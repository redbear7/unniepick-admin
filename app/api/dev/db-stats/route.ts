import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// 주요 테이블 목록
const TABLES = [
  'stores', 'users', 'owner_pins', 'music_tracks', 'playlists',
  'playlist_tracks', 'coupons', 'store_posts', 'post_delete_requests',
  'store_announcements', 'fish_voices', 'notices',
];

// Storage 버킷 목록
const BUCKETS = ['music-tracks', 'store-images', 'tts-audio'];

export async function GET() {
  const client = sb();

  // 테이블 row 수 병렬 조회
  const tableCounts = await Promise.all(
    TABLES.map(async (t) => {
      const { count, error } = await client
        .from(t)
        .select('*', { count: 'exact', head: true });
      return { table: t, count: error ? null : (count ?? 0) };
    }),
  );

  // Storage 버킷별 파일 수 + 총 용량
  const bucketStats = await Promise.all(
    BUCKETS.map(async (bucket) => {
      try {
        // list with limit — recursive size 계산
        const { data, error } = await client.storage.from(bucket).list('', {
          limit: 1000,
          offset: 0,
        });
        if (error || !data) return { bucket, files: 0, bytes: 0 };
        const files = data.filter(f => f.id); // 폴더 제외
        const bytes = files.reduce((s, f) => s + (f.metadata?.size ?? 0), 0);
        return { bucket, files: files.length, bytes };
      } catch {
        return { bucket, files: 0, bytes: 0 };
      }
    }),
  );

  return NextResponse.json({ tables: tableCounts, buckets: bucketStats });
}
