import React from 'react';

// Sharded Pub/Sub with partitions: each channel's partition (a hash tag) pins it
// to one node. A publish reaches only that node — no broadcast — and its
// subscribers connect to that same node. Different channels map to different
// nodes, so both publish and subscribe load spread across the whole cluster.

const C = { bg: '#17171b', pub: '#5b8def', sub: '#5bef7b', amber: '#f5c451', muted: '#888', text: '#ccc', slot: '#23242b' };
const centers = [80, 218, 356, 494, 632];
const tags = ['{a}', '{b}', '{c}', '{d}', '{e}'];
const NW = 100;
const NTOP = 128;
const NH = 50;

export default function ClusterShardedPubSubDiagram() {
  return (
    <svg
      viewBox="0 0 740 330"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="csp-blue" markerWidth="9" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.pub} />
        </marker>
        <marker id="csp-green" markerWidth="9" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.sub} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Sharded Pub/Sub: publish and subscribe load spread across the nodes
      </text>

      {/* flow direction hints, placed in the gap between columns 1 and 2 */}
      <text x="149" y="106" fontSize="9" fill={C.muted} textAnchor="middle" fontFamily="monospace">SPUBLISH</text>
      <text x="149" y="212" fontSize="9" fill={C.muted} textAnchor="middle" fontFamily="monospace">delivered</text>

      {centers.map((cx, i) => (
        <g key={i}>
          {/* publisher */}
          <rect x={cx - 47} y="46" width="94" height="30" rx="7" fill={C.slot} stroke={C.pub} strokeWidth="1.3" />
          <text x={cx} y="65" fontSize="10" fill={C.pub} textAnchor="middle" fontFamily="system-ui, sans-serif">publisher</text>
          <line x1={cx} y1="76" x2={cx} y2={NTOP - 2} stroke={C.pub} strokeWidth="1.5" markerEnd="url(#csp-blue)" />

          {/* node + the partition it owns */}
          <rect x={cx - NW / 2} y={NTOP} width={NW} height={NH} rx="8" fill={C.slot} stroke={C.amber} strokeWidth="1.5" />
          <text x={cx} y={NTOP + 21} fontSize="11.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">node {i + 1}</text>
          <text x={cx} y={NTOP + 39} fontSize="11" fill={C.amber} textAnchor="middle" fontFamily="monospace">{tags[i]}</text>

          {/* subscriber */}
          <line x1={cx} y1={NTOP + NH + 2} x2={cx} y2="230" stroke={C.sub} strokeWidth="1.5" markerEnd="url(#csp-green)" />
          <rect x={cx - 47} y="232" width="94" height="30" rx="7" fill={C.slot} stroke={C.sub} strokeWidth="1.3" />
          <text x={cx} y="251" fontSize="10" fill={C.sub} textAnchor="middle" fontFamily="system-ui, sans-serif">subscriber</text>
        </g>
      ))}

      <text x="370" y="292" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Each channel lives on the one node that owns its slot, so its publisher and subscribers meet on that node — and nowhere else.
      </text>
      <text x="370" y="310" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Different channels land on different nodes, so publish and subscribe load spreads across the whole cluster.
      </text>
    </svg>
  );
}
