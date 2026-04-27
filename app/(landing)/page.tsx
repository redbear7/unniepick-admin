'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import ApplyModal from '@/components/ApplyModal';

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
interface AiMockItem {
  chips: { text: string; color: string }[];
  intent: string; count: number; results: AiResult[];
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

const AI_MOCK: Record<string, AiMockItem> = {
  '아메리카노 500원 할인': {
    chips: [{ text:'카페', color:'#FF6F0F' }, { text:'할인쿠폰', color:'#FF6F0F' }],
    intent: '아메리카노 할인 쿠폰이 있는 카페', count: 8,
    results: [
      { rank:1, name:'빈스커피 상남점', cat:'카페', rating:4.7, reviews:312,
        why:'아메리카노 500원 할인 쿠폰 보유. 스탬프 카드 운영 중.',
        coupon: { disc:'500원', title:'아메리카노 할인', desc:'HOT/ICE 선택 가능' } },
      { rank:2, name:'모카팩토리', cat:'카페', rating:4.5, reviews:198,
        why:'버블티 2+1 쿠폰 진행 중. 오후 타임세일.',
        coupon: { disc:'2+1', title:'버블티 2+1', desc:'오후 2~6시 한정' } },
    ],
  },
  '헤어샵 할인쿠폰': {
    chips: [{ text:'뷰티·미용', color:'#C026D3' }, { text:'할인쿠폰', color:'#FF6F0F' }],
    intent: '헤어샵 할인 쿠폰이 있는 미용실', count: 12,
    results: [
      { rank:1, name:'헤어스튜디오K', cat:'뷰티·미용', rating:4.8, reviews:245,
        why:'커트 20% 할인쿠폰 보유. "친절해요" 리뷰 다수.',
        coupon: { disc:'20%', title:'커트+드라이 할인', desc:'예약 고객 한정' } },
      { rank:2, name:'네일팝', cat:'뷰티·미용', rating:4.6, reviews:187,
        why:'젤네일 25% 타임세일 진행 중. 13~17시 한정.',
        coupon: { disc:'25%', title:'젤네일 타임세일', desc:'13:00~17:00 한정' } },
    ],
  },
};

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
function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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
  const [storePanelOpen, setStorePanelOpen] = useState(false);
  const [aiPanelOpen,    setAiPanelOpen]    = useState(false);
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
      setStorePanelOpen(true);
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
    setAiPanelOpen(true);
    setStorePanelOpen(false);
    setAiStage('parsing');
    setAiFilter(null);
    setAiCount(0);
    setAiResults([]);

    const mock: AiMockItem = AI_MOCK[q] ?? {
      chips: [{ text: q, color: '#FF6F0F' }],
      intent: `"${q}"에 맞는 가게`,
      count: 0, results: [],
    };

    await wait(700);
    setAiFilter({ chips: mock.chips, intent: mock.intent });
    setAiStage('searching');
    await wait(600);
    setAiCount(mock.count);
    setAiStage('ranking');
    for (const r of mock.results) {
      await wait(700);
      setAiResults(prev => [...prev, r]);
    }
    setAiStage('done');
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
    setAuthStep('phone');
    setAuthPhone('');
    setAuthOtp('');
    setAuthError('');
    setAuthModalOpen(true);
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
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden',
      background:'#fff', fontFamily:"'Pretendard Variable','Noto Sans KR',-apple-system,sans-serif",
      color:'#111827' }}>

      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services,clusterer&autoload=false`}
        strategy="afterInteractive"
        onLoad={handleKakaoLoad}
      />

      {/* ═══ HEADER ════════════════════════════════════════ */}
      <header style={{ flexShrink:0, background:'#fff', borderBottom:'1px solid #E5E7EB',
        position:'sticky', top:0, zIndex:200 }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 20px',
          display:'grid', gridTemplateColumns:'1fr auto 1fr',
          alignItems:'center', height:64 }}>

          {/* 좌측 여백 */}
          <div />

          {/* ── 로고 + 검색창 (가운데) ──────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>

            {/* 로고 */}
            <div style={{ display:'flex', alignItems:'center', gap:7,
              fontSize:18, fontWeight:900, color:OR, cursor:'pointer', flexShrink:0 }}>
              <div style={{ width:28, height:28, background:OR, borderRadius:7,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, color:'#fff' }}>
                🩷
              </div>
              언니픽
            </div>

          <div style={{ width:440, position:'relative' }}>
            <form id="search-form" onSubmit={onSubmit}
              style={{ display:'flex', alignItems:'center', background:'#fff',
                border:`1.5px solid ${searchDropOpen ? OR : '#D1D5DB'}`,
                borderRadius:100,
                boxShadow: searchDropOpen ? `0 2px 12px rgba(255,111,15,.12)` : '0 1px 4px rgba(0,0,0,.06)',
                overflow:'visible', transition:'border-color .15s, box-shadow .15s' }}>

              {/* 위치 버튼 */}
              <button id="loc-btn" type="button"
                onClick={() => setLocDropOpen(v => !v)}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'0 12px', height:40,
                  flexShrink:0,
                  fontSize:12, fontWeight:700, color: locDropOpen ? OR : '#374151',
                  background:'none', border:'none', borderRight:'1px solid #E5E7EB',
                  cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                <span>{locText}</span>
                <span style={{ fontSize:10, color:'#9CA3AF' }}>▾</span>
              </button>

              {/* 검색 아이콘 */}
              <div style={{ width:34, height:40, flexShrink:0, display:'flex',
                alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:14 }}>
                🔍
              </div>

              {/* Input */}
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={openSearchDrop}
                placeholder="혜택 검색"
                autoComplete="off"
                style={{ flex:1, height:40, padding:'0 2px', border:'none', outline:'none',
                  background:'transparent', fontFamily:'inherit', fontSize:13, color:'#374151' }}
              />

              {/* AI 추천 버튼 */}
              <button type="button"
                onClick={() => handleSearch(searchQuery || randomPicks[0]?.text || '아메리카노 500원 할인')}
                style={{ margin:4, padding:'0 12px', height:32, borderRadius:100, border:'none',
                  background:`linear-gradient(135deg, ${PU}, #9B6FF5)`,
                  color:'#fff', fontSize:12, fontWeight:700,
                  display:'flex', alignItems:'center', gap:4, cursor:'pointer', flexShrink:0,
                  whiteSpace:'nowrap', boxShadow:'0 1px 6px rgba(103,66,245,.25)',
                  fontFamily:'inherit' }}>
                ✨ AI
              </button>
            </form>

            {/* ── 검색 드롭다운 ─────────────────────────────── */}
            {searchDropOpen && (
              <div id="search-drop" style={{ position:'absolute', top:'calc(100% + 8px)', left:0, right:0,
                background:'#fff', border:'1.5px solid #D1D5DB', borderRadius:20,
                boxShadow:'0 8px 40px rgba(0,0,0,.14)', zIndex:500, overflow:'hidden' }}>

                <div style={{ display:'flex', borderBottom:'1px solid #E5E7EB' }}>
                  {(['popular','recent'] as const).map(tab => (
                    <button key={tab} onClick={() => setSearchTab(tab)}
                      style={{ flex:1, padding:'12px 0', fontSize:13, fontWeight:700,
                        color: searchTab === tab ? PU : '#9CA3AF',
                        background:'none', border:'none', cursor:'pointer',
                        borderBottom: searchTab === tab ? `2.5px solid ${PU}` : '2.5px solid transparent',
                        marginBottom:-1, fontFamily:'inherit' }}>
                      {tab === 'popular' ? '인기 키워드' : '최근 검색'}
                    </button>
                  ))}
                </div>

                {searchTab === 'popular' && (
                  <div>
                    {randomPicks.map((p, i) => (
                      <div key={i} onClick={() => pickKeyword(p.text)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 18px',
                          cursor:'pointer', transition:'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width:30, height:30, borderRadius:8, background:'#F3F4F6',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:15, flexShrink:0 }}>
                          {p.icon}
                        </div>
                        <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{p.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {searchTab === 'recent' && (
                  <div style={{ padding:'28px 18px', textAlign:'center', color:'#9CA3AF', fontSize:12, lineHeight:1.8 }}>
                    최근 검색한 가게나 키워드가 없어요.<br />
                    지금 바로 근처 혜택을 검색해보세요 🔍
                  </div>
                )}

                <div style={{ display:'flex', justifyContent:'flex-end',
                  padding:'8px 14px', borderTop:'1px solid #E5E7EB' }}>
                  <button onClick={() => setSearchDropOpen(false)}
                    style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', background:'none',
                      border:'none', cursor:'pointer', padding:'4px 8px', fontFamily:'inherit' }}>
                    닫기
                  </button>
                </div>
              </div>
            )}

            {/* ── 위치 드롭다운 ────────────────────────────── */}
            {locDropOpen && (
              <div id="loc-drop" style={{ position:'absolute', top:'calc(100% + 8px)', left:0, width:260,
                background:'#fff', border:'1.5px solid #D1D5DB', borderRadius:20,
                boxShadow:'0 8px 40px rgba(0,0,0,.14)', zIndex:500, overflow:'hidden' }}>
                <div style={{ padding:'12px 14px', borderBottom:'1px solid #E5E7EB',
                  fontSize:12, fontWeight:800, color:'#111827',
                  display:'flex', justifyContent:'space-between' }}>
                  <span>지역 선택</span>
                  <span style={{ fontSize:11, fontWeight:500, color:'#9CA3AF' }}>창원시</span>
                </div>
                <div onClick={() => { getGPS(); setLocDropOpen(false); }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                    borderBottom:'1px solid #E5E7EB', cursor:'pointer', transition:'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = OR_S)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize:16 }}>🎯</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:OR }}>현재 위치 사용</div>
                    <div style={{ fontSize:10, color:'#9CA3AF' }}>GPS로 자동 감지</div>
                  </div>
                </div>
                {[
                  { name:'의창구',    landmark:'창원시청',      lat:35.2279, lng:128.6811 },
                  { name:'성산구',    landmark:'NC파크',        lat:35.2229, lng:128.6827 },
                  { name:'마산합포구', landmark:'마산어시장',    lat:35.1946, lng:128.5688 },
                  { name:'마산회원구', landmark:'마산역',        lat:35.2065, lng:128.5746 },
                  { name:'진해구',    landmark:'경화역벚꽃길', lat:35.1487, lng:128.6672 },
                ].map(r => (
                  <div key={r.name} onClick={() => selectRegion(r.name, r.lat, r.lng)}
                    style={{ padding:'9px 14px', cursor:'pointer', transition:'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{r.name}</div>
                    <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>📍 {r.landmark}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>{/* 로고+검색창 wrapper 끝 */}

          {/* Right — 우측 정렬 */}
          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>

            {/* 로그인 / 프로필 */}
            {authUser ? (
              <div style={{ position:'relative' }}>
                <button id="auth-btn" onClick={() => setAuthMenuOpen(v => !v)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
                    borderRadius:100, border:`1.5px solid ${OR}`, cursor:'pointer',
                    background:'#fff', fontFamily:'inherit', transition:'all .15s' }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:OR,
                    color:'#fff', fontSize:11, fontWeight:800, flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(authUser.nickname ?? '나')[0]}
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>
                    {authUser.nickname ?? '언니픽회원'}
                  </span>
                  <span style={{ fontSize:9, color:'#9CA3AF' }}>▾</span>
                </button>
                {authMenuOpen && (
                  <div id="auth-menu" style={{ position:'absolute', top:'calc(100% + 8px)', right:0,
                    background:'#fff', border:'1px solid #E5E7EB', borderRadius:12,
                    boxShadow:'0 8px 24px rgba(0,0,0,.1)', zIndex:500, minWidth:160,
                    overflow:'hidden' }}>
                    <div style={{ padding:'12px 16px', borderBottom:'1px solid #E5E7EB' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>
                        {authUser.nickname ?? '언니픽회원'}
                      </div>
                    </div>
                    <button onClick={handleSignOut}
                      style={{ width:'100%', padding:'10px 16px', background:'none', border:'none',
                        textAlign:'left', fontSize:13, color:'#6B7280', cursor:'pointer',
                        fontFamily:'inherit', transition:'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={openAuthModal}
                style={{ padding:'7px 16px', borderRadius:100, fontSize:12, fontWeight:700,
                  color:'#fff', background:OR, border:'none', cursor:'pointer',
                  fontFamily:'inherit', boxShadow:'0 1px 6px rgba(255,111,15,.25)' }}>
                로그인
              </button>
            )}

            <button onClick={() => window.open('/app', '_blank')}
              style={{ padding:'7px 14px', borderRadius:6, fontSize:12, fontWeight:600,
                color:'#6B7280', background:'none', border:'1px solid #E5E7EB', cursor:'pointer' }}>
              📱 앱 다운로드
            </button>
            <button
              onClick={() => setApplyOpen(true)}
              style={{ padding:'8px 16px', borderRadius:6, fontSize:12, fontWeight:700,
                color:'#fff', background:PU, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              가게 등록
            </button>
          </div>
        </div>
      </header>

      {/* ═══ CATEGORY BAR ══════════════════════════════════ */}
      <div style={{ flexShrink:0, background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'10px 0' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px',
          display:'flex', alignItems:'center', gap:6, overflowX:'auto',
          scrollbarWidth:'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => filterCat(c.key)}
              style={{ display:'inline-flex', alignItems:'center', gap:5,
                padding:'7px 15px', borderRadius:100,
                border: activeCat === c.key ? `1.5px solid ${OR}` : '1.5px solid #E5E7EB',
                background: activeCat === c.key ? OR : '#fff',
                fontSize:13, fontWeight: activeCat === c.key ? 700 : 600,
                color: activeCat === c.key ? '#fff' : '#374151',
                cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
                fontFamily:'inherit', transition:'all .15s' }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ MAP AREA ══════════════════════════════════════ */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

        {/* Kakao Map */}
        <div ref={mapContainerRef} style={{ width:'100%', height:'100%' }} />

        {/* 지도 상단 배지 */}
        <div style={{ position:'absolute', top:12, left:12, zIndex:10,
          display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setStorePanelOpen(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
              background:'rgba(255,255,255,.95)', backdropFilter:'blur(8px)',
              border:'1px solid #E5E7EB', borderRadius:100,
              fontSize:12, fontWeight:700, color:'#374151',
              boxShadow:'0 2px 8px rgba(0,0,0,.08)', cursor:'pointer',
              fontFamily:'inherit' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:OR, display:'inline-block' }} />
            쿠폰 있는 가게 <strong style={{ color:OR }}>{displayStores.length}</strong>개
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
            background:'rgba(255,255,255,.95)', backdropFilter:'blur(8px)',
            border:'1px solid #E5E7EB', borderRadius:100,
            fontSize:12, fontWeight:700, color:'#374151',
            boxShadow:'0 2px 8px rgba(0,0,0,.08)' }}>
            ⏰ 타임세일 진행 중 <strong style={{ color:'#E53935' }}>
              {displayStores.filter(s => s.timesale).length}
            </strong>개
          </div>
        </div>

        {/* GPS 버튼 */}
        <button onClick={() => { getGPS(); showToast('내 위치로 이동합니다.'); }}
          style={{ position:'absolute', bottom:80, right:12, zIndex:10,
            width:44, height:44, borderRadius:'50%',
            background:'rgba(255,255,255,.95)', backdropFilter:'blur(8px)',
            border:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.08)',
            fontFamily:'inherit' }}>
          📍
        </button>

        {/* ── 가게 목록 사이드 패널 (왼쪽) ─────────────── */}
        <div style={{ position:'absolute', top:0, left:0, bottom:0, width:340,
          background:'#fff', borderRight:'1px solid #E5E7EB',
          transform: storePanelOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:'transform .25s cubic-bezier(.4,0,.2,1)',
          zIndex:20, display:'flex', flexDirection:'column',
          boxShadow:'4px 0 20px rgba(0,0,0,.1)' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #E5E7EB',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontSize:14, fontWeight:800, color:'#111827' }}>📍 주변 가게 목록</span>
            <button onClick={() => setStorePanelOpen(false)}
              style={{ width:28, height:28, borderRadius:'50%', background:'#F3F4F6',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, cursor:'pointer', border:'none', fontFamily:'inherit' }}>
              ✕
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:10 }}>
            {displayStores.map(store => (
              <div key={store.id} onClick={() => window.__selectStore(store.id)}
                style={{ display:'flex', gap:10, padding:12, borderRadius:12,
                  border: selectedId === store.id ? `1.5px solid ${OR}` : '1px solid #E5E7EB',
                  background: selectedId === store.id ? OR_S : '#fff',
                  marginBottom:8, cursor:'pointer', transition:'all .15s' }}
                onMouseEnter={e => { if (selectedId !== store.id) e.currentTarget.style.borderColor = OR_M; }}
                onMouseLeave={e => { if (selectedId !== store.id) e.currentTarget.style.borderColor = '#E5E7EB'; }}>
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
        </div>

        {/* ── AI 추천 패널 (오른쪽) ─────────────────────── */}
        <div style={{ position:'absolute', top:0, right:0, bottom:0, width:380,
          background:'#fff', borderLeft:'1px solid #E5E7EB',
          transform: aiPanelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:'transform .25s cubic-bezier(.4,0,.2,1)',
          zIndex:20, display:'flex', flexDirection:'column',
          boxShadow:'-4px 0 20px rgba(0,0,0,.1)' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #E5E7EB',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontSize:14, fontWeight:800, color:'#111827',
              display:'flex', alignItems:'center', gap:6 }}>
              ✨ AI 가게 추천
            </span>
            <button onClick={() => setAiPanelOpen(false)}
              style={{ width:28, height:28, borderRadius:'50%', background:'#F3F4F6',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, cursor:'pointer', border:'none', fontFamily:'inherit' }}>
              ✕
            </button>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:14 }}>
            {/* 파싱 단계 */}
            <AiStageRow
              label={aiStage === 'parsing' ? '쿼리 분석 중...' : '쿼리 분석'}
              status={aiStage === 'parsing' ? 'active' : aiFilter ? 'done' : 'wait'}
            >
              {aiFilter && (
                <div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                    {aiFilter.chips.map((c, i) => (
                      <span key={i} style={{ padding:'3px 10px', borderRadius:100, fontSize:11,
                        fontWeight:700, background:OR_S, color:OR, border:`1px solid ${OR_M}` }}>
                        {c.text}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize:11, color:'#9CA3AF', marginTop:4, fontStyle:'italic' }}>
                    💭 {aiFilter.intent}
                  </p>
                </div>
              )}
            </AiStageRow>

            {/* 검색 단계 */}
            {aiStage !== 'idle' && (
              <AiStageRow
                label={aiStage === 'searching' ? '가게 검색 중...' : '가게 검색 완료'}
                status={aiStage === 'searching' ? 'active' : (aiCount > 0 || aiStage === 'done' || aiStage === 'ranking') ? 'done' : 'wait'}
              >
                {aiCount > 0 && (
                  <p style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>
                    조건에 맞는 가게 <strong style={{ color:OR }}>{aiCount}</strong>개 발견
                  </p>
                )}
              </AiStageRow>
            )}

            {/* 랭킹 단계 */}
            {(aiStage === 'ranking' || aiStage === 'done') && (
              <AiStageRow
                label={aiStage === 'ranking' ? 'AI 추천 선별 중...' : 'AI 추천 완료'}
                status={aiStage === 'ranking' ? 'active' : 'done'}
              />
            )}

            {/* 결과 카드 */}
            {aiResults.length > 0 && (
              <div style={{ marginTop:16 }}>
                <p style={{ fontSize:13, fontWeight:800, color:'#111827', marginBottom:10 }}>
                  🏆 AI 추천 {aiResults.length}개
                </p>
                {aiResults.map(r => (
                  <AiResultCard key={r.rank} r={r} onToast={showToast} />
                ))}
              </div>
            )}

            {aiStage === 'done' && aiResults.length === 0 && (
              <div style={{ textAlign:'center', padding:'24px 0', color:'#9CA3AF', fontSize:13 }}>
                조건에 맞는 가게를 찾지 못했어요.<br />조건을 조금 바꿔보세요.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TOAST ═════════════════════════════════════════ */}
      <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
        background:'#111827', color:'#fff', padding:'10px 20px', borderRadius:100,
        fontSize:13, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.18)',
        zIndex:9999, whiteSpace:'nowrap',
        opacity: toastVis ? 1 : 0, transition:'opacity .25s', pointerEvents:'none' }}>
        {toastMsg}
      </div>

      {/* ═══ AUTH MODAL ════════════════════════════════════ */}
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

            {/* 닫기 */}
            <button onClick={() => setAuthModalOpen(false)}
              style={{ position:'absolute', top:16, right:16, width:30, height:30,
                borderRadius:'50%', background:'#F3F4F6', border:'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, cursor:'pointer', fontFamily:'inherit', color:'#374151' }}>
              ✕
            </button>

            {/* 로고 */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:24 }}>
              <div style={{ width:52, height:52, background:OR, borderRadius:15,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:26, color:'#fff', marginBottom:10 }}>
                🩷
              </div>
              <div style={{ fontSize:20, fontWeight:900, color:OR }}>언니픽</div>
              <div style={{ fontSize:13, color:'#9CA3AF', marginTop:4 }}>
                {authStep === 'phone' ? '휴대폰 번호로 로그인' : '인증번호를 입력해주세요'}
              </div>
            </div>

            {/* ── STEP 1: 전화번호 ── */}
            {authStep === 'phone' && (
              <>
                <label style={{ fontSize:12, fontWeight:700, color:'#374151',
                  display:'block', marginBottom:6 }}>
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  value={authPhone}
                  onChange={e => {
                    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let fmt = d;
                    if (d.length > 3 && d.length <= 7) fmt = d.slice(0,3)+'-'+d.slice(3);
                    else if (d.length > 7) fmt = d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);
                    setAuthPhone(fmt);
                    setAuthError('');
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') sendPhoneOtp(); }}
                  placeholder="010-0000-0000"
                  maxLength={13}
                  autoFocus
                  style={{ width:'100%', height:50, padding:'0 16px', borderRadius:12,
                    border:`1.5px solid ${authError ? '#EF4444' : '#D1D5DB'}`,
                    fontSize:17, fontFamily:'inherit', outline:'none',
                    boxSizing:'border-box', letterSpacing:1, transition:'border-color .15s' }}
                  onFocus={e  => (e.target.style.borderColor = OR)}
                  onBlur={e   => (e.target.style.borderColor = authError ? '#EF4444' : '#D1D5DB')}
                />
                {authError && (
                  <div style={{ fontSize:11, color:'#EF4444', marginTop:5 }}>{authError}</div>
                )}
                <button onClick={sendPhoneOtp} disabled={authLoading}
                  style={{ width:'100%', height:50, marginTop:12, borderRadius:12, border:'none',
                    background: authLoading ? '#FFD9B8' : OR,
                    color:'#fff', fontSize:15, fontWeight:800,
                    cursor: authLoading ? 'wait' : 'pointer', fontFamily:'inherit',
                    transition:'background .15s' }}>
                  {authLoading ? '발송 중...' : '인증번호 받기'}
                </button>
                <p style={{ fontSize:11, color:'#9CA3AF', textAlign:'center', marginTop:14,
                  lineHeight:1.7, margin:'14px 0 0' }}>
                  처음 오셨다면 자동으로 가입됩니다.<br />
                  계속 진행하시면{' '}
                  <span style={{ color:OR, fontWeight:700, cursor:'pointer' }}>이용약관</span>에
                  동의하는 것으로 간주됩니다.
                </p>
              </>
            )}

            {/* ── STEP 2: OTP ── */}
            {authStep === 'otp' && (
              <>
                <p style={{ fontSize:13, color:'#6B7280', marginBottom:18, textAlign:'center',
                  lineHeight:1.7 }}>
                  <strong style={{ color:'#111827' }}>{authPhone}</strong>으로<br />
                  6자리 인증번호를 전송했어요
                </p>
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <input key={i}
                      id={`otp-digit-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={authOtp[i] ?? ''}
                      autoFocus={i === 0}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        const arr = authOtp.padEnd(6, ' ').split('');
                        arr[i] = v.slice(-1);
                        const next = arr.join('').trimEnd();
                        setAuthOtp(next);
                        setAuthError('');
                        if (v && i < 5) {
                          (document.getElementById(`otp-digit-${i+1}`) as HTMLInputElement)?.focus();
                        }
                        const filled = arr.join('').replace(/ /g,'');
                        if (filled.length === 6) {
                          setTimeout(() => verifyPhoneOtp(filled), 80);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !authOtp[i] && i > 0) {
                          (document.getElementById(`otp-digit-${i-1}`) as HTMLInputElement)?.focus();
                        }
                      }}
                      onPaste={i === 0 ? (e) => {
                        e.preventDefault();
                        const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
                        setAuthOtp(p);
                        if (p.length === 6) setTimeout(() => verifyPhoneOtp(p), 80);
                      } : undefined}
                      style={{ width:44, height:54, textAlign:'center', fontSize:22, fontWeight:800,
                        border:`1.5px solid ${authError ? '#EF4444' : authOtp[i] && authOtp[i] !== ' ' ? OR : '#D1D5DB'}`,
                        borderRadius:12, outline:'none', fontFamily:'inherit',
                        background:'#fff', transition:'border-color .15s', boxSizing:'border-box' }}
                    />
                  ))}
                </div>
                {authError && (
                  <div style={{ fontSize:11, color:'#EF4444', textAlign:'center', marginBottom:8 }}>
                    {authError}
                  </div>
                )}
                <button onClick={() => verifyPhoneOtp()}
                  disabled={authLoading || authOtp.replace(/\s/g,'').length < 6}
                  style={{ width:'100%', height:50, borderRadius:12, border:'none',
                    background: (authLoading || authOtp.replace(/\s/g,'').length < 6) ? '#FFD9B8' : OR,
                    color:'#fff', fontSize:15, fontWeight:800, fontFamily:'inherit',
                    cursor: (authLoading || authOtp.replace(/\s/g,'').length < 6) ? 'default' : 'pointer' }}>
                  {authLoading ? '확인 중...' : '확인'}
                </button>
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
                  gap:6, marginTop:14 }}>
                  <span style={{ fontSize:12, color:'#9CA3AF' }}>번호가 오지 않나요?</span>
                  <button
                    onClick={() => { setAuthStep('phone'); setAuthOtp(''); setAuthError(''); }}
                    style={{ fontSize:12, color:OR, fontWeight:700, background:'none', border:'none',
                      cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                    다시 받기
                  </button>
                </div>
              </>
            )}
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
