'use client';

/**
 * 사장님 PIN 관리 페이지 (시샵 전용)
 *
 * 최초 실행 전 Supabase에서 테이블 생성 필요:
 * ─────────────────────────────────────────────
 * create table if not exists owner_pins (
 *   id               uuid    default gen_random_uuid() primary key,
 *   user_id          text    not null unique,
 *   pin_hash         text    not null,
 *   pin_changes      int     default 0,
 *   pin_change_month text    default '',
 *   is_active        boolean default true,
 *   created_at       timestamptz default now(),
 *   updated_at       timestamptz default now()
 * );
 * ─────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  KeyRound, UserCheck, UserX, RefreshCw, Plus,
  Search, Shield, Loader2, Eye, EyeOff, Copy, Check,
  FlaskConical, Store, ChevronDown, ChevronUp,
} from 'lucide-react';

interface StoreRow {
  id:       string;
  name:     string;
  category: string | null;
  phone:    string | null;
  owner_id: string | null;
}

interface SeedResult {
  store: string;
  owner_name: string;
  phone: string;
  pin: string;
  status: string;
}

interface OwnerUser {
  id:         string;
  name:       string;
  phone:      string | null;
  created_at: string;
  pin?: {
    id:               string;
    pin_changes:      number;
    pin_change_month: string;
    is_active:        boolean;
    updated_at:       string;
  } | null;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function remainingChanges(pin: OwnerUser['pin']) {
  if (!pin) return 2;
  return pin.pin_change_month === currentMonth() ? Math.max(0, 2 - pin.pin_changes) : 2;
}

// 브라우저에서 SHA-256 (서버와 동일한 prefix 사용)
async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`unnipick:${pin}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function OwnersPage() {
  const sb = createClient();

  const [owners, setOwners]     = useState<OwnerUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');

  // 더미 생성
  const [showSeed, setShowSeed]       = useState(false);
  const [stores, setStores]           = useState<StoreRow[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [seeding, setSeeding]         = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[]>([]);
  const [resetting, setResetting]     = useState(false);

  // PIN 부여/재설정 모달
  const [modal, setModal]         = useState<'assign' | 'reset' | null>(null);
  const [targetUser, setTarget]   = useState<OwnerUser | null>(null);
  const [pin, setPin]             = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [modalError, setModalErr] = useState('');
  const [copied, setCopied]       = useState(false);

  const load = async () => {
    setLoading(true);
    // role='owner' 사용자 목록
    const { data: users } = await sb
      .from('users')
      .select('id, name, phone, created_at')
      .eq('role', 'owner')
      .order('created_at', { ascending: false });

    if (!users || users.length === 0) { setOwners([]); setLoading(false); return; }

    // owner_pins 조회
    const ids = users.map(u => u.id);
    const { data: pins } = await sb
      .from('owner_pins')
      .select('id, user_id, pin_changes, pin_change_month, is_active, updated_at')
      .in('user_id', ids);

    const pinMap = Object.fromEntries((pins ?? []).map(p => [p.user_id, p]));

    setOwners(users.map(u => ({
      ...u,
      pin: pinMap[u.id] ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadStores = async () => {
    setLoadingStores(true);
    const { data } = await sb
      .from('stores')
      .select('id, name, category, phone, owner_id')
      .order('name');
    setStores((data ?? []) as StoreRow[]);
    setLoadingStores(false);
  };

  const toggleStore = (id: string) => {
    setSelectedStores(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleReset = async () => {
    if (!confirm('더미 사장님 데이터를 모두 삭제하고 매장 연결을 해제합니다. 계속할까요?')) return;
    setResetting(true);
    setSeedResults([]);
    try {
      const res = await fetch('/api/dev/reset-owners', { method: 'POST' });
      const data = await res.json();
      alert(`초기화 완료: ${data.deleted}명 삭제`);
      await load();
      await loadStores();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const handleSeed = async () => {
    if (selectedStores.size === 0) return;
    setSeeding(true);
    setSeedResults([]);
    try {
      const res = await fetch('/api/dev/seed-owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_ids: Array.from(selectedStores) }),
      });
      const data = await res.json();
      setSeedResults(data.results ?? []);
      setSelectedStores(new Set());
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  const filtered = owners.filter(o =>
    !query || o.name.includes(query) || (o.phone ?? '').includes(query)
  );

  const openAssign = (user: OwnerUser) => {
    setTarget(user);
    setPin(randomPin());
    setShowPin(true);
    setModalErr('');
    setModal('assign');
  };

  const openReset = (user: OwnerUser) => {
    setTarget(user);
    setPin(randomPin());
    setShowPin(true);
    setModalErr('');
    setModal('reset');
  };

  const handleSavePin = async () => {
    if (!targetUser) return;
    if (!/^\d{6}$/.test(pin)) { setModalErr('6자리 숫자 PIN을 입력해주세요.'); return; }

    setSaving(true);
    setModalErr('');
    try {
      const hash = await hashPin(pin);
      if (modal === 'assign') {
        const { error } = await sb.from('owner_pins').insert({
          user_id:          targetUser.id,
          pin_hash:         hash,
          pin_changes:      0,
          pin_change_month: '',
          is_active:        true,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from('owner_pins')
          .update({ pin_hash: hash, pin_changes: 0, pin_change_month: '', updated_at: new Date().toISOString() })
          .eq('user_id', targetUser.id);
        if (error) throw new Error(error.message);
      }
      setModal(null);
      load();
    } catch (e) {
      setModalErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: OwnerUser) => {
    if (!user.pin) return;
    await sb.from('owner_pins')
      .update({ is_active: !user.pin.is_active, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    load();
  };

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[#FF6F0F]/15 flex items-center justify-center">
          <Shield size={18} className="text-[#FF6F0F]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary">사장님 PIN 관리</h1>
          <p className="text-xs text-muted mt-0.5">role=owner 회원에게 6자리 PIN을 부여합니다.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* ── 더미 사장님 생성 (테스트용) ── */}
        <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-xl overflow-hidden">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setShowSeed(v => !v);
              if (!showSeed && stores.length === 0) loadStores();
              setSeedResults([]);
            }}
            onKeyDown={e => e.key === 'Enter' && (setShowSeed(v => !v))}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-yellow-500/10 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 text-yellow-400">
              <FlaskConical size={15} />
              <span className="text-sm font-semibold">테스트용 더미 사장님 생성</span>
              <span className="text-[10px] bg-yellow-500/20 px-1.5 py-0.5 rounded font-mono">DEV</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); handleReset(); }}
                disabled={resetting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition disabled:opacity-40"
              >
                {resetting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                초기화
              </button>
              {showSeed ? <ChevronUp size={14} className="text-yellow-400/60" /> : <ChevronDown size={14} className="text-yellow-400/60" />}
            </div>
          </div>

          {showSeed && (
            <div className="px-4 pb-4 space-y-3 border-t border-yellow-500/20">
              <p className="text-xs text-yellow-400/70 pt-3">
                샘플 매장을 선택하면 더미 owner 회원이 생성됩니다. PIN: <strong className="text-yellow-300 font-mono">000000</strong>, <strong className="text-yellow-300 font-mono">000001</strong> … 순서 배정
              </p>

              {loadingStores ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-yellow-400/60" />
                </div>
              ) : (
                <>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {stores.map(store => {
                      const isSelected = selectedStores.has(store.id);
                      const hasOwner   = !!store.owner_id;
                      return (
                        <button
                          key={store.id}
                          onClick={() => !hasOwner && toggleStore(store.id)}
                          disabled={hasOwner}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition ${
                            hasOwner
                              ? 'border-white/5 bg-white/3 opacity-40 cursor-not-allowed'
                              : isSelected
                                ? 'border-yellow-500/50 bg-yellow-500/15'
                                : 'border-white/8 bg-white/3 hover:border-yellow-500/30 hover:bg-yellow-500/8'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-yellow-500 border-yellow-500' : 'border-white/30'}`}>
                            {isSelected && <Check size={10} className="text-black" />}
                          </div>
                          <Store size={13} className="text-white/40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/80 truncate">{store.name}</p>
                            <p className="text-[10px] text-white/35">{store.category ?? '카테고리 없음'}</p>
                          </div>
                          {hasOwner && <span className="text-[10px] text-white/30 shrink-0">이미 연결됨</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSeed}
                      disabled={seeding || selectedStores.size === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-bold hover:bg-yellow-500/30 transition disabled:opacity-40"
                    >
                      {seeding ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
                      {selectedStores.size > 0 ? `${selectedStores.size}개 더미 생성` : '매장 선택 후 생성'}
                    </button>
                    {selectedStores.size > 0 && (
                      <button onClick={() => setSelectedStores(new Set())} className="text-xs text-white/30 hover:text-white/60 transition">
                        전체 해제
                      </button>
                    )}
                  </div>

                  {/* 생성 결과 */}
                  {seedResults.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-yellow-500/20">
                      <p className="text-xs font-semibold text-yellow-400/70">생성 결과</p>
                      {seedResults.map((r, i) => (
                        <div key={i} className={`px-3 py-2 rounded-lg text-xs ${r.status === 'ok' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                          {r.status === 'ok' ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white/70 truncate">{r.store} → <span className="text-white">{r.owner_name}</span></span>
                              <span className="font-mono text-green-400 shrink-0">📞 {r.phone} · PIN: <strong>{r.pin}</strong></span>
                            </div>
                          ) : (
                            <span className="text-red-400">{r.store}: {r.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 검색 */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="이름, 전화번호 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-[#0f1117] border border-border-main rounded-lg pl-8 pr-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]/50"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Shield size={32} className="text-muted/30" />
            <p className="text-sm text-muted">사장님(owner) 회원이 없습니다.</p>
            <p className="text-xs text-dim">회원 관리에서 role을 owner로 변경하면 여기에 나타납니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(owner => {
              const rem = remainingChanges(owner.pin);
              return (
                <div
                  key={owner.id}
                  className="bg-card border border-border-main rounded-xl p-4 flex items-center gap-4"
                >
                  {/* 아바타 */}
                  <div className="w-10 h-10 rounded-full bg-[#FF6F0F]/15 flex items-center justify-center shrink-0 text-sm font-bold text-[#FF6F0F]">
                    {owner.name.charAt(0)}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-primary">{owner.name}</p>
                      {owner.pin && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          owner.pin.is_active
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {owner.pin.is_active ? '활성' : '비활성'}
                        </span>
                      )}
                      {!owner.pin && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                          PIN 미부여
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">{owner.phone ?? '-'}</p>
                    {owner.pin && (
                      <p className="text-[10px] text-dim mt-1">
                        이번 달 PIN 변경 잔여: <span className={rem === 0 ? 'text-red-400' : 'text-[#FF9F4F]'}>{rem}회</span>
                        {owner.pin.updated_at && ` · 마지막 변경: ${new Date(owner.pin.updated_at).toLocaleDateString('ko-KR')}`}
                      </p>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!owner.pin ? (
                      <button
                        onClick={() => openAssign(owner)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6F0F]/15 text-[#FF6F0F] text-xs font-semibold hover:bg-[#FF6F0F]/25 transition"
                      >
                        <Plus size={12} /> PIN 부여
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => openReset(owner)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border-main text-xs text-muted hover:text-primary hover:bg-white/10 transition"
                        >
                          <RefreshCw size={12} /> 재설정
                        </button>
                        <button
                          onClick={() => toggleActive(owner)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                            owner.pin.is_active
                              ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                              : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                          }`}
                        >
                          {owner.pin.is_active
                            ? <><UserX size={12} /> 비활성화</>
                            : <><UserCheck size={12} /> 활성화</>}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PIN 부여/재설정 모달 */}
      {modal && targetUser && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-[#1a1c24] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF6F0F]/15 flex items-center justify-center">
                <KeyRound size={18} className="text-[#FF6F0F]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {modal === 'assign' ? 'PIN 부여' : 'PIN 재설정'}
                </h2>
                <p className="text-xs text-white/50">{targetUser.name} · {targetUser.phone}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5">6자리 PIN</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setModalErr(''); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-lg tracking-[0.4em] placeholder:text-white/20 focus:outline-none focus:border-[#FF6F0F]/60 pr-20"
                  placeholder="000000"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button type="button" onClick={copyPin} className="p-1.5 text-white/30 hover:text-white/70 transition">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <button type="button" onClick={() => setShowPin(v => !v)} className="p-1.5 text-white/30 hover:text-white/70 transition">
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setPin(randomPin()); setModalErr(''); }}
                className="mt-2 text-xs text-[#FF9F4F] hover:text-[#FF6F0F] transition flex items-center gap-1"
              >
                <RefreshCw size={11} /> 랜덤 생성
              </button>
            </div>

            {modalError && <p className="text-sm text-red-400">{modalError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:bg-white/5 transition"
              >
                취소
              </button>
              <button
                onClick={handleSavePin}
                disabled={saving || pin.length !== 6}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6F0F] text-white font-bold text-sm hover:bg-[#e86200] transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {modal === 'assign' ? 'PIN 부여' : '재설정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
