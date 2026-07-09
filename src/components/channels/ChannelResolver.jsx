import React, { useMemo, useState } from 'react';
import { resolveNamespace, validateOptions, buildNamespaceConfig } from './engine';
import { Snippet } from '../auth/ui';
import styles from '../auth/styles.module.css';

const DEFAULT_OPTS = {
  presence: false,
  historySize: '0',
  historyTTL: '',
  historyMetaTTL: '',
  forcePositioning: false,
  forceRecovery: false,
  forceRecoveryMode: '',
  autoCacheRecover: false,
  deltaPublish: false,
  allowUserLimited: false,
};

function Check({ opts, set, name, label }) {
  return (
    <div className={styles.mapRow} style={{ margin: '0.22rem 0' }}>
      <input type="checkbox" id={'ch-' + name} checked={!!opts[name]} onChange={(e) => set({ [name]: e.target.checked })} />
      <label htmlFor={'ch-' + name}><code>{label}</code></label>
    </div>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? styles.segActive : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function Bool({ on, children }) {
  return <div className={styles.kv}><span className={`${styles.dot} ${on ? styles['d-pass'] : styles['d-off']}`} style={{ marginTop: '0.2rem' }}>{on ? '✓' : '·'}</span><span className={styles.kvVal} style={{ fontWeight: 500 }}>{children}</span></div>;
}

export default function ChannelResolver() {
  const [channel, setChannel] = useState('chat:room42');
  const [nsNames, setNsNames] = useState('public, personal, chat');
  const [opts, setOptsRaw] = useState(DEFAULT_OPTS);
  const set = (patch) => setOptsRaw((s) => ({ ...s, ...patch }));

  const names = useMemo(() => nsNames.split(',').map((s) => s.trim()).filter(Boolean), [nsNames]);
  const res = useMemo(() => resolveNamespace(channel, names), [channel, names]);
  const val = useMemo(() => validateOptions(opts), [opts]);
  const config = useMemo(() => buildNamespaceConfig(res.isDefault ? '' : res.namespace, opts), [res, opts]);

  const badge = res.found ? (res.isDefault ? 'default namespace' : res.namespace) : '102 unknown channel';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Channel resolver &amp; options</h4>
        <span className={`${styles.badge} ${res.found ? styles.ok : styles.bad}`}>{res.found ? `→ ${badge}` : badge}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Channel &amp; defined namespaces</div>
            <div className={styles.field}>
              <span className={styles.hint}>channel</span>
              <input className={`${styles.text} ${styles.mono}`} value={channel} onChange={(e) => setChannel(e.target.value)} />
            </div>
            <div className={styles.field}>
              <span className={styles.hint}>defined namespace names (comma-separated)</span>
              <input className={`${styles.text} ${styles.mono}`} value={nsNames} onChange={(e) => setNsNames(e.target.value)} />
            </div>
            <div className={styles.hint}><code>:</code> splits the namespace · <code>#</code> = user-limited · <code>$</code> prefix = private. Each namespace's options are configured independently under <code>channel.namespaces</code> (the default lives under <code>channel.without_namespace</code>).</div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Namespace options</div>
            <Check opts={opts} set={set} name="presence" label="presence" />
            <div className={styles.field}>
              <span className={styles.hint}><code>history_size</code> / <code>history_ttl</code> / <code>history_meta_ttl</code></span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input className={`${styles.text} ${styles.mono}`} style={{ width: '4rem' }} value={opts.historySize} onChange={(e) => set({ historySize: e.target.value })} />
                <input className={`${styles.text} ${styles.mono}`} placeholder="300s" value={opts.historyTTL} onChange={(e) => set({ historyTTL: e.target.value })} />
                <input className={`${styles.text} ${styles.mono}`} placeholder="720h" value={opts.historyMetaTTL} onChange={(e) => set({ historyMetaTTL: e.target.value })} />
              </div>
            </div>
            <Check opts={opts} set={set} name="forcePositioning" label="force_positioning" />
            <Check opts={opts} set={set} name="forceRecovery" label="force_recovery" />
            <div className={styles.field}>
              <span className={styles.hint}><code>force_recovery_mode</code></span>
              <Seg value={opts.forceRecoveryMode} onChange={(v) => set({ forceRecoveryMode: v })}
                options={[{ value: '', label: 'default (stream)' }, { value: 'stream', label: 'stream' }, { value: 'cache', label: 'cache' }]} />
            </div>
            <Check opts={opts} set={set} name="autoCacheRecover" label="auto_cache_recover" />
            <Check opts={opts} set={set} name="deltaPublish" label="delta_publish (fossil)" />
            <Check opts={opts} set={set} name="allowUserLimited" label="allow_user_limited_channels" />
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Resolution</div>
          <div className={styles.kv}><span className={styles.kvKey}>namespace</span><span className={styles.kvVal}>{res.found ? (res.isDefault ? 'default (without_namespace)' : res.namespace) : `"${res.namespace}" is not defined → 102 unknown channel`}</span></div>
          <div className={styles.kv}><span className={styles.kvKey}>private ($)</span><span className={styles.kvVal}>{res.isPrivate ? 'yes — needs a subscription token' : 'no'}</span></div>
          <div className={styles.kv}><span className={styles.kvKey}>user-limited (#)</span><span className={styles.kvVal}>{res.isUserLimited ? (opts.allowUserLimited ? 'yes — only the users listed after # may subscribe' : 'contains #, but allow_user_limited_channels is off → the # is an ordinary character (normal permission checks apply)') : 'no'}</span></div>

          <div className={styles.groupLabel} style={{ marginTop: '0.7rem' }}>Effective behavior</div>
          <Bool on={val.effective.presence}>presence</Bool>
          <Bool on={val.effective.history}>history / recoverable stream {val.effective.history ? '' : '(needs both history_size and history_ttl)'}</Bool>
          <Bool on={val.effective.recovery}>automatic recovery ({val.effective.recoveryMode})</Bool>
          <Bool on={val.effective.positioning}>positioning</Bool>
          <Bool on={val.effective.delta}>delta compression (fossil)</Bool>
          <Bool on={val.effective.userLimited}>user-limited channels</Bool>

          {val.errors.length > 0 && (
            <div className={styles.warns}>
              <div className={styles.groupLabel} style={{ marginBottom: '0.3rem' }}>Config would be rejected at startup</div>
              {val.errors.map((e, i) => <div className={styles.warn} key={i}>• {e}</div>)}
            </div>
          )}
          {val.advisories.map((a, i) => <div className={styles.hint} key={i} style={{ marginTop: '0.4rem' }}>⚠ {a}</div>)}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>Config</div>
        <Snippet title="Centrifugo config" code={config} />
      </div>

      <div className={styles.caveat}>
        Reproduces channel → namespace resolution and the startup dependency checks
        (<code>validateChannelOptions</code>). History needs <b>both</b> size and ttl; recovery needs history;
        <code> auto_cache_recover</code> needs <code>force_recovery</code> + cache mode. Positioning-without-history
        is an advisory, not a startup error.
      </div>
    </div>
  );
}
