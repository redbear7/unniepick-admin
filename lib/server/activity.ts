import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ActivityEventType =
  | 'coupon_created'
  | 'coupon_saved'
  | 'coupon_used'
  | 'shorts_requested'
  | 'shorts_created'
  | 'store_joined'
  | 'review_claimed'
  | 'geofence_entered'
  | 'route_clicked'
  | 'share_clicked';

export type ActivityActorType = 'user' | 'owner' | 'admin' | 'system';

export interface ActivityInput {
  event_type: ActivityEventType;
  actor_type?: ActivityActorType;
  user_id?: string | null;
  store_id?: string | null;
  coupon_id?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  area?: string | null;
  title: string;
  detail?: string | null;
  geofence_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_m?: number | null;
  metadata?: Record<string, unknown>;
  visibility?: 'public' | 'admin';
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function logActivity(
  sb: SupabaseClient,
  input: ActivityInput,
) {
  const payload = {
    event_type: input.event_type,
    actor_type: input.actor_type ?? 'system',
    user_id: input.user_id ?? null,
    store_id: input.store_id ?? null,
    coupon_id: input.coupon_id ?? null,
    source_table: input.source_table ?? null,
    source_id: input.source_id ?? null,
    area: input.area?.trim() || '창원 상권',
    title: input.title.trim(),
    detail: input.detail?.trim() || null,
    geofence_id: input.geofence_id ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    radius_m: input.radius_m ?? null,
    metadata: input.metadata ?? {},
    visibility: input.visibility ?? 'public',
  };

  const { data, error } = await sb
    .from('activity_events')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}
