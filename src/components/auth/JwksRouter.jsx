import React, { useMemo, useState } from 'react';
import { findProvider, normalizeAud, validateProviders, buildJwksConfig } from './jwks';
import { extractMeta, extractLabels } from './claims';
import { Snippet, JsonBlock, MappingEditor } from './ui';
import styles from './styles.module.css';

const DEFAULT_CLAIMS = `{
  "sub": "user123",
  "iss": "https://tenant.auth0.com/",
  "aud": "web-app",
  "user": { "role": "admin" },
  "deployment": { "region": "eu" }
}`;

const DEFAULT_PROVIDERS = [
  {
    name: 'auth0_web', enabled: true, endpoint: 'https://tenant.auth0.com/.well-known/jwks.json',
    issuer: 'https://tenant.auth0.com/', audience: 'web-app',
    metaMappings: [{ key: 'role', value: 'user.role' }],
    labelMappings: [{ key: 'region', value: 'deployment.region' }],
  },
  {
    name: 'auth0_mobile', enabled: true, endpoint: 'https://tenant.auth0.com/.well-known/jwks.json',
    issuer: 'https://tenant.auth0.com/', audience: 'mobile-app',
    metaMappings: [{ key: 'role', value: 'user.role' }],
    labelMappings: [],
  },
];

const TRACE_GLYPH = { match: '✓', fallback: '↩', skip: '·', disabled: '·' };
const NOTE_GLYPH = { extracted: '✓', override: '⤒', skipped: '·', 'invalid-key': '✕', 'invalid-path': '✕' };

export default function JwksRouter() {
  const [claimsText, setClaimsText] = useState(DEFAULT_CLAIMS);
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [open, setOpen] = useState({});

  const setP = (i, patch) => setProviders(providers.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addP = () => setProviders([...providers, { name: '', enabled: true, endpoint: '', issuer: '', audience: '', metaMappings: [], labelMappings: [] }]);
  const removeP = (i) => setProviders(providers.filter((_, j) => j !== i));

  const parsed = useMemo(() => {
    try { const v = JSON.parse(claimsText); return { claims: v && typeof v === 'object' ? v : {}, error: null }; }
    catch (e) { return { claims: {}, error: e.message }; }
  }, [claimsText]);
  const claims = parsed.claims;

  const iss = typeof claims.iss === 'string' ? claims.iss : '';
  const audArray = useMemo(() => normalizeAud(claims.aud), [claims]);

  const routing = useMemo(() => findProvider(iss, audArray, providers), [iss, audArray, providers]);
  const warns = useMemo(() => validateProviders(providers), [providers]);
  const config = useMemo(() => buildJwksConfig(providers), [providers]);

  const matched = routing.matched;
  const meta = useMemo(() => (matched ? extractMeta(claims, matched.metaMappings || []) : null), [matched, claims]);
  const labels = useMemo(() => (matched ? extractLabels(claims, matched.labelMappings || []) : null), [matched, claims]);
  const extractNotes = matched
    ? [...(meta ? meta.notes.map((n) => ({ ...n, kind: 'meta' })) : []),
       ...(labels ? labels.notes.map((n) => ({ ...n, kind: 'labels' })) : [])]
    : [];

  const matchedName = matched ? matched.name : null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>JWKS provider routing explorer</h4>
        <span className={`${styles.badge} ${matchedName ? styles.ok : styles.bad}`}>
          {matchedName ? `→ ${matchedName}${routing.viaFallback ? ' (fallback)' : ''}` : 'REJECTED'}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Incoming token claims</div>
            <textarea className={styles.claims} spellCheck={false}
              value={claimsText} onChange={(e) => setClaimsText(e.target.value)} />
            {parsed.error && <div className={styles.err}>Invalid JSON: {parsed.error}</div>}
            <div className={styles.chips}>
              <span className={styles.chip}><b>iss</b> {iss || '—'}</span>
              <span className={styles.chip}><b>aud</b> {audArray.join(', ') || '—'}</span>
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Configured providers</div>
            {providers.map((p, i) => {
              const nMaps = (p.metaMappings || []).filter((m) => m.key).length + (p.labelMappings || []).filter((m) => m.key).length;
              return (
                <div className={`${styles.provCard} ${matchedName === p.name ? styles.provMatched : ''}`} key={i}>
                  <div className={styles.provTop}>
                    <input type="checkbox" checked={p.enabled} title="enabled" onChange={(e) => setP(i, { enabled: e.target.checked })} />
                    <input className={`${styles.text} ${styles.mono}`} placeholder="name" value={p.name} onChange={(e) => setP(i, { name: e.target.value })} />
                    <input className={`${styles.text} ${styles.mono}`} placeholder="issuer" value={p.issuer} onChange={(e) => setP(i, { issuer: e.target.value })} />
                    <button type="button" className={styles.iconBtn} title="remove" onClick={() => removeP(i)}>×</button>
                  </div>
                  <div className={styles.provAud}>
                    <input className={`${styles.text} ${styles.mono}`} placeholder="audience (optional)" value={p.audience} onChange={(e) => setP(i, { audience: e.target.value })} />
                  </div>
                  <button type="button" className={styles.provToggle} onClick={() => setOpen({ ...open, [i]: !open[i] })}>
                    {open[i] ? '▾' : '▸'} claim mappings{nMaps ? ` (${nMaps})` : ''}
                  </button>
                  {open[i] && (
                    <div className={styles.provMaps}>
                      <MappingEditor label={<code>meta_from_claim</code>} rows={p.metaMappings || []}
                        onChange={(rows) => setP(i, { metaMappings: rows })}
                        keyPlaceholder="meta key" valuePlaceholder="claim path" />
                      <MappingEditor label={<code>labels_from_claim</code>} rows={p.labelMappings || []}
                        onChange={(rows) => setP(i, { labelMappings: rows })}
                        keyPlaceholder="label key" valuePlaceholder="claim path" />
                    </div>
                  )}
                </div>
              );
            })}
            <button type="button" className={styles.addRow} onClick={addP}>+ add provider</button>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Routing decision</div>
          <ul className={styles.notes}>
            {routing.trace.map((t, i) => (
              <li className={styles.note} key={i}>
                <span className={`${styles.dot} ${styles['d-' + t.status]}`}>{TRACE_GLYPH[t.status]}</span>
                <span><span className={styles.noteKey}>{t.name || '(unnamed)'}</span> <span className={styles.noteDetail}>— {t.detail}</span></span>
              </li>
            ))}
          </ul>

          {matchedName ? (
            <>
              <div className={styles.hint} style={{ margin: '0.4rem 0 0.6rem' }}>
                Verified with <b>{matchedName}</b>{routing.viaFallback ? ' via issuer-only fallback' : ''}, using <b>its</b> claim mappings:
              </div>
              <JsonBlock title="meta" value={meta && meta.result} empty="null — no meta claim and no mapping matched" />
              <JsonBlock title="labels" value={labels && labels.result} empty="null — no labels claim and no mapping matched" />
              {extractNotes.length > 0 && (
                <ul className={styles.notes}>
                  {extractNotes.map((n, i) => (
                    <li className={styles.note} key={i}>
                      <span className={`${styles.dot} ${styles['d-' + n.status]}`}>{NOTE_GLYPH[n.status]}</span>
                      <span><span className={styles.noteKey}>{n.kind}.{n.key || '∅'}</span> <span className={styles.noteDetail}>— {n.detail}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className={styles.err} style={{ marginTop: '0.5rem' }}>
              No provider matched — connection rejected: <code>no JWKS provider found for issuer: {iss || '(empty)'}</code>
            </div>
          )}

          {warns.length > 0 && (
            <div className={styles.warns}>
              <div className={styles.groupLabel} style={{ marginBottom: '0.3rem' }}>Config would be rejected at startup</div>
              {warns.map((w, i) => <div className={styles.warn} key={i}>• {w}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>Config to implement this</div>
        <Snippet title="Centrifugo config" code={config} />
      </div>

      <div className={styles.caveat}>
        Mirrors PRO issuer/audience routing end-to-end: an exact issuer+audience match wins (even over an earlier
        audience-less provider), an audience-less provider is an issuer-only fallback, and no match rejects the
        connection. The matched provider's own <code>meta_from_claim</code> / <code>labels_from_claim</code> are
        applied (not the global mapping). Same routing for connection and subscription tokens (configured separately).
      </div>
    </div>
  );
}
