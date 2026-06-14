import React from 'react';

// The other half of the story: the Reply envelope does double duty. The SDK reads
// every incoming frame three ways, decided entirely by the id field — a reply to a
// command (id > 0), an asynchronous push (id 0 + push), or a ping (id 0, empty).

const C = {
  bg: '#17171b',
  reply: '#5bef7b',
  push: '#fe5e5e',
  ping: '#f5c451',
  muted: '#888',
  text: '#ccc',
};

const HUB = { x: 302, y: 122 };
const TARGET_X = 420;

function Branch({ y, color, cond, title }) {
  return (
    <g>
      <line x1={HUB.x} y1={HUB.y} x2={TARGET_X} y2={y + 26} stroke={color} strokeWidth="1.6" opacity="0.8" markerEnd="url(#push-arr)" />
      <rect x={TARGET_X} y={y} width="278" height="52" rx="9" fill="#1b1d22" stroke={color} strokeWidth="1.4" />
      <text x={TARGET_X + 16} y={y + 22} fontSize="11.5" fill={color} fontFamily="monospace" fontWeight="bold">{cond}</text>
      <text x={TARGET_X + 16} y={y + 40} fontSize="12" fill={C.text} fontFamily="system-ui, sans-serif">{title}</text>
    </g>
  );
}

export default function ProtocolPushDiagram() {
  return (
    <svg
      viewBox="0 0 720 250"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="push-arr" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
          <polygon points="0 0, 9 4, 0 8" fill={C.muted} />
        </marker>
      </defs>

      <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
        One Reply envelope, read three ways
      </text>

      {/* incoming frame */}
      <g transform="translate(20, 98)">
        <rect width="150" height="48" rx="10" fill="#1b1d22" stroke={C.muted} strokeWidth="1.3" />
        <text x="75" y="21" fontSize="11" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">frame from server</text>
        <text x="75" y="37" fontSize="11.5" fill={C.text} textAnchor="middle" fontFamily="monospace">{'{ … }'}</text>
      </g>
      <line x1="170" y1="122" x2="206" y2="122" stroke={C.muted} strokeWidth="1.5" markerEnd="url(#push-arr)" />

      {/* hub */}
      <rect x="206" y="102" width="96" height="40" rx="10" fill="#23242b" stroke={C.text} strokeWidth="1.3" />
      <text x="254" y="119" fontSize="11" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">look at</text>
      <text x="254" y="134" fontSize="12" fill={C.ping} textAnchor="middle" fontFamily="monospace" fontWeight="bold">id</text>

      {/* branches */}
      <Branch y={24} color={C.reply} cond="id > 0" title="Reply to a command" />
      <Branch y={96} color={C.push} cond="id = 0  +  push" title="Asynchronous push" />
      <Branch y={168} color={C.ping} cond="id = 0  ·  empty" title="Ping" />

      <text x="559" y="240" fontSize="11" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">
        pushes carry events: pub · join · leave · unsubscribe · disconnect · …
      </text>
    </svg>
  );
}
