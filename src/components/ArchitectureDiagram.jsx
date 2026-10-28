import React from 'react';

// Centrifugo architecture as one broadcast, laid out radially. The broker
// (a cluster of shards) sits in the middle, Centrifugo nodes form a ring around
// it, and every node has its own group of connected clients. The backend
// publishes a message to a single node; that node hands it to the broker shard
// owning the channel, the shard fans it out to every node, and each node pushes
// it down to all of its clients. All motion runs on one shared clock.

const CYCLE = 5.5;
const k = (t) => (t / CYCLE).toFixed(4);

const RED = '#fe5e5e';
const BLUE = '#5b8def';
const GREEN = '#5bef7b';

// ---- Geometry ---------------------------------------------------------------

const W = 820;
const H = 824;
const CX = 410;
const CY = 385;
const R_NODE = 230;
const R_CLIENT = 338;
const NODE_R = 40;

const rad = (a) => (a * Math.PI) / 180;
const pt = (a, r) => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
const fmt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

// First point where the segment P -> Q crosses the border of `rect`.
function cross([x1, y1], [x2, y2], r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let best = 1;
  const cand = [];
  if (dx) cand.push((r.x - x1) / dx, (r.x + r.w - x1) / dx);
  if (dy) cand.push((r.y - y1) / dy, (r.y + r.h - y1) / dy);
  for (const t of cand) {
    if (t > 0 && t < best) {
      const x = x1 + dx * t;
      const y = y1 + dy * t;
      if (x >= r.x - 0.01 && x <= r.x + r.w + 0.01 && y >= r.y - 0.01 && y <= r.y + r.h + 0.01) best = t;
    }
  }
  return [x1 + dx * best, y1 + dy * best];
}

// Point on a node's circle in the direction of `target`.
function edgeOf(node, [tx, ty]) {
  const [x, y] = node.center;
  const dx = tx - x;
  const dy = ty - y;
  const len = Math.hypot(dx, dy) || 1;
  return [x + (dx / len) * NODE_R, y + (dy / len) * NODE_R];
}

// Nodes sit every 45 degrees; the top slot is left free for the backend.
const NODES = [-135, -45, 0, 45, 90, 135, 180].map((angle, i) => {
  const [x, y] = pt(angle, R_NODE);
  return {
    angle,
    label: i === 6 ? 'Node N' : `Node ${i + 1}`,
    center: [x, y],
    clients: [-16, -5.5, 5.5, 16].map((off, j) => ({ pos: pt(angle + off, R_CLIENT), kind: (i + j) % 3 })),
  };
});

const BROKER = { x: CX - 122, y: CY - 66, w: 244, h: 132 };
const BROKER_CENTER = [CX, CY];
const SHARD_W = 104;
const SHARD_H = 48;
const SHARDS = [
  { x: CX - 108, y: CY - 46, label: 'Shard 1' },
  { x: CX + 4, y: CY - 46, label: 'Shard 2' },
  { x: CX - 108, y: CY + 10, label: 'Shard 3' },
  { x: CX + 4, y: CY + 10, label: 'Shard N' },
];
const OWNER = 0; // the shard owning the published channel

// The backend box overlaps the client ring at the top, like a big client.
const BACKEND = { w: 240, h: 68 };
BACKEND.x = CX - BACKEND.w / 2;
BACKEND.y = CY - R_CLIENT - BACKEND.h / 2 + 44;
const PUBLISH_FROM = [BACKEND.x + 36, BACKEND.y + BACKEND.h];
const ENTRY = NODES[0];
const PUBLISH_TO = edgeOf(ENTRY, PUBLISH_FROM);

// ---- Timeline ---------------------------------------------------------------

const T_PUBLISH = [0.3, 1.0];
const T_TO_BROKER = [1.2, 1.8];
const T_FAN_OUT = [2.0, 2.7];
const T_DELIVER = [2.9, 3.6];

// ---- Small building blocks --------------------------------------------------

function Parcel({ d, t0, t1, color = '#ffb0b0', glow = 'rgba(254,94,94,0.95)' }) {
  const fade = 0.05;
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

function Flash({ t, lo, hi, hold = 0.6 }) {
  return (
    <animate
      attributeName="opacity" dur={`${CYCLE}s`} repeatCount="indefinite"
      values={`${lo};${lo};${hi};${lo};${lo}`}
      keyTimes={`0;${k(t - 0.08)};${k(t)};${k(t + hold)};1`}
    />
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
const GEAR = gearPath(8.5, 6.2, 8);

function Node({ node, flashAt, spinDelay }) {
  const { center: [x, y], label } = node;
  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}>
      <circle r={NODE_R + 2} fill="none" stroke={RED} strokeWidth="4" filter="url(#cf-blur)" opacity="0.14">
        <Flash t={flashAt} lo="0.14" hi="0.7" />
      </circle>
      <circle r={NODE_R} fill="url(#cf-node-fill)" stroke="url(#cf-node-stroke)" strokeWidth="1.2" filter="url(#cf-shadow)" />
      <circle r={NODE_R - 4} fill="none" stroke="#ffb1b1" strokeOpacity="0.14" strokeWidth="1" />
      {/* Lit state when a message arrives */}
      <circle r={NODE_R} fill={RED} opacity="0">
        <Flash t={flashAt} lo="0" hi="0.18" />
      </circle>
      <circle r={NODE_R} fill="none" stroke="#ffd6d6" strokeWidth="1.5" opacity="0">
        <Flash t={flashAt} lo="0" hi="0.8" />
      </circle>
      <circle cx="0" cy="-9" r="17" fill="#121216" />
      <circle cx="0" cy="-9" r="17" fill="none" stroke={RED} strokeOpacity="0.3" strokeWidth="1" />
      <image className="cf-rotor" href="/img/logo.svg" x="-14" y="-23" width="28" height="28" style={{ animationDelay: spinDelay }} />
      <text x="0" y="26" fontSize="11.5" fontWeight="bold" fill="#ff9a9a" textAnchor="middle">{label}</text>
      <circle className="cf-led" cx={NODE_R - 12} cy={-(NODE_R - 12)} r="2.5" fill="#5bef7b" style={{ animationDelay: spinDelay }} />
    </g>
  );
}

function Shard({ shard, flashAt, spinDelay }) {
  return (
    <g transform={`translate(${shard.x}, ${shard.y})`}>
      {flashAt != null && (
        <rect x="-3" y="-3" width={SHARD_W + 6} height={SHARD_H + 6} rx="10" fill="none" stroke={BLUE} strokeWidth="6" filter="url(#cf-blur)" opacity="0.1">
          <Flash t={flashAt} lo="0.1" hi="1" />
        </rect>
      )}
      <rect width={SHARD_W} height={SHARD_H} rx="7" fill="url(#cf-broker-fill)" stroke="url(#cf-broker-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
      <line x1="8" y1="1.2" x2={SHARD_W - 8} y2="1.2" stroke="#bcd2ff" strokeOpacity="0.3" strokeWidth="0.8" />
      {flashAt != null && (
        <g>
          <rect width={SHARD_W} height={SHARD_H} rx="7" fill={BLUE} opacity="0">
            <Flash t={flashAt} lo="0" hi="0.4" />
          </rect>
          <rect width={SHARD_W} height={SHARD_H} rx="7" fill="none" stroke="#dbe7ff" strokeWidth="1.8" opacity="0">
            <Flash t={flashAt} lo="0" hi="1" />
          </rect>
        </g>
      )}
      <g transform="translate(20, 24)">
        <path className="cf-gear" d={GEAR} fill="#1b2433" stroke="#8fb3ff" strokeWidth="1.1" style={{ animationDelay: spinDelay }} />
        <circle r="2.2" fill="#8fb3ff" />
      </g>
      <text x="66" y="21" fontSize="12.5" fontWeight="600" fill="#ffffff" textAnchor="middle">{shard.label}</text>
      <text x="66" y="37" fontSize="9.5" fill="#8fb3ff" textAnchor="middle" letterSpacing="1px">PUB/SUB</text>
    </g>
  );
}

function ClientIcon({ kind }) {
  if (kind === 0) {
    // browser
    return (
      <g transform="translate(-6, -4.5)">
        <rect width="12" height="9" rx="1.2" fill="none" stroke="#d6d6de" strokeWidth="1" />
        <line x1="0" y1="3" x2="12" y2="3" stroke="#d6d6de" strokeWidth="0.8" />
        <circle cx="2" cy="1.5" r="0.7" fill={RED} />
        <circle cx="4.2" cy="1.5" r="0.7" fill="#f5c542" />
      </g>
    );
  }
  if (kind === 1) {
    // mobile
    return (
      <g transform="translate(-3.5, -6)">
        <rect width="7" height="12" rx="1.5" fill="none" stroke="#d6d6de" strokeWidth="1" />
        <line x1="2.2" y1="10" x2="4.8" y2="10" stroke="#d6d6de" strokeWidth="0.8" />
      </g>
    );
  }
  // server / backend client
  return (
    <g transform="translate(-6, -4.5)">
      <rect width="12" height="9" rx="1.2" fill="none" stroke="#d6d6de" strokeWidth="1" />
      <text x="2" y="7" fontSize="6" fill="#5bef7b" fontFamily="monospace">{'>_'}</text>
    </g>
  );
}

function Client({ pos: [x, y], kind, flashAt }) {
  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}>
      <circle r="15" fill={GREEN} opacity="0" filter="url(#cf-blur)">
        <Flash t={flashAt} lo="0" hi="0.18" hold={0.7} />
      </circle>
      <circle r="12.5" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
      <circle r="12.5" fill={GREEN} opacity="0">
        <Flash t={flashAt} lo="0" hi="0.07" hold={0.7} />
      </circle>
      <circle r="12.5" fill="none" stroke={GREEN} strokeWidth="1" opacity="0">
        <Flash t={flashAt} lo="0" hi="0.35" hold={0.7} />
      </circle>
      <g transform="scale(1.2)"><ClientIcon kind={kind} /></g>
    </g>
  );
}

// ---- The diagram ------------------------------------------------------------

export default function ArchitectureDiagram() {
  const tNodeIn = T_PUBLISH[1];
  const tShard = T_TO_BROKER[1];
  const tNodesAll = T_FAN_OUT[1];
  const tClients = T_DELIVER[1];

  return (
    <svg
      className="cf-arch"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px' }}
    >
      <style>{`
        .cf-arch text {
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
        }
        .cf-arch .cf-flow {
          stroke-dasharray: 7 5;
          animation: cf-dash12 1.1s linear infinite;
        }
        .cf-arch .cf-flow-slow {
          stroke-dasharray: 3 5;
          animation: cf-dash8 1.6s linear infinite;
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
        <radialGradient id="cf-bg" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#222230" />
          <stop offset="55%" stopColor="#16161c" />
          <stop offset="100%" stopColor="#0f0f13" />
        </radialGradient>
        <radialGradient id="cf-blob-red" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={RED} stopOpacity="0.1" />
          <stop offset="100%" stopColor={RED} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cf-blob-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.14" />
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

      {/* ===== SCENE ===== */}
      <rect x="0" y="0" width={W} height={H} fill="url(#cf-bg)" />
      <rect x="0" y="0" width={W} height={H} fill="url(#cf-grid)" />
      <circle className="cf-blob" cx={CX} cy={CY} r="300" fill="url(#cf-blob-red)" />
      <circle className="cf-blob" cx={CX} cy={CY} r="170" fill="url(#cf-blob-blue)" style={{ animationDelay: '4s' }} />
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.06" />

      {/* Faint rings: the node ring and the client ring */}
      <circle cx={CX} cy={CY} r={R_NODE} fill="none" stroke={RED} strokeOpacity="0.1" strokeWidth="1" strokeDasharray="2,6" />
      <circle cx={CX} cy={CY} r={R_CLIENT} fill="none" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="2,6" />

      {/* ===== LINKS (drawn first, under everything) ===== */}
      {/* client <-> node connections */}
      {NODES.map((n) => n.clients.map((c, j) => (
        <line key={`${n.angle}-${j}`} x1={n.center[0]} y1={n.center[1]} x2={c.pos[0]} y2={c.pos[1]}
          stroke={RED} strokeOpacity="0.35" strokeWidth="1" />
      )))}
      {/* node <-> broker connections */}
      {NODES.map((n) => {
        const a = edgeOf(n, BROKER_CENTER);
        const b = cross(BROKER_CENTER, n.center, BROKER);
        return (
          <line key={n.angle} className="cf-flow-slow" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
            stroke={BLUE} strokeOpacity="0.6" strokeWidth="1.3" />
        );
      })}

      {/* ===== BROKER ===== */}
      <rect x={BROKER.x} y={BROKER.y} width={BROKER.w} height={BROKER.h} rx="12"
        fill="rgba(91,141,239,0.06)" stroke={BLUE} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="5,4" />
      {/* Broker perimeter lights up together with the owning shard */}
      <rect x={BROKER.x - 2} y={BROKER.y - 2} width={BROKER.w + 4} height={BROKER.h + 4} rx="14"
        fill="none" stroke={BLUE} strokeWidth="4" filter="url(#cf-blur)" opacity="0">
        <Flash t={tShard} lo="0" hi="0.3" />
      </rect>
      <rect x={BROKER.x} y={BROKER.y} width={BROKER.w} height={BROKER.h} rx="12"
        fill="none" stroke="#dbe7ff" strokeWidth="1.2" opacity="0">
        <Flash t={tShard} lo="0" hi="0.4" />
      </rect>
      <g transform={`translate(${CX}, ${BROKER.y})`}>
        <rect x="-122" y="-12" width="244" height="24" rx="12" fill="#131722" stroke={BLUE} strokeOpacity="0.4" />
        <text x="0" y="4" fontSize="10.5" fontWeight="bold" fill="#7da6ff" textAnchor="middle" letterSpacing="1.5px">
          BROKER: REDIS CLUSTER / NATS
        </text>
      </g>
      {SHARDS.map((s, i) => (
        <Shard key={s.label} shard={s} flashAt={i === OWNER ? tShard : null} spinDelay={`${-i * 2.3}s`} />
      ))}

      {/* ===== CENTRIFUGO NODES ===== */}
      {NODES.map((n, i) => (
        <Node key={n.angle} node={n} flashAt={i === 0 ? tNodeIn : tNodesAll} spinDelay={`${-i * 0.7}s`} />
      ))}
      {/* Entry node flashes again with the rest when the broker delivers */}
      <g transform={`translate(${NODES[0].center[0].toFixed(1)}, ${NODES[0].center[1].toFixed(1)})`}>
        <circle r={NODE_R + 2} fill="none" stroke={RED} strokeWidth="4" filter="url(#cf-blur)" opacity="0">
          <Flash t={tNodesAll} lo="0" hi="0.6" />
        </circle>
        <circle r={NODE_R} fill={RED} opacity="0">
          <Flash t={tNodesAll} lo="0" hi="0.18" />
        </circle>
        <circle r={NODE_R} fill="none" stroke="#ffd6d6" strokeWidth="1.5" opacity="0">
          <Flash t={tNodesAll} lo="0" hi="0.8" />
        </circle>
      </g>

      {/* ===== CLIENTS ===== */}
      {NODES.map((n) => n.clients.map((c, j) => (
        <Client key={`${n.angle}-${j}`} pos={c.pos} kind={c.kind} flashAt={tClients} />
      )))}

      {/* ===== BACKEND ===== */}
      <g transform={`translate(${BACKEND.x}, ${BACKEND.y})`}>
        <rect width={BACKEND.w} height={BACKEND.h} rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
        <line x1="11" y1="1.2" x2={BACKEND.w - 11} y2="1.2" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
        <text x={BACKEND.w / 2} y="28" fontSize="15" fontWeight="bold" fill="#f2f2f5" textAnchor="middle" letterSpacing="2px">
          YOUR BACKEND
        </text>
        <text x={BACKEND.w / 2} y="50" fontSize="13.5" fill="#c4c4cd" textAnchor="middle">
          Any language, any framework
        </text>
      </g>
      <line className="cf-flow" x1={PUBLISH_FROM[0]} y1={PUBLISH_FROM[1]} x2={PUBLISH_TO[0]} y2={PUBLISH_TO[1]}
        stroke={RED} strokeWidth="1.6" markerEnd="url(#cf-arrow)" />
      <text x={BACKEND.x + 52} y={BACKEND.y + BACKEND.h + 30} fontSize="12" fontWeight="bold" fill="#ff8a8a" letterSpacing="1px">PUBLISH</text>
      <text x={BACKEND.x + 52} y={BACKEND.y + BACKEND.h + 45} fontSize="11" fill="#c08a8a">server API, HTTP / GRPC</text>
      <text x={BACKEND.x + 52} y={BACKEND.y + BACKEND.h + 60} fontSize="11" fill="#c08a8a">to any single node</text>

      {/* ===== PARCELS ===== */}
      {/* 1. backend publishes to one node */}
      <Parcel d={`M${fmt(PUBLISH_FROM)} L${fmt(PUBLISH_TO)}`} t0={T_PUBLISH[0]} t1={T_PUBLISH[1]} />
      {/* 2. that node hands the message to the broker shard owning the channel */}
      <Parcel d={`M${fmt(edgeOf(ENTRY, BROKER_CENTER))} L${fmt(cross(BROKER_CENTER, ENTRY.center, BROKER))}`} t0={T_TO_BROKER[0]} t1={T_TO_BROKER[1]} />
      {/* 3. the shard fans it out to every node */}
      {NODES.map((n) => (
        <Parcel key={`fan-${n.angle}`} d={`M${fmt(cross(BROKER_CENTER, n.center, BROKER))} L${fmt(edgeOf(n, BROKER_CENTER))}`} t0={T_FAN_OUT[0]} t1={T_FAN_OUT[1]} />
      ))}
      {/* 4. every node delivers to all of its clients */}
      {NODES.map((n) => n.clients.map((c, j) => (
        <Parcel key={`del-${n.angle}-${j}`} d={`M${fmt(edgeOf(n, c.pos))} L${fmt(c.pos)}`} t0={T_DELIVER[0] + j * 0.04} t1={T_DELIVER[1] + j * 0.04} />
      )))}

      {/* ===== LEGENDS ===== */}
      <g transform={`translate(16, ${H - 62})`}>
        <rect width="330" height="48" rx="24" fill="#16161c" stroke="url(#cf-glass-stroke)" strokeWidth="1" />
        <g transform="translate(28, 24)"><circle r="10" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" /><ClientIcon kind={0} /></g>
        <g transform="translate(54, 24)"><circle r="10" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" /><ClientIcon kind={1} /></g>
        <g transform="translate(80, 24)"><circle r="10" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" /><ClientIcon kind={2} /></g>
        <text x="102" y="20" fontSize="13" fontWeight="600" fill="#e4e4ea">Browsers, mobile apps, servers</text>
        <text x="102" y="36" fontSize="12" fill="#b4b4be">connected to different nodes</text>
      </g>
      <g transform={`translate(${W - 16}, ${H - 62})`}>
        <rect x="-376" width="376" height="48" rx="24" fill="#16161c" stroke="url(#cf-glass-stroke)" strokeWidth="1" />
        <text x="-188" y="20" fontSize="13" fontWeight="600" textAnchor="middle">
          <tspan fill="#ff8585">WebSocket</tspan>
          <tspan fill="#6a6a74"> / </tspan>
          <tspan fill="#e4e4ea">SSE</tspan>
          <tspan fill="#6a6a74"> / </tspan>
          <tspan fill="#e4e4ea">HTTP-Streaming</tspan>
          <tspan fill="#6a6a74"> / </tspan>
          <tspan fill="#e4e4ea">WebTransport</tspan>
        </text>
        <text x="-188" y="36" fontSize="12" fill="#b4b4be" textAnchor="middle">JSON and Protobuf</text>
      </g>
    </svg>
  );
}
