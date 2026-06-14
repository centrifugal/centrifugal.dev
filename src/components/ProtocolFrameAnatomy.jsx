import React from 'react';

// Anatomy of the synchronous half of the protocol, shown by example: two core
// exchanges — connect (the handshake) and subscribe (the workhorse). Each frame
// is an id plus one payload; each reply echoes the command's id so the two are
// paired. A reply carries the matching result, or an error on failure.
// Asynchronous pushes are a separate story — see ProtocolPushDiagram.

const C = {
  bg: '#17171b',
  command: '#5b8def',
  reply: '#5bef7b',
  error: '#fe5e5e',
  id: '#f5c451',
  muted: '#888',
  text: '#ccc',
  slot: '#23242b',
};

const CMD_X = 40;
const REP_X = 380;
const BOX_W = 300;
const BOX_H = 48;

function Frame({ x, y, fillBg, color, id, method, payload }) {
  const cy = y + BOX_H / 2;
  return (
    <g>
      <rect x={x} y={y} width={BOX_W} height={BOX_H} rx="11" fill={fillBg} stroke={color} strokeWidth="1.5" />
      {/* id badge */}
      <rect x={x + 14} y={cy - 11} width="44" height="22" rx="6" fill={C.slot} stroke={C.id} strokeWidth="1" />
      <text x={x + 36} y={cy + 4} fontSize="11" fill={C.id} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`id ${id}`}</text>
      {/* payload */}
      <text x={x + 72} y={cy + 4} fontFamily="monospace" fontSize="12.5">
        <tspan fill={color} fontWeight="bold">{method}</tspan>
        <tspan fill={C.muted}>{`  ${payload}`}</tspan>
      </text>
    </g>
  );
}

function Link({ y }) {
  return (
    <line
      x1={CMD_X + BOX_W} y1={y} x2={REP_X} y2={y}
      stroke={C.id} strokeWidth="1.6" strokeDasharray="4,3"
      markerStart="url(#anat-link-start)" markerEnd="url(#anat-link)"
    />
  );
}

const ROW_A = 42;
const ROW_B = 98;

export default function ProtocolFrameAnatomy() {
  return (
    <svg
      viewBox="0 0 720 214"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="anat-link" markerWidth="9" markerHeight="8" refX="7.5" refY="4" orient="auto">
          <polygon points="0 0, 9 4, 0 8" fill={C.id} />
        </marker>
        <marker id="anat-link-start" markerWidth="9" markerHeight="8" refX="1.5" refY="4" orient="auto">
          <polygon points="9 0, 0 4, 9 8" fill={C.id} />
        </marker>
      </defs>

      {/* column headers */}
      <text x={CMD_X} y="24" fontSize="14" fontWeight="bold" fill={C.command} fontFamily="system-ui, sans-serif">Command</text>
      <text x={CMD_X + BOX_W} y="24" fontSize="11" fill={C.muted} textAnchor="end" fontFamily="system-ui, sans-serif">client → server</text>
      <text x={REP_X} y="24" fontSize="14" fontWeight="bold" fill={C.reply} fontFamily="system-ui, sans-serif">Reply</text>
      <text x={REP_X + BOX_W} y="24" fontSize="11" fill={C.muted} textAnchor="end" fontFamily="system-ui, sans-serif">server → client</text>

      {/* Row A — connect handshake */}
      <Frame x={CMD_X} y={ROW_A} fillBg="#1b1f29" color={C.command} id={1} method="connect" payload="{ token }" />
      <Frame x={REP_X} y={ROW_A} fillBg="#1a221b" color={C.reply} id={1} method="connect" payload="{ client, ping }" />
      <Link y={ROW_A + BOX_H / 2} />

      {/* Row B — subscribe */}
      <Frame x={CMD_X} y={ROW_B} fillBg="#1b1f29" color={C.command} id={2} method="subscribe" payload="{ channel }" />
      <Frame x={REP_X} y={ROW_B} fillBg="#1a221b" color={C.reply} id={2} method="subscribe" payload="{ epoch, offset }" />
      <Link y={ROW_B + BOX_H / 2} />

      {/* side notes */}
      <text x={CMD_X + 14} y="170" fontSize="10.5" fill={C.muted} fontFamily="system-ui, sans-serif">
        + publish · unsubscribe · history · rpc · send · …
      </text>
      <text x={REP_X + BOX_W} y="170" fontSize="10.5" textAnchor="end" fontFamily="monospace">
        <tspan fill={C.muted}>result · or </tspan>
        <tspan fill={C.error} fontWeight="bold">error</tspan>
        <tspan fill={C.muted}> {'{ code, message }'}</tspan>
      </text>

      {/* bottom caption */}
      <text x="360" y="200" fontSize="11.5" fill={C.id} textAnchor="middle" fontFamily="system-ui, sans-serif">
        each command gets a fresh <tspan fontFamily="monospace" fontWeight="bold">id</tspan>; the reply echoes it back ⇒ the two are paired
      </text>
    </svg>
  );
}
