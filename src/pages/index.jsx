import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./styles.module.css";
import Logo from "./components/logo";
import useThemeContext from '@theme/hooks/useThemeContext';

// function ResponsiveEmbed({ src }) {
//   return (
//     <div className={clsx(styles.responsiveEmbed)}>
//       <iframe src={src} frameBorder="0" allowFullScreen></iframe>
//     </div>
//   );
// }

function Feature({ imageUrl, title, children }) {
  const imgUrl = useBaseUrl(imageUrl);
  return (
    <div className={clsx("col col--4", styles.feature)}>
      {imgUrl && (
        <div className="text--center">
          <img className={styles.featureImage} src={imgUrl} alt={title} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function Header() {
  const { isDarkTheme } = useThemeContext();
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
  const { siteConfig = {} } = context;
  return (
    <Layout
      title={siteConfig.title}
      description="Scalable real-time messaging server"
    >
      <Header />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              <Feature title="Integrates with everything" imageUrl="img/integration.svg">
                Centrifugo is language-agnostic. It's a standalone server with
                simple API which can be integrated with an application written in
                any programming language. No need to change an existing application
                architecture to introduce real-time features. Just add Centrifugo nearby
                and let it deal with persistent connections.
              </Feature>
              <Feature title="Great performance" imageUrl="img/performance.svg">
                Centrifugo is built in Go language with some smart optimizations inside.
                It has good performance – see a <a href="/blog/2020/02/10/million-websocket-with-centrifugo">description</a> of a
                test stand with one million WebSocket connections and 30 million delivered
                messages per minute with a hardware comparable to one modern server machine.
              </Feature>
              <Feature title="Feature-rich" imageUrl="img/feature_rich.svg">
                Many built-in features can help building an attractive real-time
                application in a limited time. Centrifugo provides different types
                of subscriptions, hot channel history and instant presence, RPC calls.
                Also possibility to proxy WebSocket events to backend over HTTP or GRPC
                and more.
              </Feature>
              <Feature title="Out-of-the-box scalability" imageUrl="img/scalability.svg">
                Built-in Redis, KeyDB, Tarantool engines or Nats broker make it possible
                to scale connections over different machines. With consistent sharding
                of Redis, KeyDB and Tarantool it's possible to handle millions of active
                connections with reasonable hardware requirements.
              </Feature>
              <Feature title="Used in production" imageUrl="img/production.svg">
                Started almost 10 years back then Centrifugo (and Centrifuge library for Go
                it's built on top of) is a mature server succesfully used in production by
                many companies around the world: Mail.ru, Badoo, ManyChat, Grafana, Spot.im
                and others.
              </Feature>
              <Feature title="Even more with Centrifugo PRO" imageUrl="img/pro2.svg">
                Centrifugo PRO has even more unique features: real-time connection analylics
                with Clickhouse, real-time user and channel tracing, token bucket operation
                throttling, user last active status support, faster API and proxy performance etc.
              </Feature>
            </div>
          </div>
        </section>
        <section className={clsx(styles.section, styles.sectionAlt)}>
          <div className="container">
            <h2>What is Centrifugo?</h2>
            <p>
              💠 Real-time messaging can help building interactive applications where data
              delivered to users almost immediately after being acknowleded by application
              backend using push technologies.
            </p>
            <p>
              💠 Centrifugo handles persistent connections from clients over WebSocket, SockJS,
              GRPC, SSE (Eventsource), HTTP-streaming transports and provides API to publish
              messages to clients in real-time.
            </p>
            <p>
              💠 Clients subscribe to channels to receive an interesting subset of messages. So
              Centrifugo acts as a user facing PUB/SUB server.
            </p>
            <p>
              💠 Chats, live comments, multiplayer games, streaming metrics and other types of
              interactive applications can be quickly built using Centrifugo and a set of client
              libraries available for frontend (for both web and mobile experience).
            </p>
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
        </section>
      </main>
    </Layout>
  );
}

export default Home;
