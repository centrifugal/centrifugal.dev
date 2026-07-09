import React, { useMemo, useState } from 'react';
import { decideSubscribe, buildSubTokenPayload, buildSubConfig, OVERRIDES } from './authsubtoken';
import { Snippet, JsonBlock } from './ui';
import styles from './styles.module.css';

// Generic OSS subscription-JWT explorer: build the claims, see whether the
// subscription is authorized and what it becomes, plus the token payload and config.

const DEFAULT_STATE = {
  userID: '42',
  anonymous: false,
  channel: 'chat:room42',
  exp: 'valid',        // valid | expired | none
  expireAt: 'absent',  // absent | never | future
  infoText: '',
  overrides: { presence: 'unset', joinLeave: 'unset', forcePushJoinLeave: 'unset', forceRecovery: 'unset', forcePositioning: 'unset' },
  // advanced
  tokenAud: '',
  tokenIss: '',
  cfgAudience: '',
  cfgIssuer: '',
};

const STATUS_GLYPH = { pass: '✓', fail: '✕', off: '·' };
const OVERRIDE_LABEL = Object.fromEntries(OVERRIDES.map(([k, name]) => [k, name]));

function Seg({ value, onChange, options }) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button key={o.value} type="button"
          className={value === o.value ? styles.segActive : ''}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export default function SubscriptionTokenExplorer() {
  const [state, setStateRaw] = useState(DEFAULT_STATE);
  const set = (patch) => setStateRaw((s) => ({ ...s, ...patch }));
  const setOverride = (k, v) => setStateRaw((s) => ({ ...s, overrides: { ...s.overrides, [k]: v } }));

  const result = useMemo(() => decideSubscribe(state), [state]);
  const payload = useMemo(() => buildSubTokenPayload(state), [state]);
  const config = useMemo(() => buildSubConfig(state), [state]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Subscription JWT explorer</h4>
        <span className={`${styles.badge} ${result.accepted ? styles.ok : styles.bad}`}>
          {result.accepted ? 'ACCEPTED' : 'REJECTED'}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Subscription</div>
            <div className={styles.field}>
              <span className={styles.hint}><code>channel</code> — required</span>
              <input className={`${styles.text} ${styles.mono}`} value={state.channel} onChange={(e) => set({ channel: e.target.value })} />
            </div>
            <div className={styles.field}>
              <span className={styles.hint}><code>sub</code> — user ID (must match the authenticated user ID) {state.anonymous && '(ignored — anonymous)'}</span>
              <input className={`${styles.text} ${styles.mono}`} value={state.userID} disabled={state.anonymous}
                onChange={(e) => set({ userID: e.target.value })} />
            </div>
            <div className={styles.mapRow} style={{ margin: '0.2rem 0' }}>
              <input type="checkbox" id="st-anon" checked={state.anonymous} onChange={(e) => set({ anonymous: e.target.checked })} />
              <label htmlFor="st-anon">Anonymous (no <code>sub</code>)</label>
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Expiration</div>
            <div className={styles.field}>
              <span className={styles.hint}><code>exp</code> — token / subscription expiration</span>
              <Seg value={state.exp} onChange={(v) => set({ exp: v })} options={[
                { value: 'valid', label: 'future' }, { value: 'expired', label: 'past' }, { value: 'none', label: 'none' }]} />
            </div>
            <div className={styles.field}>
              <span className={styles.hint}><code>expire_at</code> — separate subscription expiration</span>
              <Seg value={state.expireAt} onChange={(v) => set({ expireAt: v })} options={[
                { value: 'absent', label: 'absent' }, { value: 'never', label: '0 (never)' }, { value: 'future', label: 'future' }]} />
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}><code>info</code> &amp; <code>override</code></div>
            <div className={styles.field}>
              <span className={styles.hint}><code>info</code> — channel-specific, shown in presence / join-leave (JSON)</span>
              <input className={`${styles.text} ${styles.mono}`} placeholder='{"name": "Alice"}' value={state.infoText}
                onChange={(e) => set({ infoText: e.target.value })} />
            </div>
            {OVERRIDES.map(([k, name]) => (
              <div className={styles.field} key={k}>
                <span className={styles.hint}>override <code>{name}</code></span>
                <Seg value={state.overrides[k]} onChange={(v) => setOverride(k, v)} options={[
                  { value: 'unset', label: '—' }, { value: 'true', label: 'true' }, { value: 'false', label: 'false' }]} />
              </div>
            ))}
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Audience &amp; issuer <span className={styles.hint}>— recommended</span></div>
            <div className={styles.field}>
              <span className={styles.hint}>Token <code>aud</code> / server <code>client.token.audience</code></span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input className={`${styles.text} ${styles.mono}`} placeholder="token aud" value={state.tokenAud} onChange={(e) => set({ tokenAud: e.target.value })} />
                <input className={`${styles.text} ${styles.mono}`} placeholder="expected audience" value={state.cfgAudience} onChange={(e) => set({ cfgAudience: e.target.value })} />
              </div>
            </div>
            <div className={styles.field}>
              <span className={styles.hint}>Token <code>iss</code> / server <code>client.token.issuer</code></span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input className={`${styles.text} ${styles.mono}`} placeholder="token iss" value={state.tokenIss} onChange={(e) => set({ tokenIss: e.target.value })} />
                <input className={`${styles.text} ${styles.mono}`} placeholder="expected issuer" value={state.cfgIssuer} onChange={(e) => set({ cfgIssuer: e.target.value })} />
              </div>
            </div>
            <div className={styles.hint}>Subscription tokens reuse <code>client.token.audience</code> / <code>client.token.issuer</code> — setting them is good practice.</div>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Verification (assuming a valid signature)</div>
          <ul className={styles.notes}>
            {result.trace.map((t, i) => (
              <li className={styles.note} key={i}>
                <span className={`${styles.dot} ${styles['d-' + t.status]}`}>{STATUS_GLYPH[t.status]}</span>
                <span><span className={styles.noteKey}>{t.label}</span> <span className={styles.noteDetail}>— {t.detail}</span></span>
              </li>
            ))}
          </ul>

          {result.accepted ? (
            <>
              <div className={styles.groupLabel} style={{ marginTop: '0.7rem' }}>Resulting subscription</div>
              <div className={styles.kv}><span className={styles.kvKey}>channel</span><span className={styles.kvVal}>{result.subscription.channel}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>user</span><span className={styles.kvVal}>{result.subscription.user}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>expires</span><span className={styles.kvVal}>{result.subscription.expiration}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>overrides</span><span className={styles.kvVal}>
                {result.subscription.overrides.length
                  ? result.subscription.overrides.map((o) => `${o.name}=${o.value}`).join(', ')
                  : 'none (namespace defaults)'}</span></div>
              {result.subscription.info !== undefined && <JsonBlock title="info" value={result.subscription.info} />}
              {result.infoError && <div className={styles.err}>{result.infoError}</div>}
            </>
          ) : (
            <div className={styles.err} style={{ marginTop: '0.5rem' }}>Subscription rejected: <b>{result.reason}</b>.</div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>Token &amp; config</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
          <Snippet title="Subscription JWT — claims to sign" code={payload} />
          <Snippet title="Centrifugo config" code={config} />
        </div>
        <div className={styles.hint} style={{ marginTop: '0.5rem' }}>
          Sign the claims with the same key as connection tokens (or a separate one under <code>client.subscription_token</code>) and return the JWT from the SDK subscription <code>getToken</code> callback. You still need a valid connection JWT for the client.
        </div>
      </div>

      <div className={styles.caveat}>
        Models Centrifugo OSS subscription-token claim checks and the resulting subscription. Signature verification
        and the PRO <code>allow</code> capability claim are not modeled here. <code>exp</code> values are example timestamps.
      </div>
    </div>
  );
}
