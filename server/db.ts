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
}

export default db;
