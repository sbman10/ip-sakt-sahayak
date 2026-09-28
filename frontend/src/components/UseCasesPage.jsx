import { Link } from 'react-router-dom'
import { useLanguage } from '../locales'

const USE_CASE_DEFS = [
  {
    key: 'uc1',
    to: '/formulation-wizard',
    icon: '🧪',
    defaultTitle: 'Ayurvedic Formulation & Patent Pathway Research',
    defaultWho: 'Vaidyas, AYUSH manufacturers, MSME entrepreneurs',
    defaultInput: 'Describe your formulation — ingredients, preparation method, intended therapeutic use.',
    defaultOutput: 'RAGVYN classifies your formulation (Classical / Proprietary / Nutraceutical), identifies prior-art risks under Section 3(p), and suggests the most viable patent or licensing pathway.',
    defaultCta: 'Open Formulation Wizard',
  },
  {
    key: 'uc2',
    to: '/chat',
    icon: '⚖️',
    defaultTitle: 'Patentability & Prior-Art Exploration',
    defaultWho: 'Patent attorneys, R&D teams, academic researchers',
    defaultInput: 'Ask about any compound, delivery mechanism, or therapeutic claim you want to protect.',
    defaultOutput: 'Source-cited guidance referencing Patents Act 1970 (§ 2(1)(j), § 3(d), § 3(e), § 3(p)), TKDL prior-art matches, and PCT/WIPO treaty considerations.',
    defaultCta: 'Start Consultation',
  },
  {
    key: 'uc3',
    to: '/chat',
    icon: '📜',
    defaultTitle: 'Traditional Knowledge & TKDL Screening',
    defaultWho: 'IP examiners, pharma compliance teams, policy researchers',
    defaultInput: 'Enter a formulation name, classical text reference, or ingredient combination.',
    defaultOutput: 'Cross-reference results against the Traditional Knowledge Digital Library (2.5 lakh+ formulations) to assess prior-art barriers before filing.',
    defaultCta: 'Ask RAGVYN AI',
  },
  {
    key: 'uc4',
    to: '/abs-checker',
    icon: '🌿',
    defaultTitle: 'Biodiversity & ABS Compliance Research',
    defaultWho: 'Exporters, bioprospectors, herbal product companies',
    defaultInput: 'Name the biological resource, its geographic origin, and intended commercial use.',
    defaultOutput: 'Nagoya Protocol and Biological Diversity Act 2002 compliance assessment — NBA clearance requirements, ABS Form-I obligations, and benefit-sharing obligations.',
    defaultCta: 'Open ABS Checker',
  },
  {
    key: 'uc5',
    to: '/chat',
    icon: '💊',
    defaultTitle: 'AYUSH Drug, Cosmetic & Regulatory Guidance',
    defaultWho: 'ASU drug manufacturers, cosmetic formulators, regulatory affairs teams',
    defaultInput: 'Describe your product category, intended claims, and target market.',
    defaultOutput: 'Applicable licensing pathway under Drugs & Cosmetics Rules (Form 22 / Form 44), FSSAI Ayurveda Aahar categorisation, and BIS compliance requirements.',
    defaultCta: 'Start Consultation',
  },
  {
    key: 'uc6',
    to: '/sources',
    icon: '📚',
    defaultTitle: 'Official Source & Legal Corpus Discovery',
    defaultWho: 'Legal researchers, students, policy analysts',
    defaultInput: 'Search for a specific statute, section, or regulatory topic.',
    defaultOutput: 'Retrieve authoritative source documents from the Indian Patents Act, Biodiversity Act, TKDL, WIPO treaties, and Drugs & Cosmetics Rules — with exact section citations.',
    defaultCta: 'Browse Sources',
  },
  {
    key: 'uc7',
    to: '/ip-calculator',
    icon: '🎯',
    defaultTitle: 'Preparing Questions for IP / Legal Professionals',
    defaultWho: 'First-time inventors, startups, academic spin-offs',
    defaultInput: 'Describe your innovation and what you want to protect.',
    defaultOutput: 'RAGVYN helps you frame informed questions, understand relevant legal concepts, estimate filing costs, and track statutory deadlines — so your professional consultation is focused and productive.',
    defaultCta: 'Try Fee Calculator',
  },
]

export default function UseCasesPage({ navbar }) {
  const { t } = useLanguage()

  return (
    <div className="page-container">
      {navbar}
      <div className="use-cases-page">
        <div className="use-cases-header">
          <p className="use-cases-eyebrow">{t('use_cases.eyebrow') || 'RAGVYN USE CASES'}</p>
          <h1 className="use-cases-title">
            {t('use_cases.title') || 'How RAGVYN helps you navigate IP & regulation'}
          </h1>
          <p className="use-cases-subtitle">
            {t('use_cases.subtitle') || 'Explore real scenarios where source-backed AI guidance saves time, reduces risk, and helps you make informed decisions.'}
          </p>
        </div>

        <div className="use-cases-grid">
          {USE_CASE_DEFS.map((uc, i) => (
            <article className="use-case-card" key={i}>
              <div className="use-case-icon" aria-hidden="true">{uc.icon}</div>
              <h2 className="use-case-card-title">
                {t(`use_cases.${uc.key}Title`) || uc.defaultTitle}
              </h2>

              <div className="use-case-detail">
                <span className="use-case-label">{t('use_cases.whoBenefits') || 'Who benefits'}</span>
                <p>{t(`use_cases.${uc.key}Who`) || uc.defaultWho}</p>
              </div>
              <div className="use-case-detail">
                <span className="use-case-label">{t('use_cases.whatYouEnter') || 'What you enter'}</span>
                <p>{t(`use_cases.${uc.key}Input`) || uc.defaultInput}</p>
              </div>
              <div className="use-case-detail">
                <span className="use-case-label">{t('use_cases.whatRagvynProvides') || 'What RAGVYN provides'}</span>
                <p>{t(`use_cases.${uc.key}Output`) || uc.defaultOutput}</p>
              </div>

              <Link to={uc.to} className="use-case-cta">
                {t(`use_cases.${uc.key}Cta`) || uc.defaultCta}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
