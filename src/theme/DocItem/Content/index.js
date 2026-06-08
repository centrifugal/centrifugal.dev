import React from 'react';
import Head from '@docusaurus/Head';
import Content from '@theme-original/DocItem/Content';
import { useDoc, useDocsVersion } from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import AskAI from '@site/src/components/AskAI';

// Maps the first path segment of a doc permalink (/docs/<section>/...) to a
// breadcrumb section label and its landing page. Used to emit a consistent
// `Home > Section > Page` BreadcrumbList for SEO (breadcrumb rich results).
// We build this ourselves instead of relying on Docusaurus' sidebar-based
// breadcrumbs because the site keeps the visible breadcrumb nav disabled and
// sidebar association is not uniform across all docs.
const DOC_SECTIONS = {
    'getting-started': { label: 'Getting Started', href: '/docs/getting-started/introduction' },
    'server': { label: 'Server Guide', href: '/docs/server/configuration' },
    'transports': { label: 'Transports & SDK', href: '/docs/transports/overview' },
    'pro': { label: 'Centrifugo PRO', href: '/docs/pro/overview' },
    'faq': { label: 'FAQ', href: '/docs/faq' },
    'tutorial': { label: 'Tutorial', href: '/docs/tutorial/intro' },
};

function buildBreadcrumbStructuredData({ metadata, siteUrl }) {
    const permalink = metadata.permalink; // e.g. "/docs/server/channels"
    const abs = (p) => `${siteUrl}${p}`;
    const sectionKey = (permalink.match(/^\/docs\/([^/]+)/) || [])[1];
    const section = DOC_SECTIONS[sectionKey];

    // Compare paths ignoring a trailing slash (index docs like the FAQ resolve
    // to "/docs/faq/" while the section href is "/docs/faq").
    const norm = (p) => p.replace(/\/+$/, '');

    const crumbs = [{ name: 'Home', item: `${siteUrl}/` }];
    // Skip the section crumb when the current page *is* the section landing page,
    // to avoid two crumbs pointing at the same URL.
    if (section && norm(section.href) !== norm(permalink)) {
        crumbs.push({ name: section.label, item: abs(section.href) });
    }
    crumbs.push({ name: metadata.title, item: abs(permalink) });

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: c.item,
        })),
    };
}

export default function ContentWrapper(props) {
    const { metadata } = useDoc();
    const version = useDocsVersion();
    const { siteConfig } = useDocusaurusContext();
    const url = `${siteConfig.url}${metadata.permalink}`;

    // Older (non-latest) doc versions stay accessible but are excluded from
    // search indexes so they don't compete with the current version for the
    // same queries. They are also dropped from the sitemap (see config).
    const noIndex = !version.isLast;

    // Only emit breadcrumb structured data for the latest (indexed) version —
    // older versions are noindex and their permalinks carry a version prefix
    // (/docs/5/...) that wouldn't map to a section anyway.
    const breadcrumbData = version.isLast
        ? buildBreadcrumbStructuredData({ metadata, siteUrl: siteConfig.url })
        : null;

    return (
        <>
            {noIndex && (
                <Head>
                    <meta name="robots" content="noindex" />
                </Head>
            )}
            {breadcrumbData && (
                <Head>
                    <script type="application/ld+json">
                        {JSON.stringify(breadcrumbData)}
                    </script>
                </Head>
            )}
            <AskAI title={metadata.title} url={url} />
            <Content {...props} />
        </>
    );
}
