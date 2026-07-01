# PA Automation Center — Prior Authorization Automation (MVP demo)

A demo web app that streamlines prior authorization (PA): paste or upload a
patient's medical notes and insurance card, and it will

1. **read** the documents + card (with Claude),
2. **extract** structured patient / insurance / clinical fields,
3. **pick** the right PA form based on the insurance and request type,
4. **auto-fill** that form, and
5. let a human **review, correct, and approve** it — ending in an on-screen
   reviewed summary.

**🔗 Live demo:** _add your Vercel URL here after deploying_ · **Tech:** Next.js 16
(App Router) · React 19 · TypeScript · Tailwind · Anthropic API · pdf-lib · pdf.js

> ⚠️ **Demo only. Use synthetic / fake data.** There is no authentication,
> database, or HIPAA-compliant hosting here. Do not enter real patient
> information (PHI).

---

## Prerequisites

- **Node.js 18.18+** (works on current LTS / Node 20+).
- An **Anthropic API key** for the extraction step.
  Get one at <https://console.anthropic.com/>.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
cp .env.local.example .env.local
#    then open .env.local and paste your key after ANTHROPIC_API_KEY=

# 3. Start the app
npm run dev
```

Then open <http://localhost:3000>.

> By default the app uses **Claude Opus 4.8** for extraction. To use a different
> model, set `ANTHROPIC_MODEL` in `.env.local` (e.g. `claude-sonnet-4-6`).

## Try it — no API key needed (Demo Mode)

The fastest way to see the whole flow: under the upload tiles, click a
**sample patient** button (Wegovy · Dupixent · Adderall XR). Each loads a
realistic, fully synthetic case and auto-fills the matching payer's PA form
**instantly — with zero API calls** (the results are pre-computed). Then click
**Create draft** to see the data overlaid on that payer's real PA form.

Each sample pairs a synthetic insurance card with a matching clinical document
in [`data/sample-patients/`](data/sample-patients/):

| Sample | Insurance card | Clinical doc | Payer / drug |
| --- | --- | --- | --- |
| 1 | `ins-card-1.png` | `sample-med-note-1.pdf` | UnitedHealthcare · Wegovy |
| 2 | `ins-card-2.png` | `sample-med-note-2.pdf` | Aetna · Dupixent |
| 3 | `ins-card-3.png` | `sample-med-note-3.pdf` | Blue Cross Blue Shield · Adderall XR |

You can also **drag the files onto the tiles** (the app recognizes the sample
files and serves the canned result), or upload your **own** documents to run a
real Claude extraction (requires an API key — see below).

### Demo Mode & cost control

Live extraction calls the Anthropic API (a few cents each). For a public
deployment that should never run up a bill:

- The sample-patient buttons make **no API calls**, so anonymous traffic is free.
- Set `DEMO_ONLY=1` to **disable live uploads entirely** — only the bundled
  samples run. Pair with a spend cap in the Anthropic console for a hard ceiling.

---

## How it works

```
Single page (app/page.tsx)
   │  drag-drop: insurance card + Rx/clinical notes
   ▼
POST /api/extract (app/api/extract/route.ts)
   ├─ lib/parse.ts     PDF/.docx → text; card image → base64 for vision
   ├─ lib/claude.ts    Claude extracts structured fields (structured outputs)
   └─ lib/forms/       match the right PA form + auto-fill it
   ▼
   the PA form on the same page auto-populates (editable, with confidence
   badges) → Create draft (PA-format preview) → Submit PA form → confirmation
```

The form can also be filled in entirely by hand. Smart fields: masked DOB /
phone, sex & payer dropdowns, medication & diagnosis type-aheads (diagnosis
auto-fills the ICD-10 code, and suggestions are biased by the chosen drug).
Address autocomplete is optional — set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to
enable Google Places suggestions; otherwise it's a normal field.

### Where's what — a guide to the files

New to the project? Read the files in roughly this order. (In a Next.js app,
some filenames are fixed by the framework — `page.tsx` is always the page,
`layout.tsx` the shell, `route.ts` a backend endpoint — so the folder they live
in tells you their job.)

**The website you see (front-end)**

| File | What it does |
| --- | --- |
| `app/page.tsx` | 🏠 **The whole homepage** — drop zones, sample-patient buttons, the auto-filled PA form, and the draft editor. Start here. |
| `app/layout.tsx` | The page shell: header/logo, tab title, global styles. |
| `app/DraftEditor.tsx` | Shows the filled PDF and lets you add/drag text & X marks on it (manual edits). |

**The backend (runs on the server)**

| File | What it does |
| --- | --- |
| `app/api/extract/route.ts` | Endpoint that reads uploaded docs with Claude → structured fields. |
| `app/api/draft-pdf/route.ts` | Endpoint that fills the payer's PDF form and bakes in manual edits. |
| `lib/claude.ts` | The actual Claude (AI) call that extracts the data. |
| `lib/parse.ts` | Turns uploaded PDFs / Word docs into text for Claude to read. |

**The data & rules**

| File | What it does |
| --- | --- |
| `lib/schema.ts` | The shared shape of the extracted data (patient, insurance, clinical…). |
| `lib/forms/` | The on-screen PA form fields + the logic that picks the right form. |
| `lib/pdf/templates.ts` | For each payer, which real PDF to use and where each value goes on it. |
| `lib/demo/samples.ts` | Pre-computed results for the 3 sample patients (Demo Mode — no API call). |
| `pa-forms/` | The real payer PA-form PDFs that get filled in. |
| `data/sample-patients/` | Synthetic insurance cards + clinical notes for the demo. |

**How it's launched:** `package.json` holds the commands — `npm run dev`
(local) and `npm run build` / `npm start` (production).

### Realistic draft PDFs

Clicking **Create draft** posts the form values to `/api/draft-pdf`, which loads
the matching payer's real PA-form PDF from `pa-forms/`, overlays the data at
mapped field coordinates (`pdf-lib`), and renders the result to a `<canvas>` in
the browser with **pdf.js** — so the preview displays in every browser, not just
ones with a native PDF viewer. The filled form is also downloadable.

**Mapped payer forms** (each field placed from real label coordinates, found
with `pdftotext -bbox`):

| Payer | Form |
| --- | --- |
| UnitedHealthcare | OptumRx PA form |
| Aetna | Specialty/precertification PA |
| Blue Cross Blue Shield | Empire BCBS (NY) pharmacy PA |
| Cigna | Medication PA |
| Medicare | CMS Part D coverage determination |
| Medicaid | NYRx (NY Medicaid pharmacy) |
| Fidelis | NYS Standard PA form |
| MVP | Prescription PA |
| OptumRx Part D | Medicare Part D PA |

Payers without a mapped template fall back to a generic on-screen HTML draft, so
the flow never dead-ends. To add another: drop its PDF in `pa-forms/`, find label
positions with `pdftotext -bbox`, and add an entry to `lib/pdf/templates.ts`.

> ⚠️ The PDFs in `pa-forms/` are the payers' own copyrighted forms, included for
> a **local demo only** — don't redistribute them in a shipped product.

## Adding a real payer form

The demo ships with two **synthetic** forms (`lib/forms/generic-medication-pa.ts`
and `generic-imaging-pa.ts`). To model a real payer's PA form:

1. Copy `generic-medication-pa.ts` to e.g. `lib/forms/aetna-medication-pa.ts`.
2. Map each field on the real PDF to the matching `ExtractedData` value, and set
   `payerMatchers: ["aetna"]` and the appropriate `requestTypes`.
3. Add it to the top of the `FORM_TEMPLATES` array in `lib/forms/index.ts`
   (payer-specific forms are preferred over the generic fallbacks).

---

## What this MVP intentionally leaves out

- No real patient data, login, or database (state is per-session, in the browser).
- No submission to insurers — the flow ends at an approved on-screen summary.
- No HIPAA-compliant hosting, encryption, or audit logging.

These are the natural next steps once the core flow is validated.
