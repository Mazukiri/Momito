import { ImageResponse } from 'next/og';

// MOM-015: 192x192 PWA manifest icon (installability). Placeholder brand mark;
// swap for designed artwork later.
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
          color: 'white',
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    { width: 192, height: 192 },
  );
}
