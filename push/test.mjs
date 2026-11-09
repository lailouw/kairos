// Vérifie le serveur sans rien envoyer : node push/test.mjs
// Déchiffre le message comme le ferait le téléphone, et contrôle la signature VAPID.
import assert from 'node:assert';
import worker, { encrypt, vapid, Rappels } from './worker.js';
const s = crypto.subtle, TE = new TextEncoder(), ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const hkdf = async (salt, ikm, info, len) => new Uint8Array(await s.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await s.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));
const cat = (...a) => Uint8Array.from(a.flatMap(x => [...x]));

// faux téléphone
const ua = await s.generateKey(ECDH, true, ['deriveBits']);
const uaPub = new Uint8Array(await s.exportKey('raw', ua.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: Buffer.from(uaPub).toString('base64url'), auth: Buffer.from(auth).toString('base64url') } };

const msg = JSON.stringify({ title: 'ZEPHIR', body: 'Clara a créé un évènement partagé : Restaurant' });
const b = await encrypt(sub, msg);
const salt = b.slice(0, 16), asPub = b.slice(21, 86), ct = b.slice(86);
assert.equal(b[20], 65);
const secret = new Uint8Array(await s.deriveBits({ name: 'ECDH', public: await s.importKey('raw', asPub, ECDH, false, []) }, ua.privateKey, 256));
const ikm = await hkdf(auth, secret, cat(TE.encode('WebPush: info\0'), uaPub, asPub), 32);
const cek = await hkdf(salt, ikm, TE.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, TE.encode('Content-Encoding: nonce\0'), 12);
const pt = new Uint8Array(await s.decrypt({ name: 'AES-GCM', iv: nonce }, await s.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
assert.equal(pt.at(-1), 2);
assert.equal(new TextDecoder().decode(pt.slice(0, -1)), msg);

// signature VAPID avec une clé de test
const kp = await s.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const h = await vapid(sub.endpoint, await s.exportKey('jwk', kp.privateKey));
const [, jwt] = h.match(/^vapid t=([^,]+), k=/);
const [hd, pl, sig] = jwt.split('.');
assert.equal(JSON.parse(Buffer.from(pl, 'base64url')).aud, 'https://fcm.googleapis.com');
assert.ok(await s.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, Buffer.from(sig, 'base64url'), TE.encode(hd + '.' + pl)));

// rappels : la route /rappels range la liste chiffrée, l'alarme envoie ce qui est dû et se reprogramme pour le reste
const env = { VAPID_PRIVATE_JWK: JSON.stringify(await s.exportKey('jwk', kp.privateKey)) };
const mem = new Map(); let alarme = null;
const storage = { put: async (k, v) => mem.set(k, v), get: async k => mem.get(k), setAlarm: async t => alarme = t, deleteAlarm: async () => alarme = null };
const doc = new Rappels({ storage }, env);
env.RAPPELS = { idFromName: n => n, get: () => ({ fetch: (u, o) => doc.fetch(new Request(u, o)) }) };
const now = Date.now(), req = rappels => new Request('https://w/rappels', { method: 'POST', headers: { Origin: 'https://lailouw.github.io' }, body: JSON.stringify({ sub, rappels }) });
assert.equal((await worker.fetch(req([{ at: now - 1000, data: { title: 'ZEPHIR', body: 'a' } }, { at: now + 3600e3, data: { title: 'ZEPHIR', body: 'b' } }]), env)).status, 204);
assert.equal(alarme, now - 1000);
assert.ok(!JSON.stringify(mem.get('l')).includes('"b"')); // gardé chiffré
const envoyes = []; globalThis.fetch = async (u, o) => { envoyes.push(u); return new Response(null, { status: 201 }) };
await doc.alarm();
assert.equal(envoyes.length, 1); assert.equal(mem.get('l').length, 1); assert.equal(alarme, now + 3600e3);
assert.equal((await worker.fetch(req([{ at: now + 30 * 864e5, data: {} }]), env)).status, 400); // trop loin
await worker.fetch(req([]), env); assert.equal(alarme, null);
console.log('ok : chiffrement, signature et rappels corrects');
