import React, { useEffect, useRef, useState } from 'react';
import styles from './HowItWorks.module.css';

export default function HowItWorks() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`${styles.section} ${active ? styles.active : ''}`}
      ref={ref}
    >
      <div className={styles.bg} />
      <div className="container">
        <div className={styles.flow}>
          {/* Your App */}
          <div className={`${styles.node} ${styles.node1}`}>
            <div className={styles.card}>
              <div className={styles.cardIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <h3>Your App</h3>
              <p>Publish events from any backend, database, or client</p>
            </div>
            <span className={styles.stepBadge}>1</span>
          </div>

          {/* Connector 1 */}
          <div className={`${styles.connector} ${styles.conn1}`}>
            <div className={styles.connLine} />
            <div className={styles.connDot} />
          </div>

          {/* Centrifugo */}
          <div className={`${styles.node} ${styles.node2}`}>
            <div className={`${styles.card} ${styles.heroCard}`}>
              <img src="/img/logo.svg" alt="" className={styles.heroLogo} />
              <h3>Centrifugo</h3>
              <p>Routes, broadcasts, and syncs state across millions of connections</p>
            </div>
            <span className={styles.stepBadge}>2</span>
          </div>

          {/* Connector 2 */}
          <div className={`${styles.connector} ${styles.conn2}`}>
            <div className={styles.connLine} />
            <div className={styles.connDot} />
            <div className={`${styles.connDot} ${styles.connDot2}`} />
            <div className={`${styles.connDot} ${styles.connDot3}`} />
          </div>

          {/* Users */}
          <div className={`${styles.node} ${styles.node3}`}>
            <div className={styles.card}>
              <div className={styles.cardIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3>Your Users</h3>
              <p>Subscribers receive real-time updates on any device using our SDKs</p>
            </div>
            <span className={styles.stepBadge}>3</span>
          </div>
        </div>

        <p className={styles.punchline}>
          No changes to your existing architecture. Spin up and go.
        </p>
      </div>
    </section>
  );
}
