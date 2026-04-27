'use client';

/**
 * RecommendFeed — 나만의 추천맛집
 *
 * - 카카오/네이버 업체 검색 → 메뉴 정보(DB 있으면 자동, 없으면 직접 입력) → 추천글 작성
 * - 추천글 좋아요 · 공유
 * - 댓글 + 댓글 좋아요
 * - 비로그인 = 읽기 전용, 좋아요/작성은 전화번호 로그인 유도
 */

import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

// ── 타입 ──────────────────────────────────────────────────────
interface MenuItem  { name: string; price: string }
interface Comment   { id: string; user_display: string; content: string; like_count: number; created_at: string; myLiked?: boolean }
interface Rec {
  id: string;
  user_display: string;
  place_name: string;
  place_category: string;
  place_address: string;
  place_image_url?: string;
  menu_items: MenuItem[];
  recommendation_text: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  myLiked?: boolean;
}
interface PlaceResult {
  kakao_id?: string;
  naver_id?: string;
  place_name: string;
  category: string;
  address: string;
  road_address?: string;
  phone?: string;
  place_url?: string;
  source?: 'kakao' | 'naver';
}

// ── 유틸 ─────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

async function getToken(): Promise<string | null> {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

// ── 가게 검색 훅 ─────────────────────────────────────────────
function usePlaceSearch(source: 'kakao' | 'naver') {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      if (source === 'kakao') {
        const res = await fetch(`/api/kakao-place?q=${encodeURIComponent(q)}&limit=7`);
        const json = await res.json();
        setResults((json.data ?? []).map((p: any) => ({ ...p, source: 'kakao' as const })));
      } else {
        const res = await fetch(`/api/naver-place?q=${encodeURIComponent(q)}&size=7`);
        const json = await res.json();
        setResults((json.places ?? []).map((p: any) => ({ ...p, source: 'naver' as const })));
      }
    } catch { setResults([]); }
    setLoading(false);
  };

  // 소스 변경 시 결과 초기화
  useEffect(() => { setResults([]); }, [source]);

  // 디바운스 자동검색
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(query), 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, source]);

  return { query, setQuery, results, loading, search };
}

// ── 댓글 패널 ────────────────────────────────────────────────
function CommentPanel({ rec, user }: { rec: Rec; user: User | null }) {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [loaded,   setLoaded]       = useState(false);
  const [open,     setOpen]         = useState(false);
  const [text,     setText]         = useState('');
  const [sending,  setSending]      = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/recommendations/${rec.id}/comments`);
    const json = await res.json();
    setComments(json.data ?? []);
    setLoaded(true);
  }, [rec.id]);

  const toggle = () => {
    if (!open && !loaded) load();
    setOpen(v => !v);
  };

  const submit = async () => {
    if (!text.trim() || sending) return;
    const token = await getToken();
    if (!token) { alert('로그인이 필요합니다'); return; }
    setSending(true);
    const res = await fetch(`/api/recommendations/${rec.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: text.trim() }),
    });
    const json = await res.json();
    if (json.data) { setComments(p => [...p, json.data]); setText(''); }
    setSending(false);
  };

  const likeComment = async (cmt: Comment) => {
    const token = await getToken();
    if (!token) { alert('로그인이 필요합니다'); return; }
    const res = await fetch(`/api/recommendations/${rec.id}/comments/${cmt.id}/like`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setComments(p => p.map(c =>
      c.id === cmt.id ? { ...c, like_count: json.like_count, myLiked: json.liked } : c,
    ));
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={toggle} style={btnGhost}>
        💬 댓글 {rec.comment_count > 0 ? rec.comment_count : ''} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {comments.map(c => (
            <div key={c.id} style={cmtItem}>
              <div style={{ flex: 1 }}>
                <span style={cmtUser}>{c.user_display}</span>
                <span style={cmtTime}> · {timeAgo(c.created_at)}</span>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#333' }}>{c.content}</p>
              </div>
              <button onClick={() => likeComment(c)} style={btnLikeSm}>
                {c.myLiked ? '❤️' : '🤍'} {c.like_count > 0 ? c.like_count : ''}
              </button>
            </div>
          ))}

          {user ? (
            <div style={cmtInputRow}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="댓글을 남겨보세요..."
                style={cmtInput}
                maxLength={200}
              />
              <button onClick={submit} disabled={sending} style={btnSubmit}>
                {sending ? '...' : '등록'}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>댓글을 쓰려면 로그인하세요.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── 추천 카드 ────────────────────────────────────────────────
function RecCard({ rec: initRec, user }: { rec: Rec; user: User | null }) {
  const [rec, setRec] = useState(initRec);

  const like = async () => {
    const token = await getToken();
    if (!token) { alert('좋아요는 로그인 후 이용해주세요 😊'); return; }
    const res  = await fetch(`/api/recommendations/${rec.id}/like`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setRec(p => ({ ...p, like_count: json.like_count, myLiked: json.liked }));
  };

  const share = async () => {
    const text = `[언니픽 추천맛집] ${rec.place_name}\n${rec.recommendation_text}\n\nhttps://unniepick.com/app`;
    if (navigator.share) {
      await navigator.share({ title: `${rec.place_name} 추천`, text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      alert('링크가 복사되었습니다!');
    }
  };

  return (
    <div style={card}>
      {/* 헤더 */}
      <div style={cardHead}>
        <div style={placeEmoji}>{getCategoryEmoji(rec.place_category)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={placeName}>{rec.place_name}</div>
          <div style={placeMeta}>{rec.place_category} {rec.place_address ? `· ${rec.place_address.slice(0, 20)}...` : ''}</div>
        </div>
        <div style={cardTime}>{timeAgo(rec.created_at)}</div>
      </div>

      {/* 메뉴 정보 */}
      {rec.menu_items?.length > 0 && (
        <div style={menuWrap}>
          {rec.menu_items.slice(0, 4).map((m, i) => (
            <div key={i} style={menuItem}>
              <span style={menuName}>{m.name}</span>
              {m.price && <span style={menuPrice}>{m.price}</span>}
            </div>
          ))}
          {rec.menu_items.length > 4 && (
            <div style={{ ...menuItem, color: '#aaa', fontSize: 11 }}>
              +{rec.menu_items.length - 4}개 더
            </div>
          )}
        </div>
      )}

      {/* 추천사 */}
      {rec.recommendation_text && (
        <p style={recText}>💬 &ldquo;{rec.recommendation_text}&rdquo;</p>
      )}

      {/* 추천자 */}
      <div style={cardAuthor}>{rec.user_display} 님의 추천</div>

      {/* 액션 버튼 */}
      <div style={actionRow}>
        <button onClick={like} style={btnLike(rec.myLiked)}>
          {rec.myLiked ? '❤️' : '🤍'} 좋아요 {rec.like_count > 0 ? rec.like_count : ''}
        </button>
        <button onClick={share} style={btnGhost}>📤 공유</button>
        <CommentPanel rec={rec} user={user} />
      </div>
    </div>
  );
}

// ── 이미지 리사이즈 ───────────────────────────────────────────
async function resizeToBlob(file: File, maxPx = 1024, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = objUrl;
  });
}

// ── 추천 작성 모달 ────────────────────────────────────────────
function AddModal({ user, onClose, onAdded }: {
  user: User;
  onClose: () => void;
  onAdded: (rec: Rec) => void;
}) {
  const [searchSource, setSearchSource] = useState<'naver' | 'kakao'>('naver');
  const { query, setQuery, results, loading, search } = usePlaceSearch(searchSource);
  const [inputVal,     setInputVal]     = useState('');
  const [selected,     setSelected]     = useState<PlaceResult | null>(null);
  const [menuItems,    setMenuItems]    = useState<MenuItem[]>([]);
  const [newMenu,      setNewMenu]      = useState({ name: '', price: '' });
  const [recText,      setRecText]      = useState('');
  const [saving,       setSaving]       = useState(false);
  const [step,         setStep]         = useState<'search' | 'edit'>('search');
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const NAVER_GREEN = '#03C75A';
  const KAKAO_YELLOW = '#FEE500';

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // DB에서 해당 가게 메뉴 정보 자동 조회
  const fetchMenuFromDB = useCallback(async (placeName: string) => {
    try {
      const res = await fetch(`/api/restaurants?search=${encodeURIComponent(placeName)}&limit=1`);
      const json = await res.json();
      const r = json.data?.[0];
      if (r?.menu_items?.length) {
        setMenuItems(r.menu_items.map((m: any) => ({
          name:  m.name ?? '',
          price: m.price ?? '',
        })));
      }
    } catch {}
  }, []);

  const selectPlace = (place: PlaceResult) => {
    setSelected(place);
    setStep('edit');
    fetchMenuFromDB(place.place_name);
  };

  const addMenuItem = () => {
    if (!newMenu.name.trim()) return;
    setMenuItems(p => [...p, { name: newMenu.name.trim(), price: newMenu.price.trim() }]);
    setNewMenu({ name: '', price: '' });
  };

  const submit = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const token = await getToken();
    if (!token) { alert('로그인 세션이 만료되었습니다.'); setSaving(false); return; }

    // 이미지 업로드 (실패해도 계속)
    let imageUrl: string | undefined;
    if (photoFile) {
      try {
        const blob = await resizeToBlob(photoFile);
        const sb = createClient();
        const { data: { session } } = await sb.auth.getSession();
        const uid = session?.user?.id ?? 'anon';
        const filename = `${uid}/${Date.now()}.jpg`;
        const { error: upErr } = await sb.storage
          .from('rec-images')
          .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
        if (!upErr) {
          const { data: { publicUrl } } = sb.storage.from('rec-images').getPublicUrl(filename);
          imageUrl = publicUrl;
        }
      } catch { /* 이미지 없이 진행 */ }
    }

    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        place_id:            selected.kakao_id ?? selected.naver_id ?? selected.place_name,
        place_name:          selected.place_name,
        place_category:      selected.category,
        place_address:       selected.road_address ?? selected.address,
        place_image_url:     imageUrl,
        source:              selected.source ?? searchSource,
        menu_items:          menuItems,
        recommendation_text: recText.trim(),
      }),
    });
    const json = await res.json();
    if (json.data) {
      onAdded(json.data);
      if (json.points_earned) {
        setPointsEarned(json.points_earned);
        setTimeout(() => onClose(), 2400);
      } else {
        onClose();
      }
    } else {
      alert(json.error ?? '저장에 실패했습니다');
      setSaving(false);
    }
  };

  const sourceColor = searchSource === 'naver' ? NAVER_GREEN : '#3A1D96';

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modal, position: 'relative', overflow: 'hidden' }}>
        {/* 닫기 버튼 */}
        <button onClick={onClose} style={{ ...btnClose, position: 'absolute', top: 20, right: 20 }}>✕</button>

        {/* 포인트 획득 축하 오버레이 */}
        {pointsEarned && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.97)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: 20, zIndex: 99 }}>
            <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>🎉</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#FF6F0F', marginBottom: 8 }}>
              +{pointsEarned} 포인트!
            </div>
            <div style={{ fontSize: 15, color: '#6B7684', marginBottom: 4 }}>추천글이 등록됐어요</div>
            <div style={{ fontSize: 13, color: '#ADB5BD' }}>잠시 후 닫힙니다...</div>
          </div>
        )}

        {step === 'search' ? (
          <>
            {/* 헤더 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#191F28', margin: '0 0 6px', lineHeight: 1.3 }}>
                언니픽에 나만의<br />추천맛집을 자랑해보세요!
              </h2>
              <p style={{ fontSize: 13, color: '#8B95A1', margin: '0 0 4px' }}>
                사진을 함께 등록하면 랜덤 포인트가 지급됩니다 🎁
              </p>
              <p style={{ fontSize: 12, color: '#ADB5BD', margin: 0 }}>
                하루 최대 10개 작성 가능
              </p>
            </div>

            {/* 소스 탭 */}
            <div style={{ display: 'flex', background: '#F2F4F6', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 }}>
              {([
                { key: 'naver' as const, label: '네이버', color: NAVER_GREEN },
                { key: 'kakao' as const, label: '카카오', color: KAKAO_YELLOW },
              ]).map(s => (
                <button key={s.key} onClick={() => { setSearchSource(s.key); setInputVal(''); setQuery(''); }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s',
                    background: searchSource === s.key ? s.color : 'transparent',
                    color: searchSource === s.key
                      ? (s.key === 'kakao' ? '#3A1D96' : '#fff')
                      : '#8B95A1',
                    boxShadow: searchSource === s.key ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* 검색 입력 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                background: '#F7F8FA', borderRadius: 12, padding: '0 14px',
                border: '1.5px solid #E5E8EB' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: sourceColor, flexShrink: 0 }} />
                <input
                  value={inputVal}
                  onChange={e => { setInputVal(e.target.value); setQuery(e.target.value); }}
                  onKeyDown={e => e.key === 'Enter' && search(inputVal)}
                  placeholder="가게 이름 또는 주소로 검색"
                  style={{ flex: 1, height: 44, border: 'none', outline: 'none',
                    background: 'transparent', fontSize: 14, fontFamily: 'inherit', color: '#191F28' }}
                  autoFocus
                />
              </div>
              <button onClick={() => search(inputVal)}
                style={{ width: 52, height: 52, borderRadius: 12, border: 'none',
                  background: sourceColor, color: searchSource === 'kakao' ? '#3A1D96' : '#fff',
                  fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 8px ${sourceColor}44` }}>
                🔍
              </button>
            </div>

            {/* 결과 */}
            {loading && <div style={hint}>검색 중...</div>}
            {results.map((p, i) => (
              <div key={i} onClick={() => selectPlace(p)} style={searchResult}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: p.source === 'naver' ? '#E8F9EE' : '#FFF9C4',
                    color: p.source === 'naver' ? NAVER_GREEN : '#8B6914' }}>
                    {p.source === 'naver' ? 'N' : 'K'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.place_name}</span>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {p.category}{p.category && ' · '}{p.road_address ?? p.address}
                </div>
              </div>
            ))}
            {inputVal.length >= 2 && !loading && results.length === 0 && (
              <div style={hint}>검색 결과가 없습니다</div>
            )}
          </>
        ) : (
          <>
            <div style={modalHead}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>🍽️ 추천글 작성</span>
            </div>

            {/* 선택된 가게 */}
            <div style={selectedPlace}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: selected?.source === 'naver' ? '#E8F9EE' : '#FFF9C4',
                  color: selected?.source === 'naver' ? NAVER_GREEN : '#8B6914' }}>
                  {selected?.source === 'naver' ? 'NAVER' : 'KAKAO'}
                </span>
                <span style={{ fontWeight: 800 }}>{selected!.place_name}</span>
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>{selected!.category} · {selected!.road_address ?? selected!.address}</div>
              <button onClick={() => { setSelected(null); setStep('search'); setMenuItems([]); setPhotoFile(null); setPhotoPreview(null); }} style={btnChangePlace}>
                가게 변경
              </button>
            </div>

            {/* 사진 업로드 */}
            <div style={sectionLabel}>📷 사진 (선택, 자동 리사이즈)</div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={handlePhotoChange} />
            {photoPreview ? (
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <img src={photoPreview} alt="preview"
                  style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26,
                    borderRadius: '50%', background: 'rgba(0,0,0,.5)', color: '#fff',
                    border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%', height: 80, borderRadius: 10, border: '1.5px dashed #D1D5DB',
                  background: '#F9FAFB', color: '#8B95A1', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                📷 사진 추가
              </button>
            )}

            {/* 메뉴 정보 */}
            <div style={sectionLabel}>🍽️ 메뉴 정보</div>
            {menuItems.length === 0 && (
              <div style={hint}>DB에 메뉴 정보가 없어요. 직접 입력해주세요.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {menuItems.map((m, i) => (
                <div key={i} style={menuEditRow}>
                  <span style={{ fontSize: 13 }}>{m.name} {m.price && <span style={{ color: '#FF6F0F' }}>{m.price}</span>}</span>
                  <button onClick={() => setMenuItems(p => p.filter((_, j) => j !== i))} style={btnDel}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input value={newMenu.name}  onChange={e => setNewMenu(p => ({ ...p, name: e.target.value }))}
                placeholder="메뉴명" style={{ ...inputHalf, flex: 2 }} />
              <input value={newMenu.price} onChange={e => setNewMenu(p => ({ ...p, price: e.target.value }))}
                placeholder="가격 (예: 8,000원)" style={{ ...inputHalf, flex: 2 }} />
              <button onClick={addMenuItem} style={btnAdd}>추가</button>
            </div>

            {/* 추천사 */}
            <div style={sectionLabel}>✏️ 추천 한마디</div>
            <textarea
              value={recText}
              onChange={e => setRecText(e.target.value)}
              placeholder="이 가게를 추천하는 이유를 써주세요 (선택)"
              style={textarea}
              rows={3}
              maxLength={200}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#aaa', marginBottom: 12 }}>{recText.length}/200</div>

            <button onClick={submit} disabled={saving} style={btnPrimary}>
              {saving ? '등록 중...' : '🎉 추천글 올리기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function RecommendFeed({ compact = false }: { compact?: boolean }) {
  const [user,     setUser]     = useState<User | null>(null);
  const [recs,     setRecs]     = useState<Rec[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [showAdd,  setShowAdd]  = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [phone,    setPhone]    = useState('');
  const [otp,      setOtp]      = useState('');
  const [authStep, setAuthStep] = useState<'phone' | 'otp'>('phone');
  const [authLoad, setAuthLoad] = useState(false);

  const LIMIT = 6;

  // 인증 상태 구독
  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 추천 목록 로드
  const loadRecs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recommendations?page=${p}&limit=${LIMIT}`);
      const json = await res.json();
      if (p === 1) setRecs(json.data ?? []);
      else setRecs(prev => [...prev, ...(json.data ?? [])]);
      setTotal(json.total ?? 0);
      setPage(p);
    } catch {
      if (p === 1) setRecs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRecs(1); }, [loadRecs]);

  const onAdded = (rec: Rec) => setRecs(p => [rec, ...p]);

  // 전화번호 로그인 (OTP)
  const toE164 = (p: string) => '+82' + p.replace(/\D/g,'').slice(1);

  const sendOtp = async () => {
    setAuthLoad(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithOtp({ phone: toE164(phone) });
    if (error) { alert(error.message); } else { setAuthStep('otp'); }
    setAuthLoad(false);
  };

  const verifyOtp = async () => {
    setAuthLoad(true);
    const sb = createClient();
    const { error } = await sb.auth.verifyOtp({ phone: toE164(phone), token: otp, type: 'sms' });
    if (error) { alert(error.message); } else { setAuthOpen(false); setAuthStep('phone'); setPhone(''); setOtp(''); }
    setAuthLoad(false);
  };

  const wrapStyle: React.CSSProperties = compact
    ? { maxWidth: '100%', margin: 0, padding: '16px 16px 24px' }
    : sectionWrap;

  return (
    <section style={wrapStyle}>
      {/* 헤더 */}
      <div style={sectionHead}>
        <div>
          <div style={labelTag}>🏆 언니픽 커뮤니티</div>
          <h2 style={sectionTitle}>나만의 추천맛집</h2>
          <p style={sectionDesc}>동네 이웃들이 직접 추천하는 숨은 맛집을 발견하세요</p>
        </div>
        <button
          onClick={() => user ? setShowAdd(true) : setAuthOpen(true)}
          style={btnWrite}
        >
          ✏️ 추천 올리기
        </button>
      </div>

      {/* 피드 */}
      {loading && recs.length === 0 ? (
        <div style={skeletons}>
          {[0,1,2].map(i => <div key={i} style={skeleton} />)}
        </div>
      ) : recs.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>아직 추천이 없어요</div>
          <div style={{ fontSize: 13, color: '#aaa' }}>첫 번째 추천자가 되어보세요!</div>
        </div>
      ) : (
        <div style={feedGrid}>
          {recs.map(r => <RecCard key={r.id} rec={r} user={user} />)}
        </div>
      )}

      {/* 더 보기 */}
      {recs.length < total && !loading && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => loadRecs(page + 1)} style={btnMore}>
            더 보기 ({recs.length}/{total})
          </button>
        </div>
      )}

      {/* 추천 작성 모달 */}
      {showAdd && user && (
        <AddModal user={user} onClose={() => setShowAdd(false)} onAdded={onAdded} />
      )}

      {/* 로그인 모달 */}
      {authOpen && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && setAuthOpen(false)}>
          <div style={{ ...modal, maxWidth: 360 }}>
            <div style={modalHead}>
              <span style={{ fontWeight: 800 }}>📱 로그인</span>
              <button onClick={() => setAuthOpen(false)} style={btnClose}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              추천 등록 · 좋아요 · 댓글을 이용하려면 전화번호 인증이 필요해요.
            </p>
            {authStep === 'phone' ? (
              <>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000" style={inputFull} type="tel" />
                <button onClick={sendOtp} disabled={authLoad} style={{ ...btnPrimary, marginTop: 12 }}>
                  {authLoad ? '전송 중...' : '인증번호 받기'}
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{phone}으로 전송된 6자리 인증번호를 입력하세요.</p>
                <input value={otp} onChange={e => setOtp(e.target.value)}
                  placeholder="인증번호 6자리" style={inputFull} maxLength={6} />
                <button onClick={verifyOtp} disabled={authLoad} style={{ ...btnPrimary, marginTop: 12 }}>
                  {authLoad ? '확인 중...' : '확인'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── 카테고리 이모지 ───────────────────────────────────────────
function getCategoryEmoji(cat?: string): string {
  const c = (cat ?? '').toLowerCase();
  if (c.includes('카페') || c.includes('커피')) return '☕';
  if (c.includes('한식'))                        return '🍚';
  if (c.includes('고기') || c.includes('육'))   return '🍖';
  if (c.includes('치킨'))                        return '🍗';
  if (c.includes('중식'))                        return '🍜';
  if (c.includes('일식'))                        return '🍱';
  if (c.includes('양식') || c.includes('피자')) return '🍕';
  if (c.includes('베이커리') || c.includes('빵')) return '🥐';
  if (c.includes('분식'))                        return '🥢';
  return '🍽️';
}

// ── 스타일 (인라인 CSS-in-JS) ────────────────────────────────
const sectionWrap: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '60px 20px',
};
const sectionHead: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
  marginBottom: 28, flexWrap: 'wrap', gap: 12,
};
const labelTag: React.CSSProperties = {
  display: 'inline-block',
  background: 'linear-gradient(135deg,#FF6F0F,#FF9A3D)',
  color: '#fff',
  borderRadius: 20,
  padding: '4px 14px',
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 8,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 28, fontWeight: 900, color: '#191F28',
  margin: '0 0 6px', letterSpacing: -0.5,
};
const sectionDesc: React.CSSProperties = {
  fontSize: 15, color: '#6B7684', margin: 0,
};
const btnWrite: React.CSSProperties = {
  background: 'linear-gradient(135deg,#FF6F0F,#FF9A3D)',
  color: '#fff', border: 'none', borderRadius: 12,
  padding: '12px 22px', fontWeight: 800, fontSize: 14,
  cursor: 'pointer', whiteSpace: 'nowrap',
  boxShadow: '0 4px 16px rgba(255,111,15,0.3)',
};
const feedGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 16,
};
const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #EAECEF',
  padding: '16px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
};
const cardHead: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
};
const placeEmoji: React.CSSProperties = {
  fontSize: 28,
  width: 46, height: 46,
  background: '#FFF3EB',
  borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};
const placeName: React.CSSProperties = {
  fontWeight: 800, fontSize: 15, color: '#191F28',
  marginBottom: 2, lineHeight: 1.3,
};
const placeMeta: React.CSSProperties = {
  fontSize: 12, color: '#8B95A1',
};
const cardTime: React.CSSProperties = {
  fontSize: 11, color: '#ADB5BD', flexShrink: 0,
};
const menuWrap: React.CSSProperties = {
  background: '#F9FAFB', borderRadius: 8,
  padding: '8px 12px', marginBottom: 10,
  display: 'flex', flexWrap: 'wrap', gap: '4px 12px',
};
const menuItem: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center', fontSize: 12,
};
const menuName: React.CSSProperties = { color: '#333', fontWeight: 600 };
const menuPrice: React.CSSProperties = { color: '#FF6F0F', fontWeight: 700 };
const recText: React.CSSProperties = {
  fontSize: 13, color: '#4E5968', lineHeight: 1.6,
  margin: '0 0 8px', fontStyle: 'italic',
};
const cardAuthor: React.CSSProperties = {
  fontSize: 11, color: '#ADB5BD', marginBottom: 8,
};
const actionRow: React.CSSProperties = {
  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
  borderTop: '1px solid #F2F4F6', paddingTop: 8,
};
const btnLike = (active?: boolean): React.CSSProperties => ({
  background: active ? '#FFF3EB' : '#F9FAFB',
  color: active ? '#FF6F0F' : '#6B7684',
  border: `1px solid ${active ? '#FFB07A' : '#EAECEF'}`,
  borderRadius: 8, padding: '5px 12px', fontSize: 12,
  fontWeight: 700, cursor: 'pointer',
});
const btnGhost: React.CSSProperties = {
  background: 'none', border: '1px solid #EAECEF',
  borderRadius: 8, padding: '5px 12px',
  fontSize: 12, color: '#6B7684', cursor: 'pointer',
};
const cmtItem: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 0',
  borderBottom: '1px solid #F2F4F6', alignItems: 'flex-start',
};
const cmtUser: React.CSSProperties = { fontWeight: 700, fontSize: 12, color: '#333' };
const cmtTime: React.CSSProperties = { fontSize: 11, color: '#aaa' };
const cmtInputRow: React.CSSProperties = {
  display: 'flex', gap: 6, marginTop: 8,
};
const cmtInput: React.CSSProperties = {
  flex: 1, border: '1px solid #EAECEF', borderRadius: 8,
  padding: '7px 10px', fontSize: 13,
  outline: 'none',
};
const btnSubmit: React.CSSProperties = {
  background: '#FF6F0F', color: '#fff',
  border: 'none', borderRadius: 8,
  padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const btnLikeSm: React.CSSProperties = {
  background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 12, color: '#888', flexShrink: 0,
};
const skeletons: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16,
};
const skeleton: React.CSSProperties = {
  height: 160, borderRadius: 16, background: '#EAECEF',
  animation: 'pulse 1.5s ease-in-out infinite',
};
const empty: React.CSSProperties = {
  textAlign: 'center', padding: '60px 0', color: '#6B7684',
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 20,
  padding: 24, width: '100%', maxWidth: 480,
  maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
const modalHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', marginBottom: 16,
};
const modalSub: React.CSSProperties = { fontSize: 13, color: '#888', marginBottom: 12 };
const btnClose: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#aaa',
};
const inputFull: React.CSSProperties = {
  width: '100%', border: '1px solid #EAECEF', borderRadius: 10,
  padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const searchResult: React.CSSProperties = {
  padding: '10px 12px', borderBottom: '1px solid #F2F4F6',
  cursor: 'pointer', borderRadius: 8,
};
const hint: React.CSSProperties = {
  fontSize: 13, color: '#aaa', padding: '8px 0',
};
const selectedPlace: React.CSSProperties = {
  background: '#FFF3EB', borderRadius: 10, padding: '10px 14px',
  marginBottom: 14, border: '1px solid #FFB07A', position: 'relative',
};
const btnChangePlace: React.CSSProperties = {
  position: 'absolute', top: 8, right: 10,
  background: 'none', border: '1px solid #FFB07A',
  borderRadius: 6, padding: '2px 8px', fontSize: 11,
  cursor: 'pointer', color: '#FF6F0F', fontWeight: 600,
};
const sectionLabel: React.CSSProperties = {
  fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#333',
};
const menuEditRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  background: '#F9FAFB', borderRadius: 6, padding: '5px 10px',
};
const btnDel: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#aaa', fontSize: 13,
};
const inputHalf: React.CSSProperties = {
  border: '1px solid #EAECEF', borderRadius: 8,
  padding: '8px 10px', fontSize: 13, outline: 'none',
};
const btnAdd: React.CSSProperties = {
  background: '#FF6F0F', color: '#fff', border: 'none',
  borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const textarea: React.CSSProperties = {
  width: '100%', border: '1px solid #EAECEF', borderRadius: 10,
  padding: '10px 14px', fontSize: 13, outline: 'none',
  resize: 'vertical', boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  width: '100%', background: 'linear-gradient(135deg,#FF6F0F,#FF9A3D)',
  color: '#fff', border: 'none', borderRadius: 12,
  padding: '13px', fontWeight: 800, fontSize: 15, cursor: 'pointer',
};
const btnMore: React.CSSProperties = {
  background: '#F9FAFB', border: '1px solid #EAECEF',
  borderRadius: 10, padding: '10px 28px',
  fontSize: 14, fontWeight: 700, color: '#4E5968', cursor: 'pointer',
};
