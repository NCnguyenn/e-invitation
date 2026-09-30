'use client';

import { useEffect, useId, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { entranceTransition, hasViewedInvitation, rememberInvitation } from './entrance-state';
import styles from './invitation-entrance.module.css';
import '@/features/template/fonts.css';

const OPENING_DURATION_MS = 1260;
const INVITATION_TRANSITION_MS = 220;

type Props = {
  guestName: string;
  invitationNote: string | null;
  eventTitle: string;
  memoryKey?: string;
  children: ReactNode;
};

function browserStorage() {
  try { return window.localStorage; }
  catch { return null; }
}

function Cap({ className }: { className?: string }) {
  return <svg className={className} width="48" height="36" viewBox="0 0 48 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
    <path d="m3 12 21-9 21 9-21 9L3 12Z" />
    <path d="M12 16v11c7 5 17 5 24 0V16M43 13v13m-2 5 2-5 2 5" />
  </svg>;
}

function MailIcon() {
  return <svg width="22" height="18" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="1" y="1" width="22" height="18" rx="1.5" /><path d="m2 3 10 8L22 3" /></svg>;
}

function Flourish({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 240 240" fill="none" aria-hidden="true">
    {Array.from({ length: 18 }, (_, index) => <ellipse key={index} cx="12" cy="18" rx={82 + index * 6} ry={48 + index * 5} transform={`rotate(${index * 5} 12 18)`} />)}
  </svg>;
}

function Sprig() {
  return <svg className={styles.sprig} viewBox="0 0 100 240" fill="none" aria-hidden="true">
    <path d="M12 232C25 165 69 91 61 12M27 178 7 142M40 149 81 118M49 118 26 82M57 87 84 60" />
    {[[59, 23, -12], [56, 49, 24], [66, 63, 35], [43, 88, -38], [72, 94, 48], [36, 121, -38], [55, 137, 42], [23, 152, -40], [38, 176, 48], [13, 190, -30]].map(([x, y, angle], index) => <ellipse key={index} cx={x} cy={y} rx="4" ry="10" transform={`rotate(${angle} ${x} ${y})`} />)}
  </svg>;
}

export function InvitationEntrance({ guestName, invitationNote, eventTitle, memoryKey, children }: Props) {
  const [stage, dispatch] = useReducer(entranceTransition, 'checking');
  const [hasEntered, setHasEntered] = useState(false);
  const letterRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previousStage = useRef(stage);
  const letterId = useId();
  const headingId = useId();
  const open = stage === 'opening' || stage === 'opened' || stage === 'leaving';
  const busy = stage === 'checking' || stage === 'opening' || stage === 'leaving';
  const note = invitationNote?.trim() || 'Sự hiện diện của bạn sẽ khiến ngày đặc biệt này trở nên ý nghĩa hơn rất nhiều.';

  useEffect(() => {
    dispatch(hasViewedInvitation(browserStorage(), memoryKey) ? 'remembered' : 'new');
  }, [memoryKey]);

  useEffect(() => {
    if (stage !== 'opening' && stage !== 'leaving') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The paper's transitionend completes opening. Retain a bounded fallback
    // for background tabs or browsers that suppress transition events.
    const timer = window.setTimeout(() => dispatch('settled'), reduced ? 0 : stage === 'opening' ? OPENING_DURATION_MS + 160 : INVITATION_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    const previous = previousStage.current;
    previousStage.current = stage;
    if (stage === 'opened') letterRef.current?.focus({ preventScroll: true });
    if (stage === 'invitation') {
      setHasEntered(true);
      if (previous === 'leaving') {
        window.scrollTo({ top: 0, behavior: 'instant' });
        contentRef.current?.focus({ preventScroll: true });
        const audio = contentRef.current?.querySelector('audio') || document.querySelector('audio');
        if (audio && audio.paused) {
          audio.volume = 1.0;
          audio.play().catch(() => {});
        }
        try { window.dispatchEvent(new CustomEvent('invitation:play-audio')); } catch {}
      }
    }
    if (stage === 'closed' && previous === 'invitation') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [stage]);

  function advance() {
    if (stage === 'closed') dispatch('open');
    if (stage === 'opened') {
      rememberInvitation(browserStorage(), memoryKey);
      dispatch('view');
      const audio = contentRef.current?.querySelector('audio') || document.querySelector('audio');
      if (audio) {
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
      try { window.dispatchEvent(new CustomEvent('invitation:play-audio')); } catch {}
    }
  }

  function replay() {
    contentRef.current?.querySelectorAll('audio, video').forEach(element => {
      if (element instanceof HTMLMediaElement) element.pause();
    });
    dispatch('replay');
  }

  return <>
    {stage !== 'invitation' && <section className={styles.entrance} data-stage={stage} aria-labelledby={headingId} aria-busy={busy} style={{ '--opening-duration': `${OPENING_DURATION_MS}ms` } as CSSProperties}>
      <div className={styles.frame} aria-hidden="true"><span /><span /><span /><span /></div>
      <Flourish className={styles.flourishTop} />
      <Flourish className={styles.flourishBottom} />
      <Sprig />
      <div className={styles.layout}>
        <header className={styles.header}>
          <div className={styles.emblem}><span /><Cap /><span /></div>
          <p className={styles.eyebrow}>{eventTitle}</p>
          <h1 id={headingId}>Một ngày đặc biệt,<br className={styles.mobileBreak} /> một người khách đặc biệt.</h1>
        </header>

        <div className={styles.scene} data-open={open}>
          <div className={styles.envelope}>
            <div className={styles.back} aria-hidden="true" />
            <div className={styles.flapHinge} aria-hidden="true"><div className={styles.flap} data-envelope-part="flap" /></div>
            <div className={styles.paper} data-envelope-part="paper" onTransitionEnd={event => {
              if (event.target === event.currentTarget && event.propertyName === 'transform' && stage === 'opening') dispatch('settled');
            }}>
              <article id={letterId} ref={letterRef} className={styles.letter} tabIndex={stage === 'opened' ? 0 : -1} aria-hidden={!open} inert={stage !== 'opened'} aria-label={`Lời nhắn dành cho ${guestName}`}>
                <div className={styles.letterInner}>
                  <span className={styles.star} aria-hidden="true">✦</span>
                  <p className={styles.salutation}>Gửi bạn</p>
                  <h2 className={styles.guestName}>{guestName}</h2>
                  <div className={styles.divider} aria-hidden="true" />
                  <p className={styles.note}>{note}</p>
                  <p className={styles.signature}>Hẹn gặp bạn nhé!</p>
                </div>
              </article>
            </div>
            <div className={styles.pocket} aria-hidden="true"><div className={styles.foldLeft} /><div className={styles.foldRight} /><div className={styles.foldBottom} /></div>
            <div className={styles.addressee} aria-hidden={open}><span>Kính gửi</span><p>{guestName}</p><i /></div>
            <div className={styles.seal} data-envelope-part="seal" aria-hidden="true"><Cap /></div>
          </div>
        </div>

        <div className={styles.actions}>
          <button ref={buttonRef} type="button" className={styles.openButton} onClick={advance} aria-disabled={busy} aria-controls={stage === 'closed' || stage === 'opening' ? letterId : undefined} aria-expanded={open}>
            {!open && <MailIcon />}
            <span>{stage === 'opening' ? 'Đang mở thư…' : stage === 'leaving' ? 'Đang mở thiệp…' : open ? 'Xem thư mời' : 'Mở thư'}</span>
            {open && stage !== 'opening' && <span className={styles.arrow} aria-hidden="true">→</span>}
          </button>
          <p className={styles.hint} aria-live="polite">{open ? 'Khám phá ngày đặc biệt cùng mình' : 'Có một lời nhắn đang chờ bạn'}</p>
          <div className={styles.progress} aria-label={open ? 'Bước 2: Đọc lời nhắn' : 'Bước 1: Mở phong thư'}><span data-active={!open} /><span data-active={open} /></div>
        </div>
      </div>
      <noscript><p className={styles.noScript}>Vui lòng bật JavaScript để mở thư mời và gửi phản hồi.</p></noscript>
    </section>}

    <div ref={contentRef} className={styles.content} hidden={stage !== 'invitation'} tabIndex={-1} aria-label="Nội dung thư mời" onPlayCapture={event => {
      // Only pause if the invitation has been closed or replayed back to the closed envelope
      if (stage === 'closed' && event.target instanceof HTMLMediaElement) {
        event.target.pause();
      }
    }}>
      <div className={styles.replayBar}><button type="button" onClick={replay}><MailIcon /> Xem lại phong thư</button></div>
      {children}
    </div>
  </>;
}
