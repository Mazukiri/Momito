import type { MetadataRoute } from 'next';

// MOM-015: installable PWA manifest (service worker lives in public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Momito - Interview Prep',
    short_name: 'Momito',
    description: 'Practice interview questions and track your progress',
    start_url: '/today',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      { src: '/pwa-icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
