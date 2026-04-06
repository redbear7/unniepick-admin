'use client';

import { Play, Pause, Trash2, Loader2, Megaphone, Radio } from 'lucide-react';
import { Announcement, Store, FishVoice, MODE_LABEL, fmtTime, voiceLabel } from './_shared';

interface Props {
  announcements:     Announcement[];
  stores:            Store[];
  fishVoices:        FishVoice[];
  selectedStore:     string;
  playingId:         string | null;
  announcingId:      string | null;
  announcementPlaying: boolean;
  deleting:          string | null;
  loading:           boolean;
  onPlay:            (ann: Announcement) => void;
  onBroadcast:       (ann: Announcement) => void;
  onDelete:          (id: string) => void;
  onClearAll:        () => void;
  hasTrack:          boolean;
}

export default function AnnouncementHistory({
  announcements, stores, fishVoices, selectedStore,
  playingId, announcingId, announcementPlaying,
  deleting, loading,
  onPlay, onBroadcast, onDelete, onClearAll, hasTrack,
}: Props) {
  const storeName = (id: string) => stores.find(s => s.id === id)?.name ?? id;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-400">
          {selectedStore ? stores.find(s => s.id === selectedStore)?.name : '전체'} 안내방송
          <span className="ml-2 text-gray-600">· {announcements.length}건</span>
          <span className="ml-2 text-[10px] text-gray-700 font-normal">로컬 저장</span>
        </h2>
        {announcements.length > 0 && (
          <button onClick={onClearAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gray-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition">
            <Trash2 size={11} /> 전체 초기화
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600">
          <Loader2 size={20} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Megaphone size={32} className="mb-3 opacity-30" />
          <p className="text-sm">생성된 안내방송이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map(ann => (
            <div key={ann.id}
              className="bg-[#1A1D23] border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3 hover:border-white/10 transition">
              <button
                onClick={() => onPlay(ann)}
                disabled={!ann.audio_url}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition ${
                  playingId === ann.id || announcingId === ann.id
                    ? 'bg-[#FF6F0F] text-white'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-30'
                }`}>
                {playingId === ann.id || announcingId === ann.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug">{ann.text}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {!selectedStore && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] border border-[#FF6F0F]/20">
                      {storeName(ann.store_id)}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ann.ann_type === 'call' ? 'bg-blue-500/15 text-blue-400' : 'bg-[#FF6F0F]/15 text-[#FF6F0F]'}`}>
                    {ann.ann_type === 'call' ? '호출음성' : '템플릿음성'}
                  </span>
                  <span className="text-[10px] text-gray-600">{voiceLabel(fishVoices, ann.voice_type)}</span>
                  <span className="text-[10px] text-gray-600">·</span>
                  <span className="text-[10px] text-gray-600">{MODE_LABEL[ann.play_mode] ?? ann.play_mode}</span>
                  <span className="text-[10px] text-gray-600">· {ann.repeat_count}회</span>
                  <span className="text-[10px] text-gray-600 ml-auto">{fmtTime(ann.created_at)}</span>
                </div>
              </div>

              {ann.audio_url && hasTrack && (
                <button
                  onClick={() => onBroadcast(ann)}
                  disabled={announcementPlaying}
                  title={ann.play_mode === 'immediate' ? '즉시 방송 (트랙 페이드 아웃)' : '곡간 삽입 대기'}
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                    announcingId === ann.id && announcementPlaying
                      ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/40 text-[#FF6F0F] cursor-not-allowed'
                      : announcementPlaying
                        ? 'bg-white/5 border-white/10 text-gray-600 cursor-not-allowed opacity-40'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                  }`}>
                  <Radio size={10} />
                  {ann.play_mode === 'immediate' ? '즉시' : '곡간'}
                </button>
              )}
              <button onClick={() => onDelete(ann.id)} disabled={deleting === ann.id}
                className="shrink-0 text-gray-600 hover:text-red-400 transition p-1">
                {deleting === ann.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
