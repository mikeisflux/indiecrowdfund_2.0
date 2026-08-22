import React from "react";

/**
 * Minimal Markdown renderer for the API reference.
 *
 * Covers exactly the constructs docs-content.ts uses: headings, fenced code,
 * pipe tables, bullet lists, paragraphs, and inline code/bold/links. Written
 * rather than pulled in as a dependency so the docs page and the "Copy for
 * LLM" output stay one source of truth — hand-authoring a second JSX copy
 * would let the two drift, which is the whole thing the button exists to
 * avoid.
 *
 * Input is our own module constant, never user content, so this does not need
 * to be a sanitizer. It still never uses dangerouslySetInnerHTML: everything
 * below goes through React elements, so even if the source ever became
 * untrusted it could not inject markup.
 */

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // One pass over `code`, **bold**, and [label](href).
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-i${i++}`;

    if (tok.startsWith("`")) {
      out.push(
        <code key={k} className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    } else {
      const split = tok.indexOf("](");
      const label = tok.slice(1, split);
      const href = tok.slice(split + 2, -1);
      out.push(
        <a key={k} href={href} className="text-primary hover:underline">
          {label}
        </a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const H = ["text-3xl", "text-2xl", "text-xl", "text-lg"];

export function MarkdownView({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre
          key={`c${i}`}
          className="my-4 overflow-x-auto rounded-lg border bg-zinc-950 p-4 text-sm text-zinc-100"
        >
          <code className="font-mono">{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Pipe table — header, separator, then rows until a non-pipe line.
    if (line.startsWith("|") && lines[i + 1]?.match(/^\|[\s:|-]+\|$/)) {
      const cells = (r: string) =>
        r.split("|").slice(1, -1).map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(cells(lines[i++]));
      blocks.push(
        // Wide tables scroll inside their own container rather than pushing
        // the page sideways on mobile.
        <div key={`t${i}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {head.map((h, x) => (
                  <th key={x} className="px-3 py-2 text-left font-semibold">
                    {inline(h, `th${i}-${x}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, y) => (
                <tr key={y} className="border-b">
                  {r.map((c, x) => (
                    <td key={x} className="px-3 py-2 align-top">
                      {inline(c, `td${i}-${y}-${x}`)}
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

    // Headings
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const Tag = (["h1", "h2", "h3", "h4"] as const)[level - 1];
      blocks.push(
        <Tag
          key={`h${i}`}
          className={`${H[level - 1]} font-bold ${level <= 2 ? "mt-10 mb-3" : "mt-6 mb-2"}`}
        >
          {inline(h[2], `h${i}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // Bullet / numbered list
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`l${i}`}
          className={`my-3 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}
        >
          {items.map((t, x) => (
            <li key={x}>{inline(t, `li${i}-${x}`)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — consume until a blank line or the start of another block.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("|") &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={`p${i}`} className="my-3 leading-relaxed">
        {inline(para.join(" "), `p${i}`)}
      </p>
    );
  }

  return <div className="max-w-none">{blocks}</div>;
}
