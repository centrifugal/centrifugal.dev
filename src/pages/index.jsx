import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./styles.module.css";
import { useColorMode } from '@docusaurus/theme-common';
import Hero from '../components/Hero';
import Highlight from './components/Highlight';
import TitleWithCat from './components/TitleWithCat';
import Badoo from "./components/logos/Badoo";
import Grafana from "./components/logos/Grafana";
import ManyChat from "./components/logos/ManyChat";
import OpenWeb from "./components/logos/OpenWeb";
import Mayflower from "./components/logos/Mayflower";
import Exness from "./components/logos/Exness";
import InDrive from "./components/logos/InDrive";
import Plata from "./components/logos/Plata";
import AzuraCast from "./components/logos/AzuraCast";
import Selectel from "./components/logos/Selectel";
import Nobitex from "./components/logos/Nobitex";
import Altamira from "./components/logos/Altamira";
import TestimonialsCarousel from '../components/TestimonialsCarousel';
import ProBanner from '../components/ProBanner';
import ImageRotator from '../components/ImageRotator';
import ProCtaBanner from '../components/ProCtaBanner';
import RecentBlogPosts from '../components/RecentBlogPosts';
import AIStreaming from '../components/AIStreaming';
import SubscriptionTypes from '../components/SubscriptionTypes';
import GitHubStarButton from '../components/GitHubStarButton';
import QuickStart, { QuickStartDescription } from '../components/QuickStart';
import { ChatIcon, DashboardIcon, GameIcon, DataSyncIcon, FinancialIcon, LiveFeedIcon, IoTIcon, AIIcon } from '../components/UseCaseIcons';

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
        <TitleWithCat isDarkTheme={isDarkTheme} />
      </div>
      <h1 className={styles.subTitle}>
        Wash away realtime complexity
      </h1>
      <div className={styles.subSubTitle}>
        Scalable <span className="text-gradient text-gradient-hero">realtime messaging</span> and <span className="text-gradient text-gradient-hero">data sync</span> for any stack. Spin up once and forever.
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
        <GitHubStarButton />
      </div>
    </Hero>
  );
}

function Home() {
  return (
    <Layout
      title="Scalable real-time messaging server"
      description="Centrifugo is an open-source real-time messaging server — a self-hosted alternative to PubNub, Pusher, Ably, Socket.IO, Phoenix.PubSub & SignalR. Set up once and forever."
    >
      <Head>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://centrifugal.dev/#organization",
                "name": "Centrifugal Labs LTD",
                "alternateName": "Centrifugal Labs",
                "url": "https://centrifugal.dev",
                "logo": "https://centrifugal.dev/img/logo.svg",
                "description": "Centrifugal Labs powers realtime magic. The flagship product is Centrifugo — a self-hosted realtime messaging and data sync platform, stack-agnostic and integrates with any frontend or backend technology.",
                "sameAs": [
                  "https://github.com/centrifugal",
                  "https://twitter.com/centrifugalabs",
                  "https://discord.gg/tYgADKx"
                ]
              },
              {
                "@type": "WebSite",
                "@id": "https://centrifugal.dev/#website",
                "name": "Centrifugo",
                "alternateName": ["Centrifugo real-time messaging server", "Centrifugo server"],
                "url": "https://centrifugal.dev",
                "publisher": { "@id": "https://centrifugal.dev/#organization" },
                "about": { "@id": "https://centrifugal.dev/#software" }
              },
              {
                "@type": "SoftwareApplication",
                "@id": "https://centrifugal.dev/#software",
                "name": "Centrifugo",
                "url": "https://centrifugal.dev",
                "applicationCategory": "DeveloperApplication",
                "operatingSystem": "Linux, macOS, Windows, Docker, Kubernetes",
                "description": "Self-hosted realtime messaging and data sync platform. Delivers messages instantly via WebSocket, HTTP-streaming, SSE, WebTransport, or gRPC. Synchronizes key-value state across clients with transactional consistency. Perfect for chats, live updates, AI streaming, multiplayer games, dashboards, and collaborative tools. Scales to millions of connections.",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "EUR"
                },
                "publisher": { "@id": "https://centrifugal.dev/#organization" },
                "author": { "@id": "https://centrifugal.dev/#organization" }
              }
            ]
          })}
        </script>
      </Head>
      <div className={styles.landingTop}>
        <div className={styles.landingBackdrop} aria-hidden="true" />
        <Header />
        <ProBanner />
        <main>
        <section className={clsx("logos-wrapper", styles.logos)}>
          <div className="container">
            <div className={styles.logosHeader}>
              TRUSTED BY SUCCESSFUL COMPANIES WORLDWIDE. THOUSANDS OF REAL INSTALLATIONS.
            </div>
            <div className={styles.logosGrid}>
              <div className={styles.logoItem}>
                <Badoo />
              </div>
              <div className={styles.logoItem}>
                <Grafana />
              </div>
              <div className={styles.logoItem}>
                <ManyChat />
              </div>
              <div className={styles.logoItem}>
                <OpenWeb />
              </div>
              <div className={styles.logoItem}>
                <Mayflower />
              </div>
              <div className={styles.logoItem}>
                <Exness />
              </div>
              <div className={styles.logoItem}>
                <AzuraCast />
              </div>
              <div className={styles.logoItem}>
                <Selectel />
              </div>
              <div className={styles.logoItem}>
                <Plata />
              </div>
              <div className={styles.logoItem}>
                <Nobitex />
              </div>
              <div className={styles.logoItem}>
                <InDrive />
              </div>
              <div className={styles.logoItem}>
                <Altamira />
              </div>
            </div>
          </div>
        </section>
        <Highlight
          img={<QuickStart />}
          title=""
          text={
            <QuickStartDescription>
              <p>
                Get Centrifugo running in seconds with a single Docker command.
              </p>
              <p>
                Lightweight but with Centrifugal force inside. See <a href="/docs/getting-started/installation">all the ways to install</a>.
              </p>
            </QuickStartDescription>
          }
        />
        <section className={clsx("features-wrapper", styles.features)}>
          <div className="container">
            <div className="row">
              <Feature title="Seamless Integration" imageUrl="img/feature_integration.png">
                Centrifugo is a self-hosted service which handles connections over various <a href="/docs/transports/overview">transports</a> and provides a simple <a href="/docs/server/server_api">publishing API</a>.
                Centrifugo nicely integrates with any application &mdash; no changes in
                the existing app architecture required to introduce realtime updates.
              </Feature>
              <Feature title="Great Performance" imageUrl="img/feature_performance.png">
                Centrifugo is written in Go language and includes some smart optimizations.
                See the description of the test stand with <a href="/blog/2020/02/10/million-connections-with-centrifugo">one million WebSocket</a> connections and 30 million delivered
                messages per minute on hardware comparable to a single modern server.
              </Feature>
              <Feature title="Feature-rich" imageUrl="img/feature_rich.png">
                Centrifugo provides flexible auth, various types
                of subscriptions, channel history, online presence, delta updates, the ability to proxy connection events to the
                backend, and much more. It comes with official SDK libraries for both web and mobile development.
              </Feature>
              <Feature title="Out-of-the-box Scalability" imageUrl="img/feature_scalability.png">
                Scale connections over many Centrifugo nodes by using built-in integrations with efficient brokers: Redis (or Redis Cluster, or Redis-compatible storages like AWS Elasticache, Google Memorystore, DragonflyDB, Valkey, KeyDB), PostgreSQL and Nats.
              </Feature>
              <Feature title="Proven in Production" imageUrl="img/feature_production.png">
                Started a decade ago, Centrifugo (and Centrifuge library for Go
                it's built on top of) is mature, battle-tested software that has been successfully used in
                production by many companies around the world: VK, Badoo, ManyChat, OpenWeb, Grafana, and others.
              </Feature>
              <Feature title="Centrifugo PRO" imageUrl="img/feature_pro.png">
                <a href="/pro">Centrifugo PRO</a> offers great benefits for corporate and enterprise environments by providing unique features on top of the OSS version: analytics
                with ClickHouse, realtime tracing, performance optimizations, push notification API, SSO integrations for web UI, etc.
              </Feature>
            </div>
          </div>
        </section>
        <Highlight
          img={
            <img src="/img/basic_pub_sub.png" alt="Centrifugo PUB/SUB architecture: a backend publishes messages to channels and Centrifugo broadcasts them in real time to subscribed WebSocket clients" loading="lazy" />
          }
          reversed
          isDark
          title="Realtime messaging & data sync"
          text={
            <>
              <p>
                Realtime messaging delivers events to online users with minimal delay. Chats, live comments, multiplayer games, AI streaming responses &mdash; all built on top of a realtime messaging layer.
              </p>
              <p>
                Data sync allows keeping state synchronized across clients in realtime providing eventual consistency with your database.
              </p>
              <p>
                Centrifugo handles persistent connections over <b>WebSocket</b>, HTTP-streaming, SSE, WebTransport, and gRPC &mdash; providing both <b>PUB/SUB messaging</b> and <b>state synchronization</b> primitives.
              </p>
            </>
          }
        />
        < Highlight
          img={
            <img src="/img/broadcast.svg" alt="Broadcast illustration" className={styles.broadcastImg} />
          }
          title="Efficient message broadcast"
          text={
            <>
              <p>
                Centrifugo excels at broadcasting messages to many subscribers simultaneously. The efficient client protocol (JSON or binary Protobuf) enables high-throughput messaging at scale.
              </p>
              <p>
                The design of Centrifugo is optimized for scenarios where a single message needs to be sent to thousands or even millions of clients, making it ideal for realtime applications that require instant updates to large audiences.
              </p>
              <div className={styles.buttons}>
                <Link
                    className={clsx(
                        "button button--outline button--secondary button--lg",
                        styles.getStarted
                    )}
                    to={useBaseUrl("/blog/2020/02/10/million-connections-with-centrifugo")}
                >
                  Million connections and 500K msg/s in K8S
                </Link>
              </div>
            </>
          }
        />
        <section className={styles.useCases}>
          <div className="container">
            <div className={styles.useCasesGrid}>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><ChatIcon /></div>
                <h3>Chat & Messaging</h3>
                <p>Build realtime chat applications, live comments, and instant messaging systems</p>
              </div>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><DashboardIcon /></div>
                <h3>Live Dashboards</h3>
                <p>Stream metrics, analytics, and telemetry data for realtime visualization</p>
              </div>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><GameIcon /></div>
                <h3>Multiplayer Games</h3>
                <p>Synchronize game state and player actions in realtime gaming experiences</p>
              </div>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><DataSyncIcon /></div>
                <h3>Data Sync</h3>
                <p>Synchronize key-value state across clients with transactional consistency</p>
              </div>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><FinancialIcon /></div>
                <h3>Financial Data</h3>
                <p>Deliver realtime stock prices, trading updates, and market information</p>
              </div>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><LiveFeedIcon /></div>
                <h3>Live Data Feeds</h3>
                <p>Poll backend once, fan out changes to thousands of clients automatically</p>
              </div>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><IoTIcon /></div>
                <h3>IoT & Tracking</h3>
                <p>Track vehicles, devices, and sensor data with live location updates</p>
              </div>
              <div className={styles.useCaseItem}>
                <div className={styles.useCaseIcon}><AIIcon /></div>
                <h3>AI Streaming</h3>
                <p>Stream AI model responses and live generation results to users</p>
              </div>
            </div>
          </div>
        </section>
        <TestimonialsCarousel />
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
          reversed
          text={
            <>
              <p>
                Here is the realtime telemetry streamed from the Assetto Corsa racing simulator to the Grafana dashboard with a help of our WebSocket technologies.
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
        < Highlight
          img={
            <video
              width="560"
              height="315"
              src="/img/grand-chat-tutorial-demo.mp4"
              title="Messenger tutorial"
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          }
          isDark
          title="Slack-scale messenger?"
          text={
            <>
              <p>
                Straightforward with Centrifugo! Even though your backend does not support concurrency. See the tutorial where we build a beautiful messenger app and go beyond usually shown basics.
              </p>
              <p>Centrifugo is a versatile realtime component – it can be used to build various types of realtime applications, not just messengers.</p>
              <div className={styles.buttons}>
                <Link
                  className={clsx(
                    "button button--outline button--secondary button--lg",
                    styles.getStarted
                  )}
                  to={useBaseUrl("docs/tutorial/intro")}
                >
                  See full tutorial
                </Link>
              </div>
            </>
          }
        />
        <AIStreaming />
        <RecentBlogPosts />
        <ProCtaBanner />
        </main >
      </div>
    </Layout >
  );
}

export default Home;
