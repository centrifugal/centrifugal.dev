// Reproduces Centrifugo OSS connection-token verification & the resulting
// connection (internal/jwtverify/token_verifier_jwt.go VerifyConnectToken +
// validateClaims). Signature verification is out of scope (it needs your
// secret and real crypto) — this models the CLAIM-level checks and what the
// authenticated connection becomes. OSS only: no caps / meta_from_claim /
// labels (those are PRO).

// Fixed, obviously-placeholder timestamps so snippets are deterministic.
const EXP_FUTURE = 1893456000; // 2030-01-01
const EXP_PAST = 1577836800;   // 2020-01-01

function splitList(s) {
  return (s || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
}

function parseJsonSafe(text) {
  const t = (text || '').trim();
  if (t === '') return { ok: true, value: undefined };
  try { return { ok: true, value: JSON.parse(t) }; }
  catch (e) { return { ok: false, value: undefined }; }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function step(key, label, status, detail) { return { key, label, status, detail }; }

export function effectiveUser(state) {
  return state.anonymous ? '' : (state.userID || '');
}

function connectionExpiration(state) {
  if (state.expireAt === 'never') return 'never (expire_at = 0; the token exp is still validated)';
  if (state.expireAt === 'future') return 'at the expire_at time';
  // expire_at absent → follows the token exp
  if (state.exp === 'valid') return 'when the token exp is reached';
  return 'never (no exp and no expire_at)';
}

export function decideConnect(state) {
  const trace = [];
  const uid = effectiveUser(state);
  const tokenAud = splitList(state.tokenAud);

  // 1. Audience — only checked when client.token.audience is configured.
  if (state.cfgAudience) {
    if (tokenAud.includes(state.cfgAudience)) {
      trace.push(step('aud', 'Audience', 'pass', `Server expects aud "${state.cfgAudience}" and the token carries it.`));
    } else {
      trace.push(step('aud', 'Audience', 'fail', `Server client.token.audience = "${state.cfgAudience}", but token aud = [${tokenAud.join(', ') || '—'}].`));
      return { accepted: false, reason: 'invalid audience', trace };
    }
  } else {
    trace.push(step('aud', 'Audience', 'off', 'client.token.audience not set — audience is not verified.'));
  }

  // 2. Issuer — only checked when client.token.issuer is configured.
  if (state.cfgIssuer) {
    if ((state.tokenIss || '') === state.cfgIssuer) {
      trace.push(step('iss', 'Issuer', 'pass', `Server expects iss "${state.cfgIssuer}" and the token matches.`));
    } else {
      trace.push(step('iss', 'Issuer', 'fail', `Server client.token.issuer = "${state.cfgIssuer}", but token iss = "${state.tokenIss || ''}".`));
      return { accepted: false, reason: 'invalid issuer', trace };
    }
  } else {
    trace.push(step('iss', 'Issuer', 'off', 'client.token.issuer not set — issuer is not verified.'));
  }

  // 3. Channel claim is forbidden in a connection token.
  if (state.channelClaim) {
    trace.push(step('channel', 'Channel claim', 'fail', 'A connection JWT must not contain a "channel" claim — that is only for subscription tokens.'));
    return { accepted: false, reason: 'channel claim in connection token', trace };
  }

  // 4. Expiration (exp). Absent exp = no token expiration.
  if (state.exp === 'expired') {
    trace.push(step('exp', 'Expiration', 'fail', 'exp is in the past — token expired.'));
    return { accepted: false, reason: 'token expired', trace };
  }
  trace.push(step('exp', 'Expiration', 'pass', state.exp === 'none' ? 'No exp claim — the token itself never expires.' : 'exp is in the future.'));

  const info = parseJsonSafe(state.infoText);
  const meta = parseJsonSafe(state.metaText);
  const infoError = info.ok ? null : 'info must be valid JSON.';
  let metaError = null;
  if (!meta.ok) metaError = 'meta must be valid JSON.';
  else if (meta.value !== undefined && !isPlainObject(meta.value)) metaError = 'meta must be a JSON object, e.g. {"role": "admin"}.';

  const connection = {
    user: uid === '' ? '(anonymous — empty user ID)' : uid,
    expiration: connectionExpiration(state),
    serverSideSubscriptions: splitList(state.channelsText),
    info: infoError ? undefined : info.value,
    meta: metaError ? undefined : meta.value,
  };
  return { accepted: true, trace, connection, infoError, metaError };
}

export function buildTokenPayload(state) {
  const uid = effectiveUser(state);
  const c = {};
  if (uid !== '') c.sub = uid; // anonymous → no sub claim
  if (state.exp === 'valid') c.exp = EXP_FUTURE;
  else if (state.exp === 'expired') c.exp = EXP_PAST;
  if (state.expireAt === 'never') c.expire_at = 0;
  else if (state.expireAt === 'future') c.expire_at = EXP_FUTURE;
  if (state.tokenIss) c.iss = state.tokenIss;
  const aud = splitList(state.tokenAud);
  if (aud.length === 1) c.aud = aud[0];
  else if (aud.length > 1) c.aud = aud;
  const chans = splitList(state.channelsText);
  if (chans.length) c.channels = chans;
  const info = parseJsonSafe(state.infoText);
  if (info.ok && info.value !== undefined) c.info = info.value;
  const meta = parseJsonSafe(state.metaText);
  if (meta.ok && meta.value !== undefined && isPlainObject(meta.value)) c.meta = meta.value;
  return JSON.stringify(c, null, 2);
}

export function buildConnectConfig(state) {
  const token = { hmac_secret_key: 'your-secret-key' };
  if (state.cfgAudience) token.audience = state.cfgAudience;
  if (state.cfgIssuer) token.issuer = state.cfgIssuer;
  return JSON.stringify({ client: { token } }, null, 2);
}
