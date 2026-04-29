'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import ApplyModal from '@/components/ApplyModal';
import RecommendFeed from '@/components/RecommendFeed';

declare global {
  interface Window { kakao: any; __selectStore: (id: number) => void; }
}

/* ──────────────────────────────────────────────────────────────── */
/* Constants                                                         */
/* ──────────────────────────────────────────────────────────────── */
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '1e8def4aebde26a40dbdfe38bf42db24';
const DEFAULT_LAT  = 35.2279;
const DEFAULT_LNG  = 128.6811;

/* ──────────────────────────────────────────────────────────────── */
/* Types & Mock Data                                                 */
/* ──────────────────────────────────────────────────────────────── */
interface StoreItem {
  id: number; name: string; emoji: string; cat: string;
  lat: number; lng: number; coupon: string; timesale: boolean; dist: string;
}
interface AiResult {
  rank: number; name: string; cat: string; rating: number; reviews: number;
  why: string; coupon?: { disc: string; title: string; desc: string };
}
const MOCK_STORES: StoreItem[] = [
  { id:1,  name:'빈스커피 상남점', emoji:'☕', cat:'cafe',    lat:35.2295, lng:128.6838, coupon:'아메리카노 500원 할인', timesale:false, dist:'143m' },
  { id:2,  name:'헤어스튜디오K',   emoji:'✂️', cat:'beauty',  lat:35.2308, lng:128.6875, coupon:'커트 20% 할인',        timesale:false, dist:'380m' },
  { id:3,  name:'청담국수',        emoji:'🍜', cat:'food',    lat:35.2278, lng:128.6845, coupon:'점심 런치 30% 할인',   timesale:true,  dist:'210m' },
  { id:4,  name:'힐링스파',        emoji:'💆', cat:'health',  lat:35.2322, lng:128.6820, coupon:'1만원 할인',           timesale:false, dist:'620m' },
  { id:5,  name:'도시락공방',      emoji:'🍱', cat:'snack',   lat:35.2265, lng:128.6855, coupon:'런치세트 2+1',         timesale:true,  dist:'255m' },
  { id:6,  name:'네일팝',          emoji:'💅', cat:'beauty',  lat:35.2312, lng:128.6842, coupon:'젤네일 25% 할인',      timesale:true,  dist:'400m' },
  { id:7,  name:'스터디룸플러스',  emoji:'📚', cat:'etc',     lat:35.2301, lng:128.6828, coupon:'1시간 무료 이용',      timesale:false, dist:'350m' },
  { id:8,  name:'모카팩토리',      emoji:'🧋', cat:'cafe',    lat:35.2275, lng:128.6892, coupon:'버블티 2+1',           timesale:false, dist:'520m' },
  { id:9,  name:'피자마루 상남',   emoji:'🍕', cat:'food',    lat:35.2288, lng:128.6870, coupon:'저녁 피자 20% 할인',   timesale:true,  dist:'470m' },
  { id:10, name:'굿바디피트니스',  emoji:'💪', cat:'fitness', lat:35.2340, lng:128.6850, coupon:'1일 무료 체험',        timesale:false, dist:'880m' },
];

const PICK_POOL = [
  { icon:'☕',  text:'아메리카노 500원 할인' },
  { icon:'✂️',  text:'헤어샵 할인쿠폰' },
  { icon:'🍽️', text:'점심 타임세일 맛집' },
  { icon:'💅',  text:'젤네일 할인' },
  { icon:'💆',  text:'마사지 스파 쿠폰' },
  { icon:'🧋',  text:'버블티 2+1' },
  { icon:'🍕',  text:'저녁 피자 20% 할인' },
  { icon:'📚',  text:'스터디카페 1시간 무료' },
  { icon:'🍜',  text:'혼밥 국수 가성비' },
  { icon:'💰',  text:'1만원 이하 가성비 점심' },
  { icon:'🌸',  text:'진해 벚꽃 분위기 카페' },
  { icon:'💪',  text:'헬스장 1일 체험 무료' },
  { icon:'🐾',  text:'반려견 동반 카페' },
  { icon:'🍱',  text:'런치 도시락 세트 할인' },
  { icon:'🍣',  text:'회식 고기집 단체 할인' },
  { icon:'🎯',  text:'상남동 데이트 코스' },
  { icon:'🧖',  text:'왁싱 샵 신규 할인' },
  { icon:'🥐',  text:'오전 베이커리 1+1' },
  { icon:'🍦',  text:'디저트 카페 스탬프' },
  { icon:'🏊',  text:'수영장 첫 방문 할인' },
];

const CATEGORIES = [
  { key:'all',     label:'전체',     emoji:'🗺️' },
  { key:'cafe',    label:'카페',     emoji:'☕' },
  { key:'food',    label:'음식점',   emoji:'🍽️' },
  { key:'snack',   label:'분식·간식', emoji:'🥢' },
  { key:'beauty',  label:'뷰티·미용', emoji:'💅' },
  { key:'health',  label:'병원·건강', emoji:'🏥' },
  { key:'fitness', label:'피트니스', emoji:'💪' },
  { key:'shop',    label:'쇼핑',     emoji:'🛍️' },
  { key:'pet',     label:'반려동물', emoji:'🐾' },
  { key:'etc',     label:'기타',     emoji:'✨' },
  { key:'value',   label:'가성비픽', emoji:'💰' },
];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/* ──────────────────────────────────────────────────────────────── */
/* Main Page                                                         */
/* ──────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const kakaoMapRef     = useRef<any>(null);
  const myLocOverlay    = useRef<any>(null);
  const storeOverlays   = useRef<{ id: number; overlay: any }[]>([]);
  const toastTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [locText,        setLocText]        = useState('위치 확인 중...');
  const [activeCat,      setActiveCat]      = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchDropOpen, setSearchDropOpen] = useState(false);
  const [locDropOpen,    setLocDropOpen]    = useState(false);
  const [randomPicks,    setRandomPicks]    = useState<typeof PICK_POOL>([]);
  const [searchTab,      setSearchTab]      = useState<'popular'|'recent'>('popular');
  const [toastMsg,       setToastMsg]       = useState('');
  const [toastVis,       setToastVis]       = useState(false);
  const [displayStores,  setDisplayStores]  = useState(MOCK_STORES);
  const [selectedId,     setSelectedId]     = useState<number|null>(null);

  const [aiStage,   setAiStage]   = useState<'idle'|'parsing'|'searching'|'ranking'|'done'>('idle');
  const [aiFilter,  setAiFilter]  = useState<{ chips:{text:string;color:string}[]; intent:string }|null>(null);
  const [aiCount,   setAiCount]   = useState(0);
  const [aiResults, setAiResults] = useState<AiResult[]>([]);

  const [leftTab, setLeftTab] = useState<'stores'|'recommend'>('stores');

  /* ── Auth ───────────────────────────────────────────── */
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMenuOpen,  setAuthMenuOpen]  = useState(false);
  const [applyOpen,     setApplyOpen]     = useState(false);
  const [authStep,      setAuthStep]      = useState<'phone'|'otp'>('phone');
  const [authPhone,     setAuthPhone]     = useState('');
  const [authOtp,       setAuthOtp]       = useState('');
  const [authLoading,   setAuthLoading]   = useState(false);
  const [authError,     setAuthError]     = useState('');
  const [authUser,      setAuthUser]      = useState<{ id: string; nickname?: string } | null>(null);

  /* ── Toast ───────────────────────────────────────────── */
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVis(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVis(false), 2400);
  }, []);

  /* ── Map: 마커 렌더 ─────────────────────────────────── */
  const renderMarkers = useCallback((stores: StoreItem[]) => {
    if (!kakaoMapRef.current || !window.kakao) return;
    storeOverlays.current.forEach(({ overlay }) => overlay.setMap(null));
    storeOverlays.current = [];
    stores.forEach(store => {
      const el = document.createElement('div');
      el.style.cssText = [
        `background:${store.timesale ? 'linear-gradient(135deg,#E53935,#FF7043)' : '#FF6F0F'}`,
        'color:#fff', 'border-radius:20px', 'border:2px solid #fff',
        'padding:5px 10px', 'cursor:pointer',
        'font-size:12px', 'font-weight:800',
        'box-shadow:0 2px 8px rgba(0,0,0,.22)',
        'display:flex', 'align-items:center', 'gap:4px',
        'white-space:nowrap',
        "font-family:'Pretendard Variable',-apple-system,sans-serif",
      ].join(';');
      el.innerHTML = `${store.emoji} ${store.timesale ? '⏰' : '🎟'} ${store.name}`;
      el.addEventListener('click', () => window.__selectStore(store.id));
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(store.lat, store.lng),
        content: el, yAnchor: 1.35,
      });
      overlay.setMap(kakaoMapRef.current);
      storeOverlays.current.push({ id: store.id, overlay });
    });
  }, []);

  /* ── Map: 초기화 ────────────────────────────────────── */
  const initMap = useCallback((lat: number, lng: number) => {
    if (!mapContainerRef.current || !window.kakao?.maps) return;
    if (kakaoMapRef.current) return; // already initialized
    const center = new window.kakao.maps.LatLng(lat, lng);
    const map = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 5 });
    map.addControl(new window.kakao.maps.ZoomControl(), window.kakao.maps.ControlPosition.RIGHT);
    kakaoMapRef.current = map;
    renderMarkers(MOCK_STORES);
  }, [renderMarkers]);

  /* ── Map: 위치 이동 ─────────────────────────────────── */
  const moveMapTo = useCallback((lat: number, lng: number) => {
    if (!window.kakao) return;
    if (!kakaoMapRef.current) { initMap(lat, lng); return; }
    kakaoMapRef.current.setCenter(new window.kakao.maps.LatLng(lat, lng));
    kakaoMapRef.current.setLevel(5);
    if (myLocOverlay.current) myLocOverlay.current.setMap(null);
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;';
    el.innerHTML = `
      <style>
        @keyframes unniepick-pulse {
          0%   { transform:scale(1);   opacity:.7; }
          50%  { transform:scale(1.6); opacity:.2; }
          100% { transform:scale(1);   opacity:.7; }
        }
      </style>
      <div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(66,133,244,.3);animation:unniepick-pulse 2s ease-in-out infinite;"></div>
        <div style="position:absolute;inset:3px;border-radius:50%;background:#4285F4;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(66,133,244,.5);"></div>
      </div>
      <div style="background:#4285F4;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.2);white-space:nowrap;letter-spacing:-.2px;">내 위치</div>
    `;
    myLocOverlay.current = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(lat, lng),
      content: el, yAnchor: 0.5, xAnchor: 0.5,
    });
    myLocOverlay.current.setMap(kakaoMapRef.current);
  }, [initMap]);

  /* ── GPS ────────────────────────────────────────────── */
  const getGPS = useCallback(() => {
    setLocDropOpen(false);
    if (!navigator.geolocation) {
      setLocText('📍 창원 성산구');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        moveMapTo(lat, lng);
        if (window.kakao?.maps?.services) {
          const geocoder = new window.kakao.maps.services.Geocoder();
          geocoder.coord2RegionCode(lng, lat, (result: any[], status: string) => {
            if (status === window.kakao.maps.services.Status.OK) {
              const r = result.find((x: any) => x.region_type === 'H') || result[0];
              if (r) {
                const name = [r.region_2depth_name, r.region_3depth_name].filter(Boolean).join(' ');
                setLocText('📍 ' + name.trim());
              }
            } else {
              setLocText('📍 현재 위치');
            }
          });
        } else {
          setLocText('📍 현재 위치');
        }
      },
      () => {
        setLocText('📍 창원 성산구');
        showToast('위치 정보를 가져올 수 없어 창원시청을 기준으로 표시합니다.');
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  }, [moveMapTo, showToast]);

  /* ── Kakao SDK 로드 완료 ─────────────────────────────── */
  const handleKakaoLoad = useCallback(() => {
    window.kakao.maps.load(() => {
      initMap(DEFAULT_LAT, DEFAULT_LNG);
      getGPS();
    });
  }, [initMap, getGPS]);

  /* ── selectStore bridge ─────────────────────────────── */
  useEffect(() => {
    window.__selectStore = (id: number) => {
      setSelectedId(id);
      const s = MOCK_STORES.find(x => x.id === id);
      if (s && kakaoMapRef.current && window.kakao) {
        kakaoMapRef.current.setCenter(new window.kakao.maps.LatLng(s.lat, s.lng));
        kakaoMapRef.current.setLevel(4);
      }
    };
    return () => { delete (window as any).__selectStore; };
  }, []);

  /* ── 외부 클릭 닫기 ─────────────────────────────────── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('#search-drop') && !t.closest('#search-form'))
        setSearchDropOpen(false);
      if (!t.closest('#loc-drop') && !t.closest('#loc-btn'))
        setLocDropOpen(false);
      if (!t.closest('#auth-menu') && !t.closest('#auth-btn'))
        setAuthMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── Category filter ────────────────────────────────── */
  const filterCat = useCallback((cat: string) => {
    setActiveCat(cat);
    const filtered = cat === 'all' ? MOCK_STORES : MOCK_STORES.filter(s => s.cat === cat);
    setDisplayStores(filtered);
    renderMarkers(filtered);
  }, [renderMarkers]);

  /* ── Search dropdown ────────────────────────────────── */
  const openSearchDrop = useCallback(() => {
    setRandomPicks(shuffled(PICK_POOL).slice(0, 6));
    setSearchTab('popular');
    setSearchDropOpen(true);
  }, []);

  const pickKeyword = useCallback((text: string) => {
    setSearchQuery(text);
    setSearchDropOpen(false);
    handleSearch(text);
  }, []);

  /* ── AI Search ──────────────────────────────────────── */
  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    setLeftTab('stores');
    setAiStage('parsing');
    setAiFilter(null);
    setAiCount(0);
    setAiResults([]);

    try {
      const res = await fetch('/api/restaurants/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok || !res.body) throw new Error('검색 실패');

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === 'filter') {
              setAiFilter({ chips: event.chips ?? [], intent: event.rewritten_intent ?? q });
              setAiStage('searching');
            } else if (event.type === 'candidates') {
              setAiCount(event.count);
              setAiStage('ranking');
            } else if (event.type === 'recommendation') {
              setAiResults(prev => [...prev, {
                rank:    event.rank,
                name:    event.name,
                cat:     event.category,
                rating:  event.rating ?? 0,
                reviews: event.review_count ?? 0,
                why:     event.why,
                coupon:  event.coupon ? {
                  disc:  event.coupon.discount,
                  title: event.coupon.title,
                  desc:  event.coupon.description,
                } : undefined,
              } as AiResult]);
            } else if (event.type === 'done') {
              setAiStage('done');
            }
          } catch {}
        }
      }
      setAiStage('done');
    } catch {
      setAiStage('done');
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchDropOpen(false);
    handleSearch(searchQuery);
  };

  /* ── 지역 직접 선택 ─────────────────────────────────── */
  const selectRegion = useCallback((name: string, lat: number, lng: number) => {
    setLocText('📍 ' + name);
    setLocDropOpen(false);
    // 상태 업데이트 후 다음 프레임에서 지도 이동 (렌더 사이클 간섭 방지)
    requestAnimationFrame(() => {
      if (!window.kakao || !kakaoMapRef.current) {
        initMap(lat, lng);
        return;
      }
      const pos = new window.kakao.maps.LatLng(lat, lng);
      kakaoMapRef.current.setCenter(pos);
      kakaoMapRef.current.setLevel(5);
    });
  }, [initMap]);

  /* ── Auth helpers ───────────────────────────────────── */
  const toE164 = (p: string) => '+82' + p.replace(/\D/g, '').slice(1);

  const openAuthModal = useCallback(() => {
    setAuthError('');
    setAuthModalOpen(true);
  }, []);

  const signInWithKakao = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const sb = createClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'kakao',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (e: any) {
      setAuthError(e?.message ?? '카카오 로그인에 실패했어요');
      setAuthLoading(false);
    }
  }, []);

  const signInWithNaver = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const sb = createClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'naver' as any,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (e: any) {
      setAuthError(e?.message ?? '네이버 로그인에 실패했어요');
      setAuthLoading(false);
    }
  }, []);

  const sendPhoneOtp = useCallback(async () => {
    const digits = authPhone.replace(/\D/g, '');
    if (digits.length < 10) { setAuthError('올바른 번호를 입력해주세요'); return; }
    setAuthLoading(true);
    setAuthError('');
    try {
      const sb = createClient();
      const { error } = await sb.auth.signInWithOtp({ phone: toE164(authPhone) });
      if (error) throw error;
      setAuthStep('otp');
    } catch (e: any) {
      setAuthError(e?.message ?? '인증번호 발송에 실패했어요');
    } finally {
      setAuthLoading(false);
    }
  }, [authPhone]);

  const verifyPhoneOtp = useCallback(async (codeOverride?: string) => {
    const code = codeOverride ?? authOtp;
    if (code.length < 6) { setAuthError('6자리를 모두 입력해주세요'); return; }
    setAuthLoading(true);
    setAuthError('');
    try {
      const sb = createClient();
      const { error } = await sb.auth.verifyOtp({
        phone: toE164(authPhone),
        token: code,
        type: 'sms',
      });
      if (error) throw error;
      setAuthModalOpen(false);
      setAuthStep('phone');
      setAuthPhone('');
      setAuthOtp('');
      showToast('로그인 됐어요 🎉');
    } catch (e: any) {
      setAuthError(e?.message ?? '인증번호가 올바르지 않아요');
    } finally {
      setAuthLoading(false);
    }
  }, [authPhone, authOtp, showToast]);

  const handleSignOut = useCallback(async () => {
    const sb = createClient();
    await sb.auth.signOut();
    setAuthUser(null);
    setAuthMenuOpen(false);
    showToast('로그아웃 됐어요');
  }, [showToast]);

  /* ── Auth 세션 복원 ─────────────────────────────────── */
  useEffect(() => {
    const sb = createClient();
    const loadProfile = (userId: string) => {
      sb.from('profiles').select('nickname').eq('id', userId).maybeSingle()
        .then(({ data }) => setAuthUser({ id: userId, nickname: data?.nickname ?? undefined }));
    };
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) loadProfile(session.user.id);
      else setAuthUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ──────────────────────────────────────────────────── */
  /* Render                                               */
  /* ──────────────────────────────────────────────────── */
  const OR = '#FF6F0F';
  const OR_S = '#FFF4EC';
  const OR_M = '#FFD9B8';
  const PU = '#6742F5';

  return (
    <div style={{ height:'100vh', display:'flex', overflow:'hidden',
      background:'#fff', fontFamily:"'Pretendard Variable','Noto Sans KR',-apple-system,sans-serif",
      color:'#111827' }}>

      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services,clusterer&autoload=false`}
        strategy="afterInteractive"
        onLoad={handleKakaoLoad}
      />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL                                                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={{ width:380, flexShrink:0, display:'flex', flexDirection:'column',
        borderRight:'1px solid #E5E7EB', background:'#fff', zIndex:10,
        boxShadow:'2px 0 12px rgba(0,0,0,.06)' }}>

        {/* ─ 로고 헤더 ─ */}
        <div style={{ padding:'14px 16px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>

            {/* 로고 */}
            <div style={{ display:'flex', alignItems:'center', gap:7,
              fontSize:18, fontWeight:900, color:OR }}>
              <div style={{ width:28, height:28, background:OR, borderRadius:7,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, color:'#fff' }}>
                🩷
              </div>
              언니픽
            </div>

            {/* 우측 버튼 */}
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {authUser ? (
                <div style={{ position:'relative' }}>
                  <button id="auth-btn" onClick={() => setAuthMenuOpen(v => !v)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px',
                      borderRadius:100, border:`1.5px solid ${OR}`, cursor:'pointer',
                      background:'#fff', fontFamily:'inherit' }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background:OR,
                      color:'#fff', fontSize:10, fontWeight:800, flexShrink:0,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {(authUser.nickname ?? '나')[0]}
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>
                      {authUser.nickname ?? '언니픽회원'}
                    </span>
                  </button>
                  {authMenuOpen && (
                    <div id="auth-menu" style={{ position:'absolute', top:'calc(100% + 6px)', right:0,
                      background:'#fff', border:'1px solid #E5E7EB', borderRadius:12,
                      boxShadow:'0 8px 24px rgba(0,0,0,.1)', zIndex:500, minWidth:140, overflow:'hidden' }}>
                      <div style={{ padding:'10px 14px', borderBottom:'1px solid #E5E7EB',
                        fontSize:12, fontWeight:700, color:'#111827' }}>
                        {authUser.nickname ?? '언니픽회원'}
                      </div>
                      <button onClick={handleSignOut}
                        style={{ width:'100%', padding:'9px 14px', background:'none', border:'none',
                          textAlign:'left', fontSize:12, color:'#6B7280', cursor:'pointer', fontFamily:'inherit' }}
                        onMouseEnter={e => (e.currentTarget.style.background='#F9FAFB')}
                        onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={openAuthModal}
                  style={{ padding:'6px 14px', borderRadius:100, fontSize:12, fontWeight:700,
                    color:'#fff', background:OR, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  로그인
                </button>
              )}
              <button onClick={() => setApplyOpen(true)}
                style={{ padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:700,
                  color:'#fff', background:PU, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                가게등록
              </button>
            </div>
          </div>

          {/* ─ 위치 버튼 ─ */}
          <button id="loc-btn" type="button"
            onClick={() => setLocDropOpen(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 0',
              fontSize:12, fontWeight:700, color: locDropOpen ? OR : '#374151',
              background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', marginBottom:6 }}>
            <span>{locText}</span>
            <span style={{ fontSize:10, color:'#9CA3AF' }}>▾</span>
          </button>

          {/* 위치 드롭다운 */}
          {locDropOpen && (
            <div id="loc-drop" style={{ position:'absolute', top:88, left:16, width:240,
              background:'#fff', border:'1.5px solid #D1D5DB', borderRadius:16,
              boxShadow:'0 8px 32px rgba(0,0,0,.12)', zIndex:500, overflow:'hidden' }}>
              <div style={{ padding:'10px 12px', borderBottom:'1px solid #E5E7EB',
                fontSize:12, fontWeight:800, color:'#111827', display:'flex', justifyContent:'space-between' }}>
                <span>지역 선택</span>
                <span style={{ fontSize:10, fontWeight:500, color:'#9CA3AF' }}>창원시</span>
              </div>
              <div onClick={() => { getGPS(); setLocDropOpen(false); }}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
                  borderBottom:'1px solid #E5E7EB', cursor:'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background=OR_S)}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <span style={{ fontSize:14 }}>🎯</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:OR }}>현재 위치 사용</div>
                  <div style={{ fontSize:10, color:'#9CA3AF' }}>GPS로 자동 감지</div>
                </div>
              </div>
              {[
                { name:'의창구',     lat:35.2279, lng:128.6811 },
                { name:'성산구',     lat:35.2229, lng:128.6827 },
                { name:'마산합포구', lat:35.1946, lng:128.5688 },
                { name:'마산회원구', lat:35.2065, lng:128.5746 },
                { name:'진해구',     lat:35.1487, lng:128.6672 },
              ].map(r => (
                <div key={r.name} onClick={() => selectRegion(r.name, r.lat, r.lng)}
                  style={{ padding:'8px 12px', cursor:'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{r.name}</div>
                </div>
              ))}
            </div>
          )}

          {/* ─ 검색창 ─ */}
          <div style={{ position:'relative', marginBottom:12 }}>
            <form id="search-form" onSubmit={onSubmit}
              style={{ display:'flex', alignItems:'center', background:'#fff',
                border:`1.5px solid ${searchDropOpen ? OR : '#D1D5DB'}`,
                borderRadius:100,
                boxShadow: searchDropOpen ? `0 2px 8px rgba(255,111,15,.12)` : '0 1px 3px rgba(0,0,0,.06)',
                overflow:'visible' }}>
              <div style={{ width:32, height:40, flexShrink:0, display:'flex',
                alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:14 }}>
                🔍
              </div>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={openSearchDrop}
                placeholder="혜택·가게 검색"
                autoComplete="off"
                style={{ flex:1, height:40, padding:'0 2px', border:'none', outline:'none',
                  background:'transparent', fontFamily:'inherit', fontSize:13, color:'#374151' }}
              />
              <button type="button"
                onClick={() => handleSearch(searchQuery || randomPicks[0]?.text || '아메리카노 500원 할인')}
                style={{ margin:4, padding:'0 10px', height:32, borderRadius:100, border:'none',
                  background:`linear-gradient(135deg,${PU},#9B6FF5)`,
                  color:'#fff', fontSize:12, fontWeight:700,
                  display:'flex', alignItems:'center', gap:3, cursor:'pointer', flexShrink:0,
                  whiteSpace:'nowrap', fontFamily:'inherit' }}>
                ✨ AI
              </button>
            </form>

            {/* 검색 드롭다운 */}
            {searchDropOpen && (
              <div id="search-drop" style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
                background:'#fff', border:'1.5px solid #D1D5DB', borderRadius:16,
                boxShadow:'0 8px 32px rgba(0,0,0,.12)', zIndex:500, overflow:'hidden' }}>
                <div style={{ display:'flex', borderBottom:'1px solid #E5E7EB' }}>
                  {(['popular','recent'] as const).map(tab => (
                    <button key={tab} onClick={() => setSearchTab(tab)}
                      style={{ flex:1, padding:'10px 0', fontSize:12, fontWeight:700,
                        color: searchTab === tab ? PU : '#9CA3AF',
                        background:'none', border:'none', cursor:'pointer',
                        borderBottom: searchTab === tab ? `2px solid ${PU}` : '2px solid transparent',
                        marginBottom:-1, fontFamily:'inherit' }}>
                      {tab === 'popular' ? '인기 키워드' : '최근 검색'}
                    </button>
                  ))}
                </div>
                {searchTab === 'popular' && randomPicks.map((p, i) => (
                  <div key={i} onClick={() => pickKeyword(p.text)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', cursor:'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background='#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <div style={{ width:28, height:28, borderRadius:8, background:'#F3F4F6',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                      {p.icon}
                    </div>
                    <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{p.text}</span>
                  </div>
                ))}
                {searchTab === 'recent' && (
                  <div style={{ padding:'24px 14px', textAlign:'center', color:'#9CA3AF', fontSize:12 }}>
                    최근 검색한 가게나 키워드가 없어요.
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'flex-end', padding:'6px 12px', borderTop:'1px solid #E5E7EB' }}>
                  <button onClick={() => setSearchDropOpen(false)}
                    style={{ fontSize:12, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─ 탭 바 ─ */}
        <div style={{ display:'flex', flexShrink:0, borderBottom:'1px solid #E5E7EB' }}>
          {([
            { key:'stores',    label:'🗺️ 가게 찾기' },
            { key:'recommend', label:'🏆 추천맛집' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setLeftTab(t.key)}
              style={{ flex:1, padding:'11px 0', fontSize:13, fontWeight:700,
                color: leftTab === t.key ? OR : '#9CA3AF',
                background:'none', border:'none', cursor:'pointer',
                borderBottom: leftTab === t.key ? `2.5px solid ${OR}` : '2.5px solid transparent',
                marginBottom:-1, fontFamily:'inherit', transition:'color .12s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─ 콘텐츠 영역 ─ */}
        <div style={{ flex:1, overflowY:'auto' }}>

          {/* 가게 찾기 탭 */}
          {leftTab === 'stores' && (
            <>
              {/* AI 검색 결과 */}
              {aiStage !== 'idle' && (
                <div style={{ padding:14 }}>
                  <AiStageRow
                    label={aiStage === 'parsing' ? '쿼리 분석 중...' : '쿼리 분석'}
                    status={aiStage === 'parsing' ? 'active' : aiFilter ? 'done' : 'wait'}>
                    {aiFilter && (
                      <div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:5 }}>
                          {aiFilter.chips.map((c, i) => (
                            <span key={i} style={{ padding:'2px 8px', borderRadius:100, fontSize:11,
                              fontWeight:700, background:OR_S, color:OR, border:`1px solid ${OR_M}` }}>
                              {c.text}
                            </span>
                          ))}
                        </div>
                        <p style={{ fontSize:11, color:'#9CA3AF', marginTop:3, fontStyle:'italic' }}>
                          💭 {aiFilter.intent}
                        </p>
                      </div>
                    )}
                  </AiStageRow>
                  {aiStage !== 'idle' && (
                    <AiStageRow
                      label={aiStage === 'searching' ? '가게 검색 중...' : '가게 검색 완료'}
                      status={aiStage === 'searching' ? 'active' : (aiCount > 0 || aiStage === 'done' || aiStage === 'ranking') ? 'done' : 'wait'}>
                      {aiCount > 0 && (
                        <p style={{ fontSize:12, color:'#6B7280', marginTop:3 }}>
                          조건에 맞는 가게 <strong style={{ color:OR }}>{aiCount}</strong>개 발견
                        </p>
                      )}
                    </AiStageRow>
                  )}
                  {(aiStage === 'ranking' || aiStage === 'done') && (
                    <AiStageRow
                      label={aiStage === 'ranking' ? 'AI 추천 선별 중...' : 'AI 추천 완료'}
                      status={aiStage === 'ranking' ? 'active' : 'done'}
                    />
                  )}
                  {aiResults.length > 0 && (
                    <div style={{ marginTop:14 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <p style={{ fontSize:13, fontWeight:800, color:'#111827' }}>
                          🏆 AI 추천 {aiResults.length}개
                        </p>
                        <button onClick={() => { setAiStage('idle'); setAiResults([]); setAiFilter(null); }}
                          style={{ fontSize:11, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                          닫기
                        </button>
                      </div>
                      {aiResults.map(r => (
                        <AiResultCard key={r.rank} r={r} onToast={showToast} />
                      ))}
                    </div>
                  )}
                  {aiStage === 'done' && aiResults.length === 0 && (
                    <div style={{ textAlign:'center', padding:'20px 0', color:'#9CA3AF', fontSize:13 }}>
                      조건에 맞는 가게를 찾지 못했어요.
                    </div>
                  )}
                </div>
              )}

              {/* 가게 목록 */}
              {aiStage === 'idle' && (
                <div style={{ padding:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'8px 6px 6px', fontSize:12, color:'#6B7280', fontWeight:600 }}>
                    <span>
                      <span style={{ color:OR, fontWeight:800 }}>{displayStores.length}</span>개 가게
                    </span>
                    <span style={{ fontSize:11, color:'#9CA3AF' }}>
                      ⏰ 타임세일 <strong style={{ color:'#E53935' }}>{displayStores.filter(s=>s.timesale).length}</strong>개
                    </span>
                  </div>
                  {displayStores.map(store => (
                    <div key={store.id} onClick={() => window.__selectStore(store.id)}
                      style={{ display:'flex', gap:10, padding:12, borderRadius:12,
                        border: selectedId === store.id ? `1.5px solid ${OR}` : '1px solid #E5E7EB',
                        background: selectedId === store.id ? OR_S : '#fff',
                        marginBottom:8, cursor:'pointer', transition:'all .12s' }}
                      onMouseEnter={e => { if (selectedId !== store.id) e.currentTarget.style.borderColor=OR_M; }}
                      onMouseLeave={e => { if (selectedId !== store.id) e.currentTarget.style.borderColor='#E5E7EB'; }}>
                      <div style={{ width:44, height:44, borderRadius:12, background:'#F3F4F6',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:22, flexShrink:0 }}>
                        {store.emoji}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{store.name}</div>
                        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>
                          {store.cat} · {store.dist}
                        </div>
                        <div style={{ display:'inline-flex', alignItems:'center', gap:3,
                          background:OR_S, color:OR, fontSize:10, fontWeight:800,
                          padding:'3px 8px', borderRadius:100, marginTop:5 }}>
                          {store.timesale ? '⏰' : '🎟'} {store.coupon}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 추천맛집 탭 */}
          {leftTab === 'recommend' && <RecommendFeed compact />}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* RIGHT MAP AREA                                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

        {/* ─ 업종 칩 바 (지도 상단 고정) ─ */}
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10,
          background:'rgba(255,255,255,.95)', backdropFilter:'blur(8px)',
          borderBottom:'1px solid #E5E7EB', padding:'8px 0' }}>
          <div style={{ display:'flex', gap:6, padding:'0 14px', overflowX:'auto',
            scrollbarWidth:'none' }}>
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => filterCat(c.key)}
                style={{ display:'inline-flex', alignItems:'center', gap:4,
                  padding:'6px 13px', borderRadius:100,
                  border: activeCat === c.key ? `1.5px solid ${OR}` : '1.5px solid #E5E7EB',
                  background: activeCat === c.key ? OR : '#fff',
                  fontSize:12, fontWeight: activeCat === c.key ? 700 : 600,
                  color: activeCat === c.key ? '#fff' : '#374151',
                  cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
                  fontFamily:'inherit', transition:'all .12s' }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─ Kakao Map ─ */}
        <div ref={mapContainerRef} style={{ width:'100%', height:'100%' }} />

        {/* ─ GPS 버튼 ─ */}
        <button onClick={() => { getGPS(); showToast('내 위치로 이동합니다.'); }}
          style={{ position:'absolute', bottom:24, right:14, zIndex:10,
            width:44, height:44, borderRadius:'50%',
            background:'rgba(255,255,255,.95)', backdropFilter:'blur(8px)',
            border:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.08)', fontFamily:'inherit' }}>
          📍
        </button>

        {/* ─ 앱 다운로드 버튼 ─ */}
        <button onClick={() => window.open('/app','_blank')}
          style={{ position:'absolute', bottom:78, right:14, zIndex:10,
            padding:'8px 12px', borderRadius:10,
            background:'rgba(255,255,255,.95)', backdropFilter:'blur(8px)',
            border:'1px solid #E5E7EB', fontSize:11, fontWeight:600, color:'#374151',
            cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.08)', fontFamily:'inherit',
            display:'flex', alignItems:'center', gap:4 }}>
          📱 앱 다운로드
        </button>
      </div>

      {/* ═══ TOAST ═══════════════════════════════════════════════ */}
      <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
        background:'#111827', color:'#fff', padding:'10px 20px', borderRadius:100,
        fontSize:13, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.18)',
        zIndex:9999, whiteSpace:'nowrap',
        opacity: toastVis ? 1 : 0, transition:'opacity .25s', pointerEvents:'none' }}>
        {toastMsg}
      </div>

      {/* ═══ AUTH MODAL ══════════════════════════════════════════ */}
      {authModalOpen && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:9000, padding:20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setAuthModalOpen(false); }}
        >
          <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:400,
            padding:28, boxShadow:'0 20px 60px rgba(0,0,0,.2)', position:'relative',
            fontFamily:"'Pretendard Variable','Noto Sans KR',-apple-system,sans-serif" }}>

            <button onClick={() => setAuthModalOpen(false)}
              style={{ position:'absolute', top:16, right:16, width:30, height:30,
                borderRadius:'50%', background:'#F3F4F6', border:'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, cursor:'pointer', fontFamily:'inherit', color:'#374151' }}>
              ✕
            </button>

            {/* 로고 */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28 }}>
              <div style={{ width:56, height:56, background:OR, borderRadius:16,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28, color:'#fff', marginBottom:12 }}>
                🩷
              </div>
              <div style={{ fontSize:22, fontWeight:900, color:'#111827' }}>언니픽에 오신 걸 환영해요</div>
              <div style={{ fontSize:13, color:'#9CA3AF', marginTop:6 }}>
                소셜 계정으로 간편하게 시작하세요
              </div>
            </div>

            {/* 카카오 로그인 */}
            <button
              onClick={signInWithKakao}
              disabled={authLoading}
              style={{ width:'100%', height:52, borderRadius:14, border:'none',
                background:'#FEE500', color:'#191919', fontSize:15, fontWeight:800,
                cursor: authLoading ? 'wait' : 'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                marginBottom:10, boxShadow:'0 2px 8px rgba(254,229,0,.4)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.48 3 2 6.69 2 11.25c0 2.9 1.85 5.45 4.65 6.95l-.95 3.5 4.1-2.7c.7.1 1.45.15 2.2.15 5.52 0 10-3.69 10-8.25S17.52 3 12 3z"/>
              </svg>
              카카오로 계속하기
            </button>

            {/* 네이버 로그인 */}
            <button
              onClick={signInWithNaver}
              disabled={authLoading}
              style={{ width:'100%', height:52, borderRadius:14, border:'none',
                background:'#03C75A', color:'#fff', fontSize:15, fontWeight:800,
                cursor: authLoading ? 'wait' : 'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                boxShadow:'0 2px 8px rgba(3,199,90,.3)' }}
            >
              <span style={{ fontSize:18, fontWeight:900, lineHeight:1 }}>N</span>
              네이버로 계속하기
            </button>

            {authError && (
              <div style={{ fontSize:12, color:'#EF4444', textAlign:'center', marginTop:14 }}>
                {authError}
              </div>
            )}

            <p style={{ fontSize:11, color:'#C4C9D4', textAlign:'center', marginTop:20, lineHeight:1.7 }}>
              처음 오셨다면 자동으로 가입됩니다.<br />
              로그인 시 <span style={{ textDecoration:'underline' }}>이용약관</span> 및 <span style={{ textDecoration:'underline' }}>개인정보처리방침</span>에 동의하게 됩니다.
            </p>
          </div>
        </div>
      )}

      <ApplyModal isOpen={applyOpen} onClose={() => setApplyOpen(false)} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Sub Components                                                    */
/* ──────────────────────────────────────────────────────────────── */
function AiStageRow({ label, status, children }: {
  label: string; status: 'wait'|'active'|'done'; children?: React.ReactNode;
}) {
  const OR = '#FF6F0F';
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0' }}>
      <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, marginTop:1,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:11,
        background: status === 'done' ? '#EDFFF6' : status === 'active' ? '#FFF4EC' : '#F3F4F6',
        border: status === 'done' ? '1px solid #86EFAC' : status === 'active' ? `1px solid ${OR}` : '1px solid #E5E7EB' }}>
        {status === 'done' ? '✓' : status === 'active' ? '⏳' : ''}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600,
          color: status === 'active' ? OR : status === 'done' ? '#374151' : '#9CA3AF' }}>
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function AiResultCard({ r, onToast }: { r: AiResult; onToast: (m: string) => void }) {
  const OR = '#FF6F0F';
  const OR_S = '#FFF4EC';
  const OR_M = '#FFD9B8';
  const rankColors: Record<number, string> = { 1:'#F59E0B', 2:'#94A3B8', 3:'#B45309' };
  const [claimed, setClaimed] = useState(false);

  return (
    <div style={{ border:'1px solid #E5E7EB', borderRadius:16, overflow:'hidden',
      marginBottom:12, transition:'border-color .15s', cursor:'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = OR_M)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}>
      <div style={{ padding:'14px 14px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:24, height:24, borderRadius:'50%',
            background: rankColors[r.rank] ?? '#9CA3AF',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, fontWeight:900, color:'#fff', flexShrink:0 }}>
            {r.rank}
          </div>
          <span style={{ fontSize:15, fontWeight:800, color:'#111827' }}>{r.name}</span>
        </div>
        <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:8 }}>
          {r.cat} · ⭐{r.rating} · 리뷰 {r.reviews}
        </div>
        <div style={{ background:OR_S, borderRadius:8, padding:'8px 10px',
          fontSize:12, color:'#374151', lineHeight:1.6, marginBottom: r.coupon ? 8 : 0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:OR, marginBottom:3 }}>✨ AI 추천 이유</div>
          {r.why}
        </div>
        {r.coupon && (
          <div style={{ display:'flex', alignItems:'center', gap:8,
            background:`linear-gradient(135deg, ${OR_S}, #FFF8F4)`,
            border:`1.5px dashed ${OR_M}`, borderRadius:8, padding:'8px 10px' }}>
            <div style={{ background:OR, color:'#fff', padding:'6px 10px', borderRadius:8,
              fontSize:14, fontWeight:900, textAlign:'center', flexShrink:0, minWidth:48 }}>
              {r.coupon.disc}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color:OR }}>{r.coupon.title}</div>
              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{r.coupon.desc}</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setClaimed(true); onToast('쿠폰이 쿠폰함에 저장됐어요 🎟'); }}
              disabled={claimed}
              style={{ background: claimed ? '#EDFFF6' : OR, color: claimed ? '#059669' : '#fff',
                border: claimed ? '1px solid #A7F3D0' : 'none',
                padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700,
                cursor: claimed ? 'default' : 'pointer', flexShrink:0, fontFamily:'inherit' }}>
              {claimed ? '✓ 받음' : '받기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
