'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase';
import { Send, X, FileText, Loader2, RefreshCw, ImagePlus } from 'lucide-react';

interface Message {
  id: string;
  inquiry_id: string;
  sender_type: 'admin' | 'business' | 'system';
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
}

interface Inquiry {
  id: string;
  business_name: string;
  status: string;
}

interface Chip {
  id: string;
  label: string;
  message: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

type LoadError = 'not_found' | 'server_error' | null;

export default function ConsultChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const supabase = createClient();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<{ file: File; preview: string } | null>(null);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [isDragging, setIsDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async ({ setInquiryData = false } = {}) => {
    const res = await fetch(`/api/consult/${token}/messages`);
    if (!res.ok) {
      setLoadError(res.status === 404 ? 'not_found' : 'server_error');
      return;
    }
    const data = await res.json();
    setLoadError(null);
    if (setInquiryData && data.inquiry) setInquiry(data.inquiry as Inquiry);
    setMessages(data.messages ?? []);
  }, [token]);

  useEffect(() => {
    // 최초 로드: inquiry 정보도 함께 세팅
    loadMessages({ setInquiryData: true });

    // 칩 로드
    fetch('/api/consult/chips')
      .then(r => r.json())
      .then(d => setChips(d.chips ?? []));
  }, [token, loadMessages]);

  // Realtime 구독
  useEffect(() => {
    if (!inquiry) return;
    const channel = supabase
      .channel(`consult:${inquiry.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consult_messages', filter: `inquiry_id=eq.${inquiry.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [inquiry, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string, fileUrl?: string, fileType?: string, fileName?: string) => {
    setIsSending(true);
    try {
      const res = await fetch(`/api/consult/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, file_url: fileUrl, file_type: fileType, file_name: fileName }),
      });
      if (res.ok) {
        // Realtime이 비활성화된 경우에도 즉시 갱신
        await loadMessages();
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !filePreview) return;

    if (filePreview) {
      setIsUploading(true);
      try {
        const file = filePreview.file;
        const ext = file.name.split('.').pop();
        const path = `consult/${token}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('consult-files').upload(path, file);
        if (upErr) throw new Error(`파일 업로드 실패: ${upErr.message}`);
        const { data: { publicUrl } } = supabase.storage.from('consult-files').getPublicUrl(path);
        await sendMessage(text, publicUrl, file.type.startsWith('image/') ? 'image' : 'file', file.name);
        setFilePreview(null);
        setInput('');
      } catch (e: unknown) {
        alert((e as Error).message ?? '파일 전송 오류');
      }
      finally { setIsUploading(false); }
    } else {
      setInput('');
      await sendMessage(text);
    }
  };

  const handleChip = async (chip: Chip) => {
    if (isSending) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/consult/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chip.message }),
      });
      if (res.ok) await loadMessages();
    } finally { setIsSending(false); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyFile(file);
    e.target.value = '';
  };

  const applyFile = (file: File) => {
    setFilePreview({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  if (loadError === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-5">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-[18px] font-bold text-gray-800">상담을 찾을 수 없어요</p>
          <p className="text-[14px] text-gray-500 mt-2">링크가 올바른지 확인해주세요</p>
        </div>
      </div>
    );
  }

  if (loadError === 'server_error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-5">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-[18px] font-bold text-gray-800">일시적인 오류가 발생했어요</p>
          <p className="text-[14px] text-gray-500 mt-2">잠시 후 다시 시도해주세요</p>
          <button
            onClick={() => loadMessages({ setInquiryData: true })}
            className="mt-5 flex items-center gap-2 mx-auto px-5 py-2.5 bg-[#FF6F0F] text-white text-[14px] font-semibold rounded-full"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#f5f5f5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 shrink-0 z-10">
        <div className="w-8 h-8 bg-[#FF6F0F] rounded-full flex items-center justify-center text-[14px] shrink-0">🌸</div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">
            {inquiry?.business_name ?? '창원언니쓰 상담'}
          </p>
          <p className="text-[12px] text-green-500 font-medium">온라인</p>
        </div>
        {inquiry?.status === 'completed' && (
          <span className="text-[11px] bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-semibold border border-green-100 shrink-0">
            상담 완료
          </span>
        )}
      </div>

      {/* 언니픽 등록 유도 배너 — 추후 활성화 */}
      {/* <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[13px] font-bold text-white">언니픽에 가게를 등록해보세요!</p>
          <p className="text-[11px] text-orange-100">창원 최대 맛집 앱 · 쿠폰 · 리뷰 관리</p>
        </div>
        <a href="/apply" className="flex items-center gap-1 px-3 py-1.5 bg-white text-[#FF6F0F] text-[12px] font-bold rounded-full hover:opacity-90 transition-opacity shrink-0">
          등록하기
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div> */}

      {/* 메시지 — 드래그앤드롭 대상 */}
      <div
        ref={dropZoneRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 overscroll-contain relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 드래그 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 z-20 bg-[#FF6F0F]/10 border-2 border-dashed border-[#FF6F0F] rounded-2xl flex flex-col items-center justify-center gap-3 pointer-events-none">
            <ImagePlus className="w-10 h-10 text-[#FF6F0F]" />
            <p className="text-[15px] font-bold text-[#FF6F0F]">여기에 놓으면 첨부돼요</p>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[14px] text-gray-400">상담이 시작되었습니다 🌸</p>
            <p className="text-[13px] text-gray-400 mt-1">궁금하신 점을 편하게 물어보세요</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.sender_type === 'system') {
            return (
              <div key={msg.id} className="text-center py-2">
                <span className="text-[12px] text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
                  상담이 접수되었습니다
                </span>
              </div>
            );
          }

          const isAdmin = msg.sender_type === 'admin';
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isAdmin ? 'flex-row' : 'flex-row-reverse'} mb-1`}>
              {isAdmin && (
                <div className="w-7 h-7 bg-[#FF6F0F] rounded-full flex items-center justify-center text-white text-[12px] shrink-0 mb-0.5">
                  🌸
                </div>
              )}
              <div className={`max-w-[75%] flex flex-col gap-1 ${isAdmin ? 'items-start' : 'items-end'}`}>
                {msg.file_url && msg.file_type === 'image' && (
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={msg.file_url} alt={msg.file_name || '이미지'} className="rounded-2xl max-h-60 object-cover" />
                  </a>
                )}
                {msg.file_url && msg.file_type === 'file' && (
                  <a
                    href={msg.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-medium ${
                      isAdmin ? 'bg-[#FF6F0F] text-white' : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-[140px]">{msg.file_name}</span>
                  </a>
                )}
                {msg.content && (
                  <div className={`px-4 py-2.5 text-[15px] leading-relaxed rounded-2xl ${
                    isAdmin
                      ? 'bg-[#FF6F0F] text-white rounded-tl-sm'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tr-sm'
                  }`}>
                    {msg.content}
                  </div>
                )}
                <span className="text-[11px] text-gray-400">{formatTime(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 빠른 질문 칩 */}
      {chips.length > 0 && (
        <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {chips.map(chip => (
              <button
                key={chip.id}
                onClick={() => handleChip(chip)}
                disabled={isSending}
                className="shrink-0 px-3.5 py-2 rounded-full border border-[#FF6F0F] text-[#FF6F0F] text-[13px] font-medium bg-white active:bg-orange-50 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 파일 미리보기 */}
      {filePreview && (
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center gap-3">
          {filePreview.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={filePreview.preview} alt="미리보기" className="w-12 h-12 rounded-xl object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <p className="flex-1 text-[13px] text-gray-700 truncate">{filePreview.file.name}</p>
          <button onClick={() => setFilePreview(null)} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 입력창 */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-3 pt-2"
           style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>

        {/* 첨부 버튼 행 */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-orange-50 active:bg-orange-100 text-gray-500 hover:text-[#FF6F0F] text-[12px] font-semibold transition-colors"
          >
            <ImagePlus className="w-4 h-4" />
            사진·파일 첨부
          </button>
          <span className="text-[11px] text-gray-300 self-center">또는 채팅창에 드래그</span>
        </div>

        {/* 텍스트 입력 + 전송 */}
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="flex-1 bg-transparent text-[16px] text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none py-1.5 leading-relaxed"
            style={{ maxHeight: '96px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 96)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !filePreview) || isSending || isUploading}
            className="w-9 h-9 bg-[#FF6F0F] text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 mb-0.5"
          >
            {isSending || isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}
