'use client';

import { useState } from 'react';
import { ImagePlus, Download, RefreshCw, Copy, Loader, Sparkles, Check } from 'lucide-react';

const ASSET_TYPES = [
  { id: 'instagram_feed',     label: '인스타 피드',    ratio: '1:1',  size: '1080x1080' },
  { id: 'instagram_story',    label: '인스타 스토리',   ratio: '9:16', size: '1080x1920' },
  { id: 'instagram_carousel', label: '인스타 캐러셀',   ratio: '4:5',  size: '1080x1350' },
  { id: 'web_banner',         label: '웹 배너',        ratio: '16:9', size: '1920x1080' },
  { id: 'youtube_thumbnail',  label: '유튜브 썸네일',   ratio: '16:9', size: '1280x720'  },
];

const STYLE_PRESETS = [
  { id: 'lifestyle-in-context', label: '라이프스타일', desc: '자연스러운 환경 속 제품' },
  { id: 'studio-product-hero',  label: '스튜디오',    desc: '깔끔한 배경, 제품 중심' },
  { id: 'ugc-selfie',           label: 'UGC 셀카',   desc: '아이폰 촬영 느낌' },
  { id: 'cinematic',            label: '시네마틱',    desc: '영화 같은 드라마틱' },
  { id: 'minimalist',           label: '미니멀',      desc: '여백, 단순한 구성' },
  { id: 'editorial-beauty',     label: '에디토리얼',   desc: '매거진 퀄리티' },
];

const CATEGORIES = [
  '카페/음료', '음식점', '뷰티', '패션', '헬스케어', '헤어', '네일', '피트니스', '기타',
];

interface GeneratedImage {
  type: string;
  label: string;
  aspect_ratio: string;
  url: string | null;
  status: 'success' | 'error';
  error?: string;
}

export default function AIImagesPage() {
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [sceneOverride, setSceneOverride] = useState('');
  const [stylePreset, setStylePreset] = useState('lifestyle-in-context');
  const [moodOverride, setMoodOverride] = useState('');
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const toggleAsset = (id: string) => {
    setSelectedAssets(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!storeName.trim() || !category || selectedAssets.length === 0) {
      alert('매장명, 카테고리, 에셋 유형을 모두 선택해주세요.');
      return;
    }

    setGenerating(true);
    setResults([]);

    try {
      const res = await fetch('/api/ai-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName,
          category,
          assets: selectedAssets.map(type => ({
            type,
            aspect_ratio: ASSET_TYPES.find(a => a.id === type)?.ratio || '1:1',
          })),
          subject: subject || undefined,
          scene_override: sceneOverride || undefined,
          style_preset: stylePreset,
          mood_override: moodOverride || undefined,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
    } catch (e: any) {
      alert(`이미지 생성 실패: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main">
        <h1 className="text-lg font-bold text-primary">🎨 AI 마케팅 이미지 생성</h1>
        <p className="text-xs text-muted mt-0.5">매장 정보 입력 → 플랫폼 선택 → AI가 맞춤 이미지 자동 생성</p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* 기본 정보 */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-primary">🏪 매장 정보</h2>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="매장명 (예: 강남 카페 아메노)"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              className="px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm focus:outline-none focus:border-[#FF6F0F]">
              <option value="">카테고리 선택</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <textarea
            placeholder="주요 피사체 설명 (선택, 예: 시그니처 라떼와 당근 케이크)"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none"
          />
          <textarea
            placeholder="배경/환경 설명 (선택, 비우면 카테고리 기본값 사용)"
            value={sceneOverride}
            onChange={e => setSceneOverride(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none"
          />
          <input
            type="text"
            placeholder="분위기 (선택, 예: 따뜻하고 아늑한)"
            value={moodOverride}
            onChange={e => setMoodOverride(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
          />
        </div>

        {/* 에셋 유형 선택 */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-primary">📐 에셋 유형 선택</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {ASSET_TYPES.map(asset => (
              <button
                key={asset.id}
                onClick={() => toggleAsset(asset.id)}
                className={`p-3 rounded-lg border-2 transition text-center ${
                  selectedAssets.includes(asset.id)
                    ? 'bg-[#FF6F0F]/10 border-[#FF6F0F] text-primary'
                    : 'bg-fill-subtle border-border-main text-muted hover:border-border-subtle'
                }`}>
                <div className="text-xs font-bold">{asset.label}</div>
                <div className="text-[10px] text-dim mt-0.5">{asset.ratio} · {asset.size}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 스타일 프리셋 */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-primary">🎨 스타일 프리셋</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STYLE_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => setStylePreset(preset.id)}
                className={`p-3 rounded-lg border-2 transition text-left ${
                  stylePreset === preset.id
                    ? 'bg-purple-500/10 border-purple-500 text-primary'
                    : 'bg-fill-subtle border-border-main text-muted hover:border-border-subtle'
                }`}>
                <div className="text-xs font-bold">{preset.label}</div>
                <div className="text-[10px] text-dim mt-0.5">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 생성 버튼 */}
        <button
          onClick={handleGenerate}
          disabled={generating || !storeName.trim() || !category || selectedAssets.length === 0}
          className="w-full py-3.5 bg-gradient-to-r from-[#FF6F0F] to-[#ff8c3a] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-[#FF6F0F]/20">
          {generating ? (
            <>
              <Loader size={16} className="animate-spin" />
              AI 이미지 생성중... ({selectedAssets.length}장, 장당 약 10초)
            </>
          ) : (
            <>
              <Sparkles size={16} />
              AI 마케팅 이미지 생성 ({selectedAssets.length}장)
            </>
          )}
        </button>
        <p className="text-[10px] text-purple-400/50 text-center font-mono -mt-3">Powered by Gemini 2.5 Flash Image (Nano Banana 2)</p>

        {/* 결과 갤러리 */}
        {results.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-main">
              <h2 className="text-sm font-bold text-primary">🖼️ 생성 결과</h2>
              <p className="text-xs text-muted mt-1">
                성공: {results.filter(r => r.status === 'success').length}장 /
                실패: {results.filter(r => r.status === 'error').length}장
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
              {results.map((result, idx) => (
                <div key={idx} className="bg-fill-subtle border border-border-subtle rounded-lg overflow-hidden">
                  {result.status === 'success' && result.url ? (
                    <>
                      <div className="relative aspect-square bg-black">
                        <img
                          src={result.url}
                          alt={result.label}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute top-2 left-2 text-[10px] font-semibold bg-black/70 text-white px-2 py-0.5 rounded">
                          {result.label} · {result.aspect_ratio}
                        </span>
                      </div>
                      <div className="p-2 flex gap-1.5">
                        <button
                          onClick={() => window.open(result.url!, '_blank')}
                          className="flex-1 py-1.5 text-[10px] font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded hover:border-border-main transition flex items-center justify-center gap-1">
                          <Download size={10} /> 다운로드
                        </button>
                        <button
                          onClick={() => handleCopyUrl(result.url!)}
                          className="flex-1 py-1.5 text-[10px] font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded hover:border-border-main transition flex items-center justify-center gap-1">
                          {copiedUrl === result.url ? <><Check size={10} /> 복사됨</> : <><Copy size={10} /> URL 복사</>}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold text-red-400">{result.label} 생성 실패</p>
                      <p className="text-[10px] text-muted mt-1">{result.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
