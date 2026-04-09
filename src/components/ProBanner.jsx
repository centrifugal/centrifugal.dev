import React from 'react';
import styles from './ProBanner.module.css';

const ProBanner = () => {
    return (
        <div className={styles.strip}>
            <span className={styles.badge}>New</span>
            <a className={styles.link} href="/blog/2025/10/14/server-side-publication-filtering-by-tags">
                Publication filtering by tags
            </a>
            <span className={styles.dash}>&mdash;</span>
            <span className={styles.desc}>server-side filtering to reduce bandwidth overhead</span>
        </div>
    );
};

export default ProBanner;
