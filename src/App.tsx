import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, Camera, Film, Home, Images } from 'lucide-react';
import { DisposableCamera } from './components/DisposableCamera';
import { FilmRollSection } from './components/FilmRollSection';
import { ResilientImage } from './components/ResilientImage';
import { WeddingGallery } from './components/WeddingGallery';
import { COUPLE_PHOTOS, WEDDING_CONFIG } from './config/weddingConfig';
import { LocalShot } from './types/wedding';
import { dataUrlToBlob } from './utils/filmProcessor';

const STORAGE_KEY = 'farid_bella_disposable_roll_v1';

interface StoredRollState {
  rollId: string;
  guestName: string;
  wish: string;
  shots: LocalShot[];
}

function generateRollId(): string {
  return `roll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadInitialRoll(): StoredRollState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredRollState>;
      if (Array.isArray(parsed.shots)) {
        return {
          rollId: parsed.rollId || generateRollId(),
          guestName: parsed.guestName || '',
          wish: parsed.wish || '',
          shots: parsed.shots.slice(0, WEDDING_CONFIG.maxShotsPerGuest),
        };
      }
    }
  } catch {
    // Fallback to fresh roll
  }
  return {
    rollId: generateRollId(),
    guestName: '',
    wish: '',
    shots: [],
  };
}

export default function App() {
  const [rollState, setRollState] = useState<StoredRollState>(() => loadInitialRoll());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [galleryRefreshSignal, setGalleryRefreshSignal] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rollState));
    } catch {
      // Ignore storage quota errors safely; state stays active in memory
    }
  }, [rollState]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleCaptureShot = useCallback(
    (shotData: Omit<LocalShot, 'id' | 'frameNumber' | 'status'>) => {
      setUploadError(null);
      setUploadSuccessMessage(null);
      setRollState((prev) => {
        if (prev.shots.length >= WEDDING_CONFIG.maxShotsPerGuest) {
          return prev;
        }
        const nextFrameNumber = prev.shots.length + 1;
        const newShot: LocalShot = {
          ...shotData,
          id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          frameNumber: nextFrameNumber,
          status: 'pending',
        };
        return {
          ...prev,
          shots: [...prev.shots, newShot],
        };
      });
    },
    []
  );

  const handleRemoveShot = useCallback((id: string) => {
    setRollState((prev) => {
      const target = prev.shots.find((s) => s.id === id);
      if (!target || target.status === 'uploaded') return prev;
      const remaining = prev.shots
        .filter((s) => s.id !== id)
        .map((shot, idx) => ({
          ...shot,
          frameNumber: idx + 1,
        }));
      return {
        ...prev,
        shots: remaining,
      };
    });
  }, []);

  const handleUploadPending = useCallback(async () => {
    const pending = rollState.shots.filter((s) => s.status === 'pending');
    if (pending.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: pending.length });
    setUploadError(null);
    setUploadSuccessMessage(null);

    let successCount = 0;

    try {
      for (let i = 0; i < pending.length; i++) {
        const shot = pending[i];
        setUploadProgress({ current: i + 1, total: pending.length });

        const formData = new FormData();
        formData.append('guestName', rollState.guestName.trim() || 'Tamu Pernikahan');
        formData.append('wish', rollState.wish.trim());
        formData.append('rollId', rollState.rollId);
        formData.append(
          'frames',
          JSON.stringify([
            {
              frameNumber: shot.frameNumber,
              filter: shot.filter,
              capturedAt: shot.capturedAt,
            },
          ])
        );

        const blob = dataUrlToBlob(shot.dataUrl);
        formData.append('photos', blob, `frame-${String(shot.frameNumber).padStart(2, '0')}.jpg`);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Gagal mengunggah foto ke Neo S3.');
        }

        const uploadedKey = result.photos?.[0]?.key as string | undefined;
        successCount += 1;

        setRollState((prev) => ({
          ...prev,
          shots: prev.shots.map((item) =>
            item.id === shot.id
              ? {
                  ...item,
                  status: 'uploaded',
                  s3Key: uploadedKey || item.s3Key,
                }
              : item
          ),
        }));
      }

      setUploadSuccessMessage(
        `${successCount} foto berhasil diunggah ke galeri pernikahan Farid & Bella.`
      );
      setGalleryRefreshSignal((n) => n + 1);
    } catch (err) {
      if (successCount > 0) {
        setGalleryRefreshSignal((n) => n + 1);
      }
      setUploadError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat mengunggah ke Neo S3.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [rollState]);

  const handleResetRoll = useCallback(() => {
    setUploadError(null);
    setUploadSuccessMessage(null);
    setRollState({
      rollId: generateRollId(),
      guestName: '',
      wish: '',
      shots: [],
    });
  }, []);

  const primaryPhoto = COUPLE_PHOTOS[0];
  const secondaryPhoto = COUPLE_PHOTOS[1];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5F0] text-[#1C1B18] pb-16 md:pb-0">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#F7F5F0]/90 backdrop-blur-md border-b border-[#DED8CB]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="#hero"
            className="font-editorial text-xl sm:text-2xl font-semibold tracking-tight text-[#1C1B18] whitespace-nowrap shrink-0"
          >
            {WEDDING_CONFIG.coupleNames}
          </a>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5E584E]">
            <a
              href="#hero"
              className="hover:text-[#1C1B18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Beranda
            </a>
            <a
              href="#camera"
              className="hover:text-[#1C1B18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Kamera
            </a>
            <a
              href="#roll"
              className="hover:text-[#1C1B18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Roll Saya
            </a>
            <a
              href="#gallery"
              className="hover:text-[#1C1B18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Galeri
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => scrollToSection('camera')}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1C1B18] hover:bg-[#2F2D28] text-[#F7F5F0] text-xs font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Buka Kamera</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Editorial Wedding Hero */}
        <section id="hero" className="pt-10 pb-14 md:pt-16 md:pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left Column: Editorial Typographic Story */}
              <div className="lg:col-span-5 flex flex-col justify-between py-2">
                <div>
                  <p className="text-xs font-film-mono uppercase tracking-[0.2em] text-[#9A7B4F]">
                    {WEDDING_CONFIG.weddingDateLabel} · {WEDDING_CONFIG.weddingLocation}
                  </p>
                  <h1
                    className="font-editorial font-medium tracking-tight text-[#1C1B18] mt-4 text-balance leading-[1.06]"
                    style={{ fontSize: 'clamp(2.4rem, 4.2vw, 3.75rem)' }}
                  >
                    Abadikan Momen Bahagia Farid &amp; Bella
                  </h1>
                  <p className="text-sm sm:text-base text-[#5E584E] mt-5 leading-relaxed max-w-prose">
                    Setiap tamu dibekali satu roll kamera sekali pakai dengan{' '}
                    <span className="font-film-mono font-medium text-[#1C1B18]">10</span> eksposur.
                    Potret senyum hangat, tawa keluarga, dan momen spontan selama perayaan—lalu
                    unggah hasilnya langsung ke album kenangan bersama.
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-[#DED8CB] flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => scrollToSection('camera')}
                    className="min-h-[48px] px-6 py-3 rounded-lg bg-[#1C1B18] hover:bg-[#2F2D28] text-[#F7F5F0] text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil Foto Sekarang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToSection('gallery')}
                    className="min-h-[48px] px-4 py-3 text-sm font-medium text-[#4A463E] hover:text-[#1C1B18] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Lihat Galeri Tamu</span>
                    <ArrowDownRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Dual Couple Wedding Portrait Diptych */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-5 items-stretch">
                {primaryPhoto && (
                  <figure className="sm:col-span-7 flex flex-col">
                    <div className="flex-1 min-h-[280px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-[#DED8CB] bg-[#EFECE4]">
                      <ResilientImage
                        src={primaryPhoto.url}
                        alt={primaryPhoto.alt}
                        fallbackTitle={WEDDING_CONFIG.coupleNames}
                        fallbackSubtitle={primaryPhoto.caption}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <figcaption className="mt-2.5 flex items-center justify-between text-xs text-[#6E685C]">
                      <span className="font-editorial italic text-sm text-[#1C1B18]">
                        {primaryPhoto.caption}
                      </span>
                      <span className="font-film-mono tabular-nums">01</span>
                    </figcaption>
                  </figure>
                )}

                {secondaryPhoto && (
                  <figure className="sm:col-span-5 flex flex-col sm:pt-10">
                    <div className="flex-1 min-h-[240px] sm:min-h-[320px] rounded-2xl overflow-hidden border border-[#DED8CB] bg-[#EFECE4]">
                      <ResilientImage
                        src={secondaryPhoto.url}
                        alt={secondaryPhoto.alt}
                        fallbackTitle={WEDDING_CONFIG.coupleNames}
                        fallbackSubtitle={secondaryPhoto.caption}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <figcaption className="mt-2.5 flex items-center justify-between text-xs text-[#6E685C]">
                      <span className="font-editorial italic text-sm text-[#1C1B18]">
                        {secondaryPhoto.caption}
                      </span>
                      <span className="font-film-mono tabular-nums">02</span>
                    </figcaption>
                  </figure>
                )}
              </div>
            </div>

            {/* Full-Width 4-Column Summary Strip Below Hero Split */}
            <div className="mt-12 md:mt-16 pt-8 border-t border-[#DED8CB] grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              <div>
                <p className="font-film-mono text-xl sm:text-2xl font-medium text-[#1C1B18] tabular-nums">
                  {WEDDING_CONFIG.maxShotsPerGuest} Eksposur
                </p>
                <p className="text-xs sm:text-sm text-[#6E685C] mt-1">
                  Batas jepretan per tamu undangan
                </p>
              </div>
              <div>
                <p className="font-film-mono text-xl sm:text-2xl font-medium text-[#1C1B18]">
                  4 Efek Film
                </p>
                <p className="text-xs sm:text-sm text-[#6E685C] mt-1">
                  Portra · Golden · Klasik B&amp;W · Natural
                </p>
              </div>
              <div>
                <p className="font-film-mono text-xl sm:text-2xl font-medium text-[#1C1B18]">
                  Kamera Pribadi
                </p>
                <p className="text-xs sm:text-sm text-[#6E685C] mt-1">
                  Langsung dari kamera HP atau browser Anda
                </p>
              </div>
              <div>
                <p className="font-film-mono text-xl sm:text-2xl font-medium text-[#1C1B18]">
                  Arsip Neo S3
                </p>
                <p className="text-xs sm:text-sm text-[#6E685C] mt-1">
                  Tersimpan otomatis di galeri pernikahan
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive 35mm Disposable Camera */}
        <DisposableCamera
          shots={rollState.shots}
          maxShots={WEDDING_CONFIG.maxShotsPerGuest}
          onCaptureShot={handleCaptureShot}
          onJumpToRoll={() => scrollToSection('roll')}
        />

        {/* Guest 10-Frame Contact Sheet & S3 Upload */}
        <FilmRollSection
          shots={rollState.shots}
          maxShots={WEDDING_CONFIG.maxShotsPerGuest}
          guestName={rollState.guestName}
          wish={rollState.wish}
          onChangeGuestName={(guestName) => setRollState((prev) => ({ ...prev, guestName }))}
          onChangeWish={(wish) => setRollState((prev) => ({ ...prev, wish }))}
          onRemoveShot={handleRemoveShot}
          onUploadPending={handleUploadPending}
          onResetRoll={handleResetRoll}
          onGoToCamera={() => scrollToSection('camera')}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          uploadSuccessMessage={uploadSuccessMessage}
        />

        {/* Live Wedding Gallery from Neo S3 */}
        <WeddingGallery
          refreshSignal={galleryRefreshSignal}
          onJumpToCamera={() => scrollToSection('camera')}
        />
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#DED8CB] bg-[#EFECE4]/60 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E685C]">
          <p className="font-editorial text-base text-[#1C1B18]">
            {WEDDING_CONFIG.coupleNames} · {WEDDING_CONFIG.weddingDateLabel}
          </p>
          <p>Kamera Sekali Pakai Digital · Kenangan Tersimpan di Neo S3</p>
        </div>
      </footer>

      {/* Mobile Bottom Thumb-Zone Navigation (<= 15% aggregate sticky height) */}
      <nav
        aria-label="Navigasi Cepat"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#F7F5F0]/95 backdrop-blur-md border-t border-[#DED8CB] grid grid-cols-4"
      >
        <button
          type="button"
          onClick={() => scrollToSection('hero')}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#4A463E] active:text-[#1C1B18]"
        >
          <Home className="w-4 h-4" />
          <span>Beranda</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('camera')}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#1C1B18]"
        >
          <Camera className="w-4 h-4 text-[#9A7B4F]" />
          <span>Kamera</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('roll')}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#4A463E] active:text-[#1C1B18]"
        >
          <Film className="w-4 h-4" />
          <span className="font-film-mono tabular-nums">
            Roll ({rollState.shots.length}/{WEDDING_CONFIG.maxShotsPerGuest})
          </span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('gallery')}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[#4A463E] active:text-[#1C1B18]"
        >
          <Images className="w-4 h-4" />
          <span>Galeri</span>
        </button>
      </nav>
    </div>
  );
}
