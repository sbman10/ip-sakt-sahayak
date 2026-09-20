import React, { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * PatentabilityAssessment — Specialized Evidence-Grounded Patentability & Prior-Art Assessment.
 *
 * Implements preliminary statutory and prior-art evaluation for AYUSH, herbal,
 * traditional knowledge (TKDL), and Indian patent law.
 *
 * Never renders a simplistic "patentable" or "not patentable" badge.
 * Instead produces cautious result categories, feature-by-feature comparison tables,
 * Section 3(p)/3(d)/3(e) statutory issue cards, and experimental evidence gap checklists.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const RESULT_CATEGORIES = {
  'Potentially distinguishable based on supplied information': {
    color: '#0D9488',
    bg: '#F0FDFA',
    border: '#14B8A6',
    icon: '✨',
    desc: 'Features may distinguish the formulation, subject to experimental confirmation and formal patent review.',
  },
  'Significant prior-art overlap identified': {
    color: '#E11D48',
    bg: '#FFF1F2',
    border: '#F43F5E',
    icon: '⚠️',
    desc: 'Substantial overlap with classical traditional knowledge (Section 3(p)) or prior publications.',
  },
  'Evidence insufficient for reliable assessment': {
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#F59E0B',
    icon: '⏳',
    desc: 'Critical dates or experimental comparators missing. Time-based prior-art filtering is incomplete.',
  },
  'Professional patent review required': {
    color: '#4F46E5',
    bg: '#EEF2FF',
    border: '#6366F1',
    icon: '⚖️',
    desc: 'High legal scrutiny under Indian Patents Act Sections 3(d), 3(e), or Biological Diversity Act Section 6.',
  },
}

export default function PatentabilityAssessment() {
  // Form State
  const [formData, setFormData] = useState({
    title: 'Ashwagandha & Piperine Sustained-Release Nanogel',
    problem_statement: 'Poor oral bioavailability and rapid clearance of Withanolides in classical Ayurvedic formulations.',
    ingredients: 'Ashwagandha root extract, Piperine',
    botanical_names: 'Withania somnifera, Piper nigrum',
    ingredient_amounts: '250mg Withania extract, 10mg Piperine',
    ingredient_ranges: '10-25% w/w actives',
    extract_type: 'Hydroalcoholic (70:30 ethanol:water)',
    standardisation_details: 'Withanolides >= 5.0% w/w by HPLC; Piperine >= 98%',
    excipients: 'Microcrystalline cellulose (MCC), Sodium alginate, Polysorbate 80',
    carrier_or_polymer_matrix: 'Sodium alginate-crosslinked bio-polymeric matrix',
    dosage_form: 'Sustained-release nanogel tablet',
    preparation_process: '1. Hydroalcoholic extraction at 50°C for 6 hours.\n2. Sonic dispersion with polysorbate surfactant.\n3. Complexation with sodium alginate matrix.\n4. Gelation and drying at 40°C.',
    extraction_solvent: 'Ethanol:Water 70:30',
    extraction_temperature: '50°C',
    extraction_duration: '6 hours',
    mixing_order: 'Extract -> Surfactant -> Alginate solution -> Crosslinker',
    pH: '6.4 - 6.8',
    curing_or_gelation_conditions: 'Calcium chloride 2% w/v crosslinking for 30 mins',
    release_profile: '8-hour zero-order sustained release profile (85% release in 8 hours)',
    retention_or_adhesion_data: 'Mucoadhesive detachment force 1.4 N/cm2',
    bioavailability_data: 'Claimed 3.5x fold increase in Withanolide A plasma AUC in preliminary rodent model',
    pharmacological_or_technical_effect: 'Synergistic bioavailability enhancement and continuous 8-hour plasma concentration',
    intended_use: 'Management of generalized anxiety and neurocognitive stress',
    jurisdiction: 'India',
    earliest_invention_date: '2024-01-15',
    priority_date: '2024-04-10',
    first_public_disclosure_date: '',
    public_disclosure_details: '',
    biological_resource_source: 'Plant roots (Withania somnifera) and fruit (Piper nigrum)',
    geographic_source: 'Madhya Pradesh (Neemuch district), India',
    cultivation_or_wild_source: 'Cultivated agricultural plantation',
  })

  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [activeTab, setActiveTab] = useState('summary')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('doc_category', 'experimental_report')
      data.append('description', 'User uploaded supporting data')

      const res = await fetch(`${API_BASE}/api/patentability/upload`, {
        method: 'POST',
        body: data,
      })

      if (!res.ok) throw new Error('Upload failed')
      const docRef = await res.json()
      setUploadedFiles((prev) => [...prev, docRef])
    } catch (err) {
      setError(`Failed to upload file: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setError('Please provide an invention title.')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)

    try {
      const payload = {
        ...formData,
        uploaded_supporting_documents: uploadedFiles,
      }

      const res = await fetch(`${API_BASE}/api/patentability/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Assessment request failed (HTTP ${res.status})`)
      }

      const reportData = await res.json()
      setReport(reportData)
    } catch (err) {
      setError(err.message || 'Could not connect to assessment engine. Verify backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const catStyle = report ? (RESULT_CATEGORIES[report.result_category] || RESULT_CATEGORIES['Professional patent review required']) : null

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Navigation & Header */}
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← Back to IP-SAKTI Home</Link>
          <div style={styles.headerBadge}>SPECIALIZED WORKFLOW</div>
          <h1 style={styles.title}>Patentability & Prior-Art Assessment Engine</h1>
          <p style={styles.subtitle}>
            Evidence-grounded preliminary assessment under Indian Patents Act 1970 (§ 3(p), 3(d), 3(e)),
            Biological Diversity Act 2002 (§ 6), and Traditional Knowledge Digital Library (TKDL) standards.
          </p>
          <div style={styles.limitationNotice}>
            <strong>Statutory Caution:</strong> This automated workflow produces preliminary evidence-based observations.
            It does not issue final legal decisions ("patentable" / "not patentable") or replace formal examination by the Indian Patent Office (IPO).
          </div>
        </div>

        {/* Main Grid: Form on Left, Output on Right */}
        <div style={styles.mainGrid}>
          {/* LEFT: Structured Intake Form */}
          <div style={styles.formCard}>
            <h2 style={styles.sectionHeader}>Invention Formulation Intake</h2>
            <p style={styles.formHint}>Provide detailed formulation architecture and processing parameters for an evidence-grounded evaluation.</p>

            <form onSubmit={handleSubmit}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Invention Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Problem Statement / Unmet Need</label>
                <textarea
                  name="problem_statement"
                  value={formData.problem_statement}
                  onChange={handleChange}
                  rows={2}
                  style={styles.textarea}
                />
              </div>

              {/* Composition */}
              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Active Ingredients</label>
                  <input
                    type="text"
                    name="ingredients"
                    value={formData.ingredients}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. Ashwagandha, Turmeric"
                  />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Botanical Latin Names</label>
                  <input
                    type="text"
                    name="botanical_names"
                    value={formData.botanical_names}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. Withania somnifera"
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Ingredient Amounts</label>
                  <input
                    type="text"
                    name="ingredient_amounts"
                    value={formData.ingredient_amounts}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. 250mg, 10g"
                  />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Percentage / Ratio Ranges</label>
                  <input
                    type="text"
                    name="ingredient_ranges"
                    value={formData.ingredient_ranges}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. 10-25% w/w, 40:25:5"
                  />
                </div>
              </div>

              {/* Matrix & Delivery Architecture */}
              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Dosage Form</label>
                  <input
                    type="text"
                    name="dosage_form"
                    value={formData.dosage_form}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. Sustained-release tablet, Nanogel"
                  />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Carrier / Polymer Matrix</label>
                  <input
                    type="text"
                    name="carrier_or_polymer_matrix"
                    value={formData.carrier_or_polymer_matrix}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. Sodium alginate, MCC, PLGA"
                  />
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Standardisation Details (HPLC/Markers)</label>
                <input
                  type="text"
                  name="standardisation_details"
                  value={formData.standardisation_details}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="e.g. Withanolides >= 5%, Curcuminoids >= 95%"
                />
              </div>

              {/* Process & Parameters */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Preparation Process</label>
                <textarea
                  name="preparation_process"
                  value={formData.preparation_process}
                  onChange={handleChange}
                  rows={3}
                  style={styles.textarea}
                  placeholder="Step-by-step extraction and compounding steps..."
                />
              </div>

              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Extraction Solvent & Temp</label>
                  <input
                    type="text"
                    name="extraction_solvent"
                    value={formData.extraction_solvent}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. Hydroalcoholic 70:30, 50°C"
                  />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Release / Dissolution Profile</label>
                  <input
                    type="text"
                    name="release_profile"
                    value={formData.release_profile}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="e.g. 8-hour sustained release"
                  />
                </div>
              </div>

              {/* Claims & Technical Effects */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Claimed Pharmacological or Technical Effect</label>
                <input
                  type="text"
                  name="pharmacological_or_technical_effect"
                  value={formData.pharmacological_or_technical_effect}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="e.g. Synergistic bioavailability enhancement"
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Bioavailability / Measured Performance Data</label>
                <input
                  type="text"
                  name="bioavailability_data"
                  value={formData.bioavailability_data}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="e.g. 3.5x fold increase in AUC"
                />
              </div>

              {/* Legal & Dates */}
              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Earliest Invention Date</label>
                  <input
                    type="date"
                    name="earliest_invention_date"
                    value={formData.earliest_invention_date}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Priority Date</label>
                  <input
                    type="date"
                    name="priority_date"
                    value={formData.priority_date}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Biological Origin (NBA Compliance) */}
              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Geographic Origin of Herbs</label>
                  <input
                    type="text"
                    name="geographic_source"
                    value={formData.geographic_source}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="State, District, India"
                  />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Wild vs Cultivated</label>
                  <select
                    name="cultivation_or_wild_source"
                    value={formData.cultivation_or_wild_source}
                    onChange={handleChange}
                    style={styles.select}
                  >
                    <option value="Cultivated agricultural plantation">Cultivated Plantation</option>
                    <option value="Wild harvest from forest">Wild Harvest (Forest)</option>
                    <option value="Imported from foreign jurisdiction">Imported (Foreign)</option>
                  </select>
                </div>
              </div>

              {/* Supporting Document Upload */}
              <div style={styles.uploadSection}>
                <label style={styles.label}>Upload Supporting Lab / Formulation Docs</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  style={styles.fileInput}
                  disabled={uploading}
                />
                {uploading && <span style={styles.uploadStatus}>Sanitizing & indexing file...</span>}
                {uploadedFiles.length > 0 && (
                  <div style={styles.fileList}>
                    {uploadedFiles.map((f, i) => (
                      <div key={i} style={styles.fileItem}>
                        📄 {f.filename} <span style={styles.fileCat}>({f.doc_category})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div style={styles.errorAlert}>{error}</div>}

              <button
                type="submit"
                disabled={loading}
                style={loading ? { ...styles.submitBtn, opacity: 0.7 } : styles.submitBtn}
              >
                {loading ? 'Evaluating Prior Art & Statutes...' : 'Generate Evidence-Grounded Assessment →'}
              </button>
            </form>
          </div>

          {/* RIGHT: Results / Report View */}
          <div style={styles.resultCard}>
            {!report && !loading && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📋</div>
                <h3 style={styles.emptyTitle}>No Assessment Generated Yet</h3>
                <p style={styles.emptyDesc}>
                  Complete the structured formulation form on the left and click
                  <strong> Generate Assessment</strong> to run the multi-angle prior-art search,
                  Section 3(p)/3(d)/3(e) statutory checks, and feature comparison matrix.
                </p>
              </div>
            )}

            {loading && (
              <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <h3>Executing Grounded Patentability Analysis</h3>
                <p style={styles.loadingStep}>1. Scrubbing PII for DPDP compliance...</p>
                <p style={styles.loadingStep}>2. Extracting immutable invention fingerprint (F001, F002...)...</p>
                <p style={styles.loadingStep}>3. Querying dual vector engine (Qdrant & ChromaDB) across 9 controlled angles...</p>
                <p style={styles.loadingStep}>4. Building feature-by-feature prior-art comparison matrix...</p>
                <p style={styles.loadingStep}>5. Evaluating Indian statutory exclusions (Section 3(p), 3(d), 3(e), NBA § 6)...</p>
                <p style={styles.loadingStep}>6. Generating experimental evidence checklist and limitation notices...</p>
              </div>
            )}

            {report && (
              <div style={styles.reportContainer}>
                {/* Result Header & Category */}
                <div style={{ ...styles.categoryBadge, backgroundColor: catStyle.bg, borderColor: catStyle.border, color: catStyle.color }}>
                  <span style={styles.categoryIcon}>{catStyle.icon}</span>
                  <div>
                    <div style={styles.categoryTitle}>{report.result_category}</div>
                    <div style={styles.categoryDesc}>{catStyle.desc}</div>
                  </div>
                </div>

                {report.is_time_assessment_incomplete && (
                  <div style={styles.warningBanner}>
                    ⚠️ <strong>Temporal Prior-Art Notice:</strong> Priority or invention date is missing.
                    Later vs. earlier prior art cannot be definitively certified.
                  </div>
                )}

                {/* Report Tabs */}
                <div style={styles.tabsRow}>
                  <button
                    style={activeTab === 'summary' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
                    onClick={() => setActiveTab('summary')}
                  >
                    Invention & Features
                  </button>
                  <button
                    style={activeTab === 'pointers' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
                    onClick={() => setActiveTab('pointers')}
                  >
                    Prior-Art Pointers ({report.prior_art_pointers.length})
                  </button>
                  <button
                    style={activeTab === 'comparison' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
                    onClick={() => setActiveTab('comparison')}
                  >
                    Feature Comparison Table
                  </button>
                  <button
                    style={activeTab === 'statutes' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
                    onClick={() => setActiveTab('statutes')}
                  >
                    Statutory Issues (§ 3)
                  </button>
                  <button
                    style={activeTab === 'checklist' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
                    onClick={() => setActiveTab('checklist')}
                  >
                    Evidence Checklist
                  </button>
                  <button
                    style={activeTab === 'raw' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
                    onClick={() => setActiveTab('raw')}
                  >
                    Full Markdown Report
                  </button>
                </div>

                {/* TAB 1: Invention Understood & Feature Map */}
                {activeTab === 'summary' && (
                  <div style={styles.tabContent}>
                    <h3 style={styles.tabHeading}>1. Invention Understood</h3>
                    <div style={styles.summaryGrid}>
                      <div style={styles.summaryItem}><strong>Actives:</strong> {report.invention_summary.active_ingredients}</div>
                      <div style={styles.summaryItem}><strong>Dosage Form:</strong> {report.invention_summary.dosage_form}</div>
                      <div style={styles.summaryItem}><strong>Delivery Matrix:</strong> {report.invention_summary.delivery_system}</div>
                      <div style={styles.summaryItem}><strong>Jurisdiction:</strong> {report.invention_summary.jurisdiction}</div>
                      <div style={styles.summaryItem}><strong>Relevant Date:</strong> {report.invention_summary.relevant_date}</div>
                    </div>

                    <h3 style={{ ...styles.tabHeading, marginTop: 24 }}>2. Discrete Feature Map</h3>
                    <div style={styles.featureMap}>
                      {report.feature_map.map((feat) => (
                        <div key={feat.feature_id} style={styles.featureBadge}>
                          <span style={styles.featureId}>{feat.feature_id}</span>
                          <span style={styles.featureName}>{feat.feature_name}:</span>
                          <span style={styles.featureVal}>{feat.feature_value}</span>
                        </div>
                      ))}
                    </div>

                    {report.evidence_gaps.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <h4 style={styles.subHeading}>Critical Evidence Gaps</h4>
                        {report.evidence_gaps.map((gap, i) => (
                          <div key={i} style={styles.gapItem}>⚠️ {gap}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Prior-Art Pointers */}
                {activeTab === 'pointers' && (
                  <div style={styles.tabContent}>
                    <h3 style={styles.tabHeading}>Retrieved Prior-Art Documents</h3>
                    {report.prior_art_pointers.length === 0 ? (
                      <p style={styles.noData}>No matching document was identified in the indexed corpus. This is not a legal novelty opinion.</p>
                    ) : (
                      report.prior_art_pointers.map((p) => (
                        <div key={p.source_id} style={styles.pointerCard}>
                          <div style={styles.pointerHeader}>
                            <span style={styles.pointerSourceId}>[{p.source_id}]</span>
                            <strong style={styles.pointerTitle}>{p.title}</strong>
                            <span style={styles.pointerTag}>{p.date_category}</span>
                          </div>
                          <div style={styles.pointerMeta}>
                            <span>Authority: {p.authority}</span>
                            <span>Jurisdiction: {p.jurisdiction}</span>
                            <span>Published: {p.publication_date || 'N/A'}</span>
                            <span>Section: {p.relevant_section_or_page}</span>
                          </div>
                          <div style={styles.pointerFeatures}>
                            {p.matching_features.length > 0 && (
                              <div><strong style={{ color: '#047857' }}>Matching Features:</strong> {p.matching_features.join(', ')}</div>
                            )}
                            {p.missing_features.length > 0 && (
                              <div><strong style={{ color: '#B91C1C' }}>Missing Features:</strong> {p.missing_features.join(', ')}</div>
                            )}
                          </div>
                          <p style={styles.pointerWhy}>{p.why_relevant}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 3: Feature Comparison Matrix */}
                {activeTab === 'comparison' && (
                  <div style={styles.tabContent}>
                    <h3 style={styles.tabHeading}>Feature-by-Feature Prior-Art Comparison</h3>
                    <div style={styles.tableWrapper}>
                      <table style={styles.table}>
                        <thead>
                          <tr style={styles.tableHeaderRow}>
                            <th style={styles.th}>Feature</th>
                            <th style={styles.th}>User's Formulation</th>
                            <th style={styles.th}>Prior-Art Overlap</th>
                            <th style={styles.th}>Assessment Label</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.feature_comparison_table.map((row, idx) => (
                            <tr key={idx} style={styles.tr}>
                              <td style={styles.td}><strong>[{row.feature_id}]</strong> {row.feature_name}</td>
                              <td style={styles.td}>{row.user_formulation_value}</td>
                              <td style={styles.td}>
                                {row.feature_present ? (
                                  <span style={styles.overlapPresent}>Found in [{row.source_id}]</span>
                                ) : row.feature_uncertain ? (
                                  <span style={styles.overlapUncertain}>Partial in [{row.source_id}]</span>
                                ) : (
                                  <span style={styles.overlapAbsent}>Not found in [{row.source_id}]</span>
                                )}
                                {row.supporting_excerpt && (
                                  <div style={styles.excerpt}>"{row.supporting_excerpt}"</div>
                                )}
                              </td>
                              <td style={styles.td}>
                                <span style={styles.assessmentLabel}>{row.assessment_label}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 4: Statutory Legal Issues */}
                {activeTab === 'statutes' && (
                  <div style={styles.tabContent}>
                    <h3 style={styles.tabHeading}>Statutory Patentability Issues (Indian Patents Act 1970)</h3>
                    {report.preliminary_observations.map((issue, idx) => (
                      <div key={idx} style={styles.issueCard}>
                        <div style={styles.issueHeader}>
                          <span style={styles.issueTopic}>{issue.topic}</span>
                          <span style={styles.issueStatute}>{issue.statutory_basis}</span>
                          <span style={issue.risk_level === 'CRITICAL' || issue.risk_level === 'HIGH' ? styles.riskHigh : styles.riskMod}>
                            {issue.risk_level} RISK
                          </span>
                        </div>
                        <div style={styles.issueBody}>
                          <p><strong>Evidence Found:</strong> {issue.evidence_found}</p>
                          <p><strong>Statutory Interpretation:</strong> {issue.interpretation}</p>
                          <p style={{ color: '#B45309' }}><strong>Missing Information:</strong> {issue.missing_information}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 5: Evidence Checklist */}
                {activeTab === 'checklist' && (
                  <div style={styles.tabContent}>
                    <h3 style={styles.tabHeading}>Experimental Evidence & Proof Checklist</h3>
                    <p style={styles.formHint}>Required technical proofs to withstand FER examination objections under Sections 3(e) and 3(d).</p>
                    {report.recommended_next_steps.map((step, idx) => (
                      <div key={idx} style={styles.stepItem}>
                        <span style={styles.stepNum}>{idx + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 6: Full Raw Markdown Report */}
                {activeTab === 'raw' && (
                  <div style={styles.tabContent}>
                    <h3 style={styles.tabHeading}>Standardized Preliminary Assessment Report</h3>
                    <pre style={styles.rawMarkdown}>{report.markdown_report}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', backgroundColor: '#F8FAFC', padding: '24px 16px', fontFamily: 'Inter, system-ui, sans-serif' },
  container: { maxWidth: 1400, margin: '0 auto' },
  header: { marginBottom: 24 },
  backLink: { color: '#4F46E5', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  headerBadge: { display: 'inline-block', backgroundColor: '#EEF2FF', color: '#4338CA', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginTop: 12, letterSpacing: 0.5 },
  title: { fontSize: 28, fontWeight: 800, color: '#0F172A', margin: '8px 0' },
  subtitle: { fontSize: 15, color: '#475569', maxWidth: 800, lineHeight: 1.5 },
  limitationNotice: { marginTop: 12, padding: '10px 14px', backgroundColor: '#FEF3C7', borderLeft: '4px solid #F59E0B', color: '#92400E', fontSize: 13, borderRadius: 4 },

  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 24, alignItems: 'start' },
  formCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  sectionHeader: { fontSize: 18, fontWeight: 700, color: '#1E293B', marginBottom: 4 },
  formHint: { fontSize: 13, color: '#64748B', marginBottom: 16 },

  fieldGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 },
  input: { width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box', fontFamily: 'inherit' },
  select: { width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box', backgroundColor: '#FFF' },
  row: { display: 'flex', gap: 12 },

  uploadSection: { marginTop: 12, padding: 12, backgroundColor: '#F1F5F9', borderRadius: 6, border: '1px dashed #94A3B8' },
  fileInput: { fontSize: 12, marginTop: 4 },
  uploadStatus: { fontSize: 12, color: '#4338CA', marginLeft: 8 },
  fileList: { marginTop: 8 },
  fileItem: { fontSize: 12, color: '#334155' },
  fileCat: { color: '#64748B', fontStyle: 'italic' },

  errorAlert: { padding: '10px 14px', backgroundColor: '#FEE2E2', border: '1px solid #EF4444', color: '#B91C1C', borderRadius: 6, fontSize: 13, marginBottom: 14 },
  submitBtn: { width: '100%', padding: '12px 16px', backgroundColor: '#4F46E5', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },

  resultCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0', minHeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  emptyState: { textAlign: 'center', padding: '80px 24px' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#334155', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748B', maxWidth: 460, margin: '0 auto', lineHeight: 1.5 },

  loadingContainer: { textAlign: 'center', padding: '60px 20px' },
  spinner: { width: 40, height: 40, border: '4px solid #E2E8F0', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' },
  loadingStep: { fontSize: 13, color: '#64748B', margin: '4px 0' },

  reportContainer: {},
  categoryBadge: { display: 'flex', gap: 14, padding: '14px 18px', borderRadius: 8, border: '2px solid', marginBottom: 16 },
  categoryIcon: { fontSize: 28 },
  categoryTitle: { fontSize: 16, fontWeight: 800, marginBottom: 2 },
  categoryDesc: { fontSize: 13, opacity: 0.9 },
  warningBanner: { padding: '10px 14px', backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: 6, fontSize: 13, marginBottom: 16 },

  tabsRow: { display: 'flex', gap: 6, borderBottom: '1px solid #E2E8F0', paddingBottom: 8, marginBottom: 18, overflowX: 'auto' },
  tabBtn: { padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#64748B', backgroundColor: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' },
  activeTabBtn: { color: '#4F46E5', backgroundColor: '#EEF2FF' },

  tabContent: {},
  tabHeading: { fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 14 },
  subHeading: { fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 8 },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13, color: '#334155', backgroundColor: '#F8FAFC', padding: 14, borderRadius: 8 },
  summaryItem: { padding: '4px 0' },
  featureMap: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  featureBadge: { padding: '6px 10px', backgroundColor: '#F1F5F9', borderRadius: 6, fontSize: 12, border: '1px solid #CBD5E1' },
  featureId: { fontWeight: 800, color: '#4338CA', marginRight: 6 },
  featureName: { fontWeight: 600, color: '#1E293B', marginRight: 4 },
  featureVal: { color: '#475569' },
  gapItem: { fontSize: 13, color: '#B45309', padding: '6px 0' },

  pointerCard: { padding: 14, borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 12, backgroundColor: '#F8FAFC' },
  pointerHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  pointerSourceId: { fontWeight: 800, color: '#4338CA', fontSize: 13 },
  pointerTitle: { fontSize: 14, color: '#0F172A', flex: 1 },
  pointerTag: { fontSize: 11, backgroundColor: '#E2E8F0', padding: '2px 6px', borderRadius: 4, color: '#475569' },
  pointerMeta: { fontSize: 12, color: '#64748B', display: 'flex', gap: 14, marginBottom: 8 },
  pointerFeatures: { fontSize: 12, margin: '6px 0', lineHeight: 1.4 },
  pointerWhy: { fontSize: 12, color: '#334155', fontStyle: 'italic', margin: '4px 0 0' },
  noData: { fontSize: 13, color: '#64748B', fontStyle: 'italic' },

  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  tableHeaderRow: { backgroundColor: '#F1F5F9' },
  th: { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' },
  tr: { borderBottom: '1px solid #E2E8F0' },
  td: { padding: '10px 12px', verticalAlign: 'top', color: '#334155' },
  overlapPresent: { color: '#047857', fontWeight: 600 },
  overlapUncertain: { color: '#B45309', fontWeight: 600 },
  overlapAbsent: { color: '#64748B' },
  excerpt: { fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 4 },
  assessmentLabel: { fontSize: 11, padding: '2px 6px', backgroundColor: '#EEF2FF', color: '#4338CA', borderRadius: 4, fontWeight: 600 },

  issueCard: { padding: 14, borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 12, backgroundColor: '#FFF' },
  issueHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  issueTopic: { fontSize: 14, fontWeight: 700, color: '#0F172A', flex: 1 },
  issueStatute: { fontSize: 12, fontWeight: 600, color: '#4F46E5', backgroundColor: '#EEF2FF', padding: '2px 8px', borderRadius: 4 },
  riskHigh: { fontSize: 11, fontWeight: 700, color: '#DC2626', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: 4 },
  riskMod: { fontSize: 11, fontWeight: 700, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 6px', borderRadius: 4 },
  issueBody: { fontSize: 13, color: '#334155', lineHeight: 1.5 },

  stepItem: { display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13, color: '#334155' },
  stepNum: { width: 24, height: 24, borderRadius: '50%', backgroundColor: '#4F46E5', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },

  rawMarkdown: { padding: 16, backgroundColor: '#0F172A', color: '#E2E8F0', borderRadius: 8, fontSize: 12, overflowX: 'auto', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
}
