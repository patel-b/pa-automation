import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { templateForPayer, type FlatValues } from "@/lib/pdf/templates";

// pdf-lib + filesystem reads need the Node.js runtime.
export const runtime = "nodejs";

/** A user-added mark placed directly on the draft (fractional page coords). */
interface Annotation {
  page: number;
  xFrac: number; // 0..1 from left
  yFrac: number; // 0..1 from top
  type: "text" | "x";
  text?: string;
  sizePt?: number;
}

/**
 * POST /api/draft-pdf
 * Body: { payer: string, values: { [fieldKey]: string } }
 *
 * Returns the matched payer's real PA-form PDF with the values overlaid, or
 * 404 if no template is mapped for that payer (the client falls back to the
 * on-screen HTML draft).
 */
export async function POST(request: Request) {
  let body: {
    payer?: string;
    values?: FlatValues;
    annotations?: Annotation[];
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const template = templateForPayer(body.payer ?? "");
  if (!template) {
    return Response.json({ error: "No PDF template for this payer." }, {
      status: 404,
    });
  }

  const values = body.values ?? {};

  try {
    const bytes = await readFile(
      path.join(process.cwd(), "pa-forms", template.file),
    );
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const ink = rgb(0.05, 0.05, 0.5);

    /** Greedy word-wrap into lines that fit within maxWidth at the given size. */
    const wrapLines = (text: string, size: number, maxWidth: number) => {
      const lines: string[] = [];
      let line = "";
      for (const word of text.split(/\s+/)) {
        const trial = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(trial, size) <= maxWidth || !line) {
          line = trial;
        } else {
          lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    for (const pl of template.placements) {
      const text = String(pl.value(values) ?? "");
      if (!text) continue;
      const page = pages[pl.page ?? 0];
      if (!page) continue;
      const size = pl.size ?? 9;
      const baseY = page.getHeight() - pl.top;

      if (pl.wrap) {
        const { width, lineHeight, maxLines } = pl.wrap;
        let lines = wrapLines(text, size, width);
        if (maxLines && lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1}$/, "…");
        }
        lines.forEach((ln, i) =>
          page.drawText(ln, {
            x: pl.x,
            y: baseY - i * lineHeight,
            size,
            font,
            color: ink,
          }),
        );
      } else {
        page.drawText(text, { x: pl.x, y: baseY, size, font, color: ink });
      }
    }

    // Stamp user-added annotations (manual edits placed on the draft).
    for (const a of body.annotations ?? []) {
      const page = pages[a.page ?? 0];
      if (!page) continue;
      const text = a.type === "x" ? "X" : (a.text ?? "").trim();
      if (!text) continue;
      const size = a.sizePt ?? (a.type === "x" ? 13 : 11);
      const x = a.xFrac * page.getWidth();
      // overlay positions are top-left; nudge the baseline down to match.
      const y = page.getHeight() - a.yFrac * page.getHeight() - size;
      page.drawText(text, { x, y, size, font, color: ink });
    }

    const out = await doc.save();
    return new Response(Buffer.from(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="pa-draft.pdf"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Could not build PDF: ${message}` },
      { status: 500 },
    );
  }
}
