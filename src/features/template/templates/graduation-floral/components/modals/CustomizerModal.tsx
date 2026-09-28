import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Wand2,
  Download,
  RotateCcw,
  Check,
  Image as ImageIcon,
  Calendar,
  FileText,
  CreditCard,
  Eye,
} from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import type { AppConfig } from '../../types/config';
import { PoeticButton } from '../common/PoeticButton';

export const CustomizerModal: React.FC = () => {
  const { isCustomizerOpen, setIsCustomizerOpen, config, updateConfig, resetConfig } =
    useConfig();

  const [formData, setFormData] = useState<AppConfig>(config);
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'story' | 'bank'>('info');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isCustomizerOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig(() => formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(formData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'wedding_config.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImageFileChange = (
    key: 'heroPortrait' | 'storyPortrait' | 'thankYouBanner',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData((prev) => ({
        ...prev,
        images: {
          ...prev.images,
          [key]: url,
        },
      }));
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl border border-rosegold/50 shadow-[0_20px_60px_rgba(221,167,165,0.4)] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-rose-100 bg-rose-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 text-rose-500 flex items-center justify-center">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-poetic-text">
                  BẢNG ĐIỀU KHIỂN & CHỈNH SỬA NHANH
                </h3>
                <p className="text-xs font-serif italic text-poetic-muted">
                  Tùy chỉnh nội dung, hình ảnh, lời ngỏ và xem kết quả ngay lập tức
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCustomizerOpen(false)}
              className="w-9 h-9 rounded-full bg-white text-stone-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-rose-100 bg-rose-50/30 overflow-x-auto">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-3 px-5 font-serif text-xs sm:text-sm font-semibold tracking-wider flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'info'
                  ? 'border-rose-400 text-rose-600 bg-rose-100/50'
                  : 'border-transparent text-poetic-muted hover:text-rose-500'
              }`}
            >
              <Calendar className="w-4 h-4" /> Thông Tin Sự Kiện
            </button>

            <button
              onClick={() => setActiveTab('images')}
              className={`py-3 px-5 font-serif text-xs sm:text-sm font-semibold tracking-wider flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'images'
                  ? 'border-rose-400 text-rose-600 bg-rose-100/50'
                  : 'border-transparent text-poetic-muted hover:text-rose-500'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Hình Ảnh
            </button>

            <button
              onClick={() => setActiveTab('story')}
              className={`py-3 px-5 font-serif text-xs sm:text-sm font-semibold tracking-wider flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'story'
                  ? 'border-rose-400 text-rose-600 bg-rose-100/50'
                  : 'border-transparent text-poetic-muted hover:text-rose-500'
              }`}
            >
              <FileText className="w-4 h-4" /> Tâm Sự / Lời Ngỏ
            </button>

            <button
              onClick={() => setActiveTab('bank')}
              className={`py-3 px-5 font-serif text-xs sm:text-sm font-semibold tracking-wider flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'bank'
                  ? 'border-rose-400 text-rose-600 bg-rose-100/50'
                  : 'border-transparent text-poetic-muted hover:text-rose-500'
              }`}
            >
              <CreditCard className="w-4 h-4" /> Hộp Quà Mừng
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                      Tên nhân vật chính
                    </label>
                    <input
                      type="text"
                      value={formData.event.ownerName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          event: { ...formData.event, ownerName: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                      Chức danh / Danh xưng
                    </label>
                    <input
                      type="text"
                      value={formData.event.subName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          event: { ...formData.event, subName: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                      Tiêu đề phụ 1
                    </label>
                    <input
                      type="text"
                      value={formData.event.badgeTop}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          event: { ...formData.event, badgeTop: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                      Tiêu đề phụ 2
                    </label>
                    <input
                      type="text"
                      value={formData.event.badgeBottom}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          event: { ...formData.event, badgeBottom: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                      Ngày
                    </label>
                    <input
                      type="text"
                      value={formData.event.day}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          event: { ...formData.event, day: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                      Tháng
                    </label>
                    <input
                      type="text"
                      value={formData.event.month}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          event: { ...formData.event, month: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                      Năm
                    </label>
                    <input
                      type="text"
                      value={formData.event.year}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          event: { ...formData.event, year: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                    Thời gian & Thứ
                  </label>
                  <input
                    type="text"
                    value={formData.event.timeString}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        event: { ...formData.event, timeString: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                  />
                </div>

                <div>
                  <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                    Tên địa điểm tổ chức
                  </label>
                  <input
                    type="text"
                    value={formData.event.venue.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        event: {
                          ...formData.event,
                          venue: { ...formData.event.venue, name: e.target.value },
                        },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                  />
                </div>

                <div>
                  <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                    Khán phòng / Hội trường
                  </label>
                  <input
                    type="text"
                    value={formData.event.venue.subVenue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        event: {
                          ...formData.event,
                          venue: { ...formData.event.venue, subVenue: e.target.value },
                        },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                  />
                </div>

                <div>
                  <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                    Địa chỉ chi tiết
                  </label>
                  <input
                    type="text"
                    value={formData.event.venue.address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        event: {
                          ...formData.event,
                          venue: { ...formData.event.venue, address: e.target.value },
                        },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                  />
                </div>
              </div>
            )}

            {activeTab === 'images' && (
              <div className="space-y-4">
                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200">
                  <label className="block font-serif text-xs text-rose-700 mb-2 font-bold">
                    1. Ảnh chân dung đầu trang (Hero Portrait)
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={formData.images.heroPortrait}
                      alt="Hero"
                      className="w-16 h-20 object-cover rounded-xl border border-rose-300"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange('heroPortrait', e)}
                      className="text-xs text-poetic-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-serif file:bg-rose-200 file:text-rose-800 hover:file:bg-rose-300"
                    />
                  </div>
                </div>

                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200">
                  <label className="block font-serif text-xs text-rose-700 mb-2 font-bold">
                    2. Ảnh phần Lời Ngỏ (Story Portrait)
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={formData.images.storyPortrait}
                      alt="Story"
                      className="w-16 h-20 object-cover rounded-xl border border-rose-300"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange('storyPortrait', e)}
                      className="text-xs text-poetic-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-serif file:bg-rose-200 file:text-rose-800 hover:file:bg-rose-300"
                    />
                  </div>
                </div>

                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200">
                  <label className="block font-serif text-xs text-rose-700 mb-2 font-bold">
                    3. Ảnh bìa cảm ơn cuối trang (Thank You Banner)
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={formData.images.thankYouBanner}
                      alt="Thank you"
                      className="w-20 h-16 object-cover rounded-xl border border-rose-300"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange('thankYouBanner', e)}
                      className="text-xs text-poetic-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-serif file:bg-rose-200 file:text-rose-800 hover:file:bg-rose-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'story' && (
              <div className="space-y-4">
                <div>
                  <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                    Tiêu đề phần Tâm sự
                  </label>
                  <input
                    type="text"
                    value={formData.story.heading}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        story: { ...formData.story, heading: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                  />
                </div>

                <div>
                  <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                    Chữ ký người gửi
                  </label>
                  <input
                    type="text"
                    value={formData.story.signature}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        story: { ...formData.story, signature: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                  />
                </div>

                <div>
                  <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                    Nội dung tâm sự (Cách nhau bằng dấu xuống dòng)
                  </label>
                  <textarea
                    rows={6}
                    value={formData.story.paragraphs.join('\n\n')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        story: {
                          ...formData.story,
                          paragraphs: e.target.value.split('\n\n').filter(Boolean),
                        },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-rose-50/40 border border-rose-200 rounded-xl text-poetic-text text-sm"
                  />
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="space-y-4">
                {formData.giftBox.accounts.map((acc, i) => (
                  <div key={i} className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-3">
                    <div>
                      <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                        Tên Ngân Hàng
                      </label>
                      <input
                        type="text"
                        value={acc.bankName}
                        onChange={(e) => {
                          const accounts = [...formData.giftBox.accounts];
                          accounts[i].bankName = e.target.value;
                          setFormData({
                            ...formData,
                            giftBox: { ...formData.giftBox, accounts },
                          });
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-rose-200 rounded-xl text-poetic-text text-sm"
                      />
                    </div>

                    <div>
                      <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                        Số Tài Khoản
                      </label>
                      <input
                        type="text"
                        value={acc.accountNumber}
                        onChange={(e) => {
                          const accounts = [...formData.giftBox.accounts];
                          accounts[i].accountNumber = e.target.value;
                          setFormData({
                            ...formData,
                            giftBox: { ...formData.giftBox, accounts },
                          });
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-rose-200 rounded-xl text-poetic-text text-sm"
                      />
                    </div>

                    <div>
                      <label className="block font-serif text-xs text-poetic-text mb-1 font-semibold">
                        Chủ Tài Khoản
                      </label>
                      <input
                        type="text"
                        value={acc.accountHolder}
                        onChange={(e) => {
                          const accounts = [...formData.giftBox.accounts];
                          accounts[i].accountHolder = e.target.value;
                          setFormData({
                            ...formData,
                            giftBox: { ...formData.giftBox, accounts },
                          });
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-rose-200 rounded-xl text-poetic-text text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 border-t border-rose-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PoeticButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetConfig}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Khôi phục gốc
                </PoeticButton>

                <PoeticButton
                  type="button"
                  variant="cream"
                  size="sm"
                  onClick={handleExportJson}
                  icon={<Download className="w-3.5 h-3.5 text-rose-500" />}
                >
                  Tải file config.json
                </PoeticButton>
              </div>

              <PoeticButton
                type="submit"
                variant="primary"
                size="sm"
                icon={savedSuccess ? <Check className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              >
                {savedSuccess ? 'ĐÃ CẬP NHẬT!' : 'LƯU & XEM THỬ NGAY'}
              </PoeticButton>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
