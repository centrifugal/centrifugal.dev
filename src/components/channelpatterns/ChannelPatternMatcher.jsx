import React, { useMemo, useState } from 'react';
import { resolve, validatePatterns, buildPatternsConfig } from './engine';
import { Snippet } from '../auth/ui';
import styles from '../auth/styles.module.css';

const DEFAULT_PATTERNS = [
  { name: 'chat', pattern: '/chat/:room' },
  { name: 'chat_lobby', pattern: '/chat/lobby' },
  { name: 'personal', pattern: '/personal/user_:user' },
];

export default function ChannelPatternMatcher() {
  const [patterns, setPatterns] = useState(DEFAULT_PATTERNS);
  const [channel, setChannel] = useState('/chat/42');

  const setP = (i, patch) => setPatterns(patterns.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addP = () => setPatterns([...patterns, { name: '', pattern: '' }]);
  const removeP = (i) => setPatterns(patterns.filter((_, j) => j !== i));

  const result = useMemo(() => resolve(patterns, channel), [patterns, channel]);
  const warns = useMemo(() => validatePatterns(patterns), [patterns]);
  const config = useMemo(() => buildPatternsConfig(patterns), [patterns]);

  const winner = result.winner;
  const badge = !result.applies ? 'not a pattern channel' : winner ? winner.name : '102 unknown channel';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Channel pattern matcher</h4>
        <span className={`${styles.badge} ${winner ? styles.ok : styles.bad}`}>{winner ? `→ ${badge}` : badge}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Channel</div>
            <input className={`${styles.text} ${styles.mono}`} value={channel} onChange={(e) => setChannel(e.target.value)} />
            {!result.applies && <div className={styles.hint} style={{ marginTop: '0.3rem' }}>Pattern matching only runs for channels starting with <code>/</code> (with <code>channel.patterns: true</code>). Other channels use ordinary <code>name:rest</code> namespacing.</div>}
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Namespace patterns</div>
            {patterns.map((p, i) => (
              <div className={styles.mapRow} key={i}>
                <input className={`${styles.text} ${styles.mono} ${styles.mapKey}`} placeholder="name" value={p.name} onChange={(e) => setP(i, { name: e.target.value })} />
                <span className={styles.arrow}>›</span>
                <input className={`${styles.text} ${styles.mono} ${styles.mapVal}`} placeholder="/chat/:room" value={p.pattern} onChange={(e) => setP(i, { pattern: e.target.value })} />
                <button type="button" className={styles.iconBtn} onClick={() => removeP(i)}>×</button>
              </div>
            ))}
            <button type="button" className={styles.addRow} onClick={addP}>+ add pattern</button>
            <div className={styles.hint} style={{ marginTop: '0.3rem' }}>A <code>:var</code> captures exactly one segment (up to the next <code>/</code>). Static patterns beat variable ones.</div>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Match result</div>
          {winner ? (
            <>
              <div className={styles.kv}><span className={styles.kvKey}>namespace</span><span className={styles.kvVal}>{winner.name || '(unnamed)'}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>pattern</span><span className={styles.kvVal}><code>{winner.pattern}</code></span></div>
              <div className={styles.kv}><span className={styles.kvKey}>vars</span><span className={styles.kvVal}>{Object.keys(winner.vars).length ? Object.entries(winner.vars).map(([k, v]) => `${k}=${v}`).join(', ') : 'none'}</span></div>
              <div className={styles.hint} style={{ marginTop: '0.2rem' }}>These <code>vars</code> are available in <code>subscribe_cel</code> / transforms as <code>vars.{Object.keys(winner.vars)[0] || 'name'}</code>.</div>
            </>
          ) : (
            <div className={styles.err}>{result.applies ? 'No pattern matches — the client gets 102: unknown channel.' : 'Not matched via patterns (channel does not start with "/").'}</div>
          )}

          <div className={styles.groupLabel} style={{ marginTop: '0.7rem' }}>Per-pattern</div>
          <ul className={styles.notes}>
            {result.candidates.map((c) => (
              <li className={styles.note} key={c.index}>
                <span className={`${styles.dot} ${winner && winner.index === c.index ? styles['d-match'] : c.matched ? styles['d-pass'] : styles['d-off']}`}>{c.matched ? '✓' : '·'}</span>
                <span>
                  <span className={styles.noteKey}>{c.name || '(unnamed)'}</span> <code className={styles.noteDetail}>{c.pattern}</code>
                  <span className={styles.noteDetail}> — {c.matched ? (winner && winner.index === c.index ? 'matches — wins (most static)' : 'matches, but a more static pattern wins') : 'no match'}</span>
                </span>
              </li>
            ))}
          </ul>

          {warns.length > 0 && (
            <div className={styles.warns}>
              <div className={styles.groupLabel} style={{ marginBottom: '0.3rem' }}>Config would be rejected at startup</div>
              {warns.map((w, i) => <div className={styles.warn} key={i}>• {w}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>Config</div>
        <Snippet title="Centrifugo config" code={config} />
      </div>

      <div className={styles.caveat}>
        Reproduces the PRO channel-pattern router: <code>:var</code> matches a single non-empty segment, static
        beats variable, and each matched pattern is its own namespace exposing <code>vars</code>. Wildcards
        (<code>*</code>), non-ASCII, duplicate variable names, and conflicting patterns are rejected on startup.
      </div>
    </div>
  );
}
