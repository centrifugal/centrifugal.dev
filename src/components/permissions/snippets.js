// Turns an explorer state into copy-pasteable artifacts: a Centrifugo config
// snippet and JWT token payloads that reproduce the current permission model.
// Pure functions so they can be unit-tested without React.

// A fixed, obviously-a-placeholder future timestamp (2030-01-01 UTC). Kept
// constant so snippets are deterministic; readers replace it with a real value.
const EXAMPLE_EXP = 1893456000;

function subject(state) {
  return state.anonymous ? '' : (state.userID || '<user-id>');
}

// Namespace name = the part of the channel before ":" (channels without a
// namespace live in the default, top-level channel options). Mirrors
// container.go namespaceName: the private prefix is stripped BEFORE the split,
// so "$secret:room" resolves to namespace "secret".
export function namespaceName(channel, privatePrefix = '$') {
  let ch = channel || '';
  if (privatePrefix && ch.startsWith(privatePrefix)) ch = ch.slice(privatePrefix.length);
  const i = ch.indexOf(':');
  if (i <= 0) return '';
  return ch.slice(0, i);
}

function namespaceOptions(op, state) {
  const o = {};
  if (op === 'subscribe') {
    if (state.allowUserLimited) o.allow_user_limited_channels = true;
    if (state.subscribeProxy) o.subscribe_proxy_enabled = true;
    if (state.allowSubscribeForClient) o.allow_subscribe_for_client = true;
    if (state.allowSubscribeForAnonymous) o.allow_subscribe_for_anonymous = true;
  } else if (op === 'publish') {
    if (state.publishProxy) o.publish_proxy_enabled = true;
    if (state.allowPublishForClient) o.allow_publish_for_client = true;
    if (state.allowPublishForSubscriber) o.allow_publish_for_subscriber = true;
    if (state.allowPublishForAnonymous) o.allow_publish_for_anonymous = true;
  } else if (op === 'history') {
    if (state.historyConfigured) { o.history_size = 100; o.history_ttl = '300s'; }
    if (state.allowHistoryForClient) o.allow_history_for_client = true;
    if (state.allowHistoryForSubscriber) o.allow_history_for_subscriber = true;
    if (state.allowHistoryForAnonymous) o.allow_history_for_anonymous = true;
  } else if (op === 'presence') {
    if (state.presenceEnabled) o.presence = true;
    if (state.allowPresenceForClient) o.allow_presence_for_client = true;
    if (state.allowPresenceForSubscriber) o.allow_presence_for_subscriber = true;
    if (state.allowPresenceForAnonymous) o.allow_presence_for_anonymous = true;
  }
  return o;
}

export function buildConfig(op, state) {
  const opts = namespaceOptions(op, state);
  const ns = namespaceName(state.channel, state.privatePrefix);
  const notes = [];

  let root;
  if (ns) {
    root = { channel: { namespaces: [{ name: ns, ...opts }] } };
  } else {
    root = { channel: { ...opts } };
    notes.push('This channel has no namespace prefix, so options go into the default (top-level) `channel` config.');
  }

  if ((op === 'subscribe' && state.subscribeProxy) || (op === 'publish' && state.publishProxy)) {
    notes.push('The proxy flag needs a configured proxy — define one under `channel.proxy` (or a named proxy) pointing at your backend endpoint. See the Proxy docs.');
  }
  if (op === 'history' && state.historyConfigured) {
    notes.push('`history_size` / `history_ttl` are example values — tune them to your retention needs.');
  }
  if (op === 'subscribe' && (state.channel || '').startsWith('$')) {
    notes.push('Channels starting with the private prefix ("$") always require a subscription token.');
  }

  return { code: JSON.stringify(root, null, 2), notes, empty: Object.keys(opts).length === 0 };
}

export function buildTokens(op, state, connCaps) {
  const tokens = [];
  const sub = subject(state);

  const wantSubToken = (op === 'subscribe' && state.subToken === 'valid') ||
    (op !== 'subscribe' && Array.isArray(state.channelCapsAllow) && state.channelCapsAllow.length > 0);

  if (wantSubToken) {
    const claims = { sub, channel: state.channel, exp: EXAMPLE_EXP };
    if (op !== 'subscribe' && state.channelCapsAllow.length > 0) claims.allow = state.channelCapsAllow;
    tokens.push({
      title: 'Subscription token — JWT claims',
      code: JSON.stringify(claims, null, 2),
      notes: [
        'Sign these claims with your token secret and return the JWT from the client SDK `getToken` callback for this subscription.',
        'Replace `exp` with a real future Unix timestamp.',
      ],
    });
  }

  if (Array.isArray(connCaps) && connCaps.length > 0) {
    const claims = { sub, exp: EXAMPLE_EXP, caps: connCaps };
    tokens.push({
      title: 'Connection token — JWT claims',
      code: JSON.stringify(claims, null, 2),
      notes: [
        'Include this `caps` claim in the connection JWT your backend issues at connect time.',
        'Replace `exp` with a real future Unix timestamp.',
      ],
    });
  }

  return tokens;
}
