'use client';

import { useEffect } from 'react';

const HF_SPACE_URL = 'https://breadknife-news-apex-api.hf.space';

// Pings the HF Space every 25 minutes so it never cold-starts during a session.
// HF free Spaces sleep after 30 min of inactivity — a cold start takes 3–5 min.
export default function KeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch(`${HF_SPACE_URL}/health`, { method: 'GET' }).catch(() => {});
    };

    // Ping immediately on mount, then every 25 minutes
    ping();
    const interval = setInterval(ping, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null; // renders nothing
}
