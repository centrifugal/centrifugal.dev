import React from 'react';
import styles from './TitleWithCat.module.css';
import proStyles from '../styles.module.css';
import proLocalStyles from './TitleWithCatPro.module.css';

function TitleWithCatPro({ isDarkTheme }) {
  const catColor = isDarkTheme ? '#000000' : '#fff';

  const mainPath = "M2342 2273 c-57 -60 -153 -197 -191 -270 l-21 -43 -139 0 c-76 0 -165 -3 -198 -6 l-59 -6 -55 96 c-63 113 -132 195 -195 232 -35 21 -47 24 -59 14 -35 -29 -85 -233 -85 -347 0 -29 11 -86 24 -127 l24 -75 -23 -86 c-12 -47 -24 -88 -28 -91 -3 -3 -38 10 -79 29 -101 49 -196 76 -310 89 -73 9 -101 9 -109 1 -19 -19 -2 -43 28 -43 46 0 339 -77 403 -106 58 -26 82 -56 66 -82 -3 -5 -75 -12 -160 -16 -166 -7 -375 -38 -387 -57 -12 -21 2 -41 25 -35 125 30 479 70 514 58 6 -2 12 -19 12 -38 0 -29 -4 -34 -27 -39 -100 -21 -249 -62 -311 -86 -150 -60 -207 -98 -184 -121 9 -9 34 -4 105 21 136 49 333 109 383 117 41 6 44 5 55 -22 6 -16 15 -54 21 -84 5 -30 14 -78 20 -105 9 -46 7 -61 -22 -150 -42 -133 -51 -184 -51 -287 0 -74 -3 -89 -18 -97 -41 -22 -254 -70 -356 -80 -159 -16 -251 -15 -325 3 -88 21 -186 20 -275 -4 -149 -40 -207 -71 -277 -149 -74 -82 -83 -148 -26 -185 40 -26 211 -41 344 -30 144 12 1182 0 1329 -15 57 -6 398 -11 800 -11 537 -1 743 -5 885 -17 237 -20 975 -28 1115 -13 178 20 705 23 1175 7 467 -16 994 -10 1123 14 137 24 364 134 472 228 113 98 247 327 267 458 20 129 -24 295 -115 431 -63 94 -156 189 -221 227 -154 90 -301 15 -272 -138 4 -19 39 -86 78 -148 94 -151 116 -201 124 -285 9 -102 -15 -152 -123 -254 -96 -91 -173 -132 -278 -149 -207 -33 -573 -41 -735 -16 -191 29 -359 92 -416 157 -16 18 -78 112 -138 208 -130 208 -176 269 -253 334 -76 64 -139 104 -260 165 -211 107 -376 144 -648 145 -201 0 -187 3 -610 -114 -240 -66 -267 -73 -450 -105 -91 -16 -189 -27 -250 -28 -103 -1 -96 -2 -262 63 -24 10 -40 80 -29 125 6 24 9 25 59 20 114 -12 236 -28 324 -41 51 -8 102 -14 113 -14 30 0 24 29 -7 36 -16 3 -35 8 -43 10 -20 5 -366 52 -410 56 -41 4 -69 43 -47 65 17 18 144 33 387 46 182 11 205 14 208 30 3 15 -8 17 -126 17 -71 0 -196 -7 -278 -16 -216 -23 -218 -23 -222 4 -5 32 61 59 273 112 183 46 235 63 235 79 0 32 -357 -28 -478 -80 -49 -21 -62 -18 -62 15 0 13 -11 61 -24 107 -13 46 -27 111 -31 144 -9 80 -41 238 -61 298 -21 63 -58 107 -92 107 -19 0 -41 -16 -80 -57z m-576 -670 c32 -21 57 -78 49 -114 -10 -44 -63 -79 -129 -86 -53 -6 -57 -4 -91 30 -28 28 -35 43 -35 74 0 55 31 97 85 115 27 9 95 -1 121 -19z m574 -5 c43 -29 56 -68 41 -119 -15 -49 -51 -69 -125 -69 -48 0 -57 3 -80 31 -29 34 -36 103 -13 131 42 52 121 64 177 26z";
  const eyeCircle1Path = "M1766 1603 c32 -21 57 -78 49 -114 -10 -44 -63 -79 -129 -86 -53 -6 -57 -4 -91 30 -28 28 -35 43 -35 74 0 55 31 97 85 115 27 9 95 -1 121 -19z";
  const eyeCircle2Path = "M2340 1598 c43 -29 56 -68 41 -119 -15 -49 -51 -69 -125 -69 -48 0 -57 3 -80 31 -29 34 -36 103 -13 131 42 52 121 64 177 26z";
  const eyePath1 = "M1670 1545 c-15 -18 -5 -64 15 -72 45 -17 87 26 65 67 -13 24 -61 27 -80 5z";
  const eyePath2 = "M2217 1540 c-28 -40 5 -86 51 -73 26 6 40 48 25 72 -16 25 -59 26 -76 1z";

  const eyeBackgroundColor = isDarkTheme ? '#699176' : '#cfcfcf';
  const eyePupilColor = catColor;

  return (
    <div className={styles.titleContainer}>
      {/* Left part of cat - on top of title */}
      <svg
        className={`${styles.cat} ${styles.catLeft} ${proLocalStyles.proCat}`}
        style={{ '--eye-open-color': eyeBackgroundColor, '--cat-color': catColor, color: catColor }}
        version="1.0"
        xmlns="http://www.w3.org/2000/svg"
        width="760.000000pt"
        height="233.000000pt"
        viewBox="0 0 760.000000 233.000000"
        preserveAspectRatio="xMidYMid meet">
        <g transform="translate(0.000000,233.000000) scale(0.100000,-0.100000)"
          fill="currentColor" stroke="none">
          <path d={mainPath}/>
          <path className={proLocalStyles.eyeBlink} fill={eyeBackgroundColor} d={eyeCircle1Path}/>
          <path className={proLocalStyles.eyeBlink} fill={eyeBackgroundColor} d={eyeCircle2Path}/>
          <path fill={eyePupilColor} d={eyePath1}/>
          <path fill={eyePupilColor} d={eyePath2}/>
        </g>
      </svg>
      <div className={styles.title}>
        CENTRIFUGO
        <span className={`${proStyles.proSuffix} ${proLocalStyles.proSuffixPosition}`}>PRO</span>
      </div>
      {/* Right part of cat - behind title */}
      <svg
        className={`${styles.cat} ${styles.catRight} ${proLocalStyles.proCat}`}
        style={{ '--eye-open-color': eyeBackgroundColor, '--cat-color': catColor, color: catColor }}
        version="1.0"
        xmlns="http://www.w3.org/2000/svg"
        width="760.000000pt"
        height="233.000000pt"
        viewBox="0 0 760.000000 233.000000"
        preserveAspectRatio="xMidYMid meet">
        <g transform="translate(0.000000,233.000000) scale(0.100000,-0.100000)"
          fill="currentColor" stroke="none">
          <path d={mainPath}/>
          <path className={proLocalStyles.eyeBlink} fill={eyeBackgroundColor} d={eyeCircle1Path}/>
          <path className={proLocalStyles.eyeBlink} fill={eyeBackgroundColor} d={eyeCircle2Path}/>
          <path d={eyePath1}/>
          <path d={eyePath2}/>
        </g>
      </svg>
    </div>
  );
}

export default TitleWithCatPro;
