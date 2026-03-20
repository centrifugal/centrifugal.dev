import React from 'react';

export default function SharedPollDiagram() {
  return (
    <svg
      viewBox="0 0 820 430"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#17171b' }}
    >
      <defs>
        <marker id="sp-arrow-blue" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#5b8def" />
        </marker>
        <marker id="sp-arrow-red" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#fe5e5e" />
        </marker>
        <marker id="sp-arrow-green" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#5bef7b" />
        </marker>

        <linearGradient id="sp-grad-client" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2430" />
          <stop offset="100%" stopColor="#161a22" />
        </linearGradient>
        <linearGradient id="sp-grad-centrifugo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2020" />
          <stop offset="100%" stopColor="#1f1515" />
        </linearGradient>
        <linearGradient id="sp-grad-backend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2a20" />
          <stop offset="100%" stopColor="#161e16" />
        </linearGradient>
        <linearGradient id="sp-grad-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#222830" />
          <stop offset="100%" stopColor="#1a1e24" />
        </linearGradient>

        <filter id="sp-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5b8def" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sp-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#fe5e5e" floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sp-glow-green" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#5bef7b" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        <pattern id="sp-hatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="12" stroke="#222224" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* ===== BACKGROUND ===== */}
      <rect x="15" y="10" width="790" height="410" rx="12"
        fill="none" stroke="#444" strokeWidth="1" strokeDasharray="8,4" />
      <rect x="15" y="10" width="790" height="410" rx="12"
        fill="url(#sp-hatch)" opacity="0.2" />

      {/* ===== CLIENTS (left column) ===== */}

      {/* Client A */}
      <g transform="translate(35, 35)" filter="url(#sp-glow-blue)">
        <rect width="152" height="72" rx="8" fill="url(#sp-grad-client)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="76" y="23" fontSize="13" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Client A</text>
        <text x="76" y="42" fontSize="11" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">tracking:</text>
        <text x="76" y="60" fontSize="11" fontWeight="600" fill="#ccc"
          textAnchor="middle" fontFamily="monospace">post_1, post_2</text>
      </g>

      {/* Client B */}
      <g transform="translate(35, 132)" filter="url(#sp-glow-blue)">
        <rect width="152" height="72" rx="8" fill="url(#sp-grad-client)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="76" y="23" fontSize="13" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Client B</text>
        <text x="76" y="42" fontSize="11" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">tracking:</text>
        <text x="76" y="60" fontSize="11" fontWeight="600" fill="#ccc"
          textAnchor="middle" fontFamily="monospace">post_2, post_3</text>
      </g>

      {/* Client C */}
      <g transform="translate(35, 229)" filter="url(#sp-glow-blue)">
        <rect width="152" height="72" rx="8" fill="url(#sp-grad-client)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="76" y="23" fontSize="13" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Client C</text>
        <text x="76" y="42" fontSize="11" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">tracking:</text>
        <text x="76" y="60" fontSize="11" fontWeight="600" fill="#ccc"
          textAnchor="middle" fontFamily="monospace">post_1, post_5</text>
      </g>

      {/* N clients indicator */}
      <text x="111" y="322" fontSize="16" fill="#555"
        textAnchor="middle" fontFamily="system-ui, sans-serif">{'⋮'}</text>
      <text x="111" y="340" fontSize="11" fill="#555" fontStyle="italic"
        textAnchor="middle" fontFamily="system-ui, sans-serif">N clients</text>

      {/* ===== TRACK ARROWS (clients → centrifugo, blue solid, horizontal) ===== */}
      <line x1="187" y1="57" x2="310" y2="57"
        stroke="#5b8def" strokeWidth="1.5" markerEnd="url(#sp-arrow-blue)" />
      <line x1="187" y1="154" x2="310" y2="154"
        stroke="#5b8def" strokeWidth="1.5" markerEnd="url(#sp-arrow-blue)" />
      <line x1="187" y1="251" x2="310" y2="251"
        stroke="#5b8def" strokeWidth="1.5" markerEnd="url(#sp-arrow-blue)" />
      <text x="248" y="148" fontSize="11" fontWeight="600" fill="#5b8def"
        textAnchor="middle" fontFamily="system-ui, sans-serif">track</text>

      {/* ===== UPDATE ARROWS (centrifugo → clients, green dashed, horizontal) ===== */}
      <line x1="313" y1="85" x2="192" y2="85"
        stroke="#5bef7b" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#sp-arrow-green)" />
      <line x1="313" y1="182" x2="192" y2="182"
        stroke="#5bef7b" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#sp-arrow-green)" />
      <line x1="313" y1="279" x2="192" y2="279"
        stroke="#5bef7b" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#sp-arrow-green)" />
      <text x="248" y="198" fontSize="11" fontWeight="600" fill="#5bef7b"
        textAnchor="middle" fontFamily="system-ui, sans-serif">updates</text>

      {/* ===== CENTRIFUGO (center) ===== */}
      <g transform="translate(315, 25)" filter="url(#sp-glow-red)">
        <rect width="195" height="295" rx="10" fill="url(#sp-grad-centrifugo)" stroke="#fe5e5e" strokeWidth="1.5" />

        <text x="98" y="26" fontSize="14" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">CENTRIFUGO</text>

        {/* Aggregate section */}
        <rect x="12" y="38" width="171" height="72" rx="6" fill="url(#sp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="98" y="58" fontSize="11" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Aggregate tracked keys</text>
        <text x="98" y="80" fontSize="14" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" fontFamily="monospace">{'{ 1, 2, 3, 5 }'}</text>
        <text x="98" y="100" fontSize="10" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">4 unique from 6 tracked</text>

        {/* Poll section */}
        <rect x="12" y="120" width="171" height="38" rx="6" fill="url(#sp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="98" y="144" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Poll backend once per cycle</text>

        {/* Compare section */}
        <rect x="12" y="168" width="171" height="38" rx="6" fill="url(#sp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="98" y="192" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Compare versions per client</text>

        {/* Fan-out section */}
        <rect x="12" y="216" width="171" height="38" rx="6" fill="url(#sp-grad-inner)" stroke="#444" strokeWidth="1" />
        <text x="98" y="240" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Push only changed items</text>

        {/* Key metric */}
        <text x="98" y="278" fontSize="12" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" fontFamily="system-ui, sans-serif">1 request / cycle</text>
      </g>

      {/* ===== POLL ARROW (centrifugo → backend, red) ===== */}
      <line x1="510" y1="164" x2="605" y2="164"
        stroke="#fe5e5e" strokeWidth="1.5" markerEnd="url(#sp-arrow-red)" />
      <text x="560" y="156" fontSize="10" fill="#888"
        textAnchor="middle" fontFamily="system-ui, sans-serif">poll</text>

      {/* ===== RESPONSE ARROW (backend → centrifugo, green) ===== */}
      <line x1="608" y1="212" x2="515" y2="212"
        stroke="#5bef7b" strokeWidth="1.5" markerEnd="url(#sp-arrow-green)" />
      <text x="560" y="230" fontSize="10" fill="#888"
        textAnchor="middle" fontFamily="system-ui, sans-serif">data + versions</text>

      {/* ===== YOUR BACKEND (right) ===== */}
      <g transform="translate(610, 75)" filter="url(#sp-glow-green)">
        <rect width="170" height="220" rx="10" fill="url(#sp-grad-backend)" stroke="#5bef7b" strokeWidth="1.5" />

        <text x="85" y="26" fontSize="14" fontWeight="bold" fill="#5bef7b"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">YOUR BACKEND</text>

        <text x="85" y="56" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Return current data</text>
        <text x="85" y="74" fontSize="11" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">for requested keys</text>

        {/* Sample response data */}
        <rect x="12" y="85" width="146" height="55" rx="6" fill="url(#sp-grad-inner)"
          stroke="#5bef7b" strokeWidth="1" strokeDasharray="4,3" />
        <text x="85" y="105" fontSize="10" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">post_1: v6, data: ...</text>
        <text x="85" y="122" fontSize="10" fill="#5bef7b"
          textAnchor="middle" fontFamily="monospace">post_3: v12, data: ...</text>
        <text x="85" y="136" fontSize="9" fill="#666"
          textAnchor="middle" fontFamily="system-ui, sans-serif">items + versions</text>

        <text x="85" y="168" fontSize="11" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">No publish hooks</text>
        <text x="85" y="186" fontSize="11" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Just a read endpoint</text>
        <text x="85" y="209" fontSize="10" fill="#666" fontStyle="italic"
          textAnchor="middle" fontFamily="system-ui, sans-serif">Called once per cycle</text>
      </g>

      {/* ===== BOTTOM INSIGHT BAR ===== */}
      <g transform="translate(35, 355)">
        <rect width="750" height="52" rx="8" fill="url(#sp-grad-centrifugo)" stroke="#444" strokeWidth="1" />
        <text x="375" y="22" fontSize="13" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Client-side polling: 10,000 clients = <tspan fill="#fe5e5e" fontWeight="bold">10,000 req/s</tspan>
        </text>
        <text x="375" y="42" fontSize="13" fill="#888"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Shared poll: 10,000 clients = <tspan fill="#5bef7b" fontWeight="bold">1 req / cycle</tspan>
        </text>
      </g>
    </svg>
  );
}
