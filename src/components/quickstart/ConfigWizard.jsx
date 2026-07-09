import React, { useEffect, useMemo, useState } from 'react';
import { Snippet } from '../auth/ui';
import styles from '../auth/styles.module.css';

function genSecret(numBytes = 24) {
  const bytes = new Uint8Array(numBytes);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function genSecrets() {
  return { hmac: genSecret(), apiKey: genSecret(), adminPassword: genSecret(12), adminSecret: genSecret() };
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

const SUB_HINT = {
  token: <>Clients subscribe with a per-channel subscription JWT — issue it from your backend (see <a href="/docs/server/channel_token_auth">channel token auth</a>).</>,
  client: <>Any authenticated (non-anonymous) client may subscribe to channels in this namespace — no per-channel token needed.</>,
  server: <>No client-side subscribe — channels are attached server-side via the connection token’s <code>channels</code> / <code>subs</code>.</>,
};

function buildConfig(s, secrets) {
  const nsOpts = {};
  if (s.history) { nsOpts.history_size = 100; nsOpts.history_ttl = '300s'; nsOpts.force_recovery = true; }
  if (s.subMode === 'client') nsOpts.allow_subscribe_for_client = true;

  const cfg = {
    client: {
      token: { hmac_secret_key: secrets.hmac },
      allowed_origins: ['http://localhost:3000'],
    },
    channel: s.nsName ? { namespaces: [{ name: s.nsName, ...nsOpts }] } : { without_namespace: nsOpts },
    http_api: { key: secrets.apiKey },
  };
  if (s.engine === 'redis') cfg.engine = { type: 'redis', redis: { address: '127.0.0.1:6379' } };
  if (s.admin) cfg.admin = { enabled: true, password: secrets.adminPassword, secret: secrets.adminSecret };
  return cfg;
}

// Client-side usage that adapts to the enabled features (centrifuge-js).
function clientUsage(s) {
  const ch = s.nsName ? `${s.nsName}:index` : 'channel';
  const L = [];
  L.push('import { Centrifuge } from "centrifuge"; // npm i centrifuge');
  L.push('');
  L.push('const centrifuge = new Centrifuge("ws://localhost:8000/connection/websocket", {');
  L.push('  // load a fresh connection token from your backend — called on connect and to');
  L.push('  // refresh it before expiry (a static `token:` would disconnect once it expires):');
  L.push('  getToken: async () => (await fetch("/centrifugo/connection_token")).text(),');
  L.push('});');
  L.push('');

  if (s.subMode === 'server') {
    L.push('// Server-side subscriptions: channels are attached via the connection token,');
    L.push('// so consume publications straight from the client instance:');
    L.push('centrifuge.on("publication", (ctx) => console.log(ctx.channel, ctx.data));');
    L.push('');
    L.push('centrifuge.connect();');
    return L.join('\n');
  }

  const subOpts = s.subMode === 'token'
    ? `, {\n  // load a subscription token from your backend (auto-refreshes on expiry):\n  getToken: async (ctx) => (await fetch(\`/centrifugo/subscription_token?channel=\${encodeURIComponent(ctx.channel)}\`)).text(),\n}`
    : ''; // allow_subscribe_for_client → no per-channel token needed
  L.push(`const sub = centrifuge.newSubscription(${JSON.stringify(ch)}${subOpts});`);
  L.push('');
  L.push('sub.on("publication", (ctx) => console.log("message:", ctx.data));');
  if (s.history) {
    L.push('sub.on("subscribed", (ctx) => {');
    L.push('  // Missed messages are replayed automatically via "publication" above.');
    L.push('  // If continuity could NOT be restored, load fresh state from your backend');
    L.push('  // — your database is the source of truth, history is only a fast cache:');
    L.push('  if (ctx.wasRecovering && !ctx.recovered) loadStateFromBackend();');
    L.push('});');
    L.push('');
    L.push('// Load initial state from your backend (or use the getState callback in');
    L.push('// the subscription options to read the position and state together):');
    L.push('loadStateFromBackend();');
  }
  L.push('sub.subscribe();');
  L.push('');
  L.push('centrifuge.connect();');
  return L.join('\n');
}

export default function ConfigWizard() {
  const [s, setSRaw] = useState({
    nsName: 'chat',
    history: false,
    subMode: 'token',
    engine: 'memory',
    admin: true,
  });
  const set = (patch) => setSRaw((p) => ({ ...p, ...patch }));
  const [secrets, setSecrets] = useState({ hmac: '…', apiKey: '…', adminPassword: '…', adminSecret: '…' });
  useEffect(() => { setSecrets(genSecrets()); }, []);

  const config = useMemo(() => JSON.stringify(buildConfig(s, secrets), null, 2), [s, secrets]);
  const run = s.engine === 'redis'
    ? 'docker run -d -p 6379:6379 redis:7    # start Redis first\n./centrifugo -c config.json'
    : './centrifugo -c config.json';

  const Check = ({ name, label }) => (
    <div className={styles.mapRow} style={{ margin: '0.22rem 0' }}>
      <input type="checkbox" id={'cw-' + name} checked={!!s[name]} onChange={(e) => set({ [name]: e.target.checked })} />
      <label htmlFor={'cw-' + name}>{label}</label>
    </div>
  );

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Starter config builder</h4>
        <span className={`${styles.badge} ${styles.ok}`}>config.json</span>
      </div>

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Namespace</div>
            <div className={styles.field}>
              <span className={styles.hint}>namespace name (empty = default <code>without_namespace</code>)</span>
              <input className={`${styles.text} ${styles.mono}`} value={s.nsName} onChange={(e) => set({ nsName: e.target.value })} />
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>History &amp; recovery</div>
            <Check name="history" label={<span><code>history</code> + recovery — replay messages missed while disconnected</span>} />
            {s.history && (
              <div className={styles.tip}>
                Recovery is a fast cache, <b>not</b> your source of truth. On reconnect Centrifugo replays missed messages automatically, but when it can't (<code>recovered: false</code>) — and on first load — your app must load full state from its own backend. See <a href="/docs/server/history_and_recovery">history and recovery</a>.
              </div>
            )}
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Client access</div>
            <div className={styles.field}>
              <span className={styles.hint}>how do clients subscribe?</span>
              <Seg value={s.subMode} onChange={(v) => set({ subMode: v })} options={[
                { value: 'token', label: 'sub token' }, { value: 'client', label: 'any auth client' }, { value: 'server', label: 'server-side' }]} />
              <div className={styles.tip}>{SUB_HINT[s.subMode]}</div>
            </div>
            <div className={styles.tip}>Publish from your backend, or from clients over the connection (a publish proxy is recommended) — see <a href="/docs/getting-started/design#idiomatic-usage">idiomatic usage</a>.</div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>Deployment</div>
            <div className={styles.field}>
              <span className={styles.hint}>engine</span>
              <Seg value={s.engine} onChange={(v) => set({ engine: v })} options={[
                { value: 'memory', label: 'Memory (single node)' }, { value: 'redis', label: 'Redis (scale out)' }]} />
            </div>
            <Check name="admin" label={<span>admin web UI</span>} />
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.jsonHead}>
            <span className={styles.jsonTitle}>config.json</span>
            <button type="button" className={styles.copyBtn} onClick={() => setSecrets(genSecrets())}>regenerate secrets</button>
          </div>
          <Snippet title="config.json" code={config} />
          <div className={styles.groupLabel} style={{ margin: '0.7rem 0 0.4rem' }}>Run it</div>
          <Snippet title="terminal" code={run} />
          <div className={styles.hint} style={{ marginTop: '0.5rem' }}>
            Get a token for user access with the <a href="/docs/server/authentication#examples-create-connection-jwt">connection token generator</a>. Full option reference on the <a href="/docs/server/channels">channels</a> page.
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.groupLabel} style={{ marginBottom: '0.4rem' }}>Use it in your client</div>
        <Snippet title="connect &amp; use the enabled features (centrifuge-js)" code={clientUsage(s)} />
        <div className={styles.hint} style={{ marginTop: '0.4rem' }}>
          This adapts to the options you picked above. Clients exist for JS, Dart, Swift, Kotlin, Python, Go and more — see the <a href="/docs/transports/client_sdk">client SDK</a> and <a href="/docs/transports/client_api">client API</a> pages.
        </div>
      </div>

      <div className={styles.caveatWarn}>
        <b>This runs entirely in your browser.</b> Every key above (token secret, API key, admin password &amp; secret) is a
        strong random value generated locally with the Web Crypto API — <b>none is ever sent to any server</b> (not to this
        docs site). Hit <b>regenerate secrets</b> for a fresh set. Treat them like passwords: keep them out of version
        control (environment variables / a secret store) and use different values per environment. For multi-node
        production, choose the Redis engine (or Nats / PostgreSQL — see the engines page).
      </div>
    </div>
  );
}
