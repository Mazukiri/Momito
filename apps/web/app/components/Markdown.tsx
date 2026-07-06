import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '../lib/cn';

// MOM-034: renders question prompts, reference answers, and (later) system-design
// answers (plan §7.4 fixed-section markdown) with sane typographic defaults. No
// raw HTML support (default react-markdown behavior) — plain markdown only.
// remark-gfm adds tables/task-lists/strikethrough/autolinks; rehype-highlight
// adds hljs-* classes to fenced code blocks, styled by the single dark hljs
// theme imported in globals.css (code blocks are always dark-styled regardless
// of site theme, matching the existing prose-pre:bg-zinc-900 convention below).
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-zinc max-w-none prose-headings:font-semibold prose-pre:bg-zinc-900 prose-pre:text-zinc-100',
        'dark:prose-invert',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
