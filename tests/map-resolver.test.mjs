import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGoogleMapsUrl,
  extractPlaceFromUrl,
  formatAddressFromProperties,
  resolveGoogleMapsUrl,
} from '../src/features/events/map-resolver.ts';

test('isGoogleMapsUrl correctly identifies valid Google Maps URLs', () => {
  assert.equal(isGoogleMapsUrl('https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6'), true);
  assert.equal(isGoogleMapsUrl('https://www.google.com/maps/place/Hanoi'), true);
  assert.equal(isGoogleMapsUrl('https://maps.google.com/?q=21.0,105.8'), true);
  assert.equal(isGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=Bach+Khoa'), true);
  assert.equal(isGoogleMapsUrl('https://example.com/not-maps'), false);
  assert.equal(isGoogleMapsUrl('not-a-url'), false);
});

test('extractPlaceFromUrl extracts place name and coordinates from place URL', () => {
  const url = 'https://www.google.com/maps/place/Tr%C6%B0%E1%BB%9Dng+%C4%90%E1%BA%A1i+H%E1%BB%8Dc+Kinh+T%E1%BA%BF+Qu%E1%BB%91c+D%C3%A2n+(NEU)/@21.0000781,105.8376696,2009m/data=!3m1!1e3!4m6!3m5!1s0x3135ac71752d8f79:0xd2ec575c01017afa!8m2!3d20.9999958!4d105.8429949!16s';
  const result = extractPlaceFromUrl(url);
  assert.equal(result.placeName, 'Trường Đại Học Kinh Tế Quốc Dân (NEU)');
  assert.equal(result.lat, 20.9999958);
  assert.equal(result.lon, 105.8429949);
});

test('extractPlaceFromUrl extracts search query from search URL', () => {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Đại học Bách Khoa')}`;
  const result = extractPlaceFromUrl(url);
  assert.equal(result.query, 'Đại học Bách Khoa');
});

test('extractPlaceFromUrl extracts coordinates from query parameter', () => {
  const url = 'https://maps.google.com/?q=21.0285,105.8542';
  const result = extractPlaceFromUrl(url);
  assert.equal(result.lat, 21.0285);
  assert.equal(result.lon, 105.8542);
});

test('formatAddressFromProperties produces a clean Vietnamese address', () => {
  const props = {
    housenumber: '207',
    street: 'Giải Phóng',
    district: 'Hai Bà Trưng',
    city: 'Hà Nội',
    country: 'Việt Nam',
  };
  const addr = formatAddressFromProperties(props);
  assert.equal(addr, '207 Giải Phóng, Hai Bà Trưng, Hà Nội');
});

test('resolveGoogleMapsUrl expands a short link with one bounded GET, then geocodes its pinned place', async () => {
  const shortUrl = 'https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6';
  const expandedUrl = 'https://www.google.com/maps/place/Tr%C6%B0%E1%BB%9Dng+%C4%90%E1%BA%A1i+H%E1%BB%8Dc+Kinh+T%E1%BA%BF+Qu%E1%BB%91c+D%C3%A2n+(NEU)/@21.0000781,105.8376696,2009m/data=!1m1!1s0x3135ac71752d8f79:0xd2ec575c01017afa!8m2!3d20.9999958!4d105.8429949';
  const calls = [];
  const mockFetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === shortUrl) {
      const response = new Response('', { status: 200 });
      Object.defineProperty(response, 'url', { value: expandedUrl });
      return response;
    }
    if (url.startsWith('https://photon.komoot.io/reverse?')) {
      return Response.json({ features: [{
        properties: { name: 'Trường Đại Học Kinh Tế Quốc Dân', housenumber: '207', street: 'Giải Phóng', district: 'Hai Bà Trưng', city: 'Hà Nội' },
        geometry: { coordinates: [105.8429949, 20.9999958] },
      }] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const res = await resolveGoogleMapsUrl(shortUrl, mockFetch);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, shortUrl);
  assert.equal(calls[0].init.method ?? 'GET', 'GET');
  assert.equal(calls[0].init.redirect, 'follow');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.ok(res.venueName.includes('Kinh Tế Quốc Dân'));
  assert.equal(res.venueAddress, '207 Giải Phóng, Hai Bà Trưng, Hà Nội');
  assert.equal(res.lat, 20.9999958);
  assert.equal(res.lon, 105.8429949);
  assert.equal(res.googleMapUrl, shortUrl);
});

test('resolveGoogleMapsUrl reports failed short-link expansion instead of returning a fake location', async () => {
  const mockFetch = async () => { throw new TypeError('network unavailable'); };
  await assert.rejects(
    resolveGoogleMapsUrl('https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6', mockFetch),
    /Không thể mở liên kết Google Maps rút gọn/,
  );
});

test('resolveGoogleMapsUrl refuses short links redirected outside Google Maps', async () => {
  const response = new Response('', { status: 200 });
  Object.defineProperty(response, 'url', { value: 'https://example.com/venue' });
  let calls = 0;
  const mockFetch = async () => { calls++; return response; };
  await assert.rejects(
    resolveGoogleMapsUrl('https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6', mockFetch),
    /không dẫn đến Google Maps/,
  );
  assert.equal(calls, 1);
});

test('resolveGoogleMapsUrl keeps an explicit map place usable when Photon is offline', async () => {
  const url = 'https://www.google.com/maps/place/Dai+hoc+Bach+Khoa/@21.004,105.844/data=!3d21.004!4d105.844';
  const res = await resolveGoogleMapsUrl(url, async () => new Response('', { status: 503 }));
  assert.equal(res.venueName, 'Dai hoc Bach Khoa');
  assert.equal(res.venueAddress, 'Dai hoc Bach Khoa');
  assert.equal(res.lat, 21.004);
  assert.equal(res.lon, 105.844);
  assert.equal(res.googleMapUrl, url);
});

test('resolveGoogleMapsUrl never replaces a pinned location with a name-search result', async () => {
  const url = 'https://www.google.com/maps/place/Truong+Hop+Tac+Quoc+Te/@21.004,105.844/data=!3d21.004!4d105.844';
  const paths = [];
  const res = await resolveGoogleMapsUrl(url, async input => {
    const requestUrl = String(input);
    paths.push(new URL(requestUrl).pathname);
    if (requestUrl.includes('/reverse?')) return new Response('', { status: 503 });
    throw new Error('A generic name search could select a different venue');
  });
  assert.deepEqual(paths, ['/reverse']);
  assert.equal(res.venueName, 'Truong Hop Tac Quoc Te');
  assert.equal(res.venueAddress, 'Truong Hop Tac Quoc Te');
  assert.equal(res.lat, 21.004);
  assert.equal(res.lon, 105.844);
});
