const KAKAO_REST_KEY =
  process.env.KAKAO_REST_KEY
  ?? process.env.NEXT_PUBLIC_KAKAO_REST_KEY
  ?? '30e31a6f08ec677dc19b020601ffcbb0';

type GeocodeResult = {
  latitude: number;
  longitude: number;
  roadAddress: string | null;
  address: string | null;
};

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', query);
  url.searchParams.set('size', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Kakao geocode failed: ${res.status}`);
  }

  const data = await res.json().catch(() => null) as {
    documents?: Array<{
      x?: string;
      y?: string;
      address?: { address_name?: string | null } | null;
      road_address?: { address_name?: string | null } | null;
    }>;
  } | null;

  const doc = data?.documents?.[0];
  if (!doc) return null;

  const latitude = Number(doc.y);
  const longitude = Number(doc.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    roadAddress: doc.road_address?.address_name ?? null,
    address: doc.address?.address_name ?? null,
  };
}
