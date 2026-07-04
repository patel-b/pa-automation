// =============================================================================
// CLAUDE (ANTHROPIC API) INTEGRATION — the AI extraction step.
// Sends the document text + insurance-card image to Claude and gets back a
// structured, typed object of patient / insurance / clinical fields.
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { Confidence, ExtractedData, Field, RequestType } from "@/lib/schema";
import { emptyExtractedData } from "@/lib/schema";
import type { ParsedImage } from "@/lib/parse";

/**
 * Extraction step: hand the parsed documents + insurance-card image(s) to Claude
 * and get back a normalized ExtractedData object.
 *
 * The card image is passed to Claude's vision-capable model directly. The model
 * returns JSON, then we normalize it into the exact app shape locally.
 *
 * Model defaults to Claude Sonnet 5 (speed/cost balanced); override with ANTHROPIC_MODEL.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

/** Thrown when ANTHROPIC_API_KEY isn't set — the API route turns this into a friendly message. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set");
    this.name = "MissingApiKeyError";
  }
}

const CONFIDENCES: Confidence[] = ["high", "medium", "low"];
const REQUEST_TYPES: RequestType[] = [
  "medication",
  "imaging",
  "procedure",
  "unknown",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeConfidence(value: unknown): Confidence {
  return CONFIDENCES.includes(value as Confidence)
    ? (value as Confidence)
    : "low";
}

function normalizeSource(value: unknown, hasValue: boolean): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return hasValue ? "model output" : "not found";
}

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeField(raw: unknown): Field {
  const record = isRecord(raw) ? raw : {};
  const rawValue = "value" in record ? record.value : raw;
  const value = normalizeValue(rawValue);
  return {
    value,
    confidence: normalizeConfidence(record.confidence),
    source: normalizeSource(record.source, Boolean(value)),
  };
}

function normalizeRequestType(raw: unknown): Field<RequestType> {
  const record = isRecord(raw) ? raw : {};
  const rawValue = "value" in record ? record.value : raw;
  const value = normalizeValue(rawValue);
  const requestType = REQUEST_TYPES.includes(value as RequestType)
    ? (value as RequestType)
    : "unknown";
  return {
    value: requestType,
    confidence: normalizeConfidence(record.confidence),
    source: normalizeSource(record.source, requestType !== "unknown"),
  };
}

function normalizeExtractedData(raw: unknown): ExtractedData {
  if (!isRecord(raw)) return emptyExtractedData();

  const patient = isRecord(raw.patient) ? raw.patient : {};
  const insurance = isRecord(raw.insurance) ? raw.insurance : {};
  const clinical = isRecord(raw.clinical) ? raw.clinical : {};
  const provider = isRecord(raw.provider) ? raw.provider : {};

  return {
    patient: {
      firstName: normalizeField(patient.firstName),
      lastName: normalizeField(patient.lastName),
      dateOfBirth: normalizeField(patient.dateOfBirth),
      sex: normalizeField(patient.sex),
      phone: normalizeField(patient.phone),
      address: normalizeField(patient.address),
    },
    insurance: {
      payerName: normalizeField(insurance.payerName),
      planName: normalizeField(insurance.planName),
      memberId: normalizeField(insurance.memberId),
      groupNumber: normalizeField(insurance.groupNumber),
      rxBin: normalizeField(insurance.rxBin),
      rxPcn: normalizeField(insurance.rxPcn),
    },
    clinical: {
      primaryDiagnosis: normalizeField(clinical.primaryDiagnosis),
      icd10Code: normalizeField(clinical.icd10Code),
      requestType: normalizeRequestType(clinical.requestType),
      requestedService: normalizeField(clinical.requestedService),
      requestedCptCode: normalizeField(clinical.requestedCptCode),
      directions: normalizeField(clinical.directions),
      strength: normalizeField(clinical.strength),
      frequency: normalizeField(clinical.frequency),
      quantity: normalizeField(clinical.quantity),
      daysSupply: normalizeField(clinical.daysSupply),
      lengthOfTherapy: normalizeField(clinical.lengthOfTherapy),
      clinicalJustification: normalizeField(clinical.clinicalJustification),
      relevantHistory: normalizeField(clinical.relevantHistory),
    },
    provider: {
      name: normalizeField(provider.name),
      npi: normalizeField(provider.npi),
      specialty: normalizeField(provider.specialty),
      clinicName: normalizeField(provider.clinicName),
      phone: normalizeField(provider.phone),
      fax: normalizeField(provider.fax),
    },
  };
}

function parseJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const objectText = extractFirstJsonObject(trimmed);
  if (objectText) candidates.push(objectText);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

const OUTPUT_FORMAT = `Return only valid JSON with this shape:
{
  "patient": {
    "firstName": {"value": "", "confidence": "low", "source": "not found"},
    "lastName": {"value": "", "confidence": "low", "source": "not found"},
    "dateOfBirth": {"value": "", "confidence": "low", "source": "not found"},
    "sex": {"value": "", "confidence": "low", "source": "not found"},
    "phone": {"value": "", "confidence": "low", "source": "not found"},
    "address": {"value": "", "confidence": "low", "source": "not found"}
  },
  "insurance": {
    "payerName": {"value": "", "confidence": "low", "source": "not found"},
    "planName": {"value": "", "confidence": "low", "source": "not found"},
    "memberId": {"value": "", "confidence": "low", "source": "not found"},
    "groupNumber": {"value": "", "confidence": "low", "source": "not found"},
    "rxBin": {"value": "", "confidence": "low", "source": "not found"},
    "rxPcn": {"value": "", "confidence": "low", "source": "not found"}
  },
  "clinical": {
    "primaryDiagnosis": {"value": "", "confidence": "low", "source": "not found"},
    "icd10Code": {"value": "", "confidence": "low", "source": "not found"},
    "requestType": {"value": "unknown", "confidence": "low", "source": "not found"},
    "requestedService": {"value": "", "confidence": "low", "source": "not found"},
    "requestedCptCode": {"value": "", "confidence": "low", "source": "not found"},
    "directions": {"value": "", "confidence": "low", "source": "not found"},
    "strength": {"value": "", "confidence": "low", "source": "not found"},
    "frequency": {"value": "", "confidence": "low", "source": "not found"},
    "quantity": {"value": "", "confidence": "low", "source": "not found"},
    "daysSupply": {"value": "", "confidence": "low", "source": "not found"},
    "lengthOfTherapy": {"value": "", "confidence": "low", "source": "not found"},
    "clinicalJustification": {"value": "", "confidence": "low", "source": "not found"},
    "relevantHistory": {"value": "", "confidence": "low", "source": "not found"}
  },
  "provider": {
    "name": {"value": "", "confidence": "low", "source": "not found"},
    "npi": {"value": "", "confidence": "low", "source": "not found"},
    "specialty": {"value": "", "confidence": "low", "source": "not found"},
    "clinicName": {"value": "", "confidence": "low", "source": "not found"},
    "phone": {"value": "", "confidence": "low", "source": "not found"},
    "fax": {"value": "", "confidence": "low", "source": "not found"}
  }
}`;

const SYSTEM_PROMPT = `You are a clinical intake assistant that extracts structured data from a patient's medical notes and their insurance card, to pre-fill a prior authorization (PA) request form.

Extract every field you can find. For each field:
- Put the literal value found (e.g. a member ID exactly as printed), or an empty string if it isn't present.
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
Do not invent data. If something isn't present, use an empty string with source "not found". This is synthetic demo data; there are no privacy concerns.`;

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
    text: `${images.length > 0 ? "The image(s) above are the patient's insurance card.\n\n" : ""}${docSection}\n\nExtract the structured prior-authorization fields.\n\n${OUTPUT_FORMAT}`,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const parsed = parseJsonObject(text);
  return parsed ? normalizeExtractedData(parsed) : emptyExtractedData();
}
