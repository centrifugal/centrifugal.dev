import React, { useState, useCallback } from 'react';
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from './pricing.module.css';

function getAddr() {
    return ['sales', 'centrifugal', 'dev'].join('@').replace('@', '@').replace(/^([^@]+)@(.+)$/, '$1@$2');
}

function EmailContact() {
    const parts = ['sales', 'centrifugal', 'dev'];
    const [copied, setCopied] = useState(false);

    const handleEmail = useCallback((e) => {
        e.preventDefault();
        const addr = parts[0] + '@' + parts[1] + '.' + parts[2];
        window.location.href = 'mailto:' + addr;
    }, []);

    const handleCopy = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        const addr = parts[0] + '@' + parts[1] + '.' + parts[2];
        navigator.clipboard.writeText(addr).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, []);

    return (
        <div className={styles.emailWrap}>
            <a
                href="#contact"
                onClick={handleEmail}
                className={styles.emailLink}
                aria-label="Send email to sales"
            >
                <svg className={styles.emailIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 4L12 13L2 4" />
                </svg>
                <span>{parts[0]}<span style={{ display: 'none' }}>nospam</span>@{parts[1]}.{parts[2]}</span>
            </a>
            <button
                className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
                onClick={handleCopy}
                aria-label="Copy email address"
                title="Copy email address"
            >
                {copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                )}
                {copied && <span className={styles.copiedTooltip}>Copied!</span>}
            </button>
        </div>
    );
}

export default function Pricing() {
    return (
        <section id="pricing" className={styles.pricingSection}>
            <video
                className={styles.bgVideo}
                src={useBaseUrl('/img/logo.mp4')}
                autoPlay
                muted
                loop
            />
            <div className={styles.overlay} />
            <div className={styles.content}>
                <div className={styles.priceHeader}>
                    <span className={styles.eyebrow}>Pricing</span>
                    <div className={styles.priceAnchor}>
                        <span className={styles.priceFrom}>from</span>
                        <span className={styles.priceAmount}>€3,500</span>
                        <span className={styles.pricePer}>/ year</span>
                    </div>
                    <div className={styles.priceScale}>flat — scaling with company size</div>
                </div>
                <div className={styles.text}>
                    <p>
                        One flat license — no per-connection fees, no per-message metering,
                        no usage tiers. Centrifugo PRO is self-hosted, so it runs entirely on
                        your own infrastructure and your messages and user data never leave it.
                    </p>
                    <p>
                        The license unlocks every PRO feature without limits across your
                        organization's projects and includes one year of prioritized support
                        and updates.
                    </p>
                    <p>
                        Available to corporate and business customers. Share your use case and
                        company details to get a quote:
                    </p>
                </div>
                <EmailContact />
            </div>
        </section>
    );
}
