import crypto from 'crypto';

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
