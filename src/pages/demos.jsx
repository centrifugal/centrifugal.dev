import React from "react";
import Layout from "@theme/Layout";
import DemoGallery from "../components/demos/DemoGallery";
import demoData from "../data/demos.json";
import styles from "./demos.module.css";

const TITLE = "Demos";
const DESCRIPTION =
    "Real-time features built with Centrifugo — shared cursors, live dashboards, presence, chat, AI token streams, and load tests. Most of them run locally with Docker Compose.";

export default function Demos() {
    return (
        <Layout title={TITLE} description={DESCRIPTION}>
            <div className={styles.page}>
                <header className={styles.header}>
                    <div className="container">
                        <h1 className={styles.title}>Centrifugo in action</h1>
                        <p className={styles.subtitle}>
                            Cursors, dashboards, presence, chat, AI streams, and a few deliberately
                            extreme load tests. Hover a card for a preview, click to watch it, then
                            take the source and run it yourself.
                        </p>
                        <p className={styles.meta}>
                            {demoData.demos.length} demos · most of them start with one Docker Compose command
                        </p>
                    </div>
                </header>

                <main className={`container ${styles.main}`}>
                    <DemoGallery />
                </main>
            </div>
        </Layout>
    );
}
