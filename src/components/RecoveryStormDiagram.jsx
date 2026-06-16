import React, { useState } from 'react';

// The "why" of recovery: a mass reconnect. Toggle recovery off/on to see where
// the load lands — without it every returning client hammers the application
// database; with it Centrifugo replays missed messages from its history broker
// (memory, Redis, or PostgreSQL) and the database stays untouched.

const C = {
  bg: '#17171b',
  client: '#5b8def',
  cf: '#5bef7b',
  db: '#fe5e5e',
  ok: '#5bef7b',
  amber: '#f5c451',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

const CLIENT_Y = [72, 108, 144, 180, 216];

export default function RecoveryStormDiagram() {
  const [on, setOn] = useState(true);

  return (
    <div style={{ margin: '1.2rem 0' }}>
      <svg
        viewBox="0 0 720 300"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg }}
      >
        <defs>
          <marker id="storm-c" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" fill={C.client} />
          </marker>
          <marker id="storm-r" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" fill={C.db} />
          </marker>
          <marker id="storm-g" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" fill={C.ok} />
          </marker>
        </defs>

        <text x="20" y="26" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">
          A balancer reloaded — every client reconnects at once
        </text>

        {/* clients */}
        <text x="74" y="52" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">clients</text>
        {CLIENT_Y.map((y, i) => (
          <g key={i}>
            <circle cx="74" cy={y} r="11" fill={C.slot} stroke={C.client} strokeWidth="1.4" />
            <circle cx="74" cy={y} r="4" fill={C.client} />
            <line x1="85" y1={y} x2="246" y2="144" stroke={C.client} strokeWidth="1.2" opacity="0.5" markerEnd="url(#storm-c)" />
          </g>
        ))}

        {/* Centrifugo */}
        <g transform="translate(250, 60)">
          <rect width="190" height="168" rx="12" fill="#1a221b" stroke={C.cf} strokeWidth="1.6" />
          <text x="95" y="26" fontSize="12.5" fontWeight="bold" fill={C.cf} textAnchor="middle" fontFamily="system-ui, sans-serif">CENTRIFUGO</text>
          {/* in-memory stream */}
          <rect x="20" y="44" width="150" height="56" rx="8" fill={C.slot} stroke={on ? C.ok : '#3a3b44'} strokeWidth={on ? 1.6 : 1} />
          <text x="95" y="64" fontSize="10" fill={on ? C.ok : C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">history broker</text>
          <g fontFamily="monospace" fontSize="9.5">
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <rect x={28 + i * 36} y="74" width="30" height="18" rx="3" fill="#1b1d22" stroke={on ? C.ok : '#3a3b44'} strokeWidth="1" />
                <text x={28 + i * 36 + 15} y="86" fill={on ? C.ok : C.muted} textAnchor="middle">#{10 + i}</text>
              </g>
            ))}
          </g>
          {on && (
            <text x="95" y="124" fontSize="10.5" fill={C.ok} textAnchor="middle" fontFamily="system-ui, sans-serif">✓ replayed from the broker</text>
          )}
        </g>

        {/* recovery off: clients fetch state directly from the backend, bypassing Centrifugo */}
        {!on && (
          <>
            <path d="M 95 232 C 280 274, 480 274, 600 232" fill="none" stroke={C.db} strokeWidth="2.2" strokeDasharray="6,4" markerEnd="url(#storm-r)" />
            <text x="348" y="292" fontSize="10.5" fill={C.db} textAnchor="middle" fontFamily="system-ui, sans-serif">clients fetch state directly from your backend (Centrifugo bypassed)</text>
          </>
        )}

        {/* Backend */}
        <g transform="translate(520, 60)">
          <rect width="180" height="168" rx="12" fill="#1b1f29" stroke={C.muted} strokeWidth="1.3" />
          <text x="90" y="26" fontSize="12" fontWeight="bold" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">YOUR BACKEND</text>
          <rect x="22" y="40" width="136" height="30" rx="6" fill={C.slot} stroke={C.muted} strokeWidth="1" />
          <text x="90" y="59" fontSize="10.5" fill={C.text} textAnchor="middle" fontFamily="system-ui, sans-serif">app</text>
          <rect x="22" y="80" width="136" height="64" rx="6" fill={on ? '#16241a' : '#2a1618'} stroke={on ? C.ok : C.db} strokeWidth="1.6" />
          <text x="90" y="104" fontSize="11" fontWeight="bold" fill={on ? C.ok : C.db} textAnchor="middle" fontFamily="system-ui, sans-serif">database</text>
          <text x="90" y="124" fontSize="9.5" fill={on ? C.ok : C.db} textAnchor="middle" fontFamily="system-ui, sans-serif">
            {on ? 'calm — not queried' : 'thundering herd'}
          </text>
        </g>
      </svg>

      {/* control + metric */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #2a2b33', borderRadius: '8px', overflow: 'hidden' }}>
          {[['Recovery off', false], ['Recovery on', true]].map(([label, val]) => (
            <button
              key={String(val)}
              onClick={() => setOn(val)}
              style={{
                padding: '7px 14px', fontSize: '13px', cursor: 'pointer', border: 'none',
                background: on === val ? (val ? C.ok : C.db) : 'transparent',
                color: on === val ? C.bg : C.muted, fontWeight: on === val ? 'bold' : 'normal',
              }}
            >{label}</button>
          ))}
        </div>
        <span style={{ fontSize: '13px', color: on ? C.ok : C.db }}>
          {on
            ? 'Returning clients are served from the broker — the database load from reconnects is ~0.'
            : 'Every returning client queries the database for missed state — load spikes with the herd.'}
        </span>
      </div>
    </div>
  );
}
