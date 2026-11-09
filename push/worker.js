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

const notif = d => JSON.stringify({ title: String(d.title).slice(0, 100), body: String(d.body).slice(0, 500), tag: String(d.tag || '').slice(0, 64) });
const envoyer = async (endpoint, body, env) => fetch(endpoint, {
  method: 'POST', body,
  headers: { Authorization: await vapid(endpoint, JSON.parse(env.VAPID_PRIVATE_JWK)), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' }
});

// Rappels programmés (tâches non cochées) : un Durable Object par abonnement, réveillé par une alarme à l'heure du prochain rappel.
// Les textes sont chiffrés pour le téléphone dès la réception : ce qui est gardé ici est illisible pour le serveur.
export class Rappels {
  constructor(state, env) { this.state = state; this.env = env }
  async fetch(req) { // la liste reçue remplace l'ancienne
    const l = await req.json();
    await this.state.storage.put('l', l);
    if (l.length) await this.state.storage.setAlarm(Math.min(...l.map(r => r.at))); else await this.state.storage.deleteAlarm();
    return new Response(null, { status: 204 });
  }
  async alarm() {
    const l = await this.state.storage.get('l') || [], now = Date.now() + 30000;
    for (const r of l.filter(r => r.at <= now)) await envoyer(r.endpoint, unb64u(r.body), this.env).catch(() => {});
    const reste = l.filter(r => r.at > now);
    await this.state.storage.put('l', reste);
    if (reste.length) await this.state.storage.setAlarm(Math.min(...reste.map(r => r.at)));
  }
}

export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || req.headers.get('Origin') !== ORIGIN) return new Response('non', { status: 403, headers: cors });
    let sub, data, rappels;
    try {
      ({ sub, data, rappels } = await req.json());
      const u = new URL(sub.endpoint);
      if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname) || !sub.keys.p256dh || !sub.keys.auth) throw 0;
      if (new URL(req.url).pathname === '/rappels') { // { sub, rappels: [{ at, data }] } : au plus 50, dans les 8 jours ; remplace la liste précédente
        const max = Date.now() + 8 * 864e5;
        if (!Array.isArray(rappels) || rappels.length > 50 || rappels.some(r => !(r.at > 0 && r.at < max))) throw 0;
        const l = await Promise.all(rappels.map(async r => ({ at: r.at, endpoint: sub.endpoint, body: b64u(await encrypt(sub, notif(r.data))) })));
        await env.RAPPELS.get(env.RAPPELS.idFromName(sub.endpoint)).fetch('https://do/', { method: 'POST', body: JSON.stringify(l) });
        return new Response(null, { status: 204, headers: cors });
      }
      data = notif(data);
    } catch (e) { return new Response('demande invalide', { status: 400, headers: cors }) }
    const r = await envoyer(sub.endpoint, await encrypt(sub, data), env);
    return new Response(null, { status: r.ok ? 204 : r.status, headers: cors }); // 404/410 : abonnement expiré
  }
};
