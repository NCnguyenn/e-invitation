'use client';

import { useEffect, useState } from 'react';

/** Re-evaluate age/period boundaries even while another admin tab is open. */
export function useMeasurementClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}
