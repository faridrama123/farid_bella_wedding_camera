import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Zap,
  ZapOff,
} from 'lucide-react';
import { WEDDING_CONFIG } from '../config/weddingConfig';
import { FILM_FILTERS, FilmFilter, LocalShot } from '../types/wedding';
import {
  getCssFilter,
  loadImageFileToFilmDataUrl,
  playShutterSound,
  processImageToFilmDataUrl,
} from '../utils/filmProcessor';

interface DisposableCameraProps {
  shots: LocalShot[];
  maxShots: number;
  onCaptureShot: (shot: Omit<LocalShot, 'id' | 'frameNumber' | 'status'>) => void;
  onJumpToRoll: () => void;
}

export function DisposableCamera({
  shots,
  maxShots,
  onCaptureShot,
  onJumpToRoll,
}: DisposableCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [selectedFilter, setSelectedFilter] = useState<FilmFilter>('portra');
  const [flashEnabled, setFlashEnabled] = useState<boolean>(false);
  const [dateStampEnabled, setDateStampEnabled] = useState<boolean>(true);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [lastCapturedThumb, setLastCapturedThumb] = useState<string | null>(null);

  const shotsCount = shots.length;
  const remainingShots = Math.max(0, maxShots - shotsCount);
  const isRollFull = remainingShots === 0;
  const nextFrameNumber = Math.min(maxShots, shotsCount + 1);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('error');
        setErrorMessage(
          'Browser Anda tidak mendukung akses kamera langsung. Gunakan tombol Kamera HP / Pilih Foto di bawah.'
        );
        return;
      }

      setCameraState('starting');
      setErrorMessage('');
      stopCamera();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraState('active');
      } catch (err) {
        setCameraState('error');
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Izin kamera belum diberikan. Izinkan akses kamera di browser atau gunakan tombol Ambil via Kamera HP.'
            : 'Kamera perangkat tidak terdeteksi. Anda tetap dapat mengambil foto menggunakan tombol Ambil via Kamera HP.';
        setErrorMessage(msg);
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (isRollFull && cameraState === 'active') {
      stopCamera();
      setCameraState('idle');
    }
  }, [isRollFull, cameraState, stopCamera]);

  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraState === 'active') {
      startCamera(nextMode);
    }
  };

  const triggerShutterEffects = (dataUrl: string) => {
    playShutterSound();
    setLastCapturedThumb(dataUrl);
    if (flashEnabled) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 220);
    }
    setIsAdvancing(true);
    setTimeout(() => setIsAdvancing(false), 320);
  };

  const handleCapture = async () => {
    if (isRollFull || isAdvancing) return;
    const video = videoRef.current;
    if (!video || cameraState !== 'active' || video.readyState < 2) return;

    // Attempt hardware torch flash if enabled and supported
    if (flashEnabled && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      if (capabilities?.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: true } as MediaTrackConstraintSet],
          });
          setTimeout(() => {
            track
              .applyConstraints({
                advanced: [{ torch: false } as MediaTrackConstraintSet],
              })
              .catch(() => {});
          }, 260);
        } catch {
          // Hardware torch optional; screen flash still triggers
        }
      }
    }

    try {
      const dataUrl = processImageToFilmDataUrl(video, {
        filter: selectedFilter,
        mirror: facingMode === 'user',
        dateStamp: dateStampEnabled,
        dateStampText: WEDDING_CONFIG.dateStampCode,
      });

      triggerShutterEffects(dataUrl);
      onCaptureShot({
        dataUrl,
        filter: selectedFilter,
        dateStamp: dateStampEnabled,
        capturedAt: new Date().toISOString(),
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal mengambil foto.');
    }
  };

  const handleFileCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0 || isRollFull) return;

    const available = remainingShots;
    const filesToProcess = files.slice(0, available);

    for (const file of filesToProcess) {
      try {
        const dataUrl = await loadImageFileToFilmDataUrl(file, {
          filter: selectedFilter,
          dateStamp: dateStampEnabled,
          dateStampText: WEDDING_CONFIG.dateStampCode,
        });
        triggerShutterEffects(dataUrl);
        onCaptureShot({
          dataUrl,
          filter: selectedFilter,
          dateStamp: dateStampEnabled,
          capturedAt: new Date().toISOString(),
        });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memproses foto.');
      }
    }
  };

  return (
    <section id="camera" className="py-16 md:py-24 bg-[#11100E] text-[#F7F5F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Column: Analog Camera Instructions & Film Controls */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <p className="text-xs font-film-mono uppercase tracking-[0.2em] text-[#C9A96E]">
                Kamera Sekali Pakai · Roll 35mm
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-[#F7F5F0] mt-3 text-balance">
                Tangkap 10 Momen Terbaik Dari Sudut Pandang Anda
              </h2>
              <p className="text-sm sm:text-base text-[#B8B1A3] mt-4 leading-relaxed">
                Setiap tamu mendapatkan satu roll film berisi{' '}
                <span className="text-[#F7F5F0] font-medium font-film-mono">10</span> eksposur.
                Pilih karakter film, bidik momen autentik selama acara, lalu unggah seluruh roll
                ke galeri pernikahan Farid &amp; Bella.
              </p>
            </div>

            {/* Exposure Counter Readout */}
            <div className="border-t border-b border-white/10 py-5 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[#9E9789]">Frame Berikutnya</p>
                <p className="font-film-mono text-2xl font-medium text-[#F7F5F0] mt-1 tabular-nums">
                  {isRollFull ? '10' : String(nextFrameNumber).padStart(2, '0')} / {maxShots}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#9E9789]">Sisa Eksposur</p>
                <p className="font-film-mono text-2xl font-medium text-[#C9A96E] mt-1 tabular-nums">
                  {remainingShots}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#9E9789]">Terkirim ke S3</p>
                <p className="font-film-mono text-2xl font-medium text-[#F7F5F0] mt-1 tabular-nums">
                  {shots.filter((s) => s.status === 'uploaded').length}
                </p>
              </div>
            </div>

            {/* Film Preset Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#D6CFC2]">Karakter Film</span>
                <span className="text-xs font-film-mono text-[#9E9789]">ISO 400</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FILM_FILTERS.map((preset) => {
                  const active = selectedFilter === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedFilter(preset.id)}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors border whitespace-nowrap shrink-0 flex items-center justify-between ${
                        active
                          ? 'bg-[#C9A96E] text-[#11100E] border-[#C9A96E]'
                          : 'bg-[#1A1815] text-[#D6CFC2] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Camera Options */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setFlashEnabled((prev) => !prev)}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  flashEnabled
                    ? 'bg-[#F7F5F0] text-[#11100E] border-[#F7F5F0]'
                    : 'bg-[#1A1815] text-[#D6CFC2] border-white/10 hover:border-white/25'
                }`}
              >
                {flashEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                <span>Flash: {flashEnabled ? 'Aktif' : 'Mati'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDateStampEnabled((prev) => !prev)}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  dateStampEnabled
                    ? 'bg-[#1A1815] text-[#C9A96E] border-[#C9A96E]/60'
                    : 'bg-[#1A1815] text-[#9E9789] border-white/10 hover:border-white/25'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Cap Tanggal: {dateStampEnabled ? 'Ya' : 'Tidak'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Tactile Disposable Camera Body */}
          <div className="lg:col-span-7">
            <div className="bg-[#1B1916] border border-white/12 rounded-2xl p-4 sm:p-6 shadow-2xl">
              {/* Top Camera Deck */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3 text-xs font-film-mono text-[#D6CFC2]">
                  <span>FARID &amp; BELLA 400</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#C9A96E]">
                    {isRollFull ? 'ROLL PENUH' : `FRAME ${String(nextFrameNumber).padStart(2, '0')}`}
                  </span>
                </div>

                {cameraState === 'active' && !isRollFull && (
                  <button
                    type="button"
                    onClick={handleToggleFacingMode}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#272420] hover:bg-[#332F29] text-xs font-medium text-[#F7F5F0] inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
                  </button>
                )}
              </div>

              {/* Optical Viewfinder Screen */}
              <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#090807] border border-white/10">
                {/* Live Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ filter: getCssFilter(selectedFilter) }}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    cameraState === 'active' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />

                {/* Viewfinder Reticle Overlays when Active */}
                {cameraState === 'active' && (
                  <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-6 h-6 border-t-2 border-l-2 border-white/60" />
                      <div className="w-6 h-6 border-t-2 border-r-2 border-white/60" />
                    </div>

                    {/* Center focus brackets */}
                    <div className="mx-auto w-14 h-10 border border-white/35 rounded-sm" />

                    <div className="flex items-end justify-between">
                      <div className="w-6 h-6 border-b-2 border-l-2 border-white/60" />
                      {dateStampEnabled && (
                        <span className="font-film-mono text-xs sm:text-sm font-semibold text-[#FF9333] drop-shadow-[0_0_6px_rgba(255,110,20,0.85)]">
                          {WEDDING_CONFIG.dateStampCode}
                        </span>
                      )}
                      <div className="w-6 h-6 border-b-2 border-r-2 border-white/60" />
                    </div>
                  </div>
                )}

                {/* Shutter / Flash Curtain Animation */}
                {(isFlashing || isAdvancing) && (
                  <div
                    className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
                      isFlashing ? 'bg-white opacity-95' : 'bg-black opacity-75'
                    }`}
                  />
                )}

                {/* Idle / Error / Full Roll States */}
                {isRollFull ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#12110F]">
                    <p className="font-film-mono text-xs uppercase tracking-widest text-[#C9A96E]">
                      10 / 10 Eksposur Tercapai
                    </p>
                    <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[#F7F5F0] mt-2">
                      Roll Film Anda Sudah Penuh
                    </h3>
                    <p className="text-sm text-[#B8B1A3] mt-2 max-w-md">
                      Periksa hasil jepretan Anda di bawah dan unggah ke album pernikahan Farid
                      &amp; Bella di Neo S3.
                    </p>
                    <button
                      type="button"
                      onClick={onJumpToRoll}
                      className="mt-6 min-h-[44px] px-6 py-2.5 rounded-lg bg-[#C9A96E] hover:bg-[#D4B67F] text-[#11100E] text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      Lihat Roll &amp; Upload Foto
                    </button>
                  </div>
                ) : cameraState !== 'active' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#12110F]/95">
                    <div className="w-12 h-12 rounded-full border border-[#C9A96E]/40 flex items-center justify-center text-[#C9A96E] mb-4">
                      <Camera className="w-5 h-5" />
                    </div>
                    <h3 className="font-editorial text-2xl font-medium text-[#F7F5F0]">
                      {cameraState === 'starting'
                        ? 'Menyiapkan Lensa Kamera...'
                        : 'Siap Mengabadikan Momen?'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#B8B1A3] mt-2 max-w-sm leading-relaxed">
                      {errorMessage ||
                        'Aktifkan kamera perangkat Anda untuk memotret langsung, atau pilih foto dari kamera bawaan HP.'}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        disabled={cameraState === 'starting'}
                        onClick={() => startCamera(facingMode)}
                        className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#C9A96E] hover:bg-[#D4B67F] disabled:opacity-60 text-[#11100E] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                      >
                        {cameraState === 'error' ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        <span>
                          {cameraState === 'starting'
                            ? 'Membuka Kamera...'
                            : cameraState === 'error'
                              ? 'Coba Kamera Lagi'
                              : 'Aktifkan Kamera'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#272420] hover:bg-[#332F29] text-[#F7F5F0] text-xs sm:text-sm font-medium border border-white/10 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                      >
                        <ImagePlus className="w-4 h-4" />
                        <span>Kamera HP / Galeri</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Hidden Native Camera / File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFileCapture}
                className="hidden"
                aria-label="Ambil foto dengan kamera bawaan atau pilih file"
              />

              {/* Bottom Tactile Shutter Deck */}
              <div className="mt-5 flex items-center justify-between gap-4">
                {/* Last Shot Thumbnail */}
                <button
                  type="button"
                  onClick={onJumpToRoll}
                  className="min-h-[44px] flex items-center gap-3 text-left group"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#0D0C0A] border border-white/15 shrink-0 flex items-center justify-center">
                    {lastCapturedThumb || shots[shots.length - 1]?.dataUrl ? (
                      <img
                        src={lastCapturedThumb || shots[shots.length - 1]?.dataUrl}
                        alt="Jepretan terakhir"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-film-mono text-[11px] text-[#7D766A]">00</span>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-medium text-[#F7F5F0] group-hover:text-[#C9A96E] transition-colors">
                      Roll Film Anda
                    </p>
                    <p className="font-film-mono text-xs text-[#9E9789] tabular-nums">
                      {shotsCount} / {maxShots} Terambil
                    </p>
                  </div>
                </button>

                {/* Primary Shutter Release Button */}
                <button
                  type="button"
                  disabled={cameraState !== 'active' || isRollFull || isAdvancing}
                  onClick={handleCapture}
                  aria-label="Ambil Foto"
                  className="relative w-[72px] h-[72px] rounded-full border-2 border-[#C9A96E] p-1.5 transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <span className="block w-full h-full rounded-full bg-[#F7F5F0] hover:bg-white transition-colors" />
                </button>

                {/* Native Upload / Stop Camera Trigger */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isRollFull}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#272420] hover:bg-[#332F29] disabled:opacity-40 text-xs font-medium text-[#D6CFC2] inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Pilih Foto</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
