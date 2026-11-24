import React from 'react';

interface MarkdownLessonViewProps {
  markdown: string;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

export function MarkdownLessonView({ markdown }: MarkdownLessonViewProps) {
  const lines = markdown.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Markdown headings (###, ##, #)
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      if (level <= 2) {
        blocks.push(
          <h3 key={`h-${i}`} className="font-display text-lg font-bold text-[#1A1635] pt-2">
            {text}
          </h3>
        );
      } else {
        blocks.push(
          <h4 key={`h-${i}`} className="font-display text-base font-bold text-[#2E1E6B] pt-2">
            {text}
          </h4>
        );
      }
      i += 1;
      continue;
    }

    // Markdown pipe tables or single-column code/diagram blocks encoded with ` / `
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }

      const parsedRows = tableLines.map(parseTableRow);
      const colCount = parsedRows[0]?.length ?? 0;

      // Single-column `| line1 / line2 |` + `| --- |` blocks represent code snippets or diagrams
      if (colCount === 1 && parsedRows.length >= 2 && isSeparatorRow(parsedRows[1])) {
        const rawCode = parsedRows
          .filter((_, idx) => idx !== 1)
          .map((cells) => cells[0])
          .join('\n')
          .replace(/\s+\/\s+/g, '\n')
          .replace(/\s+\/$/gm, '');
        blocks.push(
          <pre
            key={`code-${i}`}
            className="rounded-xl bg-[#16122E] text-[#ECE7FF] p-4 text-xs font-mono leading-relaxed overflow-x-auto border border-[#2D2558]"
          >
            <code>{rawCode}</code>
          </pre>
        );
        continue;
      }

      // Standard multi-column Markdown table
      const hasHeader = parsedRows.length >= 2 && isSeparatorRow(parsedRows[1]);
      const headers = hasHeader ? parsedRows[0] : [];
      const bodyRows = hasHeader ? parsedRows.slice(2) : parsedRows.filter((r) => !isSeparatorRow(r));

      blocks.push(
        <div key={`tbl-${i}`} className="overflow-x-auto rounded-xl border border-[#E5E0F5]">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            {hasHeader && (
              <thead>
                <tr className="bg-[#F4F1FC] text-[#271968] border-b border-[#E5E0F5]">
                  {headers.map((h, idx) => (
                    <th key={idx} className="py-2.5 px-3.5 font-display font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-[#EFEBF9] bg-white">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#FAF9FE]">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3.5 text-[#373054] align-top">
                      {cell}
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

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1.5 text-sm text-[#322B4E] leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1.5 text-sm text-[#322B4E] leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Standard paragraph: gather consecutive plain lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('|') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-sm text-[#322B4E] leading-relaxed">
        {paraLines.join(' ')}
      </p>
    );
  }

  return <div className="space-y-4">{blocks}</div>;
}
