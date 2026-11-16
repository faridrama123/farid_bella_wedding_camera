export interface CouplePhoto {
  id: string;
  url: string;
  alt: string;
  caption: string;
}

/**
 * Konfigurasi Pernikahan Farid & Bella.
 * Anda dapat mengganti URL gambar mempelai di array COUPLE_PHOTOS kapan saja.
 */
export const WEDDING_CONFIG = {
  coupleNames: 'Farid & Bella',
  brideName: 'Bella',
  groomName: 'Farid',
  weddingDateLabel: 'Sabtu, 28 November 2026',
  weddingLocation: 'Jakarta',
  maxShotsPerGuest: 10,
  dateStampCode: "'26 11 28",
};

export const COUPLE_PHOTOS: CouplePhoto[] = [
  {
    id: 'couple-primary',
    url: 'https://cdn.antaranews.com/cache/1200x800/2026/04/28/IMG_9035.v1.jpg',
    alt: 'Potret pernikahan Farid dan Bella',
    caption: 'Babak Baru Bersama',
  },
  {
    id: 'couple-secondary',
    url: 'https://zetizens.id/wp-content/uploads/2026/04/El-Rumi-dan-Syifa-Hadju.jpg',
    alt: 'Momen kebersamaan Farid dan Bella',
    caption: 'Janji Suci · 2026',
  },
];
