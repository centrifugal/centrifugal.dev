import React, { useMemo, useState } from 'react';
import { resolveCaps, CAP_OPS, CAP_LABEL } from './engine';
import { Snippet } from '../auth/ui';
import styles from '../auth/styles.module.css';

const DEFAULT_CAPS = `[
  { "channels": ["news:*"], "match": "wildcard", "allow": ["sub"] },
  { "channels": ["news:sports"], "allow": ["pub", "hst"] }
]`;

export default function CapabilityResolver() {
  const [capsText, setCapsText] = useState(DEFAULT_CAPS);
  const [channel, setChannel] = useState('news:sports');

  const parsed = useMemo(() => {
    const t = capsText.trim();
    if (t === '') return { caps: [], error: null };
    try { const v = JSON.parse(t); return { caps: Array.isArray(v) ? v : [], error: Array.isArray(v) ? null : 'caps must be a JSON array' }; }
    catch (e) { return { caps: [], error: e.message }; }
  }, [capsText]);

  const result = useMemo(() => resolveCaps(parsed.caps, channel), [parsed.caps, channel]);
  const tokenSnippet = useMemo(
    () => JSON.stringify({ sub: '17', exp: 1893456000, caps: parsed.caps }, null, 2),
    [parsed.caps]
  );

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Capability resolver</h4>
        <span className={`${styles.badge} ${result.effective.length ? styles.ok : styles.bad}`}>
          {result.effective.length ? result.effective.join(' · ') : 'no access'}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Connection <code>caps</code> (JWT claim / connect proxy)</div>
            <textarea className={styles.claims} spellCheck={false} value={capsText}
              onChange={(e) => setCapsText(e.target.value)} style={{ minHeight: '9rem' }} />
            {parsed.error && <div className={styles.err}>Invalid JSON: {parsed.error}</div>}
          </div>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Channel the client attempts</div>
            <input className={`${styles.text} ${styles.mono}`} value={channel} onChange={(e) => setChannel(e.target.value)} />
            <div className={styles.hint} style={{ marginTop: '0.3rem' }}>
              <code>match</code>: omit for exact, or <code>wildcard</code> / <code>regex</code> — applies to every channel in that caps object.
            </div>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Effective capabilities for <code>{channel}</code></div>
          <div className={styles.chips} style={{ marginBottom: '0.6rem' }}>
            {CAP_OPS.map((op) => (
              <span key={op} className={styles.chip}
                style={result.ops[op].allowed
                  ? { background: 'rgba(75,210,122,0.18)', color: '#1a9e52' }
                  : { opacity: 0.55 }}>
                {result.ops[op].allowed ? '✓' : '✕'} <b>{op}</b> {CAP_LABEL[op]}
              </span>
            ))}
          </div>

          <ul className={styles.notes}>
            {CAP_OPS.map((op) => (
              <li className={styles.note} key={op}>
                <span className={`${styles.dot} ${result.ops[op].allowed ? styles['d-pass'] : styles['d-fail']}`}>{result.ops[op].allowed ? '✓' : '✕'}</span>
                <span>
                  <span className={styles.noteKey}>{op}</span>{' '}
                  <span className={styles.noteDetail}>
                    {result.ops[op].allowed
                      ? `granted by caps[${result.ops[op].by}] (matched "${result.ops[op].resource}"${result.ops[op].match ? ` via ${result.ops[op].match}` : ' exact'})`
                      : 'no caps object both allows this op and matches the channel'}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.groupLabel} style={{ marginTop: '0.7rem' }}>Per-object channel match</div>
          <ul className={styles.notes}>
            {result.objects.map((o) => (
              <li className={styles.note} key={o.index}>
                <span className={`${styles.dot} ${o.matches ? styles['d-pass'] : styles['d-off']}`}>{o.matches ? '✓' : '·'}</span>
                <span>
                  <span className={styles.noteKey}>caps[{o.index}]</span>{' '}
                  <span className={styles.noteDetail}>
                    allow [{o.allow.join(', ') || '—'}]{o.match ? ` · ${o.match}` : ''} — {o.matches ? `matches "${o.matchedResource}"` : 'no channel match'}
                  </span>
                </span>
              </li>
            ))}
            {result.objects.length === 0 && <li className={styles.note}><span className={styles.noteDetail}>No caps objects.</span></li>}
          </ul>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>Connection JWT claims</div>
        <Snippet title="claims to sign" code={tokenSnippet} />
      </div>

      <div className={styles.caveat}>
        Capabilities are evaluated <b>per operation</b>: a channel's effective caps are the <b>union</b> of the
        <code> allow</code> sets of every caps object whose channels match it. Object order does not change the
        outcome, and caps only ever <b>grant</b> — a more specific object can't take an operation away. Reproduces
        <code> HasChannelCapability</code> (internal/caps/match.go).
      </div>
    </div>
  );
}
