import type { SelectOption } from "./types";

/** Sex dropdown options. Extraction is normalized to one of these values. */
export const SEX_OPTIONS: SelectOption[] = [
  { label: "Male (M)", value: "M" },
  { label: "Female (F)", value: "F" },
];

/**
 * Most common US payers for the insurance dropdown. The form also offers
 * "Other" (handled in the UI) with a free-text box.
 */
export const PAYER_OPTIONS: SelectOption[] = [
  { label: "UnitedHealthcare", value: "UnitedHealthcare" },
  { label: "Aetna", value: "Aetna" },
  { label: "Cigna", value: "Cigna" },
  { label: "Blue Cross Blue Shield", value: "Blue Cross Blue Shield" },
  { label: "Anthem (Elevance Health)", value: "Anthem" },
  { label: "Humana", value: "Humana" },
  { label: "Kaiser Permanente", value: "Kaiser Permanente" },
  { label: "Centene", value: "Centene" },
  { label: "Molina Healthcare", value: "Molina Healthcare" },
  { label: "MVP Health Care", value: "MVP" },
  { label: "Fidelis Care", value: "Fidelis" },
  { label: "Medicare", value: "Medicare" },
  { label: "Medicaid (NY / NYRx)", value: "Medicaid" },
  { label: "Tricare", value: "Tricare" },
];

/**
 * Curated list of commonly prior-authorized medications (brand + generic),
 * for the requested-medication type-ahead. Not exhaustive — a demo aid.
 */
export const COMMON_MEDICATIONS: string[] = [
  "Humira (adalimumab)",
  "Enbrel (etanercept)",
  "Stelara (ustekinumab)",
  "Cosentyx (secukinumab)",
  "Skyrizi (risankizumab)",
  "Rinvoq (upadacitinib)",
  "Otezla (apremilast)",
  "Taltz (ixekizumab)",
  "Tremfya (guselkumab)",
  "Xeljanz (tofacitinib)",
  "Dupixent (dupilumab)",
  "Ozempic (semaglutide)",
  "Wegovy (semaglutide)",
  "Mounjaro (tirzepatide)",
  "Zepbound (tirzepatide)",
  "Trulicity (dulaglutide)",
  "Jardiance (empagliflozin)",
  "Farxiga (dapagliflozin)",
  "Eliquis (apixaban)",
  "Xarelto (rivaroxaban)",
  "Entresto (sacubitril/valsartan)",
  "Repatha (evolocumab)",
  "Praluent (alirocumab)",
  "Trikafta (elexacaftor/tezacaftor/ivacaftor)",
  "Biktarvy (bictegravir/emtricitabine/tenofovir)",
  "Keytruda (pembrolizumab)",
  "Ibrance (palbociclib)",
  "Ocrevus (ocrelizumab)",
  "Tysabri (natalizumab)",
  "Vyvanse (lisdexamfetamine)",
  "Adderall XR (amphetamine salts)",
  "Nurtec ODT (rimegepant)",
  "Ajovy (fremanezumab)",
  "Emgality (galcanezumab)",
  "Aimovig (erenumab)",
  "Vraylar (cariprazine)",
  "Latuda (lurasidone)",
  "Trintellix (vortioxetine)",
  "Symbicort (budesonide/formoterol)",
  "Trelegy Ellipta (fluticasone/umeclidinium/vilanterol)",
  "Breo Ellipta (fluticasone/vilanterol)",
  "Botox (onabotulinumtoxinA)",
  "Saxenda (liraglutide)",
  "Jakafi (ruxolitinib)",
  "Veozah (fezolinetant)",
];

export interface DiagnosisOption {
  label: string;
  icd10: string;
}

/**
 * Common diagnoses paired with their ICD-10 code. Picking a diagnosis in the
 * UI auto-fills the ICD-10 field, so the user never has to know the code.
 */
export const COMMON_DIAGNOSES: DiagnosisOption[] = [
  { label: "Rheumatoid arthritis", icd10: "M06.9" },
  { label: "Psoriasis", icd10: "L40.9" },
  { label: "Plaque psoriasis", icd10: "L40.0" },
  { label: "Psoriatic arthritis", icd10: "L40.50" },
  { label: "Ankylosing spondylitis", icd10: "M45.9" },
  { label: "Crohn's disease", icd10: "K50.90" },
  { label: "Ulcerative colitis", icd10: "K51.90" },
  { label: "Atopic dermatitis (eczema)", icd10: "L20.9" },
  { label: "Asthma, moderate persistent", icd10: "J45.40" },
  { label: "Asthma, unspecified", icd10: "J45.909" },
  { label: "COPD", icd10: "J44.9" },
  { label: "Type 2 diabetes mellitus", icd10: "E11.9" },
  { label: "Type 1 diabetes mellitus", icd10: "E10.9" },
  { label: "Obesity, unspecified", icd10: "E66.9" },
  { label: "Morbid (severe) obesity", icd10: "E66.01" },
  { label: "Atrial fibrillation", icd10: "I48.91" },
  { label: "Heart failure, unspecified", icd10: "I50.9" },
  { label: "Hyperlipidemia", icd10: "E78.5" },
  { label: "Chronic migraine", icd10: "G43.709" },
  { label: "Migraine, intractable", icd10: "G43.711" },
  { label: "Multiple sclerosis", icd10: "G35" },
  { label: "HIV disease", icd10: "B20" },
  { label: "Chronic hepatitis C", icd10: "B18.2" },
  { label: "Major depressive disorder, recurrent", icd10: "F33.9" },
  { label: "Bipolar disorder", icd10: "F31.9" },
  { label: "Schizophrenia", icd10: "F20.9" },
  { label: "ADHD", icd10: "F90.9" },
  { label: "Breast cancer", icd10: "C50.919" },
  { label: "Prostate cancer", icd10: "C61" },
  { label: "Osteoporosis", icd10: "M81.0" },
  { label: "Cystic fibrosis", icd10: "E84.9" },
  { label: "Chronic kidney disease", icd10: "N18.9" },
];

/**
 * Maps a medication (by brand-name fragment) to the diagnoses it's most likely
 * prescribed for. Used to bias the diagnosis type-ahead so, e.g., picking
 * Wegovy surfaces obesity/diabetes rather than arthritis. Diagnosis strings
 * must exactly match labels in COMMON_DIAGNOSES.
 */
export const MEDICATION_DIAGNOSES: { match: string[]; diagnoses: string[] }[] = [
  { match: ["wegovy", "saxenda", "zepbound"], diagnoses: ["Morbid (severe) obesity", "Obesity, unspecified", "Type 2 diabetes mellitus"] },
  { match: ["ozempic", "mounjaro", "trulicity", "jardiance", "farxiga", "victoza"], diagnoses: ["Type 2 diabetes mellitus", "Obesity, unspecified"] },
  { match: ["humira", "enbrel", "stelara", "cosentyx", "skyrizi", "rinvoq", "otezla", "taltz", "tremfya", "xeljanz"], diagnoses: ["Rheumatoid arthritis", "Psoriatic arthritis", "Plaque psoriasis", "Psoriasis", "Ankylosing spondylitis", "Crohn's disease", "Ulcerative colitis"] },
  { match: ["dupixent"], diagnoses: ["Atopic dermatitis (eczema)", "Asthma, moderate persistent"] },
  { match: ["repatha", "praluent"], diagnoses: ["Hyperlipidemia"] },
  { match: ["eliquis", "xarelto"], diagnoses: ["Atrial fibrillation"] },
  { match: ["entresto"], diagnoses: ["Heart failure, unspecified"] },
  { match: ["trikafta"], diagnoses: ["Cystic fibrosis"] },
  { match: ["biktarvy"], diagnoses: ["HIV disease"] },
  { match: ["keytruda", "ibrance"], diagnoses: ["Breast cancer", "Prostate cancer"] },
  { match: ["ocrevus", "tysabri"], diagnoses: ["Multiple sclerosis"] },
  { match: ["nurtec", "ajovy", "emgality", "aimovig", "botox"], diagnoses: ["Chronic migraine", "Migraine, intractable"] },
  { match: ["vyvanse", "adderall"], diagnoses: ["ADHD"] },
  { match: ["vraylar", "latuda"], diagnoses: ["Bipolar disorder", "Schizophrenia"] },
  { match: ["trintellix"], diagnoses: ["Major depressive disorder, recurrent"] },
  { match: ["symbicort", "trelegy", "breo"], diagnoses: ["Asthma, moderate persistent", "COPD"] },
];

/** Diagnoses most associated with the given medication (empty if none known). */
export function relatedDiagnoses(medication: string): string[] {
  if (!medication) return [];
  const m = medication.toLowerCase();
  for (const entry of MEDICATION_DIAGNOSES) {
    if (entry.match.some((k) => m.includes(k))) return entry.diagnoses;
  }
  return [];
}
