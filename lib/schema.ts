/**
 * Normalized data extracted from a patient's documents + insurance card.
 *
 * This single shape is shared across the extraction step (lib/claude.ts) and
 * the form-matching / auto-fill step (lib/forms/*). Every field is optional
 * because real-world intake is messy — the human reviewer fills gaps.
 *
 * Each scalar field is wrapped in `Field<T>` so we can carry a confidence hint
 * and a short note about where the value came from. That powers the review UI:
 * low-confidence values get flagged for a closer look.
 */

export type Confidence = "high" | "medium" | "low";

export interface Field<T = string> {
  value: T | null;
  /** Model's self-reported confidence that this value is correct. */
  confidence: Confidence;
  /** Short human-readable note on where the value came from, e.g. "insurance card" or "not found". */
  source: string;
}

/** The request type drives which PA form we need. */
export type RequestType = "medication" | "imaging" | "procedure" | "unknown";

export interface ExtractedData {
  patient: {
    firstName: Field;
    lastName: Field;
    dateOfBirth: Field; // ISO-ish string, as read
    sex: Field;
    phone: Field;
    address: Field;
  };
  insurance: {
    payerName: Field; // e.g. "Aetna", "UnitedHealthcare"
    planName: Field;
    memberId: Field;
    groupNumber: Field;
    rxBin: Field;
    rxPcn: Field;
  };
  clinical: {
    primaryDiagnosis: Field;
    icd10Code: Field;
    requestType: Field<RequestType>;
    requestedService: Field; // medication name OR procedure/imaging name
    requestedCptCode: Field;
    directions: Field; // Sig / directions for use, e.g. "Inject 0.25 mg weekly"
    strength: Field; // e.g. "300 mg/2 mL"
    frequency: Field; // e.g. "1 injection every 2 weeks"
    quantity: Field; // e.g. "1 carton (2 pens)"
    daysSupply: Field; // e.g. "28 days"
    lengthOfTherapy: Field; // e.g. "12 months", "chronic"
    clinicalJustification: Field;
    relevantHistory: Field;
  };
  provider: {
    name: Field;
    npi: Field;
    specialty: Field;
    clinicName: Field;
    phone: Field;
    fax: Field;
  };
}

/** A blank, all-null ExtractedData used as a fallback / starting point. */
export function emptyExtractedData(): ExtractedData {
  const blank = (): Field => ({
    value: null,
    confidence: "low",
    source: "not found",
  });
  return {
    patient: {
      firstName: blank(),
      lastName: blank(),
      dateOfBirth: blank(),
      sex: blank(),
      phone: blank(),
      address: blank(),
    },
    insurance: {
      payerName: blank(),
      planName: blank(),
      memberId: blank(),
      groupNumber: blank(),
      rxBin: blank(),
      rxPcn: blank(),
    },
    clinical: {
      primaryDiagnosis: blank(),
      icd10Code: blank(),
      requestType: { value: "unknown", confidence: "low", source: "not found" },
      requestedService: blank(),
      requestedCptCode: blank(),
      directions: blank(),
      strength: blank(),
      frequency: blank(),
      quantity: blank(),
      daysSupply: blank(),
      lengthOfTherapy: blank(),
      clinicalJustification: blank(),
      relevantHistory: blank(),
    },
    provider: {
      name: blank(),
      npi: blank(),
      specialty: blank(),
      clinicName: blank(),
      phone: blank(),
      fax: blank(),
    },
  };
}
