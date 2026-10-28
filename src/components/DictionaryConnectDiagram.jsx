import React from 'react';

// How a connection gets its dictionary: the first connect reply carries it,
// a reconnect only names it, and every frame after the reply is compressed
// against it and marked as such.

const C = {
  bg: '#17171b',
  command: '#5b8def',
  reply: '#5bef7b',
  push: '#fe5e5e',
  accent: '#f5c451',
  muted: '#888',
  text: '#ccc',
  card: '#23242b',
};

const FONT = 'system-ui, sans-serif';

function Arrow({ y, left, right, toServer, color, label, note }) {
  const [x1, x2] = toServer ? [left + 6, right - 6] : [right - 6, left + 6];
  const mid = (left + right) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="1.6" markerEnd={`url(#dict-connect-arr-${color.slice(1)})`} />
      <text x={mid} y={y - 7} fontSize="10.5" fill={C.text} textAnchor="middle" fontFamily="monospace">{label}</text>
      {note && <text x={mid} y={y + 15} fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>{note}</text>}
    </g>
  );
}

function Frame({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width="14" height="16" rx="2" fill={C.accent} opacity="0.85" />
      <rect x="16" width="58" height="16" rx="2" fill={C.card} stroke={C.push} strokeWidth="1" />
      <text x="45" y="11.5" fontSize="8.5" fill={C.muted} textAnchor="middle" fontFamily="monospace">deflated</text>
    </g>
  );
}

function Panel({ x, title, connectLabel, replyLabel, replyNote }) {
  const left = 40;
  const right = 300;
  return (
    <g transform={`translate(${x}, 0)`}>
      <rect x="0" y="14" width="340" height="270" rx="8" fill="#1b1f29" stroke="#2c2f3a" />
      <text x="170" y="38" fontSize="12" fontWeight="bold" fill={C.text} textAnchor="middle" fontFamily={FONT}>{title}</text>
      <text x={left} y="62" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>client</text>
      <text x={right} y="62" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>server</text>
      <line x1={left} y1="70" x2={left} y2="270" stroke="#3a3d48" strokeDasharray="3 4" />
      <line x1={right} y1="70" x2={right} y2="270" stroke="#3a3d48" strokeDasharray="3 4" />

      <Arrow y={100} left={left} right={right} toServer color={C.command} label={connectLabel} />
      <Arrow y={150} left={left} right={right} color={C.reply} label={replyLabel} note={replyNote} />

      <text x="170" y="196" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>every frame after the reply:</text>
      {[214, 238, 262].map(y => (
        <g key={y}>
          <line x1={right - 6} y1={y} x2={left + 6} y2={y} stroke={C.push} strokeWidth="1.4" markerEnd={`url(#dict-connect-arr-${C.push.slice(1)})`} />
          <Frame x={133} y={y - 8} />
        </g>
      ))}
    </g>
  );
}

export default function DictionaryConnectDiagram() {
  const colors = [C.command, C.reply, C.push];
  return (
    <svg
      viewBox="0 0 720 340"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        {colors.map(c => (
          <marker key={c} id={`dict-connect-arr-${c.slice(1)}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill={c} />
          </marker>
        ))}
      </defs>

      <Panel
        x={14}
        title="First connect"
        connectLabel='connect · "I can decode"'
        replyLabel='dict: { id, data }'
        replyNote="the dictionary itself, sent once"
      />
      <Panel
        x={366}
        title="Reconnect"
        connectLabel='connect · dict: "id"'
        replyLabel='dict: { id }'
        replyNote="just the id: nothing to download"
      />

      <g transform="translate(160, 304)" fontFamily={FONT} fontSize="10">
        <rect width="12" height="12" rx="2" fill={C.accent} opacity="0.85" />
        <text x="18" y="10" fill={C.muted}>one-byte marker: compressed or not</text>
        <text x="230" y="10" fill={C.muted}>The connect reply itself is never compressed.</text>
      </g>
    </svg>
  );
}
