import React, { useEffect, useState, useRef } from 'react';
import styles from './LiveCounter.module.css';

const STORAGE_KEY = 'cf-burst-count';
const ENABLED_KEY = 'cf-orbs-enabled';
const CHANNEL_NAME = 'cf-burst-channel';
const PRESENCE_CHANNEL = 'cf-presence-channel';

function isFeatureSupported() {
  if (typeof window === 'undefined') return false;
  if (typeof BroadcastChannel === 'undefined') return false;
  if (typeof navigator === 'undefined' || !navigator.locks) return false;
  return true;
}

export default function LiveCounter() {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(0);
  const [peerCount, setPeerCount] = useState(0);
  const channelRef = useRef(null);

  // Watch for activation
  useEffect(() => {
    if (!isFeatureSupported()) return;

    // Initial state from localStorage
    try {
      if (localStorage.getItem(ENABLED_KEY) === 'true') {
        setEnabled(true);
      }
    } catch (e) {}

    const activationHandler = () => setEnabled(true);
    const deactivationHandler = () => {
      setEnabled(false);
      setCount(0);
    };
    window.addEventListener('cf-orbs-activated', activationHandler);
    window.addEventListener('cf-orbs-deactivated', deactivationHandler);

    const storageHandler = (e) => {
      if (e.key === ENABLED_KEY) {
        if (e.newValue === 'true') setEnabled(true);
        else {
          setEnabled(false);
          setCount(0);
        }
      }
      if (e.key === STORAGE_KEY && e.newValue === null) {
        setCount(0);
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('cf-orbs-activated', activationHandler);
      window.removeEventListener('cf-orbs-deactivated', deactivationHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  // Counter sync - only when enabled
  useEffect(() => {
    if (!enabled) return;

    try {
      const stored = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      if (!isNaN(stored)) setCount(stored);
    } catch (e) {}

    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data && typeof event.data.count === 'number') {
          setCount(event.data.count);
        }
      };
    }

    const handler = () => {
      setCount((prev) => {
        const next = prev + 1;
        try {
          localStorage.setItem(STORAGE_KEY, String(next));
        } catch (e) {}
        if (channelRef.current) {
          channelRef.current.postMessage({ count: next });
        }
        return next;
      });
    };

    window.addEventListener('cf-burst', handler);

    const storageHandler = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const v = parseInt(e.newValue, 10);
        if (!isNaN(v)) setCount(v);
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('cf-burst', handler);
      window.removeEventListener('storage', storageHandler);
      if (channel) channel.close();
      channelRef.current = null;
    };
  }, [enabled]);

  const handleStop = () => {
    try {
      localStorage.removeItem(ENABLED_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setEnabled(false);
    setCount(0);
    try { window.dispatchEvent(new CustomEvent('cf-orbs-deactivated')); } catch (e) {}
  };

  // Presence: detect other tabs syncing the simulation
  useEffect(() => {
    if (!enabled) return;
    if (typeof BroadcastChannel === 'undefined') return;

    const myId = Math.random().toString(36).slice(2);
    const peers = new Map(); // peerId -> lastSeen timestamp
    let presenceChannel;
    try {
      presenceChannel = new BroadcastChannel(PRESENCE_CHANNEL);
    } catch (e) {
      return;
    }

    presenceChannel.onmessage = (event) => {
      const { id, type } = event.data || {};
      if (!id || id === myId) return;
      if (type === 'ping' || type === 'hello') {
        peers.set(id, Date.now());
        // Reply to a fresh peer so they see us immediately
        if (type === 'hello') {
          try { presenceChannel.postMessage({ id: myId, type: 'ping' }); } catch (e) {}
        }
        setPeerCount(peers.size);
      } else if (type === 'bye') {
        peers.delete(id);
        setPeerCount(peers.size);
      }
    };

    // Announce ourselves
    try { presenceChannel.postMessage({ id: myId, type: 'hello' }); } catch (e) {}

    // Periodic ping + pruning
    const pingInterval = setInterval(() => {
      try { presenceChannel.postMessage({ id: myId, type: 'ping' }); } catch (e) {}
      const now = Date.now();
      let changed = false;
      for (const [id, lastSeen] of peers) {
        if (now - lastSeen > 4000) {
          peers.delete(id);
          changed = true;
        }
      }
      if (changed) setPeerCount(peers.size);
    }, 1500);

    const onUnload = () => {
      try { presenceChannel.postMessage({ id: myId, type: 'bye' }); } catch (e) {}
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('beforeunload', onUnload);
      try { presenceChannel.postMessage({ id: myId, type: 'bye' }); } catch (e) {}
      presenceChannel.close();
    };
  }, [enabled]);

  if (!enabled) return null;

  const totalTabs = peerCount + 1;

  return (
    <div className={styles.counter}>
      <span className={styles.dot} />
      <span className={styles.label}>Live messages delivered</span>
      <span className={styles.value}>{count.toLocaleString('en-US')}</span>
      {peerCount > 0 && (
        <span
          className={styles.sync}
          title={`Synced across ${totalTabs} tabs in this browser`}
          aria-label={`Synced across ${totalTabs} tabs`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {totalTabs}
        </span>
      )}
      <button
        className={styles.stop}
        onClick={handleStop}
        aria-label="Stop simulation"
        title="Stop simulation"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
