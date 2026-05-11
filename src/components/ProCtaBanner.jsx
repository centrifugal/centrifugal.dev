import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './ProCtaBanner.module.css';
import ImageRotator from './ImageRotator';

export default function ProCtaBanner() {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className="row">
          <div className={clsx('col col--6', styles.content)}>
            <span className={styles.label}>For teams that need more</span>
            <h2 className={styles.title}>
              Unlock the full <span className={styles.titleGradient}>power</span> of Centrifugo
            </h2>
            <p className={styles.text}>
              Centrifugal Labs offers a PRO version of Centrifugo that includes a set of unique features, additional APIs, and enhanced performance. Ever dreamed about a self-hosted real-time messaging system combined with a push notification system? Want to benefit from analytics of real-time connections and subscriptions? Centrifugo PRO makes this all possible.
            </p>
            <div className={styles.cta}>
              <Link
                className={clsx(
                  "button button--outline button--secondary button--lg"
                )}
                to={useBaseUrl("/pro")}
              >
                More about Centrifugo PRO
              </Link>
            </div>
          </div>
          <div className={clsx('col col--6', styles.visual)}>
            <ImageRotator />
          </div>
        </div>
      </div>
    </section>
  );
}
