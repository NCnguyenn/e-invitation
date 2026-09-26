'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorIcon } from './EditorIcon';
import { isGoogleMapsUrl } from './map-resolver';
import styles from './event-editor.module.css';

interface LocationMapPickerProps {
  venueName: string;
  venueAddress: string;
  googleMapUrl: string;
  onChangeVenueName: (val: string) => void;
  onChangeVenueAddress: (val: string) => void;
  onChangeGoogleMapUrl: (val: string) => void;
  disabled?: boolean;
}

interface PlaceSuggestion {
  place_id: number;
  name: string;
  address: string;
  display_name: string;
  lat?: number;
  lon?: number;
  googleMapUrl: string;
}

interface StatusMessage {
  type: 'info' | 'success' | 'error';
  text: string;
}

export function LocationMapPicker({
  venueName,
  venueAddress,
  googleMapUrl,
  onChangeVenueName,
  onChangeVenueAddress,
  onChangeGoogleMapUrl,
  disabled = false,
}: LocationMapPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapPreviewQuery = [venueName, venueAddress].filter(Boolean).join(', ');
  const [settledMapQuery, setSettledMapQuery] = useState(mapPreviewQuery);

  // Cập nhật iframe bản đồ với debounce
  useEffect(() => {
    const timer = setTimeout(() => setSettledMapQuery(mapPreviewQuery), 500);
    return () => clearTimeout(timer);
  }, [mapPreviewQuery]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hàm nhận diện link Google Maps từ server
  async function resolveMapLink(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Đang nhận diện địa điểm từ Google Maps…' });

    try {
      const res = await fetch('/api/host/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.location) {
        const { venueName: name, venueAddress: addr, googleMapUrl: finalMapUrl } = data.location;
        if (name) onChangeVenueName(name);
        if (addr) onChangeVenueAddress(addr);
        if (finalMapUrl) onChangeGoogleMapUrl(finalMapUrl);

        setStatusMessage({
          type: 'success',
          text: `Đã tự động cập nhật: "${name}" từ Google Maps!`,
        });
        setSearchQuery('');
        setShowDropdown(false);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.message || 'Không thể nhận diện liên kết Google Maps này.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Lỗi kết nối khi nhận diện liên kết Google Maps.',
      });
    } finally {
      setLoading(false);
    }
  }

  // Tìm kiếm địa điểm với debounce
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    setStatusMessage(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = val.trim();
    // Nếu người dùng dán link Google Maps vào ô tìm kiếm
    if (isGoogleMapsUrl(trimmed)) {
      resolveMapLink(trimmed);
      return;
    }

    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/host/locations?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isMapUrl && data.resolved) {
            const { venueName: name, venueAddress: addr, googleMapUrl: finalMapUrl } = data.resolved;
            if (name) onChangeVenueName(name);
            if (addr) onChangeVenueAddress(addr);
            if (finalMapUrl) onChangeGoogleMapUrl(finalMapUrl);
            setStatusMessage({
              type: 'success',
              text: `Đã tự động cập nhật: "${name}" từ Google Maps!`,
            });
            setShowDropdown(false);
            return;
          }
          const list = (data.suggestions || []) as PlaceSuggestion[];
          setSuggestions(list);
          setShowDropdown(true);
        }
      } catch {
        // Fallback im lặng
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  // Khi chọn một địa điểm từ danh sách gợi ý
  function selectPlace(place: PlaceSuggestion) {
    onChangeVenueName(place.name);
    onChangeVenueAddress(place.address);
    onChangeGoogleMapUrl(place.googleMapUrl);
    setSearchQuery(place.name);
    setShowDropdown(false);
    setStatusMessage({
      type: 'success',
      text: `Đã chọn địa điểm: "${place.name}"`,
    });
  }

  // Tự động tạo hoặc đồng bộ link Google Maps từ thông tin đang nhập
  function syncGoogleMapsLink() {
    const query = [venueName, venueAddress].filter(Boolean).join(', ');
    if (query && !googleMapUrl) {
      const generated = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      onChangeGoogleMapUrl(generated);
    }
  }

  // Tạo URL embed để hiển thị bản đồ mini
  const embedUrl = settledMapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(settledMapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
    : null;

  return (
    <section className={styles.card} aria-labelledby="location-heading">
      <div className={styles.cardHeader}>
        <span className={styles.iconBadge}><EditorIcon name="pin" /></span>
        <div>
          <h2 id="location-heading" className={styles.cardTitle}>Địa điểm tổ chức</h2>
          <p className={styles.cardDescription}>Thông tin địa điểm hiển thị trên thiệp mời.</p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={[
            styles.locationStatus,
            statusMessage.type === 'success'
              ? styles.locationStatusSuccess
              : statusMessage.type === 'error'
              ? styles.locationStatusError
              : styles.locationStatusInfo,
          ].join(' ')}
          role="status"
        >
          <EditorIcon name="info" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className={styles.searchWrapper} ref={dropdownRef}>
        <div className={styles.searchBox}>
          <EditorIcon name="search" />
          <input
            type="search"
            className={styles.input}
            aria-label="Tìm kiếm địa điểm"
            aria-controls={showDropdown ? 'place-suggestions' : undefined}
            aria-expanded={showDropdown}
            placeholder="Tìm kiếm địa điểm hoặc dán link Google Maps…"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              if (suggestions.length > 0 || (searchQuery.trim().length >= 2 && !loading)) {
                setShowDropdown(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDropdown(false);
              if (e.key === 'Enter') {
                e.preventDefault();
                if (suggestions.length > 0) {
                  selectPlace(suggestions[0]);
                } else if (searchQuery.trim()) {
                  if (isGoogleMapsUrl(searchQuery.trim())) {
                    resolveMapLink(searchQuery.trim());
                  } else {
                    onChangeVenueName(searchQuery.trim());
                    if (!venueAddress) onChangeVenueAddress(searchQuery.trim());
                    syncGoogleMapsLink();
                    setShowDropdown(false);
                    setStatusMessage({
                      type: 'info',
                      text: `Đã áp dụng: "${searchQuery.trim()}"`,
                    });
                  }
                }
              }
              if (e.key === 'ArrowDown' && showDropdown) {
                e.preventDefault();
                dropdownRef.current?.querySelector<HTMLButtonElement>('li button')?.focus();
              }
            }}
            disabled={disabled}
          />
          {loading && (
            <span className={styles.searchSpinner} role="status" aria-label="Đang tìm kiếm">
              …
            </span>
          )}
        </div>

        {showDropdown && (
          <ul id="place-suggestions" className={styles.suggestions} aria-label="Địa điểm gợi ý">
            {suggestions.length > 0 ? (
              suggestions.map((p) => (
                <li key={p.place_id}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    disabled={disabled}
                    onClick={() => selectPlace(p)}
                  >
                    <EditorIcon name="pin" />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.address}</small>
                    </span>
                  </button>
                </li>
              ))
            ) : !loading && searchQuery.trim().length >= 2 ? (
              <li className={styles.emptySuggestion}>
                Không tìm thấy địa điểm phù hợp. Bạn có thể nhấn <strong>Enter</strong> hoặc nhập trực tiếp vào các ô bên dưới.
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div className={styles.locationGrid}>
        <div className={styles.locationInputs}>
          <div className={styles.field}>
            <label htmlFor="event-venue-input">Tên địa điểm</label>
            <input
              id="event-venue-input"
              className={styles.input}
              value={venueName}
              maxLength={255}
              placeholder="Nhà hàng, hội trường, tư gia…"
              onChange={(e) => onChangeVenueName(e.target.value)}
              onBlur={syncGoogleMapsLink}
              disabled={disabled}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="event-address-input">Địa chỉ chi tiết</label>
            <textarea
              id="event-address-input"
              className={styles.input}
              value={venueAddress}
              rows={2}
              maxLength={2000}
              placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành…"
              onChange={(e) => onChangeVenueAddress(e.target.value)}
              onBlur={syncGoogleMapsLink}
              disabled={disabled}
            />
          </div>
        </div>

        <div className={styles.miniMap}>
          <div className={styles.mapFrame}>
            {embedUrl ? (
              <iframe
                title="Bản đồ vị trí"
                src={embedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className={styles.mapPlaceholder}>
                <EditorIcon name="pin" />
                <span>Nhập hoặc tìm địa điểm để hiển thị bản đồ.</span>
              </div>
            )}
          </div>
          {googleMapUrl.startsWith('https://') && (
            <a
              href={googleMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mapLink}
            >
              <EditorIcon name="external" />
              Mở Google Maps
            </a>
          )}
        </div>
      </div>

      <button
        type="button"
        className={styles.mapToggle}
        aria-expanded={showCustomUrlInput}
        aria-controls="custom-map-url"
        onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
        disabled={disabled}
      >
        <EditorIcon name="chevron" />
        {showCustomUrlInput ? 'Ẩn liên kết Google Maps' : 'Cấu hình liên kết Google Maps'}
      </button>

      <div id="custom-map-url" hidden={!showCustomUrlInput} className={styles.customUrl}>
        <div className={styles.field}>
          <label htmlFor="event-map-input">Liên kết Google Maps</label>
          <input
            id="event-map-input"
            type="url"
            className={styles.input}
            value={googleMapUrl}
            maxLength={2048}
            placeholder="https://maps.app.goo.gl/… hoặc https://www.google.com/maps/…"
            onChange={(e) => {
              const val = e.target.value;
              onChangeGoogleMapUrl(val);
              if (isGoogleMapsUrl(val)) {
                resolveMapLink(val);
              }
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text').trim();
              if (isGoogleMapsUrl(pasted)) {
                setTimeout(() => resolveMapLink(pasted), 50);
              }
            }}
            disabled={disabled}
          />
        </div>
        <div className={styles.syncRow}>
          <button
            type="button"
            className={styles.syncBtn}
            onClick={() => resolveMapLink(googleMapUrl)}
            disabled={disabled || !googleMapUrl.trim() || loading}
          >
            <EditorIcon name="pin" />
            Nhận diện thông tin từ link này
          </button>
        </div>
        <p className={styles.fieldHelp}>
          Dán liên kết Google Maps (link rút gọn maps.app.goo.gl hoặc link đầy đủ) để hệ thống tự động cập nhật Tên địa điểm, Địa chỉ và Bản đồ.
        </p>
      </div>
    </section>
  );
}
