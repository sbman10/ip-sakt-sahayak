/**
 * IP-SAKTI Sahayak - Tool Introduction Configurations
 * 
 * Centralized, authoritative metadata for each IP utility tool.
 * Content strictly adheres to the tool's actual code, statutory backing,
 * and real regulatory frameworks (Patents Act 1970, BD Act 2002, Drugs & Cosmetics Act 1940).
 */

export const TOOL_INTRO_CONFIGS = {
  'abs-checker': {
    id: 'abs-checker',
    toolName: 'ABS Checker',
    chipLabel: 'Biological Diversity Act 2002 Module',
    purpose: 'Check whether your proposed use of biological resources requires National Biodiversity Authority (NBA) approval or State Biodiversity Board (SBB) intimation.',
    whatItDoes: 'Evaluates your applicant entity type, biological material origin, and intended activity to determine whether you need prior approval from the National Biodiversity Authority (NBA) or must notify the State Biodiversity Board (SBB).',
    whyUseful: 'Using Indian biological resources or traditional knowledge for research, commercial manufacturing, or patent filing without mandatory ABS clearance risks statutory penalties under Section 55 and delays patent grants under Section 6.',
    steps: [
      {
        stepNumber: '1',
        title: 'Enter Entity & Resource Details',
        desc: 'Select your entity structure (individual / domestic / foreign), origin of biological material, and purpose (commercial / patent / export).'
      },
      {
        stepNumber: '2',
        title: 'Statutory Criteria Evaluation',
        desc: 'The system evaluates Section 3, Section 6, and Section 7 triggers under the Biological Diversity Act 2002.'
      },
      {
        stepNumber: '3',
        title: 'Preliminary ABS Guidance',
        desc: 'Receive your required regulatory pathway, necessary NBA/SBB application forms, and practitioner exemption status.'
      }
    ],
    outputs: [
      'Statutory clearance status (NBA Form I / Form III vs SBB intimation)',
      'Applicability of Biological Diversity Act 2002 (Sections 3, 6 & 7)',
      'Exemption analysis for local Vaidyas and domestic traditional practitioners',
      'Prescribed regulatory compliance steps before patent grant or manufacturing'
    ],
    estimatedTime: '~1 min',
    disclaimer: 'Information for guidance only — not legal advice.',
    ctaText: 'Start Using Tool'
  },

  'ip-calculator': {
    id: 'ip-calculator',
    toolName: 'IP Cost Calculator',
    chipLabel: 'Patents Rules 2003 & Multi-IP Fee Schedule',
    purpose: 'Estimate official government filing fees and overall professional budgeting across Patents, Trademarks, Designs, Copyrights, and GI.',
    whatItDoes: 'Calculates exact Indian Patent Office statutory fees based on applicant category (Natural Person, Startup, Small Entity, Others), specification pages, and claims count, plus multi-stage IP prosecution estimates.',
    whyUseful: 'Statutory fees vary significantly based on entity classification (concessional rates apply to Startups & Individuals). This tool prevents unexpected budget deficits and helps plan IP expenditures.',
    steps: [
      {
        stepNumber: '1',
        title: 'Select IP Type & Entity Slab',
        desc: 'Choose your intellectual property category, filing jurisdiction, and applicant category (Individual, Startup, SME, Large Entity).'
      },
      {
        stepNumber: '2',
        title: 'Configure Specification Factors',
        desc: 'Specify claim counts, page volume, priority claims, or optional fast-track services (prior-art search, drafting assistance).'
      },
      {
        stepNumber: '3',
        title: 'Comprehensive Budget Breakdown',
        desc: 'System applies statutory First Schedule fee tables to generate an itemized cost and timeline report.'
      }
    ],
    outputs: [
      'Official statutory government fee breakdown per Patents Rules 2003',
      'Concessional fee tier verification for Startups, Individuals, and SMEs',
      'One-time vs recurring renewal expenditure projection',
      'Downloadable official cost estimate summary in PDF format'
    ],
    estimatedTime: '~2 mins',
    disclaimer: 'Information for guidance only — not legal advice.',
    ctaText: 'Start Using Tool'
  },

  'deadline-calculator': {
    id: 'deadline-calculator',
    toolName: 'Deadline Calculator',
    chipLabel: 'Patents Act 1970 Statutory Milestones',
    purpose: 'Track non-extendable statutory deadlines and prosecution milestones for Indian and international patent applications.',
    whatItDoes: 'Computes critical statutory due dates for Request for Examination (RFE), First Examination Report (FER) response, Convention Priority (12m), and PCT National Phase (31m) from your filing or priority dates.',
    whyUseful: 'Missing a statutory deadline at the Patent Office leads to irreversible abandonment of your patent application under Section 21 and Section 11B. Accurate deadline tracking is essential for patent maintenance.',
    steps: [
      {
        stepNumber: '1',
        title: 'Enter Critical Dates',
        desc: 'Input your patent application filing date and optional priority date.'
      },
      {
        stepNumber: '2',
        title: 'Statutory Window Computation',
        desc: 'System automatically calculates all statutory timelines under the Patents Act 1970 and Patents Rules 2003.'
      },
      {
        stepNumber: '3',
        title: 'Urgency Timeline & Deadlines',
        desc: 'Visual timeline displays milestones with real-time countdown days and urgency status (Overdue, Due Today, Urgent, Upcoming).'
      }
    ],
    outputs: [
      'Exact calendar due dates for RFE, FER response, PCT, and renewals',
      'Color-coded urgency classification (Urgent <90 days, Upcoming, Passed)',
      'Specific statutory section citations under the Indian Patents Act 1970',
      'Actionable countdown indicators to protect against legal abandonment'
    ],
    estimatedTime: '~1 min',
    disclaimer: 'Information for guidance only — not legal advice.',
    ctaText: 'Start Using Tool'
  },

  'draft-generator': {
    id: 'draft-generator',
    toolName: 'Draft Generator',
    chipLabel: 'Statutory Document Preparation Assistant',
    purpose: 'Generate structured, pre-formatted draft templates for Patent Form-1, NBA approval applications, and Section 3(p) petitions.',
    whatItDoes: 'Helps innovators generate structured draft templates with standard statutory clauses, applicant declarations, and biological resource disclosures formatted for review with registered patent agents.',
    whyUseful: 'Drafting initial patent applications and regulatory petitions from blank documents often misses required statutory declarations. Standardized scaffolds save time and ensure comprehensive initial submissions.',
    steps: [
      {
        stepNumber: '1',
        title: 'Select Document Template',
        desc: 'Choose the appropriate statutory instrument (Patent Form-1, Form-2, NBA Form-I, or Section 3(p) opposition).'
      },
      {
        stepNumber: '2',
        title: 'Fill Innovation & Entity Details',
        desc: 'Provide title, inventor information, bio-resource origins, and key formulation claims.'
      },
      {
        stepNumber: '3',
        title: 'Export Formatted Legal Draft',
        desc: 'Download or copy a cleanly formatted draft ready for formal inspection by a registered patent agent.'
      }
    ],
    outputs: [
      'Standardized statutory draft aligned with Indian Patent Office / NBA rules',
      'Pre-populated legal clauses, declarations, and fee indicators',
      'Exportable clean text and document preview',
      'Filing checklist of required attachments and supporting proofs'
    ],
    estimatedTime: '~3 mins',
    disclaimer: 'Information for guidance only — not legal advice.',
    ctaText: 'Start Using Tool'
  },

  'formulation-wizard': {
    id: 'formulation-wizard',
    toolName: 'Formulation Classification Wizard',
    chipLabel: 'Ayurveda IP & Regulatory Pathway Engine',
    purpose: 'Determine whether your Ayurvedic innovation qualifies as Classical, Patent & Proprietary, or Ayurveda-Aahar, and identify its legal pathway.',
    whatItDoes: 'Takes you through a 3-question decision tree evaluating traditional text citation, ingredient synergy, and delivery mechanisms to identify patent eligibility and licensing requirements.',
    whyUseful: 'Filing patent applications on classical Ayurvedic formulations violates Section 3(p) and leads to certain rejection. This wizard identifies the correct regulatory pathway and alternative IP protections before you spend resources.',
    steps: [
      {
        stepNumber: '1',
        title: 'Formulation Origin',
        desc: 'State whether ingredients and recipes originate directly from First Schedule classical texts or novel research.'
      },
      {
        stepNumber: '2',
        title: 'Synergy & Formulation Nature',
        desc: 'Indicate whether processing involves novel extraction, enhanced bioavailability, or therapeutic claims.'
      },
      {
        stepNumber: '3',
        title: 'Classification & IP Roadmap',
        desc: 'Receive immediate verdict on Section 3(p) patent bars, Rule 158-B manufacturing license, and brand protection strategies.'
      }
    ],
    outputs: [
      'Formulation classification (Classical / Patent & Proprietary / Ayurveda-Aahar)',
      'Patent eligibility evaluation under Section 3(p) and Section 3(e) of Patents Act',
      'State AYUSH licensing category (Rule 158-B(1) vs Rule 158-B(2))',
      'Strategic IP protection recommendations (Trademarks, Designs, Trade Secrets)'
    ],
    estimatedTime: '~2 mins',
    disclaimer: 'Information for guidance only — not legal advice.',
    ctaText: 'Start Classification Wizard'
  },

  'checklists': {
    id: 'checklists',
    toolName: 'IP Filing Checklists',
    chipLabel: 'Statutory Procedural Verification System',
    purpose: 'Verify procedural readiness and mandatory documentation before submitting Patent, Trademark, Design, or GI applications.',
    whatItDoes: 'Provides an interactive, step-by-step audit of required forms, statutory affidavits, powers of attorney, fee receipts, and biological resource disclosures required by the Indian IP office.',
    whyUseful: 'Procedural defects or omitted forms cause office objections (FER defects) and delay application processing by months. Pre-filing verification ensures first-time accuracy.',
    steps: [
      {
        stepNumber: '1',
        title: 'Select IP Discipline',
        desc: 'Choose between Patents, Trademarks, Industrial Designs, Geographical Indications, or NBA clearances.'
      },
      {
        stepNumber: '2',
        title: 'Verify Required Prerequisites',
        desc: 'Check off mandatory document items, forms, and statutory proof of eligibility.'
      },
      {
        stepNumber: '3',
        title: 'Readiness Audit & Progress',
        desc: 'Track completion percentage and confirm filing readiness before submitting to the IP portal.'
      }
    ],
    outputs: [
      'Comprehensive stage-wise document readiness checklist',
      'Required statutory forms, enclosures, and official fee requirements',
      'Persistent progress tracking with completed item indicators',
      'Direct references to official Indian Patent Office submission requirements'
    ],
    estimatedTime: '~2 mins',
    disclaimer: 'Information for guidance only — not legal advice.',
    ctaText: 'Start Using Tool'
  }
}
