import React from 'react';
import Link from '@docusaurus/Link';
import styles from './SubscriptionTypes.module.css';

function StreamIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function PollIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

const types = [
  {
    icon: <StreamIcon />,
    title: 'Stream subscriptions',
    description: 'Ordered event delivery with history and automatic recovery. The foundation for chat, notifications, activity feeds, and audit logs.',
    detail: 'With the PostgreSQL broker, publish inside your database transaction — the real-time update commits or rolls back with your business write.',
    link: '/docs/server/channels#stream-channel-mode',
    color: 'var(--ifm-color-primary)',
  },
  {
    icon: <MapIcon />,
    title: 'Map subscriptions',
    description: 'Synchronized key-value state with paginated snapshots and stream-based recovery. Built for collaborative documents, leaderboards, inventories, and game lobbies.',
    detail: 'Conditional writes (CAS), per-key TTL, ordered state, and three modes for different state lifetimes — ephemeral, recoverable, or persistent.',
    link: '/docs/server/map_subscriptions',
    color: '#4ecdc4',
  },
  {
    icon: <PollIcon />,
    title: 'Shared poll subscriptions',
    description: 'Centrifugo polls your backend once and fans out changes to all subscribers. 10,000 clients stay up to date with one backend request per second.',
    detail: 'No push infrastructure needed on the backend. Ideal for dashboards, live scores, stock tickers, and any read-heavy state that changes server-side.',
    link: '/docs/server/channels#shared-poll-channel-mode',
    color: '#f7b731',
  },
];

export default function SubscriptionTypes() {
  return (
    <section className={styles.section}>
      <div className="container">
        <h2 className={styles.heading}>Three subscription primitives</h2>
        <p className={styles.subheading}>
          Each designed for a different relationship between clients and data
        </p>
        <div className={styles.grid}>
          {types.map((t) => (
            <Link key={t.title} to={t.link} className={styles.card}>
              <div className={styles.iconWrap} style={{ color: t.color }}>
                {t.icon}
              </div>
              <h3 className={styles.cardTitle}>{t.title}</h3>
              <p className={styles.cardDesc}>{t.description}</p>
              <p className={styles.cardDetail}>{t.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
