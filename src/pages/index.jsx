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
import Badoo from "./components/logos/Badoo";
import Grafana from "./components/logos/Grafana";
import ManyChat from "./components/logos/ManyChat";
import OpenWeb from "./components/logos/OpenWeb";

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
      <div className="container" style={{ "zIndex": 1 }}>
        <div className={styles.mainTitle}>
          {/* <span style={{ "color": "#d34343" }}> */}
          CENTRIFUGO
          {/* </span> */}
        </div>
        <div className={styles.subTitle}>
          Scalable real-time messaging server. Set up once and forever.
        </div>
        <div className={styles.buttons}>
          <Link
            className={clsx(
              "button button--outline button--secondary button--lg"
            )}
            to={useBaseUrl("docs/getting-started/introduction")}
          >
            GET STARTED
          </Link>
        </div>
      </div>
    </header >
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
        <section className={clsx("logos-wrapper", styles.logos)}>
          <div className="container">
            <div className="row justify-content-center">
              <div className="col"></div>
              <div className="col">
                <Badoo />
              </div>
              <div className="col">
                <Grafana />
              </div>
              <div className="col">
                <ManyChat />
              </div>
              <div className="col">
                <OpenWeb />
              </div>
              <div className="col"></div>
            </div>
          </div>
        </section>
        <section className={clsx("features-wrapper", styles.features)}>
          <div className="container">
            <div className="row">
              <Feature title="Integrates with everything" imageUrl="img/feature_integration.png">
                Centrifugo is a self-hosted service which handles connections over various <a href="/docs/transports/overview">transports</a> and provides a simple <a href="/docs/server/server_api">publishing API</a>.
                Centrifugo nicely integrates with any application &mdash; no changes in
                the existing app architecture required to introduce real-time updates.
              </Feature>
              <Feature title="Great performance" imageUrl="img/feature_performance.png">
                Centrifugo is written in Go language with some smart optimizations inside.
                See the description of the test stand with <a href="/blog/2020/02/10/million-connections-with-centrifugo">one million WebSocket</a> connections and 30 million delivered
                messages per minute with hardware comparable to a single modern server machine.
              </Feature>
              <Feature title="Feature-rich" imageUrl="img/feature_rich.png">
                Centrifugo provides flexible authentication, various types
                of subscriptions, hot channel history, online presence, the ability to proxy connection events to the
                backend, and much more. It comes with official SDK libraries for both web and mobile development.
              </Feature>
              <Feature title="Out-of-the-box scalability" imageUrl="img/feature_scalability.png">
                Built-in Redis, KeyDB, Tarantool engines, or Nats broker make it possible
                to scale connections across different Centrifugo nodes. So Centrifugo helps
                you to scale to millions of active connections with reasonable hardware requirements.
              </Feature>
              <Feature title="Used in production" imageUrl="img/feature_production.png">
                Started a decade ago, Centrifugo (and Centrifuge library for Go
                it's built on top of) is mature, battle-tested software that has been successfully used in
                production by many companies around the world: VK, Badoo, ManyChat, OpenWeb, Grafana, and others.
              </Feature>
              <Feature title="Centrifugo PRO" imageUrl="img/feature_pro.png">
                <a href="/docs/pro/overview">Centrifugo PRO</a> has a set of unique features on top of the OSS version: analytics
                with ClickHouse, real-time user and channel tracing, operation throttling, faster performance, token extensions, additional APIs (for example, push notification API), and more.
              </Feature>
            </div>
          </div>
        </section>
        <Highlight
          img={
            <img src="/img/basic_pub_sub.png" />
          }
          reversed
          isDark
          title="What is real-time messaging?"
          text={
            <>
              <p>
                Real-time messaging is used to create interactive applications where events
                are delivered to online users with minimal delay.
              </p>
              <p>
                Chats apps, live comments, multiplayer games, real-time data visualizations, collaborative tools, etc. can all be built on top of a real-time messaging system.
              </p>
              <p>
                Centrifugo is a user facing <b>PUB/SUB</b> server that handles persistent connections over various real-time transports &mdash; <b>WebSocket</b>, HTTP-streaming, SSE (Server-Sent Events), SockJS, WebTransport, GRPC.
              </p>
            </>
          }
        />
        < Highlight
          img={
            <iframe
              width="560"
              height="315"
              src="https://www.youtube.com/embed/dzgXph_pRJ0"
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          }
          title="Looking for a cool demo?"
          text={
            <>
              <p>
                Here is the real-time telemetry streamed from the Assetto Corsa racing simulator to the Grafana dashboard with a help of our WebSocket technologies.
              </p>
              <p>This demonstrates that you can stream <b>60Hz</b> data towards client connections and thus provide instant visual feedback on the state of the system.</p>
              <div className={styles.buttons}>
                <Link
                  className={clsx(
                    "button button--outline button--secondary button--lg",
                    styles.getStarted
                  )}
                  to={useBaseUrl("docs/getting-started/introduction")}
                >
                  Impressive? Get Started!
                </Link>
              </div>
            </>
          }
        />
        <Highlight
          img={
            <video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/logo.mp4"></video>
          }
          reversed
          isDark
          title="What users ❤️ in Centrifugo"
          text={
            <div className="quotes">
              <code>Stability. It just works without restarts, for few years already</code>
              <code>Scalability and integration with Redis</code>
              <code>It's simple and powerful</code>
              <code>Open source</code>
              <code>Very simple integration</code>
              <code>It's really well written. Super easy to setup, especially for auth</code>
              <code>Clean code</code>
              <code>Has a Dart Client &lt;3</code>
            </div>
          }
        />
        <div className="container get-started-row">
          <div className="row">
            <Link
              to={useBaseUrl("docs/getting-started/introduction")}
            >
              GET STARTED
            </Link>
          </div>
        </div>
      </main >
    </Layout >
  );
}

export default Home;
