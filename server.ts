import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDb, migrateDb } from './server/db.ts';
import { generateBatch, importKeys, sign } from './server/utils.ts';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const HMAC_SECRET = process.env.HMAC_SECRET || 'default-secret-change-it';

// Initialize DB
initDb();
migrateDb();

app.use(cors());
app.use(express.json());

// --- Rate Limiting Middleware (Spec §10.1) ---

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }

  entry.count++;
  if (entry.count > 10) {
    return res.status(429).json({ code: 4290, message: '请求过于频繁，请稍后再试' });
  }
  next();
}

// --- Input Validation Helpers ---

const KEY_REGEX = /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

function validateKey(key: string): boolean {
  return KEY_REGEX.test(key);
}

// --- Client API ---

app.post('/api/v1/verify', rateLimit, (req, res) => {
  const { key, machine_fingerprint } = req.body;

  if (!key || !machine_fingerprint) {
    return res.status(400).json({ code: 4000, message: 'Missing parameters' });
  }

  // Input validation (Spec §10.1)
  if (typeof key !== 'string' || !validateKey(key)) {
    return res.status(400).json({ code: 4000, message: 'Invalid key format' });
  }
  if (typeof machine_fingerprint !== 'string' || machine_fingerprint.length < 8) {
    return res.status(400).json({ code: 4000, message: 'Invalid machine fingerprint' });
  }

  try {
    const license = db.prepare('SELECT * FROM license_keys WHERE key = ?').get(key) as any;

    if (!license) {
      return res.status(404).json({ code: 4004, message: '卡密不存在或已失效' });
    }

    if (license.status === 'revoked') {
      return res.status(403).json({ code: 4005, message: '该卡密已被撤销' });
    }

    if (license.status === 'active') {
      const consume = db.transaction(() => {
        db.prepare("UPDATE license_keys SET status = 'used', used_at = datetime('now') WHERE id = ?").run(license.id);
        db.prepare('INSERT INTO license_consumptions (key_id, machine_fingerprint) VALUES (?, ?)').run(license.id, machine_fingerprint);
      });
      consume();

      const issuedAt = new Date().toISOString();
      const payload = { key, machine_fingerprint, type: 'permanent', issued_at: issuedAt };
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          action: 'consumed',
          license_key: key,
          type: 'permanent',
          issued_at: issuedAt,
          signature: sign(payload, HMAC_SECRET)
        }
      });
    }

    if (license.status === 'used') {
      const consumption = db.prepare('SELECT * FROM license_consumptions WHERE key_id = ?').get(license.id) as any;

      if (consumption.machine_fingerprint !== machine_fingerprint) {
        return res.status(403).json({ code: 4001, message: '该卡密已被其他设备绑定，无法重复使用' });
      }

      const issuedAt = new Date().toISOString();
      const payload = { key, machine_fingerprint, type: 'permanent', issued_at: issuedAt };
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          action: 'verified',
          license_key: key,
          type: 'permanent',
          issued_at: issuedAt,
          signature: sign(payload, HMAC_SECRET)
        }
      });
    }

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ code: 5000, message: 'Internal Server Error' });
  }
});

// --- Admin API ---

app.get('/api/admin/stats', (req, res) => {
  const stats = {
    total: db.prepare('SELECT COUNT(*) as count FROM license_keys').get() as any,
    active: db.prepare("SELECT COUNT(*) as count FROM license_keys WHERE status = 'active'").get() as any,
    used: db.prepare("SELECT COUNT(*) as count FROM license_keys WHERE status = 'used'").get() as any,
    revoked: db.prepare("SELECT COUNT(*) as count FROM license_keys WHERE status = 'revoked'").get() as any,
    today_consumed: db.prepare("SELECT COUNT(*) as count FROM license_keys WHERE used_at >= date('now')").get() as any
  };

  res.json({
    code: 0,
    data: {
      total: stats.total.count,
      active: stats.active.count,
      used: stats.used.count,
      revoked: stats.revoked.count,
      today_consumed: stats.today_consumed.count
    }
  });
});

app.get('/api/admin/recent', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const rows = db.prepare(`
    SELECT c.id, c.key_id, l.key, c.machine_fingerprint, c.consumed_at
    FROM license_consumptions c
    JOIN license_keys l ON c.key_id = l.id
    ORDER BY c.consumed_at DESC
    LIMIT ?
  `).all(limit);
  res.json({ code: 0, data: { list: rows } });
});

app.get('/api/admin/licenses', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  const search = req.query.search as string;

  let countQuery = 'SELECT COUNT(*) as count FROM license_keys l WHERE 1=1';
  let query = `
    SELECT l.*, c.machine_fingerprint
    FROM license_keys l
    LEFT JOIN license_consumptions c ON l.id = c.key_id
    WHERE 1=1
  `;
  const params: any[] = [];
  const countParams: any[] = [];

  if (status && status !== 'all') {
    const statusFilter = ' AND l.status = ?';
    query += statusFilter;
    countQuery += statusFilter;
    params.push(status);
    countParams.push(status);
  }

  if (search) {
    const searchFilter = ' AND l.key LIKE ?';
    query += searchFilter;
    countQuery += searchFilter;
    params.push(`%${search}%`);
    countParams.push(`%${search}%`);
  }

  query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(pageSize, (page - 1) * pageSize);

  const list = db.prepare(query).all(...params);
  const total = (db.prepare(countQuery).get(...countParams) as any).count;

  res.json({
    code: 0,
    data: {
      total,
      page,
      pageSize,
      list
    }
  });
});

app.get('/api/admin/licenses/:id', (req, res) => {
  const license = db.prepare('SELECT * FROM license_keys WHERE id = ?').get(req.params.id) as any;
  if (!license) return res.status(404).json({ code: 4004, message: '卡密不存在' });

  const consumption = db.prepare('SELECT * FROM license_consumptions WHERE key_id = ?').get(license.id) as any;
  res.json({
    code: 0,
    data: {
      ...license,
      machine_fingerprint: consumption?.machine_fingerprint || null,
      consumed_at: consumption?.consumed_at || null
    }
  });
});

app.post('/api/admin/generate', (req, res) => {
  const { count, batch } = req.body;
  if (!count || !Number.isInteger(count) || count < 1) {
    return res.status(400).json({ code: 1, message: 'Invalid count' });
  }
  if (count > 10000) {
    return res.status(400).json({ code: 1, message: 'Count exceeds maximum (10000)' });
  }

  try {
    const keys = generateBatch(count, batch || '');
    res.json({ code: 0, data: { keys, count: keys.length, batch } });
  } catch (e: any) {
    res.status(500).json({ code: 2, message: e.message });
  }
});

app.post('/api/admin/import-keys', (req, res) => {
  const { keys, batch } = req.body;
  if (!Array.isArray(keys) || keys.length === 0) {
    return res.status(400).json({ code: 1, message: 'Invalid keys array' });
  }
  const { imported, skipped } = importKeys(db, keys, batch || '');
  res.json({ code: 0, data: { imported, skipped } });
});

app.post('/api/admin/licenses/:id/revoke', (req, res) => {
  db.prepare("UPDATE license_keys SET status = 'revoked', revoked_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ code: 0, message: '已撤销' });
});

app.post('/api/admin/licenses/:id/unbind', (req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM license_consumptions WHERE key_id = ?').run(req.params.id);
    db.prepare("UPDATE license_keys SET status = 'active', used_at = NULL WHERE id = ?").run(req.params.id);
  })();
  res.json({ code: 0, message: '已解绑' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Prompt Submission API (External) ---

app.post('/api/v1/submit-prompt', rateLimit, (req, res) => {
  const { prompt, report, machine_code, license_key, input_tokens, output_tokens } = req.body;

  if (!report || !machine_code || !license_key) {
    return res.status(400).json({ code: 4000, message: '缺少必填参数' });
  }

  // prompt 可为空，代表用户没有自定义提示词用的系统默认提示词
  if (prompt !== undefined && prompt !== null && typeof prompt === 'string' && prompt.trim().length === 0) {
    return res.status(400).json({ code: 4000, message: '提示词内容无效' });
  }

  if (typeof report !== 'string' || report.trim().length === 0) {
    return res.status(400).json({ code: 4000, message: '报告内容无效' });
  }

  if (typeof machine_code !== 'string' || machine_code.trim().length === 0) {
    return res.status(400).json({ code: 4000, message: '机器码无效' });
  }

  try {
    const license = db.prepare('SELECT id FROM license_keys WHERE key = ?').get(license_key) as any;

    if (!license) {
      return res.status(404).json({ code: 4004, message: '卡密不存在' });
    }

    db.prepare(
      'INSERT INTO prompt_records (license_key, machine_code, prompt_content, report_content, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(license_key, machine_code, prompt || null, report, input_tokens || 0, output_tokens || 0);

    return res.json({ code: 0, message: '提示词已收录' });
  } catch (error) {
    console.error('Submit prompt error:', error);
    return res.status(500).json({ code: 5000, message: 'Internal Server Error' });
  }
});

// --- Admin Prompt Management API ---

app.get('/api/admin/prompts/stats', (req, res) => {
  const stats = {
    pending: db.prepare("SELECT COUNT(*) as count FROM prompt_records WHERE status = 'pending'").get() as any,
    reviewed: db.prepare("SELECT COUNT(*) as count FROM prompt_records WHERE status = 'reviewed'").get() as any,
    archived: db.prepare("SELECT COUNT(*) as count FROM prompt_records WHERE status = 'archived'").get() as any,
    total: db.prepare('SELECT COUNT(*) as count FROM prompt_records').get() as any
  };

  res.json({
    code: 0,
    data: {
      pending: stats.pending.count,
      reviewed: stats.reviewed.count,
      archived: stats.archived.count,
      total: stats.total.count
    }
  });
});

app.get('/api/admin/prompts', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  const search = req.query.search as string;

  let countQuery = 'SELECT COUNT(*) as count FROM prompt_records WHERE 1=1';
  let query = 'SELECT * FROM prompt_records WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (status && status !== 'all') {
    const statusFilter = ' AND status = ?';
    query += statusFilter;
    countQuery += statusFilter;
    params.push(status);
    countParams.push(status);
  }

  if (search) {
    const searchFilter = ' AND prompt_content LIKE ?';
    query += searchFilter;
    countQuery += searchFilter;
    params.push(`%${search}%`);
    countParams.push(`%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(pageSize, (page - 1) * pageSize);

  const list = db.prepare(query).all(...params);
  const total = (db.prepare(countQuery).get(...countParams) as any).count;

  res.json({
    code: 0,
    data: {
      total,
      page,
      pageSize,
      list
    }
  });
});

app.get('/api/admin/prompts/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM prompt_records WHERE id = ?').get(req.params.id) as any;
  if (!record) return res.status(404).json({ code: 4004, message: '记录不存在' });

  res.json({ code: 0, data: record });
});

app.put('/api/admin/prompts/:id', (req, res) => {
  const { status, admin_notes } = req.body;

  const validStatuses = ['pending', 'reviewed', 'archived'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ code: 4000, message: '无效的状态值' });
  }

  const record = db.prepare('SELECT id FROM prompt_records WHERE id = ?').get(req.params.id) as any;
  if (!record) return res.status(404).json({ code: 4004, message: '记录不存在' });

  db.prepare(
    "UPDATE prompt_records SET status = COALESCE(?, status), admin_notes = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, admin_notes, req.params.id);

  const updated = db.prepare('SELECT * FROM prompt_records WHERE id = ?').get(req.params.id);
  res.json({ code: 0, data: updated, message: '已更新' });
});

app.delete('/api/admin/prompts/:id', (req, res) => {
  const record = db.prepare('SELECT id FROM prompt_records WHERE id = ?').get(req.params.id) as any;
  if (!record) return res.status(404).json({ code: 4004, message: '记录不存在' });

  db.prepare('DELETE FROM prompt_records WHERE id = ?').run(req.params.id);
  res.json({ code: 0, message: '已删除' });
});

// Serve static assets from the React build
if (!isProd) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);
  app.get('*', async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const template = await vite.transformIndexHtml(url, `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>License Server Admin</title>
            <meta name="google" content="notranslate" />
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/src/main.tsx"></script>
          </body>
        </html>
      `);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
