import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'license.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_keys (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        key             TEXT    NOT NULL UNIQUE,
        status          TEXT    NOT NULL DEFAULT 'active',
        generated_by    TEXT,
        created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
        used_at         DATETIME,
        revoked_at      DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
    CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status);

    CREATE TABLE IF NOT EXISTS license_consumptions (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id              INTEGER NOT NULL UNIQUE,
        machine_fingerprint TEXT    NOT NULL UNIQUE,
        consumed_at         DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (key_id) REFERENCES license_keys(id)
    );

    CREATE INDEX IF NOT EXISTS idx_consumptions_key_id ON license_consumptions(key_id);
    CREATE INDEX IF NOT EXISTS idx_consumptions_fingerprint ON license_consumptions(machine_fingerprint);

    CREATE TABLE IF NOT EXISTS prompt_records (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        license_key         TEXT    NOT NULL,
        machine_code        TEXT    NOT NULL,
        prompt_content      TEXT,
        report_content      TEXT    NOT NULL,
        input_tokens        INTEGER NOT NULL DEFAULT 0,
        output_tokens       INTEGER NOT NULL DEFAULT 0,
        status              TEXT    NOT NULL DEFAULT 'pending',
        admin_notes         TEXT,
        created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at          DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (license_key) REFERENCES license_keys(key)
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_records_license ON prompt_records(license_key);
    CREATE INDEX IF NOT EXISTS idx_prompt_records_status ON prompt_records(status);
    CREATE INDEX IF NOT EXISTS idx_prompt_records_created ON prompt_records(created_at);
  `);
}

export function migrateDb() {
  // Check if license_consumptions has UNIQUE on machine_fingerprint
  const tableInfo = db.pragma("table_info('license_consumptions_old')") as any[];
  if (tableInfo.length === 0) {
    // Table hasn't been migrated yet — check current schema
    const cols = db.pragma("table_info('license_consumptions')") as any[];
    const fpCol = cols.find(c => c.name === 'machine_fingerprint');
    // SQLite doesn't expose UNIQUE in pragma, so we check indexes
    const indexes = db.pragma("index_list('license_consumptions')") as any[];
    const hasUniqueFp = indexes.some(idx => idx.name.includes('machine_fingerprint') && idx.unique);
    if (!hasUniqueFp) {
      // Rebuild table with UNIQUE constraint
      db.exec(`
        ALTER TABLE license_consumptions RENAME TO license_consumptions_old;
        CREATE TABLE license_consumptions (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id              INTEGER NOT NULL UNIQUE,
            machine_fingerprint TEXT    NOT NULL UNIQUE,
            consumed_at         DATETIME NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (key_id) REFERENCES license_keys(id)
        );
        INSERT INTO license_consumptions (id, key_id, machine_fingerprint, consumed_at)
          SELECT id, key_id, machine_fingerprint, consumed_at FROM license_consumptions_old;
        DROP TABLE license_consumptions_old;
        CREATE INDEX idx_consumptions_key_id ON license_consumptions(key_id);
        CREATE INDEX idx_consumptions_fingerprint ON license_consumptions(machine_fingerprint);
      `);
    }
  }

  // Migrate prompt_records.prompt_content to nullable (was NOT NULL)
  const promptCols = db.pragma("table_info('prompt_records')") as any[];
  const promptContentCol = promptCols.find(c => c.name === 'prompt_content');
  if (promptContentCol && promptContentCol.notnull === 1) {
    db.exec(`
      ALTER TABLE prompt_records RENAME TO prompt_records_old;
      CREATE TABLE prompt_records (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          license_key         TEXT    NOT NULL,
          machine_code        TEXT    NOT NULL,
          prompt_content      TEXT,
          report_content      TEXT    NOT NULL,
          input_tokens        INTEGER NOT NULL DEFAULT 0,
          output_tokens       INTEGER NOT NULL DEFAULT 0,
          status              TEXT    NOT NULL DEFAULT 'pending',
          admin_notes         TEXT,
          created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
          updated_at          DATETIME NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (license_key) REFERENCES license_keys(key)
      );
      INSERT INTO prompt_records (id, license_key, machine_code, prompt_content, report_content, input_tokens, output_tokens, status, admin_notes, created_at, updated_at)
        SELECT id, license_key, machine_code, prompt_content, report_content, input_tokens, output_tokens, status, admin_notes, created_at, updated_at FROM prompt_records_old;
      DROP TABLE prompt_records_old;
      CREATE INDEX idx_prompt_records_license ON prompt_records(license_key);
      CREATE INDEX idx_prompt_records_status ON prompt_records(status);
      CREATE INDEX idx_prompt_records_created ON prompt_records(created_at);
    `);
  }
}

export default db;
