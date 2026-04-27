import crypto from 'crypto';
import type Database from 'better-sqlite3';

const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHARSET_LEN = CHARSET.length;

function randomSegment() {
    let part = '';
    for (let i = 0; i < 4; i++) {
        part += CHARSET[crypto.randomInt(0, CHARSET_LEN)];
    }
    return part;
}

export function generateOne() {
    return `${randomSegment()}-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

export function sign(payload: any, secret: string) {
    const json = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(json);
    return hmac.digest('base64');
}

/**
 * Batch generate keys with Set dedup and maxAttempts safety valve (Spec §6.3)
 */
export function generateBatch(count: number, batch: string): string[] {
    const generated = new Set<string>();
    const maxAttempts = count * 10;
    let attempts = 0;

    while (generated.size < count && attempts < maxAttempts) {
        generated.add(generateOne());
        attempts++;
    }

    if (generated.size < count) {
        throw new Error(
            `生成失败：尝试 ${maxAttempts} 次后仍不足 ${count} 个，` +
            `可能字符池过小或已有大量重复`
        );
    }

    return Array.from(generated);
}

/**
 * Import external keys, returns {imported, skipped} (Spec §6.3)
 */
export function importKeys(db: Database, keys: string[], batch: string): { imported: number; skipped: number } {
    const insertStmt = db.prepare(
        'INSERT OR IGNORE INTO license_keys (key, generated_by) VALUES (?, ?)'
    );

    let imported = 0;
    let skipped = 0;

    const importMany = db.transaction((items: string[]) => {
        for (const key of items) {
            const result = insertStmt.run(key, batch);
            if (result.changes > 0) {
                imported++;
            } else {
                skipped++;
            }
        }
    });

    importMany(keys);
    return { imported, skipped };
}
