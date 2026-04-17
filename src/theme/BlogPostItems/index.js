import React from 'react';
import Link from "@docusaurus/Link";
import { useBlogPost } from '@docusaurus/plugin-content-blog/client'
import BlogPostItemContainer from "@theme/BlogPostItem/Container";
import { BlogPostProvider } from '@docusaurus/plugin-content-blog/client';
import styles from './styles.module.css';

export default function BlogPostItemsWrapper(props) {
  return (
    <>
      <BlogPostItems {...props} />
    </>
  );
}

function BlogPostItems({
  items,
  component: BlogPostItemComponent = BlogPostItem,
}) {
  return (
    <div className={styles.list}>
      {items.map(({ content: BlogPostContent }, index) => (
        <BlogPostProvider
          key={BlogPostContent.metadata.permalink}
          content={BlogPostContent}>
          <BlogPostItemComponent featured={index === 0}>
            <BlogPostContent />
          </BlogPostItemComponent>
        </BlogPostProvider>
      ))}
    </div>
  );
}

function BlogPostItem({ featured }) {
  const { metadata } = useBlogPost();

  const {
    permalink,
    title,
    date,
    frontMatter,
    description,
    readingTime,
  } = metadata;

  const author = metadata.authors[0];
  const readMin = readingTime ? `${Math.ceil(readingTime)} min read` : null;
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (featured) {
    return (
      <BlogPostItemContainer>
        <Link itemProp="url" to={permalink} className={styles.featuredCard}>
          <div className={styles.featuredImage}>
            {frontMatter.image && <img src={frontMatter.image} alt={title} />}
            <span className={styles.metaTag}>{formattedDate}{readMin && ` · ${readMin}`}</span>
          </div>
          <div className={styles.featuredOverlay}>
            <h2 className={styles.featuredTitle}>{title}</h2>
            <p className={styles.featuredDesc}>{description}</p>
          </div>
        </Link>
      </BlogPostItemContainer>
    );
  }

  return (
    <BlogPostItemContainer>
      <Link itemProp="url" to={permalink} className={styles.card}>
        <div className={styles.cardImageWrap}>
          <div className={styles.cardImage}>
            {frontMatter.image && <img src={frontMatter.image} alt={title} />}
          </div>
          <span className={styles.metaTag}>{formattedDate}{readMin && ` · ${readMin}`}</span>
        </div>
        <div className={styles.cardOverlay}>
          <h3 className={styles.cardTitle}>{title}</h3>
        </div>
        <p className={styles.cardDesc}>{description}</p>
      </Link>
    </BlogPostItemContainer>
  );
}
