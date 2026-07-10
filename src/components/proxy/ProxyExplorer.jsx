import React, { useMemo, useState } from 'react';
import {
  EVENTS, getEvent, defaultState, CONFIG_NOTES,
  buildRequestJSON, buildResponseJSON, buildConfig, buildCode, buildHeaders, buildStreamPub,
} from './proxymodel';
import { Snippet, JsonBlock } from '../auth/ui';
import styles from '../auth/styles.module.css';

// Interactive explorer for Centrifugo proxy events. A single widget with an
// event selector; pass `events={['subscribe', ...]}` to scope it to the events
// documented on a given page (one event → pinned, no selector). Field data is
// derived from proxy.proto (see proxymodel.js), so it stays faithful to the
// actual proxy contract.

const TIER = {
  'OSS': null,
  'OSS-exp': { label: 'experimental', cls: styles.neutral },
  'PRO': { label: 'PRO', cls: styles.ok },
  'PRO-preview': { label: 'PRO · preview', cls: styles.ok },
};

const BAD_STATUS = ['REJECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED', 'EMPTY'];
function statusClass(status) {
  if (BAD_STATUS.includes(status)) return styles.bad;
  if (status === 'STREAMING' || status === 'ACK') return styles.neutral;
  return styles.ok;
}

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

function Check({ id, checked, onChange, children }) {
  return (
    <div className={styles.mapRow} style={{ margin: '0.15rem 0' }}>
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}

// `events` is an ordered list of event ids to expose (defaults to all). Pass the
// events documented on a given page so the same widget can be embedded per page.
export default function ProxyExplorer({ events }) {
  const available = useMemo(
    () => (events && events.length ? events.map((id) => getEvent(id)) : EVENTS),
    [events],
  );
  const [eventId, setEventId] = useState(available[0].id);
  const ev = getEvent(eventId);
  const [state, setState] = useState(() => defaultState(ev));
  const [lang, setLang] = useState(available[0].grpcOnly ? 'grpc' : 'node');

  const set = (patch) => setState((s) => ({ ...s, ...patch }));
  const selectEvent = (id) => {
    const nextEv = getEvent(id);
    setEventId(id);
    setState(defaultState(nextEv));
    setLang(nextEv.grpcOnly ? 'grpc' : 'node');
  };

  const req = useMemo(() => buildRequestJSON(ev, state), [ev, state]);
  const resp = useMemo(() => buildResponseJSON(ev, state), [ev, state]);
  const cfg = useMemo(() => buildConfig(ev, state), [ev, state]);
  const code = useMemo(() => buildCode(ev, state, lang), [ev, state, lang]);
  const headers = useMemo(() => buildHeaders(ev, state), [ev, state]);
  const outcome = useMemo(() => ev.outcome(state), [ev, state]);

  const modeOptions = [{ value: 'result', label: ev.shape === 'stream' ? 'accept' : 'result' }]
    .concat(ev.err ? [{ value: 'error', label: 'error' }] : [])
    .concat(ev.disc ? [{ value: 'disconnect', label: 'disconnect' }] : []);

  const tier = TIER[ev.tier];
  const binaryRelevant = ev.clientCtx && !ev.grpcOnly;
  const isStream = ev.shape === 'stream';
  const codeLangs = ev.grpcOnly ? ['grpc'] : ['node', 'python', 'go', 'grpc'];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Proxy explorer</h4>
        {tier && <span className={`${styles.badge} ${tier.cls}`}>{tier.label}</span>}
      </div>

      {/* Event selector (a label + purpose line when only one event is exposed) */}
      <div className={styles.group} style={{ padding: '0.9rem 1rem 0', marginBottom: '0.6rem' }}>
        {available.length > 1 ? (
          <>
            <div className={styles.groupLabel}>Proxy event</div>
            <select className={`${styles.text} ${styles.mono}`} value={eventId}
              style={{ padding: '0.4rem 0.6rem', height: 'auto' }}
              onChange={(e) => selectEvent(e.target.value)}>
              {['OSS', 'PRO'].map((grp) => {
                const items = available.filter((e) => e.tier.startsWith(grp));
                return items.length ? (
                  <optgroup key={grp} label={grp}>
                    {items.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
          </>
        ) : (
          <div className={styles.groupLabel}>{ev.label} proxy</div>
        )}
        <div className={styles.hint} style={{ marginTop: '0.3rem' }}>{ev.dataMeaning}</div>
      </div>

      {/* Controls */}
      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Setup</div>
            <div className={styles.field}>
              <span className={styles.hint}>Backend protocol</span>
              {ev.grpcOnly ? (
                <span className={styles.hintInline}><b>GRPC only</b> — a streaming proxy (no HTTP)</span>
              ) : (
                <Seg value={state.transport} onChange={(v) => set({ transport: v })}
                  options={[{ value: 'http', label: 'HTTP' }, { value: 'grpc', label: 'GRPC' }]} />
              )}
            </div>
            {isStream && (
              <div className={styles.field}>
                <span className={styles.hint}>Stream direction</span>
                <Seg value={state.streamMode} onChange={(v) => set({ streamMode: v })}
                  options={[{ value: 'uni', label: 'unidirectional' }, { value: 'bi', label: 'bidirectional' }]} />
              </div>
            )}
            {ev.named && (
              <Check id="px-named" checked={state.named} onChange={(v) => set({ named: v })}>
                Use a <b>named</b> proxy referenced from a namespace
              </Check>
            )}
            {ev.userMeta && (
              <Check id="px-meta" checked={state.includeMeta} onChange={(v) => set({ includeMeta: v })}>
                <code>include_connection_meta</code> (attach connection <code>meta</code>)
              </Check>
            )}
            {binaryRelevant && (
              <Check id="px-bin" checked={state.binary} onChange={(v) => set({ binary: v })}>
                <code>binary_encoding</code> (base64 payloads: <code>data</code>→<code>b64data</code>)
              </Check>
            )}
          </div>

          {/* Request */}
          <div className={styles.group}>
            <div className={styles.groupLabel}>Request <span className={styles.hint}>— Centrifugo → your backend</span></div>
            {(ev.reqToggles || []).map((t) => (
              <Check key={t.key} id={`px-req-${t.key}`} checked={!!state[t.key]} onChange={(v) => set({ [t.key]: v })}>
                {t.label}
              </Check>
            ))}
            <JsonBlock title={isStream ? (state.streamMode === 'bi' ? 'first frame — StreamSubscribeRequest' : 'input — SubscribeRequest') : 'request body'} value={JSON.parse(req)} />
            {isStream && state.streamMode === 'bi' && (
              <div className={styles.hint}>Bidirectional: after the first frame, the client's own publications arrive as <code>{'{ publication }'}</code> frames.</div>
            )}
            {!ev.clientCtx && (
              <div className={styles.hint}>No client-connection context — this event has no <code>client</code>/<code>user</code>/<code>meta</code> and no forwarded headers.</div>
            )}
          </div>

          {headers && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>Forwarded {headers.dest}</div>
              <ul className={styles.notes}>
                {headers.rows.map((h, i) => (
                  <li className={styles.note} key={i}>
                    <span className={styles.noteKey}><code>{h.name}</code></span>
                    <span className={styles.noteDetail}>— {h.origin}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.hint}>
                Static values are added first (lowest precedence); client-supplied <code>emulated_headers</code> next; real
                transport headers last (they win). With a GRPC client these come from <code>grpc_metadata</code> instead.
              </div>
            </div>
          )}
        </div>

        {/* Response + outcome */}
        <div className={styles.col}>
          <div className={styles.group}>
            <div className={styles.groupLabel}>Response <span className={styles.hint}>— your backend → Centrifugo</span></div>
            {modeOptions.length > 1 && (
              <div className={styles.field}>
                <span className={styles.hint}>Your backend returns</span>
                <Seg value={state.mode} onChange={(v) => set({ mode: v })} options={modeOptions} />
              </div>
            )}
            {state.mode === 'result' && (ev.resToggles || []).map((t) => (
              <Check key={t.key} id={`px-res-${t.key}`} checked={!!state[t.key]} onChange={(v) => set({ [t.key]: v })}>
                {t.label}
              </Check>
            ))}
            <JsonBlock title={isStream ? 'first frame — subscribe_response (required)' : 'response body'} value={JSON.parse(resp)} />
            {isStream && (
              <>
                <JsonBlock title="then, repeated — publication frame" value={JSON.parse(buildStreamPub(ev))} />
                <div className={styles.hint}>The stream stays open: your backend keeps sending <code>publication</code> frames, each delivered to the subscribed client.</div>
              </>
            )}
            {!ev.err && !ev.disc && (
              <div className={styles.hint}>This event's response has <b>no</b> <code>error</code> or <code>disconnect</code> — only a result.</div>
            )}
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>What happens</div>
            <div style={{ margin: '0.1rem 0 0.4rem' }}>
              <span className={`${styles.badge} ${statusClass(outcome.status)}`}>{outcome.status}</span>
            </div>
            <ul className={styles.notes}>
              {outcome.lines.map(([k, v], i) => (
                <li className={styles.note} key={i}>
                  <span className={styles.noteKey}>{k}</span> <span className={styles.noteDetail}>— {v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Config + code */}
      <div className={styles.footer}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.8rem' }}>
          <div>
            <Snippet title={`Centrifugo configuration${state.named && ev.named ? ' — named proxy' : ''}`} code={cfg} />
            {CONFIG_NOTES[ev.id] && <div className={styles.hint} style={{ marginTop: '0.4rem' }}>{CONFIG_NOTES[ev.id]}</div>}
          </div>
          <div>
            <div className={styles.seg} style={{ marginBottom: '0.4rem' }}>
              {codeLangs.map((l) => (
                <button key={l} type="button" className={lang === l ? styles.segActive : ''} onClick={() => setLang(l)}>
                  {l === 'grpc' ? 'GRPC' : l[0].toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
            <Snippet title={`Backend handler (${lang === 'grpc' ? 'GRPC sketch' : lang})`} code={code} />
          </div>
        </div>
      </div>

      <div className={styles.caveat}>
        Models the Centrifugo proxy request/response contract for illustration — field names and per-event context are
        taken from <code>proxy.proto</code>. Payloads shown are examples.
      </div>
    </div>
  );
}
