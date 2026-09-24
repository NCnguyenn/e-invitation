/**
 * ====================================================================
 * JAVASCRIPT CHO THIỆP ĐIỆN TỬ - KHOẢNG KHẮC RỰC RỠ
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  renderContentFromConfig();
  handleGuestNameFromURL();
  initCalendar();
  initCountdown();
  initAudioPlayer();
  initPetalsEffect();
  initLightbox();
  initRSVPForm();
  initBankCopy();
  initCustomizer();
}

/**
 * Hiển thị toàn bộ dữ liệu từ config.js lên trang web
 */
function renderContentFromConfig() {
  if (typeof WEDDING_CONFIG === 'undefined') return;
  const cfg = WEDDING_CONFIG;

  // 1. Meta & Title
  document.title = cfg.meta.pageTitle || "Thiệp Mời";

  // 2. Hero Section
  safeSetText('#hero-badge-title', cfg.event.badgeTop);
  safeSetText('#hero-script-subtitle', cfg.event.badgeBottom);
  safeSetText('#hero-owner-name', cfg.event.ownerName);
  safeSetSrc('#hero-portrait-img', cfg.images.heroPortrait);

  // 3. Invitation Section
  safeSetText('#invitation-greeting', cfg.event.inviteGreeting);
  safeSetText('#event-datetime-header', cfg.event.timeString);
  safeSetText('#date-month', cfg.event.month);
  safeSetText('#date-year', cfg.event.year);
  safeSetText('#date-day', cfg.event.day);

  // 4. Marquee Photos
  const marqueeContainer = document.getElementById('marquee-content');
  if (marqueeContainer && cfg.images.marqueePhotos) {
    // Duplicate photos for smooth infinite loop
    const photos = [...cfg.images.marqueePhotos, ...cfg.images.marqueePhotos];
    marqueeContainer.innerHTML = photos.map(src => `
      <div class="marquee-card">
        <img src="${src}" alt="Moments" loading="lazy" />
      </div>
    `).join('');
  }

  // 5. Venue Section
  safeSetText('#venue-name', cfg.event.venue.name);
  safeSetText('#venue-sub', cfg.event.venue.subVenue);
  safeSetText('#venue-address', cfg.event.venue.address);
  
  const mapLink = document.getElementById('btn-directions');
  if (mapLink && cfg.event.venue.mapDirectLink) {
    mapLink.href = cfg.event.venue.mapDirectLink;
  }
  
  const mapFrame = document.getElementById('map-iframe');
  if (mapFrame && cfg.event.venue.mapEmbedUrl) {
    mapFrame.src = cfg.event.venue.mapEmbedUrl;
  }

  // 6. Story Section
  safeSetSrc('#story-portrait-img', cfg.images.storyPortrait);
  safeSetText('#story-heading', cfg.story.heading);
  safeSetText('#story-signature', cfg.story.signature);
  
  const storyBody = document.getElementById('story-body');
  if (storyBody && cfg.story.paragraphs) {
    storyBody.innerHTML = cfg.story.paragraphs.map(p => `<p>${p}</p>`).join('');
  }

  // 7. Gallery Section
  const galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid && cfg.images.galleryPhotos) {
    galleryGrid.innerHTML = cfg.images.galleryPhotos.map((item, idx) => `
      <div class="gallery-item" data-index="${idx}">
        <img src="${item.src}" alt="${item.caption || 'Kỉ niệm'}" loading="lazy" />
        <div class="gallery-overlay">
          <i class="fa-solid fa-magnifying-glass-plus"></i>
        </div>
      </div>
    `).join('');
  }

  // 8. Gift Box Section
  const giftSection = document.getElementById('gift-section');
  if (giftSection) {
    if (cfg.giftBox && cfg.giftBox.enabled && cfg.giftBox.accounts && cfg.giftBox.accounts.length > 0) {
      giftSection.style.display = 'block';
      const acc = cfg.giftBox.accounts[0];
      safeSetText('#gift-title', cfg.giftBox.title);
      safeSetText('#gift-desc', cfg.giftBox.description);
      safeSetSrc('#bank-qr-img', acc.qrImage);
      safeSetText('#bank-name', acc.bankName);
      safeSetText('#bank-number', acc.accountNumber);
      safeSetText('#bank-holder', acc.accountHolder);
    } else {
      giftSection.style.display = 'none';
    }
  }

  // 9. Thank You Section
  safeSetSrc('#thank-you-bg', cfg.images.thankYouBanner);
  safeSetText('#thank-you-title', cfg.thankYou.title);
  safeSetText('#thank-you-message', cfg.thankYou.message);
}

/**
 * Xử lý tên khách mời từ tham số trên đường dẫn URL (?guest=Ten+Khach hoặc ?to=Ten+Khach)
 */
function handleGuestNameFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const guestParam = urlParams.get('guest') || urlParams.get('to') || urlParams.get('name') || urlParams.get('u');
  const guestDisplay = document.getElementById('guest-name');
  
  if (guestDisplay) {
    if (guestParam) {
      guestDisplay.textContent = decodeURIComponent(guestParam);
    } else if (typeof WEDDING_CONFIG !== 'undefined' && WEDDING_CONFIG.event.defaultGuestName) {
      guestDisplay.textContent = WEDDING_CONFIG.event.defaultGuestName;
    }
  }
}

/**
 * Tạo bảng Lịch Tháng tự động với ngày đặc biệt được highlight
 */
function initCalendar() {
  const tableBody = document.getElementById('calendar-days');
  const headerTitle = document.getElementById('calendar-header-title');
  if (!tableBody || typeof WEDDING_CONFIG === 'undefined') return;

  const cal = WEDDING_CONFIG.event.calendar;
  if (headerTitle) {
    headerTitle.textContent = cal.title || `THÁNG ${cal.month} - ${cal.year}`;
  }

  const year = cal.year;
  const month = cal.month - 1; // 0-indexed in JS
  const highlightDay = cal.highlightDay;

  // Lấy ngày đầu tiên của tháng và số ngày trong tháng
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  // Thứ của ngày đầu tiên (0: Chủ Nhật, 1: Thứ Hai...)
  // Ta muốn thứ Hai là cột đầu tiên: 0 = Mon, 6 = Sun
  let startCol = firstDay.getDay() - 1;
  if (startCol === -1) startCol = 6;

  let html = '<tr>';
  let dayCount = 1;

  // Các ô trống trước ngày 1
  for (let i = 0; i < startCol; i++) {
    html += '<td></td>';
  }

  // Điền các ngày trong tháng
  let currentCol = startCol;
  while (dayCount <= totalDays) {
    if (currentCol === 7) {
      html += '</tr><tr>';
      currentCol = 0;
    }

    const isHighlight = dayCount === highlightDay;
    const highlightClass = isHighlight ? 'class="highlight-day"' : '';
    html += `<td ${highlightClass}>${dayCount}</td>`;

    dayCount++;
    currentCol++;
  }

  // Điền các ô trống cuối bảng
  while (currentCol > 0 && currentCol < 7) {
    html += '<td></td>';
    currentCol++;
  }

  html += '</tr>';
  tableBody.innerHTML = html;

  // Nút Thêm vào Google Calendar
  const addCalBtn = document.getElementById('btn-add-calendar');
  if (addCalBtn) {
    addCalBtn.addEventListener('click', () => {
      const cfg = WEDDING_CONFIG;
      const title = encodeURIComponent(`${cfg.event.badgeTop} - ${cfg.event.ownerName}`);
      const details = encodeURIComponent(`${cfg.story.heading}\nĐịa điểm: ${cfg.event.venue.name} - ${cfg.event.venue.address}`);
      const location = encodeURIComponent(`${cfg.event.venue.name}, ${cfg.event.venue.address}`);
      
      // Target Date format: YYYYMMDDTHHmmssZ
      const d = new Date(cfg.event.targetDate);
      const isoStart = d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const dEnd = new Date(d.getTime() + 3 * 3600 * 1000);
      const isoEnd = dEnd.toISOString().replace(/-|:|\.\d\d\d/g, "");

      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${isoStart}/${isoEnd}&details=${details}&location=${location}`;
      window.open(gcalUrl, '_blank');
    });
  }
}

/**
 * Đồng hồ đếm ngược thời gian thực (Days, Hours, Minutes, Seconds)
 */
function initCountdown() {
  if (typeof WEDDING_CONFIG === 'undefined') return;
  const targetDateStr = WEDDING_CONFIG.event.targetDate;
  const targetTime = new Date(targetDateStr).getTime();

  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minutesEl = document.getElementById('cd-minutes');
  const secondsEl = document.getElementById('cd-seconds');

  if (!daysEl) return;

  function update() {
    const now = new Date().getTime();
    const diff = targetTime - now;

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

/**
 * Trình phát nhạc nền với đĩa xoay và tự động phát khi tương tác
 */
function initAudioPlayer() {
  const musicBtn = document.getElementById('music-toggle-btn');
  const audio = document.getElementById('bg-audio');
  if (!musicBtn || !audio || typeof WEDDING_CONFIG === 'undefined') return;

  if (WEDDING_CONFIG.music && WEDDING_CONFIG.music.audioSrc) {
    audio.src = WEDDING_CONFIG.music.audioSrc;
  }

  let isPlaying = false;

  function togglePlay() {
    if (isPlaying) {
      audio.pause();
      musicBtn.classList.remove('playing');
      showToast('Đã tạm dừng nhạc nền');
      isPlaying = false;
    } else {
      audio.play().then(() => {
        musicBtn.classList.add('playing');
        showToast('Đang phát nhạc: ' + (WEDDING_CONFIG.music.songTitle || 'Melody'));
        isPlaying = true;
      }).catch(err => {
        console.log('Audio autoplay blocked by browser policy:', err);
      });
    }
  }

  musicBtn.addEventListener('click', togglePlay);

  // Tự động phát khi người dùng chạm hoặc cuộn lần đầu
  const autoPlayOnce = () => {
    if (!isPlaying && WEDDING_CONFIG.music?.enabled) {
      audio.play().then(() => {
        musicBtn.classList.add('playing');
        isPlaying = true;
      }).catch(() => {});
    }
    document.removeEventListener('click', autoPlayOnce);
    document.removeEventListener('touchstart', autoPlayOnce);
    document.removeEventListener('scroll', autoPlayOnce);
  };

  document.addEventListener('click', autoPlayOnce, { once: true });
  document.addEventListener('touchstart', autoPlayOnce, { once: true });
  document.addEventListener('scroll', autoPlayOnce, { once: true });
}

/**
 * Hiệu ứng cánh hoa / trái tim rơi lãng mạn trên Canvas
 */
function initPetalsEffect() {
  const canvas = document.getElementById('petals-canvas');
  const toggleBtn = document.getElementById('petals-toggle-btn');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  let petalsEnabled = WEDDING_CONFIG?.effects?.fallingPetals !== false;
  const petalCount = 28;
  const petals = [];

  class Petal {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * -height;
      this.size = Math.random() * 8 + 6;
      this.speedY = Math.random() * 1.5 + 0.8;
      this.speedX = Math.random() * 1.2 - 0.6;
      this.rotation = Math.random() * 360;
      this.rotationSpeed = (Math.random() - 0.5) * 1.8;
      this.color = Math.random() > 0.4 ? 'rgba(255, 182, 193, 0.7)' : 'rgba(201, 164, 93, 0.65)';
    }
    update() {
      this.y += this.speedY;
      this.x += Math.sin(this.y * 0.01) * 0.8 + this.speedX;
      this.rotation += this.rotationSpeed;
      if (this.y > height + 20) {
        this.reset();
      }
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      // Vẽ cánh hoa mềm mại
      ctx.ellipse(0, 0, this.size, this.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < petalCount; i++) {
    petals.push(new Petal());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    if (petalsEnabled) {
      for (const p of petals) {
        p.update();
        p.draw();
      }
    }
    requestAnimationFrame(animate);
  }
  animate();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      petalsEnabled = !petalsEnabled;
      toggleBtn.style.color = petalsEnabled ? 'var(--accent-gold)' : 'var(--text-muted)';
      showToast(petalsEnabled ? 'Đã bật hiệu ứng hoa rơi' : 'Đã tắt hiệu ứng hoa rơi');
    });
  }
}

/**
 * Trình xem ảnh toàn màn hình (Lightbox)
 */
let currentLightboxIdx = 0;

function initLightbox() {
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  const caption = document.getElementById('lightbox-caption');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  if (!modal) return;

  function openLightbox(idx) {
    if (!WEDDING_CONFIG?.images?.galleryPhotos) return;
    const photos = WEDDING_CONFIG.images.galleryPhotos;
    currentLightboxIdx = (idx + photos.length) % photos.length;
    const item = photos[currentLightboxIdx];
    img.src = item.src;
    caption.textContent = item.caption || '';
    modal.classList.add('active');
  }

  function closeLightbox() {
    modal.classList.remove('active');
  }

  document.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (item) {
      const idx = parseInt(item.getAttribute('data-index') || '0', 10);
      openLightbox(idx);
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', () => openLightbox(currentLightboxIdx - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => openLightbox(currentLightboxIdx + 1));

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('lightbox-img-wrapper')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') openLightbox(currentLightboxIdx - 1);
    if (e.key === 'ArrowRight') openLightbox(currentLightboxIdx + 1);
  });
}

/**
 * Xử lý Form RSVP & Lưu Sổ Lưu Bút
 */
function initRSVPForm() {
  const form = document.getElementById('rsvp-form');
  const wishesList = document.getElementById('wishes-list');
  if (!form) return;

  // Tải các lời chúc đã có từ localStorage
  const savedWishes = JSON.parse(localStorage.getItem('wedding_wishes') || '[]');
  
  // Dữ liệu mẫu ban đầu nếu chưa có lời chúc
  if (savedWishes.length === 0) {
    savedWishes.push(
      {
        name: "Ngọc Mai",
        text: "Chúc mừng bạn thân yêu của mình! Chúc bạn luôn rực rỡ và thành công trên chặng đường mới nhé! 🎉",
        time: "Vừa xong"
      },
      {
        name: "Hoàng Tuấn",
        text: "Chúc mừng Mai Hoa! Nhất định mình sẽ có mặt để chung vui cùng bạn!",
        time: "1 giờ trước"
      }
    );
  }

  function renderWishes() {
    if (!wishesList) return;
    wishesList.innerHTML = savedWishes.map(w => `
      <div class="wish-item">
        <div class="wish-header">
          <span class="wish-author">${escapeHTML(w.name)}</span>
          <span class="wish-time">${w.time}</span>
        </div>
        <div class="wish-text">${escapeHTML(w.text)}</div>
      </div>
    `).join('');
  }
  renderWishes();

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('rsvp-name');
    const attendingInput = document.querySelector('input[name="attendance"]:checked');
    const guestsCount = document.getElementById('rsvp-guests')?.value || '1';
    const messageInput = document.getElementById('rsvp-message');

    const name = nameInput?.value.trim();
    const attendance = attendingInput?.value || 'yes';
    const message = messageInput?.value.trim();

    if (!name) {
      showToast('Vui lòng nhập họ và tên của bạn nhé!');
      return;
    }

    // Lưu vào Sổ lưu bút
    if (message) {
      savedWishes.unshift({
        name: name,
        text: message,
        time: 'Vừa xong'
      });
      localStorage.setItem('wedding_wishes', JSON.stringify(savedWishes));
      renderWishes();
    }

    // Gửi webhook nếu có cài đặt
    if (WEDDING_CONFIG?.rsvp?.googleSheetWebhookUrl) {
      try {
        fetch(WEDDING_CONFIG.rsvp.googleSheetWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            attendance,
            guestsCount,
            message,
            submittedAt: new Date().toISOString()
          })
        });
      } catch (err) {
        console.log('Webhook error:', err);
      }
    }

    showToast('✨ Cảm ơn bạn! Xác nhận tham dự đã được gửi thành công!');
    form.reset();
  });
}

/**
 * Nút Sao chép số tài khoản nhanh
 */
function initBankCopy() {
  const copyBtn = document.getElementById('btn-copy-account');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', () => {
    const accNumber = document.getElementById('bank-number')?.textContent || '';
    if (accNumber) {
      navigator.clipboard.writeText(accNumber.trim()).then(() => {
        showToast('Đã sao chép số tài khoản: ' + accNumber);
      }).catch(() => {
        showToast('Số tài khoản: ' + accNumber);
      });
    }
  });
}

/**
 * ====================================================================
 * LIVE CUSTOMIZER (BẢNG THAY ẢNH VÀ CHỈNH SỬA TRỰC TIẾP TRÊN TRÌNH DUYỆT)
 * ====================================================================
 */
function initCustomizer() {
  const openBtn = document.getElementById('btn-open-customizer');
  const modal = document.getElementById('customizer-modal');
  const closeBtn = document.getElementById('customizer-close');
  const saveBtn = document.getElementById('btn-customizer-save');
  const exportBtn = document.getElementById('btn-customizer-export');

  if (!modal || !openBtn) return;

  openBtn.addEventListener('click', () => {
    modal.classList.add('active');
    populateCustomizerInputs();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  function populateCustomizerInputs() {
    const cfg = WEDDING_CONFIG;
    setVal('cust-owner-name', cfg.event.ownerName);
    setVal('cust-badge-top', cfg.event.badgeTop);
    setVal('cust-badge-bottom', cfg.event.badgeBottom);
    setVal('cust-date', cfg.event.day);
    setVal('cust-month', cfg.event.month);
    setVal('cust-year', cfg.event.year);
    setVal('cust-time', cfg.event.timeString);
    setVal('cust-venue-name', cfg.event.venue.name);
    setVal('cust-venue-address', cfg.event.venue.address);
    setVal('cust-story-heading', cfg.story.heading);
  }

  // Xử lý chọn ảnh từ máy tính (FileReader)
  bindImagePicker('picker-hero', (dataUrl) => {
    WEDDING_CONFIG.images.heroPortrait = dataUrl;
    safeSetSrc('#hero-portrait-img', dataUrl);
  });

  bindImagePicker('picker-story', (dataUrl) => {
    WEDDING_CONFIG.images.storyPortrait = dataUrl;
    safeSetSrc('#story-portrait-img', dataUrl);
  });

  bindImagePicker('picker-thankyou', (dataUrl) => {
    WEDDING_CONFIG.images.thankYouBanner = dataUrl;
    safeSetSrc('#thank-you-bg', dataUrl);
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      WEDDING_CONFIG.event.ownerName = getVal('cust-owner-name');
      WEDDING_CONFIG.event.badgeTop = getVal('cust-badge-top');
      WEDDING_CONFIG.event.badgeBottom = getVal('cust-badge-bottom');
      WEDDING_CONFIG.event.day = getVal('cust-date');
      WEDDING_CONFIG.event.month = getVal('cust-month');
      WEDDING_CONFIG.event.year = getVal('cust-year');
      WEDDING_CONFIG.event.timeString = getVal('cust-time');
      WEDDING_CONFIG.event.venue.name = getVal('cust-venue-name');
      WEDDING_CONFIG.event.venue.address = getVal('cust-venue-address');
      WEDDING_CONFIG.story.heading = getVal('cust-story-heading');

      renderContentFromConfig();
      modal.classList.remove('active');
      showToast('🎉 Đã cập nhật thiệp trực tiếp thành công!');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const configStr = 'const WEDDING_CONFIG = ' + JSON.stringify(WEDDING_CONFIG, null, 2) + ';\n';
      const blob = new Blob([configStr], { type: 'application/javascript;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'config.js';
      link.click();
      showToast('Đã tải xuống file config.js mới!');
    });
  }
}

function bindImagePicker(inputId, onLoaded) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onLoaded(evt.target.result);
          showToast('Đã chèn ảnh mới thành công!');
        }
      };
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Toast Notification Helper
 */
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// Helper Utilities
function safeSetText(selector, text) {
  if (text === undefined || text === null) return;
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function safeSetSrc(selector, src) {
  if (!src) return;
  const el = document.querySelector(selector);
  if (el) el.src = src;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.value = val;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
