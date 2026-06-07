import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './AIStreaming.module.css';

// Hook: detect prefers-reduced-motion (SSR-safe — defaults to motion on).
function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

const streamPath = (yL, yR) =>
  `M0,${yL} C250,${yL} 350,210 500,210 S750,${yR} 1000,${yR}`;

// Sharp foreground streams — the token text flows along these.
const FG = [
  { yL: 70, yR: 200, dur: 26 },
  { yL: 150, yR: 95, dur: 31 },
  { yL: 210, yR: 320, dur: 23 },
  { yL: 300, yR: 150, dur: 34 },
  { yL: 350, yR: 270, dur: 28 },
];

// Soft, blurred background field — adds depth, never animates.
const BG = [
  [20, 260], [90, 40], [160, 300], [250, 120], [310, 380],
  [380, 220], [40, 170], [140, 350], [275, 70], [200, 250], [355, 300],
];

// The flowing tokens are the section's own copy.
const PHRASE =
  'Piping tokens straight to the browser works in the demo. Centrifugo keeps it working in production — resumable streams, multi-viewer sessions, transport fallback, and scale across nodes. No per-token billing, your data on your network.';
const SEP = ' · '; // em-space · em-space
const UNIT = PHRASE + SEP;
const FLOW_TEXT = UNIT.repeat(2);

export default function AIStreaming() {
  const reduced = usePrefersReducedMotion();
  const measureRef = React.useRef(null);
  const [unitLen, setUnitLen] = React.useState(0);

  React.useEffect(() => {
    if (measureRef.current) {
      setUnitLen(measureRef.current.getComputedTextLength());
    }
  }, []);

  return (
    <section className={styles.section}>
      <div className={clsx('container', styles.inner)}>
        <div className={styles.text}>
          <span className={styles.eyebrow}>For AI apps</span>
          <h2 className={styles.title}>
            Stream <span className={styles.titleGradient}>AI responses</span> that survive production
          </h2>
          <p className={styles.subtitle}>
            Piping tokens straight to the browser works in the demo. Centrifugo keeps it
            working in production — resumable streams, multi-viewer sessions, transport
            fallback, and scale across nodes. No per-token billing, your data on your network.
          </p>
          <div className={styles.buttons}>
            <Link
              className="button button--outline button--secondary button--lg"
              to={useBaseUrl('docs/getting-started/ai_apps')}
            >
              Centrifugo for AI apps
            </Link>
            <Link to={useBaseUrl('/blog/2026/03/01/scaling-ai-token-streams-with-centrifugo')}>
              Scaling AI token streams →
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.art} aria-hidden="true">
        <svg
          className={styles.svg}
          viewBox="0 0 1000 420"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Tokens of text streaming through Centrifugo and fanning out to many clients"
        >
          <defs>
            <linearGradient id="ais-stream" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fe5e5e" />
              <stop offset="50%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="ais-text" x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fe7a7a" />
              <stop offset="50%" stopColor="#c89cff" />
              <stop offset="100%" stopColor="#6cc4f5" />
            </linearGradient>
            {/* Nebula palette */}
            <radialGradient id="ais-neb-a" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fe5e5e" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fe5e5e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ais-neb-b" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ais-neb-c" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ais-neb-d" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff8fc0" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ff8fc0" stopOpacity="0" />
            </radialGradient>
            {/* Soft circular reveal so the nebula fades into the page (no hard edge) */}
            <radialGradient id="ais-neb-fade" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="62%" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="ais-neb-mask">
              <circle cx="500" cy="210" r="146" fill="url(#ais-neb-fade)" />
            </mask>
            <filter id="ais-soft">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>

            {/* Horizontal fade so tokens emerge / dissolve at the edges instead of being cut. */}
            <linearGradient id="ais-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.13" stopColor="#fff" />
              <stop offset="0.87" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
            {/* Radial hole: text dissolves as it nears the core, re-emerges past it */}
            <radialGradient id="ais-hole" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000" stopOpacity="1" />
              <stop offset="55%" stopColor="#000" stopOpacity="1" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <mask id="ais-mask">
              <rect x="0" y="0" width="1000" height="420" fill="url(#ais-fade)" />
            </mask>
            <mask id="ais-text-mask">
              <rect x="0" y="0" width="1000" height="420" fill="url(#ais-fade)" />
              <circle cx="500" cy="210" r="108" fill="url(#ais-hole)" />
            </mask>

            {/* Foreground path geometry (referenced by the textPaths) */}
            {FG.map(({ yL, yR }, i) => (
              <path key={i} id={`ais-fg-${i}`} d={streamPath(yL, yR)} />
            ))}
          </defs>

          {/* Hidden ruler: one repetition, measured at runtime for a seamless loop. */}
          <text ref={measureRef} className={styles.tokens} x="0" y="-100" opacity="0">
            {UNIT}
          </text>

          <g mask="url(#ais-mask)">
            {/* Background depth field — blurred, faint, static */}
            <g filter="url(#ais-soft)" stroke="url(#ais-stream)" fill="none" strokeLinecap="round">
              {BG.map(([yL, yR], i) => (
                <path key={i} d={streamPath(yL, yR)} strokeWidth="0.8" strokeOpacity="0.08" />
              ))}
            </g>

            {/* Foreground wires (conduits into the core) */}
            {FG.map(({ yL, yR }, i) => (
              <path key={i} d={streamPath(yL, yR)} fill="none" stroke="url(#ais-stream)" strokeWidth="0.8" strokeOpacity="0.14" strokeLinecap="round" />
            ))}
          </g>

          {/* Flowing token text — dissolves into the core and re-emerges past it */}
          <g mask="url(#ais-text-mask)">
            {FG.map(({ dur }, i) => (
              <text key={i} className={styles.tokens} fill="url(#ais-text)" fillOpacity="0.85">
                <textPath xlinkHref={`#ais-fg-${i}`} startOffset={unitLen ? -unitLen : 0}>
                  {!reduced && unitLen > 0 && (
                    <animate
                      attributeName="startOffset"
                      from={-unitLen}
                      to="0"
                      dur={`${dur}s`}
                      repeatCount="indefinite"
                      calcMode="linear"
                    />
                  )}
                  {FLOW_TEXT}
                </textPath>
              </text>
            ))}
          </g>

          {/* Core nebula — tokens dissolve into a slow drifting cloud and stream back out */}
          <g mask="url(#ais-neb-mask)">
            {/* drifting coloured gas, slowly rotating as a whole */}
            <g>
              {!reduced && (
                <animateTransform attributeName="transform" type="rotate" from="0 500 210" to="360 500 210" dur="80s" repeatCount="indefinite" />
              )}
              <circle cx="479" cy="192" r="81" fill="url(#ais-neb-a)">
                {!reduced && <animate attributeName="opacity" values="0.55;0.9;0.55" dur="9s" repeatCount="indefinite" />}
              </circle>
              <circle cx="527" cy="228" r="73" fill="url(#ais-neb-b)">
                {!reduced && <animate attributeName="opacity" values="0.5;0.85;0.5" dur="11s" repeatCount="indefinite" />}
              </circle>
              <circle cx="515" cy="183" r="59" fill="url(#ais-neb-c)">
                {!reduced && <animate attributeName="opacity" values="0.4;0.7;0.4" dur="13s" repeatCount="indefinite" />}
              </circle>
              <circle cx="479" cy="234" r="56" fill="url(#ais-neb-d)">
                {!reduced && <animate attributeName="opacity" values="0.45;0.75;0.45" dur="10s" repeatCount="indefinite" />}
              </circle>
            </g>

            {/* faint stars scattered through the cloud */}
            <g fill="#ffffff">
              <circle cx="462" cy="178" r="1.2" opacity="0.7">
                {!reduced && <animate attributeName="opacity" values="0.25;0.8;0.25" dur="3.5s" repeatCount="indefinite" />}
              </circle>
              <circle cx="538" cy="196" r="1" opacity="0.55" />
              <circle cx="512" cy="246" r="1.3" opacity="0.6">
                {!reduced && <animate attributeName="opacity" values="0.2;0.7;0.2" dur="4.5s" repeatCount="indefinite" />}
              </circle>
              <circle cx="488" cy="218" r="0.9" opacity="0.5" />
              <circle cx="530" cy="234" r="1" opacity="0.45">
                {!reduced && <animate attributeName="opacity" values="0.2;0.6;0.2" dur="5.5s" repeatCount="indefinite" />}
              </circle>
              <circle cx="482" cy="200" r="0.8" opacity="0.4" />
              <circle cx="548" cy="222" r="0.9" opacity="0.5">
                {!reduced && <animate attributeName="opacity" values="0.2;0.65;0.2" dur="4s" repeatCount="indefinite" />}
              </circle>
            </g>
          </g>
        </svg>
      </div>
    </section>
  );
}
