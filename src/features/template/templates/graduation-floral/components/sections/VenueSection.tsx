import React from 'react';
import { motion } from 'framer-motion';
import { Navigation, MapPin, Compass } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { SectionHeader } from '../common/SectionHeader';
import { PoeticCard } from '../common/PoeticCard';
import { PoeticButton } from '../common/PoeticButton';

export const VenueSection: React.FC = () => {
  const { config } = useConfig();
  const { venue } = config.event;

  return (
    <section id="venue-section" className="py-12 sm:py-20 px-3 sm:px-4 max-w-5xl mx-auto relative w-full">
      <SectionHeader
        tag="ĐỊA ĐIỂM TỔ CHỨC"
        title="Tọa Độ Hẹn Ước"
        scriptAccent="Sacred Place"
        subtitle="Thông tin hội trường vinh danh, bản đồ chỉ đường và những lối rẽ ngập tràn sắc hoa."
        accent="rosegold"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
        {/* Left: Venue Info Card */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="lg:col-span-5 flex flex-col justify-between"
        >
          <PoeticCard variant="cream" className="p-5 sm:p-8 h-full flex flex-col justify-between">
            <div>
              {/* Status Tag */}
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
                <span className="font-serif italic text-xs uppercase tracking-widest text-rosegold-dark">
                  ĐỊA ĐIỂM TRANG TRỌNG
                </span>
              </div>

              {/* Venue Name */}
              <div className="mb-4 sm:mb-6">
                <div className="font-serif italic text-[11px] sm:text-xs tracking-widest text-poetic-muted uppercase mb-1">
                  TRƯỜNG ĐẠI HỌC
                </div>
                <h3 className="font-display text-xl sm:text-3xl font-bold text-poetic-text">
                  {venue.name}
                </h3>
              </div>

              {/* Sub Venue */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-rose-50/70 border-l-3 border-rose-300 rounded-r-2xl">
                <div className="font-serif italic text-[11px] sm:text-xs tracking-widest text-poetic-muted uppercase mb-1">
                  KHÁN PHÒNG VINH DANH
                </div>
                <div className="font-serif text-sm sm:text-lg font-semibold text-rose-800">
                  {venue.subVenue}
                </div>
              </div>

              {/* Address */}
              <div className="mb-4 sm:mb-6">
                <div className="font-serif italic text-[11px] sm:text-xs tracking-widest text-poetic-muted uppercase mb-1">
                  ĐỊA CHỈ CHI TIẾT
                </div>
                <p className="text-poetic-text font-serif italic text-xs sm:text-base leading-relaxed">
                  {venue.address}
                </p>
              </div>

              {/* Coordinates */}
              {venue.coordinates && (
                <div className="mb-4 sm:mb-6 flex items-center gap-2 font-serif text-xs text-poetic-muted">
                  <Compass className="w-4 h-4 text-rosegold" />
                  <span>{venue.coordinates}</span>
                </div>
              )}
            </div>

            {/* Direct Google Maps Action Button */}
            <div className="pt-3 sm:pt-4 border-t border-rose-100">
              <PoeticButton
                variant="primary"
                size="md"
                fullWidth
                asAnchor
                href={venue.mapDirectLink}
                target="_blank"
                rel="noopener noreferrer"
                icon={<Navigation className="w-4 h-4 fill-white" />}
                className="text-xs sm:text-sm"
              >
                Mở Chỉ Đường Google Maps
              </PoeticButton>
            </div>
          </PoeticCard>
        </motion.div>

        {/* Right: Embedded Interactive Map */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="lg:col-span-7 relative min-h-[280px] sm:min-h-[420px]"
        >
          <div className="relative w-full h-full min-h-[280px] sm:min-h-[420px] bg-white rounded-3xl p-2.5 sm:p-3 border border-rosegold/40 shadow-[0_15px_40px_rgba(221,167,165,0.25)] overflow-hidden">
            {/* Google Map Iframe with rounded corners */}
            <iframe
              src={venue.mapEmbedUrl}
              className="w-full h-full min-h-[280px] sm:min-h-[400px] border-0 rounded-2xl filter saturate-[1.1] contrast-[0.98]"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Google Map Location"
            />

            {/* Poetic Location Overlay Tag */}
            <div className="absolute top-4 sm:top-6 left-4 sm:left-6 bg-white/90 border border-rose-200 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full font-serif italic text-[11px] sm:text-xs text-rosegold-dark flex items-center gap-1.5 shadow-sm backdrop-blur-md pointer-events-none">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>Hội Trường A2 - Tòa Nhà Thế Kỷ</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
