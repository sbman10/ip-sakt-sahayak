import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconFileText,
  IconSparkles,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
} from './Icons'
import { getApiBase } from '../api/config'
import './DraftGenerator.css'

const API_BASE = getApiBase()

/* ------------------------------------------------------------------
   Template Catalogue — Statutory instruments supported for Indian IP
   ------------------------------------------------------------------ */
const TEMPLATES = [
  {
    id: 'form_1',
    category: 'Patent Filing',
    label: 'Patent Application — Form 1',
    subtitle: 'Application for grant of patent & complete specification scaffold',
    reference: 'Patents Rules, 2003 — Form 1 (Section 7, 54 & 135; Rule 20(1))',
    icon: '📜',
    showClaims: true,
    showRespondent: false,
    descriptionLabel: 'Field of Invention & Technical Summary',
    descriptionHint:
      'Describe the invention, technical advancement, novel active compounds, or Ayush formulation synergy.',
    suitableFor: 'AYUSH extracts, pharmaceutical compounds, medical devices, bio-process formulations',
  },
  {
    id: 'nba',
    category: 'Biodiversity Clearance',
    label: 'NBA Approval Application — Form III',
    subtitle: 'Statutory biological resource & traditional knowledge clearance',
    reference: 'Biological Diversity Act, 2002 — Section 6, Form III',
    icon: '🌿',
    showClaims: false,
    showRespondent: false,
    descriptionLabel: 'Biological Resource(s) & Associated Traditional Knowledge',
    descriptionHint:
      'Detail the biological resource(s) accessed, geographic source/state, research purpose, and proposed ABS compliance.',
    suitableFor: 'Inventions using Indian medicinal plants, microbes, animal derivatives, or traditional folklore',
  },
  {
    id: '3p_petition',
    category: 'Pre-Grant Opposition',
    label: 'Pre-Grant Opposition — Section 3(p)',
    subtitle: 'Representation challenging patents claiming traditional knowledge',
    reference: 'Patents Act, 1970 — Section 25(1) read with Section 3(p)',
    icon: '⚖️',
    showClaims: false,
    showRespondent: true,
    descriptionLabel: 'Statement of Case & Grounds of Opposition',
    descriptionHint:
      'Cite traditional Ayurvedic texts (Charaka, Sushruta), CSIR TKDL prior art references, or Section 3(e) aggregation grounds.',
    suitableFor: 'Preventing biopiracy and wrongful monopolization of documented Indian traditional remedies',
  },
]

/* ------------------------------------------------------------------
   Sample Data for 1-Click Demonstration & Fast Testing
   ------------------------------------------------------------------ */
const SAMPLE_DATA = {
  form_1: {
    applicantName: 'Dr. Anjali Sharma',
    entityType: 'Startup / Small Entity',
    applicantAddress: 'CSIR-CDRI, Sector 10, Jankipuram Extension, Lucknow 226031, Uttar Pradesh, India',
    applicantContact: 'anjali.sharma@cdri.res.in | +91 522 2772450',
    inventionTitle: 'A Synergistic Herbal Nano-Formulation of Withania Somnifera with Enhanced Bioavailability and Anti-Inflammatory Efficacy',
    filingDate: new Date().toISOString().slice(0, 10),
    description:
      'The present invention relates to an optimized self-emulsifying nano-formulation comprising standardized Withania somnifera (Ashwagandha) root extract having bioactive withanolide content between 4.5% to 5.2% w/w, encapsulated within lipid nanoparticles having an average particle size of 140-180 nm. The formulation demonstrates a 4.8-fold increase in oral bioavailability compared to conventional hydro-alcoholic extract and exhibits synergistic COX-2 inhibition in pre-clinical models without gastric ulceration.',
    claimsText:
      '1. A synergistic herbal nano-formulation comprising a standardized extract of Withania somnifera encapsulated in a lipid nanoparticle carrier.\n2. The formulation of claim 1, wherein the mean nanoparticle size is between 120 nm and 180 nm with a polydispersity index of less than 0.2.\n3. The formulation of claim 1, wherein the bioactive withanolide content is standardized between 4.5% and 5.5% w/w.\n4. A method of preparing the formulation of claim 1, comprising high-pressure homogenization at 800 bar.',
    respondentName: '',
    applicationNumber: '',
  },
  nba: {
    applicantName: 'Arogya Botanical Research Labs Pvt. Ltd.',
    entityType: 'Startup / Small Entity',
    applicantAddress: 'Plot 42, Biotech Park, Genome Valley, Hyderabad 500078, Telangana, India',
    applicantContact: 'regulatory@arogyabio.in | +91 40 23456789',
    inventionTitle: 'Standardized Phytopharmaceutical Composition Derived from Indian Gymnema Sylvestre',
    filingDate: new Date().toISOString().slice(0, 10),
    description:
      'The biological resource utilized is Gymnema sylvestre (Gudmar) leaves procured from sustainable wild collection in the Western Ghats biodiversity zone (Shimoga district, Karnataka). The extract is subjected to proprietary fractionation to isolate gymnemic acid IV. Research purpose: Development of an oral anti-hyperglycemic therapeutic agent. Equitable benefit sharing shall follow NBA Regulation 2014.',
    claimsText: '',
    respondentName: '',
    applicationNumber: '',
  },
  '3p_petition': {
    applicantName: 'National Traditional Medicine Advocates Collective',
    entityType: 'Others',
    applicantAddress: '84 Lodhi Estate, New Delhi 110003, India',
    applicantContact: 'secretariat@ip-ayush-coalition.org',
    inventionTitle: 'Opposition to Patent Application for "Medicinal Curcumin Formulation"',
    filingDate: new Date().toISOString().slice(0, 10),
    description:
      'The opponent submits that the claims in impugned application IN202311054321 lack novelty and inventive step under Section 2(1)(j) and Section 2(1)(ja) of the Patents Act, 1970, and directly fall within the statutory exclusion of Section 3(p) as an invention which, in effect, is traditional knowledge. Curcumin extracts for inflammatory treatment have been well-documented in classical Ayurvedic texts including Charaka Samhita (Sutra Sthana 27/296) and indexed under TKDL accession numbers RS/2341 and HA/1098. The claimed formulation merely aggregates known properties without synergistic efficacy.',
    claimsText: '',
    respondentName: 'PharmaCorp International AG',
    applicationNumber: 'IN202311054321',
  },
}

/* ------------------------------------------------------------------
   Deterministic Client-Side Fallback Generator (Active if Backend Offline)
   ------------------------------------------------------------------ */
function generateLocalFallbackDraft(payload) {
  const tpl = payload.template_type
  const dateStr = payload.filing_date || new Date().toISOString().slice(0, 10)
  const sections = []
  let documentTitle
  let formReference

  if (tpl === 'form_1') {
    documentTitle = 'APPLICATION FOR GRANT OF PATENT (FORM 1)'
    formReference = 'Patents Rules, 2003 — Form 1 (Section 7, 54 & 135; Rule 20(1))'

    sections.push({
      heading: "1. APPLICANT'S REFERENCE / IDENTIFICATION OF APPLICATION",
      body: `Type of Application: ORDINARY APPLICATION.\nApplicant's Reference No.: REF-${Date.now().toString().slice(-6)}\nIntended Date of Filing: ${dateStr}`,
    })
    sections.push({
      heading: '2. TYPE OF APPLICATION',
      body: '[X] Ordinary Application    [ ] Convention Application    [ ] PCT National Phase\n[ ] Divisional Application    [ ] Patent of Addition',
    })
    sections.push({
      heading: '3. APPLICANT(S) PARTICULARS',
      body: `Full Legal Name: ${payload.applicant_name}\nNationality: Indian\nCountry of Residence: India\nPostal Address: ${payload.applicant_address || 'Address provided on record'}\nCategory: Natural Person / Startup / Small Entity`,
    })
    sections.push({
      heading: '4. INVENTOR(S)',
      body: `Are all the inventor(s) same as applicant(s)?  [X] Yes   [ ] No\nFull Name: ${payload.applicant_name}\nNationality: Indian\nAddress: ${payload.applicant_address || 'Address on record'}`,
    })
    sections.push({
      heading: '5. TITLE OF THE INVENTION',
      body: payload.invention_title,
    })
    sections.push({
      heading: '6. ADDRESS FOR SERVICE OF APPLICANT / REGISTERED AGENT IN INDIA',
      body: `Address for Service: ${payload.applicant_address || 'Address on record'}\nRegistered Patent Agent: [TO BE COMPLETED BY REGISTERED PATENT AGENT]\nIN/PA Reg No.: [TO BE COMPLETED]`,
    })
    sections.push({
      heading: '7. FIELD OF THE INVENTION & TECHNICAL ADVANCEMENT',
      body: `The present invention relates to:\n\n${payload.description}`,
    })
    sections.push({
      heading: '8. BACKGROUND AND TKDL COMPLIANCE STATEMENT',
      body: `The applicant asserts that the invention satisfies the requirements of novelty and inventive step under Sections 2(1)(j) and 2(1)(ja) of the Patents Act, 1970.\n\nWhere the subject matter is derived from or relates to Ayurvedic knowledge, the applicant confirms that the claimed formulation demonstrates technical advancement and synergistic efficacy, avoiding statutory bars under Section 3(d) or Section 3(p). Prior-art Freedom-to-Operate search against the Traditional Knowledge Digital Library (TKDL) is verified prior to complete specification filing.`,
    })

    const claimsList = payload.claims && payload.claims.length > 0
      ? payload.claims
      : ['A composition or process as herein described and illustrated by the accompanying specification.']
    sections.push({
      heading: '9. CLAIMS (PROVISIONAL SCAFFOLD)',
      body: `The scope of protection sought is defined by the following initial claims:\n\n` +
        claimsList.map((c, i) => `  Claim ${i + 1}: ${c}`).join('\n\n'),
    })
    sections.push({
      heading: '10. DECLARATION BY THE APPLICANT(S)',
      body: `I/We, the applicant(s) named herein, do hereby declare that:\n(a) I/We am/are in possession of the above-mentioned invention;\n(b) The provisional/complete specification relating to the invention is filed herewith;\n(c) The invention as disclosed in the specification uses biological material from India and the necessary permission from the National Biodiversity Authority shall be furnished prior to grant of the patent.`,
    })
  } else if (tpl === 'nba') {
    documentTitle = 'APPLICATION FOR ACCESS TO BIOLOGICAL RESOURCES (FORM III)'
    formReference = 'Biological Diversity Act, 2002 — Section 6, Form III (Rule 17)'

    sections.push({
      heading: '1. APPLICANT DETAILS & STATUTORY CLASSIFICATION',
      body: `Name: ${payload.applicant_name}\nAddress: ${payload.applicant_address || 'Address on record'}\nLegal Classification: Entity seeking Intellectual Property Rights based on Indian Biological Resources or Traditional Knowledge under Section 6 of Biological Diversity Act, 2002.`,
    })
    sections.push({
      heading: '2. TITLE OF THE INVENTION / IP APPLICATION',
      body: payload.invention_title,
    })
    sections.push({
      heading: '3. BIOLOGICAL RESOURCES AND ASSOCIATED TRADITIONAL KNOWLEDGE (TK)',
      body: `Details of Biological Material and Traditional Knowledge Disclosed:\n\n${payload.description}`,
    })
    sections.push({
      heading: '4. SOURCE AND ACCESS DETAILS',
      body: `Geographical Origin: Collected/procured within the territory of India.\nPrior Informed Consent (PIC): To be coordinated through concerned State Biodiversity Board (SBB) / Local Biodiversity Management Committee (BMC).`,
    })
    sections.push({
      heading: '5. BENEFIT SHARING & COMPLIANCE UNDERTAKING',
      body: `The applicant undertakes to comply with all terms and conditions of Access and Benefit Sharing (ABS) determined by the National Biodiversity Authority under Regulation 2014, including upfront or royalty sharing where commercial benefits accrue.`,
    })
    sections.push({
      heading: '6. VERIFICATION AND AFFIDAVIT',
      body: `I, ${payload.applicant_name}, do hereby state and verify that the contents of this statutory application are true to my personal knowledge, that no biological material has been accessed in violation of the Biological Diversity Act, 2002, and that this application is submitted for formal sanction.`,
    })
  } else {
    documentTitle = 'PRE-GRANT OPPOSITION PETITION (SECTION 3(p) & 25(1))'
    formReference = 'Patents Act, 1970 — Section 25(1) read with Section 3(p) and Rule 55'

    sections.push({
      heading: '1. BEFORE THE CONTROLLER OF PATENTS',
      body: `In the matter of Patents Act, 1970;\nAnd in the matter of Patents Rules, 2003;\nAnd in the matter of Pre-Grant Representation under Section 25(1);\nIn the matter of Patent Application No.: ${payload.application_number || 'IN-PENDING-APPLICATION'}\nFiled by: ${payload.respondent_name || 'The Patent Applicant / Respondent'}\nTitle: "${payload.invention_title}"`,
    })
    sections.push({
      heading: '2. OPPONENT / PERSON INTERESTED PARTICULARS',
      body: `Opponent: ${payload.applicant_name}\nAddress for Service: ${payload.applicant_address || 'New Delhi, India'}\nStatus: Person Interested / Public Stakeholder safeguarding Traditional Knowledge under Section 25(1).`,
    })
    sections.push({
      heading: '3. GROUNDS OF OPPOSITION UNDER SECTION 25(1)',
      body: `The Opponent respectfully opposes the grant of patent on the following statutory grounds:\n[X] Section 25(1)(e): The invention is obvious and clearly does not involve any inventive step.\n[X] Section 25(1)(f): The subject matter is not an invention within the meaning of this Act, or is not patentable under Section 3(p).\n[X] Section 25(1)(k): The complete specification does not disclose or wrongly mentions the source and geographical origin of biological material.`,
    })
    sections.push({
      heading: '4. STATEMENT OF CASE AND EVIDENCE OF TRADITIONAL KNOWLEDGE',
      body: `The grounds and evidence relied upon by the Opponent are detailed below:\n\n${payload.description}`,
    })
    sections.push({
      heading: '5. STATUTORY BAR UNDER SECTION 3(p)',
      body: `Section 3(p) of the Patents Act, 1970 expressly excludes from patentability "an invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components." The Opponent submits that the claimed formulations merely duplicate established Ayurvedic therapeutic properties documented in classical treatises and indexed in the TKDL.`,
    })
    sections.push({
      heading: '6. PRAYER FOR RELIEF',
      body: `The Opponent prays that:\n(a) The Controller be pleased to refuse grant of patent in respect of Application No. ${payload.application_number || 'IN-PENDING'};\n(b) The Opponent be granted an oral hearing under Rule 55 before passing any final orders;\n(c) Any other relief deemed just and equitable in the interest of preserving sovereign traditional knowledge be granted.`,
    })
  }

  // Flatten plain text
  const lines = []
  lines.push('='.repeat(72))
  lines.push(documentTitle.toUpperCase())
  lines.push(`(${formReference})`)
  lines.push('='.repeat(72))
  lines.push('')

  for (const sec of sections) {
    lines.push(sec.heading)
    lines.push('-'.repeat(sec.heading.length))
    lines.push(sec.body)
    lines.push('')
  }

  const disclaimer =
    'This document is an auto-generated informational draft, not a filed legal instrument or formal legal advice. It must be reviewed, corrected, and signed by a registered patent agent or qualified IP professional before submission to any authority.'

  lines.push('-'.repeat(72))
  lines.push('DISCLAIMER: ' + disclaimer)
  lines.push('-'.repeat(72))

  return {
    template_type: tpl,
    document_title: documentTitle,
    form_reference: formReference,
    generated_at: new Date().toISOString(),
    sections,
    plain_text: lines.join('\n'),
    disclaimer,
  }
}

export default function DraftGenerator({ onBack }) {
  const [templateType, setTemplateType] = useState('form_1')
  const [applicantName, setApplicantName] = useState('')
  const [entityType, setEntityType] = useState('Startup / Small Entity')
  const [applicantAddress, setApplicantAddress] = useState('')
  const [applicantContact, setApplicantContact] = useState('')
  const [inventionTitle, setInventionTitle] = useState('')
  const [filingDate, setFilingDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [claimsText, setClaimsText] = useState('')
  const [respondentName, setRespondentName] = useState('')
  const [applicationNumber, setApplicationNumber] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [viewDetailsMap, setViewDetailsMap] = useState({})

  const activeTemplate = useMemo(
    () => TEMPLATES.find((tpl) => tpl.id === templateType) || TEMPLATES[0],
    [templateType],
  )

  // Stepper progress indicator: 1 = choose template, 2 = enter details, 3 = preview
  const currentStep = result ? 3 : applicantName.trim() ? 2 : 1

  const canSubmit =
    applicantName.trim().length >= 2 &&
    inventionTitle.trim().length >= 3 &&
    filingDate.trim().length > 0 &&
    description.trim().length >= 10 &&
    !loading

  // Pre-fill sample data
  const handleFillSample = (tplId = templateType) => {
    const s = SAMPLE_DATA[tplId] || SAMPLE_DATA.form_1
    setTemplateType(tplId)
    setApplicantName(s.applicantName)
    setEntityType(s.entityType)
    setApplicantAddress(s.applicantAddress)
    setApplicantContact(s.applicantContact)
    setInventionTitle(s.inventionTitle)
    setFilingDate(s.filingDate)
    setDescription(s.description)
    setClaimsText(s.claimsText)
    setRespondentName(s.respondentName)
    setApplicationNumber(s.applicationNumber)
    setError('')
    setResult(null)
  }

  const handleGenerate = async () => {
    setError('')
    setResult(null)
    setCopied(false)

    if (!canSubmit) {
      setError('Please provide an applicant/opponent name, title, filing date, and at least 10 characters in the description.')
      return
    }

    const claims =
      activeTemplate.showClaims && claimsText.trim()
        ? claimsText
            .split('\n')
            .map((c) => c.trim())
            .filter(Boolean)
        : null

    const payload = {
      template_type: templateType,
      applicant_name: applicantName.trim(),
      invention_title: inventionTitle.trim(),
      filing_date: filingDate.trim(),
      description: description.trim(),
      claims,
      applicant_address: applicantAddress.trim() || null,
      respondent_name: activeTemplate.showRespondent ? respondentName.trim() || null : null,
      application_number: activeTemplate.showRespondent ? applicationNumber.trim() || null : null,
    }

    setLoading(true)
    try {
      let data = null
      try {
        const token = localStorage.getItem('ip_sakti_access_token')
        const response = await fetch(`${API_BASE}/api/drafts/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          data = await response.json()
        }
      } catch (networkErr) {
        console.warn('Backend API unavailable, executing client-side statutory generator:', networkErr.message)
      }

      // If backend didn't return or was offline, use deterministic legal generator
      if (!data) {
        data = generateLocalFallbackDraft(payload)
      }

      setResult(data)

      // Smooth scroll to preview panel
      setTimeout(() => {
        const el = document.getElementById('dg-preview-anchor')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      setError(err.message || 'Failed to generate draft. Please check form inputs.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.plain_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard. Please select and copy manually.')
    }
  }

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob([result.plain_text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeTitle = (result.document_title || 'statutory-draft')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
    a.href = url
    a.download = `${safeTitle || 'draft'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(result.template_type || 'draft')}-payload.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setResult(null)
    setError('')
    setCopied(false)
  }

  const toggleDetails = (id) => {
    setViewDetailsMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Compute text statistics for the document preview
  const stats = useMemo(() => {
    if (!result || !result.plain_text) return { words: 0, chars: 0, sections: 0 }
    const words = result.plain_text.trim().split(/\s+/).filter(Boolean).length
    const chars = result.plain_text.length
    const sections = (result.sections || []).length
    return { words, chars, sections }
  }, [result])

  return (
    <div className="dg-container">
      {/* Top Utility Navigation Strip */}
      <div className="dg-top-strip">
        <div className="dg-breadcrumbs">
          <Link to="/" className="dg-breadcrumb-link" onClick={onBack}>
            <span>←</span>
            <span>Back to Portal</span>
          </Link>
          <span className="dg-breadcrumb-sep">/</span>
          <span className="dg-breadcrumb-link">IP Tools</span>
          <span className="dg-breadcrumb-sep">/</span>
          <span className="dg-breadcrumb-active">Statutory Document Preparation Assistant</span>
        </div>
        <div className="dg-top-actions">
          <Link to="/workspace" className="dg-portal-link" title="Open Matter Workspace">
            <span>📁</span>
            <span>Matter Workspace</span>
          </Link>
          <Link to="/chat" className="dg-portal-link" title="Consult RagVyn AI">
            <span>✨</span>
            <span>Ask RagVyn AI</span>
          </Link>
        </div>
      </div>

      <div className="dg-content">
        {/* 1. TOP PAGE HEADER */}
        <header className="dg-header">
          <div className="dg-header-left">
            <div className="dg-header-icon-box" aria-hidden="true">
              <IconFileText size={24} />
            </div>
            <div className="dg-header-titles">
              <span className="dg-category-chip">IP DOCUMENT TOOL</span>
              <h1>Statutory Document Preparation Assistant</h1>
              <p className="dg-header-subtitle">
                Prepare structured statutory drafts and filing-ready documents for Indian IP and biodiversity requirements.
              </p>
            </div>
          </div>

          <div className="dg-header-right">
            <div className="dg-est-time-badge" title="Estimated preparation duration">
              <span>⚡</span>
              <span>~3 min draft generation</span>
            </div>
            <button
              type="button"
              className="dg-btn-secondary"
              onClick={() => handleFillSample(templateType)}
              title="Auto-fill high quality statutory demonstration data"
            >
              <span>🧪</span>
              <span>Fill Sample Data</span>
            </button>
          </div>
        </header>

        {/* 2. HERO / TOOL INTRO CARD */}
        <section className="dg-hero-card">
          <div>
            <span className="dg-hero-badge">STATUTORY DOCUMENT PREPARATION</span>
            <h2 className="dg-hero-heading">Prepare your statutory document</h2>
            <p className="dg-hero-desc">
              Generate structured, pre-formatted draft templates for Patent Form-1, NBA approval applications, and Section 3(p) pre-grant oppositions with statutory declarations formatted for patent agent review.
            </p>
            <div className="dg-hero-highlights">
              <div className="dg-hero-highlight-item">
                <span className="dg-hero-highlight-dot">✓</span>
                <span>Standardized Statutory Drafting</span>
              </div>
              <div className="dg-hero-highlight-item">
                <span className="dg-hero-highlight-dot">✓</span>
                <span>Section 3(p) & TKDL Safeguards</span>
              </div>
              <div className="dg-hero-highlight-item">
                <span className="dg-hero-highlight-dot">✓</span>
                <span>Filing-Ready Agent Scaffolds</span>
              </div>
            </div>
          </div>
          <div className="dg-hero-illustration" aria-hidden="true">
            ⚖️
          </div>
        </section>

        {/* 3. STEP-BY-STEP WORKFLOW */}
        <section className="dg-stepper-card" aria-label="Workflow progress">
          <div className="dg-stepper-track">
            <div
              className={`dg-step-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
              onClick={() => {
                const el = document.getElementById('dg-template-selection')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <div className="dg-step-number-box">
                {currentStep > 1 ? '✓' : '01'}
              </div>
              <div className="dg-step-meta">
                <span className="dg-step-title">Select Template</span>
                <span className="dg-step-desc">Choose statutory instrument</span>
              </div>
            </div>

            <div
              className={`dg-step-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
              onClick={() => {
                const el = document.getElementById('dg-form-section')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <div className="dg-step-number-box">
                {currentStep > 2 ? '✓' : '02'}
              </div>
              <div className="dg-step-meta">
                <span className="dg-step-title">Enter Details</span>
                <span className="dg-step-desc">Applicant, invention & bio-data</span>
              </div>
            </div>

            <div
              className={`dg-step-item ${currentStep === 3 ? 'active' : ''}`}
              onClick={() => {
                const el = document.getElementById('dg-preview-anchor')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <div className="dg-step-number-box">
                {result ? '✓' : '03'}
              </div>
              <div className="dg-step-meta">
                <span className="dg-step-title">Generate Draft</span>
                <span className="dg-step-desc">Export structured legal draft</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. DOCUMENT TEMPLATE SELECTION */}
        <section className="dg-section-card" id="dg-template-selection">
          <div className="dg-section-header">
            <h2 className="dg-section-title">Choose a document</h2>
            <p className="dg-section-subtitle">
              Select the statutory instrument that matches your filing or regulatory opposition requirement.
            </p>
          </div>

          <div className="dg-templates-grid">
            {TEMPLATES.map((tpl) => {
              const isSelected = templateType === tpl.id
              const showDet = !!viewDetailsMap[tpl.id]

              return (
                <div
                  key={tpl.id}
                  className={`dg-template-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setTemplateType(tpl.id)
                    setResult(null)
                    setError('')
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setTemplateType(tpl.id)
                      setResult(null)
                    }
                  }}
                >
                  <div>
                    <div className="dg-template-top">
                      <div className="dg-template-icon-wrap" aria-hidden="true">
                        <span>{tpl.icon}</span>
                      </div>
                      <div className="dg-template-radio" aria-label={`Select ${tpl.label}`}>
                        {isSelected && <span className="dg-template-radio-dot" />}
                      </div>
                    </div>

                    <span className="dg-template-tag">{tpl.category}</span>
                    <h3 className="dg-template-name">{tpl.label}</h3>
                    <div className="dg-template-ref">{tpl.reference}</div>
                    <p className="dg-template-desc">{tpl.subtitle}</p>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--dg-card-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--dg-text-muted)', fontWeight: 600 }}>
                        {isSelected ? '✓ Selected for drafting' : 'Click to select'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDetails(tpl.id)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--dg-purple)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {showDet ? 'Hide details' : 'View details'}
                      </button>
                    </div>

                    {showDet && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--dg-text-body)', background: 'var(--dg-bg)', padding: '8px 10px', borderRadius: 6 }}>
                        <strong>Best suited for:</strong> {tpl.suitableFor}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 5. ENTITY & INNOVATION DETAILS (FORM) */}
        <section className="dg-section-card" id="dg-form-section">
          <div className="dg-section-header">
            <h2 className="dg-section-title">Innovation & Entity Details</h2>
            <p className="dg-section-subtitle">
              Provide accurate applicant and invention details required for the selected statutory instrument ({activeTemplate.label}).
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleGenerate()
            }}
            className="dg-form-groups"
          >
            {/* Group 1: Applicant / Opponent Information */}
            <div className="dg-form-group-card">
              <div className="dg-group-header">
                <span className="dg-group-badge">👤</span>
                <h3 className="dg-group-title">
                  {templateType === '3p_petition' ? 'Opponent / Petitioner Information' : 'Applicant Information'}
                </h3>
              </div>

              <div className="dg-form-grid-2">
                <div className="dg-form-field">
                  <label htmlFor="dg-applicant" className="dg-label">
                    <span>{templateType === '3p_petition' ? 'Opponent Legal Name' : 'Applicant / Innovator Name'}</span>
                    <span className="dg-req-star">*</span>
                  </label>
                  <input
                    id="dg-applicant"
                    type="text"
                    className="dg-input"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="e.g. Dr. Anjali Sharma / Arogya Labs Pvt Ltd"
                    required
                  />
                  <span className="dg-field-hint">Full legal entity or individual inventor name</span>
                </div>

                <div className="dg-form-field">
                  <label htmlFor="dg-entity-type" className="dg-label">
                    <span>Entity Category / Legal Status</span>
                  </label>
                  <select
                    id="dg-entity-type"
                    className="dg-select"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                  >
                    <option value="Natural Person">Natural Person (Individual Inventor)</option>
                    <option value="Startup / Small Entity">Startup / Small Entity (MSME)</option>
                    <option value="Educational Institution">Educational / University Institution</option>
                    <option value="Others">Others (Large Entity / Corporation / NGO)</option>
                  </select>
                  <span className="dg-field-hint">Affects official statutory fee computation under Patents Rules</span>
                </div>

                <div className="dg-form-field full-width">
                  <label htmlFor="dg-address" className="dg-label">
                    <span>{templateType === '3p_petition' ? 'Address for Service in India' : 'Postal Address in India'}</span>
                  </label>
                  <input
                    id="dg-address"
                    type="text"
                    className="dg-input"
                    value={applicantAddress}
                    onChange={(e) => setApplicantAddress(e.target.value)}
                    placeholder="e.g. Sector 10, Jankipuram Extension, Lucknow 226031, Uttar Pradesh, India"
                  />
                  <span className="dg-field-hint">Required for official correspondence from the Indian Patent Office / NBA</span>
                </div>

                <div className="dg-form-field full-width">
                  <label htmlFor="dg-contact" className="dg-label">
                    <span>Contact Information (Email / Phone)</span>
                  </label>
                  <input
                    id="dg-contact"
                    type="text"
                    className="dg-input"
                    value={applicantContact}
                    onChange={(e) => setApplicantContact(e.target.value)}
                    placeholder="e.g. counsel@ip-sakti.org | +91 11 2345 6789"
                  />
                </div>
              </div>
            </div>

            {/* Group 2: Innovation / Patent Specification */}
            <div className="dg-form-group-card">
              <div className="dg-group-header">
                <span className="dg-group-badge">⚙️</span>
                <h3 className="dg-group-title">
                  {templateType === '3p_petition' ? 'Target Patent Particulars' : 'Innovation / Patent Particulars'}
                </h3>
              </div>

              <div className="dg-form-grid-2">
                <div className="dg-form-field full-width">
                  <label htmlFor="dg-title" className="dg-label">
                    <span>{templateType === '3p_petition' ? 'Title of Impugned Patent Application' : 'Invention / Application Title'}</span>
                    <span className="dg-req-star">*</span>
                  </label>
                  <input
                    id="dg-title"
                    type="text"
                    className="dg-input"
                    value={inventionTitle}
                    onChange={(e) => setInventionTitle(e.target.value)}
                    placeholder="e.g. A Synergistic Nano-Formulation of Withania Somnifera with Enhanced Bioavailability"
                    required
                  />
                  <span className="dg-field-hint">Clear, descriptive title matching technical content (min 3 characters)</span>
                </div>

                <div className="dg-form-field">
                  <label htmlFor="dg-date" className="dg-label">
                    <span>{templateType === '3p_petition' ? 'Date of Representation' : 'Intended Filing Date'}</span>
                    <span className="dg-req-star">*</span>
                  </label>
                  <input
                    id="dg-date"
                    type="date"
                    className="dg-input"
                    value={filingDate}
                    onChange={(e) => setFilingDate(e.target.value)}
                    required
                  />
                </div>

                {/* Conditional Fields for Section 3(p) Opposition */}
                {activeTemplate.showRespondent && (
                  <>
                    <div className="dg-form-field">
                      <label htmlFor="dg-appno" className="dg-label">
                        <span>Impugned Patent Application No.</span>
                      </label>
                      <input
                        id="dg-appno"
                        type="text"
                        className="dg-input"
                        value={applicationNumber}
                        onChange={(e) => setApplicationNumber(e.target.value)}
                        placeholder="e.g. IN202311054321"
                      />
                      <span className="dg-field-hint">Official application number being formally challenged</span>
                    </div>

                    <div className="dg-form-field full-width">
                      <label htmlFor="dg-respondent" className="dg-label">
                        <span>Respondent Name (Patent Applicant Being Opposed)</span>
                      </label>
                      <input
                        id="dg-respondent"
                        type="text"
                        className="dg-input"
                        value={respondentName}
                        onChange={(e) => setRespondentName(e.target.value)}
                        placeholder="e.g. Global Nutra Pharma AG"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Group 3: Technical Description & Biodiversity Grounds */}
            <div className="dg-form-group-card">
              <div className="dg-group-header">
                <span className="dg-group-badge">📝</span>
                <h3 className="dg-group-title">
                  {templateType === 'nba'
                    ? 'Biological Resource Origin & Access Disclosures'
                    : templateType === '3p_petition'
                    ? 'Statement of Case & Traditional Knowledge (TKDL) Prior Art'
                    : 'Technical Field & Invention Summary'}
                </h3>
              </div>

              <div className="dg-form-field full-width">
                <label htmlFor="dg-description" className="dg-label">
                  <span>{activeTemplate.descriptionLabel}</span>
                  <span className="dg-req-star">*</span>
                </label>
                <textarea
                  id="dg-description"
                  className="dg-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={activeTemplate.descriptionHint}
                  rows={5}
                  required
                />
                <span className="dg-field-hint">
                  Minimum 10 characters required. The technical text will be formatted directly into statutory document body sections.
                </span>
              </div>
            </div>

            {/* Group 4: Patent Claims & Disclosures (Shown for Patent Form 1) */}
            {activeTemplate.showClaims && (
              <div className="dg-form-group-card">
                <div className="dg-group-header">
                  <span className="dg-group-badge">📋</span>
                  <h3 className="dg-group-title">Statutory Patent Claims Scaffold</h3>
                </div>

                <div className="dg-form-field full-width">
                  <label htmlFor="dg-claims" className="dg-label">
                    <span>Initial Patent Claims (One claim per line)</span>
                  </label>
                  <textarea
                    id="dg-claims"
                    className="dg-textarea"
                    value={claimsText}
                    onChange={(e) => setClaimsText(e.target.value)}
                    placeholder={
                      '1. A synergistic herbal nano-formulation comprising a standardized extract of Withania somnifera...\n2. The formulation of claim 1, wherein the mean nanoparticle size is between 120 nm and 180 nm.\n3. A method of preparing the formulation of claim 1 comprising high-pressure homogenization.'
                    }
                    rows={4}
                  />
                  <span className="dg-field-hint">
                    Each line becomes a numbered statutory claim in the generated draft. Leave blank to insert a standard placeholder claim scaffold.
                  </span>
                </div>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="dg-error-banner" role="alert">
                <IconAlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* 8. PRIMARY CTA */}
            <div className="dg-cta-bar">
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="dg-btn-generate"
                id="dg-primary-cta"
              >
                {loading ? (
                  <>
                    <span className="dg-btn-spinner" />
                    <span>Generating Statutory Draft…</span>
                  </>
                ) : (
                  <>
                    <IconSparkles size={16} />
                    <span>Generate Document</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* 6. DELIVERABLES ("What you'll receive") */}
        <section className="dg-section-card">
          <div className="dg-section-header">
            <h2 className="dg-section-title">What you'll receive</h2>
            <p className="dg-section-subtitle">
              Every generated instrument includes verified statutory structure and filing declarations ready for registered professional inspection.
            </p>
          </div>

          <div className="dg-deliverables-grid">
            <div className="dg-deliverable-card">
              <div className="dg-deliverable-icon-wrap">📋</div>
              <div className="dg-deliverable-content">
                <h4>Standardized Statutory Draft</h4>
                <p>Formatted according to official Indian Patent Office & NBA statutory filing rules.</p>
              </div>
            </div>

            <div className="dg-deliverable-card">
              <div className="dg-deliverable-icon-wrap">⚖️</div>
              <div className="dg-deliverable-content">
                <h4>Pre-populated Legal Clauses</h4>
                <p>Standard formal declarations, applicant verifications, and Section 3(p) non-infringement clauses.</p>
              </div>
            </div>

            <div className="dg-deliverable-card">
              <div className="dg-deliverable-icon-wrap">📄</div>
              <div className="dg-deliverable-content">
                <h4>Exportable Document Preview</h4>
                <p>Formatted digital sheet view with instant text copy and clean .txt file download.</p>
              </div>
            </div>

            <div className="dg-deliverable-card">
              <div className="dg-deliverable-icon-wrap">🛡️</div>
              <div className="dg-deliverable-content">
                <h4>Filing Checklist & Attachments</h4>
                <p>Clear audit checklist of required attachments including Form 2, 3, 5, and Form 26 Power of Attorney.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. DOCUMENT PREVIEW PANEL (Rendered when Result Exists) */}
        {result && (
          <div id="dg-preview-anchor" style={{ scrollMarginTop: 32 }}>
            <section className="dg-section-card" style={{ padding: '28px' }}>
              <div className="dg-section-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 className="dg-section-title">Generated Statutory Document</h2>
                    <p className="dg-section-subtitle">
                      Review, audit, and export your legal instrument below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="dg-btn-secondary"
                  >
                    <span>✕</span>
                    <span>Clear Result</span>
                  </button>
                </div>
              </div>

              <div className="dg-preview-layout">
                {/* Left Controls & Summary */}
                <div className="dg-preview-controls-card">
                  <div className="dg-preview-meta-top">
                    <span className="dg-category-chip" style={{ marginBottom: 6 }}>OFFICIAL DRAFT</span>
                    <h3>{result.document_title}</h3>
                    <p>{result.form_reference}</p>
                  </div>

                  <div className="dg-preview-stats">
                    <div className="dg-stat-item">
                      <span className="dg-stat-num">{stats.words}</span>
                      <span className="dg-stat-label">Total Words</span>
                    </div>
                    <div className="dg-stat-item">
                      <span className="dg-stat-num">{stats.sections}</span>
                      <span className="dg-stat-label">Sections</span>
                    </div>
                  </div>

                  <div className="dg-preview-btn-group">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`dg-btn-action ${copied ? 'copied' : 'primary-action'}`}
                    >
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      <span>{copied ? 'Copied to Clipboard' : 'Copy Full Draft'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      className="dg-btn-action"
                    >
                      <span>💾</span>
                      <span>Download .txt File</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="dg-btn-action"
                    >
                      <span>📦</span>
                      <span>Export JSON Payload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="dg-btn-action"
                    >
                      <span>🖨️</span>
                      <span>Print Document</span>
                    </button>
                  </div>

                  <div className="dg-checklist-box">
                    <div className="dg-checklist-title">
                      <span>✓</span>
                      <span>Registered Agent Checklist</span>
                    </div>
                    <ul>
                      <li>Verify Indian Patent Office jurisdiction branch</li>
                      <li>Affix physical/digital signature on Form 1</li>
                      <li>Attach Form 2 (Complete/Provisional Specification)</li>
                      <li>Include Form 3 (Statement of Foreign Applications)</li>
                      <li>Attach Form 5 (Declaration of Inventorship)</li>
                      <li>Include Form 26 (Power of Attorney if represented)</li>
                    </ul>
                  </div>
                </div>

                {/* Right Realistic Document Paper Sheet */}
                <article className="dg-paper-sheet">
                  <span className="dg-sheet-page-indicator">PAGE 1 OF 1 • STATUTORY DRAFT</span>

                  <header className="dg-sheet-header">
                    <div className="dg-sheet-emblem">🇮🇳</div>
                    <div className="dg-sheet-gov">GOVERNMENT OF INDIA</div>
                    <div className="dg-sheet-title">{result.document_title}</div>
                    <div className="dg-sheet-ref">{result.form_reference}</div>
                  </header>

                  <div className="dg-sheet-sections">
                    {result.sections.map((sec, idx) => (
                      <section key={idx} className="dg-sheet-section">
                        <div className="dg-sheet-section-heading">{sec.heading}</div>
                        <pre className="dg-sheet-section-body">{sec.body}</pre>
                      </section>
                    ))}
                  </div>

                  {/* Verification & Signature Line */}
                  <div className="dg-sheet-verification">
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>
                        Dated this {new Date(filingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.7 }}>
                        Place: India
                      </p>
                    </div>
                    <div className="dg-sig-line">
                      Signature of the Applicant / Registered Patent Agent
                    </div>
                  </div>

                  {result.disclaimer && (
                    <footer style={{ marginTop: 28, paddingTop: 14, borderTop: '1px dashed rgba(0,0,0,0.15)', fontSize: 11, fontStyle: 'italic', opacity: 0.75 }}>
                      <strong>Disclaimer:</strong> {result.disclaimer}
                    </footer>
                  )}
                </article>
              </div>
            </section>
          </div>
        )}

        {/* 9. LEGAL DISCLAIMER */}
        <p className="dg-disclaimer">
          Information provided for guidance only — not legal advice. Always review statutory instruments with a registered patent agent or advocate before filing with the Indian Patent Office or National Biodiversity Authority.
        </p>
      </div>
    </div>
  )
}
