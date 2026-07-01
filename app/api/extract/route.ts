import { NextResponse } from "next/server";
import { parseUploads } from "@/lib/parse";
import { extractData, MissingApiKeyError } from "@/lib/claude";
import { matchForm, fillForm } from "@/lib/forms";
import { getDemoById, findDemoByFilenames } from "@/lib/demo/samples";
import type { ExtractedData } from "@/lib/schema";

// PDF/Word parsing and the Anthropic call need the Node.js runtime (not edge).
export const runtime = "nodejs";
// Extraction can take a little while on large notes.
export const maxDuration = 60;

/** Run an ExtractedData through form matching + filling into the API shape. */
function buildResponse(extracted: ExtractedData, demo: boolean) {
  const match = matchForm(extracted);
  const filledForm = fillForm(match.template, extracted);
  return {
    extracted,
    match: {
      formId: match.template.id,
      formTitle: match.template.title,
      payerLabel: match.template.payerLabel,
      reason: match.reason,
      alternatives: match.alternatives.map((t) => ({ id: t.id, title: t.title })),
    },
    filledForm,
    demo,
  };
}

/**
 * POST /api/extract
 *
 * Accepts multipart/form-data:
 *   - notes        : typed clinical notes (string, optional)
 *   - cardText     : typed insurance details (string, optional)
 *   - files        : uploaded PDFs / Word docs (repeatable, optional)
 *   - cardImages   : insurance card image uploads (repeatable, optional)
 *
 * Returns the extracted data, the matched form, and the auto-filled form.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const notes = (form.get("notes") as string | null)?.trim() ?? "";
  const cardText = (form.get("cardText") as string | null)?.trim() ?? "";

  const docFiles = form.getAll("files").filter((f): f is File => f instanceof File);
  const imageFiles = form
    .getAll("cardImages")
    .filter((f): f is File => f instanceof File);

  // Demo short-circuit: an explicit demoId, or an upload of one of the bundled
  // sample files, serves a pre-computed result WITHOUT calling the Anthropic
  // API. This keeps the public demo free no matter how many people use it.
  const demoId = (form.get("demoId") as string | null)?.trim() || null;
  const uploadedNames = [...docFiles, ...imageFiles].map((f) => f.name);
  const demoSample = getDemoById(demoId) ?? findDemoByFilenames(uploadedNames);
  if (demoSample) {
    return NextResponse.json(buildResponse(demoSample.extracted, true));
  }

  // Nothing to work with at all.
  if (!notes && !cardText && docFiles.length === 0 && imageFiles.length === 0) {
    return NextResponse.json(
      { error: "Please provide some notes, card details, or upload a file." },
      { status: 400 },
    );
  }

  // Public-deploy safety valve: when DEMO_ONLY is set, only the bundled samples
  // run (handled above) — live uploads never reach the paid API.
  if (process.env.DEMO_ONLY === "1") {
    return NextResponse.json(
      {
        error:
          "This is a public demo — live extraction is disabled. Try one of the sample patients to see the flow.",
      },
      { status: 403 },
    );
  }

  try {
    const parsed = await parseUploads([...docFiles, ...imageFiles]);

    // Combine typed inputs with parsed document text.
    const textParts = [
      notes && `Typed clinical notes:\n${notes}`,
      cardText && `Typed insurance card details:\n${cardText}`,
      parsed.documentText,
    ].filter(Boolean);

    const extracted = await extractData(textParts.join("\n\n"), parsed.images);

    return NextResponse.json(buildResponse(extracted, false));
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error:
            "No Anthropic API key configured. Copy .env.local.example to .env.local, add your ANTHROPIC_API_KEY, and restart the dev server.",
        },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Extraction failed: ${message}` },
      { status: 500 },
    );
  }
}
