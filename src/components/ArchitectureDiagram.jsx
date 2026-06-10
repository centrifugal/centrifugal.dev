import React from 'react';

export default function ArchitectureDiagram() {
  return (
    <svg
      className="cf-arch"
      viewBox="0 0 800 700"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px' }}
    >
      <style>{`
        .cf-arch text {
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
        }
        /* Marching dashes — data flowing along a path */
        .cf-arch .cf-flow-red {
          stroke-dasharray: 7 5;
          animation: cf-dash12 1.1s linear infinite;
        }
        .cf-arch .cf-flow-blue {
          stroke-dasharray: 3 5;
          animation: cf-dash8 1.4s linear infinite;
        }
        .cf-arch .cf-ants {
          stroke-dasharray: 7 5;
          animation: cf-dash12 3s linear infinite;
        }
        @keyframes cf-dash12 { to { stroke-dashoffset: -12; } }
        @keyframes cf-dash8 { to { stroke-dashoffset: -8; } }
        /* Glowing particles travelling along the arrows */
        .cf-arch .cf-pt {
          fill: #ffc9c9;
          filter: drop-shadow(0 0 4px rgba(254, 94, 94, 0.95));
          opacity: 0;
        }
        .cf-arch .cf-pt-down { animation: cf-fall56 2.4s linear infinite; }
        .cf-arch .cf-pt-up { animation: cf-rise56 2.4s linear infinite; }
        .cf-arch .cf-pt-tr { animation: cf-fall72 2.8s linear infinite; }
        @keyframes cf-fall56 {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateY(56px); opacity: 0; }
        }
        @keyframes cf-rise56 {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateY(-56px); opacity: 0; }
        }
        @keyframes cf-fall72 {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(72px); opacity: 0; }
        }
        /* Breathing halo behind Centrifugo nodes */
        .cf-arch .cf-halo {
          opacity: 0.16;
          animation: cf-pulse 3.6s ease-in-out infinite;
        }
        @keyframes cf-pulse {
          0%, 100% { opacity: 0.14; }
          50% { opacity: 0.5; }
        }
        /* Status LEDs and blinking accents */
        .cf-arch .cf-led { animation: cf-blink 2.4s ease-in-out infinite; }
        @keyframes cf-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        /* Ambient color fields slowly breathing */
        .cf-arch .cf-blob { animation: cf-breathe 8s ease-in-out infinite; }
        @keyframes cf-breathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cf-arch * { animation: none !important; }
          .cf-arch .cf-pt { display: none; }
        }
      `}</style>

      <defs>
        {/* Scene background */}
        <radialGradient id="cf-bg" cx="50%" cy="22%" r="90%">
          <stop offset="0%" stopColor="#212129" />
          <stop offset="55%" stopColor="#16161c" />
          <stop offset="100%" stopColor="#0f0f13" />
        </radialGradient>
        <radialGradient id="cf-blob-red" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fe5e5e" stopOpacity="0.11" />
          <stop offset="100%" stopColor="#fe5e5e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cf-blob-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5b8def" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#5b8def" stopOpacity="0" />
        </radialGradient>

        {/* Glass surfaces */}
        <linearGradient id="cf-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="cf-glass-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.07" />
        </linearGradient>

        {/* Centrifugo node surfaces */}
        <linearGradient id="cf-node-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d2126" />
          <stop offset="100%" stopColor="#211318" />
        </linearGradient>
        <linearGradient id="cf-node-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9b9b" />
          <stop offset="50%" stopColor="#fe5e5e" />
          <stop offset="100%" stopColor="#a83838" />
        </linearGradient>

        {/* Broker surfaces */}
        <linearGradient id="cf-broker-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2837" />
          <stop offset="100%" stopColor="#131a25" />
        </linearGradient>
        <linearGradient id="cf-broker-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fb3ff" />
          <stop offset="100%" stopColor="#3d63b8" />
        </linearGradient>

        {/* Transport lines intensify toward the clients */}
        <linearGradient id="cf-grad-transport" gradientUnits="userSpaceOnUse" x1="0" y1="510" x2="0" y2="590">
          <stop offset="0%" stopColor="#fe5e5e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fe5e5e" stopOpacity="0.85" />
        </linearGradient>

        {/* Arrowheads */}
        <marker id="cf-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 9 3, 0 6, 2.2 3" fill="#fe5e5e" />
        </marker>

        {/* Filters */}
        <filter id="cf-shadow" x="-30%" y="-30%" width="160%" height="190%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.45" />
        </filter>
        <filter id="cf-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ===== SCENE BACKGROUND ===== */}
      <rect x="0" y="0" width="800" height="700" fill="url(#cf-bg)" />
      <ellipse className="cf-blob" cx="400" cy="265" rx="340" ry="135" fill="url(#cf-blob-red)" />
      <ellipse className="cf-blob" cx="400" cy="400" rx="290" ry="105" fill="url(#cf-blob-blue)" style={{ animationDelay: '4s' }} />
      <rect x="0.5" y="0.5" width="799" height="699" rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.06" />

      {/* ===== BACKEND INFRASTRUCTURE BOUNDARY ===== */}
      <rect x="20" y="20" width="760" height="490" rx="14"
        fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" strokeDasharray="8,5" />

      {/* Infra label */}
      <g transform="translate(400, 20)">
        <rect x="-158" y="-12" width="316" height="24" rx="12" fill="#14141a" stroke="#ffffff" strokeOpacity="0.14" />
        <text x="0" y="4" fontSize="11" fontWeight="bold" fill="#9a9aa4"
          textAnchor="middle" letterSpacing="2px">
          YOUR BACKEND INFRASTRUCTURE
        </text>
      </g>

      {/* ===== BACKEND APP ===== */}
      <g transform="translate(80, 52)">
        <g className="cf-card">
          <rect width="640" height="72" rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <line x1="11" y1="1.2" x2="629" y2="1.2" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
          <text x="34" y="46" fontSize="20" fill="#ffffff" fillOpacity="0.1" fontFamily="monospace">{'</>'}</text>
          <text x="320" y="30" fontSize="17" fontWeight="bold" fill="#f2f2f5"
            textAnchor="middle" letterSpacing="2.5px">
            YOUR BACKEND APPLICATION
          </text>
          <text x="320" y="52" fontSize="12" fill="#8d8d97" textAnchor="middle">
            Any language, any framework, any architecture
          </text>
        </g>
      </g>

      {/* ===== API ARROWS ===== */}
      {/* Down arrow - Publish */}
      <line className="cf-flow-red" x1="360" y1="124" x2="360" y2="190" stroke="#fe5e5e" strokeWidth="1.6" markerEnd="url(#cf-arrow)" />
      {/* Up arrow - Proxy */}
      <line className="cf-flow-red" x1="440" y1="190" x2="440" y2="124" stroke="#fe5e5e" strokeWidth="1.6" markerEnd="url(#cf-arrow)" />

      {/* Particles on API arrows */}
      <circle className="cf-pt cf-pt-down" cx="360" cy="128" r="2.4" />
      <circle className="cf-pt cf-pt-down" cx="360" cy="128" r="2.4" style={{ animationDelay: '1.2s' }} />
      <circle className="cf-pt cf-pt-up" cx="440" cy="186" r="2.4" style={{ animationDelay: '0.6s' }} />
      <circle className="cf-pt cf-pt-up" cx="440" cy="186" r="2.4" style={{ animationDelay: '1.8s' }} />

      {/* API labels */}
      <text x="345" y="155" fontSize="10" fontWeight="bold" fill="#ff8a8a" textAnchor="end" letterSpacing="1px">
        SERVER API
      </text>
      <text x="345" y="167" fontSize="9" textAnchor="end">
        <tspan fill="#ff8a8a">publish</tspan><tspan fill="#c08a8a">, presence, history, etc.</tspan>
      </text>
      <text x="345" y="179" fontSize="9" fill="#c08a8a" textAnchor="end">
        HTTP / GRPC
      </text>
      <text x="455" y="155" fontSize="10" fontWeight="bold" fill="#ff8a8a" textAnchor="start" letterSpacing="1px">
        PROXY EVENTS
      </text>
      <text x="455" y="167" fontSize="9" fill="#c08a8a" textAnchor="start">
        connect, subscribe, publish, RPC, etc.
      </text>
      <text x="455" y="179" fontSize="9" fill="#c08a8a" textAnchor="start">
        HTTP / GRPC
      </text>

      {/* ===== CENTRIFUGO CLUSTER ===== */}
      <rect className="cf-ants" x="60" y="205" width="680" height="280" rx="12"
        fill="rgba(254,94,94,0.035)" stroke="#fe5e5e" strokeOpacity="0.55" strokeWidth="1.5" />

      {/* Cluster label */}
      <g transform="translate(400, 205)">
        <rect x="-115" y="-12" width="230" height="24" rx="12" fill="#1c1216" stroke="#fe5e5e" strokeOpacity="0.45" />
        <circle className="cf-led" cx="-96" cy="0" r="3" fill="#fe5e5e" />
        <text x="6" y="4" fontSize="11" fontWeight="bold" fill="#ff7d7d"
          textAnchor="middle" letterSpacing="2px">
          CENTRIFUGO CLUSTER
        </text>
      </g>

      {/* Centrifugo Nodes */}
      <g transform="translate(100, 235)">
        <g className="cf-card">
          <rect className="cf-halo" x="-2" y="-2" width="164" height="64" rx="10" fill="none" stroke="#fe5e5e" strokeWidth="4" filter="url(#cf-blur)" />
          <rect width="160" height="60" rx="8" fill="url(#cf-node-fill)" stroke="url(#cf-node-stroke)" strokeWidth="1.2" filter="url(#cf-shadow)" />
          <line x1="9" y1="1.4" x2="151" y2="1.4" stroke="#ffb1b1" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="30" cy="30" r="17" fill="#ffffff" fillOpacity="0.92" />
          <image href="/img/logo.svg" x="17" y="17" width="26" height="26" />
          <text x="98" y="27" fontSize="14" fontWeight="bold" fill="#ffffff" textAnchor="middle">
            Centrifugo
          </text>
          <text x="98" y="46" fontSize="11" fill="#ff9a9a" textAnchor="middle">
            Node 1
          </text>
          <circle cx="147" cy="13" r="6" fill="#5bef7b" opacity="0.15" />
          <circle className="cf-led" cx="147" cy="13" r="2.6" fill="#5bef7b" />
        </g>
      </g>

      <g transform="translate(320, 235)">
        <g className="cf-card">
          <rect className="cf-halo" x="-2" y="-2" width="164" height="64" rx="10" fill="none" stroke="#fe5e5e" strokeWidth="4" filter="url(#cf-blur)" style={{ animationDelay: '1.2s' }} />
          <rect width="160" height="60" rx="8" fill="url(#cf-node-fill)" stroke="url(#cf-node-stroke)" strokeWidth="1.2" filter="url(#cf-shadow)" />
          <line x1="9" y1="1.4" x2="151" y2="1.4" stroke="#ffb1b1" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="30" cy="30" r="17" fill="#ffffff" fillOpacity="0.92" />
          <image href="/img/logo.svg" x="17" y="17" width="26" height="26" />
          <text x="98" y="27" fontSize="14" fontWeight="bold" fill="#ffffff" textAnchor="middle">
            Centrifugo
          </text>
          <text x="98" y="46" fontSize="11" fill="#ff9a9a" textAnchor="middle">
            Node 2
          </text>
          <circle cx="147" cy="13" r="6" fill="#5bef7b" opacity="0.15" />
          <circle className="cf-led" cx="147" cy="13" r="2.6" fill="#5bef7b" style={{ animationDelay: '0.8s' }} />
        </g>
      </g>

      {/* Ellipsis dots */}
      <g transform="translate(500, 265)">
        <circle className="cf-led" cx="0" cy="0" r="2.5" fill="#fe5e5e" opacity="0.6" />
        <circle className="cf-led" cx="14" cy="0" r="2.5" fill="#fe5e5e" opacity="0.6" style={{ animationDelay: '0.4s' }} />
        <circle className="cf-led" cx="28" cy="0" r="2.5" fill="#fe5e5e" opacity="0.6" style={{ animationDelay: '0.8s' }} />
      </g>

      <g transform="translate(550, 235)">
        <g className="cf-card">
          <rect className="cf-halo" x="-2" y="-2" width="164" height="64" rx="10" fill="none" stroke="#fe5e5e" strokeWidth="4" filter="url(#cf-blur)" style={{ animationDelay: '2.4s' }} />
          <rect width="160" height="60" rx="8" fill="url(#cf-node-fill)" stroke="url(#cf-node-stroke)" strokeWidth="1.2" filter="url(#cf-shadow)" />
          <line x1="9" y1="1.4" x2="151" y2="1.4" stroke="#ffb1b1" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="30" cy="30" r="17" fill="#ffffff" fillOpacity="0.92" />
          <image href="/img/logo.svg" x="17" y="17" width="26" height="26" />
          <text x="98" y="27" fontSize="14" fontWeight="bold" fill="#ffffff" textAnchor="middle">
            Centrifugo
          </text>
          <text x="98" y="46" fontSize="11" fill="#ff9a9a" textAnchor="middle">
            Node N
          </text>
          <circle cx="147" cy="13" r="6" fill="#5bef7b" opacity="0.15" />
          <circle className="cf-led" cx="147" cy="13" r="2.6" fill="#5bef7b" style={{ animationDelay: '1.6s' }} />
        </g>
      </g>

      {/* Lines from nodes down to broker */}
      <line className="cf-flow-blue" x1="180" y1="295" x2="180" y2="340" stroke="#5b8def" strokeOpacity="0.55" strokeWidth="1.2" />
      <line className="cf-flow-blue" x1="400" y1="295" x2="400" y2="340" stroke="#5b8def" strokeOpacity="0.55" strokeWidth="1.2" />
      <line className="cf-flow-blue" x1="630" y1="295" x2="630" y2="340" stroke="#5b8def" strokeOpacity="0.55" strokeWidth="1.2" />

      {/* ===== BROKER / ENGINE CLUSTER (inner) ===== */}
      <rect x="100" y="340" width="600" height="120" rx="10"
        fill="rgba(91,141,239,0.04)" stroke="#5b8def" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="5,4" />

      {/* Broker label */}
      <g transform="translate(400, 340)">
        <rect x="-140" y="-11" width="280" height="22" rx="11" fill="#131722" stroke="#5b8def" strokeOpacity="0.35" />
        <text x="0" y="4" fontSize="10" fontWeight="bold" fill="#7da6ff"
          textAnchor="middle" letterSpacing="1.5px">
          BROKER: REDIS / REDIS CLUSTER / NATS
        </text>
      </g>

      {/* Broker shards */}
      <g transform="translate(170, 370)">
        <g className="cf-card">
          <rect width="120" height="48" rx="7" fill="url(#cf-broker-fill)" stroke="url(#cf-broker-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <line x1="8" y1="1.2" x2="112" y2="1.2" stroke="#bcd2ff" strokeOpacity="0.3" strokeWidth="0.8" />
          <text x="60" y="22" fontSize="12" fontWeight="600" fill="#ffffff" textAnchor="middle">
            Shard 1
          </text>
          <text x="60" y="38" fontSize="9" fill="#8fb3ff" textAnchor="middle" letterSpacing="1px">
            PUB/SUB
          </text>
        </g>
      </g>

      <g transform="translate(340, 370)">
        <g className="cf-card">
          <rect width="120" height="48" rx="7" fill="url(#cf-broker-fill)" stroke="url(#cf-broker-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <line x1="8" y1="1.2" x2="112" y2="1.2" stroke="#bcd2ff" strokeOpacity="0.3" strokeWidth="0.8" />
          <text x="60" y="22" fontSize="12" fontWeight="600" fill="#ffffff" textAnchor="middle">
            Shard 2
          </text>
          <text x="60" y="38" fontSize="9" fill="#8fb3ff" textAnchor="middle" letterSpacing="1px">
            PUB/SUB
          </text>
        </g>
      </g>

      {/* Ellipsis dots */}
      <g transform="translate(482, 394)">
        <circle className="cf-led" cx="0" cy="0" r="2" fill="#5b8def" opacity="0.7" />
        <circle className="cf-led" cx="12" cy="0" r="2" fill="#5b8def" opacity="0.7" style={{ animationDelay: '0.4s' }} />
        <circle className="cf-led" cx="24" cy="0" r="2" fill="#5b8def" opacity="0.7" style={{ animationDelay: '0.8s' }} />
      </g>

      <g transform="translate(524, 370)">
        <g className="cf-card">
          <rect width="120" height="48" rx="7" fill="url(#cf-broker-fill)" stroke="url(#cf-broker-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <line x1="8" y1="1.2" x2="112" y2="1.2" stroke="#bcd2ff" strokeOpacity="0.3" strokeWidth="0.8" />
          <text x="60" y="22" fontSize="12" fontWeight="600" fill="#ffffff" textAnchor="middle">
            Shard N
          </text>
          <text x="60" y="38" fontSize="9" fill="#8fb3ff" textAnchor="middle" letterSpacing="1px">
            PUB/SUB
          </text>
        </g>
      </g>

      {/* ===== TRANSPORT LINES FROM CENTRIFUGO OUT ===== */}
      {/* Arrows: y=510 to y=590, midpoint=550 — transport label centered there */}
      <line className="cf-flow-red" x1="200" y1="510" x2="200" y2="590" stroke="url(#cf-grad-transport)" strokeWidth="1.6" markerEnd="url(#cf-arrow)" />
      <line className="cf-flow-red" x1="400" y1="510" x2="400" y2="590" stroke="url(#cf-grad-transport)" strokeWidth="1.6" markerEnd="url(#cf-arrow)" />
      <line className="cf-flow-red" x1="600" y1="510" x2="600" y2="590" stroke="url(#cf-grad-transport)" strokeWidth="1.6" markerEnd="url(#cf-arrow)" />

      {/* Particles on transport lines */}
      <circle className="cf-pt cf-pt-tr" cx="200" cy="512" r="2.4" />
      <circle className="cf-pt cf-pt-tr" cx="200" cy="512" r="2.4" style={{ animationDelay: '1.4s' }} />
      <circle className="cf-pt cf-pt-tr" cx="400" cy="512" r="2.4" style={{ animationDelay: '0.5s' }} />
      <circle className="cf-pt cf-pt-tr" cx="400" cy="512" r="2.4" style={{ animationDelay: '1.9s' }} />
      <circle className="cf-pt cf-pt-tr" cx="600" cy="512" r="2.4" style={{ animationDelay: '0.9s' }} />
      <circle className="cf-pt cf-pt-tr" cx="600" cy="512" r="2.4" style={{ animationDelay: '2.3s' }} />

      {/* Transport label — centered vertically on arrows */}
      <g transform="translate(400, 547)">
        <rect x="-215" y="-14" width="430" height="38" rx="19" fill="#16161c" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
        <rect x="-215" y="-14" width="430" height="38" rx="19" fill="url(#cf-glass)" />
        <text y="1" fontSize="12" fill="#ffffff" textAnchor="middle" fontWeight="600">
          <tspan fill="#ff8585">WebSocket</tspan>
          <tspan fill="#55555e"> / </tspan>
          <tspan fill="#c0c0c8">SSE</tspan>
          <tspan fill="#55555e"> / </tspan>
          <tspan fill="#c0c0c8">HTTP-Streaming</tspan>
          <tspan fill="#55555e"> / </tspan>
          <tspan fill="#c0c0c8">WebTransport</tspan>
        </text>
        <text y="17" fontSize="9" fill="#74747e" textAnchor="middle" letterSpacing="0.5px">
          JSON and Protobuf
        </text>
      </g>

      {/* ===== CLIENTS (outside infra) ===== */}

      {/* Browser */}
      <g transform="translate(80, 605)">
        <g className="cf-card">
          <rect width="200" height="80" rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <line x1="10" y1="1.2" x2="190" y2="1.2" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
          {/* Browser icon */}
          <g transform="translate(15, 22)">
            <rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke="#b8b8c2" strokeWidth="1.2" />
            <line x1="0" y1="6" x2="24" y2="6" stroke="#b8b8c2" strokeWidth="0.8" />
            <circle cx="4" cy="3" r="1.2" fill="#fe5e5e" />
            <circle cx="8.5" cy="3" r="1.2" fill="#f5c542" />
            <circle cx="13" cy="3" r="1.2" fill="#5bef7b" />
          </g>
          <text x="55" y="36" fontSize="15" fontWeight="600" fill="#f2f2f5" textAnchor="start">
            Browser
          </text>
          <text x="100" y="58" fontSize="10" fill="#8d8d97" textAnchor="middle">
            JavaScript / Dart
          </text>
        </g>
      </g>

      {/* Mobile */}
      <g transform="translate(300, 605)">
        <g className="cf-card">
          <rect width="200" height="80" rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <line x1="10" y1="1.2" x2="190" y2="1.2" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
          {/* Mobile icon */}
          <g transform="translate(18, 18)">
            <rect x="0" y="0" width="15" height="26" rx="2.5" fill="none" stroke="#b8b8c2" strokeWidth="1.2" />
            <line x1="4" y1="22" x2="11" y2="22" stroke="#b8b8c2" strokeWidth="0.8" />
            <rect x="2" y="3" width="11" height="16" rx="0.5" fill="none" stroke="#6a6a74" strokeWidth="0.5" />
          </g>
          <text x="50" y="36" fontSize="15" fontWeight="600" fill="#f2f2f5" textAnchor="start">
            Mobile
          </text>
          <text x="100" y="58" fontSize="10" fill="#8d8d97" textAnchor="middle">
            Swift / Java / Dart / C#
          </text>
        </g>
      </g>

      {/* Backend */}
      <g transform="translate(520, 605)">
        <g className="cf-card">
          <rect width="200" height="80" rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <line x1="10" y1="1.2" x2="190" y2="1.2" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
          {/* Terminal/server icon */}
          <g transform="translate(15, 20)">
            <rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke="#b8b8c2" strokeWidth="1.2" />
            <text x="4" y="13" fontSize="9" fill="#5bef7b" fontFamily="monospace">{'>'}</text>
            <rect className="cf-led" x="11" y="10.5" width="5" height="1.6" fill="#5bef7b" />
          </g>
          <text x="55" y="36" fontSize="15" fontWeight="600" fill="#f2f2f5" textAnchor="start">
            Backend
          </text>
          <text x="100" y="58" fontSize="10" fill="#8d8d97" textAnchor="middle">
            Go / Python
          </text>
        </g>
      </g>

    </svg>
  );
}
