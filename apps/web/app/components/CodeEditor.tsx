'use client';

// MOM-035: syntax-highlighted code editor for DSA/coding answers. Loaded via
// next/dynamic with ssr: false from AnswerForm since CodeMirror touches
// browser-only APIs and its language packs are sizable — no reason to ship
// them in the server-rendered HTML or the initial JS payload for every
// question type.
import { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { useTheme } from '../lib/theme-context';

const LANGUAGES = {
  javascript: { label: 'JavaScript', extension: javascript({ jsx: true }) },
  python: { label: 'Python', extension: python() },
  cpp: { label: 'C++', extension: cpp() },
  java: { label: 'Java', extension: java() },
} as const;

type LanguageKey = keyof typeof LANGUAGES;

export default function CodeEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [language, setLanguage] = useState<LanguageKey>('javascript');
  const extensions = useMemo(() => [LANGUAGES[language].extension], [language]);
  const { theme } = useTheme();

  return (
    <div className="rounded-lg border border-zinc-300 dark:border-zinc-700">
      <div className="flex items-center justify-between border-b border-zinc-200 px-2 py-1 dark:border-zinc-800">
        <span className="text-xs font-medium text-zinc-400">Language</span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageKey)}
          className="rounded border border-zinc-300 bg-transparent px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
        >
          {Object.entries(LANGUAGES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        placeholder={placeholder}
        theme={theme}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        minHeight="12rem"
        className="text-sm"
      />
    </div>
  );
}
