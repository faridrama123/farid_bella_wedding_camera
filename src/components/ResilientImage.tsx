import { useState } from 'react';
import { Camera } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  loading?: 'eager' | 'lazy';
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackTitle = 'Farid & Bella',
  fallbackSubtitle = '28 November 2026',
  loading = 'eager',
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFECE4] text-[#4A463E] p-6 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-12 h-12 rounded-full border border-[#C9A96E]/50 flex items-center justify-center mb-3 text-[#9A7B4F]">
          <Camera className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <p className="font-editorial text-2xl font-medium tracking-tight text-[#1C1B18]">
          {fallbackTitle}
        </p>
        <p className="text-xs text-[#6E685C] mt-1">{fallbackSubtitle}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#EAE5DA]">
      {!loaded && (
        <div className="absolute inset-0 bg-[#EAE5DA] animate-pulse" aria-hidden="true" />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
