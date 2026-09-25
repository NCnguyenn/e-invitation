'use client';

import { useEffect, useRef, useState } from 'react';
import type { HostEvent } from '@/lib/contracts';
import { eventDateToInputs, parseEventUpdate, vietnamDateTimeToIso } from '@/lib/validation';
import { InvitationTemplate } from '@/features/template/InvitationTemplate';
import { MusicUploader } from './MusicUploader';


function fieldsFromEvent(event: HostEvent) {
  return { title: event.title, ...eventDateToInputs(event.eventDate), venueName: event.venueName ?? '',
    venueAddress: event.venueAddress ?? '', googleMapUrl: event.googleMapUrl ?? '' };
}

export function EventEditor({ initialEvent }: { initialEvent: HostEvent }) {
  const [saved, setSaved] = useState(initialEvent);
  const [fields, setFields] = useState(() => fieldsFromEvent(initialEvent));
  const [preview, setPreview] = useState(initialEvent);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expired, setExpired] = useState(false);
  const [musicVersion, setMusicVersion] = useState(0);
  const previewPanel = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  useEffect(() => { setReady(true); }, []);
  const dirty = JSON.stringify(fields) !== JSON.stringify(fieldsFromEvent(saved));
  const previewDirty = JSON.stringify(fieldsFromEvent(preview)) !== JSON.stringify(fields);

  function update(name: keyof typeof fields, value: string) {
    setFields(current => ({ ...current, [name]: value })); setMessage(''); setError('');
  }
  function validated() {
    return parseEventUpdate({ title: fields.title, eventDate: vietnamDateTimeToIso(fields.date, fields.time),
      venueName: fields.venueName, venueAddress: fields.venueAddress, googleMapUrl: fields.googleMapUrl });
  }
  function showPreview() {
    setError('');
    try {
      setPreview({ ...saved, ...validated() });
      setMessage('Đã cập nhật bản xem trước. Thông tin chưa lưu sẽ không thay đổi thiệp đã gửi.');
      previewPanel.current?.focus({ preventScroll: true });
      if (window.innerWidth < 1100) previewPanel.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Thông tin không hợp lệ.'); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError(''); setMessage(''); setExpired(false);
    let input;
    try { input = validated(); } catch (err) { setError(err instanceof Error ? err.message : 'Thông tin không hợp lệ.'); return; }
    saving.current = true; setPending(true);
    try {
      const response = await fetch('/api/host/event', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok) {
        setExpired(response.status === 401);
        setError(body.message || 'Không thể lưu. Vui lòng thử lại.'); return;
      }
      const savedEvent = body.event as HostEvent;
      setSaved(savedEvent); setFields(fieldsFromEvent(savedEvent)); setPreview(savedEvent);
      setMessage('Đã lưu thay đổi. Thông tin trên thiệp đã được cập nhật.');
    } catch { setError('Không thể kết nối để lưu. Thông tin bạn nhập vẫn được giữ lại.'); }
    finally { saving.current = false; setPending(false); }
  }

  return <>
    <header className="editor-heading">
      <div><p className="editor-eyebrow">Sự kiện của tôi</p><h1>Chỉnh sửa thiệp mời</h1><p>Lưu lại thông tin cho ngày đặc biệt của bạn.</p></div>
      <span className={`save-state${dirty ? ' unsaved' : ''}`}>{dirty ? 'Chưa lưu thay đổi' : 'Đã lưu'}</span>
    </header>
    <div className="editor-grid">
      <div className="editor-column">
        <section className="editor-card" aria-labelledby="information-heading">
          <h2 id="information-heading">Thông tin sự kiện</h2><p className="card-description">Thông tin này sẽ hiển thị trên thiệp mời.</p>
          <form onSubmit={save} method="post" action="/api/host/event" noValidate>
            <fieldset disabled={!ready || pending} className="event-fields">
              <label htmlFor="event-title-input">Tiêu đề sự kiện</label>
              <input id="event-title-input" value={fields.title} maxLength={255} required onChange={e => update('title', e.target.value)} />
              <div className="date-fields">
                <div><label htmlFor="event-date-input">Ngày tổ chức</label><input id="event-date-input" type="date" min="0001-01-01" max="9999-12-31" required value={fields.date} onChange={e => update('date', e.target.value)} /></div>
                <div><label htmlFor="event-time-input">Giờ bắt đầu</label><input id="event-time-input" type="time" required value={fields.time} onChange={e => update('time', e.target.value)} /></div>
              </div>
              <p className="field-help">Giờ Việt Nam (UTC+7)</p>
              <label htmlFor="event-venue-input">Địa điểm</label>
              <input id="event-venue-input" value={fields.venueName} maxLength={255} placeholder="Tên hội trường, nhà hàng…" onChange={e => update('venueName', e.target.value)} />
              <label htmlFor="event-address-input">Địa chỉ</label>
              <textarea id="event-address-input" value={fields.venueAddress} rows={3} maxLength={2000} placeholder="Địa chỉ tổ chức sự kiện" onChange={e => update('venueAddress', e.target.value)} />
              <label htmlFor="event-map-input">Liên kết Google Maps</label>
              <input id="event-map-input" type="url" value={fields.googleMapUrl} maxLength={2048} placeholder="https://maps.app.goo.gl/…" onChange={e => update('googleMapUrl', e.target.value)} />
              <div className="editor-actions"><button className="button-secondary" type="button" onClick={showPreview}>Xem trước</button><button className="button-primary" type="submit">{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
            </fieldset>
            <div className="editor-feedback">
              {error && <p className="editor-error" role="alert">{error} {expired && <a href="/login" target="_blank" rel="noopener noreferrer">Đăng nhập lại ở tab mới</a>}</p>}
              <p role="status" aria-live="polite">{message}</p>
            </div>
            <noscript>Vui lòng bật JavaScript để chỉnh sửa và lưu thông tin.</noscript>
          </form>
        </section>
        <MusicUploader
          hasMusic={saved.hasMusic}
          onMusicUpdated={(musicExists) => {
            setSaved((current) => ({ ...current, hasMusic: musicExists }));
            setPreview((current) => ({ ...current, hasMusic: musicExists }));
            setMusicVersion((v) => v + 1);
          }}
        />
      </div>
      <section className="preview-card" aria-labelledby="preview-heading">
        <div className="preview-card-heading"><h2 id="preview-heading">Xem trước thiệp</h2><span className="device-label">▯ Điện thoại</span></div>
        <div className="host-preview" data-testid="host-preview" ref={previewPanel} tabIndex={-1}>
          <InvitationTemplate mode="preview" previewContext="host" musicVersion={musicVersion} invitation={{ event: preview, guestName: 'Bạn và Người thương', invitationNote: null, status: 'pending', receipt: null }} />
        </div>
        <p className="preview-help">Tên khách mẫu chỉ dùng để xem trước. Không gửi hoặc lưu phản hồi.</p>
        {previewDirty && <p className="preview-reminder">Bấm “Xem trước” để cập nhật nội dung đang chỉnh.</p>}
      </section>
    </div>
  </>;
}
