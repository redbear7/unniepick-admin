import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, logActivity, type ActivityEventType } from '@/lib/server/activity';

const EVENT_TYPES = new Set<ActivityEventType>([
  'coupon_created',
  'coupon_saved',
  'coupon_used',
  'shorts_requested',
  'shorts_created',
  'store_joined',
  'review_claimed',
  'geofence_entered',
  'route_clicked',
  'share_clicked',
]);

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 30), 100);
  const area = req.nextUrl.searchParams.get('area');
  const type = req.nextUrl.searchParams.get('type');

  const sb = createAdminClient();
  let query = sb
    .from('activity_feed_public')
    .select('id, event_type, actor_type, store_id, coupon_id, area, title, detail, geofence_id, radius_m, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (area) query = query.eq('area', area);
  if (type && EVENT_TYPES.has(type as ActivityEventType)) query = query.eq('event_type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON body가 필요합니다.' }, { status: 400 });
  }

  const eventType = String(body.event_type ?? '');
  if (!EVENT_TYPES.has(eventType as ActivityEventType)) {
    return NextResponse.json({ error: '지원하지 않는 event_type입니다.' }, { status: 400 });
  }

  const title = String(body.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'title이 필요합니다.' }, { status: 400 });
  }

  const actorType = ['user', 'owner', 'admin', 'system'].includes(body.actor_type)
    ? body.actor_type
    : 'system';

  const visibility = body.visibility === 'admin' ? 'admin' : 'public';
  const sb = createAdminClient();

  try {
    const data = await logActivity(sb, {
      event_type: eventType as ActivityEventType,
      actor_type: actorType,
      user_id: body.user_id ?? null,
      store_id: body.store_id ?? null,
      coupon_id: body.coupon_id ?? null,
      source_table: body.source_table ?? null,
      source_id: body.source_id ?? null,
      area: body.area ?? null,
      title,
      detail: body.detail ?? null,
      geofence_id: body.geofence_id ?? null,
      lat: asNumber(body.lat),
      lng: asNumber(body.lng),
      radius_m: asNumber(body.radius_m),
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      visibility,
    });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'activity log failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
