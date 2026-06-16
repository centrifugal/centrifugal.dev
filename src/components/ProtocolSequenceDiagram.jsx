import React, { useState } from 'react';

// Interactive sequence diagram for the Centrifugal client protocol.
// Click any message to inspect the frame that travels on the wire and learn
// what role it plays. Commands and replies that share an `id` light up together.

const COLORS = {
  bg: '#17171b',
  command: '#5b8def', // client -> server request
  reply: '#5bef7b',   // server -> client response
  push: '#fe5e5e',    // async server -> client push
  ping: '#f5c451',    // heartbeat
  muted: '#888',
  text: '#ccc',
};

const MESSAGES = [
  {
    key: 'connect-cmd',
    dir: 'c2s',
    kind: 'command',
    id: 1,
    label: 'connect',
    frame: '{"id":1,"connect":{"token":"<JWT>","name":"js"}}',
    title: 'Command · connect',
    desc: 'The first thing a client sends. It carries the auth token and optional data — a "hello" that opens the session. Every command gets a fresh incrementing id; this one is id=1.',
  },
  {
    key: 'connect-reply',
    dir: 's2c',
    kind: 'reply',
    id: 1,
    label: 'connect reply',
    frame: '{"id":1,"connect":{"client":"e2a1…","ping":25,"pong":true}}',
    title: 'Reply · connect',
    desc: 'The server echoes id=1 so the SDK can match this reply to the command it sent. The result hands back the client id and negotiates the heartbeat: send a ping every 25s, and expect a pong back.',
  },
  {
    key: 'subscribe-cmd',
    dir: 'c2s',
    kind: 'command',
    id: 2,
    label: 'subscribe',
    frame: '{"id":2,"subscribe":{"channel":"chat:42"}}',
    title: 'Command · subscribe',
    desc: 'Subscriptions are multiplexed over the same single connection. id=2 distinguishes this in-flight request from any other the client may have sent before a reply arrives.',
  },
  {
    key: 'subscribe-reply',
    dir: 's2c',
    kind: 'reply',
    id: 2,
    label: 'subscribe reply',
    frame: '{"id":2,"subscribe":{"recoverable":true,"epoch":"x7","offset":14}}',
    title: 'Reply · subscribe',
    desc: 'Matched to id=2. The result tells the client the channel is recoverable and where the stream currently is (epoch + offset) — the anchor used to recover missed messages after a reconnect.',
  },
  {
    key: 'pub-push',
    dir: 's2c',
    kind: 'push',
    id: 0,
    label: 'publication',
    frame: '{"push":{"channel":"chat:42","pub":{"data":{"text":"hi"},"offset":15}}}',
    title: 'Async push · publication',
    desc: 'A push has no id (id=0). It is not an answer to any command — it arrives whenever something happens, here a new message in the channel. The same correlation rule that routes replies also tells the SDK "this one is unsolicited".',
  },
  {
    key: 'ping',
    dir: 's2c',
    kind: 'ping',
    id: 0,
    label: 'ping',
    frame: '{}',
    title: 'Ping',
    desc: 'A ping is the cheapest possible frame: an empty reply (no id, no push payload). The server sends one on the negotiated interval to keep the connection warm and to let the client notice a dead link.',
  },
  {
    key: 'pong',
    dir: 'c2s',
    kind: 'ping',
    id: 0,
    label: 'pong',
    frame: '{}',
    title: 'Pong',
    desc: 'The client answers with an equally empty command. No id, no body — just enough to prove both ends are alive.',
  },
];

const LANE_LEFT = 150;
const LANE_RIGHT = 560;
const TOP = 64;
const ROW = 58;

export default function ProtocolSequenceDiagram() {
  const [selected, setSelected] = useState('connect-cmd');
  const active = MESSAGES.find((m) => m.key === selected) || MESSAGES[0];
  const height = TOP + MESSAGES.length * ROW + 24;

  return (
    <div style={{ margin: '1.2rem 0' }}>
      <svg
        viewBox={`0 0 710 ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: COLORS.bg }}
      >
        <defs>
          <marker id="seq-arr-cmd" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill={COLORS.command} />
          </marker>
          <marker id="seq-arr-reply" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill={COLORS.reply} />
          </marker>
          <marker id="seq-arr-push" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill={COLORS.push} />
          </marker>
          <marker id="seq-arr-ping" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill={COLORS.ping} />
          </marker>
        </defs>

        {/* Header boxes */}
        <g fontFamily="system-ui, sans-serif">
          <rect x={LANE_LEFT - 70} y="16" width="140" height="32" rx="8" fill="#1e2430" stroke={COLORS.command} strokeWidth="1.5" />
          <text x={LANE_LEFT} y="36" fontSize="13" fontWeight="bold" fill={COLORS.command} textAnchor="middle">CLIENT (SDK)</text>
          <rect x={LANE_RIGHT - 70} y="16" width="140" height="32" rx="8" fill="#1e2a20" stroke={COLORS.reply} strokeWidth="1.5" />
          <text x={LANE_RIGHT} y="36" fontSize="13" fontWeight="bold" fill={COLORS.reply} textAnchor="middle">SERVER</text>
        </g>

        {/* Lifelines */}
        <line x1={LANE_LEFT} y1="48" x2={LANE_LEFT} y2={height - 8} stroke="#33343c" strokeWidth="1.5" strokeDasharray="3,4" />
        <line x1={LANE_RIGHT} y1="48" x2={LANE_RIGHT} y2={height - 8} stroke="#33343c" strokeWidth="1.5" strokeDasharray="3,4" />

        {/* Messages */}
        {MESSAGES.map((m, i) => {
          const y = TOP + i * ROW + 24;
          const color = COLORS[m.kind];
          const c2s = m.dir === 'c2s';
          const x1 = c2s ? LANE_LEFT : LANE_RIGHT;
          const x2 = c2s ? LANE_RIGHT : LANE_LEFT;
          const isActive = m.key === selected;
          const idMatch = active.id > 0 && m.id === active.id && m.id > 0;
          const emphasized = isActive || idMatch;
          const arr = { command: 'seq-arr-cmd', reply: 'seq-arr-reply', push: 'seq-arr-push', ping: 'seq-arr-ping' }[m.kind];
          return (
            <g key={m.key} onClick={() => setSelected(m.key)} style={{ cursor: 'pointer' }}>
              {/* hit area */}
              <rect x={LANE_LEFT - 80} y={y - ROW / 2} width={LANE_RIGHT - LANE_LEFT + 160} height={ROW} fill="transparent" />
              {isActive && (
                <rect x={LANE_LEFT - 80} y={y - ROW / 2 + 4} width={LANE_RIGHT - LANE_LEFT + 160} height={ROW - 8} rx="6" fill={color} opacity="0.08" />
              )}
              {/* label */}
              <text
                x={(x1 + x2) / 2}
                y={y - 9}
                fontSize="12.5"
                fontWeight={emphasized ? 'bold' : '500'}
                fill={emphasized ? color : COLORS.text}
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
              >
                {m.label}
              </text>
              {/* arrow */}
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={color}
                strokeWidth={emphasized ? 2.4 : 1.4}
                strokeDasharray={m.kind === 'ping' ? '5,4' : 'none'}
                markerEnd={`url(#${arr})`}
                opacity={emphasized ? 1 : 0.55}
              />
              {/* id badge */}
              <g transform={`translate(${c2s ? LANE_LEFT - 30 : LANE_RIGHT + 30}, ${y})`}>
                <rect x="-22" y="-10" width="44" height="20" rx="10"
                  fill={m.id > 0 ? (idMatch ? color : '#23242b') : '#23242b'}
                  stroke={m.id > 0 ? color : COLORS.muted} strokeWidth="1" opacity={emphasized ? 1 : 0.7} />
                <text x="0" y="4" fontSize="10.5" fill={m.id > 0 && idMatch ? COLORS.bg : (m.id > 0 ? color : COLORS.muted)}
                  textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                  {m.id > 0 ? `id ${m.id}` : 'id 0'}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Detail panel */}
      <div
        style={{
          marginTop: '-2px',
          border: `1px solid ${COLORS[active.kind]}`,
          borderRadius: '10px',
          background: '#1b1c22',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase',
            color: COLORS.bg, background: COLORS[active.kind], padding: '3px 9px', borderRadius: '6px',
          }}>{active.title}</span>
          <span style={{ fontSize: '12px', color: COLORS.muted }}>
            {active.dir === 'c2s' ? 'client → server' : 'server → client'}
          </span>
        </div>
        <pre style={{
          margin: '0 0 10px 0', background: COLORS.bg, border: '1px solid #2a2b33', borderRadius: '8px',
          padding: '10px 12px', fontSize: '12.5px', color: COLORS.text, overflowX: 'auto', lineHeight: 1.5,
        }}><code>{active.frame}</code></pre>
        <div style={{ fontSize: '13.5px', color: COLORS.text, lineHeight: 1.55 }}>{active.desc}</div>
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: COLORS.muted, textAlign: 'center' }}>
        Click any message above to inspect it. Matching <code>id</code> badges light up together.
      </div>
    </div>
  );
}
