// Models Centrifugo's dynamic JWKS endpoint templating (OSS, v6.7.0):
// runtime iss/aud → named-group extraction → {{placeholder}} substitution, and
// the startup safety validator that requires every named group used as a
// placeholder to be an explicit alternation of fixed strings.
// (internal/jwtverify/validate.go + token_verifier_jwt.go + jwks/manager.go)

// fasttemplate uses the RAW text between {{ }} as the key — it does NOT trim.
// So "{{ realm }}" is the key " realm " (with spaces) and will not resolve.
export function extractPlaceholders(url) {
  const out = [];
  const re = /\{\{(.*?)\}\}/g;
  let m;
  while ((m = re.exec(url)) !== null) out.push(m[1]);
  return out;
}

// Gate A — whole-pattern: no character classes [...] and no \d \D \w \W \s \S \p \P.
export function rejectCharClassSyntax(pattern) {
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      const n = pattern[i + 1];
      if (n && 'dDwWsSpP'.includes(n)) return `contains character-class shorthand \\${n}`;
      i++;
      continue;
    }
    if (c === '[') return 'contains character-class syntax [...]';
  }
  return null;
}

// Find named groups (?P<name>...) / (?<name>...) with paren-balanced bodies.
export function findNamedGroups(pattern) {
  const groups = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') { i++; continue; }
    const m = /^\(\?P?<([A-Za-z_][A-Za-z0-9_]*)>/.exec(pattern.slice(i));
    if (pattern[i] === '(' && m) {
      const name = m[1];
      const bodyStart = i + m[0].length;
      let depth = 1; let j = bodyStart;
      for (; j < pattern.length; j++) {
        if (pattern[j] === '\\') { j++; continue; }
        if (pattern[j] === '(') depth++;
        else if (pattern[j] === ')') { depth--; if (depth === 0) break; }
      }
      groups.push({ name, body: pattern.slice(bodyStart, j) });
      i = bodyStart - 1;
    }
  }
  return groups;
}

// Gate B — a placeholder group's body must be an explicit alternation of fixed
// strings (Go isLiteralTree accepts OpLiteral/OpEmptyMatch/OpCharClass and the
// structural OpConcat/OpCapture/OpAlternate). So literals, `|`, and (possibly
// nested) groups — capturing `(...)`, non-capturing `(?:...)`, named
// `(?P<n>...)` — are allowed; dots, quantifiers, char classes, anchors, and
// word boundaries are rejected.
export function literalTreeError(body) {
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') {
      const n = body[i + 1];
      if (n === 'b' || n === 'B') return `uses a word boundary \\${n}`;
      i++; // escaped literal
      continue;
    }
    if (c === '(') {
      const m = /^\((?:\?:|\?P?<[A-Za-z_][A-Za-z0-9_]*>)?/.exec(body.slice(i));
      i += m[0].length - 1; // consume the group-open token (its `?` is not a quantifier)
      continue;
    }
    if (c === ')' || c === '|') continue;
    if ('.*+?{}[]^$'.includes(c)) return `uses regex metacharacter "${c}"`;
  }
  return null;
}

export function validateSafety({ issuerRegex = '', audienceRegex = '', url = '' }) {
  const placeholders = extractPlaceholders(url);
  const warns = [];
  if (placeholders.length === 0) return warns; // static URL — no template check runs
  for (const [label, pat] of [['issuer_regex', issuerRegex], ['audience_regex', audienceRegex]]) {
    if (!pat) continue;
    const ga = rejectCharClassSyntax(pat);
    if (ga) { warns.push(`${label} ${ga} — not allowed with a templated JWKS endpoint. Use an explicit list, e.g. (?P<realm>a|b|c).`); continue; }
    for (const g of findNamedGroups(pat)) {
      if (!placeholders.includes(g.name)) continue; // groups not used as a placeholder are exempt from Gate B
      const gb = literalTreeError(g.body);
      if (gb) warns.push(`${label} named group "${g.name}" ${gb} — a template placeholder may only be an explicit alternation of fixed strings.`);
    }
  }
  return [...new Set(warns)];
}

function goToJs(re) { return re.replace(/\(\?P</g, '(?<'); }

// Mimic Go's path.Clean (used by resolveURL to reject non-canonical paths).
function pathClean(p) {
  if (p === '') return '.';
  const rooted = p[0] === '/';
  const out = [];
  for (const s of p.split('/')) {
    if (s === '' || s === '.') continue;
    if (s === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else if (!rooted) out.push('..');
    } else {
      out.push(s);
    }
  }
  const res = (rooted ? '/' : '') + out.join('/');
  return res === '' ? (rooted ? '/' : '.') : res;
}

export function resolveRuntime({ issuerRegex = '', audienceRegex = '', url = '', iss = '', aud = '' }) {
  const vars = {};
  const trace = [];
  if (issuerRegex) {
    let re;
    try { re = new RegExp(goToJs(issuerRegex)); } catch (e) { return { ok: false, error: `issuer_regex does not compile: ${e.message}`, vars, trace }; }
    const m = re.exec(iss);
    if (!m) return { ok: false, error: `iss "${iss}" does not match issuer_regex → token rejected (issuer not matched)`, vars, trace };
    Object.assign(vars, m.groups || {});
    trace.push(`iss matched issuer_regex → ${Object.keys(m.groups || {}).map((k) => `${k}=${m.groups[k]}`).join(', ') || '(no named groups)'}`);
  }
  if (audienceRegex) {
    let re;
    try { re = new RegExp(goToJs(audienceRegex)); } catch (e) { return { ok: false, error: `audience_regex does not compile: ${e.message}`, vars, trace }; }
    const auds = aud.split(',').map((s) => s.trim()).filter(Boolean);
    let matched = null;
    for (const a of auds) { const m = re.exec(a); if (m) { matched = m; break; } }
    if (!matched) return { ok: false, error: `no aud value matches audience_regex → token rejected (audience not matched)`, vars, trace };
    Object.assign(vars, matched.groups || {});
    trace.push(`aud matched audience_regex → ${Object.keys(matched.groups || {}).map((k) => `${k}=${matched.groups[k]}`).join(', ') || '(no named groups)'}`);
  }

  const missing = [];
  const resolved = url.replace(/\{\{(.*?)\}\}/g, (_, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
    missing.push(name);
    return '';
  });

  // Runtime guard: Go rejects when path.Clean(u.Path) != u.Path — this catches
  // "..", but also "//", "/./" and a trailing "/" (e.g. from an empty variable).
  try {
    const u = new URL(resolved);
    if (u.pathname !== '' && pathClean(u.pathname) !== u.pathname) {
      return { ok: false, error: `resolved URL path is not clean (contains "..", "//", "/./", or a trailing "/") → rejected: ${resolved}`, vars, trace };
    }
  } catch (e) { /* not an absolute URL — leave as-is */ }

  return { ok: true, url: resolved, vars, trace, missing };
}

export function buildTokenConfig({ issuerRegex, audienceRegex, url }) {
  const token = {};
  if (issuerRegex) token.issuer_regex = issuerRegex;
  if (audienceRegex) token.audience_regex = audienceRegex;
  token.jwks_public_endpoint = url;
  return JSON.stringify({ client: { token } }, null, 2);
}
