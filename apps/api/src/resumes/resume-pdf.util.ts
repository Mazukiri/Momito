// MOM-139: a tiny, dependency-free PDF writer for ATS-safe résumé export.
//
// Why hand-rolled instead of pdfkit/puppeteer: an ATS parser reads a PDF's text
// via its content stream + a standard font's glyph widths. The safest output is
// therefore plain text, one column, in a standard (non-embedded) font. That is
// exactly what this produces — Helvetica (one of the 14 built-in PDF fonts, no
// font file to embed), single column, left-aligned. No binary dependency, no
// browser, deterministic, and fully unit-testable. Anything fancier is actively
// worse for ATS parsing, so there is nothing to gain from a heavy library here.

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 72; // 1 inch
const MAX_W = PAGE_W - 2 * MARGIN; // 468pt usable width

interface StyledLine {
  text: string;
  size: number;
  blank: boolean;
  gapBefore: number; // extra points of space before this line (headings)
}

// ATS parsers prefer plain ASCII. Strip diacritics (é→e), fold common typographic
// symbols to ASCII, then drop anything else outside the printable range.
function transliterate(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining marks left by NFKD
    .replace(/[•·]/g, '-') // • ·
    .replace(/[—–]/g, '-') // — –
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7e]/g, '');
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    // A single word longer than the line gets hard-split.
    if (word.length > maxChars) {
      if (current) { out.push(current); current = ''; }
      for (let i = 0; i < word.length; i += maxChars) out.push(word.slice(i, i + maxChars));
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) { out.push(current); current = word; } else { current = candidate; }
  }
  if (current) out.push(current);
  return out.length > 0 ? out : [''];
}

// Markdown → styled, wrapped lines. Headings become larger sizes; list items keep
// a "- " marker; links render as "text (url)". Purely structural — no styling that
// an ATS would choke on.
function markdownToLines(contentMd: string): StyledLine[] {
  const out: StyledLine[] = [];
  for (const raw of contentMd.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (line === '') {
      out.push({ text: '', size: 0, blank: true, gapBefore: 0 });
      continue;
    }
    let size = 10;
    let gapBefore = 0;
    let text = line;
    if (/^#\s+/.test(line)) { size = 18; gapBefore = 2; text = line.replace(/^#\s+/, ''); }
    else if (/^##\s+/.test(line)) { size = 13; gapBefore = 8; text = line.replace(/^##\s+/, ''); }
    else if (/^###\s+/.test(line)) { size = 11; gapBefore = 4; text = line.replace(/^###\s+/, ''); }
    else if (/^[-*]\s+/.test(line)) { text = `- ${line.replace(/^[-*]\s+/, '')}`; }

    text = text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // links → text (url)
      .replace(/\*\*/g, '')
      .replace(/`/g, '');
    text = transliterate(text);

    // Helvetica averages ~0.5em per character; wrap conservatively to MAX_W.
    const maxChars = Math.max(20, Math.floor(MAX_W / (size * 0.5)));
    let first = true;
    for (const wrapped of wrap(text, maxChars)) {
      out.push({ text: wrapped, size, blank: false, gapBefore: first ? gapBefore : 0 });
      first = false;
    }
  }
  return out;
}

// Lay styled lines onto one or more page content streams, paginating when the
// cursor would cross the bottom margin.
function paginate(lines: StyledLine[]): string[] {
  const pages: string[] = [];
  let stream = '';
  let y = PAGE_H - MARGIN;
  const push = () => { if (stream) pages.push(stream); };

  for (const line of lines) {
    if (line.blank) { y -= 7; continue; }
    const leading = line.size * 1.35;
    y -= line.gapBefore;
    if (y - leading < MARGIN) {
      push();
      stream = '';
      y = PAGE_H - MARGIN;
    }
    stream += `BT /F1 ${line.size} Tf 1 0 0 1 ${MARGIN} ${round(y)} Tm (${escapePdf(line.text)}) Tj ET\n`;
    y -= leading;
  }
  push();
  return pages.length > 0 ? pages : [''];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resumeMarkdownToPdf(contentMd: string): Buffer {
  const pages = paginate(markdownToLines(contentMd));
  const pageCount = pages.length;
  const contentStartId = 4; // 1 Catalog, 2 Pages, 3 Font, then content streams
  const pageStartId = contentStartId + pageCount;

  const objects: Array<{ id: number; body: string }> = [];
  const kids = Array.from({ length: pageCount }, (_, i) => `${pageStartId + i} 0 R`).join(' ');
  objects.push({ id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' });
  objects.push({ id: 2, body: `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>` });
  objects.push({ id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' });
  pages.forEach((stream, i) => {
    objects.push({ id: contentStartId + i, body: `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream` });
  });
  pages.forEach((_, i) => {
    objects.push({
      id: pageStartId + i,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentStartId + i} 0 R >>`,
    });
  });
  objects.sort((a, b) => a.id - b.id);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets[obj.id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, 'latin1');
  const size = objects.length + 1; // + the free object 0
  pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
