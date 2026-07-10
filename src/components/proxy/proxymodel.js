// Source of truth for the ProxyExplorer widget.
//
// Field lists, contexts and response shapes are transcribed from the Centrifugo
// PRO source — internal/proxyproto/proxy.proto and internal/proxy/*.go — NOT
// from the prose docs, so the widget can double as a check on the docs.
//
// Every panel (request / response / outcome / config / code) is generated from
// the descriptors below.

const CLIENT = '9336a229-2400-4ebc-8c50-0a643d22e8a0';
const B64 = 'eyJpbnB1dCI6InRleHQifQ=='; // example base64 (of {"input":"text"})

// ---- helpers ---------------------------------------------------------------

// A JSON payload field that becomes a base64 string field in binary mode.
function jsonOrB64(obj, name, value, binary) {
  if (value === undefined) return;
  if (binary) obj['b64' + name] = B64;
  else obj[name] = value;
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

// ---- event descriptors -----------------------------------------------------
// tier: 'OSS' | 'OSS-exp' | 'PRO' | 'PRO-preview'
// shape: 'reqresp' | 'stream' | 'batch'
// clientCtx: request carries client/transport/protocol/encoding (+ headers)
// userMeta: request carries user + meta (authenticated context)
// named: event can reference a named proxy from a namespace

export const EVENTS = [
  {
    id: 'connect', label: 'Connect', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: false, headers: true, named: false,
    err: true, disc: true,
    dataMeaning: 'Custom data the client attached in the SDK constructor (optional).',
    enable: { kind: 'client', key: 'connect' },
    reqToggles: [
      { key: 'sendName', label: 'client sent name/version', def: true },
      { key: 'sendData', label: 'client sent data', def: false },
      { key: 'reqChannels', label: 'client requested server-side channels', def: false },
    ],
    resToggles: [
      { key: 'expire', label: 'expire_at (connection expiration)', def: false },
      { key: 'info', label: 'info (presence / join-leave)', def: false },
      { key: 'meta', label: 'meta (server-side only)', def: false },
      { key: 'subs', label: 'subs (server-side subscriptions)', def: false },
      { key: 'data', label: 'data (returned to client)', def: false },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json' };
      if (s.sendName) { r.name = 'js'; r.version = '3.1.0'; }
      if (s.sendData) jsonOrB64(r, 'data', { room: 'general' }, s.binary);
      if (s.reqChannels) r.channels = ['news', 'personal:56'];
      return r;
    },
    buildResult(s) {
      const r = { user: '56' };
      if (s.expire) r.expire_at = 1893456000;
      if (s.info) { if (s.binary) r.b64info = B64; else r.info = { name: 'Alice' }; }
      if (s.meta) r.meta = { role: 'admin' };
      if (s.subs) r.subs = { 'personal:56': {} };
      if (s.data) { if (s.binary) r.b64data = B64; else r.data = { welcome: true }; }
      return r;
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'REJECTED', lines: [['error', 'client receives the error on connect; connection is not established']] };
      if (s.mode === 'disconnect') return { status: 'DISCONNECTED', lines: [['disconnect', 'connection closed with your code/reason']] };
      const lines = [['user', '56 (authenticated)'], ['expires', s.expire ? 'at expire_at (needs refresh)' : 'never']];
      if (s.subs) lines.push(['server subs', 'personal:56']);
      if (s.info) lines.push(['info', 'attached — visible in presence & join/leave']);
      if (s.meta) lines.push(['meta', 'attached — server-side only, sent to later proxies']);
      return { status: 'ACCEPTED', lines };
    },
  },

  {
    id: 'refresh', label: 'Refresh', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: true, headers: true, named: false,
    err: false, disc: false, // handler ignores error/disconnect for refresh
    dataMeaning: 'No client payload — fired by Centrifugo when a connection is about to expire.',
    enable: { kind: 'client', key: 'refresh' },
    reqToggles: [],
    resToggles: [
      { key: 'expired', label: 'expired: true (stop the connection)', def: false },
      { key: 'info', label: 'info (update connection info)', def: false },
      { key: 'meta', label: 'meta (update connection meta)', def: false },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56' };
      if (s.includeMeta) r.meta = { role: 'admin' };
      return r;
    },
    buildResult(s) {
      if (s.expired) return { expired: true };
      const r = { expire_at: 1893456000 };
      if (s.info) r.info = { name: 'Alice' };
      if (s.meta) r.meta = { role: 'admin' };
      return r;
    },
    outcome(s) {
      if (s.expired) return { status: 'EXPIRED', lines: [['expired', 'connection is considered expired and will be disconnected']] };
      return { status: 'EXTENDED', lines: [['expires', 'pushed to the new expire_at']] };
    },
  },

  {
    id: 'subscribe', label: 'Subscribe', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: true, headers: true, named: true,
    err: true, disc: true,
    dataMeaning: 'Custom data the client attached to this subscription (optional).',
    enable: { kind: 'channel', key: 'subscribe' },
    reqToggles: [
      { key: 'sendToken', label: 'client sent a subscription token', def: false },
      { key: 'sendData', label: 'client sent subscription data', def: false },
    ],
    resToggles: [
      { key: 'info', label: 'info (channel presence info)', def: false },
      { key: 'override', label: 'override channel options', def: false },
      { key: 'expire', label: 'expire_at (subscription expiration)', def: false },
      { key: 'allow', label: 'allow — channel capabilities (PRO)', def: false },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56', channel: 'chat:index' };
      if (s.sendToken) r.token = '<subscription-JWT>';
      if (s.includeMeta) r.meta = { role: 'admin' };
      if (s.sendData) jsonOrB64(r, 'data', { tab: 'main' }, s.binary);
      return r;
    },
    buildResult(s) {
      const r = {};
      if (s.info && !s.binary) r.info = { admin: true };
      else if (s.info && s.binary) r.b64info = B64;
      if (s.expire) r.expire_at = 1893456000;
      if (s.override) r.override = { presence: { value: true }, join_leave: { value: true } };
      if (s.allow) r.allow = ['pub', 'hst', 'prs'];
      return r;
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'REJECTED', lines: [['error', "client's subscription to chat:index is rejected"]] };
      if (s.mode === 'disconnect') return { status: 'DISCONNECTED', lines: [['disconnect', 'connection closed with your code/reason']] };
      const lines = [['channel', 'chat:index — subscription allowed']];
      if (s.override) lines.push(['override', 'presence & join/leave turned on for this subscription']);
      if (s.allow) lines.push(['allow', 'grants channel capabilities pub / hst / prs to the client (PRO)']);
      if (s.expire) lines.push(['expires', 'subscription needs sub_refresh before expire_at']);
      return { status: 'ALLOWED', lines };
    },
  },

  {
    id: 'sub_refresh', label: 'Sub refresh', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: true, headers: true, named: true,
    err: false, disc: false, // handler ignores error/disconnect for sub_refresh
    dataMeaning: 'No client payload — fired when a subscription is about to expire.',
    enable: { kind: 'channel', key: 'sub_refresh' },
    reqToggles: [],
    resToggles: [
      { key: 'expired', label: 'expired: true (stop the subscription)', def: false },
      { key: 'info', label: 'info (update channel info)', def: false },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56', channel: 'chat:index' };
      if (s.includeMeta) r.meta = { role: 'admin' };
      return r;
    },
    buildResult(s) {
      if (s.expired) return { expired: true };
      const r = { expire_at: 1893456000 };
      if (s.info) r.info = { admin: true };
      return r;
    },
    outcome(s) {
      if (s.expired) return { status: 'EXPIRED', lines: [['expired', 'subscription is expired and will be removed']] };
      return { status: 'EXTENDED', lines: [['expires', 'subscription extended to the new expire_at']] };
    },
  },

  {
    id: 'publish', label: 'Publish', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: true, headers: true, named: true,
    err: true, disc: true,
    dataMeaning: 'The payload the client is trying to publish — you may validate or transform it.',
    enable: { kind: 'channel', key: 'publish' },
    reqToggles: [],
    resToggles: [
      { key: 'transform', label: 'transform data before publish', def: false },
      { key: 'skip', label: 'skip_history', def: false },
      { key: 'tags', label: 'tags', def: false },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56', channel: 'chat:index' };
      if (s.includeMeta) r.meta = { role: 'admin' };
      jsonOrB64(r, 'data', { text: 'hello' }, s.binary);
      return r;
    },
    buildResult(s) {
      const r = {};
      if (s.transform) jsonOrB64(r, 'data', { text: 'hello', by: '56', ts: 1893456000 }, s.binary);
      if (s.skip) r.skip_history = true;
      if (s.tags) r.tags = { source: 'chat' };
      return r;
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'REJECTED', lines: [['error', 'publish is rejected — message is not delivered']] };
      if (s.mode === 'disconnect') return { status: 'DISCONNECTED', lines: [['disconnect', 'connection closed']] };
      const lines = [['channel', 'chat:index — publish allowed']];
      if (s.transform) lines.push(['data', 'replaced with your transformed payload (enriched)']);
      if (s.skip) lines.push(['history', 'this publication is not saved to history']);
      if (s.tags) lines.push(['tags', 'attached to the publication']);
      return { status: 'ALLOWED', lines };
    },
  },

  {
    id: 'rpc', label: 'RPC', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: true, headers: true, named: true,
    err: true, disc: true,
    dataMeaning: 'RPC params sent by the client — your backend computes a response.',
    enable: { kind: 'rpc', key: 'rpc' },
    reqToggles: [],
    resToggles: [
      { key: 'data', label: 'data (RPC response payload)', def: true },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56', method: 'getUserBalance' };
      if (s.includeMeta) r.meta = { role: 'admin' };
      jsonOrB64(r, 'data', { currency: 'USD' }, s.binary);
      return r;
    },
    buildResult(s) {
      const r = {};
      if (s.data) jsonOrB64(r, 'data', { balance: 4200 }, s.binary);
      return r;
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'ERROR', lines: [['error', 'client receives the error as the RPC result']] };
      if (s.mode === 'disconnect') return { status: 'DISCONNECTED', lines: [['disconnect', 'connection closed']] };
      return { status: 'OK', lines: [['data', 'returned to the client as the RPC response']] };
    },
  },

  {
    id: 'subscribe_stream', label: 'Subscribe stream', tier: 'OSS', shape: 'stream',
    clientCtx: true, userMeta: true, headers: true, named: true,
    err: true, disc: true, grpcOnly: true,
    dataMeaning: 'A GRPC streaming proxy (not request/response): your backend accepts the subscription in the first frame, then pushes Publications to the client for the lifetime of the subscription.',
    enable: { kind: 'channel', key: 'subscribe_stream' },
    reqToggles: [],
    resToggles: [],
    buildRequest(s) {
      const sr = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56', channel: 'stream:prices' };
      // Unidirectional RPC input is a single SubscribeRequest. Bidirectional
      // input is a stream of StreamSubscribeRequest whose first frame wraps it.
      return s.streamMode === 'bi' ? { subscribe_request: sr } : sr;
    },
    buildResult() { return {}; }, // first-frame subscribe_response.result
    streamPub() { return { publication: { data: { price: 101.2 }, tags: {} } }; },
    outcome(s) {
      if (s.mode === 'error') return { status: 'REJECTED', lines: [['1st frame', 'subscribe_response returns an error — subscription rejected']] };
      if (s.mode === 'disconnect') return { status: 'DISCONNECTED', lines: [['1st frame', 'subscribe_response returns a disconnect — connection closed']] };
      const lines = [
        ['1st frame', 'required — a subscribe_response must be sent first (accept via result, or reject via error/disconnect)'],
        ['then', 'backend streams { publication } frames — each pushed to the subscribed client'],
      ];
      if (s.streamMode === 'bi') lines.push(['client → backend', 'bidirectional: client publications arrive as StreamSubscribeRequest.publication']);
      return { status: 'STREAMING', lines };
    },
  },

  {
    id: 'map_publish', label: 'Map publish', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: true, headers: true, named: true,
    err: true, disc: true,
    dataMeaning: 'Payload a client publishes into a keyed map channel.',
    enable: { kind: 'map', key: 'publish' },
    reqToggles: [],
    resToggles: [
      { key: 'transform', label: 'transform data', def: false },
      { key: 'idem', label: 'idempotency_key', def: false },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56', channel: 'board:1', key: 'card:42' };
      if (s.includeMeta) r.meta = { role: 'admin' };
      jsonOrB64(r, 'data', { title: 'Task' }, s.binary);
      return r;
    },
    buildResult(s) {
      const r = { key: 'card:42' };
      if (s.transform) jsonOrB64(r, 'data', { title: 'Task', by: '56' }, s.binary);
      if (s.idem) r.idempotency_key = 'card:42:v3';
      return r;
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'REJECTED', lines: [['error', 'map publish rejected']] };
      if (s.mode === 'disconnect') return { status: 'DISCONNECTED', lines: [['disconnect', 'connection closed']] };
      const lines = [['key', 'card:42 — upsert allowed']];
      if (s.idem) lines.push(['idempotency_key', 'dedupes repeated writes of this key']);
      return { status: 'ALLOWED', lines };
    },
  },

  {
    id: 'map_remove', label: 'Map remove', tier: 'OSS', shape: 'reqresp',
    clientCtx: true, userMeta: true, headers: true, named: true,
    err: true, disc: true,
    dataMeaning: 'No payload — a client asks to remove a key from a map channel.',
    enable: { kind: 'map', key: 'remove' },
    reqToggles: [],
    resToggles: [
      { key: 'tags', label: 'tags', def: false },
    ],
    buildRequest(s) {
      const r = { client: CLIENT, transport: 'websocket', protocol: 'json', encoding: 'json', user: '56', channel: 'board:1', key: 'card:42' };
      if (s.includeMeta) r.meta = { role: 'admin' };
      return r;
    },
    buildResult(s) {
      const r = { key: 'card:42' };
      if (s.tags) r.tags = { removed_by: '56' };
      return r;
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'REJECTED', lines: [['error', 'map remove rejected']] };
      if (s.mode === 'disconnect') return { status: 'DISCONNECTED', lines: [['disconnect', 'connection closed']] };
      return { status: 'ALLOWED', lines: [['key', 'card:42 — removed from the map']] };
    },
  },

  {
    id: 'cache_empty', label: 'Cache empty', tier: 'PRO', shape: 'reqresp',
    clientCtx: false, userMeta: false, headers: false, named: true,
    err: false, disc: false,
    dataMeaning: 'No client context — Centrifugo asks your backend to populate an empty channel cache.',
    enable: { kind: 'channel', key: 'cache_empty' },
    reqToggles: [],
    resToggles: [
      { key: 'populated', label: 'populated: true (backend filled the cache)', def: true },
    ],
    buildRequest() {
      return { channel: 'chat:index' };
    },
    buildResult(s) {
      return { populated: !!s.populated };
    },
    outcome(s) {
      return s.populated
        ? { status: 'POPULATED', lines: [['cache', 'backend published the current value — cache is now warm']] }
        : { status: 'EMPTY', lines: [['cache', 'nothing published — channel cache stays empty']] };
    },
  },

  {
    id: 'state', label: 'Channel state', tier: 'PRO-preview', shape: 'batch',
    clientCtx: false, userMeta: false, headers: false, named: false,
    err: true, disc: false,
    dataMeaning: 'No client context — a batch notification when channels become occupied / vacated.',
    enable: { kind: 'state', key: 'state' },
    reqToggles: [],
    resToggles: [],
    buildRequest() {
      return { events: [{ time_ms: 1893456000000, channel: 'chat:index', type: 'occupied' }] };
    },
    buildResult() {
      return {};
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'ERROR', lines: [['error', 'marks the notification as failed — Centrifugo logs it / retries. No client is involved, so it is not a client-facing error.']] };
      return { status: 'ACK', lines: [['result', 'empty {} — the notification is acknowledged']] };
    },
  },

  {
    id: 'shared_poll_refresh', label: 'Shared poll refresh', tier: 'OSS', shape: 'batch',
    clientCtx: false, userMeta: false, headers: false, named: true,
    err: true, disc: false,
    dataMeaning: 'No client context — Centrifugo asks your backend for fresh values of polled keys.',
    enable: { kind: 'sharedpoll', key: 'shared_poll_refresh' },
    reqToggles: [],
    resToggles: [],
    buildRequest() {
      return { channel: 'poll:index', items: [{ key: 'item:1', version: 3 }] };
    },
    buildResult() {
      return { items: [{ key: 'item:1', data: { value: 42 }, version: 4 }], epoch: 'xyz' };
    },
    outcome(s) {
      if (s.mode === 'error') return { status: 'ERROR', lines: [['error', 'refresh failed — Centrifugo logs the error. No client is involved, so it is not a client-facing error.']] };
      return { status: 'REFRESHED', lines: [['items', 'returned values are delivered to pollers']] };
    },
  },
];

export function getEvent(id) {
  return EVENTS.find((e) => e.id === id) || EVENTS[0];
}

// Default toggle state for an event.
export function defaultState(ev) {
  // includeMeta models the include_connection_meta option (opt-in, default off).
  const s = {
    mode: 'result', binary: false, includeMeta: false, named: false,
    transport: ev.grpcOnly ? 'grpc' : 'http', // subscribe_stream is GRPC-only
    streamMode: 'uni',
  };
  (ev.reqToggles || []).forEach((t) => { s[t.key] = t.def; });
  (ev.resToggles || []).forEach((t) => { s[t.key] = t.def; });
  return s;
}

// ---- request / response JSON ----------------------------------------------

export function buildRequestJSON(ev, s) {
  return pretty(ev.buildRequest(s));
}

export function buildResponseJSON(ev, s) {
  // Streaming: the FIRST frame optionally carries a subscribe_response
  // (result / error / disconnect) to accept or reject the subscription.
  if (ev.shape === 'stream') {
    if (s.mode === 'error') return pretty({ subscribe_response: { error: { code: 1000, message: 'custom error' } } });
    if (s.mode === 'disconnect') return pretty({ subscribe_response: { disconnect: { code: 4500, reason: 'custom disconnect' } } });
    return pretty({ subscribe_response: { result: {} } });
  }
  if (s.mode === 'error' && ev.err) return pretty({ error: { code: 1000, message: 'custom error' } });
  if (s.mode === 'disconnect' && ev.disc) return pretty({ disconnect: { code: 4500, reason: 'custom disconnect' } });
  return pretty({ result: ev.buildResult(s) });
}

// The publication frame a streaming proxy pushes to the client after accepting.
export function buildStreamPub(ev) {
  return pretty(ev.streamPub ? ev.streamPub() : { publication: { data: {} } });
}

// ---- headers panel ---------------------------------------------------------
// Models internal/proxy/http.go requestHeaders / grpc.go requestMetadata.

export function buildHeaders(ev, s) {
  if (!ev.headers) return null;
  const toGrpc = s.transport === 'grpc';
  const dest = toGrpc ? 'metadata' : 'headers';
  // Order = precedence, low → high (later wins on the same key).
  const rows = [
    { name: 'x-api-key: static', origin: `static_${toGrpc ? 'metadata' : 'headers'} — added by Centrifugo` },
    { name: 'authorization', origin: 'emulated_headers — client-supplied emulated header (fallback when no real header)' },
    { name: 'cookie, authorization', origin: 'http_headers — forwarded from the client transport headers' },
  ];
  return { dest, rows };
}

// ---- config generation -----------------------------------------------------

const ENDPOINT_HTTP = 'http://localhost:3000/centrifugo';
const ENDPOINT_GRPC = 'grpc://localhost:3000';

// HTTP proxies get a per-event path (a common pattern — one handler per event).
// GRPC has no path: it dispatches by the CentrifugoProxy service method.
function endpoint(ev, s) {
  return s.transport === 'grpc' ? ENDPOINT_GRPC : `${ENDPOINT_HTTP}/${ev.id}`;
}

function httpPath(ev) {
  return `/centrifugo/${ev.id}`;
}

// Header-forwarding config that matches the "Forwarded headers" panel:
// http_headers (client transport headers) + emulated_headers (client-supplied) +
// static values added by Centrifugo (static_headers for HTTP, static_metadata for GRPC).
function headerFields(ev, s) {
  if (!ev.headers) return {};
  // Authorization is listed in BOTH lists on purpose: forwarded from the real
  // transport header when present, or from a client-supplied emulated header
  // (e.g. a non-browser client that can't set real headers).
  const f = { http_headers: ['Cookie', 'Authorization'], emulated_headers: ['Authorization'] };
  if (s.transport === 'grpc') f.grpc = { static_metadata: { 'x-api-key': 'static-value' } };
  else f.http = { static_headers: { 'x-api-key': 'static-value' } };
  return f;
}

export function buildConfig(ev, s) {
  const ep = endpoint(ev, s);
  const k = ev.enable;

  if (k.kind === 'client') {
    return pretty({ client: { proxy: { [k.key]: { enabled: true, endpoint: ep, timeout: '1s', ...headerFields(ev, s) } } } });
  }

  // Named vs inline (default) for channel / rpc / map / sharedpoll / cache_empty.
  if (s.named && ev.named) {
    const proxyName = `${k.key}1`;
    const named = { name: proxyName, endpoint: ep, timeout: '1s', ...headerFields(ev, s) };
    if (k.kind === 'rpc') {
      return pretty({ proxies: [named], rpc: { namespaces: [{ name: 'ns1', proxy_enabled: true, proxy_name: proxyName }] } });
    }
    if (k.kind === 'map') {
      const opt = k.key === 'remove' ? 'remove' : 'publish';
      return pretty({ proxies: [named], channel: { namespaces: [{ name: 'board', subscription_type: 'map', map: { [`${opt}_proxy_enabled`]: true, [`${opt}_proxy_name`]: proxyName } }] } });
    }
    if (k.kind === 'sharedpoll') {
      return pretty({ proxies: [named], channel: { namespaces: [{ name: 'poll', shared_poll: { proxy_name: proxyName } }] } });
    }
    // channel-wide subscribe / publish / sub_refresh / subscribe_stream / cache_empty
    return pretty({ proxies: [named], channel: { namespaces: [{ name: 'ns1', [`${k.key}_proxy_enabled`]: true, [`${k.key}_proxy_name`]: proxyName }] } });
  }

  // Inline default proxy config.
  const inline = { endpoint: ep, timeout: '1s', ...headerFields(ev, s) };
  if (k.kind === 'rpc') {
    return pretty({ rpc: { proxy: inline, namespaces: [{ name: 'ns1', proxy_enabled: true }] } });
  }
  if (k.kind === 'state') {
    return pretty({ channel: { proxy: { state: inline }, namespaces: [{ name: 'ns1', state_proxy_enabled: true, state_events: ['occupied', 'vacated'] }] } });
  }
  if (k.kind === 'map') {
    const opt = k.key === 'remove' ? 'remove' : 'publish';
    return pretty({ channel: { proxy: { [`map_${k.key}`]: inline }, namespaces: [{ name: 'board', subscription_type: 'map', map: { [`${opt}_proxy_enabled`]: true } }] } });
  }
  if (k.kind === 'sharedpoll') {
    // No *_proxy_enabled flag — the shared_poll config selects a proxy by name
    // (defaults to "default", i.e. channel.proxy.shared_poll_refresh).
    return pretty({ channel: { proxy: { shared_poll_refresh: inline }, namespaces: [{ name: 'poll', shared_poll: {} }] } });
  }
  // channel-wide default (subscribe / publish / sub_refresh / subscribe_stream / cache_empty)
  return pretty({ channel: { proxy: { [k.key]: inline }, namespaces: [{ name: 'ns1', [`${k.key}_proxy_enabled`]: true }] } });
}

// Events whose full setup lives in a dedicated chapter — the widget shows a
// representative config and points there.
export const CONFIG_NOTES = {
  subscribe_stream: 'Streaming proxy — see the Proxy streams chapter for the full setup.',
  map_publish: 'Map channels — configured on a map-type namespace; see the Map subscriptions chapter.',
  map_remove: 'Map channels — configured on a map-type namespace; see the Map subscriptions chapter.',
  cache_empty: 'Part of cache recovery — see PRO event hooks.',
  state: 'Channel state events — see PRO event hooks. Note: state has no *_proxy_name (default proxy only).',
  shared_poll_refresh: 'Shared poll — see the Shared poll chapter; the proxy is selected via the shared_poll proxy_name.',
};

// ---- backend code generation ----------------------------------------------

export function buildCode(ev, s, lang) {
  const res = ev.buildResult(s);
  const hasClient = ev.clientCtx;

  if (lang === 'node') {
    return [
      `app.post('${httpPath(ev)}', (httpReq, httpRes) => {`,
      '  const req = httpReq.body;',
      ev.headers ? "  // forwarded transport headers you allow-listed via http_headers:" : null,
      ev.headers ? "  const cookie = httpReq.get('cookie');" : null,
      hasClient && ev.userMeta ? '  // req.user is the authenticated user id' : null,
      '  // ... your logic ...',
      '  httpRes.json({ result: ' + JSON.stringify(res) + ' });',
      '});',
    ].filter(Boolean).join('\n');
  }
  if (lang === 'python') {
    return [
      `@app.post('${httpPath(ev)}')`,
      'async def proxy(request: Request):',
      '    req = await request.json()',
      ev.headers ? "    cookie = request.headers.get('cookie')  # allow-listed via http_headers" : null,
      hasClient && ev.userMeta ? "    user = req['user']" : null,
      '    # ... your logic ...',
      '    return {"result": ' + JSON.stringify(res) + '}',
    ].filter(Boolean).join('\n');
  }
  if (lang === 'go') {
    return [
      'func proxy(w http.ResponseWriter, r *http.Request) {',
      '    var req map[string]any',
      '    _ = json.NewDecoder(r.Body).Decode(&req)',
      ev.headers ? '    cookie := r.Header.Get("Cookie") // allow-listed via http_headers' : null,
      hasClient && ev.userMeta ? '    // req["user"] is the authenticated user id' : null,
      '    // ... your logic ...',
      '    w.Header().Set("Content-Type", "application/json")',
      '    json.NewEncoder(w).Encode(map[string]any{"result": ' + goMap(res) + '})',
      '}',
    ].filter(Boolean).join('\n');
  }
  // grpc — rough sketch
  if (ev.shape === 'stream') {
    if (s.streamMode === 'bi') {
      return [
        '// Bidirectional streaming — the client may also publish into the stream.',
        'func (s *server) SubscribeBidirectional(',
        '    stream proxyproto.CentrifugoProxy_SubscribeBidirectionalServer) error {',
        '    first, _ := stream.Recv()          // 1st frame: SubscribeRequest',
        '    _ = first.GetSubscribeRequest()',
        '    // REQUIRED: the first response frame must carry a subscribe_response.',
        '    if err := stream.Send(&proxyproto.StreamSubscribeResponse{',
        '        SubscribeResponse: &proxyproto.SubscribeResponse{Result: &proxyproto.SubscribeResult{}},',
        '    }); err != nil { return err }',
        '    // then push publications (and Recv() client publications):',
        '    return stream.Send(&proxyproto.StreamSubscribeResponse{',
        '        Publication: &proxyproto.Publication{Data: []byte(`{"price":101.2}`)},',
        '    })',
        '}',
      ].join('\n');
    }
    return [
      '// Unidirectional streaming — backend pushes publications to the client.',
      'func (s *server) SubscribeUnidirectional(',
      '    req *proxyproto.SubscribeRequest,',
      '    stream proxyproto.CentrifugoProxy_SubscribeUnidirectionalServer) error {',
      '    // REQUIRED: the first frame must carry a subscribe_response (accept or reject).',
      '    if err := stream.Send(&proxyproto.StreamSubscribeResponse{',
      '        SubscribeResponse: &proxyproto.SubscribeResponse{Result: &proxyproto.SubscribeResult{}},',
      '    }); err != nil { return err }',
      '    // then stream publications:',
      '    return stream.Send(&proxyproto.StreamSubscribeResponse{',
      '        Publication: &proxyproto.Publication{Data: []byte(`{"price":101.2}`)},',
      '    })',
      '}',
    ].join('\n');
  }
  const method = grpcMethod(ev.id);
  return [
    '// Implement the CentrifugoProxy service from proxy.proto.',
    `func (s *server) ${method}(ctx context.Context, req *proxyproto.${grpcReq(ev.id)}) (*proxyproto.${grpcResp(ev.id)}, error) {`,
    ev.userMeta ? '    // req.User is the authenticated user id' : null,
    '    // ... your logic ...',
    `    return &proxyproto.${grpcResp(ev.id)}{`,
    `        Result: &proxyproto.${grpcResult(ev.id)}{ /* fields */ },`,
    '    }, nil',
    '}',
  ].filter(Boolean).join('\n');
}

function goMap(obj) {
  // Very small pretty-printer to a Go map literal for the sketch.
  return JSON.stringify(obj);
}

function cap(id) { return id.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join(''); }
function grpcMethod(id) {
  const m = { subscribe_stream: 'SubscribeUnidirectional', state: 'NotifyChannelState', cache_empty: 'NotifyCacheEmpty', shared_poll_refresh: 'SharedPollRefresh' };
  return m[id] || cap(id);
}
function grpcReq(id) {
  const m = { state: 'NotifyChannelStateRequest', cache_empty: 'NotifyCacheEmptyRequest', shared_poll_refresh: 'SharedPollRefreshRequest' };
  return m[id] || cap(id) + 'Request';
}
function grpcResp(id) {
  const m = { state: 'NotifyChannelStateResponse', cache_empty: 'NotifyCacheEmptyResponse', shared_poll_refresh: 'SharedPollRefreshResponse' };
  return m[id] || cap(id) + 'Response';
}
function grpcResult(id) {
  const m = { state: 'NotifyChannelStateResult', cache_empty: 'NotifyCacheEmptyResult', shared_poll_refresh: 'SharedPollRefreshResult' };
  return m[id] || cap(id) + 'Result';
}
