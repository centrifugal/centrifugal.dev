// Reproduces Centrifugo PRO's JWT-claim → meta / labels extraction
// (internal/jwtverify/token_verifier_jwt_pro.go). Faithful to the real
// algorithm: restricted gjson dotted paths, silent-skip on missing paths,
// mapped entries override existing meta / top-level labels, and gjson
// `.String()` stringification for labels (NOT fmt.Sprint).

export const META_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Split a restricted gjson path into literal segments. A backslash escapes the
// next character (so "\." is a literal dot inside a field name).
export function splitPath(path) {
  const segs = [];
  let cur = '';
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c === '\\' && i + 1 < path.length) { cur += path[i + 1]; i++; continue; }
    if (c === '.') { segs.push(cur); cur = ''; continue; }
    cur += c;
  }
  segs.push(cur);
  return segs;
}

// Mirrors validateGJSONPath (internal/config/validate_pro.go): only simple
// dotted paths are allowed; these characters are rejected unless escaped.
export function validateGjsonPath(path) {
  if (path === '') return 'path cannot be empty';
  const runes = [...path];
  for (let i = 0; i < runes.length; i++) {
    const r = runes[i];
    if (r === '\\' && i + 1 < runes.length) { i++; continue; }
    switch (r) {
      case '|': case '{': case '}': return 'multipaths with |, {, } are not allowed — use simple dot paths';
      case '#': return 'array operations with # are not allowed — use simple dot paths';
      case '@': return 'modifiers with @ are not allowed (escape as \\@ inside a field name)';
      case '*': case '?': return 'wildcards with *, ? are not allowed — use simple dot paths';
      case '!': return 'literals with ! are not allowed — use simple dot paths';
      case '(': case ')': return 'parentheses are not allowed — use simple dot paths';
      case '[': case ']': return 'array indexing with [] is not allowed — use simple dot paths';
      default: break;
    }
  }
  return null;
}

// Resolve a validated dotted path against the claims object. Supports numeric
// segments indexing into arrays (gjson "arr.0" semantics).
export function resolvePath(claims, path) {
  let cur = claims;
  for (const seg of splitPath(path)) {
    if (cur === null || cur === undefined) return { exists: false };
    if (Array.isArray(cur)) {
      if (!/^\d+$/.test(seg)) return { exists: false };
      const idx = Number(seg);
      if (idx >= cur.length) return { exists: false };
      cur = cur[idx];
    } else if (typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, seg)) {
      cur = cur[seg];
    } else {
      return { exists: false };
    }
  }
  return { exists: true, value: cur };
}

// gjson Result.String() semantics for label values.
export function gjsonString(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v); // JS avoids sci-notation below ~1e21
  return JSON.stringify(v); // arrays / objects → raw JSON text
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// mappings: [{ key, value }]
export function extractMeta(claims, mappings) {
  const notes = [];
  const active = mappings.filter((m) => m.key !== '' || m.value !== '');
  const hasMetaClaim = isPlainObject(claims.meta);
  let out = hasMetaClaim ? JSON.parse(JSON.stringify(claims.meta)) : {};

  if (active.length === 0) {
    return { result: hasMetaClaim ? out : null, notes, applied: false };
  }

  for (const m of active) {
    if (!META_KEY_RE.test(m.key)) {
      notes.push({ key: m.key, status: 'invalid-key', detail: `key "${m.key}" must match ${META_KEY_RE.source}` });
      continue;
    }
    const pathErr = validateGjsonPath(m.value);
    if (pathErr) { notes.push({ key: m.key, status: 'invalid-path', detail: pathErr }); continue; }
    const r = resolvePath(claims, m.value);
    if (!r.exists) {
      notes.push({ key: m.key, status: 'skipped', detail: `path "${m.value}" not found — silently skipped` });
      continue;
    }
    const overrode = Object.prototype.hasOwnProperty.call(out, m.key);
    out[m.key] = r.value;
    notes.push({
      key: m.key,
      status: overrode ? 'override' : 'extracted',
      detail: overrode ? `overrode existing meta.${m.key}` : `set meta.${m.key} from "${m.value}"`,
    });
  }
  return { result: out, notes, applied: true };
}

export function extractLabels(claims, mappings) {
  const notes = [];
  const active = mappings.filter((m) => m.key !== '' || m.value !== '');
  const hasLabelsClaim = isPlainObject(claims.labels);
  if (!hasLabelsClaim && active.length === 0) {
    return { result: null, notes, applied: false };
  }
  const out = {};
  if (hasLabelsClaim) for (const k of Object.keys(claims.labels)) out[k] = gjsonString(claims.labels[k]);

  if (active.length === 0) return { result: out, notes, applied: false };

  for (const m of active) {
    if (!META_KEY_RE.test(m.key)) {
      notes.push({ key: m.key, status: 'invalid-key', detail: `key "${m.key}" must match ${META_KEY_RE.source}` });
      continue;
    }
    const pathErr = validateGjsonPath(m.value);
    if (pathErr) { notes.push({ key: m.key, status: 'invalid-path', detail: pathErr }); continue; }
    const r = resolvePath(claims, m.value);
    if (!r.exists) {
      notes.push({ key: m.key, status: 'skipped', detail: `path "${m.value}" not found — silently skipped` });
      continue;
    }
    const overrode = Object.prototype.hasOwnProperty.call(out, m.key);
    out[m.key] = gjsonString(r.value);
    notes.push({
      key: m.key,
      status: overrode ? 'override' : 'extracted',
      detail: overrode ? `overrode labels.${m.key} from the top-level labels claim` : `set labels.${m.key} from "${m.value}"`,
    });
  }
  return { result: out, notes, applied: true };
}

export function buildAuthConfig(metaMappings, labelMappings) {
  const token = { hmac_secret_key: 'your-secret-key' };
  const meta = metaMappings.filter((m) => m.key && m.value);
  const labels = labelMappings.filter((m) => m.key && m.value);
  if (meta.length) token.meta_from_claim = meta.map((m) => ({ key: m.key, value: m.value }));
  if (labels.length) token.labels_from_claim = labels.map((m) => ({ key: m.key, value: m.value }));
  return JSON.stringify({ client: { token } }, null, 2);
}
