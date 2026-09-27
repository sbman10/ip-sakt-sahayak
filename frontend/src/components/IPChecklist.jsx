import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ToolIntro from './ToolIntro'
import { TOOL_INTRO_CONFIGS } from '../data/toolIntroConfigs'
import { getApiBase } from '../api/config'
import './IPChecklist.css'
import {
  IconHome,
  IconFolder,
  IconScroll,
  IconSparkles,
  IconCheckCircle,
  IconCheck,
  IconClock,
  IconHelpCircle,
  IconFileText,
  IconCurrencyRupee,
  IconGlobe,
  IconLeaf,
  IconAward,
  IconSearch,
  IconX,
  IconPrinter,
  IconRotateCcw10,
  IconChevronDown,
  IconChevronRight,
  IconLock,
  IconShieldCheck,
  IconScale,
  IconBuilding,
  IconFilter,
  IconEdit,
  IconInfo,
  IconBuilding2
} from './Icons'

const API_BASE = getApiBase()

// ============================================================
// COMPREHENSIVE STATUTORY CHECKLISTS (OFFLINE & BACKEND FALLBACK)
// Real regulatory procedures aligned with Indian IP statutes:
// - Patents Act, 1970 & Patents Rules, 2003
// - Trade Marks Act, 1999 & Trade Marks Rules, 2017
// - Geographical Indications of Goods Act, 1999
// - Biological Diversity Act, 2002 & BD Rules, 2004
// - TKDL & AYUSH Section 3(p) / 3(e) Guidelines
// ============================================================

const STATUTORY_CHECKLISTS = [
  {
    id: 'patent_india_ordinary',
    name: 'Patent Filing Checklist (India - Ordinary Application)',
    category: 'patent',
    categoryLabel: 'Patent',
    act: 'Patents Act, 1970 & Patents Rules, 2003',
    description: 'Complete statutory verification roadmap for preparing, filing, and prosecuting an ordinary patent application before the Indian Patent Office (IPO).',
    estimated_time: '3-6 months filing, 2-4 years grant',
    fees_range: '₹1,600 - ₹8,000 filing + examination fee',
    jurisdiction: 'Indian Patent Office (Delhi, Mumbai, Chennai, Kolkata)',
    items: [
      {
        id: 'p1',
        text: 'Conduct Prior Art & Novelty Search',
        description: 'Exhaustive prior art search across domestic and international patent databases, scientific literature, and public domain repositories to verify novelty and inventive step before public disclosure.',
        required: true,
        documents: ['Prior Art Search Report', 'Non-Patent Literature Citations'],
        tips: [
          'Search InPASS (Indian Patent Advanced Search System) for domestic prior art.',
          'Cross-reference WIPO PATENTSCOPE, Google Patents, and EPO Espacenet.',
          'Ensure zero public disclosure prior to priority date to preserve absolute novelty in India.'
        ]
      },
      {
        id: 'p2',
        text: 'Assess Statutory Exclusions under Section 3 & Section 4',
        description: 'Verify that the claimed subject matter does not fall within statutory patent exclusions under Section 3 (frivolous, contrary to public order, discovery of living things, Section 3(k) software per se, or Section 3(p) traditional knowledge) or Section 4 (atomic energy).',
        required: true,
        documents: ['Patentability Assessment Memo', 'Technical Effect Clarification'],
        tips: [
          'Software per se is barred under Section 3(k); must establish technical effect or hardware interaction.',
          'Traditional knowledge remedies face strict Section 3(p) objections; prepare synergy data.',
          'Section 3(d) requires demonstration of enhanced therapeutic efficacy for derivative compounds.'
        ]
      },
      {
        id: 'p3',
        text: 'Draft Complete / Provisional Specification (Form 2)',
        description: 'Prepare detailed description with title, technical field, background, summary, detailed embodiment disclosures, and independent/dependent claims.',
        required: true,
        documents: ['Form 2 Specification', 'Formal Patent Drawings / Figures', 'Abstract'],
        tips: [
          'A Provisional Specification secures priority date with 12 months to file Complete.',
          'Must disclose the best mode of performing the invention under Section 10(4).',
          'Ensure independent claims clearly define essential novel inventive features.'
        ]
      },
      {
        id: 'p4',
        text: 'Execute Form 1 (Application for Grant of Patent)',
        description: 'Main statutory application containing applicant identity, address for service in India, type of applicant (Natural Person, Startup, Small Entity, Others), and inventor declarations.',
        required: true,
        documents: ['Form 1 Application', 'Proof of Right (Assignment Deed / Employment Contract)', 'DPIIT Startup Certificate (if applicable)'],
        tips: [
          'If applicant is not the inventor, Proof of Right must be submitted within 6 months.',
          'Registered DPIIT startups and MSMEs enjoy 80% statutory fee concessions.',
          'Valid Indian address for service is mandatory for all foreign and domestic applicants.'
        ]
      },
      {
        id: 'p5',
        text: 'Submit Form 3 (Statement & Undertaking on Foreign Filings)',
        description: 'Mandatory statutory undertaking under Section 8 declaring all corresponding foreign patent applications filed for the same or substantially the same invention.',
        required: true,
        documents: ['Form 3 Statement & Undertaking', 'Foreign Patent Application Schedules'],
        tips: [
          'Must be filed along with Form 1 or within 6 months of Indian filing.',
          'Any subsequent foreign application must be disclosed within 6 months of that foreign filing.',
          'Non-compliance with Section 8 is a major ground for post-grant revocation under Section 64.'
        ]
      },
      {
        id: 'p6',
        text: 'Submit Form 5 (Declaration as to Inventorship)',
        description: 'Statutory declaration identifying all true and first inventors with full names, nationalities, and residential addresses.',
        required: true,
        documents: ['Form 5 Declaration'],
        tips: [
          'Must be submitted with complete specification or within 1 month from filing date.',
          'All inventors who contributed to the inventive concept must be formally named.',
          'Legal representatives or assignees can apply only with inventor endorsement.'
        ]
      },
      {
        id: 'p7',
        text: 'Execute Form 26 / Power of Attorney (if using Agent)',
        description: 'Authorization empowering a registered Indian Patent Agent or legal practitioner to act before the Controller of Patents.',
        required: false,
        documents: ['Form 26 Authorization', 'Stamped Power of Attorney'],
        tips: [
          'Must bear appropriate state stamp duty per the Indian Stamp Act.',
          'Can be filed along with the application or within 3 months of filing.',
          'General Power of Attorney (GPA) can be referenced across multiple filings.'
        ]
      },
      {
        id: 'p8',
        text: 'Pay Official Government E-Filing Fees',
        description: 'Remit prescribed statutory filing fees via the Controller General of Patents, Designs and Trade Marks (CGPDTM) e-filing gateway.',
        required: true,
        documents: ['CBR (Comprehensive Barcode Receipt)', 'Fee Payment Confirmation'],
        tips: [
          'E-filing receives a 10% statutory discount over physical counter submissions.',
          'Base fee covers up to 30 pages and up to 10 claims; additional fee per page/claim.',
          'Natural Person / Startup: ₹1,600 base fee; Small Entity: ₹4,000; Others: ₹8,000.'
        ]
      },
      {
        id: 'p9',
        text: 'File Form 9 for Early Publication (Optional)',
        description: 'Request early publication in the Official Patent Journal within 1 month, rather than waiting the statutory 18-month dormancy period.',
        required: false,
        documents: ['Form 9 Request for Early Publication'],
        tips: [
          'Accelerates prosecution timeline significantly.',
          'Required step if seeking fast-track commercial licensing or early enforcement post-grant.',
          'Statutory fee: ₹2,500 (Natural Person/Startup) / ₹12,500 (Large Entity).'
        ]
      },
      {
        id: 'p10',
        text: 'File Form 18 / 18A (Request for Examination - RFE)',
        description: 'Formal request to examine the application. Applications are not examined until an RFE is filed with the prescribed fee.',
        required: true,
        documents: ['Form 18 (Standard) or Form 18A (Expedited)', 'Startup / Female Applicant / MSME Proof'],
        tips: [
          'Must be filed within 48 months from priority/filing date (31 months for applications filed after March 2024 amendments).',
          'Form 18A expedited examination is available for Startups, Female applicants, SMEs, and Green Tech.',
          'Expedited examination often produces First Examination Report within 60-90 days.'
        ]
      },
      {
        id: 'p11',
        text: 'Respond to First Examination Report (FER)',
        description: 'Comprehensive point-by-point reply addressing prior art citations, Section 3 statutory objections, and formal drafting defects.',
        required: true,
        documents: ['Formal Written Response to FER', 'Amended Claims / Specification (Marked-up & Clean)'],
        tips: [
          'Statutory response deadline is 6 months from FER issuance date.',
          'A 3-month extension can be requested via Form 4 before the expiry of 6 months.',
          'Failure to comply within the statutory period causes application abandonment under Section 21.'
        ]
      },
      {
        id: 'p12',
        text: 'Receive Patent Grant & Track Maintenance Renewals',
        description: 'Issuance of electronic Patent Grant Certificate and calendarization of annual statutory annuities to keep the patent in force.',
        required: true,
        documents: ['Patent Grant Certificate', 'Maintenance Renewal Schedule (Form 4)'],
        tips: [
          'Indian patents are valid for 20 years from the date of filing.',
          'Renewal annuities commence from the 3rd year onwards, payable before each anniversary.',
          'File annual Statement of Working (Form 27) every 3 financial years per Patents Rules 2024.'
        ]
      }
    ]
  },
  {
    id: 'ayush_formulation_patent',
    name: 'AYUSH & Herbal Formulation Patenting Checklist',
    category: 'ayush',
    categoryLabel: 'AYUSH & TKDL',
    act: 'Patents Act 1970 (Sec 3(p), 3(e)) & Biological Diversity Act 2002',
    description: 'Specialized compliance roadmap for Ayurvedic, Siddha, Unani, and herbal innovations navigating Traditional Knowledge Digital Library (TKDL) barriers and NBA clearances.',
    estimated_time: '6-12 months preparation, 2-3 years grant',
    fees_range: '₹1,600 - ₹8,000 + NBA Form III fee',
    jurisdiction: 'Indian Patent Office & National Biodiversity Authority, Chennai',
    items: [
      {
        id: 'ay1',
        text: 'Conduct TKDL (Traditional Knowledge Digital Library) Clearance',
        description: 'Screen Ayurvedic Pharmacopoeia of India (API), Charaka Samhita, Sushruta Samhita, and CSIR TKDL databases to ensure formulation is not part of documented public knowledge.',
        required: true,
        documents: ['TKDL Clearance Memo', 'Classical Text Reference Citations'],
        tips: [
          'Section 3(p) bars patenting of traditional knowledge or an aggregation of known properties.',
          'Identify whether the therapeutic indication is already recognized in classical texts.',
          'Focus novel claims on specialized extraction solvents, purified active fractions, or delivery systems.'
        ]
      },
      {
        id: 'ay2',
        text: 'Establish Synergistic Therapeutic Effect under Section 3(e)',
        description: 'Provide empirical comparative pharmacological evidence demonstrating that the herbal combination produces a non-obvious synergistic effect greater than the sum of its individual components.',
        required: true,
        documents: ['Synergistic Index (CI < 1.0) Laboratory Data', 'Comparative Bioavailability Studies', 'Pharmacological Assay Reports'],
        tips: [
          'Section 3(e) strictly prohibits mere admixtures of known substances.',
          'Must submit quantitative experimental data showing unexpected synergy or reduced toxicity.',
          'Include Combination Index (Chou-Talalay method) or equivalent validated statistical model.'
        ]
      },
      {
        id: 'ay3',
        text: 'Declare Source & Geographical Origin of Biological Resources',
        description: 'Mandatory statutory disclosure under Section 10(4)(ii)(D) specifying the botanical source and exact geographical location in India from which herbs/plants were sourced.',
        required: true,
        documents: ['Biological Material Source Declaration', 'Vendor / Cultivator Invoices'],
        tips: [
          'Must disclose the state, district, and forest/agricultural source of all biological materials.',
          'Failure to disclose or wrongful disclosure is a statutory ground for opposition under Section 25.',
          'Confirm that species are not included on the endangered or negative export list.'
        ]
      },
      {
        id: 'ay4',
        text: 'Apply for NBA Form III Prior Approval (Biological Diversity Act)',
        description: 'Submit formal application to the National Biodiversity Authority (NBA) in Chennai under Section 6 of the Biological Diversity Act, 2002 before patent grant.',
        required: true,
        documents: ['NBA Form III Application', 'Patent Application Abstract & Claims Copy', 'NBA Fee Receipt (₹500)'],
        tips: [
          'Section 6 mandates prior NBA approval before grant of any IPR based on Indian biological resources.',
          'Can be filed simultaneously with or after patent application, but must precede patent grant.',
          'Apply via the official NBA National ABS E-filing Portal (absefiling.nic.in).'
        ]
      },
      {
        id: 'ay5',
        text: 'Draft Complete Specification Highlighting Non-Obvious Processing',
        description: 'Frame patent claims with clear emphasis on novel standardized fractions, specific solvent ratios, temperature profiles, or bioavailability enhancements.',
        required: true,
        documents: ['Complete Specification (Form 2)', 'Standardization Biomarker HPLC/LC-MS Data'],
        tips: [
          'Characterize extracts with HPLC, HPTLC, or LC-MS chromatographic fingerprints.',
          'Claim specific concentration ranges of identified active phytoconstituents.',
          'Disclose best extraction mode and stability profile under ICH accelerated conditions.'
        ]
      },
      {
        id: 'ay6',
        text: 'File Application & Form 18A (Expedited for Startups/AYUSH)',
        description: 'Submit patent application with biological material checkboxes ticked on Form 1 and request expedited examination if DPIIT recognized.',
        required: true,
        documents: ['Form 1', 'Form 2', 'Form 18A Request for Expedited Examination'],
        tips: [
          'Form 1 explicitly queries whether biological material is sourced from India.',
          'DPIIT-certified AYUSH startups can leverage fast-track examination to receive FER in 3 months.',
          'Ensure complete foreign filing declarations (Form 3) are lodged at the same time.'
        ]
      },
      {
        id: 'ay7',
        text: 'Rebut Section 3(p) & Section 3(e) FER Objections',
        description: 'Prepare technical and legal defense countering CSIR TKDL examiner citations by demonstrating novel technical parameters and unexpected physiological action.',
        required: true,
        documents: ['Written Rebuttal Brief', 'Expert Scientific Affidavit', 'Supplementary Synergism Data'],
        tips: [
          'Examiners routinely raise Section 3(p) TKDL citations on every plant mention.',
          'Overcome objections by demonstrating that processing alters chemical profile from classical decoctions.',
          'Cite Delhi High Court precedent on synergistic formulations and enhanced bioavailability.'
        ]
      },
      {
        id: 'ay8',
        text: 'Execute NBA Benefit Sharing Agreement',
        description: 'Conclude formal Access and Benefit Sharing (ABS) agreement with NBA Chennai agreeing to statutory royalty/monetary sharing terms before IPO grant.',
        required: true,
        documents: ['Signed ABS Agreement with NBA', 'Benefit Sharing Compliance Undertaking'],
        tips: [
          'Standard terms: 0.1% - 0.5% ex-factory sales or 2% - 5% on IPR commercial licensing.',
          'Controller of Patents will not seal the patent certificate until NBA clearance order is on record.',
          'Maintain transparent accounts of commercialization for periodic NBA audit.'
        ]
      }
    ]
  },
  {
    id: 'trademark_india',
    name: 'Trademark Registration Checklist (Form TM-A)',
    category: 'trademark',
    categoryLabel: 'Trademark',
    act: 'Trade Marks Act, 1999 & Trade Marks Rules, 2017',
    description: 'Comprehensive procedural verification for brand names, logos, device marks, and packaging trade dress before the Trade Marks Registry.',
    estimated_time: '8-15 months',
    fees_range: '₹4,500 - ₹9,000 per class',
    jurisdiction: 'Trade Marks Registry (Mumbai, Delhi, Kolkata, Chennai, Ahmedabad)',
    items: [
      {
        id: 't1',
        text: 'Conduct Comprehensive Trademark Clearance Search',
        description: 'Search official IP India trademark database for visually, phonetically, and conceptually similar registered marks or pending applications in target and allied classes.',
        required: true,
        documents: ['IP India Public Search Report', 'Market Common Law Search Summary'],
        tips: [
          'Search exact matches, phonetic matches, and prefix/suffix wildcards.',
          'Check Google, MCA registered company names, and social media handles.',
          'Review coordinated and allied classes (e.g., Class 5 pharma and Class 3 cosmetics).'
        ]
      },
      {
        id: 't2',
        text: 'Select Precise Nice Classification Classes (1 - 45)',
        description: 'Determine the correct Nice Classification class(es) for your commercial goods or services.',
        required: true,
        documents: ['Itemized Description of Goods/Services'],
        tips: [
          'Class 1-34 cover Goods; Class 35-45 cover Services.',
          'Class 5: Ayurvedic medicines & dietary supplements; Class 3: Herbal skincare; Class 30: Teas/spices.',
          'Multi-class application is supported under a single Form TM-A.'
        ]
      },
      {
        id: 't3',
        text: 'Evaluate Section 9 (Absolute) & Section 11 (Relative) Grounds',
        description: 'Ensure proposed mark is sufficiently distinctive, not generic or descriptive of the goods/services, and does not conflict with prior trademarks.',
        required: true,
        documents: ['Distinctiveness Assessment Memo'],
        tips: [
          'Section 9 bars descriptive marks (e.g., "Pure Aloe Vera" for skincare is descriptive).',
          'Invented or coined words (e.g., "KODAK", "ZYVO") have the strongest legal protection.',
          'Section 11 bars marks confusingly similar to earlier registered marks.'
        ]
      },
      {
        id: 't4',
        text: 'Prepare Form TM-A & Mark Representation',
        description: 'Fill out standard Form TM-A with applicant name, legal entity structure, registered office address, mark representation, and language translation/transliteration if non-English.',
        required: true,
        documents: ['Form TM-A', 'High-Resolution Mark Artwork (JPG/PNG < 5MB)'],
        tips: [
          'Word mark provides broadest protection across all font styles and colors.',
          'Device mark protects specific artistic logo, styling, and color layout.',
          'If color combination is claimed as a distinctive feature, provide Pantone codes.'
        ]
      },
      {
        id: 't5',
        text: 'Execute User Affidavit (if Claiming Prior Commercial Use)',
        description: 'If claiming trademark use prior to filing date, execute a notarized affidavit of user date supported by continuous commercial evidence.',
        required: false,
        documents: ['Notarized User Affidavit', 'Earliest Commercial Invoices', 'Date-stamped Marketing Material'],
        tips: [
          'Prior use strengthens defense against third-party opposition substantially.',
          'Must submit invoices showing mark used directly on or in connection with the goods/services.',
          'If mark is not yet used commercially, select "Proposed to be used" (no affidavit needed).'
        ]
      },
      {
        id: 't6',
        text: 'Pay Statutory E-Filing Application Fees',
        description: 'Pay official fee via IP India payment gateway: ₹4,500 per class for Individuals / Startups / SMEs; ₹9,000 for Large Companies.',
        required: true,
        documents: ['Electronic Payment Receipt', 'Application Number Acknowledgement'],
        tips: [
          'Individuals, DPIIT startups, and MSMEs receive a 50% statutory discount.',
          'Ensure payment receipt displays correct class and applicant name.',
          'Application number is generated immediately upon payment confirmation.'
        ]
      },
      {
        id: 't7',
        text: 'Monitor Examination Report & Respond within 30 Days',
        description: 'Track examination status in the Trade Marks Journal. Respond to any Section 9 or Section 11 objections within the strict statutory 30-day window.',
        required: true,
        documents: ['Written Response to Examination Report (Form MIS-R)', 'Supporting Proof of Acquired Distinctiveness'],
        tips: [
          'Examination report is typically issued within 30 to 60 days from filing.',
          'Strict 30-day response deadline from date of receipt (can request 30-day extension via TM-M).',
          'Failure to respond leads to automatic abandonment of the trademark application.'
        ]
      },
      {
        id: 't8',
        text: 'Monitor 4-Month Trademark Journal Publication & Oppositions',
        description: 'Once accepted, mark is published in the weekly Trade Marks Journal for a statutory 4-month public opposition period.',
        required: true,
        documents: ['Journal Publication Clipping', 'Counter-Statement (Form TM-O) if opposed'],
        tips: [
          'Third parties have exactly 4 months from publication date to file opposition.',
          'If opposed, applicant must file Counter-Statement within 2 months of receiving Notice of Opposition.',
          'If no opposition is filed, mark automatically proceeds to registration.'
        ]
      },
      {
        id: 't9',
        text: 'Download Registration Certificate & Maintain 10-Year Renewals',
        description: 'Download the official electronic Registration Certificate (Form O-2) and establish calendar reminder for 10-year renewal deadline.',
        required: true,
        documents: ['Trademark Registration Certificate (Form O-2)', 'Renewal Calendar Schedule'],
        tips: [
          'Registration is valid for 10 years from the date of initial application.',
          'Authorized to display the registered symbol (®) alongside the mark.',
          'Renewable indefinitely every 10 years by filing Form TM-R with prescribed fee.'
        ]
      }
    ]
  },
  {
    id: 'gi_india',
    name: 'Geographical Indication Registration Checklist',
    category: 'gi',
    categoryLabel: 'Geographical Indication',
    act: 'Geographical Indications of Goods Act, 1999',
    description: 'Statutory verification process for registered associations of producers seeking legal protection for goods possessing unique regional qualities or reputation.',
    estimated_time: '18-24 months',
    fees_range: '₹5,000 - ₹10,000',
    jurisdiction: 'Geographical Indications Registry, Chennai',
    items: [
      {
        id: 'g1',
        text: 'Verify Geographical Origin & Terroir Eligibility',
        description: 'Establish that the agricultural, natural, or manufactured goods originate from a defined geographical area and possess characteristics attributable to regional factors or artisan skills.',
        required: true,
        documents: ['Terroir Link Technical Study', 'Geographical Boundary Map'],
        tips: [
          'Product qualities, reputation, or characteristics must be linked to regional environment.',
          'Examples: Darjeeling Tea, Alphonso Mango, Kangra Painting, Mysore Silk.',
          'General indications or generic trade names cannot be registered as GI.'
        ]
      },
      {
        id: 'g2',
        text: 'Form Registered Producer Association or Body',
        description: 'Form or verify an association of producers, cooperative society, or statutory body representing the collective interest of all regional producers.',
        required: true,
        documents: ['Association Registration Certificate', 'Constitution / Bylaws', 'List of Member Producers'],
        tips: [
          'GI applications cannot be owned by individual proprietary persons.',
          'Must represent a substantial body of producers in the defined geographical territory.',
          'Government bodies or universities can apply on behalf of traditional artisans.'
        ]
      },
      {
        id: 'g3',
        text: 'Compile Statement of Case & Historical Gazette Evidence',
        description: 'Draft comprehensive Statement of Case documenting historical lineage, traditional manufacturing techniques, and quality control specifications.',
        required: true,
        documents: ['Statement of Case', 'Historical Gazetteers & Literature Citations', 'Production Flowcharts'],
        tips: [
          'Document at least 50 to 100 years of continuous regional production history.',
          'Detail specific climatic, geological, or human factors responsible for uniqueness.',
          'Specify inspection body mechanism to ensure post-registration quality compliance.'
        ]
      },
      {
        id: 'g4',
        text: 'Submit Form GI-1 Application to GI Registry Chennai',
        description: 'Lodge formal application on Form GI-1 along with 3 copies of Statement of Case, special human skill disclosures, and detailed geographical maps.',
        required: true,
        documents: ['Form GI-1 Application', 'Affidavit of Authorized Representative', 'Boundary Map (Survey of India)'],
        tips: [
          'GI Registry in Chennai has pan-India jurisdiction over all GI filings.',
          'Specify exact class of goods under the GI classification schedule.',
          'Filing fee is ₹5,000 for producer associations and ₹10,000 for other bodies.'
        ]
      },
      {
        id: 'g5',
        text: 'Present Case before Expert Consultative Committee',
        description: 'Appear before the multidisciplinary Consultative Committee appointed by the Registrar to review historical evidence, laboratory testing, and physical samples.',
        required: true,
        documents: ['Technical Committee Presentation', 'Physical Product Samples', 'Scientific Testing Reports'],
        tips: [
          'Committee includes scientists, historians, and sector-specific government specialists.',
          'Address any queries regarding production boundaries or artisan inclusion.',
          'Amend Statement of Case as per Consultative Committee recommendations.'
        ]
      },
      {
        id: 'g6',
        text: 'Monitor 3-Month GI Journal Publication & Oppositions',
        description: 'Upon acceptance, application is published in the Geographical Indications Journal for a 3-month public opposition window.',
        required: true,
        documents: ['GI Journal Notice', 'Counter-Statement (Form GI-2) if opposed'],
        tips: [
          '3-month opposition period allows other regional producer groups to raise boundary concerns.',
          'Opposition disputes are resolved through formal evidence and hearings in Chennai.',
          'If no opposition is filed, Registrar issues formal registration order.'
        ]
      },
      {
        id: 'g7',
        text: 'Obtain GI Certificate & Register Authorized Users (Form GI-3)',
        description: 'Receive Certificate of Registration (10-year renewable term) and facilitate individual local producers in applying as Registered Authorized Users under Form GI-3.',
        required: true,
        documents: ['GI Registration Certificate (Form O-2)', 'Authorized User Applications (Form GI-3)'],
        tips: [
          'GI registration is valid for 10 years and renewable indefinitely.',
          'Only producers registered as Authorized Users (Form GI-3, ₹500 fee) can legally use the GI logo and tag.',
          'Unauthorized use is a cognizable criminal offense punishable under Section 38 of the GI Act.'
        ]
      }
    ]
  },
  {
    id: 'abs_india',
    name: 'ABS Compliance Checklist (Biodiversity Act)',
    category: 'biodiversity',
    categoryLabel: 'Biodiversity / ABS',
    act: 'Biological Diversity Act, 2002 & BD Rules, 2004',
    description: 'Mandatory Access and Benefit Sharing (ABS) compliance procedures under the Biological Diversity Act, 2002 for commercial utilization or IPR filings.',
    estimated_time: '3-6 months',
    fees_range: '₹500 (Form III) to ₹10,000 (Form I)',
    jurisdiction: 'National Biodiversity Authority (NBA), Chennai & State Biodiversity Boards',
    items: [
      {
        id: 'a1',
        text: 'Identify Biological Resource & Associated Traditional Knowledge',
        description: 'Audit all ingredients, plant parts, animal derivatives, microbial cultures, and genetic material to verify whether they fall under the Biological Diversity Act.',
        required: true,
        documents: ['Biological Material Taxonomical Specification', 'Procurement Origin Audit'],
        tips: [
          'Applies to all Indian biological resources and associated indigenous knowledge.',
          'Excludes value-added products lacking identifiable genetic material.',
          'Check the MoEFCC list of normally traded commodities (NTACs) for potential exemptions.'
        ]
      },
      {
        id: 'a2',
        text: 'Determine Statutory Entity Category (Section 3 vs Section 7)',
        description: 'Verify whether the applicant entity requires prior NBA Chennai approval (Section 3) or prior intimation to the State Biodiversity Board (Section 7).',
        required: true,
        documents: ['Shareholding Pattern Certificate', 'Corporate Incorporation Records'],
        tips: [
          'Section 3: Foreign nationals, non-residents, or Indian entities with any foreign shareholding require prior NBA approval.',
          'Section 7: Purely Indian entities utilizing biological resources for commercial purposes must notify the State Biodiversity Board (SBB).',
          'Local vaidyas and hakims practicing traditional medicine are exempt from commercial ABS fees.'
        ]
      },
      {
        id: 'a3',
        text: 'Obtain Prior Informed Consent (PIC) & Consult Local BMCs',
        description: 'Engage with local Biodiversity Management Committees (BMCs) where resources or traditional knowledge are collected to obtain Prior Informed Consent (PIC).',
        required: true,
        documents: ['Prior Informed Consent (PIC) Resolution', 'BMC Consultation Minutes'],
        tips: [
          'Section 41 mandates consultation with local BMCs regarding access to bio-resources.',
          'Document collection locations with GPS coordinates and local community leadership signatures.',
          'Ensure fair representation of tribal knowledge holders.'
        ]
      },
      {
        id: 'a4',
        text: 'Submit Online Application on NBA E-Filing Portal',
        description: 'File prescribed statutory form on the official National ABS Portal (absefiling.nic.in) corresponding to the intended activity.',
        required: true,
        documents: ['Form I (Research/Commercial)', 'Form III (Applying for IPR/Patent)', 'Official Fee Receipt'],
        tips: [
          'Form I: Access for research, commercial utilization, or bio-survey (₹10,000 fee).',
          'Form III: Prior approval before applying for IPR inside or outside India (₹500 fee).',
          'Form IV: Third-party transfer of accessed biological resources (₹10,000 fee).'
        ]
      },
      {
        id: 'a5',
        text: 'Negotiate Access & Benefit Sharing (ABS) Agreement',
        description: 'Conclude formal benefit sharing agreement with the NBA determining monetary and non-monetary sharing terms.',
        required: true,
        documents: ['Draft Benefit Sharing Agreement', 'Commercial Production Volume Projections'],
        tips: [
          'Monetary terms: 0.1% to 0.5% of ex-factory sale price for commercial utilization.',
          'IPR royalty sharing: 2% to 5% of commercial licensing income received.',
          'Non-monetary options include technology transfer, local community training, or bio-conservation.'
        ]
      },
      {
        id: 'a6',
        text: 'Obtain Official NBA Approval Permit / Order',
        description: 'Issuance of formal approval order from the Secretary, National Biodiversity Authority, setting out approved quantities, geographical source, and permitted uses.',
        required: true,
        documents: ['NBA Approval Order', 'Access Permit Certificate'],
        tips: [
          'The Indian Patent Office requires this approval order before granting patent applications based on bio-resources.',
          'Approval is strictly restricted to the specified purpose and resource volume.',
          'Any expansion of scope or transfer to third parties requires fresh approval under Form IV.'
        ]
      },
      {
        id: 'a7',
        text: 'Maintain Annual Compliance & Remit Benefit Sharing Funds',
        description: 'Submit annual utilization reports and remit calculated benefit sharing installments to the National Biodiversity Fund.',
        required: true,
        documents: ['Annual Utilization Report', 'Audited Commercial Sales Certificates', 'Bank Remittance Advice'],
        tips: [
          'Reports are due annually within 60 days of financial year end.',
          'Funds deposited in National Biodiversity Fund are distributed to local BMCs for conservation.',
          'Non-compliance attracts penal provisions under Section 55 of the Biological Diversity Act.'
        ]
      }
    ]
  }
]

export default function IPChecklist() {
  const [showIntro, setShowIntro] = useState(true)
  const [checklists, setChecklists] = useState(STATUTORY_CHECKLISTS)
  const [selectedChecklistId, setSelectedChecklistId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [stepSearchQuery, setStepSearchQuery] = useState('')
  const [stepFilter, setStepFilter] = useState('all') // 'all', 'required', 'pending', 'completed'
  const [completedItems, setCompletedItems] = useState(new Set())
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [notes, setNotes] = useState({})
  const [toastMessage, setToastMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  // ----------------------------------------------------------------
  // Fetch checklists from API if available; fallback gracefully
  // ----------------------------------------------------------------
  useEffect(() => {
    fetchChecklists()
  }, [])

  const fetchChecklists = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/checklists/`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          // Merge API summaries with rich offline statutory item details
          const merged = STATUTORY_CHECKLISTS.map(localCl => {
            const apiMatch = data.find(apiCl => apiCl.id === localCl.id)
            if (apiMatch) {
              return {
                ...localCl,
                name: apiMatch.name || localCl.name,
                description: apiMatch.description || localCl.description,
                estimated_time: apiMatch.estimated_time || localCl.estimated_time,
                fees_range: apiMatch.fees_range || localCl.fees_range
              }
            }
            return localCl
          })
          setChecklists(merged)
        }
      }
    } catch (err) {
      // Backend unavailable; STATUTORY_CHECKLISTS is already set as fallback
      console.log('Checklists API offline or unreachable, using verified statutory datasets.')
    }
  }

  // ----------------------------------------------------------------
  // Load progress and notes when a checklist is selected
  // ----------------------------------------------------------------
  const activeChecklist = useMemo(() => {
    return checklists.find(c => c.id === selectedChecklistId) || null
  }, [checklists, selectedChecklistId])

  useEffect(() => {
    if (!selectedChecklistId) return

    // 1. Load from localStorage
    const savedProgressKey = `ip_sakti_checklist_progress_${selectedChecklistId}`
    const savedNotesKey = `ip_sakti_checklist_notes_${selectedChecklistId}`
    try {
      const savedItems = localStorage.getItem(savedProgressKey)
      if (savedItems) {
        const parsed = JSON.parse(savedItems)
        if (Array.isArray(parsed)) {
          setCompletedItems(new Set(parsed))
        }
      } else {
        setCompletedItems(new Set())
      }

      const savedNotes = localStorage.getItem(savedNotesKey)
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes)
        if (typeof parsedNotes === 'object') {
          setNotes(parsedNotes)
        }
      } else {
        setNotes({})
      }
    } catch (e) {
      console.error('Failed to load local checklist storage:', e)
    }

    // 2. Expand first 2 items by default for great UX
    if (activeChecklist && activeChecklist.items) {
      const initialExpanded = new Set(activeChecklist.items.slice(0, 2).map(item => item.id))
      setExpandedItems(initialExpanded)
    }

    // 3. Try to sync with backend progress endpoint
    fetchRemoteProgress(selectedChecklistId)
  }, [selectedChecklistId, activeChecklist])

  const fetchRemoteProgress = async (checklistId) => {
    try {
      const res = await fetch(`${API_BASE}/api/checklists/${checklistId}/progress?user_id=anonymous`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.completed_items) && data.completed_items.length > 0) {
          setCompletedItems(prev => {
            const merged = new Set([...prev, ...data.completed_items])
            return merged
          })
        }
        if (data.notes && Object.keys(data.notes).length > 0) {
          setNotes(prev => ({ ...prev, ...data.notes }))
        }
      }
    } catch (err) {
      // Backend progress offline, silent fallback to localStorage
    }
  }

  // ----------------------------------------------------------------
  // Toggle Item Completion
  // ----------------------------------------------------------------
  const toggleItem = useCallback((itemId) => {
    setCompletedItems(prev => {
      const next = new Set(prev)
      const isNowCompleted = !next.has(itemId)
      if (isNowCompleted) {
        next.add(itemId)
      } else {
        next.delete(itemId)
      }

      // Persist in localStorage
      if (selectedChecklistId) {
        const key = `ip_sakti_checklist_progress_${selectedChecklistId}`
        localStorage.setItem(key, JSON.stringify(Array.from(next)))

        // Attempt async sync to API without blocking
        fetch(`${API_BASE}/api/checklists/${selectedChecklistId}/progress?user_id=anonymous`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, completed: isNowCompleted })
        }).catch(() => {})
      }

      showToast(isNowCompleted ? 'Milestone marked complete' : 'Milestone marked pending')
      return next
    })
  }, [selectedChecklistId])

  // ----------------------------------------------------------------
  // Toggle Accordion Item
  // ----------------------------------------------------------------
  const toggleExpand = useCallback((itemId) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  const expandAll = () => {
    if (!activeChecklist) return
    setExpandedItems(new Set(activeChecklist.items.map(item => item.id)))
  }

  const collapseAll = () => {
    setExpandedItems(new Set())
  }

  // ----------------------------------------------------------------
  // Update Step Notes
  // ----------------------------------------------------------------
  const updateNote = (itemId, text) => {
    setNotes(prev => {
      const next = { ...prev, [itemId]: text }
      if (selectedChecklistId) {
        const key = `ip_sakti_checklist_notes_${selectedChecklistId}`
        localStorage.setItem(key, JSON.stringify(next))
      }
      return next
    })
  }

  // ----------------------------------------------------------------
  // Reset Progress
  // ----------------------------------------------------------------
  const handleResetProgress = () => {
    if (!selectedChecklistId) return
    if (window.confirm('Are you sure you want to reset all progress and notes for this checklist?')) {
      setCompletedItems(new Set())
      setNotes({})
      localStorage.removeItem(`ip_sakti_checklist_progress_${selectedChecklistId}`)
      localStorage.removeItem(`ip_sakti_checklist_notes_${selectedChecklistId}`)

      // Attempt remote reset
      fetch(`${API_BASE}/api/checklists/${selectedChecklistId}/progress?user_id=anonymous`, {
        method: 'DELETE'
      }).catch(() => {})

      showToast('Checklist progress reset to 0%')
    }
  }

  // ----------------------------------------------------------------
  // Print / Export
  // ----------------------------------------------------------------
  const handlePrint = () => {
    expandAll()
    setTimeout(() => {
      window.print()
    }, 200)
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 2400)
  }

  // ----------------------------------------------------------------
  // Filtering & Computed Stats
  // ----------------------------------------------------------------
  const categories = [
    { id: 'all', label: 'All Checklists', icon: <IconFolder size={14} /> },
    { id: 'patent', label: 'Patents', icon: <IconFileText size={14} /> },
    { id: 'ayush', label: 'AYUSH & TKDL', icon: <IconLeaf size={14} /> },
    { id: 'trademark', label: 'Trademarks', icon: <IconAward size={14} /> },
    { id: 'gi', label: 'Geographical Indications', icon: <IconGlobe size={14} /> },
    { id: 'biodiversity', label: 'ABS & Biodiversity', icon: <IconShieldCheck size={14} /> }
  ]

  const filteredChecklists = useMemo(() => {
    return checklists.filter(cl => {
      const matchesCategory = selectedCategory === 'all' || cl.category === selectedCategory
      const query = searchQuery.trim().toLowerCase()
      if (!query) return matchesCategory

      const matchesSearch =
        cl.name.toLowerCase().includes(query) ||
        cl.description.toLowerCase().includes(query) ||
        (cl.act && cl.act.toLowerCase().includes(query)) ||
        cl.items.some(it => it.text.toLowerCase().includes(query) || (it.description && it.description.toLowerCase().includes(query)))

      return matchesCategory && matchesSearch
    })
  }, [checklists, selectedCategory, searchQuery])

  // Detail view filtered steps
  const filteredSteps = useMemo(() => {
    if (!activeChecklist) return []
    return activeChecklist.items.filter(item => {
      const isDone = completedItems.has(item.id)

      // Step filter tab
      if (stepFilter === 'required' && !item.required) return false
      if (stepFilter === 'pending' && isDone) return false
      if (stepFilter === 'completed' && !isDone) return false

      // Step search query
      const sq = stepSearchQuery.trim().toLowerCase()
      if (!sq) return true

      return (
        item.text.toLowerCase().includes(sq) ||
        (item.description && item.description.toLowerCase().includes(sq)) ||
        (item.documents && item.documents.some(d => d.toLowerCase().includes(sq))) ||
        (item.tips && item.tips.some(t => t.toLowerCase().includes(sq)))
      )
    })
  }, [activeChecklist, completedItems, stepFilter, stepSearchQuery])

  // Compute progress for active checklist
  const totalItemsCount = activeChecklist ? activeChecklist.items.length : 0
  const completedCount = activeChecklist
    ? activeChecklist.items.filter(item => completedItems.has(item.id)).length
    : 0
  const progressPercent = totalItemsCount > 0
    ? Math.round((completedCount / totalItemsCount) * 100)
    : 0

  const requiredItems = useMemo(() => {
    return activeChecklist ? activeChecklist.items.filter(item => item.required) : []
  }, [activeChecklist])

  const requiredCompletedCount = useMemo(() => {
    return requiredItems.filter(item => completedItems.has(item.id)).length
  }, [requiredItems, completedItems])

  const allRequiredDone = requiredItems.length > 0 && requiredCompletedCount === requiredItems.length

  // Helper for card category badges
  const getBadgeStyle = (category) => {
    switch (category) {
      case 'patent':
        return { background: '#F4EFFE', color: '#6D35E8', border: '1px solid #D8C7F9' }
      case 'ayush':
        return { background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }
      case 'trademark':
        return { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }
      case 'gi':
        return { background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }
      case 'biodiversity':
        return { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }
      default:
        return { background: '#F3F0EA', color: '#667085', border: '1px solid #E4E0D8' }
    }
  }

  // ----------------------------------------------------------------
  // RENDER: Intro Screen View
  // ----------------------------------------------------------------
  if (showIntro) {
    return (
      <div className="cl-page" style={{ padding: '24px 16px' }}>
        <ToolIntro
          config={TOOL_INTRO_CONFIGS['checklists']}
          icon={<IconCheckCircle size={28} />}
          onStart={() => setShowIntro(false)}
          backTo="/"
          backLabel="Back to Portal"
        />
      </div>
    )
  }

  // ----------------------------------------------------------------
  // RENDER: Main Checklist Workspace
  // ----------------------------------------------------------------
  return (
    <div className="cl-page">
      {/* Top Utility Navigation Strip */}
      <div className="cl-top-strip">
        <nav className="cl-breadcrumbs" aria-label="Breadcrumb navigation">
          <Link to="/" className="cl-breadcrumb-link">
            <IconHome size={14} />
            <span>Portal</span>
          </Link>
          <span className="cl-breadcrumb-sep">/</span>
          <span className="cl-breadcrumb-link">IP Tools</span>
          <span className="cl-breadcrumb-sep">/</span>
          <span className="cl-breadcrumb-active">Filing Checklists</span>
        </nav>

        <div className="cl-top-actions">
          <Link to="/workspace" className="cl-portal-link" title="Open Matter Workspace">
            <IconFolder size={14} />
            <span>Matter Workspace</span>
          </Link>
          <Link to="/drafts" className="cl-portal-link" title="Open Draft Generator">
            <IconFileText size={14} />
            <span>Draft Generator</span>
          </Link>
          <Link to="/documents" className="cl-portal-link" title="View Uploaded Documents">
            <IconScroll size={14} />
            <span>My Documents</span>
          </Link>
        </div>
      </div>

      <div className="cl-container">
        {/* =========================================================
            HEADER SECTION
            ========================================================= */}
        <header className="cl-header">
          <div className="cl-header-left">
            <div className="cl-header-icon-box" aria-hidden="true">
              <IconCheckCircle size={24} />
            </div>
            <div className="cl-header-titles">
              <h1>IP Statutory Filing Checklists</h1>
              <p className="cl-header-subtitle">
                Procedural verification roadmaps and mandatory statutory documentation check for Patent, Trademark, GI, and Biodiversity applications in India.
              </p>
            </div>
          </div>

          <div className="cl-header-right">
            <button
              type="button"
              className="cl-btn-guide"
              onClick={() => setShowIntro(true)}
              title="View checklist overview & instructions"
            >
              <IconInfo size={15} />
              <span>Checklist Guide</span>
            </button>
          </div>
        </header>

        {/* =========================================================
            VIEW 1: CHECKLIST SELECTION GRID
            ========================================================= */}
        {!selectedChecklistId ? (
          <div>
            {/* Filter & Search Bar */}
            <div className="cl-filter-card">
              <div className="cl-category-pills">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`cl-category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="cl-search-box">
                <span className="cl-search-icon">
                  <IconSearch size={15} />
                </span>
                <input
                  type="text"
                  className="cl-search-input"
                  placeholder="Search checklists, statutes, or forms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="cl-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Checklist Cards Grid */}
            <div className="cl-grid">
              {filteredChecklists.map(cl => {
                // Compute local completed count from localStorage
                let localDone = 0
                try {
                  const stored = localStorage.getItem(`ip_sakti_checklist_progress_${cl.id}`)
                  if (stored) {
                    const arr = JSON.parse(stored)
                    if (Array.isArray(arr)) localDone = arr.length
                  }
                } catch (e) {}

                const cardPercent = cl.items.length > 0 ? Math.round((localDone / cl.items.length) * 100) : 0
                const badgeStyle = getBadgeStyle(cl.category)

                return (
                  <div
                    key={cl.id}
                    className="cl-card"
                    onClick={() => setSelectedChecklistId(cl.id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedChecklistId(cl.id); }}
                  >
                    <div>
                      <div className="cl-card-top">
                        <span className="cl-card-badge" style={badgeStyle}>
                          {cl.categoryLabel || cl.category}
                        </span>
                        {cardPercent === 100 && (
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconCheck size={13} /> Complete
                          </span>
                        )}
                      </div>

                      <h3 className="cl-card-title">{cl.name}</h3>
                      <p className="cl-card-desc">{cl.description}</p>

                      <div className="cl-card-stats">
                        <div className="cl-card-stat-row">
                          <IconCheckCircle size={13} />
                          <span><strong>{cl.items.length}</strong> statutory steps</span>
                        </div>
                        <div className="cl-card-stat-row">
                          <IconClock size={13} />
                          <span>{cl.estimated_time}</span>
                        </div>
                        <div className="cl-card-stat-row">
                          <IconCurrencyRupee size={13} />
                          <span>{cl.fees_range}</span>
                        </div>
                      </div>

                      {/* Card progress */}
                      <div className="cl-progress-track">
                        <div
                          className="cl-progress-fill"
                          style={{
                            width: `${cardPercent}%`,
                            background: cardPercent === 100 ? '#16A34A' : '#6D35E8'
                          }}
                        />
                      </div>
                    </div>

                    <div className="cl-card-footer">
                      <span className="cl-card-progress-label">
                        {localDone} of {cl.items.length} completed ({cardPercent}%)
                      </span>
                      <button type="button" className="cl-btn-open">
                        <span>Open Checklist</span>
                        <IconChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredChecklists.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E4E0D8' }}>
                <IconSearch size={32} style={{ color: '#9CA3AF', marginBottom: '12px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#111827' }}>No matching checklists found</h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#667085' }}>Try adjusting your search criteria or category filter.</p>
                <button
                  type="button"
                  className="cl-btn-action"
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================
             VIEW 2: CHECKLIST DETAIL & WORKING VIEW
             ========================================================= */
          <div>
            {/* Action Bar */}
            <div className="cl-detail-header-actions">
              <button
                type="button"
                className="cl-btn-back"
                onClick={() => { setSelectedChecklistId(null); setStepSearchQuery(''); }}
              >
                <span>← Back to All Checklists</span>
              </button>

              <div className="cl-detail-actions-right">
                <button
                  type="button"
                  className="cl-btn-action"
                  onClick={handleResetProgress}
                  title="Reset all checkmarks and notes"
                >
                  <IconRotateCcw10 size={14} />
                  <span>Reset Progress</span>
                </button>

                <button
                  type="button"
                  className="cl-btn-action"
                  onClick={handlePrint}
                  title="Print or export checklist summary"
                >
                  <IconPrinter size={14} />
                  <span>Print Checklist</span>
                </button>

                <Link
                  to="/drafts"
                  className="cl-btn-primary"
                  title="Generate Statutory Forms in Draft Generator"
                >
                  <IconFileText size={14} />
                  <span>Generate Forms</span>
                </Link>
              </div>
            </div>

            {activeChecklist && (
              <>
                {/* Hero / Overview Card */}
                <div className="cl-detail-card">
                  <div className="cl-detail-top-row">
                    <div className="cl-detail-info">
                      <span className="cl-detail-meta-chip" style={getBadgeStyle(activeChecklist.category)}>
                        {activeChecklist.categoryLabel || activeChecklist.category}
                      </span>
                      <h2 className="cl-detail-title">{activeChecklist.name}</h2>
                      <p className="cl-detail-desc">{activeChecklist.description}</p>
                    </div>

                    {/* Circular Progress Meter */}
                    <div className="cl-progress-widget">
                      <div className="cl-progress-ring-container">
                        <svg width="64" height="64" viewBox="0 0 64 64">
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            fill="none"
                            stroke="#E4E0D8"
                            strokeWidth="5"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            fill="none"
                            stroke={progressPercent === 100 ? '#16A34A' : '#6D35E8'}
                            strokeWidth="5"
                            strokeDasharray={163.36}
                            strokeDashoffset={163.36 - (163.36 * progressPercent) / 100}
                            strokeLinecap="round"
                            transform="rotate(-90 32 32)"
                            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                          />
                        </svg>
                        <span className="cl-progress-ring-val">{progressPercent}%</span>
                      </div>

                      <div className="cl-progress-text-block">
                        <span className="cl-progress-status-title">
                          {progressPercent === 100
                            ? 'Filing Ready'
                            : progressPercent > 0
                            ? 'In Progress'
                            : 'Not Started'}
                        </span>
                        <span className="cl-progress-status-desc">
                          {completedCount} of {totalItemsCount} steps verified
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fact Strip */}
                  <div className="cl-fact-strip">
                    <div className="cl-fact-item">
                      <div className="cl-fact-icon-wrap">
                        <IconClock size={16} />
                      </div>
                      <div className="cl-fact-content">
                        <span>Statutory Timeline</span>
                        <strong>{activeChecklist.estimated_time}</strong>
                      </div>
                    </div>

                    <div className="cl-fact-item">
                      <div className="cl-fact-icon-wrap">
                        <IconCurrencyRupee size={16} />
                      </div>
                      <div className="cl-fact-content">
                        <span>Statutory Fees</span>
                        <strong>{activeChecklist.fees_range}</strong>
                      </div>
                    </div>

                    <div className="cl-fact-item">
                      <div className="cl-fact-icon-wrap">
                        <IconBuilding size={16} />
                      </div>
                      <div className="cl-fact-content">
                        <span>Competent Registry</span>
                        <strong>{activeChecklist.jurisdiction}</strong>
                      </div>
                    </div>

                    <div className="cl-fact-item">
                      <div className="cl-fact-icon-wrap">
                        <IconScale size={16} />
                      </div>
                      <div className="cl-fact-content">
                        <span>Statutory Authority</span>
                        <strong>{activeChecklist.act}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 100% Completion Celebration Banner */}
                {allRequiredDone && (
                  <div className="cl-readiness-banner" role="status">
                    <div className="cl-readiness-icon" aria-hidden="true">
                      <IconCheckCircle size={22} />
                    </div>
                    <div className="cl-readiness-text">
                      <h3>Filing Readiness Achieved</h3>
                      <p>
                        All mandatory statutory requirements and form enclosures have been verified. Your application package is ready for final inspection by a registered practitioner or direct e-filing submission.
                      </p>
                    </div>
                  </div>
                )}

                {/* Steps List Toolbar */}
                <div className="cl-steps-toolbar">
                  <h3 className="cl-steps-title">
                    <span>Statutory Procedures & Milestones</span>
                    <span className="cl-steps-count-pill">
                      {filteredSteps.length} {filteredSteps.length === 1 ? 'Step' : 'Steps'}
                    </span>
                  </h3>

                  <div className="cl-steps-filter-group">
                    <button
                      type="button"
                      className={`cl-step-filter-btn ${stepFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setStepFilter('all')}
                    >
                      All ({totalItemsCount})
                    </button>
                    <button
                      type="button"
                      className={`cl-step-filter-btn ${stepFilter === 'required' ? 'active' : ''}`}
                      onClick={() => setStepFilter('required')}
                    >
                      Required Only ({requiredItems.length})
                    </button>
                    <button
                      type="button"
                      className={`cl-step-filter-btn ${stepFilter === 'pending' ? 'active' : ''}`}
                      onClick={() => setStepFilter('pending')}
                    >
                      Pending ({totalItemsCount - completedCount})
                    </button>
                    <button
                      type="button"
                      className={`cl-step-filter-btn ${stepFilter === 'completed' ? 'active' : ''}`}
                      onClick={() => setStepFilter('completed')}
                    >
                      Completed ({completedCount})
                    </button>

                    <button
                      type="button"
                      className="cl-step-filter-btn"
                      onClick={expandedItems.size === activeChecklist.items.length ? collapseAll : expandAll}
                      style={{ marginLeft: '6px' }}
                    >
                      {expandedItems.size === activeChecklist.items.length ? 'Collapse All' : 'Expand All'}
                    </button>
                  </div>
                </div>

                {/* Step Search */}
                <div style={{ marginBottom: '14px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                    <IconSearch size={14} />
                  </span>
                  <input
                    type="text"
                    className="cl-search-input"
                    placeholder="Search step title, documents, or tips..."
                    value={stepSearchQuery}
                    onChange={(e) => setStepSearchQuery(e.target.value)}
                    style={{ paddingLeft: '34px', height: '36px', maxWidth: '100%' }}
                  />
                  {stepSearchQuery && (
                    <button
                      type="button"
                      className="cl-search-clear"
                      onClick={() => setStepSearchQuery('')}
                      style={{ right: '10px' }}
                    >
                      <IconX size={13} />
                    </button>
                  )}
                </div>

                {/* Step Accordion Cards */}
                <div className="cl-step-list">
                  {filteredSteps.map((item, index) => {
                    const isCompleted = completedItems.has(item.id)
                    const isExpanded = expandedItems.has(item.id)
                    const itemNote = notes[item.id] || ''

                    return (
                      <div
                        key={item.id}
                        className={`cl-step-card ${isCompleted ? 'completed' : ''}`}
                      >
                        {/* Step Header */}
                        <div
                          className="cl-step-header"
                          onClick={() => toggleExpand(item.id)}
                          tabIndex={0}
                          role="button"
                          aria-expanded={isExpanded}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') toggleExpand(item.id)
                          }}
                        >
                          {/* Checkbox button */}
                          <button
                            type="button"
                            className={`cl-checkbox-btn ${isCompleted ? 'checked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleItem(item.id)
                            }}
                            title={isCompleted ? 'Mark step as incomplete' : 'Mark step as complete'}
                            aria-label={`Mark step ${item.text} as ${isCompleted ? 'incomplete' : 'complete'}`}
                          >
                            {isCompleted && <IconCheck size={14} />}
                          </button>

                          {/* Index badge */}
                          <div className="cl-step-index">
                            {index + 1}
                          </div>

                          {/* Title & metadata */}
                          <div className="cl-step-title-area">
                            <h4 className="cl-step-text">{item.text}</h4>
                            <div className="cl-step-badges-row">
                              {item.required ? (
                                <span className="cl-badge-req">Required</span>
                              ) : (
                                <span className="cl-badge-opt">Optional</span>
                              )}
                              {item.documents && item.documents.length > 0 && (
                                <span className="cl-badge-doc-count">
                                  {item.documents.length} {item.documents.length === 1 ? 'doc' : 'docs'}
                                </span>
                              )}
                              {itemNote && (
                                <span style={{ fontSize: '11px', color: '#6D35E8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <IconEdit size={11} /> Note attached
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Chevron */}
                          <div className={`cl-chevron-wrap ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
                            <IconChevronDown size={18} />
                          </div>
                        </div>

                        {/* Step Body */}
                        {isExpanded && (
                          <div className="cl-step-body">
                            {item.description && (
                              <p className="cl-step-desc">{item.description}</p>
                            )}

                            {/* Required Documents Section */}
                            {item.documents && item.documents.length > 0 && (
                              <div className="cl-docs-section">
                                <span className="cl-subheading">
                                  <IconFileText size={13} />
                                  <span>Required Statutory Documents & Enclosures</span>
                                </span>
                                <div className="cl-doc-tags">
                                  {item.documents.map((doc, docIdx) => (
                                    <span key={docIdx} className="cl-doc-pill">
                                      <IconFileText size={12} />
                                      <span>{doc}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Examiner / Regulatory Tips Section */}
                            {item.tips && item.tips.length > 0 && (
                              <div className="cl-tips-box">
                                <span className="cl-subheading" style={{ color: '#6D35E8', marginBottom: '4px' }}>
                                  <IconHelpCircle size={13} />
                                  <span>Examiner & Legal Practice Tips</span>
                                </span>
                                <ul className="cl-tips-list">
                                  {item.tips.map((tip, tipIdx) => (
                                    <li key={tipIdx}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Practitioner Notes Input */}
                            <div className="cl-notes-wrapper">
                              <span className="cl-subheading" style={{ marginBottom: '4px' }}>
                                <IconEdit size={13} />
                                <span>Practitioner Notes & Matter Reference</span>
                              </span>
                              <textarea
                                className="cl-notes-input"
                                rows={2}
                                placeholder="Add custom notes, matter file numbers, client disclosures, or internal filing dates..."
                                value={itemNote}
                                onChange={(e) => updateNote(item.id, e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {filteredSteps.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E4E0D8' }}>
                    <p style={{ margin: 0, color: '#667085', fontSize: '13px' }}>
                      No steps match the filter criteria.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Save Notification Toast */}
      {toastMessage && (
        <div className="cl-toast" role="status">
          <IconCheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
