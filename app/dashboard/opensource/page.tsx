'use client';

import { useState, useMemo } from 'react';
import { ExternalLink, Search, ArrowUpDown, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

type Platform = 'admin' | 'crawler';
type SortKey  = 'name' | 'category' | 'status';

interface Pkg {
  name:      string;
  installed: string;   // 실제 설치 버전
  latest:    string;   // npm latest
  license:   string;
  url:       string;
  desc:      string;
  category:  string;
  platform:  Platform;
  breaking?: boolean;  // 메이저 업그레이드 주의
  note?:     string;   // 특이사항
}

type PkgBase = Omit<Pkg, 'platform'>;

/* ── 어드민 웹 (Next.js 앱) ── */
const ADMIN_PKGS: PkgBase[] = [
  { name: 'next',                       installed: '16.2.2',  latest: '16.2.4',  license: 'MIT',        category: '프레임워크',   url: 'https://github.com/vercel/next.js',                             desc: 'React 풀스택 웹 프레임워크' },
  { name: 'react',                      installed: '19.2.4',  latest: '19.2.5',  license: 'MIT',        category: '프레임워크',   url: 'https://github.com/facebook/react',                             desc: 'UI 라이브러리' },
  { name: 'react-dom',                  installed: '19.2.4',  latest: '19.2.5',  license: 'MIT',        category: '프레임워크',   url: 'https://github.com/facebook/react',                             desc: 'React DOM 렌더러' },
  { name: '@supabase/supabase-js',      installed: '2.105.1', latest: '2.105.1', license: 'MIT',        category: '데이터베이스', url: 'https://github.com/supabase/supabase-js',                       desc: 'Supabase JS 클라이언트' },
  { name: '@supabase/ssr',              installed: '0.10.2',  latest: '0.10.2',  license: 'MIT',        category: '데이터베이스', url: 'https://github.com/supabase/supabase-js',                       desc: 'Supabase SSR 클라이언트' },
  { name: 'tailwindcss',                installed: '4.2.4',   latest: '4.2.4',   license: 'MIT',        category: 'UI/스타일',   url: 'https://github.com/tailwindlabs/tailwindcss',                   desc: 'Utility-first CSS 프레임워크' },
  { name: 'lucide-react',               installed: '1.11.0',  latest: '1.11.0',  license: 'ISC',        category: 'UI/스타일',   url: 'https://github.com/lucide-icons/lucide',                        desc: '아이콘 라이브러리' },
  { name: 'typescript',                 installed: '5.9.3',   latest: '6.0.3',   license: 'Apache-2.0', category: '언어/타입',   url: 'https://github.com/microsoft/TypeScript',                       desc: '정적 타입 언어', breaking: true, note: 'v6 Breaking change 검토 후 적용 권장' },
  { name: '@anthropic-ai/sdk',          installed: '0.88.0',  latest: '0.91.1',  license: 'MIT',        category: 'AI/ML',       url: 'https://github.com/anthropic-ai/anthropic-sdk-python',          desc: 'Anthropic Claude API 클라이언트' },
  { name: '@google/genai',              installed: '1.50.1',  latest: '1.50.1',  license: 'Apache-2.0', category: 'AI/ML',       url: 'https://github.com/google/generative-ai-js',                    desc: 'Google Gemini API 클라이언트' },
  { name: '@fal-ai/client',             installed: '1.10.0',  latest: '1.10.0',  license: 'MIT',        category: 'AI/ML',       url: 'https://github.com/fal-ai/fal',                                 desc: 'fal.ai 이미지 생성 클라이언트' },
  { name: 'remotion',                   installed: '4.0.453', latest: '4.0.453', license: 'MIT',        category: '미디어',      url: 'https://github.com/remotion-dev/remotion',                      desc: '코드 기반 영상 제작 프레임워크' },
  { name: '@remotion/player',           installed: '4.0.453', latest: '4.0.453', license: 'MIT',        category: '미디어',      url: 'https://github.com/remotion-dev/remotion',                      desc: 'Remotion 플레이어 컴포넌트' },
  { name: '@remotion/renderer',         installed: '4.0.453', latest: '4.0.453', license: 'MIT',        category: '미디어',      url: 'https://github.com/remotion-dev/remotion',                      desc: 'Remotion 서버사이드 렌더러' },
  { name: '@remotion/bundler',          installed: '4.0.453', latest: '4.0.453', license: 'MIT',        category: '미디어',      url: 'https://github.com/remotion-dev/remotion',                      desc: 'Remotion Webpack 번들러' },
  { name: 'three',                      installed: '0.183.2', latest: '0.184.0', license: 'MIT',        category: '3D/그래픽',   url: 'https://github.com/mrdoob/three.js',                            desc: '3D 그래픽 라이브러리' },
  { name: '@pixiv/three-vrm',           installed: '3.5.1',   latest: '3.5.1',   license: 'MIT',        category: '3D/그래픽',   url: 'https://github.com/pixiv/three-vrm',                            desc: 'VRM 아바타 렌더링' },
  { name: '@dnd-kit/core',              installed: '6.3.1',   latest: '6.3.1',   license: 'MIT',        category: 'UI/스타일',   url: 'https://github.com/clauderic/dnd-kit',                          desc: '드래그 앤 드롭' },
  { name: '@dnd-kit/sortable',          installed: '10.0.0',  latest: '10.0.0',  license: 'MIT',        category: 'UI/스타일',   url: 'https://github.com/clauderic/dnd-kit',                          desc: '정렬 가능 드래그 앤 드롭' },
  { name: 'react-markdown',             installed: '10.1.0',  latest: '10.1.0',  license: 'MIT',        category: 'UI/스타일',   url: 'https://github.com/remarkjs/react-markdown',                    desc: 'Markdown 렌더링' },
  { name: 'remark-gfm',                 installed: '4.0.1',   latest: '4.0.1',   license: 'MIT',        category: 'UI/스타일',   url: 'https://github.com/remarkjs/remark-gfm',                        desc: 'GitHub Flavored Markdown' },
  { name: 'gray-matter',                installed: '4.0.3',   latest: '4.0.3',   license: 'MIT',        category: '유틸리티',    url: 'https://github.com/jonschlinkert/gray-matter',                  desc: 'Front-matter 파싱' },
  { name: 'next-themes',                installed: '0.4.6',   latest: '0.4.6',   license: 'MIT',        category: 'UI/스타일',   url: 'https://github.com/pacocoursey/next-themes',                    desc: '다크/라이트 테마 전환' },
  { name: 'solapi',                     installed: '6.0.1',   latest: '6.0.1',   license: 'MIT',        category: '유틸리티',    url: 'https://github.com/solapi/solapi-nodejs',                       desc: 'SMS/알림톡 발송' },
  { name: 'ssaju',                      installed: '0.1.2',   latest: '0.2.0',   license: 'MIT',        category: '유틸리티',    url: 'https://github.com/ssaju/ssaju',                                desc: '주소 유틸리티', note: '마이너 업데이트 가능' },
  { name: 'pretendard',                 installed: '1.3.9',   latest: '1.3.9',   license: 'MIT',        category: 'UI/스타일',   url: 'https://github.com/orioncactus/pretendard',                     desc: 'Pretendard 폰트' },
];

/* ── 크롤러 (scripts/crawl-restaurants) ── */
const CRAWLER_PKGS: PkgBase[] = [
  { name: 'crawlee',                          installed: '3.16.0', latest: '3.16.0', license: 'Apache-2.0', category: '크롤링',     url: 'https://github.com/apify/crawlee',                              desc: '웹 스크래핑·크롤링 프레임워크' },
  { name: 'playwright',                       installed: '1.59.1', latest: '1.59.1', license: 'Apache-2.0', category: '크롤링',     url: 'https://github.com/microsoft/playwright',                       desc: '헤드리스 브라우저 자동화' },
  { name: 'playwright-extra',                 installed: '4.3.6',  latest: '4.3.6',  license: 'MIT',        category: '크롤링',     url: 'https://github.com/berstend/puppeteer-extra',                   desc: 'Playwright 플러그인 확장' },
  { name: 'puppeteer-extra-plugin-stealth',   installed: '2.11.2', latest: '2.11.2', license: 'MIT',        category: '크롤링',     url: 'https://github.com/berstend/puppeteer-extra',                   desc: '봇 탐지 우회 플러그인' },
  { name: 'sharp',                            installed: '0.34.5', latest: '0.34.5', license: 'Apache-2.0', category: '미디어',     url: 'https://github.com/lovell/sharp',                               desc: '이미지 처리 · 리사이징' },
  { name: '@supabase/supabase-js',            installed: '2.103.2',latest: '2.105.1',license: 'MIT',        category: '데이터베이스',url: 'https://github.com/supabase/supabase-js',                       desc: 'Supabase JS 클라이언트', note: 'npm update 권장' },
  { name: 'dotenv',                           installed: '16.6.1', latest: '17.4.2', license: 'BSD-2',      category: '유틸리티',   url: 'https://github.com/motdotla/dotenv',                            desc: '환경변수 로더', breaking: true, note: 'v17 Breaking change 검토 후 적용' },
  { name: 'node-cron',                        installed: '3.0.3',  latest: '4.2.1',  license: 'MIT',        category: '유틸리티',   url: 'https://github.com/node-cron/node-cron',                        desc: '크론 스케줄러', breaking: true, note: 'v4 스케줄 문법 변경 가능성' },
  { name: 'tsx',                              installed: '4.21.0', latest: '4.21.0', license: 'MIT',        category: '개발도구',   url: 'https://github.com/privatenumber/tsx',                          desc: 'TypeScript 실행기' },
];

const ALL_PKGS: Pkg[] = [
  ...ADMIN_PKGS.map(p => ({ ...p, platform: 'admin' as Platform })),
  ...CRAWLER_PKGS.map(p => ({ ...p, platform: 'crawler' as Platform })),
];

/* ── 버전 비교 ── */
function parseVer(v: string) {
  return v.replace(/[^0-9.]/g, '').split('.').map(Number);
}
function cmpVer(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVer(a), pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0, nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}
function isMajorBump(installed: string, latest: string) {
  return parseVer(installed)[0] < parseVer(latest)[0];
}
function isMinorBump(installed: string, latest: string) {
  const pi = parseVer(installed), pl = parseVer(latest);
  return pi[0] === pl[0] && pi[1] < pl[1];
}

type UpdateStatus = 'latest' | 'minor' | 'major';
function getStatus(pkg: Pkg): UpdateStatus {
  const cmp = cmpVer(pkg.installed, pkg.latest);
  if (cmp === 0) return 'latest';
  if (isMajorBump(pkg.installed, pkg.latest)) return 'major';
  return 'minor';
}

const LICENSE_COLOR: Record<string, string> = {
  'MIT':        'bg-green-500/15 text-green-400',
  'Apache-2.0': 'bg-blue-500/15 text-blue-400',
  'ISC':        'bg-teal-500/15 text-teal-400',
  'BSD-2':      'bg-sky-500/15 text-sky-400',
};

const PLATFORM_LABEL: Record<Platform, string> = {
  admin:   '🖥 어드민',
  crawler: '🕷 크롤러',
};

const ALL_CATEGORIES = ['전체', ...Array.from(new Set(ALL_PKGS.map(p => p.category))).sort()];

export default function OpenSourcePage() {
  const [query,     setQuery]     = useState('');
  const [category,  setCategory]  = useState('전체');
  const [platform,  setPlatform]  = useState<'all' | Platform>('all');
  const [status,    setStatus]    = useState<'all' | UpdateStatus>('all');
  const [sortKey,   setSortKey]   = useState<SortKey>('status');
  const [sortAsc,   setSortAsc]   = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    let list = ALL_PKGS.filter(p => {
      const s = getStatus(p);
      const matchQ = !query   || p.name.toLowerCase().includes(query.toLowerCase()) || p.desc.includes(query);
      const matchC = category === '전체'  || p.category === category;
      const matchP = platform === 'all'   || p.platform === platform;
      const matchS = status   === 'all'   || s === status;
      return matchQ && matchC && matchP && matchS;
    });

    const statusOrder = { major: 0, minor: 1, latest: 2 };
    list = [...list].sort((a, b) => {
      if (sortKey === 'status') {
        const cmp = statusOrder[getStatus(a)] - statusOrder[getStatus(b)];
        return sortAsc ? cmp : -cmp;
      }
      if (sortKey === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return sortAsc ? cmp : -cmp;
      }
      const cmp = a.category.localeCompare(b.category);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [query, category, platform, status, sortKey, sortAsc]);

  const counts = useMemo(() => ({
    latest: ALL_PKGS.filter(p => getStatus(p) === 'latest').length,
    minor:  ALL_PKGS.filter(p => getStatus(p) === 'minor').length,
    major:  ALL_PKGS.filter(p => getStatus(p) === 'major').length,
  }), []);

  const statusBadge = (pkg: Pkg) => {
    const s = getStatus(pkg);
    if (s === 'latest') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400">
        <CheckCircle2 size={9} /> 최신
      </span>
    );
    if (s === 'major') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400">
        <AlertCircle size={9} /> 메이저
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400">
        <AlertTriangle size={9} /> 업데이트
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">오픈소스 패키지</h1>
        <p className="text-sm text-muted mt-1">
          언니픽 어드민·크롤러에 사용된 오픈소스 목록 · 총 {ALL_PKGS.length}개
          <span className="ml-2 text-dim text-xs">기준일: 2026-04-28</span>
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setStatus(status === 'latest' ? 'all' : 'latest')}
          className={`rounded-xl p-4 border text-left transition ${status === 'latest' ? 'bg-green-500/10 border-green-500/30' : 'bg-card border-border-main hover:border-green-500/20'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-green-400" />
            <span className="text-xs font-semibold text-green-400">최신</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{counts.latest}</p>
          <p className="text-xs text-muted mt-0.5">업데이트 불필요</p>
        </button>
        <button
          onClick={() => setStatus(status === 'minor' ? 'all' : 'minor')}
          className={`rounded-xl p-4 border text-left transition ${status === 'minor' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card border-border-main hover:border-amber-500/20'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">마이너 업데이트</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{counts.minor}</p>
          <p className="text-xs text-muted mt-0.5">안전하게 업데이트 가능</p>
        </button>
        <button
          onClick={() => setStatus(status === 'major' ? 'all' : 'major')}
          className={`rounded-xl p-4 border text-left transition ${status === 'major' ? 'bg-red-500/10 border-red-500/30' : 'bg-card border-border-main hover:border-red-500/20'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs font-semibold text-red-400">메이저 업그레이드</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{counts.major}</p>
          <p className="text-xs text-muted mt-0.5">Breaking change 가능 — 검토 필요</p>
        </button>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="패키지명, 설명 검색"
          className="w-full bg-card border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
        />
      </div>

      {/* 플랫폼 탭 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'admin', 'crawler'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              platform === p
                ? 'bg-[#FF6F0F] text-primary'
                : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}
          >
            {p === 'all' ? `전체 ${ALL_PKGS.length}` : `${PLATFORM_LABEL[p]} ${p === 'admin' ? ADMIN_PKGS.length : CRAWLER_PKGS.length}`}
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
                ? 'bg-white/15 text-primary border border-border-main'
                : 'bg-card border border-border-main text-muted hover:text-secondary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-main">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted">
                <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-primary transition">
                  패키지
                  <ArrowUpDown size={11} className={sortKey === 'name' ? 'text-[#FF6F0F]' : ''} />
                </button>
              </th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">
                <button onClick={() => toggleSort('category')} className="flex items-center gap-1 hover:text-primary transition">
                  카테고리
                  <ArrowUpDown size={11} className={sortKey === 'category' ? 'text-[#FF6F0F]' : ''} />
                </button>
              </th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">설치 버전</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">최신 버전</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">
                <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-primary transition">
                  상태
                  <ArrowUpDown size={11} className={sortKey === 'status' ? 'text-[#FF6F0F]' : ''} />
                </button>
              </th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">라이선스</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted">링크</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-dim">검색 결과가 없어요</td>
              </tr>
            ) : filtered.map(pkg => {
              const s = getStatus(pkg);
              const rowBg = s === 'major' ? 'hover:bg-red-500/5' : s === 'minor' ? 'hover:bg-amber-500/5' : 'hover:bg-white/[0.02]';
              return (
                <tr key={`${pkg.platform}-${pkg.name}`} className={`border-b border-border-main transition last:border-0 ${rowBg}`}>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-primary font-mono text-xs">{pkg.name}</p>
                    <p className="text-xs text-muted mt-0.5">{pkg.desc}</p>
                    <span className="text-[10px] text-dim">{PLATFORM_LABEL[pkg.platform]}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 bg-fill-subtle rounded text-xs text-tertiary">{pkg.category}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono text-secondary">{pkg.installed}</td>
                  <td className="px-4 py-3.5 text-xs font-mono">
                    <span className={s !== 'latest' ? (s === 'major' ? 'text-red-400 font-bold' : 'text-amber-400 font-semibold') : 'text-dim'}>
                      {pkg.latest}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      {statusBadge(pkg)}
                      {pkg.note && <span className="text-[10px] text-muted leading-tight max-w-[140px]">{pkg.note}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${LICENSE_COLOR[pkg.license] ?? 'bg-fill-subtle text-tertiary'}`}>
                      {pkg.license}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <a
                      href={pkg.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted hover:text-[#FF6F0F] transition"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-dim">
        <span>{filtered.length}개 표시</span>
      </div>

      <div className="mt-6 p-4 bg-white/[0.03] border border-border-main rounded-2xl">
        <p className="text-xs text-dim leading-relaxed">
          위 오픈소스는 각 라이선스 조건에 따라 사용됩니다 · MIT · Apache-2.0 · ISC · BSD-2 · OFL-1.1 원문은 각 저장소에서 확인하세요.
        </p>
      </div>
    </div>
  );
}
