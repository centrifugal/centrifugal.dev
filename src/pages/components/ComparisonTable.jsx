import React, { useState, useCallback } from 'react';
import styles from './comparisonTable.module.css';

const data = [
    {
        category: 'Core Messaging',
        comment: 'A solid real-time foundation available in both editions',
        features: [
            { name: 'PUB/SUB, channels, namespaces', oss: true, pro: true },
            { name: 'WebSocket, SSE, HTTP-streaming, WebTransport, GRPC transports', oss: true, pro: true },
            { name: 'Stream subscriptions with history, recovery, cache mode', oss: true, pro: true },
            { name: 'Map subscriptions for state sync', oss: 'soon', pro: 'soon' },
            { name: 'Presence & join/leave events', oss: true, pro: true },
            { name: 'Delta compression', oss: true, pro: true },
            { name: 'Publication filtering by tags', oss: true, pro: true },
            { name: 'Proxy events (connect, subscribe, publish, RPC)', oss: true, pro: true },
            { name: 'SDKs for popular languages and frameworks', oss: true, pro: true },
        ],
    },
    {
        category: 'Security, auth, permissions',
        comment: 'Protect your platform, control access at every level',
        features: [
            { name: 'JWT & proxy authentication', oss: true, pro: true },
            {
                name: 'Channel capabilities & CEL expressions', pro: true, link: '/docs/pro/capabilities',
                description: 'Fine-grained permissions on a per-connection or per-subscription basis. Control who can publish, subscribe, or access history — configured via JWT claims or connect/subscribe proxy.',
            },
            {
                name: 'Channel patterns', pro: true, link: '/docs/pro/channel_patterns',
                description: 'Define channel configuration using route-like patterns (e.g. /users/:name) similar to URL routing in web frameworks. Build familiar HTTP-style channel models without listing every namespace.',
            },
            {
                name: 'Operation rate limiting', pro: true, link: '/docs/pro/rate_limiting',
                description: 'Limit the number of subscribe, publish, history, presence, RPC and other operations per connection using a token bucket algorithm. Automatically disconnect clients that generate too many errors.',
            },
            {
                name: 'User blocking API', pro: true, link: '/docs/pro/user_block',
                description: 'Block users at the Centrifugo level — blocked users are immediately disconnected and cannot reconnect. Supports optional persistence to Redis or database so blocks survive restarts.',
            },
            {
                name: 'Token revocation & invalidation', pro: true, link: '/docs/pro/token_revocation',
                description: 'Revoke individual tokens by JTI claim or invalidate all tokens issued before a specific time using IAT claim. Revocation info is kept in-memory with periodic sync, making checks fast.',
            },
            {
                name: 'Multiple JWKS providers', pro: true, link: '/docs/pro/client_authentication',
                description: 'Automatically extract and map JWT claims from third-party identity providers into Centrifugo connection metadata. Useful when working with providers that issue non-customizable tokens.',
            },
            {
                name: 'Server API JWKS authentication', pro: true, link: '/docs/pro/server_api_auth',
                description: 'Protect HTTP and GRPC server APIs with JWKS-based JWT authentication. Use tokens from your identity provider (Keycloak, Auth0, etc.) instead of static API keys.',
            },
        ],
    },
    {
        category: 'Scalability',
        comment: 'Lower costs and handle more with fewer resources',
        features: [
            { name: 'Scale with Redis, Redis Cluster and NATS', oss: true, pro: true },
            {
                name: 'Per-namespace engines', pro: true, link: '/docs/pro/scalability#per-namespace-engines',
                description: 'Use different broker or presence backends per namespace. For example, Redis for most channels but NATS for wildcard subscriptions — within a single Centrifugo setup.',
            },
            {
                name: 'Singleflight & shared position sync', pro: true, link: '/docs/pro/scalability',
                description: 'Merge identical parallel requests to history, presence, or presence stats into one real network request. Particularly effective during massive reconnect scenarios.',
            },
            {
                name: 'Performance optimizations', pro: true, link: '/docs/pro/performance',
                description: 'Batch periodic client events (ping, presence updates) to reduce CPU usage and system calls. Reported over 2x CPU reduction for idle connections in benchmarks.',
            },
            {
                name: 'Bandwidth optimizations', pro: true, link: '/docs/pro/bandwidth_optimizations',
                description: 'Enable delta compression for at-most-once delivery by keeping the latest publication in node memory. Reduces outgoing bandwidth without requiring history or recovery to be enabled.',
            },
            {
                name: 'Message batching control', pro: true, link: '/docs/pro/client_message_batching',
                description: 'Configure write_delay to collect messages before sending, trading delivery latency for reduced CPU. Can cut overall cluster CPU usage by half for high message rate scenarios.',
            },
        ],
    },
    {
        category: 'Observability',
        comment: 'Full visibility into every connection, channel, and message',
        features: [
            { name: 'Prometheus metrics, admin UI', oss: true, pro: true },
            {
                name: 'ClickHouse analytics', pro: true, link: '/docs/pro/analytics',
                description: 'Export publications, connections, subscriptions, operations, and push notification events to ClickHouse. Run fast analytical queries with effective data retention policies.',
            },
            {
                name: 'Real-time channel & user tracing', pro: true, link: '/docs/pro/tracing',
                description: 'Attach to any channel or user ID in real time to see all messages and events as they happen. Available in admin UI or via API. Traces can be saved to files for later analysis.',
            },
            {
                name: 'Connection & channel snapshots', pro: true, link: '/docs/pro/admin_ui#channels-and-connections-snapshots',
                description: 'Inspect current state of connections and channels across the cluster. See who is connected, what they are subscribed to, and channel-level stats.',
            },
            {
                name: 'SSO/OIDC for admin UI', pro: true, link: '/docs/pro/admin_ui',
                description: 'Authenticate admin UI users via any OIDC-compatible identity provider (Okta, KeyCloak, Google, Azure, etc.) with PKCE support. Checks user permissions on every request.',
            },
            {
                name: 'Enhanced metrics', pro: true, link: '/docs/pro/observability_enhancements',
                description: 'Channel namespace resolution and client SDK name breakdown in Prometheus metrics, per-node CPU and RSS stats in admin UI, and more.',
            },
        ],
    },
    {
        category: 'Engagement',
        comment: 'Reach users even when they are offline',
        features: [
            {
                name: 'Push notifications (FCM, APNs, HMS)', pro: true, link: '/docs/pro/push_notifications',
                description: 'Send push notifications to Android, iOS, and web via FCM, APNs, and HMS. Supports timezone-aware delivery, localization, and templating.',
            },
            {
                name: 'Device token management & topics', pro: true, link: '/docs/pro/push_notifications',
                description: 'Built-in device token storage in PostgreSQL with topic-based subscriptions and Redis-based worker queues. Centrifugo handles the full push notification lifecycle.',
            },
        ],
    },
    {
        category: 'Channel Events',
        comment: 'React to what is happening in your channels instantly',
        features: [
            {
                name: 'Channel state events (occupied/vacated)', pro: true, link: '/docs/pro/channel_state_events', preview: true,
                description: 'Webhook notifications when a channel becomes occupied (first subscriber) or vacated (last subscriber leaves). Requires Redis engine with presence enabled on channels.',
            },
            {
                name: 'Cache empty events', pro: true, link: '/docs/pro/channel_cache_empty',
                description: 'Proxy notification when a client in cache recovery mode finds no publication in the channel history stream, allowing your backend to populate the cache on demand.',
            },
        ],
    },
    {
        category: 'Additional APIs',
        comment: 'Extended server-side APIs for deeper integration',
        features: [
            {
                name: 'User status API', pro: true, link: '/docs/pro/user_status',
                description: 'Clients call update_user_status RPC on meaningful actions, storing last active time in Redis. Query status for multiple users at once — useful for showing online indicators in chat apps.',
            },
            {
                name: 'Connections API', pro: true, link: '/docs/pro/connections',
                description: 'Retrieve all active user sessions by user ID or expression without requiring presence. Attach JSON metadata to connections for server-side inspection and session management.',
            },
        ],
    },
    {
        category: 'Support',
        comment: 'Get help when you need it',
        features: [
            { name: 'Community support', oss: true, pro: true },
            { name: 'Prioritized support', pro: true },
        ],
    },
];

function Check() {
    return (
        <span className={styles.check}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </span>
    );
}

function CheckPro() {
    return (
        <span className={styles.checkPro}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </span>
    );
}

function Dash() {
    return <span className={styles.dash}>&mdash;</span>;
}

function Soon() {
    return <span className={styles.soon}>Soon</span>;
}

function Chevron({ expanded }) {
    return (
        <svg
            className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

export default function ComparisonTable() {
    const [expanded, setExpanded] = useState({});

    const toggle = useCallback((key) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    return (
        <section className={styles.section}>
            <div className={styles.inner}>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.colFeature}><span className={styles.title}>OSS vs PRO</span></th>
                                <th className={styles.colOss}>OSS</th>
                                <th className={styles.colPro}>PRO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((group) => (
                                <React.Fragment key={group.category}>
                                    <tr className={styles.categoryRow}>
                                        <td colSpan={3}>
                                            <span className={styles.categoryName}>{group.category}</span>
                                            <span className={styles.categoryComment}>{group.comment}</span>
                                        </td>
                                    </tr>
                                    {group.features.map((f, fi) => {
                                        const key = `${group.category}:${f.name}`;
                                        const hasDesc = !!f.description;
                                        const isOpen = !!expanded[key];
                                        const isLast = fi === group.features.length - 1;
                                        return (
                                            <React.Fragment key={f.name}>
                                                <tr
                                                    className={`${styles.featureRow} ${hasDesc ? styles.expandable : ''} ${isOpen ? styles.featureRowOpen : ''} ${isLast ? styles.featureRowLast : ''}`}
                                                    onClick={hasDesc ? () => toggle(key) : undefined}
                                                >
                                                    <td>
                                                        <span className={styles.featureNameWrap}>
                                                            {hasDesc && <Chevron expanded={isOpen} />}
                                                            {f.name}
                                                            {f.preview && <span className={styles.preview}>Preview</span>}
                                                        </span>
                                                    </td>
                                                    <td>{f.oss === 'soon' ? <Soon /> : f.oss ? <Check /> : <Dash />}</td>
                                                    <td>{f.pro === 'soon' ? <Soon /> : f.pro ? <CheckPro /> : <Dash />}</td>
                                                </tr>
                                                {hasDesc && (
                                                    <tr className={`${styles.descriptionRow} ${isOpen ? styles.descriptionRowOpen : ''} ${isLast ? styles.descriptionRowLast : ''}`}>
                                                        <td colSpan={3}>
                                                            <div className={styles.descriptionInner}>
                                                                {f.description}
                                                                {f.link && (
                                                                    <>
                                                                        {' '}
                                                                        <a className={styles.docsLink} href={f.link}>
                                                                            Learn more &rarr;
                                                                        </a>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
