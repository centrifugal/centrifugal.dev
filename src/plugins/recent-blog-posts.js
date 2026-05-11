/**
 * Custom Docusaurus plugin that exposes the most recent blog posts
 * as global data, so any page component can access them via:
 *
 *   import { usePluginData } from '@docusaurus/useGlobalData';
 *   const { recentPosts } = usePluginData('recent-blog-posts');
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

module.exports = function recentBlogPostsPlugin(context, options) {
  const blogDir = path.resolve(context.siteDir, 'blog');
  const count = (options && options.count) || 4;

  return {
    name: 'recent-blog-posts',

    async loadContent() {
      if (!fs.existsSync(blogDir)) return [];

      const entries = fs.readdirSync(blogDir).filter((name) => {
        const full = path.join(blogDir, name);
        // Accept both .md files and directories containing index.md(x)
        if (fs.statSync(full).isDirectory()) {
          return (
            fs.existsSync(path.join(full, 'index.md')) ||
            fs.existsSync(path.join(full, 'index.mdx'))
          );
        }
        return name.endsWith('.md') || name.endsWith('.mdx');
      });

      const posts = entries
        .map((name) => {
          const full = path.join(blogDir, name);
          let filePath;
          if (fs.statSync(full).isDirectory()) {
            filePath = fs.existsSync(path.join(full, 'index.mdx'))
              ? path.join(full, 'index.mdx')
              : path.join(full, 'index.md');
          } else {
            filePath = full;
          }

          const src = fs.readFileSync(filePath, 'utf-8');
          const { data: fm } = matter(src);
          if (fm.draft) return null;

          // Parse date from frontmatter or filename (YYYY-MM-DD prefix)
          let date = fm.date;
          if (!date) {
            const match = name.match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) date = match[1];
          }
          if (!date) return null;

          // Build permalink slug from filename
          // e.g. "2026-04-07-map-subscriptions.md" → "/blog/2026/04/07/map-subscriptions"
          const slug =
            fm.slug ||
            name
              .replace(/\.mdx?$/, '')
              .replace(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/, '$1/$2/$3/$4')
              .replace(/\/index$/, '');

          return {
            title: fm.title || name,
            description: fm.description || '',
            date: new Date(date).toISOString(),
            image: fm.image || null,
            permalink: `/blog/${slug}`,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, count);

      return posts;
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData({ recentPosts: content });
    },
  };
};
