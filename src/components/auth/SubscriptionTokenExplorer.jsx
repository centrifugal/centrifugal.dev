import React, { useMemo, useState } from 'react';
import { decideSubscribe, buildSubTokenPayload, buildSubConfig, claimsToSubState, OVERRIDES } from './authsubtoken';
import { decodeJwt, describeTime, tokenWarnings, makeToken } from './jwtdecode';
import { Snippet, JsonBlock } from './ui';
import styles from './styles.module.css';

// Generic OSS subscription-JWT explorer with two modes:
//  - build:  compose claims and see whether the subscription is authorized.
//  - decode: paste an existing subscription JWT and run the same checks.
// Both modes feed the identical decideSubscribe() trace + "resulting subscription".

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
const TIME_CLAIMS = ['iat', 'nbf', 'exp', 'expire_at'];

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
  const [mode, setMode] = useState('build');
  const [state, setStateRaw] = useState(DEFAULT_STATE);
  const [dec, setDec] = useState({ token: '', cfgAudience: '', cfgIssuer: '', connUser: '' });
  const set = (patch) => setStateRaw((s) => ({ ...s, ...patch }));
  const setOverride = (k, v) => setStateRaw((s) => ({ ...s, overrides: { ...s.overrides, [k]: v } }));
  const setD = (patch) => setDec((d) => ({ ...d, ...patch }));

  const decoded = useMemo(() => (mode === 'decode' ? decodeJwt(dec.token) : null), [mode, dec.token]);

  const activeState = useMemo(() => {
    if (mode === 'build') return state;
    if (decoded && decoded.ok) return claimsToSubState(decoded.payload, { cfgAudience: dec.cfgAudience, cfgIssuer: dec.cfgIssuer, connUser: dec.connUser });
    return null;
  }, [mode, state, decoded, dec.cfgAudience, dec.cfgIssuer, dec.connUser]);

  const result = useMemo(() => (activeState ? decideSubscribe(activeState) : null), [activeState]);
  const payload = useMemo(() => buildSubTokenPayload(state), [state]);
  const config = useMemo(() => buildSubConfig(state), [state]);

  const warnings = useMemo(() => {
    if (mode !== 'decode' || !decoded || !decoded.ok) return [];
    const w = tokenWarnings(decoded);
    if (!decoded.payload.channel) {
      w.push('No "channel" claim — a subscription token must name a channel (this looks like a connection token).');
    }
    return w;
  }, [mode, decoded]);

  const times = useMemo(() => {
    if (mode !== 'decode' || !decoded || !decoded.ok) return [];
    const out = [];
    for (const key of TIME_CLAIMS) {
      const d = describeTime(decoded.payload[key]);
      if (d) out.push({ key, ...d });
    }
    return out;
  }, [mode, decoded]);

  const p = decoded && decoded.ok ? decoded.payload : null;
  const tokenAudFirst = p ? (Array.isArray(p.aud) ? p.aud[0] : p.aud) : null;

  const loadExample = () => setD({
    token: makeToken({ sub: '42', channel: 'chat:room42', exp: 1893456000, info: { name: 'Alice' } }),
  });

  const badge = result
    ? (result.accepted ? { cls: styles.ok, text: 'ACCEPTED' } : { cls: styles.bad, text: 'REJECTED' })
    : { cls: styles.neutral, text: decoded && decoded.error ? 'INVALID TOKEN' : 'PASTE A TOKEN' };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Subscription JWT explorer</h4>
        <Seg value={mode} onChange={setMode} options={[{ value: 'build', label: 'Build' }, { value: 'decode', label: 'Decode' }]} />
        <span className={`${styles.badge} ${badge.cls}`}>{badge.text}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          {mode === 'build' && (
            <>
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
            </>
          )}

          {mode === 'decode' && (
            <>
              <div className={styles.group}>
                <div className={styles.groupLabel}>
                  Paste a subscription JWT
                  {dec.token
                    ? <button type="button" className={styles.exampleBtn} onClick={() => setD({ token: '' })}>clear</button>
                    : <button type="button" className={styles.exampleBtn} onClick={loadExample}>load example</button>}
                </div>
                <textarea className={styles.claims} spellCheck={false} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…"
                  value={dec.token} onChange={(e) => setD({ token: e.target.value })} />
                {decoded && decoded.error && <div className={styles.err}>{decoded.error}</div>}
              </div>

              {decoded && decoded.ok && (
                <>
                  <div className={styles.group}>
                    <div className={styles.groupLabel}>Header</div>
                    <div className={styles.chips}>
                      {Object.entries(decoded.header).map(([k, v]) => (
                        <span className={styles.chip} key={k}><b>{k}</b> {String(v)}</span>
                      ))}
                    </div>
                  </div>

                  {warnings.length > 0 && (
                    <div className={styles.warns}>
                      {warnings.map((wn, i) => <div className={styles.warn} key={i}>⚠ {wn}</div>)}
                    </div>
                  )}

                  <div className={styles.group}>
                    <JsonBlock title="Decoded payload (claims)" value={decoded.payload} />
                  </div>

                  {times.length > 0 && (
                    <div className={styles.group}>
                      <div className={styles.groupLabel}>Claim times</div>
                      {times.map((t) => (
                        <div className={styles.kv} key={t.key}>
                          <span className={styles.kvKey}><code>{t.key}</code></span>
                          <span className={styles.kvVal}>{t.abs} <span className={styles.hintInline}>({t.rel})</span></span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.group}>
                    <div className={styles.groupLabel}>Verify against server config &amp; context <span className={styles.hint}>— optional</span></div>
                    <div className={styles.field}>
                      <span className={styles.hint}>
                        Connection's authenticated <code>user</code> (token <code>sub</code> must match)
                        {p.sub != null && String(p.sub) !== '' ? <button type="button" className={styles.useBtn} onClick={() => setD({ connUser: String(p.sub) })}>use “{String(p.sub)}”</button> : null}
                      </span>
                      <input className={`${styles.text} ${styles.mono}`}
                        placeholder={p.sub != null && String(p.sub) !== '' ? 'set to check the sub/user match' : '(unset — user match not checked)'}
                        value={dec.connUser} onChange={(e) => setD({ connUser: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.hint}>
                        Expected <code>client.token.audience</code>
                        {tokenAudFirst ? <button type="button" className={styles.useBtn} onClick={() => setD({ cfgAudience: String(tokenAudFirst) })}>use “{String(tokenAudFirst)}”</button> : null}
                      </span>
                      <input className={`${styles.text} ${styles.mono}`}
                        placeholder={tokenAudFirst ? 'set to check the token’s aud claim' : '(unset — aud not checked)'}
                        value={dec.cfgAudience} onChange={(e) => setD({ cfgAudience: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.hint}>
                        Expected <code>client.token.issuer</code>
                        {p.iss ? <button type="button" className={styles.useBtn} onClick={() => setD({ cfgIssuer: String(p.iss) })}>use “{String(p.iss)}”</button> : null}
                      </span>
                      <input className={`${styles.text} ${styles.mono}`}
                        placeholder={p.iss ? 'set to check the token’s iss claim' : '(unset — iss not checked)'}
                        value={dec.cfgIssuer} onChange={(e) => setD({ cfgIssuer: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Verification (assuming a valid signature)</div>
          {result ? (
            <>
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
            </>
          ) : (
            <div className={styles.hint} style={{ marginTop: '0.5rem' }}>
              {decoded && decoded.error
                ? 'Fix the token above to run the claim checks.'
                : 'Paste a JWT (or press “load example”) to decode it and check the claims.'}
            </div>
          )}
        </div>
      </div>

      {mode === 'build' && (
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
      )}

      <div className={styles.caveat}>
        Models Centrifugo OSS subscription-token claim checks and the resulting subscription. Decoding reads the header and
        payload only — signature verification and the PRO <code>allow</code> capability claim are not performed here.
        In build mode <code>exp</code> values are example timestamps.
      </div>
    </div>
  );
}
