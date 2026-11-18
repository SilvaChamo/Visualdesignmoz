/**
 * Web Push sem dependências (só o módulo `crypto` do Node): chaves VAPID (RFC 8292), cifra do conteúdo (RFC 8291, aes128gcm de
 * RFC 8188) e envio ao serviço de notificações do navegador. Usado pelos avisos do VhostMail com o VhostMail fechado
 * (Silva, 18/11/2026). Sem `web-push` de propósito: o deploy usa `npm ci` e uma dependência nova exigiria mexer no package-lock.
 */
import { createECDH, createCipheriv, createPrivateKey, createSign, hkdfSync, randomBytes } from 'node:crypto';

export type Subscricao = { endpoint: string; p256dh: string; auth: string };
export type ChavesVapid = { publicKey: string; privateKey: string };

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');
const deB64u = (s: string) => Buffer.from(s, 'base64url');

/** Par de chaves VAPID novo (P-256): pública em 65 bytes (04 || x || y) e privada em 32 bytes, ambas em base64url */
export function novasChavesVapid(): ChavesVapid {
  const e = createECDH('prime256v1');
  e.generateKeys();
  return { publicKey: b64u(e.getPublicKey()), privateKey: b64u(e.getPrivateKey()) };
}

/** Cabeçalho Authorization de VAPID para o serviço de notificações do `endpoint` (JWT ES256, válido 12 h) */
export function cabecalhoVapid(endpoint: string, chaves: ChavesVapid, sujeito: string, agora = Date.now()): string {
  const aud = new URL(endpoint).origin;
  const cabeca = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(agora / 1000) + 12 * 3600, sub: sujeito })));
  const pub = deB64u(chaves.publicKey);
  const chave = createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: chaves.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  const assinatura = createSign('SHA256').update(`${cabeca}.${corpo}`).sign({ key: chave, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${cabeca}.${corpo}.${b64u(assinatura)}, k=${chaves.publicKey}`;
}

/** Cifra `conteudo` para a subscrição (RFC 8291). `fixos` só serve para testes (sal e chave efémera conhecidos). */
export function cifrar(conteudo: Buffer, sub: { p256dh: string; auth: string }, fixos?: { sal?: Buffer; efemera?: { publica: Buffer; privada: Buffer } }): Buffer {
  const uaPublica = deB64u(sub.p256dh);
  const segredoAuth = deB64u(sub.auth);
  if (uaPublica.length !== 65 || uaPublica[0] !== 4) throw new Error('chave p256dh inválida');
  if (segredoAuth.length !== 16) throw new Error('segredo auth inválido');
  if (conteudo.length > 3993) throw new Error('conteúdo grande de mais para um aviso');
  const ecdh = createECDH('prime256v1');
  if (fixos?.efemera) ecdh.setPrivateKey(fixos.efemera.privada);
  else ecdh.generateKeys();
  const asPublica = ecdh.getPublicKey();
  const segredo = ecdh.computeSecret(uaPublica);
  const sal = fixos?.sal || randomBytes(16);
  // RFC 8291 §3.4: IKM = HKDF(auth, ecdh, "WebPush: info\0" || ua_public || as_public, 32)
  const ikm = Buffer.from(hkdfSync('sha256', segredo, segredoAuth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublica, asPublica]), 32));
  // RFC 8188: chave de conteúdo (16 bytes) e nonce (12 bytes)
  const cek = Buffer.from(hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cifra = createCipheriv('aes-128-gcm', cek, nonce);
  // um só registo: conteúdo || 0x02 (delimitador do último registo)
  const dados = Buffer.concat([cifra.update(Buffer.concat([conteudo, Buffer.from([2])])), cifra.final(), cifra.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([asPublica.length]), asPublica, dados]);
}

export type ResultadoEnvio = { ok: boolean; estado: number; gone: boolean; erro?: string };

/** Envia um aviso. `gone` = a subscrição já não existe (404/410): deve apagar-se. */
export async function enviarPush(sub: Subscricao, conteudo: object, chaves: ChavesVapid, sujeito: string): Promise<ResultadoEnvio> {
  try {
    const corpo = cifrar(Buffer.from(JSON.stringify(conteudo), 'utf8'), sub);
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: cabecalhoVapid(sub.endpoint, chaves, sujeito),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(corpo.length),
        TTL: '86400',
        Urgency: 'high',
      },
      body: new Uint8Array(corpo),
      signal: AbortSignal.timeout(15_000),
    });
    const gone = r.status === 404 || r.status === 410;
    return { ok: r.status >= 200 && r.status < 300, estado: r.status, gone, ...(r.ok ? {} : { erro: (await r.text().catch(() => '')).slice(0, 200) }) };
  } catch (e) {
    return { ok: false, estado: 0, gone: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
