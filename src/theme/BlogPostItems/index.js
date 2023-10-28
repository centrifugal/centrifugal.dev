import React from 'react';
import Link from "@docusaurus/Link";
import { useBlogPost } from "@docusaurus/theme-common/internal";
import BlogPostItemContainer from "@theme/BlogPostItem/Container";
import { BlogPostProvider } from '@docusaurus/theme-common/internal';
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
    <>
      {items.map(({ content: BlogPostContent }) => (
        <BlogPostProvider
          key={BlogPostContent.metadata.permalink}
          content={BlogPostContent}>
          <BlogPostItemComponent>
            <BlogPostContent />
          </BlogPostItemComponent>
        </BlogPostProvider>
      ))}
    </>
  );
}

function BlogPostItem({ className }) {
  const { metadata } = useBlogPost();

  console.log(metadata);

  const {
    permalink,
    title,
    // date,
    formattedDate,
    frontMatter,
    description,
    // tags,
  } = metadata;

  const author = metadata.authors[0];

  return (
    <BlogPostItemContainer className={className}>
      <div className={styles.container}>
        <div className={styles.leftColumn}>
          <img src={frontMatter.image} width="200px" />
        </div>
        <div className={styles.rightColumn}>
          <div>
            <Link itemProp="url" to={permalink} style={{ "fontSize": "1.0em" }}>
              {title}
            </Link>
          </div>
          <div
            style={{ "fontSize": "0.8em", color: "#6d6666" }}
          >
            {formattedDate} by {author?.name}
          </div>
          <div>
            <div>
              <div
                style={{ fontSize: "0.9em" }}
              >
                {description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BlogPostItemContainer>
  );
}
