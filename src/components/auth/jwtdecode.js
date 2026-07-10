// Client-side JWT decoding for the token explorers' "decode" mode.
//
// Decodes the header + payload ONLY — there is no signature verification here
// (that needs the signing key and real crypto). The decoded claims are mapped
// onto the same `state` shape that decideConnect / decideSubscribe already
// understand (see authtoken.js / authsubtoken.js), so the identical claim-check
// trace and "resulting connection/subscription" panels are reused as-is.
//
// Everything runs in the browser on user interaction. During SSR the token is
// empty, so atob/TextDecoder/btoa are never touched at build time.

function padB64(s) {
  const m = s.length % 4;
  if (m === 2) return s + '==';
  if (m === 3) return s + '=';
  return s; // m === 0 (or the invalid m === 1, which atob will reject)
}

function b64urlDecode(seg) {
  const bin = atob(padB64(seg.replace(/-/g, '+').replace(/_/g, '/')));
  try {
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return bin; // fall back to the raw binary string on any decode hiccup
  }
}

// decodeJwt splits a compact JWS, decodes header + payload, and reports the
// first problem it hits. Returns { ok:false, empty:true } for blank input so
// callers can show a neutral "paste a token" state rather than an error.
export function decodeJwt(token) {
  const t = (token || '').trim().replace(/^Bearer\s+/i, '');
  if (t === '') return { ok: false, empty: true };
  const parts = t.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'A JWT has three dot-separated parts: header.payload.signature.' };
  }
  let header;
  try { header = JSON.parse(b64urlDecode(parts[0])); }
  catch (e) { return { ok: false, error: 'Header is not valid base64url-encoded JSON.' }; }
  let payload;
  try { payload = JSON.parse(b64urlDecode(parts[1])); }
  catch (e) { return { ok: false, error: 'Payload is not valid base64url-encoded JSON.' }; }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Payload must be a JSON object of claims.' };
  }
  return { ok: true, header: header || {}, payload, hasSig: parts[2] !== '' };
}

// aud may be a string or an array of strings — normalise to the space/comma
// list form the decide* functions parse via splitList.
export function audToString(aud) {
  if (Array.isArray(aud)) return aud.join(', ');
  return aud == null ? '' : String(aud);
}

// exp/expire_at → the token-state enums used by decideConnect / decideSubscribe.
export function expState(payload) {
  const hasExp = typeof payload.exp === 'number';
  const exp = !hasExp ? 'none' : (payload.exp * 1000 > Date.now() ? 'valid' : 'expired');
  let expireAt = 'absent';
  if (payload.expire_at === 0) expireAt = 'never';
  else if (typeof payload.expire_at === 'number' && payload.expire_at > 0) expireAt = 'future';
  return { exp, expireAt };
}

// Centrifugo rejects a token whose nbf (not before) is in the future with the
// same ErrTokenExpired as an expired token (token_verifier_jwt.go IsValidNotBefore).
export function isNbfFuture(payload) {
  return !!payload && typeof payload.nbf === 'number' && payload.nbf * 1000 > Date.now();
}

function relTime(ms) {
  const past = ms < 0;
  const s = Math.abs(ms) / 1000;
  const units = [['year', 31536000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      return `${past ? '' : 'in '}${n} ${name}${n === 1 ? '' : 's'}${past ? ' ago' : ''}`;
    }
  }
  const n = Math.floor(s);
  return `${past ? '' : 'in '}${n} second${n === 1 ? '' : 's'}${past ? ' ago' : ''}`;
}

// Human-readable absolute + relative time for a numeric Unix-seconds claim.
export function describeTime(sec) {
  if (typeof sec !== 'number' || !isFinite(sec)) return null;
  const ms = sec * 1000;
  const diff = ms - Date.now();
  return { abs: new Date(ms).toUTCString(), rel: relTime(diff), past: diff < 0 };
}

// Generic, token-type-agnostic warnings surfaced above the decoded payload.
export function tokenWarnings(decoded) {
  const w = [];
  if (!decoded || !decoded.ok) return w;
  const alg = decoded.header && decoded.header.alg;
  if (typeof alg === 'string' && alg.toLowerCase() === 'none') {
    w.push('Header alg is "none" — the token is unsigned. Centrifugo rejects unsigned tokens.');
  }
  if (!decoded.hasSig) {
    w.push('Token has no signature segment — Centrifugo will not accept it.');
  }
  // nbf is surfaced by the verification trace itself (a future nbf is a
  // rejection, not just a warning), so it's not duplicated here.
  return w;
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Build a sample compact JWT string (with a placeholder, unverifiable
// signature) so "load example" gives users something to decode immediately.
// Called lazily from click handlers, never at module load.
export function makeToken(payload, header) {
  const h = header || { alg: 'HS256', typ: 'JWT' };
  return [b64urlEncode(JSON.stringify(h)), b64urlEncode(JSON.stringify(payload)), 'ExampleSignatureNotVerified'].join('.');
}
