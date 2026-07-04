import { ImageResponse } from 'next/og';

// MOM-015: 512x512 PWA manifest icon (installability, maskable-safe padding).
// Placeholder brand mark; swap for designed artwork later.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#4f46e5',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 300,
            height: 300,
            color: 'white',
            fontSize: 220,
            fontWeight: 700,
          }}
        >
          M
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
