import React from 'react';
import styles from './ProBanner.module.css';

const ProBanner = () => {
    // return (
    //     <div className={styles.banner}>
    //         <h2 className={styles.bannerTitle}>Using Centrifugo? Check out <a className={styles.bannerLink} href="/docs/pro/overview">Centrifugo PRO</a></h2>
    //         <p className={styles.bannerText}>Innovative answers to complex real-time messaging challenges</p>
    //     </div>
    // );
    return (
        <div className={styles.banner}>
            <h2 className={styles.bannerTitle}>New in Centrifugo: <a className={styles.bannerLink} href="/blog/2025/10/14/server-side-publication-filtering-by-tags">Publication filtering by tags</a></h2>
            <p className={styles.bannerText}>Server-side publication filtering for reducing bandwidth and processing overhead</p>
        </div>
    );
};

export default ProBanner;
