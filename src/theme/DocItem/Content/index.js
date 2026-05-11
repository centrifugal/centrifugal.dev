import React from 'react';
import Content from '@theme-original/DocItem/Content';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import AskAI from '@site/src/components/AskAI';

export default function ContentWrapper(props) {
    const { metadata } = useDoc();
    const { siteConfig } = useDocusaurusContext();
    const url = `${siteConfig.url}${metadata.permalink}`;

    return (
        <>
            <AskAI title={metadata.title} url={url} />
            <Content {...props} />
        </>
    );
}
