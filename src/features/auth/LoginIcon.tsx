import type { SVGProps } from 'react';

type IconName = 'envelope' | 'lock' | 'eye' | 'eye-off' | 'arrow' | 'support' | 'spinner';

export function LoginIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {name === 'envelope' && <><rect x="2" y="4" width="20" height="16" rx="1" /><path d="m3 5 9 8 9-8M3 19l6-7m12 7-6-7" /></>}
      {name === 'lock' && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>}
      {name === 'eye' && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
      {name === 'eye-off' && <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 3.9M6.5 6.5A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.5-1.5M10 10a3 3 0 0 0 4 4" /></>}
      {name === 'arrow' && <path d="M4 12h16m-6-6 6 6-6 6" />}
      {name === 'support' && <><path d="M4 13v-2a8 8 0 0 1 16 0v2m0 5v1a2 2 0 0 1-2 2h-4" /><rect x="2" y="11" width="4" height="8" rx="2" /><rect x="18" y="11" width="4" height="8" rx="2" /><path d="M12 21h2" /></>}
      {name === 'spinner' && <path d="M21 12a9 9 0 1 1-9-9" />}
    </svg>
  );
}
