import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './proNumbers.module.css';

// Measured results of PRO's resource options, each linked to where it was
// measured. Every figure here must match its source.
const ROWS = [
    {
        title: 'Connections and bandwidth',
        cards: [
            {
                value: '2x',
                label: 'less CPU for idle connections',
                gradient: 'text-gradient-coral',
                before: { name: 'Default', value: 0.94, text: '0.94 cores' },
                after: { name: 'PRO', value: 0.45, text: '0.45 cores' },
                note: '200,000 idle connections',
                link: '/blog/2026/08/17/tuning-idle-connections',
            },
            {
                value: '2.5x',
                label: 'less memory per connection',
                gradient: 'text-gradient-warm',
                before: { name: 'Default', value: 27, text: '27 KB' },
                after: { name: 'PRO', value: 11, text: '11 KB' },
                note: 'A million connections on one node',
                link: '/blog/2026/08/17/tuning-idle-connections',
            },
            {
                value: '4.6x',
                label: 'less bandwidth for JSON',
                gradient: 'text-gradient-cool',
                before: { name: 'Plain', value: 807, text: '807 B' },
                after: { name: 'PRO', value: 175, text: '175 B' },
                note: 'Per message, varies by payload',
                link: '/docs/pro/bandwidth_optimizations#what-egress-metrics-show',
            },
        ],
    },
    {
        title: 'Publishing',
        cards: [
            {
                value: '5x',
                label: 'less CPU for broadcasts',
                gradient: 'text-gradient-coral',
                before: { name: 'OSS', value: 0.88, text: '0.88 cores' },
                after: { name: 'PRO', value: 0.15, text: '0.15 cores' },
                note: '1,000 channels, 100k publications/s',
                link: '/docs/pro/performance#faster-publishing',
            },
            {
                value: '1.6x',
                label: 'less CPU with batched writes',
                gradient: 'text-gradient-warm',
                before: { name: 'Default', value: 1.76, text: '1.76 cores' },
                after: { name: 'PRO', value: 1.12, text: '1.12 cores' },
                note: '1,000 subscribers × 100 msg/s',
                link: '/docs/pro/client_message_batching',
            },
            {
                value: '2.9x',
                label: 'less CPU for batch publishing',
                gradient: 'text-gradient-cool',
                before: { name: 'OSS', value: 0.26, text: '0.26 cores' },
                after: { name: 'PRO', value: 0.09, text: '0.09 cores' },
                note: '100 publications with history',
                link: '/docs/pro/performance#faster-publishing',
            },
        ],
    },
    {
        title: 'Redis at scale',
        cards: [
            {
                calculator: 'nodeGrouped',
                label: 'fewer Redis Cluster connections',
                gradient: 'text-gradient-coral',
                link: '/docs/pro/scalability#node-grouped-sharded-pubsub',
            },
            {
                value: '3x',
                label: 'fewer Redis calls on reconnect',
                gradient: 'text-gradient-warm',
                before: { name: 'Default', value: 10000, text: '10,000' },
                after: { name: 'PRO', value: 2952, text: '2,952' },
                note: '10,000 clients recover at once',
                link: '/docs/pro/scalability#singleflight',
            },
            {
                value: '1',
                label: 'position check per channel',
                gradient: 'text-gradient-cool',
                before: { name: 'Default', value: 20009, text: '20,009' },
                after: { name: 'PRO', value: 4, text: '4' },
                note: 'Instead of one per subscriber',
                link: '/docs/pro/scalability#shared-position-sync',
            },
        ],
    },
];

// useReveal decides how the bars appear. Rendered on the server, and on a
// section already on screen, they are simply drawn at their size. Only a
// section that starts below the fold collapses them, to grow them once it
// scrolls into view, so nothing depends on the animation running.
function useReveal() {
    const ref = useRef(null);
    const [phase, setPhase] = useState('static');
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            return undefined;
        }
        if (el.getBoundingClientRect().top < window.innerHeight) {
            return undefined;
        }
        setPhase('hidden');
        const observer = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) {
                setPhase('shown');
                observer.disconnect();
            }
        }, { threshold: 0.3 });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return [ref, phase];
}

function Bar({ name, text, width, accent, phase, live }) {
    return (
        <div className={styles.barRow}>
            <span className={styles.barName}>{name}</span>
            <div className={styles.barTrack}>
                <div
                    className={clsx(styles.bar, accent && styles.barAccent, phase === 'shown' && styles.barGrow, live && styles.barLive)}
                    style={{ width: phase === 'hidden' ? 0 : `${width}%` }}
                />
            </div>
            <span className={clsx(styles.barValue, accent && styles.barValueAccent)}>{text}</span>
        </div>
    );
}

function Card({ n, phase }) {
    return (
        <Link className={styles.card} to={n.link}>
            <div className={clsx(styles.value, 'text-gradient', n.gradient)}>{n.value}</div>
            <div className={styles.label}>{n.label}</div>
            <div className={styles.bars}>
                <Bar {...n.before} width={100} phase={phase} />
                <Bar {...n.after} width={Math.max(2, 100 * n.after.value / n.before.value)} accent phase={phase} />
            </div>
            <div className={styles.note}>{n.note}</div>
            <span className={styles.link}>How it was measured →</span>
        </Link>
    );
}

const CENTRIFUGO_NODES = [10, 20, 50, 100, 200, 500, 1000];
const REDIS_NODES = [3, 6, 9, 12, 24, 48];
const PARTITIONS = 128;

function Stepper({ label, values, index, onChange }) {
    return (
        <label className={styles.stepper}>
            <span className={styles.stepperLabel}>{label}</span>
            <input
                type="range"
                className={styles.range}
                min={0}
                max={values.length - 1}
                value={index}
                onChange={e => onChange(Number(e.target.value))}
            />
            <span className={styles.stepperValue}>{values[index].toLocaleString('en-US')}</span>
        </label>
    );
}

function ratio(x) {
    return x >= 10 ? `${Math.round(x)}x` : `${Math.round(x * 10) / 10}x`;
}

// NodeGroupedCard computes PUB/SUB connections from the deployment size: one
// per partition on every Centrifugo node, or one per Redis node with
// node-grouped PUB/SUB.
function NodeGroupedCard({ n, phase }) {
    const [nodes, setNodes] = useState(4);
    const [redis, setRedis] = useState(1);
    const before = CENTRIFUGO_NODES[nodes] * PARTITIONS;
    const after = CENTRIFUGO_NODES[nodes] * Math.min(REDIS_NODES[redis], PARTITIONS);
    return (
        <div className={styles.card}>
            <div className={clsx(styles.value, 'text-gradient', n.gradient)}>{ratio(before / after)}</div>
            <div className={styles.label}>{n.label}</div>
            <div className={styles.bars}>
                <Bar name="Default" text={before.toLocaleString('en-US')} width={100} phase={phase} />
                <Bar name="PRO" text={after.toLocaleString('en-US')} width={Math.max(2, 100 * after / before)} accent phase={phase} live />
            </div>
            <div className={styles.controls}>
                <Stepper label="Centrifugo nodes" values={CENTRIFUGO_NODES} index={nodes} onChange={setNodes} />
                <Stepper label="Redis nodes" values={REDIS_NODES} index={redis} onChange={setRedis} />
                <div className={styles.controlsNote}>PUB/SUB connections, {PARTITIONS} partitions</div>
            </div>
            <Link className={styles.link} to={n.link}>How it is computed →</Link>
        </div>
    );
}

export default function ProNumbers() {
    const [ref, phase] = useReveal();
    return (
        <section className={styles.section} ref={ref}>
            <div className={styles.inner}>
                <div className={styles.header}>
                    <span className={styles.eyebrow}>Measured</span>
                    <h2 className={styles.heading}>Cheaper to run</h2>
                    <p className={styles.subheading}>
                        Less CPU, memory and bandwidth for the same load.
                    </p>
                </div>
                {ROWS.map(row => (
                    <div key={row.title} className={styles.row}>
                        <h3 className={styles.rowTitle}>{row.title}</h3>
                        <div className={styles.grid}>
                            {row.cards.filter(n => !n.pending).map(n => (n.calculator === 'nodeGrouped'
                                ? <NodeGroupedCard key={n.label} n={n} phase={phase} />
                                : <Card key={n.label} n={n} phase={phase} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
