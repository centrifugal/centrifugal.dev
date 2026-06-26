import React from 'react';

// The naive partition tag is just the index ({0},{1},...), whose CRC16 values
// cluster into a narrow band of slots, so partitions pile onto some Redis nodes
// and leave others idle. Precomputed tags are chosen so their slots spread evenly
// across any cluster size.

const C = {
  bg: '#17171b',
  hot: '#fe5e5e',
  node: '#5bef7b',
  amber: '#f5c451',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

// Real CRC16 distribution for 128 partitions across a 6-node cluster.
const naive = [27, 15, 22, 23, 16, 25];
const even = [21, 22, 21, 21, 22, 21];
const yBase = 226;
const SCALE = 4; // px per partition, so the spread is visible

function Bars({ x0, data, color, step }) {
  const X0 = Number(x0);
  const S = Number(step);
  return data.map((h, i) => {
    const x = X0 + i * S;
    const bh = h * SCALE;
    return (
      <g key={i}>
        <rect x={x} y={yBase - bh} width="28" height={bh} rx="3" fill={color} opacity="0.85" />
        <text x={x + 14} y={yBase - bh - 5} fontSize="9.5" fill={color} textAnchor="middle" fontFamily="monospace">{h}</text>
      </g>
    );
  });
}

export default function PubSubPrecomputedTagsDiagram() {
  return (
    <svg
      viewBox="0 0 760 296"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="pct-arr" markerWidth="11" markerHeight="9" refX="9" refY="4.5" orient="auto">
          <polygon points="0 0, 11 4.5, 0 9" fill={C.amber} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Spread partitions evenly with precomputed tags
      </text>
      <text x="380" y="46" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        partitions landing on each Redis node
      </text>

      {/* left: naive */}
      <text x="184" y="74" fontSize="11.5" fill={C.hot} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">
        Naive: tag = partition index
      </text>
      <text x="184" y="92" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="monospace">{'{0} {1} {2} … {N}'}</text>
      <Bars x0="70" data={naive} color={C.hot} step="46" />
      <line x1="58" y1={yBase} x2="338" y2={yBase} stroke={C.muted} strokeWidth="1" />
      <text x="198" y="256" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        CRC16 bunches the slots — some nodes get far more than others
      </text>

      {/* arrow */}
      <line x1="356" y1="150" x2="404" y2="150" stroke={C.amber} strokeWidth="2" markerEnd="url(#pct-arr)" />

      {/* right: precomputed */}
      <text x="586" y="74" fontSize="11.5" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">
        Precomputed tags
      </text>
      <text x="586" y="92" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="monospace">{'{ms3} {pt6} {ky8} … {rc2}'}</text>

      {/* both schemes still produce N tags — only the strings differ */}
      <text x="380" y="118" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">either way it's still N tags — one per partition</text>
      <Bars x0="472" data={even} color={C.node} step="46" />
      <line x1="460" y1={yBase} x2="740" y2={yBase} stroke={C.muted} strokeWidth="1" />
      <text x="600" y="256" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        slots spread flat across every Redis node
      </text>

      <text x="380" y="284" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Same partitions, same connection count — only the slot each partition lands on changes.
      </text>
    </svg>
  );
}
