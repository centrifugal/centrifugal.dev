import React from 'react';
import Head from '@docusaurus/Head';
import Content from '@theme-original/DocItem/Content';
import { useDoc, useDocsVersion } from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import AskAI from '@site/src/components/AskAI';

export default function ContentWrapper(props) {
    const { metadata } = useDoc();
    const version = useDocsVersion();
    const { siteConfig } = useDocusaurusContext();
    const url = `${siteConfig.url}${metadata.permalink}`;

    // Older (non-latest) doc versions stay accessible but are excluded from
    // search indexes so they don't compete with the current version for the
    // same queries. They are also dropped from the sitemap (see config).
    const noIndex = !version.isLast;

    return (
        <>
            {noIndex && (
                <Head>
                    <meta name="robots" content="noindex" />
                </Head>
            )}
            <AskAI title={metadata.title} url={url} />
            <Content {...props} />
        </>
    );
}
