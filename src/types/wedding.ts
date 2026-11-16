export type FilmFilter = 'natural' | 'portra' | 'golden' | 'bw';

export interface FilmFilterOption {
  id: FilmFilter;
  label: string;
  cssFilter: string;
}

export const FILM_FILTERS: FilmFilterOption[] = [
  {
    id: 'portra',
    label: 'Portra Warm',
    cssFilter: 'contrast(1.04) saturate(1.12) sepia(0.14) brightness(1.02)',
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    cssFilter: 'contrast(1.06) saturate(1.18) sepia(0.22) hue-rotate(-6deg)',
  },
  {
    id: 'bw',
    label: 'Klasik B&W',
    cssFilter: 'grayscale(1) contrast(1.18) brightness(1.02)',
  },
  {
    id: 'natural',
    label: 'Natural',
    cssFilter: 'contrast(1.02) saturate(1.03)',
  },
];

export interface LocalShot {
  id: string;
  frameNumber: number;
  dataUrl: string;
  filter: FilmFilter;
  dateStamp: boolean;
  capturedAt: string;
  status: 'pending' | 'uploaded';
  s3Key?: string;
}

export interface S3WeddingPhoto {
  key: string;
  url: string;
  size: number;
  lastModified: string;
  guestName: string;
  wish: string;
  frameNumber: number;
  filter: string;
  capturedAt: string;
  rollId: string;
}
