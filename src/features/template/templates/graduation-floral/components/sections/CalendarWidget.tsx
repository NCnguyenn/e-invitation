import React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { generateMonthlyDays } from '../../utils/calendar';

export const CalendarWidget: React.FC = () => {
  const { config } = useConfig();
  const { calendar } = config.event;

  const days = generateMonthlyDays(calendar.year, calendar.month, calendar.highlightDay);
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  return (
    <div className="relative p-6 sm:p-7 bg-white/85 border border-rosegold/40 rounded-3xl backdrop-blur-xl shadow-[0_10px_35px_rgba(221,167,165,0.22)]">
      {/* Calendar Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-rose-100">
        <div className="font-serif italic text-sm sm:text-base font-bold text-rosegold-dark flex items-center gap-2">
          <span>🌸</span>
          <span>{calendar.title || `THÁNG ${calendar.month} // ${calendar.year}`}</span>
        </div>
        <div className="font-serif italic text-xs text-poetic-muted">
          Ngày Đặc Biệt: <span className="text-rose-500 font-bold">{calendar.highlightDay}</span>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center font-serif font-bold text-xs sm:text-sm text-poetic-muted mb-2">
        {weekDays.map((wd, i) => (
          <div key={i} className={`py-1 ${i >= 5 ? 'text-rose-500' : ''}`}>
            {wd}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center font-serif text-sm">
        {days.map((item, index) => {
          if (!item.day) {
            return <div key={index} className="p-2 opacity-0" />;
          }

          if (item.isHighlight) {
            return (
              <div
                key={index}
                className="relative p-2 sm:p-2.5 font-bold text-white bg-gradient-to-tr from-rose-400 via-rose-500 to-rose-400 rounded-full shadow-[0_4px_16px_rgba(244,63,94,0.35)] flex items-center justify-center transform scale-105"
              >
                <span>{item.day}</span>
                <span className="absolute -top-1 -right-1 text-[10px]">🌸</span>
              </div>
            );
          }

          return (
            <div
              key={index}
              className="p-2 sm:p-2.5 text-poetic-text hover:bg-rose-50 rounded-full transition-colors flex items-center justify-center cursor-default"
            >
              {item.day}
            </div>
          );
        })}
      </div>

      {/* Bottom Note */}
      <div className="mt-4 pt-3 border-t border-rose-100 flex items-center justify-between text-xs font-serif italic text-poetic-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span>Ngày Diễn Ra Sự Kiện</span>
        </div>
        <span className="text-rose-500 font-semibold">10:45 AM</span>
      </div>
    </div>
  );
};
