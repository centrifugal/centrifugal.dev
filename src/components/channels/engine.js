// Models Centrifugo channel → namespace resolution and the effective-options /
// dependency validation (internal/config/container.go namespaceName +
// channelOpts, internal/config/validate.go validateChannelOptions).

const GLOBAL_META_TTL_SEC = 720 * 3600; // channel.history_meta_ttl default 720h

// Parse a channel into { isPrivate, namespace, rest, isUserLimited }.
// The private prefix is stripped BEFORE the namespace split (mirrors container.go).
export function parseChannel(channel, opts = {}) {
  const priv = opts.privatePrefix ?? '$';
  const nsB = opts.nsBoundary ?? ':';
  const userB = opts.userBoundary ?? '#';
  const isPrivate = priv !== '' && channel.startsWith(priv);
  const cTrim = priv !== '' && channel.startsWith(priv) ? channel.slice(priv.length) : channel;
  let namespace = '';
  let rest = channel;
  if (nsB !== '' && cTrim.includes(nsB)) {
    const idx = cTrim.indexOf(nsB);
    namespace = cTrim.slice(0, idx);
    rest = cTrim.slice(idx + nsB.length);
  }
  const isUserLimited = userB !== '' && channel.includes(userB);
  return { isPrivate, namespace, rest, isUserLimited };
}

// namespaceNames: array of defined namespace names (the top-level/default is "").
export function resolveNamespace(channel, namespaceNames, opts = {}) {
  const parsed = parseChannel(channel, opts);
  if (parsed.namespace === '') {
    return { ...parsed, found: true, isDefault: true, resolved: '(default / without_namespace)' };
  }
  const found = namespaceNames.includes(parsed.namespace);
  return { ...parsed, found, isDefault: false, resolved: found ? parsed.namespace : null };
}

// Parse a Centrifugo duration string → seconds. '' → 0 (unset); invalid → null.
export function parseDuration(s) {
  if (s === undefined || s === null || String(s).trim() === '') return 0;
  const t = String(s).trim();
  if (/^\d+$/.test(t)) return Number(t); // bare number = seconds
  const re = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;
  const mult = { ns: 1e-9, us: 1e-6, 'µs': 1e-6, ms: 1e-3, s: 1, m: 60, h: 3600 };
  let m; let total = 0; let any = false; let consumed = 0;
  while ((m = re.exec(t)) !== null) { any = true; total += parseFloat(m[1]) * mult[m[2]]; consumed += m[0].length; }
  if (!any || consumed !== t.length) return null;
  return total;
}

// opts: { presence, historySize, historyTTL, historyMetaTTL, forcePositioning,
//         forceRecovery, forceRecoveryMode, autoCacheRecover, deltaPublish,
//         allowUserLimited }
export function validateOptions(opts) {
  const errors = [];
  const advisories = [];
  const size = parseInt(opts.historySize || '0', 10) || 0;
  const ttl = parseDuration(opts.historyTTL);
  if (ttl === null) errors.push('history_ttl is not a valid duration (e.g. "300s", "5m", "24h").');
  const meta = parseDuration(opts.historyMetaTTL);
  if (meta === null) errors.push('history_meta_ttl is not a valid duration.');
  const ttlSec = ttl || 0;
  const metaSec = meta && meta > 0 ? meta : GLOBAL_META_TTL_SEC;
  // Centrifugo rejects sub-second precision on these durations (validateSecondPrecisionDuration).
  if (ttl !== null && ttl > 0 && ttl % 1 !== 0) errors.push('history_ttl: sub-second precision is not supported.');
  if (meta !== null && meta > 0 && meta % 1 !== 0) errors.push('history_meta_ttl: sub-second precision is not supported.');

  if ((size > 0 && ttlSec === 0) || (size === 0 && ttlSec > 0)) {
    errors.push('both history_size and history_ttl are required for history.');
  }
  const historyConfigured = size > 0 && ttlSec > 0;
  if (historyConfigured && metaSec < ttlSec) {
    errors.push(`history_ttl can not be greater than history_meta_ttl (effective ${opts.historyMetaTTL || '720h default'}).`);
  }
  if (opts.forceRecovery && !historyConfigured) {
    errors.push('both history_size and history_ttl are required for force_recovery.');
  }
  const mode = opts.forceRecoveryMode || '';
  if (!['', 'stream', 'cache'].includes(mode)) errors.push(`unknown force_recovery_mode "${mode}" (use stream or cache).`);
  if (opts.autoCacheRecover && (!opts.forceRecovery || mode !== 'cache')) {
    errors.push('auto_cache_recover requires force_recovery and force_recovery_mode = cache.');
  }
  if (opts.forcePositioning && !historyConfigured) {
    advisories.push('force_positioning is on but history is not configured — positioning has no stream to detect loss against (not a startup error).');
  }

  const effective = {
    presence: !!opts.presence,
    history: historyConfigured,
    recovery: !!opts.forceRecovery && historyConfigured,
    recoveryMode: mode === 'cache' ? 'cache' : 'stream',
    positioning: !!opts.forcePositioning,
    delta: !!opts.deltaPublish,
    userLimited: !!opts.allowUserLimited,
  };
  return { errors: [...new Set(errors)], advisories, effective, historyConfigured };
}

export function buildNamespaceConfig(name, opts) {
  const o = {};
  if (name) o.name = name;
  if (opts.presence) o.presence = true;
  const size = parseInt(opts.historySize || '0', 10) || 0;
  if (size > 0) o.history_size = size;
  if (opts.historyTTL) o.history_ttl = opts.historyTTL;
  if (opts.historyMetaTTL) o.history_meta_ttl = opts.historyMetaTTL;
  if (opts.forcePositioning) o.force_positioning = true;
  if (opts.forceRecovery) o.force_recovery = true;
  if (opts.forceRecoveryMode) o.force_recovery_mode = opts.forceRecoveryMode;
  if (opts.autoCacheRecover) o.auto_cache_recover = true;
  if (opts.deltaPublish) { o.delta_publish = true; o.allowed_delta_types = ['fossil']; }
  if (opts.allowUserLimited) o.allow_user_limited_channels = true;
  return JSON.stringify(name ? { channel: { namespaces: [o] } } : { channel: { without_namespace: o } }, null, 2);
}
