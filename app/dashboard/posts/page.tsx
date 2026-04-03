'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

interface DeleteRequest {
  id:               string;
  post_id:          string;
  store_id:         string;
  reason:           string;
  status:           'pending' | 'approved' | 'rejected';
  admin_note:       string | null;
  has_active_coupon: boolean;
  requested_at:     string;
  processed_at:     string | null;
  store_posts:      { content: string } | null;
  stores:           { name: string }    | null;
}

export default function PostsPage() {
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [noteModal, setNoteModal]   = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null);
  const [note,      setNote]        = useState('');

  const load = async () => {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb
      .from('store_post_delete_requests')
      .select(`
        id, post_id, store_id, reason, status, admin_note,
        has_active_coupon, requested_at, processed_at,
        store_posts ( content ),
        stores ( name )
      `)
      .order('requested_at', { ascending: false });
    setRequests((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const sb = createClient();
    load();
    const channel = sb
      .channel('posts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_post_delete_requests' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_posts' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProcess = async () => {
    if (!noteModal) return;
    setProcessing(noteModal.id);
    const sb = createClient();
    try {
      await sb.rpc('process_post_delete_request', {
        p_request_id: noteModal.id,
        p_action:     noteModal.action,
        p_note:       note.trim() || null,
      });
      setRequests(prev => prev.map(r =>
        r.id === noteModal.id
          ? { ...r, status: noteModal.action, admin_note: note.trim() || null, processed_at: new Date().toISOString() }
          : r,
      ));
    } catch (e: any) {
      alert('처리 실패: ' + (e.message ?? ''));
    } finally {
      setProcessing(null);
      setNoteModal(null);
      setNote('');
    }
  };

  const filtered = requests.filter(r => r.status === filter);

  const counts = {
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">게시물 관리</h1>
        <p className="text-sm text-gray-500 mt-1">사장님이 요청한 게시물 삭제를 승인하거나 반려해요</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'pending',  label: '대기 중',  color: 'text-yellow-400', dot: 'bg-yellow-400' },
          { key: 'approved', label: '승인됨',   color: 'text-green-400',  dot: 'bg-green-400' },
          { key: 'rejected', label: '반려됨',   color: 'text-red-400',    dot: 'bg-red-400' },
        ] as const).map(({ key, label, color, dot }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              filter === key
                ? 'bg-[#1A1D23] border border-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {label}
            <span className={`text-xs ${color}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#1A1D23] rounded-2xl p-5 animate-pulse h-28" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">요청이 없어요</div>
        ) : (
          filtered.map(req => (
            <div key={req.id} className="bg-[#1A1D23] border border-white/5 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* 가게명 + 날짜 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-white">{req.stores?.name ?? '알 수 없음'}</span>
                    {req.has_active_coupon && (
                      <span className="flex items-center gap-1 text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">
                        <AlertTriangle size={10} /> 활성 쿠폰 있음
                      </span>
                    )}
                    <span className="text-xs text-gray-600 ml-auto">
                      <Clock size={11} className="inline mr-1" />
                      {new Date(req.requested_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* 게시물 내용 */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-2">
                    <p className="text-xs text-gray-500 mb-1">게시물 내용</p>
                    <p className="text-sm text-gray-300 line-clamp-2">{req.store_posts?.content ?? '(삭제된 게시물)'}</p>
                  </div>

                  {/* 삭제 사유 */}
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-600">삭제 사유: </span>
                    {req.reason}
                  </p>

                  {/* 처리 메모 */}
                  {req.admin_note && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="text-gray-600">관리자 메모: </span>
                      {req.admin_note}
                    </p>
                  )}
                </div>

                {/* 액션 버튼 */}
                {req.status === 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => { setNoteModal({ id: req.id, action: 'approved' }); setNote(''); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded-xl text-xs font-bold transition"
                    >
                      <CheckCircle size={13} /> 승인
                    </button>
                    <button
                      onClick={() => { setNoteModal({ id: req.id, action: 'rejected' }); setNote(''); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition"
                    >
                      <XCircle size={13} /> 반려
                    </button>
                  </div>
                )}

                {req.status !== 'pending' && (
                  <div className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl ${
                    req.status === 'approved'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {req.status === 'approved' ? '✅ 승인됨' : '❌ 반려됨'}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 메모 모달 */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1D23] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-1">
              {noteModal.action === 'approved' ? '✅ 삭제 요청 승인' : '❌ 삭제 요청 반려'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {noteModal.action === 'approved'
                ? '승인하면 게시물이 즉시 삭제됩니다'
                : '반려 사유를 사장님에게 전달해요'}
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="관리자 메모 (선택사항)"
              rows={3}
              className="w-full bg-[#0D0F14] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setNoteModal(null); setNote(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-white/5 hover:bg-white/10 transition"
              >
                취소
              </button>
              <button
                onClick={handleProcess}
                disabled={!!processing}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 ${
                  noteModal.action === 'approved'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {processing ? '처리 중...' : noteModal.action === 'approved' ? '승인하기' : '반려하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
