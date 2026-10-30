import React, { createContext, useContext, useState } from 'react';
import styles from './ArchitectureDiagram.module.css';

// Centrifugo architecture laid out radially. The broker (a cluster of shards)
// sits in the middle, Centrifugo nodes form a ring around it, and every node
// has its own group of connected clients. Each tab plays one scenario on the
// same scene: broadcast, targeted broadcast, publish proxy, RPC proxy, async
// consumers, reconnect and recovery, shared poll, map subscriptions,
// subscription streams (backend in the middle instead of the broker) and
// presence. All motion inside a scenario runs on one shared clock.

const Clock = createContext(5.5);
function useClock() {
  const cycle = useContext(Clock);
  return [cycle, (t) => (t / cycle).toFixed(4)];
}

const RED = '#fe5e5e';
const BLUE = '#5b8def';
const GREEN = '#5bef7b';
const AMBER = '#f5c542';

// ---- Geometry ---------------------------------------------------------------

const W = 820;
const H = 792;
const CX = 410;
const CY = 353;
const R_NODE = 230;
const R_CLIENT = 338;
const NODE_R = 40;

const rad = (a) => (a * Math.PI) / 180;
const pt = (a, r) => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
const fmt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
const seg = (a, b) => `M${fmt(a)} L${fmt(b)}`;

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

// The backend box overlaps the client ring at the top, like a big client.
const BACKEND = { w: 240, h: 68 };
BACKEND.x = CX - BACKEND.w / 2;
BACKEND.y = CY - R_CLIENT - BACKEND.h / 2 + 44;
const PUBLISH_FROM = [BACKEND.x + 36, BACKEND.y + BACKEND.h];
const ENTRY = NODES[0];
const PUBLISH_TO = edgeOf(ENTRY, PUBLISH_FROM);

// Paths shared by scenarios.
const toBroker = (n) => seg(edgeOf(n, BROKER_CENTER), cross(BROKER_CENTER, n.center, BROKER));
const fromBroker = (n) => seg(cross(BROKER_CENTER, n.center, BROKER), edgeOf(n, BROKER_CENTER));
const toClient = (n, c) => seg(edgeOf(n, c.pos), c.pos);
const fromClient = (n, c) => seg(c.pos, edgeOf(n, c.pos));

// ---- Small building blocks --------------------------------------------------

const AMBER_PARCEL = { color: '#ffe08a', glow: 'rgba(245,197,66,0.95)' };
const GREEN_PARCEL = { color: '#b5ffc4', glow: 'rgba(91,239,123,0.9)' };

function Parcel({ d, t0, t1, color = '#ffb0b0', glow = 'rgba(254,94,94,0.95)', label }) {
  const [cycle, k] = useClock();
  const fade = 0.05;
  return (
    <g className="cf-parcel" opacity="0" style={{ filter: `drop-shadow(0 0 4px ${glow})` }}>
      {label ? (
        <g>
          <rect x={-(6 + label.length * 3.2)} y="-7.5" width={12 + label.length * 6.4} height="15" rx="7.5" fill={color} />
          <text y="3.6" fontSize="10" fontWeight="bold" fill="#0f0f13" textAnchor="middle">{label}</text>
        </g>
      ) : (
        <g>
          <rect x="-6" y="-4" width="12" height="8" rx="2" fill={color} />
          <rect x="-3.5" y="-2" width="7" height="1.3" rx="0.6" fill="#ffffff" opacity="0.75" />
        </g>
      )}
      <animateMotion
        dur={`${cycle}s`} repeatCount="indefinite" path={d}
        calcMode="linear" keyPoints="0;0;1;1" keyTimes={`0;${k(t0)};${k(t1)};1`}
      />
      <animate
        attributeName="opacity" dur={`${cycle}s`} repeatCount="indefinite"
        values="0;0;1;1;0;0" keyTimes={`0;${k(t0)};${k(t0 + fade)};${k(t1 - fade)};${k(t1)};1`}
      />
    </g>
  );
}

function Flash({ t, lo, hi, hold = 0.6 }) {
  const [cycle, k] = useClock();
  return (
    <animate
      attributeName="opacity" dur={`${cycle}s`} repeatCount="indefinite"
      values={`${lo};${lo};${hi};${lo};${lo}`}
      keyTimes={`0;${k(t - 0.08)};${k(t)};${k(t + hold)};1`}
    />
  );
}

// Piecewise-linear animation through [time, value] frames, held at both ends.
function Anim({ frames, attr = 'opacity' }) {
  const [cycle, k] = useClock();
  const values = [frames[0][1], ...frames.map((f) => f[1]), frames[frames.length - 1][1]];
  const times = ['0', ...frames.map((f) => k(f[0])), '1'];
  return (
    <animate
      attributeName={attr} dur={`${cycle}s`} repeatCount="indefinite"
      values={values.join(';')} keyTimes={times.join(';')}
    />
  );
}

// Text shown only between t0 and t1.
function Phase({ t0, t1, children, ...rest }) {
  return (
    <text opacity="0" {...rest}>
      {children}
      <Anim frames={[[t0, 0], [t0 + 0.25, 1], [t1 - 0.25, 1], [t1, 0]]} />
    </text>
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
  const lit = flashAt != null;
  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}>
      <circle r={NODE_R + 2} fill="none" stroke={RED} strokeWidth="4" filter="url(#cf-blur)" opacity="0.14">
        {lit && <Flash t={flashAt} lo="0.14" hi="0.7" />}
      </circle>
      <circle r={NODE_R} fill="url(#cf-node-fill)" stroke="url(#cf-node-stroke)" strokeWidth="1.2" filter="url(#cf-shadow)" />
      <circle r={NODE_R - 4} fill="none" stroke="#ffb1b1" strokeOpacity="0.14" strokeWidth="1" />
      {/* Lit state when a message arrives */}
      {lit && (
        <circle r={NODE_R} fill={RED} opacity="0">
          <Flash t={flashAt} lo="0" hi="0.18" />
        </circle>
      )}
      {lit && (
        <circle r={NODE_R} fill="none" stroke="#ffd6d6" strokeWidth="1.5" opacity="0">
          <Flash t={flashAt} lo="0" hi="0.8" />
        </circle>
      )}
      <circle cx="0" cy="-9" r="17" fill="#121216" />
      <circle cx="0" cy="-9" r="17" fill="none" stroke={RED} strokeOpacity="0.3" strokeWidth="1" />
      <image className="cf-rotor" href="/img/logo.svg" x="-14" y="-23" width="28" height="28" style={{ animationDelay: spinDelay }} />
      <text x="0" y="26" fontSize="11.5" fontWeight="bold" fill="#ff9a9a" textAnchor="middle">{label}</text>
    </g>
  );
}

// A node lighting up again, drawn on top of the node.
function NodeFlash({ node, t }) {
  return (
    <g transform={`translate(${node.center[0].toFixed(1)}, ${node.center[1].toFixed(1)})`}>
      <circle r={NODE_R + 2} fill="none" stroke={RED} strokeWidth="4" filter="url(#cf-blur)" opacity="0">
        <Flash t={t} lo="0" hi="0.6" />
      </circle>
      <circle r={NODE_R} fill={RED} opacity="0">
        <Flash t={t} lo="0" hi="0.18" />
      </circle>
      <circle r={NODE_R} fill="none" stroke="#ffd6d6" strokeWidth="1.5" opacity="0">
        <Flash t={t} lo="0" hi="0.8" />
      </circle>
    </g>
  );
}

// A node going down at `down` and coming back at `up`.
function NodeDown({ node, down, up }) {
  const frames = [[down, 0], [down + 0.4, 1], [up, 1], [up + 0.5, 0]];
  return (
    <g transform={`translate(${node.center[0].toFixed(1)}, ${node.center[1].toFixed(1)})`} opacity="0">
      <Anim frames={frames} />
      <circle r={NODE_R + 1} fill="#0f0f13" opacity="0.72" />
      <circle r={NODE_R} fill="none" stroke="#6a6a74" strokeWidth="1.2" strokeDasharray="4,4" />
      <g stroke={RED} strokeWidth="3" strokeLinecap="round">
        <line x1="-9" y1="-18" x2="9" y2="0" />
        <line x1="9" y1="-18" x2="-9" y2="0" />
      </g>
      <text x="0" y="26" fontSize="11.5" fontWeight="bold" fill="#ff9a9a" textAnchor="middle">{node.label}</text>
    </g>
  );
}

function Shard({ shard, flashes = [], spinDelay }) {
  const [first, ...more] = flashes;
  const lit = first != null;
  return (
    <g transform={`translate(${shard.x}, ${shard.y})`}>
      {lit && (
        <rect x="-3" y="-3" width={SHARD_W + 6} height={SHARD_H + 6} rx="10" fill="none" stroke={BLUE} strokeWidth="6" filter="url(#cf-blur)" opacity="0.1">
          <Flash t={first} lo="0.1" hi="1" />
        </rect>
      )}
      {more.map((t) => (
        <rect key={t} x="-3" y="-3" width={SHARD_W + 6} height={SHARD_H + 6} rx="10" fill="none" stroke={BLUE} strokeWidth="6" filter="url(#cf-blur)" opacity="0">
          <Flash t={t} lo="0" hi="0.9" />
        </rect>
      ))}
      <rect width={SHARD_W} height={SHARD_H} rx="7" fill="url(#cf-broker-fill)" stroke="url(#cf-broker-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
      <line x1="8" y1="1.2" x2={SHARD_W - 8} y2="1.2" stroke="#bcd2ff" strokeOpacity="0.3" strokeWidth="0.8" />
      {flashes.map((t) => (
        <g key={t}>
          <rect width={SHARD_W} height={SHARD_H} rx="7" fill={BLUE} opacity="0">
            <Flash t={t} lo="0" hi="0.4" />
          </rect>
          <rect width={SHARD_W} height={SHARD_H} rx="7" fill="none" stroke="#dbe7ff" strokeWidth="1.8" opacity="0">
            <Flash t={t} lo="0" hi="1" />
          </rect>
        </g>
      ))}
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

// `subscribed` draws a channel ring, `muted` fades a client that is not part of
// the scenario, `sendAt` marks the client sending a message, `offline` is a
// list of opacity frames for the disconnected overlay.
function Client({ pos: [x, y], kind, flashAt, subscribed, muted, sendAt, offline }) {
  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} opacity={muted ? '0.4' : undefined}>
      {flashAt != null && (
        <circle r="15" fill={GREEN} opacity="0" filter="url(#cf-blur)">
          <Flash t={flashAt} lo="0" hi="0.18" hold={0.7} />
        </circle>
      )}
      {subscribed && (
        <circle r="17" fill="none" stroke={AMBER} strokeOpacity="0.85" strokeWidth="1.3" strokeDasharray="3,2.5" opacity={Array.isArray(subscribed) ? '0' : undefined}>
          {Array.isArray(subscribed) && <Anim frames={subscribed} />}
        </circle>
      )}
      {sendAt != null && (
        <circle r="17" fill="none" stroke={AMBER} strokeWidth="2" opacity="0">
          <Anim frames={[[sendAt - 0.2, 0], [sendAt, 1], [sendAt + 1.2, 1], [sendAt + 1.6, 0]]} />
        </circle>
      )}
      <circle r="12.5" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
      {flashAt != null && (
        <circle r="12.5" fill={GREEN} opacity="0">
          <Flash t={flashAt} lo="0" hi="0.07" hold={0.7} />
        </circle>
      )}
      {flashAt != null && (
        <circle r="12.5" fill="none" stroke={GREEN} strokeWidth="1" opacity="0">
          <Flash t={flashAt} lo="0" hi="0.35" hold={0.7} />
        </circle>
      )}
      <g transform="scale(1.2)"><ClientIcon kind={kind} /></g>
      {offline && (
        <g opacity="0">
          <Anim frames={offline} />
          <circle r="13" fill="#0f0f13" opacity="0.8" />
          <circle r="12.5" fill="none" stroke="#8a8a94" strokeWidth="1" strokeDasharray="2.5,2.5" />
        </g>
      )}
    </g>
  );
}

function IngressLabels({ lines }) {
  const [title, ...rest] = lines;
  return (
    <g>
      <text x={BACKEND.x + 52} y={BACKEND.y + BACKEND.h + 30} fontSize="12" fontWeight="bold" fill="#ff8a8a" letterSpacing="1px">{title}</text>
      {rest.map((l, i) => (
        <text key={l} x={BACKEND.x + 52} y={BACKEND.y + BACKEND.h + 45 + i * 15} fontSize="11" fill="#c08a8a">{l}</text>
      ))}
    </g>
  );
}

// The backend publishing to the entry node over the server API.
function PublishArrow({ lines }) {
  return (
    <g>
      <line className="cf-flow" x1={PUBLISH_FROM[0]} y1={PUBLISH_FROM[1]} x2={PUBLISH_TO[0]} y2={PUBLISH_TO[1]}
        stroke={RED} strokeWidth="1.6" markerEnd="url(#cf-arrow)" />
      <IngressLabels lines={lines} />
    </g>
  );
}

// Broker -> all listed nodes -> all listed clients, the second half of every
// broadcast. `clientsOf(i)` lists the receiving client indexes of node i.
function Broadcast({ nodes, clientsOf, tFan, tDeliver }) {
  return (
    <g>
      {nodes.map((i) => (
        <Parcel key={`fan-${i}`} d={fromBroker(NODES[i])} t0={tFan[0]} t1={tFan[1]} />
      ))}
      {nodes.map((i) => clientsOf(i).map((j) => (
        <Parcel key={`del-${i}-${j}`} d={toClient(NODES[i], NODES[i].clients[j])}
          t0={tDeliver[0] + j * 0.04} t1={tDeliver[1] + j * 0.04} />
      )))}
    </g>
  );
}

const ALL_NODES = NODES.map((_, i) => i);
const ALL_CLIENTS = () => [0, 1, 2, 3];

// ---- Scenarios --------------------------------------------------------------
//
// Every scenario describes how the shared scene behaves:
//   cycle                  loop length in seconds
//   tShard, owner          when and which shard lights up (plus the broker rim)
//   shardFlashes(i)        all flash times of shard i
//   nodeFlashes(i)         flash times of node i
//   client(i, j)           props for client j of node i
//   clientLink(i, j)       { opacity, frames } of a client link
//   brokerLink(i)          { opacity, frames } of a node -> broker link
//   backendFlash           when the backend box lights up (one or more times)
//   brokerOpacity          dims the broker when a scenario does not use it
//   hideBroker, hideBackend  drop the broker or the top backend box
//   under()                extra elements drawn with the links
//   over()                 ingress arrows, labels and parcels

const BROADCAST = (() => {
  const T_PUBLISH = [0.3, 1.0];
  const T_TO_BROKER = [1.2, 1.8];
  const T_FAN_OUT = [2.0, 2.7];
  const T_DELIVER = [2.9, 3.6];
  return {
    title: 'Massive broadcast',
    caption: 'The backend publishes a message to any single Centrifugo node. The broker delivers it to every node, and each node sends it to its connected clients. Nodes and broker shards scale independently.',
    cycle: 5.5,
    owner: 0,
    tShard: T_TO_BROKER[1],
    nodeFlashes: (i) => (i === 0 ? [T_PUBLISH[1], T_FAN_OUT[1]] : [T_FAN_OUT[1]]),
    client: () => ({ flashAt: T_DELIVER[1] }),
    over: () => (
      <g>
        <PublishArrow lines={['PUBLISH', 'server API, HTTP / GRPC', 'to any single node']} />
        <Parcel d={seg(PUBLISH_FROM, PUBLISH_TO)} t0={T_PUBLISH[0]} t1={T_PUBLISH[1]} />
        <Parcel d={toBroker(ENTRY)} t0={T_TO_BROKER[0]} t1={T_TO_BROKER[1]} />
        <Broadcast nodes={ALL_NODES} clientsOf={ALL_CLIENTS} tFan={T_FAN_OUT} tDeliver={T_DELIVER} />
      </g>
    ),
  };
})();

const TARGETED = (() => {
  const T_PUBLISH = [0.3, 1.0];
  const T_TO_BROKER = [1.2, 1.8];
  const T_FAN_OUT = [2.0, 2.7];
  const T_DELIVER = [2.9, 3.6];
  // Subscribers of the channel, by node. The entry node has none.
  const SUBS = { 1: [0, 2], 3: [1, 2, 3], 5: [0], 6: [2, 3] };
  const subNodes = Object.keys(SUBS).map(Number);
  const isSub = (i, j) => (SUBS[i] || []).includes(j);
  return {
    title: 'Targeted broadcast',
    caption: 'A message goes only to subscribers of its channel, marked with a yellow ring. A node subscribes to the channel in the broker only while it has subscribers, so nodes without them get no traffic for it.',
    cycle: 5.5,
    owner: 2,
    tShard: T_TO_BROKER[1],
    nodeFlashes: (i) => (i === 0 ? [T_PUBLISH[1]] : SUBS[i] ? [T_FAN_OUT[1]] : []),
    client: (i, j) => (isSub(i, j) ? { flashAt: T_DELIVER[1], subscribed: true } : { muted: true }),
    clientLink: (i, j) => ({ opacity: isSub(i, j) ? 0.35 : 0.12 }),
    brokerLink: (i) => ({ opacity: i === 0 || SUBS[i] ? 0.6 : 0.15 }),
    over: () => (
      <g>
        <PublishArrow lines={['PUBLISH', 'into channel chat:42', 'to any single node']} />
        <Parcel d={seg(PUBLISH_FROM, PUBLISH_TO)} t0={T_PUBLISH[0]} t1={T_PUBLISH[1]} />
        <Parcel d={toBroker(ENTRY)} t0={T_TO_BROKER[0]} t1={T_TO_BROKER[1]} />
        <Broadcast nodes={subNodes} clientsOf={(i) => SUBS[i]} tFan={T_FAN_OUT} tDeliver={T_DELIVER} />
      </g>
    ),
  };
})();

const PROXY = (() => {
  const P = 1; // the node the sending client is connected to
  const S = 3; // the sending client of that node
  const node = NODES[P];
  const sender = node.clients[S];
  const T_SEND = [0.3, 0.9];
  const T_TO_BACKEND = [1.1, 1.8];
  const T_REPLY = [2.1, 2.8];
  const T_TO_BROKER = [3.0, 3.6];
  const T_FAN_OUT = [3.8, 4.5];
  const T_DELIVER = [4.7, 5.4];
  // Two parallel lanes between the backend and the node: request and reply.
  const anchor = [BACKEND.x + BACKEND.w - 30, BACKEND.y + BACKEND.h];
  const end = edgeOf(node, anchor);
  const len = Math.hypot(end[0] - anchor[0], end[1] - anchor[1]);
  const nx = -(end[1] - anchor[1]) / len;
  const ny = (end[0] - anchor[0]) / len;
  const shift = ([x, y], d) => [x + nx * d, y + ny * d];
  const up = [shift(end, 4), shift(anchor, 4)];
  const down = [shift(anchor, -4), shift(end, -4)];
  return {
    title: 'Publish proxy',
    caption: 'A client publishes to its node, and Centrifugo proxies the request to the backend over HTTP or GRPC. Once the backend allows it, the message is broadcast to all subscribers.',
    cycle: 7,
    owner: 1,
    tShard: T_TO_BROKER[1],
    backendFlash: T_TO_BACKEND[1],
    nodeFlashes: (i) => (i === P ? [T_SEND[1], T_REPLY[1], T_FAN_OUT[1]] : [T_FAN_OUT[1]]),
    client: (i, j) => ({ flashAt: T_DELIVER[1], sendAt: i === P && j === S ? T_SEND[0] : null }),
    over: () => (
      <g>
        <line className="cf-flow" x1={up[0][0]} y1={up[0][1]} x2={up[1][0]} y2={up[1][1]}
          stroke={AMBER} strokeOpacity="0.8" strokeWidth="1.4" markerEnd="url(#cf-arrow-amber)" />
        <line className="cf-flow" x1={down[0][0]} y1={down[0][1]} x2={down[1][0]} y2={down[1][1]}
          stroke={RED} strokeWidth="1.4" markerEnd="url(#cf-arrow)" />
        <text x="498" y="118" fontSize="12" fontWeight="bold" fill={AMBER} letterSpacing="1px" textAnchor="end">PROXY</text>
        <text x="498" y="133" fontSize="11" fill="#c9b27a" textAnchor="end">client publish</text>
        <text x="498" y="148" fontSize="11" fill="#c9b27a" textAnchor="end">HTTP / GRPC</text>
        <Parcel d={fromClient(node, sender)} t0={T_SEND[0]} t1={T_SEND[1]} {...AMBER_PARCEL} />
        <Parcel d={seg(up[0], up[1])} t0={T_TO_BACKEND[0]} t1={T_TO_BACKEND[1]} {...AMBER_PARCEL} />
        <Parcel d={seg(down[0], down[1])} t0={T_REPLY[0]} t1={T_REPLY[1]} />
        <Parcel d={toBroker(node)} t0={T_TO_BROKER[0]} t1={T_TO_BROKER[1]} />
        <Broadcast nodes={ALL_NODES} clientsOf={ALL_CLIENTS} tFan={T_FAN_OUT} tDeliver={T_DELIVER} />
      </g>
    ),
  };
})();

const CONSUMERS = (() => {
  const Q = { w: 180, h: 56 };
  Q.x = CX - Q.w / 2;
  Q.y = 150;
  const T_WRITE = [0.3, 0.9];
  const T_CONSUME = [1.3, 1.8];
  const T_TO_BROKER = [2.0, 2.6];
  const T_FAN_OUT = [2.8, 3.5];
  const T_DELIVER = [3.7, 4.4];
  const writeFrom = [CX, BACKEND.y + BACKEND.h];
  const writeTo = [CX, Q.y];
  const leftOut = [Q.x, Q.y + Q.h / 2];
  const rightOut = [Q.x + Q.w, Q.y + Q.h / 2];
  const leftIn = edgeOf(NODES[0], leftOut);
  const rightIn = edgeOf(NODES[1], rightOut);
  return {
    title: 'Async consumers',
    caption: 'The backend writes events to a queue, such as Kafka or a PostgreSQL outbox table. Centrifugo nodes consume them and broadcast. An outbox write can be part of the same transaction as the business data change.',
    cycle: 6,
    owner: 0,
    tShard: T_TO_BROKER[1],
    nodeFlashes: (i) => (i === 0 ? [T_CONSUME[1], T_FAN_OUT[1]] : [T_FAN_OUT[1]]),
    client: () => ({ flashAt: T_DELIVER[1] }),
    over: () => (
      <g>
        <line className="cf-flow" x1={writeFrom[0]} y1={writeFrom[1]} x2={writeTo[0]} y2={writeTo[1] - 2}
          stroke={RED} strokeWidth="1.6" markerEnd="url(#cf-arrow)" />
        <text x={CX + 10} y="118" fontSize="12" fontWeight="bold" fill="#ff8a8a" letterSpacing="1px">WRITE</text>
        <text x={CX + 10} y="133" fontSize="11" fill="#c08a8a">e.g. in DB transaction</text>
        {[[leftOut, leftIn], [rightOut, rightIn]].map(([a, b]) => (
          <line key={a[0]} className="cf-flow-slow" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
            stroke={AMBER} strokeOpacity="0.7" strokeWidth="1.3" />
        ))}
        <g transform={`translate(${Q.x}, ${Q.y})`}>
          <rect width={Q.w} height={Q.h} rx="10" fill="#1d1a12" stroke={AMBER} strokeOpacity="0.6" strokeWidth="1.2" filter="url(#cf-shadow)" />
          <rect width={Q.w} height={Q.h} rx="10" fill={AMBER} opacity="0">
            <Flash t={T_WRITE[1]} lo="0" hi="0.18" />
          </rect>
          {[0, 1, 2].map((r) => (
            <g key={r} transform={`translate(14, ${13 + r * 11})`}>
              {[0, 1, 2, 3].map((c) => (
                <rect key={c} x={c * 9} width="7" height="7" rx="1.5" fill={AMBER} opacity={0.25 + 0.15 * ((r + c) % 3)} />
              ))}
            </g>
          ))}
          <text x="112" y="25" fontSize="12" fontWeight="bold" fill="#ffffff" textAnchor="middle" letterSpacing="1px">QUEUE</text>
          <text x="112" y="41" fontSize="10.5" fill="#d8c48e" textAnchor="middle">Kafka, PG outbox, …</text>
        </g>
        <Parcel d={seg(writeFrom, writeTo)} t0={T_WRITE[0]} t1={T_WRITE[1]} />
        <Parcel d={seg(leftOut, leftIn)} t0={T_CONSUME[0]} t1={T_CONSUME[1]} {...AMBER_PARCEL} />
        <Parcel d={toBroker(ENTRY)} t0={T_TO_BROKER[0]} t1={T_TO_BROKER[1]} />
        <Broadcast nodes={ALL_NODES} clientsOf={ALL_CLIENTS} tFan={T_FAN_OUT} tDeliver={T_DELIVER} />
      </g>
    ),
  };
})();

const RECOVERY = (() => {
  const F = 4; // the node that fails
  const failed = NODES[F];
  // Its clients move to the neighbour nodes on both sides.
  const NEW_NODE = [3, 3, 5, 5];
  const JITTER = [0, 0.45, 0.2, 0.7];
  const T_DOWN = 0.4;
  const T_PUBLISH = [1.3, 2.0];
  const T_TO_BROKER = [2.2, 2.8];
  const T_FAN_OUT = [3.0, 3.7];
  const T_DELIVER = [3.9, 4.6];
  const T_RECONNECT = 5.0;
  const T_HISTORY = [6.2, 6.7];
  const T_RECOVER = [6.9, 7.4];
  const T_RESEND = [7.6, 8.2];
  const T_UP = 9.0;
  const live = ALL_NODES.filter((i) => i !== F);
  const back = (j) => T_RECONNECT + JITTER[j];
  const linkFade = (from) => [[T_DOWN + 0.1, from], [T_DOWN + 0.5, 0], [T_UP, 0], [T_UP + 0.5, from]];
  const midY = BROKER.y + BROKER.h + 52;
  return {
    title: 'Reconnect & recovery',
    caption: 'A node goes down. Its clients reconnect to other nodes with backoff and jitter. A message published while they were offline stays in the channel history in the broker, so after reconnecting the clients recover what they missed.',
    cycle: 10,
    owner: 0,
    tShard: T_TO_BROKER[1],
    shardFlashes: (i) => (i === 0 ? [T_TO_BROKER[1], T_HISTORY[1]] : []),
    nodeFlashes: (i) => {
      if (i === F) return [];
      const base = i === 0 ? [T_PUBLISH[1], T_FAN_OUT[1]] : [T_FAN_OUT[1]];
      return NEW_NODE.includes(i) ? [...base, T_RECOVER[1]] : base;
    },
    client: (i, j) => (i === F
      ? {
        flashAt: T_RESEND[1] + j * 0.04,
        offline: [[T_DOWN + 0.2 + JITTER[j] * 0.3, 0], [T_DOWN + 0.5 + JITTER[j] * 0.3, 1], [back(j), 1], [back(j) + 0.3, 0]],
      }
      : { flashAt: T_DELIVER[1] }),
    clientLink: (i) => (i === F ? { opacity: 0.35, frames: linkFade(0.35) } : null),
    brokerLink: (i) => (i === F ? { opacity: 0.6, frames: linkFade(0.6) } : null),
    under: () => failed.clients.map((c, j) => {
      const target = NODES[NEW_NODE[j]];
      return (
        <line key={`re-${j}`} x1={c.pos[0]} y1={c.pos[1]} x2={target.center[0]} y2={target.center[1]}
          stroke={RED} strokeWidth="1" strokeOpacity="0">
          <Anim attr="stroke-opacity" frames={[[back(j), 0], [back(j) + 0.3, 0.45], [T_UP, 0.45], [T_UP + 0.5, 0]]} />
        </line>
      );
    }),
    nodeOverlay: () => <NodeDown node={failed} down={T_DOWN} up={T_UP} />,
    over: () => (
      <g>
        <PublishArrow lines={['PUBLISH', 'while some clients', 'are offline']} />
        <Parcel d={seg(PUBLISH_FROM, PUBLISH_TO)} t0={T_PUBLISH[0]} t1={T_PUBLISH[1]} />
        <Parcel d={toBroker(ENTRY)} t0={T_TO_BROKER[0]} t1={T_TO_BROKER[1]} />
        <Broadcast nodes={live} clientsOf={ALL_CLIENTS} tFan={T_FAN_OUT} tDeliver={T_DELIVER} />
        {[3, 5].map((i) => (
          <g key={`rec-${i}`}>
            <Parcel d={toBroker(NODES[i])} t0={T_HISTORY[0]} t1={T_HISTORY[1]} {...AMBER_PARCEL} />
            <Parcel d={fromBroker(NODES[i])} t0={T_RECOVER[0]} t1={T_RECOVER[1]} {...AMBER_PARCEL} />
          </g>
        ))}
        {failed.clients.map((c, j) => (
          <Parcel key={`resend-${j}`} d={toClient(NODES[NEW_NODE[j]], c)}
            t0={T_RESEND[0] + j * 0.04} t1={T_RESEND[1] + j * 0.04} {...AMBER_PARCEL} />
        ))}
        <g fontSize="11.5" fontWeight="bold" letterSpacing="1px" textAnchor="middle">
          <Phase t0={T_DOWN} t1={T_PUBLISH[0] + 0.1} x={CX} y={midY} fill="#ff8a8a">{`${failed.label.toUpperCase()} GOES DOWN`}</Phase>
          <Phase t0={T_PUBLISH[0]} t1={T_RECONNECT} x={CX} y={midY} fill="#c4c4cd">ITS CLIENTS MISS THE MESSAGE</Phase>
          <Phase t0={T_RECONNECT} t1={T_HISTORY[0]} x={CX} y={midY} fill="#e4e4ea">RECONNECT WITH JITTER</Phase>
          <Phase t0={T_HISTORY[0]} t1={T_UP} x={CX} y={midY} fill={AMBER}>RECOVER FROM HISTORY</Phase>
          <Phase t0={T_UP} t1={T_UP + 0.95} x={CX} y={midY} fill="#e4e4ea">{`${failed.label.toUpperCase()} IS BACK`}</Phase>
        </g>
      </g>
    ),
  };
})();


const PRESENCE = (() => {
  // Same channel and subscribers as the targeted broadcast.
  const SUBS = { 1: [0, 2], 3: [1, 2, 3], 5: [0], 6: [2, 3] };
  const isSub = (i, j) => (SUBS[i] || []).includes(j);
  // Clients that go online and offline during the loop: node, client, whether
  // it starts online, and the two moments it toggles. One event every 2 s.
  const CHURN = [
    { i: 2, j: 0, online: false, at: [0.5, 6.5] },
    { i: 3, j: 1, online: true, at: [2.5, 8.5] },
    { i: 6, j: 0, online: false, at: [4.5, 10.5] },
  ];
  const LAG = 1.0; // event at the client -> update reaches the shard
  const churnOf = (i, j) => CHURN.find((c) => c.i === i && c.j === j);
  // Fade between online (on) and offline (off) values of a churning client.
  const onlineFrames = (c, on = 1, off = 0) => {
    const [a0, a1] = c.at;
    const first = c.online ? on : off;
    const second = c.online ? off : on;
    return [[a0, first], [a0 + 0.3, second], [a1, second], [a1 + 0.3, first]];
  };
  const events = CHURN.flatMap((c) => c.at.map((t, n) => ({ c, t, joins: (n === 0) !== c.online })))
    .sort((x, y) => x.t - y.t);
  const START = 8;
  const counts = [START];
  events.forEach((e) => counts.push(counts[counts.length - 1] + (e.joins ? 1 : -1)));
  const valueFrames = (v) => {
    const frames = [];
    events.forEach((e, n) => {
      frames.push([e.t + LAG - 0.08, counts[n] === v ? 1 : 0], [e.t + LAG + 0.08, counts[n + 1] === v ? 1 : 0]);
    });
    return frames;
  };
  const values = [...new Set(counts)].sort();
  const nodeFlashes = {};
  events.forEach((e) => (nodeFlashes[e.c.i] = nodeFlashes[e.c.i] || []).push(e.t + LAG / 2));
  const midY = BROKER.y + BROKER.h + 52;
  const MINUS_PARCEL = { color: '#ff9b9b', glow: 'rgba(254,94,94,0.95)' };
  return {
    title: 'Presence',
    caption: 'Clients come online and go offline all the time. Their nodes report each change to the broker shard that owns the channel, so the online count stays current. The backend or a client can ask who is online at any time.',
    cycle: 12,
    owner: 2,
    tShard: events[0].t + LAG,
    shardFlashes: (i) => (i === 2 ? events.map((e) => e.t + LAG) : []),
    nodeFlashes: (i) => nodeFlashes[i] || [],
    client: (i, j) => {
      const c = churnOf(i, j);
      if (c) return { subscribed: onlineFrames(c), offline: onlineFrames(c, 0, 1) };
      return isSub(i, j) ? { subscribed: true } : { muted: true };
    },
    clientLink: (i, j) => {
      const c = churnOf(i, j);
      if (c) return { opacity: c.online ? 0.35 : 0.12, frames: onlineFrames(c, 0.35, 0.12) };
      return { opacity: isSub(i, j) ? 0.35 : 0.12 };
    },
    brokerLink: (i) => ({ opacity: SUBS[i] || nodeFlashes[i] ? 0.6 : 0.15 }),
    over: () => (
      <g>
        {/* Online counter of the channel, kept on the owning shard */}
        <g transform={`translate(${CX}, ${midY})`}>
          <rect x="-88" y="-17" width="176" height="30" rx="15" fill="#131722" stroke={GREEN} strokeOpacity="0.45" />
          {events.map((e) => (
            <rect key={e.t} x="-88" y="-17" width="176" height="30" rx="15" fill="none"
              stroke={e.joins ? GREEN : RED} strokeWidth="2.5" opacity="0">
              <Flash t={e.t + LAG} lo="0" hi="1" hold={0.8} />
            </rect>
          ))}
          <circle cx="-70" cy="-2" r="4" fill={GREEN} />
          <text x="-59" y="3" fontSize="12.5" fontWeight="bold" fill="#e4e4ea" letterSpacing="0.5px">chat:42</text>
          {values.map((v) => (
            <text key={v} x="74" y="3" fontSize="12.5" fontWeight="bold" fill={GREEN} textAnchor="end" opacity={v === START ? '1' : '0'}>
              {`${v} online`}
              <Anim frames={valueFrames(v)} />
            </text>
          ))}
        </g>
        {events.map((e) => {
          const node = NODES[e.c.i];
          const client = node.clients[e.c.j];
          const color = e.joins ? GREEN : RED;
          // Status label placed outward from the client.
          const [px, py] = client.pos;
          const dx = px - CX;
          const dy = py - CY;
          const len = Math.hypot(dx, dy);
          const lx = px + (dx / len) * 44;
          const ly = py + (dy / len) * 34 + 4;
          return (
            <g key={e.t}>
              {/* Pulse at the client */}
              <circle cx={px} cy={py} r="13" fill="none" stroke={color} strokeWidth="2" opacity="0">
                <Anim attr="r" frames={[[e.t, 13], [e.t + 0.8, 30]]} />
                <Anim frames={[[e.t - 0.01, 0], [e.t, 0.9], [e.t + 0.8, 0]]} />
              </circle>
              <Phase t0={e.t} t1={e.t + 1.6} x={lx} y={ly} fontSize="11" fontWeight="bold" fill={color} textAnchor="middle" letterSpacing="0.5px">
                {e.joins ? 'online' : 'offline'}
              </Phase>
              {/* A client coming online subscribes through its node */}
              {e.joins && <Parcel d={fromClient(node, client)} t0={e.t} t1={e.t + LAG / 2} {...GREEN_PARCEL} />}
              {/* The node updates presence on the shard */}
              <Parcel d={toBroker(node)} t0={e.t + LAG / 2 + 0.05} t1={e.t + LAG}
                label={e.joins ? '+1' : '−1'} {...(e.joins ? GREEN_PARCEL : MINUS_PARCEL)} />
            </g>
          );
        })}
      </g>
    ),
  };
})();


// Route between a node and the backend box at the top: out to a ring between
// nodes and clients, around it, and into the backend from the node's side.
const R_RING = 290;
function ringPath(n, back) {
  const right = n.angle > -90 && n.angle <= 90;
  const endA = right ? -63 : -117;
  const p0 = pt(n.angle, R_NODE + NODE_R);
  const p1 = pt(n.angle, R_RING);
  const p2 = pt(endA, R_RING);
  const p3 = right ? [BACKEND.x + BACKEND.w - 8, BACKEND.y + BACKEND.h - 1] : [BACKEND.x + 8, BACKEND.y + BACKEND.h - 1];
  const sweep = right ? 0 : 1;
  const arc = (to, sw) => `A${R_RING},${R_RING} 0 0 ${sw} ${fmt(to)}`;
  return back
    ? `M${fmt(p3)} L${fmt(p2)} ${arc(p1, 1 - sweep)} L${fmt(p0)}`
    : `M${fmt(p0)} L${fmt(p1)} ${arc(p2, sweep)} L${fmt(p3)}`;
}

// Point at `dist` outward from the scene center, past a client.
function outward([x, y], dist, dy = 0) {
  const ax = x - CX;
  const ay = y - CY;
  const len = Math.hypot(ax, ay);
  return [x + (ax / len) * dist, y + (ay / len) * dist + dy];
}

const SHARED_POLL = (() => {
  const KEYS = [
    { key: 'A', color: AMBER },
    { key: 'B', color: '#5bc8ef' },
    { key: 'C', color: '#c58bef' },
  ];
  const keyOf = (i, j) => (i * 4 + j) % 3;
  const TICKS = [{ t: 0.4, changed: 1 }, { t: 4.4, changed: 0 }];
  const POLL = 0.9; // node -> backend
  const RESP = [1.1, 2.0]; // backend -> node, relative to the tick
  const DELIVER = [2.2, 2.8];
  const midY = BROKER.y + BROKER.h + 52;
  const nClients = NODES.length * 4;
  return {
    title: 'Shared poll',
    caption: 'Clients track items, and each node polls the backend once per cycle for all of them. Backend load depends on nodes and items, not on clients. Only clients tracking a changed item get the update.',
    cycle: 8,
    owner: null,
    tShard: null,
    brokerOpacity: 0.3,
    backendFlash: TICKS.map((k) => k.t + POLL),
    shardFlashes: () => [],
    nodeFlashes: () => TICKS.flatMap((k) => [k.t + 0.05, k.t + RESP[1]]),
    client: (i, j) => {
      const tick = TICKS.find((k) => k.changed === keyOf(i, j));
      return { flashAt: tick ? tick.t + DELIVER[1] : null };
    },
    brokerLink: () => ({ opacity: 0.12 }),
    under: () => (
      <g>
        {NODES.map((n) => (
          <path key={n.angle} className="cf-flow-slow" d={ringPath(n, false)} fill="none"
            stroke={AMBER} strokeOpacity="0.3" strokeWidth="1.2" />
        ))}
      </g>
    ),
    over: () => (
      <g>
        <IngressLabels lines={['SHARED POLL', 'one request per node', 'for all tracked items']} />
        {/* Tracked item of every client */}
        {NODES.map((n, i) => n.clients.map((c, j) => {
          const k = KEYS[keyOf(i, j)];
          const [x, y] = outward(c.pos, 22);
          return (
            <g key={`${i}-${j}`} transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}>
              <circle r="7" fill="#16161c" stroke={k.color} strokeWidth="1.2" />
              <text y="3.3" fontSize="9" fontWeight="bold" fill={k.color} textAnchor="middle">{k.key}</text>
            </g>
          );
        }))}
        <g transform={`translate(${CX}, ${midY})`}>
          <rect x="-104" y="-17" width="208" height="30" rx="15" fill="#1d1a12" stroke={AMBER} strokeOpacity="0.55" />
          <text y="3" fontSize="12" fontWeight="bold" fill="#e4e4ea" textAnchor="middle">
            <tspan fill={AMBER}>{NODES.length} requests</tspan>
            <tspan>{` per cycle, not ${nClients}`}</tspan>
          </text>
        </g>
        {TICKS.map((k) => {
          const item = KEYS[k.changed];
          return (
            <g key={k.t}>
              {NODES.map((n) => (
                <g key={n.angle}>
                  <Parcel d={ringPath(n, false)} t0={k.t} t1={k.t + POLL} label="poll" {...AMBER_PARCEL} />
                  <Parcel d={ringPath(n, true)} t0={k.t + RESP[0]} t1={k.t + RESP[1]} />
                  {n.clients.map((c, j) => (keyOf(NODES.indexOf(n), j) === k.changed ? (
                    <Parcel key={j} d={toClient(n, c)} t0={k.t + DELIVER[0] + j * 0.04} t1={k.t + DELIVER[1] + j * 0.04}
                      label={item.key} color={item.color} glow={item.color} />
                  ) : null))}
                </g>
              ))}
              <Phase t0={k.t + RESP[0]} t1={k.t + 3.6} x={CX} y={midY + 32} fontSize="11" fontWeight="bold"
                letterSpacing="1px" textAnchor="middle" fill={item.color}>
                {`ITEM ${item.key} CHANGED`}
              </Phase>
            </g>
          );
        })}
      </g>
    ),
  };
})();

const MAP = (() => {
  // Subscribers of the map channel, as in the targeted broadcast.
  const SUBS = { 1: [0, 2], 3: [1, 2, 3], 5: [0], 6: [2, 3] };
  const subNodes = Object.keys(SUBS).map(Number);
  const isSub = (i, j) => (SUBS[i] || []).includes(j);
  const X = 3; // node of the client that subscribes
  const XJ = 0;
  const node = NODES[X];
  const joiner = node.clients[XJ];
  const T_ON = 0.4;
  const T_SUB = [0.6, 1.1];
  const T_REQ = [1.3, 1.8];
  const T_SNAP_N = [2.0, 2.5];
  const T_SNAP_C = [2.7, 3.2];
  const T_PUB = [3.9, 4.6];
  const T_PUB_B = [4.8, 5.3];
  const T_FAN = [5.5, 6.1];
  const T_DEL = [6.3, 6.9];
  const T_OFF = 8.3;
  const T_RESET = 8.7;
  const onFrames = (on, off) => [[T_ON, off], [T_ON + 0.3, on], [T_OFF, on], [T_OFF + 0.3, off]];
  const fanNodes = [...new Set([...subNodes, X])];
  const T = { x: CX - 78, y: BROKER.y + BROKER.h + 14, w: 156 };
  const ROWS = [['alice', 'ready'], ['bob', 'away'], ['carol', 'ready']];
  const [lx, ly] = outward(joiner.pos, 40, 4);
  return {
    title: 'Map subscriptions',
    caption: 'Centrifugo keeps a key-value collection in the broker. A client that subscribes gets the current state first, then live updates for changed keys. Good for lobbies, cursors, scoreboards or device fleets.',
    cycle: 9.5,
    owner: 1,
    tShard: T_REQ[1],
    shardFlashes: (i) => (i === 1 ? [T_REQ[1], T_PUB_B[1]] : []),
    nodeFlashes: (i) => {
      if (i === X) return [T_SUB[1], T_SNAP_N[1], T_FAN[1]];
      if (i === 0) return SUBS[0] ? [T_PUB[1], T_FAN[1]] : [T_PUB[1]];
      return SUBS[i] ? [T_FAN[1]] : [];
    },
    client: (i, j) => {
      if (i === X && j === XJ) return { flashAt: T_DEL[1], subscribed: onFrames(1, 0), offline: onFrames(0, 1) };
      return isSub(i, j) ? { flashAt: T_DEL[1], subscribed: true } : { muted: true };
    },
    clientLink: (i, j) => {
      if (i === X && j === XJ) return { opacity: 0.12, frames: onFrames(0.35, 0.12) };
      return { opacity: isSub(i, j) ? 0.35 : 0.12 };
    },
    brokerLink: (i) => ({ opacity: i === 0 || fanNodes.includes(i) ? 0.6 : 0.15 }),
    over: () => (
      <g>
        <PublishArrow lines={['MAP UPDATE', 'set bob = ready', 'server API']} />
        {/* The collection, stored in the broker */}
        <g transform={`translate(${T.x}, ${T.y})`}>
          <rect width={T.w} height="76" rx="9" fill="#131722" stroke={BLUE} strokeOpacity="0.55" filter="url(#cf-shadow)" />
          <text x="10" y="16" fontSize="10.5" fontWeight="bold" fill="#7da6ff" letterSpacing="1px">MAP lobby:7</text>
          <line x1="8" y1="22" x2={T.w - 8} y2="22" stroke={BLUE} strokeOpacity="0.3" />
          {ROWS.map(([k, v], r) => {
            const y = 37 + r * 15;
            const changes = k === 'bob';
            return (
              <g key={k}>
                {changes && (
                  <rect x="4" y={y - 11} width={T.w - 8} height="15" rx="4" fill={BLUE} opacity="0">
                    <Flash t={T_PUB_B[1]} lo="0" hi="0.45" hold={0.9} />
                  </rect>
                )}
                <text x="12" y={y} fontSize="11" fill="#e4e4ea">{k}</text>
                {changes ? (
                  <g>
                    <text x={T.w - 12} y={y} fontSize="11" fill="#8a8a94" textAnchor="end">
                      away
                      <Anim frames={[[T_PUB_B[1] - 0.1, 1], [T_PUB_B[1], 0], [T_RESET, 0], [T_RESET + 0.4, 1]]} />
                    </text>
                    <text x={T.w - 12} y={y} fontSize="11" fill={GREEN} textAnchor="end" opacity="0">
                      ready
                      <Anim frames={[[T_PUB_B[1] - 0.1, 0], [T_PUB_B[1], 1], [T_RESET, 1], [T_RESET + 0.4, 0]]} />
                    </text>
                  </g>
                ) : (
                  <text x={T.w - 12} y={y} fontSize="11" fill={v === 'ready' ? GREEN : '#8a8a94'} textAnchor="end">{v}</text>
                )}
              </g>
            );
          })}
        </g>
        {/* Mini copy of the map next to the new subscriber once it is synced */}
        <g transform={`translate(${lx.toFixed(1)}, ${(ly - 4).toFixed(1)})`} opacity="0">
          <Anim frames={[[T_SNAP_C[1], 0], [T_SNAP_C[1] + 0.25, 1], [T_OFF, 1], [T_OFF + 0.3, 0]]} />
          <rect x="-13" y="-10" width="26" height="20" rx="3" fill="#131722" stroke={BLUE} strokeOpacity="0.8" />
          {[0, 1, 2].map((r) => (
            <line key={r} x1="-8" y1={-4 + r * 5} x2="8" y2={-4 + r * 5} stroke="#8fb3ff" strokeWidth="1.3" />
          ))}
        </g>
        {/* 1. a client subscribes and receives the current state */}
        <Parcel d={fromClient(node, joiner)} t0={T_SUB[0]} t1={T_SUB[1]} />
        <Parcel d={toBroker(node)} t0={T_REQ[0]} t1={T_REQ[1]} />
        <Parcel d={fromBroker(node)} t0={T_SNAP_N[0]} t1={T_SNAP_N[1]} label="state" color="#a9c4ff" glow="rgba(91,141,239,0.95)" />
        <Parcel d={toClient(node, joiner)} t0={T_SNAP_C[0]} t1={T_SNAP_C[1]} label="state" color="#a9c4ff" glow="rgba(91,141,239,0.95)" />
        {/* 2. a key changes and the update goes to every subscriber */}
        <Parcel d={seg(PUBLISH_FROM, PUBLISH_TO)} t0={T_PUB[0]} t1={T_PUB[1]} />
        <Parcel d={toBroker(ENTRY)} t0={T_PUB_B[0]} t1={T_PUB_B[1]} />
        <Broadcast nodes={fanNodes}
          clientsOf={(i) => (i === X ? [...(SUBS[i] || []), XJ] : SUBS[i])} tFan={T_FAN} tDeliver={T_DEL} />
        <g fontSize="11" fontWeight="bold" letterSpacing="1px" textAnchor="middle">
          <Phase t0={T_SUB[0]} t1={T_PUB[0]} x={CX} y={T.y + 98} fill="#a9c4ff">STATE ON SUBSCRIBE</Phase>
          <Phase t0={T_PUB[0]} t1={T_OFF} x={CX} y={T.y + 98} fill="#e4e4ea">LIVE UPDATE OF ONE KEY</Phase>
        </g>
      </g>
    ),
  };
})();


const RPC = (() => {
  // Same lanes as the publish proxy: a client of Node 2 calls the backend.
  const P = 1;
  const S = 3;
  const node = NODES[P];
  const caller = node.clients[S];
  const T_SEND = [0.3, 0.9];
  const T_TO_BACKEND = [1.1, 1.8];
  const T_REPLY = [2.1, 2.8];
  const T_BACK = [3.0, 3.6];
  const anchor = [BACKEND.x + BACKEND.w - 30, BACKEND.y + BACKEND.h];
  const end = edgeOf(node, anchor);
  const len = Math.hypot(end[0] - anchor[0], end[1] - anchor[1]);
  const nx = -(end[1] - anchor[1]) / len;
  const ny = (end[0] - anchor[0]) / len;
  const shift = ([x, y], d) => [x + nx * d, y + ny * d];
  const up = [shift(end, 4), shift(anchor, 4)];
  const down = [shift(anchor, -4), shift(end, -4)];
  const REPLY_PARCEL = { color: '#b5ffc4', glow: 'rgba(91,239,123,0.9)' };
  return {
    title: 'RPC proxy',
    caption: 'A client calls an RPC method over its real-time connection. Centrifugo proxies the call to the backend over HTTP or GRPC and returns the reply to that client only. The broker is not involved.',
    cycle: 5,
    owner: null,
    tShard: null,
    brokerOpacity: 0.3,
    backendFlash: T_TO_BACKEND[1],
    shardFlashes: () => [],
    nodeFlashes: (i) => (i === P ? [T_SEND[1], T_REPLY[1]] : []),
    client: (i, j) => (i === P && j === S ? { flashAt: T_BACK[1] } : {}),
    brokerLink: () => ({ opacity: 0.12 }),
    over: () => (
      <g>
        <line className="cf-flow" x1={up[0][0]} y1={up[0][1]} x2={up[1][0]} y2={up[1][1]}
          stroke={AMBER} strokeOpacity="0.8" strokeWidth="1.4" markerEnd="url(#cf-arrow-amber)" />
        <line className="cf-flow" x1={down[0][0]} y1={down[0][1]} x2={down[1][0]} y2={down[1][1]}
          stroke={GREEN} strokeOpacity="0.8" strokeWidth="1.4" />
        <text x="498" y="118" fontSize="12" fontWeight="bold" fill={AMBER} letterSpacing="1px" textAnchor="end">PROXY</text>
        <text x="498" y="133" fontSize="11" fill="#c9b27a" textAnchor="end">client RPC</text>
        <text x="498" y="148" fontSize="11" fill="#c9b27a" textAnchor="end">HTTP / GRPC</text>
        <Parcel d={fromClient(node, caller)} t0={T_SEND[0]} t1={T_SEND[1]} label="rpc" {...AMBER_PARCEL} />
        <Parcel d={seg(up[0], up[1])} t0={T_TO_BACKEND[0]} t1={T_TO_BACKEND[1]} label="rpc" {...AMBER_PARCEL} />
        <Parcel d={seg(down[0], down[1])} t0={T_REPLY[0]} t1={T_REPLY[1]} label="reply" {...REPLY_PARCEL} />
        <Parcel d={toClient(node, caller)} t0={T_BACK[0]} t1={T_BACK[1]} label="reply" {...REPLY_PARCEL} />
      </g>
    ),
  };
})();

const STREAMS = (() => {
  // The backend takes the broker's place in the middle.
  const BOX = { x: CX - 112, y: CY - 50, w: 224, h: 100 };
  const BOX_CENTER = [CX, CY];
  const SOURCE = { ...BACKEND };
  // Individual streams: node, client, color, open and close moments.
  const STREAMS_ = [
    { i: 0, j: 1, color: AMBER, open: 0.4, close: 6.6 },
    { i: 2, j: 2, color: '#5bc8ef', open: 1.4, close: 7.6, bidi: true },
    { i: 4, j: 0, color: '#c58bef', open: 2.4, close: 8.6 },
    { i: 5, j: 3, color: GREEN, open: 3.4, close: 9.4 },
  ];
  const UP = 0.4;
  const TO_BACKEND = [0.45, 0.95];
  const LIVE = 1.1; // stream is open this long after subscribe
  const EVERY = 0.55; // data frequency
  const streamOf = (i, j) => STREAMS_.find((st) => st.i === i && st.j === j);
  const nodeToBox = (n) => [edgeOf(n, BOX_CENTER), cross(BOX_CENTER, n.center, BOX)];
  const streamPath = (st, up) => {
    const n = NODES[st.i];
    const c = n.clients[st.j];
    const pts = [cross(BOX_CENTER, n.center, BOX), n.center, c.pos];
    if (up) pts.reverse();
    return `M${pts.map(fmt).join(' L')}`;
  };
  // Open stream counter.
  const changes = STREAMS_.flatMap((st) => [{ t: st.open + LIVE, d: 1 }, { t: st.close, d: -1 }]).sort((a, b) => a.t - b.t);
  const counts = [0];
  changes.forEach((c) => counts.push(counts[counts.length - 1] + c.d));
  const values = [...new Set(counts)].sort();
  const valueFrames = (v) => changes.flatMap((c, n) => [[c.t - 0.08, counts[n] === v ? 1 : 0], [c.t + 0.08, counts[n + 1] === v ? 1 : 0]]);
  return {
    title: 'Subscription streams',
    caption: 'Each subscription opens its own GRPC stream to the backend, which sends data to that client only, like tailing logs or relaying a feed. The stream closes on unsubscribe. Streams can be bidirectional.',
    cycle: 10,
    owner: null,
    tShard: null,
    hideBroker: true,
    hideBackend: true,
    shardFlashes: () => [],
    nodeFlashes: (i) => STREAMS_.filter((st) => st.i === i).map((st) => st.open + UP),
    client: (i, j) => {
      const st = streamOf(i, j);
      return st ? { sendAt: st.open } : { muted: true };
    },
    clientLink: (i, j) => ({ opacity: streamOf(i, j) ? 0.35 : 0.14 }),
    under: () => (
      <g>
        {/* GRPC connections from every node to the backend */}
        {NODES.map((n) => {
          const [a, b] = nodeToBox(n);
          return (
            <line key={n.angle} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#c9b27a" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="2,4" />
          );
        })}
        {/* Each open stream as a colored lane */}
        {STREAMS_.map((st) => (
          <path key={st.open} d={streamPath(st, false)} fill="none" stroke={st.color} strokeWidth="2.2" strokeOpacity="0" strokeLinejoin="round">
            <Anim attr="stroke-opacity" frames={[[st.open + LIVE - 0.2, 0], [st.open + LIVE, 0.55], [st.close, 0.55], [st.close + 0.3, 0]]} />
          </path>
        ))}
        {/* External sources feeding the backend */}
        <line className="cf-flow" x1={CX} y1={SOURCE.y + SOURCE.h} x2={CX} y2={BOX.y} stroke={AMBER} strokeOpacity="0.6" strokeWidth="1.4" />
      </g>
    ),
    over: () => (
      <g>
        {/* Sources at the top */}
        <g transform={`translate(${SOURCE.x}, ${SOURCE.y})`}>
          <rect width={SOURCE.w} height={SOURCE.h} rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          <text x={SOURCE.w / 2} y="28" fontSize="13.5" fontWeight="bold" fill="#f2f2f5" textAnchor="middle" letterSpacing="1.5px">DATA SOURCES</text>
          <text x={SOURCE.w / 2} y="50" fontSize="12.5" fill="#c4c4cd" textAnchor="middle">logs, feeds, queries, LLM output</text>
        </g>
        {/* The backend in the middle */}
        <g transform={`translate(${BOX.x}, ${BOX.y})`}>
          <rect width={BOX.w} height={BOX.h} rx="12" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
          {STREAMS_.map((st) => (
            <rect key={st.open} width={BOX.w} height={BOX.h} rx="12" fill="none" stroke={st.color} strokeWidth="1.6" opacity="0">
              <Flash t={st.open + TO_BACKEND[1]} lo="0" hi="0.9" />
            </rect>
          ))}
          <text x={BOX.w / 2} y="32" fontSize="15" fontWeight="bold" fill="#f2f2f5" textAnchor="middle" letterSpacing="2px">YOUR BACKEND</text>
          <text x={BOX.w / 2} y="54" fontSize="12.5" fill="#c4c4cd" textAnchor="middle">GRPC stream per subscription</text>
          <line x1="40" y1="66" x2={BOX.w - 40} y2="66" stroke="#ffffff" strokeOpacity="0.1" />
          {values.map((v) => (
            <text key={v} x={BOX.w / 2} y="86" fontSize="12.5" fontWeight="bold" fill={AMBER} textAnchor="middle" opacity={v === 0 ? '1' : '0'}>
              {`${v} open stream${v === 1 ? '' : 's'}`}
              <Anim frames={valueFrames(v)} />
            </text>
          ))}
        </g>
        {STREAMS_.map((st) => {
          const n = NODES[st.i];
          const c = n.clients[st.j];
          const [a, b] = nodeToBox(n);
          const ticks = [];
          for (let t = st.open + LIVE; t + 1.0 <= st.close; t += EVERY) ticks.push(t);
          const [lx, ly] = outward(c.pos, 44, 4);
          return (
            <g key={st.open}>
              <Parcel d={fromClient(n, c)} t0={st.open} t1={st.open + UP} label="sub" {...AMBER_PARCEL} />
              <Parcel d={seg(a, b)} t0={st.open + TO_BACKEND[0]} t1={st.open + TO_BACKEND[1]} label="sub" {...AMBER_PARCEL} />
              {ticks.map((t) => (
                <Parcel key={t} d={streamPath(st, false)} t0={t} t1={t + 1.0} color={st.color} glow={st.color} />
              ))}
              {st.bidi && ticks.filter((_, n2) => n2 % 2 === 1).map((t) => (
                <Parcel key={`up-${t}`} d={streamPath(st, true)} t0={t + 0.25} t1={t + 1.25} color="#ffffff" glow={st.color} />
              ))}
              <Phase t0={st.close} t1={st.close + 0.9} x={lx} y={ly} fontSize="11" fontWeight="bold" fill="#ff8a8a" textAnchor="middle">
                closed
              </Phase>
              <Phase t0={st.open + LIVE} t1={st.open + LIVE + 1.4} x={lx} y={ly} fontSize="11" fontWeight="bold" fill={st.color} textAnchor="middle">
                {st.bidi ? 'bidi stream' : 'stream'}
              </Phase>
            </g>
          );
        })}
      </g>
    ),
  };
})();

const SCENARIOS = [BROADCAST, TARGETED, PROXY, RPC, CONSUMERS, RECOVERY, SHARED_POLL, MAP, STREAMS, PRESENCE];

// ---- The diagram ------------------------------------------------------------

function Diagram({ s }) {
  const shardFlashes = s.shardFlashes || ((i) => (i === s.owner ? [s.tShard] : []));
  const flashes = NODES.map((_, i) => s.nodeFlashes(i));

  return (
    <svg
      className="cf-arch"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto' }}
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
        <marker id="cf-arrow-amber" markerWidth="9" markerHeight="7" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 9 3, 0 6, 2.2 3" fill={AMBER} />
        </marker>
        <filter id="cf-shadow" x="-30%" y="-30%" width="160%" height="190%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.45" />
        </filter>
        <filter id="cf-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ===== SCENE ===== */}
      <g data-part="bg">
        <rect x="0" y="0" width={W} height={H} fill="url(#cf-bg)" />
        <rect x="0" y="0" width={W} height={H} fill="url(#cf-grid)" />
      </g>
      <g data-part="blobs">
        <circle className="cf-blob" cx={CX} cy={CY} r="300" fill="url(#cf-blob-red)" />
        <circle className="cf-blob" cx={CX} cy={CY} r="170" fill="url(#cf-blob-blue)" style={{ animationDelay: '4s' }} />
      </g>

      {/* Faint rings: the node ring and the client ring */}
      <circle data-part="node-ring" cx={CX} cy={CY} r={R_NODE} fill="none" stroke={RED} strokeOpacity="0.1" strokeWidth="1" strokeDasharray="2,6" />
      <circle data-part="client-ring" cx={CX} cy={CY} r={R_CLIENT} fill="none" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="2,6" />

      {/* ===== LINKS (drawn first, under everything) ===== */}
      {/* client <-> node connections */}
      {NODES.map((n, i) => n.clients.map((c, j) => {
        const l = (s.clientLink && s.clientLink(i, j)) || { opacity: 0.35 };
        return (
          <line key={`${n.angle}-${j}`} data-part="client-link" data-i={i} data-j={j}
            x1={n.center[0]} y1={n.center[1]} x2={c.pos[0]} y2={c.pos[1]}
            stroke={RED} strokeOpacity={l.opacity} strokeWidth="1">
            {l.frames && <Anim attr="stroke-opacity" frames={l.frames} />}
          </line>
        );
      }))}
      {/* node <-> broker connections */}
      {!s.hideBroker && NODES.map((n, i) => {
        const a = edgeOf(n, BROKER_CENTER);
        const b = cross(BROKER_CENTER, n.center, BROKER);
        const l = (s.brokerLink && s.brokerLink(i)) || { opacity: 0.6 };
        return (
          <line key={n.angle} className="cf-flow-slow" data-part="broker-link" data-i={i}
            x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
            stroke={BLUE} strokeOpacity={l.opacity} strokeWidth="1.3">
            {l.frames && <Anim attr="stroke-opacity" frames={l.frames} />}
          </line>
        );
      })}
      {s.under && <g data-part="under">{s.under()}</g>}

      {/* ===== BROKER ===== */}
      {!s.hideBroker && (
      <g data-part="broker" opacity={s.brokerOpacity}>
      <rect x={BROKER.x} y={BROKER.y} width={BROKER.w} height={BROKER.h} rx="12"
        fill="rgba(91,141,239,0.06)" stroke={BLUE} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="5,4" />
      {/* Broker perimeter lights up together with the owning shard */}
      {s.tShard != null && (
        <rect x={BROKER.x - 2} y={BROKER.y - 2} width={BROKER.w + 4} height={BROKER.h + 4} rx="14"
          fill="none" stroke={BLUE} strokeWidth="4" filter="url(#cf-blur)" opacity="0">
          <Flash t={s.tShard} lo="0" hi="0.3" />
        </rect>
      )}
      {s.tShard != null && (
        <rect x={BROKER.x} y={BROKER.y} width={BROKER.w} height={BROKER.h} rx="12"
          fill="none" stroke="#dbe7ff" strokeWidth="1.2" opacity="0">
          <Flash t={s.tShard} lo="0" hi="0.4" />
        </rect>
      )}
      <g transform={`translate(${CX}, ${BROKER.y})`}>
        <rect x="-122" y="-12" width="244" height="24" rx="12" fill="#131722" stroke={BLUE} strokeOpacity="0.4" />
        <text x="0" y="4" fontSize="10.5" fontWeight="bold" fill="#7da6ff" textAnchor="middle" letterSpacing="1.5px">
          BROKER: REDIS CLUSTER / NATS
        </text>
      </g>
      {SHARDS.map((sh, i) => (
        <Shard key={sh.label} shard={sh} flashes={shardFlashes(i)} spinDelay={`${-i * 2.3}s`} />
      ))}
      </g>
      )}

      {/* ===== CENTRIFUGO NODES ===== */}
      {NODES.map((n, i) => (
        <g key={n.angle} data-part="node" data-i={i}>
          <Node node={n} flashAt={flashes[i][0]} spinDelay={`${-i * 0.7}s`} />
        </g>
      ))}
      {/* Nodes lighting up more than once */}
      {NODES.map((n, i) => (
        <g key={n.angle} data-part="node-flash" data-i={i}>
          {flashes[i].slice(1).map((t) => <NodeFlash key={t} node={n} t={t} />)}
        </g>
      ))}
      {s.nodeOverlay && <g data-part="node-overlay">{s.nodeOverlay()}</g>}

      {/* ===== CLIENTS ===== */}
      {NODES.map((n, i) => n.clients.map((c, j) => (
        <g key={`${n.angle}-${j}`} data-part="client" data-i={i} data-j={j}>
          <Client pos={c.pos} kind={c.kind} {...s.client(i, j)} />
        </g>
      )))}

      {/* ===== BACKEND ===== */}
      {!s.hideBackend && (
      <g data-part="backend">
      <g transform={`translate(${BACKEND.x}, ${BACKEND.y})`}>
        <rect width={BACKEND.w} height={BACKEND.h} rx="10" fill="url(#cf-glass)" stroke="url(#cf-glass-stroke)" strokeWidth="1" filter="url(#cf-shadow)" />
        {[].concat(s.backendFlash ?? []).map((t) => (
          <g key={t}>
            <rect width={BACKEND.w} height={BACKEND.h} rx="10" fill={AMBER} opacity="0">
              <Flash t={t} lo="0" hi="0.12" />
            </rect>
            <rect width={BACKEND.w} height={BACKEND.h} rx="10" fill="none" stroke={AMBER} strokeWidth="1.4" opacity="0">
              <Flash t={t} lo="0" hi="0.8" />
            </rect>
          </g>
        ))}
        <line x1="11" y1="1.2" x2={BACKEND.w - 11} y2="1.2" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
        <text x={BACKEND.w / 2} y="28" fontSize="15" fontWeight="bold" fill="#f2f2f5" textAnchor="middle" letterSpacing="2px">
          YOUR BACKEND
        </text>
        <text x={BACKEND.w / 2} y="50" fontSize="13.5" fill="#c4c4cd" textAnchor="middle">
          Any language, any framework
        </text>
      </g>
      </g>
      )}

      {/* ===== INGRESS, LABELS AND PARCELS ===== */}
      <g data-part="over">{s.over()}</g>

      {/* ===== LEGENDS ===== */}
      <g data-part="legend" transform={`translate(16, ${H - 62})`}>
        <rect width="330" height="48" rx="24" fill="#16161c" stroke="url(#cf-glass-stroke)" strokeWidth="1" />
        <g transform="translate(28, 24)"><circle r="10" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" /><ClientIcon kind={0} /></g>
        <g transform="translate(54, 24)"><circle r="10" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" /><ClientIcon kind={1} /></g>
        <g transform="translate(80, 24)"><circle r="10" fill="#1c1c23" stroke="#ffffff" strokeOpacity="0.22" /><ClientIcon kind={2} /></g>
        <text x="102" y="20" fontSize="13" fontWeight="600" fill="#e4e4ea">Browsers, mobile apps, servers</text>
        <text x="102" y="36" fontSize="12" fill="#b4b4be">connected to different nodes</text>
      </g>
      <g data-part="legend" transform={`translate(${W - 16}, ${H - 62})`}>
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

// Used by the video renderer, which stages parts of the scene through the
// data-part attributes above. Nothing here changes the docs page.
export {
  Diagram, SCENARIOS, Clock, NODES, NODE_R, BROKER, SHARDS, SHARD_W, SHARD_H, BACKEND,
  W, H, CX, CY, R_NODE, R_CLIENT, RED, BLUE, GREEN, AMBER,
};

export default function ArchitectureDiagram({ initialTab = 0 }) {
  const [tab, setTab] = useState(initialTab);
  const s = SCENARIOS[tab];
  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist" aria-label="Centrifugo scenarios">
        {SCENARIOS.map((sc, i) => (
          <button
            key={sc.title} type="button" role="tab" aria-selected={i === tab}
            className={i === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab(i)}
          >
            {sc.title}
          </button>
        ))}
      </div>
      <p className={styles.caption}>{s.caption}</p>
      <Clock.Provider value={s.cycle}>
        {/* A new key remounts the SVG, so every scenario starts from t = 0. */}
        <Diagram key={tab} s={s} />
      </Clock.Provider>
    </div>
  );
}
