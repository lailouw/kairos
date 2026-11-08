// Serveur de notifications ZEPHIR (Cloudflare Worker).
// Il ne garde rien : l'appli lui envoie l'abonnement du destinataire + le texte, il le chiffre (RFC 8291),
// le signe avec la clé VAPID (secret VAPID_PRIVATE_JWK) et le transmet au service de notifications du téléphone.
// shortcut: n'importe qui peut appeler ce serveur depuis l'appli, mais il ne peut viser que des abonnements ZEPHIR, qui sont chiffrés dans le Gist.
const ORIGIN = 'https://lailouw.github.io';
const VAPID_PUBLIC = 'BA8OvB8_K_aRLSOuR_pK5I_mpw4JIEs0Y7-8taX4r-Vh2nfFb8zeZ3xIrdGALzrw_vCMgOBqjRxo3pJBiFCvDLQ';
const CONTACT = 'https://lailouw.github.io/kairos/';
// seuls les vrais services de notifications (Google, Mozilla, Apple, Microsoft)
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/;

const TE = new TextEncoder();
const b64u = u => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length } return o };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

export async function encrypt(sub, text) { // aes128gcm, un seul bloc
  const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const ua = await crypto.subtle.importKey('raw', uaPub, ECDH, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256));
  const ikm = await hkdf(auth, secret, cat(TE.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, TE.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, TE.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, cat(TE.encode(text), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([65]), asPub, ct);
}

export async function vapid(endpoint, jwk) {
  const enc = o => b64u(TE.encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT });
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, TE.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}

export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || req.headers.get('Origin') !== ORIGIN) return new Response('non', { status: 403, headers: cors });
    let sub, data;
    try {
      ({ sub, data } = await req.json());
      const u = new URL(sub.endpoint);
      if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname) || !sub.keys.p256dh || !sub.keys.auth) throw 0;
      data = JSON.stringify({ title: String(data.title).slice(0, 100), body: String(data.body).slice(0, 500), tag: String(data.tag || '').slice(0, 64) });
    } catch (e) { return new Response('demande invalide', { status: 400, headers: cors }) }
    const r = await fetch(sub.endpoint, {
      method: 'POST', body: await encrypt(sub, data),
      headers: { Authorization: await vapid(sub.endpoint, JSON.parse(env.VAPID_PRIVATE_JWK)), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' }
    });
    return new Response(null, { status: r.ok ? 204 : r.status, headers: cors }); // 404/410 : abonnement expiré
  }
};
