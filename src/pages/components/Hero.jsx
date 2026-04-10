import React from 'react';
import clsx from 'clsx';
import { useColorMode } from '@docusaurus/theme-common';
import Logo from './logo';
import Ray from './Ray';
import LiveCounter from './LiveCounter';
import styles from '../styles.module.css';

export default function Hero({ children }) {
  const isDarkTheme = useColorMode().colorMode === 'dark';
  return (
    <header id="hero" className={clsx("hero hero--primary", styles.heroBanner)}>
      <Ray />
      <Logo isDarkTheme={isDarkTheme} />
      <div className="container" style={{ zIndex: 1, pointerEvents: "none" }}>
        {children}
      </div>
      <LiveCounter />
    </header>
  );
}
