import type { SVGProps } from 'react';

type IconName = 'envelope' | 'calendar' | 'pin' | 'music' | 'upload' | 'eye' | 'check' | 'info' | 'search' | 'external' | 'chevron' | 'user' | 'copy' | 'refresh' | 'edit' | 'send' | 'note' | 'sparkles' | 'heart' | 'clock';

export function EditorIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    {name === 'envelope' && <><rect x="2" y="4" width="20" height="16" rx="1" /><path d="m3 5 9 8 9-8M3 19l6-7m12 7-6-7" /></>}
    {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18" /></>}
    {name === 'pin' && <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>}
    {name === 'music' && <><path d="M9 18V5l11-2v13M9 9l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2.5" /><ellipse cx="17" cy="16" rx="3" ry="2.5" /></>}
    {name === 'upload' && <><path d="M7 18H5a4 4 0 0 1-1-7.9A8 8 0 0 1 20 10a4 4 0 0 1-1 8h-2M12 21V10m-4 4 4-4 4 4" /></>}
    {name === 'eye' && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
    {name === 'check' && <path d="m4 12 5 5L20 6" />}
    {name === 'info' && <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>}
    {name === 'search' && <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>}
    {name === 'external' && <><path d="M14 3h7v7m0-7L11 13M10 5H4v15h15v-6" /></>}
    {name === 'chevron' && <path d="m6 9 6 6 6-6" />}
    {name === 'user' && <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
    {name === 'copy' && <><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>}
    {name === 'refresh' && <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></>}
    {name === 'edit' && <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>}
    {name === 'send' && <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>}
    {name === 'note' && <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>}
    {name === 'sparkles' && <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /></>}
    {name === 'heart' && <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />}
    {name === 'clock' && <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>}
  </svg>;
}
