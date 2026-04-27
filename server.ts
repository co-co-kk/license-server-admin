import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDb } from './server/db.ts';
import { generateOne, sign } from './server/utils.ts';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const HMAC_SECRET = process.env.HMAC_SECRET || 'default-secret-change-it';

// Initialize DB
initDb();

app.use(cors());
app.use(express.json());

// --- Client API ---

app.post('/api/v1/verify', (req, res) => {
  const { key, machine_fingerprint } = req.body;

  if (!key || !machine_fingerprint) {
    return res.status(400).json({ code: 4000, message: 'Missing parameters' });
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
      // First time consumption
      const consume = db.transaction(() => {
        db.prepare("UPDATE license_keys SET status = 'used', used_at = datetime('now') WHERE id = ?").run(license.id);
        db.prepare('INSERT INTO license_consumptions (key_id, machine_fingerprint) VALUES (?, ?)').run(license.id, machine_fingerprint);
      });
      consume();

      const payload = { key, machine_fingerprint, type: 'permanent', issued_at: new Date().toISOString() };
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          action: 'consumed',
          license_key: key,
          type: 'permanent',
          signature: sign(payload, HMAC_SECRET)
        }
      });
    }

    if (license.status === 'used') {
      const consumption = db.prepare('SELECT * FROM license_consumptions WHERE key_id = ?').get(license.id) as any;
      
      if (consumption.machine_fingerprint !== machine_fingerprint) {
        return res.status(403).json({ code: 4001, message: '该卡密已被其他设备绑定，无法重复使用' });
      }

      const payload = { key, machine_fingerprint, type: 'permanent', issued_at: new Date().toISOString() };
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          action: 'verified',
          license_key: key,
          type: 'permanent',
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

app.post('/api/admin/generate', (req, res) => {
  const { count, batch } = req.body;
  if (!count || count < 1) return res.status(400).json({ code: 1, message: 'Invalid count' });

  const keys: string[] = [];
  const insert = db.transaction((items: string[]) => {
    for (const key of items) {
      db.prepare('INSERT OR IGNORE INTO license_keys (key, generated_by) VALUES (?, ?)').run(key, batch);
    }
  });

  for (let i = 0; i < count; i++) {
    keys.push(generateOne());
  }

  insert(keys);
  res.json({ code: 0, data: { count: keys.length, batch } });
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
