import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { SectionHeader } from '../common/SectionHeader';
import { PoeticCard } from '../common/PoeticCard';
import { PoeticButton } from '../common/PoeticButton';
import { triggerPoeticConfetti } from '../../utils/confetti';
import { PoeticBadge } from '../common/PoeticBadge';

export const RSVPSection: React.FC = () => {
  const { config, addWish, wishes, guestName } = useConfig();
  const { rsvp } = config;

  const [formData, setFormData] = useState({
    name: guestName !== config.event.defaultGuestName ? guestName : '',
    attendance: 'yes' as 'yes' | 'no',
    guestsCount: 1,
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);

    setTimeout(() => {
      addWish({
        name: formData.name.trim(),
        attendance: formData.attendance,
        guestsCount: Number(formData.guestsCount),
        message: formData.message.trim() || 'Chúc mừng nàng thơ Nguyên Mai có một ngày lễ tốt nghiệp thật rạng rỡ và hạnh phúc!',
      });

      setSubmitting(false);
      setSubmitted(true);
      triggerPoeticConfetti();
    }, 600);
  };

  return (
    <section id="rsvp-section" className="py-12 sm:py-20 px-3 sm:px-4 max-w-5xl mx-auto relative w-full">
      <SectionHeader
        tag="LỜI CHÚC & THAM DỰ"
        title={rsvp.title}
        scriptAccent="Sweet Wishes"
        subtitle={rsvp.subtitle}
        accent="rosegold"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* RSVP Form Box */}
        <div className="lg:col-span-6">
          <PoeticCard variant="cream" className="p-5 sm:p-8">
            <h3 className="font-display text-xl sm:text-2xl font-bold text-poetic-text mb-2 flex items-center gap-2">
              <span className="text-rose-500">💌</span>
              PHIẾU XÁC NHẬN THAM DỰ
            </h3>
            <p className="text-poetic-muted font-serif italic text-xs sm:text-sm mb-5 sm:mb-6">
              {rsvp.description}
            </p>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 sm:p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center"
              >
                <div className="text-4xl mb-3 animate-bounce">🌸</div>
                <h4 className="font-display text-lg font-bold text-rose-800">
                  GỬI LỜI CHÚC THÀNH CÔNG!
                </h4>
                <p className="text-poetic-text text-xs sm:text-sm mt-2 font-serif italic">
                  Lời chúc ngọt ngào của bạn đã được trao gửi tới Nguyên Mai. Hẹn gặp bạn trong vườn hoa rực rỡ nhé!
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 sm:mt-5 px-5 py-2 font-serif text-xs uppercase tracking-wider text-rose-600 hover:text-rose-800 border border-rose-300 rounded-full transition-colors bg-white shadow-sm"
                >
                  Gửi thêm lời chúc khác
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name - text-base to prevent mobile zoom */}
                <div>
                  <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1 font-semibold">
                    HỌ VÀ TÊN CỦA BẠN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Hoàng Yến, Minh Thư..."
                    className="w-full px-4 py-3 bg-white border border-rose-200 rounded-2xl text-poetic-text font-serif text-base sm:text-sm focus:outline-none focus:border-rose-400 focus:shadow-[0_0_15px_rgba(244,114,182,0.25)] transition-all"
                  />
                </div>

                {/* Number of Attendees */}
                <div>
                  <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1 font-semibold">
                    SỐ LƯỢNG NGƯỜI THAM DỰ
                  </label>
                  <select
                    value={formData.guestsCount}
                    onChange={(e) => setFormData({ ...formData, guestsCount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-white border border-rose-200 rounded-2xl text-poetic-text font-serif text-base sm:text-sm focus:outline-none focus:border-rose-400 transition-all"
                  >
                    <option value={1}>Đi 1 mình (Ghé thăm)</option>
                    <option value={2}>Đi 2 người (Cùng người thương / bạn thân)</option>
                    <option value={3}>Đi 3 người trở lên (Đi theo nhóm / gia đình)</option>
                  </select>
                </div>

                {/* Attendance Radio */}
                <div>
                  <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1.5 font-semibold">
                    KHẢ NĂNG THAM DỰ
                  </label>
                  <div className="space-y-2">
                    <label
                      className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        formData.attendance === 'yes'
                          ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-sm'
                          : 'bg-white border-rose-100 text-poetic-muted hover:border-rose-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="attendance"
                        value="yes"
                        checked={formData.attendance === 'yes'}
                        onChange={() => setFormData({ ...formData, attendance: 'yes' })}
                        className="hidden"
                      />
                      <CheckCircle2
                        className={`w-5 h-5 flex-shrink-0 ${
                          formData.attendance === 'yes' ? 'text-rose-500' : 'text-stone-300'
                        }`}
                      />
                      <span className="font-serif text-xs sm:text-sm font-semibold tracking-wide">
                        {rsvp.acceptLabel}
                      </span>
                    </label>

                    <label
                      className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        formData.attendance === 'no'
                          ? 'bg-stone-50 border-stone-300 text-stone-700'
                          : 'bg-white border-rose-100 text-poetic-muted hover:border-rose-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="attendance"
                        value="no"
                        checked={formData.attendance === 'no'}
                        onChange={() => setFormData({ ...formData, attendance: 'no' })}
                        className="hidden"
                      />
                      <XCircle
                        className={`w-5 h-5 flex-shrink-0 ${
                          formData.attendance === 'no' ? 'text-stone-400' : 'text-stone-300'
                        }`}
                      />
                      <span className="font-serif text-xs sm:text-sm font-semibold tracking-wide">
                        {rsvp.declineLabel}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Message Textarea */}
                <div>
                  <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1 font-semibold">
                    LỜI CHÚC MỪNG DỊU DÀNG
                  </label>
                  <textarea
                    rows={3}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Viết đôi dòng nhắn nhủ ngọt ngào tại đây..."
                    className="w-full px-4 py-3 bg-white border border-rose-200 rounded-2xl text-poetic-text font-serif text-base sm:text-sm focus:outline-none focus:border-rose-400 transition-all resize-none"
                  />
                </div>

                {/* Submit Button */}
                <PoeticButton
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={submitting}
                  icon={<Send className="w-4 h-4 fill-white" />}
                >
                  {submitting ? 'ĐANG GỬI THƯ...' : rsvp.submitLabel}
                </PoeticButton>
              </form>
            )}
          </PoeticCard>
        </div>

        {/* Guestbook Sổ Lưu Bút Box */}
        <div className="lg:col-span-6">
          <PoeticCard variant="cream" className="p-5 sm:p-8 h-full">
            <div className="flex items-center justify-between pb-4 mb-4 sm:mb-6 border-b border-rose-100">
              <h3 className="font-display text-base sm:text-xl font-bold text-poetic-text flex items-center gap-2">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                SỔ LƯU BÚT NGỌT NGÀO ({wishes.length})
              </h3>
              <PoeticBadge variant="rosegold" size="sm">
                LỜI NHẮN
              </PoeticBadge>
            </div>

            {/* List of wishes */}
            <div className="space-y-3 sm:space-y-4 max-h-[440px] sm:max-h-[480px] overflow-y-auto pr-1 sm:pr-2">
              {wishes.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 bg-rose-50/50 border border-rose-100 rounded-2xl relative hover:border-rose-200 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-rose-300 to-rose-400 text-white flex items-center justify-center font-serif font-bold text-xs shadow-sm flex-shrink-0">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-serif font-bold text-xs sm:text-sm text-poetic-text truncate max-w-[150px] sm:max-w-none">
                        {item.name}
                      </span>
                    </div>

                    <span className="font-serif italic text-[11px] sm:text-xs text-poetic-muted flex-shrink-0">
                      {item.timestamp}
                    </span>
                  </div>

                  <p className="text-poetic-text font-serif italic text-xs sm:text-sm leading-relaxed pl-9 sm:pl-10">
                    {item.message}
                  </p>

                  <div className="mt-2 pl-9 sm:pl-10 flex items-center gap-2 text-[11px] sm:text-xs font-serif">
                    {item.attendance === 'yes' ? (
                      <span className="text-rose-600 flex items-center gap-1 font-medium">
                        🌸 Có tham dự ({item.guestsCount} người)
                      </span>
                    ) : (
                      <span className="text-stone-400 flex items-center gap-1">
                        💌 Gửi lời chúc từ xa
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PoeticCard>
        </div>
      </div>
    </section>
  );
};
