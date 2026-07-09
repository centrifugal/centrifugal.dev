import React, { useState } from 'react';
import styles from './styles.module.css';

export function Copy({ text, className }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className || styles.copyBtn}
      onClick={() => {
        try {
          navigator.clipboard.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          });
        } catch (e) { /* clipboard unavailable */ }
      }}
    >{done ? 'copied' : 'copy'}</button>
  );
}

export function JsonBlock({ title, value, empty }) {
  const text = value == null ? empty : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className={styles.jsonHead}>
        <span className={styles.jsonTitle}>{title}</span>
        {value != null && <Copy text={text} />}
      </div>
      <pre className={styles.jsonBlock}><code>{text}</code></pre>
    </div>
  );
}

export function Snippet({ title, code }) {
  return (
    <div className={styles.snippet}>
      <div className={styles.snippetHead}>
        <span className={styles.snippetTitle}>{title}</span>
        <Copy text={code} />
      </div>
      <pre className={styles.snippetCode}><code>{code}</code></pre>
    </div>
  );
}

// Editable key → path mapping list (used for meta_from_claim / labels_from_claim).
export function MappingEditor({ label, rows, onChange, keyPlaceholder, valuePlaceholder, example }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...rows, { key: '', value: '' }]);
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  return (
    <div className={styles.group}>
      <div className={styles.groupLabel}>
        {label}
        {example && <button type="button" className={styles.exampleBtn} onClick={() => onChange(example)}>reset example</button>}
      </div>
      {rows.map((r, i) => (
        <div className={styles.mapRow} key={i}>
          <input className={`${styles.text} ${styles.mono} ${styles.mapKey}`} value={r.key}
            placeholder={keyPlaceholder} onChange={(e) => set(i, { key: e.target.value })} />
          <span className={styles.arrow}>←</span>
          <input className={`${styles.text} ${styles.mono} ${styles.mapVal}`} value={r.value}
            placeholder={valuePlaceholder} onChange={(e) => set(i, { value: e.target.value })} />
          <button type="button" className={styles.iconBtn} title="remove" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button type="button" className={styles.addRow} onClick={add}>+ add mapping</button>
    </div>
  );
}
