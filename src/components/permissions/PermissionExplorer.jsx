import React, { useMemo, useState } from 'react';
import { decide, hasChannelCapability } from './engine';
import { buildConfig, buildTokens } from './snippets';
import styles from './styles.module.css';

// The capability string each operation checks (internal/caps/caps.go).
const OP_CAP = { subscribe: 'sub', publish: 'pub', history: 'hst', presence: 'prs' };

// Interactive, client-side "why allowed / why denied" explorer. It mirrors the
// real decision order in Centrifugo (internal/client/handler.go) so readers can
// validate a permission model before writing any code. One instance is rendered
// per operation via the `op` prop: "subscribe" | "publish" | "history" | "presence".

const OP_TITLE = {
  subscribe: 'Subscribe permission explorer',
  publish: 'Publish permission explorer',
  history: 'History permission explorer',
  presence: 'Presence permission explorer',
};

const DEFAULT_STATE = {
  userID: '17',
  anonymous: false,
  channel: 'personal:17',
  privatePrefix: '$',
  // subscribe
  allowUserLimited: false,
  subscribeProxy: false,
  subscribeProxyVerdict: 'allow',
  allowSubscribeForClient: false,
  allowSubscribeForAnonymous: false,
  subToken: 'none',
  // publish / history / presence
  isSubscribed: false,
  publishProxy: false,
  publishProxyVerdict: 'allow',
  allowPublishForClient: false,
  allowPublishForSubscriber: false,
  allowPublishForAnonymous: false,
  historyConfigured: true,
  allowHistoryForClient: false,
  allowHistoryForSubscriber: false,
  allowHistoryForAnonymous: false,
  presenceEnabled: true,
  allowPresenceForClient: false,
  allowPresenceForSubscriber: false,
  allowPresenceForAnonymous: false,
  // PRO caps
  connCapsText: '',
  channelCapsAllow: [],
  // advanced
  insecure: false,
};

function Check({ state, set, name, label, pro }) {
  return (
    <div className={styles.row}>
      <input
        type="checkbox"
        id={name + '-' + label}
        checked={!!state[name]}
        onChange={(e) => set({ [name]: e.target.checked })}
      />
      <label htmlFor={name + '-' + label}>
        {label} {pro && <span className={styles.pro}>PRO</span>}
      </label>
    </div>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? styles.active : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CapsEditor({ state, set, capType, channel, grants }) {
  const text = state.connCapsText;
  const trimmed = text.trim();
  let parseErr = false;
  if (trimmed !== '') { try { JSON.parse(trimmed); } catch (x) { parseErr = true; } }

  const example = JSON.stringify([{ channels: [channel || 'personal:17'], allow: [capType] }]);

  let feedback;
  if (trimmed === '') {
    feedback = <span className={styles.capsHint}>Grants permissions without a per-channel token. This operation needs the <code>{capType}</code> capability.</span>;
  } else if (parseErr) {
    feedback = <span className={styles.capsErr}>Invalid JSON</span>;
  } else if (grants) {
    feedback = <span className={styles.capsOk}>✓ grants <code>{capType}</code> for <code>{channel}</code></span>;
  } else {
    feedback = <span className={styles.capsWarn}>✗ no capability here matches <code>{channel}</code> for <code>{capType}</code></span>;
  }

  return (
    <div className={styles.field}>
      <span>
        Connection capabilities <span className={styles.pro}>PRO</span>{' '}
        <span style={{ opacity: 0.7 }}>— connection token <code>caps</code> / connect proxy</span>
      </span>
      <textarea
        className={styles.caps}
        spellCheck={false}
        value={text}
        placeholder={example}
        onChange={(e) => set({ connCapsText: e.target.value })}
      />
      <div className={styles.capsFoot}>
        <button type="button" className={styles.exampleBtn}
          onClick={() => set({ connCapsText: example })}>Insert example</button>
        <span className={styles.capsHint}>
          <code>match</code>: omit for exact, or <code>wildcard</code> / <code>regex</code>.
        </span>
      </div>
      <div>{feedback}</div>
    </div>
  );
}

function ChannelCaps({ state, set, capType, channel }) {
  const toggle = (cap) => {
    const cur = state.channelCapsAllow;
    set({ channelCapsAllow: cur.includes(cap) ? cur.filter((c) => c !== cap) : [...cur, cap] });
  };
  const CAPS = [['pub', 'pub'], ['hst', 'hst'], ['prs', 'prs']];
  const grants = state.channelCapsAllow.includes(capType);
  return (
    <div className={styles.field}>
      <span>
        Subscription <code>allow</code> for this channel <span className={styles.pro}>PRO</span>{' '}
        <span style={{ opacity: 0.7 }}>— subscription token <code>allow</code> / subscribe proxy. This operation needs <code>{capType}</code>.</span>
      </span>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
        {CAPS.map(([cap]) => (
          <div className={`${styles.row} ${cap === capType ? styles.capNeeded : ''}`} key={cap} style={{ margin: 0 }}>
            <input type="checkbox" id={'cc-' + cap} checked={state.channelCapsAllow.includes(cap)} onChange={() => toggle(cap)} />
            <label htmlFor={'cc-' + cap}><code>{cap}</code>{cap === capType ? ' ←' : ''}</label>
          </div>
        ))}
      </div>
      {grants
        ? <span className={styles.capsOk}>✓ grants <code>{capType}</code> for <code>{channel}</code></span>
        : <span className={styles.capsHint}>Check <code>{capType}</code> to grant this operation for <code>{channel}</code>.</span>}
    </div>
  );
}

const STATUS_GLYPH = {
  granted: '✓', blocked: '✕', 'no-match': '–', off: '·', skipped: '·',
};

function Snippet({ title, code, notes }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      });
    } catch (e) { /* clipboard unavailable */ }
  };
  return (
    <div className={styles.snippet}>
      <div className={styles.snippetHead}>
        <span className={styles.snippetTitle}>{title}</span>
        <button type="button" className={styles.copyBtn} onClick={copy}>{copied ? 'copied' : 'copy'}</button>
      </div>
      <pre className={styles.snippetCode}><code>{code}</code></pre>
      {notes && notes.map((n, i) => <div key={i} className={styles.snippetNote}>{n}</div>)}
    </div>
  );
}

export default function PermissionExplorer({ op = 'subscribe' }) {
  const [state, setStateRaw] = useState(DEFAULT_STATE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = (patch) => setStateRaw((s) => ({ ...s, ...patch }));

  const connCaps = useMemo(() => {
    if (!state.connCapsText.trim()) return [];
    try { const v = JSON.parse(state.connCapsText); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }, [state.connCapsText]);

  const result = useMemo(
    () => decide(op, { ...state, connCaps }),
    [op, state, connCaps]
  );

  const capType = OP_CAP[op];
  const connCapsGrant = useMemo(
    () => hasChannelCapability(connCaps, capType, state.channel),
    [connCaps, capType, state.channel]
  );

  const config = useMemo(() => buildConfig(op, state), [op, state]);
  const tokens = useMemo(() => buildTokens(op, state, connCaps), [op, state, connCaps]);

  const verdictClass = result.available === false
    ? styles.na
    : result.allowed ? styles.allowed : styles.denied;
  const verdictText = result.available === false
    ? 'NOT AVAILABLE'
    : result.allowed ? 'ALLOWED' : 'DENIED';

  const showProxy = op === 'subscribe' ? state.subscribeProxy : op === 'publish' ? state.publishProxy : false;
  const proxyName = op === 'subscribe' ? 'subscribeProxyVerdict' : 'publishProxyVerdict';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>{OP_TITLE[op]}</h4>
        <span className={`${styles.verdict} ${verdictClass}`}>{verdictText}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.controls}>
          {/* connection */}
          <div className={styles.group}>
            <div className={styles.groupLabel}>Connection</div>
            <div className={styles.field}>
              <span>User ID {state.anonymous && '(ignored — anonymous)'}</span>
              <input className={`${styles.text} ${styles.mono}`} value={state.userID}
                disabled={state.anonymous}
                onChange={(e) => set({ userID: e.target.value })} />
            </div>
            <Check state={state} set={set} name="anonymous" label="Anonymous connection (empty user ID)" />
          </div>

          {/* channel */}
          <div className={styles.group}>
            <div className={styles.groupLabel}>Channel</div>
            <div className={styles.field}>
              <input className={`${styles.text} ${styles.mono}`} value={state.channel}
                onChange={(e) => set({ channel: e.target.value })} />
              <span style={{ opacity: 0.7 }}>
                <code>#</code> = user-limited · <code>{state.privatePrefix}</code> prefix = private channel
              </span>
            </div>
          </div>

          {/* op-specific namespace options */}
          <div className={styles.group}>
            <div className={styles.groupLabel}>Namespace options</div>

            {op === 'subscribe' && <>
              <Check state={state} set={set} name="allowUserLimited" label="allow_user_limited_channels" />
              <Check state={state} set={set} name="subscribeProxy" label="subscribe proxy (subscribe_proxy_enabled)" />
              <Check state={state} set={set} name="allowSubscribeForClient" label="allow_subscribe_for_client" />
              <Check state={state} set={set} name="allowSubscribeForAnonymous" label="allow_subscribe_for_anonymous" />
            </>}

            {op === 'publish' && <>
              <Check state={state} set={set} name="publishProxy" label="publish proxy (publish_proxy_enabled)" />
              <Check state={state} set={set} name="allowPublishForClient" label="allow_publish_for_client" />
              <Check state={state} set={set} name="allowPublishForSubscriber" label="allow_publish_for_subscriber" />
              <Check state={state} set={set} name="allowPublishForAnonymous" label="allow_publish_for_anonymous" />
              <Check state={state} set={set} name="isSubscribed" label="connection is subscribed to this channel" />
            </>}

            {op === 'history' && <>
              <Check state={state} set={set} name="historyConfigured" label="history configured (history_size / history_ttl > 0)" />
              <Check state={state} set={set} name="allowHistoryForClient" label="allow_history_for_client" />
              <Check state={state} set={set} name="allowHistoryForSubscriber" label="allow_history_for_subscriber" />
              <Check state={state} set={set} name="allowHistoryForAnonymous" label="allow_history_for_anonymous" />
              <Check state={state} set={set} name="isSubscribed" label="connection is subscribed to this channel" />
            </>}

            {op === 'presence' && <>
              <Check state={state} set={set} name="presenceEnabled" label="presence enabled" />
              <Check state={state} set={set} name="allowPresenceForClient" label="allow_presence_for_client" />
              <Check state={state} set={set} name="allowPresenceForSubscriber" label="allow_presence_for_subscriber" />
              <Check state={state} set={set} name="allowPresenceForAnonymous" label="allow_presence_for_anonymous" />
              <Check state={state} set={set} name="isSubscribed" label="connection is subscribed to this channel" />
            </>}

            {showProxy && (
              <div className={styles.field}>
                <span>Proxy response from your backend</span>
                <Seg value={state[proxyName]} onChange={(v) => set({ [proxyName]: v })}
                  options={[{ value: 'allow', label: 'allow' }, { value: 'deny', label: 'deny' }]} />
              </div>
            )}
          </div>

          {/* tokens / caps */}
          <div className={styles.group}>
            <div className={styles.groupLabel}>Tokens &amp; capabilities</div>
            {op === 'subscribe' && (
              <div className={styles.field}>
                <span>Subscription token</span>
                <Seg value={state.subToken} onChange={(v) => set({ subToken: v })}
                  options={[
                    { value: 'none', label: 'none' },
                    { value: 'valid', label: 'valid' },
                    { value: 'invalid', label: 'invalid' },
                  ]} />
              </div>
            )}
            <CapsEditor state={state} set={set} capType={capType} channel={state.channel} grants={connCapsGrant} />
            {op !== 'subscribe' && <ChannelCaps state={state} set={set} capType={capType} channel={state.channel} />}
          </div>

          {/* advanced */}
          <button type="button" className={styles.advToggle} onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? '▾ hide advanced' : '▸ advanced'}
          </button>
          {showAdvanced && (
            <div className={styles.group}>
              <Check state={state} set={set} name="insecure" label="client.insecure (dev only — bypasses all checks)" />
            </div>
          )}
        </div>

        {/* trace */}
        <div className={styles.trace}>
          <div className={styles.groupLabel}>Decision order</div>
          <ul className={styles.stepList}>
            {result.trace.map((s, i) => (
              <li key={i} className={`${styles.step} ${(s.status === 'off' || s.status === 'skipped') ? styles.stepFaint : ''}`}>
                <span className={`${styles.dot} ${styles['d-' + s.status]}`}>{STATUS_GLYPH[s.status]}</span>
                <div className={styles.stepMain}>
                  <div className={styles.stepLabel}>
                    {s.label} {s.pro && <span className={styles.pro}>PRO</span>}
                  </div>
                  <div className={styles.stepDetail}>{s.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          {result.allowed && result.source && (
            <div className={styles.sourceLine}>Granted by: <b>{result.source}</b></div>
          )}
        </div>
      </div>

      <div className={styles.implement}>
        <div className={styles.implementHead}>
          <span className={styles.groupLabel} style={{ margin: 0 }}>Implement this</span>
          <span className={styles.implementLead}>
            {result.available === false
              ? 'This operation is unavailable with the current settings — enable it above to generate config.'
              : result.allowed
                ? 'Config and token that reproduce this ALLOWED result:'
                : 'These settings currently produce DENIED. The snippets below reflect what you toggled — adjust the options to grant access.'}
          </span>
        </div>
        <div className={styles.snippets}>
          <Snippet
            title="Centrifugo config"
            code={config.code}
            notes={config.empty ? ['No namespace permission options are toggled on for this operation yet.', ...config.notes] : config.notes}
          />
          {tokens.length === 0
            ? <div className={styles.snippet}><div className={styles.snippetNote}>No token required for this configuration — permission comes from namespace options{op === 'subscribe' ? '/user-limited channel' : ''}.</div></div>
            : tokens.map((t, i) => <Snippet key={i} title={t.title} code={t.code} notes={t.notes} />)}
        </div>
      </div>

      <div className={styles.caveat}>
        Mirrors Centrifugo's decision order for teaching purposes. Advanced knobs
        (CEL expressions, the bidirectional subscribe-stream proxy) are omitted for clarity.
        Server API calls from your backend always bypass these checks.
      </div>
    </div>
  );
}
