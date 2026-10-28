import React from 'react';

const SOURCES = [
  'PostgreSQL outbox table',
  'Kafka topic',
  'Nats JetStream',
  'Redis Stream',
  'Google Cloud PUB/SUB',
  'AWS SQS',
  'Azure Service Bus',
];

const SUBSCRIBERS = ['Browser', 'Mobile app', 'Any SDK'];

const NOTES = [
  ['At-least-once', 'internal errors retried, others logged'],
  ['JSON payloads only', 'read commands and batch are ignored'],
  ['Many consumers at once', 'each with its own type and mode'],
];

export default function ConsumersDiagram() {
  return (
    <svg
      viewBox="0 0 860 430"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#17171b' }}
    >
      <defs>
        <marker id="cons-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="#fe5e5e" />
        </marker>
        <marker id="cons-arrow-blue" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="#5b8def" />
        </marker>
        <marker id="cons-arrow-amber" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="#d9a05b" />
        </marker>
        <marker id="cons-arrow-green" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="#5bef7b" />
        </marker>

        <linearGradient id="cons-grad-app" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2430" />
          <stop offset="100%" stopColor="#161a22" />
        </linearGradient>
        <linearGradient id="cons-grad-queue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b2419" />
          <stop offset="100%" stopColor="#1d1913" />
        </linearGradient>
        <linearGradient id="cons-grad-centrifugo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2020" />
          <stop offset="100%" stopColor="#1f1515" />
        </linearGradient>
        <linearGradient id="cons-grad-clients" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2620" />
          <stop offset="100%" stopColor="#151d18" />
        </linearGradient>
        <linearGradient id="cons-grad-chip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#222830" />
          <stop offset="100%" stopColor="#1a1e24" />
        </linearGradient>

        <filter id="cons-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#fe5e5e" floodOpacity="0.15" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cons-glow-amber" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#d9a05b" floodOpacity="0.12" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="860" height="430" fill="#17171b" />

      {/* ===== YOUR APPLICATION ===== */}
      <g>
        <rect x="14" y="120" width="140" height="150" rx="10"
          fill="url(#cons-grad-app)" stroke="#5b8def" strokeWidth="1.5" />
        <text x="84" y="142" fontSize="10" fontWeight="bold" fill="#5b8def"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          YOUR APP
        </text>

        <rect x="28" y="156" width="112" height="34" rx="5"
          fill="url(#cons-grad-chip)" stroke="#444" strokeWidth="1" />
        <text x="84" y="177" fontSize="9.5" fill="#ccc" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          Business logic
        </text>

        <rect x="28" y="200" width="112" height="34" rx="5"
          fill="url(#cons-grad-chip)" stroke="#5b8def" strokeWidth="1" />
        <text x="84" y="215" fontSize="9" fill="#9dbcf5" textAnchor="middle"
          fontFamily="monospace">
          INSERT / produce
        </text>
        <text x="84" y="227" fontSize="8" fill="#7f8c9d" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          API command as JSON
        </text>

        <text x="84" y="254" fontSize="8" fill="#7f8c9d" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          no HTTP call to Centrifugo
        </text>
      </g>

      {/* app -> queue */}
      <line x1="156" y1="196" x2="176" y2="196" stroke="#5b8def" strokeWidth="1.5"
        markerEnd="url(#cons-arrow-blue)" />

      {/* ===== QUEUE / STREAM / OUTBOX ===== */}
      <g filter="url(#cons-glow-amber)">
        <rect x="180" y="44" width="210" height="310" rx="10"
          fill="url(#cons-grad-queue)" stroke="#d9a05b" strokeWidth="1.5" />
        <text x="285" y="66" fontSize="10" fontWeight="bold" fill="#d9a05b"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          QUEUE, STREAM OR TABLE
        </text>

        {SOURCES.map((source, i) => (
          <g key={source} transform={`translate(196, ${82 + i * 38})`}>
            <rect width="178" height="32" rx="5"
              fill="url(#cons-grad-chip)" stroke="#4a4335" strokeWidth="1" />
            <circle cx="14" cy="16" r="3.5" fill="#d9a05b" />
            <text x="28" y="20" fontSize="9.5" fill="#ccc" fontFamily="system-ui, sans-serif">
              {source}
            </text>
          </g>
        ))}
      </g>

      {/* queue -> centrifugo */}
      <line x1="392" y1="196" x2="412" y2="196" stroke="#d9a05b" strokeWidth="1.5"
        markerEnd="url(#cons-arrow-amber)" />

      {/* ===== CENTRIFUGO ===== */}
      <g filter="url(#cons-glow-red)">
        <rect x="416" y="44" width="280" height="310" rx="10"
          fill="url(#cons-grad-centrifugo)" stroke="#fe5e5e" strokeWidth="1.5" />
        <text x="556" y="66" fontSize="10" fontWeight="bold" fill="#fe5e5e"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          CENTRIFUGO
        </text>

        {/* consumer worker */}
        <rect x="432" y="84" width="248" height="46" rx="6"
          fill="url(#cons-grad-chip)" stroke="#fe5e5e" strokeWidth="1" />
        <text x="556" y="103" fontSize="10" fontWeight="600" fill="#f0a0a0"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Async consumer
        </text>
        <text x="556" y="119" fontSize="8" fill="#8d7f7f" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          polls or subscribes, retries on internal error
        </text>

        {/* split into two modes */}
        <line x1="556" y1="130" x2="556" y2="140" stroke="#666" strokeWidth="1" />
        <line x1="492" y1="140" x2="620" y2="140" stroke="#666" strokeWidth="1" />
        <line x1="492" y1="140" x2="492" y2="150" stroke="#666" strokeWidth="1"
          markerEnd="url(#cons-arrow)" />
        <line x1="620" y1="140" x2="620" y2="150" stroke="#666" strokeWidth="1"
          markerEnd="url(#cons-arrow)" />

        <rect x="432" y="158" width="120" height="72" rx="6"
          fill="url(#cons-grad-chip)" stroke="#444" strokeWidth="1" />
        <text x="492" y="176" fontSize="9" fontWeight="600" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          API command mode
        </text>
        <text x="492" y="194" fontSize="8" fill="#8a8a8a" textAnchor="middle"
          fontFamily="monospace">
          {'{ "method": ... ,'}
        </text>
        <text x="492" y="205" fontSize="8" fill="#8a8a8a" textAnchor="middle"
          fontFamily="monospace">
          {'"payload": ... }'}
        </text>
        <text x="492" y="221" fontSize="7.5" fill="#6f6f6f" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          message body is the command
        </text>

        <rect x="560" y="158" width="120" height="72" rx="6"
          fill="url(#cons-grad-chip)" stroke="#444" strokeWidth="1" />
        <text x="620" y="176" fontSize="9" fontWeight="600" fill="#ccc"
          textAnchor="middle" fontFamily="system-ui, sans-serif">
          Publication data mode
        </text>
        <text x="620" y="194" fontSize="8" fill="#8a8a8a" textAnchor="middle"
          fontFamily="monospace">
          body = publication
        </text>
        <text x="620" y="205" fontSize="8" fill="#8a8a8a" textAnchor="middle"
          fontFamily="monospace">
          channels in headers
        </text>
        <text x="620" y="221" fontSize="7.5" fill="#6f6f6f" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          for existing producers
        </text>

        <line x1="492" y1="230" x2="492" y2="242" stroke="#666" strokeWidth="1"
          markerEnd="url(#cons-arrow)" />
        <line x1="620" y1="230" x2="620" y2="242" stroke="#666" strokeWidth="1"
          markerEnd="url(#cons-arrow)" />

        {/* command execution */}
        <rect x="432" y="248" width="248" height="66" rx="6"
          fill="url(#cons-grad-chip)" stroke="#fe5e5e" strokeWidth="1" />
        <text x="556" y="268" fontSize="9.5" fill="#f0a0a0" textAnchor="middle"
          fontFamily="monospace">
          publish · broadcast
        </text>
        <text x="556" y="284" fontSize="9.5" fill="#f0a0a0" textAnchor="middle"
          fontFamily="monospace">
          unsubscribe · disconnect
        </text>
        <text x="556" y="303" fontSize="8" fill="#8d7f7f" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          same handlers the HTTP and GRPC API use
        </text>

        <text x="556" y="336" fontSize="8" fill="#7a6c6c" textAnchor="middle"
          fontFamily="system-ui, sans-serif">
          state-changing commands only
        </text>
      </g>

      {/* centrifugo -> clients */}
      <line x1="698" y1="196" x2="714" y2="196" stroke="#5bef7b" strokeWidth="1.5"
        markerEnd="url(#cons-arrow-green)" />

      {/* ===== SUBSCRIBERS ===== */}
      <g>
        <rect x="718" y="110" width="128" height="170" rx="10"
          fill="url(#cons-grad-clients)" stroke="#5bef7b" strokeWidth="1.5" />
        <text x="782" y="132" fontSize="10" fontWeight="bold" fill="#5bef7b"
          textAnchor="middle" letterSpacing="1px" fontFamily="system-ui, sans-serif">
          SUBSCRIBERS
        </text>

        {SUBSCRIBERS.map((client, i) => (
          <g key={client} transform={`translate(732, ${146 + i * 42})`}>
            <rect width="100" height="32" rx="5"
              fill="url(#cons-grad-chip)" stroke="#2f4a38" strokeWidth="1" />
            <text x="50" y="20" fontSize="9.5" fill="#ccc" textAnchor="middle"
              fontFamily="system-ui, sans-serif">
              {client}
            </text>
          </g>
        ))}
      </g>

      {/* ===== NOTES ===== */}
      {NOTES.map(([title, text], i) => (
        <g key={title} transform={`translate(${14 + i * 284}, 372)`}>
          <rect width="272" height="42" rx="7" fill="#1b1b20" stroke="#2e2e36" strokeWidth="1" />
          <text x="16" y="19" fontSize="9" fontWeight="600" fill="#bfbfbf"
            fontFamily="system-ui, sans-serif">
            {title}
          </text>
          <text x="16" y="33" fontSize="8" fill="#7c7c85" fontFamily="system-ui, sans-serif">
            {text}
          </text>
        </g>
      ))}
    </svg>
  );
}
