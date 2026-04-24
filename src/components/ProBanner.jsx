import React, { useState, useEffect } from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';
import styles from './ProBanner.module.css';

const ProBanner = () => {
    const [post, setPost] = useState(null);

    let posts = [];
    try {
        const data = usePluginData('recent-blog-posts');
        posts = data?.recentPosts || [];
    } catch (e) {}

    useEffect(() => {
        if (posts.length > 0) {
            setPost(posts[Math.floor(Math.random() * posts.length)]);
        }
    }, []);

    if (!post) return null;

    return (
        <div className={styles.strip}>
            <span className={styles.badge}>New</span>
            <a className={styles.link} href={post.permalink}>
                {post.title}
            </a>
        </div>
    );
};

export default ProBanner;
