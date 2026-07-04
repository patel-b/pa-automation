/**
 * Server-side helpers that turn uploaded files into something Claude can read.
 *
 * - PDFs and Word docs are converted to plain text.
 * - Images (insurance card photos / scans) are passed through as base64 so we
 *   can hand them to Claude's vision-capable model directly — no separate OCR
 *   dependency needed for the demo.
 *
 * These run only on the server (the API route), never in the browser.
 */

import mammoth from "mammoth";

export interface ParsedImage {
  /** Base64-encoded image bytes (no data: prefix). */
  base64: string;
  /** Media type, e.g. "image/png" or "image/jpeg". */
  mediaType: string;
}

export interface ParsedUploads {
  /** Concatenated plain text pulled from all PDF / Word / text uploads. */
  documentText: string;
  /** Insurance card (or any image) uploads, ready for Claude vision. */
  images: ParsedImage[];
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function isWordDoc(name: string, type: string): boolean {
  return (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.toLowerCase().endsWith(".docx")
  );
}

function isPdf(name: string, type: string): boolean {
  return type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

async function pdfToText(buffer: Buffer): Promise<string> {
  // pdfjs-dist (used internally by pdf-parse) references DOMMatrix/ImageData/Path2D at
  // module scope even for plain text extraction, expecting @napi-rs/canvas to provide
  // them. That native package isn't available on Vercel and isn't needed here — we never
  // render PDF pages, only extract text — so stub just enough for the module to load.
  class CanvasStub {}
  globalThis.DOMMatrix ??= CanvasStub as unknown as typeof DOMMatrix;
  globalThis.ImageData ??= CanvasStub as unknown as typeof ImageData;
  globalThis.Path2D ??= CanvasStub as unknown as typeof Path2D;

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function docxToText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

/**
 * Convert a list of uploaded files into combined document text + images.
 * Unsupported file types are skipped with a labelled note rather than throwing,
 * so one bad upload doesn't sink the whole request.
 */
export async function parseUploads(files: File[]): Promise<ParsedUploads> {
  const textChunks: string[] = [];
  const images: ParsedImage[] = [];

  for (const file of files) {
    const name = file.name || "upload";
    const type = file.type || "";
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      if (isPdf(name, type)) {
        const text = await pdfToText(buffer);
        textChunks.push(`--- ${name} (PDF) ---\n${text}`);
      } else if (isWordDoc(name, type)) {
        const text = await docxToText(buffer);
        textChunks.push(`--- ${name} (Word) ---\n${text}`);
      } else if (SUPPORTED_IMAGE_TYPES.has(type)) {
        images.push({
          base64: buffer.toString("base64"),
          mediaType: type === "image/jpg" ? "image/jpeg" : type,
        });
      } else if (type.startsWith("text/") || name.toLowerCase().endsWith(".txt")) {
        textChunks.push(`--- ${name} (text) ---\n${buffer.toString("utf8")}`);
      } else {
        textChunks.push(`--- ${name} ---\n[Unsupported file type "${type}", skipped]`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      textChunks.push(`--- ${name} ---\n[Could not read file: ${message}]`);
    }
  }

  return {
    documentText: textChunks.join("\n\n"),
    images,
  };
}
