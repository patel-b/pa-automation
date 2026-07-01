"use client";

// =============================================================================
// MAIN WEB PAGE — this is the entire homepage users see at the site root ("/").
//
// It contains: the document drop zones, the "sample patient" buttons, the
// auto-filled prior-authorization form, and the draft preview / PDF editor.
// (Start the site locally with `npm run dev`, then open http://localhost:3000.)
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORM_TEMPLATES, fillForm } from "@/lib/forms";
import { emptyExtractedData, type Confidence } from "@/lib/schema";
import type { FilledForm, FilledField, SelectOption } from "@/lib/forms/types";
import {
  COMMON_MEDICATIONS,
  COMMON_DIAGNOSES,
  relatedDiagnoses,
} from "@/lib/forms/suggestions";
import type { ExtractResponse } from "@/lib/api-types";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import DraftEditor, { type Annotation } from "./DraftEditor";

type ValueMap = Record<string, string>;
type Suggestion = { label: string; value: string; icd10?: string };

const keyOf = (s: number, k: string) => `${s}.${k}`;

// --- input formatting helpers -------------------------------------------------

function formatDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  const mm = d.slice(0, 2);
  const dd = d.slice(2, 4);
  const yy = d.slice(4, 8);
  if (d.length > 4) return `${mm}/${dd}/${yy}`;
  if (d.length > 2) return `${mm}/${dd}`;
  return mm;
}

function normalizeDate(v: string): string {
  if (!v) return "";
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[2].padStart(2, "0")}/${iso[3].padStart(2, "0")}/${iso[1]}`;
  }
  return formatDate(v);
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (d.length > 6) return `(${a}) ${b}-${c}`;
  if (d.length >= 3) return `(${a}) ${b}`;
  if (d.length > 0) return `(${a}`;
  return "";
}

function normalizeSelect(options: SelectOption[], v: string): string {
  if (!v) return "";
  const lower = v.trim().toLowerCase();
  const opt = options.find(
    (o) =>
      o.value.toLowerCase() === lower ||
      o.label.toLowerCase() === lower ||
      o.label.toLowerCase().startsWith(lower) ||
      o.value.toLowerCase().startsWith(lower),
  );
  return opt ? opt.value : "";
}

function suggestionsFor(suggest?: "medications" | "diagnoses"): Suggestion[] {
  if (suggest === "medications")
    return COMMON_MEDICATIONS.map((m) => ({ label: m, value: m }));
  if (suggest === "diagnoses")
    return COMMON_DIAGNOSES.map((d) => ({
      label: `${d.label} (${d.icd10})`,
      value: d.label,
      icd10: d.icd10,
    }));
  return [];
}

function displayValue(f: FilledField, value: string): string {
  if (!value) return "";
  if (f.type === "select" && !f.allowOther && f.options) {
    const o = f.options.find((x) => x.value === value);
    return o ? o.label : value;
  }
  return value;
}

// --- Google Maps (optional address autocomplete) ------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
let googleMapsPromise: Promise<any> | null = null;
function loadGoogleMaps(key: string): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).google?.maps?.places)
    return Promise.resolve((window as any).google);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true;
    s.onload = () => resolve((window as any).google);
    s.onerror = () => reject(new Error("maps load failed"));
    document.head.appendChild(s);
  });
  return googleMapsPromise;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- value initialization -----------------------------------------------------

function blankForm(): FilledForm {
  return fillForm(FORM_TEMPLATES[0], emptyExtractedData());
}

function valuesFromForm(form: FilledForm): ValueMap {
  const v: ValueMap = {};
  form.sections.forEach((section, s) =>
    section.fields.forEach((f) => {
      let val = f.value ?? "";
      if (f.type === "date") val = normalizeDate(val);
      else if (f.type === "tel") val = formatPhone(val);
      else if (f.type === "select" && !f.allowOther && f.options)
        val = normalizeSelect(f.options, val);
      v[keyOf(s, f.key)] = val;
    }),
  );
  return v;
}

function findValue(form: FilledForm, values: ValueMap, key: string): string {
  for (let s = 0; s < form.sections.length; s++) {
    if (form.sections[s].fields.some((x) => x.key === key))
      return values[keyOf(s, key)] ?? "";
  }
  return "";
}

// =============================================================================

export default function Home() {
  const [filled, setFilled] = useState<FilledForm>(blankForm);
  const [values, setValues] = useState<ValueMap>(() =>
    valuesFromForm(blankForm()),
  );
  const [match, setMatch] = useState<ExtractResponse["match"] | null>(null);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [header, setHeader] = useState({ name: "New patient", dob: "" });

  const [cardFiles, setCardFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [draftPdfUrl, setDraftPdfUrl] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Generated on the client after mount — using Math.random() during the
  // initial render causes a server/client hydration mismatch.
  const [caseKey, setCaseKey] = useState("");
  useEffect(() => {
    setCaseKey("E-" + Math.floor(10000 + Math.random() * 89999));
  }, []);

  const autoNonce = useRef(0);
  const [autoTick, setAutoTick] = useState(0);

  // Apply an /api/extract response to form + header state (shared by the live
  // upload path and the demo-sample path).
  const applyResponse = useCallback((resp: ExtractResponse) => {
    setFilled(resp.filledForm);
    setValues(valuesFromForm(resp.filledForm));
    setMatch(resp.match);
    setHasExtracted(true);
    setIsDemo(Boolean(resp.demo));
    setFormVersion((v) => v + 1);
    const fn = resp.extracted.patient.firstName.value ?? "";
    const ln = resp.extracted.patient.lastName.value ?? "";
    setHeader({
      name: [fn, ln].filter(Boolean).join(" ") || "New patient",
      dob: normalizeDate(resp.extracted.patient.dateOfBirth.value ?? ""),
    });
  }, []);

  const runExtract = useCallback(async () => {
    if (cardFiles.length === 0 && docFiles.length === 0) return;
    setError(null);
    setLoading(true);
    const body = new FormData();
    cardFiles.forEach((f) => body.append("cardImages", f));
    docFiles.forEach((f) => body.append("files", f));
    try {
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      applyResponse(data as ExtractResponse);
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }, [cardFiles, docFiles, applyResponse]);

  // Load a bundled sample patient — served from canned data, no API call.
  const runDemo = useCallback(
    async (demoId: string) => {
      setError(null);
      setLoading(true);
      setCardFiles([]);
      setDocFiles([]);
      const body = new FormData();
      body.append("demoId", demoId);
      try {
        const res = await fetch("/api/extract", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong.");
          return;
        }
        applyResponse(data as ExtractResponse);
      } catch {
        setError("Network error — is the dev server running?");
      } finally {
        setLoading(false);
      }
    },
    [applyResponse],
  );

  useEffect(() => {
    if (autoTick > 0) runExtract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTick]);

  function addCardFiles(f: File[]) {
    setCardFiles((prev) => [...prev, ...f]);
    autoNonce.current += 1;
    setAutoTick(autoNonce.current);
  }
  function addDocFiles(f: File[]) {
    setDocFiles((prev) => [...prev, ...f]);
    autoNonce.current += 1;
    setAutoTick(autoNonce.current);
  }

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    filled.sections.forEach((section, s) =>
      section.fields.forEach((f) => {
        if (f.required && !values[keyOf(s, f.key)]?.trim())
          missing.push(f.label);
      }),
    );
    return missing;
  }, [filled, values]);

  const findIdByKey = useCallback(
    (key: string) => {
      for (let s = 0; s < filled.sections.length; s++) {
        if (filled.sections[s].fields.some((x) => x.key === key))
          return keyOf(s, key);
      }
      return null;
    },
    [filled],
  );

  function flatValues(): Record<string, string> {
    const o: Record<string, string> = {};
    filled.sections.forEach((section, s) =>
      section.fields.forEach((f) => {
        o[f.key] = values[keyOf(s, f.key)] ?? "";
      }),
    );
    return o;
  }

  async function handleCreateDraft() {
    if (missingRequired.length > 0) {
      setSubmitAttempted(true);
      for (let s = 0; s < filled.sections.length; s++) {
        for (const f of filled.sections[s].fields) {
          if (f.required && !values[keyOf(s, f.key)]?.trim()) {
            document
              .getElementById(keyOf(s, f.key))
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
      }
      return;
    }

    // Try to render the real payer PDF; fall back to the on-screen draft.
    setDraftLoading(true);
    setDraftPdfUrl(null);
    try {
      const res = await fetch("/api/draft-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer: findValue(filled, values, "payerName"),
          values: flatValues(),
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        setDraftPdfUrl(URL.createObjectURL(blob));
      }
    } catch {
      // ignore — fall back to the HTML draft
    } finally {
      setDraftLoading(false);
      setShowDraft(true);
    }
  }

  function closeDraft() {
    if (draftPdfUrl) URL.revokeObjectURL(draftPdfUrl);
    setDraftPdfUrl(null);
    setShowDraft(false);
  }

  if (submitted) {
    const name =
      [
        findValue(filled, values, "patientFirstName"),
        findValue(filled, values, "patientLastName"),
      ]
        .filter(Boolean)
        .join(" ") || "New patient";
    return (
      <Confirmation
        caseKey={caseKey}
        patientName={name}
        formTitle={filled.formTitle}
        medication={
          findValue(filled, values, "requestedMedication") ||
          findValue(filled, values, "requestedService")
        }
        onReset={() => window.location.reload()}
      />
    );
  }

  const selectedMedication = findValue(filled, values, "requestedMedication");

  const renderField = (s: number, f: FilledField) => {
    const id = keyOf(s, f.key);
    const val = values[id] ?? "";
    const isMissing =
      (hasExtracted || submitAttempted) && f.required && !val.trim();
    const setVal = (v: string) => setValues((prev) => ({ ...prev, [id]: v }));

    switch (f.type) {
      case "textarea":
        return (
          <textarea
            id={id}
            rows={3}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className={inputClass(isMissing)}
          />
        );
      case "date":
        return (
          <input
            id={id}
            value={val}
            inputMode="numeric"
            maxLength={10}
            placeholder="MM/DD/YYYY"
            onChange={(e) => setVal(formatDate(e.target.value))}
            className={inputClass(isMissing)}
          />
        );
      case "tel":
        return (
          <input
            id={id}
            value={val}
            inputMode="tel"
            maxLength={14}
            placeholder="(XXX) XXX-XXXX"
            onChange={(e) => setVal(formatPhone(e.target.value))}
            className={inputClass(isMissing)}
          />
        );
      case "address":
        return (
          <AddressField
            id={id}
            value={val}
            onChange={setVal}
            isMissing={isMissing}
          />
        );
      case "select":
        if (f.allowOther && f.options)
          return (
            <PayerField
              id={id}
              value={val}
              options={f.options}
              onChange={setVal}
              isMissing={isMissing}
            />
          );
        return (
          <select
            id={id}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className={selectClass(isMissing)}
          >
            <option value="">—</option>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "autocomplete":
        return (
          <Autocomplete
            id={id}
            value={val}
            placeholder={
              f.suggest === "medications"
                ? "Start typing a medication…"
                : "Start typing a diagnosis…"
            }
            options={suggestionsFor(f.suggest)}
            prioritize={
              f.suggest === "diagnoses"
                ? relatedDiagnoses(selectedMedication)
                : undefined
            }
            onChange={setVal}
            onSelect={(opt) =>
              setValues((prev) => {
                const next = { ...prev, [id]: opt.value };
                if (f.linkedField && opt.icd10) {
                  const lid = findIdByKey(f.linkedField);
                  if (lid) next[lid] = opt.icd10;
                }
                return next;
              })
            }
            className={inputClass(isMissing)}
          />
        );
      default:
        return (
          <input
            id={id}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className={inputClass(isMissing)}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Case header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-bold text-gray-900">{header.name}</h1>
          <span className="text-xs text-gray-400">
            CASE KEY{" "}
            <span className="font-semibold text-gray-600">{caseKey}</span>
          </span>
          {header.dob && (
            <span className="text-xs text-gray-400">
              DOB{" "}
              <span className="font-semibold text-gray-600">{header.dob}</span>
            </span>
          )}
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {hasExtracted ? "Draft · not sent to plan" : "New request"}
        </span>
      </div>

      {/* Step 1 — drop zones */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2">
          <StepDot n={1} />
          <h2 className="text-sm font-semibold text-gray-900">
            Drop in the patient&apos;s documents
          </h2>
        </div>
        <p className="mb-4 ml-7 text-xs text-gray-500">
          Drag &amp; drop the insurance card and the prescription / clinical
          notes. The prior authorization form below fills in automatically.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <DropZone
            label="Insurance card"
            hint="PNG or JPG photo / scan"
            accept="image/png,image/jpeg,image/webp"
            icon={<CardIcon />}
            files={cardFiles}
            onFiles={addCardFiles}
            onRemove={(i) =>
              setCardFiles((p) => p.filter((_, idx) => idx !== i))
            }
          />
          <DropZone
            label="Prescription & clinical notes"
            hint="PDF, Word .docx, or .txt"
            accept="application/pdf,.pdf,.docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            icon={<DocIcon />}
            files={docFiles}
            onFiles={addDocFiles}
            onRemove={(i) => setDocFiles((p) => p.filter((_, idx) => idx !== i))}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={runExtract}
            disabled={
              loading || (cardFiles.length === 0 && docFiles.length === 0)
            }
            className="rounded-full bg-[#e0006d] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#c4005f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Reading documents…" : "Auto-fill form ↓"}
          </button>
          {loading && (
            <span className="flex items-center gap-2 text-xs text-gray-500">
              <Spinner /> Extracting fields with Claude…
            </span>
          )}
          {hasExtracted && !loading && (
            <span className="text-xs font-medium text-green-600">
              ✓ Form auto-filled — review below
            </span>
          )}
        </div>

        {/* Sample patients — one click loads a canned result, no API call. */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs text-gray-500">
            No documents handy? Try a sample patient — loads instantly, no API
            call:
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_SAMPLES.map((d) => (
              <button
                key={d.id}
                onClick={() => runDemo(d.id)}
                disabled={loading}
                title={d.blurb}
                className="rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-[#e0006d] hover:text-[#e0006d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      {/* Matched form banner */}
      {match && (
        <div className="rounded-xl border border-[#f7c5dd] bg-[#fdeef5] p-4">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#a1004f]">
              Form selected
            </p>
            {isDemo && (
              <span className="rounded-full bg-[#a1004f] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Sample · no API call
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {match.formTitle}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">{match.reason}</p>
        </div>
      )}

      {/* Step 2 — the PA form */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <StepDot n={2} />
          <h2 className="text-sm font-semibold text-gray-900">
            Prior authorization form
          </h2>
          {!hasExtracted && (
            <span className="text-xs text-gray-400">
              (drop documents above, or fill in by hand)
            </span>
          )}
        </div>

        <div className="space-y-7">
          {filled.sections.map((section, s) => (
            <div key={s}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                {section.title}
              </h3>
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                {section.fields.map((f) => {
                  const id = keyOf(s, f.key);
                  const fullWidth = f.type === "textarea" || f.fullWidth;
                  return (
                    <div
                      key={`${formVersion}-${id}`}
                      className={fullWidth ? "sm:col-span-2" : ""}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <label
                          htmlFor={id}
                          className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
                        >
                          {f.label}
                          {f.required && (
                            <span className="text-[#e0006d]"> *</span>
                          )}
                        </label>
                        {hasExtracted && (
                          <ConfidenceBadge
                            confidence={f.confidence}
                            source={f.source}
                            hasValue={!!values[id]?.trim()}
                          />
                        )}
                      </div>
                      {renderField(s, f)}
                      {f.hint && (
                        <p className="mt-1 text-[10px] text-gray-400">
                          {f.hint}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <span className="text-xs text-gray-500">
          Fill in the form (or auto-fill from documents), then create a draft to
          preview it.
          {(submitAttempted || hasExtracted) && missingRequired.length > 0 && (
            <span className="ml-1 text-amber-600">
              {missingRequired.length} required field
              {missingRequired.length > 1 ? "s" : ""} still empty.
            </span>
          )}
        </span>
        <button
          onClick={handleCreateDraft}
          disabled={draftLoading}
          className="rounded-full bg-[#e0006d] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c4005f] disabled:opacity-60"
        >
          {draftLoading ? "Building draft…" : "Create draft →"}
        </button>
      </div>

      {showDraft && (
        <DraftModal
          form={filled}
          values={values}
          flat={flatValues()}
          caseKey={caseKey}
          payer={findValue(filled, values, "payerName")}
          pdfUrl={draftPdfUrl}
          onClose={closeDraft}
          onSubmit={() => {
            closeDraft();
            setSubmitted(true);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AddressField({
  id,
  value,
  onChange,
  isMissing,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  isMissing: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !ref.current) return;
    let cancelled = false;
    loadGoogleMaps(key)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((g: any) => {
        if (cancelled || !g?.maps?.places || !ref.current) return;
        const ac = new g.maps.places.Autocomplete(ref.current, {
          types: ["address"],
          fields: ["formatted_address"],
        });
        ac.addListener("place_changed", () => {
          const p = ac.getPlace();
          if (p?.formatted_address) onChange(p.formatted_address);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={ref}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Street, city, state, ZIP"
      className={inputClass(isMissing)}
    />
  );
}

function PayerField({
  id,
  value,
  options,
  onChange,
  isMissing,
}: {
  id: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  isMissing: boolean;
}) {
  const matched = matchPayer(value, options);
  const [sel, setSel] = useState(
    matched ? matched.value : value ? "__other__" : "",
  );
  const [other, setOther] = useState(matched ? "" : value);

  return (
    <div>
      <select
        id={id}
        value={sel}
        onChange={(e) => {
          const nv = e.target.value;
          setSel(nv);
          onChange(nv === "__other__" ? other : nv);
        }}
        className={selectClass(isMissing)}
      >
        <option value="">Select payer…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="__other__">Other…</option>
      </select>
      {sel === "__other__" && (
        <input
          value={other}
          placeholder="Enter insurance / payer name"
          onChange={(e) => {
            setOther(e.target.value);
            onChange(e.target.value);
          }}
          className={`${inputClass(isMissing)} mt-2`}
        />
      )}
    </div>
  );
}

function matchPayer(value: string, options: SelectOption[]) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return (
    options.find((o) => {
      const ol = o.value.toLowerCase();
      return ol === v || v.includes(ol) || ol.includes(v);
    }) ?? null
  );
}

function Autocomplete({
  id,
  value,
  options,
  onChange,
  onSelect,
  className,
  placeholder,
  prioritize,
}: {
  id: string;
  value: string;
  options: Suggestion[];
  onChange: (v: string) => void;
  onSelect: (opt: Suggestion) => void;
  className: string;
  placeholder?: string;
  prioritize?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const pr =
    prioritize && prioritize.length
      ? new Set(prioritize.map((x) => x.toLowerCase()))
      : null;
  let pool =
    q.length === 0
      ? options.slice()
      : options.filter((o) => o.label.toLowerCase().includes(q));
  if (pr) {
    pool = [...pool].sort(
      (a, b) =>
        (pr.has(b.value.toLowerCase()) ? 1 : 0) -
        (pr.has(a.value.toLowerCase()) ? 1 : 0),
    );
  }
  const matches = pool.slice(0, 8);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(o: Suggestion) {
    onSelect(o);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (open && matches[hi]) {
              e.preventDefault();
              pick(matches[hi]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {matches.map((o, i) => (
            <li
              key={o.value + i}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setHi(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                i === hi ? "bg-[#fdeef5] text-[#a1004f]" : "text-gray-700"
              }`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftModal({
  form,
  values,
  flat,
  caseKey,
  payer,
  pdfUrl,
  onClose,
  onSubmit,
}: {
  form: FilledForm;
  values: ValueMap;
  flat: Record<string, string>;
  caseKey: string;
  payer: string;
  pdfUrl: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Download the draft with any manual annotations baked into the PDF.
  async function downloadFinal() {
    let url = pdfUrl;
    if (annotations.length > 0) {
      try {
        const res = await fetch("/api/draft-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payer, values: flat, annotations }),
        });
        if (res.ok) url = URL.createObjectURL(await res.blob());
      } catch {
        /* fall back to the un-annotated draft */
      }
    }
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "pa-draft.pdf";
    a.click();
  }

  // When we have a real payer PDF, show that; otherwise the on-screen document.
  if (pdfUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-[#a1004f]">
              Draft preview · {payer} prior authorization form
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Close draft"
            >
              ✕
            </button>
          </div>
          <DraftEditor
            pdfUrl={pdfUrl}
            annotations={annotations}
            setAnnotations={setAnnotations}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-3">
            <button
              onClick={downloadFinal}
              className="text-xs font-medium text-[#a1004f] hover:underline"
            >
              ↓ Download PDF
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Back to edit
              </button>
              <button
                onClick={onSubmit}
                className="rounded-full bg-[#e0006d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#c4005f]"
              >
                Submit PA form
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 h-fit w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-white px-6 py-3">
          <span className="text-xs font-bold uppercase tracking-wide text-[#a1004f]">
            Draft preview · scroll down to submit
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close draft"
          >
            ✕
          </button>
        </div>

        <div className="px-8 py-6">
          {/* Document-style header, like a payer PA form */}
          <div className="mb-6 border-b-2 border-gray-800 pb-4">
            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900">
              Prior Authorization Request
            </h2>
            <p className="mt-1 text-sm text-gray-600">{form.formTitle}</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              <span>
                Payer:{" "}
                <b className="text-gray-700">{payer || "—"}</b>
              </span>
              <span>
                Case Key: <b className="text-gray-700">{caseKey}</b>
              </span>
              <span>
                Date:{" "}
                <b className="text-gray-700">
                  {new Date().toLocaleDateString()}
                </b>
              </span>
            </div>
          </div>

          {form.sections.map((section, s) => (
            <div key={s} className="mb-6">
              <h3 className="mb-3 border-b border-gray-300 pb-1 text-sm font-bold text-gray-800">
                {section.title}
              </h3>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
                {section.fields.map((f) => {
                  const v = displayValue(f, values[keyOf(s, f.key)] ?? "");
                  return (
                    <div
                      key={f.key}
                      className={f.type === "textarea" ? "col-span-2" : ""}
                    >
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 min-h-[20px] border-b border-dotted border-gray-300 pb-1 text-sm text-gray-900">
                        {v || <span className="text-gray-300">—</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}

          <div className="mt-8 border-t border-gray-200 pt-5 text-center">
            <p className="mx-auto mb-4 max-w-md text-xs text-gray-500">
              Confirm the information above is accurate. This is a demo —
              submitting won&apos;t transmit to a real payer.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={onClose}
                className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Back to edit
              </button>
              <button
                onClick={onSubmit}
                className="rounded-full bg-[#e0006d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#c4005f]"
              >
                Submit PA form
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropZone({
  label,
  hint,
  accept,
  icon,
  files,
  onFiles,
  onRemove,
}: {
  label: string;
  hint: string;
  accept: string;
  icon: React.ReactNode;
  files: File[];
  onFiles: (f: File[]) => void;
  onRemove: (i: number) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && inputRef.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = Array.from(e.dataTransfer.files);
          if (f.length) onFiles(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          drag
            ? "border-[#e0006d] bg-[#fdeef5]"
            : "border-gray-300 bg-gray-50 hover:border-[#e0006d] hover:bg-[#fdeef5]/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <div className="mb-2 text-gray-400">{icon}</div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Drag &amp; drop or click to browse
        </p>
        <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600"
            >
              <span className="truncate">📎 {f.name}</span>
              <button
                onClick={() => onRemove(i)}
                className="ml-2 shrink-0 text-gray-400 hover:text-red-500"
                aria-label="Remove file"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function inputClass(isMissing: boolean) {
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${
    isMissing
      ? "border-amber-300 bg-amber-50 focus:border-amber-500 focus:ring-amber-500"
      : "border-gray-300 focus:border-[#e0006d] focus:ring-[#e0006d]"
  }`;
}

/** Selects need an explicit min-height so they match the text inputs. */
function selectClass(isMissing: boolean) {
  return `${inputClass(isMissing)} h-[42px]`;
}

function ConfidenceBadge({
  confidence,
  source,
  hasValue,
}: {
  confidence: Confidence;
  source: string;
  hasValue: boolean;
}) {
  if (!hasValue) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
        not found
      </span>
    );
  }
  const styles: Record<Confidence, string> = {
    high: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-orange-100 text-orange-700",
  };
  return (
    <span
      title={`Source: ${source}`}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[confidence]}`}
    >
      {confidence}
    </span>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e0006d] text-[11px] font-bold text-white">
      {n}
    </span>
  );
}

function Spinner() {
  return (
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-[#e0006d]" />
  );
}

function CardIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14h5" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 2.5h7l5 5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
      <path d="M13 2.5V8h5" />
      <path d="M8.5 13h7M8.5 16.5h7" strokeLinecap="round" />
    </svg>
  );
}

function Confirmation({
  caseKey,
  patientName,
  formTitle,
  medication,
  onReset,
}: {
  caseKey: string;
  patientName: string;
  formTitle: string;
  medication: string;
  onReset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-8 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
        ✓
      </div>
      <h1 className="text-2xl font-bold text-gray-900">PA form submitted</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        In production this would be transmitted to the payer. For this demo the
        reviewed request is confirmed below.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-left">
        <dl className="space-y-3 text-sm">
          <Row label="Case key" value={caseKey} />
          <Row label="Patient" value={patientName} />
          <Row label="Form" value={formTitle} />
          {medication && <Row label="Requested" value={medication} />}
          <Row label="Status" value="Submitted (demo)" />
        </dl>
      </div>

      <button
        onClick={onReset}
        className="mt-6 rounded-full bg-[#e0006d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#c4005f]"
      >
        Start a new request
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}
