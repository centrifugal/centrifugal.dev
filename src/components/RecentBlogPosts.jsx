import React from 'react';
import Link from '@docusaurus/Link';
import { usePluginData } from '@docusaurus/useGlobalData';
import styles from './RecentBlogPosts.module.css';

export default function RecentBlogPosts() {
  let recentPosts = [];
  try {
    const data = usePluginData('recent-blog-posts');
    recentPosts = data?.recentPosts || [];
  } catch (e) {
    return null;
  }

  if (recentPosts.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2 className={styles.title}>From the Centrifugal blog</h2>
          <Link to="/blog" className={styles.viewAll}>
            View all posts &rarr;
          </Link>
        </div>
        <div className={styles.grid}>
          {recentPosts.slice(0, 4).map((post) => (
            <Link
              key={post.permalink}
              to={post.permalink}
              className={styles.card}
            >
              <div className={styles.imageWrap}>
                {post.image ? (
                  <img
                    src={post.image}
                    alt={post.title}
                    className={styles.image}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.imagePlaceholder} />
                )}
                <div className={styles.overlay}>
                  <h3 className={styles.cardTitle}>{post.title}</h3>
                </div>
                <span className={styles.metaTag}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <p className={styles.desc}>{post.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
