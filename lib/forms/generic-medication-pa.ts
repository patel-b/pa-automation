import type { FormTemplate } from "./types";
import { SEX_OPTIONS, PAYER_OPTIONS } from "./suggestions";

/**
 * Seeded SYNTHETIC medication prior-authorization form.
 *
 * Field set mirrors what a typical payer pharmacy PA asks for, but the form
 * itself is fabricated for the demo (no real payer's copyrighted layout).
 * Replace / supplement this with a real payer form once a PDF is provided.
 */
export const genericMedicationPA: FormTemplate = {
  id: "generic-medication-pa",
  title: "Medication Prior Authorization Request (Generic)",
  payerLabel: "Generic / Any payer",
  payerMatchers: [], // fallback — applies to any payer
  requestTypes: ["medication"],
  sections: [
    {
      title: "Patient Information",
      fields: [
        { key: "patientFirstName", label: "Patient First Name", type: "text", required: true, fromExtracted: (d) => d.patient.firstName },
        { key: "patientLastName", label: "Patient Last Name", type: "text", required: true, fromExtracted: (d) => d.patient.lastName },
        { key: "patientDob", label: "Date of Birth", type: "date", required: true, fromExtracted: (d) => d.patient.dateOfBirth },
        { key: "patientSex", label: "Sex", type: "select", options: SEX_OPTIONS, fromExtracted: (d) => d.patient.sex },
        { key: "patientPhone", label: "Phone", type: "tel", fromExtracted: (d) => d.patient.phone },
        { key: "patientAddress", label: "Address", type: "address", fullWidth: true, fromExtracted: (d) => d.patient.address },
      ],
    },
    {
      title: "Insurance Information",
      fields: [
        { key: "payerName", label: "Insurance / Payer", type: "select", options: PAYER_OPTIONS, allowOther: true, required: true, fromExtracted: (d) => d.insurance.payerName },
        { key: "planName", label: "Plan Name", type: "text", hint: "Specific plan on the card (optional)", fromExtracted: (d) => d.insurance.planName },
        { key: "memberId", label: "Member ID", type: "text", required: true, fromExtracted: (d) => d.insurance.memberId },
        { key: "groupNumber", label: "Group Number", type: "text", fromExtracted: (d) => d.insurance.groupNumber },
        { key: "rxBin", label: "Rx BIN", type: "text", fromExtracted: (d) => d.insurance.rxBin },
        { key: "rxPcn", label: "Rx PCN", type: "text", fromExtracted: (d) => d.insurance.rxPcn },
      ],
    },
    {
      title: "Medication Requested",
      fields: [
        { key: "requestedMedication", label: "Requested Medication", type: "autocomplete", suggest: "medications", required: true, hint: "Start typing a drug name to search", fromExtracted: (d) => d.clinical.requestedService },
        { key: "directions", label: "Directions for Use (Sig)", type: "text", fullWidth: true, hint: "e.g. Inject 0.25 mg subcutaneously once weekly", fromExtracted: (d) => d.clinical.directions },
        { key: "strength", label: "Strength", type: "text", hint: "e.g. 300 mg/2 mL", fromExtracted: (d) => d.clinical.strength },
        { key: "frequency", label: "Frequency", type: "text", hint: "e.g. 1 injection every 2 weeks", fromExtracted: (d) => d.clinical.frequency },
        { key: "quantity", label: "Quantity", type: "text", hint: "e.g. 1 carton (2 pens)", fromExtracted: (d) => d.clinical.quantity },
        { key: "daysSupply", label: "Days Supply", type: "text", hint: "e.g. 28 days", fromExtracted: (d) => d.clinical.daysSupply },
        { key: "lengthOfTherapy", label: "Expected Length of Therapy", type: "text", hint: "e.g. 12 months / chronic", fromExtracted: (d) => d.clinical.lengthOfTherapy },
        { key: "primaryDiagnosis", label: "Primary Diagnosis", type: "autocomplete", suggest: "diagnoses", linkedField: "icd10Code", required: true, hint: "Picking a diagnosis fills the ICD-10 code", fromExtracted: (d) => d.clinical.primaryDiagnosis },
        { key: "icd10Code", label: "ICD-10 Code", type: "text", hint: "Auto-filled from the diagnosis", fromExtracted: (d) => d.clinical.icd10Code },
        { key: "clinicalJustification", label: "Clinical Justification / Medical Necessity", type: "textarea", required: true, fromExtracted: (d) => d.clinical.clinicalJustification },
        { key: "relevantHistory", label: "Relevant History / Prior Therapies Tried", type: "textarea", fromExtracted: (d) => d.clinical.relevantHistory },
      ],
    },
    {
      title: "Prescriber Information",
      fields: [
        { key: "providerName", label: "Prescriber Name", type: "text", required: true, fromExtracted: (d) => d.provider.name },
        { key: "providerNpi", label: "NPI", type: "text", required: true, fromExtracted: (d) => d.provider.npi },
        { key: "providerSpecialty", label: "Specialty", type: "text", fromExtracted: (d) => d.provider.specialty },
        { key: "clinicName", label: "Clinic / Practice", type: "text", fromExtracted: (d) => d.provider.clinicName },
        { key: "providerPhone", label: "Phone", type: "tel", fromExtracted: (d) => d.provider.phone },
        { key: "providerFax", label: "Fax", type: "tel", fromExtracted: (d) => d.provider.fax },
      ],
    },
  ],
};
