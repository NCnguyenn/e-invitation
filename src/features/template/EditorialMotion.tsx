'use client';

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';

// Progressive enhancement: the document stays visible if animation is unavailable.
export function EditorialMotion({ children, className }: { children: ReactNode; className: string }) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-editorial-chapter]'));
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.editorial-chapter-nav a'));
    let observer: IntersectionObserver | undefined;
    let frame = 0;

    function updateProgress() {
      frame = 0;
      if (!root || !chapters.length) return;
      const bounds = root.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -bounds.top / Math.max(1, bounds.height - window.innerHeight)));
      root.style.setProperty('--editorial-progress', String(progress));
      const active = chapters.reduce((previous, chapter) =>
        chapter.getBoundingClientRect().top < window.innerHeight * .4 ? chapter : previous, chapters[0]);
      links.forEach(link => {
        if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    }

    function configureMotion() {
      observer?.disconnect();
      root!.classList.remove('editorial-motion-ready');
      root!.querySelectorAll('.is-visible').forEach(element => element.classList.remove('is-visible'));
      if (preference.matches || !('IntersectionObserver' in window)) return;
      root!.classList.add('editorial-motion-ready');
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer?.unobserve(entry.target);
          entry.target.classList.add('is-visible');
        });
      }, { threshold: .06, rootMargin: '0px 0px -24px 0px' });
      root?.querySelectorAll('[data-reveal], .gallery-item').forEach(element => observer?.observe(element));
    }

    configureMotion();
    updateProgress();
    preference.addEventListener('change', configureMotion);
    // Capture also covers scrolling inside the dashboard preview.
    document.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      preference.removeEventListener('change', configureMotion);
      document.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  function navigate(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-story-link]');
    if (!link || !rootRef.current?.contains(link)) return;
    const target = Array.from(rootRef.current.querySelectorAll<HTMLElement>('[data-editorial-chapter]'))
      .find(chapter => '#' + chapter.id === link.hash);
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  return <main ref={rootRef} className={className} onClick={navigate}>{children}</main>;
}
