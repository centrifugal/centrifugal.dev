import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./styles.module.css";
import Logo from "./components/logo";
import { useColorMode } from '@docusaurus/theme-common';
import Highlight from './components/Highlight'

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
  const { isDarkTheme } = useColorMode();
  return (
    <header id="hero" className={clsx("hero hero--primary", styles.heroBanner)}>
      <Logo isDarkTheme={isDarkTheme} />
      <div className="container" style={{ "zIndex": 1 }}>
        <div className={styles.mainTitle}>
          CENTRIFUGO
        </div>
        <div className={styles.subTitle}>
          Scalable real-time messaging server. Set up once and forever.
        </div>
        <div className={styles.buttons}>
          <Link
            className={clsx(
              "button button--outline button--secondary button--lg",
              styles.getStarted
            )}
            to={useBaseUrl("docs/getting-started/introduction")}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Home() {
  const context = useDocusaurusContext();
  const { siteConfig: { tagline } = {} } = context;
  return (
    <Layout
      title={tagline}
      description="Centrifugo is an open source server designed to help building interactive real-time messaging applications. Think chats, live comments, multiplayer games, streaming metrics etc. Centrifugo provides a variety of real-time transports, scales well and integrates with any application."
    >
      <Header />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              <Feature title="Integrates with everything" imageUrl="img/feature_integration.png">
                Centrifugo is a self-hosted service which can handle connections over a variety of <a href="/docs/transports/overview">real-time transports</a> and provides a simple <a href="/docs/server/server_api">publish API</a>.
                Centrifugo integrates well with any application – no need to change an
                existing application architecture to introduce real-time features.
              </Feature>
              <Feature title="Great performance" imageUrl="img/feature_performance.png">
                Centrifugo is built in Go language with some smart optimizations inside.
                See a description of a test stand with <a href="/blog/2020/02/10/million-connections-with-centrifugo">one million WebSocket</a> connections and 30 million delivered
                messages per minute with hardware comparable to one modern server machine.
              </Feature>
              <Feature title="Feature-rich" imageUrl="img/feature_rich.png">
                Centrifugo provides flexible authentication, different types
                of subscriptions, hot channel history, online presence, possibility to proxy connection events to the application
                backend and more. It comes with official SDK libraries for both web and mobile development.
              </Feature>
              <Feature title="Out-of-the-box scalability" imageUrl="img/feature_scalability.png">
                Built-in Redis, KeyDB, Tarantool engines, or Nats broker make it possible
                to scale connections over different machines. With consistent sharding
                of Redis, KeyDB, and Tarantool it's possible to handle millions of active
                connections with reasonable hardware requirements.
              </Feature>
              <Feature title="Used in production" imageUrl="img/feature_production.png">
                Started a decade ago Centrifugo (and Centrifuge library for Go
                it's built on top of) is a mature battle-tested software successfully used in
                production by many companies around the world: VK, Badoo, ManyChat, OpenWeb, Grafana, and others.
              </Feature>
              <Feature title="Centrifugo PRO" imageUrl="img/feature_pro.png">
                Centrifugo PRO provides a set of unique features on top of the OSS version: connection analytics
                with ClickHouse, real-time user and channel tracing, operation throttling, faster performance, optimized Redis communication, and more.
              </Feature>
            </div>
          </div>
        </section>
        <Highlight
          img={
            <img src="/img/scheme_sketch.png" />
          }
          reversed
          isDark
          title="What is real-time messaging?"
          text={
            <>
              <p>
                Real-time messaging can help building interactive applications where events
                are delivered to online users with a minimal latency.
              </p>
              <p>
                Chats apps, live comments, collaborative tools, multiplayer games, streaming metrics can be built on top of a real-time messaging system.
              </p>
              <p>
                Centrifugo is a user facing PUB/SUB server that handles persistent connections over a variety of real-time transports – WebSocket, HTTP-streaming, EventSource (Server-Sent Events), SockJS, or GRPC.
              </p>
            </>
          }
        />
        < Highlight
          img={
            < iframe
              width="560"
              height="355"
              src="https://player.vimeo.com/video/570333329?title=0&byline=0&portrait=0"
              frameBorder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          }
          title="Looking for a cool demo?"
          text={
            <>
              <p>
                Here is a real-time telemetry streamed from Assetto Corsa racing simulator towards Grafana dashboard with a help of our WebSocket technologies.
              </p>
              <p>This demonstrates that you can stream <b>60Hz</b> data towards client connections and thus provide an instant visual feedback about system state.</p>
              <div className={styles.buttons}>
                <Link
                  className={clsx(
                    "button button--outline button--secondary button--lg",
                    styles.getStarted
                  )}
                  to={useBaseUrl("docs/getting-started/introduction")}
                >
                  Impressive? Get Started.
                </Link>
              </div>
            </>
          }
        />
      </main >
    </Layout >
  );
}

export default Home;
