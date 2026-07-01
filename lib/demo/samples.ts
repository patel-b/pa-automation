import type { ExtractedData, RequestType } from "@/lib/schema";

/**
 * Pre-computed extraction results for the bundled sample patients.
 *
 * These let the public demo run with ZERO Anthropic API calls — and therefore
 * zero cost. When a request names a `demoId`, or uploads one of the known
 * sample files in data/sample-patients/, the /api/extract route serves the
 * canned result below instead of calling Claude.
 *
 * Values were hand-authored from the sample documents to mirror what the model
 * returns. Regenerate from the live model anytime the documents change.
 */

type Conf = "high" | "medium" | "low";

/** Field sourced from the clinical note / prescription. */
const note = (value: string | null, confidence: Conf = "high") => ({
  value,
  confidence,
  source: "clinical note",
});
/** Field sourced from the insurance card image. */
const card = (value: string | null, confidence: Conf = "high") => ({
  value,
  confidence,
  source: "insurance card",
});
/** Not present in either document. */
const none = () => ({ value: null, confidence: "low" as Conf, source: "not found" });
const reqType = (value: RequestType) => ({
  value,
  confidence: "high" as Conf,
  source: "clinical note",
});

export interface DemoSample {
  id: string;
  /** Short button label, e.g. "Sample 1 · Wegovy". */
  label: string;
  /** One-line description shown under the button. */
  blurb: string;
  /** Lowercased filename fragments that auto-trigger this sample on upload. */
  fileMatches: string[];
  extracted: ExtractedData;
}

export const DEMO_SAMPLES: DemoSample[] = [
  {
    id: "1",
    label: "Sample 1 · Wegovy",
    blurb: "UnitedHealthcare · weight management",
    fileMatches: ["ins-card-1", "sample-med-note-1"],
    extracted: {
      patient: {
        firstName: note("Robert"),
        lastName: note("Hayes"),
        dateOfBirth: note("07/22/1968"),
        sex: note("Male"),
        phone: note("(555) 318-4471"),
        address: note("1190 Maple Crest Drive, Aurora, IL 60504"),
      },
      insurance: {
        payerName: card("UnitedHealthcare"),
        planName: card("Choice Plus PPO"),
        memberId: card("948267715"),
        groupNumber: card("0708144"),
        rxBin: card("610279"),
        rxPcn: card("9999"),
      },
      clinical: {
        primaryDiagnosis: note("Severe (morbid) obesity with type 2 diabetes mellitus"),
        icd10Code: note("E66.01"),
        requestType: reqType("medication"),
        requestedService: note("Wegovy (semaglutide) 0.25 mg subcutaneous pen, once weekly"),
        requestedCptCode: none(),
        directions: note("Inject 0.25 mg subcutaneously once weekly"),
        strength: note("0.25 mg/0.5 mL"),
        frequency: note("1 injection once weekly"),
        quantity: note("1 carton (4 pens)"),
        daysSupply: note("28 days"),
        lengthOfTherapy: note("12 months (chronic)"),
        clinicalJustification: note(
          "BMI 37.6 with type 2 diabetes and hypertension. Enrolled in a supervised weight-management program with registered-dietitian oversight. Inadequate response to lifestyle modification, liraglutide (Saxenda) and semaglutide (Ozempic).",
        ),
        relevantHistory: note(
          "Prior trials: 6-month lifestyle/diet program (<4% loss); metformin; Saxenda (liraglutide) 3.0 mg daily x4 months; Ozempic (semaglutide) 1.0 mg weekly x5 months — all with inadequate weight response.",
        ),
      },
      provider: {
        name: note("Susan Whitfield, MD"),
        npi: note("1457823690"),
        specialty: note("Endocrinology"),
        clinicName: note("Lakeside Endocrinology & Medical Weight Management"),
        phone: note("(555) 412-7700"),
        fax: note("(555) 412-7701"),
      },
    },
  },
  {
    id: "2",
    label: "Sample 2 · Dupixent",
    blurb: "Aetna · atopic dermatitis",
    fileMatches: ["ins-card-2", "sample-med-note-2"],
    extracted: {
      patient: {
        firstName: note("Maria"),
        lastName: note("Santos"),
        dateOfBirth: note("11/05/1990"),
        sex: note("Female"),
        phone: note("(555) 274-9038"),
        address: note("745 Glenview Avenue, Apt 12B, Naperville, IL 60540"),
      },
      insurance: {
        payerName: card("Aetna"),
        planName: card("Open Access HMO"),
        memberId: card("W213456789"),
        groupNumber: card("285410"),
        rxBin: card("610502"),
        rxPcn: card("ADV"),
      },
      clinical: {
        primaryDiagnosis: note("Moderate-to-severe atopic dermatitis"),
        icd10Code: note("L20.9"),
        requestType: reqType("medication"),
        requestedService: note("Dupixent (dupilumab) 300 mg/2 mL prefilled pen"),
        requestedCptCode: none(),
        directions: note("Inject 600 mg subcutaneously (two 300 mg injections) on day 1, then 300 mg every 2 weeks"),
        strength: note("300 mg/2 mL"),
        frequency: note("1 injection every 2 weeks"),
        quantity: note("1 carton (2 pens)"),
        daysSupply: note("28 days"),
        lengthOfTherapy: note("12 months (chronic)"),
        clinicalJustification: note(
          "Moderate-to-severe atopic dermatitis inadequately controlled on topical therapy. Dosing: 600 mg loading dose, then 300 mg every 2 weeks.",
        ),
        relevantHistory: note(
          "Prior therapy: medium- and high-potency topical corticosteroids and topical calcineurin inhibitor (tacrolimus) with inadequate control.",
        ),
      },
      provider: {
        name: note("Andrew Lim, MD"),
        npi: note("1982347561"),
        specialty: note("Dermatology"),
        clinicName: note("Brightwood Dermatology Associates"),
        phone: note("(555) 660-2120"),
        fax: note("(555) 660-2121"),
      },
    },
  },
  {
    id: "3",
    label: "Sample 3 · Adderall XR",
    blurb: "Blue Cross Blue Shield · ADHD",
    fileMatches: ["ins-card-3", "sample-med-note-3"],
    extracted: {
      patient: {
        firstName: note("Daniel"),
        lastName: note("Okafor"),
        dateOfBirth: note("09/30/1999"),
        sex: note("Male"),
        phone: note("(555) 631-7742"),
        address: note("318 Sherman Street, Unit 4, Evanston, IL 60202"),
      },
      insurance: {
        payerName: card("Blue Cross Blue Shield"),
        // Plan type isn't printed on this (barebones) card — it comes from the note.
        planName: note("Blue Advantage PPO"),
        memberId: card("XYH901447632"),
        groupNumber: card("100214"),
        rxBin: card("003858"),
        rxPcn: card("A4"),
      },
      clinical: {
        primaryDiagnosis: note("Attention-deficit/hyperactivity disorder, combined type"),
        icd10Code: note("F90.2"),
        requestType: reqType("medication"),
        requestedService: note(
          "Adderall XR (dextroamphetamine-amphetamine ER) 20 mg capsule, once daily",
        ),
        requestedCptCode: none(),
        directions: note("Take 1 capsule (20 mg) by mouth every morning"),
        strength: note("20 mg"),
        frequency: note("Once daily"),
        quantity: note("30 capsules"),
        daysSupply: note("30 days"),
        lengthOfTherapy: note("12 months (chronic)"),
        clinicalJustification: note(
          "ADHD combined type confirmed by clinical interview and validated rating scales. Inadequate response to atomoxetine and methylphenidate ER. Schedule II — no refills.",
        ),
        relevantHistory: note(
          "Prior trials: Strattera (atomoxetine) 80 mg daily x10 weeks (inadequate); Concerta (methylphenidate ER) 54 mg daily x8 weeks (discontinued for side effects).",
        ),
      },
      provider: {
        name: note("Allison Reyes, MD"),
        npi: note("1326754980"),
        specialty: note("Psychiatry"),
        clinicName: note("Northgate Behavioral Health & Psychiatry"),
        phone: note("(555) 905-1180"),
        fax: note("(555) 905-1181"),
      },
    },
  },
];

/** Look up a sample by its explicit demo id. */
export function getDemoById(id: string | null | undefined): DemoSample | undefined {
  if (!id) return undefined;
  return DEMO_SAMPLES.find((s) => s.id === id);
}

/** Match an uploaded set of filenames to a known sample (by filename fragment). */
export function findDemoByFilenames(names: string[]): DemoSample | undefined {
  const lower = names.map((n) => n.toLowerCase());
  return DEMO_SAMPLES.find((s) =>
    s.fileMatches.some((frag) => lower.some((n) => n.includes(frag))),
  );
}
