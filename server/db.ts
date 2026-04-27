import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production/cloud run, we'll store in the root or a data folder
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
        machine_fingerprint TEXT    NOT NULL,
        consumed_at         DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (key_id) REFERENCES license_keys(id)
    );

    CREATE INDEX IF NOT EXISTS idx_consumptions_key_id ON license_consumptions(key_id);
    CREATE INDEX IF NOT EXISTS idx_consumptions_fingerprint ON license_consumptions(machine_fingerprint);
  `);
}

export default db;
