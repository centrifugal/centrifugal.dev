import React from 'react';

// Why live compression can beat the measured ratio, and when it does not:
// messages written to a connection together are compressed together, so later
// ones reuse earlier ones. Across nodes they arrive one by one unless a short
// write delay collects them again.

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

const ROWS = [
  { title: 'One node', sub: 'a burst is written at once', spread: false, together: true, result: 'better than the measured ratio' },
  { title: 'Several nodes', sub: 'via the broker, one by one', spread: true, together: false, result: 'about the measured ratio' },
  { title: 'Several nodes', sub: 'with client.write_delay', spread: true, together: true, wait: true, result: 'better than measured again' },
];

function Chip({ x, y, n }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width="42" height="22" rx="4" fill={C.card} stroke={C.command} strokeWidth="1.1" />
      <text x="21" y="15" fontSize="10" fill={C.text} textAnchor="middle" fontFamily="monospace">{`pub ${n}`}</text>
    </g>
  );
}

function Marker({ x, y }) {
  return <rect x={x} y={y} width="10" height="22" rx="2" fill={C.accent} opacity="0.85" />;
}

export default function DictionaryBatchingDiagram() {
  const fx = 470;
  return (
    <svg
      viewBox="0 0 720 330"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: C.bg, margin: '1.2rem 0' }}
    >
      <defs>
        <marker id="dict-batch-arr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill={C.muted} />
        </marker>
      </defs>

      <text x="285" y="26" fontSize="11" fontWeight="bold" fill={C.command} textAnchor="middle" fontFamily={FONT}>publications for one connection</text>
      <text x={fx + 115} y="26" fontSize="11" fontWeight="bold" fill={C.accent} textAnchor="middle" fontFamily={FONT}>what is written to it</text>

      {ROWS.map((r, i) => {
        const y = 46 + i * 94;
        const xs = r.spread ? [176, 238, 300, 362] : [176, 222, 268, 314];
        return (
          <g key={i}>
            <rect x="12" y={y - 6} width="696" height="84" rx="8" fill="#1b1f29" stroke="#2c2f3a" />
            <text x="26" y={y + 22} fontSize="12" fontWeight="bold" fill={C.text} fontFamily={FONT}>{r.title}</text>
            <text x="26" y={y + 40} fontSize="10" fill={C.muted} fontFamily={r.wait ? 'monospace' : FONT}>{r.sub}</text>

            {xs.map((x, j) => <Chip key={j} x={x} y={y + 14} n={j + 1} />)}
            {r.spread && !r.wait && xs.map((x, j) => (
              <line key={j} x1={x + 21} y1={y + 38} x2={x + 21} y2={y + 52} stroke={C.muted} strokeWidth="1" />
            ))}
            {r.spread && !r.wait && (
              <text x="290" y={y + 66} fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>each written as soon as it arrives</text>
            )}
            {r.wait && (
              <g>
                <path d={`M 176 ${y + 44} L 176 ${y + 52} L 404 ${y + 52} L 404 ${y + 44}`} fill="none" stroke={C.accent} strokeWidth="1.2" />
                <text x="290" y={y + 66} fontSize="9.5" fill={C.accent} textAnchor="middle" fontFamily={FONT}>held for a few milliseconds, then written together</text>
              </g>
            )}
            {!r.spread && (
              <text x="268" y={y + 66} fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>already queued together</text>
            )}

            <line x1="416" y1={y + 25} x2={fx - 8} y2={y + 25} stroke={C.muted} strokeWidth="1.4" markerEnd="url(#dict-batch-arr)" />

            {r.together ? (
              <g>
                <Marker x={fx} y={y + 14} />
                <rect x={fx + 12} y={y + 14} width="218" height="22" rx="3" fill={C.card} stroke={C.push} strokeWidth="1.1" />
                <text x={fx + 121} y={y + 29} fontSize="10" fill={C.text} textAnchor="middle" fontFamily="monospace">pub 1 · pub 2 · pub 3 · pub 4</text>
                <text x={fx + 121} y={y + 52} fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>one frame: pub 2-4 reuse what pub 1 sent</text>
              </g>
            ) : (
              <g>
                {[0, 1, 2, 3].map(j => (
                  <g key={j}>
                    <Marker x={fx + j * 58} y={y + 14} />
                    <rect x={fx + j * 58 + 12} y={y + 14} width="42" height="22" rx="3" fill={C.card} stroke={C.push} strokeWidth="1.1" />
                    <text x={fx + j * 58 + 33} y={y + 29} fontSize="10" fill={C.text} textAnchor="middle" fontFamily="monospace">{`pub ${j + 1}`}</text>
                  </g>
                ))}
                <text x={fx + 115} y={y + 52} fontSize="9.5" fill={C.muted} textAnchor="middle" fontFamily={FONT}>four frames, each compressed on its own</text>
              </g>
            )}
            <text x={fx + 115} y={y + 68} fontSize="10" fontWeight="bold" fill={r.together ? C.reply : C.text} textAnchor="middle" fontFamily={FONT}>{r.result}</text>
          </g>
        );
      })}
    </svg>
  );
}
