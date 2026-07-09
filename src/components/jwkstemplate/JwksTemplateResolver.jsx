import React, { useMemo, useState } from 'react';
import { validateSafety, resolveRuntime, buildTokenConfig } from './engine';
import { Snippet } from '../auth/ui';
import styles from '../auth/styles.module.css';

const DEFAULTS = {
  issuerRegex: 'https://keycloak\\.example\\.com/realms/(?P<realm>master|staging|production)',
  audienceRegex: '',
  url: 'https://keycloak.example.com/realms/{{realm}}/protocol/openid-connect/certs',
  iss: 'https://keycloak.example.com/realms/production',
  aud: '',
};

export default function JwksTemplateResolver() {
  const [s, setS] = useState(DEFAULTS);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));

  const warns = useMemo(() => validateSafety(s), [s]);
  const runtime = useMemo(() => resolveRuntime(s), [s]);
  const config = useMemo(() => buildTokenConfig(s), [s]);
  const safe = warns.length === 0;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Dynamic JWKS template resolver</h4>
        <span className={`${styles.badge} ${safe ? styles.ok : styles.bad}`}>{safe ? 'startup: ok' : 'startup: rejected'}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Config</div>
            <div className={styles.field}>
              <span className={styles.hint}><code>issuer_regex</code></span>
              <input className={`${styles.text} ${styles.mono}`} value={s.issuerRegex} onChange={(e) => set({ issuerRegex: e.target.value })} />
            </div>
            <div className={styles.field}>
              <span className={styles.hint}><code>audience_regex</code> (optional)</span>
              <input className={`${styles.text} ${styles.mono}`} value={s.audienceRegex} onChange={(e) => set({ audienceRegex: e.target.value })} />
            </div>
            <div className={styles.field}>
              <span className={styles.hint}><code>jwks_public_endpoint</code> (template)</span>
              <input className={`${styles.text} ${styles.mono}`} value={s.url} onChange={(e) => set({ url: e.target.value })} />
            </div>
          </div>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Sample token claims</div>
            <div className={styles.field}>
              <span className={styles.hint}><code>iss</code></span>
              <input className={`${styles.text} ${styles.mono}`} value={s.iss} onChange={(e) => set({ iss: e.target.value })} />
            </div>
            <div className={styles.field}>
              <span className={styles.hint}><code>aud</code> (comma-separated for an array)</span>
              <input className={`${styles.text} ${styles.mono}`} value={s.aud} onChange={(e) => set({ aud: e.target.value })} />
            </div>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.groupLabel}>Startup safety check</div>
          {safe
            ? <div className={styles.kv}><span className={`${styles.dot} ${styles['d-pass']}`}>✓</span><span className={styles.kvVal} style={{ fontWeight: 500 }}>Every template placeholder maps to an explicit list of fixed values — Centrifugo will start.</span></div>
            : <div className={styles.warns}>
                <div className={styles.groupLabel} style={{ marginBottom: '0.3rem' }}>Centrifugo will refuse to start</div>
                {warns.map((w, i) => <div className={styles.warn} key={i}>• {w}</div>)}
                <div className={styles.hint} style={{ marginTop: '0.3rem' }}>You can bypass this with <code>insecure_skip_jwks_endpoint_safety_check: true</code> (logs a warning; insecure — will be removed).</div>
              </div>}

          <div className={styles.groupLabel} style={{ marginTop: '0.7rem' }}>Runtime resolution (this token)</div>
          {runtime.ok ? (
            <>
              {runtime.trace.map((t, i) => <div className={styles.hint} key={i}>{t}</div>)}
              <div className={styles.kv} style={{ marginTop: '0.3rem' }}><span className={styles.kvKey}>JWKS URL</span><span className={styles.kvVal}><code>{runtime.url}</code></span></div>
              {runtime.missing && runtime.missing.length > 0 && <div className={styles.err}>Unresolved placeholder(s): {runtime.missing.join(', ')} — substituted with empty string.</div>}
            </>
          ) : (
            <div className={styles.err}>{runtime.error}</div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.5rem' }}>Config</div>
        <Snippet title="Centrifugo config" code={config} />
      </div>

      <div className={styles.caveat}>
        Template values come from <b>unverified</b> JWT claims (the URL is built before the signature is checked), so
        every <code>{'{{placeholder}}'}</code> must resolve from a named group that is an explicit alternation of fixed
        strings — no <code>.</code>, quantifiers, or character classes. Setting both <code>issuer</code> and
        <code> issuer_regex</code> (or both audience forms) is a startup error. Mirrors
        <code> validateJWKSEndpointSafety</code> (v6.7.0).
      </div>
    </div>
  );
}
