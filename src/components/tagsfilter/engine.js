// Reproduces Centrifugo's tags FilterNode evaluation + validation
// (vendored/centrifuge/internal/filter/filter.go: Match + Validate) and the
// server∩client composition used at delivery (hub.go: server filter first,
// client can only narrow, fail-closed).
//
// FilterNode = { op, key, cmp, val, vals, nodes }. A leaf has op === "".

export const LEAF_CMPS = ['eq', 'neq', 'in', 'nin', 'ex', 'nex', 'sw', 'ew', 'ct', 'gt', 'gte', 'lt', 'lte'];
const VAL_CMPS = ['eq', 'neq', 'sw', 'ew', 'ct', 'gt', 'gte', 'lt', 'lte'];
const LIST_CMPS = ['in', 'nin'];
const KEYLESS_CMPS = ['ex', 'nex'];
const NUM_CMPS = ['gt', 'gte', 'lt', 'lte'];

// Parse like udecimal.Parse: only a plain numeric literal succeeds.
function parseNum(s) {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---- validation (mirrors filter.Validate; stricter than Match) ----
export function validateFilter(node) {
  if (!node || typeof node !== 'object') return 'filter node must be an object';
  const op = node.op || '';
  if (op === '') {
    const cmp = node.cmp || '';
    if (cmp === '') return 'leaf node must have cmp set';
    if (VAL_CMPS.includes(cmp)) {
      if (!node.val) return `${cmp} comparison requires val`;
      if (Array.isArray(node.vals) && node.vals.length) return `${cmp} comparison must not use vals`;
    } else if (LIST_CMPS.includes(cmp)) {
      if (!Array.isArray(node.vals) || node.vals.length === 0) return `${cmp} comparison requires non-empty vals`;
      if (node.val) return `${cmp} comparison must not use val`;
    } else if (KEYLESS_CMPS.includes(cmp)) {
      if (node.val || (Array.isArray(node.vals) && node.vals.length)) return `${cmp} comparison must not use val or vals`;
    } else {
      return `unknown comparison operator: ${cmp}`;
    }
    if (!KEYLESS_CMPS.includes(cmp) && !node.key) return 'leaf node requires key';
    return null;
  }
  if (op === 'and' || op === 'or') {
    if (!Array.isArray(node.nodes) || node.nodes.length === 0) return `${op} node must have at least one child`;
    for (const c of node.nodes) { const e = validateFilter(c); if (e) return e; }
    return null;
  }
  if (op === 'not') {
    if (!Array.isArray(node.nodes) || node.nodes.length !== 1) return 'not node must have exactly one child';
    return validateFilter(node.nodes[0]);
  }
  return `invalid op: ${op}`;
}

// ---- evaluation with trace (mirrors filter.Match) ----
// Returns { result, label, detail, op, children }.
export function evalTrace(node, tags) {
  const op = (node && node.op) || '';
  if (op === '') {
    const cmp = node.cmp || '';
    const has = Object.prototype.hasOwnProperty.call(tags, node.key);
    const val = has ? String(tags[node.key]) : '';
    const listStr = `[${(node.vals || []).join(', ')}]`;
    const rhs = LIST_CMPS.includes(cmp) ? listStr : `"${node.val ?? ''}"`;
    const label = `${node.key || '∅'} ${cmp} ${rhs}`;
    let result = false;
    let detail;
    switch (cmp) {
      case 'eq': result = has && val === node.val; break;
      case 'neq': result = !has || val !== node.val; break;
      case 'in': result = (node.vals || []).includes(val); break;
      case 'nin': result = !(node.vals || []).includes(val); break;
      case 'ex': result = has; break;
      case 'nex': result = !has; break;
      case 'sw': result = has && val.startsWith(node.val); break;
      case 'ew': result = has && val.endsWith(node.val); break;
      case 'ct': result = has && val.includes(node.val); break;
      case 'gt': case 'gte': case 'lt': case 'lte': {
        const a = has ? parseNum(val) : null;
        const b = parseNum(node.val);
        if (a === null || b === null) {
          result = false;
          detail = !has ? `tag "${node.key}" absent → false`
            : a === null ? `tag "${node.key}"="${val}" is not numeric → false`
              : `operand "${node.val}" is not numeric → false`;
        } else {
          result = cmp === 'gt' ? a > b : cmp === 'gte' ? a >= b : cmp === 'lt' ? a < b : a <= b;
        }
        break;
      }
      default: result = false; detail = `unknown cmp "${cmp}"`;
    }
    if (!detail) {
      detail = has ? `tag "${node.key}"="${val}"` : (NUM_CMPS.includes(cmp) || ['eq', 'sw', 'ew', 'ct', 'in'].includes(cmp) ? `tag "${node.key}" absent` : `tag "${node.key}" absent`);
    }
    return { result, label, detail, op: '', children: [] };
  }

  const kids = (node.nodes || []).map((c) => evalTrace(c, tags));
  if (op === 'and') return { result: kids.every((k) => k.result), label: 'AND', op, children: kids };
  if (op === 'or') return { result: kids.some((k) => k.result), label: 'OR', op, children: kids };
  if (op === 'not') return { result: kids.length === 1 ? !kids[0].result : false, label: 'NOT', op, children: kids };
  return { result: false, label: `invalid op "${op}"`, op, children: kids };
}

export function matchFilter(node, tags) {
  return evalTrace(node, tags).result;
}

// server∩client composition at delivery (server first, fail-closed, client narrows only)
export function composeDelivery(serverNode, clientNode, tags) {
  const out = { serverTrace: null, clientTrace: null, delivered: true, droppedBy: null };
  if (serverNode) {
    out.serverTrace = evalTrace(serverNode, tags);
    if (!out.serverTrace.result) { out.delivered = false; out.droppedBy = 'server'; return out; }
  }
  if (clientNode) {
    out.clientTrace = evalTrace(clientNode, tags);
    if (!out.clientTrace.result) { out.delivered = false; out.droppedBy = 'client'; return out; }
  }
  return out;
}
