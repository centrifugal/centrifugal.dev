import React from 'react';

export default function PgTransactionalDiagram() {
  return (
    <svg
      viewBox="0 0 700 150"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#17171b' }}
    >
      <defs>
        <marker id="pgtx-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#fe5e5e" />
        </marker>
        <marker id="pgtx-arrow-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#5b8def" />
        </marker>

        <linearGradient id="pgtx-grad-app" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2430" />
          <stop offset="100%" stopColor="#161a22" />
        </linearGradient>
        <linearGradient id="pgtx-grad-pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2a20" />
          <stop offset="100%" stopColor="#161e16" />
        </linearGradient>
        <linearGradient id="pgtx-grad-centrifugo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2020" />
          <stop offset="100%" stopColor="#1f1515" />
        </linearGradient>
        <linearGradient id="pgtx-grad-table" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#222830" />
          <stop offset="100%" stopColor="#1a1e24" />
        </linearGradient>

        <filter id="pgtx-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5b8def" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pgtx-glow-green" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5bef7b" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pgtx-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#fe5e5e" floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ===== YOUR TRANSACTION ===== */}
      <g transform="translate(20, 15)" filter="url(#pgtx-glow-blue)">
        <rect width="185" height="120" rx="10" fill="url(#pgtx-grad-app)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="92" y="22" fontSize="10" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          YOUR TRANSACTION
        </text>

        <rect x="10" y="33" width="165" height="78" rx="6" fill="none" stroke="#5b8def" strokeWidth="1" strokeDasharray="4,3" />
        <text x="92" y="50" fontSize="10" fontWeight="600" fill="#5b8def"
          textAnchor="middle" fontFamily="monospace">
          BEGIN
        </text>
        <rect x="20" y="56" width="145" height="22" rx="4" fill="url(#pgtx-grad-table)" stroke="#444" strokeWidth="1" />
        <text x="92" y="71" fontSize="9" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          your business logic
        </text>
        <rect x="20" y="82" width="145" height="22" rx="4" fill="url(#pgtx-grad-table)" stroke="#5b8def" strokeWidth="1" />
        <text x="92" y="97" fontSize="9" fontWeight="600" fill="#5b8def"
          textAnchor="middle" fontFamily="monospace">
          cf_map_publish(...)
        </text>
      </g>

      {/* ===== Arrow 1 ===== */}
      <line x1="205" y1="75" x2="237" y2="75" stroke="#5b8def" strokeWidth="1.5" markerEnd="url(#pgtx-arrow-blue)" />

      {/* ===== POSTGRESQL ===== */}
      <g transform="translate(243, 15)" filter="url(#pgtx-glow-green)">
        <rect width="160" height="120" rx="10" fill="url(#pgtx-grad-pg)" stroke="#5bef7b" strokeWidth="1.5" />
        <text x="80" y="22" fontSize="10" fontWeight="bold" fill="#5bef7b"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          POSTGRESQL
        </text>
        <rect x="12" y="36" width="136" height="28" rx="4" fill="url(#pgtx-grad-table)" stroke="#5bef7b" strokeWidth="1" />
        <text x="80" y="54" fontSize="9" fontWeight="600" fill="#5bef7b"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          state + outbox
        </text>
        <text x="80" y="85" fontSize="9" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Rolls back?
        </text>
        <text x="80" y="100" fontSize="9" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Nothing gets sent.
        </text>
      </g>

      {/* ===== Arrow 2 ===== */}
      <line x1="403" y1="75" x2="435" y2="75" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#pgtx-arrow)" />

      {/* ===== CENTRIFUGO ===== */}
      <g transform="translate(441, 15)" filter="url(#pgtx-glow-red)">
        <rect width="120" height="120" rx="10" fill="url(#pgtx-grad-centrifugo)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="60" y="22" fontSize="10" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          CENTRIFUGO
        </text>
        <text x="60" y="58" fontSize="9" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Picks up changes
        </text>
        <text x="60" y="73" fontSize="9" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          from outbox
        </text>
        <text x="60" y="100" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          WebSocket push
        </text>
      </g>

      {/* ===== Arrow 3 ===== */}
      <line x1="561" y1="75" x2="593" y2="75" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#pgtx-arrow)" />

      {/* ===== CLIENTS ===== */}
      <g transform="translate(599, 15)">
        <rect width="80" height="120" rx="10" fill="url(#pgtx-grad-table)" stroke="#888" strokeWidth="1" />
        <text x="40" y="22" fontSize="10" fontWeight="bold" fill="#ccc"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          CLIENTS
        </text>
        <g transform="translate(40, 55)">
          <rect x="-30" y="-12" width="60" height="22" rx="4" fill="url(#pgtx-grad-app)" stroke="#5b8def" strokeWidth="1" />
          <text x="0" y="3" fontSize="8" fill="#5b8def"
            textAnchor="middle" fontFamily="system-ui, sans-serif">
            sync
          </text>
        </g>
        <g transform="translate(40, 85)">
          <rect x="-30" y="-12" width="60" height="22" rx="4" fill="url(#pgtx-grad-centrifugo)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="0" y="3" fontSize="8" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">
            update
          </text>
        </g>
      </g>

    </svg>
  );
}
