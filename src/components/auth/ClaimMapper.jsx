import React, { useMemo, useState } from 'react';
import { extractMeta, extractLabels, buildAuthConfig } from './claims';
import { JsonBlock, Snippet, MappingEditor } from './ui';
import styles from './styles.module.css';

const DEFAULT_CLAIMS = `{
  "sub": "user123",
  "exp": 1234567890,
  "user": { "role": "admin", "department": "engineering" },
  "permissions": { "level": 5 },
  "enabled_features": ["dashboard", "api"],
  "custom-info": "some info",
  "deployment": { "region": "eu" },
  "subscription": { "tier": "pro" }
}`;

const DEFAULT_META = [
  { key: 'role', value: 'user.role' },
  { key: 'dept', value: 'user.department' },
  { key: 'access_level', value: 'permissions.level' },
  { key: 'features', value: 'enabled_features' },
  { key: 'info', value: 'custom-info' },
];

const DEFAULT_LABELS = [
  { key: 'region', value: 'deployment.region' },
  { key: 'tier', value: 'subscription.tier' },
];

const NOTE_GLYPH = { extracted: '✓', override: '⤒', skipped: '·', 'invalid-key': '✕', 'invalid-path': '✕' };

export default function ClaimMapper() {
  const [claimsText, setClaimsText] = useState(DEFAULT_CLAIMS);
  const [metaRows, setMetaRows] = useState(DEFAULT_META);
  const [labelRows, setLabelRows] = useState(DEFAULT_LABELS);

  const parsed = useMemo(() => {
    try { return { claims: JSON.parse(claimsText), error: null }; }
    catch (e) { return { claims: null, error: e.message }; }
  }, [claimsText]);

  const claims = parsed.claims && typeof parsed.claims === 'object' ? parsed.claims : {};
  const meta = useMemo(() => extractMeta(claims, metaRows), [claims, metaRows]);
  const labels = useMemo(() => extractLabels(claims, labelRows), [claims, labelRows]);
  const config = useMemo(() => buildAuthConfig(metaRows, labelRows), [metaRows, labelRows]);

  const allNotes = [
    ...meta.notes.map((n) => ({ ...n, kind: 'meta' })),
    ...labels.notes.map((n) => ({ ...n, kind: 'labels' })),
  ];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>JWT claim mapping explorer</h4>
        <span className={`${styles.badge} ${styles.neutral}`}>meta + labels</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Connection JWT claims</div>
            <textarea className={styles.claims} spellCheck={false}
              value={claimsText} onChange={(e) => setClaimsText(e.target.value)} />
            {parsed.error && <div className={styles.err}>Invalid JSON: {parsed.error}</div>}
          </div>

          <MappingEditor
            label={<code>meta_from_claim</code>}
            rows={metaRows} onChange={setMetaRows} example={DEFAULT_META}
            keyPlaceholder="meta key" valuePlaceholder="claim path (e.g. user.role)" />

          <MappingEditor
            label={<code>labels_from_claim</code>}
            rows={labelRows} onChange={setLabelRows} example={DEFAULT_LABELS}
            keyPlaceholder="label key" valuePlaceholder="claim path (e.g. deployment.region)" />
          <div className={styles.hint}>Keys must match <code>^[A-Za-z_][A-Za-z0-9_]*$</code>. Paths are simple dot paths; escape a literal dot as <code>\.</code></div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Resulting connection state</div>
          <JsonBlock title="meta" value={meta.result} empty="null — no meta claim and no mapping matched" />
          <JsonBlock title="labels" value={labels.result} empty="null — no labels claim and no mapping matched" />

          <div className={styles.groupLabel}>What happened</div>
          <ul className={styles.notes}>
            {allNotes.length === 0 && <li className={styles.note}><span className={styles.noteDetail}>No mappings configured.</span></li>}
            {allNotes.map((n, i) => (
              <li className={styles.note} key={i}>
                <span className={`${styles.dot} ${styles['d-' + n.status]}`}>{NOTE_GLYPH[n.status]}</span>
                <span>
                  <span className={styles.noteKey}>{n.kind}.{n.key || '∅'}</span>{' '}
                  <span className={styles.noteDetail}>— {n.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>Config to implement this</div>
        <Snippet title="Centrifugo config" code={config} />
      </div>

      <div className={styles.caveat}>
        Mirrors PRO claim extraction: missing paths are silently skipped, mapped entries override an existing
        <code> meta</code> field / top-level <code>labels</code> entry, and label values use gjson string
        semantics. Applies to connection tokens only.
      </div>
    </div>
  );
}
