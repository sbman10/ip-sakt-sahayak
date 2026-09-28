import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconLeaf,
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconShieldCheck,
  IconArrowLeft,
} from './Icons'
import './SiteFooter.css'

/**
 * Arrow Up Icon for accessible Back-to-Top button
 */
function IconArrowUp({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

/**
 * Institutional Site Footer for IP-SAKTI / RAGVYN
 * Adheres strictly to the formal Indian government/legal-tech design standard:
 * - Clean off-white/dark surface
 * - 4-column structured navigation
 * - Data-driven route-backed links
 * - "Coming soon" indicators for unreleased frameworks
 * - Mobile responsive accordion
 * - Accessible legal bottom strip with Back to top
 */
export default function SiteFooter({
  isLoggedIn = false,
  userName = '',
  onOpenAbout,
  compact = false,
}) {
  // Mobile accordion expand state for columns (default col 1 is open or all collapsed on mobile)
  const [openSections, setOpenSections] = useState({
    guidance: false,
    tools: false,
    support: false,
  })

  const toggleSection = (key) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleBackToTop = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

  // ----------------------------------------------------------------
  // FOOTER DATA ARCHITECTURE
  // ----------------------------------------------------------------
  const ipSaktiLinks = [
    {
      label: 'About IP-SAKTI Portal',
      to: '/#about',
      onClick: onOpenAbout,
      title: 'Institutional background and governance of the IP-SAKTI portal',
    },
    {
      label: 'How the System Works',
      to: '/#how-it-works',
      title: 'Procedural pipeline from formulation input to statutory diagnostic',
    },
    {
      label: 'Official Data Corpora',
      to: '/sources',
      title: 'Verified repositories: Patents Act, Biological Diversity Act, and TKDL',
    },
    {
      label: 'Statutory Methodology',
      to: '/sources',
      title: 'Legal reasoning rules and knowledge graph ingestion methodology',
    },
    {
      label: 'Statutory Disclaimer',
      to: '/privacy#disclaimer',
      title: 'Information provided for administrative and research guidance only',
    },
  ]

  const guidanceLinks = [
    {
      label: 'Patentability & Section 3(p)',
      to: '/patentability',
      status: 'active',
      title: 'Statutory exclusions on traditional knowledge and novelty assessment',
    },
    {
      label: 'Traditional Knowledge & TKDL',
      to: '/sources',
      status: 'active',
      title: 'CSIR Traditional Knowledge Digital Library prior art verification',
    },
    {
      label: 'Biodiversity & ABS Compliance',
      to: '/abs-checker',
      status: 'active',
      title: 'National Biodiversity Authority approval triggers under BD Act 2002',
    },
    {
      label: 'AYUSH & ASU Regulation',
      to: '/formulation-wizard',
      status: 'active',
      title: 'Ayurvedic, Siddha & Unani manufacturing pathways under Rule 158-B',
    },
    {
      label: 'Trademarks & GI Framework',
      to: '/checklists',
      status: 'active',
      title: 'Geographical Indications of Goods Act and Trade Marks Act procedures',
    },
    {
      label: 'International Frameworks (PCT & CBD)',
      to: null,
      status: 'coming_soon',
      title: 'International treaties and PCT national phase guidance (forthcoming)',
    },
    {
      label: 'Patent Filing Pathways',
      to: '/roadmap',
      status: 'active',
      title: 'Step-by-step milestone roadmap from research to patent grant',
    },
  ]

  const toolsLinks = [
    { label: 'AI Consultation & Search', to: '/chat' },
    { label: 'Formulation Classification Wizard', to: '/formulation-wizard' },
    { label: 'ABS Compliance Checker', to: '/abs-checker' },
    { label: 'Official IP Cost Calculator', to: '/ip-calculator' },
    { label: 'Statutory Deadline Calculator', to: '/deadline-calculator' },
    { label: 'IP Filing Checklists', to: '/checklists' },
    { label: 'Statutory Document Generator', to: '/drafts' },
    { label: 'Patentability Assessment Engine', to: '/patentability' },
    { label: 'Statutory Verdict Engine', to: '/verdict' },
    { label: 'Matter Workspace', to: '/workspace' },
    { label: 'Expert Connect Directory', to: '/experts' },
    { label: 'Dual-Use Guardian', to: '/guardian' },
  ]

  const supportLinks = [
    { label: 'Frequently Asked Questions', to: '/#faq' },
    { label: 'Complete Sitemap & Directory', to: '/sitemap' },
    { label: 'Privacy Policy & DPDP Act', to: '/privacy' },
    { label: 'Terms of Use & Governance', to: '/privacy#terms' },
    { label: 'Pricing & Institutional Tiers', to: '/pricing' },
    {
      label: isLoggedIn ? `Account (${userName || 'User'})` : 'Account Authentication',
      to: '/login',
    },
  ]

  // If compact mode is requested (e.g. for tight utility workflows)
  if (compact) {
    return (
      <footer className="site-footer" role="contentinfo" aria-label="Institutional footer compact">
        <div className="site-footer-container">
          <div className="site-footer-bottom">
            <div className="site-footer-legal-links">
              <span>© 2026 IP-SAKTI / RAGVYN</span>
              <span className="site-footer-separator">|</span>
              <Link to="/privacy" className="site-footer-legal-link">Privacy Policy</Link>
              <span className="site-footer-separator">|</span>
              <Link to="/privacy#terms" className="site-footer-legal-link">Terms of Use</Link>
              <span className="site-footer-separator">|</span>
              <Link to="/sitemap" className="site-footer-legal-link">Sitemap</Link>
            </div>
            <button
              type="button"
              className="site-footer-back-to-top"
              onClick={handleBackToTop}
              aria-label="Back to top of page"
            >
              <IconArrowUp size={13} />
              <span>Back to top</span>
            </button>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="site-footer" role="contentinfo" aria-label="Institutional footer">
      <div className="site-footer-container">
        {/* =========================================================
            FOUR-COLUMN MAIN NAVIGATION
            ========================================================= */}
        <div className="site-footer-grid">
          {/* Column 1: Brand & Factual Overview */}
          <div className="site-footer-col">
            <Link to="/" className="site-footer-brand-wrap" aria-label="IP-SAKTI Portal Home">
              <span className="site-footer-brand-icon" aria-hidden="true">
                <IconLeaf size={20} />
              </span>
              <div>
                <span className="site-footer-brand-name">IP-SAKTI Sahayak</span>
                <span className="site-footer-brand-sub">आईपी-शक्ति सहायक</span>
              </div>
            </Link>

            <div className="site-footer-inst-badge">
              <IconShieldCheck size={14} />
              <span>Statutory Legal-Tech Platform</span>
            </div>

            <p className="site-footer-description">
              Smart IP & Regulatory Assistance Portal for Traditional Knowledge, Ayurvedic Formulations, and Patent Eligibility in India.
            </p>

            <nav aria-label="IP-SAKTI General Navigation">
              <ul className="site-footer-nav">
                {ipSaktiLinks.map((item, idx) => (
                  <li key={idx}>
                    {item.onClick ? (
                      <button
                        type="button"
                        className="site-footer-link"
                        onClick={item.onClick}
                        title={item.title}
                      >
                        <span>{item.label}</span>
                      </button>
                    ) : (
                      <Link
                        to={item.to}
                        className="site-footer-link"
                        title={item.title}
                      >
                        <span>{item.label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Column 2: Ayurvedic IP Guidance */}
          <div className="site-footer-col">
            <h4 className="site-footer-heading">Ayurvedic IP Guidance</h4>

            {/* Mobile Accordion Toggle Button */}
            <button
              type="button"
              className="site-footer-accordion-btn"
              onClick={() => toggleSection('guidance')}
              aria-expanded={openSections.guidance}
              aria-controls="footer-col-guidance"
            >
              <span>Ayurvedic IP Guidance</span>
              <span className={`site-footer-accordion-chevron ${openSections.guidance ? 'open' : ''}`}>
                <IconChevronDown size={16} />
              </span>
            </button>

            <div
              id="footer-col-guidance"
              className={`site-footer-col-content ${openSections.guidance ? 'open' : ''}`}
            >
              <nav aria-label="Ayurvedic IP Guidance Links">
                <ul className="site-footer-nav">
                  {guidanceLinks.map((item, idx) => (
                    <li key={idx}>
                      {item.status === 'coming_soon' ? (
                        <span className="site-footer-disabled-item" title={item.title}>
                          <span>{item.label}</span>
                          <span className="site-footer-coming-soon-pill">Coming soon</span>
                        </span>
                      ) : (
                        <Link to={item.to} className="site-footer-link" title={item.title}>
                          <span>{item.label}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>

          {/* Column 3: Tools & Services */}
          <div className="site-footer-col">
            <h4 className="site-footer-heading">Tools & Services</h4>

            {/* Mobile Accordion Toggle Button */}
            <button
              type="button"
              className="site-footer-accordion-btn"
              onClick={() => toggleSection('tools')}
              aria-expanded={openSections.tools}
              aria-controls="footer-col-tools"
            >
              <span>Tools & Services</span>
              <span className={`site-footer-accordion-chevron ${openSections.tools ? 'open' : ''}`}>
                <IconChevronDown size={16} />
              </span>
            </button>

            <div
              id="footer-col-tools"
              className={`site-footer-col-content ${openSections.tools ? 'open' : ''}`}
            >
              <nav aria-label="Tools and Services Navigation">
                <ul className="site-footer-nav">
                  {toolsLinks.map((item, idx) => (
                    <li key={idx}>
                      <Link to={item.to} className="site-footer-link">
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>

          {/* Column 4: Support & Account */}
          <div className="site-footer-col">
            <h4 className="site-footer-heading">Support & Governance</h4>

            {/* Mobile Accordion Toggle Button */}
            <button
              type="button"
              className="site-footer-accordion-btn"
              onClick={() => toggleSection('support')}
              aria-expanded={openSections.support}
              aria-controls="footer-col-support"
            >
              <span>Support & Governance</span>
              <span className={`site-footer-accordion-chevron ${openSections.support ? 'open' : ''}`}>
                <IconChevronDown size={16} />
              </span>
            </button>

            <div
              id="footer-col-support"
              className={`site-footer-col-content ${openSections.support ? 'open' : ''}`}
            >
              <nav aria-label="Support and Account Navigation">
                <ul className="site-footer-nav">
                  {supportLinks.map((item, idx) => (
                    <li key={idx}>
                      <Link to={item.to} className="site-footer-link">
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>

        {/* =========================================================
            BOTTOM LEGAL STRIP
            ========================================================= */}
        <div className="site-footer-bottom">
          <div className="site-footer-legal-links">
            <span>© 2026 IP-SAKTI / RAGVYN • National IP & Regulatory Intelligence</span>
            <span className="site-footer-separator">|</span>
            <Link to="/privacy" className="site-footer-legal-link">Privacy Policy</Link>
            <span className="site-footer-separator">|</span>
            <Link to="/privacy#terms" className="site-footer-legal-link">Terms of Use</Link>
            <span className="site-footer-separator">|</span>
            <Link to="/sitemap" className="site-footer-legal-link">Sitemap</Link>
          </div>

          <button
            type="button"
            className="site-footer-back-to-top"
            onClick={handleBackToTop}
            aria-label="Back to top of page"
            title="Scroll to top of page"
          >
            <IconArrowUp size={13} />
            <span>Back to top</span>
          </button>
        </div>
      </div>
    </footer>
  )
}
