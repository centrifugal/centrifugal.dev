import React from 'react';
import clsx from 'clsx';
import { useColorMode } from '@docusaurus/theme-common';
import Logo from '../pages/components/logo';
import Ray from '../pages/components/Ray';
import styles from '../pages/styles.module.css';

export default function Hero({ children }) {
  const isDarkTheme = useColorMode().colorMode === 'dark';
  return (
    <header id="hero" className={clsx("hero hero--primary", styles.heroBanner)}>
      <Ray />
      <Logo isDarkTheme={isDarkTheme} />
      <div className="container" style={{ zIndex: 1, pointerEvents: "none" }}>
        {children}
      </div>
    </header>
  );
}
