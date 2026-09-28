import React from 'react';
import { CalendarPlus, Clock } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { SectionHeader } from '../common/SectionHeader';
import { PoeticCard } from '../common/PoeticCard';
import { PoeticButton } from '../common/PoeticButton';
import { CalendarWidget } from './CalendarWidget';
import { CountdownSection } from './CountdownSection';
import { getGoogleCalendarUrl } from '../../utils/calendar';

export const InvitationSection: React.FC = () => {
  const { config, guestName, guestGreeting } = useConfig();
  const { event } = config;

  const googleCalUrl = getGoogleCalendarUrl(event);

  return (
    <section id="invitation-section" className="py-12 sm:py-20 px-3 sm:px-4 max-w-5xl mx-auto relative w-full">
      <SectionHeader
        tag="SAVE THE DATE"
        title="Khoảnh Khắc Dịu Dàng"
        scriptAccent="Sweet Rendezvous"
        subtitle="Chi tiết thời gian, lịch sự kiện và đếm ngược khoảnh khắc hạnh phúc ngập tràn sắc hoa."
        accent="rosegold"
      />

      {/* Main Glass Invitation Card */}
      <PoeticCard variant="glass" className="p-4 sm:p-10 md:p-12 mb-10 sm:mb-12">
        {/* Guest VIP Box */}
        <div className="text-center pb-6 sm:pb-8 mb-6 sm:mb-8 border-b border-rose-100">
          <div className="inline-flex items-center gap-1.5 text-xs font-serif italic tracking-widest text-rosegold-dark uppercase mb-2">
            <span>🌸</span>
            {guestGreeting}
          </div>
          <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-poetic-text tracking-wide px-2">
            {guestName}
          </h3>
          <p className="mt-2.5 text-xs sm:text-base text-poetic-muted max-w-xl mx-auto font-serif italic leading-relaxed px-2">
            Sự hiện diện của bạn là đóa hoa thơm ngát và niềm hạnh phúc to lớn đối với Nguyên Mai!
          </p>
        </div>

        {/* Date Time Highlights */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 font-serif text-xs sm:text-base font-semibold text-rosegold-dark mb-4 px-4 sm:px-5 py-1.5 sm:py-2 bg-rose-50/80 border border-rose-200 rounded-full shadow-sm">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
            <span>{event.timeString}</span>
          </div>

          {/* Large Date Display */}
          <div className="flex items-center justify-center gap-3 sm:gap-8 my-3 sm:my-4">
            <div className="text-right">
              <span className="block font-serif text-xs sm:text-xl font-bold tracking-wider text-poetic-muted">
                {event.month}
              </span>
              <span className="block text-[10px] sm:text-xs font-serif italic text-rose-400 uppercase">THÁNG</span>
            </div>

            <div className="relative px-5 sm:px-8 py-1.5 sm:py-2 bg-gradient-to-br from-rose-100/60 via-pink-50 to-white rounded-2xl sm:rounded-3xl border border-rosegold/50 shadow-sm">
              <span className="font-display text-4xl sm:text-7xl md:text-8xl font-bold text-rose-500 drop-shadow-sm">
                {event.day}
              </span>
            </div>

            <div className="text-left">
              <span className="block font-serif text-xs sm:text-xl font-bold tracking-wider text-poetic-muted">
                {event.year}
              </span>
              <span className="block text-[10px] sm:text-xs font-serif italic text-rose-400 uppercase">NĂM</span>
            </div>
          </div>
        </div>

        {/* Layout Grid: Calendar & Countdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center mb-6 sm:mb-8">
          <div className="lg:col-span-5">
            <CalendarWidget />
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center">
            <CountdownSection />

            {/* Add to Calendar Button */}
            <div className="mt-6 sm:mt-8 text-center lg:text-left">
              <PoeticButton
                variant="rosegold"
                size="md"
                asAnchor
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                icon={<CalendarPlus className="w-4 h-4 text-poetic-plum" />}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Thêm Vào Google Calendar
              </PoeticButton>
            </div>
          </div>
        </div>
      </PoeticCard>
    </section>
  );
};
