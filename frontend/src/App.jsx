import { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom'
import './index.css'

/* ============================================================
   GLOBAL LANGUAGE CONTEXT & TRANSLATIONS
   ============================================================ */
const SITE_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ml', label: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
]

// Complete translations for all UI text
const UI_TRANSLATIONS = {
  en: {
    // Government Header
    govtOf: 'Government of India',
    ministry: 'Ministry of AYUSH',
    searchPlaceholder: 'Search portal...',
    
    // Navbar
    home: 'Home',
    absChecker: 'ABS Checker',
    ipCalculator: 'IP Calculator',
    officialSources: 'Official Sources',
    aboutPortal: 'About Portal',
    consultAssistant: 'Consult IP Assistant',
    
    // Hero Section
    heroEyebrow: 'Ministry of AYUSH · Government of India Initiative',
    heroTitle: 'IP-SAKTI Sahayak',
    heroSubtitle: 'Your Trusted Guide to Ayurvedic Intellectual Property',
    heroDesc: 'A multilingual, source-cited AI assistant helping Vaidyas, AYUSH startups, researchers and cultivators navigate patents, trademarks, GI tags and biodiversity compliance.',
    heroDescBold: ' Grounded in official statutes, never guessing.',
    startConsultation: 'Start Consultation',
    formulationWizard: 'Formulation Wizard',
    seeDemo: 'See Demo',
    
    // Trust Pills
    zeroHallucination: 'Zero-hallucination',
    sourceCited: 'Source-cited',
    multiLanguage: '10+ Languages',
    indiaIntl: 'India & International',
    
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
    moreQuestions: 'Have more questions? Ask our AI assistant!',
    askIpSakti: 'Ask IP-SAKTI',
    
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
    aboutSubtitle: 'Intellectual Property Assistant',
    closeModal: 'Close modal',
    aboutPurposeTitle: 'Purpose & Vision',
    aboutPurposeText: 'IP-SAKTI Sahayak (Smart Ayurveda Knowledge & Technology Initiative) is an AI-powered legal and regulatory assistant created for the Ministry of AYUSH. It bridges the gap between complex Indian Intellectual Property laws, Traditional Knowledge preservation, and biological diversity compliance.',
    aboutGroundingTitle: 'Grounding Policy & Zero Hallucination',
    aboutGroundingText: 'Every response is strictly grounded in official statutory corpora. If relevant legal context is missing, the assistant abstains rather than inventing legal advice. All answers include section citations, database links, and confidence ratings.',
    aboutCorporaTitle: 'Core Ingested Corpora',
    aboutDisclaimer: 'IP-SAKTI Sahayak is an informational research tool for AYUSH innovators and Vaidyas. It does not replace professional legal representation before the Controller General of Patents or High Courts.',
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
    logout: 'Logout',
    dashboard: 'Dashboard',
    welcomeBack: 'Welcome back',
    secureLogin: 'Secure & Encrypted',
    govtPortal: 'Official Government Portal',
    termsNote: 'By signing in, you agree to our',
    termsLink: 'Terms of Service',
    andText: 'and',
    privacyLink: 'Privacy Policy',
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
    consultAssistant: 'IP सहायक से परामर्श',
    
    // Hero Section
    heroEyebrow: 'आयुष मंत्रालय · भारत सरकार पहल',
    heroTitle: 'IP-SAKTI सहायक',
    heroSubtitle: 'आयुर्वेदिक बौद्धिक संपदा के लिए आपका विश्वसनीय मार्गदर्शक',
    heroDesc: 'एक बहुभाषी, स्रोत-उद्धृत AI सहायक जो वैद्यों, आयुष स्टार्टअप्स, शोधकर्ताओं और किसानों को पेटेंट, ट्रेडमार्क, GI टैग और जैव विविधता अनुपालन में मार्गदर्शन करता है।',
    heroDescBold: ' आधिकारिक कानूनों पर आधारित, कभी अनुमान नहीं।',
    startConsultation: 'परामर्श शुरू करें',
    formulationWizard: 'फॉर्मूलेशन विज़ार्ड',
    seeDemo: 'डेमो देखें',
    
    // Trust Pills
    zeroHallucination: 'शून्य-भ्रम',
    sourceCited: 'स्रोत-उद्धृत',
    multiLanguage: '10+ भाषाएं',
    indiaIntl: 'भारत और अंतर्राष्ट्रीय',
    
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
    moreQuestions: 'क्या आपके पास और प्रश्न हैं? हमारे AI सहायक से पूछें!',
    askIpSakti: 'IP-SAKTI से पूछें',
    
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
    logout: 'लॉगआउट',
    dashboard: 'डैशबोर्ड',
    welcomeBack: 'वापसी पर स्वागत है',
    secureLogin: 'सुरक्षित और एन्क्रिप्टेड',
    govtPortal: 'आधिकारिक सरकारी पोर्टल',
    termsNote: 'साइन इन करके, आप हमारी',
    termsLink: 'सेवा की शर्तें',
    andText: 'और',
    privacyLink: 'गोपनीयता नीति',
  },
}

// Fallback to English for languages without full translation
const getTranslation = (lang, key) => {
  if (UI_TRANSLATIONS[lang] && UI_TRANSLATIONS[lang][key]) {
    return UI_TRANSLATIONS[lang][key]
  }
  return UI_TRANSLATIONS['en'][key] || key
}

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (key) => key })

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
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? '0px 0px -50px 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
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
    { value: tkdl.value, suffix: '+', label: 'TKDL Formulations Protected', icon: '📚' },
    { value: statutes.value, suffix: '', label: 'Core Statutes Indexed', icon: '⚖️' },
    { value: languages.value, suffix: '+', label: 'Indian Languages Supported', icon: '🌐' },
    { value: users.value, suffix: '+', label: 'User Categories Served', icon: '👥' },
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
      icon: '🧑‍⚕️',
      title: 'Ayurvedic Practitioners',
      subtitle: 'Vaidyas & Traditional Healers',
      problem: 'Unsure if custom formulations can be legally protected',
      solution: 'Get clarity on Section 3(p) exemptions and trademark options',
    },
    {
      icon: '🏢',
      title: 'AYUSH Startups & MSMEs',
      subtitle: 'Herbal Product Companies',
      problem: 'Confused between drug licensing and IP protection paths',
      solution: 'Guided classification wizard + regulatory pathway mapping',
    },
    {
      icon: '🔬',
      title: 'Researchers & Academia',
      subtitle: 'Scientists & PhD Scholars',
      problem: 'Need ABS compliance guidance before publishing',
      solution: 'Step-by-step NBA approval checker with Form guidance',
    },
    {
      icon: '🌿',
      title: 'Herb Cultivators & Farmers',
      subtitle: 'Traditional Growers',
      problem: 'Unaware of GI tags and plant variety rights',
      solution: 'Learn about geographical indications and PPV&FR Act',
    },
    {
      icon: '📖',
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
                  <span className="table-badge ipsakti">🌿 IP-SAKTI Sahayak</span>
                </th>
                <th className="col-generic">
                  <span className="table-badge generic">💬 Generic AI Chatbot</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i}>
                  <td>{f.feature}</td>
                  <td className="col-ipsakti">{f.ipsakti ? <span className="check">✓</span> : <span className="cross">✗</span>}</td>
                  <td className="col-generic">{f.generic ? <span className="check">✓</span> : <span className="cross">✗</span>}</td>
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
  return (
    <section className="section demo-section" id="demo">
      <Reveal>
        <p className="section-label">{t('demoLabel')}</p>
        <h2 className="section-title">{t('demoTitle')}</h2>
      </Reveal>
      <Reveal delay={150}>
        <div className="demo-card">
          <div className="demo-header">
            <div className="demo-dot red" />
            <div className="demo-dot yellow" />
            <div className="demo-dot green" />
            <span className="demo-title">{t('demoSampleResponse')}</span>
          </div>
          <div className="demo-body">
            <div className="demo-msg user">
              <div className="demo-avatar user">👤</div>
              <div className="demo-bubble user">{t('demoUserQuestion')}</div>
            </div>
            <div className="demo-msg ai">
              <div className="demo-avatar ai">🌿</div>
              <div className="demo-bubble ai">
                <p>{t('demoAiResponse1')}</p>
                <p style={{ marginTop: '0.75rem' }}>{t('demoAiResponse2')}</p>
                <div className="demo-citations">
                  <span className="demo-citation">📜 Patents Act 1970 §3(p)</span>
                  <span className="demo-citation">📚 TKDL Database</span>
                  <span className="demo-citation">📜 Patents Act 1970 §2(1)(j)</span>
                </div>
                <div className="demo-meta">
                  <span className="demo-confidence high">● {t('demoHighConfidence')}</span>
                  <span className="demo-disclaimer">ℹ️ {t('demoDisclaimer')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal delay={250}>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/chat" className="btn-primary">{t('demoTryIt')} →</Link>
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
      icon: '📜',
      name: 'Patents Act, 1970',
      key: 'Sec 3(p), 3(e), 2(1)(j)',
      desc: 'Defines patentability and explicitly bars traditional knowledge from patent protection.',
      color: 'primary',
    },
    {
      icon: '🌿',
      name: 'Biological Diversity Act, 2002',
      key: 'Sec 3, 6, ABS',
      desc: 'Regulates access to biological resources and mandates benefit sharing with local communities.',
      color: 'secondary',
    },
    {
      icon: '💊',
      name: 'Drugs & Cosmetics Act, 1940',
      key: 'Rule 158-B',
      desc: 'Governs licensing of Ayurvedic drug manufacturing: classical vs proprietary pathways.',
      color: 'primary',
    },
    {
      icon: '📚',
      name: 'TKDL (Traditional Knowledge Digital Library)',
      key: '3.5L+ Formulations',
      desc: 'Database preventing international biopiracy by documenting prior art from ancient texts.',
      color: 'secondary',
    },
    {
      icon: '🌍',
      name: 'WIPO GRATK Treaty, 2024',
      key: 'Disclosure Mandate',
      desc: 'New international treaty requiring patent applicants to disclose TK and genetic resource origins.',
      color: 'primary',
    },
    {
      icon: '📋',
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
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

/* ============================================================
   TYPEWRITER EFFECT
   ============================================================ */
const TYPEWRITER_PHRASES = [
  'Ayurvedic IP Guidance',
  'पेटेंट सलाह',               // Hindi
  'ಬೌದ್ಧಿಕ ಆಸ್ತಿ',           // Kannada
  'पारंपरिक ज्ञान संरक्षण',    // Hindi
  'Trademark Assistance',
  'বুদ্ধিবৃত্তিক সম্পদ',      // Bengali
]

function useTypewriter(phrases, speed = 70, pause = 1800) {
  const [displayText, setDisplayText] = useState('')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const tick = () => {
      const current = phrases[phraseIdx]
      if (!deleting) {
        if (charIdx < current.length) {
          setDisplayText(current.slice(0, charIdx + 1))
          setCharIdx(c => c + 1)
          timeout = setTimeout(tick, speed)
        } else {
          timeout = setTimeout(() => setDeleting(true), pause)
        }
      } else {
        if (charIdx > 0) {
          setDisplayText(current.slice(0, charIdx - 1))
          setCharIdx(c => c - 1)
          timeout = setTimeout(tick, speed / 2)
        } else {
          setDeleting(false)
          setPhraseIdx(i => (i + 1) % phrases.length)
          timeout = setTimeout(tick, speed)
        }
      }
    }

    let timeout = setTimeout(tick, speed)
    return () => clearTimeout(timeout)
  }, [phrases, speed, pause, phraseIdx, charIdx, deleting])

  return displayText
}

/* ============================================================
   ABOUT IP-SAKTI MODAL / DRAWER
   ============================================================ */
function AboutModal({ isOpen, onClose }) {
  const { t } = useLanguage()
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span style={{ fontSize: '1.5rem' }}>🌿</span>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{t('aboutTitle')}</h2>
              <span className="devanagari" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {t('aboutSubtitle')}
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('closeModal')}>✕</button>
        </div>

        <div className="modal-body">
          <section>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🎯 {t('aboutPurposeTitle')}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {t('aboutPurposeText')}
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--secondary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🛡️ {t('aboutGroundingTitle')}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {t('aboutGroundingText')}
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              📚 {t('aboutCorporaTitle')}
            </h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <li>📜 Patents Act 1970 (Sec 3p)</li>
              <li>🌿 Biological Diversity Act 2002</li>
              <li>💊 Drugs & Cosmetics Act 1940</li>
              <li>📚 TKDL (Traditional Knowledge)</li>
              <li>🌍 WIPO GRATK Treaty 2024</li>
              <li>🏷️ GI of Goods Act 1999</li>
            </ul>
          </section>

          <div style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--primary-light)' }}>
            ⚠️ <strong>{t('disclaimer')}:</strong> {t('aboutDisclaimer')}
          </div>
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
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: null })

  if (!isOpen) return null

  const resetWizard = () => {
    setStep(1)
    setAnswers({ q1: null, q2: null, q3: null })
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
        badge: '🚫 Patent Barred (Sec 3(p))',
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
        badge: '🍏 FSSAI / AYUSH Food Regime',
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
      badge: '💡 Potentially Patentable (Sec 2(1)(j))',
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
          <div className="modal-title-group">
            <span style={{ fontSize: '1.5rem' }}>🧪</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{t('wizardTitle')}</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {t('wizardSubtitle')}
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={handleClose} aria-label={t('closeModal')}>✕</button>
        </div>

        <div className="modal-body">
          {/* Progress Bar */}
          <div className="wizard-progress">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`wizard-progress-step ${step === s ? 'active' : step > s ? 'completed' : ''}`}
              >
                {step > s ? '✓' : s}
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
                    icon: '📜',
                    title: 'Ancient Authoritative Text (First Schedule)',
                    desc: 'Recipe taken directly from Charaka Samhita, Sushruta Samhita, Sahasrayogam, or Bhaishajya Ratnavali.',
                  },
                  {
                    id: 'proprietary',
                    icon: '🔬',
                    title: 'Modified / Novel Herbal Blend',
                    desc: 'Unique combination, novel extract ratio, or new delivery mechanism developed by your R&D team.',
                  },
                  {
                    id: 'nutra',
                    icon: '🥗',
                    title: 'Functional Dietary Supplement / Food',
                    desc: 'Herbal beverage, tonic, or dietary pill meant for daily health maintenance (Ayurveda Aahar).',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q1 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q1', opt.id)}
                  >
                    <span className="option-icon">{opt.icon}</span>
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
                    icon: '🏺',
                    title: 'Traditional Ayurvedic Processing Methods',
                    desc: 'Standard Kwatha (decoction), Asava-Arishta (fermentation), Bhasma, or Churna preparation.',
                  },
                  {
                    id: 'novel_proc',
                    icon: '⚙️',
                    title: 'Modern Extraction or Nanotechnology',
                    desc: 'Supercritical CO2 extraction, targeted liposomal delivery, or standardized marker compound enrichment.',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q2 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q2', opt.id)}
                  >
                    <span className="option-icon">{opt.icon}</span>
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
                    icon: '🏥',
                    title: 'Specific Disease Treatment or Cure',
                    desc: 'Claiming clinical cure or management for conditions like Arthritis, Diabetes, or Hypertension.',
                  },
                  {
                    id: 'wellness',
                    icon: '🌿',
                    title: 'General Immunity & Wellness',
                    desc: 'Promoting overall vitality, digestion, or stress relief without disease-specific claims.',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q3 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q3', opt.id)}
                  >
                    <span className="option-icon">{opt.icon}</span>
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
                  Generate IP Assessment ✨
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
                <button className="btn-secondary" onClick={resetWizard}>
                  🔄 {t('retestFormulation')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   HISTORY SIDEBAR RAIL
   ============================================================ */
function ChatSidebar({ collapsed, activeId, onSelectSession, onNewChat, onOpenWizard, onOpenAbout }) {
  const { t } = useLanguage()
  const SESSIONS = [
    { id: 1, title: 'Arthritis Formulation Patentability', tag: 'Patents', date: 'Today' },
    { id: 2, title: 'ABS Compliance for Neem Extract', tag: 'BD Act', date: 'Yesterday' },
    { id: 3, title: 'TKDL Prior Art Section 3(p)', tag: 'TKDL', date: 'Aug 29' },
    { id: 4, title: 'Ayurvedic Herbal Cosmetic Trademark', tag: 'Trademark', date: 'Aug 26' },
  ]

  return (
    <aside className={`chat-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label={t('chatHistory')}>
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNewChat} id="new-chat-btn">
          <span>➕</span>
          <span>{t('newConsultation')}</span>
        </button>
      </div>

      <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {t('pastConversations')}
      </div>

      <div className="sidebar-history-list">
        {SESSIONS.map(s => (
          <div
            key={s.id}
            className={`history-item ${activeId === s.id ? 'active' : ''}`}
            onClick={() => onSelectSession(s.id)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="history-item-title">{s.title}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.date}</span>
            </div>
            <span className="history-item-tag">{s.tag}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-link-btn" onClick={onOpenWizard}>
          <span>🧪</span>
          <span>{t('formulationWizard')}</span>
        </button>
        <Link to="/abs-checker" className="sidebar-link-btn">
          <span>🌿</span>
          <span>{t('absChecker')}</span>
        </Link>
        <Link to="/sources" className="sidebar-link-btn">
          <span>📚</span>
          <span>{t('officialDataCorpora')}</span>
        </Link>
        <button className="sidebar-link-btn" onClick={onOpenAbout}>
          <span>ℹ️</span>
          <span>{t('aboutIpSakti')}</span>
        </button>
      </div>
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
    text: 'Namaste! 🙏 I am IP-SAKTI Sahayak, your guide to Intellectual Property in Ayurveda. Ask me about patents, trademarks, GI tags, TKDL, or any IP question related to traditional knowledge.',
    citations: [],
    confidence: null,
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
    citations: [
      { title: '📜 Patents Act 1970 | §3(p) | Traditional Knowledge Bar', url: 'https://ipindia.gov.in/patents.htm' },
      { title: '📜 TKDL Database | Cross-Reference Check', url: 'https://www.tkdl.res.in/' },
      { title: '📜 Patents Act 1970 | §2(1)(j) | Definition of Invention', url: 'https://indiacode.nic.in/' },
    ],
    confidence: 'high',
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
    citations: [
      { title: '📜 Patents Act 1970 | §3(e) | Synergistic Admixture Exclusion', url: 'https://ipindia.gov.in/patents.htm' },
      { title: '📜 Biological Diversity Act 2002 | §6 | Prior NBA Approval for IP', url: 'http://nbaindia.org/' },
    ],
    confidence: 'medium',
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
      { title: '🌍 WIPO GRATK Treaty 2024 | Mandatory Disclosure of Traditional Knowledge', url: 'https://www.wipo.int/' },
      { title: '📋 Nagoya Protocol | Access & Benefit Sharing (ABS)', url: 'https://www.cbd.int/abs/' },
    ],
    confidence: 'low',
    showDisclaimer: true,
  },
]

/* ============================================================
   CHAT COMPONENTS
   ============================================================ */
function CitationCard({ citation }) {
  return (
    <a href={citation.url} target="_blank" rel="noopener noreferrer" className="citation-card">
      <span className="citation-title">{citation.title}</span>
      <span className="citation-url">{citation.url}</span>
    </a>
  )
}

function ConfidenceBadge({ level }) {
  const map = {
    high:   { label: '● High Confidence (Direct Statute Match)', cls: 'high' },
    medium: { label: '● Moderate Confidence: Verify details with expert', cls: 'medium' },
    low:    { label: '● Low Confidence: Consult a registered IP attorney', cls: 'low' },
  }
  const m = map[level]
  if (!m) return null
  return (
    <span className={`confidence-badge ${m.cls}`} role="status" aria-label={m.label}>
      {m.label}
    </span>
  )
}

function DisclaimerBanner() {
  return (
    <div className="disclaimer" role="note">
      <span aria-hidden="true">ℹ️</span>
      <span>This is information only, grounded in retrieved statutes. Consult a qualified IP attorney for formal legal proceedings.</span>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="message-row ai-row" aria-label="IP-SAKTI is thinking">
      <div className="avatar ai-avatar" aria-hidden="true">🌿</div>
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="message-row user-row">
        <div className="avatar user-avatar" aria-hidden="true">👤</div>
        <div className="bubble-column">
          <div className="bubble user-bubble">{msg.text}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-row ai-row">
      <div className="avatar ai-avatar" aria-hidden="true">🌿</div>
      <div className="bubble-column">
        <div className="bubble ai-bubble" style={{ whiteSpace: 'pre-line' }}>
          {msg.text}
        </div>
        {msg.citations?.length > 0 && (
          <div className="citation-list">
            {msg.citations.map((c, i) => (
              <CitationCard key={i} citation={c} />
            ))}
          </div>
        )}
        {msg.confidence && <ConfidenceBadge level={msg.confidence} />}
        {msg.showDisclaimer && <DisclaimerBanner />}
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
        India 🇮🇳
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
        International 🌐
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
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ml', label: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
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
        <label htmlFor="faq-lang-select" className="faq-lang-label">
          🌐 {t('faqReadIn')}
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
              {lang.flag} {lang.label}
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
              <span className="faq-icon" aria-hidden="true">
                {faq.category === 'website' ? '🌐' : '📜'}
              </span>
              <span className="faq-question-text">
                {getLocalizedText(faq.question)}
              </span>
              <span className={`faq-chevron ${openIndex === index ? 'rotated' : ''}`} aria-hidden="true">
                ▼
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
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {t('moreQuestions')}
        </p>
        <Link to="/chat" className="btn-primary">
          {t('askIpSakti')} →
        </Link>
      </div>
    </section>
  )
}

/* ============================================================
   GOVERNMENT PORTAL ACCESSIBILITY BAR
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
    <div className="top-access-bar" role="region" aria-label="Accessibility & Quick Tools Header">
      <div className="top-access-container">
        <div className="top-access-left">
          <span>भारत सरकार | {t('govtOf')}</span>
          <span className="divider">•</span>
          <span>आयुष मंत्रालय | {t('ministry')}</span>
        </div>

        <div className="top-access-right">
          {/* Global Language Selector */}
          <GlobalLanguageSelector />

          <form className="top-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="top-search-input"
              aria-label="Search IP Statutes and Guidelines"
            />
            <button type="submit" className="top-search-btn" title="Search Portal">🔍</button>
          </form>

          <div className="font-size-controls" aria-label="Font Size Accessibility Controls">
            <button
              className={`font-size-btn ${fontSize === 'sm' ? 'active' : ''}`}
              onClick={() => setFontSize('sm')}
              title="Decrease Font Size (A-)"
            >
              A-
            </button>
            <button
              className={`font-size-btn ${fontSize === 'md' ? 'active' : ''}`}
              onClick={() => setFontSize('md')}
              title="Normal Font Size (A)"
            >
              A
            </button>
            <button
              className={`font-size-btn ${fontSize === 'lg' ? 'active' : ''}`}
              onClick={() => setFontSize('lg')}
              title="Increase Font Size (A+)"
            >
              A+
            </button>
          </div>

          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />

          <a href="#chat-messages" className="top-access-icon-link" title="Screen Reader Accessibility Access" aria-label="Screen Reader Access">
            ♿
          </a>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   GOVERNMENT PORTAL MAIN HEADER
   ============================================================ */
function GovtMainHeader() {
  return (
    <header className="gov-header" role="banner">
      <div className="gov-header-container">
        <div className="gov-emblem-wrap">
          {/* Indian Government Emblem */}
          <svg className="gov-emblem-svg" viewBox="0 0 100 100" width="56" height="56" aria-label="State Emblem of India Placeholder">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--primary)" strokeWidth="3" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--secondary)" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="16" fill="none" stroke="var(--primary)" strokeWidth="2" />
            <path d="M50 10 L50 90 M10 50 L90 50 M22 22 L78 78 M22 78 L78 22" stroke="var(--primary)" strokeWidth="1.2" opacity="0.85" />
            <text x="50" y="54" textAnchor="middle" fontSize="13" fontWeight="bold" fill="var(--primary)">सत्यमेव</text>
          </svg>
          <div className="gov-emblem-text">
            <span className="gov-title-hi">भारत सरकार</span>
            <span className="gov-title-en">Government of India</span>
            <span className="gov-dept-hi">आयुष मंत्रालय</span>
            <span className="gov-dept-en">Ministry of AYUSH</span>
          </div>
        </div>

        <div className="gov-portal-brand">
          <Link to="/" className="gov-portal-badge">
            {/* IP-SAKTI Premium Logo - Shield with Ayurvedic Leaf */}
            <IpSaktiLogo className="ip-sakti-logo" size={56} />
            <div>
              <h1 className="gov-portal-name">IP-SAKTI Sahayak</h1>
              <div className="gov-portal-sub">राष्ट्रीय आयुर्वेद बौद्धिक संपदा सहायता पोर्टल</div>
              <div className="gov-portal-tagline">Smart Ayurveda IP & Regulatory Assistance Portal</div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ============================================================
   IP-SAKTI PREMIUM LOGO COMPONENT
   ============================================================ */
function IpSaktiLogo({ className = '', size = 48 }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 120 120" 
      width={size} 
      height={size} 
      aria-label="IP-SAKTI Sahayak Logo"
    >
      {/* Background Circle - Chakra inspired */}
      <circle cx="60" cy="60" r="58" fill="#0F172A" />
      <circle cx="60" cy="60" r="54" fill="none" stroke="#F59E0B" strokeWidth="2" />
      
      {/* Inner decorative ring - 24 spokes like Ashoka Chakra */}
      <circle cx="60" cy="60" r="48" fill="none" stroke="#1E40AF" strokeWidth="1" opacity="0.4" />
      
      {/* Shield Shape - IP Protection */}
      <path 
        d="M60 18 L92 32 L92 62 C92 82 76 98 60 104 C44 98 28 82 28 62 L28 32 Z" 
        fill="#1D4ED8"
      />
      <path 
        d="M60 24 L86 36 L86 60 C86 77 73 91 60 96 C47 91 34 77 34 60 L34 36 Z" 
        fill="#1E40AF"
      />
      
      {/* Ayurvedic Leaf - Traditional Knowledge */}
      <path 
        d="M60 32 C75 42 72 58 60 68 C48 58 45 42 60 32" 
        fill="#10B981"
      />
      {/* Leaf center vein */}
      <path d="M60 36 L60 64" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Leaf side veins */}
      <path d="M60 44 L52 50" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M60 44 L68 50" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M60 52 L54 57" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M60 52 L66 57" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      
      {/* IP Text */}
      <text x="60" y="88" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="bold" fill="#ffffff" letterSpacing="2">IP</text>
      
      {/* Three dots - representing Ayurveda's three doshas (Vata, Pitta, Kapha) */}
      <circle cx="48" cy="76" r="3" fill="#F59E0B" />
      <circle cx="60" cy="76" r="3" fill="#F59E0B" />
      <circle cx="72" cy="76" r="3" fill="#F59E0B" />
      
      {/* Outer saffron accent ring */}
      <circle cx="60" cy="60" r="58" fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />
    </svg>
  )
}

/* ============================================================
   GOVERNMENT PORTAL MAIN NAVIGATION BAR
   ============================================================ */
function GovtNavbar({ onOpenAbout, onOpenWizard, isLoggedIn, userName, onLogout }) {
  const { t } = useLanguage()
  
  return (
    <nav className="gov-nav-bar" role="navigation" aria-label="Main Portal Navigation">
      <div className="gov-nav-container">
        <ul className="gov-nav-menu">
          <li>
            <Link to="/" className="gov-nav-link">🏠 {t('home')}</Link>
          </li>
          <li>
            <button className="gov-nav-link-btn" onClick={onOpenWizard}>
              🧪 {t('formulationWizard')}
            </button>
          </li>
          <li>
            <Link to="/abs-checker" className="gov-nav-link">🌿 {t('absChecker')}</Link>
          </li>
          <li>
            <Link to="/ip-calculator" className="gov-nav-link">🧮 {t('ipCalculator')}</Link>
          </li>
          <li>
            <Link to="/sources" className="gov-nav-link">📚 {t('officialSources')}</Link>
          </li>
          <li>
            <button className="gov-nav-link-btn" onClick={onOpenAbout}>
              ℹ️ {t('aboutPortal')}
            </button>
          </li>
          <li>
            <a href="https://ayush.gov.in/" target="_blank" rel="noopener noreferrer" className="gov-nav-link">
              🏛️ {t('ministry')} ↗
            </a>
          </li>
        </ul>

        <div className="gov-nav-actions">
          {isLoggedIn ? (
            <>
              <div className="gov-nav-user-welcome">
                <span>👋</span>
                <span>{t('welcomeBack')}, <strong>{userName}</strong></span>
              </div>
              <button className="gov-nav-logout-btn" onClick={onLogout}>
                🚪 {t('logout')}
              </button>
              <Link to="/chat" className="gov-nav-cta" id="gov-nav-consult-btn">
                <span>{t('consultAssistant')}</span>
                <span>→</span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="gov-nav-login-btn">
                <span>👤</span>
                <span>{t('loginOrRegister')}</span>
              </Link>
              <Link to="/login" className="gov-nav-cta" id="gov-nav-consult-btn">
                <span>{t('consultAssistant')}</span>
                <span>→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ============================================================
   TRANSLATED FOOTER COMPONENT
   ============================================================ */
function TranslatedFooter() {
  const { t } = useLanguage()
  
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-content">
        <div className="footer-brand">
          <span className="footer-logo">🌿</span>
          <div>
            <h3>IP-SAKTI Sahayak</h3>
            <span className="devanagari">{t('footerDesc')}</span>
          </div>
        </div>
        <div className="footer-info">
          <p>{t('ministry')} · {t('govtOf')}</p>
          <p className="footer-disclaimer">
            ⚠️ {t('footerDisclaimer')}
          </p>
        </div>
        <div className="footer-links">
          <Link to="/chat">{t('startConsultation')}</Link>
          <Link to="/abs-checker">{t('absChecker')}</Link>
          <Link to="/sources">{t('officialSources')}</Link>
          <Link to="/privacy">{t('privacyPolicy')}</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <p>{t('footerCopyright')}</p>
      </div>
    </footer>
  )
}

/* ============================================================
   NAVBAR WRAPPER (COMMON)
   ============================================================ */
function Navbar({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt, isLoggedIn, userName, onLogout }) {
  return (
    <div className="gov-portal-header-wrapper">
      <GovtAccessibilityBar
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setPrefillPrompt={setPrefillPrompt}
      />
      <GovtMainHeader />
      <GovtNavbar 
        onOpenAbout={onOpenAbout} 
        onOpenWizard={onOpenWizard}
        isLoggedIn={isLoggedIn}
        userName={userName}
        onLogout={onLogout}
      />
    </div>
  )
}

/* ============================================================
   LANDING PAGE
   ============================================================ */
function LandingPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt, isLoggedIn, userName, onLogout }) {
  const text = useTypewriter(TYPEWRITER_PHRASES)
  const { t } = useLanguage()

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

      {/* Hero */}
      <section className="hero-section" id="hero" aria-labelledby="hero-title">
        {/* Animated mesh gradient background */}
        <div className="hero-mesh" aria-hidden="true">
          <div className="mesh-blob mesh-blob-1" />
          <div className="mesh-blob mesh-blob-2" />
          <div className="mesh-blob mesh-blob-3" />
        </div>

        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="eyebrow-pulse" />
            <span>🏛️ {t('heroEyebrow')}</span>
          </div>

          <h1 className="hero-title" id="hero-title">{t('heroTitle')}</h1>
          <p className="hero-title-sub">{t('heroSubtitle')}</p>

          <div className="typewriter-wrap" aria-live="polite" aria-label="Rotating phrases">
            <span className="typewriter">{text}</span>
            <span className="typewriter-cursor" aria-hidden="true" />
          </div>

          <p className="hero-description">
            {t('heroDesc')}
            <strong>{t('heroDescBold')}</strong>
          </p>

          <div className="hero-cta-group">
            <Link to="/chat" className="btn-primary" id="hero-start-btn">
              {t('startConsultation')}
            </Link>
            <button className="btn-secondary" onClick={onOpenWizard}>
              {t('formulationWizard')}
            </button>
            <a href="#demo" className="btn-ghost">
              {t('seeDemo')}
            </a>
          </div>

          {/* Trust pills */}
          <div className="hero-trust-pills">
            <div className="trust-pill"><span>🛡️</span> {t('zeroHallucination')}</div>
            <div className="trust-pill"><span>📜</span> {t('sourceCited')}</div>
            <div className="trust-pill"><span>🌐</span> {t('multiLanguage')}</div>
            <div className="trust-pill"><span>⚖️</span> {t('indiaIntl')}</div>
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
              icon: '📜',
              titleKey: 'featureStatuteCited',
              descKey: 'featureStatuteCitedDesc',
            },
            {
              icon: '🧪',
              titleKey: 'featureFormulationWizard',
              descKey: 'featureFormulationWizardDesc',
            },
            {
              icon: '🌐',
              titleKey: 'featureMultilingual',
              descKey: 'featureMultilingualDesc',
            },
            {
              icon: '⚖️',
              titleKey: 'featureJurisdiction',
              descKey: 'featureJurisdictionDesc',
            },
            {
              icon: '🌿',
              titleKey: 'featureABS',
              descKey: 'featureABSDesc',
            },
            {
              icon: '🔒',
              titleKey: 'featureTKDL',
              descKey: 'featureTKDLDesc',
            },
          ].map((f, i) => (
            <Reveal key={f.titleKey} delay={i * 80}>
              <article className="feature-card">
                <div className="feature-icon" aria-hidden="true">{f.icon}</div>
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
        <div class="logo">🌿 IP-SAKTI Sahayak</div>
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
                    ${aiReply.citations.map(c => `<span class="citation">📜 ${c.title}</span>`).join('')}
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
        <div class="disclaimer-title">⚠️ ${t('legalDisclaimer')}</div>
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
  { code: 'en-IN', label: 'English', flag: '🇬🇧' },
  { code: 'hi-IN', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr-IN', label: 'मराठी', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te-IN', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml-IN', label: 'മലയാളം', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'বাংলা', flag: '🇮🇳' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'as-IN', label: 'অসমীয়া', flag: '🇮🇳' },
  { code: 'ur-IN', label: 'اردو', flag: '🇮🇳' },
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
      console.log('🎤 Speech recognition not supported in this browser')
      return
    }
    
    // Cleanup old instance
    if (recognitionRef.current) {
      shouldRestartRef.current = false
      try { 
        recognitionRef.current.abort() 
      } catch (e) {
        console.log('🎤 Cleanup abort error (safe to ignore):', e.message)
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    // Configuration optimized for better Hindi recognition accuracy
    recognition.continuous = false  // Single-shot mode for better accuracy
    recognition.interimResults = true  // Show partial results
    recognition.maxAlternatives = 1  // Single best result for better accuracy
    recognition.lang = lang
    
    console.log('🎤 Recognition initialized with lang:', lang, '(single-shot mode for accuracy)')

    recognition.onstart = () => {
      console.log('🎤 Started listening - Lang:', lang)
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

        console.log('🎤 Result:', transcript, 'Confidence:', resultConfidence, 'isFinal:', result.isFinal)

        if (result.isFinal) {
          finalTranscript += transcript + ' '
          lastConfidence = resultConfidence
          console.log('🎤 Final result:', transcript, '| Confidence:', (resultConfidence * 100).toFixed(1) + '%')
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
      console.error('🔴 Speech recognition error:', event.error)
      
      // Handle specific errors
      switch (event.error) {
        case 'not-allowed':
          setError('माइक्रोफ़ोन की अनुमति दें / Please allow microphone access')
          shouldRestartRef.current = false
          setIsListening(false)
          break
        case 'no-speech':
          // Don't stop - just keep listening
          console.log('🎤 No speech detected, continuing...')
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
      console.log('🎤 Recognition ended, shouldRestart:', shouldRestartRef.current)
      
      // Auto-restart if user wants to keep listening
      if (shouldRestartRef.current) {
        setTimeout(() => {
          try {
            console.log('🎤 Auto-restarting...')
            recognitionRef.current?.start()
          } catch (e) {
            console.log('🎤 Restart failed:', e.message)
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
        console.log('🎤 Cleanup error (safe to ignore):', e.message)
      }
    }
  }, [isSupported, lang])

  const startListening = useCallback(() => {
    console.log('🎤 startListening called')
    setError(null)
    shouldRestartRef.current = true
    
    try {
      recognitionRef.current?.start()
      console.log('🎤 start() called successfully')
    } catch (e) {
      console.log('🎤 start() error:', e.message)
      if (e.name !== 'InvalidStateError') {
        setError('वॉइस शुरू नहीं हो सका / Failed to start voice')
      }
      // InvalidStateError means already started - that's ok
    }
  }, [])

  const stopListening = useCallback(() => {
    console.log('🎤 stopListening called')
    shouldRestartRef.current = false
    
    try { 
      recognitionRef.current?.stop() 
    } catch (e) {
      console.log('🎤 stop() error (safe to ignore):', e.message)
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
        <span className="voice-lang-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="voice-lang-dropdown">
          <div className="voice-lang-header">🎤 Voice Language</div>
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
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
              {value === lang.code && <span className="voice-lang-check">✓</span>}
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
  const { t } = useLanguage()
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [input, setInput] = useState('')
  const [jurisdiction, setJurisdiction] = useState('india')
  const [lang, setLang] = useState('en')
  const [typing, setTyping] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(1)

  // Voice Input with language selection
  const [voiceLang, setVoiceLang] = useState('hi-IN')
  
  const handleVoiceResult = useCallback((transcript) => {
    setInput(prev => prev ? prev + ' ' + transcript : transcript)
  }, [])
  
  const { isListening, isSupported: voiceSupported, interimText, error: voiceError, confidence: voiceConfidence, startListening, stopListening } = useVoiceInput(handleVoiceResult, voiceLang)

  useEffect(() => {
    if (prefillPrompt) {
      setInput(prefillPrompt)
      setPrefillPrompt('')
    }
  }, [prefillPrompt, setPrefillPrompt])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMsg = { id: Date.now(), role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, jurisdiction, language: lang }),
      })

      if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`)
      const data = await response.json()
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: data.answer,
        citations: data.citations,
        confidence: data.confidence === 'unavailable' ? null : data.confidence,
        showDisclaimer: true,
      }])
    } catch (error) {
      let aiText = `Under Section 3(p) of the Indian Patents Act 1970, traditional Ayurvedic formulations are excluded from patentability as prior art. However, novel, non-obvious synergistic combinations or extraction processes may be patentable subject matter.`
      let citations = [
        { title: '📜 Indian Patents Act 1970 | §3(p)', url: 'https://ipindia.gov.in/' },
        { title: '📚 Traditional Knowledge Digital Library (TKDL)', url: 'https://www.tkdl.res.in/' },
      ]

      if (jurisdiction === 'international') {
        aiText = `Under WIPO GRATK Treaty (2024) and Nagoya Protocol, international patent applications utilizing genetic resources or traditional knowledge must disclose the origin of biological material and evidence of Prior Informed Consent (PIC).`
        citations = [
          { title: '🌍 WIPO GRATK Treaty (2024) | Mandatory Disclosure Clause', url: 'https://www.wipo.int/' },
          { title: '📋 Nagoya Protocol on ABS | Article 6 & 7', url: 'https://www.cbd.int/abs/' },
        ]
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: `Development Mode Fallback:\n\nBackend connection note: ${error.message}\n\n${aiText}`,
        citations,
        confidence: 'high',
        showDisclaimer: true,
      }])
    } finally {
      setTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([DEMO_MESSAGES[0]])
    setInput('')
  }

  const handleNewChat = () => {
    setMessages([DEMO_MESSAGES[0]])
    setInput('')
    setActiveSessionId(null)
  }

  const handleSelectSession = (id) => {
    setActiveSessionId(id)
    if (id === 1) setMessages(DEMO_MESSAGES)
    else if (id === 2) {
      setMessages([
        DEMO_MESSAGES[0],
        { id: 201, role: 'user', text: 'Do I need National Biodiversity Authority approval for exporting Neem oil extract?' },
        {
          id: 202,
          role: 'ai',
          text: 'Yes. Under Section 3 of the Biological Diversity Act 2002, non-Indian citizens, NRIs, and foreign-incorporated companies must obtain prior approval from the National Biodiversity Authority (NBA) via Form I before accessing Indian bio-resources like Neem (Azadirachta indica) for commercial utilization.',
          citations: [{ title: '🌿 Biological Diversity Act 2002 | §3 | Access Approval', url: 'http://nbaindia.org/' }],
          confidence: 'high',
          showDisclaimer: true
        }
      ])
    }
  }

  return (
    <div className="chat-layout" role="main">
      <GovtAccessibilityBar theme={theme} toggleTheme={toggleTheme} fontSize={fontSize} setFontSize={setFontSize} />

      {/* Topbar */}
      <header className="chat-topbar" role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={t('toggleSidebar')}
          >
            ☰
          </button>
          <Link to="/" className="chat-brand" aria-label={t('backToHome')}>
            <div className="chat-brand-icon" aria-hidden="true">🌿</div>
            <div>
              <span className="chat-brand-name">IP-SAKTI Sahayak</span>
              <span className="devanagari" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--primary)' }}>
                आयुष मंत्रालय | Govt of India
              </span>
            </div>
          </Link>
        </div>

        <div className="topbar-right">
          <JurisdictionToggle value={jurisdiction} onChange={setJurisdiction} />

          <select
            className="lang-select"
            value={lang}
            onChange={e => setLang(e.target.value)}
            aria-label={t('selectResponseLang')}
            id="lang-selector"
          >
            <option value="en">🇬🇧 English</option>
            <option value="hi">🇮🇳 हिन्दी</option>
            <option value="kn">🇮🇳 ಕನ್ನಡ</option>
            <option value="bn">🇮🇳 বাংলা</option>
            <option value="ta">🇮🇳 தமிழ்</option>
            <option value="te">🇮🇳 తెలుగు</option>
          </select>

          <button className="btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }} onClick={onOpenAbout}>
            ℹ️ {t('about')}
          </button>
          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
        </div>
      </header>

      {/* Main Chat Area with Sidebar */}
      <div className="chat-container">
        <ChatSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onOpenWizard={onOpenWizard}
          onOpenAbout={onOpenAbout}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Chat Body */}
          <div className="chat-body" id="chat-messages" role="log" aria-live="polite">
            {/* Wizard shortcuts */}
            <div className="wizard-shortcut-bar" aria-label={t('quickActions')}>
              {[
                { icon: '🧪', labelKey: 'formulationWizard', action: onOpenWizard },
                { icon: '🌿', labelKey: 'absChecker', link: '/abs-checker' },
                { icon: '📜', labelKey: 'patentsActSection', prompt: 'What is Section 3(p) of Patents Act 1970?' },
                { icon: '📚', labelKey: 'tkdlCheck', prompt: 'How does TKDL prevent traditional knowledge biopiracy?' },
                { icon: '🏷️', labelKey: 'giTagging', prompt: 'How do I register a Geographical Indication for an Ayurvedic herb?' },
              ].map((b, idx) => (
                b.link ? (
                  <Link key={idx} to={b.link} className="wizard-btn">
                    <span aria-hidden="true">{b.icon}</span>
                    {t(b.labelKey)}
                  </Link>
                ) : (
                  <button
                    key={idx}
                    className="wizard-btn"
                    onClick={() => b.action ? b.action() : setInput(b.prompt)}
                  >
                    <span aria-hidden="true">{b.icon}</span>
                    {t(b.labelKey)}
                  </button>
                )
              ))}
            </div>

            {/* Messages */}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* Typing indicator */}
            {typing && <TypingIndicator />}
          </div>

          {/* Input Bar */}
          <div className="chat-input-bar" role="form" aria-label={t('messageInput')}>
            {/* Interim voice text display */}
            {isListening && interimText && (
              <div className="voice-interim-text">
                <span className="voice-interim-icon">🎤</span>
                <span className="voice-interim-content">{interimText}</span>
              </div>
            )}
            
            {/* Voice error display */}
            {voiceError && (
              <div className="voice-error-text" style={{
                background: 'linear-gradient(90deg, #fef2f2, #fee2e2)',
                color: '#dc2626',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>{voiceError}</span>
              </div>
            )}
            
            {/* Voice confidence indicator - show when confidence is low */}
            {voiceConfidence !== null && voiceConfidence < 0.5 && (
              <div className="voice-confidence-warning" style={{
                background: 'linear-gradient(90deg, #fef9c3, #fef08a)',
                color: '#a16207',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>कम सटीकता / Low accuracy ({(voiceConfidence * 100).toFixed(0)}%) - कृपया स्पष्ट बोलें / Please speak clearly</span>
              </div>
            )}
            
            <div className="input-row">
              <div className="chat-input-wrap">
                <textarea
                  className="chat-input"
                  id="chat-input-field"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? t('voiceListening') : t('chatPlaceholder')}
                  rows={1}
                  aria-label={t('typeYourQuestion')}
                />
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
                    >
                      {isListening ? (
                        <span className="voice-waves">
                          <span></span><span></span><span></span>
                        </span>
                      ) : '🎤'}
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
              >
                ➤
              </button>
            </div>

            <div className="input-actions">
              <button className="action-btn" onClick={onOpenWizard}>
                🧪 {t('formulationWizard')}
              </button>
              <Link to="/abs-checker" className="action-btn">
                🌿 {t('absCompliance')}
              </Link>
              <button 
                className="action-btn pdf-export-btn" 
                onClick={() => handleExportPdf(messages, t, jurisdiction)}
                disabled={messages.length <= 1}
              >
                📄 {t('exportPdf')}
              </button>
              <button className="action-btn" id="clear-chat-btn" onClick={handleClear}>
                🗑️ {t('clearSession')}
              </button>
            </div>
          </div>
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

      <header className="page-header">
        <span className="chip" style={{ background: 'rgba(6, 95, 70, 0.2)', color: 'var(--secondary-light)', marginBottom: '0.75rem' }}>
          🌿 {t('absChipLabel')}
        </span>
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
              <span style={{ fontSize: '1.4rem' }}>📋</span>
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
    </div>
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

function IPCostCalculatorPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  useLanguage() // For future translations
  
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
          <div class="logo">🌿 IP-SAKTI Sahayak</div>
          <div class="subtitle">Intellectual Property Cost Estimate Report</div>
          <div class="ministry">Ministry of AYUSH | Government of India</div>
        </div>

        <h1>📋 Estimate Configuration</h1>
        <div class="config-grid">
          <div class="config-item"><span>IP Type:</span><strong>${estimate.ipType?.icon || ''} ${estimate.ipType?.name || 'N/A'}</strong></div>
          <div class="config-item"><span>Jurisdiction:</span><strong>${estimate.jurisdiction?.flag || ''} ${estimate.jurisdiction?.name || 'N/A'}</strong></div>
          <div class="config-item"><span>Applicant:</span><strong>${estimate.applicantCategory?.icon || ''} ${estimate.applicantCategory?.name || 'N/A'}</strong></div>
          <div class="config-item"><span>Filing Type:</span><strong>${estimate.filingType?.icon || ''} ${estimate.filingType?.name || 'N/A'}</strong></div>
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

        <h1>🏛️ Government Fees Breakdown</h1>
        <table>
          <thead><tr><th>Fee Type</th><th class="amount">Amount</th></tr></thead>
          <tbody>
            ${govtBreakdown || '<tr><td colspan="2">No fees calculated</td></tr>'}
            <tr style="font-weight: 600; background: #f0f9ff;"><td>Total Government Fees</td><td class="amount">${formatCurrency(estimate.governmentFees.total)}</td></tr>
          </tbody>
        </table>

        ${profBreakdown ? `
        <h1>💼 Professional Services Fees</h1>
        <table>
          <thead><tr><th>Service</th><th class="amount">Estimated Range</th></tr></thead>
          <tbody>
            ${profBreakdown}
            <tr style="font-weight: 600; background: #f0f9ff;"><td>Total Professional Fees</td><td class="amount">${formatCurrency(estimate.professionalFees.min)} - ${formatCurrency(estimate.professionalFees.max)}</td></tr>
          </tbody>
        </table>
        ` : ''}

        <h1>⏱️ Timeline & Important Notes</h1>
        <div class="config-grid">
          <div class="config-item"><span>Estimated Timeline:</span><strong>${estimate.summary.timeline}</strong></div>
          <div class="config-item"><span>Generated On:</span><strong>${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
        </div>

        <div class="disclaimer">
          <strong>⚠️ Important Disclaimer:</strong><br>
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
                  <span className="calc-ip-icon">{type.icon}</span>
                  <span className="calc-ip-name">{type.name}</span>
                  <span className="calc-ip-desc">{type.description}</span>
                  {formData.ipType === type.id && <span className="calc-ip-check">✓</span>}
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
                  <span className="calc-j-flag">{j.flag}</span>
                  <span className="calc-j-name">{j.name}</span>
                  <span className="calc-j-currency">{j.currency}</span>
                  {formData.jurisdiction === j.id && <span className="calc-j-check">✓</span>}
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
                    <span className="calc-a-icon">{cat.icon}</span>
                    <span className="calc-a-name">{cat.name}</span>
                  </div>
                  <span className="calc-a-desc">{cat.description}</span>
                  {cat.discount < 1 && (
                    <span className="calc-a-discount">
                      🎉 {Math.round((1 - cat.discount) * 100)}% Fee Discount
                    </span>
                  )}
                  {formData.applicantCategory === cat.id && <span className="calc-a-check">✓</span>}
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
                    {ft.icon} {ft.name}
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
                    <span className="calc-s-icon">{service.icon}</span>
                    <span className="calc-s-name">{service.name}</span>
                    {service.recommended && <span className="calc-s-badge">Recommended</span>}
                  </div>
                  <span className="calc-s-desc">{service.description}</span>
                  <span className="calc-s-time">⏱️ {service.estimatedTime}</span>
                  {formData.services.includes(service.id) && <span className="calc-s-check">✓</span>}
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
                  <span className="calc-r-value">
                    {IP_TYPES.find(t => t.id === formData.ipType)?.icon} {IP_TYPES.find(t => t.id === formData.ipType)?.name}
                  </span>
                </div>
                <div className="calc-review-item">
                  <span className="calc-r-label">Jurisdiction</span>
                  <span className="calc-r-value">
                    {JURISDICTIONS.find(j => j.id === formData.jurisdiction)?.flag} {JURISDICTIONS.find(j => j.id === formData.jurisdiction)?.name}
                  </span>
                </div>
                <div className="calc-review-item">
                  <span className="calc-r-label">Applicant</span>
                  <span className="calc-r-value">
                    {APPLICANT_CATEGORIES.find(c => c.id === formData.applicantCategory)?.icon} {APPLICANT_CATEGORIES.find(c => c.id === formData.applicantCategory)?.name}
                  </span>
                </div>
                <div className="calc-review-item">
                  <span className="calc-r-label">Filing Type</span>
                  <span className="calc-r-value">
                    {FILING_TYPES.find(f => f.id === formData.filingType)?.icon} {FILING_TYPES.find(f => f.id === formData.filingType)?.name}
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
                        <span key={sId} className="calc-r-service-tag">
                          {service?.icon} {service?.name}
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
      { label: 'Government Fees', value: govtTotal, color: '#1D4ED8' },
      { label: 'Professional Fees', value: profMin, color: '#10B981' },
    ]
    const chartTotal = chartData.reduce((sum, d) => sum + d.value, 0)

    return (
      <div className="calc-results">
        <div className="calc-results-header">
          <h2>📊 Cost Estimate Results</h2>
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
            <span className="calc-sum-icon">💰</span>
            <span className="calc-sum-label">One-Time Costs</span>
            <span className="calc-sum-value">{formatCurrency(estimate.summary.oneTimeCosts)}</span>
          </div>
          <div className="calc-summary-card">
            <span className="calc-sum-icon">🔄</span>
            <span className="calc-sum-label">Recurring (Annual)</span>
            <span className="calc-sum-value">{formatCurrency(estimate.summary.recurringCosts)}</span>
          </div>
          <div className="calc-summary-card">
            <span className="calc-sum-icon">🏛️</span>
            <span className="calc-sum-label">Government Fees</span>
            <span className="calc-sum-value">{formatCurrency(govtTotal)}</span>
          </div>
          <div className="calc-summary-card">
            <span className="calc-sum-icon">💼</span>
            <span className="calc-sum-label">Professional Fees</span>
            <span className="calc-sum-value">{formatCurrency(profMin)} - {formatCurrency(profMax)}</span>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="calc-chart-section">
          <h3>📈 Cost Distribution</h3>
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
          <h3>🏛️ Government Fees Breakdown</h3>
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
            <h3>💼 Professional Services Breakdown</h3>
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
          <h3>⏱️ Estimated Timeline</h3>
          <div className="calc-timeline-card">
            <span className="calc-timeline-icon">📅</span>
            <span className="calc-timeline-value">{estimate.summary.timeline}</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="calc-disclaimer">
          <span className="calc-disclaimer-icon">⚠️</span>
          <p>{estimate.disclaimer}</p>
        </div>

        {/* Actions */}
        <div className="calc-results-actions">
          <button className="calc-btn-primary" onClick={handleExportCostPdf}>
            📄 Download PDF Report
          </button>
          <button className="calc-btn-secondary" onClick={handleReset}>
            🔄 Start New Calculation
          </button>
          <Link to="/chat" className="calc-btn-outline">
            💬 Ask IP Expert
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

      <header className="page-header">
        <span className="chip" style={{ background: 'rgba(29, 78, 216, 0.2)', color: '#60A5FA', marginBottom: '0.75rem' }}>
          🧮 IP Cost Calculator
        </span>
        <h1 className="page-title">IP Filing Cost Estimator</h1>
        <p className="page-subtitle">
          Get transparent cost estimates for Patents, Trademarks, Copyrights, Industrial Designs & GI Tags
        </p>
      </header>

      <main className="calc-main">
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
                    <span className="calc-step-dot">{currentStep > step ? '✓' : step}</span>
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
                >
                  {isCalculating ? (
                    <>
                      <span className="calc-spinner" /> Calculating...
                    </>
                  ) : (
                    <>🧮 Calculate Estimate</>
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          renderResults()
        )}
      </main>
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
      icon: '🏛️',
      name: 'India Code statutory archive',
      tag: 'Statute Corpus',
      desc: 'Official repository of Indian legislation including Patents Act 1970, Biological Diversity Act 2002, and Drugs & Cosmetics Act 1940.',
      url: 'https://indiacode.nic.in/',
    },
    {
      icon: '🔖',
      name: 'IP India Patent & Design Office',
      tag: 'Patent Office',
      desc: 'Official portal of the Controller General of Patents, Designs & Trade Marks (CGPDTM) detailing examination guidelines.',
      url: 'https://ipindia.gov.in/',
    },
    {
      icon: '📚',
      name: 'TKDL (Traditional Knowledge Digital Library)',
      tag: 'Prior Art DB',
      desc: 'Joint initiative of CSIR and Ministry of AYUSH mapping traditional formulas to prevent international biopiracy.',
      url: 'https://www.tkdl.res.in/',
    },
    {
      icon: '🌍',
      name: 'WIPO GRATK Treaty (2024)',
      tag: 'International Law',
      desc: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge establishing disclosure rules.',
      url: 'https://www.wipo.int/',
    },
    {
      icon: '📋',
      name: 'Nagoya Protocol on ABS',
      tag: 'Treaty Corpus',
      desc: 'Global treaty under the Convention on Biological Diversity governing fair access and equitable benefit-sharing.',
      url: 'https://www.cbd.int/abs/',
    },
    {
      icon: '🌿',
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
        <span className="chip" style={{ background: 'rgba(217, 119, 6, 0.2)', color: 'var(--primary-light)', marginBottom: '0.75rem' }}>
          📚 {t('sourcesChipLabel')}
        </span>
        <h1 className="page-title">{t('sourcesPageTitle')}</h1>
        <p className="page-subtitle">{t('sourcesPageSubtitle')}</p>
      </header>

      <main className="sources-grid">
        {SOURCES.map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="source-card">
            <div className="source-header">
              <span className="source-icon">{s.icon}</span>
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
        <span className="chip" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#A5B4FC', marginBottom: '0.75rem' }}>
          🔒 {t('privacyLegal')}
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
              <span>🛡️</span>
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
   LOGIN PAGE
   ============================================================ */
function LoginPage({ theme, toggleTheme, fontSize, setFontSize, onLogin }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Theme props available for future use
  void theme; void toggleTheme; void fontSize; void setFontSize;

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    // Simulate API call (frontend only)
    setTimeout(() => {
      setIsLoading(false)
      // Save login state with name and redirect to home
      const userName = isRegister ? fullName : email.split('@')[0]
      onLogin(email, userName)
      navigate('/')
    }, 1500)
  }

  const handleSocialLogin = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onLogin('user@example.com', 'User')
      navigate('/')
    }, 1000)
  }

  const handleMagicLink = () => {
    if (!email) {
      setError('Please enter your email first')
      return
    }
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setSuccess(t('magicLinkSent'))
    }, 1000)
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
                <span className="login-feature-icon">✓</span>
                <span>{t('zeroHallucination')}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon">✓</span>
                <span>{t('sourceCited')}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon">✓</span>
                <span>{t('multiLanguage')}</span>
              </div>
            </div>

            <div className="login-govt-badge">
              <span>🏛️</span>
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

            {/* Social Login Buttons */}
            <div className="login-social-buttons">
              <button 
                type="button" 
                className="login-social-btn google"
                onClick={() => handleSocialLogin('google')}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>{t('loginWithGoogle')}</span>
              </button>

              <button 
                type="button" 
                className="login-social-btn apple"
                onClick={() => handleSocialLogin('apple')}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                <span>{t('loginWithApple')}</span>
              </button>
            </div>

            {/* Magic Link */}
            <button 
              type="button" 
              className="login-magic-btn"
              onClick={handleMagicLink}
              disabled={isLoading}
            >
              <span>✨</span>
              <span>{t('loginWithMagicLink')}</span>
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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    required
                    disabled={isLoading}
                    aria-label={t('passwordLabel')}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {!isRegister && (
                  <a href="#" className="login-forgot">{t('forgotPassword')}</a>
                )}
              </div>

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
            <div className="login-security">
              <span>🔒</span>
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
          <span className="protected-icon">🔒</span>
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
  }

  const handleAskChatFromWizard = (prompt) => {
    setPrefillPrompt(prompt)
    window.location.hash = ''
  }

  return (
    <LanguageProvider>
    <BrowserRouter>
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
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
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  )
}
