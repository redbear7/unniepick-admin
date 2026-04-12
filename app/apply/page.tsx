'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Mail, ShieldCheck, Loader2, Check } from 'lucide-react';

export default function ApplyPage() {
  /* ── 이메일 인증 ── */
  const [emailId,    setEmailId]    = useState('');
  const [otpSent,    setOtpSent]    = useState(false);
  const [otp,        setOtp]        = useState(['', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError,   setOtpError]   = useState('');
  const [verified,   setVerified]   = useState(false);
  const [cooldown,   setCooldown]   = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* ── 폼 ── */
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [storeName,  setStoreName]  = useState('');
  const [naverUrl,   setNaverUrl]   = useState('');
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillMsg, setAutoFillMsg] = useState('');
  const [submitting, setSubmitting]  = useState(false);
  const [done,       setDone]        = useState(false);
  const [error,      setError]       = useState('');

  const [storeCategory, setStoreCategory] = useState('');
  const [storeAddress,  setStoreAddress]  = useState('');
  const [storePhone,    setStorePhone]    = useState('');
  const [carrier,       setCarrier]       = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fullEmail = () => `${emailId.trim().toLowerCase()}@naver.com`;
  const formValid = verified && name.trim() && phone.trim() && storeName.trim();

  /* ── 인증번호 발송 ── */
  const handleSendOtp = async () => {
    if (!emailId.trim()) { setOtpError('아이디를 입력하세요'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: fullEmail() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtpSent(true);
      setCooldown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      setOtpError(e.message ?? '인증번호 발송 실패');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 1) otpRefs.current[idx + 1]?.focus();
    else if (digit && idx === 1) handleVerifyOtp(next);
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (otp[idx]) { const n = [...otp]; n[idx] = ''; setOtp(n); }
      else if (idx > 0) otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (arr = otp) => {
    const code = arr.join('');
    if (code.length < 2) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email: fullEmail(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerified(true);
    } catch (e: any) {
      setOtpError(e.message ?? '인증번호가 올바르지 않습니다');
      setOtp(['', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setOtpLoading(false);
    }
  };

  /* ── 네이버 자동 입력 ── */
  const handleNaverAutoFill = async () => {
    if (!naverUrl.trim()) return;
    setAutoFilling(true);
    setAutoFillMsg('');
    try {
      const res = await fetch(`/api/naver-place?url=${encodeURIComponent(naverUrl.trim())}`);
      const data = await res.json();
      if (data.error) { setAutoFillMsg(data.error); return; }
      if (data.name)     setStoreName(data.name);
      if (data.address)  setStoreAddress(data.address);
      if (data.phone)    setStorePhone(data.phone);
      if (data.category) setStoreCategory(data.category);
      setAutoFillMsg('자동 입력 완료!');
    } catch {
      setAutoFillMsg('네트워크 오류');
    } finally {
      setAutoFilling(false);
    }
  };

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!formValid) return;
    setSubmitting(true);
    setError('');
    try {
      const sb = createClient();
      const { error: err } = await sb.from('store_requests').insert({
        owner_name:     name.trim(),
        owner_phone:    phone.trim(),
        owner_email:    fullEmail(),
        store_name:     storeName.trim(),
        store_category: storeCategory.trim() || null,
        store_address:  storeAddress.trim() || null,
        store_phone:    storePhone.trim() || null,
        status:         'pending',
      });
      if (err) throw err;
      setDone(true);
    } catch {
      setError('제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 완료 ── */
  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-6">
          <Check size={36} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-3">신청 완료!</h1>
        <p className="text-tertiary text-sm leading-relaxed">
          가게 등록 신청이 접수되었습니다.<br />
          검토 후 영업일 1~2일 내에 연락드릴게요.
        </p>
      </div>
    );
  }

  /* ── 폼 ── */
  return (
    <div className="flex-1 flex flex-col items-center px-5 py-12">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">가게 등록 신청</h1>
          <p className="text-sm text-muted mt-1">최소 정보만 입력하면 바로 신청됩니다</p>
        </div>

        {/* ── 이메일 인증 ── */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-tertiary">
            <Mail size={14} className="text-dim" />
            네이버 이메일 {verified && <span className="ml-auto text-emerald-400 flex items-center gap-1"><ShieldCheck size={12} /> 인증완료</span>}
          </label>

          {!verified ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-sidebar border border-border-subtle rounded-xl focus-within:border-[#FF6F0F] transition overflow-hidden">
                  <input
                    value={emailId}
                    onChange={e => { setEmailId(e.target.value.replace(/@.*$/, '')); setOtpError(''); }}
                    onKeyDown={e => e.key === 'Enter' && !otpSent && handleSendOtp()}
                    placeholder="아이디"
                    disabled={otpSent && cooldown > 0}
                    className="flex-1 min-w-0 bg-transparent px-4 py-3 text-lg font-semibold text-primary placeholder-muted focus:outline-none"
                  />
                  <span className="text-sm font-medium text-tertiary pr-4 shrink-0 select-none">@naver.com</span>
                </div>
                <button
                  onClick={handleSendOtp}
                  disabled={otpLoading || !emailId.trim() || (otpSent && cooldown > 0)}
                  className="shrink-0 px-4 py-3.5 bg-[#FF6F0F] hover:bg-[#e66000] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  {otpLoading && <Loader2 size={13} className="animate-spin" />}
                  {otpSent ? (cooldown > 0 ? `${cooldown}초` : '재전송') : '인증요청'}
                </button>
              </div>

              {otpSent && (
                <div>
                  <div className="flex gap-3 justify-center">
                    {otp.map((v, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={v}
                        onChange={e => handleOtpInput(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        disabled={otpLoading}
                        className="w-14 h-16 bg-sidebar border border-border-subtle rounded-xl text-center text-3xl font-bold text-primary focus:outline-none focus:border-[#FF6F0F] disabled:opacity-40 transition"
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-2 text-center">이메일로 전송된 숫자 2자리를 입력하세요</p>
                </div>
              )}

              {otpError && <p className="text-red-400 text-xs text-center">{otpError}</p>}
            </>
          ) : (
            <p className="text-sm font-medium text-primary">{fullEmail()}</p>
          )}
        </div>

        {/* ── 신청자 정보 ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-tertiary mb-1.5 block">이름 *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="홍길동"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-tertiary mb-1.5 block">연락처 *</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              inputMode="tel"
              className={inputCls}
            />
          </div>
        </div>

        {/* ── 가게명 ── */}
        <div>
          <label className="text-xs font-semibold text-tertiary mb-1.5 block">가게명 *</label>
          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="가게 이름"
            className={inputCls}
          />
        </div>

        {/* ── 네이버 자동 입력 ── */}
        <div className="bg-card border border-border-main rounded-2xl p-4">
          <p className="text-xs font-semibold text-tertiary mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 bg-[#03C75A] rounded flex items-center justify-center text-[10px] font-black text-white">N</span>
            네이버 업체정보 공유 링크 붙여넣기 <span className="text-dim font-normal">(선택)</span>
          </p>
          <div className="flex gap-2">
            <input
              value={naverUrl}
              onChange={e => { setNaverUrl(e.target.value); setAutoFillMsg(''); }}
              onKeyDown={e => e.key === 'Enter' && handleNaverAutoFill()}
              placeholder="주소·카테고리·전화번호 자동 입력"
              className="flex-1 min-w-0 bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:border-[#03C75A] transition"
            />
            <button
              onClick={handleNaverAutoFill}
              disabled={autoFilling || !naverUrl.trim()}
              className="shrink-0 px-4 py-2.5 bg-[#03C75A] hover:bg-[#02b050] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              {autoFilling ? <Loader2 size={13} className="animate-spin" /> : null}
              {autoFilling ? '조회 중' : '자동입력'}
            </button>
          </div>
          {autoFillMsg && (
            <p className={`mt-2 text-xs ${autoFillMsg.includes('완료') ? 'text-emerald-400' : 'text-red-400'}`}>
              {autoFillMsg}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!formValid || submitting}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#FF6F0F] hover:bg-[#e66000] disabled:opacity-40 text-white font-bold text-base transition"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> 제출 중...</>
            : '신청하기'}
        </button>

      </div>
    </div>
  );
}

const inputCls = 'w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-muted focus:outline-none focus:border-[#FF6F0F] transition';
