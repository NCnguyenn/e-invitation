import { useId } from 'react';
import { DemoAudioControl } from '../DemoAudioControl';
import { HostAudioPreviewControl } from '@/features/events/HostAudioPreviewControl';
import { Gallery } from '../Gallery';
import { MockRsvpForm } from '../MockRsvpForm';
import { EditorialMotion } from '../EditorialMotion';
import { eventCalendar } from '../date';
import { editorialAsset, editorialContent } from '../graduation-editorial-content';
import type { TemplateProps } from '../types';
import '../fonts.css';
import '../template.css';
import '../graduation-editorial.css';

export function GraduationEditorial01(props: TemplateProps) {
  const { invitation } = props;
  const { event } = invitation;
  const date = eventCalendar(event.eventDate);
  const owner = editorialContent.ownerName;
  const mapUrl = event.googleMapUrl?.startsWith('https://') ? event.googleMapUrl : null;
  const prefix = useId().replace(/:/g, '');
  const chapterId = (name: string) => prefix + '-editorial-' + name;
  const chapters = [
    ['memories', 'Hành trình'], ['letter', 'Lá thư'], ['ticket', 'Lời mời'],
    ['gallery', 'Kỷ niệm'], ['rsvp', 'Hồi đáp'], ['thanks', 'Hẹn gặp'],
  ];
  const milestones = [
    { year: date.year - 4, image: 'gallery-3.webp', text: 'Những bước chân đầu tiên' },
    { year: date.year - 2, image: 'gallery-5.webp', text: 'Gom từng ngày rực rỡ' },
    { year: date.year, image: 'gallery-2.webp', text: 'Và hôm nay, mình đã sẵn sàng!' },
  ];

  return (
    <div className="invitation-template graduation-editorial-template">
      <div className="editorial-audio-control">
        {props.mode === 'preview'
          ? props.previewContext === 'host'
            ? <HostAudioPreviewControl hasMusic={event.hasMusic} sourceKey={props.musicVersion} />
            : <DemoAudioControl sampleUrl="/mb3/mono.mp3" />
          : props.audioControl}
      </div>

      <EditorialMotion className="editorial-container">
        {props.mode === 'preview' && <aside className="editorial-preview-notice">Bản xem trước · Phản hồi thử không được lưu</aside>}
        <header className="editorial-topbar">
          <span>{owner} / {date.year}</span>
          <span className="editorial-topbar-note">Một lời mời, một chương mới.</span>
        </header>

        <nav className="editorial-chapter-nav" aria-label="Các chương của thiệp">
          {chapters.map(([name, label], index) => (
            <a key={name} href={'#' + chapterId(name)} data-story-link>
              <span className="editorial-chapter-number">0{index + 1}</span><span>{label}</span>
            </a>
          ))}
          <span className="editorial-reading-progress" aria-hidden="true" />
        </nav>

        <section className="editorial-hero" aria-label={event.title}>
          <div className="editorial-hero-blush" aria-hidden="true" />
          <div className="editorial-hero-year" aria-hidden="true">{date.year}</div>
          <div className="editorial-hero-copy" data-reveal>
            <span className="editorial-kicker">LỄ TỐT NGHIỆP · {owner}</span>
            <h1><span>THANH</span><span>XUÂN</span></h1>
            <p className="editorial-script">sang trang.</p>
            <p className="editorial-hero-note">Một chặng đường khép lại,<br />một hành trình mới bắt đầu.</p>
            <a className="editorial-primary" href={'#' + chapterId('memories')} data-story-link>Mở câu chuyện <span aria-hidden="true">↗</span></a>
            <span className="editorial-scroll-hint"><span aria-hidden="true">↓</span> Chậm một chút, cùng nhìn lại nhé.</span>
          </div>
          <figure className="editorial-hero-portrait" data-reveal>
            <img src={editorialAsset('hero-cutout.webp')} alt={'Chân dung ' + owner + ' trong lễ phục tốt nghiệp'} width={1024} height={1536} fetchPriority="high" />
            <span className="editorial-sticker">I DID IT!</span>
          </figure>
        </section>

        <section id={chapterId('memories')} className="editorial-memory-section" data-editorial-chapter tabIndex={-1} aria-labelledby={prefix + '-memories-title'}>
          <div className="editorial-section-label">01 / NHỮNG NGÀY RỰC RỠ</div>
          <div data-reveal><h2 id={prefix + '-memories-title'}>Từ một giấc mơ<span>…</span></h2><p className="editorial-lead">…đến những ngày mình sẽ nhớ mãi.</p></div>
          <div className="editorial-route" data-reveal>
            <svg className="editorial-route-thread" viewBox="0 0 1000 360" aria-hidden="true">
              <path pathLength={1} d="M-80 370 C-15 330 22 309 60 305 C170 298 250 125 417 265 C555 262 630 278 773 215 C880 184 955 136 1080 85" />
              <circle cx="60" cy="305" r="8" />
              <circle cx="417" cy="265" r="8" />
              <circle cx="773" cy="215" r="8" />
            </svg>
            {milestones.map(milestone => <figure key={milestone.year} data-reveal>
              <img src={editorialAsset(milestone.image)} alt={milestone.text} loading="lazy" />
              <figcaption><b>{milestone.year}</b><span>{milestone.text}</span></figcaption>
            </figure>)}
          </div>
          <p className="editorial-chapter-bridge">Và trong những ngày ấy, thật may vì có bạn. <span aria-hidden="true">↓</span></p>
        </section>

        <section id={chapterId('letter')} className="editorial-letter-section" data-editorial-chapter tabIndex={-1} aria-labelledby={prefix + '-letter-title'}>
          <div className="editorial-section-label">02 / LÁ THƯ GỬI BẠN</div>
          <div className="editorial-letter-grid">
            <div className="editorial-letter-copy" data-reveal>
              <h2 id={prefix + '-letter-title'} className="editorial-hand">Gửi bạn<br />thân mến,</h2>
              <p className="editorial-personal-guest">{invitation.guestName}</p>
              {editorialContent.story.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              {invitation.invitationNote && <p className="editorial-personal-note">{invitation.invitationNote}</p>}
              <p className="editorial-signature">{owner} <span aria-hidden="true">♡</span></p>
            </div>
            <figure data-reveal><img src={editorialAsset('story-portrait.webp')} alt={owner + ' lưu lại kỷ niệm tốt nghiệp'} loading="lazy" /><figcaption>Mang theo thật nhiều điều đẹp đẽ.</figcaption></figure>
          </div>
        </section>

        <section id={chapterId('ticket')} className="editorial-ticket-section" data-editorial-chapter tabIndex={-1} aria-labelledby={prefix + '-ticket-title'}>
          <div className="editorial-section-label">03 / TẤM VÉ HẸN NHAU</div>
          <div className="editorial-ticket" data-reveal>
            <div className="editorial-ticket-stub"><span>GRADUATION<br />DAY</span><b>{date.year}</b><span>YOU'RE<br />INVITED</span></div>
            <div className="editorial-ticket-main">
              <h2 id={prefix + '-ticket-title'}>HẸN NHA!</h2>
              <p className="editorial-ticket-title">{event.title}</p>
              <dl className="editorial-ticket-details">
                <div><dt>Ngày gặp nhau</dt><dd><time dateTime={event.eventDate}>{String(date.day).padStart(2, '0')}.{String(date.month).padStart(2, '0')}.{date.year}</time></dd><span>{date.weekday}</span></div>
                <div><dt>Thời gian</dt><dd>{date.time}</dd><span>Giờ Việt Nam</span></div>
                <div className="editorial-ticket-venue"><dt>Địa điểm</dt><dd>{event.venueName || 'Địa điểm sẽ được cập nhật'}</dd>{event.venueAddress && <span>{event.venueAddress}</span>}</div>
              </dl>
              <div className="editorial-ticket-actions">
                {mapUrl && <a className="editorial-ticket-button" href={mapUrl} target="_blank" rel="noopener noreferrer">Xem đường đi <span aria-hidden="true">↗</span></a>}
                <a className="editorial-text-link" href={'#' + chapterId('rsvp')} data-story-link>Gửi lời hồi đáp <span aria-hidden="true">↓</span></a>
              </div>
            </div>
            <div className="editorial-ticket-barcode" aria-hidden="true" />
          </div>
        </section>

        <section id={chapterId('gallery')} className="editorial-gallery-intro" data-editorial-chapter tabIndex={-1} aria-labelledby={prefix + '-gallery-title'}>
          <div className="editorial-section-label">04 / NHỮNG KHOẢNH KHẮC Ở LẠI</div>
          <div className="editorial-gallery-heading" data-reveal><h2 id={prefix + '-gallery-title'}>Mình đã có<br /><em>những ngày như thế.</em></h2><p>Chạm vào từng tấm ảnh<br />để xem trọn một kỷ niệm <span aria-hidden="true">↗</span></p></div>
          <Gallery photos={editorialContent.gallery} />
          <p className="editorial-chapter-bridge">Tấm ảnh tiếp theo, mình mong có bạn ở bên. <span aria-hidden="true">↓</span></p>
        </section>

        <section id={chapterId('rsvp')} className="editorial-rsvp-section" data-editorial-chapter tabIndex={-1} aria-labelledby={prefix + '-rsvp-title'}>
          <div className="editorial-rsvp-header">
            <span className="editorial-section-label">06 / HỒI ĐÁP CÙNG MÌNH</span>
            <div className="editorial-rsvp-header-line" aria-hidden="true" />
            <span className="editorial-rsvp-progress-badge" aria-hidden="true">06 / 06</span>
            <div className="editorial-rsvp-corner-line" aria-hidden="true" />
          </div>
          <div className="editorial-rsvp-layout">
            <div className="editorial-rsvp-intro" data-reveal>
              <span className="editorial-rsvp-rail" aria-hidden="true">HỒI ĐÁP</span>
              <h2 id={prefix + '-rsvp-title'}>Bạn sẽ<br />có mặt chứ?</h2>
              <div className="editorial-rsvp-coral-bar" aria-hidden="true" />
              <p>Một lời hồi đáp nhỏ,<br />một niềm vui thật lớn.</p>
              <span className="editorial-rsvp-signature">Mong gặp bạn ở đó!</span>
            </div>
            <div className="editorial-rsvp-panel">
              <span className="editorial-rsvp-tab" aria-hidden="true">RSVP / 2025</span>
              {props.mode === 'preview' ? <MockRsvpForm guestName={invitation.guestName} /> : props.responseArea}
            </div>
          </div>
        </section>

        <section id={chapterId('thanks')} className="editorial-thank-you" data-editorial-chapter tabIndex={-1} aria-labelledby={prefix + '-thanks-title'}>
          <img src={editorialAsset('thank-you-banner.webp')} alt={owner + ' trong khuôn viên trường'} loading="lazy" />
          <div className="editorial-thank-you-copy" data-reveal><p className="editorial-section-label">06 / VÀ MỘT KHỞI ĐẦU MỚI</p><h2 id={prefix + '-thanks-title'}>Hẹn ở<br />chương mới.</h2><p>Cảm ơn vì đã là một phần<br />thanh xuân của mình.</p><span className="editorial-signature">{owner}</span></div>
        </section>
        <footer className="editorial-footer">{owner} · CLASS OF {date.year} <span>Những ngày rực rỡ còn ở phía trước.</span></footer>
      </EditorialMotion>
    </div>
  );
}
