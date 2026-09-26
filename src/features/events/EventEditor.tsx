'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HostEvent } from '@/lib/contracts';
import { eventDateToInputs, parseEventUpdate, vietnamDateTimeToIso } from '@/lib/validation';
import { ClientInvitationTemplate } from '@/features/template/ClientInvitationTemplate';
import { LocationMapPicker } from './LocationMapPicker';
import { MusicUploader } from './MusicUploader';
import { PreviewModal } from './PreviewModal';
import { EditorIcon } from './EditorIcon';
import styles from './event-editor.module.css';

function fieldsFromEvent(event: HostEvent) {
  return {
    title: event.title,
    ...eventDateToInputs(event.eventDate),
    venueName: event.venueName ?? '',
    venueAddress: event.venueAddress ?? '',
    googleMapUrl: event.googleMapUrl ?? '',
  };
}

export function EventEditor({ initialEvent }: { initialEvent: HostEvent }) {
  const [saved, setSaved] = useState(initialEvent);
  const [fields, setFields] = useState(() => fieldsFromEvent(initialEvent));
  const [preview, setPreview] = useState(initialEvent);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expired, setExpired] = useState(false);
  const [musicVersion, setMusicVersion] = useState(0);
  const saving = useRef(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const dirty = JSON.stringify(fields) !== JSON.stringify(fieldsFromEvent(saved));
  // The saved card is independent of draft keystrokes and save-status updates.
  const savedPreview = useMemo(() => (
    <ClientInvitationTemplate mode="preview" previewContext="host" musicVersion={musicVersion} invitation={{ event: saved, guestName: 'Bạn và Người thương', invitationNote: null, status: 'pending', receipt: null }} />
  ), [saved, musicVersion]);

  function update(name: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setMessage('');
    setError('');
  }

  function validated() {
    return parseEventUpdate({
      title: fields.title,
      eventDate: vietnamDateTimeToIso(fields.date, fields.time),
      venueName: fields.venueName,
      venueAddress: fields.venueAddress,
      googleMapUrl: fields.googleMapUrl,
    });
  }

  function showPreview() {
    setError('');
    try {
      setPreview({ ...saved, ...validated() });
      setPreviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thông tin không hợp lệ.');
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !dirty) return;
    setError('');
    setMessage('');
    setExpired(false);
    let input;
    try {
      input = validated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thông tin không hợp lệ.');
      return;
    }
    saving.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/host/event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) {
        setExpired(response.status === 401);
        setError(body.message || 'Không thể lưu. Vui lòng thử lại.');
        return;
      }
      const savedEvent = body.event as HostEvent;
      setSaved(savedEvent);
      setFields(fieldsFromEvent(savedEvent));
      setPreview(savedEvent);
      setMessage('Đã lưu thay đổi. Thông tin trên thiệp đã được cập nhật.');
    } catch {
      setError('Không thể kết nối để lưu. Thông tin bạn nhập vẫn được giữ lại.');
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  const savedDate = eventDateToInputs(saved.eventDate);
  return (
    <div className={styles.editor}>
      <header className={styles.heading}>
        <div className={styles.headingText}>
          <p className={styles.eyebrow}>Sự kiện của tôi</p>
          <h1 className={styles.title}>Chỉnh sửa thiệp mời</h1>
          <p className={styles.subtitle}>Chăm chút từng chi tiết cho ngày đặc biệt.</p>
        </div>
        <div className={styles.toolbar}>
          <span className={[styles.saveState, dirty ? styles.unsaved : ''].join(' ')} role="status">
            {pending ? 'Đang lưu thay đổi…' : dirty ? 'Chưa lưu thay đổi' : 'Đã lưu thay đổi'}
          </span>
          <button type="button" className={styles.secondary} onClick={showPreview} disabled={!ready || pending}>
            <EditorIcon name="eye" />Xem trước thiệp
          </button>
          <button type="submit" form="event-editor-form" className={styles.primary} disabled={!ready || pending || !dirty}>
            <EditorIcon name="check" />{pending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.column}>
          <form id="event-editor-form" className={styles.form} onSubmit={save} method="post" action="/api/host/event" noValidate aria-busy={pending}>
            <div className={styles.feedback}>
              {error && <p className={styles.error} role="alert">{error}{' '}{expired && <a href="/login" target="_blank" rel="noopener noreferrer">Đăng nhập lại ở tab mới</a>}</p>}
              {message && <p className={styles.success} role="status">{message}</p>}
            </div>
            <section className={styles.card} aria-labelledby="information-heading">
              <div className={styles.cardHeader}>
                <span className={styles.iconBadge}><EditorIcon name="calendar" /></span>
                <div><h2 id="information-heading" className={styles.cardTitle}>Thông tin sự kiện</h2><p className={styles.cardDescription}>Thông tin chính hiển thị trên thiệp mời.</p></div>
              </div>
              <fieldset disabled={!ready || pending} className={styles.fields} aria-labelledby="information-heading">
                <div className={styles.field}>
                  <label htmlFor="event-title-input">Tên sự kiện</label>
                  <input className={styles.input} id="event-title-input" value={fields.title} maxLength={255} required placeholder="Ví dụ: Lễ Tốt Nghiệp, Lễ Thành Hôn…" onChange={(e) => update('title', e.target.value)} />
                </div>
                <div className={styles.dateFields}>
                  <div className={styles.field}>
                    <label htmlFor="event-date-input">Ngày tổ chức</label>
                    <input className={styles.input} id="event-date-input" type="date" min="0001-01-01" max="9999-12-31" required value={fields.date} onChange={(e) => update('date', e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="event-time-input">Giờ bắt đầu</label>
                    <input className={styles.input} id="event-time-input" type="time" required value={fields.time} onChange={(e) => update('time', e.target.value)} />
                  </div>
                </div>
              </fieldset>
              <p className={styles.fieldHelp}>Giờ Việt Nam · UTC+7</p>
            </section>
            <LocationMapPicker venueName={fields.venueName} venueAddress={fields.venueAddress} googleMapUrl={fields.googleMapUrl} onChangeVenueName={(v) => update('venueName', v)} onChangeVenueAddress={(v) => update('venueAddress', v)} onChangeGoogleMapUrl={(v) => update('googleMapUrl', v)} disabled={!ready || pending} />
            <noscript>Vui lòng bật JavaScript để chỉnh sửa và lưu thông tin.</noscript>
          </form>
          <MusicUploader hasMusic={saved.hasMusic} onMusicUpdated={(musicExists) => {
            setSaved((current) => ({ ...current, hasMusic: musicExists }));
            setPreview((current) => ({ ...current, hasMusic: musicExists }));
            setMusicVersion((v) => v + 1);
          }} />
        </div>

        <section className={[styles.card, styles.previewCard].join(' ')} aria-labelledby="preview-heading">
          <div className={styles.previewHeading}>
            <h2 id="preview-heading" className={styles.cardTitle}>Thiệp của bạn</h2>
            <span className={styles.badge}>Bản đã lưu</span>
          </div>
          <div className={styles.previewStage} data-testid="host-preview">
            <div className={styles.previewCover} inert aria-hidden="true">
              {savedPreview}
            </div>
            <div className={styles.savedDetails}>
              <p>{saved.title}</p>
              <strong>{savedDate.date.split('-').reverse().join(' . ')}</strong>
              <p>{saved.venueName || 'Địa điểm sẽ được cập nhật'}</p>
            </div>
          </div>
          <div className={styles.previewNote}>
            <EditorIcon name="info" />
            <p>{dirty ? 'Lưu thay đổi để cập nhật thiệp.' : 'Thiệp đã cập nhật thông tin mới nhất.'}<br /><small>Bản xem thử không gửi phản hồi.</small></p>
          </div>
        </section>
      </div>
      <PreviewModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} event={preview} musicVersion={musicVersion} />
    </div>
  );
}
