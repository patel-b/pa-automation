/**
 * Maps a payer to a real PA-form PDF (kept in /pa-forms) plus the coordinates
 * where each of our values should be drawn onto it.
 *
 * The PDFs are flat (no fillable fields), so we overlay text at fixed positions
 * derived from each form's label coordinates. `top` is the distance from the
 * top of the page in PDF points; the route converts it to pdf-lib's
 * bottom-left origin at draw time (y = pageHeight - top).
 *
 * To add another payer: drop its PDF in /pa-forms, find label coordinates with
 * `pdftotext -bbox`, and add a template entry here.
 *
 * NOTE: these are the payers' own forms, included only for a local demo.
 */

export type FlatValues = Record<string, string>;

export interface PdfPlacement {
  x: number;
  top: number;
  size?: number;
  /** Page index to draw on (0-based). Defaults to the first page. */
  page?: number;
  /**
   * When set, wrap the text to `width` points across multiple lines (each
   * `lineHeight` points apart), up to `maxLines` lines (truncated with an
   * ellipsis). Used for free-text boxes like "other comments".
   */
  wrap?: { width: number; lineHeight: number; maxLines?: number };
  value: (v: FlatValues) => string;
}

export interface PdfTemplate {
  id: string;
  label: string;
  file: string;
  /** Lowercase payer-name fragments this form applies to. */
  payerMatchers: string[];
  placements: PdfPlacement[];
}

const fullName = (v: FlatValues) =>
  `${v.patientFirstName ?? ""} ${v.patientLastName ?? ""}`.trim();

const today = () => new Date().toLocaleDateString("en-US");

// --- Address parsing -------------------------------------------------------
// Splits a single address string like
//   "318 Sherman Street, Unit 4, Evanston, IL 60202"
// into street / city / state / zip for forms with separate boxes.
function addressParts(addr: string) {
  const parts = (addr ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { street: "", city: "", state: "", zip: "" };
  const stateZip = parts.length >= 2 ? parts[parts.length - 1] : "";
  const city = parts.length >= 3 ? parts[parts.length - 2] : "";
  const street =
    parts.length >= 3
      ? parts.slice(0, parts.length - 2).join(", ")
      : parts[0];
  const [state = "", ...zipRest] = stateZip.split(/\s+/);
  return { street, city, state, zip: zipRest.join(" ") };
}
const street = (v: FlatValues) => addressParts(v.patientAddress).street;
const city = (v: FlatValues) => addressParts(v.patientAddress).city;
const state = (v: FlatValues) => addressParts(v.patientAddress).state;
const zip = (v: FlatValues) => addressParts(v.patientAddress).zip;

/** Brief combined note for "other comments" boxes. */
const commentsSummary = (v: FlatValues) =>
  [v.clinicalJustification, v.relevantHistory].filter(Boolean).join("  ");

/** "Diagnosis (ICD-10: CODE)" for forms with a single diagnosis field. */
const diagnosisWithIcd = (v: FlatValues) =>
  [v.primaryDiagnosis, v.icd10Code && `(ICD-10: ${v.icd10Code})`]
    .filter(Boolean)
    .join(" ");

/** Drug name only (strip the strength/form that follows the first number). */
const drugName = (v: FlatValues) =>
  (v.requestedMedication ?? "").split(/\s+\d/)[0].trim();

/** Whether the length-of-therapy reads as a chronic / long-term course. */
const isChronic = (v: FlatValues) =>
  /chronic|life|long[- ]?term|month|year/i.test(v.lengthOfTherapy ?? "");

/** Whether this is an injectable (drives "specific dosage form" answers). */
const isInjectable = (v: FlatValues) =>
  /inject|\bpen\b|syringe|subcutaneous|subcut|\bSC\b/i.test(
    `${v.directions ?? ""} ${v.requestedMedication ?? ""}`,
  );

export const PDF_TEMPLATES: PdfTemplate[] = [
  {
    id: "ny-medicaid-nyrx",
    label: "NYRx — NY Medicaid Pharmacy",
    payerMatchers: ["nyrx", "medicaid"],
    file: "ny-medicaid-nyrx.pdf",
    placements: [
      // --- Member Information ---
      { x: 155, top: 222, value: (v) => v.patientLastName },
      { x: 157, top: 244, value: (v) => v.patientFirstName },
      { x: 376, top: 267, value: (v) => v.memberId },
      { x: 205, top: 289, value: (v) => v.patientDob },
      // --- Prescriber Information ---
      { x: 166, top: 432, value: (v) => v.providerName },
      { x: 127, top: 478, value: (v) => v.providerNpi },
      { x: 189, top: 501, size: 8, value: (v) => v.clinicName },
      { x: 141, top: 546, value: (v) => v.providerPhone },
      { x: 415, top: 546, value: (v) => v.providerFax },
      // --- Medication and Dispensing Information ---
      { x: 111, top: 667, size: 7, value: (v) => v.requestedMedication },
    ],
  },
  {
    id: "ny-standard-pa",
    label: "NYS Medicaid Standard PA (Fidelis)",
    payerMatchers: ["fidelis", "nys standard"],
    file: "ny-standard-pa.pdf",
    placements: [
      // --- Patient Information ---
      { x: 82, top: 134, value: (v) => v.patientFirstName },
      { x: 254, top: 134, value: (v) => v.patientLastName },
      { x: 35, top: 177, size: 8, value: (v) => v.patientDob },
      { x: 150, top: 177, size: 8, value: (v) => v.memberId },
      // --- Provider Information (values sit below the cramped label row) ---
      { x: 35, top: 224, value: (v) => v.providerName },
      { x: 320, top: 224, size: 8, value: (v) => v.clinicName },
      { x: 40, top: 251, value: (v) => v.providerNpi },
      { x: 150, top: 251, size: 8, value: (v) => v.providerPhone },
      { x: 245, top: 251, size: 8, value: (v) => v.providerFax },
      // --- Medication / Diagnosis ---
      { x: 82, top: 277, size: 8, value: (v) => v.requestedMedication },
      {
        x: 167,
        top: 299,
        size: 8,
        value: diagnosisWithIcd,
      },
    ],
  },
  {
    id: "cigna",
    label: "Cigna",
    file: "cigna.pdf",
    payerMatchers: ["cigna"],
    placements: [
      // --- Physician Information (left column) ---
      { x: 108, top: 130, value: (v) => v.providerName },
      { x: 92, top: 194, value: (v) => v.providerPhone },
      { x: 82, top: 215, value: (v) => v.providerFax },
      { x: 121, top: 236, size: 8, value: (v) => v.clinicName },
      // --- Patient Information (right column) ---
      { x: 366, top: 173, value: fullName },
      { x: 348, top: 194, value: (v) => v.memberId },
      { x: 506, top: 194, value: (v) => v.patientDob },
      { x: 397, top: 215, size: 7, value: (v) => v.patientAddress },
      { x: 362, top: 258, value: (v) => v.patientPhone },
      // --- Medication / Diagnosis ---
      { x: 40, top: 338, size: 8, value: (v) => v.requestedMedication },
      {
        x: 162,
        top: 376,
        size: 8,
        value: diagnosisWithIcd,
      },
    ],
  },
  {
    id: "optumrx-partd",
    label: "OptumRx (Medicare Part D)",
    // Specific matcher so it doesn't steal general "optum" requests from uhc-optumrx.
    payerMatchers: ["optumrx part d", "optum rx part d", "optumrx-partd"],
    file: "optumrx-partd.pdf",
    placements: [
      // --- Member Information (left) ---
      { x: 111, top: 135, value: fullName },
      { x: 107, top: 154, value: (v) => v.memberId },
      { x: 101, top: 172, value: (v) => v.patientDob },
      { x: 111, top: 190, size: 8, value: (v) => v.patientAddress },
      { x: 77, top: 226, value: (v) => v.patientPhone },
      // --- Provider Information (right) ---
      { x: 391, top: 135, value: (v) => v.providerName },
      { x: 351, top: 154, value: (v) => v.providerNpi },
      { x: 383, top: 172, value: (v) => v.providerPhone },
      { x: 372, top: 190, value: (v) => v.providerFax },
      { x: 416, top: 208, size: 8, value: (v) => v.clinicName },
      // --- Medication Information ---
      { x: 215, top: 263, size: 8, value: (v) => v.requestedMedication },
      { x: 360, top: 328, size: 8, value: (v) => v.primaryDiagnosis },
      { x: 125, top: 343, value: (v) => v.icd10Code },
    ],
  },
  {
    id: "mvp",
    label: "MVP Health Care",
    payerMatchers: ["mvp"],
    file: "mvp.pdf",
    placements: [
      // --- Section 1: Member Information (values sit below labels) ---
      { x: 42, top: 202, value: fullName },
      { x: 337, top: 202, value: (v) => v.patientDob },
      { x: 435, top: 202, value: (v) => v.memberId },
      // --- Section 2: Requesting Provider Information ---
      { x: 42, top: 262, value: (v) => v.providerName },
      { x: 293, top: 262, value: (v) => v.providerNpi },
      { x: 487, top: 262, size: 8, value: (v) => v.providerPhone },
      { x: 487, top: 294, size: 8, value: (v) => v.providerFax },
      { x: 42, top: 327, size: 8, value: (v) => v.clinicName },
      // --- Section 3: Medication Requested ---
      { x: 42, top: 387, size: 8, value: (v) => v.requestedMedication },
      // --- Section 4: Patient History ---
      {
        x: 42,
        top: 636,
        size: 8,
        value: diagnosisWithIcd,
      },
    ],
  },
  {
    id: "medicare-partd",
    label: "Medicare Part D",
    payerMatchers: ["medicare"],
    file: "medicare-partd.pdf",
    placements: [
      // --- Page 1: Enrollee Information (labels sit above the fill box) ---
      { x: 78, top: 187, value: fullName },
      { x: 313, top: 187, value: (v) => v.patientDob },
      { x: 78, top: 224, value: (v) => v.memberId },
      { x: 313, top: 224, value: (v) => v.groupNumber },
      { x: 78, top: 352, size: 8, value: (v) => v.patientAddress },
      { x: 112, top: 390, size: 8, value: (v) => v.patientPhone },
      { x: 78, top: 423, size: 8, value: (v) => v.requestedMedication },
      // --- Page 1: Prescribing Physician's Information ---
      { x: 78, top: 543, value: (v) => v.providerName },
      { x: 78, top: 580, size: 8, value: (v) => v.clinicName },
      { x: 112, top: 623, size: 8, value: (v) => v.providerPhone },
      { x: 262, top: 623, size: 8, value: (v) => v.providerFax },
      // --- Page 2: check the "prior authorization" request box + date ---
      { x: 77, top: 100, page: 1, size: 11, value: () => "X" },
      { x: 434, top: 620, page: 1, value: today },
    ],
  },
  {
    id: "bcbs-empire-ny",
    label: "Empire BlueCross BlueShield (NY)",
    file: "bcbs-empire-ny.pdf",
    payerMatchers: ["blue cross", "blueshield", "blue shield", "bcbs", "empire", "anthem"],
    placements: [
      // --- Member information (values sit in the fill cell after each divider) ---
      { x: 235, top: 305, size: 9, value: fullName },
      { x: 132, top: 323, value: (v) => v.memberId },
      { x: 363, top: 323, value: (v) => v.patientDob }, // fill cell is right of the divider
      // Sex: X in the F or M box (no free text)
      { x: 144, top: 337, size: 9, value: (v) => (/^f/i.test(v.patientSex) ? "X" : "") },
      { x: 167, top: 337, size: 9, value: (v) => (/^m/i.test(v.patientSex) ? "X" : "") },
      // --- Medication information ---
      { x: 230, top: 418, size: 8, value: (v) => v.requestedMedication },
      { x: 232, top: 443, size: 8, value: (v) => v.directions }, // SIG (dose, frequency, duration)
      { x: 366, top: 458, value: (v) => v.icd10Code },
      { x: 230, top: 476, size: 8, value: (v) => v.primaryDiagnosis },
      // --- Briefly describe (free-text) → summarized justification + history ---
      {
        x: 64,
        top: 700,
        size: 8,
        wrap: { width: 520, lineHeight: 10, maxLines: 2 },
        value: commentsSummary,
      },
    ],
  },
  {
    id: "aetna",
    label: "Aetna",
    file: "aetna.pdf",
    payerMatchers: ["aetna"],
    placements: [
      // --- Patient Information (left column) ---
      { x: 25, top: 150, value: fullName },
      { x: 25, top: 176, value: (v) => v.memberId },
      { x: 25, top: 201, size: 8, value: (v) => v.patientAddress },
      { x: 25, top: 226, value: (v) => v.patientPhone },
      { x: 250, top: 247, value: (v) => v.patientDob },
      // Gender: X in the Male or Female box
      { x: 19, top: 250, size: 9, value: (v) => (/^m/i.test(v.patientSex) ? "X" : "") },
      { x: 71, top: 250, size: 9, value: (v) => (/^f/i.test(v.patientSex) ? "X" : "") },
      // --- Prescriber Information (right column) ---
      { x: 420, top: 149, value: today },
      { x: 420, top: 175, value: (v) => v.providerName },
      { x: 420, top: 201, size: 8, value: (v) => v.clinicName },
      { x: 480, top: 226, value: (v) => v.providerPhone },
      { x: 480, top: 250, value: (v) => v.providerFax },
      // --- Diagnosis and Medical Information ---
      // Medication row: Medication | Strength | Frequency
      { x: 30, top: 291, size: 8, value: drugName },
      { x: 315, top: 291, size: 8, value: (v) => v.strength },
      { x: 465, top: 291, size: 8, value: (v) => v.frequency },
      // Expected Length of Therapy | Quantity | Day Supply
      { x: 30, top: 325, size: 8, value: (v) => v.lengthOfTherapy },
      { x: 180, top: 325, size: 8, value: (v) => v.quantity },
      { x: 315, top: 325, size: 8, value: (v) => v.daysSupply },
      // Chronic / long-term condition? -> Yes
      { x: 407, top: 345, size: 9, value: (v) => (isChronic(v) ? "X" : "") },
      // "What condition is the drug being prescribed for?" (checkbox + ICD + diagnosis)
      { x: 24, top: 390, size: 9, value: (v) => (v.primaryDiagnosis ? "X" : "") },
      { x: 300, top: 385, value: (v) => v.icd10Code },
      { x: 75, top: 398, size: 8, value: (v) => v.primaryDiagnosis },
      // STEP THERAPY checkbox (prior therapies on file)
      { x: 24, top: 427, size: 9, value: (v) => (v.relevantHistory ? "X" : "") },
      // Specific dosage form? -> check + note for injectables
      { x: 24, top: 574, size: 9, value: (v) => (isInjectable(v) ? "X" : "") },
      { x: 80, top: 585, size: 8, value: (v) => (isInjectable(v) ? "Prefilled pen / syringe (subcutaneous)" : "") },
      // --- Page 2: prescriber signature + date (sign below the labels) ---
      { x: 45, top: 125, page: 1, value: (v) => v.providerName },
      { x: 460, top: 125, page: 1, value: today },
    ],
  },
  {
    id: "uhc-optumrx",
    label: "UnitedHealthcare / OptumRx",
    file: "uhc-optumrx.pdf",
    payerMatchers: ["unitedhealthcare", "united health", "uhc", "optumrx", "optum"],
    placements: [
      // Member Information (left column)
      { x: 111, top: 124, value: fullName },
      { x: 107, top: 143, value: (v) => v.memberId },
      { x: 101, top: 161, value: (v) => v.patientDob },
      { x: 111, top: 179, size: 8, value: street }, // street only
      { x: 67, top: 197, size: 8, value: city },
      { x: 161, top: 197, value: state },
      { x: 248, top: 197, value: zip },
      { x: 77, top: 215, value: (v) => v.patientPhone },
      // Provider Information (right column)
      { x: 372, top: 124, value: (v) => v.providerName },
      { x: 332, top: 143, value: (v) => v.providerNpi },
      { x: 509, top: 143, size: 8, value: (v) => v.providerSpecialty },
      { x: 364, top: 161, value: (v) => v.providerPhone },
      { x: 353, top: 179, value: (v) => v.providerFax },
      { x: 398, top: 197, size: 7, value: (v) => v.clinicName }, // office address
      // Medication Information
      { x: 215, top: 250, size: 8, value: (v) => v.requestedMedication },
      { x: 45, top: 266, size: 9, value: (v) => (v.requestedMedication ? "X" : "") }, // requesting brand
      { x: 384, top: 268, size: 8, value: (v) => v.directions },
      // Clinical Information
      { x: 95, top: 436, size: 8, value: (v) => v.primaryDiagnosis },
      { x: 432, top: 436, value: (v) => v.icd10Code },
      // Prescriber attestation + signature
      { x: 92, top: 558, size: 9, value: (v) => (v.providerName ? "X" : "") }, // attest: Yes
      { x: 155, top: 571, value: (v) => v.providerName },
      { x: 388, top: 571, value: today },
      // Other comments — summarized history + justification (wrapped)
      {
        x: 41,
        top: 628,
        size: 8,
        wrap: { width: 545, lineHeight: 11, maxLines: 4 },
        value: commentsSummary,
      },
    ],
  },
];

/** Find a PDF template for a payer name, or null if none is mapped. */
export function templateForPayer(payer: string): PdfTemplate | null {
  const p = (payer || "").toLowerCase();
  if (!p) return null;
  return (
    PDF_TEMPLATES.find((t) => t.payerMatchers.some((m) => p.includes(m))) ?? null
  );
}
