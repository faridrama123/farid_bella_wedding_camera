import { FormEvent, useState } from 'react';
import { CheckCircle2, CloudUpload, Eye, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import { FILM_FILTERS, LocalShot } from '../types/wedding';

interface FilmRollSectionProps {
  shots: LocalShot[];
  maxShots: number;
  guestName: string;
  wish: string;
  onChangeGuestName: (name: string) => void;
  onChangeWish: (wish: string) => void;
  onRemoveShot: (id: string) => void;
  onUploadPending: () => Promise<void>;
  onResetRoll: () => void;
  onGoToCamera: () => void;
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccessMessage: string | null;
}

export function FilmRollSection({
  shots,
  maxShots,
  guestName,
  wish,
  onChangeGuestName,
  onChangeWish,
  onRemoveShot,
  onUploadPending,
  onResetRoll,
  onGoToCamera,
  isUploading,
  uploadError,
  uploadSuccessMessage,
}: FilmRollSectionProps) {
  const [previewShot, setPreviewShot] = useState<LocalShot | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const pendingShots = shots.filter((s) => s.status === 'pending');
  const uploadedShots = shots.filter((s) => s.status === 'uploaded');
  const slots = Array.from({ length: maxShots }, (_, idx) => {
    const frameNumber = idx + 1;
    const shot = shots[idx] || null;
    return { frameNumber, shot };
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pendingShots.length === 0 || isUploading) return;
    await onUploadPending();
  };

  const getFilterLabel = (filterId: string) =>
    FILM_FILTERS.find((f) => f.id === filterId)?.label || 'Natural';

  return (
    <section id="roll" className="py-16 md:py-24 bg-[#F7F5F0] border-b border-[#DED8CB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#DED8CB]">
          <div>
            <p className="text-xs font-film-mono uppercase tracking-[0.2em] text-[#9A7B4F]">
              Contact Sheet · Roll Film Anda
            </p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1B18] mt-2 text-balance">
              10 Bingkai Kenangan Anda
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#5E584E]">
            <span className="font-film-mono tabular-nums">
              Terisi: <strong className="text-[#1C1B18]">{shots.length}/{maxShots}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-film-mono tabular-nums">
              Siap Upload: <strong className="text-[#9A7B4F]">{pendingShots.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-film-mono tabular-nums">
              Tersimpan di S3: <strong className="text-[#1C1B18]">{uploadedShots.length}</strong>
            </span>
          </div>
        </div>

        {/* 10-Frame Film Strip Grid */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {slots.map(({ frameNumber, shot }) => {
            const pad = String(frameNumber).padStart(2, '0');
            if (!shot) {
              return (
                <button
                  key={pad}
                  type="button"
                  onClick={onGoToCamera}
                  className="group aspect-[4/5] rounded-xl border border-dashed border-[#CFC7B7] bg-[#EFECE4]/50 hover:bg-[#EFECE4] hover:border-[#9A7B4F] transition-colors p-3 flex flex-col justify-between text-left"
                >
                  <span className="font-film-mono text-xs text-[#8C8476] tabular-nums">
                    {pad}A
                  </span>
                  <span className="text-xs text-[#6E685C] group-hover:text-[#1C1B18] transition-colors">
                    Kosong · Klik untuk foto
                  </span>
                </button>
              );
            }

            return (
              <div
                key={shot.id}
                className="group bg-[#181715] text-[#F7F5F0] rounded-xl overflow-hidden border border-[#2C2924] flex flex-col"
              >
                {/* Film Sprocket Header */}
                <div className="px-3 py-2 flex items-center justify-between text-[11px] font-film-mono text-[#B8B1A3]">
                  <span className="tabular-nums">{pad}A</span>
                  <span>
                    {shot.status === 'uploaded' ? (
                      <span className="inline-flex items-center gap-1 text-[#C9A96E]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Terkirim</span>
                      </span>
                    ) : (
                      <span>Siap Kirim</span>
                    )}
                  </span>
                </div>

                {/* Image Frame */}
                <div className="relative aspect-[4/3] bg-black overflow-hidden">
                  <img
                    src={shot.dataUrl}
                    alt={`Frame ${pad}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setPreviewShot(shot)}
                      aria-label={`Lihat frame ${pad}`}
                      className="min-h-[40px] min-w-[40px] rounded-full bg-white/90 text-[#11100E] flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {shot.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => onRemoveShot(shot.id)}
                        aria-label={`Hapus frame ${pad}`}
                        className="min-h-[40px] min-w-[40px] rounded-full bg-[#1C1B18]/90 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Film Footer */}
                <div className="px-3 py-2 flex items-center justify-between text-[11px] text-[#9E9789]">
                  <span className="truncate">{getFilterLabel(shot.filter)}</span>
                  {shot.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => onRemoveShot(shot.id)}
                      className="text-[#D6CFC2] hover:text-red-400 transition-colors sm:hidden"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload Form & Actions */}
        <div className="mt-10 bg-[#EFECE4] rounded-2xl p-6 sm:p-8 border border-[#DED8CB]">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-4">
              <label htmlFor="guest-name" className="block text-xs font-medium text-[#4A463E] mb-2">
                Nama Tamu / Pengirim
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(e) => onChangeGuestName(e.target.value)}
                placeholder="Contoh: Raka & Nadya"
                maxLength={60}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#F7F5F0] border border-[#CFC7B7] text-sm text-[#1C1B18] placeholder:text-[#8C8476] focus:outline-none focus:border-[#9A7B4F]"
              />
            </div>

            <div className="lg:col-span-5">
              <label htmlFor="guest-wish" className="block text-xs font-medium text-[#4A463E] mb-2">
                Ucapan Singkat untuk Farid &amp; Bella (Opsional)
              </label>
              <input
                id="guest-wish"
                type="text"
                value={wish}
                onChange={(e) => onChangeWish(e.target.value)}
                placeholder="Semoga sakinah mawaddah warahmah..."
                maxLength={140}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#F7F5F0] border border-[#CFC7B7] text-sm text-[#1C1B18] placeholder:text-[#8C8476] focus:outline-none focus:border-[#9A7B4F]"
              />
            </div>

            <div className="lg:col-span-3 flex flex-col gap-2">
              <button
                type="submit"
                disabled={pendingShots.length === 0 || isUploading}
                className="w-full min-h-[48px] px-5 py-3 rounded-lg bg-[#1C1B18] hover:bg-[#2F2D28] disabled:opacity-45 disabled:cursor-not-allowed text-[#F7F5F0] text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengunggah ke S3...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>
                      Upload {pendingShots.length > 0 ? `${pendingShots.length} Foto` : 'Roll'} ke
                      S3
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Status Feedback */}
          {(uploadError || uploadSuccessMessage) && (
            <div className="mt-5 pt-4 border-t border-[#DED8CB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {uploadError ? (
                <p className="text-sm text-red-700 font-medium">{uploadError}</p>
              ) : (
                <p className="text-sm text-[#2E5A36] font-medium inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{uploadSuccessMessage}</span>
                </p>
              )}

              {uploadedShots.length === maxShots && (
                <div>
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="text-xs font-medium text-[#6E685C] hover:text-[#1C1B18] underline underline-offset-4 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ganti Tamu / Roll Baru</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[#4A463E]">Mulai roll baru (10 foto) di perangkat ini?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onResetRoll();
                          setConfirmReset(false);
                        }}
                        className="font-semibold text-[#1C1B18] underline"
                      >
                        Ya, Mulai Baru
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="text-[#6E685C]"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal for Local Roll Shot */}
      {previewShot && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewShot(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#181715] rounded-2xl overflow-hidden border border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 text-xs font-film-mono text-[#D6CFC2]">
              <span>
                FRAME {String(previewShot.frameNumber).padStart(2, '0')} ·{' '}
                {getFilterLabel(previewShot.filter)}
              </span>
              <button
                type="button"
                onClick={() => setPreviewShot(null)}
                aria-label="Tutup pratinjau"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#D6CFC2] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black max-h-[75vh] flex items-center justify-center">
              <img
                src={previewShot.dataUrl}
                alt={`Frame ${previewShot.frameNumber}`}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
