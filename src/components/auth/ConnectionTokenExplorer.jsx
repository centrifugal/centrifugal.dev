import React, { useMemo, useState } from 'react';
import { decideConnect, buildTokenPayload, buildConnectConfig, claimsToConnectState } from './authtoken';
import { decodeJwt, describeTime, tokenWarnings, makeToken } from './jwtdecode';
import { Snippet, JsonBlock } from './ui';
import styles from './styles.module.css';

// Generic OSS connection-JWT explorer with two modes:
//  - build:  compose claims and see whether the connection is accepted + the
//            token payload / config to sign.
//  - decode: paste an existing JWT, inspect its header/claims/times, and run
//            the same claim-level checks against it.
// Both modes feed the identical decideConnect() trace + "resulting connection".

const DEFAULT_STATE = {
  userID: '17',
  anonymous: false,
  exp: 'valid',        // valid | expired | none
  expireAt: 'absent',  // absent | never | future
  channelsText: '',
  infoText: '',
  metaText: '',
  // advanced
  tokenAud: '',
  tokenIss: '',
  cfgAudience: '',
  cfgIssuer: '',
  channelClaim: false,
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

export default function ConnectionTokenExplorer() {
  const [mode, setMode] = useState('build');
  const [state, setStateRaw] = useState(DEFAULT_STATE);
  const [adv, setAdv] = useState(false);
  const [dec, setDec] = useState({ token: '', cfgAudience: '', cfgIssuer: '' });
  const set = (patch) => setStateRaw((s) => ({ ...s, ...patch }));
  const setD = (patch) => setDec((d) => ({ ...d, ...patch }));

  const decoded = useMemo(() => (mode === 'decode' ? decodeJwt(dec.token) : null), [mode, dec.token]);

  const activeState = useMemo(() => {
    if (mode === 'build') return state;
    if (decoded && decoded.ok) return claimsToConnectState(decoded.payload, { cfgAudience: dec.cfgAudience, cfgIssuer: dec.cfgIssuer });
    return null;
  }, [mode, state, decoded, dec.cfgAudience, dec.cfgIssuer]);

  const result = useMemo(() => (activeState ? decideConnect(activeState) : null), [activeState]);
  const payload = useMemo(() => buildTokenPayload(state), [state]);
  const config = useMemo(() => buildConnectConfig(state), [state]);

  const warnings = useMemo(() => {
    if (mode !== 'decode' || !decoded || !decoded.ok) return [];
    const w = tokenWarnings(decoded);
    if (decoded.payload.channel) {
      w.push('This token carries a "channel" claim — that belongs to a subscription token, not a connection token.');
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
    token: makeToken({ sub: '17', exp: 1893456000, info: { name: 'Alice' }, channels: ['news'] }),
  });

  const badge = result
    ? (result.accepted ? { cls: styles.ok, text: 'ACCEPTED' } : { cls: styles.bad, text: 'REJECTED' })
    : { cls: styles.neutral, text: decoded && decoded.error ? 'INVALID TOKEN' : 'PASTE A TOKEN' };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Connection JWT explorer</h4>
        <Seg value={mode} onChange={setMode} options={[{ value: 'build', label: 'Build' }, { value: 'decode', label: 'Decode' }]} />
        <span className={`${styles.badge} ${badge.cls}`}>{badge.text}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          {mode === 'build' && (
            <>
              <div className={styles.group}>
                <div className={styles.groupLabel}>Identity</div>
                <div className={styles.field}>
                  <span className={styles.hint}><code>sub</code> — user ID {state.anonymous && '(ignored — anonymous)'}</span>
                  <input className={`${styles.text} ${styles.mono}`} value={state.userID} disabled={state.anonymous}
                    onChange={(e) => set({ userID: e.target.value })} />
                </div>
                <div className={styles.mapRow} style={{ margin: '0.2rem 0' }}>
                  <input type="checkbox" id="ct-anon" checked={state.anonymous} onChange={(e) => set({ anonymous: e.target.checked })} />
                  <label htmlFor="ct-anon">Anonymous connection (no <code>sub</code>)</label>
                </div>
              </div>

              <div className={styles.group}>
                <div className={styles.groupLabel}>Expiration</div>
                <div className={styles.field}>
                  <span className={styles.hint}><code>exp</code> — token expiration</span>
                  <Seg value={state.exp} onChange={(v) => set({ exp: v })} options={[
                    { value: 'valid', label: 'future' }, { value: 'expired', label: 'past' }, { value: 'none', label: 'none' }]} />
                </div>
                <div className={styles.field}>
                  <span className={styles.hint}><code>expire_at</code> — separate connection expiration</span>
                  <Seg value={state.expireAt} onChange={(v) => set({ expireAt: v })} options={[
                    { value: 'absent', label: 'absent' }, { value: 'never', label: '0 (never)' }, { value: 'future', label: 'future' }]} />
                </div>
              </div>

              <div className={styles.group}>
                <div className={styles.groupLabel}>Attached data</div>
                <div className={styles.field}>
                  <span className={styles.hint}><code>channels</code> — server-side subscriptions (comma-separated)</span>
                  <input className={`${styles.text} ${styles.mono}`} placeholder="news, personal:17" value={state.channelsText}
                    onChange={(e) => set({ channelsText: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <span className={styles.hint}><code>info</code> — visible to others in presence / join-leave (JSON)</span>
                  <input className={`${styles.text} ${styles.mono}`} placeholder='{"name": "Alice"}' value={state.infoText}
                    onChange={(e) => set({ infoText: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <span className={styles.hint}><code>meta</code> — server-side only (JSON)</span>
                  <input className={`${styles.text} ${styles.mono}`} placeholder='{"role": "admin"}' value={state.metaText}
                    onChange={(e) => set({ metaText: e.target.value })} />
                </div>
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
                <div className={styles.hint}>Setting an expected <code>audience</code> / <code>issuer</code> is good practice — it stops a token minted for another service (same signing key) from being accepted here.</div>
              </div>

              <button type="button" className={styles.advToggle} onClick={() => setAdv((v) => !v)}>
                {adv ? '▾ hide advanced' : '▸ advanced'}
              </button>
              {adv && (
                <div className={styles.group} style={{ marginTop: '0.4rem' }}>
                  <div className={styles.mapRow} style={{ margin: '0.3rem 0' }}>
                    <input type="checkbox" id="ct-chan" checked={state.channelClaim} onChange={(e) => set({ channelClaim: e.target.checked })} />
                    <label htmlFor="ct-chan">Include a <code>channel</code> claim (invalid for a connection token)</label>
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'decode' && (
            <>
              <div className={styles.group}>
                <div className={styles.groupLabel}>
                  Paste a connection JWT
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
                    <div className={styles.groupLabel}>Verify against server config <span className={styles.hint}>— optional</span></div>
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
                  <div className={styles.groupLabel} style={{ marginTop: '0.7rem' }}>Resulting connection</div>
                  <div className={styles.kv}><span className={styles.kvKey}>user</span><span className={styles.kvVal}>{result.connection.user}</span></div>
                  <div className={styles.kv}><span className={styles.kvKey}>expires</span><span className={styles.kvVal}>{result.connection.expiration}</span></div>
                  <div className={styles.kv}><span className={styles.kvKey}>server subs</span><span className={styles.kvVal}>{result.connection.serverSideSubscriptions.length ? result.connection.serverSideSubscriptions.join(', ') : 'none'}</span></div>
                  {result.connection.info !== undefined && <JsonBlock title="info" value={result.connection.info} />}
                  {result.connection.meta !== undefined && <JsonBlock title="meta (server-side only)" value={result.connection.meta} />}
                  {result.infoError && <div className={styles.err}>{result.infoError}</div>}
                  {result.metaError && <div className={styles.err}>{result.metaError}</div>}
                </>
              ) : (
                <div className={styles.err} style={{ marginTop: '0.5rem' }}>Connection rejected: <b>{result.reason}</b>.</div>
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
            <Snippet title="Connection JWT — claims to sign" code={payload} />
            <Snippet title="Centrifugo config" code={config} />
          </div>
          <div className={styles.hint} style={{ marginTop: '0.5rem' }}>
            Sign the claims with your <code>hmac_secret_key</code> (or an RSA/ECDSA private key) and pass the JWT as the client SDK connection <code>token</code>. Signature verification itself is separate from the claim checks shown above.
          </div>
        </div>
      )}

      <div className={styles.caveat}>
        Models Centrifugo OSS connection-token claim checks and the resulting connection. Decoding reads the header and
        payload only — signature verification (HMAC/RSA/ECDSA/JWKS) needs your key and is not performed here.
        In build mode <code>exp</code> values are shown as example timestamps.
      </div>
    </div>
  );
}
