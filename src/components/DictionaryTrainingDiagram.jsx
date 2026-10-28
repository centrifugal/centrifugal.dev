import React from 'react';

// The life of a dictionary: a training session whose last quarter is held
// back, a build scored against that held-back traffic, a human review, an
// activation, and monitoring that says when to train again.

const C = {
  bg: '#17171b',
  command: '#5b8def',
  reply: '#5bef7b',
  push: '#fe5e5e',
  accent: '#f5c451',
  muted: '#888',
  text: '#ccc',
  card: '#23242b',
};

const FONT = 'system-ui, sans-serif';

const STEPS = [
  { title: 'Build', color: C.command, lines: ['every size on the ladder,', 'scored on the control', 'window: a size and values', 'come back recommended'] },
  { title: 'Review', color: C.accent, lines: ['untick any value not fit', 'for everyone the profile', 'reaches; a shape-only', 'session has none to read'] },
  { title: 'Activate', color: C.reply, lines: ['a version for the profile:', 'JSON and Protobuf', 'together, optionally to a', 'share of new connections'] },
  { title: 'Monitor', color: C.push, lines: ['live ratio next to the', 'measured one; falling', 'below it means your', 'messages changed'] },
];

export default function DictionaryTrainingDiagram() {
  const bx = 20;
  const bw = 680;
  const split = bx + bw * 0.75;
  const sw = 152;
  const gap = (bw - 4 * sw) / 3;
  const sy = 140;
  const sh = 116;
  return (
    <svg
      viewBox="0 0 720 304"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="dict-train-arr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill={C.muted} />
        </marker>
      </defs>

      {/* the session timeline */}
      <text x={bx} y="26" fontSize="12" fontWeight="bold" fill={C.text} fontFamily={FONT}>Training session</text>
      <text x={bx + bw} y="26" fontSize="10" fill={C.muted} textAnchor="end" fontFamily={FONT}>a minute to 24 hours, chosen when you start it</text>
      <rect x={bx} y="38" width={split - bx} height="40" rx="6" fill="#1b2a44" stroke={C.command} strokeWidth="1.2" />
      <text x={(bx + split) / 2} y="56" fontSize="11.5" fill={C.text} textAnchor="middle" fontFamily={FONT}>sample connections: shapes, and values if you asked for them</text>
      <text x={(bx + split) / 2} y="71" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily={FONT}>what the dictionary is built from</text>
      <rect x={split + 4} y="38" width={bx + bw - split - 4} height="40" rx="6" fill="#2f2a1b" stroke={C.accent} strokeWidth="1.2" />
      <text x={(split + bx + bw) / 2 + 2} y="56" fontSize="11.5" fill={C.accent} textAnchor="middle" fontFamily={FONT}>control window</text>
      <text x={(split + bx + bw) / 2 + 2} y="71" fontSize="10" fill={C.muted} textAnchor="middle" fontFamily={FONT}>last quarter, held back</text>

      {/* both halves feed the build */}
      <path d={`M ${(bx + split) / 2} 80 L ${(bx + split) / 2} 104 L ${bx + sw / 2 + 8} 104 L ${bx + sw / 2 + 8} ${sy - 4}`} fill="none" stroke={C.command} strokeWidth="1.3" markerEnd="url(#dict-train-arr)" />
      <path d={`M ${(split + bx + bw) / 2} 80 L ${(split + bx + bw) / 2} 116 L ${bx + sw / 2 - 8} 116 L ${bx + sw / 2 - 8} ${sy - 4}`} fill="none" stroke={C.accent} strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#dict-train-arr)" />
      <text x={(split + bx + bw) / 2 - 8} y="111" fontSize="9.5" fill={C.accent} textAnchor="end" fontFamily={FONT}>measures it</text>
      <text x={(bx + split) / 2 + 8} y="99" fontSize="9.5" fill={C.command} fontFamily={FONT}>builds it</text>

      {STEPS.map((s, i) => {
        const x = bx + i * (sw + gap);
        return (
          <g key={s.title}>
            <rect x={x} y={sy} width={sw} height={sh} rx="7" fill={C.card} stroke={s.color} strokeWidth="1.2" />
            <text x={x + 12} y={sy + 22} fontSize="12" fontWeight="bold" fill={s.color} fontFamily={FONT}>{s.title}</text>
            {s.lines.map((l, j) => (
              <text key={j} x={x + 12} y={sy + 44 + j * 16} fontSize="10" fill={C.text} fontFamily={FONT}>{l}</text>
            ))}
            {i < STEPS.length - 1 && (
              <line x1={x + sw + 3} y1={sy + sh / 2} x2={x + sw + gap - 3} y2={sy + sh / 2} stroke={C.muted} strokeWidth="1.4" markerEnd="url(#dict-train-arr)" />
            )}
          </g>
        );
      })}

      {/* retrain loop */}
      <path
        d={`M ${bx + 3 * (sw + gap) + sw / 2} ${sy + sh + 2} L ${bx + 3 * (sw + gap) + sw / 2} 290 L 9 290 L 9 58 L ${bx - 2} 58`}
        fill="none"
        stroke={C.muted}
        strokeWidth="1.3"
        strokeDasharray="4 3"
        markerEnd="url(#dict-train-arr)"
      />
      <text x="360" y="284" fontSize="10.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>Retrain: another session over the same connections. Nothing activates on its own.</text>
    </svg>
  );
}
