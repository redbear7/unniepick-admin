'use client';

import { useState, useMemo } from 'react';
import { ExternalLink, Search, ArrowUpDown } from 'lucide-react';

type Platform = 'app' | 'admin';
type SortKey  = 'name' | 'addedAt' | 'updatedAt';

interface Pkg {
  name:      string;
  version:   string;
  license:   string;
  url:       string;
  desc:      string;
  category:  string;
  platform:  Platform;
  addedAt:   string;   // YYYY-MM-DD (프로젝트 추가일)
  updatedAt: string;   // YYYY-MM-DD (현재 버전 릴리즈일)
}

const PACKAGES: Pkg[] = [
  // ── 모바일 앱 ──────────────────────────────────────────────
  { name: 'React Native',              version: '0.81',   license: 'MIT',        platform: 'app',   category: '프레임워크',  addedAt: '2024-01-10', updatedAt: '2024-08-12', url: 'https://github.com/facebook/react-native',                       desc: '모바일 앱 프레임워크' },
  { name: 'Expo',                      version: '~54.0',  license: 'MIT',        platform: 'app',   category: '프레임워크',  addedAt: '2024-01-10', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: 'React Native 개발 플랫폼' },
  { name: 'React',                     version: '19.1',   license: 'MIT',        platform: 'app',   category: '프레임워크',  addedAt: '2024-01-10', updatedAt: '2024-12-05', url: 'https://github.com/facebook/react',                              desc: 'UI 라이브러리' },
  { name: 'React Navigation',          version: '^7',     license: 'MIT',        platform: 'app',   category: '탐색',       addedAt: '2024-01-12', updatedAt: '2024-10-01', url: 'https://github.com/react-navigation/react-navigation',           desc: '앱 화면 탐색 라이브러리' },
  { name: '@supabase/supabase-js',     version: '^2.47',  license: 'MIT',        platform: 'app',   category: '데이터베이스', addedAt: '2024-01-15', updatedAt: '2024-11-20', url: 'https://github.com/supabase/supabase-js',                        desc: 'Supabase JavaScript 클라이언트' },
  { name: 'expo-image-picker',         version: '~17.0',  license: 'MIT',        platform: 'app',   category: '미디어',     addedAt: '2024-02-01', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: '갤러리/카메라 이미지 선택' },
  { name: 'expo-camera',               version: '~17.0',  license: 'MIT',        platform: 'app',   category: '미디어',     addedAt: '2024-02-01', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: '카메라 접근' },
  { name: 'expo-av',                   version: '~15.0',  license: 'MIT',        platform: 'app',   category: '미디어',     addedAt: '2024-03-10', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: '오디오/비디오 재생' },
  { name: 'react-native-track-player', version: '^4.1',   license: 'Apache-2.0', platform: 'app',   category: '미디어',     addedAt: '2024-03-15', updatedAt: '2024-09-08', url: 'https://github.com/doublesymmetry/react-native-track-player',    desc: '백그라운드 음악 재생' },
  { name: 'expo-location',             version: '~19.0',  license: 'MIT',        platform: 'app',   category: '지도/위치',  addedAt: '2024-02-20', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: 'GPS 위치 정보' },
  { name: 'react-native-maps',         version: '1.20',   license: 'MIT',        platform: 'app',   category: '지도/위치',  addedAt: '2024-02-20', updatedAt: '2024-10-22', url: 'https://github.com/react-native-maps/react-native-maps',         desc: '지도 표시' },
  { name: 'expo-notifications',        version: '~0.32',  license: 'MIT',        platform: 'app',   category: '알림',       addedAt: '2024-04-01', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: '푸시 알림' },
  { name: 'expo-secure-store',         version: '~15.0',  license: 'MIT',        platform: 'app',   category: '보안',       addedAt: '2024-01-20', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: '암호화 로컬 저장소' },
  { name: 'expo-local-authentication', version: '~17.0',  license: 'MIT',        platform: 'app',   category: '보안',       addedAt: '2024-05-10', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: '생체인증 (Face ID / 지문)' },
  { name: 'expo-apple-authentication', version: '~8.0',   license: 'MIT',        platform: 'app',   category: '인증',       addedAt: '2024-04-15', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: 'Apple 로그인' },
  { name: 'expo-document-picker',      version: '~13.0',  license: 'MIT',        platform: 'app',   category: '유틸리티',   addedAt: '2024-06-01', updatedAt: '2024-11-15', url: 'https://github.com/expo/expo',                                   desc: '파일 선택' },
  { name: 'react-native-webview',      version: '^13.16', license: 'MIT',        platform: 'app',   category: '유틸리티',   addedAt: '2024-03-01', updatedAt: '2024-12-01', url: 'https://github.com/react-native-webview/react-native-webview',   desc: '인앱 웹브라우저' },
  { name: 'react-native-qrcode-svg',   version: '^6.3',   license: 'MIT',        platform: 'app',   category: '유틸리티',   addedAt: '2024-05-20', updatedAt: '2024-07-14', url: 'https://github.com/awesomejerry/react-native-qrcode-svg',        desc: 'QR 코드 생성' },
  { name: 'react-native-svg',          version: '15.12',  license: 'MIT',        platform: 'app',   category: 'UI/스타일',  addedAt: '2024-02-10', updatedAt: '2024-10-05', url: 'https://github.com/software-mansion/react-native-svg',           desc: 'SVG 렌더링' },
  { name: '@expo-google-fonts/noto-sans-kr', version: '^0.4', license: 'OFL-1.1', platform: 'app', category: 'UI/스타일',  addedAt: '2024-01-12', updatedAt: '2023-09-01', url: 'https://github.com/expo/google-fonts',                           desc: 'Noto Sans KR 폰트' },
  // ── 어드민 웹 ──────────────────────────────────────────────
  { name: 'Next.js',                   version: '16.2.2', license: 'MIT',        platform: 'admin', category: '프레임워크',  addedAt: '2026-04-01', updatedAt: '2026-03-18', url: 'https://github.com/vercel/next.js',                              desc: 'React 풀스택 웹 프레임워크' },
  { name: 'React',                     version: '19.2',   license: 'MIT',        platform: 'admin', category: '프레임워크',  addedAt: '2026-04-01', updatedAt: '2025-12-05', url: 'https://github.com/facebook/react',                              desc: 'UI 라이브러리' },
  { name: '@supabase/ssr',             version: '^0.10',  license: 'MIT',        platform: 'admin', category: '데이터베이스', addedAt: '2026-04-01', updatedAt: '2025-10-14', url: 'https://github.com/supabase/supabase-js',                        desc: 'Supabase SSR 클라이언트' },
  { name: '@supabase/supabase-js',     version: '^2.101', license: 'MIT',        platform: 'admin', category: '데이터베이스', addedAt: '2026-04-01', updatedAt: '2026-01-08', url: 'https://github.com/supabase/supabase-js',                        desc: 'Supabase JavaScript 클라이언트' },
  { name: 'Tailwind CSS',              version: '^4',     license: 'MIT',        platform: 'admin', category: 'UI/스타일',  addedAt: '2026-04-01', updatedAt: '2025-11-21', url: 'https://github.com/tailwindlabs/tailwindcss',                    desc: 'Utility-first CSS 프레임워크' },
  { name: 'lucide-react',              version: '^1.7',   license: 'ISC',        platform: 'admin', category: 'UI/스타일',  addedAt: '2026-04-01', updatedAt: '2026-02-10', url: 'https://github.com/lucide-icons/lucide',                         desc: '아이콘 라이브러리' },
  { name: 'TypeScript',                version: '^5',     license: 'Apache-2.0', platform: 'admin', category: '언어/타입',  addedAt: '2026-04-01', updatedAt: '2025-11-22', url: 'https://github.com/microsoft/TypeScript',                        desc: '정적 타입 언어' },
];

const LICENSE_COLOR: Record<string, string> = {
  'MIT':        'bg-green-500/15 text-green-400',
  'Apache-2.0': 'bg-blue-500/15 text-blue-400',
  'ISC':        'bg-teal-500/15 text-teal-400',
  'OFL-1.1':    'bg-purple-500/15 text-purple-400',
};

const PLATFORM_LABEL: Record<Platform, string> = {
  app:   '📱 앱',
  admin: '🖥 어드민',
};

const ALL_CATEGORIES = ['전체', ...Array.from(new Set(PACKAGES.map(p => p.category))).sort()];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name',      label: '이름순' },
  { key: 'addedAt',   label: '설치일순' },
  { key: 'updatedAt', label: '업데이트일순' },
];

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function OpenSourcePage() {
  const [query,       setQuery]       = useState('');
  const [category,    setCategory]    = useState('전체');
  const [platform,    setPlatform]    = useState<'all' | Platform>('all');
  const [sortKey,     setSortKey]     = useState<SortKey>('name');
  const [sortAsc,     setSortAsc]     = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    let list = PACKAGES.filter(p => {
      const matchQ  = !query    || p.name.toLowerCase().includes(query.toLowerCase()) || p.desc.includes(query);
      const matchC  = category === '전체' || p.category === category;
      const matchP  = platform === 'all'  || p.platform === platform;
      return matchQ && matchC && matchP;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name')      cmp = a.name.localeCompare(b.name);
      if (sortKey === 'addedAt')   cmp = a.addedAt.localeCompare(b.addedAt);
      if (sortKey === 'updatedAt') cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [query, category, platform, sortKey, sortAsc]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">오픈소스 라이선스</h1>
        <p className="text-sm text-gray-500 mt-1">
          언니픽 서비스에 사용된 오픈소스 소프트웨어 목록이에요 · 총 {PACKAGES.length}개
        </p>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="패키지명, 설명 검색"
          className="w-full bg-[#1A1D23] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
        />
      </div>

      {/* 플랫폼 탭 */}
      <div className="flex gap-2 mb-4">
        {(['all', 'app', 'admin'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              platform === p
                ? 'bg-[#FF6F0F] text-white'
                : 'bg-[#1A1D23] border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {p === 'all' ? '전체' : PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 flex-wrap mb-5">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              category === cat
                ? 'bg-white/15 text-white border border-white/20'
                : 'bg-[#1A1D23] border border-white/5 text-gray-500 hover:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-[#1A1D23] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">패키지</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">카테고리</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">버전 · 라이선스</th>
              <th
                className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-white transition select-none"
                onClick={() => toggleSort('addedAt')}
              >
                <span className="flex items-center gap-1">
                  설치일
                  <ArrowUpDown size={11} className={sortKey === 'addedAt' ? 'text-[#FF6F0F]' : ''} />
                </span>
              </th>
              <th
                className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-white transition select-none"
                onClick={() => toggleSort('updatedAt')}
              >
                <span className="flex items-center gap-1">
                  업데이트일
                  <ArrowUpDown size={11} className={sortKey === 'updatedAt' ? 'text-[#FF6F0F]' : ''} />
                </span>
              </th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">링크</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-600">검색 결과가 없어요</td>
              </tr>
            ) : filtered.map(pkg => (
              <tr key={`${pkg.platform}-${pkg.name}`} className="border-b border-white/5 hover:bg-white/[0.02] transition last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-white">{pkg.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pkg.desc}</p>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400 w-fit">{pkg.category}</span>
                    <span className="text-xs text-gray-600">{PLATFORM_LABEL[pkg.platform]}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400 font-mono">{pkg.version}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${LICENSE_COLOR[pkg.license] ?? 'bg-white/5 text-gray-400'}`}>
                      {pkg.license}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs text-gray-500">{fmt(pkg.addedAt)}</td>
                <td className="px-4 py-3.5 text-xs text-gray-500">{fmt(pkg.updatedAt)}</td>
                <td className="px-4 py-3.5 text-center">
                  <a
                    href={pkg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-[#FF6F0F] transition"
                  >
                    <ExternalLink size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 정렬 상태 표시 */}
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
        <span>{filtered.length}개 표시</span>
        <span>·</span>
        <span>
          {SORT_OPTIONS.find(s => s.key === sortKey)?.label}
          {sortAsc ? ' ↑' : ' ↓'}
        </span>
      </div>

      {/* 라이선스 안내 */}
      <div className="mt-6 p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
        <p className="text-xs text-gray-600 leading-relaxed">
          위 오픈소스 소프트웨어는 각각의 라이선스 조건에 따라 사용되며,
          MIT · Apache-2.0 · ISC · OFL-1.1 라이선스 원문은 각 저장소에서 확인할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
