import React from 'react';
import Link from '@docusaurus/Link';
import styles from './proPush.module.css';

const DOCS = '/docs/pro/push_notifications';

const POINTS = [
    {
        title: 'Every platform',
        text: 'iOS, Android and browsers, through FCM, APNs, HMS and Web Push.',
        link: `${DOCS}#send-in-each-providers-own-format`,
    },
    {
        title: 'Device tokens handled',
        text: 'Stored in PostgreSQL, with dead tokens removed automatically.',
        link: `${DOCS}#device-lifecycle-and-best-practices`,
    },
    {
        title: 'Topics you control',
        text: 'Devices join topics only through your backend, never from the client.',
        link: `${DOCS}#unified-secure-topics`,
    },
    {
        title: 'The right time and language',
        text: 'Local time windows, scheduling, rate limits and translations.',
        link: `${DOCS}#push-personalization`,
    },
    {
        title: 'Clear visibility',
        text: 'Admin UI, ClickHouse analytics and Prometheus metrics.',
        link: `${DOCS}#builtin-analytics`,
    },
];

function AppIcon({ className }) {
    return (
        <span className={className} aria-hidden="true">
            <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16v11H9l-5 4z" />
            </svg>
        </span>
    );
}

function DeviceLabel({ device, place, time }) {
    return (
        <div className={styles.deviceLabel}>
            <span>{device}, {place}</span>
            <span>{time} local time</span>
        </div>
    );
}

function IosNotification() {
    return (
        <div>
            <DeviceLabel device="iPhone" place="Berlin" time="09:12" />
            <div className={styles.ios}>
                <AppIcon className={styles.iosIcon} />
                <div className={styles.pushText}>
                    <div className={styles.iosTop}>
                        <strong>Deine Wochenübersicht</strong>
                        <span>jetzt</span>
                    </div>
                    <div>Sieh dir an, was diese Woche passiert ist.</div>
                </div>
            </div>
        </div>
    );
}

function AndroidNotification() {
    return (
        <div>
            <DeviceLabel device="Android" place="Tokyo" time="09:04" />
            <div className={styles.android}>
                <div className={styles.androidTop}>
                    <AppIcon className={styles.androidIcon} />
                    <span>Your App · たった今</span>
                    <svg className={styles.androidChevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>
                <strong className={styles.pushTitle}>今週のまとめ</strong>
                <div>今週の出来事をチェックしましょう。</div>
            </div>
        </div>
    );
}

function WebNotification() {
    return (
        <div>
            <DeviceLabel device="Browser" place="New York" time="09:21" />
            <div className={styles.web}>
                <AppIcon className={styles.webIcon} />
                <div className={styles.pushText}>
                    <strong className={styles.pushTitle}>Your weekly summary</strong>
                    <div>See what happened this week.</div>
                    <div className={styles.webSite}>app.example.com</div>
                </div>
                <span className={styles.webClose} aria-hidden="true">×</span>
            </div>
        </div>
    );
}

export default function ProPush() {
    return (
        <section id="push" className={styles.section}>
            <div className={styles.inner}>
                <div className={styles.copy}>
                    <span className={styles.eyebrow}>Push notifications</span>
                    <h2 className={styles.heading}>Reach users when they are offline</h2>
                    <p className={styles.lead}>
                        Realtime messages and push notifications from one server you host. Your
                        backend makes one API call, and Centrifugo PRO does the rest.
                    </p>
                    <ul className={styles.points}>
                        {POINTS.map(p => (
                            <li key={p.title}>
                                <Link to={p.link} className={styles.pointTitle}>{p.title}</Link>
                                <span className={styles.pointText}>{p.text}</span>
                            </li>
                        ))}
                    </ul>
                    <Link className="button button--outline button--secondary button--lg" to={DOCS}>
                        Read the push notification docs
                    </Link>
                </div>

                <div className={styles.stage}>
                    <div className={styles.stageTitle}>One API call. Each device gets its language, at 9 AM local time.</div>
                    <IosNotification />
                    <AndroidNotification />
                    <WebNotification />
                    <div className={styles.stageNote}>Example of the result</div>
                </div>
            </div>
        </section>
    );
}
