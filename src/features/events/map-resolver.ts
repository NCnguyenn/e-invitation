export interface ExtractedPlace {
  placeName?: string;
  query?: string;
  lat?: number;
  lon?: number;
}

export interface ResolvedLocation {
  venueName: string;
  venueAddress: string;
  googleMapUrl: string;
  lat?: number;
  lon?: number;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 6000;

export class LocationResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationResolutionError';
  }
}

export function isGoogleMapsUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    if (url.port && url.port !== '443') return false;

    const host = url.hostname.toLowerCase();
    if (host === 'maps.app.goo.gl' || host === 'maps.google.com') return true;
    if ((host === 'google.com' || host === 'www.google.com') && (url.pathname === '/maps' || url.pathname.startsWith('/maps/'))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function extractPlaceFromUrl(rawUrl: string): ExtractedPlace {
  const result: ExtractedPlace = {};
  if (!rawUrl) return result;

  try {
    const url = new URL(rawUrl);

    // 1. Check for /maps/place/<PlaceName>/
    const placeMatch = url.pathname.match(/\/maps\/place\/([^/@?]+)/);
    if (placeMatch && placeMatch[1]) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
      } catch {
        decoded = placeMatch[1].replace(/\+/g, ' ').trim();
      }
      // If it's not raw coordinates, treat as place name
      if (!/^[-\d.,\s+°'"NSEW]+$/.test(decoded)) {
        result.placeName = decoded;
      }
    }

    // 2. Check query params: query, q
    const qParam = url.searchParams.get('query') || url.searchParams.get('q');
    if (qParam) {
      // URLSearchParams already decodes percent escapes (including names containing a literal "%").
      const decodedQuery = qParam.trim();
      result.query = decodedQuery;
      if (!result.placeName && !/^[-\d.,\s+]+$/.test(decodedQuery)) {
        result.placeName = decodedQuery;
      }
      // Check if query itself has coordinates "lat,lng"
      const coordInQuery = decodedQuery.match(/^([-\d.]+)\s*,\s*([-\d.]+)$/);
      if (coordInQuery) {
        result.lat = parseFloat(coordInQuery[1]);
        result.lon = parseFloat(coordInQuery[2]);
      }
    }

    // 3. Check pin coordinates in data parameter: !3d<lat>!4d<lon>
    const pinMatch = rawUrl.match(/!3d([-\d.]+)!4d([-\d.]+)/);
    if (pinMatch) {
      result.lat = parseFloat(pinMatch[1]);
      result.lon = parseFloat(pinMatch[2]);
    } else {
      // 4. Viewport center coordinates: @<lat>,<lon>
      const atMatch = rawUrl.match(/@([-\d.]+),([-\d.]+)/);
      if (atMatch && result.lat === undefined) {
        result.lat = parseFloat(atMatch[1]);
        result.lon = parseFloat(atMatch[2]);
      }
    }
  } catch {
    // Return whatever was partially parsed
  }

  return result;
}

export function formatAddressFromProperties(props: Record<string, unknown>): string {
  if (!props) return '';
  const housenumber = typeof props.housenumber === 'string' ? props.housenumber.trim() : '';
  const street = typeof props.street === 'string' ? props.street.trim() : '';
  const locality = typeof props.locality === 'string' ? props.locality.trim() : '';
  const district = typeof props.district === 'string' ? props.district.trim() : '';
  const city = typeof props.city === 'string' ? props.city.trim() : typeof props.state === 'string' ? props.state.trim() : '';

  const streetPart = [housenumber, street].filter(Boolean).join(' ');
  const addressParts = [streetPart, locality, district, city].filter(Boolean);
  return addressParts.join(', ');
}

export async function resolveGoogleMapsUrl(inputUrl: string, fetcher: typeof fetch = fetch): Promise<ResolvedLocation> {
  const trimmed = inputUrl.trim();
  if (!isGoogleMapsUrl(trimmed)) {
    throw new Error('Liên kết Google Maps không hợp lệ.');
  }

  let expandedUrl = trimmed;

  // Expand with GET: some short-link providers do not support HEAD.
  if (new URL(trimmed).hostname.toLowerCase() === 'maps.app.goo.gl') {
    let response: Response;
    try {
      response = await fetcher(trimmed, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new LocationResolutionError('Không thể mở liên kết Google Maps rút gọn lúc này. Vui lòng thử lại hoặc dán liên kết Google Maps đầy đủ.');
    }

    if (!response.ok || !response.url || response.url === trimmed) {
      throw new LocationResolutionError('Không thể mở liên kết Google Maps rút gọn lúc này. Vui lòng thử lại hoặc dán liên kết Google Maps đầy đủ.');
    }
    if (!isGoogleMapsUrl(response.url)) {
      throw new LocationResolutionError('Liên kết rút gọn không dẫn đến Google Maps.');
    }
    expandedUrl = response.url;
  }

  const extracted = extractPlaceFromUrl(expandedUrl);
  let venueName = extracted.placeName || '';
  let venueAddress = '';
  let lat = extracted.lat;
  let lon = extracted.lon;

  // 1. If we have coordinates, reverse geocode via Photon
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
    try {
      const geoRes = await fetcher(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`, {
        headers: {
          'Accept-Language': 'vi',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (geoRes.ok) {
        const data = await geoRes.json();
        const feat = data.features?.[0];
        if (feat?.properties) {
          const formatted = formatAddressFromProperties(feat.properties);
          if (formatted) venueAddress = formatted;
          if (!venueName && feat.properties.name) {
            venueName = String(feat.properties.name);
          }
        }
      }
    } catch {
      // Photon fallback
    }
  }

  // 2. Search by place name only when the Google link has no pinned coordinates.
  const searchQuery = extracted.query || venueName;
  const hasPinnedCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
  // Keep the coordinates parsed from Google's pin; a place-name search can point to another branch.
  if ((!venueAddress || !venueName) && searchQuery && !hasPinnedCoordinates) {
    try {
      const searchRes = await fetcher(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'vi',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        const feat = data.features?.[0];
        if (feat?.properties) {
          if (!venueAddress) {
            venueAddress = formatAddressFromProperties(feat.properties);
          }
          if (!venueName && feat.properties.name) {
            venueName = String(feat.properties.name);
          }
          if (lat === undefined && feat.geometry?.coordinates) {
            lon = feat.geometry.coordinates[0];
            lat = feat.geometry.coordinates[1];
          }
        }
      }
    } catch {
      // Photon search fallback
    }
  }

  // Fallbacks if nothing could be geocoded
  if (!venueName) {
    venueName = extracted.query || 'Địa điểm tổ chức';
  }
  if (!venueAddress) {
    venueAddress = extracted.query || venueName;
  }

  // Standardize Google Maps URL
  let finalMapUrl = inputUrl;
  if (!inputUrl.startsWith('https://')) {
    finalMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${venueName}, ${venueAddress}`
    )}`;
  }

  return {
    venueName,
    venueAddress,
    googleMapUrl: finalMapUrl,
    lat,
    lon,
  };
}
