import React from 'react';

// App-level partitions, in human terms: a server handles a huge, ever-changing
// set of channels. Each channel is hashed into one of a small, fixed number of
// partitions (say 128), and the engine keeps ONE connection per partition. So the
// connection count is bounded by the partition count (128) instead of growing with
// the number of channels (which would be millions).

const C = {
  bg: '#17171b',
  chan: '#5b8def',
  amber: '#f5c451',
  node: '#5bef7b',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

const channels = ['user:1042', 'doc:88', 'chat:42', 'game:7', 'room:5'];

export default function PubSubClusterPartitionDiagram() {
  const hubX = 250;
  const hubY = 150;
  return (
    <svg
      viewBox="0 0 720 322"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="cp-arr" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.muted} />
        </marker>
        <marker id="cp-green" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.node} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Group channels into a fixed number of partitions
      </text>

      {/* channels (left) */}
      {channels.map((c, i) => {
        const y = 58 + i * 34;
        return (
          <g key={c}>
            <rect x="20" y={y} width="120" height="26" rx="6" fill={C.slot} stroke={C.chan} strokeWidth="1.2" />
            <text x="80" y={y + 17} fontSize="10.5" fill={C.chan} textAnchor="middle" fontFamily="monospace">{c}</text>
            <line x1="140" y1={y + 13} x2={hubX - 36} y2={hubY} stroke={C.chan} strokeWidth="1" opacity="0.5" markerEnd="url(#cp-arr)" />
          </g>
        );
      })}
      <text x="80" y="246" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">…and millions more</text>

      {/* hash hub (middle) */}
      <circle cx={hubX} cy={hubY} r="34" fill={C.slot} stroke={C.amber} strokeWidth="1.6" />
      <text x={hubX} y={hubY - 2} fontSize="11" fill={C.amber} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">hash</text>
      <text x={hubX} y={hubY + 13} fontSize="8.5" fill={C.muted} textAnchor="middle" fontFamily="monospace">→ partition</text>

      {/* partitions + one connection each (right-middle) */}
      {[0, 1, 2].map((p, i) => {
        const y = 84 + i * 54;
        return (
          <g key={p}>
            <line x1={hubX + 34} y1={hubY} x2="404" y2={y + 18} stroke={C.amber} strokeWidth="1.1" opacity="0.6" markerEnd="url(#cp-arr)" />
            <rect x="408" y={y} width="152" height="36" rx="7" fill={C.slot} stroke={C.amber} strokeWidth="1.3" />
            <text x="484" y={y + 15} fontSize="10.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">partition {p}</text>
            <text x="484" y={y + 29} fontSize="8.5" fill={C.muted} textAnchor="middle" fontFamily="monospace">1 connection</text>
            <line x1="560" y1={y + 18} x2="616" y2={y + 18} stroke={C.node} strokeWidth="1.4" markerEnd="url(#cp-green)" />
          </g>
        );
      })}
      <text x="484" y="262" fontSize="10" fill={C.amber} textAnchor="middle" fontFamily="system-ui, sans-serif">…N partitions in total (N is small)</text>

      {/* redis (right) */}
      <rect x="620" y="84" width="82" height="144" rx="8" fill={C.slot} stroke={C.node} strokeWidth="1.5" />
      <text x="661" y="150" fontSize="11" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif">Redis</text>
      <text x="661" y="166" fontSize="9" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">node(s)</text>

      <text x="360" y="296" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Each channel hashes to one of N partitions — a small, fixed number — and each partition uses one connection.
      </text>
      <text x="360" y="313" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        So the connection count is N, far smaller than the number of channels (which can be millions).
      </text>
    </svg>
  );
}
