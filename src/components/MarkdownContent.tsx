import React from 'react';

function formatLatexToReadable(expr: string): string {
  let out = expr.trim();
  out = out.replace(/\\text\{([^}]*)\}/g, '$1');
  out = out.replace(/\\mathrm\{([^}]*)\}/g, '$1');
  out = out.replace(/\\mathbf\{([^}]*)\}/g, '$1');
  out = out.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)');
  out = out.replace(/\\sqrt\{([^}]*)\}/g, '√($1)');
  out = out.replace(/\^\\circ|\\circ/g, '°');
  out = out.replace(/\\implies/g, '⇒');
  out = out.replace(/\\iff/g, '⇔');
  out = out.replace(/\\rightarrow|\\to/g, '→');
  out = out.replace(/\\leftarrow/g, '←');
  out = out.replace(/\\times/g, '×');
  out = out.replace(/\\cdot/g, '·');
  out = out.replace(/\\div/g, '÷');
  out = out.replace(/\\pm/g, '±');
  out = out.replace(/\\leq|\\le/g, '≤');
  out = out.replace(/\\geq|\\ge/g, '≥');
  out = out.replace(/\\neq|\\ne/g, '≠');
  out = out.replace(/\\approx/g, '≈');
  out = out.replace(/\\infty/g, '∞');
  out = out.replace(/\\pi/g, 'π');
  out = out.replace(/\\theta/g, 'θ');
  out = out.replace(/\\alpha/g, 'α');
  out = out.replace(/\\beta/g, 'β');
  out = out.replace(/\\gamma/g, 'γ');
  out = out.replace(/\\Delta/g, 'Δ');
  out = out.replace(/\\lambda/g, 'λ');
  out = out.replace(/\\sigma/g, 'σ');
  out = out.replace(/\\sum/g, '∑');
  out = out.replace(/\\int/g, '∫');
  out = out.replace(/\\left|\\right/g, '');
  out = out.replace(/\^2\b/g, '²');
  out = out.replace(/\^3\b/g, '³');
  out = out.replace(/\^\{([^}]*)\}/g, '^($1)');
  out = out.replace(/_\{([^}]*)\}/g, '_$1');
  out = out.replace(/\\([a-zA-Z]+)/g, '$1');
  return out.replace(/\s+/g, ' ').trim();
}

export function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\$\$[^$]+\$\$|\$[^$\n]+\$|\*[^*\n]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      if (inner.startsWith('`') && inner.endsWith('`') && inner.length > 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-[#F3EFFC] text-[#4C1D95] font-mono font-semibold text-[12px]"
          >
            {inner.slice(1, -1)}
          </code>
        );
      }
      return (
        <strong key={idx} className="font-semibold text-[#1A1635]">
          {renderInlineMarkdown(inner)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[#F3EFFC] text-[#4C1D95] font-mono text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
      return (
        <span
          key={idx}
          className="inline-block px-2 py-0.5 rounded-md bg-[#F7F4FD] border border-[#E5DDFB] font-mono text-[13px] font-semibold text-[#3B1D8E]"
        >
          {formatLatexToReadable(part.slice(2, -2))}
        </span>
      );
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2 && !part.startsWith('$$')) {
      const inner = part.slice(1, -1);
      // Skip currency-like patterns such as "$50 and $100" if somehow matched
      if (/^\d[\d,.]*$/.test(inner.trim())) {
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      }
      return (
        <span
          key={idx}
          className="px-1 py-0.5 rounded bg-[#F7F4FD] font-mono text-[13px] font-medium text-[#3B1D8E]"
        >
          {formatLatexToReadable(inner)}
        </span>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      return (
        <em key={idx} className="italic text-[#2E2554]">
          {renderInlineMarkdown(part.slice(1, -1))}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(trimmed);
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((cell) => cell.trim());
}

export function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^([-*_]){3,}$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${keyCounter++}`} className="border-[#EBE6FA] my-2" />);
      i += 1;
      continue;
    }

    // Standalone display math block: $$ ... $$
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      blocks.push(
        <div
          key={`math-${keyCounter++}`}
          className="px-4 py-2.5 rounded-xl bg-[#F7F4FD] border border-[#E5DDFB] font-mono text-sm font-semibold text-[#3B1D8E] text-center overflow-x-auto"
        >
          {formatLatexToReadable(trimmed.slice(2, -2))}
        </div>
      );
      i += 1;
      continue;
    }

    // Fenced code blocks
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i += 1;
      }
      blocks.push(
        <div key={`code-${keyCounter++}`} className="rounded-xl overflow-hidden border border-[#2E2554] bg-[#16122B]">
          {lang && (
            <div className="px-3 py-1 bg-[#221C42] text-[11px] font-mono uppercase tracking-wider text-[#C4B5FD]">
              {lang}
            </div>
          )}
          <pre className="p-3.5 overflow-x-auto text-xs font-mono text-[#F5F3FF] leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Markdown table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`tbl-${keyCounter++}`} className="overflow-x-auto rounded-xl border border-[#E5E0F5]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F6F3FD] text-[#1A1635]">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-3 py-2 font-semibold border-b border-[#E5E0F5]">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDF8] bg-white">
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-[#1A1635] align-top">
                      {renderInlineMarkdown(row[cIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`bq-${keyCounter++}`}
          className="border-l-4 border-[#7B3FE4] bg-[#FAF8FF] px-3.5 py-2.5 rounded-r-xl text-sm text-[#2E2554] leading-relaxed"
        >
          {renderInlineMarkdown(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingClass =
        level <= 2
          ? 'font-display text-base font-bold text-[#1A1635] pt-1'
          : 'font-display text-sm font-bold text-[#4C1D95] pt-1';
      blocks.push(
        <h4 key={`h-${keyCounter++}`} className={headingClass}>
          {renderInlineMarkdown(headingText)}
        </h4>
      );
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${keyCounter++}`} className="list-disc pl-5 space-y-1.5 text-sm text-[#1A1635]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${keyCounter++}`} className="list-decimal pl-5 space-y-1.5 text-sm text-[#1A1635]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (group contiguous non-empty lines that aren't special blocks)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (
        !nextTrimmed ||
        /^([-*_]){3,}$/.test(nextTrimmed) ||
        (nextTrimmed.startsWith('$$') && nextTrimmed.endsWith('$$')) ||
        nextTrimmed.startsWith('```') ||
        nextTrimmed.startsWith('>') ||
        /^(#{1,4})\s+/.test(nextTrimmed) ||
        /^[-*•]\s+/.test(nextTrimmed) ||
        /^\d+[.)]\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paraLines.push(nextTrimmed);
      i += 1;
    }
    blocks.push(
      <p key={`p-${keyCounter++}`} className="text-sm text-[#1A1635] leading-relaxed">
        {renderInlineMarkdown(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}
