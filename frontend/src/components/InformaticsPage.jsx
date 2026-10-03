import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconBook,
  IconScroll,
  IconShield,
  IconLeaf,
  IconScales,
  IconFlask,
  IconCheck,
  IconSearch,
  IconExternalLink,
  IconArrowRight,
  IconFileText,
  IconInfo
} from './Icons'

/**
 * InformaticsPage — Official Statutory, Treaty & Regulatory Knowledge Portal
 * Grounded in verified Indian statutes, international treaties, and AYUSH regulatory frameworks.
 * Inspired by the official hierarchy, clarity, and accessibility of India.gov.in.
 */

const INFORMATICS_SECTIONS = [
  {
    id: 'patents',
    title: 'Patents & Patent Eligibility',
    badge: 'Statutes & Rules',
    icon: <IconScales size={20} />,
    description: 'Statutory provisions governing patentability, statutory bars on traditional knowledge, and patent office examination guidelines.',
    items: [
      {
        id: 'patents-sec-3p',
        title: 'Section 3(p) — Traditional Knowledge Bar',
        statute: 'The Patents Act, 1970 (as amended)',
        authority: 'Office of the Controller General of Patents, Designs and Trade Marks (CGPDTM)',
        summary: 'Explicitly excludes from patentability an invention which in effect is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components.',
        keyPoints: [
          'Direct Ayurvedic formulations known from classical texts cannot be patented as products.',
          'Novel extraction methods, synergistic combinations with demonstrated unexpected efficacy, or novel delivery mechanisms may overcome Section 3(p) if prior art is surmounted.',
          'Mandatory search against the Traditional Knowledge Digital Library (TKDL) during examination.'
        ],
        status: 'Active Statutory Provision',
        officialLink: '/sources?filter=patents'
      },
      {
        id: 'patents-sec-3d',
        title: 'Section 3(d) — Enhanced Therapeutic Efficacy Requirement',
        statute: 'The Patents Act, 1970 (as amended)',
        authority: 'CGPDTM / Supreme Court of India precedent',
        summary: 'The mere discovery of a new form of a known substance which does not result in the enhancement of the known efficacy of that substance is not patentable.',
        keyPoints: [
          'Derivatives, salts, polymorphs, and extracts of herbal substances must prove statistically significant enhanced therapeutic efficacy over the known herbal raw form.',
          'Comparative pharmacological data must be documented in the patent specification.'
        ],
        status: 'Active Statutory Provision',
        officialLink: '/sources?filter=patents'
      },
      {
        id: 'patents-sec-3e',
        title: 'Section 3(e) — Mere Admixture Bar',
        statute: 'The Patents Act, 1970 (as amended)',
        authority: 'CGPDTM',
        summary: 'A substance obtained by a mere admixture resulting only in the aggregation of the properties of the components thereof or a process for producing such substance is not patentable.',
        keyPoints: [
          'Combining two classical herbs (e.g. Ashwagandha + Turmeric) without proving unexpected synergy fails under Section 3(e).',
          'Synergistic interaction index (Chou-Talalay method or equivalent) should be demonstrated.'
        ],
        status: 'Active Statutory Provision',
        officialLink: '/sources?filter=patents'
      },
      {
        id: 'patents-tk-guidelines',
        title: 'Guidelines for Examination of Patent Applications relating to Traditional Knowledge',
        statute: 'CGPDTM Official Guidelines, 2012',
        authority: 'Ministry of Commerce & Industry / CGPDTM',
        summary: 'Standardized operational instructions for patent examiners when reviewing applications citing biological materials and Ayurvedic texts.',
        keyPoints: [
          'Establishes 10 screening guiding principles for evaluating novelty and inventive step in traditional knowledge.',
          'Mandates applicant disclosure of source and geographical origin of biological material under Section 10(4)(d).'
        ],
        status: 'Official Examination Standard',
        officialLink: '/sources?filter=patents'
      }
    ]
  },
  {
    id: 'treaties',
    title: 'International Treaties & Conventions',
    badge: 'International Law',
    icon: <IconScroll size={20} />,
    description: 'Multilateral treaties, disclosure standards, and intellectual property conventions protecting genetic resources and traditional medicine globally.',
    items: [
      {
        id: 'treaty-wipo-gratk',
        title: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge',
        statute: 'Diplomatic Conference Final Act, Geneva (May 2024)',
        authority: 'World Intellectual Property Organization (WIPO)',
        summary: 'Landmark international legal instrument establishing a mandatory patent disclosure requirement for inventions based on genetic resources and associated traditional knowledge.',
        keyPoints: [
          'Patent applicants worldwide must disclose the country of origin of genetic resources.',
          'If based on traditional knowledge, applicants must disclose the Indigenous Peoples or local community that provided the knowledge.',
          'Information systems and databases are established to facilitate prior-art searches for examiners worldwide.'
        ],
        status: 'Historic Treaty Adopted (2024)',
        officialLink: '/sources?filter=international'
      },
      {
        id: 'treaty-cbd-nagoya',
        title: 'Nagoya Protocol on Access and Benefit Sharing (ABS)',
        statute: 'Convention on Biological Diversity (CBD) Supplementary Agreement',
        authority: 'United Nations Environment Programme (UNEP) / CBD Secretariat',
        summary: 'International legal framework for the fair and equitable sharing of benefits arising out of the utilization of genetic resources.',
        keyPoints: [
          'Requires Prior Informed Consent (PIC) from the provider country before access.',
          'Mandates Mutually Agreed Terms (MAT) for benefit sharing with indigenous communities and national authorities.',
          'National focal points and compliance checkpoints monitored internationally.'
        ],
        status: 'Ratified Multilateral Instrument',
        officialLink: '/sources?filter=international'
      },
      {
        id: 'treaty-pct',
        title: 'Patent Cooperation Treaty (PCT) & AYUSH Inventions',
        statute: 'WIPO PCT Regulations',
        authority: 'World Intellectual Property Organization (WIPO)',
        summary: 'International patent filing system allowing a single international application to seek patent protection simultaneously in over 155 contracting states.',
        keyPoints: [
          'Indian AYUSH innovators can file a PCT application within 12 months of domestic priority filing.',
          'Mandatory compliance with Section 39 of Indian Patents Act (Foreign Filing License or 6-week waiting period) before foreign filing.',
          'National Biodiversity Authority Form IV approval required before commercializing patents abroad.'
        ],
        status: 'Operational Global Filing System',
        officialLink: '/sources?filter=international'
      }
    ]
  },
  {
    id: 'tk',
    title: 'Traditional Knowledge & TKDL',
    badge: 'Sovereign Heritage',
    icon: <IconShield size={20} />,
    description: 'India’s sovereign repository of codified traditional medical knowledge safeguarding against misappropriation and biopiracy.',
    items: [
      {
        id: 'tkdl-repository',
        title: 'Traditional Knowledge Digital Library (TKDL)',
        statute: 'CSIR & Ministry of AYUSH Sovereign Knowledge Base',
        authority: 'Council of Scientific and Industrial Research (CSIR)',
        summary: 'Digital compendium translating ancient Sanskrit, Arabic, Persian, Urdu and Tamil classical texts into 5 international languages (English, German, French, Japanese, Spanish) using Traditional Knowledge Resource Classification (TKRC).',
        keyPoints: [
          'Over 4.5 lakh classical formulations documented from Ayurveda, Unani, Siddha, and Sowa-Rigpa.',
          'Bilateral access agreements with major patent offices (USPTO, EPO, JPO, UKIPO, IP Australia, etc.) to examine prior art before granting patents.',
          'Successfully defeated hundreds of wrongful patent claims and biopiracy attempts worldwide.'
        ],
        status: 'Active Defense System',
        officialLink: '/sources?filter=traditional-knowledge'
      },
      {
        id: 'tk-ccras-patents',
        title: 'CCRAS Institutional Research & Granted Patents',
        statute: 'Official Gazette & Ministry of AYUSH Research Portals',
        authority: 'Central Council for Research in Ayurvedic Sciences (CCRAS)',
        summary: 'Government-led technological innovations bridging classical Ayurvedic pharmacology with modern validation, standardization, and patented delivery mechanisms.',
        keyPoints: [
          'Demonstrates lawful patenting pathways: formulation standardization, targeted drug delivery, and extraction processes rather than claiming the herb itself.',
          'Recent grants serve as institutional benchmarks for commercialization and ABS compliance.'
        ],
        status: 'Verified Institutional Record',
        officialLink: '/sources?filter=traditional-knowledge'
      }
    ]
  },
  {
    id: 'biodiversity',
    title: 'Biodiversity & ABS Compliance',
    badge: 'Statutory Compliance',
    icon: <IconLeaf size={20} />,
    description: 'Mandatory approval pathways under the Biological Diversity Act 2002 for commercialization, research, and patent applications utilizing Indian biological resources.',
    items: [
      {
        id: 'bd-act-2002',
        title: 'The Biological Diversity Act, 2002 & Amendments',
        statute: 'Act No. 18 of 2003 (as amended by Biological Diversity Amendment Act 2023)',
        authority: 'National Biodiversity Authority (NBA) & State Biodiversity Boards (SBB)',
        summary: 'Statute conserving biological diversity, sustaining the use of its components, and ensuring equitable sharing of benefits arising out of biological resource utilization.',
        keyPoints: [
          'Section 3: Foreign nationals, non-residents, and foreign-controlled entities must obtain prior NBA approval before accessing biological resources.',
          'Section 6: Prior approval of NBA is mandatory before applying for any intellectual property right based on any biological resource obtained from India.',
          'Section 7: Indian entities must give prior intimation to the concerned State Biodiversity Board (SBB) before commercial utilization.',
          'Exemption: Registered AYUSH practitioners and local communities are exempted from SBB intimation under designated statutory criteria.'
        ],
        status: 'Mandatory Statutory Requirement',
        officialLink: '/sources?filter=biodiversity'
      },
      {
        id: 'nba-abs-regulations',
        title: 'Guidelines on Access to Biological Resources and Associated Knowledge and Benefits Sharing Regulations',
        statute: 'G.S.R. Notification under Biological Diversity Act',
        authority: 'National Biodiversity Authority (NBA)',
        summary: 'Prescribes the exact benefit-sharing percentages (typically 0.1% to 0.5% of ex-factory gross sales or upfront fee percentage) and formal application forms.',
        keyPoints: [
          'Form I: Application for access to biological resources by foreign entities.',
          'Form II: Application for transferring research results.',
          'Form III: Application for seeking prior approval for applying for Intellectual Property Rights (IPR).',
          'Form IV: Application for third-party transfer of accessed biological materials.'
        ],
        status: 'Active Regulatory Schedule',
        officialLink: '/sources?filter=biodiversity'
      }
    ]
  },
  {
    id: 'regulatory',
    title: 'Regulatory & Licensing Frameworks',
    badge: 'AYUSH & FSSAI',
    icon: <IconFlask size={20} />,
    description: 'Manufacturing licensing, pharmacopoeial compliance, and formulation categorization under Drug Control and Food Safety authorities.',
    items: [
      {
        id: 'drugs-act-1940',
        title: 'Drugs and Cosmetics Act, 1940 & Rules 1945 (Chapter IV-A)',
        statute: 'Special Provisions relating to Ayurvedic, Siddha and Unani (ASU) Drugs',
        authority: 'State AYUSH Licensing Authorities (SALA) & Drugs Controller General of India',
        summary: 'Governs the manufacture, sale, testing, and labeling of Ayurvedic, Siddha, and Unani drugs across India.',
        keyPoints: [
          'Classical ASU Medicines: Formulated strictly in accordance with authoritative classical texts listed in the First Schedule to the Act (Rule 158-B(1)).',
          'Patent or Proprietary (P&P) ASU Medicines: Formulations containing ingredients mentioned in classical texts but not prepared according to classical recipe (Rule 158-B(2)); requires pilot clinical study data or published literature evidence.',
          'Good Manufacturing Practices (GMP): Mandatory compliance under Schedule T for all ASU manufacturing units.'
        ],
        status: 'Mandatory Licensing Statute',
        officialLink: '/sources?filter=regulatory'
      },
      {
        id: 'fssai-ayush-aahar',
        title: 'FSSAI (Ayurveda Aahar) Regulations, 2022',
        statute: 'Food Safety and Standards (Ayurveda Aahar) Regulations, 2022',
        authority: 'Food Safety and Standards Authority of India (FSSAI) & Ministry of AYUSH',
        summary: 'Regulatory category for foods prepared in accordance with Ayurvedic texts for dietary use, physiological support, and health maintenance.',
        keyPoints: [
          'Excludes synthetic additives, vitamins, and minerals unless naturally present.',
          'Mandates the official Ayurveda Aahar logo on consumer packaging.',
          'Cannot make medicinal claims or therapeutic cure claims (which fall under Drugs & Cosmetics Act).'
        ],
        status: 'Active Food Safety Standard',
        officialLink: '/sources?filter=regulatory'
      }
    ]
  },
  {
    id: 'filing',
    title: 'Filing & Compliance Concepts',
    badge: 'Procedural Guides',
    icon: <IconFileText size={20} />,
    description: 'Procedural steps, mandatory forms, official examination stages, and timelines for intellectual property prosecution in India.',
    items: [
      {
        id: 'procedural-forms',
        title: 'Core Patent Filing Forms & Schedules',
        statute: 'The Patents Rules, 2003 (as amended)',
        authority: 'Indian Patent Office (IPO)',
        summary: 'Official procedural forms required at each step of patent prosecution for Ayurvedic innovations.',
        keyPoints: [
          'Form 1: Application for grant of patent.',
          'Form 2: Provisional or Complete Specification (including description, drawings, and claims).',
          'Form 3: Statement and undertaking regarding foreign filings (Section 8).',
          'Form 5: Declaration of inventorship.',
          'Form 18 / 18A: Request for Examination (RFE) / Expedited Examination (available for startups, female applicants, and government departments).'
        ],
        status: 'Active Procedural Standard',
        officialLink: '/checklists'
      },
      {
        id: 'procedural-timeline',
        title: 'Statutory Examination & Grant Timeline',
        statute: 'Patent Office Prosecution Manual',
        authority: 'CGPDTM',
        summary: 'Standard sequence from filing to grant: Publication at 18 months, Request for Examination within 48 months (or 31 months under updated rules), First Examination Report (FER) response within 6 months, and pre-grant opposition window.',
        keyPoints: [
          'Pre-Grant Opposition under Section 25(1) can be filed by any person after publication and before grant.',
          'Post-Grant Opposition under Section 25(2) can be filed by any person interested within 12 months from grant.',
          'Annual renewal fees payable from the 3rd year onwards to maintain the patent for 20 years.'
        ],
        status: 'Procedural Workflow Guide',
        officialLink: '/roadmap'
      }
    ]
  }
]

export default function InformaticsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSections = INFORMATICS_SECTIONS.map((sec) => {
    if (activeTab !== 'all' && sec.id !== activeTab) return null

    const matchingItems = sec.items.filter((item) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        item.statute.toLowerCase().includes(q) ||
        item.authority.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.keyPoints.some((kp) => kp.toLowerCase().includes(q))
      )
    })

    if (matchingItems.length === 0) return null
    return { ...sec, items: matchingItems }
  }).filter(Boolean)

  return (
    <div className="informatics-page" style={styles.page}>
      {/* Official Government Top Herald Banner */}
      <section className="informatics-hero" style={styles.heroSection}>
        <div style={styles.heroContainer}>
          <div style={styles.breadcrumbRow}>
            <Link to="/" style={styles.breadcrumbLink}>Home</Link>
            <span style={styles.breadcrumbSep}>/</span>
            <span style={styles.breadcrumbCurrent}>Informatics</span>
          </div>

          <div style={styles.authorityPill}>
            <span style={styles.flagDot} />
            <span>Ministry of AYUSH • Sovereign IP Knowledge Gateway</span>
          </div>

          <h1 style={styles.heroHeading}>
            Statutory, Treaty & Regulatory Informatics
          </h1>
          <p style={styles.heroSubheading}>
            A structured, source-verified compendium of Indian intellectual property statutes,
            traditional knowledge safeguards, biodiversity compliance frameworks, and international conventions.
          </p>

          {/* Quick Search Bar */}
          <div style={styles.searchBarWrapper}>
            <IconSearch size={18} style={styles.searchIcon} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by section, act (e.g. 'Section 3(p)', 'Nagoya', 'Rule 158-B')..."
              style={styles.searchInput}
              aria-label="Search statutory and treaty informatics"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={styles.clearSearchBtn}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Navigation Filter Tabs */}
      <nav className="informatics-nav-tabs" style={styles.tabsNav} aria-label="Informatics Categories">
        <div style={styles.tabsContainer}>
          <button
            type="button"
            className={`informatics-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            style={{ ...styles.tabBtn, ...(activeTab === 'all' ? styles.tabBtnActive : {}) }}
          >
            All Frameworks ({INFORMATICS_SECTIONS.reduce((acc, s) => acc + s.items.length, 0)})
          </button>
          {INFORMATICS_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              className={`informatics-tab ${activeTab === sec.id ? 'active' : ''}`}
              onClick={() => setActiveTab(sec.id)}
              style={{ ...styles.tabBtn, ...(activeTab === sec.id ? styles.tabBtnActive : {}) }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {sec.icon}
                <span>{sec.title}</span>
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main style={styles.mainContainer}>
        {filteredSections.length === 0 ? (
          <div style={styles.emptyState}>
            <IconInfo size={36} style={{ color: '#C87A1E', marginBottom: '12px' }} />
            <h3 style={styles.emptyTitle}>No matching statutory provisions found</h3>
            <p style={styles.emptyDesc}>
              No articles matched your search query "{searchQuery}". Try searching for terms like "3(p)", "patent", "Nagoya", "ASU", or "FSSAI".
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={styles.resetBtn}
            >
              Reset Search Filter
            </button>
          </div>
        ) : (
          filteredSections.map((sec) => (
            <section key={sec.id} style={styles.sectionBlock} id={sec.id} aria-labelledby={`sec-${sec.id}`}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionHeaderLeft}>
                  <div style={styles.sectionIconWrap}>{sec.icon}</div>
                  <div>
                    <div style={styles.sectionBadge}>{sec.badge}</div>
                    <h2 id={`sec-${sec.id}`} style={styles.sectionHeading}>{sec.title}</h2>
                  </div>
                </div>
                <p style={styles.sectionDesc}>{sec.description}</p>
              </div>

              <div style={styles.itemsGrid}>
                {sec.items.map((item) => (
                  <article key={item.id} style={styles.itemCard} className="informatics-item-card">
                    <div style={styles.cardHeader}>
                      <span style={styles.cardStatus}>{item.status}</span>
                      <span style={styles.cardStatuteRef}>{item.statute}</span>
                    </div>

                    <h3 style={styles.cardTitle}>{item.title}</h3>
                    <div style={styles.cardAuthority}>
                      <strong>Issuing Authority:</strong> {item.authority}
                    </div>

                    <p style={styles.cardSummary}>{item.summary}</p>

                    <div style={styles.keyPointsBox}>
                      <h4 style={styles.keyPointsHeading}>Statutory Guidance & Considerations:</h4>
                      <ul style={styles.keyPointsList}>
                        {item.keyPoints.map((kp, idx) => (
                          <li key={idx} style={styles.keyPointItem}>
                            <span style={styles.checkIcon}><IconCheck size={14} /></span>
                            <span>{kp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div style={styles.cardFooter}>
                      <Link to={item.officialLink} style={styles.cardActionLink}>
                        <span>Explore Source Catalog</span>
                        <IconExternalLink size={14} />
                      </Link>
                      <Link
                        to="/chat"
                        state={{ initialPrompt: `Tell me about the legal requirements under ${item.title}` }}
                        style={styles.askAiLink}
                      >
                        <span>Query RagVyn AI</span>
                        <IconArrowRight size={14} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}

        {/* Future Expansion Disclaimer Card */}
        <section style={styles.expansionNotice} aria-labelledby="compendium-status">
          <div style={styles.noticeHeader}>
            <IconInfo size={20} style={{ color: '#143D30', flexShrink: 0 }} />
            <div>
              <h3 id="compendium-status" style={styles.noticeTitle}>
                Official Gazette & Corpus Verification Notice
              </h3>
              <p style={styles.noticeText}>
                All statutory data presented in this compendium is grounded directly in gazetted legislation,
                the First Schedule of the Drugs & Cosmetics Act 1940, official CGPDTM manuals, and WIPO diplomatic records.
                Corpus expansions for state-specific Biodiversity Board rules and evolving AYUSH Aahar standards
                are continuously audited in the <Link to="/sources" style={{ color: '#143D30', fontWeight: 700, textDecoration: 'underline' }}>Knowledge Corpus Manifest</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Action Callout Bar */}
        <section style={styles.actionCallout}>
          <div style={styles.calloutLeft}>
            <h3 style={styles.calloutTitle}>Need case-specific statutory guidance?</h3>
            <p style={styles.calloutText}>
              Consult with RagVyn AI to evaluate your formulation, generate official forms, or check prior art against statutory bars.
            </p>
          </div>
          <div style={styles.calloutRight}>
            <Link to="/chat" className="btn-primary" style={styles.calloutBtnPrimary}>
              <span>Consult RagVyn AI</span>
              <IconArrowRight size={15} />
            </Link>
            <Link to="/patentability" style={styles.calloutBtnSecondary}>
              <span>Patentability Check</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary, #FAF9F6)',
    color: 'var(--text-primary, #0F172A)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-body, system-ui, -apple-system, sans-serif)',
  },
  heroSection: {
    background: 'linear-gradient(180deg, #143D30 0%, #0D2920 100%)',
    color: '#FFFFFF',
    padding: 'clamp(2.5rem, 5vw, 4rem) clamp(1rem, 3vw, 2rem) clamp(2rem, 4vw, 3rem)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  heroContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  breadcrumbRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.82rem',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '1rem',
  },
  breadcrumbLink: {
    color: 'rgba(255, 255, 255, 0.85)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  breadcrumbSep: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  breadcrumbCurrent: {
    color: '#F8D18C',
    fontWeight: 600,
  },
  authorityPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    color: '#F8D18C',
    padding: '0.35rem 0.85rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: '1rem',
  },
  flagDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#FF9933',
    boxShadow: '0 0 6px rgba(255, 153, 51, 0.8)',
  },
  heroHeading: {
    fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)',
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    marginBottom: '0.75rem',
  },
  heroSubheading: {
    fontSize: 'clamp(0.95rem, 1.3vw, 1.12rem)',
    color: '#CBDCD5',
    lineHeight: 1.6,
    maxWidth: '820px',
    marginBottom: '1.75rem',
  },
  searchBarWrapper: {
    position: 'relative',
    maxWidth: '680px',
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
    padding: '4px 8px 4px 14px',
  },
  searchIcon: {
    color: '#143D30',
    flexShrink: 0,
    marginRight: '10px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '0.95rem',
    color: '#0F172A',
    background: 'transparent',
    padding: '10px 0',
  },
  clearSearchBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748B',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '6px 10px',
  },
  tabsNav: {
    background: '#FFFFFF',
    borderBottom: '1px solid #E5E0D6',
    position: 'sticky',
    top: 'var(--gov-header-height, 96px)',
    zIndex: 90,
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
  },
  tabsContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.5rem 1rem',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
  },
  tabBtn: {
    background: 'transparent',
    border: '1px solid transparent',
    color: '#475569',
    fontSize: '0.84rem',
    fontWeight: 600,
    padding: '0.55rem 0.95rem',
    borderRadius: '8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: '#143D30',
    color: '#FFFFFF',
    borderColor: '#143D30',
  },
  mainContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    padding: 'clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 2vw, 1.5rem)',
    flex: 1,
  },
  sectionBlock: {
    marginBottom: '3rem',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '1.5px solid #E5E0D6',
  },
  sectionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sectionIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(20, 61, 48, 0.08)',
    color: '#143D30',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#C87A1E',
  },
  sectionHeading: {
    fontSize: '1.45rem',
    fontWeight: 800,
    color: '#143D30',
    letterSpacing: '-0.01em',
    margin: 0,
  },
  sectionDesc: {
    fontSize: '0.92rem',
    color: '#475569',
    lineHeight: 1.5,
    margin: 0,
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))',
    gap: '1.25rem',
  },
  itemCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E0D6',
    borderRadius: '14px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '0.75rem',
  },
  cardStatus: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: 'rgba(16, 185, 129, 0.12)',
    color: '#065F46',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  cardStatuteRef: {
    fontSize: '0.75rem',
    color: '#64748B',
    fontStyle: 'italic',
  },
  cardTitle: {
    fontSize: '1.18rem',
    fontWeight: 800,
    color: '#0F172A',
    marginBottom: '0.35rem',
    lineHeight: 1.3,
  },
  cardAuthority: {
    fontSize: '0.8rem',
    color: '#64748B',
    marginBottom: '0.85rem',
  },
  cardSummary: {
    fontSize: '0.9rem',
    color: '#334155',
    lineHeight: 1.6,
    marginBottom: '1rem',
  },
  keyPointsBox: {
    background: '#FAF9F6',
    border: '1px solid #EFEAE0',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1.25rem',
    flex: 1,
  },
  keyPointsHeading: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#143D30',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  keyPointsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  keyPointItem: {
    fontSize: '0.84rem',
    color: '#334155',
    lineHeight: 1.5,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  checkIcon: {
    color: '#059669',
    marginTop: '2px',
    flexShrink: 0,
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '0.85rem',
    borderTop: '1px solid #F1ECE1',
    gap: '12px',
    flexWrap: 'wrap',
  },
  cardActionLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#143D30',
    textDecoration: 'none',
  },
  askAiLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#C87A1E',
    textDecoration: 'none',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1.5rem',
    background: '#FFFFFF',
    borderRadius: '16px',
    border: '1px dashed #CBD5E1',
    margin: '2rem 0',
  },
  emptyTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: '0.5rem',
  },
  emptyDesc: {
    fontSize: '0.9rem',
    color: '#64748B',
    maxWidth: '500px',
    margin: '0 auto 1.25rem',
    lineHeight: 1.5,
  },
  resetBtn: {
    background: '#143D30',
    color: '#FFFFFF',
    border: 'none',
    padding: '0.5rem 1.25rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  expansionNotice: {
    background: 'rgba(20, 61, 48, 0.05)',
    border: '1.5px solid rgba(20, 61, 48, 0.2)',
    borderRadius: '14px',
    padding: '1.25rem 1.5rem',
    marginBottom: '2.5rem',
  },
  noticeHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
  },
  noticeTitle: {
    fontSize: '0.98rem',
    fontWeight: 750,
    color: '#143D30',
    marginBottom: '0.35rem',
  },
  noticeText: {
    fontSize: '0.86rem',
    color: '#334155',
    lineHeight: 1.6,
    margin: 0,
  },
  actionCallout: {
    background: 'linear-gradient(135deg, #143D30 0%, #1A4D3D 100%)',
    borderRadius: '16px',
    padding: 'clamp(1.5rem, 3vw, 2.25rem)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  calloutLeft: {
    maxWidth: '650px',
  },
  calloutTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.4rem',
  },
  calloutText: {
    fontSize: '0.9rem',
    color: '#CBDCD5',
    lineHeight: 1.5,
    margin: 0,
  },
  calloutRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  calloutBtnPrimary: {
    background: '#C87A1E',
    color: '#FFFFFF',
    border: 'none',
    padding: '0.65rem 1.25rem',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.88rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(200, 122, 30, 0.4)',
  },
  calloutBtnSecondary: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    padding: '0.65rem 1.15rem',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '0.88rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
}
