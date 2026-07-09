import React, { useMemo, useState } from 'react';
import { validateFilter, evalTrace, composeDelivery } from './engine';
import { Snippet } from '../auth/ui';
import styles from '../auth/styles.module.css';

const DEFAULT_TAGS = [
  { key: 'symbol', value: 'AAPL' },
  { key: 'type', value: 'stock' },
  { key: 'price', value: '150' },
  { key: 'exchange', value: 'NASDAQ' },
];

const CLIENT_FILTER = `{
  "op": "and",
  "nodes": [
    { "cmp": "eq", "key": "type", "val": "stock" },
    { "cmp": "gte", "key": "price", "val": "100" }
  ]
}`;

const SERVER_FILTER = `{ "cmp": "eq", "key": "exchange", "val": "NASDAQ" }`;

function TraceTree({ node, depth = 0 }) {
  if (!node) return null;
  return (
    <li className={styles.note} style={{ marginLeft: depth ? '1rem' : 0 }}>
      <span className={`${styles.dot} ${node.result ? styles['d-pass'] : styles['d-fail']}`}>{node.result ? '✓' : '✕'}</span>
      <div style={{ minWidth: 0 }}>
        <span className={styles.noteKey}>{node.label}</span>
        {node.detail && <span className={styles.noteDetail}> — {node.detail}</span>}
        {node.children && node.children.length > 0 && (
          <ul className={styles.notes} style={{ marginTop: '0.15rem' }}>
            {node.children.map((c, i) => <TraceTree key={i} node={c} depth={depth + 1} />)}
          </ul>
        )}
      </div>
    </li>
  );
}

function parseFilter(text) {
  const t = text.trim();
  if (t === '') return { node: null, error: null };
  let node;
  try { node = JSON.parse(t); } catch (e) { return { node: null, error: 'Invalid JSON: ' + e.message }; }
  const v = validateFilter(node);
  return { node: v ? null : node, error: v };
}

export default function TagsFilterEvaluator({ server = false }) {
  const [tags, setTags] = useState(DEFAULT_TAGS);
  const [clientText, setClientText] = useState(CLIENT_FILTER);
  const [serverText, setServerText] = useState(SERVER_FILTER);

  const setTag = (i, patch) => setTags(tags.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const addTag = () => setTags([...tags, { key: '', value: '' }]);
  const removeTag = (i) => setTags(tags.filter((_, j) => j !== i));

  const tagMap = useMemo(() => {
    const m = {};
    for (const t of tags) if (t.key !== '') m[t.key] = t.value;
    return m;
  }, [tags]);

  const client = useMemo(() => parseFilter(clientText), [clientText]);
  const srv = useMemo(() => parseFilter(serverText), [serverText]);

  let verdict; let compose = null; let clientTrace = null;
  if (server) {
    if (!srv.error && !client.error) compose = composeDelivery(srv.node, client.node, tagMap);
    verdict = compose ? (compose.delivered ? 'DELIVERED' : 'DROPPED') : '—';
  } else {
    if (!client.error && client.node) clientTrace = evalTrace(client.node, tagMap);
    verdict = clientTrace ? (clientTrace.result ? 'DELIVERED' : 'FILTERED OUT') : '—';
  }
  const good = verdict === 'DELIVERED';

  const snippet = server
    ? JSON.stringify({ server_tags_filter: srv.error ? '<valid FilterNode>' : srv.node }, null, 2)
    : `const sub = centrifuge.newSubscription('channel', {\n  tagsFilter: ${(client.error ? '/* valid FilterNode */ {}' : JSON.stringify(client.node))}\n});`;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>{server ? 'Server tags-filter simulator' : 'Tags-filter evaluator'}</h4>
        <span className={`${styles.badge} ${good ? styles.ok : verdict === '—' ? styles.neutral : styles.bad}`}>{verdict}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Publication <code>tags</code></div>
            {tags.map((t, i) => (
              <div className={styles.mapRow} key={i}>
                <input className={`${styles.text} ${styles.mono} ${styles.mapKey}`} placeholder="key" value={t.key} onChange={(e) => setTag(i, { key: e.target.value })} />
                <span className={styles.arrow}>=</span>
                <input className={`${styles.text} ${styles.mono} ${styles.mapVal}`} placeholder="value" value={t.value} onChange={(e) => setTag(i, { value: e.target.value })} />
                <button type="button" className={styles.iconBtn} onClick={() => removeTag(i)}>×</button>
              </div>
            ))}
            <button type="button" className={styles.addRow} onClick={addTag}>+ add tag</button>
          </div>

          {server && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>Server filter <span className={styles.hint}>(backend-set, security boundary)</span></div>
              <textarea className={styles.claims} spellCheck={false} value={serverText} onChange={(e) => setServerText(e.target.value)} style={{ minHeight: '4.5rem' }} />
              {srv.error && <div className={styles.err}>{srv.error}</div>}
            </div>
          )}

          <div className={styles.group}>
            <div className={styles.groupLabel}>{server ? 'Client filter' : 'Tags filter'} <span className={styles.hint}>(subscriber-provided)</span></div>
            <textarea className={styles.claims} spellCheck={false} value={clientText} onChange={(e) => setClientText(e.target.value)} style={{ minHeight: '6rem' }} />
            {client.error && <div className={styles.err}>{client.error}</div>}
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Evaluation</div>
          {server ? (
            compose ? (
              <>
                {compose.serverTrace && (<><div className={styles.hint}>Server filter (applied first):</div><ul className={styles.notes}><TraceTree node={compose.serverTrace} /></ul></>)}
                {compose.clientTrace
                  ? (<><div className={styles.hint} style={{ marginTop: '0.4rem' }}>Client filter:</div><ul className={styles.notes}><TraceTree node={compose.clientTrace} /></ul></>)
                  : <div className={styles.hint} style={{ marginTop: '0.4rem' }}>Client filter not evaluated — the server filter already dropped the publication.</div>}
                <div className={styles.kv} style={{ marginTop: '0.6rem' }}><span className={styles.kvKey}>result</span>
                  <span className={styles.kvVal}>{compose.delivered ? 'delivered to the subscriber' : `dropped by the ${compose.droppedBy} filter`}</span></div>
              </>
            ) : <div className={styles.hint}>Fix the filter JSON to evaluate.</div>
          ) : (
            clientTrace ? <ul className={styles.notes}><TraceTree node={clientTrace} /></ul> : <div className={styles.hint}>Fix the filter JSON to evaluate.</div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>{server ? 'Config' : 'Client subscription'}</div>
        <Snippet title={server ? 'server_tags_filter' : 'centrifuge-js'} code={snippet} />
      </div>

      <div className={styles.caveat}>
        {server
          ? <>Both filters must pass for delivery; the <b>server filter is applied first</b> as the security boundary and the client filter can only narrow further. An evaluation error fails closed (drops). </>
          : <>The subscriber only receives a publication whose <code>tags</code> match this filter. </>}
        Numeric comparisons (<code>gt/gte/lt/lte</code>) evaluate to <b>false</b> when the tag is absent or non-numeric. Mirrors <code>filter.Match</code>/<code>Validate</code>.
      </div>
    </div>
  );
}
