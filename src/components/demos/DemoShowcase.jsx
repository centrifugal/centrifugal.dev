import React from 'react';
import Link from '@docusaurus/Link';
import DemoGallery from './DemoGallery';
import data from '@site/src/data/demos.json';
import styles from './DemoShowcase.module.css';

// Landing page strip - three demos that show range: raw throughput, AI
// streaming, geo. The full set lives on /demos.
const FEATURED = ['particles', 'ai_recovery', 'drones'];

export default function DemoShowcase() {
    return (
        <section className={styles.section}>
            <div className="container">
                <div className={styles.header}>
                    <h2 className={styles.title}>Centrifugo in action</h2>
                    <Link to="/demos" className={styles.viewAll}>
                        Browse all {data.demos.length} demos &rarr;
                    </Link>
                </div>
                <p className={styles.subtitle}>
                    Cursors, live dashboards, chat, AI token streams — hover for a preview,
                    click to watch, then take the source and run it yourself.
                </p>
                <DemoGallery featured={FEATURED} showFilters={false} />
            </div>
        </section>
    );
}
