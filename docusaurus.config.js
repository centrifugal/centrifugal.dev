module.exports = {
  title: "Centrifugo",
  tagline: "is CSS for components",
  url: "https://centrifugal.dev",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.png",
  organizationName: "centrifugal", // Usually your GitHub org/user name.
  projectName: "centrifugal.dev", // Usually your repo name.
  themeConfig: {
    prism: {

    },
    colorMode: {
      // "light" | "dark"
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    },
    navbar: {
      hideOnScroll: true,
      title: "Centrifugo",
      logo: {
        alt: "Centrifugo Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          to: "docs/getting-started/introduction",
          activeBasePath: "docs/getting-started",
          label: "Getting Started",
          position: "left",
        },
        {
          to: "docs/server/configuration",
          activeBasePath: "docs/server",
          label: "Server guide",
          position: "left",
        },
        {
          to: "docs/transports/overview",
          activeBasePath: "docs/transports",
          label: "Transports",
          position: "left",
        },
        {
          to: "docs/ecosystem/client",
          activeBasePath: "docs/ecosystem",
          label: "Ecosystem",
          position: "left",
        },
        {
          to: "docs/pro/overview",
          activeBasePath: "docs/pro",
          label: "Centrifugo PRO",
          position: "left",
        },
        {
          to: "docs/faq/index",
          activeBasePath: "docs/faq",
          label: "FAQ",
          position: "left",
        },
        { to: 'blog', label: 'Blog', position: 'left' },
        {
          href: "https://github.com/centrifugal/centrifugo",
          position: "right",
          className: "header-github-link",
          "aria-label": "GitHub repository",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Contacts",
          items: [
            {
              label: "Send e-mail",
              to: "mailto:centrifugal.dev@gmail.com",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Issues",
              href: "https://github.com/centrifugal/centrifugo/issues",
            },
            {
              label: "Telegram",
              href: "https://t.me/joinchat/U57MI8Lam9mhpuhd",
            },
            {
              label: "Discord",
              href: "https://discord.gg/tYgADKx",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Attributions",
              to: "docs/attributions",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Centrifugal.`,
    },
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          sidebarPath: require.resolve("./src/sidebars"),
          editUrl:
            "https://github.com/centrifugal/centrifugal.dev/edit/main",
        },
        blog: {
          showReadingTime: true,
          /**
           * Path to data on filesystem relative to site dir.
           */
          path: 'blog',
          /**
           * Base url to edit your site.
           * Docusaurus will compute the final editUrl with "editUrl + relativeDocPath"
           */
          editUrl: 'https://github.com/centrifugal/centrifugal.dev/edit/main/',
          /**
           * For advanced cases, compute the edit url for each markdown file yourself.
           */
          editUrl: ({ locale, blogDirPath, blogPath, permalink }) => {
            return `https://github.com/centrifugal/centrifugal.dev/edit/main/${blogDirPath}/${blogPath}`;
          },
          /**
           * Useful if you commit localized files to git.
           * When markdown files are localized, the edit url will target the localized file,
           * instead of the original unlocalized file.
           * Note: this option is ignored when editUrl is a function
           */
          editLocalizedFiles: false,
          /**
           * Blog page title for better SEO
           */
          blogTitle: 'Centrifugal Blog',
          /**
           * Blog page meta description for better SEO
           */
          blogDescription: 'Centrifugal Blog',
          /**
           * Number of blog post elements to show in the blog sidebar
           * 'ALL' to show all blog posts
           * 0 to disable
           */
          blogSidebarCount: 5,
          /**
           * Title of the blog sidebar
           */
          blogSidebarTitle: 'All our posts',
          /**
           * URL route for the blog section of your site.
           * *DO NOT* include a trailing slash.
           */
          routeBasePath: 'blog',
          include: ['*.md', '*.mdx'],
          postsPerPage: 10,
          /**
           * Theme components used by the blog pages.
           */
          blogListComponent: '@theme/BlogListPage',
          blogPostComponent: '@theme/BlogPostPage',
          blogTagsListComponent: '@theme/BlogTagsListPage',
          blogTagsPostsComponent: '@theme/BlogTagsPostsPage',
          /**
           * Remark and Rehype plugins passed to MDX.
           */
          remarkPlugins: [
            /* require('remark-math') */
          ],
          rehypePlugins: [],
          /**
           * Custom Remark and Rehype plugins passed to MDX before
           * the default Docusaurus Remark and Rehype plugins.
           */
          beforeDefaultRemarkPlugins: [],
          beforeDefaultRehypePlugins: [],
          /**
           * Truncate marker, can be a regex or string.
           */
          truncateMarker: /<!--\s*(truncate)\s*-->/,
          /**
           * Show estimated reading time for the blog post.
           */
          showReadingTime: true,
          /**
           * Blog feed.
           * If feedOptions is undefined, no rss feed will be generated.
           */
          feedOptions: {
            type: 'all', // required. 'rss' | 'feed' | 'all'
            title: '', // default to siteConfig.title
            description: '', // default to  `${siteConfig.title} Blog`
            copyright: 'Centrifugal',
            language: undefined, // possible values: http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
          },
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],
  plugins: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
      },
    ],
  ],
};
