// Minimal in-browser HS256 JWT signer (Web Crypto, no dependencies). For local
// development / testing only — signing happens client-side with a secret the
// user types; in production your backend issues tokens.

function b64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signHS256(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const data = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return data + '.' + b64url(new Uint8Array(sig));
}

// Build the claims object for a connection or subscription token.
export function buildClaims({ type, userID, channel, ttlSec, nowSec }) {
  const claims = {};
  if (userID) claims.sub = userID;
  if (type === 'subscription') claims.channel = channel || '';
  if (ttlSec > 0) claims.exp = nowSec + ttlSec;
  return claims;
}
