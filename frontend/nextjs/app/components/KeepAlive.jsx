'use client';

import { useEffect } from 'react';

export default function KeepAlive() {
  useEffect(() => {
    const HF_SPACE_URL = process.env.NEXT_PUBLIC_HF_SPACE_URL || 'https://breadknife-news-apex-api.hf.space';
    
    const ping = async () => {
      try {
        await fetch(`${HF_SPACE_URL}/health`, { 
          method: 'GET',
          cache: 'no-store'
        });
        console.log('HF Space keepalive ping sent');
      } catch (error) {
        console.log('HF Space ping failed (expected if space is sleeping):', error.message);
      }
    };

    // Immediate ping on mount
    ping();
    
    // Then ping every 25 minutes to prevent sleep
    const interval = setInterval(ping, 25 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return null; // This component renders nothing
}