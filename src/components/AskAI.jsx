import React from 'react';
import styles from './AskAI.module.css';

const PROMPT_TEMPLATE = (title, url) =>
    `I'm looking at ${url}\n\nWould you kindly explain, summarize the concept, and answer any questions I have about it?`;

function ChatGPTIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0010.702.256 6.073 6.073 0 004.56 3.07a5.998 5.998 0 00-3.12 2.48 6.043 6.043 0 00.742 7.098 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.702 23a6.056 6.056 0 005.78-4.172 6.013 6.013 0 003.12-2.48 6.043 6.043 0 00-.32-6.527zM13.702 21.56a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.654 17.62a4.477 4.477 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.28a4.5 4.5 0 01-6.086-1.66zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.676l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08L8.704 5.46a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor" />
        </svg>
    );
}

function ClaudeIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fillRule="evenodd" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
        </svg>
    );
}

export default function AskAI({ title, url }) {
    const prompt = `I'm looking at ${url}\n\nWould you kindly explain, summarize the concept, and answer any questions I have about it?`;
    const claudeUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    const chatgptUrl = `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`;

    return (
        <div className={styles.container}>
            <a
                href={claudeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.button}
                title="Ask Claude about this page"
            >
                <ClaudeIcon />
            </a>
            <a
                href={chatgptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.button}
                title="Ask ChatGPT about this page"
            >
                <ChatGPTIcon />
            </a>
        </div>
    );
}
