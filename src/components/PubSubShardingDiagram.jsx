import React from 'react';

// Redis is single-threaded: when one instance saturates a core, add independent
// instances and map each channel to a shard with Jump consistent hash. Publish
// and subscribe for a channel always agree on its shard. Throughput scales with
// shard count.

const C = {
  bg: '#17171b',
  chan: '#5b8def',
  hash: '#f5c451',
  redis: '#f5c451',
  node: '#5bef7b',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

// channel -> shard index (illustrative)
const channels = [
  { name: 'chat:42', shard: 0 },
  { name: 'doc:91', shard: 2 },
  { name: 'game:7', shard: 1 },
  { name: 'feed:3', shard: 0 },
];
const shardY = [60, 124, 188];

export default function PubSubShardingDiagram() {
  return (
    <svg
      viewBox="0 0 720 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="sh-blue" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.chan} />
        </marker>
        <marker id="sh-amber" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.redis} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        One Redis is single-threaded — shard by channel
      </text>

      {/* channels */}
      {channels.map((c, i) => {
        const y = 60 + i * 44;
        return (
          <g key={c.name}>
            <rect x="24" y={y} width="124" height="32" rx="7" fill={C.slot} stroke={C.chan} strokeWidth="1.3" />
            <text x="86" y={y + 21} fontSize="11" fill={C.chan} textAnchor="middle" fontFamily="monospace">{c.name}</text>
            <line x1="148" y1={y + 16} x2="266" y2="140" stroke={C.chan} strokeWidth="1.1" markerEnd="url(#sh-blue)" opacity="0.55" />
          </g>
        );
      })}

      {/* hash pill */}
      <rect x="268" y="108" width="150" height="64" rx="32" fill={C.slot} stroke={C.hash} strokeWidth="1.8" />
      <text x="343" y="135" fontSize="11.5" fill={C.hash} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">Jump hash</text>
      <text x="343" y="153" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="monospace">(channel) → shard</text>

      {/* redis shards */}
      {shardY.map((y, i) => (
        <g key={i}>
          <rect x="560" y={y} width="132" height="40" rx="8" fill={C.slot} stroke={C.redis} strokeWidth="1.6" />
          <text x="626" y={y + 25} fontSize="11" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif">Redis {String.fromCharCode(65 + i)}</text>
          <line x1="418" y1="140" x2="558" y2={y + 20} stroke={C.redis} strokeWidth="1.3" markerEnd="url(#sh-amber)" opacity="0.8" />
        </g>
      ))}

      <text x="360" y="268" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        Independent instances, no replication between them — aggregate throughput grows with the shard count.
      </text>
      <text x="360" y="286" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        A channel's publishers and subscribers always hash to the same shard.
      </text>
    </svg>
  );
}
