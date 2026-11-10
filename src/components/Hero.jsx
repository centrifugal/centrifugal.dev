import React from 'react';
import clsx from 'clsx';
import { useColorMode } from '@docusaurus/theme-common';
import Logo from '../pages/components/logo';
import Ray from '../pages/components/Ray';
import ViceSunset, { isViceWeek } from './ViceSunset';
import styles from '../pages/styles.module.css';

export default function Hero({ children }) {
  const isDarkTheme = useColorMode().colorMode === 'dark';
  // Decided after mount: the site is static, so the date check must run in
  // the browser. Canvases draw only on the client anyway.
  const [vice, setVice] = React.useState(null);
  React.useEffect(() => setVice(isViceWeek()), []);

  return (
    <header id="hero" className={clsx("hero hero--primary", styles.heroBanner, vice && styles.heroVice)}>
      {vice === false && <Ray />}
      {vice === false && <Logo isDarkTheme={isDarkTheme} />}
      {vice === true && <ViceSunset isDarkTheme={isDarkTheme} />}
      <div className="container" style={{ zIndex: 1, pointerEvents: "none" }}>
        {children}
      </div>
    </header>
  );
}
