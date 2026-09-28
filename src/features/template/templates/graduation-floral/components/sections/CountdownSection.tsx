import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useConfig } from '../../context/ConfigContext';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export const CountdownSection: React.FC = () => {
  const { config } = useConfig();
  const { targetDate } = config.event;

  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();

      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: true,
        });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isPast: false,
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const pad = (num: number) => String(num).padStart(2, '0');

  const blocks = [
    { label: 'NGÀY', value: pad(timeLeft.days) },
    { label: 'GIỜ', value: pad(timeLeft.hours) },
    { label: 'PHÚT', value: pad(timeLeft.minutes) },
    { label: 'GIÂY', value: pad(timeLeft.seconds) },
  ];

  return (
    <div className="w-full">
      <div className="text-center mb-5 sm:mb-6">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 font-serif italic text-[11px] sm:text-xs tracking-widest text-rosegold-dark bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-200">
          <span>⏳</span>
          <span>CÙNG ĐẾM NGƯỢC THỜI GIAN</span>
        </div>
      </div>

      {/* 4 Columns side-by-side on all screens for clean mobile appearance */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto">
        {blocks.map((block, index) => (
          <motion.div
            key={index}
            whileHover={{ y: -3, scale: 1.03 }}
            className="p-2 sm:p-5 bg-white/90 border border-rosegold/30 rounded-xl sm:rounded-2xl text-center shadow-[0_4px_16px_rgba(221,167,165,0.18)] group"
          >
            {/* Number */}
            <div className="font-display text-xl sm:text-4xl md:text-5xl font-bold tracking-tight text-rose-500 drop-shadow-sm">
              {block.value}
            </div>

            {/* Label */}
            <div className="mt-1 font-serif text-[10px] sm:text-xs tracking-wider text-poetic-muted uppercase group-hover:text-rosegold-dark transition-colors">
              {block.label}
            </div>

            {/* Subtle bottom blush bar */}
            <div className="mt-1.5 sm:mt-2 h-0.5 w-6 sm:w-10 mx-auto bg-gradient-to-r from-transparent via-rose-300 to-transparent" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
