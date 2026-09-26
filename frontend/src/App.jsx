import { useEffect, useState, useRef, createContext, useContext, useCallback, useMemo } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom'
import './index.css'
import MatterWorkspace from './components/MatterWorkspace'
import DocumentUpload from './components/DocumentUpload'
import IPChecklist from './components/IPChecklist'
import VerdictEngine from './components/VerdictEngine'
import IPJourneyRoadmap from './components/IPJourneyRoadmap'
import DualUseGuardian from './components/DualUseGuardian'
import OnboardingTour from './components/OnboardingTour'
import { NextActionBar, JargonText, FriendlyEmptyState } from './components/UXHelpers'
import AccessibilityPanel from './components/AccessibilityPanel'
import ExpertConnect from './components/ExpertConnect'
import PricingPage from './components/PricingPage'
import PatentabilityAssessment from './components/PatentabilityAssessment'
import ToolIntro from './components/ToolIntro'
import { TOOL_INTRO_CONFIGS } from './data/toolIntroConfigs'
import {
  IconHome,
  IconFlask,
  IconLeaf,
  IconCalculator,
  IconBook,
  IconInfo,
  IconGovt,
  IconShield,
  IconShieldCheck,
  IconScroll,
  IconScales,
  IconGlobe,
  IconUser,
  IconUsers,
  IconLock,
  IconSearch,
  IconCheck,
  IconX,
  IconSun,
  IconMoon,
  IconArrowRight,
  IconExternalLink,
  IconMic,
  IconCopy,
  IconRotate,
  IconThumbsUp,
  IconThumbsDown,
  IconFileText,
  IconTrash,
  IconBuilding,
  IconMicroscope,
  IconEye,
  IconEyeOff,
  IconSparkles,
  IconChevronDown,
  IconAlertTriangle,
  IconTag,
  IconSend,
  IconPin,
  IconMail,
  IconPhone,
  IconAccessibility,
  IconMenu,
  IconTrendingUp,
  IconCalendar,
  IconCurrencyRupee,
  IconMessageSquare,
  IconBriefcase,
  IconPaperClip,
  IconEdit,
  IconPalette,
  IconPlay,
  IconPause,
  IconRotateCcw10,
  IconRotateCw10,
  IconMaximize,
  IconMinimize,
  IconVolume,
  IconVolumeX,
} from './components/Icons'
import { RAGVYN_THEMES, getChatTheme, getThemeCSSVariables, DEFAULT_THEME_ID } from './config/chatThemes'
import DraftGenerator from './components/DraftGenerator'
import { getApiBase } from './api/config'

// IconClose component (X icon)
function IconClose({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ============================================================
   GLOBAL LANGUAGE CONTEXT & TRANSLATIONS
   ============================================================ */
const SITE_LANGUAGES = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'hi', label: 'हिन्दी', flag: 'HI' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: 'KN' },
  { code: 'bn', label: 'বাংলা', flag: 'BN' },
  { code: 'ta', label: 'தமிழ்', flag: 'TA' },
  { code: 'te', label: 'తెలుగు', flag: 'TE' },
  { code: 'mr', label: 'मराठी', flag: 'MR' },
  { code: 'gu', label: 'ગુજરાતી', flag: 'GU' },
  { code: 'ml', label: 'മലയാളം', flag: 'ML' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', flag: 'PA' },
]

// Complete translations for all UI text
const UI_TRANSLATIONS = {
  en: {
    // Government Header
    govtOf: 'Government of India',
    ministry: 'Ministry of AYUSH',
    searchPlaceholder: 'Search statutes, Section 3(p), ABS guidelines...',

    // Navbar
    home: 'Home',
    absChecker: 'ABS Checker',
    ipCalculator: 'IP Calculator',
    officialSources: 'Official Sources',
    aboutPortal: 'About Portal',
    consultAssistant: 'Consult RagVyn AI',

    // Patent Fee Calculator (Patents Rules 2003, First Schedule — e-filing)
    pfcTitle: 'Quick Patent Fee Calculator',
    pfcSubtitle: 'Instant Indian Patent Office fee estimate based on the Patents Rules 2003, First Schedule (e-filing rates).',
    pfcApplicantType: 'Applicant Type',
    pfcAppNatural: 'Natural Person',
    pfcAppStartup: 'Startup',
    pfcAppSmall: 'Small Entity',
    pfcAppOthers: 'Others (Large Entity)',
    pfcApplicationType: 'Application Type',
    pfcTypeOrdinary: 'Ordinary',
    pfcTypeConvention: 'Convention',
    pfcTypePct: 'PCT National Phase',
    pfcClaims: 'Number of Claims',
    pfcClaimsHint: 'First 10 claims included. Extra fee applies beyond 10.',
    pfcPages: 'Number of Pages',
    pfcPagesHint: 'First 30 pages included. Extra fee applies beyond 30.',
    pfcEarlyPub: 'Request Early Publication (Form 9)',
    pfcExamReq: 'Request for Examination (Form 18)',
    pfcOptions: 'Optional Fees',
    pfcBreakdown: 'Fee Breakdown',
    pfcBaseFee: 'Filing Fee (Form 1)',
    pfcExtraClaims: 'Extra Claims',
    pfcExtraPages: 'Extra Pages',
    pfcEarlyPubFee: 'Early Publication (Form 9)',
    pfcExamFee: 'Examination Request (Form 18)',
    pfcTotal: 'Total Statutory Fee',
    pfcPerClaim: 'per claim',
    pfcPerPage: 'per page',
    pfcDisclaimer: 'Indicative Indian Patent Office statutory fees only (e-filing). Excludes attorney/agent professional charges. Verify current rates on the official IP India portal before filing.',
    pfcReset: 'Reset',
    pfcOpenFull: 'Open Full Cost Estimator',

    // Hero Section
    heroEyebrow: 'AYUSH INNOVATION GUIDANCE',
    heroTitle: 'Protect your innovation.',
    heroSubtitle: 'Know what comes next.',
    heroDesc: 'Navigate intellectual property, regulation, traditional knowledge and biodiversity-related pathways through one guided assessment.',
    startAssessment: 'Start Assessment →',
    startConsultation: 'Start Assessment →',
    howItWorksBtn: 'How it works',
    formulationWizard: 'Formulation Wizard',
    seeDemo: 'See Demo',

    // Trust Pills
    zeroHallucination: 'Zero-hallucination',
    sourceCited: 'Source-cited',
    multiLanguage: '10+ Languages',
    indiaIntl: 'India & International',

    // Trust Badges (Hero Section)
    trustPatentsAct: 'Patents Act 1970',
    trustPatentsActDesc: '§ 3(p) TKDL Exclusions',
    trustTkdl: 'TKDL Database',
    trustTkdlDesc: '2.5L+ Formulations Prior Art',
    trustBdAct: 'Biodiversity Act 2002',
    trustBdActDesc: 'Mandatory ABS Clearances',
    trustDrugsRules: 'Drugs & Cosmetics Rules',
    trustDrugsRulesDesc: 'ASU Regulatory Licensing',

    // Stats Section
    statutesCovered: 'Statutes Covered',
    languagesSupported: 'Languages Supported',
    averageResponseTime: 'Avg Response Time',
    userSatisfaction: 'User Satisfaction',

    // Features Section
    featuresLabel: 'Complete Feature Suite',
    featuresTitle: 'Everything you need for Ayurvedic IP & Regulatory Protection',
    featureStatuteCited: 'Statute-Cited Answers',
    featureStatuteCitedDesc: 'Every response backed by exact section citations from Patents Act 1970, BD Act 2002, TKDL, and WIPO treaties.',
    featureFormulationWizard: 'Formulation Wizard',
    featureFormulationWizardDesc: '3-step classification flow guiding Vaidyas & MSMEs through Classical vs Proprietary vs Nutraceutical patentability.',
    featureMultilingual: 'Multilingual Support',
    featureMultilingualDesc: 'Ask in Hindi, Kannada, Bengali, Tamil, Telugu, or English with accurate legal terminology mapping.',
    featureJurisdiction: 'Jurisdiction-Aware',
    featureJurisdictionDesc: 'Toggle seamlessly between domestic Indian Law and International Treaties (PCT, WIPO GRATK, CBD).',
    featureABS: 'ABS Compliance Checker',
    featureABSDesc: 'Verify Nagoya Protocol and BD Act compliance before commercializing formulations with endemic ingredients.',
    featureTKDL: 'TKDL Integration',
    featureTKDLDesc: 'Cross-reference against Traditional Knowledge Digital Library to assess prior art barriers.',

    // Tools Section
    toolsLabel: 'Free Tools',
    toolsTitle: 'IP Calculators & Utilities',
    toolsSubtitle: 'Essential tools for patent applicants — calculate fees, track deadlines, and plan your IP strategy',
    feeCalcTitle: 'Patent Fee Calculator',
    feeCalcDesc: 'Calculate filing, examination, and renewal fees based on applicant type (Natural Person, Startup, Small Entity, Large Entity) per Patents Rules 2003.',
    calculateNow: 'Calculate Now',
    deadlineCalcTitle: 'Deadline Calculator',
    deadlineCalcDesc: 'Track statutory deadlines — RFE (48 months), FER response (6 months), renewals, PCT national phase (31 months), and convention priority (12 months).',
    checkDeadlines: 'Check Deadlines',
    aiAssistantTitle: 'RagVyn AI',
    aiAssistantDesc: 'Ask questions about Indian IP law, traditional knowledge protection, ABS compliance, and get citation-backed answers from authoritative sources.',
    askNow: 'Ask Now',

    // How It Works
    howItWorksLabel: 'Simple Process',
    howItWorksTitle: 'How IP-SAKTI Sahayak Works',
    step1Title: 'Ask Your Question',
    step1Desc: 'Describe your formulation, IP concern, or regulatory query in any supported language.',
    step2Title: 'AI Retrieves Citations',
    step2Desc: 'Our RAG system searches official legal databases for relevant statutes and precedents.',
    step3Title: 'Get Cited Guidance',
    step3Desc: 'Receive structured guidance with exact section references and confidence ratings.',
    step4Title: 'Assess & Act',
    step4Desc: 'Use confidence badges & Formulation Wizard to plan your patent or licensing filing.',

    // Comparison Section
    comparisonLabel: 'Why Choose IP-SAKTI?',
    comparisonTitle: 'Not just another chatbot. A domain-specialized legal guide',
    comparisonFeature: 'Feature',
    comparisonGenericAI: 'Generic AI',
    comparisonIpSakti: 'IP-SAKTI',

    // Demo Section
    seeDemo: 'See Demo',
    demoLabel: 'Live Demo',
    demoTitle: 'See IP-SAKTI in Action',
    demoSampleResponse: 'IP-SAKTI Sahayak: Sample Response',
    demoHighConfidence: 'High Confidence',
    demoDisclaimer: 'Informational only. Consult IP attorney for formal advice',
    demoTryIt: 'Try It Yourself',

    // Personas Section
    personasLabel: 'Who Is It For?',
    personasTitle: 'Built for the entire Ayurveda ecosystem',
    painPoint: 'Pain Point',

    // Demo Section - Sample Chat
    demoUserQuestion: 'Can I patent my Ayurvedic arthritis formulation?',
    demoAiResponse1: 'Under Section 3(p) of the Patents Act 1970, traditional Ayurvedic formulations from classical texts are barred from patenting as they constitute prior art in the public domain.',
    demoAiResponse2: 'However, if your formulation has a novel delivery mechanism or enhanced therapeutic efficacy backed by clinical data, it may qualify as a patentable invention under Section 2(1)(j).',

    // Wizard Modal
    wizardTitle: 'Ayurvedic Formulation Classifier',
    wizardSubtitle: 'Guided 3-Step IP & Regulatory Assessment',
    wizardStep1Title: 'Step 1: What is the source of your formulation formula?',
    wizardStep1Desc: 'Select the primary origin of ingredients and recipe ratio.',
    wizardStep2Title: 'Step 2: What novel elements have you added?',
    wizardStep2Desc: 'Select the type of innovation or modification in your formulation.',
    wizardStep3Title: 'Step 3: Intended use and regulatory pathway?',
    wizardStep3Desc: 'Select how the formulation will be commercialized.',
    wizardClassical: 'Classical / Shastriya',
    wizardClassicalDesc: 'From Charaka Samhita, Sushruta, Ashtanga Hridaya',
    wizardProprietary: 'Proprietary / Modified',
    wizardProprietaryDesc: 'New combination, ratio change, or modern ingredient',
    wizardNovelDelivery: 'Novel Delivery System',
    wizardNovelDeliveryDesc: 'Nano-formulation, liposomal, transdermal patch',
    wizardEnhancedEfficacy: 'Enhanced Efficacy Data',
    wizardEnhancedEfficacyDesc: 'Clinical trials, bioavailability studies',
    wizardNoModification: 'No Modification',
    wizardNoModificationDesc: 'Traditional preparation method only',
    wizardAyushDrug: 'AYUSH Licensed Drug',
    wizardAyushDrugDesc: 'Rule 158-B, Schedule E compliance',
    wizardNutraceutical: 'Nutraceutical / Supplement',
    wizardNutraceuticalDesc: 'FSSAI Ayurveda Aahar category',
    wizardCosmetic: 'Cosmetic / Personal Care',
    wizardCosmeticDesc: 'BIS standards, no therapeutic claims',
    wizardBack: 'Back',
    wizardNext: 'Next',
    wizardAssessment: 'Assessment',
    wizardResult: 'IP Classification Result',
    wizardCategory: 'Category',
    wizardPatentability: 'Patentability',
    wizardRegulatory: 'Regulatory Path',
    wizardRecommendation: 'Recommendation',

    // Statutes Section
    statutesLabel: 'Authoritative Data Corpus',
    statutesTitle: 'Grounded in official statutes & international treaties',
    statutesSubtitle: 'Zero simulated laws. Every citation is verified against statutory archives',

    // FAQ Section
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: 'Clear all your doubts about IP-SAKTI and Ayurvedic IP protection',
    faqReadIn: 'Read in:',
    moreQuestions: 'Have more questions? Ask RagVyn AI!',
    askIpSakti: 'Ask IP-SAKTI',
    askRagvynAi: 'Ask RagVyn AI',

    // Footer
    footerDesc: 'AI-powered IP guidance for Ayurveda',
    footerDisclaimer: 'Informational research tool only. Does not constitute formal legal advice. Consult a registered IP attorney for official proceedings.',
    footerCopyright: '© 2026 IP-SAKTI Sahayak. Built with care for Ayurveda innovators.',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',

    // Chat Page
    chatWelcome: 'Namaste! I am IP-SAKTI Sahayak, your guide to Intellectual Property in Ayurveda. Ask me about patents, trademarks, GI tags, TKDL, or any IP question related to traditional knowledge.',
    chatPlaceholder: 'Ask about Patents Act, ABS clearance, BD Act 2002, TKDL, trademarks...',
    sendMessage: 'Send',

    // Voice Input
    voiceInput: 'Voice Input',
    voiceListening: 'Listening...',
    voiceNotSupported: 'Voice input not supported in this browser',
    voiceError: 'Voice recognition error. Please try again.',
    tapToSpeak: 'Tap to speak',

    // PDF Export
    exportPdf: 'Export PDF',
    exportingPdf: 'Generating PDF...',
    ipAssessmentReport: 'IP Assessment Report',
    generatedBy: 'Generated by IP-SAKTI Sahayak',
    consultationSummary: 'Consultation Summary',
    legalDisclaimer: 'Legal Disclaimer',
    disclaimerText: 'This report is for informational purposes only and does not constitute legal advice. Please consult a registered IP attorney for formal proceedings.',

    jurisdiction: 'Jurisdiction',
    jurisdictionIndia: 'India',
    jurisdictionInternational: 'International',
    jurisdictionBoth: 'Both',
    chooseJurisdiction: 'Choose Jurisdiction',
    newConsultation: 'New Consultation',
    pastConversations: 'Past Conversations',
    newChat: 'New Chat',
    chatHistory: 'Chat History',
    suggestedPrompts: 'Suggested Questions',
    typing: 'Typing...',
    about: 'About',
    clearSession: 'Clear Session',
    absCompliance: 'ABS Compliance',
    officialDataCorpora: 'Official Data Corpora',
    aboutIpSakti: 'About IP-SAKTI',
    patentsActSection: 'Patents Act',
    tkdlCheck: 'TKDL Check',
    giTagging: 'GI Tagging',
    toggleSidebar: 'Toggle history sidebar',
    backToHome: 'Back to IP-SAKTI Sahayak home',
    quickActions: 'Quick actions',
    messageInput: 'Message input',
    typeYourQuestion: 'Type your IP question',
    selectResponseLang: 'Select response language',

    // Confidence Levels
    highConfidence: 'High Confidence (Direct Statute Match)',
    mediumConfidence: 'Moderate Confidence: Verify details with expert',
    lowConfidence: 'Low Confidence: Consult a registered IP attorney',

    // ABS Checker Page
    absPageTitle: 'ABS Compliance Checker',
    absPageSubtitle: 'Verify Access and Benefit Sharing (ABS) obligations & National Biodiversity Authority (NBA) approval requirements.',
    absCheckButton: 'Check Compliance Requirements',
    absChipLabel: 'Biological Diversity Act 2002 Module',
    absApplicantType: 'Applicant Entity Type',
    absIndianCitizen: 'Indian Citizen / Local Cultivator',
    absIndianCompany: 'Indian Entity (100% Domestic Shareholding)',
    absForeignEntity: 'Foreign Entity / NRI / Foreign Shareholding Company',
    absResourceOrigin: 'Origin of Biological Material',
    absSourcedIndia: 'Sourced within India (Flora / Medicinal Herbs / Micro-organisms)',
    absImported: 'Imported from foreign country',
    absIntendedPurpose: 'Intended Purpose / Activity',
    absCommercial: 'Commercial Utilization & Drug Manufacturing',
    absPatent: 'Filing Intellectual Property / Patent Protection',
    absExport: 'Transfer of Research / Exporting Bio-Resources',

    // Sources Page
    sourcesPageTitle: 'Official Ingested Data Sources',
    sourcesPageSubtitle: 'IP-SAKTI Sahayak strictly cites verified government statutes, international treaties, and traditional knowledge archives.',
    sourcesChipLabel: 'Grounding Corpus',
    sourcesVisitSource: 'Visit Source',

    // Privacy Policy Page
    privacyTitle: 'Privacy Policy',
    privacyLegal: 'Legal',
    privacyLastUpdated: 'Last updated: January 2026',
    privacyIntroTitle: '1. Introduction',
    privacyIntroText: 'IP-SAKTI Sahayak is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered Ayurvedic IP guidance platform operated under the Ministry of AYUSH, Government of India.',
    privacyDataTitle: '2. Information We Collect',
    privacyDataProvided: '2.1 Information You Provide',
    privacyDataAuto: '2.2 Automatically Collected Information',
    privacyQueryData: 'Query Data',
    privacyQueryDataDesc: 'Questions you ask about IP, patents, trademarks, and regulatory compliance',
    privacyAccountInfo: 'Account Information',
    privacyAccountInfoDesc: 'Email address and name (for premium users)',
    privacyFeedback: 'Feedback',
    privacyFeedbackDesc: 'Ratings and comments you provide about our responses',
    privacyUsageData: 'Usage Data',
    privacyUsageDataDesc: 'Pages visited, features used, session duration',
    privacyDeviceInfo: 'Device Information',
    privacyDeviceInfoDesc: 'Browser type, operating system, device type',
    privacyLangPref: 'Language Preferences',
    privacyLangPrefDesc: 'Selected language for the interface',
    privacyUseTitle: '3. How We Use Your Information',
    privacyUse1: 'To provide AI-powered IP guidance and legal information retrieval',
    privacyUse2: 'To improve our RAG (Retrieval-Augmented Generation) system accuracy',
    privacyUse3: 'To personalize your experience based on language and jurisdiction preferences',
    privacyUse4: 'To send service updates and notifications (with your consent)',
    privacyUse5: 'To comply with legal obligations under Indian law',
    privacyStorageTitle: '4. Data Storage & Security',
    privacyStorageText: 'Your data is stored on secure servers located in India, in compliance with the Digital Personal Data Protection Act, 2023 (DPDP Act). We implement industry-standard encryption (AES-256) for data at rest and TLS 1.3 for data in transit.',
    privacyRetentionTitle: '5. Data Retention',
    privacyRetentionText: 'Query history is retained for 90 days to improve service quality. Account data is retained until you request deletion. Anonymized, aggregated data may be retained indefinitely for research and system improvement.',
    privacyRightsTitle: '6. Your Rights',
    privacyRightsIntro: 'Under the DPDP Act 2023 and applicable regulations, you have the right to:',
    privacyRightAccess: 'Access',
    privacyRightAccessDesc: 'Request a copy of your personal data',
    privacyRightCorrection: 'Correction',
    privacyRightCorrectionDesc: 'Request correction of inaccurate data',
    privacyRightErasure: 'Erasure',
    privacyRightErasureDesc: 'Request deletion of your data',
    privacyRightPortability: 'Portability',
    privacyRightPortabilityDesc: 'Receive your data in a machine-readable format',
    privacyRightWithdraw: 'Withdraw Consent',
    privacyRightWithdrawDesc: 'Opt-out of data processing at any time',
    privacyThirdPartyTitle: '7. Third-Party Services',
    privacyThirdPartyText: 'We may use third-party services for analytics (anonymized), cloud infrastructure, and AI model processing. All third-party processors are contractually bound to protect your data and comply with Indian data protection laws.',
    privacyCookiesTitle: '8. Cookies & Local Storage',
    privacyCookiesText: 'We use essential cookies and local storage for theme preferences, language settings, and session management. No tracking cookies are used without explicit consent.',
    privacyContactTitle: '9. Contact Us',
    privacyContactIntro: 'For privacy-related inquiries or to exercise your rights, contact our Data Protection Officer:',
    privacyEmail: 'Email',
    privacyAddress: 'Address',
    privacyAddressValue: 'Ministry of AYUSH, AYUSH Bhawan, B Block, GPO Complex, INA, New Delhi - 110023',
    privacyChangesTitle: '10. Changes to This Policy',
    privacyChangesText: 'We may update this Privacy Policy periodically. Changes will be posted on this page with an updated revision date. Continued use of the platform after changes constitutes acceptance of the revised policy.',
    privacyNoSell: 'We do NOT sell, rent, or trade your personal information to third parties for marketing purposes.',

    // Common Actions
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    close: 'Close',
    submit: 'Submit',
    cancel: 'Cancel',
    back: 'Back',
    next: 'Next',
    learnMore: 'Learn More',
    viewAll: 'View All',

    // Wizard Modal
    askIpSaktiDetailed: 'Ask IP-SAKTI Detailed Questions',
    retestFormulation: 'Re-test Formulation',

    // About Modal
    aboutTitle: 'About IP-SAKTI Sahayak',
    aboutSubtitle: 'Intellectual Property & Regulatory Guidance Platform',
    closeModal: 'Close modal',
    aboutPurposeTitle: 'Purpose & Vision',
    aboutPurposeP1: 'IP-SAKTI Sahayak is an AI-powered platform designed to help AYUSH innovators and Vaidyas navigate Indian Intellectual Property laws, Traditional Knowledge, and biological diversity compliance through a structured and evidence-based digital interface.',
    aboutPurposeP2: 'The platform brings together regulatory tools, authoritative sources, and RagVyn AI, its RAG-based AI assistant, to make complex IP and regulatory information easier to understand and access.',
    aboutPurposeText: 'IP-SAKTI Sahayak is an AI-powered platform designed to help AYUSH innovators and Vaidyas navigate Indian Intellectual Property laws, Traditional Knowledge, and biological diversity compliance through a structured and evidence-based digital interface. The platform brings together regulatory tools, authoritative sources, and RagVyn AI, its RAG-based AI assistant, to make complex IP and regulatory information easier to understand and access.',
    aboutGroundingTitle: 'Grounding Policy & Zero Hallucination',
    aboutGroundingP1: 'RagVyn AI uses Retrieval-Augmented Generation (RAG) to ground responses in the platform\'s official knowledge corpus.',
    aboutGroundingP2: 'When relevant legal or regulatory evidence is unavailable, it abstains rather than inventing information.',
    aboutGroundingP3: 'Responses include section citations, source/database references, and confidence indicators wherever applicable.',
    aboutGroundingText: 'RagVyn AI uses Retrieval-Augmented Generation (RAG) to ground responses in the platform\'s official knowledge corpus. When relevant legal or regulatory evidence is unavailable, it abstains rather than inventing information. Responses include section citations, source/database references, and confidence indicators wherever applicable.',
    aboutCorporaTitle: 'Core Ingested Corpus',
    aboutDisclaimer: 'IP-SAKTI Sahayak is an informational research platform for AYUSH innovators and Vaidyas. It does not replace professional legal representation before the Controller General of Patents or High Courts.',
    disclaimer: 'Disclaimer',

    // Chat Sidebar Demo Data
    today: 'Today',
    yesterday: 'Yesterday',

    // Login Page
    loginTitle: 'Sign In to IP-SAKTI Sahayak',
    loginSubtitle: 'Access your personalized IP guidance dashboard',
    loginWithGoogle: 'Continue with Google',
    loginWithApple: 'Continue with Apple',
    loginWithMagicLink: 'Send Magic Link',
    orContinueWith: 'or continue with email',
    emailLabel: 'Email Address',
    emailPlaceholder: 'Enter your email',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    forgotPassword: 'Forgot password?',
    signInButton: 'Sign In',
    signingIn: 'Signing in...',
    noAccount: "Don't have an account?",
    registerHere: 'Register here',
    haveAccount: 'Already have an account?',
    signInHere: 'Sign in here',
    registerTitle: 'Create Your Account',
    registerSubtitle: 'Join thousands of Ayurveda innovators',
    registerButton: 'Create Account',
    creating: 'Creating account...',
    fullNameLabel: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',
    loginError: 'Invalid login credentials. Please try again.',
    registerError: 'Registration failed. Please try again.',
    magicLinkSent: 'Magic link sent! Check your email.',
    magicLinkError: 'Failed to send magic link. Try again.',
    loginOrRegister: 'Login / Register',
    tourNavBtn: 'Tour',
    tourStep: 'Step',
    tourSkip: 'Skip',
    tourPrev: 'Back',
    tourNext: 'Next',
    tourFinish: 'Got it!',
    tourWelcomeTitle: 'Welcome to IP-SAKTI Sahayak! 👋',
    tourWelcomeDesc: 'Your AI guide for Ayurveda IP, patents, TKDL and regulatory questions. Let us show you around in 30 seconds.',
    tourChatTitle: '💬 Ask RagVyn AI',
    tourChatDesc: 'Ask any Ayurveda IP question in your language and get a cited, trustworthy answer — the heart of the app.',
    tourToolsTitle: '🧰 IP Tools',
    tourToolsDesc: 'Open this menu for our smart tools that go beyond chat. We will highlight the top three next.',
    tourVerdictTitle: '🛡️ Patentability Verdict',
    tourVerdictDesc: 'Type a formula and get an instant RED / YELLOW / GREEN verdict on whether it can be patented — our Biopiracy Shield.',
    tourRoadmapTitle: '🗺️ IP Journey Roadmap',
    tourRoadmapDesc: 'See your full patent journey — filing to grant to renewals — as a personalized, grounded timeline.',
    tourGuardianTitle: '🧭 Dual-Use Guardian',
    tourGuardianDesc: 'One view for ALL the compliance you need — patent + AYUSH licence + Biodiversity (ABS) + FSSAI.',
    tourFeeTitle: '💰 Fee Calculator',
    tourFeeDesc: 'Estimate your exact patent filing fees (Natural Person / Startup / Others) with all the extra-claim and page charges.',
    tourDeadlineTitle: '📅 Deadline Calculator',
    tourDeadlineDesc: 'Never miss a date — track RFE, FER, publication, renewals and PCT deadlines from your filing date.',
    tourAbsTitle: '🌿 ABS Checker',
    tourAbsDesc: 'Check if your biological resource needs NBA / ABS approval under the Biodiversity Act before you commercialise.',
    tourChecklistTitle: '✅ Filing Checklists',
    tourChecklistDesc: 'Step-by-step interactive checklists for Patent, Trademark, GI and ABS filings with docs, time and fees.',
    tourFtoTitle: 'FTO',
    tourFtoDesc: 'It helps users identify relevant existing patents and potential infringement risks before commercializing an Ayurvedic product or formulation.',
    tourServicesTitle: '💼 Services',
    tourServicesDesc: 'Open this menu for hands-on services — draft generation, your case workspace, document upload and expert help.',
    tourDraftsTitle: '📝 Draft Generator',
    tourDraftsDesc: 'Auto-fill official templates — patent Form-1, NBA Form III, and a Section 3(p) opposition petition.',
    tourWorkspaceTitle: '🗂️ Matter Workspace',
    tourWorkspaceDesc: 'Track all your IP cases in one place — statuses, notes and documents per matter (login required).',
    tourDocumentsTitle: '📎 Document Upload',
    tourDocumentsDesc: 'Upload your own PDFs and search them privately — kept separate from the public corpus (login required).',
    tourExpertsTitle: '👥 Expert Connect',
    tourExpertsDesc: 'Find verified IP experts by language and rating, request a consultation, and browse common IP FAQs.',
    tourSourcesTitle: '📚 Sources',
    tourSourcesDesc: 'See exactly which laws, acts and treaties power our answers — full transparency you can trust.',
    tourPricingTitle: '🏷️ Pricing',
    tourPricingDesc: 'Free to start. Upgrade for more daily queries, uploads, drafts and expert consultations when you need them.',
    tourFinishTitle: '🎉 You are all set!',
    tourFinishDesc: 'That is the whole toolkit. Jump into RagVyn AI to ask your first question — replay this tour anytime from the Tour button.',
    logout: 'Logout',
    dashboard: 'Dashboard',
    welcomeBack: 'Welcome back',
    secureLogin: 'Secure & Encrypted',
    govtPortal: 'Official Government Portal',
    termsNote: 'By signing in, you agree to our',
    termsLink: 'Terms of Service',
    andText: 'and',
    privacyLink: 'Privacy Policy',

    // Deadline Calculator
    deadlineCalc: 'Deadline Calculator',
    deadlineChip: 'Statutory Deadline Calculator',
    deadlineTitle: 'Indian Patent Deadline Calculator',
    deadlineSubtitle: 'Compute every statutory patent deadline from your filing / priority date — RFE, examination response, renewals, PCT & convention windows.',
    deadlineFilingLabel: 'Filing Date',
    deadlinePriorityLabel: 'Priority Date (optional)',
    deadlinePriorityHint: 'Set this if you are claiming Convention / earlier priority. RFE is counted from the earliest of filing or priority.',
    deadlineCalcBtn: 'Calculate Deadlines',
    deadlineResetBtn: 'Reset',
    deadlineTimelineTitle: 'Deadline Timeline',
    deadlineEmptyHint: 'Enter a filing date to see your statutory deadlines.',
    deadlineDueIn: 'due in',
    deadlineOverdue: 'Overdue',
    deadlineDueToday: 'Due today',
    deadlineDays: 'days',
    deadlineMonths: 'months',
    deadlineYears: 'years',
    deadlineUrgent: 'Action needed soon',
    deadlinePassed: 'Deadline passed',
    deadlineUpcoming: 'Upcoming',
    deadlineLegendUrgent: 'Within 3 months',
    deadlineLegendUpcoming: 'Upcoming',
    deadlineLegendPassed: 'Passed',
    deadlineDisclaimer: 'Indicative only. Deadlines depend on the exact procedural facts of your application (e.g. date the First Examination Report issues, extensions granted). Confirm every date with a registered patent agent and the official IP India records before relying on it.',
    deadlineAskExpert: 'Ask IP Expert',
    // Deadline item labels
    dlRfeTitle: 'Request for Examination (RFE)',
    dlRfeDesc: 'File Form 18 within 48 months of the priority / filing date, else the application is treated as withdrawn (Rule 24B).',
    dlPublishTitle: 'Early Publication Window',
    dlPublishDesc: 'Application publishes automatically at 18 months. File Form 9 before then to request early publication.',
    dlFerTitle: 'Response to First Examination Report (FER)',
    dlFerDesc: 'Reply within 6 months of the FER; extendable by up to 3 months on Form 4. (Shown from filing as a planning estimate — the real clock starts when the FER issues.)',
    dlTermTitle: 'Patent Term Expiry',
    dlTermDesc: '20 years from the date of filing (Section 53), subject to payment of renewal fees.',
    dlPctTitle: 'PCT National Phase Entry',
    dlPctDesc: 'Enter the Indian national phase within 31 months of the priority date (Rule 20).',
    dlConventionTitle: 'Convention Priority Deadline',
    dlConventionDesc: 'File the corresponding foreign/convention application within 12 months of the priority date (Paris Convention).',
    dlRenewalTitle: 'Renewal Fee',
    dlRenewalDescFrom: 'Renewal fee for year',
    dlRenewalDescDue: 'due from the 3rd year onward (Section 53 / Rule 80).',
    dlYearN: 'Year',
  },
  hi: {
    // Government Header
    govtOf: 'भारत सरकार',
    ministry: 'आयुष मंत्रालय',
    searchPlaceholder: 'पोर्टल खोजें...',

    // Navbar
    home: 'होम',
    absChecker: 'ABS चेकर',
    ipCalculator: 'IP कैलकुलेटर',
    officialSources: 'आधिकारिक स्रोत',
    aboutPortal: 'पोर्टल के बारे में',
    consultAssistant: 'RagVyn AI से परामर्श करें',

    // Patent Fee Calculator (पेटेंट नियम 2003, प्रथम अनुसूची — ई-फाइलिंग)
    pfcTitle: 'त्वरित पेटेंट शुल्क कैलकुलेटर',
    pfcSubtitle: 'पेटेंट नियम 2003, प्रथम अनुसूची (ई-फाइलिंग दरें) के आधार पर भारतीय पेटेंट कार्यालय शुल्क का तत्काल अनुमान।',
    pfcApplicantType: 'आवेदक का प्रकार',
    pfcAppNatural: 'प्राकृतिक व्यक्ति',
    pfcAppStartup: 'स्टार्टअप',
    pfcAppSmall: 'लघु इकाई',
    pfcAppOthers: 'अन्य (बड़ी इकाई)',
    pfcApplicationType: 'आवेदन का प्रकार',
    pfcTypeOrdinary: 'साधारण',
    pfcTypeConvention: 'कन्वेंशन',
    pfcTypePct: 'PCT राष्ट्रीय चरण',
    pfcClaims: 'दावों की संख्या',
    pfcClaimsHint: 'पहले 10 दावे शामिल हैं। 10 से अधिक पर अतिरिक्त शुल्क।',
    pfcPages: 'पृष्ठों की संख्या',
    pfcPagesHint: 'पहले 30 पृष्ठ शामिल हैं। 30 से अधिक पर अतिरिक्त शुल्क।',
    pfcEarlyPub: 'शीघ्र प्रकाशन का अनुरोध (फॉर्म 9)',
    pfcExamReq: 'परीक्षा हेतु अनुरोध (फॉर्म 18)',
    pfcOptions: 'वैकल्पिक शुल्क',
    pfcBreakdown: 'शुल्क विवरण',
    pfcBaseFee: 'फाइलिंग शुल्क (फॉर्म 1)',
    pfcExtraClaims: 'अतिरिक्त दावे',
    pfcExtraPages: 'अतिरिक्त पृष्ठ',
    pfcEarlyPubFee: 'शीघ्र प्रकाशन (फॉर्म 9)',
    pfcExamFee: 'परीक्षा अनुरोध (फॉर्म 18)',
    pfcTotal: 'कुल वैधानिक शुल्क',
    pfcPerClaim: 'प्रति दावा',
    pfcPerPage: 'प्रति पृष्ठ',
    pfcDisclaimer: 'केवल सांकेतिक भारतीय पेटेंट कार्यालय वैधानिक शुल्क (ई-फाइलिंग)। इसमें वकील/एजेंट शुल्क शामिल नहीं। फाइलिंग से पहले आधिकारिक IP India पोर्टल पर वर्तमान दरें सत्यापित करें।',
    pfcReset: 'रीसेट',
    pfcOpenFull: 'पूर्ण लागत अनुमानक खोलें',

    // Hero Section
    heroEyebrow: 'आयुष मंत्रालय · भारत सरकार पहल',
    heroEyebrow: 'आयुष नवाचार मार्गदर्शन',
    heroTitle: 'अपने नवाचार को सुरक्षित करें।',
    heroSubtitle: 'जानिए आगे क्या करना है।',
    heroDesc: 'एक निर्देशित मूल्यांकन के माध्यम से बौद्धिक संपदा, विनियम, पारंपरिक ज्ञान और जैव विविधता से संबंधित मार्गों का पता लगाएं।',
    startAssessment: 'मूल्यांकन शुरू करें →',
    startConsultation: 'मूल्यांकन शुरू करें →',
    howItWorksBtn: 'यह कैसे काम करता है',
    formulationWizard: 'फॉर्मूलेशन विज़ार्ड',
    seeDemo: 'डेमो देखें',

    // Trust Pills
    zeroHallucination: 'शून्य-भ्रम',
    sourceCited: 'स्रोत-उद्धृत',
    multiLanguage: '10+ भाषाएं',
    indiaIntl: 'भारत और अंतर्राष्ट्रीय',

    // Trust Badges (Hero Section)
    trustPatentsAct: 'पेटेंट अधिनियम 1970',
    trustPatentsActDesc: 'धारा 3(p) TKDL अपवर्जन',
    trustTkdl: 'TKDL डेटाबेस',
    trustTkdlDesc: '2.5 लाख+ फॉर्मूलेशन पूर्व कला',
    trustBdAct: 'जैव विविधता अधिनियम 2002',
    trustBdActDesc: 'अनिवार्य ABS अनुमोदन',
    trustDrugsRules: 'औषधि एवं प्रसाधन नियम',
    trustDrugsRulesDesc: 'ASU नियामक लाइसेंसिंग',

    // Stats Section
    statutesCovered: 'कवर किए गए क़ानून',
    languagesSupported: 'समर्थित भाषाएं',
    averageResponseTime: 'औसत प्रतिक्रिया समय',
    userSatisfaction: 'उपयोगकर्ता संतुष्टि',

    // Features Section
    featuresLabel: 'संपूर्ण फीचर सूट',
    featuresTitle: 'आयुर्वेदिक IP और नियामक सुरक्षा के लिए सब कुछ',
    featureStatuteCited: 'क़ानून-उद्धृत उत्तर',
    featureStatuteCitedDesc: 'पेटेंट अधिनियम 1970, BD अधिनियम 2002, TKDL और WIPO संधियों से सटीक अनुभाग उद्धरणों द्वारा समर्थित हर प्रतिक्रिया।',
    featureFormulationWizard: 'फॉर्मूलेशन विज़ार्ड',
    featureFormulationWizardDesc: 'वैद्यों और MSMEs को शास्त्रीय बनाम मालिकाना बनाम न्यूट्रास्युटिकल पेटेंटबिलिटी के माध्यम से मार्गदर्शन करने वाला 3-चरण वर्गीकरण प्रवाह।',
    featureMultilingual: 'बहुभाषी समर्थन',
    featureMultilingualDesc: 'हिंदी, कन्नड़, बंगाली, तमिल, तेलुगु या अंग्रेजी में सटीक कानूनी शब्दावली मैपिंग के साथ पूछें।',
    featureJurisdiction: 'अधिकार क्षेत्र-जागरूक',
    featureJurisdictionDesc: 'घरेलू भारतीय कानून और अंतर्राष्ट्रीय संधियों (PCT, WIPO GRATK, CBD) के बीच सहजता से टॉगल करें।',
    featureABS: 'ABS अनुपालन चेकर',
    featureABSDesc: 'स्थानिक सामग्री वाले फॉर्मूलेशन को व्यावसायीकृत करने से पहले नागोया प्रोटोकॉल और BD अधिनियम अनुपालन सत्यापित करें।',
    featureTKDL: 'TKDL एकीकरण',
    featureTKDLDesc: 'पूर्व कला बाधाओं का आकलन करने के लिए पारंपरिक ज्ञान डिजिटल लाइब्रेरी के विरुद्ध क्रॉस-रेफरेंस।',

    // Tools Section
    toolsLabel: 'मुफ्त उपकरण',
    toolsTitle: 'IP कैलकुलेटर और उपयोगिताएँ',
    toolsSubtitle: 'पेटेंट आवेदकों के लिए आवश्यक उपकरण — शुल्क की गणना करें, समय-सीमाएँ ट्रैक करें, और अपनी IP रणनीति की योजना बनाएं',
    feeCalcTitle: 'पेटेंट शुल्क कैलकुलेटर',
    feeCalcDesc: 'पेटेंट नियम 2003 के अनुसार आवेदक प्रकार (प्राकृतिक व्यक्ति, स्टार्टअप, लघु इकाई, बड़ी इकाई) के आधार पर फाइलिंग, परीक्षा और नवीनीकरण शुल्क की गणना करें।',
    calculateNow: 'अभी गणना करें',
    deadlineCalcTitle: 'समय-सीमा कैलकुलेटर',
    deadlineCalcDesc: 'वैधानिक समय-सीमाएँ ट्रैक करें — RFE (48 माह), FER प्रतिक्रिया (6 माह), नवीनीकरण, PCT राष्ट्रीय चरण (31 माह), और कन्वेंशन प्राथमिकता (12 माह)।',
    checkDeadlines: 'समय-सीमाएँ जाँचें',
    aiAssistantTitle: 'RagVyn AI',
    aiAssistantDesc: 'भारतीय IP कानून, पारंपरिक ज्ञान संरक्षण, ABS अनुपालन के बारे में प्रश्न पूछें और आधिकारिक स्रोतों से उद्धरण-समर्थित उत्तर प्राप्त करें।',
    askNow: 'अभी पूछें',

    // How It Works
    howItWorksLabel: 'सरल प्रक्रिया',
    howItWorksTitle: 'IP-SAKTI सहायक कैसे काम करता है',
    step1Title: 'अपना प्रश्न पूछें',
    step1Desc: 'किसी भी समर्थित भाषा में अपने फॉर्मूलेशन, IP चिंता या नियामक प्रश्न का वर्णन करें।',
    step2Title: 'AI उद्धरण प्राप्त करता है',
    step2Desc: 'हमारी RAG प्रणाली प्रासंगिक क़ानूनों और मिसालों के लिए आधिकारिक कानूनी डेटाबेस खोजती है।',
    step3Title: 'उद्धृत मार्गदर्शन प्राप्त करें',
    step3Desc: 'सटीक अनुभाग संदर्भों और विश्वास रेटिंग के साथ संरचित मार्गदर्शन प्राप्त करें।',
    step4Title: 'मूल्यांकन करें और कार्य करें',
    step4Desc: 'अपने पेटेंट या लाइसेंसिंग फाइलिंग की योजना बनाने के लिए विश्वास बैज और फॉर्मूलेशन विज़ार्ड का उपयोग करें।',

    // Comparison Section
    comparisonLabel: 'IP-SAKTI क्यों चुनें?',
    comparisonTitle: 'सिर्फ एक और चैटबॉट नहीं। एक डोमेन-विशेषज्ञ कानूनी मार्गदर्शक',
    comparisonFeature: 'फीचर',
    comparisonGenericAI: 'सामान्य AI',
    comparisonIpSakti: 'IP-SAKTI',

    // Demo Section
    seeDemo: 'डेमो देखें',
    demoLabel: 'लाइव डेमो',
    demoTitle: 'IP-SAKTI को कार्य में देखें',
    demoSampleResponse: 'IP-SAKTI सहायक: नमूना प्रतिक्रिया',
    demoHighConfidence: 'उच्च विश्वास',
    demoDisclaimer: 'केवल सूचनात्मक। औपचारिक सलाह के लिए IP वकील से परामर्श करें',
    demoTryIt: 'स्वयं आज़माएं',

    // Personas Section
    personasLabel: 'यह किसके लिए है?',
    personasTitle: 'संपूर्ण आयुर्वेद पारिस्थितिकी तंत्र के लिए निर्मित',
    painPoint: 'समस्या',

    // Demo Section - Sample Chat
    demoUserQuestion: 'क्या मैं अपने आयुर्वेदिक गठिया फॉर्मूलेशन को पेटेंट करा सकता हूं?',
    demoAiResponse1: 'पेटेंट अधिनियम 1970 की धारा 3(p) के तहत, शास्त्रीय ग्रंथों से पारंपरिक आयुर्वेदिक फॉर्मूलेशन को पेटेंट से वर्जित किया गया है क्योंकि वे सार्वजनिक डोमेन में पूर्व कला का गठन करते हैं।',
    demoAiResponse2: 'हालांकि, यदि आपके फॉर्मूलेशन में क्लिनिकल डेटा द्वारा समर्थित नवीन वितरण तंत्र या बढ़ी हुई चिकित्सीय प्रभावकारिता है, तो यह धारा 2(1)(j) के तहत पेटेंट योग्य आविष्कार के रूप में योग्य हो सकता है।',

    // Wizard Modal
    wizardTitle: 'आयुर्वेदिक फॉर्मूलेशन वर्गीकरणकर्ता',
    wizardSubtitle: 'निर्देशित 3-चरण IP और नियामक मूल्यांकन',
    wizardStep1Title: 'चरण 1: आपके फॉर्मूलेशन फॉर्मूला का स्रोत क्या है?',
    wizardStep1Desc: 'सामग्री और नुस्खा अनुपात का प्राथमिक मूल चुनें।',
    wizardStep2Title: 'चरण 2: आपने कौन से नवीन तत्व जोड़े हैं?',
    wizardStep2Desc: 'अपने फॉर्मूलेशन में नवाचार या संशोधन का प्रकार चुनें।',
    wizardStep3Title: 'चरण 3: इच्छित उपयोग और नियामक मार्ग?',
    wizardStep3Desc: 'चुनें कि फॉर्मूलेशन का व्यावसायीकरण कैसे किया जाएगा।',
    wizardClassical: 'शास्त्रीय / शास्त्रीय',
    wizardClassicalDesc: 'चरक संहिता, सुश्रुत, अष्टांग हृदय से',
    wizardProprietary: 'मालिकाना / संशोधित',
    wizardProprietaryDesc: 'नया संयोजन, अनुपात परिवर्तन, या आधुनिक सामग्री',
    wizardNovelDelivery: 'नवीन वितरण प्रणाली',
    wizardNovelDeliveryDesc: 'नैनो-फॉर्मूलेशन, लिपोसोमल, ट्रांसडर्मल पैच',
    wizardEnhancedEfficacy: 'बढ़ी हुई प्रभावकारिता डेटा',
    wizardEnhancedEfficacyDesc: 'क्लिनिकल परीक्षण, जैवउपलब्धता अध्ययन',
    wizardNoModification: 'कोई संशोधन नहीं',
    wizardNoModificationDesc: 'केवल पारंपरिक तैयारी विधि',
    wizardAyushDrug: 'आयुष लाइसेंस प्राप्त दवा',
    wizardAyushDrugDesc: 'नियम 158-B, अनुसूची E अनुपालन',
    wizardNutraceutical: 'न्यूट्रास्युटिकल / सप्लीमेंट',
    wizardNutraceuticalDesc: 'FSSAI आयुर्वेद आहार श्रेणी',
    wizardCosmetic: 'कॉस्मेटिक / पर्सनल केयर',
    wizardCosmeticDesc: 'BIS मानक, कोई चिकित्सीय दावे नहीं',
    wizardBack: 'वापस',
    wizardNext: 'अगला',
    wizardAssessment: 'मूल्यांकन',
    wizardResult: 'IP वर्गीकरण परिणाम',
    wizardCategory: 'श्रेणी',
    wizardPatentability: 'पेटेंट योग्यता',
    wizardRegulatory: 'नियामक मार्ग',
    wizardRecommendation: 'सिफारिश',

    // Statutes Section
    statutesLabel: 'आधिकारिक डेटा कॉर्पस',
    statutesTitle: 'आधिकारिक क़ानूनों और अंतर्राष्ट्रीय संधियों पर आधारित',
    statutesSubtitle: 'शून्य नकली कानून। हर उद्धरण वैधानिक अभिलेखागार के विरुद्ध सत्यापित है',

    // FAQ Section
    faqTitle: 'अक्सर पूछे जाने वाले प्रश्न',
    faqSubtitle: 'IP-SAKTI और आयुर्वेदिक IP सुरक्षा के बारे में अपने सभी संदेह दूर करें',
    faqReadIn: 'इसमें पढ़ें:',
    moreQuestions: 'क्या आपके पास और प्रश्न हैं? RagVyn AI से पूछें!',
    askIpSakti: 'IP-SAKTI से पूछें',
    askRagvynAi: 'RagVyn AI से पूछें',

    // Footer
    footerDesc: 'आयुर्वेद के लिए AI-संचालित IP मार्गदर्शन',
    footerDisclaimer: 'केवल सूचनात्मक अनुसंधान उपकरण। औपचारिक कानूनी सलाह नहीं है। आधिकारिक कार्यवाही के लिए पंजीकृत IP वकील से परामर्श करें।',
    footerCopyright: '© 2026 IP-SAKTI सहायक। आयुर्वेद नवप्रवर्तकों के लिए प्यार से बनाया गया।',
    privacyPolicy: 'गोपनीयता नीति',
    termsOfService: 'सेवा की शर्तें',

    // Chat Page
    chatWelcome: 'नमस्ते! मैं IP-SAKTI सहायक हूं, आयुर्वेद में बौद्धिक संपदा के लिए आपका मार्गदर्शक। मुझसे पेटेंट, ट्रेडमार्क, GI टैग, TKDL, या पारंपरिक ज्ञान से संबंधित किसी भी IP प्रश्न के बारे में पूछें।',
    chatPlaceholder: 'पेटेंट अधिनियम, ABS मंज़ूरी, BD अधिनियम 2002, TKDL, ट्रेडमार्क के बारे में पूछें...',
    sendMessage: 'भेजें',

    // Voice Input
    voiceInput: 'आवाज़ इनपुट',
    voiceListening: 'सुन रहा है...',
    voiceNotSupported: 'इस ब्राउज़र में आवाज़ इनपुट समर्थित नहीं है',
    voiceError: 'आवाज़ पहचान त्रुटि। कृपया पुनः प्रयास करें।',
    tapToSpeak: 'बोलने के लिए टैप करें',

    // PDF Export
    exportPdf: 'PDF निर्यात',
    exportingPdf: 'PDF बना रहा है...',
    ipAssessmentReport: 'IP मूल्यांकन रिपोर्ट',
    generatedBy: 'IP-SAKTI सहायक द्वारा निर्मित',
    consultationSummary: 'परामर्श सारांश',
    legalDisclaimer: 'कानूनी अस्वीकरण',
    disclaimerText: 'यह रिपोर्ट केवल सूचनात्मक उद्देश्यों के लिए है और कानूनी सलाह नहीं है। औपचारिक कार्यवाही के लिए पंजीकृत IP वकील से परामर्श करें।',

    jurisdiction: 'अधिकार क्षेत्र',
    jurisdictionIndia: 'भारत',
    jurisdictionInternational: 'अंतर्राष्ट्रीय',
    jurisdictionBoth: 'दोनों',
    chooseJurisdiction: 'अधिकार क्षेत्र चुनें',
    newConsultation: 'नया परामर्श',
    pastConversations: 'पिछली बातचीत',
    newChat: 'नई चैट',
    chatHistory: 'चैट इतिहास',
    suggestedPrompts: 'सुझाए गए प्रश्न',
    typing: 'टाइप कर रहा है...',
    about: 'जानकारी',
    clearSession: 'सत्र साफ़ करें',
    absCompliance: 'ABS अनुपालन',
    officialDataCorpora: 'आधिकारिक डेटा कॉर्पोरा',
    aboutIpSakti: 'IP-SAKTI के बारे में',
    patentsActSection: 'पेटेंट अधिनियम',
    tkdlCheck: 'TKDL जांच',
    giTagging: 'GI टैगिंग',
    toggleSidebar: 'इतिहास साइडबार टॉगल करें',
    backToHome: 'IP-SAKTI सहायक होम पर वापस',
    quickActions: 'त्वरित कार्य',
    messageInput: 'संदेश इनपुट',
    typeYourQuestion: 'अपना IP प्रश्न टाइप करें',
    selectResponseLang: 'प्रतिक्रिया भाषा चुनें',

    // Confidence Levels
    highConfidence: 'उच्च विश्वास (प्रत्यक्ष क़ानून मिलान)',
    mediumConfidence: 'मध्यम विश्वास: विशेषज्ञ से विवरण सत्यापित करें',
    lowConfidence: 'कम विश्वास: पंजीकृत IP वकील से परामर्श करें',

    // ABS Checker Page
    absPageTitle: 'ABS अनुपालन चेकर',
    absPageSubtitle: 'पहुंच और लाभ साझाकरण (ABS) दायित्वों और राष्ट्रीय जैव विविधता प्राधिकरण (NBA) अनुमोदन आवश्यकताओं को सत्यापित करें।',
    absCheckButton: 'अनुपालन आवश्यकताएं जांचें',
    absChipLabel: 'जैविक विविधता अधिनियम 2002 मॉड्यूल',
    absApplicantType: 'आवेदक इकाई प्रकार',
    absIndianCitizen: 'भारतीय नागरिक / स्थानीय कृषक',
    absIndianCompany: 'भारतीय इकाई (100% घरेलू शेयरधारिता)',
    absForeignEntity: 'विदेशी इकाई / NRI / विदेशी शेयरधारिता कंपनी',
    absResourceOrigin: 'जैविक सामग्री का मूल',
    absSourcedIndia: 'भारत के भीतर प्राप्त (वनस्पति / औषधीय जड़ी-बूटियां / सूक्ष्मजीव)',
    absImported: 'विदेश से आयातित',
    absIntendedPurpose: 'इच्छित उद्देश्य / गतिविधि',
    absCommercial: 'वाणिज्यिक उपयोग और दवा निर्माण',
    absPatent: 'बौद्धिक संपदा / पेटेंट संरक्षण दाखिल करना',
    absExport: 'अनुसंधान स्थानांतरण / जैव-संसाधन निर्यात',

    // Sources Page
    sourcesPageTitle: 'आधिकारिक अंतर्ग्रहित डेटा स्रोत',
    sourcesPageSubtitle: 'IP-SAKTI सहायक केवल सत्यापित सरकारी क़ानूनों, अंतर्राष्ट्रीय संधियों और पारंपरिक ज्ञान अभिलेखागार से उद्धृत करता है।',
    sourcesChipLabel: 'ग्राउंडिंग कॉर्पस',
    sourcesVisitSource: 'स्रोत पर जाएं',

    // Privacy Policy Page
    privacyTitle: 'गोपनीयता नीति',
    privacyLegal: 'कानूनी',
    privacyLastUpdated: 'अंतिम अपडेट: जनवरी 2026',
    privacyIntroTitle: '1. परिचय',
    privacyIntroText: 'IP-SAKTI सहायक आपकी गोपनीयता की रक्षा के लिए प्रतिबद्ध है। यह गोपनीयता नीति बताती है कि जब आप आयुष मंत्रालय, भारत सरकार के तहत संचालित हमारे AI-संचालित आयुर्वेदिक IP मार्गदर्शन प्लेटफॉर्म का उपयोग करते हैं तो हम आपकी जानकारी कैसे एकत्र, उपयोग, प्रकट और सुरक्षित करते हैं।',
    privacyDataTitle: '2. हम कौन सी जानकारी एकत्र करते हैं',
    privacyDataProvided: '2.1 आपके द्वारा प्रदान की गई जानकारी',
    privacyDataAuto: '2.2 स्वचालित रूप से एकत्रित जानकारी',
    privacyQueryData: 'प्रश्न डेटा',
    privacyQueryDataDesc: 'IP, पेटेंट, ट्रेडमार्क और नियामक अनुपालन के बारे में आपके प्रश्न',
    privacyAccountInfo: 'खाता जानकारी',
    privacyAccountInfoDesc: 'ईमेल पता और नाम (प्रीमियम उपयोगकर्ताओं के लिए)',
    privacyFeedback: 'प्रतिक्रिया',
    privacyFeedbackDesc: 'हमारे उत्तरों के बारे में आपकी रेटिंग और टिप्पणियां',
    privacyUsageData: 'उपयोग डेटा',
    privacyUsageDataDesc: 'देखे गए पृष्ठ, उपयोग की गई सुविधाएं, सत्र अवधि',
    privacyDeviceInfo: 'डिवाइस जानकारी',
    privacyDeviceInfoDesc: 'ब्राउज़र प्रकार, ऑपरेटिंग सिस्टम, डिवाइस प्रकार',
    privacyLangPref: 'भाषा प्राथमिकताएं',
    privacyLangPrefDesc: 'इंटरफ़ेस के लिए चयनित भाषा',
    privacyUseTitle: '3. हम आपकी जानकारी का उपयोग कैसे करते हैं',
    privacyUse1: 'AI-संचालित IP मार्गदर्शन और कानूनी जानकारी प्राप्त करने के लिए',
    privacyUse2: 'हमारी RAG (Retrieval-Augmented Generation) प्रणाली की सटीकता में सुधार के लिए',
    privacyUse3: 'भाषा और अधिकार क्षेत्र प्राथमिकताओं के आधार पर आपके अनुभव को व्यक्तिगत बनाने के लिए',
    privacyUse4: 'सेवा अपडेट और सूचनाएं भेजने के लिए (आपकी सहमति से)',
    privacyUse5: 'भारतीय कानून के तहत कानूनी दायित्वों का पालन करने के लिए',
    privacyStorageTitle: '4. डेटा संग्रहण और सुरक्षा',
    privacyStorageText: 'आपका डेटा भारत में स्थित सुरक्षित सर्वरों पर संग्रहीत है, डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 (DPDP अधिनियम) के अनुपालन में। हम आराम पर डेटा के लिए उद्योग-मानक एन्क्रिप्शन (AES-256) और पारगमन में डेटा के लिए TLS 1.3 लागू करते हैं।',
    privacyRetentionTitle: '5. डेटा प्रतिधारण',
    privacyRetentionText: 'सेवा गुणवत्ता में सुधार के लिए प्रश्न इतिहास 90 दिनों के लिए रखा जाता है। खाता डेटा तब तक रखा जाता है जब तक आप विलोपन का अनुरोध नहीं करते। अनाम, समेकित डेटा अनुसंधान और सिस्टम सुधार के लिए अनिश्चित काल तक रखा जा सकता है।',
    privacyRightsTitle: '6. आपके अधिकार',
    privacyRightsIntro: 'DPDP अधिनियम 2023 और लागू विनियमों के तहत, आपको निम्नलिखित अधिकार हैं:',
    privacyRightAccess: 'पहुंच',
    privacyRightAccessDesc: 'अपने व्यक्तिगत डेटा की प्रति का अनुरोध करें',
    privacyRightCorrection: 'सुधार',
    privacyRightCorrectionDesc: 'गलत डेटा के सुधार का अनुरोध करें',
    privacyRightErasure: 'मिटाना',
    privacyRightErasureDesc: 'अपने डेटा को हटाने का अनुरोध करें',
    privacyRightPortability: 'पोर्टेबिलिटी',
    privacyRightPortabilityDesc: 'अपना डेटा मशीन-पठनीय प्रारूप में प्राप्त करें',
    privacyRightWithdraw: 'सहमति वापस लें',
    privacyRightWithdrawDesc: 'किसी भी समय डेटा प्रोसेसिंग से बाहर निकलें',
    privacyThirdPartyTitle: '7. तृतीय-पक्ष सेवाएं',
    privacyThirdPartyText: 'हम एनालिटिक्स (अनाम), क्लाउड इंफ्रास्ट्रक्चर और AI मॉडल प्रोसेसिंग के लिए तृतीय-पक्ष सेवाओं का उपयोग कर सकते हैं। सभी तृतीय-पक्ष प्रोसेसर आपके डेटा की सुरक्षा और भारतीय डेटा संरक्षण कानूनों का अनुपालन करने के लिए अनुबंधात्मक रूप से बाध्य हैं।',
    privacyCookiesTitle: '8. कुकीज़ और स्थानीय संग्रहण',
    privacyCookiesText: 'हम थीम प्राथमिकताओं, भाषा सेटिंग्स और सत्र प्रबंधन के लिए आवश्यक कुकीज़ और स्थानीय संग्रहण का उपयोग करते हैं। स्पष्ट सहमति के बिना कोई ट्रैकिंग कुकीज़ का उपयोग नहीं किया जाता है।',
    privacyContactTitle: '9. हमसे संपर्क करें',
    privacyContactIntro: 'गोपनीयता संबंधी पूछताछ के लिए या अपने अधिकारों का प्रयोग करने के लिए, हमारे डेटा संरक्षण अधिकारी से संपर्क करें:',
    privacyEmail: 'ईमेल',
    privacyAddress: 'पता',
    privacyAddressValue: 'आयुष मंत्रालय, आयुष भवन, बी ब्लॉक, जीपीओ कॉम्प्लेक्स, आईएनए, नई दिल्ली - 110023',
    privacyChangesTitle: '10. इस नीति में परिवर्तन',
    privacyChangesText: 'हम समय-समय पर इस गोपनीयता नीति को अपडेट कर सकते हैं। परिवर्तन इस पृष्ठ पर अपडेट की गई संशोधन तिथि के साथ पोस्ट किए जाएंगे। परिवर्तनों के बाद प्लेटफ़ॉर्म का निरंतर उपयोग संशोधित नीति की स्वीकृति है।',
    privacyNoSell: 'हम विपणन उद्देश्यों के लिए आपकी व्यक्तिगत जानकारी को तीसरे पक्ष को बेचते, किराए पर देते या व्यापार नहीं करते।',

    // Common Actions
    loading: 'लोड हो रहा है...',
    error: 'त्रुटि',
    retry: 'पुनः प्रयास करें',
    close: 'बंद करें',
    submit: 'जमा करें',
    cancel: 'रद्द करें',
    back: 'वापस',
    next: 'अगला',
    learnMore: 'और जानें',
    viewAll: 'सभी देखें',

    // Wizard Modal
    askIpSaktiDetailed: 'IP-SAKTI से विस्तृत प्रश्न पूछें',
    retestFormulation: 'फॉर्मूलेशन पुनः परीक्षण करें',

    // About Modal
    aboutTitle: 'IP-SAKTI सहायक के बारे में',
    aboutSubtitle: 'बौद्धिक संपदा सहायक',
    closeModal: 'मोडल बंद करें',
    aboutPurposeTitle: 'उद्देश्य और दृष्टि',
    aboutPurposeText: 'IP-SAKTI सहायक (स्मार्ट आयुर्वेद ज्ञान और प्रौद्योगिकी पहल) आयुष मंत्रालय के लिए बनाया गया एक AI-संचालित कानूनी और नियामक सहायक है। यह जटिल भारतीय बौद्धिक संपदा कानूनों, पारंपरिक ज्ञान संरक्षण और जैव विविधता अनुपालन के बीच की खाई को पाटता है।',
    aboutGroundingTitle: 'ग्राउंडिंग नीति और शून्य-भ्रम',
    aboutGroundingText: 'प्रत्येक प्रतिक्रिया आधिकारिक वैधानिक कॉर्पोरा में सख्ती से आधारित है। यदि प्रासंगिक कानूनी संदर्भ अनुपलब्ध है, तो सहायक कानूनी सलाह का आविष्कार करने के बजाय मना कर देता है। सभी उत्तरों में अनुभाग उद्धरण, डेटाबेस लिंक और विश्वास रेटिंग शामिल हैं।',
    aboutCorporaTitle: 'मुख्य अंतर्ग्रहित कॉर्पोरा',
    aboutDisclaimer: 'IP-SAKTI सहायक आयुष नवप्रवर्तकों और वैद्यों के लिए एक सूचनात्मक अनुसंधान उपकरण है। यह पेटेंट नियंत्रक महानियंत्रक या उच्च न्यायालयों के समक्ष पेशेवर कानूनी प्रतिनिधित्व को प्रतिस्थापित नहीं करता।',
    disclaimer: 'अस्वीकरण',

    // Chat Sidebar Demo Data
    today: 'आज',
    yesterday: 'कल',

    // Login Page
    loginTitle: 'IP-SAKTI सहायक में साइन इन करें',
    loginSubtitle: 'अपने व्यक्तिगत IP मार्गदर्शन डैशबोर्ड तक पहुंचें',
    loginWithGoogle: 'Google से जारी रखें',
    loginWithApple: 'Apple से जारी रखें',
    loginWithMagicLink: 'मैजिक लिंक भेजें',
    orContinueWith: 'या ईमेल से जारी रखें',
    emailLabel: 'ईमेल पता',
    emailPlaceholder: 'अपना ईमेल दर्ज करें',
    passwordLabel: 'पासवर्ड',
    passwordPlaceholder: 'अपना पासवर्ड दर्ज करें',
    showPassword: 'पासवर्ड दिखाएं',
    hidePassword: 'पासवर्ड छुपाएं',
    forgotPassword: 'पासवर्ड भूल गए?',
    signInButton: 'साइन इन करें',
    signingIn: 'साइन इन हो रहा है...',
    noAccount: 'खाता नहीं है?',
    registerHere: 'यहां रजिस्टर करें',
    haveAccount: 'पहले से खाता है?',
    signInHere: 'यहां साइन इन करें',
    registerTitle: 'अपना खाता बनाएं',
    registerSubtitle: 'हजारों आयुर्वेद नवप्रवर्तकों से जुड़ें',
    registerButton: 'खाता बनाएं',
    creating: 'खाता बना रहा है...',
    fullNameLabel: 'पूरा नाम',
    fullNamePlaceholder: 'अपना पूरा नाम दर्ज करें',
    loginError: 'अमान्य लॉगिन क्रेडेंशियल। कृपया पुनः प्रयास करें।',
    registerError: 'पंजीकरण विफल। कृपया पुनः प्रयास करें।',
    magicLinkSent: 'मैजिक लिंक भेजा गया! अपना ईमेल जांचें।',
    magicLinkError: 'मैजिक लिंक भेजने में विफल। पुनः प्रयास करें।',
    loginOrRegister: 'लॉगिन / रजिस्टर',
    tourNavBtn: 'टूर',
    tourStep: 'चरण',
    tourSkip: 'छोड़ें',
    tourPrev: 'पीछे',
    tourNext: 'आगे',
    tourFinish: 'समझ गया!',
    tourWelcomeTitle: 'IP-SAKTI सहायक में आपका स्वागत है! 👋',
    tourWelcomeDesc: 'आयुर्वेद IP, पेटेंट, TKDL और नियामक सवालों के लिए आपका AI गाइड। 30 सेकंड में पूरा टूर देखिए।',
    tourChatTitle: '💬 AI असिस्टेंट से पूछें',
    tourChatDesc: 'अपनी भाषा में कोई भी आयुर्वेद IP सवाल पूछें और स्रोत-सहित भरोसेमंद जवाब पाएं — यही ऐप का दिल है।',
    tourToolsTitle: '🧰 IP टूल्स',
    tourToolsDesc: 'चैट से आगे के स्मार्ट टूल्स के लिए यह मेन्यू खोलें। अब हम टॉप तीन हाइलाइट करेंगे।',
    tourVerdictTitle: '🛡️ पेटेंट योग्यता फैसला',
    tourVerdictDesc: 'कोई फॉर्मूला लिखें और तुरंत RED / YELLOW / GREEN फैसला पाएं कि पेटेंट मिल सकता है या नहीं — हमारा Biopiracy Shield।',
    tourRoadmapTitle: '🗺️ IP जर्नी रोडमैप',
    tourRoadmapDesc: 'फाइलिंग से ग्रांट और रिन्यूअल तक — अपना पूरा पेटेंट सफर एक पर्सनलाइज़्ड टाइमलाइन में देखें।',
    tourGuardianTitle: '🧭 ड्यूल-यूज़ गार्डियन',
    tourGuardianDesc: 'सारी ज़रूरी कम्प्लायंस एक जगह — पेटेंट + AYUSH लाइसेंस + बायोडायवर्सिटी (ABS) + FSSAI।',
    tourFeeTitle: '💰 फीस कैलकुलेटर',
    tourFeeDesc: 'अपनी सटीक पेटेंट फाइलिंग फीस निकालें (Natural Person / Startup / Others) — अतिरिक्त क्लेम और पेज चार्ज सहित।',
    tourDeadlineTitle: '📅 डेडलाइन कैलकुलेटर',
    tourDeadlineDesc: 'कोई तारीख न छूटे — फाइलिंग डेट से RFE, FER, पब्लिकेशन, रिन्यूअल और PCT डेडलाइन ट्रैक करें।',
    tourAbsTitle: '🌿 ABS चेकर',
    tourAbsDesc: 'कमर्शियलाइज़ करने से पहले जांचें कि आपके बायोलॉजिकल रिसोर्स को बायोडायवर्सिटी एक्ट के तहत NBA / ABS अप्रूवल चाहिए या नहीं।',
    tourChecklistTitle: '✅ फाइलिंग चेकलिस्ट',
    tourChecklistDesc: 'पेटेंट, ट्रेडमार्क, GI और ABS फाइलिंग के लिए स्टेप-बाय-स्टेप इंटरैक्टिव चेकलिस्ट — डॉक्युमेंट, समय और फीस सहित।',
    tourServicesTitle: '💼 सर्विसेज़',
    tourServicesDesc: 'हैंड्स-ऑन सर्विसेज़ के लिए यह मेन्यू खोलें — ड्राफ्ट जनरेशन, केस वर्कस्पेस, डॉक्युमेंट अपलोड और एक्सपर्ट मदद।',
    tourDraftsTitle: '📝 ड्राफ्ट जनरेटर',
    tourDraftsDesc: 'आधिकारिक टेम्पलेट अपने-आप भरें — पेटेंट Form-1, NBA Form III, और Section 3(p) विरोध याचिका।',
    tourWorkspaceTitle: '🗂️ मैटर वर्कस्पेस',
    tourWorkspaceDesc: 'अपने सभी IP केस एक जगह ट्रैक करें — हर मैटर का स्टेटस, नोट्स और डॉक्युमेंट (लॉगिन ज़रूरी)।',
    tourDocumentsTitle: '📎 डॉक्युमेंट अपलोड',
    tourDocumentsDesc: 'अपनी PDF अपलोड करें और निजी तौर पर सर्च करें — पब्लिक कॉर्पस से अलग रखी जाती हैं (लॉगिन ज़रूरी)।',
    tourExpertsTitle: '👥 एक्सपर्ट कनेक्ट',
    tourExpertsDesc: 'भाषा और रेटिंग से वेरिफाइड IP एक्सपर्ट ढूंढें, कंसल्टेशन रिक्वेस्ट करें, और आम IP FAQ पढ़ें।',
    tourSourcesTitle: '📚 स्रोत',
    tourSourcesDesc: 'देखें कि कौन-से कानून, एक्ट और संधियां हमारे जवाबों को शक्ति देती हैं — पूरी पारदर्शिता जिस पर आप भरोसा कर सकें।',
    tourPricingTitle: '🏷️ प्राइसिंग',
    tourPricingDesc: 'शुरुआत मुफ़्त। ज़्यादा डेली क्वेरी, अपलोड, ड्राफ्ट और एक्सपर्ट कंसल्टेशन के लिए ज़रूरत पड़ने पर अपग्रेड करें।',
    tourFinishTitle: '🎉 आप तैयार हैं!',
    tourFinishDesc: 'यही है पूरा टूलकिट। अपना पहला सवाल पूछने के लिए AI असिस्टेंट में जाएं — यह टूर कभी भी Tour बटन से दोबारा देख सकते हैं।',
    logout: 'लॉगआउट',
    dashboard: 'डैशबोर्ड',
    welcomeBack: 'वापसी पर स्वागत है',
    secureLogin: 'सुरक्षित और एन्क्रिप्टेड',
    govtPortal: 'आधिकारिक सरकारी पोर्टल',
    termsNote: 'साइन इन करके, आप हमारी',
    termsLink: 'सेवा की शर्तें',
    andText: 'और',
    privacyLink: 'गोपनीयता नीति',

    // Deadline Calculator
    deadlineCalc: 'समय-सीमा कैलकुलेटर',
    deadlineChip: 'वैधानिक समय-सीमा कैलकुलेटर',
    deadlineTitle: 'भारतीय पेटेंट समय-सीमा कैलकुलेटर',
    deadlineSubtitle: 'अपनी फाइलिंग / प्राथमिकता तिथि से सभी वैधानिक पेटेंट समय-सीमाओं की गणना करें — RFE, परीक्षा उत्तर, नवीनीकरण, PCT और कन्वेंशन विंडो।',
    deadlineFilingLabel: 'फाइलिंग तिथि',
    deadlinePriorityLabel: 'प्राथमिकता तिथि (वैकल्पिक)',
    deadlinePriorityHint: 'यदि आप कन्वेंशन / पूर्व प्राथमिकता का दावा कर रहे हैं तो इसे भरें। RFE फाइलिंग या प्राथमिकता में से जो पहले हो, उससे गिना जाता है।',
    deadlineCalcBtn: 'समय-सीमा की गणना करें',
    deadlineResetBtn: 'रीसेट करें',
    deadlineTimelineTitle: 'समय-सीमा टाइमलाइन',
    deadlineEmptyHint: 'अपनी वैधानिक समय-सीमाएँ देखने के लिए फाइलिंग तिथि दर्ज करें।',
    deadlineDueIn: 'शेष',
    deadlineOverdue: 'समय बीत चुका',
    deadlineDueToday: 'आज देय',
    deadlineDays: 'दिन',
    deadlineMonths: 'महीने',
    deadlineYears: 'वर्ष',
    deadlineUrgent: 'शीघ्र कार्रवाई आवश्यक',
    deadlinePassed: 'समय-सीमा समाप्त',
    deadlineUpcoming: 'आगामी',
    deadlineLegendUrgent: '3 महीने के भीतर',
    deadlineLegendUpcoming: 'आगामी',
    deadlineLegendPassed: 'बीत चुकी',
    deadlineDisclaimer: 'केवल सांकेतिक। समय-सीमाएँ आपके आवेदन के सटीक प्रक्रियात्मक तथ्यों पर निर्भर करती हैं (जैसे पहली परीक्षा रिपोर्ट जारी होने की तिथि, दी गई विस्तार अवधि)। किसी भी तिथि पर निर्भर होने से पहले पंजीकृत पेटेंट एजेंट और आधिकारिक IP India रिकॉर्ड से पुष्टि करें।',
    deadlineAskExpert: 'IP विशेषज्ञ से पूछें',
    dlRfeTitle: 'परीक्षा हेतु अनुरोध (RFE)',
    dlRfeDesc: 'प्राथमिकता / फाइलिंग तिथि से 48 महीनों के भीतर फॉर्म 18 दाखिल करें, अन्यथा आवेदन वापस लिया गया माना जाएगा (नियम 24B)।',
    dlPublishTitle: 'शीघ्र प्रकाशन विंडो',
    dlPublishDesc: 'आवेदन 18 महीनों में स्वतः प्रकाशित होता है। शीघ्र प्रकाशन हेतु उससे पहले फॉर्म 9 दाखिल करें।',
    dlFerTitle: 'पहली परीक्षा रिपोर्ट (FER) का उत्तर',
    dlFerDesc: 'FER के 6 महीनों के भीतर उत्तर दें; फॉर्म 4 पर 3 महीने तक विस्तार संभव। (फाइलिंग से नियोजन अनुमान के रूप में दिखाया गया — वास्तविक घड़ी FER जारी होने पर शुरू होती है।)',
    dlTermTitle: 'पेटेंट अवधि समाप्ति',
    dlTermDesc: 'फाइलिंग तिथि से 20 वर्ष (धारा 53), नवीनीकरण शुल्क के भुगतान के अधीन।',
    dlPctTitle: 'PCT राष्ट्रीय चरण प्रवेश',
    dlPctDesc: 'प्राथमिकता तिथि से 31 महीनों के भीतर भारतीय राष्ट्रीय चरण में प्रवेश करें (नियम 20)।',
    dlConventionTitle: 'कन्वेंशन प्राथमिकता समय-सीमा',
    dlConventionDesc: 'प्राथमिकता तिथि से 12 महीनों के भीतर संबंधित विदेशी/कन्वेंशन आवेदन दाखिल करें (पेरिस कन्वेंशन)।',
    dlRenewalTitle: 'नवीनीकरण शुल्क',
    dlRenewalDescFrom: 'वर्ष के लिए नवीनीकरण शुल्क',
    dlRenewalDescDue: 'तीसरे वर्ष से देय (धारा 53 / नियम 80)।',
    dlYearN: 'वर्ष',
  },
  // ಕನ್ನಡ (Kannada)
  kn: {
    govtOf: 'ಭಾರತ ಸರ್ಕಾರ', ministry: 'ಆಯುಷ್ ಸಚಿವಾಲಯ', searchPlaceholder: 'ಕಾಯಿದೆಗಳನ್ನು ಹುಡುಕಿ...',
    home: 'ಮುಖಪುಟ', absChecker: 'ABS ಪರಿಶೀಲಕ', ipCalculator: 'IP ಕ್ಯಾಲ್ಕುಲೇಟರ್', officialSources: 'ಅಧಿಕೃತ ಮೂಲಗಳು', aboutPortal: 'ಪೋರ್ಟಲ್ ಬಗ್ಗೆ', consultAssistant: 'IP ಸಹಾಯಕರನ್ನು ಸಂಪರ್ಕಿಸಿ',
    heroEyebrow: 'ಆಯುಷ್ ನವೀನತೆ ಮಾರ್ಗದರ್ಶನ', heroTitle: 'ನಿಮ್ಮ ನವೀನತೆಯನ್ನು ರಕ್ಷಿಸಿ.', heroSubtitle: 'ಮುಂದೆ ಏನು ಎಂದು ತಿಳಿಯಿರಿ.', heroDesc: 'ಒಂದು ಮಾರ್ಗದರ್ಶಿ ಮೌಲ್ಯಮಾಪನದ ಮೂಲಕ ಬೌದ್ಧಿಕ ಆಸ್ತಿ, ನಿಯಂತ್ರಣ ಮತ್ತು ಜೈವಿಕ ವೈವಿಧ್ಯತೆ ಮಾರ್ಗಗಳನ್ನು ಅನ್ವೇಷಿಸಿ.',
    startAssessment: 'ಮೌಲ್ಯಮಾಪನ ಪ್ರಾರಂಭಿಸಿ →', startConsultation: 'ಮೌಲ್ಯಮಾಪನ ಪ್ರಾರಂಭಿಸಿ →', howItWorksBtn: 'ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ', formulationWizard: 'ಫಾರ್ಮುಲೇಶನ್ ವಿಝಾರ್ಡ್', seeDemo: 'ಡೆಮೊ ನೋಡಿ',
    zeroHallucination: 'ಶೂನ್ಯ-ಭ್ರಮೆ', sourceCited: 'ಮೂಲ-ಉಲ್ಲೇಖಿತ', multiLanguage: '10+ ಭಾಷೆಗಳು', indiaIntl: 'ಭಾರತ ಮತ್ತು ಅಂತರರಾಷ್ಟ್ರೀಯ',
    trustPatentsAct: 'ಪೇಟೆಂಟ್ ಕಾಯಿದೆ 1970', trustPatentsActDesc: 'ವಿಭಾಗ 3(p) TKDL ಅಪವಾದಗಳು', trustTkdl: 'TKDL ಡೇಟಾಬೇಸ್', trustTkdlDesc: '2.5 ಲಕ್ಷ+ ಫಾರ್ಮುಲೇಶನ್ ಪೂರ್ವ ಕಲೆ', trustBdAct: 'ಜೈವಿಕ ವೈವಿಧ್ಯತಾ ಕಾಯಿದೆ 2002', trustBdActDesc: 'ಕಡ್ಡಾಯ ABS ಅನುಮೋದನೆ', trustDrugsRules: 'ಔಷಧಿ ಮತ್ತು ಸೌಂದರ್ಯ ನಿಯಮಗಳು', trustDrugsRulesDesc: 'ASU ನಿಯಂತ್ರಕ ಪರವಾನಗಿ',
    statutesCovered: 'ಒಳಗೊಂಡಿರುವ ಕಾಯಿದೆಗಳು', languagesSupported: 'ಬೆಂಬಲಿತ ಭಾಷೆಗಳು', averageResponseTime: 'ಸರಾಸರಿ ಪ್ರತಿಕ್ರಿಯೆ ಸಮಯ', userSatisfaction: 'ಬಳಕೆದಾರರ ತೃಪ್ತಿ',
    chatWelcome: 'ನಮಸ್ಕಾರ! ನಾನು IP-SAKTI ಸಹಾಯಕ, ಆಯುರ್ವೇದದಲ್ಲಿ ಬೌದ್ಧಿಕ ಆಸ್ತಿಗೆ ನಿಮ್ಮ ಮಾರ್ಗದರ್ಶಿ.', chatPlaceholder: 'ಪೇಟೆಂಟ್ ಕಾಯಿದೆ, ABS, TKDL ಬಗ್ಗೆ ಕೇಳಿ...', sendMessage: 'ಕಳುಹಿಸಿ',
    voiceInput: 'ಧ್ವನಿ ಇನ್‌ಪುಟ್', voiceListening: 'ಆಲಿಸುತ್ತಿದೆ...', voiceNotSupported: 'ಧ್ವನಿ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ', voiceError: 'ಧ್ವನಿ ದೋಷ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', tapToSpeak: 'ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
    exportPdf: 'PDF ರಫ್ತು', jurisdiction: 'ಅಧಿಕಾರ ವ್ಯಾಪ್ತಿ', jurisdictionIndia: 'ಭಾರತ', jurisdictionInternational: 'ಅಂತರರಾಷ್ಟ್ರೀಯ',
    newChat: 'ಹೊಸ ಚಾಟ್', chatHistory: 'ಚಾಟ್ ಇತಿಹಾಸ', typing: 'ಟೈಪ್ ಮಾಡುತ್ತಿದೆ...', about: 'ಬಗ್ಗೆ', clearSession: 'ಸೆಶನ್ ತೆರವುಗೊಳಿಸಿ',
    absCompliance: 'ABS ಅನುಸರಣೆ', patentsActSection: 'ಪೇಟೆಂಟ್ ಕಾಯಿದೆ', tkdlCheck: 'TKDL ಪರಿಶೀಲನೆ', giTagging: 'GI ಟ್ಯಾಗಿಂಗ್',
    highConfidence: 'ಹೆಚ್ಚಿನ ವಿಶ್ವಾಸ', mediumConfidence: 'ಮಧ್ಯಮ ವಿಶ್ವಾಸ', lowConfidence: 'ಕಡಿಮೆ ವಿಶ್ವಾಸ',
    loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...', error: 'ದೋಷ', retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', close: 'ಮುಚ್ಚಿ', submit: 'ಸಲ್ಲಿಸಿ', cancel: 'ರದ್ದುಮಾಡಿ', back: 'ಹಿಂದೆ', next: 'ಮುಂದೆ',
    today: 'ಇಂದು', yesterday: 'ನಿನ್ನೆ', privacyPolicy: 'ಗೌಪ್ಯತಾ ನೀತಿ', termsOfService: 'ಸೇವೆಯ ನಿಯಮಗಳು',
    selectResponseLang: 'ಪ್ರತಿಕ್ರಿಯೆ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ', typeYourQuestion: 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ',
  },
  // বাংলা (Bengali)
  bn: {
    govtOf: 'ভারত সরকার', ministry: 'আয়ুষ মন্ত্রণালয়', searchPlaceholder: 'আইন অনুসন্ধান করুন...',
    home: 'হোম', absChecker: 'ABS চেকার', ipCalculator: 'IP ক্যালকুলেটর', officialSources: 'অফিসিয়াল উৎস', aboutPortal: 'পোর্টাল সম্পর্কে', consultAssistant: 'IP সহায়ক পরামর্শ',
    heroEyebrow: 'আয়ুষ উদ্ভাবন নির্দেশনা', heroTitle: 'আপনার উদ্ভাবন রক্ষা করুন।', heroSubtitle: 'পরবর্তী কী তা জানুন।', heroDesc: 'একটি নির্দেশিত মূল্যায়নের মাধ্যমে বৌদ্ধিক সম্পত্তি, নিয়ন্ত্রণ এবং জীববৈচিত্র্য পথ অন্বেষণ করুন।',
    startAssessment: 'মূল্যায়ন শুরু করুন →', startConsultation: 'মূল্যায়ন শুরু করুন →', howItWorksBtn: 'এটি কিভাবে কাজ করে', formulationWizard: 'ফর্মুলেশন উইজার্ড', seeDemo: 'ডেমো দেখুন',
    zeroHallucination: 'শূন্য-বিভ্রম', sourceCited: 'উৎস-উদ্ধৃত', multiLanguage: '10+ ভাষা', indiaIntl: 'ভারত এবং আন্তর্জাতিক',
    trustPatentsAct: 'পেটেন্ট আইন 1970', trustPatentsActDesc: 'ধারা 3(p) TKDL ব্যতিক্রম', trustTkdl: 'TKDL ডেটাবেস', trustTkdlDesc: '2.5 লক্ষ+ ফর্মুলেশন পূর্ব শিল্প', trustBdAct: 'জীববৈচিত্র্য আইন 2002', trustBdActDesc: 'বাধ্যতামূলক ABS অনুমোদন', trustDrugsRules: 'ওষুধ ও প্রসাধনী নিয়ম', trustDrugsRulesDesc: 'ASU নিয়ন্ত্রক লাইসেন্সিং',
    statutesCovered: 'আচ্ছাদিত আইন', languagesSupported: 'সমর্থিত ভাষা', averageResponseTime: 'গড় প্রতিক্রিয়া সময়', userSatisfaction: 'ব্যবহারকারীর সন্তুষ্টি',
    chatWelcome: 'নমস্কার! আমি IP-SAKTI সহায়ক, আয়ুর্বেদে বৌদ্ধিক সম্পত্তির জন্য আপনার গাইড।', chatPlaceholder: 'পেটেন্ট আইন, ABS, TKDL সম্পর্কে জিজ্ঞাসা করুন...', sendMessage: 'পাঠান',
    voiceInput: 'ভয়েস ইনপুট', voiceListening: 'শুনছি...', voiceNotSupported: 'ভয়েস সমর্থিত নয়', voiceError: 'ভয়েস ত্রুটি। আবার চেষ্টা করুন।', tapToSpeak: 'বলতে ট্যাপ করুন',
    exportPdf: 'PDF রপ্তানি', jurisdiction: 'এখতিয়ার', jurisdictionIndia: 'ভারত', jurisdictionInternational: 'আন্তর্জাতিক',
    newChat: 'নতুন চ্যাট', chatHistory: 'চ্যাট ইতিহাস', typing: 'টাইপ করছে...', about: 'সম্পর্কে', clearSession: 'সেশন পরিষ্কার করুন',
    absCompliance: 'ABS সম্মতি', patentsActSection: 'পেটেন্ট আইন', tkdlCheck: 'TKDL চেক', giTagging: 'GI ট্যাগিং',
    highConfidence: 'উচ্চ আত্মবিশ্বাস', mediumConfidence: 'মাঝারি আত্মবিশ্বাস', lowConfidence: 'কম আত্মবিশ্বাস',
    loading: 'লোড হচ্ছে...', error: 'ত্রুটি', retry: 'পুনরায় চেষ্টা', close: 'বন্ধ', submit: 'জমা দিন', cancel: 'বাতিল', back: 'পিছনে', next: 'পরবর্তী',
    today: 'আজ', yesterday: 'গতকাল', privacyPolicy: 'গোপনীয়তা নীতি', termsOfService: 'পরিষেবার শর্তাবলী',
    selectResponseLang: 'প্রতিক্রিয়া ভাষা নির্বাচন করুন', typeYourQuestion: 'আপনার প্রশ্ন টাইপ করুন',
  },
  // தமிழ் (Tamil)
  ta: {
    govtOf: 'இந்திய அரசு', ministry: 'ஆயுஷ் அமைச்சகம்', searchPlaceholder: 'சட்டங்களைத் தேடுங்கள்...',
    home: 'முகப்பு', absChecker: 'ABS சோதனை', ipCalculator: 'IP கணிப்பான்', officialSources: 'அதிகாரப்பூர்வ ஆதாரங்கள்', aboutPortal: 'போர்டல் பற்றி', consultAssistant: 'IP உதவியாளரை அணுகவும்',
    heroEyebrow: 'ஆயுஷ் புதுமை வழிகாட்டுதல்', heroTitle: 'உங்கள் புதுமையைப் பாதுகாக்கவும்.', heroSubtitle: 'அடுத்தது என்னவென்று தெரிந்துகொள்ளுங்கள்.', heroDesc: 'ஒரு வழிகாட்டி மதிப்பீட்டின் மூலம் அறிவுசார் சொத்து, ஒழுங்குமுறை மற்றும் உயிர் பன்முகத்தன்மை பாதைகளை ஆராயுங்கள்.',
    startAssessment: 'மதிப்பீட்டைத் தொடங்கு →', startConsultation: 'மதிப்பீட்டைத் தொடங்கு →', howItWorksBtn: 'இது எப்படி வேலை செய்கிறது', formulationWizard: 'ஃபார்முலேஷன் விஸார்ட்', seeDemo: 'டெமோ பார்',
    zeroHallucination: 'பூஜ்ஜிய-மாயை', sourceCited: 'ஆதாரம்-மேற்கோள்', multiLanguage: '10+ மொழிகள்', indiaIntl: 'இந்தியா மற்றும் சர்வதேசம்',
    trustPatentsAct: 'காப்புரிமை சட்டம் 1970', trustPatentsActDesc: 'பிரிவு 3(p) TKDL விலக்குகள்', trustTkdl: 'TKDL தரவுத்தளம்', trustTkdlDesc: '2.5 லட்சம்+ ஃபார்முலேஷன் முந்தைய கலை', trustBdAct: 'உயிர் பன்முகத்தன்மை சட்டம் 2002', trustBdActDesc: 'கட்டாய ABS அனுமதி', trustDrugsRules: 'மருந்துகள் மற்றும் அழகுசாதனப் விதிகள்', trustDrugsRulesDesc: 'ASU ஒழுங்குமுறை உரிமம்',
    statutesCovered: 'உள்ளடக்கிய சட்டங்கள்', languagesSupported: 'ஆதரிக்கப்படும் மொழிகள்', averageResponseTime: 'சராசரி பதில் நேரம்', userSatisfaction: 'பயனர் திருப்தி',
    chatWelcome: 'வணக்கம்! நான் IP-SAKTI சஹாயக், ஆயுர்வேதத்தில் அறிவுசார் சொத்துக்கான உங்கள் வழிகாட்டி.', chatPlaceholder: 'காப்புரிமை சட்டம், ABS, TKDL பற்றி கேளுங்கள்...', sendMessage: 'அனுப்பு',
    voiceInput: 'குரல் உள்ளீடு', voiceListening: 'கேட்கிறது...', voiceNotSupported: 'குரல் ஆதரிக்கப்படவில்லை', voiceError: 'குரல் பிழை. மீண்டும் முயற்சிக்கவும்.', tapToSpeak: 'பேச தட்டவும்',
    exportPdf: 'PDF ஏற்றுமதி', jurisdiction: 'அதிகார வரம்பு', jurisdictionIndia: 'இந்தியா', jurisdictionInternational: 'சர்வதேசம்',
    newChat: 'புதிய அரட்டை', chatHistory: 'அரட்டை வரலாறு', typing: 'தட்டச்சு செய்கிறது...', about: 'பற்றி', clearSession: 'அமர்வை அழி',
    absCompliance: 'ABS இணக்கம்', patentsActSection: 'காப்புரிமை சட்டம்', tkdlCheck: 'TKDL சோதனை', giTagging: 'GI குறியிடல்',
    highConfidence: 'உயர் நம்பிக்கை', mediumConfidence: 'மிதமான நம்பிக்கை', lowConfidence: 'குறைந்த நம்பிக்கை',
    loading: 'ஏற்றுகிறது...', error: 'பிழை', retry: 'மீண்டும் முயற்சி', close: 'மூடு', submit: 'சமர்ப்பி', cancel: 'ரத்து', back: 'பின்னால்', next: 'அடுத்து',
    today: 'இன்று', yesterday: 'நேற்று', privacyPolicy: 'தனியுரிமைக் கொள்கை', termsOfService: 'சேவை விதிமுறைகள்',
    selectResponseLang: 'பதில் மொழியைத் தேர்ந்தெடுக்கவும்', typeYourQuestion: 'உங்கள் கேள்வியை தட்டச்சு செய்யவும்',
  },
  // తెలుగు (Telugu)
  te: {
    govtOf: 'భారత ప్రభుత్వం', ministry: 'ఆయుష్ మంత్రిత్వ శాఖ', searchPlaceholder: 'చట్టాలను వెతకండి...',
    home: 'హోమ్', absChecker: 'ABS తనిఖీ', ipCalculator: 'IP కాలిక్యులేటర్', officialSources: 'అధికారిక మూలాలు', aboutPortal: 'పోర్టల్ గురించి', consultAssistant: 'IP సహాయకుడిని సంప్రదించండి',
    heroEyebrow: 'ఆయుష్ ఆవిష్కరణ మార్గదర్శకత్వం', heroTitle: 'మీ ఆవిష్కరణను రక్షించండి.', heroSubtitle: 'తర్వాత ఏమిటో తెలుసుకోండి.', heroDesc: 'ఒక మార్గదర్శక మూల్యాంకనం ద్వారా మేధో సంపత్తి, నియంత్రణ మరియు జీవవైవిధ్య మార్గాలను అన్వేషించండి.',
    startAssessment: 'మూల్యాంకనం ప్రారంభించండి →', startConsultation: 'మూల్యాంకనం ప్రారంభించండి →', howItWorksBtn: 'ఇది ఎలా పని చేస్తుంది', formulationWizard: 'ఫార్ములేషన్ విజార్డ్', seeDemo: 'డెమో చూడండి',
    zeroHallucination: 'సున్నా-భ్రమ', sourceCited: 'మూలం-ఉదహరించబడింది', multiLanguage: '10+ భాషలు', indiaIntl: 'భారతదేశం మరియు అంతర్జాతీయ',
    trustPatentsAct: 'పేటెంట్ చట్టం 1970', trustPatentsActDesc: 'సెక్షన్ 3(p) TKDL మినహాయింపులు', trustTkdl: 'TKDL డేటాబేస్', trustTkdlDesc: '2.5 లక్షల+ ఫార్ములేషన్ పూర్వ కళ', trustBdAct: 'జీవవైవిధ్య చట్టం 2002', trustBdActDesc: 'తప్పనిసరి ABS ఆమోదం', trustDrugsRules: 'మందులు & సౌందర్య సాధనాల నియమాలు', trustDrugsRulesDesc: 'ASU నియంత్రణ లైసెన్సింగ్',
    statutesCovered: 'కవర్ చేయబడిన చట్టాలు', languagesSupported: 'మద్దతు ఉన్న భాషలు', averageResponseTime: 'సగటు ప్రతిస్పందన సమయం', userSatisfaction: 'వినియోగదారు సంతృప్తి',
    chatWelcome: 'నమస్కారం! నేను IP-SAKTI సహాయక్, ఆయుర్వేదంలో మేధో సంపత్తికి మీ గైడ్.', chatPlaceholder: 'పేటెంట్ చట్టం, ABS, TKDL గురించి అడగండి...', sendMessage: 'పంపు',
    voiceInput: 'వాయిస్ ఇన్‌పుట్', voiceListening: 'వింటోంది...', voiceNotSupported: 'వాయిస్ మద్దతు లేదు', voiceError: 'వాయిస్ లోపం. మళ్ళీ ప్రయత్నించండి.', tapToSpeak: 'మాట్లాడటానికి ట్యాప్ చేయండి',
    exportPdf: 'PDF ఎగుమతి', jurisdiction: 'అధికార పరిధి', jurisdictionIndia: 'భారతదేశం', jurisdictionInternational: 'అంతర్జాతీయ',
    newChat: 'కొత్త చాట్', chatHistory: 'చాట్ చరిత్ర', typing: 'టైప్ చేస్తోంది...', about: 'గురించి', clearSession: 'సెషన్ క్లియర్ చేయండి',
    absCompliance: 'ABS సమ్మతి', patentsActSection: 'పేటెంట్ చట్టం', tkdlCheck: 'TKDL తనిఖీ', giTagging: 'GI ట్యాగింగ్',
    highConfidence: 'అధిక విశ్వాసం', mediumConfidence: 'మధ్యస్థ విశ్వాసం', lowConfidence: 'తక్కువ విశ్వాసం',
    loading: 'లోడ్ అవుతోంది...', error: 'లోపం', retry: 'మళ్ళీ ప్రయత్నించు', close: 'మూసివేయి', submit: 'సమర్పించు', cancel: 'రద్దు', back: 'వెనుకకు', next: 'తదుపరి',
    today: 'ఈరోజు', yesterday: 'నిన్న', privacyPolicy: 'గోప్యతా విధానం', termsOfService: 'సేవా నిబంధనలు',
    selectResponseLang: 'ప్రతిస్పందన భాషను ఎంచుకోండి', typeYourQuestion: 'మీ ప్రశ్నను టైప్ చేయండి',
  },
  // मराठी (Marathi)
  mr: {
    govtOf: 'भारत सरकार', ministry: 'आयुष मंत्रालय', searchPlaceholder: 'कायदे शोधा...',
    home: 'मुख्यपृष्ठ', absChecker: 'ABS तपासणी', ipCalculator: 'IP कॅल्क्युलेटर', officialSources: 'अधिकृत स्रोत', aboutPortal: 'पोर्टलबद्दल', consultAssistant: 'IP सहाय्यकाशी सल्ला',
    heroEyebrow: 'आयुष नवोन्मेष मार्गदर्शन', heroTitle: 'तुमची नवनिर्मिती सुरक्षित करा.', heroSubtitle: 'पुढे काय ते जाणून घ्या.', heroDesc: 'एका मार्गदर्शित मूल्यांकनाद्वारे बौद्धिक संपदा, नियमन आणि जैवविविधता मार्ग शोधा.',
    startAssessment: 'मूल्यांकन सुरू करा →', startConsultation: 'मूल्यांकन सुरू करा →', howItWorksBtn: 'हे कसे कार्य करते', formulationWizard: 'फॉर्म्युलेशन विझार्ड', seeDemo: 'डेमो पहा',
    zeroHallucination: 'शून्य-भ्रम', sourceCited: 'स्रोत-उद्धृत', multiLanguage: '10+ भाषा', indiaIntl: 'भारत आणि आंतरराष्ट्रीय',
    trustPatentsAct: 'पेटंट कायदा 1970', trustPatentsActDesc: 'कलम 3(p) TKDL अपवाद', trustTkdl: 'TKDL डेटाबेस', trustTkdlDesc: '2.5 लाख+ फॉर्म्युलेशन पूर्व कला', trustBdAct: 'जैवविविधता कायदा 2002', trustBdActDesc: 'अनिवार्य ABS मंजुरी', trustDrugsRules: 'औषधी व सौंदर्य प्रसाधने नियम', trustDrugsRulesDesc: 'ASU नियामक परवाना',
    statutesCovered: 'समाविष्ट कायदे', languagesSupported: 'समर्थित भाषा', averageResponseTime: 'सरासरी प्रतिसाद वेळ', userSatisfaction: 'वापरकर्ता समाधान',
    chatWelcome: 'नमस्कार! मी IP-SAKTI सहायक, आयुर्वेदातील बौद्धिक संपदेसाठी तुमचा मार्गदर्शक.', chatPlaceholder: 'पेटंट कायदा, ABS, TKDL बद्दल विचारा...', sendMessage: 'पाठवा',
    voiceInput: 'व्हॉइस इनपुट', voiceListening: 'ऐकत आहे...', voiceNotSupported: 'व्हॉइस समर्थित नाही', voiceError: 'व्हॉइस त्रुटी. पुन्हा प्रयत्न करा.', tapToSpeak: 'बोलण्यासाठी टॅप करा',
    exportPdf: 'PDF निर्यात', jurisdiction: 'अधिकारक्षेत्र', jurisdictionIndia: 'भारत', jurisdictionInternational: 'आंतरराष्ट्रीय',
    newChat: 'नवीन चॅट', chatHistory: 'चॅट इतिहास', typing: 'टाइप करत आहे...', about: 'बद्दल', clearSession: 'सत्र साफ करा',
    absCompliance: 'ABS अनुपालन', patentsActSection: 'पेटंट कायदा', tkdlCheck: 'TKDL तपासणी', giTagging: 'GI टॅगिंग',
    highConfidence: 'उच्च आत्मविश्वास', mediumConfidence: 'मध्यम आत्मविश्वास', lowConfidence: 'कमी आत्मविश्वास',
    loading: 'लोड होत आहे...', error: 'त्रुटी', retry: 'पुन्हा प्रयत्न', close: 'बंद करा', submit: 'सबमिट करा', cancel: 'रद्द करा', back: 'मागे', next: 'पुढे',
    today: 'आज', yesterday: 'काल', privacyPolicy: 'गोपनीयता धोरण', termsOfService: 'सेवेच्या अटी',
    selectResponseLang: 'प्रतिसाद भाषा निवडा', typeYourQuestion: 'तुमचा प्रश्न टाइप करा',
  },
  // ગુજરાતી (Gujarati)
  gu: {
    govtOf: 'ભારત સરકાર', ministry: 'આયુષ મંત્રાલય', searchPlaceholder: 'કાયદા શોધો...',
    home: 'હોમ', absChecker: 'ABS ચેકર', ipCalculator: 'IP કેલ્ક્યુલેટર', officialSources: 'અધિકૃત સ્ત્રોતો', aboutPortal: 'પોર્ટલ વિશે', consultAssistant: 'IP સહાયકનો સંપર્ક કરો',
    heroEyebrow: 'આયુષ નવીનતા માર્ગદર્શન', heroTitle: 'તમારી નવીનતાને સુરક્ષિત કરો.', heroSubtitle: 'આગળ શું છે તે જાણો.', heroDesc: 'એક માર્ગદર્શિત મૂલ્યાંકન દ્વારા બૌદ્ધિક સંપત્તિ, નિયમન અને જૈવવિવિધતા માર્ગો શોધો.',
    startAssessment: 'મૂલ્યાંકન શરૂ કરો →', startConsultation: 'મૂલ્યાંકન શરૂ કરો →', howItWorksBtn: 'આ કેવી રીતે કામ કરે છે', formulationWizard: 'ફોર્મ્યુલેશન વિઝાર્ડ', seeDemo: 'ડેમો જુઓ',
    zeroHallucination: 'શૂન્ય-ભ્રમ', sourceCited: 'સ્ત્રોત-ટાંકેલ', multiLanguage: '10+ ભાષાઓ', indiaIntl: 'ભારત અને આંતરરાષ્ટ્રીય',
    trustPatentsAct: 'પેટન્ટ કાયદો 1970', trustPatentsActDesc: 'કલમ 3(p) TKDL અપવાદો', trustTkdl: 'TKDL ડેટાબેસ', trustTkdlDesc: '2.5 લાખ+ ફોર્મ્યુલેશન પૂર્વ કળા', trustBdAct: 'જૈવવિવિધતા કાયદો 2002', trustBdActDesc: 'ફરજિયાત ABS મંજૂરી', trustDrugsRules: 'દવા અને સૌંદર્ય પ્રસાધન નિયમો', trustDrugsRulesDesc: 'ASU નિયમનકારી લાઇસન્સ',
    statutesCovered: 'આવરી લેવાયેલા કાયદા', languagesSupported: 'સમર્થિત ભાષાઓ', averageResponseTime: 'સરેરાશ પ્રતિસાદ સમય', userSatisfaction: 'વપરાશકર્તા સંતોષ',
    chatWelcome: 'નમસ્તે! હું IP-SAKTI સહાયક, આયુર્વેદમાં બૌદ્ધિક સંપત્તિ માટે તમારું માર્ગદર્શક.', chatPlaceholder: 'પેટન્ટ કાયદો, ABS, TKDL વિશે પૂછો...', sendMessage: 'મોકલો',
    voiceInput: 'વૉઇસ ઇનપુટ', voiceListening: 'સાંભળી રહ્યું છે...', voiceNotSupported: 'વૉઇસ સમર્થિત નથી', voiceError: 'વૉઇસ ભૂલ. ફરી પ્રયાસ કરો.', tapToSpeak: 'બોલવા માટે ટેપ કરો',
    exportPdf: 'PDF નિકાસ', jurisdiction: 'અધિકારક્ષેત્ર', jurisdictionIndia: 'ભારત', jurisdictionInternational: 'આંતરરાષ્ટ્રીય',
    newChat: 'નવી ચેટ', chatHistory: 'ચેટ ઇતિહાસ', typing: 'ટાઇપ કરી રહ્યું છે...', about: 'વિશે', clearSession: 'સત્ર સાફ કરો',
    absCompliance: 'ABS અનુપાલન', patentsActSection: 'પેટન્ટ કાયદો', tkdlCheck: 'TKDL તપાસ', giTagging: 'GI ટેગિંગ',
    highConfidence: 'ઉચ્ચ વિશ્વાસ', mediumConfidence: 'મધ્યમ વિશ્વાસ', lowConfidence: 'ઓછો વિશ્વાસ',
    loading: 'લોડ થઈ રહ્યું છે...', error: 'ભૂલ', retry: 'ફરી પ્રયાસ', close: 'બંધ કરો', submit: 'સબમિટ કરો', cancel: 'રદ કરો', back: 'પાછળ', next: 'આગળ',
    today: 'આજે', yesterday: 'ગઈકાલે', privacyPolicy: 'ગોપનીયતા નીતિ', termsOfService: 'સેવાની શરતો',
    selectResponseLang: 'પ્રતિસાદ ભાષા પસંદ કરો', typeYourQuestion: 'તમારો પ્રશ્ન ટાઇપ કરો',
  },
  // മലയാളം (Malayalam)
  ml: {
    govtOf: 'ഇന്ത്യൻ സർക്കാർ', ministry: 'ആയുഷ് മന്ത്രാലയം', searchPlaceholder: 'നിയമങ്ങൾ തിരയുക...',
    home: 'ഹോം', absChecker: 'ABS ചെക്കർ', ipCalculator: 'IP കാൽക്കുലേറ്റർ', officialSources: 'ഔദ്യോഗിക ഉറവിടങ്ങൾ', aboutPortal: 'പോർട്ടലിനെക്കുറിച്ച്', consultAssistant: 'IP സഹായിയെ ബന്ധപ്പെടുക',
    heroEyebrow: 'ആയുഷ് നവീകരണ മാർഗ്ഗനിർദ്ദേശം', heroTitle: 'നിങ്ങളുടെ നവീകരണം സംരക്ഷിക്കുക.', heroSubtitle: 'അടുത്തത് എന്താണെന്ന് അറിയുക.', heroDesc: 'ഒരു മാർഗ്ഗനിർദ്ദേശ മൂല്യനിർണ്ണയത്തിലൂടെ ബൗദ്ധിക സ്വത്ത്, നിയന്ത്രണം, ജൈവവൈവിധ്യ പാതകൾ പര്യവേക്ഷണം ചെയ്യുക.',
    startAssessment: 'മൂല്യനിർണ്ണയം ആരംഭിക്കുക →', startConsultation: 'മൂല്യനിർണ്ണയം ആരംഭിക്കുക →', howItWorksBtn: 'ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു', formulationWizard: 'ഫോർമുലേഷൻ വിസാർഡ്', seeDemo: 'ഡെമോ കാണുക',
    zeroHallucination: 'സീറോ-ഭ്രമം', sourceCited: 'ഉറവിടം-ഉദ്ധരിച്ചത്', multiLanguage: '10+ ഭാഷകൾ', indiaIntl: 'ഇന്ത്യയും അന്താരാഷ്ട്രവും',
    trustPatentsAct: 'പേറ്റന്റ് നിയമം 1970', trustPatentsActDesc: 'വകുപ്പ് 3(p) TKDL ഒഴിവാക്കലുകൾ', trustTkdl: 'TKDL ഡാറ്റാബേസ്', trustTkdlDesc: '2.5 ലക്ഷം+ ഫോർമുലേഷൻ മുൻകല', trustBdAct: 'ജൈവവൈവിധ്യ നിയമം 2002', trustBdActDesc: 'നിർബന്ധിത ABS അംഗീകാരം', trustDrugsRules: 'മരുന്ന് & സൗന്ദര്യവർധക നിയമങ്ങൾ', trustDrugsRulesDesc: 'ASU റെഗുലേറ്ററി ലൈസൻസിംഗ്',
    statutesCovered: 'ഉൾപ്പെടുത്തിയ നിയമങ്ങൾ', languagesSupported: 'പിന്തുണയ്ക്കുന്ന ഭാഷകൾ', averageResponseTime: 'ശരാശരി പ്രതികരണ സമയം', userSatisfaction: 'ഉപയോക്തൃ സംതൃപ്തി',
    chatWelcome: 'നമസ്കാരം! ഞാൻ IP-SAKTI സഹായക്, ആയുർവേദത്തിലെ ബൗദ്ധിക സ്വത്തിനുള്ള നിങ്ങളുടെ ഗൈഡ്.', chatPlaceholder: 'പേറ്റന്റ് നിയമം, ABS, TKDL എന്നിവയെക്കുറിച്ച് ചോദിക്കുക...', sendMessage: 'അയയ്ക്കുക',
    voiceInput: 'വോയ്സ് ഇൻപുട്ട്', voiceListening: 'കേൾക്കുന്നു...', voiceNotSupported: 'വോയ്സ് പിന്തുണയില്ല', voiceError: 'വോയ്സ് പിശക്. വീണ്ടും ശ്രമിക്കുക.', tapToSpeak: 'സംസാരിക്കാൻ ടാപ്പ് ചെയ്യുക',
    exportPdf: 'PDF എക്സ്പോർട്ട്', jurisdiction: 'അധികാരപരിധി', jurisdictionIndia: 'ഇന്ത്യ', jurisdictionInternational: 'അന്താരാഷ്ട്ര',
    newChat: 'പുതിയ ചാറ്റ്', chatHistory: 'ചാറ്റ് ചരിത്രം', typing: 'ടൈപ്പ് ചെയ്യുന്നു...', about: 'കുറിച്ച്', clearSession: 'സെഷൻ മായ്ക്കുക',
    absCompliance: 'ABS പാലനം', patentsActSection: 'പേറ്റന്റ് നിയമം', tkdlCheck: 'TKDL പരിശോധന', giTagging: 'GI ടാഗിംഗ്',
    highConfidence: 'ഉയർന്ന ആത്മവിശ്വാസം', mediumConfidence: 'മിതമായ ആത്മവിശ്വാസം', lowConfidence: 'കുറഞ്ഞ ആത്മവിശ്വാസം',
    loading: 'ലോഡ് ചെയ്യുന്നു...', error: 'പിശക്', retry: 'വീണ്ടും ശ്രമിക്കുക', close: 'അടയ്ക്കുക', submit: 'സമർപ്പിക്കുക', cancel: 'റദ്ദാക്കുക', back: 'പിന്നിലേക്ക്', next: 'അടുത്തത്',
    today: 'ഇന്ന്', yesterday: 'ഇന്നലെ', privacyPolicy: 'സ്വകാര്യതാ നയം', termsOfService: 'സേവന നിബന്ധനകൾ',
    selectResponseLang: 'പ്രതികരണ ഭാഷ തിരഞ്ഞെടുക്കുക', typeYourQuestion: 'നിങ്ങളുടെ ചോദ്യം ടൈപ്പ് ചെയ്യുക',
  },
  // ਪੰਜਾਬੀ (Punjabi)
  pa: {
    govtOf: 'ਭਾਰਤ ਸਰਕਾਰ', ministry: 'ਆਯੁਸ਼ ਮੰਤਰਾਲਾ', searchPlaceholder: 'ਕਾਨੂੰਨ ਖੋਜੋ...',
    home: 'ਹੋਮ', absChecker: 'ABS ਚੈੱਕਰ', ipCalculator: 'IP ਕੈਲਕੁਲੇਟਰ', officialSources: 'ਅਧਿਕਾਰਤ ਸਰੋਤ', aboutPortal: 'ਪੋਰਟਲ ਬਾਰੇ', consultAssistant: 'IP ਸਹਾਇਕ ਨਾਲ ਸੰਪਰਕ ਕਰੋ',
    heroEyebrow: 'ਆਯੁਸ਼ ਨਵੀਨਤਾ ਮਾਰਗਦਰਸ਼ਨ', heroTitle: 'ਆਪਣੀ ਨਵੀਨਤਾ ਦੀ ਰੱਖਿਆ ਕਰੋ।', heroSubtitle: 'ਜਾਣੋ ਅੱਗੇ ਕੀ ਹੈ।', heroDesc: 'ਇੱਕ ਮਾਰਗਦਰਸ਼ਿਤ ਮੁਲਾਂਕਣ ਦੁਆਰਾ ਬੌਧਿਕ ਸੰਪੱਤੀ, ਨਿਯਮ ਅਤੇ ਜੈਵ ਵਿਭਿੰਨਤਾ ਮਾਰਗਾਂ ਦੀ ਖੋਜ ਕਰੋ।',
    startAssessment: 'ਮੁਲਾਂਕਣ ਸ਼ੁਰੂ ਕਰੋ →', startConsultation: 'ਮੁਲਾਂਕਣ ਸ਼ੁਰੂ ਕਰੋ →', howItWorksBtn: 'ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ', formulationWizard: 'ਫਾਰਮੂਲੇਸ਼ਨ ਵਿਜ਼ਾਰਡ', seeDemo: 'ਡੈਮੋ ਦੇਖੋ',
    zeroHallucination: 'ਜ਼ੀਰੋ-ਭਰਮ', sourceCited: 'ਸਰੋਤ-ਹਵਾਲਾ', multiLanguage: '10+ ਭਾਸ਼ਾਵਾਂ', indiaIntl: 'ਭਾਰਤ ਅਤੇ ਅੰਤਰਰਾਸ਼ਟਰੀ',
    trustPatentsAct: 'ਪੇਟੈਂਟ ਐਕਟ 1970', trustPatentsActDesc: 'ਧਾਰਾ 3(p) TKDL ਛੋਟ', trustTkdl: 'TKDL ਡੇਟਾਬੇਸ', trustTkdlDesc: '2.5 ਲੱਖ+ ਫਾਰਮੂਲੇਸ਼ਨ ਪੂਰਵ ਕਲਾ', trustBdAct: 'ਜੈਵ ਵਿਭਿੰਨਤਾ ਐਕਟ 2002', trustBdActDesc: 'ਲਾਜ਼ਮੀ ABS ਮਨਜ਼ੂਰੀ', trustDrugsRules: 'ਦਵਾਈਆਂ ਅਤੇ ਸ਼ਿੰਗਾਰ ਨਿਯਮ', trustDrugsRulesDesc: 'ASU ਰੈਗੂਲੇਟਰੀ ਲਾਇਸੈਂਸਿੰਗ',
    statutesCovered: 'ਸ਼ਾਮਲ ਕਾਨੂੰਨ', languagesSupported: 'ਸਮਰਥਿਤ ਭਾਸ਼ਾਵਾਂ', averageResponseTime: 'ਔਸਤ ਜਵਾਬ ਸਮਾਂ', userSatisfaction: 'ਉਪਭੋਗਤਾ ਸੰਤੁਸ਼ਟੀ',
    chatWelcome: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ IP-SAKTI ਸਹਾਇਕ, ਆਯੁਰਵੇਦ ਵਿੱਚ ਬੌਧਿਕ ਸੰਪੱਤੀ ਲਈ ਤੁਹਾਡਾ ਗਾਈਡ।', chatPlaceholder: 'ਪੇਟੈਂਟ ਐਕਟ, ABS, TKDL ਬਾਰੇ ਪੁੱਛੋ...', sendMessage: 'ਭੇਜੋ',
    voiceInput: 'ਵੌਇਸ ਇਨਪੁੱਟ', voiceListening: 'ਸੁਣ ਰਿਹਾ ਹੈ...', voiceNotSupported: 'ਵੌਇਸ ਸਮਰਥਿਤ ਨਹੀਂ', voiceError: 'ਵੌਇਸ ਗਲਤੀ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', tapToSpeak: 'ਬੋਲਣ ਲਈ ਟੈਪ ਕਰੋ',
    exportPdf: 'PDF ਐਕਸਪੋਰਟ', jurisdiction: 'ਅਧਿਕਾਰ ਖੇਤਰ', jurisdictionIndia: 'ਭਾਰਤ', jurisdictionInternational: 'ਅੰਤਰਰਾਸ਼ਟਰੀ',
    newChat: 'ਨਵੀਂ ਚੈਟ', chatHistory: 'ਚੈਟ ਇਤਿਹਾਸ', typing: 'ਟਾਈਪ ਕਰ ਰਿਹਾ ਹੈ...', about: 'ਬਾਰੇ', clearSession: 'ਸੈਸ਼ਨ ਸਾਫ਼ ਕਰੋ',
    absCompliance: 'ABS ਪਾਲਣਾ', patentsActSection: 'ਪੇਟੈਂਟ ਐਕਟ', tkdlCheck: 'TKDL ਚੈੱਕ', giTagging: 'GI ਟੈਗਿੰਗ',
    highConfidence: 'ਉੱਚ ਭਰੋਸਾ', mediumConfidence: 'ਮੱਧਮ ਭਰੋਸਾ', lowConfidence: 'ਘੱਟ ਭਰੋਸਾ',
    loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...', error: 'ਗਲਤੀ', retry: 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼', close: 'ਬੰਦ ਕਰੋ', submit: 'ਜਮ੍ਹਾਂ ਕਰੋ', cancel: 'ਰੱਦ ਕਰੋ', back: 'ਪਿੱਛੇ', next: 'ਅੱਗੇ',
    today: 'ਅੱਜ', yesterday: 'ਕੱਲ੍ਹ', privacyPolicy: 'ਗੋਪਨੀਯਤਾ ਨੀਤੀ', termsOfService: 'ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ',
    selectResponseLang: 'ਜਵਾਬ ਭਾਸ਼ਾ ਚੁਣੋ', typeYourQuestion: 'ਆਪਣਾ ਸਵਾਲ ਟਾਈਪ ਕਰੋ',
  },
}

// Fallback to English for languages without full translation
const getTranslation = (lang, key) => {
  if (UI_TRANSLATIONS[lang] && UI_TRANSLATIONS[lang][key] !== undefined) {
    return UI_TRANSLATIONS[lang][key]
  }
  if (UI_TRANSLATIONS['en'] && UI_TRANSLATIONS['en'][key] !== undefined) {
    return UI_TRANSLATIONS['en'][key]
  }
  return key
}

const LanguageContext = createContext({ lang: 'en', setLang: () => { }, t: (key) => key })

function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('ip_sakti_lang') || 'en'
  })

  useEffect(() => {
    localStorage.setItem('ip_sakti_lang', lang)
    document.documentElement.setAttribute('lang', lang)
  }, [lang])

  const t = (key) => getTranslation(lang, key)

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages: SITE_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}

function useLanguage() {
  return useContext(LanguageContext)
}

/* Global Language Selector Component */
function GlobalLanguageSelector() {
  const { lang, setLang, languages } = useLanguage()

  return (
    <div className="global-lang-selector">
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label="Select website language"
        className="global-lang-dropdown"
      >
        {languages.map(l => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ============================================================
   SCROLL REVEAL HOOK (IntersectionObserver)
   ============================================================ */
function useScrollReveal(options = {}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: options.threshold ?? 0.05, rootMargin: options.rootMargin ?? '0px 0px 80px 0px' }
    )
    observer.observe(node)

    // Safety fallback: guarantee content visibility even if IntersectionObserver is delayed or un-scrolled
    const timer = setTimeout(() => {
      setVisible(true)
    }, 1000)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [options.threshold, options.rootMargin])

  return { ref, visible }
}

/* Wrapper component for scroll-reveal animation */
function Reveal({ children, className = '', delay = 0, direction = 'up' }) {
  const { ref, visible } = useScrollReveal()
  return (
    <div
      ref={ref}
      className={`reveal reveal-${direction} ${visible ? 'reveal-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

/* ============================================================
   ANIMATED COUNT-UP HOOK
   ============================================================ */
function useCountUp(target, duration = 2000, startOnVisible = false) {
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(!startOnVisible)

  useEffect(() => {
    if (!started) return
    let raf
    let startTime = null
    const animate = (ts) => {
      if (startTime === null) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, started])

  return { value, start: () => setStarted(true), started }
}

/* ============================================================
   STATS COUNTER COMPONENT
   ============================================================ */
function StatsCounter() {
  const { ref, visible } = useScrollReveal()
  const tkdl = useCountUp(350000, 2200, true)
  const statutes = useCountUp(6, 1500, true)
  const languages = useCountUp(10, 1800, true)
  const users = useCountUp(5, 1500, true)

  useEffect(() => {
    if (visible) {
      tkdl.start()
      statutes.start()
      languages.start()
      users.start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const stats = [
    { value: tkdl.value, suffix: '+', label: 'TKDL Formulations Protected', icon: <IconBook size={24} /> },
    { value: statutes.value, suffix: '', label: 'Core Statutes Indexed', icon: <IconScales size={24} /> },
    { value: languages.value, suffix: '+', label: 'Indian Languages Supported', icon: <IconGlobe size={24} /> },
    { value: users.value, suffix: '+', label: 'User Categories Served', icon: <IconUsers size={24} /> },
  ]

  return (
    <div ref={ref} className="stats-section">
      <div className="stats-container">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 100}ms` }}>
            <span className="stat-icon">{stat.icon}</span>
            <div className="stat-value">
              {stat.value >= 1000 ? `${(stat.value / 1000).toFixed(stat.value >= 100000 ? 1 : 0)}${stat.value >= 100000 ? 'L' : 'K'}` : stat.value}
              {stat.suffix}
            </div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   PERSONAS SECTION (WHO IS IT FOR)
   ============================================================ */
function PersonasSection() {
  const { t } = useLanguage()
  const personas = [
    {
      icon: <IconShield size={24} />,
      title: 'Ayurvedic Practitioners',
      subtitle: 'Vaidyas & Traditional Healers',
      problem: 'Unsure if custom formulations can be legally protected',
      solution: 'Get clarity on Section 3(p) exemptions and trademark options',
    },
    {
      icon: <IconBuilding size={24} />,
      title: 'AYUSH Startups & MSMEs',
      subtitle: 'Herbal Product Companies',
      problem: 'Confused between drug licensing and IP protection paths',
      solution: 'Guided classification wizard + regulatory pathway mapping',
    },
    {
      icon: <IconMicroscope size={24} />,
      title: 'Researchers & Academia',
      subtitle: 'Scientists & PhD Scholars',
      problem: 'Need ABS compliance guidance before publishing',
      solution: 'Step-by-step NBA approval checker with Form guidance',
    },
    {
      icon: <IconLeaf size={24} />,
      title: 'Herb Cultivators & Farmers',
      subtitle: 'Traditional Growers',
      problem: 'Unaware of GI tags and plant variety rights',
      solution: 'Learn about geographical indications and PPV&FR Act',
    },
    {
      icon: <IconBook size={24} />,
      title: 'Students & Learners',
      subtitle: 'BAMS, BNYS & Law Students',
      problem: 'Need educational resource on IP in traditional medicine',
      solution: 'Comprehensive FAQ, cited sources, and learning paths',
    },
  ]

  return (
    <section className="section personas-section" id="personas">
      <Reveal>
        <p className="section-label">{t('personasLabel')}</p>
        <h2 className="section-title">{t('personasTitle')}</h2>
      </Reveal>
      <div className="personas-grid">
        {personas.map((p, i) => (
          <Reveal key={i} delay={i * 80}>
            <div className="persona-card">
              <div className="persona-icon">{p.icon}</div>
              <h3 className="persona-title">{p.title}</h3>
              <p className="persona-subtitle">{p.subtitle}</p>
              <div className="persona-divider" />
              <div className="persona-problem">
                <span className="persona-tag problem">{t('painPoint')}</span>
                <p>{p.problem}</p>
              </div>
              <div className="persona-solution">
                <span className="persona-tag solution">IP-SAKTI Helps</span>
                <p>{p.solution}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ============================================================
   COMPARISON TABLE (WHY IP-SAKTI)
   ============================================================ */
function ComparisonSection() {
  const { t } = useLanguage()
  const features = [
    { feature: 'Source-cited legal answers', ipsakti: true, generic: false },
    { feature: 'India vs International jurisdiction separation', ipsakti: true, generic: false },
    { feature: 'Abstains when evidence insufficient', ipsakti: true, generic: false },
    { feature: 'Ayurveda-specific formulation classification', ipsakti: true, generic: false },
    { feature: 'ABS/Biodiversity compliance checker', ipsakti: true, generic: false },
    { feature: 'Multilingual Indian language support', ipsakti: true, generic: false },
    { feature: 'Confidence scoring with disclaimer', ipsakti: true, generic: false },
    { feature: 'Grounded in TKDL, Patents Act, BD Act', ipsakti: true, generic: false },
  ]

  return (
    <section className="section comparison-section" id="comparison">
      <Reveal>
        <p className="section-label">{t('comparisonLabel')}</p>
        <h2 className="section-title">{t('comparisonTitle')}</h2>
      </Reveal>
      <Reveal delay={150}>
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th className="col-ipsakti">
                  <span className="table-badge ipsakti" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconShieldCheck size={16} /> IP-SAKTI Sahayak
                  </span>
                </th>
                <th className="col-generic">
                  <span className="table-badge generic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconMessageSquare size={16} /> Generic AI Chatbot
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i}>
                  <td>{f.feature}</td>
                  <td className="col-ipsakti">{f.ipsakti ? <span className="check" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={16} /></span> : <span className="cross" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={16} /></span>}</td>
                  <td className="col-generic">{f.generic ? <span className="check" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={16} /></span> : <span className="cross" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={16} /></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  )
}

/* ============================================================
   LIVE DEMO PREVIEW
   ============================================================ */
function DemoPreview() {
  const { t } = useLanguage()
  const sectionRef = useRef(null)
  const cardRef = useRef(null)
  const videoRef = useRef(null)

  const isIntersectingRef = useRef(false)
  const userPausedRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekTime, setSeekTime] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  // IntersectionObserver for reliable viewport detection
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = videoRef.current
          if (!video) return

          if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
            // Fresh entry into view (first time or returning after scrolling away)
            if (!isIntersectingRef.current) {
              isIntersectingRef.current = true
              userPausedRef.current = false

              // Reset to beginning and play
              video.currentTime = 0
              setCurrentTime(0)
              video.muted = isMuted
              const playPromise = video.play()
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    setIsPlaying(true)
                    setAutoplayBlocked(false)
                  })
                  .catch((err) => {
                    console.warn('Autoplay blocked:', err)
                    setIsPlaying(false)
                    setAutoplayBlocked(true)
                  })
              }
            }
          } else if (!entry.isIntersecting || entry.intersectionRatio < 0.15) {
            // User scrolled away from Live Demo -> pause immediately
            isIntersectingRef.current = false
            if (!video.paused) {
              video.pause()
            }
            setIsPlaying(false)
          }
        })
      },
      { threshold: [0, 0.15, 0.25] }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [isMuted])

  // Track Fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  const handleTimeUpdate = () => {
    if (!videoRef.current || isSeeking) return
    setCurrentTime(videoRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0)
    }
  }

  const togglePlayPause = (e) => {
    if (e) e.stopPropagation()
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      userPausedRef.current = false
      video.play()
        .then(() => {
          setIsPlaying(true)
          setAutoplayBlocked(false)
        })
        .catch((err) => {
          console.warn('Play error:', err)
          setIsPlaying(false)
          setAutoplayBlocked(true)
        })
    } else {
      userPausedRef.current = true
      video.pause()
      setIsPlaying(false)
    }
  }

  const handleSkip = (seconds, e) => {
    if (e) e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    const dur = video.duration || 100
    const target = Math.max(0, Math.min(dur, video.currentTime + seconds))
    video.currentTime = target
    setCurrentTime(target)
  }

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value)
    setSeekTime(val)
    if (videoRef.current) {
      videoRef.current.currentTime = val
      setCurrentTime(val)
    }
  }

  const handleSeekStart = () => {
    setIsSeeking(true)
  }

  const handleSeekEnd = (e) => {
    setIsSeeking(false)
    const val = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = val
      setCurrentTime(val)
    }
  }

  const toggleMute = (e) => {
    if (e) e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setIsMuted(nextMuted)
  }

  const toggleFullscreen = async (e) => {
    if (e) e.stopPropagation()
    const container = cardRef.current
    if (!container) return

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen()
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen()
        } else if (container.msRequestFullscreen) {
          await container.msRequestFullscreen()
        }
      } catch (err) {
        console.warn('Fullscreen request failed:', err)
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        }
      } catch (err) {
        console.warn('Exit fullscreen failed:', err)
      }
    }
  }

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const displayCurrentTime = isSeeking ? seekTime : currentTime
  const progressPercent = duration > 0 ? (displayCurrentTime / duration) * 100 : 0

  return (
    <section className="section demo-section" id="demo" ref={sectionRef}>
      <Reveal>
        <div className="demo-header-container">
          <div className="demo-eyebrow-pill">
            <span className="demo-live-badge-dot" />
            <span>{t('demoLabel') || 'Live Demo'}</span>
          </div>
          <h2 className="demo-prominent-title">Live Demo</h2>
          <p className="demo-prominent-subtitle">
            {t('demoTitle') || 'See IP-SAKTI in Action'} — Statutory guidance, prior-art screening, and real-time citations
          </p>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className={`demo-card ${isFullscreen ? 'demo-card-fullscreen' : ''}`} ref={cardRef}>
          {/* macOS / Chrome style Window Header */}
          <div className="demo-header">
            <div className="demo-header-controls" aria-hidden="true">
              <div className="demo-dot red" />
              <div className="demo-dot yellow" />
              <div className="demo-dot green" />
            </div>
            <span className="demo-title">{t('demoSampleResponse') || 'IP-SAKTI Sahayak: Live Walkthrough'}</span>
            <div className="demo-header-badge">
              <span className={`demo-status-indicator ${isPlaying ? 'active' : ''}`} />
              <span>{isPlaying ? 'Live Playing' : 'Paused'}</span>
            </div>
          </div>

          {/* Video Container Area */}
          <div className="demo-video-wrapper" onClick={togglePlayPause}>
            <video
              ref={videoRef}
              src="/demo-video.mp4"
              playsInline
              muted={isMuted}
              loop
              preload="auto"
              className="demo-screen-video"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => {
                setIsPlaying(true)
                setAutoplayBlocked(false)
              }}
              onPause={() => setIsPlaying(false)}
            />

            {/* Click to play fallback overlay when paused */}
            {(!isPlaying || autoplayBlocked) && (
              <div
                className="demo-video-fallback-overlay"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') togglePlayPause(e) }}
                aria-label="Play Live Demo"
              >
                <div className="demo-play-circle">
                  <IconPlay size={26} />
                </div>
                <span className="demo-play-circle-text">Click to Play Demo</span>
              </div>
            )}
          </div>

          {/* Media Player Control Bar */}
          <div className="demo-control-bar" onClick={(e) => e.stopPropagation()}>
            <div className="demo-controls-left">
              {/* Play / Pause */}
              <button
                type="button"
                className="demo-ctrl-btn demo-ctrl-play"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <IconPause size={17} /> : <IconPlay size={17} />}
              </button>

              {/* Seek Backward 10s */}
              <button
                type="button"
                className="demo-ctrl-btn"
                onClick={(e) => handleSkip(-10, e)}
                aria-label="Seek backward 10 seconds"
                title="Rewind 10 seconds"
              >
                <IconRotateCcw10 size={18} />
              </button>

              {/* Seek Forward 10s */}
              <button
                type="button"
                className="demo-ctrl-btn"
                onClick={(e) => handleSkip(10, e)}
                aria-label="Seek forward 10 seconds"
                title="Forward 10 seconds"
              >
                <IconRotateCw10 size={18} />
              </button>

              {/* Time Display */}
              <div className="demo-time-box" aria-live="off">
                <span className="demo-time-current">{formatTime(displayCurrentTime)}</span>
                <span className="demo-time-sep">/</span>
                <span className="demo-time-total">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Progress / Seek bar */}
            <div className="demo-seek-wrapper">
              <input
                type="range"
                className="demo-seek-range"
                min="0"
                max={duration > 0 ? duration : 100}
                step="0.1"
                value={displayCurrentTime}
                onChange={handleSeekChange}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                aria-label="Seek video progress"
                style={{
                  background: `linear-gradient(to right, var(--primary, #155E75) ${progressPercent}%, rgba(20, 61, 48, 0.18) ${progressPercent}%)`
                }}
              />
            </div>

            <div className="demo-controls-right">
              {/* Sound toggle */}
              <button
                type="button"
                className="demo-ctrl-btn"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
                title={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted ? <IconVolumeX size={18} /> : <IconVolume size={18} />}
              </button>

              {/* Fullscreen toggle */}
              <button
                type="button"
                className="demo-ctrl-btn demo-ctrl-fs"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
              >
                {isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={250}>
        <div className="demo-try-container">
          <Link
            to="/chat"
            className="demo-try-btn"
            id="demo-try-it-btn"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={`${t('demoTryIt')} - Open RagVyn AI Chatbot`}
          >
            <span className="demo-try-text">{t('demoTryIt')}</span>
            <IconArrowRight size={18} className="btn-arrow" />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

/* ============================================================
   STATUTE SHOWCASE
   ============================================================ */
function StatuteShowcase() {
  const { t } = useLanguage()
  const statutes = [
    {
      icon: <IconScroll size={26} />,
      name: 'Patents Act, 1970',
      key: 'Sec 3(p), 3(e), 2(1)(j)',
      desc: 'Defines patentability and explicitly bars traditional knowledge from patent protection.',
      color: 'primary',
    },
    {
      icon: <IconLeaf size={26} />,
      name: 'Biological Diversity Act, 2002',
      key: 'Sec 3, 6, ABS',
      desc: 'Regulates access to biological resources and mandates benefit sharing with local communities.',
      color: 'secondary',
    },
    {
      icon: <IconFlask size={26} />,
      name: 'Drugs & Cosmetics Act, 1940',
      key: 'Rule 158-B',
      desc: 'Governs licensing of Ayurvedic drug manufacturing: classical vs proprietary pathways.',
      color: 'primary',
    },
    {
      icon: <IconBook size={26} />,
      name: 'TKDL (Traditional Knowledge Digital Library)',
      key: '3.5L+ Formulations',
      desc: 'Database preventing international biopiracy by documenting prior art from ancient texts.',
      color: 'secondary',
    },
    {
      icon: <IconGlobe size={26} />,
      name: 'WIPO GRATK Treaty, 2024',
      key: 'Disclosure Mandate',
      desc: 'New international treaty requiring patent applicants to disclose TK and genetic resource origins.',
      color: 'primary',
    },
    {
      icon: <IconFileText size={26} />,
      name: 'Nagoya Protocol',
      key: 'Access & Benefit Sharing',
      desc: 'Global framework ensuring fair benefit sharing when accessing genetic resources across borders.',
      color: 'secondary',
    },
  ]

  return (
    <section className="section statute-section" id="statutes">
      <Reveal>
        <p className="section-label">{t('statutesLabel')}</p>
        <h2 className="section-title">{t('statutesTitle')}</h2>
        <p className="section-subtitle">{t('statutesSubtitle')}</p>
      </Reveal>
      <div className="statute-grid">
        {statutes.map((s, i) => (
          <Reveal key={i} delay={i * 60}>
            <div className={`statute-card statute-${s.color}`}>
              <div className="statute-icon">{s.icon}</div>
              <h3 className="statute-name">{s.name}</h3>
              <span className="statute-key">{s.key}</span>
              <p className="statute-desc">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ============================================================
   THEME HOOK & TOGGLE
   ============================================================ */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ip_sakti_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ip_sakti_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}

/* ============================================================
   FONT SIZE HOOK
   ============================================================ */
function useFontSize() {
  const [fontSize, setFontSizeState] = useState(() => {
    return localStorage.getItem('ip_sakti_font_size') || 'md'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontSize)
    localStorage.setItem('ip_sakti_font_size', fontSize)
  }, [fontSize])

  return { fontSize, setFontSize: setFontSizeState }
}

function ThemeToggleBtn({ theme, toggleTheme }) {
  return (
    <button
      className="theme-toggle-btn"
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  )
}

/* (Typewriter effect removed per visual redesign to avoid partial substring artifacts) */

/* ============================================================
   ABOUT IP-SAKTI SAHAYAK MODAL - POLISHED LEGAL-TECH DESIGN
   ============================================================ */
function AboutModal({ isOpen, onClose }) {
  const { t } = useLanguage()
  if (!isOpen) return null

  const corpusList = [
    { name: 'Patents Act 1970 (Sec 3p)', icon: <IconScroll size={16} />, tag: 'Statute · Prior Art Exclusion' },
    { name: 'Biological Diversity Act 2002', icon: <IconLeaf size={16} />, tag: 'Statute · NBA / ABS Compliance' },
    { name: 'Drugs & Cosmetics Act 1940', icon: <IconFlask size={16} />, tag: 'Statute · ASU Regulatory Standard' },
    { name: 'TKDL (Traditional Knowledge)', icon: <IconBook size={16} />, tag: 'Corpus · Digital Prior Art Library' },
    { name: 'WIPO GRATK Treaty 2024', icon: <IconGlobe size={16} />, tag: 'Treaty · Genetic Resources & TK' },
    { name: 'GI of Goods Act 1999', icon: <IconTag size={16} />, tag: 'Statute · Geographical Indications' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
      <div className="modal-card about-modal-card" onClick={e => e.stopPropagation()}>
        {/* 1. Header with Government/AYUSH branding */}
        <div className="about-modal-header">
          <div className="about-header-branding">
            <div className="about-header-emblem" aria-hidden="true">
              <IconGovt size={22} />
            </div>
            <div className="about-header-text">
              <h2 id="about-modal-title">{t('aboutTitle') || 'About IP-SAKTI Sahayak'}</h2>
              <p className="about-header-subtitle">{t('aboutSubtitle') || 'Intellectual Property & Regulatory Guidance Platform'}</p>
            </div>
          </div>
          <button
            className="modal-close-btn about-close-btn"
            onClick={onClose}
            aria-label={t('closeModal') || 'Close modal'}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* 2. Modal Body */}
        <div className="about-modal-body">
          {/* Section 1: Purpose & Vision */}
          <section className="about-section-card about-vision-card" aria-labelledby="about-purpose-title">
            <div className="about-section-heading-row">
              <span className="about-heading-badge" aria-hidden="true">
                <IconSparkles size={14} />
              </span>
              <h3 id="about-purpose-title" className="about-section-heading">
                {t('aboutPurposeTitle') || 'Purpose & Vision'}
              </h3>
            </div>
            <div className="about-section-content">
              <p className="about-intro-text">
                <strong className="about-emphasis-brand">IP-SAKTI Sahayak</strong> is an <strong className="about-emphasis-keyword">AI-powered platform</strong> designed to help AYUSH innovators and Vaidyas navigate Indian Intellectual Property laws, Traditional Knowledge, and biological diversity compliance through a structured and evidence-based digital interface.
              </p>
              <p className="about-body-text">
                The platform brings together regulatory tools, <strong className="about-emphasis-keyword">authoritative sources</strong>, and <strong className="about-emphasis-brand">RagVyn AI</strong>, its RAG-based AI assistant, to make complex IP and regulatory information easier to understand and access.
              </p>
            </div>
          </section>

          {/* Section 2: Grounding Policy & Zero Hallucination */}
          <section className="about-section-card about-grounding-card" aria-labelledby="about-grounding-title">
            <div className="about-section-heading-row about-grounding-heading-row">
              <div className="about-heading-with-icon">
                <span className="about-heading-badge about-heading-badge-mint" aria-hidden="true">
                  <IconShieldCheck size={15} />
                </span>
                <h3 id="about-grounding-title" className="about-section-heading">
                  {t('aboutGroundingTitle') || 'Grounding Policy & Zero Hallucination'}
                </h3>
              </div>
              <span className="about-status-pill">
                <IconShield size={11} aria-hidden="true" />
                Zero Hallucination · Safe Abstention
              </span>
            </div>
            <div className="about-section-content">
              <p className="about-body-text">
                <strong className="about-emphasis-brand">RagVyn AI</strong> uses Retrieval-Augmented Generation (RAG) to ground responses in the platform&apos;s <strong className="about-emphasis-keyword">official knowledge corpus</strong>.
              </p>
              <p className="about-body-text">
                When relevant legal or regulatory evidence is unavailable, it <strong className="about-emphasis-alert">abstains</strong> rather than inventing information.
              </p>
              <p className="about-body-text">
                Responses include <strong className="about-emphasis-keyword">section citations</strong>, <strong className="about-emphasis-keyword">source/database references</strong>, and <strong className="about-emphasis-keyword">confidence indicators</strong> wherever applicable.
              </p>
            </div>
            <div className="about-grounding-features">
              <div className="about-feature-chip">
                <IconBook size={13} aria-hidden="true" />
                <span>Statutory Corpus Grounded</span>
              </div>
              <div className="about-feature-chip">
                <IconShield size={13} aria-hidden="true" />
                <span>Safe Abstention Policy</span>
              </div>
              <div className="about-feature-chip">
                <IconScroll size={13} aria-hidden="true" />
                <span>Section Citations & Scores</span>
              </div>
            </div>
          </section>

          {/* Section 3: Core Ingested Corpora */}
          <section className="about-corpus-section" aria-labelledby="about-corpora-title">
            <div className="about-corpus-section-header">
              <div className="about-section-heading-row">
                <span className="about-heading-badge" aria-hidden="true">
                  <IconBook size={14} />
                </span>
                <h3 id="about-corpora-title" className="about-section-heading">
                  {t('aboutCorporaTitle') || 'Core Ingested Corpora'}
                </h3>
              </div>
              <span className="about-corpus-count-badge">6 Statutory Archives</span>
            </div>
            <div className="about-corpus-grid">
              {corpusList.map((c, idx) => (
                <div key={idx} className="about-corpus-card">
                  <div className="about-corpus-icon-wrap" aria-hidden="true">
                    {c.icon}
                  </div>
                  <div className="about-corpus-info">
                    <span className="about-corpus-name">{c.name}</span>
                    <span className="about-corpus-tag">{c.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Disclaimer */}
          <div className="about-disclaimer-box" role="note" aria-label="Legal disclaimer">
            <span className="about-disclaimer-icon-wrap" aria-hidden="true">
              <IconAlertTriangle size={18} />
            </span>
            <div className="about-disclaimer-content">
              <strong className="about-disclaimer-label">{t('disclaimer') || 'Disclaimer'}:</strong>{' '}
              IP-SAKTI Sahayak is an <strong className="about-disclaimer-strong">informational research platform</strong> for AYUSH innovators and Vaidyas. It <strong className="about-disclaimer-strong">does not replace professional legal representation</strong> before the Controller General of Patents or High Courts.
            </div>
          </div>
        </div>

        {/* 3. Footer */}
        <div className="about-modal-footer">
          <button className="about-modal-footer-btn" onClick={onClose}>
            {t('closeModal') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   FORMULATION WIZARD MODAL
   ============================================================ */
function FormulationWizardModal({ isOpen, onClose, onAskChat }) {
  const { t } = useLanguage()
  const [showIntro, setShowIntro] = useState(true)
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: null })

  if (!isOpen) return null

  const resetWizard = () => {
    setStep(1)
    setAnswers({ q1: null, q2: null, q3: null })
    setShowIntro(true)
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const handleSelectOption = (questionKey, optionValue) => {
    setAnswers(prev => ({ ...prev, [questionKey]: optionValue }))
  }

  const calculateResult = () => {
    if (answers.q1 === 'classical') {
      return {
        type: 'Classical / Generic Ayurvedic Medicine (Shastriya)',
        cls: 'classical',
        badge: 'Patent Barred (Sec 3(p))',
        summary: 'Your formulation uses traditional ingredients and preparation methods documented in 1st Schedule texts of the Drugs & Cosmetics Act (e.g. Charaka Samhita, Sushruta Samhita).',
        legalAction: [
          'Barred from patenting in India under Patents Act 1970 §3(p).',
          'Protected against foreign biopiracy via TKDL (Traditional Knowledge Digital Library).',
          'Requires Rule 158-B(1) drug manufacturing license from State AYUSH Licensing Authority.',
          'Consider Trademark and unique packaging Design registration for brand protection.',
        ],
        prompt: 'How do I protect my brand for a classical Charaka Samhita formulation using Trademarks and GI tags?',
      }
    }
    if (answers.q1 === 'nutra') {
      return {
        type: 'Ayurveda-Aahar / Nutraceutical Supplement',
        cls: 'nutra',
        badge: 'FSSAI / AYUSH Food Regime',
        summary: 'Your product contains herbal ingredients intended for health wellness, dietary supplementation, or functional food consumption.',
        legalAction: [
          'Regulated primarily under FSSAI (Ayurveda Aahar) Regulations 2022.',
          'Cannot make therapeutic or disease-curing medicinal claims on labels.',
          'Patent eligibility limited unless novel extraction technology is involved.',
          'Primary IP protection strategy: Brand Trademark, Proprietary Blend Trade Secret, & Packaging Design.',
        ],
        prompt: 'What are the trademark and labelling guidelines for an Ayurveda-Aahar herbal health drink?',
      }
    }
    return {
      type: 'Patent / Proprietary Ayurvedic Medicine (Anubhavasiddha)',
      cls: 'proprietary',
      badge: 'Potentially Patentable (Sec 2(1)(j))',
      summary: 'Your formulation modifies traditional ingredients with a novel delivery mechanism, synergistic extract ratio, or proven unexpected therapeutic efficacy.',
      legalAction: [
        'Eligible for patent protection under Patents Act 1970 §2(1)(j) if novel and non-obvious.',
        'Must demonstrate synergism or enhanced efficacy beyond simple admixture (Section 3(e) bar).',
        'Requires ABS clearance under Biological Diversity Act 2002 before commercial filing.',
        'Requires Rule 158-B(2) AYUSH manufacturing license with safety/efficacy trial data.',
      ],
      prompt: 'What clinical data and ABS approvals do I need to file a patent for a novel Ayurvedic herbal extract combo?',
    }
  }

  const outcome = step === 4 ? calculateResult() : null

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ display: 'flex', color: 'var(--primary-light)' }}><IconFlask size={22} /></span>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{t('wizardTitle')}</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {t('wizardSubtitle')}
              </span>
            </div>
          </div>
          {!showIntro && (
            <button
              type="button"
              className="tool-guide-return-btn"
              onClick={() => setShowIntro(true)}
              title="View wizard overview"
              style={{ marginLeft: 'auto', marginRight: '0.5rem' }}
            >
              <IconInfo size={14} />
              <span>Overview</span>
            </button>
          )}
          <button className="modal-close-btn" onClick={handleClose} aria-label={t('closeModal')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={18} />
          </button>
        </div>

        {showIntro ? (
          <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto', padding: '0.5rem 1rem 1.5rem' }}>
            <ToolIntro
              config={TOOL_INTRO_CONFIGS['formulation-wizard']}
              icon={<IconFlask size={28} />}
              onStart={() => setShowIntro(false)}
              onBack={handleClose}
              backLabel="Close"
            />
          </div>
        ) : (
          <div className="modal-body">
            {/* Progress Bar */}
          <div className="wizard-progress">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`wizard-progress-step ${step === s ? 'active' : step > s ? 'completed' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {step > s ? <IconCheck size={14} /> : s}
              </div>
            ))}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h3 className="wizard-question-title">{t('wizardStep1Title')}</h3>
              <p className="wizard-question-desc">{t('wizardStep1Desc')}</p>

              <div className="wizard-options-grid">
                {[
                  {
                    id: 'classical',
                    icon: <IconScroll size={22} />,
                    title: 'Ancient Authoritative Text (First Schedule)',
                    desc: 'Recipe taken directly from Charaka Samhita, Sushruta Samhita, Sahasrayogam, or Bhaishajya Ratnavali.',
                  },
                  {
                    id: 'proprietary',
                    icon: <IconMicroscope size={22} />,
                    title: 'Modified / Novel Herbal Blend',
                    desc: 'Unique combination, novel extract ratio, or new delivery mechanism developed by your R&D team.',
                  },
                  {
                    id: 'nutra',
                    icon: <IconLeaf size={22} />,
                    title: 'Functional Dietary Supplement / Food',
                    desc: 'Herbal beverage, tonic, or dietary pill meant for daily health maintenance (Ayurveda Aahar).',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q1 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q1', opt.id)}
                  >
                    <span className="option-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{opt.icon}</span>
                    <div>
                      <div className="option-title">{opt.title}</div>
                      <div className="option-desc">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  className="btn-primary"
                  disabled={!answers.q1}
                  onClick={() => setStep(2)}
                  style={{ opacity: answers.q1 ? 1 : 0.5, cursor: answers.q1 ? 'pointer' : 'not-allowed' }}
                >
                  Next Step →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h3 className="wizard-question-title">Step 2: How is the formulation processed or prepared?</h3>
              <p className="wizard-question-desc">Select the manufacturing method used for production.</p>

              <div className="wizard-options-grid">
                {[
                  {
                    id: 'traditional_proc',
                    icon: <IconFlask size={22} />,
                    title: 'Traditional Ayurvedic Processing Methods',
                    desc: 'Standard Kwatha (decoction), Asava-Arishta (fermentation), Bhasma, or Churna preparation.',
                  },
                  {
                    id: 'novel_proc',
                    icon: <IconMicroscope size={22} />,
                    title: 'Modern Extraction or Nanotechnology',
                    desc: 'Supercritical CO2 extraction, targeted liposomal delivery, or standardized marker compound enrichment.',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q2 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q2', opt.id)}
                  >
                    <span className="option-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{opt.icon}</span>
                    <div>
                      <div className="option-title">{opt.title}</div>
                      <div className="option-desc">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                <button
                  className="btn-primary"
                  disabled={!answers.q2}
                  onClick={() => setStep(3)}
                  style={{ opacity: answers.q2 ? 1 : 0.5, cursor: answers.q2 ? 'pointer' : 'not-allowed' }}
                >
                  Next Step →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <h3 className="wizard-question-title">Step 3: What is the primary intended use and claim?</h3>
              <p className="wizard-question-desc">Select the marketing and therapeutic positioning of the product.</p>

              <div className="wizard-options-grid">
                {[
                  {
                    id: 'therapeutic',
                    icon: <IconShieldCheck size={22} />,
                    title: 'Specific Disease Treatment or Cure',
                    desc: 'Claiming clinical cure or management for conditions like Arthritis, Diabetes, or Hypertension.',
                  },
                  {
                    id: 'wellness',
                    icon: <IconLeaf size={22} />,
                    title: 'General Immunity & Wellness',
                    desc: 'Promoting overall vitality, digestion, or stress relief without disease-specific claims.',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q3 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q3', opt.id)}
                  >
                    <span className="option-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{opt.icon}</span>
                    <div>
                      <div className="option-title">{opt.title}</div>
                      <div className="option-desc">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
                <button
                  className="btn-primary"
                  disabled={!answers.q3}
                  onClick={() => setStep(4)}
                  style={{ opacity: answers.q3 ? 1 : 0.5, cursor: answers.q3 ? 'pointer' : 'not-allowed' }}
                >
                  Generate IP Assessment →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: OUTCOME */}
          {step === 4 && outcome && (
            <div className="wizard-outcome-box">
              <div className={`outcome-badge ${outcome.cls}`}>
                {outcome.badge}
              </div>

              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>
                Classification: {outcome.type}
              </h3>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {outcome.summary}
              </p>

              <div style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                <h4 style={{ fontSize: '0.88rem', color: 'var(--primary-light)', marginBottom: '0.5rem' }}>
                  Recommended IP & Licensing Actions:
                </h4>
                <ul style={{ paddingLeft: '1.2rem', fontSize: '0.83rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {outcome.legalAction.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    handleClose()
                    onAskChat(outcome.prompt)
                  }}
                >
                  {t('askIpSaktiDetailed')} →
                </button>
                <Link
                  to="/ip-calculator"
                  className="btn-secondary"
                  onClick={handleClose}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <IconCalculator size={16} /> Estimate Filing Fees
                </Link>
                <button className="btn-secondary" onClick={resetWizard} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconRotate size={16} /> {t('retestFormulation')}
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   HISTORY SIDEBAR RAIL
   ============================================================ */
function ChatSidebar({ collapsed, onClose, activeId, onSelectSession, onNewChat, onOpenWizard, onOpenAbout, sessions = [], onDeleteSession, onRenameSession, loadingSessions, width, isResizing, onStartResize }) {
  const { t } = useLanguage()
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  const handleNavClick = (fn) => {
    if (fn) fn()
    if (onClose && typeof window !== 'undefined' && window.innerWidth <= 768) {
      onClose()
    }
  }

  const startRename = (e, s) => {
    e.stopPropagation()
    setEditingId(s.id)
    setEditValue(s.title || '')
  }

  const commitRename = (id) => {
    const v = editValue.trim()
    if (v && onRenameSession) onRenameSession(id, v)
    setEditingId(null)
    setEditValue('')
  }

  return (
    <aside
      className={`chat-sidebar ${collapsed ? 'collapsed' : 'open mobile-open'} ${isResizing ? 'resizing' : ''}`}
      aria-label={t('chatHistory')}
      style={{
        width: collapsed ? undefined : (typeof width === 'number' ? `${width}px` : undefined),
      }}
    >
      <div className="sidebar-header">
        <button
          className="new-chat-btn"
          onClick={() => handleNavClick(onNewChat)}
          id="new-chat-btn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <IconSparkles size={16} />
          <span>{t('newConsultation')}</span>
        </button>
        {onClose && (
          <button
            className="sidebar-close-mobile-btn"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <IconClose size={18} />
          </button>
        )}
      </div>

      <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {t('pastConversations')}
      </div>

      <div className="sidebar-history-list">
        {loadingSessions && (
          <div style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading…</div>
        )}
        {!loadingSessions && sessions.length === 0 && (
          <div style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            No past conversations yet. Start a new consultation.
          </div>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            className={`history-item ${activeId === s.id ? 'active' : ''}`}
            onClick={() => {
              if (editingId !== s.id) {
                handleNavClick(() => onSelectSession(s.id))
              }
            }}
            style={{ alignItems: 'center' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
              {editingId === s.id ? (
                <input
                  autoFocus
                  className="history-rename-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(s.id)
                    if (e.key === 'Escape') { setEditingId(null); setEditValue('') }
                  }}
                  onBlur={() => commitRename(s.id)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '2px 4px' }}
                />
              ) : (
                <span className="history-item-title" title={s.title} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
              )}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.date}</span>
            </div>
            {editingId !== s.id && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  className="history-action-btn"
                  onClick={(e) => startRename(e, s)}
                  aria-label="Rename conversation"
                  title="Rename"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'inline-flex' }}
                >
                  <IconEdit size={13} />
                </button>
                <button
                  className="history-action-btn"
                  onClick={(e) => { e.stopPropagation(); if (onDeleteSession) onDeleteSession(s.id) }}
                  aria-label="Delete conversation"
                  title="Delete"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'inline-flex' }}
                >
                  <IconTrash size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-link-btn" onClick={() => handleNavClick(onOpenWizard)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconFlask size={16} />
          <span>{t('formulationWizard')}</span>
        </button>
        <Link to="/abs-checker" className="sidebar-link-btn" onClick={() => handleNavClick()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconLeaf size={16} />
          <span>{t('absChecker')}</span>
        </Link>
        <Link to="/ip-calculator" className="sidebar-link-btn" onClick={() => handleNavClick()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconCalculator size={16} />
          <span>{t('ipCalculator')}</span>
        </Link>
        <Link to="/deadline-calculator" className="sidebar-link-btn" onClick={() => handleNavClick()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconCalendar size={16} />
          <span>{t('deadlineCalc')}</span>
        </Link>
        <Link to="/sources" className="sidebar-link-btn" onClick={() => handleNavClick()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconBook size={16} />
          <span>{t('officialDataCorpora')}</span>
        </Link>
        <button className="sidebar-link-btn" onClick={() => handleNavClick(onOpenAbout)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconInfo size={16} />
          <span>{t('aboutIpSakti')}</span>
        </button>
      </div>

      {!collapsed && (
        <div
          className={`sidebar-resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={onStartResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize sidebar"
        >
          <div className="resize-handle-bar" />
        </div>
      )}
    </aside>
  )
}

/* ============================================================
   DEMO DATA FOR CHAT PAGE
   ============================================================ */
const DEMO_MESSAGES = [
  {
    id: 1,
    role: 'ai',
    text: 'Namaste. I am Ragvyn AI, your authoritative guide to Intellectual Property in Ayurveda. Ask me about patents, trademarks, GI tags, TKDL prior art, or regulatory compliance.',
    sections: [],
    citations: [],
    confidence: { score: 100, label: 'High', reason: 'Welcome message' },
    followUpQuestions: ['Can I patent my Ayurvedic formulation?', 'What is TKDL?', 'How do I check NBA compliance?'],
    status: 'answered',
    showDisclaimer: false,
  },
  {
    id: 2,
    role: 'user',
    text: 'Can I patent my Ayurvedic formulation for arthritis?',
  },
  {
    id: 3,
    role: 'ai',
    text: 'Under Indian patent law, purely traditional Ayurvedic formulations face significant barriers. Section 3(p) of the Patents Act 1970 bars patents on traditional knowledge, and the India Patent Office cross-checks all applications against the TKDL database.\n\nHowever, if your formulation has a novel modification, improved delivery mechanism, or enhanced efficacy backed by clinical data, it may qualify under Section 2(1)(j) as a "new invention".',
    sections: [],
    citations: [
      { source: 'Patents Act 1970', section: '§3(p)', text: 'Section 3(p): An invention which, in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components, is not patentable.', relevance: 'Primary exclusion for traditional formulations' },
      { source: 'TKDL Database', section: 'Cross-Reference Check', text: 'The Traditional Knowledge Digital Library (TKDL) is a database of traditional knowledge documented in searchable format to prevent misappropriation of Indian traditional knowledge through patents.', relevance: 'Prior art verification source' },
      { source: 'Patents Act 1970', section: '§2(1)(j)', text: 'Section 2(1)(j): "Invention" means a new product or process involving an inventive step and capable of industrial application.', relevance: 'Definition of patentable invention' },
    ],
    confidence: { score: 85, label: 'High', reason: 'Based on 3 statutory sources with direct relevance.' },
    followUpQuestions: ['What modifications make a formulation patentable?', 'How do I check TKDL for prior art?', 'What are the patent filing fees?'],
    status: 'answered',
    showDisclaimer: true,
  },
  {
    id: 4,
    role: 'user',
    text: 'What about using standardized Ashwagandha extract in a novel liposomal gel?',
  },
  {
    id: 5,
    role: 'ai',
    text: 'A liposomal delivery gel containing standardized Ashwagandha extract has a much stronger patent pathway! Because the novelty lies in the bio-availability delivery system rather than the raw herb itself, it overcomes the Section 3(p) traditional knowledge bar.\n\nKey requirements:\n1. Must demonstrate non-obvious synergistic efficacy under Section 3(e).\n2. Must obtain NBA (National Biodiversity Authority) approval under Section 6 of Biological Diversity Act 2002 before patent grant.',
    sections: [],
    citations: [
      { source: 'Patents Act 1970', section: '§3(e)', text: 'Section 3(e): A substance obtained by a mere admixture resulting only in the aggregation of the properties of the components thereof or a process for producing such substance is not patentable.', relevance: 'Synergy requirement for combinations' },
      { source: 'Biological Diversity Act 2002', section: '§6', text: 'Section 6: No person shall apply for any intellectual property right in or outside India for any invention based on any research or information on a biological resource obtained from India without obtaining prior approval of the NBA.', relevance: 'Mandatory NBA approval requirement' },
    ],
    confidence: { score: 72, label: 'Medium', reason: 'Based on 2 sources; specific formulation assessment requires detailed review.' },
    followUpQuestions: ['What is the NBA approval process?', 'What evidence of synergy is needed?', 'How long does patent examination take?'],
    status: 'answered',
    showDisclaimer: true,
  },
  {
    id: 6,
    role: 'user',
    text: 'Is there any restriction if I export this formulation to the EU or USA?',
  },
  {
    id: 7,
    role: 'ai',
    text: 'Yes! International export triggers obligations under the Nagoya Protocol and WIPO GRATK Treaty (2024).\n\nYou must ensure fair Access and Benefit Sharing (ABS) compliance with India’s National Biodiversity Authority before exporting raw bio-resources or filing foreign patent applications (PCT route). We recommend consulting an IP attorney for international patenting.',
    citations: [
      { source: 'wipo_gratk_treaty_2024', section: 'Mandatory Disclosure', text: 'The WIPO Treaty on IP, Genetic Resources and Associated Traditional Knowledge requires patent applicants to disclose the country of origin of genetic resources and associated traditional knowledge.' },
      { source: 'nagoya_protocol', section: 'ABS Articles 6 & 7', text: 'Articles 6 & 7 establish requirements for Prior Informed Consent (PIC) and Mutually Agreed Terms (MAT) for access to genetic resources and traditional knowledge associated with genetic resources.' },
    ],
    confidence: { score: 55, label: 'Medium', reason: 'International jurisdiction; specific requirements vary.' },
    followUpQuestions: ['What is the PCT filing process?', 'How do I obtain NBA export approval?'],
    status: 'answered',
    showDisclaimer: true,
  },
]

/* ============================================================
   CHAT COMPONENTS
   ============================================================ */

// Helper to format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Copy to clipboard utility
function copyToClipboard(text, onSuccess) {
  navigator.clipboard.writeText(text).then(() => {
    if (onSuccess) onSuccess()
  }).catch(err => {
    console.error('Failed to copy:', err)
  })
}

// Citation source icon helper - matches source name from backend
function getSourceIcon(source) {
  if (!source) return <IconFileText size={16} />
  const s = source.toLowerCase()
  if (s.includes('patent')) return <IconGovt size={16} />
  if (s.includes('tkdl')) return <IconBook size={16} />
  if (s.includes('wipo') || s.includes('trips')) return <IconGlobe size={16} />
  if (s.includes('nagoya') || s.includes('biodiversity') || s.includes('biological')) return <IconLeaf size={16} />
  if (s.includes('nba') || s.includes('abs')) return <IconShield size={16} />
  if (s.includes('drugs') || s.includes('cosmetics')) return <IconFlask size={16} />
  return <IconScroll size={16} />
}

// Format source name for display (e.g., "patents_act_1970" -> "Patents Act 1970")
function formatSourceName(source) {
  if (!source) return 'Unknown Source'
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+chunks?$/i, '')
    .trim()
}

function CitationCard({ citation, isExpanded, onToggle }) {
  // Backend sends: source (document name), section (page/section), text (chunk content)
  const displayTitle = formatSourceName(citation.source || citation.title || '')
  const sectionLabel = citation.section || ''
  const snippetText = citation.text || ''
  
  return (
    <div className={`citation-card ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="citation-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className="citation-icon" aria-hidden="true">{getSourceIcon(citation.source)}</span>
        <span className="citation-title">{displayTitle}{sectionLabel && ` — ${sectionLabel}`}</span>
        <span className={`citation-chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
          <IconChevronDown size={14} />
        </span>
      </button>
      {isExpanded && (
        <div className="citation-content">
          {snippetText ? (
            <p className="citation-snippet">{snippetText.length > 300 ? snippetText.slice(0, 300) + '…' : snippetText}</p>
          ) : (
            <p className="citation-snippet" style={{ opacity: 0.7 }}>Source document retrieved from verified legal corpus.</p>
          )}
          {citation.url && (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="citation-link"
            >
              <span>{citation.url}</span>
              <IconExternalLink size={14} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function CollapsibleCitations({ citations }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [allExpanded, setAllExpanded] = useState(false)

  const toggleAll = () => {
    setAllExpanded(!allExpanded)
    setExpandedIndex(null)
  }

  const toggleSingle = (index) => {
    if (allExpanded) {
      setAllExpanded(false)
      setExpandedIndex(index === expandedIndex ? null : index)
    } else {
      setExpandedIndex(index === expandedIndex ? null : index)
    }
  }

  if (!citations?.length) return null

  return (
    <div className="citations-container">
      <div className="citations-header">
        <span className="citations-label">
          <IconScroll size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
          SUPPORTED BY ({citations.length} STATUTORY SOURCES)
        </span>
        <button
          className="citations-toggle-all"
          onClick={toggleAll}
        >
          {allExpanded ? 'Collapse' : 'Expand details'}
        </button>
      </div>
      <div className="citation-list">
        {citations.map((c, i) => (
          <CitationCard
            key={i}
            citation={c}
            isExpanded={allExpanded || expandedIndex === i}
            onToggle={() => toggleSingle(i)}
          />
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   RENDER TEXT WITH INLINE CITATION LINKS
   ============================================================ */
function renderTextWithCitations(text, onCitationClick) {
  if (!text || !onCitationClick) return text
  // Match [SRC-001], [SRC-002], etc.
  const parts = text.split(/(\[SRC-\d+\])/g)
  if (parts.length <= 1) return text
  return parts.map((part, i) => {
    const match = part.match(/^\[(SRC-\d+)\]$/)
    if (match) {
      const srcId = match[1]
      return (
        <button
          key={i}
          className="inline-citation-link"
          onClick={(e) => { e.stopPropagation(); onCitationClick(srcId) }}
          title={`View source ${srcId}`}
          aria-label={`Jump to source ${srcId}`}
        >
          [{srcId}]
        </button>
      )
    }
    return part
  })
}

/* ============================================================
   SOURCES PANEL (Right-side panel for citations)
   ============================================================ */
function SourcesPanel({ citations, isOpen, onClose, highlightedSourceId, onClearHighlight }) {
  const panelRef = useRef(null)
  const cardRefs = useRef({})
  const [expandedIds, setExpandedIds] = useState({})

  // Scroll to highlighted card
  useEffect(() => {
    if (highlightedSourceId && cardRefs.current[highlightedSourceId]) {
      cardRefs.current[highlightedSourceId].scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Clear highlight after 2 seconds
      const timer = setTimeout(() => onClearHighlight?.(), 2500)
      return () => clearTimeout(timer)
    }
  }, [highlightedSourceId, onClearHighlight])

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const hasCitations = citations && citations.length > 0

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sources-panel-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`sources-panel ${isOpen ? 'open' : 'collapsed'}`}
        ref={panelRef}
        aria-label="Sources panel"
      >
        <div className="sources-panel-header">
          <span className="sources-panel-title">
            <IconScroll size={16} />
            Sources
            {hasCitations && <span className="sources-count">{citations.length}</span>}
          </span>
          <button
            className="sources-panel-close"
            onClick={onClose}
            aria-label="Close sources panel"
            title="Close sources panel"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="sources-panel-body">
          {!hasCitations ? (
            <div className="sources-empty-state">
              <IconFileText size={28} />
              <p>No supporting sources were returned for this answer.</p>
            </div>
          ) : (
            citations.map((c, i) => {
              const id = c.source_id || `src-${i}`
              const displayTitle = formatSourceName(c.source || c.title || '')
              const sectionLabel = c.section || ''
              const snippetText = c.text || ''
              const isExpanded = !!expandedIds[id]
              const isHighlighted = highlightedSourceId === id || highlightedSourceId === c.source_id

              return (
                <div
                  key={id}
                  ref={el => { cardRefs.current[id] = el; if (c.source_id) cardRefs.current[c.source_id] = el }}
                  className={`source-card ${isHighlighted ? 'highlighted' : ''} ${isExpanded ? 'expanded' : ''}`}
                >
                  <button
                    className="source-card-header"
                    onClick={() => toggleExpand(id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="source-card-icon" aria-hidden="true">{getSourceIcon(c.source)}</span>
                    <div className="source-card-meta">
                      <span className="source-card-title">{displayTitle}</span>
                      {c.source_id && <span className="source-card-id">{c.source_id}</span>}
                      {sectionLabel && <span className="source-card-section">{sectionLabel}</span>}
                      {c.authority && <span className="source-card-detail">{c.authority}</span>}
                      {c.jurisdiction && <span className="source-card-detail">{c.jurisdiction}</span>}
                      {c.page_number && <span className="source-card-detail">Page {c.page_number}</span>}
                    </div>
                    <span className={`source-card-chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
                      <IconChevronDown size={14} />
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="source-card-content">
                      {snippetText ? (
                        <p className="source-card-snippet">{snippetText}</p>
                      ) : (
                        <p className="source-card-snippet source-unavailable">Source text unavailable.</p>
                      )}
                      {c.relevance && (
                        <p className="source-card-relevance">
                          <strong>Relevance:</strong> {c.relevance}
                        </p>
                      )}
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-card-link"
                        >
                          <IconExternalLink size={14} />
                          <span>{c.url}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}

function ConfidenceBadge({ level }) {
  // Handle both old string format and new object format
  let label, cls, icon, score, reason
  
  if (typeof level === 'object' && level !== null) {
    // New structured format: { score, label, reason }
    score = level.score
    reason = level.reason || ''
    const levelLabel = (level.label || 'Medium').toLowerCase()
    
    if (levelLabel === 'error') {
      label = `Connection Error`
      cls = 'low'
      icon = <IconAlertTriangle size={14} />
    } else if (levelLabel === 'high' || score >= 80) {
      label = `High Confidence (${score}%)`
      cls = 'high'
      icon = <IconShieldCheck size={14} />
    } else if (levelLabel === 'moderate' || levelLabel === 'medium' || score >= 60) {
      label = `Moderate Confidence (${score}%)`
      cls = 'medium'
      icon = <IconInfo size={14} />
    } else {
      label = `Low Confidence (${score}%)`
      cls = 'low'
      icon = <IconAlertTriangle size={14} />
    }
  } else {
    // Legacy string format: 'high', 'medium', 'low'
    const map = {
      high: { label: 'High Confidence', cls: 'high', icon: <IconShieldCheck size={14} /> },
      medium: { label: 'Moderate Confidence', cls: 'medium', icon: <IconInfo size={14} /> },
      moderate: { label: 'Moderate Confidence', cls: 'medium', icon: <IconInfo size={14} /> },
      low: { label: 'Low Confidence', cls: 'low', icon: <IconAlertTriangle size={14} /> },
    }
    const m = map[level]
    if (!m) return null
    label = m.label
    cls = m.cls
    icon = m.icon
    reason = ''
  }
  
  return (
    <div className="confidence-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className={`confidence-badge ${cls}`} role="status" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        {icon}
        <span>{label}</span>
      </span>
      {reason && (
        <span className="confidence-reason" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.2rem' }}>
          {reason}
        </span>
      )}
    </div>
  )
}

function DisclaimerBanner() {
  return (
    <div className="disclaimer" role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
      <IconInfo size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>Informational assessment grounded in retrieved statutory corpora. Consult a registered Patent Agent or State AYUSH Authority for formal filings.</span>
    </div>
  )
}

/* ============================================================
   TYPEWRITER TEXT COMPONENT - ChatGPT-like typing animation
   ============================================================ */
function TypewriterText({ text, speed = 15, onComplete }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!text) return
    
    let currentIndex = 0
    setDisplayedText('')
    setIsComplete(false)

    const typeNextChar = () => {
      if (currentIndex < text.length) {
        // Type 2-3 characters at once for smoother effect
        const charsToAdd = Math.min(3, text.length - currentIndex)
        setDisplayedText(text.slice(0, currentIndex + charsToAdd))
        currentIndex += charsToAdd
        setTimeout(typeNextChar, speed)
      } else {
        setIsComplete(true)
        if (onComplete) onComplete()
      }
    }

    const timer = setTimeout(typeNextChar, 100)
    return () => clearTimeout(timer)
  }, [text, speed, onComplete])

  return (
    <span className="typewriter-text">
      {displayedText}
      {!isComplete && <span className="typewriter-cursor" aria-hidden="true">|</span>}
    </span>
  )
}

/* ============================================================
   DPDP PROTECTION BADGE - Shows data privacy compliance
   ============================================================ */
function DPDPProtectionBadge() {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div 
      className="dpdp-badge"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      role="status"
      aria-label="Your data is protected under DPDP Act 2023"
    >
      <IconShield size={14} />
      <span>DPDP Protected</span>
      {showTooltip && (
        <div className="dpdp-tooltip">
          <strong>Data Protection Compliance</strong>
          <ul>
            <li><IconCheck size={12} /> PII auto-scrubbed before AI processing</li>
            <li><IconCheck size={12} /> No personal data sent to external APIs</li>
            <li><IconCheck size={12} /> Compliant with DPDP Act 2023</li>
            <li><IconCheck size={12} /> Audit log maintained locally</li>
          </ul>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   VOICE INPUT VISUAL INDICATOR - Enhanced UI for voice recording
   ============================================================ */
function VoiceInputIndicator({ isListening, interimText, confidence, voiceLang }) {
  if (!isListening && !interimText) return null

  return (
    <div className={`voice-input-indicator ${isListening ? 'listening' : ''}`}>
      <div className="voice-waves">
        <span className="wave"></span>
        <span className="wave"></span>
        <span className="wave"></span>
        <span className="wave"></span>
        <span className="wave"></span>
      </div>
      <div className="voice-status">
        <span className="voice-lang-badge">{voiceLang === 'hi-IN' ? 'हिंदी' : 'EN'}</span>
        <span className="voice-text">
          {isListening ? 'Listening...' : interimText}
        </span>
        {confidence && (
          <span className="voice-confidence">
            {Math.round(confidence * 100)}% sure
          </span>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   CONFIDENCE METER - Visual bar showing answer confidence
   ============================================================ */
function ConfidenceMeter({ level }) {
  let label, fill, percent
  
  if (typeof level === 'object' && level !== null) {
    // New structured format: { score, label, reason }
    percent = level.score || 0
    const levelLabel = (level.label || 'Medium').toLowerCase()
    
    if (levelLabel === 'high' || percent >= 70) {
      label = 'High Confidence'
      fill = 'high'
    } else if (levelLabel === 'medium' || percent >= 40) {
      label = 'Moderate'
      fill = 'medium'
    } else {
      label = 'Low - Verify'
      fill = 'low'
    }
  } else {
    // Legacy string format
    const levelMap = {
      high: { label: 'High Confidence', fill: 'high', percent: 100 },
      medium: { label: 'Moderate', fill: 'medium', percent: 66 },
      moderate: { label: 'Moderate', fill: 'medium', percent: 66 },
      low: { label: 'Low - Verify', fill: 'low', percent: 33 },
    }
    const m = levelMap[level]
    if (!m) return null
    label = m.label
    fill = m.fill
    percent = m.percent
  }

  return (
    <div className="confidence-meter">
      <div className="confidence-bar">
        <div className={`confidence-fill ${fill}`} style={{ width: `${percent}%` }} />
      </div>
      <span className={`confidence-label ${fill}`}>{label}</span>
    </div>
  )
}

function TypingIndicator({ retrievalState }) {
  const [stepIndex, setStepIndex] = useState(0)
  const steps = [
    'Searching trusted sources...',
    'Reviewing relevant documents...',
    'Checking statutory references...',
    'Validating citations...',
    'Preparing cited answer...'
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex(prev => (prev + 1) % steps.length)
    }, 1500)
    return () => clearInterval(timer)
  }, [steps.length])

  // Use passed retrieval state if available, otherwise cycle through steps
  const displayText = retrievalState || steps[stepIndex]

  return (
    <div className="message-row ai-row typing-row" aria-label="Ragvyn AI is searching knowledge base">
      <div className="avatar ai-avatar" aria-hidden="true">
        <IconShieldCheck size={18} style={{ color: '#fff' }} />
      </div>
      <div className="typing-container">
        <div className="typing-indicator">
          <div className="typing-spinner" aria-hidden="true" />
          <div className="rag-stepper-text">
            <span className="rag-stepper-step">Retrieval:</span>
            <span>{displayText}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Follow-up suggestion chips
function FollowUpChips({ onSelect }) {
  const suggestions = [
    { label: 'Examine Section 3(p) criteria', icon: <IconScroll size={14} /> },
    { label: 'NBA Form III approval process', icon: <IconLeaf size={14} /> },
    { label: 'Novelty vs Prior Art requirements', icon: <IconSearch size={14} /> },
    { label: 'Estimate filing fees', icon: <IconCalculator size={14} /> },
  ]

  return (
    <div className="follow-up-chips">
      {suggestions.map((s, i) => (
        <button
          key={i}
          className="follow-up-chip"
          onClick={() => onSelect(s.label)}
        >
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>{s.icon}</span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  )
}

// Message action buttons
function MessageActions({ msg, onRegenerate, onFeedback }) {
  const [copied, setCopied] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState(null)

  const handleCopy = () => {
    copyToClipboard(msg.text, () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'IP-SAKTI Response',
        text: msg.text,
      }).catch(() => { })
    } else {
      handleCopy()
    }
  }

  const handleFeedback = (type) => {
    setFeedbackGiven(type)
    if (onFeedback) onFeedback(msg.id, type)
  }

  return (
    <div className="message-actions">
      <button
        className={`msg-action-btn ${copied ? 'success' : ''}`}
        onClick={handleCopy}
        title="Copy to clipboard"
        aria-label="Copy message"
      >
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      </button>
      <button
        className="msg-action-btn"
        onClick={handleShare}
        title="Share"
        aria-label="Share message"
      >
        <IconExternalLink size={14} />
      </button>
      <div className="feedback-btns">
        <button
          className={`msg-action-btn feedback-btn ${feedbackGiven === 'up' ? 'active' : ''}`}
          onClick={() => handleFeedback('up')}
          title="Helpful"
          aria-label="Mark as helpful"
          disabled={feedbackGiven !== null}
        >
          <IconThumbsUp size={14} />
        </button>
        <button
          className={`msg-action-btn feedback-btn ${feedbackGiven === 'down' ? 'active' : ''}`}
          onClick={() => handleFeedback('down')}
          title="Not helpful"
          aria-label="Mark as not helpful"
          disabled={feedbackGiven !== null}
        >
          <IconThumbsDown size={14} />
        </button>
      </div>
      {onRegenerate && (
        <button
          className="msg-action-btn"
          onClick={() => onRegenerate(msg.id)}
          title="Regenerate response"
          aria-label="Regenerate response"
        >
          <IconRotate size={14} />
        </button>
      )}
    </div>
  )
}

// Welcome/Empty state component (Guided Assessment)
function ChatWelcome({ onPromptClick, onOpenWizard }) {
  const navigate = useNavigate()
  // Discovery shortcuts to EXISTING tools — reuse existing routes / wizard handler only.
  const ipTools = [
    { icon: '🧪', label: 'Formulation Wizard', desc: 'Guided IP pathway assessment', onClick: () => { if (onOpenWizard) onOpenWizard() } },
    { icon: '⚖️', label: 'Patentability Verdict', desc: 'Traffic-light patent screening', onClick: () => navigate('/verdict') },
    { icon: '🗺️', label: 'IP Journey Roadmap', desc: 'Personalized filing timeline', onClick: () => navigate('/roadmap') },
    { icon: '🛡️', label: 'Dual-Use Guardian', desc: 'IP + AYUSH + ABS compliance', onClick: () => navigate('/guardian') },
    { icon: '🌿', label: 'ABS Checker', desc: 'Biodiversity access & benefit-sharing', onClick: () => navigate('/abs-checker') },
    { icon: '🧮', label: 'IP Calculator', desc: 'Patent fees by applicant type', onClick: () => navigate('/ip-calculator') },
    { icon: '📅', label: 'Deadline Calculator', desc: 'RFE, FER, renewals & PCT dates', onClick: () => navigate('/deadline-calculator') },
    { icon: '✅', label: 'Filing Checklists', desc: 'Step-by-step IP filing guides', onClick: () => navigate('/checklists') },
    { icon: '📝', label: 'Draft Generator', desc: 'Forms & opposition drafts', onClick: () => navigate('/drafts') },
    { icon: '📚', label: 'Official Data Corpora', desc: 'Browse the cited source library', onClick: () => navigate('/sources') },
  ]

  const exampleQuestions = [
    { icon: <IconScroll size={18} />, text: 'Can I patent my Ayurvedic formulation with novel extraction?', category: 'Patent / IP' },
    { icon: <IconLeaf size={18} />, text: 'What are the ABS compliance requirements under Biological Diversity Act?', category: 'Biodiversity / ABS' },
    { icon: <IconBook size={18} />, text: 'How does TKDL cross-checking affect classical formulations?', category: 'Traditional Knowledge' },
    { icon: <IconTag size={18} />, text: 'How to register a Geographical Indication (GI) for regional herbs?', category: 'GI & Brand' },
  ]

  return (
    <div className="chat-welcome">
      <div className="welcome-brand-badge">
        <IconSparkles size={14} />
        <span>RagVyn AI • Intelligent IP Guidance</span>
      </div>
      <h2 className="welcome-title">How can RagVyn AI assist your IP journey?</h2>
      <p className="welcome-subtitle">
        Select a structured assessment pathway below, or describe your formulation, research, or compliance question for statute-grounded guidance.
      </p>

      <div className="welcome-capabilities">
        <div className="capability-item">
          <IconScroll size={16} />
          <span>Statute-cited answers</span>
        </div>
        <div className="capability-item">
          <IconGlobe size={16} />
          <span>Domestic & WIPO treaties</span>
        </div>
        <div className="capability-item">
          <IconCheck size={16} />
          <span>Section 3(p) & TKDL screening</span>
        </div>
      </div>

      <div className="example-questions">
        <p className="example-label">Focused pathways to begin:</p>
        <div className="example-grid">
          {exampleQuestions.map((q, i) => (
            <button
              key={i}
              className="example-question"
              onClick={() => onPromptClick(q.text)}
            >
              <span className="example-icon" aria-hidden="true">{q.icon}</span>
              <span className="example-text">{q.text}</span>
              <span className="example-category">{q.category}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '100%', margin: '2.5rem auto 0.5rem', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--secondary, #1E8449)', margin: '0 0 4px' }}>
          Explore IP Tools
        </h3>
        <p style={{ fontSize: '0.9rem', opacity: 0.75, margin: '0 0 1.25rem' }}>
          Quick access to tools for formulation, compliance, IP calculations and regulatory research.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 14,
        }}>
          {ipTools.map((tool, i) => (
            <button
              key={i}
              type="button"
              onClick={tool.onClick}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                padding: '16px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                background: 'var(--surface, #ffffff)',
                border: '1px solid rgba(20,61,48,0.12)',
                boxShadow: '0 1px 3px rgba(20,61,48,0.06)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(20,61,48,0.14)'
                e.currentTarget.style.borderColor = 'rgba(30,132,73,0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(20,61,48,0.06)'
                e.currentTarget.style.borderColor = 'rgba(20,61,48,0.12)'
              }}
            >
              <span style={{
                fontSize: 22, lineHeight: 1,
                width: 40, height: 40, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(30,132,73,0.12), rgba(212,175,55,0.12))',
              }} aria-hidden="true">{tool.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #143D30)' }}>{tool.label}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.3 }}>{tool.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Scroll to bottom button
function ScrollToBottomBtn({ onClick, visible }) {
  if (!visible) return null
  return (
    <button
      className="scroll-to-bottom-btn"
      onClick={onClick}
      aria-label="Scroll to bottom"
    >
      <IconChevronDown size={16} />
    </button>
  )
}

function MessageBubble({ msg, onFollowUp, onRegenerate, onFeedback, isLatestAI, onCitationClick }) {
  const timestamp = msg.timestamp || msg.id

  if (msg.role === 'user') {
    return (
      <div className="message-row user-row message-fade-in">
        <div className="avatar user-avatar" aria-hidden="true">
          <IconUser size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div className="bubble-column">
          <div className="user-bubble-sender-row">
            <span className="user-sender-name">You</span>
          </div>
          <div className="bubble user-bubble">{msg.text}</div>
          <span className="message-timestamp">{formatTimestamp(timestamp)}</span>
        </div>
      </div>
    )
  }

  // Get follow-up questions from response or use defaults
  const followUps = msg.followUpQuestions || []

  // Render text content: for non-streaming, parse [SRC-xxx] references into clickable links
  const renderBubbleContent = () => {
    if (msg.streaming) return msg.text
    // Wrap JargonText output with citation links if onCitationClick provided
    if (onCitationClick && msg.text) {
      return renderTextWithCitations(msg.text, onCitationClick)
    }
    return <JargonText text={msg.text} />
  }

  return (
    <div className="message-row ai-row message-fade-in">
      <div className="avatar ai-avatar" aria-hidden="true">
        <IconShieldCheck size={18} style={{ color: '#fff' }} />
      </div>
      <div className="bubble-column">
        <div className="ai-bubble-sender-row">
          <span className="ai-sender-name">RagVyn AI</span>
          <span className="ai-sender-tag">Statute-Grounded</span>
        </div>
        <div className="bubble ai-bubble" style={{ whiteSpace: 'pre-line' }}>
          {renderBubbleContent()}
          {msg.streaming && <span className="typewriter-cursor" aria-hidden="true">|</span>}
        </div>

        {/* Show inline citations only for historical messages, not the latest (which uses the Sources panel) */}
        {!isLatestAI && <CollapsibleCitations citations={msg.citations} />}

        {msg.confidence && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <ConfidenceBadge level={msg.confidence} />
            <ConfidenceMeter level={msg.confidence} />
          </div>
        )}
        {msg.showDisclaimer && <DisclaimerBanner />}

        <MessageActions
          msg={msg}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
        />

        <span className="message-timestamp">{formatTimestamp(timestamp)}</span>

        {/* Smart next-action buttons derived from the answer text */}
        {isLatestAI && !msg.streaming && <NextActionBar text={msg.text} />}

        {/* Follow-up questions from response */}
        {isLatestAI && followUps.length > 0 && onFollowUp && (
          <div className="follow-up-section" style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Related questions you might want to ask:
            </span>
            <div className="follow-up-chips">
              {followUps.map((q, idx) => (
                <button
                  key={idx}
                  className="follow-up-chip"
                  onClick={() => onFollowUp(q)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginRight: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <IconArrowRight size={14} style={{ color: 'var(--primary)' }} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fallback to generic FollowUpChips only if no response follow-ups */}
        {isLatestAI && followUps.length === 0 && onFollowUp && (
          <FollowUpChips onSelect={onFollowUp} />
        )}
      </div>
    </div>
  )
}

function JurisdictionToggle({ value, onChange }) {
  const isIndia = value === 'india'
  return (
    <div
      className="jurisdiction-toggle"
      role="switch"
      aria-checked={!isIndia}
      aria-label="Toggle between India and International jurisdiction"
    >
      <span className={`jurisdiction-label ${isIndia ? 'active' : ''}`}>
        India (Domestic)
      </span>
      <div
        className={`toggle-track ${isIndia ? 'india' : 'intl'}`}
        onClick={() => onChange(isIndia ? 'intl' : 'india')}
        id="jurisdiction-toggle-track"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onChange(isIndia ? 'intl' : 'india')}
      >
        <div className={`toggle-thumb ${isIndia ? 'india' : 'intl'}`} />
      </div>
      <span className={`jurisdiction-label ${!isIndia ? 'active' : ''}`}>
        International (PCT / WIPO)
      </span>
    </div>
  )
}

/* ============================================================
   FAQ SECTION COMPONENT
   ============================================================ */
const FAQ_DATA = [
  // Website Related Questions
  {
    category: 'website',
    question: {
      en: 'Does IP-SAKTI Sahayak provide legal advice?',
      hi: 'क्या IP-SAKTI सहायक कानूनी सलाह देता है?',
      kn: 'IP-SAKTI ಸಹಾಯಕ ಕಾನೂನು ಸಲಹೆ ನೀಡುತ್ತದೆಯೇ?',
      bn: 'IP-SAKTI সহায়ক কি আইনি পরামর্শ প্রদান করে?',
      ta: 'IP-SAKTI சஹாயக் சட்ட ஆலோசனை வழங்குகிறதா?',
      te: 'IP-SAKTI సహాయక్ చట్టపరమైన సలహా అందిస్తుందా?',
      mr: 'IP-SAKTI सहायक कायदेशीर सल्ला देतो का?',
      gu: 'શું IP-SAKTI સહાયક કાનૂની સલાહ આપે છે?',
      ml: 'IP-SAKTI സഹായക് നിയമ ഉപദേശം നൽകുന്നുണ്ടോ?',
      pa: 'ਕੀ IP-SAKTI ਸਹਾਇਕ ਕਾਨੂੰਨੀ ਸਲਾਹ ਦਿੰਦਾ ਹੈ?',
    },
    answer: {
      en: 'No. IP-SAKTI Sahayak is an informational research tool only. It provides general guidance about Ayurvedic IP laws and regulations based on official sources, but it does NOT provide legal advice. For formal legal proceedings, patent filings, or court matters, please consult a registered Patent Attorney or IP Lawyer.',
      hi: 'नहीं। IP-SAKTI सहायक केवल एक सूचनात्मक अनुसंधान उपकरण है। यह आधिकारिक स्रोतों के आधार पर आयुर्वेदिक IP कानूनों और नियमों के बारे में सामान्य मार्गदर्शन प्रदान करता है, लेकिन यह कानूनी सलाह नहीं देता। औपचारिक कानूनी कार्यवाही, पेटेंट फाइलिंग या अदालती मामलों के लिए, कृपया एक पंजीकृत पेटेंट वकील या IP वकील से परामर्श करें।',
      kn: 'ಇಲ್ಲ. IP-SAKTI ಸಹಾಯಕ ಕೇವಲ ಮಾಹಿತಿ ಸಂಶೋಧನಾ ಸಾಧನವಾಗಿದೆ. ಇದು ಅಧಿಕೃತ ಮೂಲಗಳ ಆಧಾರದ ಮೇಲೆ ಆಯುರ್ವೇದ IP ಕಾನೂನುಗಳ ಬಗ್ಗೆ ಸಾಮಾನ್ಯ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತದೆ, ಆದರೆ ಕಾನೂನು ಸಲಹೆ ನೀಡುವುದಿಲ್ಲ.',
      bn: 'না। IP-SAKTI সহায়ক শুধুমাত্র একটি তথ্যমূলক গবেষণা সরঞ্জাম। এটি আইনি পরামর্শ প্রদান করে না।',
      ta: 'இல்லை. IP-SAKTI சஹாயக் ஒரு தகவல் ஆராய்ச்சி கருவி மட்டுமே. இது சட்ட ஆலோசனை வழங்காது.',
      te: 'కాదు. IP-SAKTI సహాయక్ కేవలం సమాచార పరిశోధన సాధనం మాత్రమే. ఇది చట్టపరమైన సలహా అందించదు.',
      mr: 'नाही. IP-SAKTI सहायक फक्त एक माहितीपूर्ण संशोधन साधन आहे. ते कायदेशीर सल्ला देत नाही.',
      gu: 'ના. IP-SAKTI સહાયક માત્ર એક માહિતીપ્રદ સંશોધન સાધન છે. તે કાનૂની સલાહ આપતું નથી.',
      ml: 'ഇല്ല. IP-SAKTI സഹായക് ഒരു വിവര ഗവേഷണ ഉപകരണം മാത്രമാണ്. ഇത് നിയമ ഉപദേശം നൽകുന്നില്ല.',
      pa: 'ਨਹੀਂ। IP-SAKTI ਸਹਾਇਕ ਸਿਰਫ਼ ਇੱਕ ਜਾਣਕਾਰੀ ਖੋਜ ਸਾਧਨ ਹੈ। ਇਹ ਕਾਨੂੰਨੀ ਸਲਾਹ ਨਹੀਂ ਦਿੰਦਾ।',
    },
  },
  {
    category: 'website',
    question: {
      en: 'What services does IP-SAKTI Sahayak provide?',
      hi: 'IP-SAKTI सहायक कौन सी सेवाएं प्रदान करता है?',
      kn: 'IP-SAKTI ಸಹಾಯಕ ಯಾವ ಸೇವೆಗಳನ್ನು ಒದಗಿಸುತ್ತದೆ?',
      bn: 'IP-SAKTI সহায়ক কি কি সেবা প্রদান করে?',
      ta: 'IP-SAKTI சஹாயக் என்ன சேவைகளை வழங்குகிறது?',
      te: 'IP-SAKTI సహాయక్ ఏ సేవలను అందిస్తుంది?',
      mr: 'IP-SAKTI सहायक कोणत्या सेवा प्रदान करतो?',
      gu: 'IP-SAKTI સહાયક કઈ સેવાઓ પ્રદાન કરે છે?',
      ml: 'IP-SAKTI സഹായക് എന്ത് സേവനങ്ങൾ നൽകുന്നു?',
      pa: 'IP-SAKTI ਸਹਾਇਕ ਕਿਹੜੀਆਂ ਸੇਵਾਵਾਂ ਪ੍ਰਦਾਨ ਕਰਦਾ ਹੈ?',
    },
    answer: {
      en: 'IP-SAKTI Sahayak provides: (1) AI-powered guidance on Ayurvedic IP laws (Patents, Trademarks, GI, etc.), (2) Formulation Classification Wizard to determine patentability, (3) ABS Compliance Checker for biodiversity regulations, (4) Source-cited answers from official statutes and treaties, (5) Multilingual support in Indian regional languages, and (6) Jurisdiction-aware guidance for India and International laws.',
      hi: 'IP-SAKTI सहायक प्रदान करता है: (1) आयुर्वेदिक IP कानूनों पर AI-संचालित मार्गदर्शन, (2) पेटेंट योग्यता निर्धारित करने के लिए फॉर्मूलेशन वर्गीकरण विज़ार्ड, (3) जैव विविधता नियमों के लिए ABS अनुपालन चेकर, (4) आधिकारिक कानूनों से स्रोत-उद्धृत उत्तर, (5) भारतीय क्षेत्रीय भाषाओं में बहुभाषी समर्थन।',
      kn: 'IP-SAKTI ಸಹಾಯಕ ಒದಗಿಸುತ್ತದೆ: ಆಯುರ್ವೇದ IP ಕಾನೂನುಗಳ ಬಗ್ಗೆ AI-ಚಾಲಿತ ಮಾರ್ಗದರ್ಶನ, ಸೂತ್ರೀಕರಣ ವರ್ಗೀಕರಣ ವಿಝಾರ್ಡ್, ABS ಅನುಸರಣೆ ಪರೀಕ್ಷಕ.',
      bn: 'IP-SAKTI সহায়ক প্রদান করে: আয়ুর্বেদিক IP আইনের উপর AI-চালিত নির্দেশিকা, সূত্র শ্রেণীবিভাগ উইজার্ড, ABS সম্মতি পরীক্ষক।',
      ta: 'IP-SAKTI சஹாயக் வழங்குவது: ஆயுர்வேத IP சட்டங்களில் AI-இயக்கப்படும் வழிகாட்டுதல், சூத்திர வகைப்பாடு வழிகாட்டி, ABS இணக்க சோதனை.',
      te: 'IP-SAKTI సహాయక్ అందిస్తుంది: ఆయుర్వేద IP చట్టాలపై AI-ఆధారిత మార్గదర్శకత్వం, ఫార్ములేషన్ వర్గీకరణ విజార్డ్, ABS సమ్మతి చెకర్.',
      mr: 'IP-SAKTI सहायक प्रदान करतो: आयुर्वेदिक IP कायद्यांवर AI-चालित मार्गदर्शन, फॉर्म्युलेशन वर्गीकरण विझार्ड, ABS अनुपालन तपासक.',
      gu: 'IP-SAKTI સહાયક પ્રદાન કરે છે: આયુર્વેદિક IP કાયદાઓ પર AI-સંચાલિત માર્ગદર્શન, ફોર્મ્યુલેશન વર્ગીકરણ વિઝાર્ડ, ABS અનુપાલન તપાસનાર.',
      ml: 'IP-SAKTI സഹായക് നൽകുന്നു: ആയുർവേദ IP നിയമങ്ങളിൽ AI-പ്രചോദിത മാർഗ്ഗനിർദ്ദേശം, ഫോർമുലേഷൻ വർഗ്ഗീകരണ വിസാർഡ്, ABS അനുസരണ പരിശോധനാ ഉപകരണം.',
      pa: 'IP-SAKTI ਸਹਾਇਕ ਪ੍ਰਦਾਨ ਕਰਦਾ ਹੈ: ਆਯੁਰਵੈਦਿਕ IP ਕਾਨੂੰਨਾਂ ਤੇ AI-ਚਾਲਿਤ ਮਾਰਗਦਰਸ਼ਨ, ਫਾਰਮੂਲੇਸ਼ਨ ਵਰਗੀਕਰਨ ਵਿਜ਼ਾਰਡ, ABS ਅਨੁਪਾਲਨ ਚੈੱਕਰ।',
    },
  },
  {
    category: 'website',
    question: {
      en: 'What does IP-SAKTI Sahayak NOT do?',
      hi: 'IP-SAKTI सहायक क्या नहीं करता?',
      kn: 'IP-SAKTI ಸಹಾಯಕ ಏನು ಮಾಡುವುದಿಲ್ಲ?',
      bn: 'IP-SAKTI সহায়ক কি করে না?',
      ta: 'IP-SAKTI சஹாயக் என்ன செய்யாது?',
      te: 'IP-SAKTI సహాయక్ ఏమి చేయదు?',
      mr: 'IP-SAKTI सहायक काय करत नाही?',
      gu: 'IP-SAKTI સહાયક શું કરતું નથી?',
      ml: 'IP-SAKTI സഹായക് എന്താണ് ചെയ്യാത്തത്?',
      pa: 'IP-SAKTI ਸਹਾਇਕ ਕੀ ਨਹੀਂ ਕਰਦਾ?',
    },
    answer: {
      en: 'IP-SAKTI Sahayak does NOT: (1) Provide legal advice or represent you in court, (2) File patents, trademarks, or any IP applications on your behalf, (3) Replace consultation with a registered IP attorney, (4) Guarantee patent approval or legal outcomes, (5) Access paid legal databases or submit government forms, (6) Provide medical or clinical advice about Ayurvedic treatments.',
      hi: 'IP-SAKTI सहायक नहीं करता: (1) कानूनी सलाह देना या अदालत में आपका प्रतिनिधित्व करना, (2) आपकी ओर से पेटेंट या ट्रेडमार्क फाइल करना, (3) पंजीकृत IP वकील से परामर्श को बदलना, (4) पेटेंट अनुमोदन की गारंटी देना, (5) सरकारी फॉर्म जमा करना, (6) आयुर्वेदिक उपचार के बारे में चिकित्सा सलाह देना।',
      kn: 'IP-SAKTI ಸಹಾಯಕ ಮಾಡುವುದಿಲ್ಲ: ಕಾನೂನು ಸಲಹೆ ನೀಡುವುದು, ಪೇಟೆಂಟ್ ಫೈಲ್ ಮಾಡುವುದು, IP ವಕೀಲರ ಸಮಾಲೋಚನೆಯನ್ನು ಬದಲಿಸುವುದು.',
      bn: 'IP-SAKTI সহায়ক করে না: আইনি পরামর্শ দেওয়া, পেটেন্ট ফাইল করা, IP উকিলের পরামর্শ প্রতিস্থাপন করা।',
      ta: 'IP-SAKTI சஹாயக் செய்யாது: சட்ட ஆலோசனை வழங்குவது, காப்புரிமை தாக்கல் செய்வது, IP வழக்கறிஞர் ஆலோசனையை மாற்றுவது.',
      te: 'IP-SAKTI సహాయక్ చేయదు: చట్టపరమైన సలహా అందించడం, పేటెంట్ ఫైల్ చేయడం, IP న్యాయవాది సంప్రదింపును భర్తీ చేయడం.',
      mr: 'IP-SAKTI सहायक करत नाही: कायदेशीर सल्ला देणे, पेटंट फाइल करणे, IP वकिलांच्या सल्ल्याची जागा घेणे.',
      gu: 'IP-SAKTI સહાયક કરતું નથી: કાનૂની સલાહ આપવી, પેટન્ટ ફાઇલ કરવી, IP વકીલની સલાહનું સ્થાન લેવું.',
      ml: 'IP-SAKTI സഹായക് ചെയ്യുന്നില്ല: നിയമ ഉപദേശം നൽകൽ, പേറ്റന്റ് ഫയൽ ചെയ്യൽ, IP അഭിഭാഷക കൂടിയാലോചന മാറ്റിസ്ഥാപിക്കൽ.',
      pa: 'IP-SAKTI ਸਹਾਇਕ ਨਹੀਂ ਕਰਦਾ: ਕਾਨੂੰਨੀ ਸਲਾਹ ਦੇਣਾ, ਪੇਟੈਂਟ ਫਾਈਲ ਕਰਨਾ, IP ਵਕੀਲ ਦੀ ਸਲਾਹ ਨੂੰ ਬਦਲਣਾ।',
    },
  },
  {
    category: 'website',
    question: {
      en: 'Is IP-SAKTI Sahayak free to use?',
      hi: 'क्या IP-SAKTI सहायक का उपयोग मुफ्त है?',
      kn: 'IP-SAKTI ಸಹಾಯಕ ಉಚಿತವಾಗಿ ಬಳಸಬಹುದೇ?',
      bn: 'IP-SAKTI সহায়ক কি বিনামূল্যে ব্যবহার করা যায়?',
      ta: 'IP-SAKTI சஹாயக் இலவசமாக பயன்படுத்தலாமா?',
      te: 'IP-SAKTI సహాయక్ ఉచితంగా ఉపయోగించవచ్చా?',
      mr: 'IP-SAKTI सहायक वापरण्यासाठी मोफत आहे का?',
      gu: 'શું IP-SAKTI સહાયક મફત વાપરી શકાય છે?',
      ml: 'IP-SAKTI സഹായക് സൗജന്യമായി ഉപയോഗിക്കാമോ?',
      pa: 'ਕੀ IP-SAKTI ਸਹਾਇਕ ਮੁਫ਼ਤ ਵਰਤਣ ਲਈ ਹੈ?',
    },
    answer: {
      en: 'IP-SAKTI Sahayak offers a Free Tier with basic IP guidance, formulation classification, and limited queries per day. For advanced features like detailed legal document generation, unlimited consultations, priority support, and API access, we offer affordable Premium plans designed for startups, enterprises, and institutions.',
      hi: 'IP-SAKTI सहायक बुनियादी IP मार्गदर्शन, फॉर्मूलेशन वर्गीकरण और प्रति दिन सीमित प्रश्नों के साथ एक मुफ्त टियर प्रदान करता है। विस्तृत कानूनी दस्तावेज़ निर्माण, असीमित परामर्श, प्राथमिकता सहायता और API एक्सेस जैसी उन्नत सुविधाओं के लिए, हम स्टार्टअप्स, उद्यमों और संस्थानों के लिए किफायती प्रीमियम प्लान प्रदान करते हैं।',
      kn: 'IP-SAKTI ಸಹಾಯಕ ಮೂಲ IP ಮಾರ್ಗದರ್ಶನದೊಂದಿಗೆ ಉಚಿತ ಟಿಯರ್ ಮತ್ತು ಸುಧಾರಿತ ವೈಶಿಷ್ಟ್ಯಗಳಿಗಾಗಿ ಪ್ರೀಮಿಯಂ ಯೋಜನೆಗಳನ್ನು ನೀಡುತ್ತದೆ.',
      bn: 'IP-SAKTI সহায়ক বেসিক IP নির্দেশিকা সহ একটি ফ্রি টায়ার এবং উন্নত বৈশিষ্ট্যগুলির জন্য সাশ্রয়ী প্রিমিয়াম প্ল্যান অফার করে।',
      ta: 'IP-SAKTI சஹாயக் அடிப்படை IP வழிகாட்டுதலுடன் இலவச நிலை மற்றும் மேம்பட்ட அம்சங்களுக்கு மலிவான பிரீமியம் திட்டங்களை வழங்குகிறது.',
      te: 'IP-SAKTI సహాయక్ బేసిక్ IP గైడెన్స్‌తో ఫ్రీ టియర్ మరియు అడ్వాన్స్‌డ్ ఫీచర్‌ల కోసం అందుబాటులో ఉన్న ప్రీమియం ప్లాన్‌లను అందిస్తుంది.',
      mr: 'IP-SAKTI सहायक मूलभूत IP मार्गदर्शनासह मोफत टियर आणि प्रगत वैशिष्ट्यांसाठी परवडणारे प्रीमियम प्लॅन देतो.',
      gu: 'IP-SAKTI સહાયક મૂળભૂત IP માર્ગદર્શન સાથે ફ્રી ટિયર અને અદ્યતન સુવિધાઓ માટે પોસાય તેવા પ્રીમિયમ પ્લાન્સ ઓફર કરે છે.',
      ml: 'IP-SAKTI സഹായക് അടിസ്ഥാന IP മാർഗ്ഗനിർദ്ദേശത്തോടെ ഫ്രീ ടിയറും വിപുലമായ ഫീച്ചറുകൾക്കായി താങ്ങാവുന്ന പ്രീമിയം പ്ലാനുകളും വാഗ്ദാനം ചെയ്യുന്നു.',
      pa: 'IP-SAKTI ਸਹਾਇਕ ਬੁਨਿਆਦੀ IP ਮਾਰਗਦਰਸ਼ਨ ਨਾਲ ਮੁਫ਼ਤ ਟੀਅਰ ਅਤੇ ਐਡਵਾਂਸਡ ਫੀਚਰਾਂ ਲਈ ਕਿਫਾਇਤੀ ਪ੍ਰੀਮੀਅਮ ਪਲਾਨ ਪੇਸ਼ ਕਰਦਾ ਹੈ।',
    },
  },
  {
    category: 'website',
    question: {
      en: 'How accurate is the information provided by IP-SAKTI?',
      hi: 'IP-SAKTI द्वारा प्रदान की गई जानकारी कितनी सटीक है?',
      kn: 'IP-SAKTI ಒದಗಿಸಿದ ಮಾಹಿತಿ ಎಷ್ಟು ನಿಖರವಾಗಿದೆ?',
      bn: 'IP-SAKTI প্রদত্ত তথ্য কতটা সঠিক?',
      ta: 'IP-SAKTI வழங்கும் தகவல் எவ்வளவு துல்லியமானது?',
      te: 'IP-SAKTI అందించిన సమాచారం ఎంత ఖచ్చితమైనది?',
      mr: 'IP-SAKTI द्वारे दिलेली माहिती किती अचूक आहे?',
      gu: 'IP-SAKTI દ્વારા આપવામાં આવેલી માહિતી કેટલી સચોટ છે?',
      ml: 'IP-SAKTI നൽകുന്ന വിവരങ്ങൾ എത്രത്തോളം കൃത്യമാണ്?',
      pa: 'IP-SAKTI ਦੁਆਰਾ ਦਿੱਤੀ ਜਾਣਕਾਰੀ ਕਿੰਨੀ ਸਹੀ ਹੈ?',
    },
    answer: {
      en: 'IP-SAKTI Sahayak uses a RAG (Retrieval-Augmented Generation) system that grounds all answers in official statutes like Patents Act 1970, Biological Diversity Act 2002, TKDL, and international treaties. Every response shows confidence levels (High/Medium/Low) and source citations. When evidence is insufficient, the system abstains rather than guessing.',
      hi: 'IP-SAKTI सहायक RAG (रिट्रीवल-ऑगमेंटेड जेनरेशन) प्रणाली का उपयोग करता है जो सभी उत्तरों को पेटेंट अधिनियम 1970, जैविक विविधता अधिनियम 2002, TKDL जैसे आधिकारिक कानूनों पर आधारित करता है। हर प्रतिक्रिया विश्वास स्तर और स्रोत उद्धरण दिखाती है। जब साक्ष्य अपर्याप्त होते हैं, तो सिस्टम अनुमान लगाने के बजाय रुक जाता है।',
      kn: 'IP-SAKTI ಸಹಾಯಕ RAG ವ್ಯವಸ್ಥೆಯನ್ನು ಬಳಸುತ್ತದೆ, ಇದು ಎಲ್ಲಾ ಉತ್ತರಗಳನ್ನು ಅಧಿಕೃತ ಶಾಸನಗಳ ಆಧಾರದ ಮೇಲೆ ನೀಡುತ್ತದೆ.',
      bn: 'IP-SAKTI সহায়ক RAG সিস্টেম ব্যবহার করে যা সমস্ত উত্তর অফিসিয়াল আইনের উপর ভিত্তি করে।',
      ta: 'IP-SAKTI சஹாயக் RAG அமைப்பைப் பயன்படுத்துகிறது, இது அனைத்து பதில்களையும் அதிகாரப்பூர்வ சட்டங்களின் அடிப்படையில் வழங்குகிறது.',
      te: 'IP-SAKTI సహాయక్ RAG వ్యవస్థను ఉపయోగిస్తుంది, ఇది అన్ని సమాధానాలను అధికారిక చట్టాల ఆధారంగా అందిస్తుంది.',
      mr: 'IP-SAKTI सहायक RAG प्रणाली वापरतो जी सर्व उत्तरे अधिकृत कायद्यांवर आधारित ठेवते.',
      gu: 'IP-SAKTI સહાયક RAG સિસ્ટમનો ઉપયોગ કરે છે જે તમામ જવાબોને સત્તાવાર કાયદાઓ પર આધારિત રાખે છે.',
      ml: 'IP-SAKTI സഹായക് RAG സിസ്റ്റം ഉപയോഗിക്കുന്നു, ഇത് എല്ലാ ഉത്തരങ്ങളും ഔദ്യോഗിക നിയമങ്ങളിൽ അടിസ്ഥാനമാക്കുന്നു.',
      pa: 'IP-SAKTI ਸਹਾਇਕ RAG ਸਿਸਟਮ ਵਰਤਦਾ ਹੈ ਜੋ ਸਾਰੇ ਜਵਾਬਾਂ ਨੂੰ ਅਧਿਕਾਰਤ ਕਾਨੂੰਨਾਂ ਤੇ ਆਧਾਰਿਤ ਕਰਦਾ ਹੈ।',
    },
  },
  {
    category: 'website',
    question: {
      en: 'Who can use IP-SAKTI Sahayak?',
      hi: 'IP-SAKTI सहायक का उपयोग कौन कर सकता है?',
      kn: 'IP-SAKTI ಸಹಾಯಕವನ್ನು ಯಾರು ಬಳಸಬಹುದು?',
      bn: 'IP-SAKTI সহায়ক কারা ব্যবহার করতে পারে?',
      ta: 'IP-SAKTI சஹாயக்கை யார் பயன்படுத்தலாம்?',
      te: 'IP-SAKTI సహాయక్‌ను ఎవరు ఉపయోగించవచ్చు?',
      mr: 'IP-SAKTI सहायक कोण वापरू शकतो?',
      gu: 'IP-SAKTI સહાયકનો ઉપયોગ કોણ કરી શકે છે?',
      ml: 'IP-SAKTI സഹായക് ആർക്കൊക്കെ ഉപയോഗിക്കാം?',
      pa: 'IP-SAKTI ਸਹਾਇਕ ਕੌਣ ਵਰਤ ਸਕਦਾ ਹੈ?',
    },
    answer: {
      en: 'Anyone interested in Ayurvedic IP can use IP-SAKTI Sahayak, including: Ayurvedic Practitioners (Vaidyas), AYUSH Startups & MSMEs, Researchers & Academia, Medicinal Herb Cultivators & Farmers, BAMS/BNYS Students, IP Facilitators & Junior Lawyers, and anyone curious about protecting traditional knowledge.',
      hi: 'आयुर्वेदिक IP में रुचि रखने वाला कोई भी व्यक्ति IP-SAKTI सहायक का उपयोग कर सकता है, जिसमें शामिल हैं: आयुर्वेदिक चिकित्सक (वैद्य), आयुष स्टार्टअप और MSMEs, शोधकर्ता, औषधीय जड़ी-बूटी किसान, BAMS/BNYS छात्र, IP सुविधाकर्ता।',
      kn: 'ಆಯುರ್ವೇದ IP ಯಲ್ಲಿ ಆಸಕ್ತಿ ಇರುವ ಯಾರಾದರೂ IP-SAKTI ಸಹಾಯಕವನ್ನು ಬಳಸಬಹುದು: ವೈದ್ಯರು, ಸ್ಟಾರ್ಟ್‌ಅಪ್‌ಗಳು, ಸಂಶೋಧಕರು, ರೈತರು.',
      bn: 'আয়ুর্বেদিক IP-তে আগ্রহী যে কেউ IP-SAKTI সহায়ক ব্যবহার করতে পারে: বৈদ্য, স্টার্টআপ, গবেষক, কৃষক।',
      ta: 'ஆயுர்வேத IP இல் ஆர்வமுள்ள எவரும் IP-SAKTI சஹாயக் பயன்படுத்தலாம்: வைத்தியர்கள், தொடக்க நிறுவனங்கள், ஆராய்ச்சியாளர்கள், விவசாயிகள்.',
      te: 'ఆయుర్వేద IP పై ఆసక్తి ఉన్న ఎవరైనా IP-SAKTI సహాయక్ ఉపయోగించవచ్చు: వైద్యులు, స్టార్టప్‌లు, పరిశోధకులు, రైతులు.',
      mr: 'आयुर्वेदिक IP मध्ये स्वारस्य असलेला कोणीही IP-SAKTI सहायक वापरू शकतो: वैद्य, स्टार्टअप्स, संशोधक, शेतकरी.',
      gu: 'આયુર્વેદિક IP માં રસ ધરાવતા કોઈપણ IP-SAKTI સહાયકનો ઉપયોગ કરી શકે છે: વૈદ્ય, સ્ટાર્ટઅપ્સ, સંશોધકો, ખેડૂતો.',
      ml: 'ആയുർവേദ IP യിൽ താൽപ്പര്യമുള്ള ആർക്കും IP-SAKTI സഹായക് ഉപയോഗിക്കാം: വൈദ്യന്മാർ, സ്റ്റാർട്ടപ്പുകൾ, ഗവേഷകർ, കർഷകർ.',
      pa: 'ਆਯੁਰਵੈਦਿਕ IP ਵਿੱਚ ਦਿਲਚਸਪੀ ਰੱਖਣ ਵਾਲਾ ਕੋਈ ਵੀ IP-SAKTI ਸਹਾਇਕ ਵਰਤ ਸਕਦਾ ਹੈ: ਵੈਦ, ਸਟਾਰਟਅੱਪ, ਖੋਜਕਰਤਾ, ਕਿਸਾਨ।',
    },
  },
  // IP Related Questions
  {
    category: 'ip',
    question: {
      en: 'Can I patent my traditional Ayurvedic formulation?',
      hi: 'क्या मैं अपनी पारंपरिक आयुर्वेदिक दवा का पेटेंट करा सकता हूं?',
      kn: 'ನನ್ನ ಸಾಂಪ್ರದಾಯಿಕ ಆಯುರ್ವೇದ ಸೂತ್ರವನ್ನು ಪೇಟೆಂಟ್ ಮಾಡಬಹುದೇ?',
      bn: 'আমি কি আমার ঐতিহ্যবাহী আয়ুর্বেদিক ফর্মুলেশনের পেটেন্ট করতে পারি?',
      ta: 'என் பாரம்பரிய ஆயுர்வேத சூத்திரத்திற்கு காப்புரிமை பெற முடியுமா?',
      te: 'నేను నా సంప్రదాయ ఆయుర్వేద ఫార్ములేషన్‌కు పేటెంట్ పొందగలనా?',
      mr: 'मी माझ्या पारंपारिक आयुर्वेदिक फॉर्म्युलेशनचे पेटंट घेऊ शकतो का?',
      gu: 'શું હું મારા પરંપરાગત આયુર્વેદિક ફોર્મ્યુલેશનનું પેટન્ટ કરાવી શકું છું?',
      ml: 'എന്റെ പരമ്പരാഗത ആയുർവേദ ഫോർമുലേഷന് പേറ്റന്റ് നേടാൻ കഴിയുമോ?',
      pa: 'ਕੀ ਮੈਂ ਆਪਣੇ ਰਵਾਇਤੀ ਆਯੁਰਵੈਦਿਕ ਫਾਰਮੂਲੇਸ਼ਨ ਦਾ ਪੇਟੈਂਟ ਕਰਵਾ ਸਕਦਾ ਹਾਂ?',
    },
    answer: {
      en: 'Traditional Ayurvedic formulations from classical texts (like Charaka Samhita) cannot be patented under Section 3(p) of the Patents Act 1970, which bars patents on traditional knowledge. However, if you have made a novel modification with improved efficacy or a new delivery mechanism, it may be patentable.',
      hi: 'शास्त्रीय ग्रंथों से पारंपरिक आयुर्वेदिक फॉर्मूलेशन को पेटेंट अधिनियम 1970 की धारा 3(p) के तहत पेटेंट नहीं कराया जा सकता। हालांकि, यदि आपने बेहतर प्रभावकारिता के साथ नया संशोधन किया है, तो यह पेटेंट योग्य हो सकता है।',
      kn: 'ಚರಕ ಸಂಹಿತೆಯಂತಹ ಶಾಸ್ತ್ರೀಯ ಗ್ರಂಥಗಳಿಂದ ಸಾಂಪ್ರದಾಯಿಕ ಆಯುರ್ವೇದ ಸೂತ್ರಗಳನ್ನು ಪೇಟೆಂಟ್ ಕಾಯಿದೆ 1970 ರ ಸೆಕ್ಷನ್ 3(p) ಅಡಿಯಲ್ಲಿ ಪೇಟೆಂಟ್ ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.',
      bn: 'চরক সংহিতার মতো শাস্ত্রীয় গ্রন্থ থেকে ঐতিহ্যবাহী আয়ুর্বেদিক ফর্মুলেশন পেটেন্ট আইন 1970 এর ধারা 3(p) এর অধীনে পেটেন্ট করা যায় না।',
      ta: 'சரக சம்ஹிதை போன்ற சாஸ்திர நூல்களிலிருந்து பாரம்பரிய ஆயுர்வேத சூத்திரங்களை காப்புரிமை சட்டம் 1970 இன் பிரிவு 3(p) இன் கீழ் காப்புரிமை பெற முடியாது.',
      te: 'చరక సంహిత వంటి శాస్త్రీయ గ్రంథాల నుండి సంప్రదాయ ఆయుర్వేద ఫార్ములేషన్‌లను పేటెంట్ చట్టం 1970 యొక్క సెక్షన్ 3(p) కింద పేటెంట్ చేయలేరు.',
      mr: 'चरक संहिता सारख्या शास्त्रीय ग्रंथांमधून पारंपारिक आयुर्वेदिक फॉर्म्युलेशन पेटंट कायदा 1970 च्या कलम 3(p) अंतर्गत पेटंट करता येत नाही.',
      gu: 'ચરક સંહિતા જેવા શાસ્ત્રીય ગ્રંથોમાંથી પરંપરાગત આયુર્વેદિક ફોર્મ્યુલેશનને પેટન્ટ કાયદા 1970 ની કલમ 3(p) હેઠળ પેટન્ટ કરાવી શકાતું નથી.',
      ml: 'ചരക സംഹിത പോലുള്ള ശാസ്ത്രീയ ഗ്രന്ഥങ്ങളിൽ നിന്നുള്ള പരമ്പരാഗത ആയുർവേദ ഫോർമുലേഷനുകൾ പേറ്റന്റ് നിയമം 1970 ലെ സെക്ഷൻ 3(p) പ്രകാരം പേറ്റന്റ് ചെയ്യാൻ കഴിയില്ല.',
      pa: 'ਚਰਕ ਸੰਹਿਤਾ ਵਰਗੇ ਸ਼ਾਸਤਰੀ ਗ੍ਰੰਥਾਂ ਤੋਂ ਰਵਾਇਤੀ ਆਯੁਰਵੈਦਿਕ ਫਾਰਮੂਲੇਸ਼ਨ ਨੂੰ ਪੇਟੈਂਟ ਐਕਟ 1970 ਦੀ ਧਾਰਾ 3(p) ਅਧੀਨ ਪੇਟੈਂਟ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਦਾ।',
    },
  },
  {
    category: 'ip',
    question: {
      en: 'What is TKDL and how does it protect Ayurveda?',
      hi: 'TKDL क्या है और यह आयुर्वेद की रक्षा कैसे करता है?',
      kn: 'TKDL ಎಂದರೇನು ಮತ್ತು ಅದು ಆಯುರ್ವೇದವನ್ನು ಹೇಗೆ ರಕ್ಷಿಸುತ್ತದೆ?',
      bn: 'TKDL কি এবং এটি আয়ুর্বেদকে কিভাবে রক্ষা করে?',
      ta: 'TKDL என்றால் என்ன, அது ஆயுர்வேதத்தை எப்படி பாதுகாக்கிறது?',
      te: 'TKDL అంటే ఏమిటి మరియు ఇది ఆయుర్వేదాన్ని ఎలా రక్షిస్తుంది?',
      mr: 'TKDL म्हणजे काय आणि ते आयुर्वेदाचे संरक्षण कसे करते?',
      gu: 'TKDL શું છે અને તે આયુર્વેદનું રક્ષણ કેવી રીતે કરે છે?',
      ml: 'TKDL എന്താണ്, അത് ആയുർവേദത്തെ എങ്ങനെ സംരക്ഷിക്കുന്നു?',
      pa: 'TKDL ਕੀ ਹੈ ਅਤੇ ਇਹ ਆਯੁਰਵੇਦ ਦੀ ਰੱਖਿਆ ਕਿਵੇਂ ਕਰਦਾ ਹੈ?',
    },
    answer: {
      en: 'TKDL (Traditional Knowledge Digital Library) is a database of 3.5 lakh+ traditional formulations created by CSIR & Ministry of AYUSH. It prevents biopiracy by providing prior art evidence to international patent offices, stopping foreign entities from patenting our ancient knowledge.',
      hi: 'TKDL (पारंपरिक ज्ञान डिजिटल पुस्तकालय) CSIR और आयुष मंत्रालय द्वारा बनाया गया 3.5 लाख+ पारंपरिक फॉर्मूलेशन का डेटाबेस है। यह अंतर्राष्ट्रीय पेटेंट कार्यालयों को पूर्व कला साक्ष्य प्रदान करके जैव-चोरी को रोकता है।',
      kn: 'TKDL (ಸಾಂಪ್ರದಾಯಿಕ ಜ್ಞಾನ ಡಿಜಿಟಲ್ ಲೈಬ್ರರಿ) CSIR ಮತ್ತು ಆಯುಷ್ ಸಚಿವಾಲಯ ರಚಿಸಿದ 3.5 ಲಕ್ಷ+ ಸಾಂಪ್ರದಾಯಿಕ ಸೂತ್ರಗಳ ಡೇಟಾಬೇಸ್ ಆಗಿದೆ.',
      bn: 'TKDL (ঐতিহ্যগত জ্ঞান ডিজিটাল লাইব্রেরি) হল CSIR এবং আয়ুষ মন্ত্রণালয় দ্বারা তৈরি 3.5 লক্ষ+ ঐতিহ্যবাহী সূত্রের ডাটাবেস।',
      ta: 'TKDL (பாரம்பரிய அறிவு டிஜிட்டல் நூலகம்) CSIR மற்றும் ஆயுஷ் அமைச்சகம் உருவாக்கிய 3.5 லட்சம்+ பாரம்பரிய சூத்திரங்களின் தரவுத்தளம் ஆகும்.',
      te: 'TKDL (సంప్రదాయ జ్ఞానం డిజిటల్ లైబ్రరీ) CSIR మరియు ఆయుష్ మంత్రిత్వ శాఖ రూపొందించిన 3.5 లక్షల+ సంప్రదాయ సూత్రాల డేటాబేస్.',
      mr: 'TKDL (पारंपारिक ज्ञान डिजिटल लायब्ररी) हा CSIR आणि आयुष मंत्रालयाने तयार केलेला 3.5 लाख+ पारंपारिक सूत्रांचा डेटाबेस आहे.',
      gu: 'TKDL (પરંપરાગત જ્ઞાન ડિજિટલ લાઇબ્રેરી) એ CSIR અને આયુષ મંત્રાલય દ્વારા બનાવેલ 3.5 લાખ+ પરંપરાગત ફોર્મ્યુલેશનનો ડેટાબેઝ છે.',
      ml: 'TKDL (പരമ്പരാഗത വിജ്ഞാന ഡിജിറ്റൽ ലൈബ്രറി) CSIR ഉം ആയുഷ് മന്ത്രാലയവും സൃഷ്ടിച്ച 3.5 ലക്ഷത്തിലധികം പരമ്പരാഗത ഫോർമുലേഷനുകളുടെ ഡാറ്റാബേസ് ആണ്.',
      pa: 'TKDL (ਰਵਾਇਤੀ ਗਿਆਨ ਡਿਜੀਟਲ ਲਾਇਬ੍ਰੇਰੀ) CSIR ਅਤੇ ਆਯੁਸ਼ ਮੰਤਰਾਲੇ ਦੁਆਰਾ ਬਣਾਇਆ 3.5 ਲੱਖ+ ਰਵਾਇਤੀ ਫਾਰਮੂਲੇਸ਼ਨਾਂ ਦਾ ਡੇਟਾਬੇਸ ਹੈ।',
    },
  },
  {
    category: 'ip',
    question: {
      en: 'What is Access and Benefit Sharing (ABS) compliance?',
      hi: 'एक्सेस और बेनिफिट शेयरिंग (ABS) अनुपालन क्या है?',
      kn: 'ಪ್ರವೇಶ ಮತ್ತು ಲಾಭ ಹಂಚಿಕೆ (ABS) ಅನುಸರಣೆ ಎಂದರೇನು?',
      bn: 'অ্যাক্সেস অ্যান্ড বেনিফিট শেয়ারিং (ABS) সম্মতি কি?',
      ta: 'அணுகல் மற்றும் நன்மை பகிர்வு (ABS) இணக்கம் என்றால் என்ன?',
      te: 'యాక్సెస్ అండ్ బెనిఫిట్ షేరింగ్ (ABS) సమ్మతి అంటే ఏమిటి?',
      mr: 'अॅक्सेस अँड बेनिफिट शेअरिंग (ABS) अनुपालन म्हणजे काय?',
      gu: 'એક્સેસ એન્ડ બેનિફિટ શેરિંગ (ABS) અનુપાલન શું છે?',
      ml: 'ആക്സസ് ആൻഡ് ബെനിഫിറ്റ് ഷെയറിംഗ് (ABS) അനുസരണം എന്താണ്?',
      pa: 'ਐਕਸੈਸ ਐਂਡ ਬੈਨੀਫਿਟ ਸ਼ੇਅਰਿੰਗ (ABS) ਅਨੁਪਾਲਨ ਕੀ ਹੈ?',
    },
    answer: {
      en: 'ABS under the Biological Diversity Act 2002 ensures that anyone using Indian biological resources (herbs, plants, microorganisms) shares benefits fairly with local communities. Foreign entities need prior approval from National Biodiversity Authority (NBA) before accessing these resources.',
      hi: 'जैविक विविधता अधिनियम 2002 के तहत ABS यह सुनिश्चित करता है कि भारतीय जैविक संसाधनों का उपयोग करने वाला कोई भी व्यक्ति स्थानीय समुदायों के साथ लाभ साझा करे। विदेशी संस्थाओं को NBA से पूर्व अनुमोदन की आवश्यकता है।',
      kn: '2002 ರ ಜೈವಿಕ ವೈವಿಧ್ಯ ಕಾಯಿದೆಯ ಅಡಿಯಲ್ಲಿ ABS ಭಾರತೀಯ ಜೈವಿಕ ಸಂಪನ್ಮೂಲಗಳನ್ನು ಬಳಸುವ ಯಾರಾದರೂ ಸ್ಥಳೀಯ ಸಮುದಾಯಗಳೊಂದಿಗೆ ಪ್ರಯೋಜನಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳುವುದನ್ನು ಖಚಿತಪಡಿಸುತ್ತದೆ.',
      bn: '2002 সালের জৈব বৈচিত্র্য আইনের অধীনে ABS নিশ্চিত করে যে ভারতীয় জৈব সম্পদ ব্যবহারকারী যে কেউ স্থানীয় সম্প্রদায়ের সাথে সুবিধা ভাগ করে নেয়।',
      ta: '2002 ஆம் ஆண்டு உயிரியல் பல்வகைமை சட்டத்தின் கீழ் ABS, இந்திய உயிரியல் வளங்களைப் பயன்படுத்தும் எவரும் உள்ளூர் சமூகங்களுடன் பயன்களைப் பகிர்வதை உறுதி செய்கிறது.',
      te: '2002 జీవ వైవిధ్య చట్టం కింద ABS భారతీయ జీవ వనరులను ఉపయోగించే ఎవరైనా స్థానిక సంఘాలతో ప్రయోజనాలను పంచుకోవడాన్ని నిర్ధారిస్తుంది.',
      mr: '2002 च्या जैवविविधता कायद्यांतर्गत ABS हे सुनिश्चित करते की भारतीय जैविक संसाधने वापरणारा कोणीही स्थानिक समुदायांसोबत लाभ सामायिक करतो.',
      gu: '2002 ના જૈવિક વિવિધતા કાયદા હેઠળ ABS ખાતરી કરે છે કે ભારતીય જૈવિક સંસાધનોનો ઉપયોગ કરનાર કોઈપણ સ્થાનિક સમુદાયો સાથે લાભ વહેંચે છે.',
      ml: '2002 ലെ ജൈവ വൈവിധ്യ നിയമത്തിന് കീഴിൽ ABS ഇന്ത്യൻ ജൈവ വിഭവങ്ങൾ ഉപയോഗിക്കുന്ന ആർക്കും പ്രാദേശിക സമൂഹങ്ങളുമായി പ്രയോജനങ്ങൾ പങ്കിടുന്നത് ഉറപ്പാക്കുന്നു.',
      pa: '2002 ਦੇ ਜੈਵਿਕ ਵਿਭਿੰਨਤਾ ਕਾਨੂੰਨ ਅਧੀਨ ABS ਯਕੀਨੀ ਬਣਾਉਂਦਾ ਹੈ ਕਿ ਭਾਰਤੀ ਜੈਵਿਕ ਸਰੋਤਾਂ ਦੀ ਵਰਤੋਂ ਕਰਨ ਵਾਲਾ ਕੋਈ ਵੀ ਸਥਾਨਕ ਭਾਈਚਾਰਿਆਂ ਨਾਲ ਲਾਭ ਸਾਂਝੇ ਕਰੇ।',
    },
  },
  {
    category: 'ip',
    question: {
      en: 'What license do I need to manufacture Ayurvedic medicines?',
      hi: 'आयुर्वेदिक दवाओं के निर्माण के लिए मुझे कौन सा लाइसेंस चाहिए?',
      kn: 'ಆಯುರ್ವೇದ ಔಷಧಿಗಳನ್ನು ತಯಾರಿಸಲು ನನಗೆ ಯಾವ ಪರವಾನಗಿ ಬೇಕು?',
      bn: 'আয়ুর্বেদিক ওষুধ তৈরি করতে আমার কোন লাইসেন্স দরকার?',
      ta: 'ஆயுர்வேத மருந்துகளை உற்பத்தி செய்ய எனக்கு என்ன உரிமம் தேவை?',
      te: 'ఆయుర్వేద మందులు తయారు చేయడానికి నాకు ఏ లైసెన్స్ అవసరం?',
      mr: 'आयुर्वेदिक औषधे तयार करण्यासाठी मला कोणत्या परवान्याची आवश्यकता आहे?',
      gu: 'આયુર્વેદિક દવાઓ બનાવવા માટે મને કયા લાયસન્સની જરૂર છે?',
      ml: 'ആയുർവേദ മരുന്നുകൾ നിർമ്മിക്കാൻ എനിക്ക് എന്ത് ലൈസൻസ് വേണം?',
      pa: 'ਆਯੁਰਵੈਦਿਕ ਦਵਾਈਆਂ ਬਣਾਉਣ ਲਈ ਮੈਨੂੰ ਕਿਹੜੇ ਲਾਇਸੈਂਸ ਦੀ ਲੋੜ ਹੈ?',
    },
    answer: {
      en: 'Under the Drugs & Cosmetics Act 1940, you need a license from State AYUSH Licensing Authority. Classical formulations require Rule 158-B(1) license, while proprietary medicines need Rule 158-B(2) license with safety and efficacy data.',
      hi: 'औषधि एवं प्रसाधन सामग्री अधिनियम 1940 के तहत, आपको राज्य आयुष लाइसेंसिंग प्राधिकरण से लाइसेंस की आवश्यकता है। शास्त्रीय फॉर्मूलेशन के लिए नियम 158-बी(1) लाइसेंस की आवश्यकता है।',
      kn: '1940 ರ ಔಷಧಿ ಮತ್ತು ಸೌಂದರ್ಯವರ್ಧಕ ಕಾಯಿದೆಯ ಅಡಿಯಲ್ಲಿ, ನಿಮಗೆ ರಾಜ್ಯ ಆಯುಷ್ ಪರವಾನಗಿ ಪ್ರಾಧಿಕಾರದಿಂದ ಪರವಾನಗಿ ಅಗತ್ಯವಿದೆ.',
      bn: '1940 সালের ড্রাগস অ্যান্ড কসমেটিক্স অ্যাক্টের অধীনে, আপনার রাজ্য আয়ুষ লাইসেন্সিং কর্তৃপক্ষের কাছ থেকে লাইসেন্স প্রয়োজন।',
      ta: '1940 ஆம் ஆண்டு மருந்துகள் மற்றும் அழகுசாதனப் பொருட்கள் சட்டத்தின் கீழ், உங்களுக்கு மாநில ஆயுஷ் உரிம ஆணையத்திடமிருந்து உரிமம் தேவை.',
      te: '1940 డ్రగ్స్ & కాస్మెటిక్స్ చట్టం ప్రకారం, మీకు స్టేట్ ఆయుష్ లైసెన్సింగ్ అథారిటీ నుండి లైసెన్స్ అవసరం.',
      mr: '1940 च्या औषधे आणि सौंदर्यप्रसाधने कायद्यांतर्गत, तुम्हाला राज्य आयुष परवाना प्राधिकरणाकडून परवाना आवश्यक आहे.',
      gu: '1940 ના ડ્રગ્સ અને કોસ્મેટિક્સ એક્ટ હેઠળ, તમને સ્ટેટ આયુષ લાઇસન્સિંગ ઓથોરિટી પાસેથી લાયસન્સની જરૂર છે.',
      ml: '1940 ലെ ഡ്രഗ്സ് & കോസ്മെറ്റിക്സ് ആക്ട് പ്രകാരം, സ്റ്റേറ്റ് ആയുഷ് ലൈസൻസിംഗ് അതോറിറ്റിയിൽ നിന്ന് ലൈസൻസ് ആവശ്യമാണ്.',
      pa: '1940 ਦੇ ਡਰੱਗਜ਼ ਐਂਡ ਕਾਸਮੈਟਿਕਸ ਐਕਟ ਅਧੀਨ, ਤੁਹਾਨੂੰ ਸਟੇਟ ਆਯੁਸ਼ ਲਾਇਸੈਂਸਿੰਗ ਅਥਾਰਟੀ ਤੋਂ ਲਾਇਸੈਂਸ ਦੀ ਲੋੜ ਹੈ।',
    },
  },
]

const FAQ_LANGUAGES = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'hi', label: 'हिन्दी', flag: 'HI' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: 'KN' },
  { code: 'bn', label: 'বাংলা', flag: 'BN' },
  { code: 'ta', label: 'தமிழ்', flag: 'TA' },
  { code: 'te', label: 'తెలుగు', flag: 'TE' },
  { code: 'mr', label: 'मराठी', flag: 'MR' },
  { code: 'gu', label: 'ગુજરાતી', flag: 'GU' },
  { code: 'ml', label: 'മലയാളം', flag: 'ML' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', flag: 'PA' },
]

const FAQ_TITLES = {
  en: 'Frequently Asked Questions',
  hi: 'अक्सर पूछे जाने वाले प्रश्न',
  kn: 'ಪದೇ ಪದೇ ಕೇಳಲಾಗುವ ಪ್ರಶ್ನೆಗಳು',
  bn: 'প্রায়শই জিজ্ঞাসিত প্রশ্নাবলী',
  ta: 'அடிக்கடி கேட்கப்படும் கேள்விகள்',
  te: 'తరచుగా అడిగే ప్రశ్నలు',
  mr: 'वारंवार विचारले जाणारे प्रश्न',
  gu: 'વારંવાર પૂછાતા પ્રશ્નો',
  ml: 'പതിവായി ചോദിക്കുന്ന ചോദ്യങ്ങൾ',
  pa: 'ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ',
}

const FAQ_SUBTITLES = {
  en: 'Clear all your doubts about IP-SAKTI and Ayurvedic IP protection',
  hi: 'IP-SAKTI और आयुर्वेदिक IP सुरक्षा के बारे में अपने सभी संदेह दूर करें',
  kn: 'IP-SAKTI ಮತ್ತು ಆಯುರ್ವೇದ IP ರಕ್ಷಣೆ ಬಗ್ಗೆ ನಿಮ್ಮ ಎಲ್ಲಾ ಸಂದೇಹಗಳನ್ನು ಬಗೆಹರಿಸಿ',
  bn: 'IP-SAKTI এবং আয়ুর্বেদিক IP সুরক্ষা সম্পর্কে আপনার সমস্ত সন্দেহ দূর করুন',
  ta: 'IP-SAKTI மற்றும் ஆயுர்வேத IP பாதுகாப்பு பற்றிய உங்கள் அனைத்து சந்தேகங்களையும் தீர்க்கவும்',
  te: 'IP-SAKTI మరియు ఆయుర్వేద IP రక్షణ గురించి మీ అన్ని సందేహాలను తొలగించుకోండి',
  mr: 'IP-SAKTI आणि आयुर्वेदिक IP संरक्षणाबद्दल तुमच्या सर्व शंका दूर करा',
  gu: 'IP-SAKTI અને આયુર્વેદિક IP સુરક્ષા વિશે તમારી બધી શંકાઓ દૂર કરો',
  ml: 'IP-SAKTI യെക്കുറിച്ചും ആയുർവേദ IP സംരക്ഷണത്തെക്കുറിച്ചും നിങ്ങളുടെ എല്ലാ സംശയങ്ങളും മാറ്റുക',
  pa: 'IP-SAKTI ਅਤੇ ਆਯੁਰਵੈਦਿਕ IP ਸੁਰੱਖਿਆ ਬਾਰੇ ਆਪਣੇ ਸਾਰੇ ਸ਼ੱਕ ਦੂਰ ਕਰੋ',
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null)
  const { lang: globalLang, t } = useLanguage()
  // Use global language as default, but allow override
  const [faqLangOverride, setFaqLangOverride] = useState(null)

  // Use override if set, otherwise use global language
  const faqLang = faqLangOverride || globalLang

  // Function to set FAQ language (this overrides global)
  const setFaqLang = (newLang) => {
    setFaqLangOverride(newLang)
  }

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  const getLocalizedText = (textObj) => {
    return textObj[faqLang] || textObj['en']
  }

  return (
    <section className="section faq-section" id="faq" aria-labelledby="faq-title">
      <p className="section-label">{FAQ_TITLES[faqLang] || FAQ_TITLES['en']}</p>
      <h2 className="section-title" id="faq-title">
        {FAQ_SUBTITLES[faqLang] || FAQ_SUBTITLES['en']}
      </h2>

      {/* Language Dropdown */}
      <div className="faq-lang-dropdown-wrap">
        <label htmlFor="faq-lang-select" className="faq-lang-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconGlobe size={15} /> {t('faqReadIn')}
        </label>
        <select
          id="faq-lang-select"
          className="faq-lang-dropdown"
          value={faqLang}
          onChange={(e) => setFaqLang(e.target.value)}
          aria-label="Select FAQ language"
        >
          {FAQ_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              [{lang.flag}] {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* FAQ Accordion */}
      <div className="faq-list">
        {FAQ_DATA.map((faq, index) => (
          <div
            key={index}
            className={`faq-item ${openIndex === index ? 'open' : ''}`}
          >
            <button
              className="faq-question"
              onClick={() => toggleFAQ(index)}
              aria-expanded={openIndex === index}
              aria-controls={`faq-answer-${index}`}
            >
              <span className="faq-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                {faq.category === 'website' ? <IconGlobe size={16} /> : <IconScroll size={16} />}
              </span>
              <span className="faq-question-text">
                {getLocalizedText(faq.question)}
              </span>
              <span className={`faq-chevron ${openIndex === index ? 'rotated' : ''}`} aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <IconChevronDown size={16} />
              </span>
            </button>
            <div
              className={`faq-answer ${openIndex === index ? 'expanded' : ''}`}
              id={`faq-answer-${index}`}
              role="region"
              aria-hidden={openIndex !== index}
            >
              <p>{getLocalizedText(faq.answer)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA to Chat */}
      <div className="faq-cta">
        <p className="faq-cta-prompt">
          {t('moreQuestions')}
        </p>
        <Link
          to="/chat"
          className="faq-ask-ragvyn-btn"
          id="faq-ask-ragvyn-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={`${t('askRagvynAi')} - Open RagVyn AI Chatbot`}
        >
          <IconSparkles size={18} className="btn-sparkle" />
          <span className="faq-ask-ragvyn-text">{t('askRagvynAi')}</span>
          <IconArrowRight size={18} className="btn-arrow" />
        </Link>
      </div>
    </section>
  )
}

/* ============================================================
   INSTITUTIONAL ACCESSIBILITY STRIP (COMPACT GOV-TECH)
   ============================================================ */
function GovtAccessibilityBar({ theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt }) {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const { t } = useLanguage()

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      if (setPrefillPrompt) setPrefillPrompt(searchQuery.trim())
      navigate('/chat')
    } else {
      navigate('/chat')
    }
  }

  return (
    <div className="gov-utility-strip" role="region" aria-label="Institutional Identity & Accessibility">
      <div className="gov-utility-container">
        <div className="gov-utility-left">
          <span className="gov-flag-marker" aria-hidden="true">
            <span className="flag-stripe saffron" />
            <span className="flag-stripe white" />
            <span className="flag-stripe green" />
          </span>
          <span className="gov-identity-text">
            <strong>आयुष मंत्रालय</strong> | Ministry of AYUSH
          </span>
        </div>

        <div className="gov-utility-right">
          <form className="top-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="top-search-input"
              aria-label="Search IP Statutes and Guidelines"
            />
            <button type="submit" className="top-search-btn" title="Search Portal" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconSearch size={13} />
            </button>
          </form>

          <GlobalLanguageSelector />

          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />

          <button
            type="button"
            className="gov-skip-link"
            title="Accessibility options"
            aria-label="Open accessibility options"
            onClick={() => { if (window.__openAccessibility) window.__openAccessibility() }}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'rgba(212,175,55,0.18)', border: '1.5px solid rgba(212,175,55,0.7)', borderRadius: '18px', cursor: 'pointer', padding: '5px 12px', color: 'inherit', fontWeight: 700 }}
          >
            <IconAccessibility size={20} />
            <span style={{ fontSize: '0.78rem' }}>Accessibility</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   IP-SAKTI PREMIUM LOGO COMPONENT
   ============================================================ */
function IpSaktiLogo({ className = '', size = 36 }) {
  return (
    <img
      src="/logo.png"
      alt="IP-SAKTI Sahayak Logo"
      className={className}
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  )
}

/* ============================================================
   GOVERNMENT PORTAL MAIN NAVIGATION BAR (CLEAN SINGLE ROW)
   ============================================================ */
function GovtNavbar({ onOpenAbout, onOpenWizard, isLoggedIn, userName, onLogout }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false)
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false)
  const [tourRun, setTourRun] = useState(false)
  const toolsDropdownRef = useRef(null)
  const servicesDropdownRef = useRef(null)

  const handleSeeDemo = (e) => {
    if (e) e.preventDefault()
    setMobileMenuOpen(false)
    if (location.pathname === '/') {
      const el = document.getElementById('demo')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        window.history.replaceState(null, '', '#demo')
      }
    } else {
      navigate('/#demo', { state: { scrollTo: 'demo' } })
    }
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target)) {
        setToolsDropdownOpen(false)
      }
      if (servicesDropdownRef.current && !servicesDropdownRef.current.contains(event.target)) {
        setServicesDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
    <nav className={`gov-nav-bar${scrolled ? ' nav-scrolled' : ''}`} role="navigation" aria-label="Main Portal Navigation">
      <div className="gov-nav-container">
        {/* Left: Brand Identity */}
        <Link
          to="/"
          className="gov-brand-wrap"
          onClick={() => {
            setMobileMenuOpen(false)
            window.dispatchEvent(new CustomEvent('retrigger-hero-anim'))
          }}
        >
          <IpSaktiLogo size={36} className="gov-brand-icon" />
          <div className="gov-brand-text">
            <div className="gov-brand-title">
              IP-SAKTI <span className="title-highlight">Sahayak</span>
            </div>
            <div className="gov-brand-subtitle">
              <span className="ayush-dot" />
              <span>Ayurveda IP & Regulatory Guidance</span>
            </div>
          </div>
        </Link>

        {/* Center: Professional navigation with dropdowns */}
        <ul className={`gov-nav-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          {/* Tools Dropdown */}
          <li className="gov-nav-dropdown" ref={toolsDropdownRef}>
            <button
              type="button"
              className="gov-nav-link-btn gov-nav-dropdown-trigger"
              data-tour="ip-tools"
              onClick={() => {
                setToolsDropdownOpen(!toolsDropdownOpen)
                setServicesDropdownOpen(false)
              }}
              aria-expanded={toolsDropdownOpen}
            >
              <IconCalculator size={15} />
              <span>IP Tools</span>
              <IconChevronDown size={12} className={`dropdown-chevron ${toolsDropdownOpen ? 'open' : ''}`} />
            </button>
            {toolsDropdownOpen && (
              <div className="gov-nav-dropdown-menu">
                <Link to="/patentability" className="gov-dropdown-item" onClick={() => { setToolsDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconScales size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">⚖️ Patentability Assessment</span>
                    <span className="dropdown-item-desc">Prior art & § 3(p)/3(d)/3(e) assessment</span>
                  </div>
                </Link>
                <Link to="/roadmap" className="gov-dropdown-item" onClick={() => { setToolsDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconCalendar size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">🗺️ IP Journey Roadmap</span>
                    <span className="dropdown-item-desc">Personalized filing-to-grant timeline</span>
                  </div>
                </Link>
                <Link to="/guardian" className="gov-dropdown-item" onClick={() => { setToolsDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconLeaf size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">🧭 Dual-Use Guardian</span>
                    <span className="dropdown-item-desc">IP + AYUSH + ABS + FSSAI in one view</span>
                  </div>
                </Link>
                <Link to="/ip-calculator" className="gov-dropdown-item" onClick={() => { setToolsDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconCurrencyRupee size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Fee Calculator</span>
                    <span className="dropdown-item-desc">Patent filing fees estimate</span>
                  </div>
                </Link>
                <Link to="/deadline-calculator" className="gov-dropdown-item" onClick={() => { setToolsDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconCalendar size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Deadline Calculator</span>
                    <span className="dropdown-item-desc">Track RFE, FER & renewals</span>
                  </div>
                </Link>
                <Link to="/abs-checker" className="gov-dropdown-item" onClick={() => { setToolsDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconLeaf size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">ABS Checker</span>
                    <span className="dropdown-item-desc">Biodiversity compliance</span>
                  </div>
                </Link>
                <Link to="/checklists" className="gov-dropdown-item" onClick={() => { setToolsDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconCheck size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Filing Checklists</span>
                    <span className="dropdown-item-desc">Patent, TM, GI checklists</span>
                  </div>
                </Link>
              </div>
            )}
          </li>

          {/* Freedom to Operate */}
          <li>
            <button type="button" className="gov-nav-link-btn" data-tour="fto">
              <span>FTO</span>
            </button>
          </li>

          {/* Services Dropdown */}
          <li className="gov-nav-dropdown" ref={servicesDropdownRef}>
            <button
              type="button"
              className="gov-nav-link-btn gov-nav-dropdown-trigger"
              data-tour="services"
              onClick={() => {
                setServicesDropdownOpen(!servicesDropdownOpen)
                setToolsDropdownOpen(false)
              }}
              aria-expanded={servicesDropdownOpen}
            >
              <IconBriefcase size={15} />
              <span>Services</span>
              <IconChevronDown size={12} className={`dropdown-chevron ${servicesDropdownOpen ? 'open' : ''}`} />
            </button>
            {servicesDropdownOpen && (
              <div className="gov-nav-dropdown-menu">
                <Link to="/drafts" className="gov-dropdown-item" onClick={() => { setServicesDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconEdit size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Draft Generator</span>
                    <span className="dropdown-item-desc">Form-1, NBA templates</span>
                  </div>
                </Link>
                <Link to="/workspace" className="gov-dropdown-item" onClick={() => { setServicesDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconBriefcase size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Matter Workspace</span>
                    <span className="dropdown-item-desc">Track your IP cases</span>
                    {!isLoggedIn && <span className="dropdown-item-badge">Login required</span>}
                  </div>
                </Link>
                <Link to="/documents" className="gov-dropdown-item" onClick={() => { setServicesDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconPaperClip size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Document Upload</span>
                    <span className="dropdown-item-desc">Upload & search PDFs</span>
                    {!isLoggedIn && <span className="dropdown-item-badge">Login required</span>}
                  </div>
                </Link>
                <Link to="/experts" className="gov-dropdown-item" onClick={() => { setServicesDropdownOpen(false); setMobileMenuOpen(false); }}>
                  <IconUsers size={16} />
                  <div className="dropdown-item-content">
                    <span className="dropdown-item-title">Expert Connect</span>
                    <span className="dropdown-item-desc">Find IP experts & FAQs</span>
                  </div>
                </Link>
              </div>
            )}
          </li>

          {/* Direct Links */}
          <li className="gov-nav-item-secondary">
            <button
              type="button"
              className="gov-nav-link-btn"
              onClick={handleSeeDemo}
              aria-label="See Demo"
            >
              <IconEye size={15} />
              <span>{t('seeDemo') || 'See Demo'}</span>
            </button>
          </li>
          <li>
            <Link to="/sources" className="gov-nav-link" onClick={() => setMobileMenuOpen(false)}>
              <IconBook size={15} />
              <span>Sources</span>
            </Link>
          </li>
          <li>
            <Link to="/pricing" className="gov-nav-link" onClick={() => setMobileMenuOpen(false)}>
              <IconTag size={15} />
              <span>Pricing</span>
            </Link>
          </li>
          <li className="gov-nav-item-secondary">
            <button
              type="button"
              className="gov-nav-link-btn"
              onClick={() => {
                setMobileMenuOpen(false)
                if (onOpenAbout) onOpenAbout()
              }}
            >
              <IconInfo size={15} />
              <span>About</span>
            </button>
          </li>
          <li className="gov-nav-item-secondary">
            <button
              type="button"
              className="gov-nav-link-btn"
              onClick={() => {
                setMobileMenuOpen(false)
                setTourRun(true)
              }}
              title="Take a guided tour"
            >
              <IconInfo size={15} />
              <span>{t('tourNavBtn') || 'Tour'}</span>
            </button>
          </li>

          {/* Mobile-Only Actions inside Hamburger Menu */}
          <li className="gov-nav-mobile-actions">
            {isLoggedIn ? (
              <div className="gov-nav-mobile-user-box">
                <div className="gov-nav-welcome-badge mobile-user-badge">
                  <div className="welcome-avatar">
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="welcome-text">
                    <span className="welcome-label">Signed in as</span>
                    <span className="welcome-name">{userName || 'Innovator'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="gov-nav-logout-btn mobile-logout-btn"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    onLogout()
                  }}
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="gov-nav-mobile-login-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                <IconUser size={16} />
                <span>{t('loginOrRegister')}</span>
              </Link>
            )}
            <Link
              to="/chat"
              className="gov-nav-mobile-cta"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>Consult RagVyn AI</span>
              <IconArrowRight size={15} />
            </Link>
          </li>
        </ul>

        {/* Right: Actions */}
        <div className="gov-nav-actions">
          {/* Desktop User/Guest Groups */}
          <div className="gov-nav-desktop-actions">
            {isLoggedIn ? (
              <div className="gov-nav-user-group">
                <div className="gov-nav-welcome-badge">
                  <div className="welcome-avatar">
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="welcome-text">
                    <span className="welcome-label">Welcome back,</span>
                    <span className="welcome-name">{userName || 'Innovator'}</span>
                  </div>
                </div>
                <button className="gov-nav-logout-btn" onClick={onLogout}>
                  {t('logout')}
                </button>
                <Link to="/chat" className="gov-nav-cta" id="gov-nav-consult-btn">
                  <span>RagVyn AI</span>
                  <IconArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="gov-nav-guest-group">
                <Link to="/login" className="gov-nav-login-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconUser size={14} />
                  <span>{t('loginOrRegister')}</span>
                </Link>
                <Link to="/chat" className="gov-nav-cta" id="gov-nav-consult-btn">
                  <span>RagVyn AI</span>
                  <IconArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Quick Action Pill */}
          <Link to="/chat" className="gov-nav-mobile-quick-cta" aria-label="RagVyn AI">
            <span>AI</span>
            <IconSparkles size={13} />
          </Link>

          {/* Mobile hamburger toggle */}
          <button
            type="button"
            className="gov-mobile-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <IconX size={20} /> : <IconMenu size={20} />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div
          className="gov-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </nav>
    <OnboardingTour
      run={tourRun}
      onClose={() => setTourRun(false)}
      onOpenTools={(open) => setToolsDropdownOpen(open)}
      onOpenServices={(open) => setServicesDropdownOpen(open)}
      t={t}
    />
    </>
  )
}

/* ============================================================
   TRANSLATED FOOTER COMPONENT - Professional Government Style
   ============================================================ */
function TranslatedFooter() {
  const { t } = useLanguage()

  return (
    <footer className="gov-footer" role="contentinfo">
      {/* Main Footer Content */}
      <div className="gov-footer-main">
        <div className="gov-footer-container">
          {/* Column 1: Brand & Ministry Info */}
          <div className="gov-footer-col gov-footer-brand-col">
            <div className="gov-footer-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="gov-footer-logo" style={{ display: 'flex', color: 'var(--primary-light)' }}><IconLeaf size={24} /></span>
              <div className="gov-footer-brand-text">
                <h3 className="gov-footer-title">IP-SAKTI Sahayak</h3>
                <span className="gov-footer-subtitle">आईपी-शक्ति सहायक</span>
              </div>
            </div>
            <div className="gov-footer-ministry">
              <p className="gov-footer-ministry-name">{t('ministry')}</p>
              <p className="gov-footer-govt">{t('govtOf')}</p>
            </div>
            <p className="gov-footer-tagline">
              Smart IP & Regulatory Assistance Portal for Traditional Knowledge
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="gov-footer-col">
            <h4 className="gov-footer-col-title">Quick Links</h4>
            <ul className="gov-footer-links">
              <li><Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconHome size={14} /> Home</Link></li>
              <li><Link to="/chat" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconMessageSquare size={14} /> AI Consultation</Link></li>
              <li><Link to="/abs-checker" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconLeaf size={14} /> ABS Checker</Link></li>
              <li><Link to="/ip-calculator" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconCalculator size={14} /> IP Calculator</Link></li>
              <li><Link to="/deadline-calculator" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconCalendar size={14} /> {t('deadlineCalc')}</Link></li>
              <li><Link to="/sources" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconBook size={14} /> Sources</Link></li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="gov-footer-col">
            <h4 className="gov-footer-col-title">Resources</h4>
            <ul className="gov-footer-links">
              <li><a href="https://www.ayush.gov.in" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconGovt size={14} /> AYUSH Portal</a></li>
              <li><a href="https://tkdl.res.in" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconBook size={14} /> TKDL Database</a></li>
              <li><a href="https://nbaindia.org" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconLeaf size={14} /> NBA India</a></li>
              <li><a href="https://ipindia.gov.in" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconScales size={14} /> IP India</a></li>
              <li><Link to="/privacy" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconLock size={14} /> Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact & Social */}
          <div className="gov-footer-col">
            <h4 className="gov-footer-col-title">Contact Us</h4>
            <div className="gov-footer-contact">
              <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconPin size={14} /> AYUSH Bhawan, B Block</p>
              <p style={{ paddingLeft: '20px' }}>GPO Complex, INA, New Delhi - 110023</p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconMail size={14} /> info-ayush@gov.in</p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconPhone size={14} /> +91-11-24651950</p>
            </div>
            <div className="gov-footer-social">
              <a href="https://twitter.com/moaboratory" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="gov-social-icon">X</a>
              <a href="https://facebook.com/moaboratory" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="gov-social-icon">fb</a>
              <a href="https://youtube.com/@ministryofayush" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="gov-social-icon">yt</a>
              <a href="https://instagram.com/ministryofayush" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="gov-social-icon">ig</a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="gov-footer-bottom">
        <div className="gov-footer-container gov-footer-bottom-content">
          <div className="gov-footer-legal">
            <span>© 2026 Ministry of AYUSH, Government of India</span>
            <span className="gov-footer-separator">|</span>
            <Link to="/privacy">Privacy Policy</Link>
            <span className="gov-footer-separator">|</span>
            <Link to="/sources">Terms of Use</Link>
            <span className="gov-footer-separator">|</span>
            <span>Accessibility Statement</span>
          </div>
          <div className="gov-footer-credits">
            <span className="gov-footer-made">National Digital Health & IP Mission • India</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   NAVBAR WRAPPER (COMMON)
   ============================================================ */
function Navbar({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt, isLoggedIn, userName, onLogout }) {
  return (
    <header className="gov-portal-header-wrapper" role="banner">
      <GovtAccessibilityBar
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setPrefillPrompt={setPrefillPrompt}
      />
      <GovtNavbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        isLoggedIn={isLoggedIn}
        userName={userName}
        onLogout={onLogout}
      />
    </header>
  )
}

/* ============================================================
   INNOVATION ASSESSMENT CARD (HERO INTERACTIVE ENGINE)
   ============================================================ */
function InnovationAssessmentCard({ onStartAssessment }) {
  const navigate = useNavigate()
  const API_BASE = getApiBase()

  // Step state: 1 to 4
  const [currentStep, setCurrentStep] = useState(1)

  // Selected option IDs for each of the 4 steps
  const [selectedType, setSelectedType] = useState('formulation')
  const [selectedPathway, setSelectedPathway] = useState('patent_novel')
  const [selectedRegulation, setSelectedRegulation] = useState('ayush_proprietary')
  const [selectedSource, setSelectedSource] = useState('classical_texts')

  // Execution states: 'idle' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [loadingStepIndex, setLoadingStepIndex] = useState(0)

  // STEP 1: Innovation Options
  const step1Options = [
    {
      id: 'formulation',
      title: 'Ayurvedic formulation',
      desc: 'Polyherbal composition, standardized extract, or modified classical recipe',
      statute: 'Patents Act § 3(p) & TKDL Prior Art',
      badge: 'TKDL Check',
      route: 'Prior Art Screening + ASU Form 22 Licensing',
    },
    {
      id: 'process',
      title: 'New process / method',
      desc: 'Novel extraction technique, bio-enhancement, or modernized delivery method',
      statute: 'Patents Act § 3(e) & Technical Step',
      badge: 'Process Patent',
      route: 'Process Patentability + Biological Diversity Act Form 1',
    },
    {
      id: 'brand',
      title: 'Product or brand',
      desc: 'Proprietary finished formulation, brand identity, or distinctive packaging',
      statute: 'Trade Marks Act Class 5 & 30',
      badge: 'Trademark & Design',
      route: 'Distinctiveness Screening + Schedule T GMP Compliance',
    },
    {
      id: 'research',
      title: 'Research innovation',
      desc: 'Clinical trial data, active phytoconstituent isolation, or collaborative discovery',
      statute: 'Biological Diversity Act § 3, 4, 6',
      badge: 'ABS Clearance',
      route: 'NBA Prior Approval + TK Protection Clearance',
    }
  ]

  // STEP 2: IP Pathway Options
  const step2Options = [
    {
      id: 'patent_novel',
      title: 'Patent Protection (§ 2(1)(j))',
      desc: 'Novelty & non-obvious technical step with synergistic efficacy beyond mere admixture',
      statute: 'Patents Act 1970 § 2(1)(j), 3(e)',
      badge: 'Patent Route',
      route: 'Synergy Proof + Non-Obviousness Technical Validation',
    },
    {
      id: 'tkdl_clearance',
      title: 'TKDL Prior Art Defensive Clearance',
      desc: 'Defensive screening against 3.5L+ classical formulations to overcome Section 3(p)',
      statute: 'Patents Act § 3(p) & TKDL',
      badge: 'TKDL Screening',
      route: 'Classical Literature Prior Art Search & Clearance',
    },
    {
      id: 'trademark_brand',
      title: 'Trademark & Trade Dress (Class 5/30)',
      desc: 'Proprietary brand name registration avoiding generic Ayurvedic descriptor conflicts',
      statute: 'Trade Marks Act 1999 Class 5/30',
      badge: 'Brand Protection',
      route: 'Distinctiveness Screening & Packaging Registration',
    },
    {
      id: 'abs_clearance',
      title: 'Biological Diversity ABS Approval',
      desc: 'Mandatory statutory approval for Indian biological resources prior to IP filing',
      statute: 'Biological Diversity Act 2002 § 3, 4, 6',
      badge: 'NBA Clearance',
      route: 'NBA Form I / III Application & ABS Agreement',
    }
  ]

  // STEP 3: Regulation Options
  const step3Options = [
    {
      id: 'ayush_shastriya',
      title: 'AYUSH Classical License (Shastriya)',
      desc: 'Manufactured strictly per First Schedule authoritative Ayurvedic classical texts',
      statute: 'Drugs & Cosmetics Act Rule 158-B(1)',
      badge: 'ASU Rule 158-B(1)',
      route: 'State AYUSH Licensing Authority Shastriya Clearance',
    },
    {
      id: 'ayush_proprietary',
      title: 'AYUSH Proprietary License (Anubhavasiddha)',
      desc: 'Patent/Proprietary ASU medicine with pilot safety & efficacy documentation',
      statute: 'Drugs & Cosmetics Rules Rule 158-B(2)',
      badge: 'ASU Rule 158-B(2)',
      route: 'Safety & Efficacy Trial Dossier + State AYUSH License',
    },
    {
      id: 'ayurveda_aahar',
      title: 'FSSAI Ayurveda-Aahar Regime',
      desc: 'Health & wellness dietary supplement governed by Ayurveda Aahar Regulations 2022',
      statute: 'FSSAI Ayurveda Aahar Regulations 2022',
      badge: 'FSSAI Regime',
      route: 'Ayurveda Aahar Standards Compliance & Labelling Clearances',
    },
    {
      id: 'gmp_clinical',
      title: 'Schedule T GMP & Standardized Extract',
      desc: 'Good Manufacturing Practice with heavy metal, microbial & chromatographic profiling',
      statute: 'Drugs & Cosmetics Act Schedule T',
      badge: 'Schedule T GMP',
      route: 'Pharmacopoeial Quality Assurance & Monograph Compliance',
    }
  ]

  // STEP 4: Source Verification Options
  const step4Options = [
    {
      id: 'classical_texts',
      title: '1st Schedule Classical Text Source',
      desc: 'Formulations referenced in Charaka Samhita, Sushruta Samhita, or Sahasrayogam',
      statute: 'Drugs & Cosmetics Act 1st Schedule',
      badge: 'Classical Source',
      route: 'Cross-Reference TKDL Prior Art Citation Database',
    },
    {
      id: 'indigenous_bio',
      title: 'Indigenous Indian Biological Resource',
      desc: 'Botanicals and biological materials harvested or cultivated within India',
      statute: 'Biological Diversity Act 2002 § 3',
      badge: 'National Resource',
      route: 'Mandatory State Biodiversity Board / NBA Prior Approval',
    },
    {
      id: 'novel_extract',
      title: 'Novel Processed Extract / Synthetic Compound',
      desc: 'Enriched phytoconstituents, supercritical CO2 extracts, or novel drug delivery',
      statute: 'Patents Act § 3(e) Synergism',
      badge: 'Novel Extract',
      route: 'Comparative In-Vitro / In-Vivo Efficacy & Synergism Proof',
    },
    {
      id: 'authenticated_herbs',
      title: 'Pharmacopoeially Authenticated Botanicals',
      desc: 'Tested against Ayurvedic Pharmacopoeia of India (API) standards with HPTLC',
      statute: 'Ayurvedic Pharmacopoeia of India',
      badge: 'API Monograph',
      route: 'Raw Material Traceability & Certificate of Analysis (CoA)',
    }
  ]

  // Dynamic step configuration
  const currentStepConfig = currentStep === 1
    ? { title: 'What are you developing?', hint: 'Step 1 of 4: Select your innovation type', options: step1Options, selected: selectedType, setSelect: setSelectedType }
    : currentStep === 2
      ? { title: 'Target IP Protection Pathway', hint: 'Step 2 of 4: Select primary IP objective', options: step2Options, selected: selectedPathway, setSelect: setSelectedPathway }
      : currentStep === 3
        ? { title: 'Regulatory & Licensing Regime', hint: 'Step 3 of 4: Select applicable regulatory standard', options: step3Options, selected: selectedRegulation, setSelect: setSelectedRegulation }
        : { title: 'Source Verification & Biological Origin', hint: 'Step 4 of 4: Select biological & traditional knowledge provenance', options: step4Options, selected: selectedSource, setSelect: setSelectedSource }

  const activeOption = currentStepConfig.options.find(o => o.id === currentStepConfig.selected) || currentStepConfig.options[0]

  // Dynamic retrieval progress messages for RagVyn AI RAG pipeline
  const loadingMessages = [
    'Compiling 4-step diagnostic parameters...',
    'Querying Patents Act, Biodiversity Act & TKDL corpora...',
    'Evaluating Section 3(p) prior art and Section 3(e) synergism...',
    'Synthesizing grounded RagVyn AI statutory guidance...'
  ]

  useEffect(() => {
    if (status !== 'loading') return
    const timer = setInterval(() => {
      setLoadingStepIndex(prev => (prev + 1) % loadingMessages.length)
    }, 1600)
    return () => clearInterval(timer)
  }, [status, loadingMessages.length])

  // Submit collected 4-step data to RagVyn AI existing API
  const handleSubmitAssessment = async () => {
    setStatus('loading')
    setErrorMsg('')
    setLoadingStepIndex(0)

    const opt1 = step1Options.find(o => o.id === selectedType) || step1Options[0]
    const opt2 = step2Options.find(o => o.id === selectedPathway) || step2Options[0]
    const opt3 = step3Options.find(o => o.id === selectedRegulation) || step3Options[0]
    const opt4 = step4Options.find(o => o.id === selectedSource) || step4Options[0]

    const structuredContext = {
      innovation_type: opt1.title,
      formulation_details: opt1.desc,
      ip_pathway: opt2.title + ' (' + opt2.statute + ')',
      regulatory_regime: opt3.title + ' (' + opt3.statute + ')',
      source_verification: opt4.title + ' (' + opt4.desc + ')',
    }

    const contextualQuestion = `The user completed an IP/regulatory assessment with the following information:
- Innovation Type: ${opt1.title} (${opt1.desc})
- Targeted IP Pathway: ${opt2.title} (${opt2.statute})
- Regulatory Regime: ${opt3.title} (${opt3.statute})
- Source Verification & TK Status: ${opt4.title} (${opt4.desc})

Based on this information, provide comprehensive statutory-grounded IP and regulatory guidance using the verified Indian and international knowledge corpus. Assess patentability under Patents Act 1970 (specifically analyzing Section 3(p) traditional knowledge bar and Section 3(e) synergistic efficacy requirement), Traditional Knowledge Digital Library (TKDL) prior art implications, Biological Diversity Act 2002 Access and Benefit Sharing (ABS) compliance, and required licensing under Drugs & Cosmetics Rules.`

    const payload = {
      question: contextualQuestion,
      jurisdiction: 'India',
      language: 'EN',
      product_description: opt1.desc,
      formulation_type: opt1.title,
      context: structuredContext,
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`)
      const data = await res.json()

      const confidenceData = data.confidence && typeof data.confidence === 'object'
        ? data.confidence
        : { score: 78, label: 'High', reason: 'Diagnostic grounded in retrieved Patents Act & TKDL statutory corpus.' }

      setResult({
        answer: data.answer,
        citations: data.citations || [],
        confidence: confidenceData,
        disclaimer: data.disclaimer,
        conversation_id: data.conversation_id,
        contextualQuestion,
        structuredContext,
      })
      setStatus('success')

      if (onStartAssessment) {
        onStartAssessment(contextualQuestion)
      }
    } catch (err) {
      console.error('[Assessment] RagVyn RAG execution failed:', err)
      setErrorMsg('RagVyn AI was unable to complete the statutory diagnostic at this moment. Please check that the backend server is running and try again.')
      setStatus('error')
    }
  }

  // Navigate to full RagVyn AI consultation with this completed session pre-loaded
  const handleContinueInRagVyn = () => {
    if (!result) return
    navigate('/chat', {
      state: {
        assessmentResult: {
          prompt: result.contextualQuestion,
          result: result,
        }
      }
    })
  }

  // Reset diagnostic to retake
  const handleRetake = () => {
    setStatus('idle')
    setResult(null)
    setCurrentStep(1)
  }

  return (
    <div className="hero-assessment-card" role="region" aria-label="Interactive Innovation Assessment Tool">
      {/* Card Header */}
      <div className="assessment-card-header">
        <div className="assessment-card-title-group">
          <span className="card-kicker-tag">INTERACTIVE DIAGNOSTIC</span>
          <h2 className="assessment-card-heading">Is Your Innovation IP-Ready?</h2>
        </div>
        <div className="assessment-progress-pill" aria-label={`Step ${currentStep} of 4`}>
          <span className="progress-num-active">
            {status === 'success' ? 'READY' : status === 'loading' ? 'WAIT' : `0${currentStep}`}
          </span>
          {status !== 'success' && status !== 'loading' && (
            <>
              <span className="progress-num-divider">/</span>
              <span className="progress-num-total">04</span>
            </>
          )}
        </div>
      </div>

      {/* Progress Stepper (Interactive 4-Step Pipeline) */}
      <div className="assessment-pipeline-steps" aria-label="Assessment Progress Steps">
        {[
          { num: 1, label: 'Innovation' },
          { num: 2, label: 'IP pathway' },
          { num: 3, label: 'Regulation' },
          { num: 4, label: 'Source verification' },
        ].map((st, idx, arr) => {
          const isCompleted = status === 'success' || currentStep > st.num
          const isActive = status !== 'success' && currentStep === st.num
          return (
            <div key={st.num} style={{ display: 'contents' }}>
              <div
                className={`pipeline-step ${isActive ? 'step-active' : ''} ${isCompleted ? 'step-completed clickable' : ''}`}
                onClick={() => {
                  if (status !== 'loading') {
                    if (status === 'success' || isCompleted) {
                      setStatus('idle')
                      setCurrentStep(st.num)
                    }
                  }
                }}
                title={isCompleted ? `Jump to Step ${st.num}: ${st.label}` : undefined}
                role="button"
                tabIndex={isCompleted ? 0 : -1}
                aria-label={`Step ${st.num}: ${st.label}`}
              >
                <span className="step-bullet">{isCompleted && !isActive ? '✓' : st.num}</span>
                <span className="step-label">{st.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div className={`pipeline-connector ${currentStep > st.num + 1 || (status === 'success' && currentStep > st.num) ? 'active completed' : currentStep > st.num ? 'active' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── STATE 1: LOADING (RAG Retrieval in progress) ── */}
      {status === 'loading' && (
        <div className="assessment-loading-box">
          <div className="assessment-spinner" aria-hidden="true" />
          <div className="assessment-loading-title">RagVyn AI Diagnostic in Progress</div>
          <div className="assessment-loading-status">{loadingMessages[loadingStepIndex]}</div>
          <div className="assessment-loading-subtext">
            Evaluating Section 3(p) traditional knowledge exclusions, Section 3(e) synergistic efficacy, TKDL prior art, and Biological Diversity Act ABS clearance.
          </div>
        </div>
      )}

      {/* ── STATE 2: ERROR ── */}
      {status === 'error' && (
        <>
          <div className="assessment-error-box">
            <div className="assessment-error-header">
              <IconAlertTriangle size={18} />
              <span>Diagnostic Engine Notice</span>
            </div>
            <div className="assessment-error-text">
              {errorMsg}
            </div>
          </div>
          <div className="assessment-card-actions">
            <div className="assessment-nav-row">
              <button
                type="button"
                className="assessment-back-btn"
                onClick={() => setStatus('idle')}
              >
                <span>Review Answers</span>
              </button>
              <button
                type="button"
                className="assessment-action-btn"
                onClick={handleSubmitAssessment}
              >
                <IconRotate size={16} />
                <span>Retry Diagnostic</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── STATE 3: SUCCESS (Grounded RagVyn AI Response) ── */}
      {status === 'success' && result && (
        <div className="assessment-result-view">
          {/* Summary chips of user's 4-step assessment */}
          <div className="assessment-result-summary">
            <span className="assessment-summary-chip">
              <span className="assessment-chip-key">Innovation:</span>
              <span>{step1Options.find(o => o.id === selectedType)?.title}</span>
            </span>
            <span className="assessment-summary-chip">
              <span className="assessment-chip-key">IP:</span>
              <span>{step2Options.find(o => o.id === selectedPathway)?.badge}</span>
            </span>
            <span className="assessment-summary-chip">
              <span className="assessment-chip-key">Reg:</span>
              <span>{step3Options.find(o => o.id === selectedRegulation)?.badge}</span>
            </span>
            <span className="assessment-summary-chip">
              <span className="assessment-chip-key">Source:</span>
              <span>{step4Options.find(o => o.id === selectedSource)?.badge}</span>
            </span>
          </div>

          {/* Scrollable grounded assessment output */}
          <div className="assessment-result-scroll">
            <div className="assessment-answer-card">
              <JargonText text={result.answer} />
            </div>

            {result.citations && result.citations.length > 0 && (
              <CollapsibleCitations citations={result.citations} />
            )}

            {result.confidence && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <ConfidenceBadge level={result.confidence} />
                <ConfidenceMeter level={result.confidence} />
              </div>
            )}

            <DisclaimerBanner />
          </div>

          {/* Action buttons */}
          <div className="assessment-card-actions">
            <div className="assessment-nav-row">
              <button
                type="button"
                className="assessment-back-btn"
                onClick={handleRetake}
                title="Retake diagnostic with new parameters"
              >
                <IconRotate size={15} />
                <span>Retake</span>
              </button>
              <button
                type="button"
                className="assessment-action-btn"
                onClick={handleContinueInRagVyn}
                id="continue-in-ragvyn-btn"
              >
                <span>Continue in RagVyn AI</span>
                <IconArrowRight size={16} />
              </button>
            </div>
            <div className="assessment-card-footnote">
              <span>Source-backed legal intelligence • Zero hallucination protocol</span>
            </div>
          </div>
        </div>
      )}

      {/* ── STATE 4: IDLE (Interactive Questions for Step 1 - 4) ── */}
      {status === 'idle' && (
        <>
          {/* Question Bar */}
          <div className="assessment-question-bar">
            <span className="assessment-q-label">{currentStepConfig.title}</span>
            <span className="assessment-q-hint">{currentStepConfig.hint}</span>
          </div>

          {/* 4 Interactive Selectable Options for Active Step */}
          <div className="assessment-options-list" role="radiogroup" aria-label={currentStepConfig.title}>
            {currentStepConfig.options.map((opt) => {
              const isSelected = currentStepConfig.selected === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`assessment-option-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => currentStepConfig.setSelect(opt.id)}
                >
                  <div className="option-radio-ring" aria-hidden="true">
                    {isSelected && <div className="option-radio-dot" />}
                  </div>
                  <div className="option-text-group">
                    <div className="option-header-row">
                      <span className="option-title">{opt.title}</span>
                      <span className="option-statute-badge">{opt.badge}</span>
                    </div>
                    <span className="option-desc">{opt.desc}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Dynamic Statutory Determination Preview */}
          <div className="assessment-dynamic-preview">
            <div className="preview-indicator-bar">
              <span className="live-engine-pulse" />
              <span className="preview-engine-label">STATUTORY ROUTING PREVIEW</span>
              <span className="preview-source-tag">OFFICIAL ACTS</span>
            </div>
            <div className="preview-grid">
              <div className="preview-item">
                <span className="preview-item-label">Applicable Framework:</span>
                <span className="preview-item-val">{activeOption.statute}</span>
              </div>
              <div className="preview-item">
                <span className="preview-item-label">Recommended Pathway:</span>
                <span className="preview-item-val">{activeOption.route}</span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="assessment-card-actions">
            {currentStep === 1 && (
              <button
                type="button"
                className="assessment-action-btn"
                onClick={() => setCurrentStep(2)}
                id="step-1-next-btn"
              >
                <span>Next: IP Pathway</span>
                <IconArrowRight size={16} />
              </button>
            )}

            {currentStep === 2 && (
              <div className="assessment-nav-row">
                <button
                  type="button"
                  className="assessment-back-btn"
                  onClick={() => setCurrentStep(1)}
                >
                  <span>← Back</span>
                </button>
                <button
                  type="button"
                  className="assessment-action-btn"
                  onClick={() => setCurrentStep(3)}
                  id="step-2-next-btn"
                >
                  <span>Next: Regulation</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="assessment-nav-row">
                <button
                  type="button"
                  className="assessment-back-btn"
                  onClick={() => setCurrentStep(2)}
                >
                  <span>← Back</span>
                </button>
                <button
                  type="button"
                  className="assessment-action-btn"
                  onClick={() => setCurrentStep(4)}
                  id="step-3-next-btn"
                >
                  <span>Next: Source Verification</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            )}

            {currentStep === 4 && (
              <div className="assessment-nav-row">
                <button
                  type="button"
                  className="assessment-back-btn"
                  onClick={() => setCurrentStep(3)}
                >
                  <span>← Back</span>
                </button>
                <button
                  type="button"
                  className="assessment-action-btn"
                  onClick={handleSubmitAssessment}
                  id="submit-assessment-btn"
                >
                  <IconSparkles size={16} />
                  <span>Assess with RagVyn AI</span>
                </button>
              </div>
            )}

            <div className="assessment-card-footnote">
              <span>Source-backed legal intelligence • Zero hallucination protocol</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ============================================================
   HERO TYPEWRITER TITLE COMPONENT
   ============================================================ */
function HeroTypewriterTitle({ line1Text, line2Text, trigger }) {
  const [displayedLine1, setDisplayedLine1] = useState('')
  const [displayedLine2, setDisplayedLine2] = useState('')
  const [activeLine, setActiveLine] = useState(1) // 1 = typing line 1, 2 = typing line 2, 0 = complete

  useEffect(() => {
    let isCancelled = false
    setDisplayedLine1('')
    setDisplayedLine2('')
    setActiveLine(1)

    const target1 = line1Text || 'Protect your innovation.'
    const target2 = line2Text || 'Know what comes next.'

    let idx1 = 0
    let idx2 = 0

    // Step 1: Smoothly type Line 1
    const timer1 = setInterval(() => {
      if (isCancelled) return
      idx1++
      setDisplayedLine1(target1.slice(0, idx1))
      if (idx1 >= target1.length) {
        clearInterval(timer1)
        setActiveLine(2)
        // Brief natural pause before typing Line 2
        setTimeout(() => {
          if (isCancelled) return
          // Step 2: Smoothly type Line 2
          const timer2 = setInterval(() => {
            if (isCancelled) return
            idx2++
            setDisplayedLine2(target2.slice(0, idx2))
            if (idx2 >= target2.length) {
              clearInterval(timer2)
              setActiveLine(0) // Finished typing
            }
          }, 30)
        }, 180)
      }
    }, 30)

    return () => {
      isCancelled = true
      clearInterval(timer1)
    }
  }, [trigger, line1Text, line2Text])

  return (
    <h1 className="hero-title" id="hero-title">
      <span className="hero-title-line-1">
        {displayedLine1 || '\u00A0'}
        {activeLine === 1 && <span className="hero-type-cursor" aria-hidden="true">|</span>}
      </span>
      <span className="hero-title-highlight hero-title-line-2">
        {displayedLine2 || '\u00A0'}
        {activeLine === 2 && <span className="hero-type-cursor" aria-hidden="true">|</span>}
      </span>
    </h1>
  )
}

/* ============================================================
   LANDING PAGE
   ============================================================ */
function LandingPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt, isLoggedIn, userName, onLogout }) {
  const { t } = useLanguage()
  const location = useLocation()
  const heroRef = useRef(null)
  const [animTrigger, setAnimTrigger] = useState(1)
  const wasOutOfViewRef = useRef(false)

  // Re-trigger animation when navigating to Home view from any other page/route
  useEffect(() => {
    if (location.pathname === '/') {
      setAnimTrigger(prev => prev + 1)
    }
  }, [location.pathname, location.key])

  // Re-trigger animation when user scrolls down and comes back/up into the hero view
  useEffect(() => {
    const el = heroRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (wasOutOfViewRef.current) {
            wasOutOfViewRef.current = false
            setAnimTrigger(prev => prev + 1)
          }
        } else {
          // User scrolled down past hero
          wasOutOfViewRef.current = true
        }
      },
      { threshold: 0.25 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Re-trigger animation when Home link / brand is clicked
  useEffect(() => {
    const handleReTrigger = () => setAnimTrigger(prev => prev + 1)
    window.addEventListener('retrigger-hero-anim', handleReTrigger)
    return () => window.removeEventListener('retrigger-hero-anim', handleReTrigger)
  }, [])

  // Smooth scroll to target section if requested via navigation state or hash (e.g. "See Demo")
  useEffect(() => {
    const targetId = location.state?.scrollTo || (location.hash ? location.hash.replace('#', '') : null)
    if (targetId) {
      const el = document.getElementById(targetId)
      if (el) {
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 120)
        return () => clearTimeout(timer)
      }
    }
  }, [location.pathname, location.state, location.hash])

  return (
    <div className="landing">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setPrefillPrompt={setPrefillPrompt}
        isLoggedIn={isLoggedIn}
        userName={userName}
        onLogout={onLogout}
      />

      {/* Hero Section - Two Column Split Composition */}
      <section className="hero-section" id="hero" ref={heroRef} aria-labelledby="hero-title">
        <div className="hero-container">
          <div className="hero-grid">
            {/* Left Column: Narrative, Statues & CTAs */}
            <div className="hero-content-col">
              <HeroTypewriterTitle
                line1Text={t('heroTitle')}
                line2Text={t('heroSubtitle')}
                trigger={animTrigger}
              />

              <p className="hero-description">
                {t('heroDesc')}
              </p>

              <div className="hero-cta-group">
                <Link to="/chat" className="btn-primary hero-btn-main" id="hero-start-btn">
                  <span>{t('startAssessment')}</span>
                  <IconArrowRight size={16} />
                </Link>
                <a href="#how-it-works" className="btn-secondary hero-btn-sub">
                  <span>{t('howItWorksBtn')}</span>
                </a>
              </div>

              {/* Verified Statutory Trust Badges */}
              <div className="hero-trust-indicators">
                <div className="hero-trust-item">
                  <div className="trust-icon-box"><IconScales size={15} /></div>
                  <div className="trust-text-box">
                    <strong>{t('trustPatentsAct')}</strong>
                    <span>{t('trustPatentsActDesc')}</span>
                  </div>
                </div>
                <div className="hero-trust-item">
                  <div className="trust-icon-box"><IconBook size={15} /></div>
                  <div className="trust-text-box">
                    <strong>{t('trustTkdl')}</strong>
                    <span>{t('trustTkdlDesc')}</span>
                  </div>
                </div>
                <div className="hero-trust-item">
                  <div className="trust-icon-box"><IconLeaf size={15} /></div>
                  <div className="trust-text-box">
                    <strong>{t('trustBdAct')}</strong>
                    <span>{t('trustBdActDesc')}</span>
                  </div>
                </div>
                <div className="hero-trust-item">
                  <div className="trust-icon-box"><IconShieldCheck size={15} /></div>
                  <div className="trust-text-box">
                    <strong>{t('trustDrugsRules')}</strong>
                    <span>{t('trustDrugsRulesDesc')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Innovation Assessment Card */}
            <div className="hero-card-col">
              <InnovationAssessmentCard
                onStartAssessment={(prompt) => {
                  if (setPrefillPrompt) setPrefillPrompt(prompt)
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Counter */}
      <StatsCounter />

      {/* Live Demo Preview */}
      <DemoPreview />

      {/* Features Grid */}
      <section className="section" id="features" aria-labelledby="features-title">
        <Reveal>
          <p className="section-label">{t('featuresLabel')}</p>
          <h2 className="section-title" id="features-title">{t('featuresTitle')}</h2>
        </Reveal>
        <div className="features-grid">
          {[
            {
              icon: <IconScroll size={24} />,
              titleKey: 'featureStatuteCited',
              descKey: 'featureStatuteCitedDesc',
            },
            {
              icon: <IconFlask size={24} />,
              titleKey: 'featureFormulationWizard',
              descKey: 'featureFormulationWizardDesc',
            },
            {
              icon: <IconGlobe size={24} />,
              titleKey: 'featureMultilingual',
              descKey: 'featureMultilingualDesc',
            },
            {
              icon: <IconScales size={24} />,
              titleKey: 'featureJurisdiction',
              descKey: 'featureJurisdictionDesc',
            },
            {
              icon: <IconLeaf size={24} />,
              titleKey: 'featureABS',
              descKey: 'featureABSDesc',
            },
            {
              icon: <IconLock size={24} />,
              titleKey: 'featureTKDL',
              descKey: 'featureTKDLDesc',
            },
          ].map((f, i) => (
            <Reveal key={f.titleKey} delay={i * 80}>
              <article className="feature-card">
                <div className="feature-icon" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.icon}</div>
                <h3>{t(f.titleKey)}</h3>
                <p>{t(f.descKey)}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Personas Section */}
      <PersonasSection />

      {/* How It Works */}
      <section className="section" id="how-it-works" aria-labelledby="how-title">
        <Reveal>
          <p className="section-label">{t('howItWorksLabel')}</p>
          <h2 className="section-title" id="how-title">{t('howItWorksTitle')}</h2>
        </Reveal>
        <div className="steps-grid">
          {[
            { n: '01', titleKey: 'step1Title', descKey: 'step1Desc' },
            { n: '02', titleKey: 'step2Title', descKey: 'step2Desc' },
            { n: '03', titleKey: 'step3Title', descKey: 'step3Desc' },
            { n: '04', titleKey: 'step4Title', descKey: 'step4Desc' },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="step-card">
                <div className="step-number" aria-hidden="true">{s.n}</div>
                <h3>{t(s.titleKey)}</h3>
                <p>{t(s.descKey)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comparison Section */}
      <ComparisonSection />

      {/* Statute Showcase */}
      <StatuteShowcase />

      {/* FAQ Section */}
      <FAQSection />

      {/* Footer */}
      <TranslatedFooter />
    </div>
  )
}

/* ============================================================
   PDF EXPORT FUNCTION
   ============================================================ */
function handleExportPdf(messages, t, jurisdiction) {
  // Create PDF content as HTML
  const aiMessages = messages.filter(m => m.role === 'ai')
  const userMessages = messages.filter(m => m.role === 'user')

  const currentDate = new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const pdfContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${t('ipAssessmentReport')} - IP-SAKTI Sahayak</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          line-height: 1.6; 
          color: #1e293b;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { 
          text-align: center; 
          border-bottom: 3px solid #1D4ED8; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
        }
        .logo { font-size: 24px; font-weight: bold; color: #1D4ED8; }
        .logo-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
        .title { font-size: 22px; color: #0f172a; margin: 20px 0 10px; }
        .meta { font-size: 12px; color: #64748b; }
        .section { margin: 25px 0; }
        .section-title { 
          font-size: 14px; 
          font-weight: 600; 
          color: #1D4ED8; 
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .qa-item { margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; }
        .question { font-weight: 600; color: #0f172a; margin-bottom: 10px; }
        .question::before { content: "Q: "; color: #1D4ED8; }
        .answer { color: #334155; }
        .answer::before { content: "A: "; color: #10B981; font-weight: 600; }
        .citations { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; }
        .citation { font-size: 11px; color: #1D4ED8; display: block; margin: 4px 0; }
        .confidence { 
          display: inline-block; 
          padding: 2px 8px; 
          border-radius: 12px; 
          font-size: 10px; 
          font-weight: 600;
          margin-top: 8px;
        }
        .confidence.high { background: #dcfce7; color: #166534; }
        .confidence.medium { background: #fef3c7; color: #92400e; }
        .confidence.low { background: #fee2e2; color: #991b1b; }
        .disclaimer { 
          margin-top: 40px; 
          padding: 20px; 
          background: #fef3c7; 
          border-left: 4px solid #f59e0b;
          border-radius: 4px;
        }
        .disclaimer-title { font-weight: 600; color: #92400e; margin-bottom: 8px; }
        .disclaimer-text { font-size: 12px; color: #78350f; }
        .footer { 
          margin-top: 40px; 
          text-align: center; 
          font-size: 11px; 
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }
        @media print {
          body { padding: 20px; }
          .qa-item { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">IP-SAKTI Sahayak</div>
        <div class="logo-sub">Ministry of AYUSH • Government of India</div>
        <h1 class="title">${t('ipAssessmentReport')}</h1>
        <div class="meta">
          ${t('generatedBy')} | ${currentDate} | Jurisdiction: ${jurisdiction === 'india' ? 'India' : 'International'}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">${t('consultationSummary')}</h2>
        ${userMessages.map((um, i) => {
    const aiReply = aiMessages[i]
    return `
            <div class="qa-item">
              <div class="question">${um.text}</div>
              ${aiReply ? `
                <div class="answer">${aiReply.text}</div>
                ${aiReply.citations ? `
                  <div class="citations">
                    ${aiReply.citations.map(c => `<span class="citation">${c.title}</span>`).join('')}
                  </div>
                ` : ''}
                ${aiReply.confidence ? `
                  <span class="confidence ${aiReply.confidence}">${aiReply.confidence.toUpperCase()} CONFIDENCE</span>
                ` : ''}
              ` : ''}
            </div>
          `
  }).join('')}
      </div>

      <div class="disclaimer">
        <div class="disclaimer-title">${t('legalDisclaimer')}</div>
        <div class="disclaimer-text">${t('disclaimerText')}</div>
      </div>

      <div class="footer">
        <p>IP-SAKTI Sahayak • Smart Ayurveda Knowledge & Technology Initiative</p>
        <p>© 2026 Ministry of AYUSH, Government of India</p>
      </div>
    </body>
    </html>
  `

  // Open print dialog
  const printWindow = window.open('', '_blank')
  printWindow.document.write(pdfContent)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.print()
  }
}

/* ============================================================
   VOICE INPUT HOOK (Web Speech API) - Multi-Language Support
   Supports: English, Hindi, Marathi, Gujarati, Tamil, Telugu, 
   Kannada, Malayalam, Bengali, Punjabi, Odia, Assamese, Urdu
   ============================================================ */
const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English', flag: 'EN' },
  { code: 'hi-IN', label: 'हिन्दी', flag: 'HI' },
  { code: 'mr-IN', label: 'मराठी', flag: 'MR' },
  { code: 'gu-IN', label: 'ગુજરાતી', flag: 'GU' },
  { code: 'ta-IN', label: 'தமிழ்', flag: 'TA' },
  { code: 'te-IN', label: 'తెలుగు', flag: 'TE' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', flag: 'KN' },
  { code: 'ml-IN', label: 'മലയാളം', flag: 'ML' },
  { code: 'bn-IN', label: 'বাংলা', flag: 'BN' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', flag: 'PA' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ', flag: 'OR' },
  { code: 'as-IN', label: 'অসমীয়া', flag: 'AS' },
  { code: 'ur-IN', label: 'اردو', flag: 'UR' },
]

function useVoiceInput(onResult, lang = 'hi-IN') {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState(null)
  const [confidence, setConfidence] = useState(null) // Track recognition confidence
  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)
  const shouldRestartRef = useRef(false)

  // Check support once
  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // Keep callback ref updated
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  // Initialize recognition when lang changes (or on mount)
  useEffect(() => {
    if (!isSupported) {
      console.log('[Speech] Speech recognition not supported in this browser')
      return
    }

    // Cleanup old instance
    if (recognitionRef.current) {
      shouldRestartRef.current = false
      try {
        recognitionRef.current.abort()
      } catch (e) {
        console.log('[Speech] Cleanup abort error (safe to ignore):', e.message)
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    // Configuration optimized for better Hindi recognition accuracy
    recognition.continuous = false  // Single-shot mode for better accuracy
    recognition.interimResults = true  // Show partial results
    recognition.maxAlternatives = 1  // Single best result for better accuracy
    recognition.lang = lang

    console.log('[Speech] Recognition initialized with lang:', lang, '(single-shot mode for accuracy)')

    recognition.onstart = () => {
      console.log('[Speech] Started listening - Lang:', lang)
      setIsListening(true)
      setError(null)
      setInterimText('')
      setConfidence(null)
    }

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      let lastConfidence = null

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        // Get the best alternative (first one has highest confidence)
        const transcript = result[0].transcript
        const resultConfidence = result[0].confidence

        console.log('[Speech] Result:', transcript, 'Confidence:', resultConfidence, 'isFinal:', result.isFinal)

        if (result.isFinal) {
          finalTranscript += transcript + ' '
          lastConfidence = resultConfidence
          console.log('[Speech] Final result:', transcript, '| Confidence:', (resultConfidence * 100).toFixed(1) + '%')
        } else {
          interimTranscript += transcript
        }
      }

      // Update confidence for UI display
      if (lastConfidence !== null) {
        setConfidence(lastConfidence)
      }

      // Show interim results
      if (interimTranscript) {
        setInterimText(interimTranscript)
      }

      // Send final results and clear interim
      if (finalTranscript.trim()) {
        setInterimText('') // Clear interim when final comes
        onResultRef.current(finalTranscript.trim())
      }
    }

    recognition.onerror = (event) => {
      console.error('[Speech] Speech recognition error:', event.error)

      // Handle specific errors
      switch (event.error) {
        case 'not-allowed':
          setError('माइक्रोफ़ोन की अनुमति दें / Please allow microphone access')
          shouldRestartRef.current = false
          setIsListening(false)
          break
        case 'no-speech':
          // Don't stop - just keep listening
          console.log('[Speech] No speech detected, continuing...')
          break
        case 'audio-capture':
          setError('माइक्रोफ़ोन नहीं मिला / No microphone found')
          shouldRestartRef.current = false
          setIsListening(false)
          break
        case 'network':
          setError('नेटवर्क त्रुटि / Network error')
          break
        case 'aborted':
          // User or code aborted - don't show error
          break
        default:
          setError(`त्रुटि / Error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      console.log('[Speech] Recognition ended, shouldRestart:', shouldRestartRef.current)

      // Auto-restart if user wants to keep listening
      if (shouldRestartRef.current) {
        setTimeout(() => {
          try {
            console.log('[Speech] Auto-restarting...')
            recognitionRef.current?.start()
          } catch (e) {
            console.log('[Speech] Restart failed:', e.message)
            // If restart fails, stop listening
            shouldRestartRef.current = false
            setIsListening(false)
          }
        }, 100)
      } else {
        setIsListening(false)
        setInterimText('')
      }
    }

    recognitionRef.current = recognition

    // Cleanup on unmount or lang change
    return () => {
      shouldRestartRef.current = false
      try {
        recognitionRef.current?.abort()
      } catch (e) {
        console.log('[Speech] Cleanup error (safe to ignore):', e.message)
      }
    }
  }, [isSupported, lang])

  const startListening = useCallback(() => {
    console.log('[Speech] startListening called')
    setError(null)
    shouldRestartRef.current = true

    try {
      recognitionRef.current?.start()
      console.log('[Speech] start() called successfully')
    } catch (e) {
      console.log('[Speech] start() error:', e.message)
      if (e.name !== 'InvalidStateError') {
        setError('वॉइस शुरू नहीं हो सका / Failed to start voice')
      }
      // InvalidStateError means already started - that's ok
    }
  }, [])

  const stopListening = useCallback(() => {
    console.log('[Speech] stopListening called')
    shouldRestartRef.current = false

    try {
      recognitionRef.current?.stop()
    } catch (e) {
      console.log('[Speech] stop() error (safe to ignore):', e.message)
    }

    setIsListening(false)
    setInterimText('')
  }, [])

  return {
    isListening,
    isSupported,
    interimText,
    error,
    confidence, // Expose confidence for UI display
    startListening,
    stopListening
  }
}

/* ============================================================
   VOICE INPUT LANGUAGE SELECTOR COMPONENT
   ============================================================ */
function VoiceLanguageSelector({ value, onChange, isListening }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLang = VOICE_LANGUAGES.find(l => l.code === value) || VOICE_LANGUAGES[0]

  return (
    <div className="voice-lang-selector" ref={dropdownRef}>
      <button
        type="button"
        className="voice-lang-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isListening}
        aria-label="Select voice input language"
        title="Voice language"
      >
        <span className="voice-lang-current">{currentLang.label.slice(0, 3)}</span>
        <span className="voice-lang-arrow" style={{ display: 'inline-flex', alignItems: 'center' }}><IconChevronDown size={12} /></span>
      </button>

      {isOpen && (
        <div className="voice-lang-dropdown">
          <div className="voice-lang-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconMic size={14} /> Voice Language</div>
          {VOICE_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              type="button"
              className={`voice-lang-option ${value === lang.code ? 'active' : ''}`}
              onClick={() => {
                onChange(lang.code)
                setIsOpen(false)
              }}
            >
              <span>[{lang.flag}]</span>
              <span>{lang.label}</span>
              {value === lang.code && <span className="voice-lang-check" style={{ display: 'inline-flex', alignItems: 'center' }}><IconCheck size={14} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   CHAT PAGE
   ============================================================ */
function ChatPage({ onOpenAbout, onOpenWizard, prefillPrompt, setPrefillPrompt, theme, toggleTheme, fontSize, setFontSize }) {
  const { t, lang, setLang, languages } = useLanguage()
  const location = useLocation()
  const API_BASE = getApiBase()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [jurisdiction, setJurisdiction] = useState('india')
  const [typing, setTyping] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  })
  const [activeSessionId, setActiveSessionId] = useState(null)

  // Sources panel state
  const [sourcesPanelOpen, setSourcesPanelOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth > 768 : true
  })
  const [highlightedSourceId, setHighlightedSourceId] = useState(null)

  // Persisted conversation state
  const [conversationId, setConversationId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  
  // File attachment state
  const [attachedFile, setAttachedFile] = useState(null)

  // New state for scroll management
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const chatBodyRef = useRef(null)
  const textareaRef = useRef(null)

  // Character count limit
  const MAX_CHARS = 2000

  // RagVyn Visual Theme State
  const [chatThemeId, setChatThemeId] = useState(() => {
    const saved = localStorage.getItem('ragvyn_chat_theme')
    return saved || DEFAULT_THEME_ID
  })
  const [showThemePicker, setShowThemePicker] = useState(false)
  const themePickerRef = useRef(null)

  // Resizable Sidebar State (desktop bounds 220px - 500px)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('ragvyn_sidebar_width')
    const num = parseInt(saved, 10)
    return (!isNaN(num) && num >= 220 && num <= 480) ? num : 260
  })
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)

  // Close theme picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target)) {
        setShowThemePicker(false)
      }
    }
    if (showThemePicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showThemePicker])

  const handleSelectTheme = (id) => {
    setChatThemeId(id)
    localStorage.setItem('ragvyn_chat_theme', id)
    setShowThemePicker(false)
  }

  // Sidebar drag-to-resize handler
  const handleStartResize = (e) => {
    e.preventDefault()
    setIsResizingSidebar(true)
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX
      const minW = 220
      const maxW = Math.min(500, Math.floor(window.innerWidth * 0.45))
      const newW = Math.max(minW, Math.min(maxW, startWidth + delta))
      setSidebarWidth(newW)
    }

    const onMouseUp = (upEvent) => {
      setIsResizingSidebar(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const delta = upEvent.clientX - startX
      const minW = 220
      const maxW = Math.min(500, Math.floor(window.innerWidth * 0.45))
      const finalW = Math.max(minW, Math.min(maxW, startWidth + delta))
      localStorage.setItem('ragvyn_sidebar_width', finalW)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const currentChatTheme = useMemo(() => getChatTheme(chatThemeId), [chatThemeId])
  const themeCSSVariables = useMemo(() => getThemeCSSVariables(currentChatTheme), [currentChatTheme])

  // Voice Input - auto-sync with UI language
  // Map UI lang code to Speech Recognition lang code
  const UI_TO_VOICE_LANG = {
    'en': 'en-IN',
    'hi': 'hi-IN',
    'kn': 'kn-IN',
    'bn': 'bn-IN',
    'ta': 'ta-IN',
    'te': 'te-IN',
    'mr': 'mr-IN',
    'gu': 'gu-IN',
    'ml': 'ml-IN',
    'pa': 'pa-IN',
  }
  const [voiceLang, setVoiceLang] = useState(() => UI_TO_VOICE_LANG[lang] || 'hi-IN')

  // Auto-sync voice language when UI language changes
  useEffect(() => {
    const newVoiceLang = UI_TO_VOICE_LANG[lang] || 'en-IN'
    setVoiceLang(newVoiceLang)
    console.log('[Lang Sync] UI lang changed to:', lang, '→ Voice lang:', newVoiceLang)
  }, [lang])

  const handleVoiceResult = useCallback((transcript) => {
    setInput(prev => prev ? prev + ' ' + transcript : transcript)
  }, [])

  const { isListening, isSupported: voiceSupported, interimText, error: voiceError, confidence: voiceConfidence, startListening, stopListening } = useVoiceInput(handleVoiceResult, voiceLang)

  // Handle incoming prefill or pre-computed assessment from Innovation Assessment flow
  useEffect(() => {
    if (location.state?.assessmentResult) {
      const { prompt, result: assessmentData } = location.state.assessmentResult
      const userMsg = {
        id: Date.now() - 500,
        role: 'user',
        text: prompt,
        timestamp: Date.now() - 500,
      }
      const aiMsg = {
        id: Date.now(),
        role: 'ai',
        text: assessmentData.answer,
        sections: assessmentData.sections || [],
        citations: assessmentData.citations || [],
        confidence: assessmentData.confidence || { score: 78, label: 'High', reason: 'Diagnostic grounded in statutory knowledge corpus.' },
        followUpQuestions: assessmentData.follow_up_questions || [
          'What are the Section 3(p) prior art criteria for this formulation?',
          'How do I obtain NBA Form III approval for commercialization?',
          'What are the ASU Rule 158-B licensing requirements?'
        ],
        status: 'answered',
        showDisclaimer: true,
        timestamp: Date.now(),
      }
      setMessages([userMsg, aiMsg])
      if (assessmentData.conversation_id) {
        setConversationId(assessmentData.conversation_id)
        setActiveSessionId(assessmentData.conversation_id)
      }
      window.history.replaceState({}, document.title)
    } else if (prefillPrompt) {
      setInput(prefillPrompt)
      setPrefillPrompt('')
    }
  }, [location.state, prefillPrompt, setPrefillPrompt])

  // ----- Conversation persistence helpers -----
  const formatSessionDate = useCallback((iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    if (sameDay) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    if (isYesterday) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }, [])

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch(`${API_BASE}/api/conversations?limit=50`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data.map(c => ({
        id: c.id,
        title: c.title || 'Untitled consultation',
        date: formatSessionDate(c.updated_at || c.created_at),
        messageCount: c.message_count,
      })))
    } catch (err) {
      console.warn('[Conversations] Could not load history:', err.message)
    } finally {
      setLoadingSessions(false)
    }
  }, [API_BASE, formatSessionDate])

  // Load conversation history on mount
  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  const loadConversation = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const loaded = (data.messages || []).map(m => {
        if (m.role === 'user') {
          return { id: m.id, role: 'user', text: m.content, timestamp: new Date(m.created_at).getTime() }
        }
        const label = (m.confidence || 'medium')
        const labelCap = label.charAt(0).toUpperCase() + label.slice(1)
        return {
          id: m.id,
          role: 'ai',
          text: m.content,
          sections: [],
          citations: m.citations || [],
          confidence: { score: label === 'high' ? 85 : label === 'low' ? 20 : 55, label: labelCap, reason: 'Loaded from saved conversation.' },
          followUpQuestions: [],
          status: 'answered',
          showDisclaimer: true,
          timestamp: new Date(m.created_at).getTime(),
        }
      })
      setMessages(loaded)
      setConversationId(id)
      setActiveSessionId(id)
    } catch (err) {
      console.warn('[Conversations] Could not load conversation:', err.message)
    }
  }, [API_BASE])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatBodyRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = chatBodyRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      if (isNearBottom || typing) {
        chatBodyRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' })
      }
    }
  }, [messages, typing])

  // Handle scroll position for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (chatBodyRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = chatBodyRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollBtn(!isNearBottom)
    }
  }, [])

  // Scroll to bottom handler
  const scrollToBottom = () => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' })
    }
  }

  // Auto-resize textarea whenever input value changes (typing, pasting, voice, suggestions, clear)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollH = textareaRef.current.scrollHeight
      const newHeight = Math.min(Math.max(scrollH, 28), 160)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [input])

  const handleInputChange = (e) => {
    const value = e.target.value
    if (value.length <= MAX_CHARS) {
      setInput(value)
    }
  }

  // Handle follow-up suggestion click
  const handleFollowUp = (text) => {
    setInput(text)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  // Handle regenerate
  const handleRegenerate = (msgId) => {
    // Find the user message before this AI message
    const aiIndex = messages.findIndex(m => m.id === msgId)
    if (aiIndex > 0) {
      const userMsg = messages[aiIndex - 1]
      if (userMsg.role === 'user') {
        // Remove the AI message and resend
        setMessages(prev => prev.filter(m => m.id !== msgId))
        setInput(userMsg.text)
        setTimeout(() => handleSend(), 100)
      }
    }
  }

  // Handle feedback
  // File upload handler
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'image/png', 'image/jpeg']
    if (!allowedTypes.includes(file.type)) {
      alert('File type not supported. Please upload PDF, Word, Text, or Image files.')
      return
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.')
      return
    }
    
    setAttachedFile(file)
    e.target.value = '' // Reset input
  }

  const handleFeedback = (msgId, type) => {
    console.log('Feedback:', msgId, type)
    // Could send to backend in the future
  }

  // Retrieval state messages
  const [retrievalState, setRetrievalState] = useState('')

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMsg = { id: Date.now(), role: 'user', text: trimmed, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)
    setRetrievalState('Searching trusted sources...')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const apiBase = API_BASE
    const requestBody = {
      question: trimmed,
      jurisdiction: jurisdiction.charAt(0).toUpperCase() + jurisdiction.slice(1),
      language: lang.toUpperCase(),
      conversation_id: conversationId,
    }

    // Stable id for the streaming AI message so we can patch it as tokens arrive.
    const aiMsgId = Date.now() + 1

    // ---- Attempt 1: streaming via SSE (fetch + ReadableStream reader) ----
    // Returns true on success, false if the caller should fall back to /api/chat.
    const tryStream = async () => {
      let response
      try {
        setRetrievalState('Reviewing relevant documents...')
        response = await fetch(`${apiBase}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify(requestBody),
        })
      } catch (err) {
        return false // network / connection failure -> fallback
      }

      if (!response.ok || !response.body) {
        return false // HTTP error or no stream body -> fallback
      }

      // Create the placeholder AI message that we'll fill token-by-token.
      let placeholderCreated = false
      const ensurePlaceholder = () => {
        if (placeholderCreated) return
        placeholderCreated = true
        setMessages(prev => [...prev, {
          id: aiMsgId,
          role: 'ai',
          text: '',
          sections: [],
          citations: [],
          confidence: null,
          followUpQuestions: [],
          status: 'streaming',
          showDisclaimer: true,
          streaming: true,
          timestamp: Date.now(),
        }])
      }

      const appendToken = (token) => {
        ensurePlaceholder()
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, text: (m.text || '') + token } : m
        ))
      }

      const finalize = (payload) => {
        ensurePlaceholder()
        const confidenceData = payload.confidence && typeof payload.confidence === 'object'
          ? payload.confidence
          : { score: 50, label: 'Medium', reason: 'Confidence information unavailable' }
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? {
            ...m,
            citations: payload.citations || [],
            confidence: confidenceData,
            followUpQuestions: payload.follow_up_questions || [],
            status: payload.status || 'answered',
            streaming: false,
          } : m
        ))
        if (payload.conversation_id) {
          setConversationId(payload.conversation_id)
          setActiveSessionId(payload.conversation_id)
          refreshSessions()
        }
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let sawError = false
      let gotToken = false
      let accumulatedCitations = []

      setRetrievalState('Preparing cited answer...')

      try {
        // Loop over the byte stream, splitting complete SSE frames on blank lines.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let sepIndex
          while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sepIndex)
            buffer = buffer.slice(sepIndex + 2)

            // A frame may contain multiple `data:` lines; concatenate them.
            const dataLines = frame
              .split('\n')
              .filter(line => line.startsWith('data:'))
              .map(line => line.slice(5).trimStart())
            if (dataLines.length === 0) continue

            const rawPayload = dataLines.join('\n')
            // Ignore legacy non-JSON control signals like [DONE] safely
            if (rawPayload.trim() === '[DONE]') continue

            let parsed
            try {
              parsed = JSON.parse(rawPayload)
            } catch {
              continue // ignore malformed frame
            }

            if (parsed.type === 'error' || parsed.error) {
              sawError = true
              // If no tokens streamed yet, cleanly fall back to /api/chat
              if (!gotToken) return false
              // If partial tokens were received, DO NOT call /api/chat again; mark status as degraded
              finalize({ status: 'degraded', citations: accumulatedCitations })
              return true
            }

            if (parsed.type === 'citations' && Array.isArray(parsed.citations)) {
              accumulatedCitations = parsed.citations
            }

            if (parsed.type === 'token' && typeof parsed.token === 'string') {
              gotToken = true
              appendToken(parsed.token)
            } else if (typeof parsed.token === 'string') {
              gotToken = true
              appendToken(parsed.token)
            }

            if (parsed.type === 'done' || parsed.done) {
              finalize({
                ...parsed,
                citations: (parsed.citations && parsed.citations.length > 0) ? parsed.citations : accumulatedCitations,
                status: parsed.status || 'answered',
              })
              return true
            }
          }
        }
      } catch (err) {
        // Stream broke mid-flight.
        if (!gotToken) return false // nothing shown -> fallback to /api/chat
        finalize({ status: 'degraded', citations: accumulatedCitations }) // keep partial answer, do not call /api/chat again
        return true
      }

      // Stream ended without an explicit `done` frame.
      if (!gotToken && !sawError) return false
      finalize({ status: sawError ? 'degraded' : 'answered', citations: accumulatedCitations })
      return true
    }

    // ---- Attempt 2: non-streaming fallback (original behaviour) ----
    const fallbackNonStreaming = async () => {
      try {
        setRetrievalState('Preparing cited answer...')
        const response = await fetch(`${apiBase}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`)
        const data = await response.json()

        const confidenceData = data.confidence && typeof data.confidence === 'object'
          ? data.confidence
          : { score: 50, label: 'Medium', reason: 'Confidence information unavailable' }

        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'ai',
          text: data.answer,
          sections: data.sections || [],
          citations: data.citations || [],
          confidence: confidenceData,
          followUpQuestions: data.follow_up_questions || [],
          status: data.status || 'answered',
          showDisclaimer: true,
          timestamp: Date.now(),
        }])
        if (data.conversation_id) {
          setConversationId(data.conversation_id)
          setActiveSessionId(data.conversation_id)
          refreshSessions()
        }
      } catch (error) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'ai',
          text: `Unable to connect to the statutory reasoning engine. Please check that the backend server is running and try again.\n\nError: ${error.message}`,
          sections: [],
          citations: [],
          confidence: { score: 0, label: 'Error', reason: 'Backend connection failed. No statutory retrieval was performed.' },
          followUpQuestions: [],
          status: 'error',
          showDisclaimer: true,
          timestamp: Date.now(),
        }])
      }
    }

    try {
      const streamed = await tryStream()
      if (!streamed) {
        await fallbackNonStreaming()
      }
    } finally {
      setTyping(false)
      setRetrievalState('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    setInput('')
  }

  const handleNewChat = () => {
    setMessages([])
    setInput('')
    setActiveSessionId(null)
    setConversationId(null)
  }

  const handleSelectSession = (id) => {
    loadConversation(id)
  }

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSessions(prev => prev.filter(s => s.id !== id))
      // If the deleted conversation is the active one, reset to a fresh chat
      if (id === conversationId || id === activeSessionId) {
        setMessages([])
        setConversationId(null)
        setActiveSessionId(null)
      }
    } catch (err) {
      console.warn('[Conversations] Delete failed:', err.message)
      alert('Could not delete the conversation. Please try again.')
    }
  }

  const handleRenameSession = async (id, title) => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s))
    } catch (err) {
      console.warn('[Conversations] Rename failed:', err.message)
      alert('Could not rename the conversation. Please try again.')
    }
  }

  // Check if we should show welcome screen (empty or only welcome message)
  const showWelcome = messages.length === 0

  // Find the latest AI message for follow-up chips
  const latestAIMessage = messages.filter(m => m.role === 'ai').slice(-1)[0]

  return (
    <div
      className="chat-layout"
      role="main"
      style={{
        ...themeCSSVariables,
        '--sidebar-width': `${sidebarWidth}px`,
      }}
    >
      <GovtAccessibilityBar theme={theme} toggleTheme={toggleTheme} fontSize={fontSize} setFontSize={setFontSize} />

      {/* Topbar */}
      <header className="chat-topbar" role="banner">
        <div className="chat-topbar-left">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={t('toggleSidebar')}
            title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          >
            <IconMenu size={18} />
          </button>
          <Link to="/" className="chat-brand" aria-label={t('backToHome')}>
            <div className="chat-brand-icon" aria-hidden="true">
              <IconLeaf size={20} />
            </div>
            <div className="chat-brand-info">
              <div className="chat-brand-title-row">
                <span className="chat-brand-name">IP-SAKTI Sahayak</span>
                <span className="chat-ragvyn-pill">RagVyn AI</span>
              </div>
              <span className="chat-brand-dept devanagari">
                आयुष मंत्रालय | Govt of India
              </span>
            </div>
          </Link>
        </div>

        <div className="topbar-right">
          {/* RagVyn Theme Selector Popover */}
          <div className="chat-theme-picker-anchor" ref={themePickerRef}>
            <button
              className={`btn-secondary chat-theme-btn ${showThemePicker ? 'active' : ''}`}
              onClick={() => setShowThemePicker(prev => !prev)}
              aria-label="Select Chat Visual Theme"
              title="Select Chat Visual Theme"
              id="ragvyn-theme-selector-btn"
            >
              <IconPalette size={15} />
              <span className="theme-btn-label">Themes</span>
              <span className="theme-current-badge">{currentChatTheme.name.split(' ')[0]}</span>
            </button>
            {showThemePicker && (
              <div className="chat-theme-popover" role="dialog" aria-label="Select RagVyn Theme">
                <div className="theme-popover-header">
                  <div className="theme-popover-title-row">
                    <IconPalette size={15} />
                    <span className="theme-popover-title">Visual Themes</span>
                  </div>
                  <button className="theme-popover-close" onClick={() => setShowThemePicker(false)} aria-label="Close">
                    <IconClose size={14} />
                  </button>
                </div>
                <p className="theme-popover-desc">
                  Choose a theme to adjust both the outer background and inner chat surface.
                </p>
                <div className="theme-options-list">
                  {RAGVYN_THEMES.map(th => {
                    const isActive = th.id === chatThemeId
                    return (
                      <button
                        key={th.id}
                        type="button"
                        className={`theme-option-card ${isActive ? 'active' : ''}`}
                        onClick={() => handleSelectTheme(th.id)}
                      >
                        <div className="theme-swatch-combo">
                          <span className="swatch-outer" style={{ background: th.preview.outer }} title="Outer Background" />
                          <span className="swatch-surface" style={{ background: th.preview.surface }} title="Chat Surface" />
                          <span className="swatch-bubble" style={{ background: th.preview.userBubble }} title="User Message" />
                        </div>
                        <div className="theme-option-info">
                          <div className="theme-option-name-row">
                            <span className="theme-option-name">{th.name}</span>
                            {isActive && <span className="theme-active-tag">Active</span>}
                          </div>
                          <span className="theme-option-sub">{th.subtitle}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <select
            className="lang-select"
            value={lang}
            onChange={e => setLang(e.target.value)}
            aria-label={t('selectResponseLang')}
            id="lang-selector"
          >
            {languages.map(l => (
              <option key={l.code} value={l.code}>[{l.flag}] {l.label}</option>
            ))}
          </select>

          <button className="btn-secondary chat-about-btn" onClick={onOpenAbout}>
            <IconInfo size={14} /> <span>{t('about')}</span>
          </button>
          <button
            className="btn-secondary chat-about-btn sources-toggle-btn"
            onClick={() => setSourcesPanelOpen(prev => !prev)}
            aria-label={sourcesPanelOpen ? 'Hide sources panel' : 'Show sources panel'}
            title={sourcesPanelOpen ? 'Hide sources' : 'Show sources'}
          >
            <IconBook size={14} />
            <span className="sources-toggle-label">{sourcesPanelOpen ? 'Hide Sources' : 'Sources'}</span>
          </button>
          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
        </div>
      </header>

      {/* Main Chat Area with Sidebar */}
      <div className="chat-container">
        {!sidebarCollapsed && (
          <div
            className="chat-sidebar-backdrop"
            onClick={() => setSidebarCollapsed(true)}
            aria-hidden="true"
          />
        )}
        <ChatSidebar
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarCollapsed(true)}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onOpenWizard={onOpenWizard}
          onOpenAbout={onOpenAbout}
          sessions={sessions}
          loadingSessions={loadingSessions}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          width={sidebarWidth}
          isResizing={isResizingSidebar}
          onStartResize={handleStartResize}
        />

        <div className="chat-main-area">
          {/* Chat content area (chat body + input bar) */}
          <div className="chat-content-area">
            {/* Chat Body */}
            <div
              className="chat-body"
              id="chat-messages"
              role="log"
              aria-live="polite"
              ref={chatBodyRef}
              onScroll={handleScroll}
            >
              <div className="chat-conversation-inner">
                {/* Wizard shortcuts - only show when not in welcome state */}
                {!showWelcome && (
                  <div className="wizard-shortcut-bar" aria-label={t('quickActions')}>
                    {[
                      { icon: <IconFlask size={14} />, labelKey: 'formulationWizard', action: onOpenWizard },
                      { icon: <IconLeaf size={14} />, labelKey: 'absChecker', link: '/abs-checker' },
                      { icon: <IconScroll size={14} />, labelKey: 'patentsActSection', prompt: 'What is Section 3(p) of Patents Act 1970?' },
                      { icon: <IconBook size={14} />, labelKey: 'tkdlCheck', prompt: 'How does TKDL prevent traditional knowledge biopiracy?' },
                      { icon: <IconTag size={14} />, labelKey: 'giTagging', prompt: 'How do I register a Geographical Indication for an Ayurvedic herb?' },
                    ].map((b, idx) => (
                      b.link ? (
                        <Link key={idx} to={b.link} className="wizard-btn">
                          <span aria-hidden="true" style={{ display: 'flex' }}>{b.icon}</span>
                          <span>{t(b.labelKey)}</span>
                        </Link>
                      ) : (
                        <button
                          key={idx}
                          className="wizard-btn"
                          onClick={() => b.action ? b.action() : setInput(b.prompt)}
                        >
                          <span aria-hidden="true" style={{ display: 'flex' }}>{b.icon}</span>
                          <span>{t(b.labelKey)}</span>
                        </button>
                      )
                    ))}
                  </div>
                )}

                {/* Welcome state or Messages */}
                {showWelcome ? (
                  <ChatWelcome
                    onPromptClick={(text) => {
                      setInput(text)
                      if (textareaRef.current) textareaRef.current.focus()
                    }}
                    onOpenWizard={onOpenWizard}
                  />
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      onFollowUp={handleFollowUp}
                      onRegenerate={handleRegenerate}
                      onFeedback={handleFeedback}
                      isLatestAI={latestAIMessage && msg.id === latestAIMessage.id && !typing}
                      onCitationClick={(srcId) => {
                        setSourcesPanelOpen(true)
                        setHighlightedSourceId(srcId)
                      }}
                    />
                  ))
                )}

                {/* Typing indicator with retrieval state */}
                {typing && <TypingIndicator retrievalState={retrievalState} />}
              </div>

              {/* Scroll to bottom button */}
              <ScrollToBottomBtn onClick={scrollToBottom} visible={showScrollBtn} />
            </div>

            {/* Input Bar */}
            <div className="chat-input-bar">
              <div className="chat-input-inner">
                {/* Voice Input Visual Indicator */}
                <VoiceInputIndicator
                  isListening={isListening}
                  interimText={interimText}
                  confidence={voiceConfidence}
                  voiceLang={voiceLang}
                />

                {/* Voice error display */}
                {voiceError && (
                  <div className="voice-error-text">
                    <IconAlertTriangle size={14} />
                    <span>{voiceError}</span>
                  </div>
                )}

                {/* Voice confidence indicator - show when confidence is low */}
                {voiceConfidence !== null && voiceConfidence < 0.5 && (
                  <div className="voice-confidence-warning">
                    <IconAlertTriangle size={14} />
                    <span>कम सटीकता / Low accuracy ({(voiceConfidence * 100).toFixed(0)}%) - कृपया स्पष्ट बोलें / Please speak clearly</span>
                  </div>
                )}

                {/* Jurisdiction selector — lives beside the chat composer */}
                <div className="chat-jurisdiction-row">
                  <label htmlFor="chat-jurisdiction-select" className="chat-jurisdiction-label">
                    {t('chooseJurisdiction') || 'Choose Jurisdiction'}
                  </label>
                  <select
                    id="chat-jurisdiction-select"
                    className="chat-jurisdiction-select"
                    value={jurisdiction}
                    onChange={e => setJurisdiction(e.target.value)}
                    aria-label={t('chooseJurisdiction') || 'Choose Jurisdiction'}
                  >
                    <option value="india">{t('jurisdictionIndia') || 'India'}</option>
                    <option value="international">{t('jurisdictionInternational') || 'International'}</option>
                    <option value="both">{t('jurisdictionBoth') || 'Both'}</option>
                  </select>
                  <span className="chat-jurisdiction-current">
                    {jurisdiction === 'both'
                      ? (t('jurisdictionBoth') || 'Both')
                      : jurisdiction === 'international'
                        ? (t('jurisdictionInternational') || 'International')
                        : (t('jurisdictionIndia') || 'India')}
                  </span>
                </div>

                <div className="input-row">
                  <div className="chat-input-wrap">
                    <textarea
                      ref={textareaRef}
                      className="chat-input"
                      id="chat-input-field"
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={isListening ? t('voiceListening') : "Ask about Patents Act, ABS clearance, BD Act, TKDL, trademarks... (e.g., 'Can I patent my Ayurvedic formulation?')"}
                      rows={1}
                      aria-label={t('typeYourQuestion')}
                    />
                    {/* File Upload Button */}
                    <div className="chat-file-upload">
                      <input
                        type="file"
                        id="chat-file-input"
                        accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="file-upload-btn"
                        onClick={() => document.getElementById('chat-file-input')?.click()}
                        aria-label="Attach file"
                        title="Upload PDF, Word, or Image"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <IconPaperClip size={16} />
                      </button>
                    </div>
                    {/* Voice Input Controls */}
                    {voiceSupported && (
                      <div className="voice-controls">
                        <VoiceLanguageSelector
                          value={voiceLang}
                          onChange={setVoiceLang}
                          isListening={isListening}
                        />
                        <button
                          type="button"
                          className={`voice-btn ${isListening ? 'listening' : ''}`}
                          onClick={isListening ? stopListening : startListening}
                          aria-label={isListening ? t('voiceListening') : t('tapToSpeak')}
                          title={t('voiceInput')}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {isListening ? (
                            <span className="voice-waves">
                              <span></span><span></span><span></span>
                            </span>
                          ) : <IconMic size={16} />}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className="send-btn"
                    id="send-message-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || typing}
                    aria-label={t('sendMessage')}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <IconSend size={16} />
                  </button>
                </div>

                {/* Attached file preview */}
                {attachedFile && (
                  <div className="attached-file-preview">
                    <div className="attached-file-info">
                      <IconFileText size={16} />
                      <span className="attached-file-name">{attachedFile.name}</span>
                      <span className="attached-file-size">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      className="remove-file-btn"
                      onClick={() => setAttachedFile(null)}
                      aria-label="Remove file"
                    >
                      <IconClose size={14} />
                    </button>
                  </div>
                )}

                {/* Character count indicator */}
                <div className="input-meta">
                  <span className={`char-count ${input.length > MAX_CHARS * 0.9 ? 'warning' : ''} ${input.length >= MAX_CHARS ? 'limit' : ''}`}>
                    {input.length}/{MAX_CHARS}
                  </span>
                  <span className="input-hint">Press Enter to send, Shift+Enter for new line</span>
                </div>

                <div className="input-actions">
                  <DPDPProtectionBadge />
                  <button className="action-btn" onClick={onOpenWizard} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconFlask size={14} /> {t('formulationWizard')}
                  </button>
                  <Link to="/abs-checker" className="action-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconLeaf size={14} /> {t('absCompliance')}
                  </Link>
                  <button
                    className="action-btn pdf-export-btn"
                    onClick={() => handleExportPdf(messages, t, jurisdiction)}
                    disabled={messages.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <IconFileText size={14} /> {t('exportPdf')}
                  </button>
                  <button className="action-btn" id="clear-chat-btn" onClick={handleClear} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconTrash size={14} /> {t('clearSession')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sources Panel (right side) */}
          <SourcesPanel
            citations={latestAIMessage?.citations || []}
            isOpen={sourcesPanelOpen}
            onClose={() => setSourcesPanelOpen(false)}
            highlightedSourceId={highlightedSourceId}
            onClearHighlight={() => setHighlightedSourceId(null)}
          />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   ABS COMPLIANCE CHECKER PAGE
   ============================================================ */
function ABSCheckerPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  const { t } = useLanguage()
  const [showIntro, setShowIntro] = useState(true)
  const [applicantType, setApplicantType] = useState('indian_individual')
  const [resourceSource, setResourceSource] = useState('india')
  const [activityIntent, setActivityIntent] = useState('commercial')
  const [evaluated, setEvaluated] = useState(false)

  const handleEvaluate = (e) => {
    e.preventDefault()
    setEvaluated(true)
  }

  return (
    <div className="page-container">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      {showIntro ? (
        <ToolIntro
          config={TOOL_INTRO_CONFIGS['abs-checker']}
          icon={<IconLeaf size={28} />}
          onStart={() => setShowIntro(false)}
          backTo="/"
          backLabel="Back to Portal"
        />
      ) : (
        <>
          <header className="page-header" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="chip" style={{ background: 'rgba(6, 95, 70, 0.2)', color: 'var(--secondary-light)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <IconLeaf size={14} /> {t('absChipLabel')}
              </span>
              <button
                type="button"
                className="tool-guide-return-btn"
                onClick={() => setShowIntro(true)}
                title="View tool overview & instructions"
              >
                <IconInfo size={14} />
                <span>Tool Overview & Guide</span>
              </button>
            </div>
            <h1 className="page-title">{t('absPageTitle')}</h1>
            <p className="page-subtitle">{t('absPageSubtitle')}</p>
          </header>

      <main className="abs-form-card">
        <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">1. {t('absApplicantType')}</label>
            <select
              className="form-select"
              value={applicantType}
              onChange={e => setApplicantType(e.target.value)}
            >
              <option value="indian_individual">{t('absIndianCitizen')}</option>
              <option value="indian_company">{t('absIndianCompany')}</option>
              <option value="foreign_entity">{t('absForeignEntity')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">2. {t('absResourceOrigin')}</label>
            <select
              className="form-select"
              value={resourceSource}
              onChange={e => setResourceSource(e.target.value)}
            >
              <option value="india">{t('absSourcedIndia')}</option>
              <option value="imported">{t('absImported')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">3. {t('absIntendedPurpose')}</label>
            <select
              className="form-select"
              value={activityIntent}
              onChange={e => setActivityIntent(e.target.value)}
            >
              <option value="commercial">{t('absCommercial')}</option>
              <option value="patent">{t('absPatent')}</option>
              <option value="export">{t('absExport')}</option>
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
            {t('absCheckButton')} →
          </button>
        </form>

        {evaluated && (
          <div className="abs-result-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'flex', color: 'var(--primary-light)' }}><IconFileText size={22} /></span>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                NBA Approval & ABS Regulatory Assessment
              </h3>
            </div>

            {applicantType === 'foreign_entity' ? (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p><strong>Status:</strong> <span style={{ color: '#FCA5A5' }}>Mandatory Prior Approval Required (Section 3 of BD Act 2002)</span></p>
                <p style={{ marginTop: '0.5rem' }}>Because the applicant involves foreign equity, NRIs, or foreign incorporation:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                  <li>Must submit <strong>Form I</strong> application to the National Biodiversity Authority (NBA).</li>
                  <li>Must sign an Access & Benefit Sharing (ABS) agreement before accessing Indian herbs.</li>
                  <li>If filing a patent, <strong>Form III</strong> approval is mandatory before patent grant (Section 6).</li>
                </ul>
              </div>
            ) : (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p><strong>Status:</strong> <span style={{ color: '#86EFAC' }}>State Biodiversity Board (SBB) Intimation Required</span></p>
                <p style={{ marginTop: '0.5rem' }}>For 100% Indian entities and domestic Vaidyas:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                  <li>Local Vaidyas & traditional practitioners are EXEMPT from ABS fees for domestic practice.</li>
                  <li>Commercial AYUSH manufacturers must notify the respective State Biodiversity Board (SBB) prior to commercial production.</li>
                  <li>If filing for an international PCT patent, prior NBA notification via Form III is required.</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
        </>
      )}
    </div>
  )
}

/* ============================================================
   PATENT FEE CALCULATOR (Tools)
   Real Indian Patent Office statutory fees — Patents Rules 2003,
   First Schedule (e-filing rates). Natural Person / Startup /
   Small Entity share the concessional slab; "Others" is the full slab.
   ============================================================ */
const PATENT_FEE_SCHEDULE = {
  // slab key -> { base (Form 1), extraClaim (per claim >10), extraPage (per page >30),
  //               earlyPub (Form 9), examReq (Form 18) }
  natural: { base: 1600, extraClaim: 320, extraPage: 160, earlyPub: 2500, examReq: 4000 },
  startup: { base: 4000, extraClaim: 800, extraPage: 400, earlyPub: 6250, examReq: 10000 },
  small:   { base: 4000, extraClaim: 800, extraPage: 400, earlyPub: 6250, examReq: 10000 },
  others:  { base: 8000, extraClaim: 1600, extraPage: 800, earlyPub: 12500, examReq: 20000 },
}

// Convention / PCT National Phase applications carry the same First-Schedule
// statutory scale for filing; the entry-type selector is retained for clarity
// and future surcharge extension.
const PATENT_APP_TYPES = ['ordinary', 'convention', 'pct']

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function PatentFeeCalculator() {
  const { t } = useLanguage()

  const [applicant, setApplicant] = useState('natural')
  const [appType, setAppType] = useState('ordinary')
  const [claims, setClaims] = useState(10)
  const [pages, setPages] = useState(30)
  const [earlyPub, setEarlyPub] = useState(false)
  const [examReq, setExamReq] = useState(true)

  const applicantOptions = [
    { id: 'natural', label: t('pfcAppNatural'), icon: <IconUser size={16} /> },
    { id: 'startup', label: t('pfcAppStartup'), icon: <IconSparkles size={16} /> },
    { id: 'small', label: t('pfcAppSmall'), icon: <IconBuilding size={16} /> },
    { id: 'others', label: t('pfcAppOthers'), icon: <IconGovt size={16} /> },
  ]

  const appTypeOptions = [
    { id: 'ordinary', label: t('pfcTypeOrdinary') },
    { id: 'convention', label: t('pfcTypeConvention') },
    { id: 'pct', label: t('pfcTypePct') },
  ]

  const slab = PATENT_FEE_SCHEDULE[applicant] || PATENT_FEE_SCHEDULE.natural
  const safeClaims = Number.isFinite(claims) ? Math.max(1, claims) : 1
  const safePages = Number.isFinite(pages) ? Math.max(1, pages) : 1

  const extraClaimCount = Math.max(0, safeClaims - 10)
  const extraPageCount = Math.max(0, safePages - 30)

  const baseFee = slab.base
  const extraClaimsFee = extraClaimCount * slab.extraClaim
  const extraPagesFee = extraPageCount * slab.extraPage
  const earlyPubFee = earlyPub ? slab.earlyPub : 0
  const examFee = examReq ? slab.examReq : 0
  const total = baseFee + extraClaimsFee + extraPagesFee + earlyPubFee + examFee

  const lineItems = [
    { key: 'base', label: t('pfcBaseFee'), amount: baseFee, show: true },
    {
      key: 'claims',
      label: `${t('pfcExtraClaims')} (${extraClaimCount} × ${formatINR(slab.extraClaim)})`,
      amount: extraClaimsFee,
      show: extraClaimCount > 0,
    },
    {
      key: 'pages',
      label: `${t('pfcExtraPages')} (${extraPageCount} × ${formatINR(slab.extraPage)})`,
      amount: extraPagesFee,
      show: extraPageCount > 0,
    },
    { key: 'earlyPub', label: t('pfcEarlyPubFee'), amount: earlyPubFee, show: earlyPub },
    { key: 'exam', label: t('pfcExamFee'), amount: examFee, show: examReq },
  ].filter(item => item.show)

  const handleReset = () => {
    setApplicant('natural')
    setAppType('ordinary')
    setClaims(10)
    setPages(30)
    setEarlyPub(false)
    setExamReq(true)
  }

  return (
    <section className="pfc-card">
      <div className="pfc-header">
        <span className="pfc-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconScroll size={14} /> Patents Rules 2003 · First Schedule
        </span>
        <h2 className="pfc-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <IconCalculator size={22} /> {t('pfcTitle')}
        </h2>
        <p className="pfc-subtitle">{t('pfcSubtitle')}</p>
      </div>

      <div className="pfc-grid">
        {/* Inputs */}
        <div className="pfc-inputs">
          <div className="pfc-field">
            <label className="pfc-label">{t('pfcApplicantType')}</label>
            <div className="pfc-chip-row">
              {applicantOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pfc-chip ${applicant === opt.id ? 'active' : ''}`}
                  onClick={() => setApplicant(opt.id)}
                  aria-pressed={applicant === opt.id}
                >
                  <span className="pfc-chip-icon" style={{ display: 'inline-flex' }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pfc-field">
            <label className="pfc-label">{t('pfcApplicationType')}</label>
            <div className="pfc-chip-row">
              {appTypeOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pfc-chip ${appType === opt.id ? 'active' : ''}`}
                  onClick={() => setAppType(opt.id)}
                  aria-pressed={appType === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pfc-number-row">
            <div className="calc-input-group">
              <label>{t('pfcClaims')}</label>
              <input
                type="number"
                min="1"
                max="500"
                value={claims}
                onChange={e => setClaims(parseInt(e.target.value, 10))}
              />
              <span className="calc-input-hint">{t('pfcClaimsHint')} · {formatINR(slab.extraClaim)} {t('pfcPerClaim')}</span>
            </div>
            <div className="calc-input-group">
              <label>{t('pfcPages')}</label>
              <input
                type="number"
                min="1"
                max="2000"
                value={pages}
                onChange={e => setPages(parseInt(e.target.value, 10))}
              />
              <span className="calc-input-hint">{t('pfcPagesHint')} · {formatINR(slab.extraPage)} {t('pfcPerPage')}</span>
            </div>
          </div>

          <div className="pfc-field">
            <label className="pfc-label">{t('pfcOptions')}</label>
            <div className="pfc-toggle-row">
              <label className="pfc-toggle">
                <input type="checkbox" checked={examReq} onChange={e => setExamReq(e.target.checked)} />
                <span>{t('pfcExamReq')} · {formatINR(slab.examReq)}</span>
              </label>
              <label className="pfc-toggle">
                <input type="checkbox" checked={earlyPub} onChange={e => setEarlyPub(e.target.checked)} />
                <span>{t('pfcEarlyPub')} · {formatINR(slab.earlyPub)}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="pfc-result">
          <h3 className="pfc-result-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <IconFileText size={16} /> {t('pfcBreakdown')}
          </h3>
          <div className="pfc-breakdown">
            {lineItems.map(item => (
              <div key={item.key} className="pfc-line">
                <span className="pfc-line-label">{item.label}</span>
                <span className="pfc-line-amount">{formatINR(item.amount)}</span>
              </div>
            ))}
          </div>
          <div className="pfc-total">
            <span className="pfc-total-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconCurrencyRupee size={18} /> {t('pfcTotal')}
            </span>
            <span className="pfc-total-amount">{formatINR(total)}</span>
          </div>

          <div className="pfc-actions">
            <button type="button" className="calc-btn-secondary" onClick={handleReset} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <IconRotate size={15} /> {t('pfcReset')}
            </button>
          </div>

          <div className="pfc-disclaimer" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: '2px' }}><IconInfo size={15} /></span>
            <p>{t('pfcDisclaimer')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   IP COST CALCULATOR PAGE
   Professional IP Cost Estimation Tool with Step-by-Step Wizard
   ============================================================ */
import {
  IP_TYPES,
  JURISDICTIONS,
  APPLICANT_CATEGORIES,
  FILING_TYPES,
  PROFESSIONAL_SERVICES,
  generateCostEstimate,
  formatCurrency,
} from './data/ipCostData'

/* ============================================================
   STATUTORY DEADLINE CALCULATOR PAGE
   Computes key Indian patent deadlines from a filing / priority
   date, with a timeline visualization + urgency alerts.
   ============================================================ */
function DocumentsPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  return (
    <div className="page-container calc-page">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      <header className="page-header">
        <span
          className="chip"
          style={{
            background: 'var(--color-primary-light, #eaf2ed)',
            color: 'var(--color-primary, #143D30)',
            marginBottom: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <IconFileText size={14} /> Document Library
        </span>
        <h1 className="page-title">My Documents</h1>
        <p className="page-subtitle">
          Upload your own PDFs — case files, prior-art references, notes — to make them
          searchable inside your AI consultations. Files are parsed, chunked and indexed
          into a private knowledge collection scoped to your account.
        </p>
      </header>

      <DocumentUpload />
    </div>
  )
}

function DraftsPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, isLoggedIn, userName, onLogout }) {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dg-bg, #f8fafc)' }}>
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        isLoggedIn={isLoggedIn}
        userName={userName}
        onLogout={onLogout}
      />
      <DraftGenerator onBack={() => navigate('/')} />
    </div>
  )
}

function WorkspacePage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, isLoggedIn, userName, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mw-bg, #f8fafc)' }}>
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        isLoggedIn={isLoggedIn}
        userName={userName}
        onLogout={onLogout}
      />
      <MatterWorkspace />
    </div>
  )
}

function ExpertConnectPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, isLoggedIn, userName, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg, #f8fafc)' }}>
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        isLoggedIn={isLoggedIn}
        userName={userName}
        onLogout={onLogout}
      />
      <ExpertConnect />
    </div>
  )
}

function DeadlineCalculatorPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  const { t, lang } = useLanguage()
  const [showIntro, setShowIntro] = useState(true)

  const [filingDate, setFilingDate] = useState('')
  const [priorityDate, setPriorityDate] = useState('')
  const [computed, setComputed] = useState(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const MS_PER_DAY = 24 * 60 * 60 * 1000

  // Add whole calendar months to a date (clamps end-of-month, e.g. Jan 31 + 1mo -> Feb 28/29)
  const addMonths = (date, months) => {
    const d = new Date(date.getTime())
    const targetDay = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + months)
    const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(targetDay, daysInTargetMonth))
    return d
  }

  const addYears = (date, years) => addMonths(date, years * 12)

  const parseDate = (str) => {
    if (!str) return null
    const d = new Date(str + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }

  const localeFor = (l) => {
    const map = { hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', gu: 'gu-IN', ml: 'ml-IN', pa: 'pa-IN', kn: 'kn-IN', en: 'en-IN' }
    return map[l] || 'en-IN'
  }

  const formatDate = (date) =>
    date.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' })

  const daysBetween = (from, to) => Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)

  // Human "due in" string with urgency status
  const describeCountdown = (date) => {
    const diffDays = daysBetween(today, date)
    if (diffDays < 0) return { status: 'passed', label: t('deadlineOverdue'), diffDays }
    if (diffDays === 0) return { status: 'urgent', label: t('deadlineDueToday'), diffDays }
    const months = Math.floor(diffDays / 30)
    const years = Math.floor(diffDays / 365)
    let human
    if (years >= 2) human = `${years} ${t('deadlineYears')}`
    else if (months >= 2) human = `${months} ${t('deadlineMonths')}`
    else human = `${diffDays} ${t('deadlineDays')}`
    const status = diffDays <= 90 ? 'urgent' : 'upcoming'
    return { status, label: `${t('deadlineDueIn')} ${human}`, diffDays }
  }

  const handleCalculate = () => {
    const filing = parseDate(filingDate)
    if (!filing) return
    const priority = parseDate(priorityDate) || filing
    // The date from which priority-based windows run = earliest of filing/priority
    const priorityAnchor = priority.getTime() < filing.getTime() ? priority : filing

    const items = []

    items.push({
      id: 'convention',
      title: t('dlConventionTitle'),
      desc: t('dlConventionDesc'),
      date: addMonths(priorityAnchor, 12),
      section: 'Paris Convention Art. 4',
    })
    items.push({
      id: 'publish',
      title: t('dlPublishTitle'),
      desc: t('dlPublishDesc'),
      date: addMonths(priorityAnchor, 18),
      section: 'Section 11A / Rule 24',
    })
    items.push({
      id: 'pct',
      title: t('dlPctTitle'),
      desc: t('dlPctDesc'),
      date: addMonths(priorityAnchor, 31),
      section: 'PCT Rule 20 / §138',
    })
    items.push({
      id: 'rfe',
      title: t('dlRfeTitle'),
      desc: t('dlRfeDesc'),
      date: addMonths(priorityAnchor, 48),
      section: 'Rule 24B',
    })
    items.push({
      id: 'fer',
      title: t('dlFerTitle'),
      desc: t('dlFerDesc'),
      // Planning estimate: FER response window shown from filing (6 + 3 mo extendable)
      date: addMonths(filing, 6),
      section: 'Rule 24B(6)',
      estimate: true,
    })
    items.push({
      id: 'term',
      title: t('dlTermTitle'),
      desc: t('dlTermDesc'),
      date: addYears(filing, 20),
      section: 'Section 53',
    })

    // Renewal fees: annual, from the 3rd year onward, up to year 20 (term).
    // Renewal for year N is payable before the anniversary at year (N-1).
    for (let year = 3; year <= 20; year++) {
      items.push({
        id: `renewal-${year}`,
        title: `${t('dlRenewalTitle')} — ${t('dlYearN')} ${year}`,
        desc: `${t('dlRenewalDescFrom')} ${year} ${t('dlRenewalDescDue')}`,
        date: addYears(filing, year - 1),
        section: 'Section 53 / Rule 80',
        renewal: true,
      })
    }

    items.sort((a, b) => a.date.getTime() - b.date.getTime())

    const enriched = items.map((it) => ({ ...it, countdown: describeCountdown(it.date) }))
    setComputed({ filing, priority, items: enriched })
  }

  const handleReset = () => {
    setFilingDate('')
    setPriorityDate('')
    setComputed(null)
  }

  // ---- scoped styles (theme-variable driven glassmorphism) ----
  const cardStyle = {
    background: 'var(--glass-bg, rgba(255,255,255,0.06))',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
    borderRadius: '18px',
    padding: '1.6rem',
    boxShadow: '0 10px 40px -12px rgba(0,0,0,0.35)',
  }

  const inputStyle = {
    width: '100%',
    padding: '0.7rem 0.9rem',
    borderRadius: '12px',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.18))',
    background: 'var(--input-bg, rgba(255,255,255,0.08))',
    color: 'var(--text-primary, inherit)',
    fontSize: '0.95rem',
    outline: 'none',
  }

  const statusColor = (status) => {
    if (status === 'passed') return { fg: 'var(--text-secondary, #9aa0a6)', bg: 'rgba(148,163,184,0.14)', dot: '#94a3b8' }
    if (status === 'urgent') return { fg: '#dc2626', bg: 'rgba(220,38,38,0.12)', dot: '#dc2626' }
    return { fg: 'var(--color-primary, #143D30)', bg: 'var(--color-primary-light, rgba(20,61,48,0.12))', dot: 'var(--primary-light, #2f855a)' }
  }

  const urgentCount = computed ? computed.items.filter(i => i.countdown.status === 'urgent').length : 0

  return (
    <div className="page-container calc-page">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      {showIntro ? (
        <ToolIntro
          config={TOOL_INTRO_CONFIGS['deadline-calculator']}
          icon={<IconCalendar size={28} />}
          onStart={() => setShowIntro(false)}
          backTo="/"
          backLabel="Back to Portal"
        />
      ) : (
        <>
          <header className="page-header" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="chip" style={{ background: 'var(--color-primary-light, #eaf2ed)', color: 'var(--color-primary, #143D30)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <IconCalendar size={14} /> {t('deadlineChip')}
              </span>
              <button
                type="button"
                className="tool-guide-return-btn"
                onClick={() => setShowIntro(true)}
                title="View tool overview & instructions"
              >
                <IconInfo size={14} />
                <span>Tool Overview & Guide</span>
              </button>
            </div>
            <h1 className="page-title">{t('deadlineTitle')}</h1>
            <p className="page-subtitle">{t('deadlineSubtitle')}</p>
          </header>

      <main className="calc-main" style={{ display: 'grid', gap: '1.5rem' }}>
        {/* Input card */}
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem' }}>
            <div>
              <label htmlFor="dl-filing" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                {t('deadlineFilingLabel')}
              </label>
              <input
                id="dl-filing"
                type="date"
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                style={inputStyle}
                aria-label={t('deadlineFilingLabel')}
              />
            </div>
            <div>
              <label htmlFor="dl-priority" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                {t('deadlinePriorityLabel')}
              </label>
              <input
                id="dl-priority"
                type="date"
                value={priorityDate}
                onChange={(e) => setPriorityDate(e.target.value)}
                style={inputStyle}
                aria-label={t('deadlinePriorityLabel')}
              />
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #9aa0a6)', margin: '0.75rem 0 1.1rem', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <IconInfo size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {t('deadlinePriorityHint')}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="calc-btn-primary"
              onClick={handleCalculate}
              disabled={!filingDate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center', opacity: filingDate ? 1 : 0.55, cursor: filingDate ? 'pointer' : 'not-allowed' }}
            >
              <IconCalculator size={16} /> {t('deadlineCalcBtn')}
            </button>
            <button
              className="calc-btn-secondary"
              onClick={handleReset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
            >
              <IconRotate size={16} /> {t('deadlineResetBtn')}
            </button>
          </div>
        </div>

        {/* Results / timeline */}
        {computed ? (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <IconCalendar size={18} /> {t('deadlineTimelineTitle')}
              </h2>
              {urgentCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#dc2626', background: 'rgba(220,38,38,0.12)', padding: '4px 10px', borderRadius: '999px' }}>
                  <IconAlertTriangle size={14} /> {urgentCount} {t('deadlineUrgent')}
                </span>
              )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary, #9aa0a6)', marginBottom: '1.25rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /> {t('deadlineLegendUrgent')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary-light, #2f855a)', display: 'inline-block' }} /> {t('deadlineLegendUpcoming')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} /> {t('deadlineLegendPassed')}</span>
            </div>

            {/* Timeline */}
            <div style={{ position: 'relative', paddingLeft: '1.75rem' }}>
              <span style={{ position: 'absolute', left: '9px', top: '4px', bottom: '4px', width: '2px', background: 'var(--glass-border, rgba(255,255,255,0.18))' }} aria-hidden="true" />
              {computed.items.map((item) => {
                const c = statusColor(item.countdown.status)
                return (
                  <div key={item.id} style={{ position: 'relative', marginBottom: '1.1rem' }}>
                    <span style={{ position: 'absolute', left: '-1.75rem', top: '4px', width: 18, height: 18, borderRadius: '50%', background: c.dot, border: '3px solid var(--glass-bg, rgba(0,0,0,0.2))', boxShadow: item.countdown.status === 'urgent' ? '0 0 0 4px rgba(220,38,38,0.18)' : 'none' }} aria-hidden="true" />
                    <div style={{ background: c.bg, border: `1px solid ${c.dot}33`, borderRadius: '14px', padding: '0.9rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <strong style={{ fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {item.countdown.status === 'urgent' && <IconAlertTriangle size={14} style={{ color: '#dc2626' }} />}
                          {item.title}
                        </strong>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: c.fg }}>{formatDate(item.date)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #9aa0a6)' }}>{item.section}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: c.fg }}>{item.countdown.label}</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #9aa0a6)', margin: '0.5rem 0 0', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #9aa0a6)', marginTop: '1.25rem', padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: 1.5 }}>
              <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px', color: '#d97706' }} /> {t('deadlineDisclaimer')}
            </p>

            <div style={{ marginTop: '1.1rem' }}>
              <Link to="/chat" className="calc-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <IconMessageSquare size={16} /> {t('deadlineAskExpert')}
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-secondary, #9aa0a6)' }}>
            <IconCalendar size={40} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>{t('deadlineEmptyHint')}</p>
          </div>
        )}
      </main>
        </>
      )}
    </div>
  )
}

function IPCostCalculatorPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  useLanguage() // For future translations

  const [showIntro, setShowIntro] = useState(true)

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [isCalculating, setIsCalculating] = useState(false)
  const [estimate, setEstimate] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    ipType: '',
    jurisdiction: 'india',
    applicantCategory: 'startup',
    filingType: 'new',
    claims: 10,
    pages: 30,
    classes: 1,
    countries: 1,
    services: [],
  })

  const TOTAL_STEPS = 5

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleService = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter(s => s !== serviceId)
        : [...prev.services, serviceId]
    }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.ipType !== ''
      case 2: return formData.jurisdiction !== ''
      case 3: return formData.applicantCategory !== ''
      case 4: return true // Services are optional
      default: return true
    }
  }

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCalculate = () => {
    setIsCalculating(true)

    // Simulate calculation delay for UX
    setTimeout(() => {
      const result = generateCostEstimate(formData)
      setEstimate(result)
      setIsCalculating(false)
      setCurrentStep(TOTAL_STEPS + 1) // Go to results
    }, 800)
  }

  const handleReset = () => {
    setCurrentStep(1)
    setEstimate(null)
    setFormData({
      ipType: '',
      jurisdiction: 'india',
      applicantCategory: 'startup',
      filingType: 'new',
      claims: 10,
      pages: 30,
      classes: 1,
      countries: 1,
      services: [],
    })
  }

  // PDF Export for cost estimate
  const handleExportCostPdf = () => {
    if (!estimate) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to export PDF')
      return
    }

    const govtBreakdown = estimate.governmentFees.breakdown
      .map(item => `<tr><td>${item.name}</td><td class="amount">${formatCurrency(item.amount)}</td></tr>`)
      .join('')

    const profBreakdown = estimate.professionalFees.breakdown
      .map(item => `<tr><td>${item.name}</td><td class="amount">${formatCurrency(item.min)} - ${formatCurrency(item.max)}</td></tr>`)
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>IP Cost Estimate - ${estimate.ipType?.name || 'Unknown'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; line-height: 1.6; }
          .header { text-align: center; border-bottom: 3px solid #1D4ED8; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 700; color: #1D4ED8; }
          .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
          .ministry { font-size: 12px; color: #888; margin-top: 10px; }
          h1 { font-size: 22px; color: #1a1a2e; margin: 25px 0 15px; border-left: 4px solid #F59E0B; padding-left: 12px; }
          .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          .summary-item { padding: 12px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; }
          .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
          .summary-value { font-size: 18px; font-weight: 600; color: #1D4ED8; margin-top: 4px; }
          .total-box { background: linear-gradient(135deg, #1D4ED8, #1E40AF); color: white; padding: 25px; border-radius: 10px; margin: 25px 0; text-align: center; }
          .total-label { font-size: 14px; opacity: 0.9; }
          .total-amount { font-size: 32px; font-weight: 700; margin: 10px 0; }
          .total-range { font-size: 14px; opacity: 0.8; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 600; color: #374151; font-size: 13px; }
          td { font-size: 14px; }
          .amount { text-align: right; font-weight: 500; color: #1D4ED8; }
          .config-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
          .config-item { display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 4px; font-size: 13px; }
          .disclaimer { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 15px; margin-top: 30px; font-size: 12px; color: #92400E; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">IP-SAKTI Sahayak</div>
          <div class="subtitle">Intellectual Property Cost Estimate Report</div>
          <div class="ministry">Ministry of AYUSH | Government of India</div>
        </div>

        <h1>Estimate Configuration</h1>
        <div class="config-grid">
          <div class="config-item"><span>IP Type:</span><strong>${estimate.ipType?.name || 'N/A'}</strong></div>
          <div class="config-item"><span>Jurisdiction:</span><strong>[${estimate.jurisdiction?.flag || ''}] ${estimate.jurisdiction?.name || 'N/A'}</strong></div>
          <div class="config-item"><span>Applicant:</span><strong>${estimate.applicantCategory?.name || 'N/A'}</strong></div>
          <div class="config-item"><span>Filing Type:</span><strong>${estimate.filingType?.name || 'N/A'}</strong></div>
          ${formData.ipType === 'patent' ? `<div class="config-item"><span>Claims:</span><strong>${formData.claims}</strong></div>` : ''}
          ${formData.ipType === 'patent' ? `<div class="config-item"><span>Pages:</span><strong>${formData.pages}</strong></div>` : ''}
          ${formData.ipType === 'trademark' ? `<div class="config-item"><span>Classes:</span><strong>${formData.classes}</strong></div>` : ''}
          ${formData.jurisdiction === 'wipo' ? `<div class="config-item"><span>Countries:</span><strong>${formData.countries}</strong></div>` : ''}
        </div>

        <div class="total-box">
          <div class="total-label">Recommended Budget</div>
          <div class="total-amount">${formatCurrency(estimate.summary.recommendedBudget)}</div>
          <div class="total-range">Range: ${formatCurrency(estimate.summary.minTotal)} - ${formatCurrency(estimate.summary.maxTotal)}</div>
        </div>

        <div class="summary-box">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">One-Time Costs</div>
              <div class="summary-value">${formatCurrency(estimate.summary.oneTimeCosts)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Recurring Costs (Annual)</div>
              <div class="summary-value">${formatCurrency(estimate.summary.recurringCosts)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Government Fees</div>
              <div class="summary-value">${formatCurrency(estimate.governmentFees.total)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Professional Fees</div>
              <div class="summary-value">${formatCurrency(estimate.professionalFees.min)} - ${formatCurrency(estimate.professionalFees.max)}</div>
            </div>
          </div>
        </div>

        <h1>Government Fees Breakdown</h1>
        <table>
          <thead><tr><th>Fee Type</th><th class="amount">Amount</th></tr></thead>
          <tbody>
            ${govtBreakdown || '<tr><td colspan="2">No fees calculated</td></tr>'}
            <tr style="font-weight: 600; background: #f0f9ff;"><td>Total Government Fees</td><td class="amount">${formatCurrency(estimate.governmentFees.total)}</td></tr>
          </tbody>
        </table>

        ${profBreakdown ? `
        <h1>Professional Services Fees</h1>
        <table>
          <thead><tr><th>Service</th><th class="amount">Estimated Range</th></tr></thead>
          <tbody>
            ${profBreakdown}
            <tr style="font-weight: 600; background: #f0f9ff;"><td>Total Professional Fees</td><td class="amount">${formatCurrency(estimate.professionalFees.min)} - ${formatCurrency(estimate.professionalFees.max)}</td></tr>
          </tbody>
        </table>
        ` : ''}

        <h1>Estimated Timeline & Notes</h1>
        <div class="config-grid">
          <div class="config-item"><span>Estimated Timeline:</span><strong>${estimate.summary.timeline}</strong></div>
          <div class="config-item"><span>Generated On:</span><strong>${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
        </div>

        <div class="disclaimer">
          <strong>Important Disclaimer:</strong><br>
          ${estimate.disclaimer}
        </div>

        <div class="footer">
          <p>Generated by IP-SAKTI Sahayak | Ministry of AYUSH, Government of India</p>
          <p>For official fee information, please visit: ipindia.gov.in | wipo.int</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  // Helper icon renderers for IP Calculator
  const renderIpTypeIcon = (id) => {
    switch (id) {
      case 'patent': return <IconScroll size={22} />
      case 'trademark': return <IconTag size={22} />
      case 'copyright': return <IconBook size={22} />
      case 'design': return <IconFlask size={22} />
      case 'gi': return <IconLeaf size={22} />
      default: return <IconFileText size={22} />
    }
  }

  const renderApplicantIcon = (id) => {
    switch (id) {
      case 'individual': return <IconUser size={20} />
      case 'startup': return <IconSparkles size={20} />
      case 'small': return <IconBuilding size={20} />
      case 'large': return <IconBuilding size={20} />
      case 'educational': return <IconBook size={20} />
      default: return <IconUsers size={20} />
    }
  }

  const renderServiceIcon = (id) => {
    switch (id) {
      case 'prior_art_search': return <IconSearch size={18} />
      case 'drafting': return <IconFileText size={18} />
      case 'legal_review': return <IconScales size={18} />
      default: return <IconBriefcase size={18} />
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="calc-step">
            <h2 className="calc-step-title">
              <span className="calc-step-number">1</span>
              Select IP Type
            </h2>
            <p className="calc-step-desc">What type of intellectual property do you want to protect?</p>

            <div className="calc-ip-grid">
              {IP_TYPES.map(type => (
                <button
                  key={type.id}
                  className={`calc-ip-card ${formData.ipType === type.id ? 'selected' : ''}`}
                  onClick={() => updateForm('ipType', type.id)}
                >
                  <span className="calc-ip-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderIpTypeIcon(type.id)}
                  </span>
                  <span className="calc-ip-name">{type.name}</span>
                  <span className="calc-ip-desc">{type.description}</span>
                  {formData.ipType === type.id && (
                    <span className="calc-ip-check" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck size={14} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="calc-step">
            <h2 className="calc-step-title">
              <span className="calc-step-number">2</span>
              Filing Jurisdiction
            </h2>
            <p className="calc-step-desc">Where do you want to file your {formData.ipType ? IP_TYPES.find(t => t.id === formData.ipType)?.name : 'IP'}?</p>

            <div className="calc-jurisdiction-grid">
              {JURISDICTIONS.map(j => (
                <button
                  key={j.id}
                  className={`calc-jurisdiction-card ${formData.jurisdiction === j.id ? 'selected' : ''}`}
                  onClick={() => updateForm('jurisdiction', j.id)}
                >
                  <span className="calc-j-flag" style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em' }}>{j.flag}</span>
                  <span className="calc-j-name">{j.name}</span>
                  <span className="calc-j-currency">{j.currency}</span>
                  {formData.jurisdiction === j.id && (
                    <span className="calc-j-check" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck size={14} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Additional inputs based on IP type */}
            {formData.ipType === 'patent' && (
              <div className="calc-extra-inputs">
                <div className="calc-input-group">
                  <label>Number of Claims</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.claims}
                    onChange={e => updateForm('claims', parseInt(e.target.value) || 10)}
                  />
                  <span className="calc-input-hint">Standard: 10 claims (extra charges apply beyond)</span>
                </div>
                <div className="calc-input-group">
                  <label>Specification Pages</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.pages}
                    onChange={e => updateForm('pages', parseInt(e.target.value) || 30)}
                  />
                  <span className="calc-input-hint">Standard: 30 pages (extra charges apply beyond)</span>
                </div>
              </div>
            )}

            {formData.ipType === 'trademark' && (
              <div className="calc-extra-inputs">
                <div className="calc-input-group">
                  <label>Number of Classes</label>
                  <input
                    type="number"
                    min="1"
                    max="45"
                    value={formData.classes}
                    onChange={e => updateForm('classes', parseInt(e.target.value) || 1)}
                  />
                  <span className="calc-input-hint">Each class incurs separate filing fee</span>
                </div>
              </div>
            )}

            {formData.jurisdiction === 'wipo' && (
              <div className="calc-extra-inputs">
                <div className="calc-input-group">
                  <label>Number of Countries</label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={formData.countries}
                    onChange={e => updateForm('countries', parseInt(e.target.value) || 1)}
                  />
                  <span className="calc-input-hint">Designation fees apply per country</span>
                </div>
              </div>
            )}
          </div>
        )

      case 3:
        return (
          <div className="calc-step">
            <h2 className="calc-step-title">
              <span className="calc-step-number">3</span>
              Applicant Category
            </h2>
            <p className="calc-step-desc">Startups and individuals get significant fee discounts in India!</p>

            <div className="calc-applicant-grid">
              {APPLICANT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`calc-applicant-card ${formData.applicantCategory === cat.id ? 'selected' : ''}`}
                  onClick={() => updateForm('applicantCategory', cat.id)}
                >
                  <div className="calc-a-header">
                    <span className="calc-a-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {renderApplicantIcon(cat.id)}
                    </span>
                    <span className="calc-a-name">{cat.name}</span>
                  </div>
                  <span className="calc-a-desc">{cat.description}</span>
                  {cat.discount < 1 && (
                    <span className="calc-a-discount">
                      {Math.round((1 - cat.discount) * 100)}% Fee Concession
                    </span>
                  )}
                  {formData.applicantCategory === cat.id && (
                    <span className="calc-a-check" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck size={14} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="calc-filing-type">
              <label className="calc-label">Filing Type</label>
              <div className="calc-filing-options">
                {FILING_TYPES.slice(0, 3).map(ft => (
                  <button
                    key={ft.id}
                    className={`calc-filing-btn ${formData.filingType === ft.id ? 'selected' : ''}`}
                    onClick={() => updateForm('filingType', ft.id)}
                  >
                    {ft.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="calc-step">
            <h2 className="calc-step-title">
              <span className="calc-step-number">4</span>
              Professional Services
            </h2>
            <p className="calc-step-desc">Select optional services you may need (recommended services are highlighted)</p>

            <div className="calc-services-grid">
              {PROFESSIONAL_SERVICES.map(service => (
                <button
                  key={service.id}
                  className={`calc-service-card ${formData.services.includes(service.id) ? 'selected' : ''} ${service.recommended ? 'recommended' : ''}`}
                  onClick={() => toggleService(service.id)}
                >
                  <div className="calc-s-header">
                    <span className="calc-s-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {renderServiceIcon(service.id)}
                    </span>
                    <span className="calc-s-name">{service.name}</span>
                    {service.recommended && <span className="calc-s-badge">Recommended</span>}
                  </div>
                  <span className="calc-s-desc">{service.description}</span>
                  <span className="calc-s-time" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <IconCalendar size={13} /> {service.estimatedTime}
                  </span>
                  {formData.services.includes(service.id) && (
                    <span className="calc-s-check" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck size={14} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )

      case 5:
        return (
          <div className="calc-step">
            <h2 className="calc-step-title">
              <span className="calc-step-number">5</span>
              Review & Calculate
            </h2>
            <p className="calc-step-desc">Review your selections before calculating the estimate</p>

            <div className="calc-review-card">
              <div className="calc-review-grid">
                <div className="calc-review-item">
                  <span className="calc-r-label">IP Type</span>
                  <span className="calc-r-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {renderIpTypeIcon(formData.ipType)} {IP_TYPES.find(t => t.id === formData.ipType)?.name}
                  </span>
                </div>
                <div className="calc-review-item">
                  <span className="calc-r-label">Jurisdiction</span>
                  <span className="calc-r-value">
                    [{JURISDICTIONS.find(j => j.id === formData.jurisdiction)?.flag}] {JURISDICTIONS.find(j => j.id === formData.jurisdiction)?.name}
                  </span>
                </div>
                <div className="calc-review-item">
                  <span className="calc-r-label">Applicant</span>
                  <span className="calc-r-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {renderApplicantIcon(formData.applicantCategory)} {APPLICANT_CATEGORIES.find(c => c.id === formData.applicantCategory)?.name}
                  </span>
                </div>
                <div className="calc-review-item">
                  <span className="calc-r-label">Filing Type</span>
                  <span className="calc-r-value">
                    {FILING_TYPES.find(f => f.id === formData.filingType)?.name}
                  </span>
                </div>
                {formData.ipType === 'patent' && (
                  <>
                    <div className="calc-review-item">
                      <span className="calc-r-label">Claims</span>
                      <span className="calc-r-value">{formData.claims}</span>
                    </div>
                    <div className="calc-review-item">
                      <span className="calc-r-label">Pages</span>
                      <span className="calc-r-value">{formData.pages}</span>
                    </div>
                  </>
                )}
                {formData.ipType === 'trademark' && (
                  <div className="calc-review-item">
                    <span className="calc-r-label">Classes</span>
                    <span className="calc-r-value">{formData.classes}</span>
                  </div>
                )}
                {formData.jurisdiction === 'wipo' && (
                  <div className="calc-review-item">
                    <span className="calc-r-label">Countries</span>
                    <span className="calc-r-value">{formData.countries}</span>
                  </div>
                )}
              </div>

              {formData.services.length > 0 && (
                <div className="calc-review-services">
                  <span className="calc-r-label">Selected Services</span>
                  <div className="calc-r-services-list">
                    {formData.services.map(sId => {
                      const service = PROFESSIONAL_SERVICES.find(s => s.id === sId)
                      return (
                        <span key={sId} className="calc-r-service-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          {renderServiceIcon(service?.id)} {service?.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // Render results
  const renderResults = () => {
    if (!estimate) return null

    const govtTotal = estimate.governmentFees.total
    const profMin = estimate.professionalFees.min
    const profMax = estimate.professionalFees.max

    // Chart data for donut
    const chartData = [
      { label: 'Government Fees', value: govtTotal, color: '#143D30' },
      { label: 'Professional Fees', value: profMin, color: '#3D705E' },
    ]
    const chartTotal = chartData.reduce((sum, d) => sum + d.value, 0)

    return (
      <div className="calc-results">
        <div className="calc-results-header">
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <IconTrendingUp size={22} /> Cost Estimate Results
          </h2>
          <p>For {estimate.ipType?.name} filing in {estimate.jurisdiction?.name}</p>
        </div>

        {/* Total Cost Card */}
        <div className="calc-total-card">
          <div className="calc-total-label">Recommended Budget</div>
          <div className="calc-total-amount">{formatCurrency(estimate.summary.recommendedBudget)}</div>
          <div className="calc-total-range">
            Range: {formatCurrency(estimate.summary.minTotal)} - {formatCurrency(estimate.summary.maxTotal)}
          </div>
        </div>

        {/* Summary Grid */}
        <div className="calc-summary-grid">
          <div className="calc-summary-card">
            <span className="calc-sum-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCurrencyRupee size={20} />
            </span>
            <span className="calc-sum-label">One-Time Costs</span>
            <span className="calc-sum-value">{formatCurrency(estimate.summary.oneTimeCosts)}</span>
          </div>
          <div className="calc-summary-card">
            <span className="calc-sum-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconRotate size={20} />
            </span>
            <span className="calc-sum-label">Recurring (Annual)</span>
            <span className="calc-sum-value">{formatCurrency(estimate.summary.recurringCosts)}</span>
          </div>
          <div className="calc-summary-card">
            <span className="calc-sum-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconGovt size={20} />
            </span>
            <span className="calc-sum-label">Government Fees</span>
            <span className="calc-sum-value">{formatCurrency(govtTotal)}</span>
          </div>
          <div className="calc-summary-card">
            <span className="calc-sum-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBriefcase size={20} />
            </span>
            <span className="calc-sum-label">Professional Fees</span>
            <span className="calc-sum-value">{formatCurrency(profMin)} - {formatCurrency(profMax)}</span>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="calc-chart-section">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <IconTrendingUp size={18} /> Cost Distribution
          </h3>
          <div className="calc-chart-container">
            {/* Simple Bar Chart */}
            <div className="calc-bar-chart">
              {chartData.map((item, idx) => (
                <div key={idx} className="calc-bar-item">
                  <div className="calc-bar-label">{item.label}</div>
                  <div className="calc-bar-track">
                    <div
                      className="calc-bar-fill"
                      style={{
                        width: `${chartTotal > 0 ? (item.value / chartTotal * 100) : 0}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                  <div className="calc-bar-value">{formatCurrency(item.value)}</div>
                  <div className="calc-bar-percent">
                    {chartTotal > 0 ? Math.round(item.value / chartTotal * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>

            {/* Donut Chart */}
            <div className="calc-donut-chart">
              <svg viewBox="0 0 100 100" className="calc-donut-svg">
                {chartData.reduce((acc, item, idx) => {
                  const percent = chartTotal > 0 ? (item.value / chartTotal * 100) : 0
                  const offset = acc.offset
                  acc.offset += percent
                  acc.elements.push(
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="15"
                      strokeDasharray={`${percent * 2.51} ${251 - percent * 2.51}`}
                      strokeDashoffset={-offset * 2.51}
                      style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                  )
                  return acc
                }, { elements: [], offset: 0 }).elements}
              </svg>
              <div className="calc-donut-center">
                <span className="calc-donut-total">{formatCurrency(chartTotal)}</span>
                <span className="calc-donut-label">Total</span>
              </div>
            </div>
          </div>

          {/* Chart Legend */}
          <div className="calc-chart-legend">
            {chartData.map((item, idx) => (
              <div key={idx} className="calc-legend-item">
                <span className="calc-legend-dot" style={{ backgroundColor: item.color }} />
                <span className="calc-legend-label">{item.label}</span>
                <span className="calc-legend-value">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="calc-breakdown-section">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <IconGovt size={18} /> Government Fees Breakdown
          </h3>
          <div className="calc-breakdown-table">
            {estimate.governmentFees.breakdown.map((item, idx) => (
              <div key={idx} className="calc-breakdown-row">
                <span className="calc-b-name">{item.name}</span>
                <span className="calc-b-amount">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="calc-breakdown-row total">
              <span className="calc-b-name">Total Government Fees</span>
              <span className="calc-b-amount">{formatCurrency(govtTotal)}</span>
            </div>
          </div>
        </div>

        {estimate.professionalFees.breakdown.length > 0 && (
          <div className="calc-breakdown-section">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <IconBriefcase size={18} /> Professional Services Breakdown
            </h3>
            <div className="calc-breakdown-table">
              {estimate.professionalFees.breakdown.map((item, idx) => (
                <div key={idx} className="calc-breakdown-row">
                  <span className="calc-b-name">{item.name}</span>
                  <span className="calc-b-amount">{formatCurrency(item.min)} - {formatCurrency(item.max)}</span>
                </div>
              ))}
              <div className="calc-breakdown-row total">
                <span className="calc-b-name">Total Professional Fees</span>
                <span className="calc-b-amount">{formatCurrency(profMin)} - {formatCurrency(profMax)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="calc-timeline-section">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <IconCalendar size={18} /> Estimated Timeline
          </h3>
          <div className="calc-timeline-card">
            <span className="calc-timeline-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCalendar size={18} />
            </span>
            <span className="calc-timeline-value">{estimate.summary.timeline}</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="calc-disclaimer">
          <span className="calc-disclaimer-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconAlertTriangle size={18} />
          </span>
          <p>{estimate.disclaimer}</p>
        </div>

        {/* Actions */}
        <div className="calc-results-actions">
          <button className="calc-btn-primary" onClick={handleExportCostPdf} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <IconFileText size={16} /> Download PDF Report
          </button>
          <button className="calc-btn-secondary" onClick={handleReset} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <IconRotate size={16} /> Start New Calculation
          </button>
          <Link to="/chat" className="calc-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <IconMessageSquare size={16} /> Ask IP Expert
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container calc-page">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      {showIntro ? (
        <ToolIntro
          config={TOOL_INTRO_CONFIGS['ip-calculator']}
          icon={<IconCalculator size={28} />}
          onStart={() => setShowIntro(false)}
          backTo="/"
          backLabel="Back to Portal"
        />
      ) : (
        <>
          <header className="page-header" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="chip" style={{ background: 'var(--color-primary-light, #eaf2ed)', color: 'var(--color-primary, #143D30)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <IconCalculator size={14} /> IP Cost Calculator
              </span>
              <button
                type="button"
                className="tool-guide-return-btn"
                onClick={() => setShowIntro(true)}
                title="View tool overview & instructions"
              >
                <IconInfo size={14} />
                <span>Tool Overview & Guide</span>
              </button>
            </div>
            <h1 className="page-title">IP Filing Cost Estimator</h1>
            <p className="page-subtitle">
              Get transparent cost estimates for Patents, Trademarks, Copyrights, Industrial Designs & GI Tags
            </p>
          </header>

      <main className="calc-main">
        {/* Tools: Quick Patent Fee Calculator (Patents Rules 2003, First Schedule) */}
        <PatentFeeCalculator />

        {currentStep <= TOTAL_STEPS ? (
          <>
            {/* Progress Bar */}
            <div className="calc-progress">
              <div className="calc-progress-bar">
                <div
                  className="calc-progress-fill"
                  style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
                />
              </div>
              <div className="calc-progress-steps">
                {[1, 2, 3, 4, 5].map(step => (
                  <div
                    key={step}
                    className={`calc-progress-step ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
                  >
                    <span className="calc-step-dot" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {currentStep > step ? <IconCheck size={14} /> : step}
                    </span>
                    <span className="calc-step-label">
                      {step === 1 && 'IP Type'}
                      {step === 2 && 'Jurisdiction'}
                      {step === 3 && 'Applicant'}
                      {step === 4 && 'Services'}
                      {step === 5 && 'Review'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="calc-content">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="calc-nav">
              <button
                className="calc-btn-back"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                ← Back
              </button>

              {currentStep < TOTAL_STEPS ? (
                <button
                  className="calc-btn-next"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="calc-btn-calculate"
                  onClick={handleCalculate}
                  disabled={isCalculating || !canProceed()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  {isCalculating ? (
                    <>
                      <span className="calc-spinner" /> Calculating...
                    </>
                  ) : (
                    <>Calculate Estimate →</>
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          renderResults()
        )}
      </main>
        </>
      )}
    </div>
  )
}

/* ============================================================
   SOURCES DIRECTORY PAGE
   ============================================================ */
function SourcesPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  const { t } = useLanguage()
  const SOURCES = [
    {
      icon: <IconGovt size={24} />,
      name: 'India Code statutory archive',
      tag: 'Statute Corpus',
      desc: 'Official repository of Indian legislation including Patents Act 1970, Biological Diversity Act 2002, and Drugs & Cosmetics Act 1940.',
      url: 'https://indiacode.nic.in/',
    },
    {
      icon: <IconTag size={24} />,
      name: 'IP India Patent & Design Office',
      tag: 'Patent Office',
      desc: 'Official portal of the Controller General of Patents, Designs & Trade Marks (CGPDTM) detailing examination guidelines.',
      url: 'https://ipindia.gov.in/',
    },
    {
      icon: <IconBook size={24} />,
      name: 'TKDL (Traditional Knowledge Digital Library)',
      tag: 'Prior Art DB',
      desc: 'Joint initiative of CSIR and Ministry of AYUSH mapping traditional formulas to prevent international biopiracy.',
      url: 'https://www.tkdl.res.in/',
    },
    {
      icon: <IconGlobe size={24} />,
      name: 'WIPO Patentscope',
      tag: 'Patent Database',
      desc: 'WIPO’s global patent search service for published PCT applications and international patent documents.',
      url: 'https://patentscope.wipo.int/search/en/search.jsf',
    },
    {
      icon: <IconGlobe size={24} />,
      name: 'WIPO GRATK Treaty (2024)',
      tag: 'International Law',
      desc: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge establishing disclosure rules.',
      url: 'https://www.wipo.int/',
    },
    {
      icon: <IconFileText size={24} />,
      name: 'Nagoya Protocol on ABS',
      tag: 'Treaty Corpus',
      desc: 'Global treaty under the Convention on Biological Diversity governing fair access and equitable benefit-sharing.',
      url: 'https://www.cbd.int/abs/',
    },
    {
      icon: <IconLeaf size={24} />,
      name: 'Ministry of AYUSH Regulatory Portal',
      tag: 'AYUSH Rules',
      desc: 'Official AYUSH guidelines including Rule 158-B licensing parameters and Ayurveda Aahar regulations.',
      url: 'https://ayush.gov.in/',
    },
  ]

  return (
    <div className="page-container">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      <header className="page-header">
        <span className="chip" style={{ background: 'rgba(217, 119, 6, 0.2)', color: 'var(--primary-light)', marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconBook size={14} /> {t('sourcesChipLabel')}
        </span>
        <h1 className="page-title">{t('sourcesPageTitle')}</h1>
        <p className="page-subtitle">{t('sourcesPageSubtitle')}</p>
      </header>

      <main className="sources-grid">
        {SOURCES.map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="source-card">
            <div className="source-header">
              <span className="source-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</span>
              <div>
                <div className="source-title">{s.name}</div>
                <span className="source-tag">{s.tag}</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {s.desc}
            </p>
            <span style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 500 }}>
              Visit Official Source ↗
            </span>
          </a>
        ))}
      </main>
    </div>
  )
}

/* ============================================================
   PRIVACY POLICY PAGE
   ============================================================ */
function PrivacyPolicyPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  const { t } = useLanguage()

  return (
    <div className="page-container">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      <header className="page-header">
        <span className="chip" style={{ background: 'var(--color-primary-light, #eaf2ed)', color: 'var(--color-primary, #143D30)', marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconLock size={13} /> {t('privacyLegal')}
        </span>
        <h1 className="page-title">{t('privacyTitle')}</h1>
        <p className="page-subtitle">
          {t('privacyLastUpdated')}
        </p>
      </header>

      <main className="privacy-content">
        <Reveal>
          <section className="privacy-section">
            <h2>{t('privacyIntroTitle')}</h2>
            <p>{t('privacyIntroText')}</p>
          </section>
        </Reveal>

        <Reveal delay={50}>
          <section className="privacy-section">
            <h2>{t('privacyDataTitle')}</h2>
            <h3>{t('privacyDataProvided')}</h3>
            <ul>
              <li><strong>{t('privacyQueryData')}:</strong> {t('privacyQueryDataDesc')}</li>
              <li><strong>{t('privacyAccountInfo')}:</strong> {t('privacyAccountInfoDesc')}</li>
              <li><strong>{t('privacyFeedback')}:</strong> {t('privacyFeedbackDesc')}</li>
            </ul>
            <h3>{t('privacyDataAuto')}</h3>
            <ul>
              <li><strong>{t('privacyUsageData')}:</strong> {t('privacyUsageDataDesc')}</li>
              <li><strong>{t('privacyDeviceInfo')}:</strong> {t('privacyDeviceInfoDesc')}</li>
              <li><strong>{t('privacyLangPref')}:</strong> {t('privacyLangPrefDesc')}</li>
            </ul>
          </section>
        </Reveal>

        <Reveal delay={100}>
          <section className="privacy-section">
            <h2>{t('privacyUseTitle')}</h2>
            <ul>
              <li>{t('privacyUse1')}</li>
              <li>{t('privacyUse2')}</li>
              <li>{t('privacyUse3')}</li>
              <li>{t('privacyUse4')}</li>
              <li>{t('privacyUse5')}</li>
            </ul>
          </section>
        </Reveal>

        <Reveal delay={150}>
          <section className="privacy-section">
            <h2>{t('privacyStorageTitle')}</h2>
            <p>{t('privacyStorageText')}</p>
            <div className="privacy-highlight">
              <span style={{ display: 'flex', color: 'var(--primary-light)' }}><IconShieldCheck size={20} /></span>
              <p>{t('privacyNoSell')}</p>
            </div>
          </section>
        </Reveal>

        <Reveal delay={200}>
          <section className="privacy-section">
            <h2>{t('privacyRetentionTitle')}</h2>
            <p>{t('privacyRetentionText')}</p>
          </section>
        </Reveal>

        <Reveal delay={250}>
          <section className="privacy-section">
            <h2>{t('privacyRightsTitle')}</h2>
            <p>{t('privacyRightsIntro')}</p>
            <ul>
              <li><strong>{t('privacyRightAccess')}:</strong> {t('privacyRightAccessDesc')}</li>
              <li><strong>{t('privacyRightCorrection')}:</strong> {t('privacyRightCorrectionDesc')}</li>
              <li><strong>{t('privacyRightErasure')}:</strong> {t('privacyRightErasureDesc')}</li>
              <li><strong>{t('privacyRightPortability')}:</strong> {t('privacyRightPortabilityDesc')}</li>
              <li><strong>{t('privacyRightWithdraw')}:</strong> {t('privacyRightWithdrawDesc')}</li>
            </ul>
          </section>
        </Reveal>

        <Reveal delay={300}>
          <section className="privacy-section">
            <h2>{t('privacyThirdPartyTitle')}</h2>
            <p>{t('privacyThirdPartyText')}</p>
          </section>
        </Reveal>

        <Reveal delay={350}>
          <section className="privacy-section">
            <h2>{t('privacyCookiesTitle')}</h2>
            <p>{t('privacyCookiesText')}</p>
          </section>
        </Reveal>

        <Reveal delay={400}>
          <section className="privacy-section">
            <h2>{t('privacyContactTitle')}</h2>
            <p>{t('privacyContactIntro')}</p>
            <div className="contact-card">
              <p><strong>{t('privacyEmail')}:</strong> privacy@ipsakti.gov.in</p>
              <p><strong>{t('privacyAddress')}:</strong> {t('privacyAddressValue')}</p>
            </div>
          </section>
        </Reveal>

        <Reveal delay={450}>
          <section className="privacy-section">
            <h2>{t('privacyChangesTitle')}</h2>
            <p>{t('privacyChangesText')}</p>
          </section>
        </Reveal>
      </main>

      <TranslatedFooter />
    </div>
  )
}

/* ============================================================
   AUTH CALLBACK PAGE - Handles OAuth redirects
   ============================================================ */
function AuthCallbackPage({ onLogin }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(true)
  const API_BASE = getApiBase()

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get tokens from URL params
        const params = new URLSearchParams(window.location.search)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const errorParam = params.get('error')

        if (errorParam) {
          // Handle OAuth errors
          const errorMessages = {
            'invalid_state': 'Security verification failed. Please try again.',
            'oauth_not_configured': 'Google login is not configured.',
            'token_exchange_failed': 'Failed to complete login. Please try again.',
            'userinfo_failed': 'Failed to get user info from Google.',
            'oauth_error': 'An error occurred during login. Please try again.',
            'no_email': 'No email received from Google.',
            'account_deactivated': 'Your account has been deactivated.'
          }
          setError(errorMessages[errorParam] || 'Login failed. Please try again.')
          setProcessing(false)
          return
        }

        if (!accessToken) {
          setError('No authentication token received.')
          setProcessing(false)
          return
        }

        // Store tokens
        localStorage.setItem('ip_sakti_access_token', accessToken)
        if (refreshToken) {
          localStorage.setItem('ip_sakti_refresh_token', refreshToken)
        }

        // Get user info with the token
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const user = await response.json()
          localStorage.setItem('ip_sakti_user', JSON.stringify(user))
          
          // Trigger login
          onLogin(user.email, user.full_name || user.email.split('@')[0])
          
          // Redirect to home
          navigate('/')
        } else {
          setError('Failed to verify login. Please try again.')
          setProcessing(false)
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setError('An error occurred. Please try again.')
        setProcessing(false)
      }
    }

    handleOAuthCallback()
  }, [navigate, onLogin])

  if (processing) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 50%, #1a472a 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid #d4af37',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '24px'
        }} />
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Completing sign in...</h2>
        <p style={{ opacity: 0.8, marginTop: '8px' }}>Please wait</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Error state
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 50%, #1a472a 100%)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(220, 53, 69, 0.2)',
        border: '1px solid rgba(220, 53, 69, 0.5)',
        borderRadius: '12px',
        padding: '24px 32px',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '1.25rem' }}>Login Failed</h2>
        <p style={{ opacity: 0.9, margin: '0 0 24px 0' }}>{error}</p>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: '#d4af37',
            color: '#1a472a',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 32px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   LOGIN PAGE
   ============================================================ */
function LoginPage({ theme, toggleTheme, fontSize, setFontSize, onLogin }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organization, setOrganization] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [], isValid: false })
  const [showStrengthMeter, setShowStrengthMeter] = useState(false)

  // Theme props available for future use
  void theme; void toggleTheme; void fontSize; void setFontSize;

  // Password strength checker
  const checkPasswordStrength = (pwd) => {
    const feedback = []
    let score = 0
    
    if (pwd.length >= 8) score += 1
    else feedback.push('At least 8 characters')
    
    if (pwd.length >= 12) score += 1
    
    if (/[A-Z]/.test(pwd)) score += 1
    else feedback.push('At least 1 uppercase letter')
    
    if (/[a-z]/.test(pwd)) score += 1
    else feedback.push('At least 1 lowercase letter')
    
    if (/\d/.test(pwd)) score += 1
    else feedback.push('At least 1 number')
    
    if (/[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\;'`~]/.test(pwd)) score += 1
    else feedback.push('At least 1 special character')
    
    const commonPatterns = ['password', '123456', 'qwerty', 'abc123', 'letmein', 'welcome', 'admin']
    if (commonPatterns.some(p => pwd.toLowerCase().includes(p))) {
      feedback.push('Avoid common patterns')
      score = Math.max(0, score - 2)
    }
    
    return { score: Math.min(5, score), feedback, isValid: feedback.length === 0 }
  }

  const handlePasswordChange = (e) => {
    const pwd = e.target.value
    setPassword(pwd)
    if (isRegister && pwd) {
      setShowStrengthMeter(true)
      setPasswordStrength(checkPasswordStrength(pwd))
    } else {
      setShowStrengthMeter(false)
    }
  }

  const getStrengthLabel = (score) => {
    if (score <= 1) return { label: 'Weak', color: '#ef4444' }
    if (score <= 2) return { label: 'Fair', color: '#f97316' }
    if (score <= 3) return { label: 'Good', color: '#eab308' }
    if (score <= 4) return { label: 'Strong', color: '#22c55e' }
    return { label: 'Very Strong', color: '#10b981' }
  }

  const API_BASE = getApiBase()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    // Validate password strength for registration
    if (isRegister && !passwordStrength.isValid) {
      setError('Please fix password issues: ' + passwordStrength.feedback.join(', '))
      setIsLoading(false)
      return
    }

    try {
      const endpoint = isRegister ? '/api/auth/signup' : '/api/auth/login'
      const payload = isRegister 
        ? { email, password, full_name: fullName, organization: organization || null }
        : { email, password }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed')
      }

      // Store tokens and user data
      localStorage.setItem('ip_sakti_access_token', data.tokens.access_token)
      localStorage.setItem('ip_sakti_refresh_token', data.tokens.refresh_token)
      localStorage.setItem('ip_sakti_user', JSON.stringify(data.user))
      
      // Call the onLogin callback
      onLogin(data.user.email, data.user.full_name)
      
      setSuccess(data.message)
      
      // Navigate after short delay
      setTimeout(() => navigate('/'), 1000)
      
    } catch (err) {
      console.error('Auth error:', err)
      // Provide user-friendly error messages
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError('Cannot connect to server. Please make sure the backend is running on port 8000.')
      } else {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider) => {
    if (provider === 'apple') {
      setError('Apple login coming soon! Please use Google or email/password for now.')
      return
    }
    
    // Google OAuth
    setIsLoading(true)
    setError('')
    
    try {
      // Get OAuth URL from backend
      const response = await fetch(`${API_BASE}/api/auth/google/url`)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to initiate Google login')
      }
      
      const data = await response.json()
      
      // Redirect to Google OAuth consent screen
      window.location.href = data.url
    } catch (err) {
      console.error('Google OAuth error:', err)
      if (err.message.includes('Failed to fetch')) {
        setError('Backend not running. Start it with: python -m uvicorn app.main:app --reload --port 8000')
      } else {
        setError(err.message || 'Failed to start Google login. Please try email/password.')
      }
      setIsLoading(false)
    }
  }

  // Password strength meter component
  const PasswordStrengthMeter = () => {
    if (!showStrengthMeter || !password) return null
    
    const { label, color } = getStrengthLabel(passwordStrength.score)
    const percentage = (passwordStrength.score / 5) * 100
    
    return (
      <div className="password-strength-meter">
        <div className="strength-bar-container">
          <div 
            className="strength-bar-fill" 
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
        <div className="strength-info">
          <span className="strength-label" style={{ color }}>{label}</span>
          {passwordStrength.feedback.length > 0 && (
            <ul className="strength-feedback">
              {passwordStrength.feedback.map((item, i) => (
                <li key={i} className="feedback-item">
                  <span className="feedback-x">✕</span> {item}
                </li>
              ))}
            </ul>
          )}
          {passwordStrength.isValid && (
            <div className="strength-valid">
              <span className="feedback-check">✓</span> Password meets all requirements
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Panel - Branding */}
        <div className="login-branding">
          <div className="login-brand-content">
            <Link to="/" className="login-logo">
              <IpSaktiLogo className="login-logo-svg" size={64} />
              <span className="login-logo-text">IP-SAKTI Sahayak</span>
            </Link>

            <h1 className="login-brand-title">
              {t('heroSubtitle')}
            </h1>

            <div className="login-features">
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={14} /></span>
                <span>{t('zeroHallucination')}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={14} /></span>
                <span>{t('sourceCited')}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={14} /></span>
                <span>{t('multiLanguage')}</span>
              </div>
            </div>

            <div className="login-govt-badge">
              <span style={{ display: 'flex' }}><IconGovt size={16} /></span>
              <span>{t('ministry')} · {t('govtOf')}</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="login-form-panel">
          <div className="login-form-container">
            <div className="login-form-header">
              <h2>{isRegister ? t('registerTitle') : t('loginTitle')}</h2>
              <p>{isRegister ? t('registerSubtitle') : t('loginSubtitle')}</p>
            </div>

            {/* Google Login Button - Full Width Premium Style */}
            <button
              type="button"
              className="login-google-btn-premium"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>{t('loginWithGoogle')}</span>
            </button>

            {/* Divider */}
            <div className="login-divider">
              <span>{t('orContinueWith')}</span>
            </div>

            {/* Error/Success Messages */}
            {error && <div className="login-error">{error}</div>}
            {success && <div className="login-success">{success}</div>}

            {/* Form */}
            <form onSubmit={handleSubmit} className="login-form">
              {isRegister && (
                <div className="login-field">
                  <label htmlFor="fullName">{t('fullNameLabel')}</label>
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('fullNamePlaceholder')}
                    required={isRegister}
                    disabled={isLoading}
                  />
                </div>
              )}

              {isRegister && (
                <div className="login-field">
                  <label htmlFor="organization">Organization (Optional)</label>
                  <input
                    type="text"
                    id="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Company, University, or Firm"
                    disabled={isLoading}
                  />
                </div>
              )}

              <div className="login-field">
                <label htmlFor="email">{t('emailLabel')}</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  required
                  disabled={isLoading}
                  aria-label={t('emailLabel')}
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">{t('passwordLabel')}</label>
                <div className="login-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder={isRegister ? 'Min 8 chars, upper, lower, number, special' : t('passwordPlaceholder')}
                    required
                    disabled={isLoading}
                    aria-label={t('passwordLabel')}
                    minLength={isRegister ? 8 : undefined}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
                <PasswordStrengthMeter />
              </div>

              {!isRegister && (
                <a href="#" className="login-forgot">{t('forgotPassword')}</a>
              )}

              <button
                type="submit"
                className="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading
                  ? (isRegister ? t('creating') : t('signingIn'))
                  : (isRegister ? t('registerButton') : t('signInButton'))
                }
              </button>
            </form>

            {/* Toggle */}
            <div className="login-toggle">
              <span>{isRegister ? t('haveAccount') : t('noAccount')}</span>
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
              >
                {isRegister ? t('signInHere') : t('registerHere')}
              </button>
            </div>

            {/* Terms */}
            <p className="login-terms">
              {t('termsNote')} <Link to="/privacy">{t('termsLink')}</Link> {t('andText')} <Link to="/privacy">{t('privacyLink')}</Link>
            </p>

            {/* Security Badge */}
            <div className="login-security" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconLock size={14} />
              <span>{t('secureLogin')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   PROTECTED ROUTE COMPONENT
   ============================================================ */
function ProtectedRoute({ children, isLoggedIn }) {
  const { t } = useLanguage()

  if (!isLoggedIn) {
    return (
      <div className="protected-route-message">
        <div className="protected-content">
          <span className="protected-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconLock size={32} />
          </span>
          <h2>{t('loginTitle')}</h2>
          <p>Please login to access the AI consultation feature.</p>
          <Link to="/login" className="btn-primary">
            {t('loginOrRegister')} →
          </Link>
        </div>
      </div>
    )
  }

  return children
}

/* ============================================================
   MAIN APP ROUTER
   ============================================================ */
export default function App() {
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [prefillPrompt, setPrefillPrompt] = useState('')
  const { theme, toggleTheme } = useTheme()
  const { fontSize, setFontSize } = useFontSize()

  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('ip_sakti_logged_in') === 'true'
  })
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('ip_sakti_user_name') || ''
  })

  const handleLogin = (email, name) => {
    setIsLoggedIn(true)
    setUserName(name)
    localStorage.setItem('ip_sakti_logged_in', 'true')
    localStorage.setItem('ip_sakti_user_name', name)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserName('')
    localStorage.removeItem('ip_sakti_logged_in')
    localStorage.removeItem('ip_sakti_user_name')
    localStorage.removeItem('ip_sakti_access_token')
    localStorage.removeItem('ip_sakti_refresh_token')
    localStorage.removeItem('ip_sakti_user')
    localStorage.removeItem('ip_sakti_logged_in')
    localStorage.removeItem('ip_sakti_user_name')
  }

  const handleAskChatFromWizard = (prompt) => {
    setPrefillPrompt(prompt)
    window.location.hash = ''
  }

  return (
    <LanguageProvider>
      <BrowserRouter>
        <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
        <AccessibilityPanel hideFab={true} />
        <FormulationWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onAskChat={handleAskChatFromWizard}
        />

        <Routes>
          <Route
            path="/"
            element={
              <LandingPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
                setPrefillPrompt={setPrefillPrompt}
                isLoggedIn={isLoggedIn}
                userName={userName}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <ChatPage
                  onOpenAbout={() => setIsAboutOpen(true)}
                  onOpenWizard={() => setIsWizardOpen(true)}
                  prefillPrompt={prefillPrompt}
                  setPrefillPrompt={setPrefillPrompt}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/abs-checker"
            element={
              <ABSCheckerPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
                setPrefillPrompt={setPrefillPrompt}
              />
            }
          />
          <Route
            path="/sources"
            element={
              <SourcesPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
                setPrefillPrompt={setPrefillPrompt}
              />
            }
          />
          <Route
            path="/privacy"
            element={
              <PrivacyPolicyPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
              />
            }
          />
          <Route
            path="/ip-calculator"
            element={
              <IPCostCalculatorPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
              />
            }
          />
          <Route
            path="/deadline-calculator"
            element={
              <DeadlineCalculatorPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
              />
            }
          />
          <Route
            path="/drafts"
            element={
              <DraftsPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
                isLoggedIn={isLoggedIn}
                userName={userName}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/login"
            element={
              <LoginPage
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
                onLogin={handleLogin}
              />
            }
          />
          <Route
            path="/workspace"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <WorkspacePage
                  onOpenAbout={() => setIsAboutOpen(true)}
                  onOpenWizard={() => setIsWizardOpen(true)}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  isLoggedIn={isLoggedIn}
                  userName={userName}
                  onLogout={handleLogout}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <DocumentsPage
                  onOpenAbout={() => setIsAboutOpen(true)}
                  onOpenWizard={() => setIsWizardOpen(true)}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/auth/callback"
            element={
              <AuthCallbackPage onLogin={handleLogin} />
            }
          />
          <Route
            path="/patentability"
            element={
              <PatentabilityAssessment />
            }
          />
          <Route
            path="/verdict"
            element={
              <VerdictEngine />
            }
          />
          <Route
            path="/roadmap"
            element={
              <IPJourneyRoadmap />
            }
          />
          <Route
            path="/guardian"
            element={
              <DualUseGuardian />
            }
          />
          <Route
            path="/checklists"
            element={
              <IPChecklist />
            }
          />
          <Route
            path="/experts"
            element={
              <ExpertConnectPage
                onOpenAbout={() => setIsAboutOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
                theme={theme}
                toggleTheme={toggleTheme}
                fontSize={fontSize}
                setFontSize={setFontSize}
                isLoggedIn={isLoggedIn}
                userName={userName}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/pricing"
            element={
              <PricingPage />
            }
          />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
