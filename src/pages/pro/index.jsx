import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "../styles.module.css";
import Logo from "../components/logo";
import { useColorMode } from '@docusaurus/theme-common';
import Highlight from '../components/Highlight'
import ImageRotator from '../../components/ImageRotator';

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
    const isDarkTheme = useColorMode().colorMode == 'dark';
    return (
        <header id="hero" className={clsx("hero hero--primary", styles.heroBanner)}>
            <Logo isDarkTheme={isDarkTheme} />
            <div className="container" style={{ "zIndex": 1, pointerEvents: "none" }}>
                <div className={styles.mainTitle}>
                    {/* <span style={{ "color": "#d34343" }}> */}
                    CENTRIFUGO PRO
                    {/* </span> */}
                </div>
                <div className={styles.subTitle}>
                    Unlock the full power of Centrifugo
                </div>
                <div className={styles.subSubTitle}>
                    Next-level self-hosted real-time messaging
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
                </div>
            </div>
        </header >
    );
}

function Pro() {
    const context = useDocusaurusContext();
    const { siteConfig: { tagline } = {} } = context;
    return (
        <Layout
            title={tagline}
            description="Centrifugo PRO - the full power of self-hosted real-time messaging. An enhanced version of Centrifugo that includes a set of unique features, additional APIs, faster performance and more flexible scalability."
        >
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
                                Centrifugal Labs offers a PRO version of Centrifugo featuring unique capabilities, additional APIs, and enhanced performance. These improvements are the result of real-world experience managing large-scale concurrent connections in production environments. You gain more features, greater scalability and performance, improved observability, prioritized support for your business.
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
                            <Feature title="Faster performance" imageUrl="img/feature_performance.png">
                                PRO version <a href={"/docs/pro/performance"}>pushes the performance</a> of Centrifugo to the next level. Optimizations for higher throughput, lower latency, better resource usage.
                            </Feature>
                            <Feature title="Push notifications" imageUrl="img/feature_mail.png">
                                Unique API for <a href={"/docs/pro/push_notifications"}>push notifications</a> with secure topics and flexible API. Integrates with FCM, APNs and HMS push providers.
                            </Feature>
                            <Feature title="Enhanced Admin UI" imageUrl="img/feature_thumbs.png">
                                Built-in <a href={"/docs/pro/admin_idp_auth"}>SSO integration over OIDC</a> protocol, user or channel real-time tracing, analytical widgets, push notification devices and more.
                            </Feature>
                            <Feature title="Flexible scalability" imageUrl="img/feature_cloud.png">
                                More options to layout your architecture: <a href={"/docs/pro/scalability#subscribe-on-replica"}>Redis replicas</a>, Redis <a href={"/docs/pro/scalability#redis-cluster-sharded-pubsub"}>sharded PUB/SUB</a>, <a href={"/docs/pro/namespace_engines"}>per-namespace Broker</a> configurations.
                            </Feature>
                            <Feature title="Better observability" imageUrl="img/feature_pro.png">
                                A <a href={"/docs/pro/observability_enhancements"}>better observability</a> of your Centrifugo cluster: additional metric insights, real-time tracing and <a href={"/docs/pro/analytics"}>ClickHouse integration</a>.
                            </Feature>
                            <Feature title="Protocol rate limits" imageUrl="img/feature_protection.png">
                                <a href={"/docs/pro/rate_limiting"}>Protect your real-time APIs</a> from misusing and client-side bugs. Detect and disconnect clients generating lots of errors.
                            </Feature>
                        </div>
                    </div>
                </section>
            </main >
            <Highlight
                img={
                    <video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/logo.mp4"></video>
                }
                reversed
                isDark
                title="Pricing"
                text={
                    <>
                        <p>
                            We currently provide Centrifugo PRO licenses only to corporate customers. The license key allows running Centrifugo PRO without any limits for organization projects, includes 1 year of prioritized support and updates.
                        </p>
                        <p>
                            Our pricing is flat and based on your company size. Please contact us for more details and a quote.
                        </p>
                        <p>
                            <div className={styles.buttons}>
                                <Link
                                    className={clsx(
                                        "button button--outline button--secondary button--lg"
                                    )}
                                    to={useBaseUrl("docs/pro/overview#pricing")}
                                >
                                    CONTACT SALES
                                </Link>
                            </div>
                        </p>
                    </>
                }
            />
        </Layout >
    );
}

export default Pro;
