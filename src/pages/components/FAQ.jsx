import React, { useState, useCallback } from 'react';
import Link from '@docusaurus/Link';
import styles from './faq.module.css';

const faqs = [
    {
        q: 'How is PRO different from open-source Centrifugo?',
        a: (
            <>
                PRO includes everything in open-source Centrifugo and adds features for scale,
                performance, security, observability and push notifications. The comparison
                above lists them side by side.
            </>
        ),
    },
    {
        q: 'Can I try Centrifugo PRO before buying?',
        a: (
            <>
                Yes. Started without a license key, Centrifugo PRO runs in sandbox mode with
                the full feature set — capped at 20 concurrent connections, 2 nodes and 5 API
                requests per second. It's meant for development and evaluation, not
                production.{' '}
                <Link to="/docs/pro/overview#try-for-free-in-sandbox-mode">Learn more &rarr;</Link>
            </>
        ),
    },
    {
        q: 'How does licensing work?',
        a: (
            <>
                One flat, company-wide license key. It runs Centrifugo PRO with no limits on
                operations, connections or nodes, across many projects within your organization
                — including SaaS products you build on top of it. The key includes one year of
                prioritized support and updates. Licenses are available to companies and
                businesses only, not to individual consumers. The exact terms are in the{' '}
                <Link to="/license">Centrifugo PRO license agreement</Link>.
            </>
        ),
    },
    {
        q: 'Is pricing per connection or per message?',
        a: (
            <>
                No. Pricing is flat and based on your company size — never on connections,
                nodes, or message volume, so costs track your company's growth rather than your
                traffic.
            </>
        ),
    },
    {
        q: 'Do I need one license key or several?',
        a: (
            <>
                One key covers all your projects as long as Centrifugo PRO stays within your own
                company's infrastructure — including SaaS products you run. Installing it on a
                customer's own premises isn't part of the standard license, but it can be arranged
                when added explicitly to the agreement — reach out to discuss. Reselling the key or
                offering Centrifugo PRO itself as a hosted service are not permitted.
            </>
        ),
    },
    {
        q: 'What happens when the license expires?',
        a: (
            <>
                Centrifugo PRO keeps running forever, with no limits, after the key expires. A
                new key is only needed if you want to upgrade to a version of Centrifugo PRO
                released after your key's expiration date.
            </>
        ),
    },
    {
        q: 'Where does my data live?',
        a: (
            <>
                Centrifugo PRO is self-hosted and runs entirely on your own infrastructure.
                Messages and connection data stay inside your systems.
            </>
        ),
    },
    {
        q: 'How can I pay?',
        a: (
            <>
                Smaller licenses can be paid online through Lemon Squeezy (part of Stripe) with a
                range of payment methods; larger ones via a signed agreement and bank transfer. A
                standard due-diligence (KYC) check applies before moving forward.
            </>
        ),
    },
    {
        q: 'Can we sign our own agreement?',
        a: (
            <>
                By default the purchase is covered by the standard{' '}
                <Link to="/license">Centrifugo PRO license agreement</Link>. For companies that
                need it, it can instead go through an individual
                agreement based on our MSA template. Custom legal adjustments are possible and
                may affect the final price.
            </>
        ),
    },
    {
        q: 'What does prioritized support include?',
        a: (
            <>
                Direct help with configuration, scaling and troubleshooting from the team that
                builds Centrifugo, along with updates throughout your license term.
            </>
        ),
    },
];

function Chevron({ expanded }) {
    return (
        <svg
            className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ''}`}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

export default function FAQ() {
    const [open, setOpen] = useState(null);

    const toggle = useCallback((i) => {
        setOpen((prev) => (prev === i ? null : i));
    }, []);

    return (
        <section className={styles.section}>
            <div className={styles.inner}>
                <div className={styles.header}>
                    <span className={styles.eyebrow}>FAQ</span>
                    <h2 className={styles.heading}>Licensing questions</h2>
                </div>
                <div className={styles.list}>
                    {faqs.map((item, i) => {
                        const isOpen = open === i;
                        return (
                            <div
                                key={i}
                                className={`${styles.item} ${isOpen ? styles.itemOpen : ''}`}
                            >
                                <button
                                    type="button"
                                    className={styles.question}
                                    onClick={() => toggle(i)}
                                    aria-expanded={isOpen}
                                >
                                    <span>{item.q}</span>
                                    <Chevron expanded={isOpen} />
                                </button>
                                <div
                                    className={`${styles.answer} ${isOpen ? styles.answerOpen : ''}`}
                                >
                                    <div className={styles.answerInner}>{item.a}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
