import React from 'react';

// The heartbeat as a timeline. Server pings on a fixed interval; the client
// answers. If a ping fails to arrive within interval + slack, the client
// declares the link dead and reconnects — broken connections are detected
// even when no real data flows.

const C = {
  bg: '#17171b',
  ping: '#f5c451',
  reply: '#5bef7b',
  push: '#fe5e5e',
  muted: '#888',
  text: '#ccc',
};

export default function ProtocolPingPongDiagram() {
  const axisY = 98;
  const x0 = 40;
  const x1 = 670;
  // ping ticks
  const ticks = [120, 260, 400]; // received pings
  const missed = 540; // expected-but-missing ping

  return (
    <svg
      viewBox="0 0 710 228"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="pp-arr" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill={C.muted} />
        </marker>
      </defs>

      <text x="40" y="28" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="system-ui, sans-serif">Connection timeline</text>
      <text x="670" y="28" fontSize="11" fill={C.muted} textAnchor="end" fontFamily="system-ui, sans-serif">time →</text>

      {/* axis */}
      <line x1={x0} y1={axisY} x2={x1} y2={axisY} stroke="#33343c" strokeWidth="2" markerEnd="url(#pp-arr)" />

      {/* received pings */}
      {ticks.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={axisY} x2={x} y2={axisY - 28} stroke={C.ping} strokeWidth="2" />
          <circle cx={x} cy={axisY - 28} r="5" fill={C.ping} />
          <text x={x} y={axisY - 38} fontSize="10" fill={C.ping} textAnchor="middle" fontFamily="monospace">ping</text>
          <line x1={x} y1={axisY} x2={x} y2={axisY + 22} stroke={C.reply} strokeWidth="1.4" strokeDasharray="3,3" />
          <text x={x} y={axisY + 36} fontSize="9" fill={C.reply} textAnchor="middle" fontFamily="monospace">pong</text>
        </g>
      ))}

      {/* interval brace */}
      <line x1={ticks[0]} y1={axisY + 56} x2={ticks[1]} y2={axisY + 56} stroke={C.muted} strokeWidth="1" />
      <text x={(ticks[0] + ticks[1]) / 2} y={axisY + 70} fontSize="10" fill={C.muted} textAnchor="middle" fontFamily="system-ui, sans-serif">ping interval (e.g. 25s)</text>

      {/* missed ping window */}
      <rect x={ticks[2]} y={axisY - 30} width={missed + 60 - ticks[2]} height="60" rx="6" fill={C.push} opacity="0.10" />
      <line x1={missed} y1={axisY} x2={missed} y2={axisY - 28} stroke={C.push} strokeWidth="2" strokeDasharray="3,3" />
      <text x={missed} y={axisY - 38} fontSize="10" fill={C.push} textAnchor="middle" fontFamily="monospace">no ping</text>
      <text x={missed} y={axisY - 50} fontSize="14" fill={C.push} textAnchor="middle">✕</text>

      <line x1={missed + 60} y1={axisY - 12} x2={missed + 60} y2={axisY + 12} stroke={C.push} strokeWidth="2" />
      <text x={missed + 60} y={axisY - 20} fontSize="10.5" fill={C.push} textAnchor="middle" fontWeight="bold" fontFamily="system-ui, sans-serif">reconnect</text>
      <text x={(ticks[2] + missed + 60) / 2} y={axisY + 70} fontSize="10" fill={C.push} textAnchor="middle" fontFamily="system-ui, sans-serif">interval + slack elapsed → link is dead</text>
    </svg>
  );
}
