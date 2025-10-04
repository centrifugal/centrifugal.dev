import React, { useState } from 'react';
import styles from './QuickStart.module.css';

export const QuickStartDescription = ({ children }) => {
    return <div className={styles.description}>{children}</div>;
};

const QuickStart = () => {
    const [copied, setCopied] = useState(false);

    const dockerCommand = 'docker run -p 8000:8000 centrifugo/centrifugo:v6 centrifugo';

    const handleCopy = () => {
        navigator.clipboard.writeText(dockerCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={styles.quickStart}>
            <div className={styles.terminalWindow}>
                <div className={styles.terminalHeader}>
                    <div className={styles.terminalButtons}>
                        <span className={styles.buttonRed}></span>
                        <span className={styles.buttonYellow}></span>
                        <span className={styles.buttonGreen}></span>
                    </div>
                    <div className={styles.terminalTitle}>Terminal</div>
                </div>
                <div className={styles.terminalBody}>
                    <div className={styles.commandLine}>
                        <span className={styles.prompt}>$</span>
                        <span className={styles.command}>{dockerCommand}</span>
                    </div>
                    <button
                        className={styles.copyButton}
                        onClick={handleCopy}
                        aria-label="Copy command"
                    >
                        {copied ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickStart;
