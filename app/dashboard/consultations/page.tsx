'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, Send, Paperclip, X, FileText, Loader2,
  Phone, MapPin, Building2, ArrowRight, CheckCircle, MessageSquare, Tag, Trash2
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Inquiry {
  id: string;
  token: string;
  owner_name: string;
  phone: string;
  business_name: string;
  area: string | null;
  has_agency: boolean;
  agency_name: string | null;
  memo: string | null;
  status: 'pending' | 'chatting' | 'completed' | 'converted';
  application_id: string | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
}

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

const STATUS_LABEL: Record<string, string> = {
  pending: '대기중',
  chatting: '상담중',
  completed: '완료',
  converted: '가게등록',
};
const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  chatting:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  completed: 'bg-green-500/15 text-green-400 border-green-500/20',
  converted: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
};

function formatPhone(p: string) {
  return p.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
}
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
function shouldShowDate(msgs: Message[], i: number) {
  if (i === 0) return true;
  return new Date(msgs[i - 1].created_at).toDateString() !== new Date(msgs[i].created_at).toDateString();
}

function ConsultationsInner() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Inquiry['status']>('all');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<{ file: File; preview: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInquiries = useCallback(async () => {
    const { data } = await supabase
      .from('consult_inquiries')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (data) setInquiries(data as Inquiry[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  // URL 파라미터로 자동 선택
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && inquiries.length > 0) {
      const found = inquiries.find((q) => q.id === id);
      if (found) setSelected(found);
    }
  }, [searchParams, inquiries]);

  const loadMessages = useCallback(async (inquiryId: string) => {
    const { data } = await supabase
      .from('consult_messages')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
    // 읽음 처리
    await supabase.from('consult_inquiries').update({ unread_count: 0 }).eq('id', inquiryId);
    setInquiries((prev) => prev.map((q) => q.id === inquiryId ? { ...q, unread_count: 0 } : q));
  }, [supabase]);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);

    const channel = supabase
      .channel(`admin-consult:${selected.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consult_messages', filter: `inquiry_id=eq.${selected.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected, loadMessages, supabase]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendReply = async (content: string, fileUrl?: string, fileType?: string, fileName?: string) => {
    if (!selected) return;
    setIsSending(true);
    try {
      await fetch(`/api/admin/consult/${selected.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, file_url: fileUrl, file_type: fileType, file_name: fileName }),
      });
      loadInquiries();
    } finally { setIsSending(false); }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !filePreview) return;

    if (filePreview) {
      setIsUploading(true);
      try {
        const file = filePreview.file;
        const ext = file.name.split('.').pop();
        const path = `consult/${selected!.id}/${Date.now()}.${ext}`;
        await supabase.storage.from('consult-files').upload(path, file);
        const { data: { publicUrl } } = supabase.storage.from('consult-files').getPublicUrl(path);
        await sendReply(text, publicUrl, file.type.startsWith('image/') ? 'image' : 'file', file.name);
        setFilePreview(null);
        setInput('');
      } catch { alert('파일 전송 오류'); }
      finally { setIsUploading(false); }
    } else {
      setInput('');
      await sendReply(text);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilePreview({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' });
    e.target.value = '';
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('이 메시지를 삭제할까요? 첨부파일도 함께 삭제됩니다.')) return;
    const res = await fetch(`/api/admin/consult/messages/${messageId}`, { method: 'DELETE' });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else {
      const d = await res.json();
      alert(d.error ?? '삭제 실패');
    }
  };

  const handleStatusChange = async (status: Inquiry['status']) => {
    if (!selected) return;
    await supabase.from('consult_inquiries').update({ status }).eq('id', selected.id);
    setSelected({ ...selected, status });
    setInquiries((prev) => prev.map((q) => q.id === selected.id ? { ...q, status } : q));
  };

  const handleConvertToApplication = async () => {
    if (!selected) return;
    setIsConverting(true);
    try {
      // store_applications에 초안 생성
      const { data: app, error } = await supabase
        .from('store_applications')
        .insert({
          owner_name: selected.owner_name,
          owner_phone: selected.phone,
          store_name: selected.business_name,
          address: '',
          phone: selected.phone,
          category: 'food',
          status: 'pending',
          message: `[상담 전환] ${selected.memo || ''}`,
        })
        .select('id')
        .single();

      if (error) throw error;

      await supabase.from('consult_inquiries').update({
        status: 'converted',
        application_id: app.id,
      }).eq('id', selected.id);

      await supabase.from('consult_messages').insert({
        inquiry_id: selected.id,
        sender_type: 'system',
        content: '가게 등록 신청으로 전환되었습니다',
      });

      setSelected({ ...selected, status: 'converted', application_id: app.id });
      setInquiries((prev) => prev.map((q) => q.id === selected.id ? { ...q, status: 'converted' } : q));
      alert(`가게 등록 신청이 생성되었습니다. (ID: ${app.id.slice(0, 8)}...)`);
    } catch (e) {
      console.error(e);
      alert('전환 중 오류가 발생했습니다.');
    } finally {
      setIsConverting(false);
    }
  };

  const filtered = inquiries.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      q.business_name.toLowerCase().includes(s) ||
      q.owner_name.toLowerCase().includes(s) ||
      q.phone.includes(s) ||
      (q.area ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* 목록 패널 */}
      <div className={`flex flex-col border-r border-[--border-main] bg-[--bg-sidebar] ${selected ? 'hidden md:flex' : 'flex'} w-full md:w-[300px] shrink-0`}>
        <div className="p-3 border-b border-[--border-main]">
          <h1 className="text-[15px] font-bold text-[--text-primary] mb-3 px-1">상담 관리</h1>

          {/* 검색 */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[--text-dim]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="업체명, 연락처 검색"
              className="w-full pl-8 pr-3 py-2 bg-[--fill-subtle] border border-[--border-main] rounded-lg text-[13px] text-[--text-primary] placeholder:text-[--text-dim] focus:outline-none focus:border-[--accent] transition-all"
            />
          </div>

          {/* 상태 필터 */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'pending', 'chatting', 'completed', 'converted'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  statusFilter === s
                    ? 'bg-[--accent] text-white'
                    : 'bg-[--fill-subtle] text-[--text-muted] hover:text-[--text-primary]'
                }`}
              >
                {s === 'all' ? '전체' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {[1,2,3,4].map((i) => <div key={i} className="h-16 bg-[--fill-subtle] rounded-lg animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[13px] text-[--text-dim]">상담 내역이 없어요</div>
          ) : (
            filtered.map((inquiry) => (
              <button
                key={inquiry.id}
                onClick={() => setSelected(inquiry)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[--fill-subtle] transition-colors border-b border-[--border-subtle] ${
                  selected?.id === inquiry.id ? 'bg-[--fill-medium]' : ''
                }`}
              >
                <div className="w-8 h-8 bg-orange-500/15 rounded-full flex items-center justify-center text-[14px] shrink-0 mt-0.5">
                  🏪
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[13px] font-semibold text-[--text-primary] truncate">{inquiry.business_name}</span>
                    {inquiry.unread_count > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] bg-[--accent] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {inquiry.unread_count > 9 ? '9+' : inquiry.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_BADGE[inquiry.status]}`}>
                      {STATUS_LABEL[inquiry.status]}
                    </span>
                    {inquiry.has_agency && (
                      <span className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-medium border border-orange-500/20">대행사</span>
                    )}
                    <span className="text-[11px] text-[--text-dim] ml-auto shrink-0">
                      {inquiry.last_message_at ? timeAgo(inquiry.last_message_at) : timeAgo(inquiry.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 채팅 패널 */}
      {selected ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* 채팅 헤더 */}
          <div className="px-4 py-3 bg-[--bg-card] border-b border-[--border-main] flex items-start gap-3 shrink-0">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden p-1 -ml-1 text-[--text-muted] hover:text-[--text-primary] text-[18px] mt-0.5"
            >←</button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[16px] font-bold text-[--text-primary]">{selected.business_name}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${STATUS_BADGE[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
                {selected.has_agency && (
                  <span className="text-[11px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 font-medium">
                    대행사{selected.agency_name ? ` (${selected.agency_name})` : ''}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                <span className="flex items-center gap-1 text-[12px] text-[--text-muted]">
                  <Building2 className="w-3 h-3" />{selected.owner_name}
                </span>
                <a href={`tel:${selected.phone}`} className="flex items-center gap-1 text-[12px] text-[--accent] hover:underline">
                  <Phone className="w-3 h-3" />{formatPhone(selected.phone)}
                </a>
                {selected.area && (
                  <span className="flex items-center gap-1 text-[12px] text-[--text-muted]">
                    <MapPin className="w-3 h-3" />{selected.area}
                  </span>
                )}
                {/* 채팅 링크 복사 */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/consult/chat/${selected.token}`);
                    alert('채팅 링크가 복사되었습니다');
                  }}
                  className="flex items-center gap-1 text-[12px] text-[--text-muted] hover:text-[--accent] transition-colors"
                  title="채팅 링크 복사"
                >
                  <Tag className="w-3 h-3" />링크 복사
                </button>
              </div>
            </div>

            {/* 상태 변경 + 전환 버튼 */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex gap-1">
                {(['pending', 'chatting', 'completed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold border transition-all ${
                      selected.status === s
                        ? STATUS_BADGE[s]
                        : 'bg-[--fill-subtle] text-[--text-dim] border-[--border-main] hover:text-[--text-primary]'
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {selected.status !== 'converted' ? (
                <button
                  onClick={handleConvertToApplication}
                  disabled={isConverting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[--accent] text-white rounded-lg text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {isConverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  언니픽 가게 등록
                </button>
              ) : (
                <a
                  href="/dashboard/applications"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 border border-green-500/20 rounded-lg text-[12px] font-semibold hover:opacity-90 transition-all"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  신청 확인하기
                </a>
              )}
            </div>
          </div>

          {/* 메모 표시 */}
          {selected.memo && (
            <div className="px-4 py-2 bg-yellow-500/5 border-b border-yellow-500/10">
              <p className="text-[12px] text-yellow-400">
                <span className="font-semibold">메모: </span>{selected.memo}
              </p>
            </div>
          )}

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[--bg-surface]">
            {messages.map((msg, i) => {
              if (msg.sender_type === 'system') {
                return (
                  <div key={msg.id}>
                    {shouldShowDate(messages, i) && (
                      <div className="text-center py-2">
                        <span className="text-[11px] text-[--text-dim] bg-[--fill-subtle] px-3 py-1 rounded-full">{formatDate(msg.created_at)}</span>
                      </div>
                    )}
                    <div className="text-center py-1">
                      <span className="text-[11px] text-[--text-muted] bg-[--fill-subtle] px-3 py-1.5 rounded-full border border-[--border-subtle]">
                        {msg.content}
                      </span>
                    </div>
                  </div>
                );
              }

              const isAdmin = msg.sender_type === 'admin';
              return (
                <div key={msg.id}>
                  {shouldShowDate(messages, i) && (
                    <div className="text-center py-2">
                      <span className="text-[11px] text-[--text-dim] bg-[--fill-subtle] px-3 py-1 rounded-full">{formatDate(msg.created_at)}</span>
                    </div>
                  )}
                  <div className={`group flex items-end gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'} mb-1`}>
                    {!isAdmin && (
                      <div className="w-6 h-6 bg-[--fill-medium] rounded-full flex items-center justify-center text-[11px] shrink-0 border border-[--border-main]">
                        🏪
                      </div>
                    )}
                    <div className={`max-w-[70%] flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                      {msg.file_url && msg.file_type === 'image' && (
                        <div className="relative">
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.file_url} alt={msg.file_name || '이미지'} className="rounded-xl max-h-52 object-cover" />
                          </a>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center"
                            title="메시지 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {msg.file_url && msg.file_type === 'file' && (
                        <div className="relative flex items-center gap-1">
                          <a
                            href={msg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium ${
                              isAdmin ? 'bg-[--accent] text-white' : 'bg-[--bg-card] text-[--text-primary] border border-[--border-main]'
                            }`}
                          >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate max-w-[120px]">{msg.file_name}</span>
                          </a>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 bg-[--fill-medium] hover:bg-red-500/20 hover:text-red-400 text-[--text-dim] rounded-full flex items-center justify-center border border-[--border-main]"
                            title="메시지 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {msg.content && (
                        <div className={`relative flex items-center gap-1 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`px-4 py-2.5 text-[14px] leading-relaxed rounded-2xl ${
                            isAdmin
                              ? 'bg-[--accent] text-white rounded-tr-sm'
                              : 'bg-[--bg-card] text-[--text-primary] border border-[--border-main] rounded-tl-sm'
                          }`}>
                            {msg.content}
                          </div>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 bg-[--fill-medium] hover:bg-red-500/20 hover:text-red-400 text-[--text-dim] rounded-full flex items-center justify-center border border-[--border-main] shrink-0"
                            title="메시지 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="text-[11px] text-[--text-dim]">{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* 파일 미리보기 */}
          {filePreview && (
            <div className="px-4 py-2 bg-[--bg-card] border-t border-[--border-main] flex items-center gap-3">
              {filePreview.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filePreview.preview} alt="미리보기" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[--fill-subtle] border border-[--border-main] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[--text-dim]" />
                </div>
              )}
              <p className="flex-1 text-[12px] text-[--text-secondary] truncate">{filePreview.file.name}</p>
              <button onClick={() => setFilePreview(null)} className="text-[--text-dim] hover:text-[--text-primary]"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* 입력창 */}
          <div className="px-4 py-3 bg-[--bg-card] border-t border-[--border-main]">
            <div className="flex items-end gap-2 bg-[--fill-subtle] rounded-xl px-3 py-2 border border-[--border-main]">
              <button onClick={() => fileInputRef.current?.click()} className="p-1 text-[--text-dim] hover:text-[--accent] transition-colors shrink-0 mb-0.5">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="답장 메시지..."
                rows={1}
                className="flex-1 bg-transparent text-[14px] text-[--text-primary] placeholder:text-[--text-dim] resize-none focus:outline-none py-1 max-h-28 leading-relaxed"
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = `${Math.min(t.scrollHeight, 112)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !filePreview) || isSending || isUploading}
                className="w-8 h-8 bg-[--accent] text-white rounded-lg flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40 mb-0.5"
              >
                {isSending || isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFile} className="hidden" />
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-[--bg-surface]">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 text-[--text-dim] mx-auto mb-3" />
            <p className="text-[15px] font-semibold text-[--text-secondary]">상담을 선택하세요</p>
            <p className="text-[13px] text-[--text-dim] mt-1">왼쪽 목록에서 상담을 클릭하세요</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsultationsPage() {
  return (
    <Suspense>
      <ConsultationsInner />
    </Suspense>
  );
}
