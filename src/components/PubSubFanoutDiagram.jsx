import React from 'react';

// Baseline mental model: backend services PUBLISH to Redis, every consumer node
// holds a PUB/SUB connection and SUBSCRIBEs to the channels it cares about, Redis
// fans each publication out to interested subscribers. This is the ceiling the
// rest of the post raises.

const C = {
  bg: '#17171b',
  pub: '#5b8def',   // publishers / commands
  redis: '#f5c451', // Redis
  node: '#5bef7b',  // our consumer nodes
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

export default function PubSubFanoutDiagram() {
  const nodes = [54, 110, 166];
  return (
    <svg
      viewBox="0 0 720 232"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="fan-blue" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.pub} />
        </marker>
        <marker id="fan-green" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.node} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        Baseline: publishers fan out to subscribers through Redis
      </text>

      {/* publishers */}
      <rect x="24" y="66" width="92" height="34" rx="7" fill={C.slot} stroke={C.pub} strokeWidth="1.4" />
      <text x="70" y="87" fontSize="11" fill={C.pub} textAnchor="middle" fontFamily="system-ui, sans-serif">publisher</text>
      <rect x="24" y="128" width="92" height="34" rx="7" fill={C.slot} stroke={C.pub} strokeWidth="1.4" />
      <text x="70" y="149" fontSize="11" fill={C.pub} textAnchor="middle" fontFamily="system-ui, sans-serif">publisher</text>

      {/* Redis */}
      <rect x="296" y="80" width="128" height="68" rx="9" fill={C.slot} stroke={C.redis} strokeWidth="1.8" />
      <text x="360" y="110" fontSize="13" fill={C.redis} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="bold">Redis</text>
      <text x="360" y="130" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="monospace">PUB/SUB</text>

      {/* publisher -> redis */}
      <line x1="116" y1="83" x2="294" y2="104" stroke={C.pub} strokeWidth="1.5" markerEnd="url(#fan-blue)" />
      <line x1="116" y1="145" x2="294" y2="124" stroke={C.pub} strokeWidth="1.5" markerEnd="url(#fan-blue)" />
      <text x="205" y="84" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="monospace">PUBLISH</text>

      {/* consumer nodes */}
      {nodes.map((y, i) => (
        <g key={i}>
          <rect x="596" y={y} width="100" height="34" rx="7" fill={C.slot} stroke={C.node} strokeWidth="1.4" />
          <text x="646" y={y + 21} fontSize="11" fill={C.node} textAnchor="middle" fontFamily="system-ui, sans-serif">node {i + 1}</text>
          <line x1="424" y1="114" x2="594" y2={y + 17} stroke={C.node} strokeWidth="1.4" markerEnd="url(#fan-green)" opacity="0.9" />
        </g>
      ))}
      <text x="500" y="78" fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">fan-out</text>
    </svg>
  );
}
