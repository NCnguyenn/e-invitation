'use client';

import { useEffect, useRef, useState } from 'react';
import type { HostEvent } from '@/lib/contracts';
import { ClientInvitationTemplate } from '@/features/template/ClientInvitationTemplate';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: HostEvent;
  musicVersion: number;
}

export function PreviewModal({ isOpen, onClose, event, musicVersion }: PreviewModalProps) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'))
          .filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          e.preventDefault();
          dialogRef.current.focus();
        } else if (e.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="preview-modal-overlay"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="preview-modal-container">
        <header className="preview-modal-header">
          <div className="preview-modal-info">
            <svg
              className="preview-eye-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span id="preview-modal-title" className="preview-modal-title">
              Xem trước thiệp
            </span>
            <span className="preview-badge-pill">Bản xem thử</span>
          </div>

          <div className="preview-device-switch" role="group" aria-label="Chế độ hiển thị">
            <button
              type="button"
              className={`preview-switch-btn ${device === 'mobile' ? 'active' : ''}`}
              onClick={() => setDevice('mobile')}
              aria-pressed={device === 'mobile'}
            >
              <span aria-hidden="true">📱</span> Điện thoại
            </button>
            <button
              type="button"
              className={`preview-switch-btn ${device === 'desktop' ? 'active' : ''}`}
              onClick={() => setDevice('desktop')}
              aria-pressed={device === 'desktop'}
            >
              <span aria-hidden="true">💻</span> Máy tính
            </button>
          </div>

          <button
            type="button"
            className="preview-close-btn"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Đóng xem trước"
          >
            ✕ Đóng
          </button>
        </header>

        <div
          className="preview-modal-scroll-area"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <div className={`preview-frame-container ${device === 'mobile' ? 'frame-mobile' : 'frame-desktop'}`}>
            <div className="preview-screen-viewport">
              <ClientInvitationTemplate
                mode="preview"
                previewContext="host"
                musicVersion={musicVersion}
                invitation={{
                  event,
                  guestName: 'Bạn và Người thương',
                  invitationNote: null,
                  status: 'pending',
                  receipt: null,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
