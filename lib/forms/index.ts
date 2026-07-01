import type { ExtractedData } from "@/lib/schema";
import type { FilledForm, FormTemplate } from "./types";
import { genericMedicationPA } from "./generic-medication-pa";
import { genericImagingPA } from "./generic-imaging-pa";

/**
 * Registry of available PA form templates.
 *
 * Order matters: payer-specific forms should come BEFORE the generic fallbacks
 * so the matcher prefers a real payer form when one applies. Drop new payer
 * forms in here (e.g. import { aetnaMedicationPA } and add it to the top).
 */
export const FORM_TEMPLATES: FormTemplate[] = [
  // --- Payer-specific forms go here (added once a real PDF is provided) ---
  // aetnaMedicationPA,

  // --- Generic fallbacks ---
  genericMedicationPA,
  genericImagingPA,
];

export interface FormMatch {
  template: FormTemplate;
  /** Why this form was chosen — surfaced in the UI for transparency. */
  reason: string;
  /** Other templates that could also apply, for an optional manual override. */
  alternatives: FormTemplate[];
}

function payerMatches(template: FormTemplate, payer: string): boolean {
  if (template.payerMatchers.length === 0) return true; // generic fallback
  const p = payer.toLowerCase();
  return template.payerMatchers.some((m) => p.includes(m));
}

/**
 * Pick the best PA form for the extracted data.
 *
 * Strategy: filter to templates that cover the detected request type, then
 * prefer a payer-specific match over a generic one. Falls back to the generic
 * medication form if nothing else fits, so the flow never dead-ends.
 */
export function matchForm(data: ExtractedData): FormMatch {
  const requestType = data.clinical.requestType.value ?? "unknown";
  const payer = data.insurance.payerName.value ?? "";

  const byType = FORM_TEMPLATES.filter((t) =>
    t.requestTypes.includes(requestType),
  );
  const candidates = byType.length > 0 ? byType : FORM_TEMPLATES;

  // Prefer a payer-specific template; fall back to the first generic one.
  const payerSpecific = candidates.find(
    (t) => t.payerMatchers.length > 0 && payerMatches(t, payer),
  );
  const template =
    payerSpecific ?? candidates[0] ?? FORM_TEMPLATES[0];

  const payerLabel = payer || "an unspecified payer";
  const reason = payerSpecific
    ? `Matched ${template.payerLabel}'s ${requestType} form for ${payerLabel}.`
    : `No payer-specific form on file for ${payerLabel}; using the generic ${requestType === "unknown" ? "medication" : requestType} form.`;

  const alternatives = FORM_TEMPLATES.filter((t) => t.id !== template.id);

  return { template, reason, alternatives };
}

/** Apply a template to extracted data, producing flat fields for the review UI. */
export function fillForm(
  template: FormTemplate,
  data: ExtractedData,
): FilledForm {
  return {
    formId: template.id,
    formTitle: template.title,
    payerLabel: template.payerLabel,
    sections: template.sections.map((section) => ({
      title: section.title,
      fields: section.fields.map((field) => {
        const f = field.fromExtracted(data);
        return {
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required ?? false,
          hint: field.hint,
          fullWidth: field.fullWidth,
          options: field.options,
          allowOther: field.allowOther,
          suggest: field.suggest,
          linkedField: field.linkedField,
          value: f.value ?? "",
          confidence: f.confidence,
          source: f.source,
        };
      }),
    })),
  };
}

/** Look up a template by id (used when the reviewer overrides the match). */
export function getTemplateById(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id);
}
