import { AudioPlayer } from '../AudioPlayer';
import { HostAudioPreviewControl } from '@/features/events/HostAudioPreviewControl';
import { Countdown } from '../Countdown';
import { Gallery } from '../Gallery';
import { MockRsvpForm } from '../MockRsvpForm';
import { eventCalendar } from '../date';
import { editorialAsset, editorialContent } from '../graduation-editorial-content';
import type { TemplateProps } from '../types';
import '../fonts.css';
import '../template.css';
import '../graduation-editorial.css';

export function GraduationEditorial01(props: TemplateProps) {
  const { invitation, mode } = props;
  const { event } = invitation;
  const date = eventCalendar(event.eventDate);
  const mapUrl = event.googleMapUrl?.startsWith('https://') ? event.googleMapUrl : null;
  const preview = props.mode === 'preview';
  const hostPreview = preview && (props.previewContext === 'host' || props.previewContext === 'designer');

  return (
    <div className="invitation-template graduation-editorial-template">
      {preview && <aside className="editorial-preview-notice">Xem trước · Tên khách minh họa · Không gửi phản hồi</aside>}
      <div className="editorial-floating-control">
        {preview ? (hostPreview ? <HostAudioPreviewControl hasMusic={event.hasMusic} sourceKey={props.musicVersion} /> : <AudioPlayer hasMusic={false} />) : props.audioControl}
      </div>
      <main className="editorial-container">
        <header className="editorial-topbar"><span>MAI HOA / 2026</span><span>Lời mời dành cho bạn</span><span>♪ Bật nhạc</span></header>
        <div className="editorial-chapter-rail" aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span><span>06</span></div>

        <section className="editorial-hero" aria-label={event.title}>
          <div className="editorial-hero-copy"><span className="editorial-kicker">LỄ TỐT NGHIỆP · MAI HOA</span><h1>THANH<br />XUÂN</h1><p className="editorial-script">sang trang.</p><p className="editorial-hero-note">Một chặng đường khép lại,<br />một hành trình mới bắt đầu.</p><button className="editorial-primary" type="button">Mở câu chuyện ↗</button><span className="editorial-scroll-hint">↓ Cuộn xuống để tiếp tục</span></div>
          <div className="editorial-hero-portrait"><img src={editorialAsset('hero-portrait.webp')} alt={`Chân dung ${editorialContent.ownerName}`} /><span className="editorial-sticker">I DID IT!</span><span className="editorial-year">2026</span></div>
        </section>

        <section className="editorial-memory-section"><div className="editorial-section-label">01 / NHỮNG NGÀY RỰC RỠ</div><h2>Từ một giấc mơ<span>…</span></h2><p className="editorial-lead">…đến những ngày thật rực rỡ.</p><div className="editorial-route"><div><img src={editorialAsset('gallery-1.webp')} alt="Kỷ niệm những ngày đầu" /><b>2022</b><small>Những ngày đầu tiên</small></div><div><img src={editorialAsset('gallery-2.webp')} alt="Bạn bè trên giảng đường" /><b>2024</b><small>Những người bạn tuyệt vời</small></div><div><img src={editorialAsset('gallery-3.webp')} alt="Ngày tốt nghiệp" /><b>2026</b><small>Và tớ ở đây, sẵn sàng!</small></div></div></section>

        <section className="editorial-letter-section"><div className="editorial-section-label">02 / LÁ THƯ GỬI BẠN</div><div className="editorial-letter-grid"><div><p className="editorial-hand">Gửi bạn<br />thân mến,</p>{editorialContent.story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p className="editorial-signature">Mai Hoa ♡</p></div><img src={editorialAsset('story-portrait.webp')} alt="Mai Hoa trong ngày tốt nghiệp" /></div></section>

        <section className="editorial-ticket-section"><div className="editorial-ticket"><div className="editorial-ticket-stub">GRADUATION<br />EVENT<br />2026</div><div className="editorial-ticket-main"><div className="editorial-section-label">03 / LỜI MỜI</div><h2>HẸN NHA!</h2><div className="editorial-ticket-details"><div><span>NGÀY</span><strong>28.09.2026</strong></div><div><span>THỜI GIAN</span><strong>{date.time}</strong></div><div><span>ĐỊA ĐIỂM</span><strong>{event.venueName || 'Hội trường A2'}</strong></div></div>{mapUrl && <a className="editorial-ticket-button" href={mapUrl} target="_blank" rel="noopener noreferrer">Xem đường đi ↗</a>}</div><div className="editorial-ticket-barcode" aria-hidden="true">||||||||</div></div></section>

        <section className="editorial-gallery-intro"><div className="editorial-section-label">04 / NHỮNG KHOẢNH KHẮC ĐÁNG NHỚ</div><h2>Mình đã có<br /><em>những ngày như thế.</em></h2><Gallery photos={editorialContent.gallery} /></section>

        <section className="editorial-rsvp-section"><div className="editorial-section-label">05 / HỒI ĐÁP CÙNG MÌNH</div><div className="editorial-rsvp-layout"><div><h2>Bạn sẽ<br />có mặt chứ?</h2><p>Cùng gặp nhau ở chương mới nhé!</p></div>{mode === 'preview' ? <MockRsvpForm guestName={invitation.guestName} /> : props.responseArea}</div></section>

        <section className="editorial-thank-you"><img src={editorialAsset('thank-you-banner.webp')} alt="Các bạn tốt nghiệp tung mũ" /><div><p className="editorial-section-label">06 / CẢM ƠN</p><h2>Hẹn ở<br />chương mới.</h2><p>Cảm ơn vì đã là một phần thanh xuân của mình.</p></div></section>
        <footer className="editorial-footer">MAI HOA · CLASS OF 2026 · LƯU GIỮ NHỮNG NGÀY RỰC RỠ</footer>
      </main>
    </div>
  );
}
