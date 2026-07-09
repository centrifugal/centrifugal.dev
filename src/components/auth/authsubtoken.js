// Reproduces Centrifugo OSS subscription-token verification and the resulting
// subscription (internal/jwtverify/token_verifier_jwt.go VerifySubscribeToken +
// the subscribe-time checks in internal/client/handler.go). Signature
// verification is out of scope. OSS only: the PRO `allow` capability claim is
// not modeled here.

const EXP_FUTURE = 1893456000; // 2030-01-01
const EXP_PAST = 1577836800;   // 2020-01-01

// Override options a subscription token can carry (doc + SubscribeOptionOverride).
export const OVERRIDES = [
  ['presence', 'presence'],
  ['joinLeave', 'join_leave'],
  ['forcePushJoinLeave', 'force_push_join_leave'],
  ['forceRecovery', 'force_recovery'],
  ['forcePositioning', 'force_positioning'],
];

function parseJsonSafe(text) {
  const t = (text || '').trim();
  if (t === '') return { ok: true, value: undefined };
  try { return { ok: true, value: JSON.parse(t) }; }
  catch (e) { return { ok: false, value: undefined }; }
}

function splitList(s) {
  return (s || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
}

function step(key, label, status, detail) { return { key, label, status, detail }; }

export function effectiveUser(state) {
  return state.anonymous ? '' : (state.userID || '');
}

function subscriptionExpiration(state) {
  if (state.expireAt === 'never') return 'never (expire_at = 0; the token exp is still validated)';
  if (state.expireAt === 'future') return 'at the expire_at time';
  if (state.exp === 'valid') return 'when the token exp is reached';
  return 'never (no exp and no expire_at)';
}

export function decideSubscribe(state) {
  const trace = [];
  const uid = effectiveUser(state);
  const tokenAud = splitList(state.tokenAud);

  // 1. Audience — only when client.token.audience is configured.
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

  // 2. Issuer — only when client.token.issuer is configured.
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

  // 3. Expiration (exp).
  if (state.exp === 'expired') {
    trace.push(step('exp', 'Expiration', 'fail', 'exp is in the past — token expired.'));
    return { accepted: false, reason: 'token expired', trace };
  }
  trace.push(step('exp', 'Expiration', 'pass', state.exp === 'none' ? 'No exp claim — the token itself never expires.' : 'exp is in the future.'));

  // 4. Channel claim is required for a subscription token.
  if ((state.channel || '').trim() === '') {
    trace.push(step('channel', 'Channel claim', 'fail', 'A subscription JWT must contain a "channel" claim — it names the channel being authorized.'));
    return { accepted: false, reason: 'channel claim is required', trace };
  }
  trace.push(step('channel', 'Channel claim', 'pass', `Authorizes subscription to "${state.channel}".`));

  // 5. User match (checked at subscribe time). Empty connUser = same as sub.
  const connUser = (state.connUser || '').trim();
  if (connUser !== '' && connUser !== uid) {
    trace.push(step('user', 'User match', 'fail', `Token sub = "${uid || '(anonymous)'}" but the connection's user is "${connUser}" — the subscription token must be for the same user.`));
    return { accepted: false, reason: 'token user does not match connection user', trace };
  }
  trace.push(step('user', 'User match', connUser === '' ? 'off' : 'pass',
    connUser === '' ? 'The token’s sub must equal the connection’s authenticated user ID, or Centrifugo rejects the subscription at subscribe time.' : `Token sub matches the connection user "${uid || '(anonymous)'}".`));

  const info = parseJsonSafe(state.infoText);
  const infoError = info.ok ? null : 'info must be valid JSON.';

  const overrides = OVERRIDES
    .filter(([k]) => state.overrides[k] !== 'unset')
    .map(([k, name]) => ({ name, value: state.overrides[k] === 'true' }));

  const subscription = {
    channel: state.channel,
    user: uid === '' ? '(anonymous — empty user ID)' : uid,
    expiration: subscriptionExpiration(state),
    info: infoError ? undefined : info.value,
    overrides,
  };
  return { accepted: true, trace, subscription, infoError };
}

export function buildSubTokenPayload(state) {
  const uid = effectiveUser(state);
  const c = {};
  if (uid !== '') c.sub = uid;
  c.channel = state.channel || '';
  if (state.exp === 'valid') c.exp = EXP_FUTURE;
  else if (state.exp === 'expired') c.exp = EXP_PAST;
  if (state.expireAt === 'never') c.expire_at = 0;
  else if (state.expireAt === 'future') c.expire_at = EXP_FUTURE;
  if (state.tokenIss) c.iss = state.tokenIss;
  const aud = splitList(state.tokenAud);
  if (aud.length === 1) c.aud = aud[0];
  else if (aud.length > 1) c.aud = aud;
  const info = parseJsonSafe(state.infoText);
  if (info.ok && info.value !== undefined) c.info = info.value;
  const override = {};
  for (const [k, name] of OVERRIDES) {
    if (state.overrides[k] !== 'unset') override[name] = { value: state.overrides[k] === 'true' };
  }
  if (Object.keys(override).length) c.override = override;
  return JSON.stringify(c, null, 2);
}

export function buildSubConfig(state) {
  const token = { hmac_secret_key: 'your-secret-key' };
  if (state.cfgAudience) token.audience = state.cfgAudience;
  if (state.cfgIssuer) token.issuer = state.cfgIssuer;
  return JSON.stringify({ client: { token } }, null, 2);
}
