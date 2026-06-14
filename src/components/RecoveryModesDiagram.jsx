import React from 'react';

// Two recovery modes for the same situation — the client missed #10, #11, #12.
// Stream mode replays them all (order matters: chat, feeds). Cache mode delivers
// only the latest (state matters: now-playing, prices, dashboards).

const C = {
  bg: '#17171b',
  stream: '#5b8def',
  cache: '#5bef7b',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
  faded: '#3a3b44',
};

function Pub({ x, y, off, on, color }) {
  return (
    <g opacity={on ? 1 : 0.32}>
      <rect x={x} y={y} width="48" height="34" rx="6" fill={C.slot} stroke={on ? color : C.faded} strokeWidth={on ? 1.6 : 1} />
      <text x={x + 24} y={y + 22} fontSize="11.5" fill={on ? color : C.muted} textAnchor="middle" fontFamily="monospace" fontWeight="bold">#{off}</text>
    </g>
  );
}

function Panel({ tx, color, title, sub, delivered, usecase, cfg }) {
  return (
    <g transform={`translate(${tx}, 44)`}>
      <rect width="320" height="196" rx="12" fill="#1b1d22" stroke={color} strokeWidth="1.5" />
      <text x="18" y="26" fontSize="13" fontWeight="bold" fill={color} fontFamily="system-ui, sans-serif">{title}</text>
      <text x="302" y="26" fontSize="10" fill={C.muted} textAnchor="end" fontFamily="monospace">{cfg}</text>
      <text x="18" y="45" fontSize="10.5" fill={C.muted} fontFamily="system-ui, sans-serif">{sub}</text>

      <text x="18" y="74" fontSize="10" fill={C.muted} fontFamily="system-ui, sans-serif">missed while away</text>
      {[10, 11, 12].map((off, i) => (
        <Pub key={off} x={18 + i * 54} y={80} off={off} on color={color} />
      ))}

      <text x="18" y="138" fontSize="10" fill={C.muted} fontFamily="system-ui, sans-serif">delivered on resubscribe</text>
      {[10, 11, 12].map((off, i) => (
        <Pub key={off} x={18 + i * 54} y={144} off={off} on={delivered.includes(off)} color={color} />
      ))}

      <text x="160" y="190" fontSize="10" fill={color} textAnchor="middle" fontFamily="system-ui, sans-serif">{usecase}</text>
    </g>
  );
}

export default function RecoveryModesDiagram() {
  return (
    <svg
      viewBox="0 0 720 252"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <text x="360" y="26" fontSize="13" fontWeight="bold" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Same gap, two modes
      </text>

      <Panel
        tx={20} color={C.stream}
        title="stream" sub="replay every missed message, in order"
        delivered={[10, 11, 12]} usecase="chat · feeds · logs"
        cfg={'force_recovery_mode: "stream"'}
      />
      <Panel
        tx={380} color={C.cache}
        title="cache" sub="deliver only the latest — the current state"
        delivered={[12]} usecase="now-playing · prices · dashboards"
        cfg={'force_recovery_mode: "cache"'}
      />
    </svg>
  );
}
