import React from 'react';
import styles from './ProBanner.module.css';

const ProBanner = () => {
    return (
        <div className={styles.banner}>
            <h2 className={styles.bannerTitle}>Using Centrifugo? Check out <a className={styles.bannerLink} href="/docs/pro/overview">Centrifugo PRO</a></h2>
            <p className={styles.bannerText}>Innovative answers to complex real-time messaging challenges</p>
        </div>
    );
};

export default ProBanner;
