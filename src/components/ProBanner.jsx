import React, { useState, useEffect } from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';
import styles from './ProBanner.module.css';

const ROTATE_MS = 30000;
const TRANSITION_MS = 500;
const POSTS_COUNT = 3;

const ProBanner = () => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [nextIdx, setNextIdx] = useState(null);

    let posts = [];
    try {
        const data = usePluginData('recent-blog-posts');
        posts = (data?.recentPosts || []).slice(0, POSTS_COUNT);
    } catch (e) {}

    useEffect(() => {
        if (posts.length > 0) {
            setCurrentIdx(Math.floor(Math.random() * posts.length));
        }
    }, [posts.length]);

    useEffect(() => {
        if (posts.length <= 1 || nextIdx !== null) return;
        const id = setTimeout(() => {
            setNextIdx((currentIdx + 1) % posts.length);
        }, ROTATE_MS);
        return () => clearTimeout(id);
    }, [currentIdx, nextIdx, posts.length]);

    useEffect(() => {
        if (nextIdx === null) return;
        const id = setTimeout(() => {
            setCurrentIdx(nextIdx);
            setNextIdx(null);
        }, TRANSITION_MS);
        return () => clearTimeout(id);
    }, [nextIdx]);

    if (posts.length === 0) return null;

    // Single-post case: no rotation needed, render statically without viewport/animation infra.
    if (posts.length === 1) {
        return (
            <div className={styles.strip}>
                <div className={styles.unit}>
                    <span className={styles.badge}>New</span>
                    <a className={styles.link} href={posts[0].permalink}>
                        {posts[0].title}
                    </a>
                </div>
            </div>
        );
    }

    const currentPost = posts[currentIdx];
    const nextPost = nextIdx !== null ? posts[nextIdx] : null;
    const transitioning = nextPost !== null;

    return (
        <div className={styles.strip}>
            <div className={styles.viewport}>
                {/* Placeholder reserves layout width during transition so the strip doesn't collapse */}
                <div
                    className={`${styles.unit} ${transitioning ? styles.placeholder : ''}`}
                    aria-hidden={transitioning ? 'true' : undefined}
                >
                    <span className={styles.badge}>New</span>
                    <a
                        className={styles.link}
                        href={currentPost.permalink}
                        tabIndex={transitioning ? -1 : undefined}
                    >
                        {currentPost.title}
                    </a>
                </div>

                {transitioning && (
                    <>
                        <div
                            className={`${styles.unitAbsolute} ${styles.exitRight}`}
                            aria-hidden="true"
                        >
                            <span className={styles.badge}>New</span>
                            <a className={styles.link} href={currentPost.permalink} tabIndex={-1}>
                                {currentPost.title}
                            </a>
                        </div>
                        <div className={`${styles.unitAbsolute} ${styles.enterFromLeft}`}>
                            <span className={styles.badge}>New</span>
                            <a className={styles.link} href={nextPost.permalink}>
                                {nextPost.title}
                            </a>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ProBanner;
