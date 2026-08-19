import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@docusaurus/Link';
import data from '@site/src/data/demos.json';
import styles from './DemoGallery.module.css';

const ALL = 'all';

// Poster/preview pairs are produced by scripts/gen-demo-media.mjs from the
// full clips in static/img. Cards show the poster, load the small preview on
// hover, and play the full clip only when a card is opened.
const posterOf = (demo) => `/img/demos/${demo.id}.webp`;
const previewOf = (demo) => `/img/demos/${demo.id}.mp4`;
const fullOf = (demo) => demo.fullVideo || demo.video;

function useReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduced(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return reduced;
}

function useHoverCapable() {
    const [capable, setCapable] = useState(false);
    useEffect(() => {
        setCapable(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }, []);
    return capable;
}

function PlayIcon({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
        </svg>
    );
}

function DemoCard({ demo, canPreview, onOpen }) {
    const [previewing, setPreviewing] = useState(false);
    const timer = useRef(null);

    // Small delay so previews don't fire while the pointer travels the grid.
    const startPreview = useCallback(() => {
        if (!canPreview) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setPreviewing(true), 160);
    }, [canPreview]);

    const stopPreview = useCallback(() => {
        clearTimeout(timer.current);
        setPreviewing(false);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    const onKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            className={styles.card}
            onClick={onOpen}
            onKeyDown={onKeyDown}
            onMouseEnter={startPreview}
            onMouseLeave={stopPreview}
            onFocus={startPreview}
            onBlur={stopPreview}
            aria-label={`Play demo: ${demo.title}`}
        >
            <div className={styles.media}>
                <img
                    className={styles.poster}
                    src={posterOf(demo)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                />
                {previewing && (
                    <video
                        className={styles.preview}
                        src={previewOf(demo)}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="none"
                    />
                )}
                {/* Touch devices get no hover preview, so they keep a play hint.
                    On pointer devices the preview itself is the affordance. */}
                <span className={styles.play} aria-hidden="true">
                    <PlayIcon className={styles.playIcon} />
                </span>
                {demo.badge && <span className={styles.badge}>{demo.badge}</span>}
            </div>
            <div className={styles.body}>
                <h3 className={styles.cardTitle}>{demo.title}</h3>
                <p className={styles.blurb}>{demo.blurb}</p>
                <div className={styles.tags}>
                    {demo.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Lightbox({ demo, onClose, onPrev, onNext }) {
    const dialog = useRef(null);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
        };
        document.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose, onNext, onPrev]);

    const { links = {} } = demo;

    return (
        <div className={styles.overlay} onClick={onClose} role="presentation">
            <div
                className={styles.dialog}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={demo.title}
                tabIndex={-1}
                ref={dialog}
            >
                <div className={styles.videoWrap}>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
                    <button type="button" className={`${styles.nav} ${styles.navPrev}`} onClick={onPrev} aria-label="Previous demo">‹</button>
                    <button type="button" className={`${styles.nav} ${styles.navNext}`} onClick={onNext} aria-label="Next demo">›</button>

                    <video
                        key={demo.id}
                        className={styles.dialogVideo}
                        src={fullOf(demo)}
                        poster={posterOf(demo)}
                        controls
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                    />
                </div>

                <div className={styles.dialogBody}>
                    <h2 className={styles.dialogTitle}>{demo.title}</h2>
                    <p className={styles.dialogText}>{demo.details || demo.blurb}</p>
                    <div className={styles.dialogFooter}>
                        <div className={styles.tags}>
                            {demo.tags.map((tag) => (
                                <span key={tag} className={styles.tag}>{tag}</span>
                            ))}
                        </div>
                        <div className={styles.dialogLinks}>
                            {links.source && (
                                <a className={styles.linkPrimary} href={links.source} target="_blank" rel="noopener noreferrer">
                                    Source code
                                </a>
                            )}
                            {links.story && (
                                <Link className={styles.link} to={links.story}>Read the story</Link>
                            )}
                            {links.docs && (
                                <Link className={styles.link} to={links.docs}>Docs</Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Full gallery by default. Pass `featured` (array of demo ids) to render a
 * subset in that order - used by the landing page section - and `showFilters`
 * to hide the category chips there.
 */
export default function DemoGallery({ featured, showFilters = true }) {
    const [category, setCategory] = useState(ALL);
    const [openIndex, setOpenIndex] = useState(null);
    const reducedMotion = useReducedMotion();
    const hoverCapable = useHoverCapable();

    const categories = useMemo(() => {
        const counts = new Map();
        data.demos.forEach((d) => counts.set(d.category, (counts.get(d.category) || 0) + 1));
        return data.categories
            .filter((c) => counts.has(c.id))
            .map((c) => ({ ...c, count: counts.get(c.id) }));
    }, []);

    const visible = useMemo(() => {
        if (featured) {
            return featured.map((id) => data.demos.find((d) => d.id === id)).filter(Boolean);
        }
        return category === ALL ? data.demos : data.demos.filter((d) => d.category === category);
    }, [category, featured]);

    const open = useCallback((index) => setOpenIndex(index), []);
    const close = useCallback(() => setOpenIndex(null), []);
    const step = useCallback(
        (delta) => setOpenIndex((i) => (i === null ? i : (i + delta + visible.length) % visible.length)),
        [visible.length],
    );

    return (
        <div className={styles.gallery}>
            {showFilters && (
            <div className={styles.filters} role="group" aria-label="Filter demos by topic">
                <button
                    type="button"
                    className={`${styles.filter} ${category === ALL ? styles.filterActive : ''}`}
                    onClick={() => setCategory(ALL)}
                >
                    All <span className={styles.filterCount}>{data.demos.length}</span>
                </button>
                {categories.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        className={`${styles.filter} ${category === c.id ? styles.filterActive : ''}`}
                        onClick={() => setCategory(c.id)}
                    >
                        {c.label} <span className={styles.filterCount}>{c.count}</span>
                    </button>
                ))}
            </div>
            )}

            <div className={styles.grid}>
                {visible.map((demo, index) => (
                    <DemoCard
                        key={demo.id}
                        demo={demo}
                        canPreview={hoverCapable && !reducedMotion}
                        onOpen={() => open(index)}
                    />
                ))}
            </div>

            {openIndex !== null && visible[openIndex] && (
                <Lightbox
                    demo={visible[openIndex]}
                    onClose={close}
                    onPrev={() => step(-1)}
                    onNext={() => step(1)}
                />
            )}
        </div>
    );
}
