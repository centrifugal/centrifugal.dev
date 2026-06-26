import React from 'react';

// At fleet scale the connection count explodes: a connection per partition means
// num_nodes × num_partitions connections to the cluster. Group subscriptions by
// the Redis node that owns them and each consumer holds num_redis_nodes
// connections instead — the count that actually bites (maxclients, fds, memory).

const C = {
  bg: '#17171b',
  node: '#5bef7b',
  amber: '#f5c451',
  hot: '#fe5e5e',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

const clusterY = [54, 90, 126, 162, 198, 234];

function ClusterNodes({ x }) {
  return clusterY.map((y, i) => (
    <g key={i}>
      <rect x={x} y={y} width="84" height="22" rx="5" fill={C.slot} stroke={C.amber} strokeWidth="1.2" />
      <text x={x + 42} y={y + 15} fontSize="9.5" fill={C.amber} textAnchor="middle" fontFamily="monospace">node {i + 1}</text>
    </g>
  ));
}

export default function PubSubNodeGroupDiagram() {
  return (
    <svg
      viewBox="0 0 760 326"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <line x1="380" y1="44" x2="380" y2="300" stroke="#2c2c34" strokeWidth="1" strokeDasharray="3,4" />

      {/* LEFT: per-partition */}
      <text x="20" y="28" fontSize="12.5" fontWeight="bold" fill={C.hot} fontFamily="system-ui, sans-serif">Per-partition</text>
      <rect x="20" y="140" width="84" height="44" rx="8" fill={C.slot} stroke={C.node} strokeWidth="1.5" />
      <text x="62" y="166" fontSize="10" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif">consumer</text>
      {clusterY.map((y, i) => (
        <g key={i}>
          <line x1="104" y1="158" x2="280" y2={y + 11} stroke={C.hot} strokeWidth="0.8" opacity="0.55" />
          <line x1="104" y1="166" x2="280" y2={y + 11} stroke={C.hot} strokeWidth="0.8" opacity="0.55" />
        </g>
      ))}
      <ClusterNodes x="280" />
      <text x="150" y="270" fontSize="10.5" fill={C.hot} fontFamily="monospace">128 conns × 200 nodes</text>
      <text x="150" y="288" fontSize="11" fill={C.hot} fontFamily="system-ui, sans-serif" fontWeight="bold">≈ 25,600 conns · ~4,267 / node</text>

      {/* RIGHT: node-grouped */}
      <text x="404" y="28" fontSize="12.5" fontWeight="bold" fill={C.node} fontFamily="system-ui, sans-serif">Node-grouped</text>
      <rect x="404" y="140" width="84" height="44" rx="8" fill={C.slot} stroke={C.node} strokeWidth="1.5" />
      <text x="446" y="166" fontSize="10" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif">consumer</text>
      {clusterY.map((y, i) => (
        <line key={i} x1="488" y1="162" x2="660" y2={y + 11} stroke={C.node} strokeWidth="1.3" opacity="0.85" />
      ))}
      <ClusterNodes x="660" />
      <text x="534" y="270" fontSize="10.5" fill={C.node} fontFamily="monospace">6 conns × 200 nodes</text>
      <text x="534" y="288" fontSize="11" fill={C.node} fontFamily="system-ui, sans-serif" fontWeight="bold">= 1,200 conns · 200 / node</text>

      <text x="380" y="316" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Group by the cluster node that owns the slots: connections per consumer drop from num_partitions to num_redis_nodes.
      </text>
    </svg>
  );
}
