import React, { useState, useCallback } from 'react';
import styles from './comparisonTable.module.css';

const data = [
    {
        category: 'Core Messaging',
        comment: 'A solid real-time foundation available in both editions',
        features: [
            { name: 'PUB/SUB, channels, namespaces', oss: true, pro: true },
            { name: 'WebSocket, SSE, HTTP-streaming, WebTransport, GRPC transports', oss: true, pro: true },
            { name: 'WebSocket bidirectional emulation', oss: true, pro: true },
            { name: 'Stream subscriptions with history, recovery, cache mode', oss: true, pro: true },
            { name: 'Map subscriptions for state sync', oss: true, pro: true },
            {
                name: 'Map subscriptions enhancements', pro: true, link: '/docs/pro/map_subscriptions',
                description: 'In-memory cache layer, PostgreSQL read replicas and broker fan-out, Redis Cluster support with sharded PUB/SUB, and per-namespace map brokers for using different backends per channel namespace.',
            },
            { name: 'Shared poll subscriptions', oss: true, pro: true },
            {
                name: 'Shared poll enhancements', pro: true, link: '/docs/pro/shared_poll',
                description: 'Instant initial data via cached items, delta compression, notification fast path for near-instant updates, adaptive backpressure, and a standalone relay server to centralize backend polling.',
            },
            { name: 'Presence & join/leave events', oss: true, pro: true },
            { name: 'Delta compression, client-side publication filtering by tags', oss: true, pro: true },
            {
                name: 'Server-side publication tags filter', pro: true, link: '/docs/pro/server_tags_filter',
                description: 'Server-controlled per-subscriber publication filtering via tags. Set by your backend through subscribe proxy or JWT — the client cannot override it. Works for stream and map subscriptions, enabling fine-grained access control within channels.',
            },
            { name: 'Proxy events (connect, subscribe, publish, RPC)', oss: true, pro: true },
            { name: 'Official real-time SDKs for popular languages', oss: true, pro: true },
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
                name: 'Token revocation & invalidation', pro: true, link: '/docs/pro/access_revoke#token-revocation',
                description: 'Revoke individual tokens by JTI claim or invalidate all tokens issued before a specific time using IAT claim. Revocation info is kept in-memory with periodic sync, making checks fast.',
            },
            {
                name: 'Multiple JWKS providers', pro: true, link: '/docs/pro/client_authentication',
                description: 'Automatically extract and map JWT claims from third-party identity providers into Centrifugo connection metadata. Useful when working with providers that issue non-customizable tokens.',
            },
            {
                name: 'Client labels', pro: true, link: '/docs/pro/client_authentication#client-labels',
                description: 'Attach a typed string map to each connection from JWT or the connect proxy. Use labels to segment Prometheus metrics, filter the server API (disconnect/refresh/subscribe/unsubscribe) by region/tier/version including fleet-wide, gate channels via CEL, segment ClickHouse analytics, and pass through to backend proxy requests.',
            },
            {
                name: 'Server API JWKS authentication', pro: true, link: '/docs/pro/server_api_enhancements#jwks-authentication',
                description: 'Protect HTTP and GRPC server APIs with JWKS-based JWT authentication. Use tokens from your identity provider (Keycloak, Auth0, etc.) instead of static API keys.',
            },
        ],
    },
    {
        category: 'Scalability and performance',
        comment: 'Lower costs and handle more with fewer resources',
        features: [
            { name: 'Scale with Redis, Redis Cluster and NATS', oss: true, pro: true },
            {
                name: 'Per-namespace engines', pro: true, link: '/docs/pro/scalability#per-namespace-engines',
                description: 'Assign different broker backends to different namespaces to scale load and match each feature to the right backend — PostgreSQL for transactional channels, Redis for high-throughput channels, separate Redis instances per namespace to distribute load.',
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
                name: 'Sharded PUB/SUB for Redis Cluster', pro: true, link: '/docs/pro/scalability#redis-cluster-sharded-pubsub',
                description: 'Use Redis 7.0+ sharded PUB/SUB to distribute channel load across cluster nodes instead of broadcasting to all. Includes node-grouped mode that reduces connection count from num_partitions to num_redis_nodes. Works for both Engine and Map Broker.',
            },
            {
                name: 'Bandwidth optimizations', pro: true, link: '/docs/pro/bandwidth_optimizations',
                description: 'Delta compression for at-most-once delivery, channel compaction, and client publish debouncing to coalesce rapid updates. Reduces bandwidth and broker load.',
            },
            {
                name: 'Advanced message write and batching', pro: true, link: '/docs/pro/client_message_batching',
                description: 'Configure write_delay to collect messages before sending, trading delivery latency for reduced CPU. Can cut overall cluster CPU usage by half for high message rate scenarios.',
            },
            {
                name: 'Fast Custom Controllers (Redis, Nats)', pro: true, link: '/docs/pro/scalability#setting-custom-controller',
                description: 'Isolate cross-node control traffic from channel data using a dedicated controller. Supports Redis, Nats in addition to PostgreSQL from the OSS version',
            },
        ],
    },
    {
        category: 'Observability',
        comment: 'Full visibility into every connection, channel, and message',
        features: [
            { name: 'Prometheus metrics, admin UI', oss: true, pro: true },
            {
                name: 'ClickHouse analytics (current stats, trends, per-connection resolution)', pro: true, link: '/docs/pro/analytics',
                description: 'Export publications, connections, subscriptions, operations, and push notification events to ClickHouse. Run fast analytical queries with effective data retention policies. Trends and connection flight recorder in admin web UI.',
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
                name: 'Configuration viewer', pro: true, link: '/docs/pro/admin_ui',
                description: 'Effective configuration is visible in admin web UI',
            },
            {
                name: 'Enhanced metrics', pro: true, link: '/docs/pro/observability_enhancements',
                description: 'Channel namespace resolution and client SDK name breakdown in Prometheus metrics, Prometheus to OTEL metrics bridge, per-node CPU and RSS stats in admin UI, and more.',
            },
        ],
    },
    {
        category: 'Engagement',
        comment: 'Reach users even when they are offline',
        features: [
            {
                name: 'Push notifications (FCM, APNs, HMS, WebPush)', pro: true, link: '/docs/pro/push_notifications',
                description: 'Send push notifications to Android, iOS, and web via FCM, APNs, HMS and WebPush (VAPID). Supports timezone-aware delivery, localization, and templating.',
            },
            {
                name: 'Device token management & topics', pro: true, link: '/docs/pro/push_notifications',
                description: 'Built-in device token storage in PostgreSQL with topic-based subscriptions and Redis-based worker queues. Centrifugo handles the full push notification lifecycle.',
            },
        ],
    },
    {
        category: 'Additional APIs and events',
        comment: 'Extended server-side APIs and channel events for deeper integration',
        features: [
            {
                name: 'Additional event hooks', pro: true, link: '/docs/pro/event_hooks',
                description: 'Channel state events (occupied/vacated webhooks when subscribers join or leave) and cache empty events (notify backend on cache misses for lazy state population).',
            },
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
                <div className={styles.header}>
                    <span className={styles.eyebrow}>OSS vs PRO</span>
                    <h2 className={styles.heading}>Compare editions</h2>
                    <p className={styles.subheading}>
                        Everything from open-source Centrifugo, plus advanced features for scale,
                        performance, security, observability, push notifications, and more in PRO.
                    </p>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.colFeature} aria-hidden="true"></th>
                                <th className={styles.colOss}><span className={styles.ossBadge}>OSS</span></th>
                                <th className={styles.colPro}><span className={styles.proBadge}>PRO</span></th>
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
