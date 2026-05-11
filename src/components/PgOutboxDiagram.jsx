import React from 'react';

export default function PgOutboxDiagram() {
  return (
    <svg
      viewBox="0 0 820 310"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#17171b' }}
    >
      <defs>
        <marker id="pgout-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#fe5e5e" />
        </marker>
        <marker id="pgout-arrow-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#5b8def" />
        </marker>
        <marker id="pgout-arrow-muted" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
        </marker>

        <linearGradient id="pgout-grad-app" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2430" />
          <stop offset="100%" stopColor="#161a22" />
        </linearGradient>
        <linearGradient id="pgout-grad-pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2a20" />
          <stop offset="100%" stopColor="#161e16" />
        </linearGradient>
        <linearGradient id="pgout-grad-centrifugo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2020" />
          <stop offset="100%" stopColor="#1f1515" />
        </linearGradient>
        <linearGradient id="pgout-grad-table" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#222830" />
          <stop offset="100%" stopColor="#1a1e24" />
        </linearGradient>

        <filter id="pgout-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5b8def" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pgout-glow-green" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5bef7b" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pgout-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#fe5e5e" floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ===== YOUR APPLICATION ===== */}
      <g transform="translate(20, 20)" filter="url(#pgout-glow-blue)">
        <rect width="190" height="270" rx="10" fill="url(#pgout-grad-app)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="95" y="24" fontSize="11" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          YOUR APPLICATION
        </text>

        {/* Transaction block */}
        <rect x="12" y="40" width="166" height="130" rx="6" fill="none" stroke="#5b8def" strokeWidth="1" strokeDasharray="4,3" />
        <text x="95" y="58" fontSize="10" fontWeight="600" fill="#5b8def"
          textAnchor="middle" fontFamily="monospace">
          BEGIN
        </text>

        {/* Business logic */}
        <rect x="22" y="68" width="146" height="30" rx="4" fill="url(#pgout-grad-table)" stroke="#444" strokeWidth="1" />
        <text x="95" y="87" fontSize="9" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Business logic / SQL
        </text>

        {/* cf_map_publish */}
        <rect x="22" y="106" width="146" height="30" rx="4" fill="url(#pgout-grad-table)" stroke="#5b8def" strokeWidth="1" />
        <text x="95" y="125" fontSize="9" fontWeight="600" fill="#5b8def"
          textAnchor="middle" fontFamily="monospace">
          cf_map_publish(...)
        </text>

        <text x="95" y="160" fontSize="10" fontWeight="600" fill="#5b8def"
          textAnchor="middle" fontFamily="monospace">
          COMMIT
        </text>

        {/* Explanation */}
        <text x="95" y="195" fontSize="9" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Both your data and the
        </text>
        <text x="95" y="208" fontSize="9" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          real-time state update
        </text>
        <text x="95" y="221" fontSize="9" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          commit or rollback
        </text>
        <text x="95" y="234" fontSize="9" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          together atomically.
        </text>

        <text x="95" y="260" fontSize="8" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Also: server API or client SDK
        </text>
      </g>

      {/* ===== Arrow: App → PostgreSQL ===== */}
      <line x1="210" y1="120" x2="234" y2="120" stroke="#5b8def" strokeWidth="1.5" markerEnd="url(#pgout-arrow-blue)" />

      {/* ===== POSTGRESQL ===== */}
      <g transform="translate(240, 20)" filter="url(#pgout-glow-green)">
        <rect width="240" height="270" rx="10" fill="url(#pgout-grad-pg)" stroke="#5bef7b" strokeWidth="1.5" />
        <text x="120" y="24" fontSize="11" fontWeight="bold" fill="#5bef7b"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          POSTGRESQL
        </text>

        {/* State table */}
        <rect x="15" y="42" width="210" height="42" rx="5" fill="url(#pgout-grad-table)" stroke="#5bef7b" strokeWidth="1" />
        <text x="120" y="60" fontSize="10" fontWeight="600" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">
          cf_map_state
        </text>
        <text x="120" y="74" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Current key-value snapshot
        </text>

        {/* Stream table (outbox) */}
        <rect x="15" y="94" width="210" height="52" rx="5" fill="url(#pgout-grad-table)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="120" y="114" fontSize="10" fontWeight="600" fill="#fe5e5e"
          textAnchor="middle" fontFamily="monospace">
          cf_map_stream
        </text>
        <text x="120" y="128" fontSize="8" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Change log (outbox)
        </text>
        <text x="120" y="140" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Sharded for parallelism
        </text>

        {/* Meta table */}
        <rect x="15" y="156" width="210" height="42" rx="5" fill="url(#pgout-grad-table)" stroke="#444" strokeWidth="1" />
        <text x="120" y="174" fontSize="10" fontWeight="600" fill="#aaa"
          textAnchor="middle" fontFamily="monospace">
          cf_map_meta
        </text>
        <text x="120" y="188" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Epoch + offset tracking
        </text>

        {/* pg_notify */}
        <rect x="15" y="208" width="210" height="30" rx="5" fill="url(#pgout-grad-table)" stroke="#e8a838" strokeWidth="1" />
        <text x="120" y="228" fontSize="10" fontWeight="600" fill="#e8a838"
          textAnchor="middle" fontFamily="monospace">
          pg_notify()
        </text>

        {/* Note */}
        <text x="120" y="258" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          All updated atomically in one transaction
        </text>
      </g>

      {/* ===== Arrow: PG → Centrifugo (stream polling) ===== */}
      <g>
        <line x1="480" y1="120" x2="504" y2="120" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#pgout-arrow)" />
        <text x="492" y="112" fontSize="7" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          poll
        </text>
      </g>

      {/* ===== Arrow: PG → Centrifugo (notify) ===== */}
      <g>
        <line x1="480" y1="223" x2="504" y2="185" stroke="#e8a838" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#pgout-arrow-muted)" />
      </g>

      {/* ===== CENTRIFUGO ===== */}
      <g transform="translate(510, 20)" filter="url(#pgout-glow-red)">
        <rect width="145" height="270" rx="10" fill="url(#pgout-grad-centrifugo)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="72" y="24" fontSize="11" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          CENTRIFUGO
        </text>

        {/* Outbox worker */}
        <rect x="12" y="42" width="121" height="55" rx="5" fill="url(#pgout-grad-table)" stroke="#fe5e5e" strokeWidth="1" />
        <text x="72" y="62" fontSize="9" fontWeight="600" fill="#fe5e5e"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Outbox Workers
        </text>
        <text x="72" y="76" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          One per shard
        </text>
        <text x="72" y="88" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Cursor-based polling
        </text>

        {/* PUB/SUB delivery */}
        <rect x="12" y="108" width="121" height="44" rx="5" fill="url(#pgout-grad-table)" stroke="#fe5e5e" strokeWidth="1" />
        <text x="72" y="128" fontSize="9" fontWeight="600" fill="#fe5e5e"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          PUB/SUB
        </text>
        <text x="72" y="143" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          WebSocket delivery
        </text>

        {/* State reads */}
        <rect x="12" y="163" width="121" height="44" rx="5" fill="url(#pgout-grad-table)" stroke="#444" strokeWidth="1" />
        <text x="72" y="183" fontSize="9" fontWeight="600" fill="#aaa"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          State Reads
        </text>
        <text x="72" y="198" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          ReadState / ReadStream
        </text>

        {/* TTL worker */}
        <rect x="12" y="218" width="121" height="40" rx="5" fill="url(#pgout-grad-table)" stroke="#444" strokeWidth="1" />
        <text x="72" y="238" fontSize="9" fontWeight="600" fill="#aaa"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          TTL / Cleanup
        </text>
        <text x="72" y="250" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Expires keys, trims stream
        </text>
      </g>

      {/* ===== Arrow: Centrifugo → Clients ===== */}
      <line x1="655" y1="130" x2="679" y2="130" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#pgout-arrow)" />

      {/* ===== CLIENTS ===== */}
      <g transform="translate(685, 20)">
        <rect width="115" height="270" rx="10" fill="url(#pgout-grad-table)" stroke="#888" strokeWidth="1" />
        <text x="57" y="24" fontSize="11" fontWeight="bold" fill="#ccc"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          CLIENTS
        </text>

        {/* Client icons */}
        <g transform="translate(57, 70)">
          <rect x="-40" y="-15" width="80" height="30" rx="4" fill="url(#pgout-grad-app)" stroke="#5b8def" strokeWidth="1" />
          <text x="0" y="4" fontSize="9" fill="#5b8def"
            textAnchor="middle" fontFamily="system-ui, sans-serif">
            sync event
          </text>
        </g>

        <g transform="translate(57, 115)">
          <rect x="-40" y="-15" width="80" height="30" rx="4" fill="url(#pgout-grad-centrifugo)" stroke="#fe5e5e" strokeWidth="1" />
          <text x="0" y="4" fontSize="9" fill="#fe5e5e"
            textAnchor="middle" fontFamily="system-ui, sans-serif">
            update event
          </text>
        </g>

        <text x="57" y="170" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          SDK manages
        </text>
        <text x="57" y="182" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          state, stream,
        </text>
        <text x="57" y="194" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          and live phases
        </text>
        <text x="57" y="206" fontSize="8" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          transparently.
        </text>
      </g>

    </svg>
  );
}
