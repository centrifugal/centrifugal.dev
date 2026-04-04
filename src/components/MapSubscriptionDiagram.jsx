import React from 'react';

export default function MapSubscriptionDiagram() {
  return (
    <svg
      viewBox="0 0 800 610"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#17171b' }}
    >
      <defs>
        <marker id="map-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#fe5e5e" />
        </marker>
        <marker id="map-arrow-muted" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
        </marker>

        <linearGradient id="map-grad-phase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2020" />
          <stop offset="100%" stopColor="#1f1515" />
        </linearGradient>
        <linearGradient id="map-grad-mode" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2430" />
          <stop offset="100%" stopColor="#161a22" />
        </linearGradient>

        <filter id="map-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#fe5e5e" floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="map-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5b8def" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="map-glow-green" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5bef7b" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <pattern id="map-hatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="12" stroke="#222224" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* ===== MAIN BOUNDARY ===== */}
      <rect x="20" y="15" width="760" height="580" rx="12"
        fill="none" stroke="#444" strokeWidth="1" strokeDasharray="8,4" />
      <rect x="20" y="15" width="760" height="580" rx="12"
        fill="url(#map-hatch)" opacity="0.2" />

      {/* ===== THREE PHASES ===== */}

      {/* STATE phase */}
      <g transform="translate(100, 40)" filter="url(#map-glow-red)">
        <rect width="170" height="80" rx="8" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="85" y="30" fontSize="11" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          STATE
        </text>
        <text x="85" y="50" fontSize="10" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Paginate full
        </text>
        <text x="85" y="65" fontSize="10" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          key-value state
        </text>
      </g>

      {/* Arrow STATE → STREAM */}
      <line x1="270" y1="80" x2="310" y2="80" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#map-arrow)" />

      {/* STREAM phase */}
      <g transform="translate(315, 40)" filter="url(#map-glow-red)">
        <rect width="170" height="80" rx="8" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="85" y="30" fontSize="11" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          STREAM
        </text>
        <text x="85" y="50" fontSize="10" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Catch up on changes
        </text>
        <text x="85" y="65" fontSize="10" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          (durable / persistent)
        </text>
      </g>

      {/* Arrow STREAM → LIVE */}
      <line x1="485" y1="80" x2="525" y2="80" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#map-arrow)" />

      {/* LIVE phase */}
      <g transform="translate(530, 40)" filter="url(#map-glow-red)">
        <rect width="170" height="80" rx="8" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="85" y="30" fontSize="11" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          LIVE
        </text>
        <text x="85" y="50" fontSize="10" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Real-time
        </text>
        <text x="85" y="65" fontSize="10" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          PUB/SUB updates
        </text>
      </g>

      {/* ===== MODES SECTION ===== */}
      <g transform="translate(400, 155)">
        <rect x="-40" y="-10" width="80" height="20" rx="4" fill="#17171b" />
        <text x="0" y="5" fontSize="10" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          MODES
        </text>
      </g>

      {/* Ephemeral mode */}
      <g transform="translate(60, 175)">
        <rect width="680" height="85" rx="8" fill="url(#map-grad-mode)" stroke="#5b8def" strokeWidth="1" />

        <text x="340" y="20" fontSize="12" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Ephemeral
        </text>
        <text x="340" y="36" fontSize="10" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Entries auto-expire. No stream history. On reconnect — full state snapshot.
        </text>

        {/* Flow: STATE ──────────────────────────────────► LIVE */}
        <g transform="translate(20, 48)">
          <rect x="0" y="0" width="200" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="100" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">STATE</text>

          <line x1="200" y1="14" x2="435" y2="14" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#map-arrow)" />

          <rect x="440" y="0" width="200" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="540" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">LIVE</text>

          {/* Skipped STREAM label */}
          <text x="320" y="8" fontSize="8" fill="#666"
            textAnchor="middle" fontFamily="system-ui, sans-serif">
            skip STREAM
          </text>
        </g>
      </g>

      {/* Durable mode */}
      <g transform="translate(60, 270)">
        <rect width="680" height="85" rx="8" fill="url(#map-grad-mode)" stroke="#5b8def" strokeWidth="1" />

        <text x="340" y="20" fontSize="12" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Durable
        </text>
        <text x="340" y="36" fontSize="10" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Entries auto-expire. Stream-based catch-up on reconnect. Falls back to snapshot if too far behind.
        </text>

        {/* Flow: STATE ───► STREAM ───► LIVE */}
        <g transform="translate(20, 48)">
          <rect x="0" y="0" width="185" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="92" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">STATE</text>

          <line x1="185" y1="14" x2="222" y2="14" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#map-arrow)" />

          <rect x="227" y="0" width="185" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="320" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">STREAM</text>

          <line x1="412" y1="14" x2="449" y2="14" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#map-arrow)" />

          <rect x="454" y="0" width="186" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="547" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">LIVE</text>
        </g>
      </g>

      {/* Persistent mode */}
      <g transform="translate(60, 365)">
        <rect width="680" height="85" rx="8" fill="url(#map-grad-mode)" stroke="#5b8def" strokeWidth="1" />

        <text x="340" y="20" fontSize="12" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Persistent
        </text>
        <text x="340" y="36" fontSize="10" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Entries persist until removed. Stream-based catch-up on reconnect. Falls back to snapshot if too far behind.
        </text>

        {/* Flow: STATE ───► STREAM ───► LIVE */}
        <g transform="translate(20, 48)">
          <rect x="0" y="0" width="185" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="92" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">STATE</text>

          <line x1="185" y1="14" x2="222" y2="14" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#map-arrow)" />

          <rect x="227" y="0" width="185" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="320" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">STREAM</text>

          <line x1="412" y1="14" x2="449" y2="14" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#map-arrow)" />

          <rect x="454" y="0" width="186" height="28" rx="5" fill="url(#map-grad-phase)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="547" y="18" fontSize="10" fontWeight="600" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">LIVE</text>
        </g>
      </g>

      {/* ===== SDK EVENTS SECTION ===== */}
      <g transform="translate(400, 480)">
        <rect x="-60" y="-10" width="120" height="20" rx="4" fill="#17171b" />
        <text x="0" y="5" fontSize="10" fontWeight="bold" fill="#5bef7b"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          SDK EVENTS
        </text>
      </g>

      <g transform="translate(60, 500)">
        <rect width="330" height="65" rx="8" fill="url(#map-grad-mode)" stroke="#444" strokeWidth="1" />

        {/* sync event */}
        <g transform="translate(20, 18)">
          <text x="0" y="0" fontSize="9" fill="#5bef7b" fontFamily="system-ui, sans-serif">{'◀──'}</text>
          <text x="32" y="0" fontSize="12" fontWeight="bold" fill="#5bef7b" fontFamily="system-ui, sans-serif">
            sync
          </text>
          <text x="70" y="0" fontSize="10" fill="#888" fontFamily="system-ui, sans-serif">
            — full state snapshot
          </text>
        </g>

        {/* update event */}
        <g transform="translate(20, 44)">
          <text x="0" y="0" fontSize="9" fill="#5bef7b" fontFamily="system-ui, sans-serif">{'◀──'}</text>
          <text x="32" y="0" fontSize="12" fontWeight="bold" fill="#5bef7b" fontFamily="system-ui, sans-serif">
            update
          </text>
          <text x="82" y="0" fontSize="10" fill="#888" fontFamily="system-ui, sans-serif">
            — incremental change
          </text>
        </g>
      </g>

      {/* SDK handles everything */}
      <g transform="translate(410, 500)">
        <rect width="330" height="65" rx="8" fill="url(#map-grad-mode)" stroke="#444" strokeWidth="1" />
        <text x="165" y="25" fontSize="10" fill="#aaa"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          SDK handles all phases transparently.
        </text>
        <text x="165" y="42" fontSize="10" fill="#aaa"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          App receives only <tspan fill="#5bef7b" fontWeight="600">sync</tspan> and <tspan fill="#5bef7b" fontWeight="600">update</tspan> events.
        </text>
      </g>

    </svg>
  );
}
