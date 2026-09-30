import { DemoAudioControl } from '../DemoAudioControl';
import { HostAudioPreviewControl } from '@/features/events/HostAudioPreviewControl';
import { Countdown } from '../Countdown';
import { Gallery } from '../Gallery';
import { MockRsvpForm } from '../MockRsvpForm';
import { eventCalendar } from '../date';
import { asset, content } from '../content';
import type { TemplateProps } from '../types';
import { WeddingFloral01Hero } from './WeddingFloral01Hero';
import '../fonts.css';
import '../template.css';

export function WeddingFloral01(props: TemplateProps) {
  const { invitation, mode } = props;
  const { event } = invitation;
  const date = eventCalendar(event.eventDate);
  const mapUrl = event.googleMapUrl?.startsWith('https://') ? event.googleMapUrl : null;
  const isHostOrDesigner = props.mode === 'preview' && (props.previewContext === 'host' || props.previewContext === 'designer');

  return (
    <div className="invitation-template">
      {props.mode === 'preview' && (
        <aside className="preview-notice">
          {isHostOrDesigner
            ? 'Xem trước · Tên khách minh họa · Không gửi phản hồi'
            : 'Bản xem trước · Dữ liệu mẫu · Chưa kết nối gửi phản hồi'}
        </aside>
      )}
      <div className="floating-controls">
        {props.mode === 'preview' ? (
          props.previewContext === 'host' ? (
            <HostAudioPreviewControl hasMusic={event.hasMusic} sourceKey={props.musicVersion} />
          ) : (
            <DemoAudioControl sampleUrl="/audio/graduation-sample.mp3" />
          )
        ) : (
          props.audioControl
        )}
      </div>

      <div className="invitation-container">
        <WeddingFloral01Hero title={event.title} />

        <section className="invitation-section">
          <div className="glass-card">
            <div className="invitation-greeting">TRÂN TRỌNG KÍNH MỜI</div>
            <div className="guest-name-box">
              <div className="guest-name">{invitation.guestName}</div>
            </div>
            <p className="event-title">{event.title}</p>
            {invitation.invitationNote && (
              <p className="invitation-note">{invitation.invitationNote}</p>
            )}
            <div className="event-datetime-header">
              {date.time}, {date.weekday}
            </div>
            <div className="date-large-display">
              <div className="date-side-text">THÁNG {date.month}</div>
              <div className="date-big-number">{date.day}</div>
              <div className="date-side-text">NĂM {date.year}</div>
            </div>
            <div className="calendar-widget">
              <div className="calendar-header">
                THÁNG {date.month} - {date.year}
              </div>
              <table className="calendar-table" aria-label={`Lịch tháng ${date.month} năm ${date.year}`}>
                <thead>
                  <tr>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                      <th scope="col" key={d}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {date.weeks.map((week, i) => (
                    <tr key={i}>
                      {week.map((day, j) => (
                        <td
                          key={j}
                          className={day === date.day ? 'highlight-day' : undefined}
                          aria-label={day === date.day ? `Ngày ${day}, ngày tổ chức` : undefined}
                        >
                          {day}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="timezone-note">Giờ Việt Nam (UTC+7)</p>
            <Countdown eventDate={event.eventDate} />
          </div>
        </section>

        <section className="marquee-section" aria-label="Khoảnh khắc đáng nhớ">
          <div className="marquee-badge">✧ OUR SWEET MOMENTS ✧</div>
          <div className="marquee-container">
            <div className="marquee-content">
              {Array.from({ length: 8 }, (_, i) => (
                <div className="marquee-card" key={i} aria-hidden={i >= 4 ? true : undefined}>
                  <img
                    src={asset(`marquee-${(i % 4) + 1}.webp`)}
                    alt={i < 4 ? `Khoảnh khắc ${i + 1}` : ''}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="venue-section">
          <div className="venue-card">
            <h2 className="venue-title">ĐỊA ĐIỂM TỔ CHỨC</h2>
            <div className="venue-name">{event.venueName || 'Địa điểm sẽ được cập nhật'}</div>
            {event.venueAddress && <p className="venue-address">{event.venueAddress}</p>}
            {mapUrl && (
              <a className="btn-directions" href={mapUrl} target="_blank" rel="noopener noreferrer">
                Xem chỉ đường Google Maps ↗
              </a>
            )}
          </div>
        </section>

        <section className="story-section">
          <div className="story-card">
            <div className="story-portrait-box">
              <img src={asset('story-portrait.webp')} alt="Kỷ niệm ngày tốt nghiệp" loading="lazy" />
            </div>
            <h2 className="story-heading">{content.storyHeading}</h2>
            <div className="story-body">
              {content.story.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="story-signature">{content.ownerName}</div>
          </div>
        </section>

        <Gallery photos={content.gallery} />

        <section className="rsvp-section">
          <div className="rsvp-card">
            <h2 className="rsvp-title">Xác Nhận Tham Dự</h2>
            {mode === 'preview' ? (
              <MockRsvpForm guestName={invitation.guestName} />
            ) : (
              props.responseArea
            )}
          </div>
        </section>

        <section className="thank-you-section">
          <img src={asset('thank-you-banner.webp')} alt="" className="thank-you-bg" loading="lazy" />
          <div className="thank-you-overlay" />
          <div className="thank-you-content">
            <h2 className="thank-you-title">Thank You!</h2>
            <p className="thank-you-message">{content.thankYou}</p>
          </div>
        </section>

        <footer className="footer-credits">Lưu giữ những khoảnh khắc rực rỡ</footer>
      </div>
    </div>
  );
}
