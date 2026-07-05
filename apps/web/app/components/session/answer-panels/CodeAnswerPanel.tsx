'use client';

import dynamic from 'next/dynamic';

// MOM-035: CodeMirror depends on browser-only APIs and its language packs are
// sizable, so it's excluded from SSR and only loaded when a code question is shown.
const CodeEditor = dynamic(() => import('../../CodeEditor'), { ssr: false });

export function CodeAnswerPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return <CodeEditor value={value} onChange={onChange} placeholder="Write your code here..." />;
}
