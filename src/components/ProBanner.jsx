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
            <h2 className={styles.bannerTitle}>Centrifugo v6 <a className={styles.bannerLink} href="/blog/2025/01/16/centrifugo-v6-released">is now live!</a></h2>
            <p className={styles.bannerText}>A better experience for everyone involved</p>
        </div>
    );
};

export default ProBanner;
