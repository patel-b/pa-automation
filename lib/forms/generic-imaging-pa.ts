import type { FormTemplate } from "./types";
import { SEX_OPTIONS, PAYER_OPTIONS } from "./suggestions";

/**
 * Seeded SYNTHETIC imaging / procedure prior-authorization form.
 *
 * Fabricated for the demo. Covers advanced imaging (MRI/CT/PET) and procedures,
 * which ask for a CPT code rather than a medication name.
 */
export const genericImagingPA: FormTemplate = {
  id: "generic-imaging-pa",
  title: "Imaging / Procedure Prior Authorization Request (Generic)",
  payerLabel: "Generic / Any payer",
  payerMatchers: [],
  requestTypes: ["imaging", "procedure"],
  sections: [
    {
      title: "Patient Information",
      fields: [
        { key: "patientFirstName", label: "Patient First Name", type: "text", required: true, fromExtracted: (d) => d.patient.firstName },
        { key: "patientLastName", label: "Patient Last Name", type: "text", required: true, fromExtracted: (d) => d.patient.lastName },
        { key: "patientDob", label: "Date of Birth", type: "date", required: true, fromExtracted: (d) => d.patient.dateOfBirth },
        { key: "patientSex", label: "Sex", type: "select", options: SEX_OPTIONS, fromExtracted: (d) => d.patient.sex },
        { key: "patientPhone", label: "Phone", type: "tel", fromExtracted: (d) => d.patient.phone },
      ],
    },
    {
      title: "Insurance Information",
      fields: [
        { key: "payerName", label: "Insurance / Payer", type: "select", options: PAYER_OPTIONS, allowOther: true, required: true, fromExtracted: (d) => d.insurance.payerName },
        { key: "planName", label: "Plan Name", type: "text", hint: "Specific plan on the card (optional)", fromExtracted: (d) => d.insurance.planName },
        { key: "memberId", label: "Member ID", type: "text", required: true, fromExtracted: (d) => d.insurance.memberId },
        { key: "groupNumber", label: "Group Number", type: "text", fromExtracted: (d) => d.insurance.groupNumber },
      ],
    },
    {
      title: "Service Requested",
      fields: [
        { key: "requestedService", label: "Requested Imaging / Procedure", type: "text", required: true, fromExtracted: (d) => d.clinical.requestedService },
        { key: "cptCode", label: "CPT Code", type: "text", fromExtracted: (d) => d.clinical.requestedCptCode },
        { key: "primaryDiagnosis", label: "Primary Diagnosis", type: "autocomplete", suggest: "diagnoses", linkedField: "icd10Code", required: true, hint: "Picking a diagnosis fills the ICD-10 code", fromExtracted: (d) => d.clinical.primaryDiagnosis },
        { key: "icd10Code", label: "ICD-10 Code", type: "text", hint: "Auto-filled from the diagnosis", fromExtracted: (d) => d.clinical.icd10Code },
        { key: "clinicalJustification", label: "Clinical Justification / Medical Necessity", type: "textarea", required: true, fromExtracted: (d) => d.clinical.clinicalJustification },
        { key: "relevantHistory", label: "Relevant History / Prior Imaging or Treatment", type: "textarea", fromExtracted: (d) => d.clinical.relevantHistory },
      ],
    },
    {
      title: "Ordering Provider",
      fields: [
        { key: "providerName", label: "Ordering Provider", type: "text", required: true, fromExtracted: (d) => d.provider.name },
        { key: "providerNpi", label: "NPI", type: "text", required: true, fromExtracted: (d) => d.provider.npi },
        { key: "clinicName", label: "Clinic / Practice", type: "text", fromExtracted: (d) => d.provider.clinicName },
        { key: "providerPhone", label: "Phone", type: "tel", fromExtracted: (d) => d.provider.phone },
        { key: "providerFax", label: "Fax", type: "tel", fromExtracted: (d) => d.provider.fax },
      ],
    },
  ],
};
