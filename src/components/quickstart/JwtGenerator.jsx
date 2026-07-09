import React, { useEffect, useState } from 'react';
import { signHS256, buildClaims } from './jwt';
import { LANGS, backendCode, clientCode } from './codegen';
import { Snippet, JsonBlock } from '../auth/ui';
import styles from '../auth/styles.module.css';

const TTLS = [
  { label: '1 hour', value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: '30 days', value: 2592000 },
];

const TITLE = { connection: 'Connection token generator', subscription: 'Subscription token generator' };

function Seg({ value, onChange, options }) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? styles.segActive : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// type: "connection" | "subscription" — fixed per docs page (no in-widget toggle).
export default function JwtGenerator({ type = 'connection' }) {
  const isSub = type === 'subscription';
  const [state, setStateRaw] = useState({
    secret: 'my-secret-key',
    userID: '123722',
    channel: 'chat:index',
    ttl: 86400,
  });
  const set = (patch) => setStateRaw((s) => ({ ...s, ...patch }));
  const [out, setOut] = useState({ token: '', claims: null, error: '' });
  const [lang, setLang] = useState('python');

  useEffect(() => {
    if (!state.secret) { setOut({ token: '', claims: null, error: 'Enter an HMAC secret to sign the token.' }); return undefined; }
    if (isSub && !state.channel) { setOut({ token: '', claims: null, error: 'Enter a channel for the subscription token.' }); return undefined; }
    let cancelled = false;
    const nowSec = Math.floor(Date.now() / 1000);
    const claims = buildClaims({ type, userID: state.userID, channel: state.channel, ttlSec: state.ttl, nowSec });
    signHS256(claims, state.secret)
      .then((token) => { if (!cancelled) setOut({ token, claims, error: '' }); })
      .catch((e) => { if (!cancelled) setOut({ token: '', claims: null, error: 'Could not sign in this browser: ' + (e.message || e) }); });
    return () => { cancelled = true; };
  }, [state, type, isSub]);

  const configSnippet = JSON.stringify({ client: { token: { hmac_secret_key: state.secret || 'your-secret-key' } } }, null, 2);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>{TITLE[type]} <span className={styles.hintInline}>— HS256, in your browser</span></h4>
        <span className={`${styles.badge} ${out.token ? styles.ok : styles.neutral}`}>{out.token ? 'signed' : '…'}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Claims</div>
            <div className={styles.field}>
              <span className={styles.hint}><code>sub</code> — user ID (leave empty for anonymous)</span>
              <input className={`${styles.text} ${styles.mono}`} value={state.userID} onChange={(e) => set({ userID: e.target.value })} />
            </div>
            {isSub && (
              <div className={styles.field}>
                <span className={styles.hint}><code>channel</code> — required</span>
                <input className={`${styles.text} ${styles.mono}`} value={state.channel} onChange={(e) => set({ channel: e.target.value })} />
              </div>
            )}
            <div className={styles.field}>
              <span className={styles.hint}>expires in</span>
              <Seg value={state.ttl} onChange={(v) => set({ ttl: v })} options={TTLS} />
            </div>
          </div>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Signing key</div>
            <div className={styles.field}>
              <span className={styles.hint}><code>client.token.hmac_secret_key</code> from your config</span>
              <input className={`${styles.text} ${styles.mono}`} value={state.secret} onChange={(e) => set({ secret: e.target.value })} />
              <span className={styles.capsOk} style={{ marginTop: '0.2rem' }}>🔒 Signed locally with the Web Crypto API — the secret never leaves your browser (no network request is made).</span>
            </div>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Token</div>
          {out.error
            ? <div className={styles.err}>{out.error}</div>
            : <Snippet title="paste this as the client token" code={out.token || '…'} />}
          {out.claims && <div style={{ marginTop: '0.6rem' }}><JsonBlock title="decoded claims" value={out.claims} /></div>}
          <div style={{ marginTop: '0.6rem' }}><JsonBlock title="config that verifies it" value={JSON.parse(configSnippet)} /></div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.4rem' }}>
          Issue this token from your backend
          <span className={styles.hint}> — this is what you ship (the generator above is just for testing)</span>
        </div>
        <div className={styles.seg} style={{ marginBottom: '0.5rem' }}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" className={lang === l.id ? styles.segActive : ''} onClick={() => setLang(l.id)}>{l.label}</button>
          ))}
        </div>
        <Snippet title={`sign the ${type} token (${lang})`} code={backendCode(lang, { type, sub: state.userID, channel: state.channel, ttlSec: state.ttl })} />

        <div className={styles.groupLabel} style={{ margin: '0.8rem 0 0.4rem' }}>Use it in your client</div>
        <Snippet title="connect / subscribe (centrifuge-js)" code={clientCode({ type, channel: state.channel })} />
        <div className={styles.hint} style={{ marginTop: '0.4rem' }}>
          Clients exist for JS, Dart, Swift, Kotlin, Python, Go and more — see the <a href="/docs/transports/client_sdk">client SDK</a> and <a href="/docs/transports/client_api">client API</a> pages. In production, return the token from the SDK's <code>getToken</code> callback so it refreshes automatically.
        </div>
      </div>

      <div className={styles.caveatWarn}>
        <b>Everything here runs entirely in your browser.</b> The secret you type is used only to sign the token locally
        (Web Crypto) and is <b>never sent to any server</b> — not to Centrifugo, not to this docs site. You can confirm in
        your browser's Network tab: nothing is requested. It is still <b>for local development / testing only</b> — don't
        paste a production secret into any web page. In production:
        <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
          <li><b>Your backend issues tokens</b> (the code above), never the browser — the HMAC secret must stay on the server.</li>
          <li>Use a <b>strong, random secret</b> (32+ bytes) — <code>centrifugo genconfig</code> generates one; keep it in an environment variable / secret store, not in code.</li>
          <li>Prefer <b>RSA/ECDSA</b> (public/private keys) or a <b>JWKS endpoint</b> if tokens are issued by a separate identity provider.</li>
          <li>Keep a <b>short <code>exp</code></b> and refresh via <code>getToken</code>, so access can be revoked in minutes.</li>
        </ul>
      </div>
    </div>
  );
}
