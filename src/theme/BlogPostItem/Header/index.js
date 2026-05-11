import React from 'react';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import OriginalHeader from '@theme-original/BlogPostItem/Header';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function BlogPostItemHeaderWrapper(props) {
  const {isBlogPostPage, metadata} = useBlogPost();
  const {title, date, frontMatter, readingTime, description} = metadata;
  const image = frontMatter.image;
  const resolvedImage = useBaseUrl(image || '');

  if (!isBlogPostPage || !image) {
    return <OriginalHeader {...props} />;
  }

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const readMin = readingTime ? `${Math.ceil(readingTime)} min read` : null;

  return (
    <header className={styles.hero}>
      <div
        className={styles.heroBg}
        style={{backgroundImage: `url(${resolvedImage})`}}
        aria-hidden="true"
      />
      <div className={styles.heroOverlay} aria-hidden="true" />
      <div className={styles.heroContent}>
        <div className={styles.heroMeta}>
          <span>{formattedDate}</span>
          {readMin && (
            <>
              <span className={styles.dot}>·</span>
              <span>{readMin}</span>
            </>
          )}
        </div>
        <h1 className={styles.heroTitle} itemProp="headline">{title}</h1>
        {description && (
          <p className={styles.heroDescription}>{description}</p>
        )}
      </div>
    </header>
  );
}
