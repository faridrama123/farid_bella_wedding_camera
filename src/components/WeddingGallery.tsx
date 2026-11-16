import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  X,
} from 'lucide-react';
import { S3WeddingPhoto } from '../types/wedding';
import { ResilientImage } from './ResilientImage';

interface WeddingGalleryProps {
  refreshSignal: number;
  onJumpToCamera: () => void;
}

type FilterMode = 'all' | 'color' | 'bw';

export function WeddingGallery({ refreshSignal, onJumpToCamera }: WeddingGalleryProps) {
  const [photos, setPhotos] = useState<S3WeddingPhoto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/photos');
      const rawText = await response.text();
      let data: { error?: string; photos?: S3WeddingPhoto[] } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server error (${response.status}): ${rawText.slice(0, 120)}`);
      }
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memuat galeri pernikahan.');
      }
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal terhubung ke Neo S3.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery, refreshSignal]);

  const filteredPhotos = useMemo(() => {
    if (filterMode === 'bw') {
      return photos.filter((p) => p.filter === 'bw');
    }
    if (filterMode === 'color') {
      return photos.filter((p) => p.filter !== 'bw');
    }
    return photos;
  }, [photos, filterMode]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % filteredPhotos.length
        );
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + filteredPhotos.length) % filteredPhotos.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, filteredPhotos.length]);

  const formatTimestamp = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  const activePhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  return (
    <section id="gallery" className="py-16 md:py-24 bg-[#F7F5F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header & Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#DED8CB]">
          <div>
            <p className="text-xs font-film-mono uppercase tracking-[0.2em] text-[#9A7B4F]">
              Arsip Album · Neo S3 Wedding Bucket
            </p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1B18] mt-2 text-balance">
              Galeri Momen Dari Para Tamu
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Functional Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#DED8CB]">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'color', label: 'Berwarna' },
                  { id: 'bw', label: 'Klasik B&W' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    filterMode === tab.id
                      ? 'bg-[#F7F5F0] text-[#1C1B18] shadow-sm'
                      : 'text-[#6E685C] hover:text-[#1C1B18]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchGallery}
              disabled={loading}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-[#CFC7B7] bg-[#F7F5F0] hover:bg-[#EFECE4] text-xs font-medium text-[#1C1B18] inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Line */}
        <div className="mt-5 flex items-center justify-between text-xs text-[#6E685C] font-film-mono">
          <span className="tabular-nums">{filteredPhotos.length} Foto Ditampilkan</span>
          <span>Bucket: wedding</span>
        </div>

        {/* Loading State */}
        {loading && photos.length === 0 ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-xl bg-[#EAE5DA] animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mt-10 bg-[#EFECE4] border border-[#DED8CB] rounded-2xl p-8 text-center">
            <p className="text-sm font-medium text-[#1C1B18]">Gagal Memuat Galeri</p>
            <p className="text-xs text-[#6E685C] mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchGallery}
              className="mt-4 min-h-[44px] px-5 py-2 rounded-lg bg-[#1C1B18] text-[#F7F5F0] text-xs font-medium"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="mt-10 bg-[#EFECE4] border border-[#DED8CB] rounded-2xl p-10 text-center">
            <h3 className="font-editorial text-2xl font-medium text-[#1C1B18]">
              Belum Ada Foto Tersimpan
            </h3>
            <p className="text-sm text-[#5E584E] mt-2 max-w-md mx-auto">
              Jadilah tamu pertama yang mengabadikan momen bahagia Farid &amp; Bella dengan kamera
              sekali pakai Anda.
            </p>
            <button
              type="button"
              onClick={onJumpToCamera}
              className="mt-6 min-h-[44px] px-6 py-2.5 rounded-lg bg-[#1C1B18] hover:bg-[#2F2D28] text-[#F7F5F0] text-xs sm:text-sm font-medium transition-colors"
            >
              Ambil Foto Pertama
            </button>
          </div>
        ) : (
          /* Editorial Gallery Grid */
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map((photo, index) => (
              <article
                key={photo.key}
                className="group bg-[#EFECE4]/60 border border-[#DED8CB] rounded-xl overflow-hidden transition-colors hover:border-[#9A7B4F]"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="block w-full aspect-[4/3] overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F]"
                >
                  <ResilientImage
                    src={photo.url}
                    alt={`Foto oleh ${photo.guestName}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </button>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-[#1C1B18] truncate">
                      {photo.guestName}
                    </h3>
                    <span className="font-film-mono text-xs text-[#6E685C] shrink-0 tabular-nums">
                      #{String(photo.frameNumber).padStart(2, '0')}
                    </span>
                  </div>
                  {photo.wish && (
                    <p className="text-xs text-[#5E584E] mt-1.5 line-clamp-2 leading-relaxed">
                      &ldquo;{photo.wish}&rdquo;
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[#7A7365] font-film-mono">
                    <span>{formatTimestamp(photo.capturedAt || photo.lastModified)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Viewer */}
      {activePhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Lightbox Header */}
          <div
            className="flex items-center justify-between text-[#F7F5F0]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs sm:text-sm">
              <span className="font-medium">{activePhoto.guestName}</span>
              <span className="mx-2 text-white/40">·</span>
              <span className="font-film-mono text-[#C9A96E] tabular-nums">
                Frame {String(activePhoto.frameNumber).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activePhoto.url}
                download={`farid-bella-${activePhoto.frameNumber}.jpg`}
                className="min-h-[44px] px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Simpan</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Tutup galeri"
                className="min-h-[44px] min-w-[44px] rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Image + Prev/Next */}
          <div
            className="relative flex-1 flex items-center justify-center my-4 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex(
                    (lightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length
                  )
                }
                aria-label="Foto sebelumnya"
                className="absolute left-0 sm:left-4 z-10 min-h-[44px] min-w-[44px] rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/15"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <img
              src={activePhoto.url}
              alt={`Foto oleh ${activePhoto.guestName}`}
              className="max-h-[75vh] max-w-full object-contain rounded-lg"
            />

            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length)}
                aria-label="Foto berikutnya"
                className="absolute right-0 sm:right-4 z-10 min-h-[44px] min-w-[44px] rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/15"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Lightbox Wish Footer */}
          <div
            className="text-center max-w-xl mx-auto text-[#D6CFC2]"
            onClick={(e) => e.stopPropagation()}
          >
            {activePhoto.wish && (
              <p className="font-editorial italic text-lg sm:text-xl text-[#F7F5F0]">
                &ldquo;{activePhoto.wish}&rdquo;
              </p>
            )}
            <p className="font-film-mono text-xs text-[#9E9789] mt-1 tabular-nums">
              {lightboxIndex + 1} / {filteredPhotos.length} ·{' '}
              {formatTimestamp(activePhoto.capturedAt || activePhoto.lastModified)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
