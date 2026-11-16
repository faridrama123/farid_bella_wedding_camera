import { FILM_FILTERS, FilmFilter } from '../types/wedding';

export function getCssFilter(filterId: FilmFilter): string {
  return FILM_FILTERS.find((f) => f.id === filterId)?.cssFilter || 'none';
}

export function playShutterSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Sharp mechanical shutter click
    const bufferSize = Math.floor(ctx.sampleRate * 0.045);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * 0.18));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(1.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Second subtle film advance click
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    oscGain.gain.setValueAtTime(0.08, now + 0.07);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now + 0.07);
    osc.stop(now + 0.13);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 300);
  } catch {
    // Ignore audio errors on restricted browsers
  }
}

export interface ProcessFrameOptions {
  filter: FilmFilter;
  mirror?: boolean;
  dateStamp: boolean;
  dateStampText: string;
}

export function processImageToFilmDataUrl(
  source: HTMLVideoElement | HTMLImageElement,
  options: ProcessFrameOptions
): string {
  const srcWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const srcHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;

  if (!srcWidth || !srcHeight) {
    throw new Error('Dimensi gambar kamera belum siap.');
  }

  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(srcWidth, srcHeight));
  const width = Math.round(srcWidth * scale);
  const height = Math.round(srcHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas tidak tersedia.');
  }

  ctx.save();
  ctx.filter = getCssFilter(options.filter);
  if (options.mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();

  // Subtle warm analog vignette
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.34,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(18,14,10,0.28)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle warm lift for film presets
  if (options.filter === 'portra' || options.filter === 'golden') {
    ctx.fillStyle = options.filter === 'golden' ? 'rgba(215, 160, 80, 0.06)' : 'rgba(235, 195, 145, 0.04)';
    ctx.fillRect(0, 0, width, height);
  }

  // Authentic quartz date stamp in bottom-right corner
  if (options.dateStamp) {
    const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.032));
    ctx.save();
    ctx.font = `600 ${fontSize}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(255, 110, 20, 0.85)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#FF9333';
    ctx.fillText(options.dateStampText, width - Math.round(width * 0.04), height - Math.round(height * 0.04));
    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.88);
}

export function loadImageFileToFilmDataUrl(
  file: File,
  options: Omit<ProcessFrameOptions, 'mirror'>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const result = processImageToFilmDataUrl(img, { ...options, mirror: false });
        URL.revokeObjectURL(objectUrl);
        resolve(result);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal membaca file foto.'));
    };
    img.src = objectUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
