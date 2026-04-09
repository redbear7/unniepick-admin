'use client';

import { useState, useCallback } from 'react';
import { ImagePlus, Download, Copy, Loader, Sparkles, Check, ChevronLeft, ChevronRight, RotateCcw, Eye, EyeOff, ClipboardPaste, X, Upload } from 'lucide-react';

// ── 에셋 유형 ──────────────────────────────────────────────
const ASSET_TYPES = [
  { id: 'instagram_feed',     label: '인스타 피드',    ratio: '1:1',  size: '1080×1080' },
  { id: 'instagram_story',    label: '인스타 스토리',   ratio: '9:16', size: '1080×1920' },
  { id: 'instagram_carousel', label: '인스타 캐러셀',   ratio: '4:5',  size: '1080×1350' },
  { id: 'web_banner',         label: '웹 배너',        ratio: '16:9', size: '1920×1080' },
  { id: 'youtube_thumbnail',  label: '유튜브 썸네일',   ratio: '16:9', size: '1280×720'  },
];

// ── 8개 카테고리 + 세부 스타일 ──────────────────────────────

interface StyleOption {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  gradient: string;
  defaults: {
    subject: string;
    scene: string;
    mood: string;
    stylePreset: string;
    storeCategory: string;
  };
}

interface WizardCategory {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  gradient: string;
  styles: StyleOption[];
}

const WIZARD_CATEGORIES: WizardCategory[] = [
  {
    id: 'portraits', name: '인물 / 헤드샷', emoji: '📸', desc: '프로필, 비즈니스, SNS용 인물 사진',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    styles: [
      { id: 'linkedin', name: '링크드인 권위', desc: '전문적이고 신뢰감 있는 헤드샷', emoji: '💼',
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
        defaults: { subject: '자신감 있는 비즈니스 전문가, 네이비 블레이저, 밝은 미소', scene: '현대적 사무실, 큰 창문, 도시 스카이라인 배경', mood: '자신감, 친근함', stylePreset: 'editorial-lifestyle', storeCategory: '기타' } },
      { id: 'founder', name: '친근한 창업자', desc: '캐주얼하지만 전문적인 느낌', emoji: '🚀',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        defaults: { subject: '30대 창업자, 블랙 티셔츠, 편안한 자세', scene: '밝은 코워킹 스페이스, 벽돌벽, 화이트보드', mood: '에너지, 친근함', stylePreset: 'lifestyle-in-context', storeCategory: '기타' } },
      { id: 'speaker', name: '컨퍼런스 연사', desc: 'TED 스타일 무대 연사', emoji: '🎤',
        gradient: 'linear-gradient(135deg, #0c3547 0%, #e74c3c 100%)',
        defaults: { subject: '열정적인 연사, 수트 재킷, 제스처 중', scene: '컨퍼런스 무대, LED 스크린, 스포트라이트', mood: '파워풀, 영감', stylePreset: 'cinematic', storeCategory: '기타' } },
      { id: 'creative', name: '크리에이티브', desc: '예술적이고 개성있는 인물', emoji: '🎨',
        gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        defaults: { subject: '컬러 젤 조명 아래 크리에이티브 전문가', scene: '아트 스튜디오, 작품이 보이는 배경', mood: '창의적, 모던', stylePreset: 'editorial-beauty', storeCategory: '기타' } },
    ],
  },
  {
    id: 'products', name: '제품 촬영', emoji: '📦', desc: '쇼핑몰, 카탈로그, SNS용 제품 사진',
    gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    styles: [
      { id: 'hero', name: '클린 히어로', desc: '깔끔한 배경, 제품 중심', emoji: '✨',
        gradient: 'linear-gradient(135deg, #f8f9fa 0%, #dee2e6 100%)',
        defaults: { subject: '[제품명] — 정면, 라벨이 보이게, 히어로 앵글', scene: '그라디언트 배경 (화이트→라이트 그레이), 매트 표면', mood: '프리미엄, 깔끔', stylePreset: 'studio-product-hero', storeCategory: '기타' } },
      { id: 'lifestyle', name: '라이프스타일', desc: '실제 환경 속 자연스러운 제품', emoji: '🏡',
        gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        defaults: { subject: '[제품명] — 자연스럽게 놓인, 라벨 일부 보이는', scene: '아늑한 욕실 카운터, 대리석, 아침 햇살', mood: '아늑한, 진정성', stylePreset: 'lifestyle-in-context', storeCategory: '뷰티' } },
      { id: 'flatlay', name: '플랫레이', desc: '위에서 내려다본 스타일링', emoji: '🍃',
        gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        defaults: { subject: '[제품명] — 성분/소품에 둘러싸인 플랫레이', scene: '리넨 천 또는 나무 보드 위, 허브, 시트러스 슬라이스', mood: '정돈된, 에디토리얼', stylePreset: 'lifestyle-in-context', storeCategory: '뷰티' } },
      { id: 'unboxing', name: '언박싱', desc: '개봉 순간의 설렘', emoji: '🎁',
        gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        defaults: { subject: '손으로 제품을 박스에서 꺼내는 장면', scene: '깔끔한 데스크, 브랜드 패키징, 티슈페이퍼', mood: '설렘, 발견', stylePreset: 'lifestyle-in-context', storeCategory: '기타' } },
      { id: 'beforeafter', name: 'Before/After', desc: '전/후 비교 이미지', emoji: '🔄',
        gradient: 'linear-gradient(135deg, #868e96 0%, #ffd43b 100%)',
        defaults: { subject: '왼쪽 BEFORE (무광), 오른쪽 AFTER (생기있는) 분할', scene: '동일한 조명, 동일한 각도, 상태만 변화', mood: '변화, 증거', stylePreset: 'studio-product-hero', storeCategory: '뷰티' } },
    ],
  },
  {
    id: 'social', name: 'SNS 그래픽', emoji: '📱', desc: '인스타, 트위터, 링크드인 피드용 그래픽',
    gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    styles: [
      { id: 'bold-statement', name: '대담한 문구', desc: '강렬한 텍스트 포스트', emoji: '💬',
        gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        defaults: { subject: '텍스트 그래픽 — 대담한 문구 포스트', scene: '다크 그라디언트 배경 (네이비→퍼플)', mood: '대담한, 권위', stylePreset: 'minimalist', storeCategory: '기타' } },
      { id: 'data-card', name: '데이터 카드', desc: '"알고 계셨나요?" 통계', emoji: '📊',
        gradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
        defaults: { subject: '핵심 통계 하나를 강조한 데이터 카드', scene: '화이트 카드 디자인, 파스텔 배경', mood: '정보, 깔끔', stylePreset: 'minimalist', storeCategory: '기타' } },
      { id: 'carousel', name: '캐러셀 커버', desc: '스와이프 시작 슬라이드', emoji: '➡️',
        gradient: 'linear-gradient(135deg, #0f9b8e 0%, #1a1a2e 100%)',
        defaults: { subject: '후킹 헤드라인이 있는 캐러셀 커버', scene: '그라디언트 배경 (틸→네이비), 라이트 릭', mood: '호기심, 스크롤 멈춤', stylePreset: 'minimalist', storeCategory: '기타' } },
      { id: 'testimonial', name: '고객 후기', desc: '리뷰/추천 카드', emoji: '⭐',
        gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
        defaults: { subject: '별 5개 + 후기 문구가 담긴 카드', scene: '크림/베이지 배경, 큰 인용부호 장식', mood: '신뢰, 따뜻함', stylePreset: 'minimalist', storeCategory: '기타' } },
    ],
  },
  {
    id: 'ads', name: '광고 크리에이티브', emoji: '📣', desc: '페이스북, 인스타 광고용 이미지',
    gradient: 'linear-gradient(135deg, #ff6b35 0%, #f7c948 100%)',
    styles: [
      { id: 'ugc-ad', name: 'UGC 광고', desc: '일반인 촬영 느낌의 광고', emoji: '🤳',
        gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
        defaults: { subject: '20대 후반 여성, 제품을 들고 셀카, 진짜 흥분한 표정', scene: '실제 욕실, 약간 어수선하지만 자연스러운', mood: '진짜, 흥분', stylePreset: 'ugc-selfie', storeCategory: '뷰티' } },
      { id: 'hero-banner', name: '히어로 배너', desc: '대형 배너 광고', emoji: '🏆',
        gradient: 'linear-gradient(135deg, #0c3547 0%, #1a1a2e 100%)',
        defaults: { subject: '[제품명] — 드라마틱한 조명의 히어로 앵글', scene: '추상적 그라디언트 + 빛줄기, 반사 표면', mood: '프리미엄, 열망', stylePreset: 'cinematic', storeCategory: '기타' } },
      { id: 'story-ad', name: '스토리 광고', desc: '세로형 스토리/릴 광고', emoji: '📲',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        defaults: { subject: '제품 사용 중인 인물, 혜택 텍스트 오버레이', scene: '자연스러운 일상 환경, 밝은 조명', mood: '에너지, 행동 유발', stylePreset: 'ugc-selfie', storeCategory: '뷰티' } },
    ],
  },
  {
    id: 'brand', name: '브랜드 에셋', emoji: '🏷️', desc: '이메일, 프레젠테이션, 블로그 헤더',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    styles: [
      { id: 'email-header', name: '이메일 헤더', desc: '뉴스레터 상단 배너', emoji: '📧',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        defaults: { subject: '브랜드 로고 + 태그라인 배너', scene: '브랜드 컬러 그라디언트, 깔끔한', mood: '전문적, 일관된', stylePreset: 'minimalist', storeCategory: '기타' } },
      { id: 'presentation', name: '프레젠테이션', desc: '발표 슬라이드 타이틀', emoji: '📊',
        gradient: 'linear-gradient(135deg, #0c3547 0%, #203a43 100%)',
        defaults: { subject: '프레젠테이션 타이틀 슬라이드', scene: '다크 배경 + 브랜드 컬러 추상 쉐이프', mood: '전문적, 세련된', stylePreset: 'minimalist', storeCategory: '기타' } },
      { id: 'blog-hero', name: '블로그 히어로', desc: '블로그 포스트 상단 이미지', emoji: '📝',
        gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        defaults: { subject: '주제 관련 라이프스타일 장면', scene: '자연광, 환경에 맞는 배경', mood: '영감, 전문적', stylePreset: 'lifestyle-in-context', storeCategory: '기타' } },
    ],
  },
  {
    id: 'infographic', name: '인포그래픽', emoji: '📈', desc: '데이터 시각화, 프로세스 도식',
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    styles: [
      { id: 'process', name: '프로세스 플로', desc: '단계별 안내 인포그래픽', emoji: '🔢',
        gradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
        defaults: { subject: 'Step 1→2→3 프로세스 도식', scene: '화이트 배경, 그리드 패턴', mood: '교육적, 명확', stylePreset: 'minimalist', storeCategory: '기타' } },
      { id: 'comparison', name: '비교표', desc: '체크마크 기능 비교', emoji: '✅',
        gradient: 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)',
        defaults: { subject: '2~3열 비교표, 체크마크/X마크', scene: '깔끔한 화이트 배경', mood: '명확, 정보', stylePreset: 'minimalist', storeCategory: '기타' } },
      { id: 'stats', name: '통계 대시보드', desc: '핵심 지표 카드 레이아웃', emoji: '📊',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        defaults: { subject: '4~6개 핵심 지표 카드, 트렌드 화살표', scene: '다크 또는 화이트 배경, 브랜드 컬러', mood: '데이터 중심, 전문적', stylePreset: 'minimalist', storeCategory: '기타' } },
    ],
  },
  {
    id: 'editing', name: '이미지 편집', emoji: '🖌️', desc: '배경 교체, 색감 변경, 보정',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    styles: [
      { id: 'bg-swap', name: '배경 교체', desc: '인물/제품 유지, 배경만 변경', emoji: '🏞️',
        gradient: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
        defaults: { subject: '기존 사진의 인물을 유지하고 배경만 교체', scene: '[원하는 새 배경 설명]', mood: '자연스러운 합성', stylePreset: 'lifestyle-in-context', storeCategory: '기타' } },
      { id: 'color-regrade', name: '색감 변경', desc: '전체 톤 & 분위기 변환', emoji: '🌈',
        gradient: 'linear-gradient(135deg, #fd79a8 0%, #6c5ce7 100%)',
        defaults: { subject: '기존 이미지의 전체 색 무드 변환', scene: '동일 장면, 색감만 변경', mood: '따뜻한/차가운/시네마틱 선택', stylePreset: 'cinematic', storeCategory: '기타' } },
      { id: 'enhance', name: '프로필 보정', desc: '헤드샷 보정 & 배경 정리', emoji: '💎',
        gradient: 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)',
        defaults: { subject: '헤드샷 보정: 배경 보케 처리, 피부톤 워밍', scene: '부드러운 보케 배경', mood: '자연스러운 보정', stylePreset: 'editorial-beauty', storeCategory: '기타' } },
    ],
  },
  {
    id: 'creative', name: '크리에이티브', emoji: '🎭', desc: '캐릭터 시리즈, 네온, 매거진 커버',
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    styles: [
      { id: 'character-series', name: '캐릭터 시리즈', desc: '같은 인물 여러 장면', emoji: '👤',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        defaults: { subject: '동일 캐릭터 — 구체적 특징 [왼쪽 볼 점, 보조개 등] 명시', scene: '[시리즈마다 다른 장소]', mood: '일관된, 전문적', stylePreset: 'editorial-lifestyle', storeCategory: '기타' } },
      { id: 'neon-sign', name: '네온 사인', desc: '어두운 벽돌벽 위 빛나는 글씨', emoji: '💡',
        gradient: 'linear-gradient(135deg, #0c0c1d 0%, #7b2ff7 100%)',
        defaults: { subject: '빛나는 네온 사인 — [텍스트/태그라인]', scene: '어두운 벽돌벽, 은은한 조명', mood: '모던, 분위기', stylePreset: 'cinematic', storeCategory: '기타' } },
      { id: 'magazine', name: '매거진 커버', desc: '잡지 표지 스타일', emoji: '📰',
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #2c3e50 100%)',
        defaults: { subject: '인물/브랜드를 매거진 커버 스타일로', scene: '화이트 또는 단색 배경, 바코드 디테일', mood: '세련된, 프리미엄', stylePreset: 'editorial-beauty', storeCategory: '기타' } },
    ],
  },
];

// ── 인터페이스 ──────────────────────────────────────────────

interface GeneratedImage {
  type: string;
  label: string;
  aspect_ratio: string;
  url: string | null;
  status: 'success' | 'error';
  error?: string;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────

export default function AIImagesPage() {
  // 위저드 상태
  const [step, setStep] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  // Step 3 폼
  const [storeName, setStoreName] = useState('');
  const [subject, setSubject] = useState('');
  const [sceneOverride, setSceneOverride] = useState('');
  const [moodOverride, setMoodOverride] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['instagram_feed']);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Step 4 결과
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // 커스텀 썸네일 이미지 (localStorage 저장)
  // key: "cat_{categoryId}" 또는 "style_{categoryId}_{styleId}"
  const [customImages, setCustomImages] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('ai_images_thumbnails') || '{}');
    } catch { return {}; }
  });

  const saveCustomImage = (key: string, dataUrl: string) => {
    const updated = { ...customImages, [key]: dataUrl };
    setCustomImages(updated);
    localStorage.setItem('ai_images_thumbnails', JSON.stringify(updated));
  };

  const removeCustomImage = (key: string) => {
    const updated = { ...customImages };
    delete updated[key];
    setCustomImages(updated);
    localStorage.setItem('ai_images_thumbnails', JSON.stringify(updated));
  };

  // 클립보드에서 이미지 붙여넣기
  const handlePasteImage = useCallback(async (key: string) => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = () => {
            saveCustomImage(key, reader.result as string);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      alert('클립보드에 이미지가 없습니다. 이미지를 먼저 복사해주세요.');
    } catch (e: any) {
      alert('클립보드 읽기 실패: ' + e.message);
    }
  }, [customImages]);

  // 파일 업로드로 이미지 설정
  const handleFileUpload = useCallback((key: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      saveCustomImage(key, reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [customImages]);

  // 파생 데이터
  const selectedCategory = WIZARD_CATEGORIES.find(c => c.id === selectedCategoryId);
  const selectedStyle = selectedCategory?.styles.find(s => s.id === selectedStyleId);

  // ── 핸들러 ──────────────────────────────────────────────

  const handleSelectCategory = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedStyleId(null);
  };

  const handleSelectStyle = (id: string) => {
    setSelectedStyleId(id);
    const style = selectedCategory?.styles.find(s => s.id === id);
    if (style) {
      setSubject(style.defaults.subject);
      setSceneOverride(style.defaults.scene);
      setMoodOverride(style.defaults.mood);
    }
  };

  const handleGenerate = async () => {
    if (!storeName.trim() || selectedAssets.length === 0) {
      alert('매장명과 에셋 유형을 선택해주세요.');
      return;
    }

    setStep(4);
    setGenerating(true);
    setResults([]);

    try {
      const res = await fetch('/api/ai-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName,
          category: selectedStyle?.defaults.storeCategory || '기타',
          assets: selectedAssets.map(type => ({
            type,
            aspect_ratio: ASSET_TYPES.find(a => a.id === type)?.ratio || '1:1',
          })),
          subject: subject || undefined,
          scene_override: sceneOverride || undefined,
          style_preset: selectedStyle?.defaults.stylePreset || 'lifestyle-in-context',
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

  const toggleAsset = (id: string) => {
    setSelectedAssets(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const resetAll = () => {
    setStep(1);
    setSelectedCategoryId(null);
    setSelectedStyleId(null);
    setStoreName('');
    setSubject('');
    setSceneOverride('');
    setMoodOverride('');
    setSelectedAssets(['instagram_feed']);
    setResults([]);
  };

  // ── Step Indicator ──────────────────────────────────────

  const STEPS = [
    { num: 1, label: '카테고리' },
    { num: 2, label: '스타일' },
    { num: 3, label: '맞춤 설정' },
    { num: 4, label: '결과' },
  ];

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-1 px-6 py-3">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <button
            onClick={() => s.num < step && setStep(s.num)}
            disabled={s.num > step}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              s.num === step
                ? 'bg-[#FF6F0F] text-white'
                : s.num < step
                ? 'bg-[#FF6F0F]/20 text-[#FF6F0F] cursor-pointer hover:bg-[#FF6F0F]/30'
                : 'bg-fill-subtle text-muted cursor-not-allowed'
            }`}>
            {s.num < step ? <Check size={12} /> : <span>{s.num}</span>}
            <span>{s.label}</span>
          </button>
          {i < STEPS.length - 1 && (
            <ChevronRight size={14} className="text-muted mx-1" />
          )}
        </div>
      ))}
    </div>
  );

  // ── Step 1: 카테고리 선택 ────────────────────────────────

  const StepCategory = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-base font-bold text-primary">어떤 이미지를 만들까요?</h2>
        <p className="text-xs text-muted mt-1">카테고리를 선택하면 세부 스타일을 고를 수 있어요</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {WIZARD_CATEGORIES.map(cat => {
          const imgKey = `cat_${cat.id}`;
          const customImg = customImages[imgKey];
          let fileRef: HTMLInputElement | null = null;

          return (
            <div key={cat.id} className={`group relative overflow-hidden rounded-xl border-2 transition-all hover:scale-[1.02] ${
              selectedCategoryId === cat.id
                ? 'border-[#FF6F0F] shadow-lg shadow-[#FF6F0F]/20'
                : 'border-border-subtle hover:border-border-main'
            }`}>
              {/* 썸네일 영역 */}
              <div
                className="h-28 flex items-center justify-center relative cursor-pointer overflow-hidden"
                style={customImg ? undefined : { background: cat.gradient }}
                onClick={() => handleSelectCategory(cat.id)}>
                {customImg ? (
                  <img src={customImg} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl drop-shadow-lg">{cat.emoji}</span>
                )}

                {/* 이미지 변경 버튼 (호버 시 표시) */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100"
                  onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handlePasteImage(imgKey)}
                    className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition" title="클립보드에서 붙여넣기">
                    <ClipboardPaste size={14} className="text-gray-800" />
                  </button>
                  <button
                    onClick={() => fileRef?.click()}
                    className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition" title="파일 업로드">
                    <Upload size={14} className="text-gray-800" />
                  </button>
                  {customImg && (
                    <button
                      onClick={() => removeCustomImage(imgKey)}
                      className="p-1.5 bg-red-500/90 rounded-lg hover:bg-red-500 transition" title="기본으로 복원">
                      <X size={14} className="text-white" />
                    </button>
                  )}
                </div>
                <input ref={el => { fileRef = el; }} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileUpload(imgKey, e.target.files[0]); }} />
              </div>

              {/* 텍스트 영역 */}
              <div className="p-3 bg-surface cursor-pointer" onClick={() => handleSelectCategory(cat.id)}>
                <p className="text-xs font-bold text-primary">{cat.name}</p>
                <p className="text-[10px] text-muted mt-0.5">{cat.desc}</p>
                <p className="text-[10px] text-dim mt-1">{cat.styles.length}개 스타일</p>
              </div>

              {selectedCategoryId === cat.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#FF6F0F] rounded-full flex items-center justify-center pointer-events-none">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 선택된 카테고리의 스타일 미리보기 */}
      {selectedCategory && (
        <div className="bg-surface border border-border-subtle rounded-xl p-4 mt-4">
          <p className="text-xs font-bold text-primary mb-3">
            {selectedCategory.emoji} {selectedCategory.name} — 스타일 미리보기
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {selectedCategory.styles.map(style => {
              const sImgKey = `style_${selectedCategory.id}_${style.id}`;
              const sCustomImg = customImages[sImgKey];
              return (
                <div key={style.id} className="shrink-0 w-28">
                  <div
                    className="h-16 rounded-lg flex items-center justify-center overflow-hidden"
                    style={sCustomImg ? undefined : { background: style.gradient }}>
                    {sCustomImg ? (
                      <img src={sCustomImg} alt={style.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{style.emoji}</span>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-primary mt-1.5 text-center">{style.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 2: 스타일 선택 ──────────────────────────────────

  const StepStyle = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-base font-bold text-primary">
          {selectedCategory?.emoji} {selectedCategory?.name} — 스타일 선택
        </h2>
        <p className="text-xs text-muted mt-1">원하는 스타일을 선택하세요. 다음 단계에서 세부 조정할 수 있어요.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {selectedCategory?.styles.map(style => {
          const sKey = `style_${selectedCategory.id}_${style.id}`;
          const sImg = customImages[sKey];
          let sFileRef: HTMLInputElement | null = null;

          return (
            <div
              key={style.id}
              className={`group relative overflow-hidden rounded-xl border-2 transition-all hover:scale-[1.02] text-left ${
                selectedStyleId === style.id
                  ? 'border-[#FF6F0F] shadow-lg shadow-[#FF6F0F]/20'
                  : 'border-border-subtle hover:border-border-main'
              }`}>
              <div
                className="h-36 flex items-center justify-center relative cursor-pointer overflow-hidden"
                style={sImg ? undefined : { background: style.gradient }}
                onClick={() => handleSelectStyle(style.id)}>
                {sImg ? (
                  <img src={sImg} alt={style.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl drop-shadow-lg">{style.emoji}</span>
                )}

                {/* 이미지 변경 오버레이 */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100"
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => handlePasteImage(sKey)}
                    className="p-2 bg-white/90 rounded-lg hover:bg-white transition flex items-center gap-1 text-[10px] font-bold text-gray-800"
                    title="클립보드에서 붙여넣기">
                    <ClipboardPaste size={14} /> PASTE
                  </button>
                  <button onClick={() => sFileRef?.click()}
                    className="p-2 bg-white/90 rounded-lg hover:bg-white transition"
                    title="파일 업로드">
                    <Upload size={14} className="text-gray-800" />
                  </button>
                  {sImg && (
                    <button onClick={() => removeCustomImage(sKey)}
                      className="p-2 bg-red-500/90 rounded-lg hover:bg-red-500 transition"
                      title="기본으로 복원">
                      <X size={14} className="text-white" />
                    </button>
                  )}
                </div>
                <input ref={el => { sFileRef = el; }} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileUpload(sKey, e.target.files[0]); }} />

                {selectedStyleId === style.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-[#FF6F0F] rounded-full flex items-center justify-center pointer-events-none">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </div>
              <div className="p-3 bg-surface cursor-pointer" onClick={() => handleSelectStyle(style.id)}>
                <p className="text-sm font-bold text-primary">{style.name}</p>
                <p className="text-[10px] text-muted mt-0.5">{style.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Step 3: 맞춤 설정 ────────────────────────────────────

  const StepCustomize = () => (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-base font-bold text-primary">
          {selectedStyle?.emoji} {selectedStyle?.name} — 맞춤 설정
        </h2>
        <p className="text-xs text-muted mt-1">기본값이 채워져 있어요. 원하는 부분만 수정하세요.</p>
      </div>

      {/* 선택된 스타일 미리보기 */}
      <div className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-3">
        {(() => {
          const previewKey = `style_${selectedCategoryId}_${selectedStyleId}`;
          const previewImg = customImages[previewKey];
          return (
            <div
              className="w-16 h-16 rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
              style={previewImg ? undefined : { background: selectedStyle?.gradient }}>
              {previewImg ? (
                <img src={previewImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">{selectedStyle?.emoji}</span>
              )}
            </div>
          );
        })()}
        <div>
          <p className="text-sm font-bold text-primary">{selectedCategory?.name} → {selectedStyle?.name}</p>
          <p className="text-xs text-muted">{selectedStyle?.desc}</p>
        </div>
      </div>

      {/* 매장 정보 */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-[#FF6F0F]">🏪 매장 정보</h3>
        <input
          type="text"
          placeholder="매장명 (필수, 예: 강남 카페 아메노)"
          value={storeName}
          onChange={e => setStoreName(e.target.value)}
          className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
        />
      </div>

      {/* 이미지 설정 */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-[#FF6F0F]">🎯 이미지 설정</h3>
        <div>
          <label className="text-[10px] font-semibold text-muted mb-1 block">주요 피사체</label>
          <textarea
            value={subject}
            onChange={e => setSubject(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted mb-1 block">배경 / 환경</label>
          <textarea
            value={sceneOverride}
            onChange={e => setSceneOverride(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted mb-1 block">분위기</label>
          <input
            type="text"
            value={moodOverride}
            onChange={e => setMoodOverride(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
          />
        </div>
      </div>

      {/* 플랫폼 선택 */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-[#FF6F0F]">📐 플랫폼 / 비율 선택</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ASSET_TYPES.map(asset => (
            <button
              key={asset.id}
              onClick={() => toggleAsset(asset.id)}
              className={`p-2.5 rounded-lg border-2 transition text-center ${
                selectedAssets.includes(asset.id)
                  ? 'bg-[#FF6F0F]/10 border-[#FF6F0F] text-primary'
                  : 'bg-fill-subtle border-border-main text-muted hover:border-border-subtle'
              }`}>
              <div className="text-xs font-bold">{asset.label}</div>
              <div className="text-[10px] text-dim mt-0.5">{asset.ratio}</div>
            </button>
          ))}
        </div>
      </div>

      {/* JSON 프롬프트 미리보기 */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPromptPreview(!showPromptPreview)}
          className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-muted hover:text-primary transition">
          <span>📋 JSON 프롬프트 미리보기</span>
          {showPromptPreview ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {showPromptPreview && (
          <pre className="px-5 pb-4 text-[10px] text-muted overflow-x-auto leading-relaxed">
            {JSON.stringify({
              store_name: storeName,
              category: selectedStyle?.defaults.storeCategory,
              style_preset: selectedStyle?.defaults.stylePreset,
              subject,
              scene: sceneOverride,
              mood: moodOverride,
              assets: selectedAssets,
            }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );

  // ── Step 4: 결과 ──────────────────────────────────────────

  const StepResults = () => (
    <div className="space-y-5">
      {generating ? (
        <div className="text-center py-16 space-y-4">
          <Loader size={40} className="animate-spin text-[#FF6F0F] mx-auto" />
          <div>
            <p className="text-sm font-bold text-primary">AI 이미지 생성중...</p>
            <p className="text-xs text-muted mt-1">{selectedAssets.length}장 생성 · 장당 약 10초</p>
          </div>
          <div className="w-48 h-1.5 bg-fill-subtle rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-[#FF6F0F] rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="text-center">
            <h2 className="text-base font-bold text-primary">🖼️ 생성 완료!</h2>
            <p className="text-xs text-muted mt-1">
              성공 {results.filter(r => r.status === 'success').length}장 /
              실패 {results.filter(r => r.status === 'error').length}장
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {results.map((result, idx) => (
              <div key={idx} className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
                {result.status === 'success' && result.url ? (
                  <>
                    <div className="relative aspect-square bg-black/50">
                      <img src={result.url} alt={result.label} className="w-full h-full object-contain" />
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
                    <p className="text-xs font-semibold text-red-400">{result.label} 실패</p>
                    <p className="text-[10px] text-muted mt-1">{result.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 네비게이션 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => { setResults([]); setStep(2); }}
              className="flex-1 py-2.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-semibold rounded-lg hover:bg-purple-500/20 transition flex items-center justify-center gap-2">
              <RotateCcw size={14} /> 다른 스타일로
            </button>
            <button
              onClick={resetAll}
              className="flex-1 py-2.5 bg-fill-subtle border border-border-subtle text-muted text-sm font-semibold rounded-lg hover:border-border-main transition flex items-center justify-center gap-2">
              <RotateCcw size={14} /> 처음부터
            </button>
          </div>
        </>
      ) : null}
    </div>
  );

  // ── 하단 네비게이션 ──────────────────────────────────────

  const canGoNext = () => {
    if (step === 1) return !!selectedCategoryId;
    if (step === 2) return !!selectedStyleId;
    if (step === 3) return !!storeName.trim() && selectedAssets.length > 0;
    return false;
  };

  const BottomNav = () => {
    if (step === 4) return null;
    return (
      <div className="px-6 py-3 border-t border-border-main flex items-center justify-between">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronLeft size={16} /> 이전
        </button>

        {step === 3 ? (
          <button
            onClick={handleGenerate}
            disabled={!canGoNext()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#FF6F0F] to-[#ff8c3a] text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-[#FF6F0F]/20">
            <Sparkles size={14} /> 이미지 생성 ({selectedAssets.length}장)
          </button>
        ) : (
          <button
            onClick={() => setStep(s => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
            disabled={!canGoNext()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-[#FF6F0F] hover:bg-[#FF6F0F]/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition">
            다음 <ChevronRight size={16} />
          </button>
        )}
      </div>
    );
  };

  // ── 렌더링 ──────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main">
        <h1 className="text-lg font-bold text-primary">🎨 AI 마케팅 이미지 생성</h1>
        <p className="text-xs text-muted mt-0.5">카테고리 선택 → 스타일 선택 → 맞춤 설정 → 생성</p>
      </div>

      {/* 스텝 인디케이터 */}
      <StepIndicator />

      {/* 스텝 콘텐츠 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {step === 1 && <StepCategory />}
        {step === 2 && <StepStyle />}
        {step === 3 && <StepCustomize />}
        {step === 4 && <StepResults />}
      </div>

      {/* 하단 네비게이션 */}
      <BottomNav />

      {/* 푸터 */}
      <p className="text-[10px] text-purple-400/30 text-center font-mono py-1">
        Powered by Gemini 2.5 Flash Image · Nano Banana 2
      </p>
    </div>
  );
}
