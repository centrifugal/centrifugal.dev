import React from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './TitleWithCat.module.css';

function TitleWithCat() {
  const isDarkTheme = useColorMode().colorMode === 'dark';
  const catColor = isDarkTheme ? '#000000' : '#cfcfcf';

  const catSvgPath = "M595 2078 c-16 -50 -44 -153 -56 -206 -12 -57 -17 -65 -54 -86 -56 -34 -109 -91 -142 -156 l-29 -55 -114 -7 c-123 -6 -170 -18 -170 -43 0 -8 29 -46 65 -84 73 -77 126 -105 220 -116 55 -7 64 -12 102 -54 l41 -46 130 -3 c72 -2 184 1 249 7 158 13 217 1 245 -49 27 -50 19 -101 -41 -252 -58 -144 -72 -206 -95 -398 -9 -74 -19 -152 -21 -173 -3 -21 -19 -81 -36 -133 -39 -123 -38 -182 5 -203 43 -20 92 -5 128 40 26 33 32 52 48 171 11 75 29 164 41 199 30 89 102 230 200 395 123 206 149 263 149 334 l0 38 738 5 c405 3 814 10 907 16 158 10 174 12 227 40 32 16 60 26 63 21 2 -4 10 -52 16 -106 25 -232 116 -380 282 -460 127 -61 255 -55 364 15 115 74 161 195 142 370 -12 112 -20 135 -54 157 -21 14 -30 14 -55 4 -40 -16 -44 -37 -30 -137 14 -97 8 -174 -15 -210 -46 -70 -150 -84 -253 -33 -73 37 -113 81 -152 164 -43 93 -44 97 -85 346 -43 259 -141 410 -320 496 -38 19 -86 43 -106 54 -96 54 -139 61 -422 72 -235 9 -283 8 -380 -7 -62 -9 -128 -21 -147 -26 -19 -6 -177 -14 -350 -19 -340 -9 -415 -18 -583 -71 -103 -32 -194 -75 -265 -127 l-42 -30 -33 31 c-18 18 -50 40 -72 50 -34 16 -46 30 -78 95 -36 74 -123 182 -146 182 -7 0 -13 -6 -16 -12z";

  return (
    <div className={styles.titleContainer}>
      {/* Left part of cat - on top of title */}
      <svg className={`${styles.cat} ${styles.catLeft}`} style={{ color: catColor }} version="1.0" xmlns="http://www.w3.org/2000/svg"
        width="422.000000pt" height="210.000000pt" viewBox="0 0 422.000000 210.000000"
        preserveAspectRatio="xMidYMid meet">
        <g transform="translate(0.000000,210.000000) scale(0.100000,-0.100000)"
          fill="currentColor" stroke="none">
          <path d={catSvgPath}/>
        </g>
      </svg>
      <div className={styles.title}>CENTRIFUGO</div>
      {/* Right part of cat - behind title */}
      <svg className={`${styles.cat} ${styles.catRight}`} style={{ color: catColor }} version="1.0" xmlns="http://www.w3.org/2000/svg"
        width="422.000000pt" height="210.000000pt" viewBox="0 0 422.000000 210.000000"
        preserveAspectRatio="xMidYMid meet">
        <g transform="translate(0.000000,210.000000) scale(0.100000,-0.100000)"
          fill="currentColor" stroke="none">
          <path d={catSvgPath}/>
        </g>
      </svg>
    </div>
  );
}

export default TitleWithCat;
