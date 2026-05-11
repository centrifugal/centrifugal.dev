import React from 'react';
import styles from './Ray.module.css';

export default function Ray({ className }) {
  return (
    <div className={`${styles.rayContainer} ${className || ''}`}>
      <div className={styles.ray} />
    </div>
  );
}
