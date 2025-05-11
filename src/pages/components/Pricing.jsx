import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from './pricing.module.css';

export default function Pricing() {
    return (
        <section className={styles.pricingSection}>
            {/* background video */}
            <video
                className={styles.bgVideo}
                src={useBaseUrl('/img/logo.mp4')}
                autoPlay
                muted
                loop
            />

            {/* dark overlay on top of video */}
            <div className={styles.overlay} />

            {/* your content */}
            <div className={styles.content}>
                <h2 className={styles.title}>Pricing</h2>
                <div className={styles.text}>
                    <p>
                        We currently provide Centrifugo PRO licenses only to corporate
                        customers. The license key allows running Centrifugo PRO without any
                        limits for organization projects, includes 1 year of prioritized
                        support and updates.
                    </p>
                    <p>
                        Our pricing is flat, based on your company size and Centrifugo role.
                        Please contact us for more details and a quote.
                    </p>
                </div>
                <div className={styles.buttons}>
                <Link
                    className={clsx(
                        'button button--outline button--secondary button--lg',
                        styles.button
                    )}
                    to={useBaseUrl('docs/pro/overview#pricing')}
                >
                    CONTACT SALES
                </Link>
                </div>
            </div>
        </section>
    );
}
