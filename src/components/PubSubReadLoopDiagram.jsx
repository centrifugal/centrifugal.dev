import React from 'react';

// All subscriptions on one connection means one goroutine drains the socket and
// also decodes + dispatches every message — a single-core ceiling. Fix: several
// PUB/SUB connections, and a pool of processors (one per core) so the read loop
// only routes raw bytes and never blocks.

const C = {
  bg: '#17171b',
  redis: '#f5c451',
  node: '#5bef7b',
  hot: '#fe5e5e',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

export default function PubSubReadLoopDiagram() {
  return (
    <svg
      viewBox="0 0 760 320"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="rl-green" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.node} />
        </marker>
        <marker id="rl-hot" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.hot} />
        </marker>
      </defs>

      {/* divider */}
      <line x1="380" y1="44" x2="380" y2="300" stroke="#2c2c34" strokeWidth="1" strokeDasharray="3,4" />

      {/* ---- LEFT: before ---- */}
      <text x="24" y="28" fontSize="12.5" fontWeight="bold" fill={C.hot} fontFamily="system-ui, sans-serif">One connection, one goroutine</text>

      <rect x="60" y="52" width="240" height="34" rx="7" fill={C.slot} stroke={C.redis} strokeWidth="1.6" />
      <text x="180" y="74" fontSize="11" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif">Redis — all channels</text>

      <line x1="180" y1="86" x2="180" y2="120" stroke={C.hot} strokeWidth="2.5" markerEnd="url(#rl-hot)" />
      <text x="232" y="108" fontSize="9" fill={C.muted} fontFamily="monospace">1 conn</text>

      <rect x="96" y="124" width="168" height="64" rx="8" fill={C.slot} stroke={C.hot} strokeWidth="1.8" />
      <text x="180" y="150" fontSize="11.5" fill={C.hot} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">read loop</text>
      <text x="180" y="170" fontSize="9.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">decode + dispatch</text>
      <text x="180" y="218" fontSize="10" fill={C.hot} textAnchor="middle" fontFamily="system-ui, sans-serif">saturates one core →</text>
      <text x="180" y="234" fontSize="10" fill={C.hot} textAnchor="middle" fontFamily="system-ui, sans-serif">reads stall</text>

      {/* ---- RIGHT: after ---- */}
      <text x="404" y="28" fontSize="12.5" fontWeight="bold" fill={C.node} fontFamily="system-ui, sans-serif">Many connections + processor pool</text>

      <rect x="440" y="52" width="280" height="34" rx="7" fill={C.slot} stroke={C.redis} strokeWidth="1.6" />
      <text x="580" y="74" fontSize="11" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif">Redis — channels split by hash</text>

      {/* read loops */}
      {[0, 1, 2].map((i) => {
        const x = 452 + i * 92;
        return (
          <g key={i}>
            <line x1={x + 36} y1="86" x2={x + 36} y2="112" stroke={C.node} strokeWidth="1.6" markerEnd="url(#rl-green)" />
            <rect x={x} y="114" width="72" height="40" rx="7" fill={C.slot} stroke={C.node} strokeWidth="1.4" />
            <text x={x + 36} y="132" fontSize="9.5" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif">read loop</text>
            <text x={x + 36} y="146" fontSize="8.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">route bytes</text>
          </g>
        );
      })}

      {/* processor pool */}
      <rect x="436" y="196" width="288" height="58" rx="8" fill="none" stroke={C.node} strokeWidth="1.2" strokeDasharray="5,4" />
      {[0, 1, 2, 3].map((i) => {
        const x = 452 + i * 68;
        return (
          <g key={i}>
            <rect x={x} y="208" width="56" height="34" rx="6" fill={C.slot} stroke={C.node} strokeWidth="1.3" />
            <text x={x + 28} y="229" fontSize="9.5" fill={C.node} textAnchor="middle" fontFamily="monospace">proc</text>
          </g>
        );
      })}
      {/* a couple of routing lines loops -> pool */}
      <line x1="488" y1="154" x2="480" y2="206" stroke={C.muted} strokeWidth="1" markerEnd="url(#rl-green)" opacity="0.6" />
      <line x1="580" y1="154" x2="616" y2="206" stroke={C.muted} strokeWidth="1" markerEnd="url(#rl-green)" opacity="0.6" />
      <line x1="672" y1="154" x2="684" y2="206" stroke={C.muted} strokeWidth="1" markerEnd="url(#rl-green)" opacity="0.6" />
      <text x="580" y="272" fontSize="9.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">1 processor per core — decode + deliver off the read path</text>

      <text x="380" y="306" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        The read loop must never block: spread subscriptions across connections, hand raw payloads to per-core processors.
      </text>
    </svg>
  );
}
