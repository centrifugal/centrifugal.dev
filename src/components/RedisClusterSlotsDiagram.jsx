import React from 'react';

// Primer: how Redis Cluster places data. Every key hashes (CRC16 % 16384) to one
// of 16,384 slots; each node owns a contiguous range of slots. A hash tag {..}
// makes only the braced part hash, so related keys can be forced onto one slot.

const C = {
  bg: '#17171b',
  key: '#5b8def',
  hash: '#f5c451',
  n1: '#5bef7b',
  n2: '#5b8def',
  n3: '#f5c451',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

export default function RedisClusterSlotsDiagram() {
  return (
    <svg
      viewBox="0 0 720 256"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="cs-blue" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.key} />
        </marker>
        <marker id="cs-n1" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.n1} />
        </marker>
        <marker id="cs-n3" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.n3} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Redis Cluster: every key belongs to one of 16,384 slots
      </text>

      {/* keys */}
      <rect x="20" y="54" width="108" height="30" rx="7" fill={C.slot} stroke={C.key} strokeWidth="1.3" />
      <text x="74" y="74" fontSize="11" fill={C.key} textAnchor="middle" fontFamily="monospace">chat:42</text>
      <rect x="20" y="104" width="108" height="30" rx="7" fill={C.slot} stroke={C.key} strokeWidth="1.3" />
      <text x="74" y="124" fontSize="11" fill={C.key} textAnchor="middle" fontFamily="monospace">doc:91</text>

      {/* hash pill */}
      <rect x="162" y="64" width="132" height="60" rx="14" fill={C.slot} stroke={C.hash} strokeWidth="1.6" />
      <text x="228" y="89" fontSize="11" fill={C.hash} textAnchor="middle" fontFamily="monospace">CRC16(key)</text>
      <text x="228" y="106" fontSize="11" fill={C.text} textAnchor="middle" fontFamily="monospace">% 16384</text>

      <line x1="128" y1="69" x2="160" y2="84" stroke={C.key} strokeWidth="1.2" markerEnd="url(#cs-blue)" />
      <line x1="128" y1="119" x2="160" y2="104" stroke={C.key} strokeWidth="1.2" markerEnd="url(#cs-blue)" />

      {/* slot bar split by node */}
      {[
        { x: 40, w: 202, c: C.n1, label: 'node 1', range: 'slots 0–5460' },
        { x: 259, w: 202, c: C.n2, label: 'node 2', range: 'slots 5461–10922' },
        { x: 478, w: 202, c: C.n3, label: 'node 3', range: 'slots 10923–16383' },
      ].map((s) => (
        <g key={s.label}>
          <rect x={s.x} y="176" width={s.w} height="34" rx="6" fill={C.slot} stroke={s.c} strokeWidth="1.5" />
          <text x={s.x + s.w / 2} y="197" fontSize="11" fill={s.c} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">{s.label}</text>
          <text x={s.x + s.w / 2} y="225" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="monospace">{s.range}</text>
        </g>
      ))}

      {/* pill -> slot number (placed above its owning node) */}
      <line x1="240" y1="124" x2="161" y2="141" stroke={C.n1} strokeWidth="1.3" markerEnd="url(#cs-n1)" opacity="0.9" />
      <line x1="296" y1="100" x2="552" y2="141" stroke={C.n3} strokeWidth="1.3" markerEnd="url(#cs-n3)" opacity="0.9" />
      <text x="141" y="153" fontSize="11" fill={C.n1} textAnchor="middle" fontFamily="monospace">slot 3401</text>
      <text x="579" y="153" fontSize="11" fill={C.n3} textAnchor="middle" fontFamily="monospace">slot 12182</text>

      {/* slot number -> owning node segment */}
      <line x1="141" y1="159" x2="141" y2="174" stroke={C.n1} strokeWidth="1.3" markerEnd="url(#cs-n1)" />
      <line x1="579" y1="159" x2="579" y2="174" stroke={C.n3} strokeWidth="1.3" markerEnd="url(#cs-n3)" />

      <text x="360" y="248" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        A hash tag hashes only the braced part, so <tspan fontFamily="monospace" fill={C.text}>{'{p}.a'}</tspan> and <tspan fontFamily="monospace" fill={C.text}>{'{p}.b'}</tspan> always land on the same slot — and the same node.
      </text>
    </svg>
  );
}
