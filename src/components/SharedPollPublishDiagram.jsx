import React from 'react';

export default function SharedPollPublishDiagram() {
  return (
    <svg
      viewBox="0 0 820 430"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#17171b' }}
    >
      <defs>
        <marker id="spp-arrow-blue" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#5b8def" />
        </marker>
        <marker id="spp-arrow-red" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#fe5e5e" />
        </marker>
        <marker id="spp-arrow-green" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#5bef7b" />
        </marker>
        <marker id="spp-arrow-amber" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#f0b060" />
        </marker>

        <linearGradient id="spp-grad-client" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2430" />
          <stop offset="100%" stopColor="#161a22" />
        </linearGradient>
        <linearGradient id="spp-grad-centrifugo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2020" />
          <stop offset="100%" stopColor="#1f1515" />
        </linearGradient>
        <linearGradient id="spp-grad-backend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2a20" />
          <stop offset="100%" stopColor="#161e16" />
        </linearGradient>
        <linearGradient id="spp-grad-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#222830" />
          <stop offset="100%" stopColor="#1a1e24" />
        </linearGradient>

        <filter id="spp-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5b8def" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="spp-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#fe5e5e" floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="spp-glow-green" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5bef7b" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="spp-glow-amber" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#f0b060" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        <pattern id="spp-hatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="12" stroke="#222224" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* ===== BACKGROUND ===== */}
      <rect x="15" y="10" width="790" height="410" rx="12"
        fill="none" stroke="#444" strokeWidth="1" strokeDasharray="8,4" />
      <rect x="15" y="10" width="790" height="410" rx="12"
        fill="url(#spp-hatch)" opacity="0.2" />

      {/* ===== YOUR BACKEND (left) ===== */}
      <g transform="translate(35, 28)" filter="url(#spp-glow-green)">
        <rect width="175" height="270" rx="10" fill="url(#spp-grad-backend)" stroke="#5bef7b" strokeWidth="1.5" />

        <text x="88" y="26" fontSize="14" fontWeight="bold" fill="#5bef7b"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">YOUR BACKEND</text>

        {/* Step 1: DB write */}
        <rect x="12" y="40" width="151" height="48" rx="6" fill="url(#spp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="88" y="58" fontSize="10" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Step 1</text>
        <text x="88" y="78" fontSize="12" fontWeight="600" fill="#5bef7b"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Update database</text>

        {/* Step 2: API call */}
        <rect x="12" y="98" width="151" height="48" rx="6" fill="url(#spp-grad-inner)" stroke="#5bef7b" strokeWidth="1" strokeDasharray="4,3" />
        <text x="88" y="116" fontSize="10" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Step 2</text>
        <text x="88" y="137" fontSize="11" fontWeight="600" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">shared_poll_publish</text>

        {/* Payload */}
        <rect x="12" y="156" width="151" height="98" rx="6" fill="url(#spp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="88" y="176" fontSize="10" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Payload</text>
        <text x="88" y="194" fontSize="10" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">channel: post_votes</text>
        <text x="88" y="210" fontSize="10" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">key: post_123</text>
        <text x="88" y="226" fontSize="10" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">version: 7</text>
        <text x="88" y="246" fontSize="10" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">{'data: {votes: 43}'}</text>
      </g>

      {/* ===== ARROW: Backend → Centrifugo ===== */}
      <line x1="210" y1="155" x2="298" y2="155"
        stroke="#5bef7b" strokeWidth="1.5" markerEnd="url(#spp-arrow-green)" />
      <text x="254" y="146" fontSize="10" fill="#888"
        textAnchor="middle" fontFamily="system-ui, sans-serif">API call</text>

      {/* ===== CENTRIFUGO (center) ===== */}
      <g transform="translate(303, 28)" filter="url(#spp-glow-red)">
        <rect width="215" height="270" rx="10" fill="url(#spp-grad-centrifugo)" stroke="#fe5e5e" strokeWidth="1.5" />

        <text x="108" y="26" fontSize="14" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">CENTRIFUGO</text>

        {/* Receive & validate */}
        <rect x="12" y="40" width="191" height="44" rx="6" fill="url(#spp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="108" y="58" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Receive publish</text>
        <text x="108" y="76" fontSize="10" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">{'Compare version (7 > 6 ✓)'}</text>

        {/* Broker distribution */}
        <rect x="12" y="94" width="191" height="44" rx="6" fill="url(#spp-grad-inner)" stroke="#fe5e5e" strokeWidth="1" strokeDasharray="4,3" />
        <text x="108" y="112" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Distribute via Broker PUB/SUB</text>
        <text x="108" y="130" fontSize="10" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">when publish_enabled: true</text>

        {/* Mark fresh */}
        <rect x="12" y="148" width="191" height="34" rx="6" fill="url(#spp-grad-inner)" stroke="#f0b060" strokeWidth="1" />
        <text x="108" y="170" fontSize="11" fontWeight="600" fill="#f0b060"
          textAnchor="middle" fontFamily="system-ui, sans-serif">{'Mark key "fresh"'}</text>

        {/* Fan-out */}
        <rect x="12" y="192" width="191" height="34" rx="6" fill="url(#spp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="108" y="214" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Fan out to tracking clients</text>

        {/* Key insight */}
        <text x="108" y="252" fontSize="11" fontWeight="bold" fill="#f0b060"
          textAnchor="middle" fontFamily="system-ui, sans-serif">{'Next poll → key skipped'}</text>
        <text x="108" y="267" fontSize="10" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">0 redundant backend calls</text>
      </g>

      {/* ===== ARROWS: Centrifugo → Clients ===== */}
      {/* To Client A (curves up) */}
      <line x1="518" y1="105" x2="618" y2="60"
        stroke="#5b8def" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#spp-arrow-blue)" />
      {/* To Client B (straight) */}
      <line x1="518" y1="155" x2="618" y2="155"
        stroke="#5b8def" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#spp-arrow-blue)" />
      {/* To Client C (curves down, dimmed — no update) */}
      <line x1="518" y1="210" x2="618" y2="257"
        stroke="#444" strokeWidth="1.2" strokeDasharray="5,3" />

      <text x="572" y="100" fontSize="10" fontWeight="600" fill="#5b8def"
        textAnchor="middle" fontFamily="system-ui, sans-serif" transform="rotate(-16, 572, 100)">instant</text>
      <text x="572" y="147" fontSize="10" fontWeight="600" fill="#5b8def"
        textAnchor="middle" fontFamily="system-ui, sans-serif">instant</text>
      <text x="582" y="250" fontSize="9" fill="#555"
        textAnchor="middle" fontFamily="system-ui, sans-serif">different key</text>

      {/* ===== CLIENTS (right column) ===== */}

      {/* Client A — receives update */}
      <g transform="translate(623, 30)" filter="url(#spp-glow-blue)">
        <rect width="160" height="66" rx="8" fill="url(#spp-grad-client)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="80" y="20" fontSize="13" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Client A</text>
        <text x="80" y="37" fontSize="10" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">tracking:</text>
        <text x="80" y="56" fontSize="11" fontWeight="600" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">{'post_123 → v7 ✓'}</text>
      </g>

      {/* Client B — receives update */}
      <g transform="translate(623, 125)" filter="url(#spp-glow-blue)">
        <rect width="160" height="66" rx="8" fill="url(#spp-grad-client)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="80" y="20" fontSize="13" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Client B</text>
        <text x="80" y="37" fontSize="10" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">tracking:</text>
        <text x="80" y="56" fontSize="11" fontWeight="600" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">{'post_123 → v7 ✓'}</text>
      </g>

      {/* Client C — different key, no update */}
      <g transform="translate(623, 227)">
        <rect width="160" height="66" rx="8" fill="url(#spp-grad-client)" stroke="#5b8def" strokeWidth="1.5" opacity="0.4" />
        <text x="80" y="20" fontSize="13" fontWeight="bold" fill="#5b8def" opacity="0.5"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Client C</text>
        <text x="80" y="37" fontSize="10" fill="#888" opacity="0.5"
          textAnchor="middle" fontFamily="system-ui, sans-serif">tracking:</text>
        <text x="80" y="56" fontSize="11" fontWeight="600" fill="#666"
          textAnchor="middle" fontFamily="monospace">post_456</text>
      </g>

      {/* ===== BOTTOM INSIGHT BAR ===== */}
      <g transform="translate(35, 320)">
        <rect width="750" height="88" rx="8" fill="url(#spp-grad-centrifugo)" stroke="#444" strokeWidth="1" />
        <text x="375" y="23" fontSize="13" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Polling only: updates arrive within <tspan fill="#fe5e5e" fontWeight="bold">refresh_interval</tspan>
        </text>
        <text x="375" y="46" fontSize="13" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Direct publish: data delivered <tspan fill="#5bef7b" fontWeight="bold">instantly</tspan>, next poll skips the key
        </text>
        <text x="375" y="72" fontSize="11" fill="#555"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Polling continues as safety net — if a publish is missed, the next cycle catches up
        </text>
      </g>
    </svg>
  );
}
