// Reproduces Centrifugo PRO's multiple-JWKS-provider routing
// (findJWKSProviderByIssuer in internal/jwtverify/token_verifier_jwt_pro.go)
// and the startup validation rules (internal/config/validate_pro.go).

export const PROVIDER_NAME_RE = /^[a-zA-Z0-9_]{2,}$/;

export function normalizeAud(aud) {
  if (aud === null || aud === undefined || aud === '') return [];
  return Array.isArray(aud) ? aud.map(String) : [String(aud)];
}

// providers: full list; only enabled ones participate in routing, in order.
// Returns { matched, trace, viaFallback }.
export function findProvider(iss, audArray, providers) {
  const trace = [];
  let issuerOnly = null;
  for (const p of providers) {
    if (!p.enabled) { trace.push({ name: p.name, status: 'disabled', detail: 'provider disabled' }); continue; }
    if (iss !== p.issuer) {
      trace.push({ name: p.name, status: 'skip', detail: `issuer "${p.issuer}" ≠ token iss "${iss}"` });
      continue;
    }
    if (p.audience) {
      if (audArray.includes(p.audience)) {
        trace.push({ name: p.name, status: 'match', detail: `issuer matches and audience "${p.audience}" is in the token aud` });
        return { matched: p, trace, viaFallback: false };
      }
      trace.push({ name: p.name, status: 'skip', detail: `issuer matches but audience "${p.audience}" not in token aud [${audArray.join(', ') || '—'}]` });
      continue;
    }
    if (issuerOnly === null) {
      issuerOnly = p;
      trace.push({ name: p.name, status: 'fallback', detail: 'issuer matches, no audience configured — kept as issuer-only fallback' });
    } else {
      trace.push({ name: p.name, status: 'skip', detail: 'issuer matches, no audience, but a fallback is already chosen' });
    }
  }
  if (issuerOnly) return { matched: issuerOnly, trace, viaFallback: true };
  return { matched: null, trace, viaFallback: false };
}

// Mirrors validateTokenJWKSProviders. Returns an array of warning strings.
export function validateProviders(providers) {
  const warns = [];
  const seenNames = [];
  for (const p of providers) {
    if (!PROVIDER_NAME_RE.test(p.name)) warns.push(`Provider name "${p.name}" must match ${PROVIDER_NAME_RE.source}.`);
    if (seenNames.includes(p.name)) warns.push(`Duplicate provider name "${p.name}" — names must be unique.`);
    seenNames.push(p.name);
  }
  const enabled = providers.filter((p) => p.enabled);
  for (const p of enabled) {
    if (!p.endpoint) warns.push(`Provider "${p.name}" is enabled but endpoint is not set.`);
    if (!p.issuer) warns.push(`Provider "${p.name}" is enabled but issuer is not set.`);
  }
  const pairs = {};
  const issuerCounts = {};
  for (const p of enabled) {
    if (!p.issuer) continue;
    issuerCounts[p.issuer] = (issuerCounts[p.issuer] || 0) + 1;
    const key = p.issuer + '|' + (p.audience || '');
    if (pairs[key]) {
      warns.push(p.audience
        ? `Providers "${pairs[key]}" and "${p.name}" have a duplicate issuer+audience pair (issuer=${p.issuer}, audience=${p.audience}).`
        : `Providers "${pairs[key]}" and "${p.name}" share issuer "${p.issuer}" — when an issuer repeats, each provider must set a different audience.`);
    } else {
      pairs[key] = p.name;
    }
  }
  for (const p of enabled) {
    if (issuerCounts[p.issuer] > 1 && !p.audience) {
      warns.push(`Provider "${p.name}": issuer "${p.issuer}" is used by multiple providers, so this one must set a distinct audience.`);
    }
  }
  return [...new Set(warns)];
}

export function buildJwksConfig(providers) {
  const list = providers.map((p) => {
    const o = { name: p.name, enabled: p.enabled, endpoint: p.endpoint || 'https://issuer/.well-known/jwks.json', issuer: p.issuer };
    if (p.audience) o.audience = p.audience;
    const meta = (p.metaMappings || []).filter((m) => m.key && m.value);
    const labels = (p.labelMappings || []).filter((m) => m.key && m.value);
    if (meta.length) o.meta_from_claim = meta.map((m) => ({ key: m.key, value: m.value }));
    if (labels.length) o.labels_from_claim = labels.map((m) => ({ key: m.key, value: m.value }));
    return o;
  });
  return JSON.stringify({ client: { token: { jwks: { enabled: true, providers: list } } } }, null, 2);
}
