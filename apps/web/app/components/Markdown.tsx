import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/cn';

// MOM-034: renders question prompts, reference answers, and (later) system-design
// answers (plan §7.4 fixed-section markdown) with sane typographic defaults. No
// raw HTML support (default react-markdown behavior) — plain markdown only.
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-zinc max-w-none prose-headings:font-semibold prose-pre:bg-zinc-900 prose-pre:text-zinc-100',
        'dark:prose-invert',
        className,
      )}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
