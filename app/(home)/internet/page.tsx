'use client';

import { useState } from 'react';
import { Wifi, Phone, ChevronRight, Check, Star, MessageSquare } from 'lucide-react';

const PROVIDERS = [
  { id: 'kt',    name: 'KT',       color: '#E8002D', logo: 'KT' },
  { id: 'lgu',   name: 'LG U+',    color: '#E6007E', logo: 'U+' },
  { id: 'sk',    name: 'SK 브로드밴드', color: '#FF6600', logo: 'SK' },
];

const PLANS = [
  {
    provider: 'kt',
    name: '기가 인터넷',
    speed: '1Gbps',
    price: 33000,
    features: ['최대 1Gbps 속도', 'TV 결합 할인', '설치비 무료', '와이파이 공유기 포함'],
    badge: '인기',
    badgeColor: 'bg-[#E8002D]/15 text-[#E8002D]',
  },
  {
    provider: 'kt',
    name: '슈퍼 기가 인터넷',
    speed: '2.5Gbps',
    price: 44000,
    features: ['최대 2.5Gbps 속도', '게이밍 최적화', 'TV 결합 할인', '프리미엄 공유기 포함'],
    badge: '',
    badgeColor: '',
  },
  {
    provider: 'lgu',
    name: '인터넷 100M',
    speed: '100Mbps',
    price: 19800,
    features: ['100Mbps 속도', '월정액 최저가', '기본 공유기 포함', '결합 할인 가능'],
    badge: '최저가',
    badgeColor: 'bg-[#E6007E]/15 text-[#E6007E]',
  },
  {
    provider: 'lgu',
    name: '인터넷 기가',
    speed: '1Gbps',
    price: 33000,
    features: ['최대 1Gbps 속도', 'IPTV 결합 할인', '설치비 무료', '기가 공유기 포함'],
    badge: '',
    badgeColor: '',
  },
  {
    provider: 'sk',
    name: '기가 라이트',
    speed: '500Mbps',
    price: 28600,
    features: ['500Mbps 속도', '합리적인 가격', '와이파이 공유기 포함', '멤버십 포인트 적립'],
    badge: '',
    badgeColor: '',
  },
  {
    provider: 'sk',
    name: '기가 프리미엄',
    speed: '1Gbps',
    price: 38500,
    features: ['최대 1Gbps 속도', 'T전화·NUGU 서비스', '프리미엄 공유기 포함', 'SK텔레콤 결합 할인'],
    badge: '',
    badgeColor: '',
  },
];

export default function InternetPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const filtered = selectedProvider
    ? PLANS.filter(p => p.provider === selectedProvider)
    : PLANS;

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-950/30 to-transparent px-5 py-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold mb-4">
          <Wifi size={12} /> 인터넷 요금제 비교
        </div>
        <h1 className="text-2xl font-extrabold text-primary mb-2">
          통신사별 인터넷 요금제<br />한 눈에 비교하세요
        </h1>
        <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
          KT · LG U+ · SK 브로드밴드 요금제를 비교하고<br />
          무료 상담으로 최적 플랜을 추천받으세요
        </p>
      </section>

      <div className="max-w-[640px] mx-auto w-full px-4 pb-16 space-y-8">
        {/* Provider filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedProvider(null)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${
              !selectedProvider
                ? 'bg-primary text-surface'
                : 'bg-fill-subtle text-secondary border border-border-main'
            }`}
          >
            전체
          </button>
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProvider(prev => prev === p.id ? null : p.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition ${
                selectedProvider === p.id
                  ? 'text-white'
                  : 'bg-fill-subtle text-secondary border border-border-main'
              }`}
              style={selectedProvider === p.id ? { backgroundColor: p.color } : {}}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div className="space-y-3">
          {filtered.map((plan, i) => {
            const provider = PROVIDERS.find(p => p.id === plan.provider)!;
            return (
              <div
                key={i}
                className="bg-card border border-border-main rounded-2xl p-5 hover:border-blue-500/30 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-extrabold shrink-0"
                      style={{ backgroundColor: provider.color }}
                    >
                      {provider.logo}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-primary text-sm">{plan.name}</p>
                        {plan.badge && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${plan.badgeColor}`}>
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{provider.name} · {plan.speed}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-primary">
                      {plan.price.toLocaleString()}원
                    </p>
                    <p className="text-[10px] text-muted">/월 (부가세 포함)</p>
                  </div>
                </div>

                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-secondary">
                      <Check size={11} className="text-blue-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button className="w-full py-2.5 rounded-xl bg-fill-subtle hover:bg-fill-medium border border-border-main text-sm font-semibold text-secondary transition flex items-center justify-center gap-1.5">
                  <Phone size={13} /> 무료 상담 신청 <ChevronRight size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Consultation form */}
        <div className="bg-card border border-border-main rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-blue-400" />
            <h2 className="font-bold text-primary">무료 상담 신청</h2>
          </div>

          {submitted ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-blue-400" />
              </div>
              <p className="font-bold text-primary mb-1">상담 신청 완료!</p>
              <p className="text-sm text-muted">전문 상담사가 24시간 내 연락드립니다.</p>
            </div>
          ) : (
            <form onSubmit={handleConsult} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">이름</label>
                <input
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-fill-subtle border border-border-main text-sm text-primary placeholder:text-dim focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1.5">연락처</label>
                <input
                  type="tel"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-fill-subtle border border-border-main text-sm text-primary placeholder:text-dim focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !phone.trim()}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>무료 상담 신청 <ChevronRight size={14} /></>
                )}
              </button>
              <p className="text-[11px] text-dim text-center">
                입력 정보는 상담 목적으로만 사용됩니다
              </p>
            </form>
          )}
        </div>

        {/* Reviews */}
        <div>
          <h2 className="font-bold text-primary mb-3">고객 후기</h2>
          <div className="space-y-3">
            {[
              { name: '김○○', review: '상담사분이 친절하게 설명해주셔서 KT 기가 인터넷으로 결정했어요. 설치도 빠르고 만족합니다!', rating: 5 },
              { name: '이○○', review: 'LG U+ 100M 요금제로 바꿨는데 가격도 저렴하고 속도도 충분해요. 추천드립니다.', rating: 5 },
              { name: '박○○', review: 'SK 브로드밴드 무료 설치 이벤트로 혜택 많이 받았습니다. 좋은 서비스 감사해요.', rating: 4 },
            ].map((r, i) => (
              <div key={i} className="bg-card border border-border-main rounded-xl p-4">
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(r.rating)].map((_, j) => (
                    <Star key={j} size={11} className="text-yellow-400 fill-yellow-400" />
                  ))}
                  {[...Array(5 - r.rating)].map((_, j) => (
                    <Star key={j} size={11} className="text-dim" />
                  ))}
                  <span className="text-xs font-semibold text-secondary ml-1">{r.name}</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">{r.review}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
