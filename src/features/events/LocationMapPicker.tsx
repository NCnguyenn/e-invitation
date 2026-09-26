'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorIcon } from './EditorIcon';
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
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    amenity?: string;
    shop?: string;
    building?: string;
  };
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapPreviewQuery = [venueName, venueAddress].filter(Boolean).join(', ');
  const [settledMapQuery, setSettledMapQuery] = useState(mapPreviewQuery);

  // Navigating an iframe on every keystroke starts an entire external page load.
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

  // Tìm kiếm địa điểm với debounce
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            val.trim()
          )}&countrycodes=vn&addressdetails=1&limit=5`,
          {
            headers: {
              'Accept-Language': 'vi',
            },
          }
        );
        if (res.ok) {
          const data = (await res.json()) as PlaceSuggestion[];
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        // Fallback im lặng nếu mạng chậm
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  // Khi chọn một địa điểm từ danh sách gợi ý
  function selectPlace(place: PlaceSuggestion) {
    const parts = place.display_name.split(',').map((s) => s.trim());
    const primaryName = place.name || parts[0] || 'Địa điểm tổ chức';
    const address = parts.length > 1 ? parts.slice(1).join(', ') : place.display_name;

    onChangeVenueName(primaryName);
    onChangeVenueAddress(address);

    // Tự động tạo link Google Maps chính thức theo tọa độ hoặc tên địa chỉ
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${primaryName}, ${address}`
    )}`;
    onChangeGoogleMapUrl(mapLink);

    setSearchQuery(place.display_name);
    setShowDropdown(false);
  }

  // Tự động tạo hoặc đồng bộ link Google Maps từ thông tin đang nhập
  function syncGoogleMapsLink() {
    const query = [venueName, venueAddress].filter(Boolean).join(', ');
    if (query) {
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
        <div><h2 id="location-heading" className={styles.cardTitle}>Địa điểm tổ chức</h2><p className={styles.cardDescription}>Thông tin địa điểm hiển thị trên thiệp mời.</p></div>
      </div>
      <div className={styles.searchWrapper} ref={dropdownRef}>
        <div className={styles.searchBox}>
          <EditorIcon name="search" />
          <input
            type="search" className={styles.input}
            aria-label="Tìm kiếm địa điểm"
            aria-controls={showDropdown ? 'place-suggestions' : undefined}
            aria-expanded={showDropdown}
            placeholder="Tìm kiếm địa điểm tổ chức"
            value={searchQuery} onChange={handleSearchChange}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDropdown(false);
              if (e.key === 'Enter') e.preventDefault();
              if (e.key === 'ArrowDown' && showDropdown) {
                e.preventDefault();
                dropdownRef.current?.querySelector<HTMLButtonElement>('li button')?.focus();
              }
            }}
            disabled={disabled}
          />
          {loading && <span className={styles.searchSpinner} role="status" aria-label="Đang tìm địa điểm">…</span>}
        </div>
        {showDropdown && suggestions.length > 0 && (
          <ul id="place-suggestions" className={styles.suggestions} aria-label="Địa điểm gợi ý">
            {suggestions.map((p) => (
              <li key={p.place_id}>
                <button type="button" className={styles.suggestion} disabled={disabled} onClick={() => selectPlace(p)}>
                  <EditorIcon name="pin" />
                  <span><strong>{p.name || p.display_name.split(',')[0]}</strong><small>{p.display_name}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.locationGrid}>
        <div className={styles.locationInputs}>
          <div className={styles.field}>
            <label htmlFor="event-venue-input">Tên địa điểm</label>
            <input id="event-venue-input" className={styles.input} value={venueName} maxLength={255} placeholder="Nhà hàng, hội trường…" onChange={(e) => onChangeVenueName(e.target.value)} onBlur={syncGoogleMapsLink} disabled={disabled} />
          </div>
          <div className={styles.field}>
            <label htmlFor="event-address-input">Địa chỉ chi tiết</label>
            <textarea id="event-address-input" className={styles.input} value={venueAddress} rows={2} maxLength={2000} placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành…" onChange={(e) => onChangeVenueAddress(e.target.value)} onBlur={syncGoogleMapsLink} disabled={disabled} />
          </div>
        </div>
        <div className={styles.miniMap}>
          <div className={styles.mapFrame}>
            {embedUrl ? <iframe title="Bản đồ vị trí" src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : (
              <div className={styles.mapPlaceholder}><EditorIcon name="pin" /><span>Nhập hoặc tìm địa điểm để hiển thị bản đồ.</span></div>
            )}
          </div>
          {googleMapUrl.startsWith('https://') && <a href={googleMapUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}><EditorIcon name="external" />Mở Google Maps</a>}
        </div>
      </div>
      <button type="button" className={styles.mapToggle} aria-expanded={showCustomUrlInput} aria-controls="custom-map-url" onClick={() => setShowCustomUrlInput(!showCustomUrlInput)} disabled={disabled}>
        <EditorIcon name="chevron" />{showCustomUrlInput ? 'Ẩn liên kết bản đồ thủ công' : 'Nhập liên kết bản đồ thủ công'}
      </button>
      <div id="custom-map-url" hidden={!showCustomUrlInput} className={styles.customUrl}>
        <div className={styles.field}>
          <label htmlFor="event-map-input">Liên kết Google Maps</label>
          <input id="event-map-input" type="url" className={styles.input} value={googleMapUrl} maxLength={2048} placeholder="https://maps.app.goo.gl/…" onChange={(e) => onChangeGoogleMapUrl(e.target.value)} disabled={disabled} />
        </div>
        <p className={styles.fieldHelp}>Dán liên kết Google Maps để khách mở chỉ đường trên thiệp mời.</p>
      </div>
    </section>
  );
}
