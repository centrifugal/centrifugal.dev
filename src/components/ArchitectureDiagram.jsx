import React from 'react';

export default function ArchitectureDiagram() {
  return (
    <svg
      viewBox="0 0 800 700"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#17171b' }}
    >
      <defs>
        {/* Arrow markers */}
        <marker id="cf-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#fe5e5e" />
        </marker>
        <marker id="cf-arrow-muted" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
        </marker>

        {/* Gradients */}
        <linearGradient id="cf-grad-backend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2e" />
          <stop offset="100%" stopColor="#1e1e21" />
        </linearGradient>
        <linearGradient id="cf-grad-node" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2020" />
          <stop offset="100%" stopColor="#1f1515" />
        </linearGradient>
        <linearGradient id="cf-grad-broker" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2430" />
          <stop offset="100%" stopColor="#161a22" />
        </linearGradient>
        <linearGradient id="cf-grad-client" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#242428" />
          <stop offset="100%" stopColor="#1c1c1f" />
        </linearGradient>

        {/* Glow filters */}
        <filter id="cf-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#fe5e5e" floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cf-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5b8def" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Diagonal hatch for infra */}
        <pattern id="cf-hatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="12" stroke="#222224" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* ===== BACKEND INFRASTRUCTURE BOUNDARY ===== */}
      <rect x="20" y="20" width="760" height="490" rx="12"
        fill="none" stroke="#444" strokeWidth="1.5" strokeDasharray="8,4" />
      <rect x="20" y="20" width="760" height="490" rx="12"
        fill="url(#cf-hatch)" opacity="0.3" />

      {/* Infra label */}
      <g transform="translate(400, 20)">
        <rect x="-155" y="-11" width="310" height="22" rx="4" fill="#17171b" />
        <text x="0" y="5" fontSize="11" fontWeight="bold" fill="#666"
          textAnchor="middle" letterSpacing="1.5px" fontFamily="system-ui, sans-serif">
          YOUR BACKEND INFRASTRUCTURE
        </text>
      </g>

      {/* ===== BACKEND APP ===== */}
      <g transform="translate(80, 52)">
        <rect width="640" height="72" rx="8" fill="url(#cf-grad-backend)" stroke="#555" strokeWidth="1" />
        <text x="320" y="30" fontSize="17" fontWeight="bold" fill="#fff"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          YOUR BACKEND APPLICATION
        </text>
        <text x="320" y="52" fontSize="12" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Any language, any framework, any architecture
        </text>
      </g>

      {/* ===== API ARROWS ===== */}
      {/* Down arrow - Publish */}
      <line x1="360" y1="124" x2="360" y2="190" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#cf-arrow)" />
      {/* Up arrow - Proxy */}
      <line x1="440" y1="190" x2="440" y2="124" stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#cf-arrow)" />

      {/* API labels */}
      <text x="345" y="155" fontSize="10" fill="#fe5e5e" textAnchor="end" fontFamily="system-ui, sans-serif">
        SERVER API
      </text>
      <text x="345" y="167" fontSize="9" textAnchor="end" fontFamily="system-ui, sans-serif">
        <tspan fill="#fe5e5e">publish</tspan><tspan fill="#cc8888">, presence, history, etc.</tspan>
      </text>
      <text x="345" y="179" fontSize="9" fill="#cc8888" textAnchor="end" fontFamily="system-ui, sans-serif">
        HTTP / GRPC
      </text>
      <text x="455" y="155" fontSize="10" fill="#fe5e5e" textAnchor="start" fontFamily="system-ui, sans-serif">
        PROXY EVENTS
      </text>
      <text x="455" y="167" fontSize="9" fill="#cc8888" textAnchor="start" fontFamily="system-ui, sans-serif">
        connect, subscribe, publish, RPC, etc.
      </text>
      <text x="455" y="179" fontSize="9" fill="#cc8888" textAnchor="start" fontFamily="system-ui, sans-serif">
        HTTP / GRPC
      </text>

      {/* ===== CENTRIFUGO CLUSTER ===== */}
      <rect x="60" y="205" width="680" height="280" rx="10"
        fill="rgba(254,94,94,0.03)" stroke="#fe5e5e" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.9" />

      {/* Cluster label */}
      <g transform="translate(400, 205)">
        <rect x="-100" y="-10" width="200" height="20" rx="4" fill="#17171b" />
        <text x="0" y="5" fontSize="11" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          CENTRIFUGO CLUSTER
        </text>
      </g>

      {/* Centrifugo Nodes */}
      <g transform="translate(100, 235)" filter="url(#cf-glow-red)">
        <rect width="160" height="60" rx="6" fill="url(#cf-grad-node)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="80" y="28" fontSize="14" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Centrifugo
        </text>
        <text x="80" y="46" fontSize="11" fill="#fe5e5e" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Node 1
        </text>
      </g>

      <g transform="translate(320, 235)" filter="url(#cf-glow-red)">
        <rect width="160" height="60" rx="6" fill="url(#cf-grad-node)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="80" y="28" fontSize="14" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Centrifugo
        </text>
        <text x="80" y="46" fontSize="11" fill="#fe5e5e" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Node 2
        </text>
      </g>

      {/* Ellipsis dots */}
      <g transform="translate(500, 265)">
        <circle cx="0" cy="0" r="2.5" fill="#fe5e5e" opacity="0.5" />
        <circle cx="14" cy="0" r="2.5" fill="#fe5e5e" opacity="0.5" />
        <circle cx="28" cy="0" r="2.5" fill="#fe5e5e" opacity="0.5" />
      </g>

      <g transform="translate(550, 235)" filter="url(#cf-glow-red)">
        <rect width="160" height="60" rx="6" fill="url(#cf-grad-node)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="80" y="28" fontSize="14" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Centrifugo
        </text>
        <text x="80" y="46" fontSize="11" fill="#fe5e5e" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Node N
        </text>
      </g>

      {/* Lines from nodes down to broker */}
      <line x1="180" y1="295" x2="180" y2="340" stroke="#555" strokeWidth="1" />
      <line x1="400" y1="295" x2="400" y2="340" stroke="#555" strokeWidth="1" />
      <line x1="630" y1="295" x2="630" y2="340" stroke="#555" strokeWidth="1" />

      {/* ===== BROKER / ENGINE CLUSTER (inner) ===== */}
      <rect x="100" y="340" width="600" height="120" rx="8"
        fill="rgba(91,141,239,0.03)" stroke="#5b8def" strokeWidth="1" strokeDasharray="5,3" />

      {/* Broker label */}
      <g transform="translate(400, 340)">
        <rect x="-130" y="-10" width="260" height="20" rx="4" fill="#17171b" />
        <text x="0" y="5" fontSize="10" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          BROKER: REDIS / REDIS CLUSTER / NATS
        </text>
      </g>

      {/* Broker shards */}
      <g transform="translate(170, 370)" filter="url(#cf-glow-blue)">
        <rect width="120" height="48" rx="5" fill="url(#cf-grad-broker)" stroke="#5b8def" strokeWidth="1" />
        <text x="60" y="22" fontSize="12" fontWeight="600" fill="#fff" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Shard 1
        </text>
        <text x="60" y="38" fontSize="9" fill="#5b8def" textAnchor="middle" fontFamily="system-ui, sans-serif">
          PUB/SUB
        </text>
      </g>

      <g transform="translate(340, 370)" filter="url(#cf-glow-blue)">
        <rect width="120" height="48" rx="5" fill="url(#cf-grad-broker)" stroke="#5b8def" strokeWidth="1" />
        <text x="60" y="22" fontSize="12" fontWeight="600" fill="#fff" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Shard 2
        </text>
        <text x="60" y="38" fontSize="9" fill="#5b8def" textAnchor="middle" fontFamily="system-ui, sans-serif">
          PUB/SUB
        </text>
      </g>

      {/* Ellipsis dots */}
      <g transform="translate(482, 394)">
        <circle cx="0" cy="0" r="2" fill="#5b8def" opacity="0.6" />
        <circle cx="12" cy="0" r="2" fill="#5b8def" opacity="0.6" />
        <circle cx="24" cy="0" r="2" fill="#5b8def" opacity="0.6" />
      </g>

      <g transform="translate(524, 370)" filter="url(#cf-glow-blue)">
        <rect width="120" height="48" rx="5" fill="url(#cf-grad-broker)" stroke="#5b8def" strokeWidth="1" />
        <text x="60" y="22" fontSize="12" fontWeight="600" fill="#fff" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Shard N
        </text>
        <text x="60" y="38" fontSize="9" fill="#5b8def" textAnchor="middle" fontFamily="system-ui, sans-serif">
          PUB/SUB
        </text>
      </g>

      {/* ===== TRANSPORT LINES FROM CENTRIFUGO OUT ===== */}
      {/* Arrows: y=510 to y=590, midpoint=550 — transport label centered there */}
      <line x1="200" y1="510" x2="200" y2="590" stroke="#888" strokeWidth="1.5" markerEnd="url(#cf-arrow-muted)" />
      <line x1="400" y1="510" x2="400" y2="590" stroke="#888" strokeWidth="1.5" markerEnd="url(#cf-arrow-muted)" />
      <line x1="600" y1="510" x2="600" y2="590" stroke="#888" strokeWidth="1.5" markerEnd="url(#cf-arrow-muted)" />

      {/* Transport label — centered vertically on arrows */}
      <g transform="translate(400, 547)">
        <rect x="-215" y="-14" width="430" height="38" rx="6" fill="#17171b" stroke="#444" strokeWidth="0.5" />
        <text y="1" fontSize="12" fill="#fff" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="600">
          <tspan fill="#fe5e5e">WebSocket</tspan>
          <tspan fill="#666"> / </tspan>
          <tspan fill="#aaa">SSE</tspan>
          <tspan fill="#666"> / </tspan>
          <tspan fill="#aaa">HTTP-Streaming</tspan>
          <tspan fill="#666"> / </tspan>
          <tspan fill="#aaa">WebTransport</tspan>
        </text>
        <text y="17" fontSize="9" fill="#666" textAnchor="middle" fontFamily="system-ui, sans-serif" letterSpacing="0.5px">
          JSON and Protobuf
        </text>
      </g>

      {/* ===== CLIENTS (outside infra) ===== */}

      {/* Browser */}
      <g transform="translate(80, 605)">
        <rect width="200" height="80" rx="8" fill="url(#cf-grad-client)" stroke="#555" strokeWidth="1" />
        {/* Browser icon */}
        <g transform="translate(15, 22)">
          <rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke="#aaa" strokeWidth="1.2" />
          <line x1="0" y1="6" x2="24" y2="6" stroke="#aaa" strokeWidth="0.8" />
          <circle cx="4" cy="3" r="1.2" fill="#fe5e5e" />
          <circle cx="8.5" cy="3" r="1.2" fill="#f5c542" />
          <circle cx="13" cy="3" r="1.2" fill="#5bef7b" />
        </g>
        <text x="55" y="36" fontSize="15" fontWeight="600" fill="#fff" textAnchor="start" fontFamily="system-ui, sans-serif">
          Browser
        </text>
        <text x="100" y="58" fontSize="10" fill="#888" textAnchor="middle" fontFamily="system-ui, sans-serif">
          JavaScript / Dart
        </text>
      </g>

      {/* Mobile */}
      <g transform="translate(300, 605)">
        <rect width="200" height="80" rx="8" fill="url(#cf-grad-client)" stroke="#555" strokeWidth="1" />
        {/* Mobile icon */}
        <g transform="translate(18, 18)">
          <rect x="0" y="0" width="15" height="26" rx="2.5" fill="none" stroke="#aaa" strokeWidth="1.2" />
          <line x1="4" y1="22" x2="11" y2="22" stroke="#aaa" strokeWidth="0.8" />
          <rect x="2" y="3" width="11" height="16" rx="0.5" fill="none" stroke="#666" strokeWidth="0.5" />
        </g>
        <text x="50" y="36" fontSize="15" fontWeight="600" fill="#fff" textAnchor="start" fontFamily="system-ui, sans-serif">
          Mobile
        </text>
        <text x="100" y="58" fontSize="10" fill="#888" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Swift / Java / Dart / C#
        </text>
      </g>

      {/* Backend */}
      <g transform="translate(520, 605)">
        <rect width="200" height="80" rx="8" fill="url(#cf-grad-client)" stroke="#555" strokeWidth="1" />
        {/* Terminal/server icon */}
        <g transform="translate(15, 20)">
          <rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke="#aaa" strokeWidth="1.2" />
          <text x="4" y="13" fontSize="9" fill="#5bef7b" fontFamily="monospace">{'>'}_</text>
        </g>
        <text x="55" y="36" fontSize="15" fontWeight="600" fill="#fff" textAnchor="start" fontFamily="system-ui, sans-serif">
          Backend
        </text>
        <text x="100" y="58" fontSize="10" fill="#888" textAnchor="middle" fontFamily="system-ui, sans-serif">
          Go / Python
        </text>
      </g>

    </svg>
  );
}
