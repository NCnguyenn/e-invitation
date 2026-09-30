import { NextResponse } from 'next/server';
import { AuthRequiredError, AuthServiceError, requireHost } from '@/features/auth/server';
import { isAllowedMutationOrigin } from '@/lib/origin';
import { ValidationError } from '@/lib/validation';
import {
  formatAddressFromProperties,
  isGoogleMapsUrl,
  LocationResolutionError,
  resolveGoogleMapsUrl,
} from '@/features/events/map-resolver';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function failure(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
      { status: 401, headers }
    );
  }
  if (error instanceof AuthServiceError) {
    console.error('[api] auth service unavailable', error);
    return NextResponse.json(
      { code: 'auth_unavailable', message: 'Dịch vụ xác thực tạm thời gián đoạn. Vui lòng thử lại sau.' },
      { status: 503, headers },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { code: 'invalid_input', message: error.message },
      { status: 422, headers }
    );
  }
  if (error instanceof LocationResolutionError) {
    return NextResponse.json(
      { code: 'map_link_unavailable', message: error.message },
      { status: 502, headers }
    );
  }
  return NextResponse.json(
    {
      code: 'location_error',
      message: error instanceof Error ? error.message : 'Không thể xử lý thông tin địa điểm.',
    },
    { status: 500, headers }
  );
}

export async function GET(request: Request) {
  try {
    await requireHost();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] }, { headers });
    }

    // If query is actually a Google Maps URL, resolve it directly
    if (isGoogleMapsUrl(q)) {
      const resolved = await resolveGoogleMapsUrl(q);
      return NextResponse.json(
        {
          isMapUrl: true,
          resolved,
          suggestions: [],
        },
        { headers }
      );
    }

    // Otherwise, search places via Photon
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`,
      {
        headers: {
          'Accept-Language': 'vi',
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] }, { headers });
    }

    const data = await res.json();
    interface PhotonFeature {
      properties?: Record<string, unknown> & { name?: string };
      geometry?: { coordinates?: [number, number] };
    }

    const suggestions = (data.features || []).map((feat: PhotonFeature, idx: number) => {
      const props = feat.properties || {};
      const name = String(props.name || q);
      const address = formatAddressFromProperties(props);
      const displayName = address ? `${name}, ${address}` : name;
      const coords = feat.geometry?.coordinates;
      const lon = coords?.[0];
      const lat = coords?.[1];
      const mapUrl =
        lat !== undefined && lon !== undefined
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayName)}`;

      return {
        place_id: idx + 1,
        name,
        address: address || name,
        display_name: displayName,
        lat,
        lon,
        googleMapUrl: mapUrl,
      };
    });

    return NextResponse.json({ suggestions }, { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json(
      { code: 'invalid_origin', message: 'Yêu cầu không hợp lệ.' },
      { status: 403, headers }
    );
  }

  try {
    await requireHost();
    let body: { url?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Dữ liệu yêu cầu không hợp lệ.');
    }

    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) {
      throw new ValidationError('Vui lòng cung cấp liên kết Google Maps.');
    }

    if (!isGoogleMapsUrl(url)) {
      throw new ValidationError('Liên kết không phải là định dạng Google Maps hợp lệ.');
    }

    const resolved = await resolveGoogleMapsUrl(url);
    return NextResponse.json({ location: resolved }, { headers });
  } catch (error) {
    return failure(error);
  }
}
