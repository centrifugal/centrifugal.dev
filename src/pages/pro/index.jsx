import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "../styles.module.css";
import { useColorMode } from '@docusaurus/theme-common';
import Hero from "../../components/Hero";
import Highlight from '../components/Highlight'
import TitleWithCatPro from '../components/TitleWithCatPro';
import ImageRotator from '../../components/ImageRotator';
import Pricing from '../components/Pricing';
import ComparisonTable from '../components/ComparisonTable';

function Feature({ imageUrl, title, children }) {
    const imgUrl = useBaseUrl(imageUrl);
    return (
        <div className={clsx("col col--4", styles.feature)}>
            {imgUrl && (
                <div className="text--center">
                    <div className="feature-media">
                        <img className={styles.featureImage} src={imgUrl} alt={title} />
                    </div>
                </div>
            )}
            <h2 className="text--center">{title}</h2>
            <p>{children}</p>
        </div>
    );
}

function Header() {
    const isDarkTheme = useColorMode().colorMode === 'dark';
    return (
        <Hero>
            <div className={styles.mainTitle}>
                <TitleWithCatPro isDarkTheme={isDarkTheme} />
            </div>
            <h1 className={styles.subTitle}>
                Unlock the full power of Centrifugo
            </h1>
            <div className={styles.subSubTitle}>
                Next-level <span className="text-gradient text-gradient-hero">realtime messaging</span> and <span className="text-gradient text-gradient-hero">data sync</span><br />
                for your organization
            </div>
            <div className={styles.buttons}>
                <Link
                    className={clsx(
                        "button button--outline button--secondary button--lg"
                    )}
                    to={useBaseUrl("docs/pro/overview")}
                >
                    PRO DOCS
                </Link>
                <a
                    className={clsx(
                        "button button--outline button--secondary button--lg"
                    )}
                    href="#pricing"
                    style={{ pointerEvents: "auto" }}
                    onClick={(e) => {
                        e.preventDefault();
                        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                    }}
                >
                    PRICING
                </a>
            </div>
        </Hero>
    );
}

function Pro() {
    return (
        <Layout
            title="Centrifugo PRO – push notifications, analytics, rate limits & SSO"
            description="The enhanced commercial edition of the self-hosted Centrifugo real-time messaging server — extra APIs, faster performance, advanced scalability & observability."
        >
            <Head>
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        "name": "Centrifugo PRO",
                        "url": "https://centrifugal.dev/pro",
                        "applicationCategory": "DeveloperApplication",
                        "operatingSystem": "Linux, macOS, Windows, Docker, Kubernetes",
                        "description": "Enhanced version of Centrifugo — a self-hosted realtime messaging server for chats, AI/LLM response streaming, live updates, and more. PRO unlocks push notifications, ClickHouse analytics, realtime tracing, rate limiting, SSO, channel state events, and performance optimizations for production workloads at scale.",
                        "featureList": "Channel capabilities & CEL expressions, Channel patterns, Operation rate limiting, User blocking API, Token revocation & invalidation, Multiple JWKS providers, Server API JWKS authentication, Per-namespace engines, Singleflight & shared position sync, Performance optimizations, Bandwidth optimizations, Advanced message write and batching, ClickHouse analytics, Realtime channel & user tracing, Connection & channel snapshots, SSO/OIDC for admin UI, Enhanced metrics, Push notifications (FCM, APNs, HMS), Device token management & topics, Channel state events, Cache empty events, User status API, Connections API, Prioritized support",
                        "offers": {
                            "@type": "Offer",
                            "priceCurrency": "EUR",
                            "availability": "https://schema.org/InStock"
                        },
                        "author": {
                            "@type": "Organization",
                            "name": "Centrifugal Labs LTD",
                            "url": "https://centrifugal.dev"
                        }
                    })}
                </script>
            </Head>
            <Header />
            <main>
                < Highlight
                    img={
                        <ImageRotator />
                    }
                    title="What is Centrifugo PRO?"
                    text={
                        <>
                            <p>
                                Centrifugal Labs offers a PRO version of Centrifugo featuring unique capabilities, additional APIs, enhanced performance. These improvements are the result of real-world experience managing large-scale concurrent connections in production environments. You gain more features, greater scalability and performance, improved observability, prioritized support for the business.
                            </p>
                            <div className={styles.buttons}>
                                <Link
                                    className={clsx(
                                        "button button--outline button--secondary button--lg",
                                        styles.getStarted
                                    )}
                                    to={useBaseUrl("docs/pro/overview")}
                                >
                                    Go to Centrifugo PRO docs
                                </Link>
                            </div>
                        </>
                    }
                />
                < Highlight
                    img={
                        <video
                            width="560"
                            height="315"
                            src="/img/snapshots_demo.mp4"
                            title="Snapshots demo"
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                    }
                    reversed
                    isDark
                    title="Powerful and complete"
                    text={
                        <>
                        <p>
                            Centrifugo PRO allows you to monitor activity down to individual channels or connections. Scalability and performance improvements can dramatically increase throughput and optimize resource usage of the realtime application. You also get support for sending push notifications making the client-facing realtime messaging system complete.
                        </p>
                        <div className={styles.buttons}>
                            <Link
                                className={clsx(
                                    "button button--outline button--secondary button--lg",
                                    styles.getStarted
                                )}
                                to={useBaseUrl("docs/pro/overview")}
                            >
                                Go to Centrifugo PRO docs
                            </Link>
                        </div>
                        </>
                    }
                />
                <section className={clsx("features-wrapper", styles.features)}>
                    <div className="container">
                        <div className="row">
                            <Feature title="Lower resource costs" imageUrl="img/feature_performance.png">
                                PRO version <a href={"/docs/pro/performance"}>pushes the performance</a> of Centrifugo to the next level. Optimizations for higher throughput. Lower latency, resource usage and <a href={"/docs/pro/bandwidth_optimizations"}>bandwidth</a>.
                            </Feature>
                            <Feature title="Push notifications" imageUrl="img/feature_mail.png">
                                Support for sending <a href={"/docs/pro/push_notifications"}>push notifications</a> with secure topics and flexible API. Integrates with FCM, APNs and HMS push providers.
                            </Feature>
                            <Feature title="Enhanced Admin UI" imageUrl="img/feature_thumbs.png">
                                Built-in <a href={"/docs/pro/admin_ui"}>SSO integration over OIDC</a> protocol, user or channel realtime tracing, analytical widgets, push notification devices, more state data and more.
                            </Feature>
                            <Feature title="Flexible scalability" imageUrl="img/feature_cloud.png">
                                More options to layout your architecture: <a href={"/docs/pro/scalability#subscribe-on-replica"}>Redis replicas</a>, Redis <a href={"/docs/pro/scalability#redis-cluster-sharded-pubsub"}>sharded PUB/SUB</a>, <a href={"/docs/pro/namespace_engines"}>per-namespace Broker</a> configurations.
                            </Feature>
                            <Feature title="Better observability" imageUrl="img/feature_pro.png">
                                A <a href={"/docs/pro/observability_enhancements"}>better observability</a> of your Centrifugo cluster: additional metric insights, realtime tracing and <a href={"/docs/pro/analytics"}>ClickHouse integration</a>, state <a href="/docs/pro/admin_ui#channels-and-connections-snapshots">snapshots</a>.
                            </Feature>
                            <Feature title="Protocol rate limits" imageUrl="img/feature_protection.png">
                                <a href={"/docs/pro/rate_limiting"}>Protect your realtime APIs</a> from misusing and client-side bugs. Detect and disconnect clients generating lots of errors.
                            </Feature>
                        </div>
                    </div>
                </section>
                <ComparisonTable />
            </main >
            <Pricing />
        </Layout >
    );
}

export default Pro;
