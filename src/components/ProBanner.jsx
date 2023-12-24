import React from 'react';
import styles from './ProBanner.module.css';

const ProBanner = () => {
    return (
        <div className={styles.banner}>
            <h2 className={styles.bannerTitle}>Using Centrifugo? Check out <a className={styles.bannerLink} href="/docs/pro/overview">Centrifugo PRO</a></h2>
            <p className={styles.bannerText}>Unique experience of self-hosted real-time messaging</p>
            {/* You can add more content or a CTA button here */}
        </div>
    );
};

export default ProBanner;
