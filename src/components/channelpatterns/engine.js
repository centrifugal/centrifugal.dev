// Models Centrifugo PRO channel-pattern matching (internal/pro/shift radix
// router + validate_pro.go). Patterns are HTTP-router-style: literal text plus
// `:var` path variables that each capture exactly ONE segment (up to the next
// "/", non-empty). Static matches beat variable matches. A channel only enters
// pattern matching when channel.patterns is on AND the channel starts with "/".

// Tokenize "/personal/user_:user" → [{lit:"/personal/user_"}, {var:"user"}].
export function tokenize(pattern) {
  const tokens = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === ':') {
      let j = i + 1;
      let name = '';
      while (j < pattern.length && pattern[j] !== '/') { name += pattern[j]; j++; }
      tokens.push({ type: 'var', name });
      i = j;
    } else {
      let lit = '';
      while (i < pattern.length && pattern[i] !== ':') { lit += pattern[i]; i++; }
      tokens.push({ type: 'lit', text: lit });
    }
  }
  return tokens;
}

// Match a single pattern against a channel. Returns { matched, vars }.
export function matchPattern(pattern, channel) {
  const tokens = tokenize(pattern);
  const vars = {};
  let pos = 0;
  for (const tk of tokens) {
    if (tk.type === 'lit') {
      if (channel.slice(pos, pos + tk.text.length) !== tk.text) return { matched: false, vars: {} };
      pos += tk.text.length;
    } else {
      let next = channel.indexOf('/', pos);
      if (next === -1) next = channel.length;
      const seg = channel.slice(pos, next);
      if (seg === '') return { matched: false, vars: {} }; // empty variable not allowed
      vars[tk.name] = seg;
      pos = next;
    }
  }
  if (pos !== channel.length) return { matched: false, vars: {} };
  return { matched: true, vars };
}

// Specificity signature: literals kept, each var → a high-sorting sentinel, so
// "more literal earlier" sorts first (static beats variable at each position).
function signature(pattern) {
  return tokenize(pattern).map((t) => (t.type === 'lit' ? t.text : '￿')).join('');
}

// patterns: [{ name, pattern }]. Resolves which namespace a channel maps to.
export function resolve(patterns, channel) {
  const patternsEnabledApplies = channel.startsWith('/');
  const candidates = patterns.map((p, index) => {
    const m = matchPattern(p.pattern, channel);
    return { index, name: p.name, pattern: p.pattern, matched: m.matched, vars: m.vars, sig: signature(p.pattern) };
  });
  const matches = candidates.filter((c) => c.matched);
  matches.sort((a, b) => (a.sig < b.sig ? -1 : a.sig > b.sig ? 1 : 0));
  const winner = patternsEnabledApplies ? (matches[0] || null) : null;
  return { applies: patternsEnabledApplies, candidates, winner, matchCount: matches.length };
}

// Startup validation (validate_pro.go + radix build). Returns warning strings.
export function validatePatterns(patterns) {
  const warns = [];
  const sigs = {};
  for (const p of patterns) {
    const pat = p.pattern || '';
    if (pat === '') continue;
    if (!pat.startsWith('/')) warns.push(`Pattern "${pat}" must start with "/".`);
    if (pat.includes('//')) warns.push(`Pattern "${pat}" can not contain two consecutive "/".`);
    if (pat.includes('*')) warns.push(`Pattern "${pat}" can not contain the wildcard "*".`);
    // eslint-disable-next-line no-control-regex
    if (/[^\x00-\x7F]/.test(pat)) warns.push(`Pattern "${pat}" must be ASCII.`);
    const names = tokenize(pat).filter((t) => t.type === 'var').map((t) => t.name);
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) warns.push(`Pattern "${pat}" has duplicate variable name ":${dup}".`);
    const sig = signature(pat);
    if (sigs[sig]) warns.push(`Pattern "${pat}" conflicts with already-registered pattern "${sigs[sig]}" (same structure).`);
    else sigs[sig] = pat;
  }
  return [...new Set(warns)];
}

export function buildPatternsConfig(patterns) {
  return JSON.stringify({
    channel: {
      patterns: true,
      namespaces: patterns.map((p) => ({ name: p.name, pattern: p.pattern })),
    },
  }, null, 2);
}
