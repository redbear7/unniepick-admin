'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import ApplyModal from '@/components/ApplyModal';
import RecommendFeed from '@/components/RecommendFeed';

export default function AppPage() {
  const [howTab,    setHowTab]    = useState<'customer' | 'owner'>('customer');
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <div className={styles.root}>

      {/* ① HEADER */}
      <header className={styles.header}>
        <div className={styles.wrap}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.logo}>
              <div className={styles.logoIcon}>🩷</div>
              언니픽
            </Link>
            <nav className={styles.headerNav}>
              <a href="#stores" className="active">가게 찾기</a>
              <a href="#recommend">추천맛집</a>
              <a href="#coupons">쿠폰</a>
              <a href="#stamp">스탬프</a>
              <a href="#owner">사장님</a>
            </nav>
            <div className={styles.headerRight}>
              <Link href="/apply" className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}>가게 등록</Link>
              <a href="#app-download" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>앱 다운로드</a>
            </div>
          </div>
        </div>
      </header>

      {/* ② HERO */}
      <section className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.heroInner}>
            {/* 좌측 텍스트 */}
            <div>
              <div className={styles.heroLabel}>🎟 동네 가게 쿠폰 &amp; 스탬프 앱</div>
              <h1 className={styles.heroTitle}>
                주변 가게에서<br />
                <em>쿠폰 받고</em><br />
                스탬프 모으세요
              </h1>
              <p className={styles.heroDesc}>
                카페, 한식, 고깃집, 분식집…<br />
                동네 가게들의 쿠폰을 한 곳에서 받고,<br />
                방문할수록 쌓이는 스탬프로 리워드를 누리세요.
              </p>
              <div className={styles.heroBtns}>
                <a href="#app-download" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}>🍎 App Store 다운로드</a>
                <a href="#app-download" className={`${styles.btn} ${styles.btnOutline} ${styles.btnLg}`}>🤖 Google Play 다운로드</a>
              </div>
              <div className={styles.heroTrust}>
                <div className={styles.trustItem}>
                  <div className={styles.trustNum}>100<span>+</span></div>
                  <div className={styles.trustLbl}>가입 매장</div>
                </div>
                <div className={styles.trustDiv} />
                <div className={styles.trustItem}>
                  <div className={styles.trustNum}>5,000<span>+</span></div>
                  <div className={styles.trustLbl}>발급 쿠폰</div>
                </div>
                <div className={styles.trustDiv} />
                <div className={styles.trustItem}>
                  <div className={styles.trustNum}>4.8<span>★</span></div>
                  <div className={styles.trustLbl}>앱 평점</div>
                </div>
              </div>
            </div>

            {/* 우측 앱 목업 */}
            <div className={styles.heroVisual}>
              {/* 뒷 폰 */}
              <div className={`${styles.phoneMock} ${styles.back}`}>
                <div className={styles.phoneScreen}>
                  <div className={styles.phoneScreenInner}>
                    <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 10 }}>🏆 내 스탬프</div>
                    <div className={styles.miniStamp}>
                      <div className={styles.msTitle}>☕ 스타벅스 서면점 · 7/10</div>
                      <div className={styles.msDots}>
                        {['🍖','🍖','🍖','🍖','🍖','🍖','🍖'].map((e, i) => (
                          <div key={i} className={`${styles.msDot} ${styles.filled}`}>{e}</div>
                        ))}
                        {[8,9,10].map(n => <div key={n} className={styles.msDot} />)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 앞 폰 */}
              <div className={`${styles.phoneMock} ${styles.front}`}>
                <div className={styles.phoneScreen}>
                  <div className={styles.phoneScreenInner}>
                    <div className={styles.miniTabs}>
                      {['전체','☕카페','🍖고기','🍜한식'].map((t, i) => (
                        <div key={t} className={`${styles.miniTab} ${i === 0 ? styles.active : ''}`}>{t}</div>
                      ))}
                    </div>
                    <div className={styles.miniCoupon}>
                      <div className={styles.mcTop}>
                        <div className={styles.mcBadge}>⏰ 타임세일</div>
                        <div className={styles.mcDiscount}>30% 할인</div>
                      </div>
                      <div className={styles.mcMenu}>아메리카노 · 카페라떼</div>
                      <div className={styles.mcStore}>☕ 카페 봄봄 · 오늘 18:00까지</div>
                    </div>
                    <div className={styles.miniCoupon} style={{ background: 'linear-gradient(135deg,#EAF9F1,#d0f5e5)', borderColor: '#A7ECC8' }}>
                      <div className={styles.mcTop}>
                        <div className={styles.mcBadge} style={{ background: '#E6FAF1', color: '#0AC86E' }}>🎁 서비스</div>
                        <div className={styles.mcDiscount} style={{ color: '#0AC86E' }}>음료 1개 무료</div>
                      </div>
                      <div className={styles.mcMenu}>재방문 고객 전용</div>
                      <div className={styles.mcStore}>🍖 정육식당 부산점 · 23명 남음</div>
                    </div>
                    <div className={styles.miniStamp} style={{ marginTop: 4 }}>
                      <div className={styles.msTitle}>🍀 스탬프 카드 · 7/10</div>
                      <div className={styles.msDots}>
                        {Array(7).fill('🍖').map((e, i) => (
                          <div key={i} className={`${styles.msDot} ${styles.filled}`}>{e}</div>
                        ))}
                        {[8,9,10].map(n => <div key={n} className={styles.msDot} />)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ③ 카테고리 */}
      <div className={styles.categoryBar}>
        <div className={styles.wrap}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className={styles.sectionLabel}>가게 카테고리</div>
              <div className={styles.sectionTitle} style={{ fontSize: 22 }}>어떤 가게 쿠폰을 찾으세요?</div>
            </div>
            <button className={styles.btnGhost} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--orange)' }}>전체 보기 →</button>
          </div>
          <div className={styles.catGrid}>
            {[
              { emoji: '☕', name: '카페' }, { emoji: '🍖', name: '고깃집' }, { emoji: '🍜', name: '한식' },
              { emoji: '🍗', name: '치킨' }, { emoji: '🍱', name: '분식' }, { emoji: '🍕', name: '양식' },
              { emoji: '🧁', name: '베이커리' },
            ].map(c => (
              <div key={c.name} className={styles.catItem}>
                <div className={styles.catEmoji}>{c.emoji}</div>
                <div className={styles.catName}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ④ 가게 탐색 미리보기 */}
      <section id="stores" className={`${styles.section} ${styles.sectionGray}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>지금 주변 가게</div>
            <h2 className={styles.sectionTitle}>쿠폰 있는 가게, 한눈에 확인</h2>
            <p className={styles.sectionSub}>지도와 카테고리로 빠르게 찾고, 쿠폰은 앱에서 바로 수령하세요.</p>
          </div>
          <div className={styles.storePreviewGrid}>
            {[
              { emoji: '☕', name: '카페 봄봄',      cat: '카페 · 부산 서면',    open: true,  cnt: 3 },
              { emoji: '🍖', name: '정육식당 부산점', cat: '고깃집 · 부산 해운대', open: true,  cnt: 1 },
              { emoji: '🍜', name: '할머니 국밥',     cat: '한식 · 부산 남포동',  open: true,  cnt: 2 },
              { emoji: '🍗', name: '교촌치킨 전포점', cat: '치킨 · 부산 전포',    open: false, cnt: 1 },
            ].map(s => (
              <div key={s.name} className={styles.spCard}>
                <div className={styles.spThumb}>{s.emoji}</div>
                <div className={styles.spBody}>
                  <div className={styles.spName}>{s.name}</div>
                  <div className={styles.spCat}>{s.cat}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    {s.open
                      ? <div className={styles.spOpen}><div className={styles.spOpenDot} /> 영업중</div>
                      : <div className={styles.spOpen} style={{ color: '#888' }}><div className={styles.spOpenDot} style={{ background: '#ccc' }} /> 영업종료</div>
                    }
                    <div className={styles.spCouponTag}>🎟 쿠폰 {s.cnt}개</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <a href="#app-download" className={`${styles.btn} ${styles.btnOutline}`}>앱에서 더 많은 가게 보기 →</a>
          </div>
        </div>
      </section>

      {/* ⑤ 나만의 추천맛집 */}
      <section id="recommend" style={{ background: 'linear-gradient(180deg,#FFF8F5 0%,#fff 100%)', borderTop: '1px solid #FFE0C8' }}>
        <RecommendFeed />
      </section>

      {/* ⑥ 쿠폰 시스템 */}
      <section id="coupons" className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.split}>
            <div>
              <div className={styles.sectionLabel}>쿠폰 시스템</div>
              <h2 className={styles.sectionTitle}>4가지 쿠폰으로<br />더 많은 혜택을</h2>
              <p className={styles.sectionSub}>할인, 타임세일, 무료 서비스, 체험 쿠폰까지.<br />가게마다 다양한 혜택을 앱 하나로 받으세요.</p>
              <div className={`${styles.featureList}`} style={{ marginTop: 28 }}>
                {[
                  { icon: '🎟', title: '일반 쿠폰',    badge: '항상 발급',  badgeCls: styles.badgeOrange, desc: '방문 고객 대상 상시 할인 쿠폰. 수령 후 QR 또는 PIN으로 즉시 사용.' },
                  { icon: '⏰', title: '타임세일 쿠폰', badge: '한정 시간',  badgeCls: styles.badgeBlue,   desc: '특정 시간대만 유효한 깜짝 할인. 놓치면 사라지는 특가 쿠폰.' },
                  { icon: '🎁', title: '서비스 쿠폰',   badge: '재방문 전용', badgeCls: styles.badgeGreen,  desc: '재방문 고객에게 무료 서비스 제공. 단골 고객만을 위한 특별 혜택.' },
                  { icon: '🌟', title: '체험단 쿠폰',   badge: '신규 전용',  badgeCls: styles.badgeOrange, desc: '신규 고객 첫 방문 시 파격 혜택. 새로운 가게를 부담 없이 경험하세요.' },
                ].map(f => (
                  <div key={f.title} className={styles.fi}>
                    <div className={styles.fiIcon}>{f.icon}</div>
                    <div>
                      <div className={styles.fiTitle}>{f.title} <span className={`${styles.badge} ${f.badgeCls}`}>{f.badge}</span></div>
                      <div className={styles.fiDesc}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.splitVisual}>
              {[
                { grad: 'linear-gradient(180deg,#4A90E2,#1A73E8)', icon: '⏰', label: '타임세일', title: '아메리카노 · 카페라떼 전 메뉴', disc: '30% 할인',    discColor: undefined,  expiry: '오늘 18:00까지', qty: '잔여 28명' },
                { grad: 'linear-gradient(180deg,#0AC86E,#07A85A)', icon: '🎁', label: '서비스',   title: '재방문 고객 음료 1잔 무료',    disc: '무료 제공',   discColor: '#0AC86E',  expiry: '~2026.05.31',   qty: '잔여 45명' },
                { grad: 'linear-gradient(180deg,#FF6F0F,#E05F00)', icon: '🎟', label: '일반',     title: '전메뉴 2,000원 할인',          disc: '2,000원 할인', discColor: undefined,  expiry: '~2026.06.30',   qty: '잔여 100명' },
                { grad: 'linear-gradient(180deg,#F59E0B,#D97706)', icon: '🌟', label: '체험단',   title: '신규 고객 첫 방문 50% 할인',   disc: '50% 할인',    discColor: '#D97706',  expiry: '신규 고객 전용', qty: '잔여 10명' },
              ].map(c => (
                <div key={c.label} className={styles.couponCard}>
                  <div className={styles.couponLeft} style={{ background: c.grad }}>
                    <div className={styles.couponLeftEmoji}>{c.icon}</div>
                    <div className={styles.couponLeftLabel}>{c.label}</div>
                  </div>
                  <div className={styles.couponRight}>
                    <div className={styles.crTitle}>{c.title}</div>
                    <div className={styles.crDiscount} style={c.discColor ? { color: c.discColor } : {}}>{c.disc}</div>
                    <div className={styles.crMeta}>
                      <div className={styles.crExpiry}>{c.expiry}</div>
                      <div className={styles.crQty}>{c.qty}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ⑦ 스탬프 & 리워드 */}
      <section id="stamp" className={`${styles.section} ${styles.sectionGray}`}>
        <div className={styles.wrap}>
          <div className={styles.split}>
            <div className={styles.splitVisual} style={{ gap: 14 }}>
              <div className={styles.stampDemo}>
                <div className={styles.sdHeader}>
                  <div className={styles.sdTitle}>🍀 정육식당 스탬프 카드</div>
                  <div className={styles.sdCount}>7 / 10</div>
                </div>
                <div className={styles.sdBar}><div className={styles.sdFill} style={{ width: '70%' }} /></div>
                <div className={styles.sdStamps}>
                  {Array(7).fill('🍖').map((e, i) => <div key={i} className={`${styles.sdStamp} ${styles.on}`}>{e}</div>)}
                  <div className={styles.sdStamp}>8</div>
                  <div className={styles.sdStamp}>9</div>
                  <div className={styles.sdStamp}>🎁</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700, marginTop: 10, textAlign: 'center' }}>
                  3개 더 모으면 리워드 쿠폰 발급!
                </div>
              </div>
              <div className={styles.receiptDemo}>
                <div className={styles.rdLabel}>📸 영수증 인증 자동 적립</div>
                <div className={styles.rdRow}>
                  <div className={styles.rdIcon}>🧾</div>
                  <div>
                    <div className={styles.rdText}>영수증 촬영 → AI가 자동 분석</div>
                    <div className={styles.rdSub}>가게 확인 후 스탬프 즉시 적립</div>
                  </div>
                </div>
                <div className={styles.rdRow} style={{ marginBottom: 0 }}>
                  <div className={styles.rdIcon}>👥</div>
                  <div>
                    <div className={styles.rdText}>함께 온 일행도 스탬프 공유</div>
                    <div className={styles.rdSub}>메뉴 수 기준 동반자 모두 적립 가능</div>
                  </div>
                </div>
              </div>
              <div className={styles.partyCode}>
                <div className={styles.pcLabel}>🎟 동반자 스탬프 코드</div>
                <div className={styles.pcCode}>HKP 4XW</div>
                <div className={styles.pcSub}>30분 내 · 최대 3명 · 앱에서 입력</div>
              </div>
            </div>
            <div>
              <div className={styles.sectionLabel}>스탬프 &amp; 리워드</div>
              <h2 className={styles.sectionTitle}>방문할수록 쌓이는<br />나만의 스탬프 카드</h2>
              <p className={styles.sectionSub}>쿠폰 사용, 영수증 인증, 동반자 코드 공유까지<br />다양한 방법으로 스탬프를 모으세요.</p>
              <div className={styles.featureList} style={{ marginTop: 28 }}>
                {[
                  { icon: '🍀', title: '자동 스탬프 적립',    desc: '쿠폰 사용 완료 시 자동으로 스탬프가 적립됩니다. 별도 인증 불필요.' },
                  { icon: '🧾', title: '영수증 인증 적립',    desc: '방문 후 영수증을 촬영하면 AI가 자동 인식해 스탬프를 적립합니다.' },
                  { icon: '👥', title: '동반자 코드 공유',    desc: '영수증 인증자가 6자리 코드를 생성하면 함께 온 일행도 스탬프 적립 가능.' },
                  { icon: '🎁', title: '리워드 쿠폰 자동 발급', desc: '스탬프 목표 달성 시 리워드 쿠폰이 자동으로 지갑에 추가됩니다.' },
                ].map(f => (
                  <div key={f.title} className={styles.fi}>
                    <div className={styles.fiIcon}>{f.icon}</div>
                    <div>
                      <div className={styles.fiTitle}>{f.title}</div>
                      <div className={styles.fiDesc}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ⑦ 네이버 리뷰 & 가격 제보 */}
      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>추가 혜택</div>
            <h2 className={styles.sectionTitle}>리뷰 쓰고, 가격 알리고 쿠폰 받기</h2>
            <p className={styles.sectionSub}>가게에 도움을 주면 특별한 혜택으로 돌아옵니다.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* 네이버 리뷰 */}
            <div style={{ background: 'linear-gradient(135deg,#EAFAF1,#F0FFF8)', border: '1px solid #A7ECC8', borderRadius: 20, padding: '32px 28px' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>📸</div>
              <div className={styles.sectionLabel} style={{ color: '#0C5C2E' }}>네이버 리뷰 인증 쿠폰</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0C5C2E', margin: '6px 0 10px' }}>리뷰 작성하면<br />즉시 쿠폰 발급</h3>
              <p style={{ fontSize: 13, color: '#1E7A45', lineHeight: 1.7 }}>
                네이버에 영수증 리뷰를 작성하고<br />스크린샷을 인증하면 쿠폰이 즉시 발급돼요.<br />가게에도 내 리뷰가 바로 등록됩니다.
              </p>
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['네이버 앱에서 영수증 리뷰 작성','리뷰 스크린샷 언니픽에 등록','쿠폰 즉시 발급 🎉'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1E7A45', fontWeight: 600 }}>
                    <span style={{ color: '#0C5C2E', fontWeight: 800 }}>①②③</span>
                    <span style={{ color: '#0C5C2E', fontWeight: 800 }}>{i + 1}</span> {t}
                  </div>
                ))}
              </div>
            </div>
            {/* 가격 제보 */}
            <div style={{ background: 'linear-gradient(135deg,#FFF8E6,#FFFBE0)', border: '1px solid #FFD97A', borderRadius: 20, padding: '32px 28px' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>💰</div>
              <div className={styles.sectionLabel} style={{ color: '#8A5800' }}>가격 정보 제보</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#5C3D00', margin: '6px 0 10px' }}>실제 가격을<br />함께 공유해요</h3>
              <p style={{ fontSize: 13, color: '#7A5200', lineHeight: 1.7 }}>
                방문 후 메뉴 가격을 제보하면<br />다른 언니들이 "맞아요 / 틀려요"로<br />가격 정확도를 검증해줍니다.
              </p>
              <div style={{ marginTop: 18, background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #FFD97A' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>아메리카노</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--orange)' }}>4,500원</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, padding: 6, background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#2E7D32' }}>👍 맞아요 24</div>
                  <div style={{ flex: 1, padding: 6, background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#C62828' }}>👎 틀려요 2</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ⑧ 사장님 기능 */}
      <section id="owner" className={`${styles.section} ${styles.sectionGray}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>사장님을 위한 기능</div>
            <h2 className={styles.sectionTitle}>고객을 다시 오게 만드는<br />마케팅 도구</h2>
            <p className={styles.sectionSub}>쿠폰 발행부터 스탬프 관리까지, 스마트폰 하나로 끝냅니다.</p>
          </div>
          <div className={styles.ownerGrid}>
            {[
              { icon: '🎟', title: '쿠폰 직접 발행',   desc: '일반·타임세일·서비스·체험 4종 쿠폰을 앱에서 직접 생성하고 관리하세요.', badge: '무제한 발행' },
              { icon: '📱', title: 'QR / PIN 사용 처리', desc: '고객의 QR 코드를 스캔하거나 PIN 번호로 쿠폰 사용 처리. 카운터에서 3초 완료.', badge: undefined },
              { icon: '🍀', title: '스탬프 카드 운영', desc: '스탬프 목표 설정 후 고객이 달성하면 리워드 쿠폰 자동 발급. 단골 고객 만들기.', badge: undefined },
              { icon: '🔔', title: '실시간 알림',      desc: '쿠폰 수령·사용 알림을 실시간으로 받아 고객 현황을 한눈에 파악.', badge: undefined },
              { icon: '💰', title: '가격 정보 관리',   desc: '고객이 제보한 메뉴 가격 정보 확인. 정확한 정보로 신뢰도 향상.', badge: undefined },
              { icon: '📸', title: '네이버 리뷰 현황', desc: '언니픽 인증 리뷰를 가게 피드에서 바로 확인. 리뷰 마케팅 효과 극대화.', badge: undefined },
            ].map(c => (
              <div key={c.title} className={styles.ogCard}>
                <div className={styles.ogCardIcon}>{c.icon}</div>
                <div className={styles.ogCardTitle}>{c.title}</div>
                <div className={styles.ogCardDesc}>{c.desc}</div>
                {c.badge && <div className={styles.ogBadge}>{c.badge}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑨ HOW IT WORKS */}
      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>이용 방법</div>
            <h2 className={styles.sectionTitle}>시작이 쉬워요</h2>
          </div>
          <div className={styles.howTabs}>
            <button className={`${styles.howTab} ${howTab === 'customer' ? styles.active : ''}`} onClick={() => setHowTab('customer')}>👩 고객으로 시작</button>
            <button className={`${styles.howTab} ${howTab === 'owner' ? styles.active : ''}`} onClick={() => setHowTab('owner')}>🏪 사장님으로 시작</button>
          </div>
          {howTab === 'customer' ? (
            <div className={styles.howSteps}>
              {[
                { icon: '📲', step: 'STEP 01', title: '앱 다운로드', desc: 'App Store 또는 Google Play에서 "언니픽"을 검색해 설치하세요.' },
                { icon: '🗺️', step: 'STEP 02', title: '주변 가게 탐색', desc: '지도나 카테고리로 근처 가게를 찾고, 발행 중인 쿠폰을 확인하세요.' },
                { icon: '🎟', step: 'STEP 03', title: '쿠폰 수령 & 사용', desc: '쿠폰을 수령하고, 방문 후 QR 코드 또는 PIN으로 즉시 혜택을 받으세요.' },
              ].map(s => (
                <div key={s.step} className={styles.hs}>
                  <div className={styles.hsNum}>{s.icon}</div>
                  <div className={styles.hsStep}>{s.step}</div>
                  <h3 className={styles.hsTitle}>{s.title}</h3>
                  <p className={styles.hsDesc}>{s.desc}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.howSteps}>
              {[
                { icon: '📝', step: 'STEP 01', title: '가게 등록 신청', desc: '언니픽 웹사이트에서 가게 정보를 입력하고 등록을 신청하세요.' },
                { icon: '✅', step: 'STEP 02', title: '심사 후 승인', desc: '관리자 심사 완료 후 사장님 앱 계정이 활성화됩니다.' },
                { icon: '🎟', step: 'STEP 03', title: '쿠폰 발행 시작', desc: '앱에서 쿠폰을 직접 만들고 고객에게 즉시 발행하세요.' },
              ].map(s => (
                <div key={s.step} className={styles.hs}>
                  <div className={styles.hsNum}>{s.icon}</div>
                  <div className={styles.hsStep}>{s.step}</div>
                  <h3 className={styles.hsTitle}>{s.title}</h3>
                  <p className={styles.hsDesc}>{s.desc}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 48, background: 'var(--orange-soft)', borderRadius: 'var(--radius-xl)', padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 24, border: '1px solid var(--orange-mid)' }}>
            <div style={{ fontSize: 40, flexShrink: 0 }}>🍀</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>방문하면 자동으로 쌓이는 스탬프</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7 }}>쿠폰 사용, 영수증 인증, 동반자 코드 입력으로 스탬프를 모으세요. 목표 달성 시 리워드 쿠폰 자동 발급!</div>
            </div>
            <a href="#app-download" className={`${styles.btn} ${styles.btnPrimary}`} style={{ flexShrink: 0 }}>앱에서 시작</a>
          </div>
        </div>
      </section>

      {/* ⑩ 후기 */}
      <section className={`${styles.section} ${styles.sectionGray}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>사용자 후기</div>
            <h2 className={styles.sectionTitle}>이미 많은 분들이 사용 중이에요</h2>
          </div>
          <div className={styles.testiGrid}>
            {[
              { stars: '★★★★★', quote: '동네 카페 쿠폰을 이렇게 쉽게 받을 수 있다니! 스탬프 모으는 재미도 있어요. 친구들한테 무조건 추천했어요.', avatar: '👩', name: '김지수님', role: '카페 단골 고객 · 앱 사용 3개월' },
              { stars: '★★★★★', quote: '영수증 찍으면 스탬프가 자동으로 쌓이는 게 너무 편해요. 일행 코드도 나눠줄 수 있어서 친구들이랑 같이 모아요.', avatar: '👧', name: '박민아님', role: '음식점 자주 방문 · 앱 사용 1개월' },
              { stars: '★★★★★', quote: '쿠폰 발행하고 나서 재방문율이 확실히 올랐어요. QR 스캔도 간단하고, 고객들도 편하다고 해요.', avatar: '👨', name: '이사장님', role: '카페 운영 · 언니픽 사장님 회원' },
            ].map(t => (
              <div key={t.name} className={styles.testiCard}>
                <div className={styles.testiStars}>{t.stars}</div>
                <div className={styles.testiQuote}>&ldquo;{t.quote}&rdquo;</div>
                <div className={styles.testiInfo}>
                  <div className={styles.testiAvatar}>{t.avatar}</div>
                  <div>
                    <div className={styles.testiName}>{t.name}</div>
                    <div className={styles.testiRole}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑪ 앱 다운로드 배너 */}
      <section id="app-download" className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.appBanner}>
            <div>
              <div className={styles.abTitle}>지금 바로 시작하세요,<br /><em>언니픽</em>은 무료예요</div>
              <div className={styles.abSub}>가입비 없이, 신용카드 없이 앱만 설치하면<br />주변 모든 가게의 쿠폰을 바로 받을 수 있습니다.</div>
              <div className={styles.abBtns}>
                <div className={styles.storeBtn}>
                  <div className={styles.storeBtnIcon}>🍎</div>
                  <div>
                    <div className={styles.storeBtnTextSm}>Download on the</div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>App Store</div>
                  </div>
                </div>
                <div className={styles.storeBtn}>
                  <div className={styles.storeBtnIcon}>🤖</div>
                  <div>
                    <div className={styles.storeBtnTextSm}>Get it on</div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Google Play</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.abQr}>
              <div className={styles.qrPlaceholder}>QR<br />코드</div>
              <div className={styles.abQrLabel}>카메라로 스캔</div>
            </div>
          </div>
        </div>
      </section>

      {/* ⑫ 사장님 등록 CTA */}
      <section className={`${styles.section} ${styles.sectionGray}`}>
        <div className={styles.wrap}>
          <div className={styles.ownerCta}>
            <div>
              <div className={styles.ocTitle}><em>내 가게</em>도 언니픽에<br />등록해보세요</div>
              <div className={styles.ocSub}>쿠폰 발행, 스탬프 운영, 고객 관리까지<br />무료로 시작하고 고객 재방문율을 높이세요.</div>
              <div className={styles.ocSteps}>
                <div className={styles.ocStep}><div className={styles.ocStepNum}>1</div> 가게 등록 신청</div>
                <div style={{ fontSize: 16, color: 'var(--orange)' }}>→</div>
                <div className={styles.ocStep}><div className={styles.ocStepNum}>2</div> 심사 후 승인</div>
                <div style={{ fontSize: 16, color: 'var(--orange)' }}>→</div>
                <div className={styles.ocStep}><div className={styles.ocStepNum}>3</div> 쿠폰 발행 시작</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <button onClick={() => setApplyOpen(true)} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}>🏪 가게 등록 신청하기</button>
              <Link href="/owner/login" className={`${styles.btn} ${styles.btnOutline}`}>이미 등록한 사장님 →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ⑬ FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link href="/" className={styles.logo}>
                <div className={styles.logoIcon}>🩷</div>
                언니픽
              </Link>
              <p className={styles.footerDesc}>동네 가게의 쿠폰과 스탬프를 한 앱에서.<br />방문할수록 혜택이 쌓이는 지역 상권 마케팅 플랫폼.</p>
              <div className={styles.footerAppBtns}>
                <div className={styles.fapp}><span>🍎</span> App Store</div>
                <div className={styles.fapp}><span>🤖</span> Google Play</div>
              </div>
            </div>
            <div className={styles.footerCol}>
              <h4>서비스</h4>
              <ul>
                <li><a href="#">가게 찾기</a></li>
                <li><a href="#">쿠폰 받기</a></li>
                <li><a href="#">스탬프 카드</a></li>
                <li><a href="#">앱 다운로드</a></li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4>사장님</h4>
              <ul>
                <li><Link href="/apply">가게 등록 신청</Link></li>
                <li><Link href="/owner/login">사장님 로그인</Link></li>
                <li><a href="#">쿠폰 발행 가이드</a></li>
                <li><a href="#">자주 묻는 질문</a></li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4>회사</h4>
              <ul>
                <li><a href="#">회사 소개</a></li>
                <li><a href="#">서비스 소개</a></li>
                <li><a href="#">공지사항</a></li>
                <li><a href="#">채용</a></li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4>고객센터</h4>
              <ul>
                <li><a href="#">이용 가이드</a></li>
                <li><a href="#">문의하기</a></li>
                <li><a href="#">신고하기</a></li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <div className={styles.footerLegal}>
              <a href="#">이용약관</a>
              <a href="#" style={{ fontWeight: 700, color: 'var(--text-2)' }}>개인정보처리방침</a>
              <a href="#">위치기반서비스 이용약관</a>
            </div>
            <div className={styles.footerCorp}>© 2026 언니픽. All rights reserved.</div>
          </div>
        </div>
      </footer>

      <ApplyModal isOpen={applyOpen} onClose={() => setApplyOpen(false)} />
    </div>
  );
}
