import React from 'react';

// Centrifugo architecture as a small factory floor. One cycle (CYCLE seconds)
// tells the whole story: a client sends an event up the transport chute, the
// proxy forwards it to the backend, the backend publishes a message through the
// server API, the node hands it to the broker, the broker fans it out to every
// node, and the nodes push it down to all connected clients. Every moving part
// is driven by the same clock so the scene stays coherent.

const CYCLE = 6;
const k = (t) => (t / CYCLE).toFixed(4);

const RED = '#fe5e5e';
const BLUE = '#5b8def';

// A message parcel travelling along a straight path between t0 and t1.
function Parcel({ d, t0, t1, color = '#ffb0b0', glow = 'rgba(254,94,94,0.95)' }) {
  const fade = 0.06;
  return (
    <g className="cf-parcel" opacity="0" style={{ filter: `drop-shadow(0 0 4px ${glow})` }}>
      <rect x="-6" y="-4" width="12" height="8" rx="2" fill={color} />
      <rect x="-3.5" y="-2" width="7" height="1.3" rx="0.6" fill="#ffffff" opacity="0.75" />
      <animateMotion
        dur={`${CYCLE}s`} repeatCount="indefinite" path={d}
        calcMode="linear" keyPoints="0;0;1;1" keyTimes={`0;${k(t0)};${k(t1)};1`}
      />
      <animate
        attributeName="opacity" dur={`${CYCLE}s`} repeatCount="indefinite"
        values="0;0;1;1;0;0" keyTimes={`0;${k(t0)};${k(t0 + fade)};${k(t1 - fade)};${k(t1)};1`}
      />
    </g>
  );
}

// Opacity flash at time t: lo -> hi -> back to lo over `hold` seconds.
function Flash({ t, lo, hi, hold = 0.6 }) {
  return (
    <animate
      attributeName="opacity" dur={`${CYCLE}s`} repeatCount="indefinite"
      values={`${lo};${lo};${hi};${lo};${lo}`}
      keyTimes={`0;${k(t - 0.08)};${k(t)};${k(t + hold)};1`}
    />
  );
}

// A conveyor chute: a translucent track with marching dashes and an arrowhead.
function Chute({ x, y1, y2, color, flowClass, arrow }) {
  const top = Math.min(y1, y2);
  const h = Math.abs(y2 - y1);
  return (
    <g>
      <rect x={x - 7} y={top} width="14" height={h} rx="7" fill="#ffffff" fillOpacity="0.035" stroke="#ffffff" strokeOpacity="0.08" />
      <line className={flowClass} x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="1.6" markerEnd={arrow ? `url(#${arrow})` : undefined} />
    </g>
  );
}

function gearPath(r1, r2, teeth) {
  const pts = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    [[r1, a], [r1, a + step * 0.3], [r2, a + step * 0.5], [r2, a + step * 0.8]].forEach(([r, ang]) => {
      pts.push(`${(r * Math.cos(ang)).toFixed(2)},${(r * Math.sin(ang)).toFixed(2)}`);
    });
  }
  return `M${pts.join('L')}Z`;
}
const GEAR = gearPath(9, 6.5, 8);

function Node({ x, y, label, flashAt, spinDelay }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-2" y="-2" width="164" height="64" rx="10" fill="none" stroke={RED} strokeWidth="4" filter="url(#cf-blur)" opacity="0.14">
        <Flash t={flashAt} lo="0.14" hi="0.9" />
      </rect>
      <rect width="160" height="60" rx="8" fill="url(#cf-node-fill)" stroke="url(#cf-node-stroke)" strokeWidth="1.2" filter="url(#cf-shadow)" />
      <line x1="9" y1="1.4" x2="151" y2="1.4" stroke="#ffb1b1" strokeOpacity="0.3" strokeWidth="1" />
      {/* Rotor: the logo spins like a centrifuge drum */}
      <circle cx="30" cy="30" r="18" fill="#ffffff" fillOpacity="0.92" />
      <circle cx="30" cy="30" r="18" fill="none" stroke={RED} strokeOpacity="0.35" strokeWidth="1" />
      <image className="cf-rotor" href="/img/logo.svg" x="17" y="17" width="26" height="26" style={{ animationDelay: spinDelay }} />
      <text x="100" y="27" fontSize="14" fontWeight="bold" fill="#ffffff" textAnchor="middle">Centrifugo</text>
      <text x="100" y="46" fontSize="11" fill="#ff9a9a" textAnchor="middle">{label}</text>
      <circle cx="147" cy="13" r="6" fill="#5bef7b" opacity="0.15" />
      <circle className="cf-led" cx="147" cy="13" r="2.6" fill="#5bef7b" style={{ animationDelay: spinDelay }} />
    </g>
  );
}

function Shard({ x, y, label, flashAt, spinDelay }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-2" y="-2" width="124" height="52" rx="9" fill="none" stroke={BLUE} strokeWidth="4" filter="url(#cf-blur)" opacity="0.1">
        <Flash t={flashAt} lo="0.1" hi="0.7" />
      </rect>
      <rect width="120" height="48" rx="7" fill="url(#cf-broker-fill)" stroke="url(#cf-broker-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
      <line x1="8" y1="1.2" x2="112" y2="1.2" stroke="#bcd2ff" strokeOpacity="0.3" strokeWidth="0.8" />
      <g transform="translate(22, 24)">
        <path className="cf-gear" d={GEAR} fill="#1b2433" stroke="#8fb3ff" strokeWidth="1.1" style={{ animationDelay: spinDelay }} />
        <circle r="2.4" fill="#8fb3ff" />
      </g>
      <text x="72" y="22" fontSize="12" fontWeight="600" fill="#ffffff" textAnchor="middle">{label}</text>
      <text x="72" y="38" fontSize="9" fill="#8fb3ff" textAnchor="middle" letterSpacing="1px">PUB/SUB</text>
    </g>
  );
}

function Client({ x, y, title, subtitle, flashAt, icon }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width="200" height="80" rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
      <line x1="10" y1="1.2" x2="190" y2="1.2" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
      {/* Delivery bay light: lights up when parcels land */}
      <rect x="40" y="-1" width="120" height="3" rx="1.5" fill={RED} opacity="0" filter="url(#cf-blur)">
        <Flash t={flashAt} lo="0" hi="0.9" hold="0.7" />
      </rect>
      <rect x="40" y="-0.5" width="120" height="2" rx="1" fill="#ffb0b0" opacity="0">
        <Flash t={flashAt} lo="0" hi="1" hold="0.7" />
      </rect>
      {icon}
      <text x="55" y="36" fontSize="15" fontWeight="600" fill="#f2f2f5">{title}</text>
      <text x="100" y="58" fontSize="10" fill="#8d8d97" textAnchor="middle">{subtitle}</text>
    </g>
  );
}

export default function ArchitectureDiagram() {
  // Timeline (seconds within the cycle)
  const tClientUp = [0.2, 1.0];
  const tProxyUp = [1.1, 1.9];
  const tBackendFlash = 1.9;
  const tPublish = [2.1, 2.9];
  const tNodeInFlash = 2.9;
  const tToBroker = [3.0, 3.45];
  const tBrokerFlash = 3.45;
  const tFanOut = [3.6, 4.05];
  const tNodesFlash = 4.05;
  const tDeliver = [4.2, 5.0];
  const tDeliver2 = [4.45, 5.25];
  const tClientFlash = 5.05;

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
        .cf-arch .cf-flow-down {
          stroke-dasharray: 7 5;
          animation: cf-dash12 1.1s linear infinite;
        }
        .cf-arch .cf-flow-up {
          stroke-dasharray: 7 5;
          animation: cf-dash12 1.1s linear infinite reverse;
        }
        .cf-arch .cf-flow-slow {
          stroke-dasharray: 3 5;
          animation: cf-dash8 1.6s linear infinite;
        }
        .cf-arch .cf-ants {
          stroke-dasharray: 7 5;
          animation: cf-dash12 3s linear infinite;
        }
        @keyframes cf-dash12 { to { stroke-dashoffset: -12; } }
        @keyframes cf-dash8 { to { stroke-dashoffset: -8; } }
        .cf-arch .cf-rotor {
          transform-box: fill-box;
          transform-origin: center;
          animation: cf-spin 5s linear infinite;
        }
        .cf-arch .cf-gear {
          transform-box: fill-box;
          transform-origin: center;
          animation: cf-spin 9s linear infinite;
        }
        @keyframes cf-spin { to { transform: rotate(360deg); } }
        .cf-arch .cf-led { animation: cf-blink 2.4s ease-in-out infinite; }
        @keyframes cf-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .cf-arch .cf-blob { animation: cf-breathe 8s ease-in-out infinite; }
        @keyframes cf-breathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cf-arch * { animation: none !important; }
          .cf-arch .cf-parcel { display: none; }
        }
      `}</style>

      <defs>
        <radialGradient id="cf-bg" cx="50%" cy="22%" r="90%">
          <stop offset="0%" stopColor="#212129" />
          <stop offset="55%" stopColor="#16161c" />
          <stop offset="100%" stopColor="#0f0f13" />
        </radialGradient>
        <radialGradient id="cf-blob-red" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={RED} stopOpacity="0.11" />
          <stop offset="100%" stopColor={RED} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cf-blob-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.1" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <pattern id="cf-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.9" fill="#ffffff" fillOpacity="0.07" />
        </pattern>

        <linearGradient id="cf-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="cf-glass-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.07" />
        </linearGradient>

        <linearGradient id="cf-node-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d2126" />
          <stop offset="100%" stopColor="#211318" />
        </linearGradient>
        <linearGradient id="cf-node-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9b9b" />
          <stop offset="50%" stopColor={RED} />
          <stop offset="100%" stopColor="#a83838" />
        </linearGradient>

        <linearGradient id="cf-broker-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2837" />
          <stop offset="100%" stopColor="#131a25" />
        </linearGradient>
        <linearGradient id="cf-broker-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fb3ff" />
          <stop offset="100%" stopColor="#3d63b8" />
        </linearGradient>

        <linearGradient id="cf-grad-transport" gradientUnits="userSpaceOnUse" x1="0" y1="490" x2="0" y2="598">
          <stop offset="0%" stopColor={RED} stopOpacity="0.3" />
          <stop offset="100%" stopColor={RED} stopOpacity="0.85" />
        </linearGradient>

        <marker id="cf-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 9 3, 0 6, 2.2 3" fill={RED} />
        </marker>

        <filter id="cf-shadow" x="-30%" y="-30%" width="160%" height="190%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.45" />
        </filter>
        <filter id="cf-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ===== SCENE BACKGROUND ===== */}
      <rect x="0" y="0" width="800" height="700" fill="url(#cf-bg)" />
      <rect x="0" y="0" width="800" height="700" fill="url(#cf-grid)" />
      <ellipse className="cf-blob" cx="400" cy="265" rx="340" ry="135" fill="url(#cf-blob-red)" />
      <ellipse className="cf-blob" cx="400" cy="400" rx="290" ry="105" fill="url(#cf-blob-blue)" style={{ animationDelay: '4s' }} />
      <rect x="0.5" y="0.5" width="799" height="699" rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.06" />

      {/* ===== BACKEND INFRASTRUCTURE BOUNDARY ===== */}
      <rect x="20" y="20" width="760" height="490" rx="14"
        fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" strokeDasharray="8,5" />
      <g transform="translate(400, 20)">
        <rect x="-158" y="-12" width="316" height="24" rx="12" fill="#14141a" stroke="#ffffff" strokeOpacity="0.14" />
        <text x="0" y="4" fontSize="11" fontWeight="bold" fill="#9a9aa4" textAnchor="middle" letterSpacing="2px">
          YOUR BACKEND INFRASTRUCTURE
        </text>
      </g>

      {/* ===== BACKEND APP ===== */}
      <g transform="translate(80, 52)">
        <rect x="-2" y="-2" width="644" height="76" rx="12" fill="none" stroke="#ffffff" strokeWidth="3" filter="url(#cf-blur)" opacity="0">
          <Flash t={tBackendFlash} lo="0" hi="0.35" />
        </rect>
        <rect width="640" height="72" rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
        <line x1="11" y1="1.2" x2="629" y2="1.2" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
        <text x="320" y="30" fontSize="17" fontWeight="bold" fill="#f2f2f5" textAnchor="middle" letterSpacing="2.5px">
          YOUR BACKEND APPLICATION
        </text>
        <text x="320" y="52" fontSize="12" fill="#8d8d97" textAnchor="middle">
          Any language, any framework, any architecture
        </text>
      </g>

      {/* ===== API CHUTES (backend <-> cluster) ===== */}
      <Chute x={360} y1={126} y2={203} color={RED} flowClass="cf-flow-down" arrow="cf-arrow" />
      <Chute x={440} y1={203} y2={126} color={RED} flowClass="cf-flow-up" arrow="cf-arrow" />

      <text x="345" y="155" fontSize="10" fontWeight="bold" fill="#ff8a8a" textAnchor="end" letterSpacing="1px">
        SERVER API
      </text>
      <text x="345" y="167" fontSize="9" textAnchor="end">
        <tspan fill="#ff8a8a">publish</tspan><tspan fill="#c08a8a">, presence, history, etc.</tspan>
      </text>
      <text x="345" y="179" fontSize="9" fill="#c08a8a" textAnchor="end">
        HTTP / GRPC
      </text>
      <text x="455" y="155" fontSize="10" fontWeight="bold" fill="#ff8a8a" letterSpacing="1px">
        PROXY EVENTS
      </text>
      <text x="455" y="167" fontSize="9" fill="#c08a8a">
        connect, subscribe, publish, RPC, etc.
      </text>
      <text x="455" y="179" fontSize="9" fill="#c08a8a">
        HTTP / GRPC
      </text>

      {/* ===== CENTRIFUGO CLUSTER ===== */}
      <rect className="cf-ants" x="60" y="205" width="680" height="280" rx="12"
        fill="rgba(254,94,94,0.035)" stroke={RED} strokeOpacity="0.55" strokeWidth="1.5" />
      <g transform="translate(400, 205)">
        <rect x="-115" y="-12" width="230" height="24" rx="12" fill="#1c1216" stroke={RED} strokeOpacity="0.45" />
        <circle className="cf-led" cx="-96" cy="0" r="3" fill={RED} />
        <text x="6" y="4" fontSize="11" fontWeight="bold" fill="#ff7d7d" textAnchor="middle" letterSpacing="2px">
          CENTRIFUGO CLUSTER
        </text>
      </g>

      {/* Node <-> broker chutes (both directions, so no arrowheads) */}
      <Chute x={180} y1={297} y2={338} color={BLUE} flowClass="cf-flow-slow" />
      <Chute x={400} y1={297} y2={338} color={BLUE} flowClass="cf-flow-slow" />
      <Chute x={630} y1={297} y2={338} color={BLUE} flowClass="cf-flow-slow" />

      <Node x={100} y={235} label="Node 1" flashAt={tNodesFlash} spinDelay="0s" />
      <Node x={320} y={235} label="Node 2" flashAt={tNodeInFlash} spinDelay="-1.7s" />
      <g transform="translate(500, 265)">
        <circle className="cf-led" cx="0" cy="0" r="2.5" fill={RED} opacity="0.6" />
        <circle className="cf-led" cx="14" cy="0" r="2.5" fill={RED} opacity="0.6" style={{ animationDelay: '0.4s' }} />
        <circle className="cf-led" cx="28" cy="0" r="2.5" fill={RED} opacity="0.6" style={{ animationDelay: '0.8s' }} />
      </g>
      <Node x={550} y={235} label="Node N" flashAt={tNodesFlash} spinDelay="-3.4s" />

      {/* ===== BROKER ===== */}
      <rect x="100" y="340" width="600" height="120" rx="10"
        fill="rgba(91,141,239,0.04)" stroke={BLUE} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="5,4" />
      <g transform="translate(400, 340)">
        <rect x="-140" y="-11" width="280" height="22" rx="11" fill="#131722" stroke={BLUE} strokeOpacity="0.35" />
        <text x="0" y="4" fontSize="10" fontWeight="bold" fill="#7da6ff" textAnchor="middle" letterSpacing="1.5px">
          BROKER: REDIS / REDIS CLUSTER / NATS
        </text>
      </g>

      <Shard x={170} y={370} label="Shard 1" flashAt={tBrokerFlash} spinDelay="0s" />
      <Shard x={340} y={370} label="Shard 2" flashAt={tBrokerFlash} spinDelay="-3s" />
      <g transform="translate(482, 394)">
        <circle className="cf-led" cx="0" cy="0" r="2" fill={BLUE} opacity="0.7" />
        <circle className="cf-led" cx="12" cy="0" r="2" fill={BLUE} opacity="0.7" style={{ animationDelay: '0.4s' }} />
        <circle className="cf-led" cx="24" cy="0" r="2" fill={BLUE} opacity="0.7" style={{ animationDelay: '0.8s' }} />
      </g>
      <Shard x={524} y={370} label="Shard N" flashAt={tBrokerFlash} spinDelay="-6s" />

      {/* ===== TRANSPORT CHUTES (cluster -> clients) ===== */}
      <Chute x={180} y1={490} y2={598} color="url(#cf-grad-transport)" flowClass="cf-flow-down" arrow="cf-arrow" />
      <Chute x={400} y1={490} y2={598} color="url(#cf-grad-transport)" flowClass="cf-flow-down" arrow="cf-arrow" />
      <Chute x={620} y1={490} y2={598} color="url(#cf-grad-transport)" flowClass="cf-flow-down" arrow="cf-arrow" />

      {/* ===== PARCELS (the story, in order) ===== */}
      {/* 1. A client sends an event up the transport */}
      <Parcel d="M400,598 L400,492" t0={tClientUp[0]} t1={tClientUp[1]} color="#e9eef8" glow="rgba(255,255,255,0.8)" />
      {/* 2. Centrifugo proxies it to the backend */}
      <Parcel d="M440,201 L440,128" t0={tProxyUp[0]} t1={tProxyUp[1]} color="#e9eef8" glow="rgba(255,255,255,0.8)" />
      {/* 3. Backend publishes through the server API */}
      <Parcel d="M360,128 L360,201" t0={tPublish[0]} t1={tPublish[1]} />
      {/* 4. Node hands the message to the broker */}
      <Parcel d="M400,297 L400,338" t0={tToBroker[0]} t1={tToBroker[1]} />
      {/* 5. Broker fans it out to every node */}
      <Parcel d="M180,338 L180,297" t0={tFanOut[0]} t1={tFanOut[1]} />
      <Parcel d="M400,338 L400,297" t0={tFanOut[0]} t1={tFanOut[1]} />
      <Parcel d="M630,338 L630,297" t0={tFanOut[0]} t1={tFanOut[1]} />
      {/* 6. Nodes deliver to all connected clients */}
      <Parcel d="M180,492 L180,598" t0={tDeliver[0]} t1={tDeliver[1]} />
      <Parcel d="M400,492 L400,598" t0={tDeliver[0]} t1={tDeliver[1]} />
      <Parcel d="M620,492 L620,598" t0={tDeliver[0]} t1={tDeliver[1]} />
      <Parcel d="M180,492 L180,598" t0={tDeliver2[0]} t1={tDeliver2[1]} />
      <Parcel d="M400,492 L400,598" t0={tDeliver2[0]} t1={tDeliver2[1]} />
      <Parcel d="M620,492 L620,598" t0={tDeliver2[0]} t1={tDeliver2[1]} />

      {/* Transport label sits between the outer chutes; the middle chute runs behind it */}
      <g transform="translate(400, 544)">
        <rect x="-170" y="-16" width="340" height="38" rx="19" fill="#16161c" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
        <rect x="-170" y="-16" width="340" height="38" rx="19" fill="url(#cf-glass)" />
        <text y="-1" fontSize="12" fill="#ffffff" textAnchor="middle" fontWeight="600">
          <tspan fill="#ff8585">WebSocket</tspan>
          <tspan fill="#55555e"> / </tspan>
          <tspan fill="#c0c0c8">SSE</tspan>
          <tspan fill="#55555e"> / </tspan>
          <tspan fill="#c0c0c8">HTTP-Streaming</tspan>
          <tspan fill="#55555e"> / </tspan>
          <tspan fill="#c0c0c8">WebTransport</tspan>
        </text>
        <text y="15" fontSize="9" fill="#74747e" textAnchor="middle" letterSpacing="0.5px">
          JSON and Protobuf
        </text>
      </g>

      {/* ===== CLIENTS ===== */}
      <Client x={80} y={605} title="Browser" subtitle="JavaScript / Dart" flashAt={tClientFlash}
        icon={(
          <g transform="translate(15, 22)">
            <rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke="#b8b8c2" strokeWidth="1.2" />
            <line x1="0" y1="6" x2="24" y2="6" stroke="#b8b8c2" strokeWidth="0.8" />
            <circle cx="4" cy="3" r="1.2" fill={RED} />
            <circle cx="8.5" cy="3" r="1.2" fill="#f5c542" />
            <circle cx="13" cy="3" r="1.2" fill="#5bef7b" />
          </g>
        )}
      />
      <Client x={300} y={605} title="Mobile" subtitle="Swift / Java / Dart / C#" flashAt={tClientFlash}
        icon={(
          <g transform="translate(18, 18)">
            <rect x="0" y="0" width="15" height="26" rx="2.5" fill="none" stroke="#b8b8c2" strokeWidth="1.2" />
            <line x1="4" y1="22" x2="11" y2="22" stroke="#b8b8c2" strokeWidth="0.8" />
            <rect x="2" y="3" width="11" height="16" rx="0.5" fill="none" stroke="#6a6a74" strokeWidth="0.5" />
          </g>
        )}
      />
      <Client x={520} y={605} title="Backend" subtitle="Go / Python" flashAt={tClientFlash}
        icon={(
          <g transform="translate(15, 20)">
            <rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke="#b8b8c2" strokeWidth="1.2" />
            <text x="4" y="13" fontSize="9" fill="#5bef7b" fontFamily="monospace">{'>'}</text>
            <rect className="cf-led" x="11" y="10.5" width="5" height="1.6" fill="#5bef7b" />
          </g>
        )}
      />
    </svg>
  );
}
