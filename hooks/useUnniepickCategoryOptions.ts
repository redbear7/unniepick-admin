'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';

export type UnniepickCategoryOption = {
  value: string;
  label: string;
  emoji: string;
};

const FALLBACK_CATEGORIES = [
  '카페',
  '디저트',
  '한식',
  '중식',
  '일식',
  '양식',
  '분식',
  '술집',
  '미용실',
  '네일샵',
  '의류',
  '헬스/운동',
  '마트/편의점',
  '기타',
];

const CATEGORY_EMOJI_RULES: Array<[string, string]> = [
  ['카페', '☕'],
  ['디저트', '🍰'],
  ['베이커리', '🥐'],
  ['한식', '🍚'],
  ['중식', '🥟'],
  ['일식', '🍣'],
  ['양식', '🍝'],
  ['분식', '🍢'],
  ['술', '🍺'],
  ['바', '🍸'],
  ['미용', '✂️'],
  ['헤어', '✂️'],
  ['네일', '💅'],
  ['의류', '👗'],
  ['패션', '👗'],
  ['헬스', '💪'],
  ['운동', '💪'],
  ['필라테스', '🧘'],
  ['마트', '🛒'],
  ['편의점', '🛒'],
];

const RAW_CATEGORY_ALIASES: Array<[string, string]> = [
  ['카페', '카페'],
  ['베이커리', '디저트'],
  ['제과', '디저트'],
  ['디저트', '디저트'],
  ['한식', '한식'],
  ['중식', '중식'],
  ['일식', '일식'],
  ['양식', '양식'],
  ['분식', '분식'],
  ['주점', '술집'],
  ['술집', '술집'],
  ['호프', '술집'],
  ['바', '술집'],
  ['미용실', '미용실'],
  ['헤어', '미용실'],
  ['네일', '네일샵'],
  ['의류', '의류'],
  ['패션', '의류'],
  ['헬스', '헬스/운동'],
  ['운동', '헬스/운동'],
  ['필라테스', '헬스/운동'],
  ['마트', '마트/편의점'],
  ['편의점', '마트/편의점'],
];

export function getCategoryEmoji(label: string | null | undefined) {
  const text = String(label ?? '').trim();
  if (!text) return '🏪';
  for (const [keyword, emoji] of CATEGORY_EMOJI_RULES) {
    if (text.includes(keyword)) return emoji;
  }
  return '🏪';
}

export function matchUnniepickCategory(raw: string, categories: string[]) {
  const normalized = raw.split('>').map(part => part.trim()).filter(Boolean).reverse();

  for (const part of normalized) {
    const exact = categories.find(category => category === part);
    if (exact) return exact;
  }

  for (const part of normalized) {
    const fuzzy = categories.find(category => part.includes(category) || category.includes(part));
    if (fuzzy) return fuzzy;
  }

  for (const part of normalized) {
    for (const [keyword, mapped] of RAW_CATEGORY_ALIASES) {
      if (part.includes(keyword)) {
        return categories.find(category => category === mapped) ?? mapped;
      }
    }
  }

  return categories[0] ?? '기타';
}

export function useUnniepickCategoryOptions() {
  const [sb] = useState(() => createClient());
  const [liveCategories, setLiveCategories] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const PAGE = 1000;
      const all: string[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await sb
          .from('restaurants')
          .select('unniepick_category')
          .not('unniepick_category', 'is', null)
          .range(from, from + PAGE - 1);

        if (error || !data || data.length === 0) break;

        all.push(
          ...(data
            .map(row => String((row as { unniepick_category?: string | null }).unniepick_category ?? '').trim())
            .filter(Boolean)),
        );

        if (data.length < PAGE) break;
        from += PAGE;
      }

      if (!alive) return;

      const counts = new Map<string, number>();
      for (const value of all) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }

      const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .map(([value]) => value);

      setLiveCategories(sorted);
    };

    load();

    const channel = sb.channel('unniepick-category-options')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        load();
      })
      .subscribe();

    return () => {
      alive = false;
      sb.removeChannel(channel);
    };
  }, [sb]);

  const options = useMemo(() => {
    const merged = [...liveCategories];
    for (const fallback of FALLBACK_CATEGORIES) {
      if (!merged.includes(fallback)) merged.push(fallback);
    }
    return merged.map((value) => ({
      value,
      label: value,
      emoji: getCategoryEmoji(value),
    })) satisfies UnniepickCategoryOption[];
  }, [liveCategories]);

  return { options, loading: liveCategories.length === 0 };
}
