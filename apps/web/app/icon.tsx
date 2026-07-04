import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// MOM-015: placeholder brand mark (indigo square + "M") generated at request time via
// next/og so no binary asset needs to be committed yet. Swap for designed artwork later.
export default function Icon() {
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
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
