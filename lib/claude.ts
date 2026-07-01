// =============================================================================
// CLAUDE (ANTHROPIC API) INTEGRATION — the AI extraction step.
// Sends the document text + insurance-card image to Claude and gets back a
// structured, typed object of patient / insurance / clinical fields.
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedData } from "@/lib/schema";
import { emptyExtractedData } from "@/lib/schema";
import type { ParsedImage } from "@/lib/parse";

/**
 * Extraction step: hand the parsed documents + insurance-card image(s) to Claude
 * and get back a normalized ExtractedData object.
 *
 * Uses structured outputs (output_config.format with a json_schema) so the model
 * is constrained to return exactly our shape — no brittle JSON-from-prose parsing.
 * The card image is passed to Claude's vision-capable model directly.
 *
 * Model defaults to Claude Opus 4.8 (most capable); override with ANTHROPIC_MODEL.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

/** Thrown when ANTHROPIC_API_KEY isn't set — the API route turns this into a friendly message. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set");
    this.name = "MissingApiKeyError";
  }
}

// --- JSON schema for structured output (mirrors ExtractedData) ---

const field = (valueType: "string" = "string") => ({
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: [valueType, "null"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    source: {
      type: "string",
      description: "Where the value came from, e.g. 'insurance card', 'clinical note', or 'not found'.",
    },
  },
  required: ["value", "confidence", "source"],
});

const requestTypeField = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: {
      type: "string",
      enum: ["medication", "imaging", "procedure", "unknown"],
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    source: { type: "string" },
  },
  required: ["value", "confidence", "source"],
};

const objectOf = (props: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties: props,
  required: Object.keys(props),
});

const extractionSchema = objectOf({
  patient: objectOf({
    firstName: field(),
    lastName: field(),
    dateOfBirth: field(),
    sex: field(),
    phone: field(),
    address: field(),
  }),
  insurance: objectOf({
    payerName: field(),
    planName: field(),
    memberId: field(),
    groupNumber: field(),
    rxBin: field(),
    rxPcn: field(),
  }),
  clinical: objectOf({
    primaryDiagnosis: field(),
    icd10Code: field(),
    requestType: requestTypeField,
    requestedService: field(),
    requestedCptCode: field(),
    directions: field(),
    strength: field(),
    frequency: field(),
    quantity: field(),
    daysSupply: field(),
    lengthOfTherapy: field(),
    clinicalJustification: field(),
    relevantHistory: field(),
  }),
  provider: objectOf({
    name: field(),
    npi: field(),
    specialty: field(),
    clinicName: field(),
    phone: field(),
    fax: field(),
  }),
});

const SYSTEM_PROMPT = `You are a clinical intake assistant that extracts structured data from a patient's medical notes and their insurance card, to pre-fill a prior authorization (PA) request form.

Extract every field you can find. For each field:
- Put the literal value found (e.g. a member ID exactly as printed), or null if it isn't present.
- Set "confidence" to how sure you are: "high" for clearly stated values, "medium" for inferred/partial, "low" for guesses.
- Set "source" to a short note on where it came from: "insurance card", "clinical note", "inferred", or "not found".

For patient.sex, output exactly "M" or "F".
For any date (e.g. date of birth), output it as MM/DD/YYYY.

For clinical.requestType, decide what kind of prior authorization this is:
- "medication" if a drug/prescription is being requested.
- "imaging" for MRI/CT/PET/ultrasound/X-ray.
- "procedure" for surgeries or other procedures.
- "unknown" if it can't be determined.

For clinical.requestedService, put the medication name (for medication requests) or the imaging/procedure name (otherwise).
For clinical.directions, put the Sig / directions for use exactly as written (e.g. "Inject 0.25 mg subcutaneously once weekly", "Take 1 capsule by mouth every morning").
For provider.specialty, put the prescriber's medical specialty (e.g. "Endocrinology", "Dermatology", "Psychiatry") if stated or clearly implied by the clinic.
For the medication detail fields, extract each from the prescription if present: clinical.strength (e.g. "300 mg/2 mL"), clinical.frequency (dosing frequency, e.g. "1 injection every 2 weeks"), clinical.quantity (amount dispensed, e.g. "1 carton (2 pens)"), clinical.daysSupply (e.g. "28 days"), and clinical.lengthOfTherapy (expected duration, e.g. "12 months"; use "chronic" only if the note says the condition is chronic/long-term).
Do not invent data. If something isn't present, use null with source "not found". This is synthetic demo data; there are no privacy concerns.`;

export async function extractData(
  documentText: string,
  images: ParsedImage[],
): Promise<ExtractedData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  const client = new Anthropic({ apiKey });

  const content: Anthropic.ContentBlockParam[] = [];

  for (const img of images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType as
          | "image/png"
          | "image/jpeg"
          | "image/webp"
          | "image/gif",
        data: img.base64,
      },
    });
  }

  const docSection =
    documentText.trim().length > 0
      ? `Medical notes / documents:\n\n${documentText}`
      : "No typed notes or documents were provided; rely on the insurance card image(s) above.";

  content.push({
    type: "text",
    text: `${images.length > 0 ? "The image(s) above are the patient's insurance card.\n\n" : ""}${docSection}\n\nExtract the structured prior-authorization fields.`,
  });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: {
      format: { type: "json_schema", schema: extractionSchema },
    },
  });

  const parsed = response.parsed_output as ExtractedData | null;
  // Fall back to a blank shape if the model refused or returned nothing usable.
  return parsed ?? emptyExtractedData();
}
