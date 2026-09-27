/**
 * IP-SAKTI / RAGVYN - Centralized Route Registry & Sitemap Configuration
 * Single source of truth for public navigation, footer links, and the /sitemap directory.
 * Conforms strictly to real, verified frontend routes in the codebase.
 */

export const SITEMAP_GROUPS = [
  {
    id: 'core',
    title: 'Core Navigation & Access',
    titleKey: 'sitemap.group.core',
    description: 'Primary entry points, public portal landing, and statutory AI consultation.',
    icon: 'IconHome',
  },
  {
    id: 'tools',
    title: 'IP & AYUSH Utility Tools',
    titleKey: 'sitemap.group.tools',
    description: 'Statutory diagnostic, fee estimation, deadline computation, and filing modules.',
    icon: 'IconFlask',
  },
  {
    id: 'sources',
    title: 'Knowledge & Legal Corpora',
    titleKey: 'sitemap.group.sources',
    description: 'Verified statutory texts, TKDL references, and official pharmacopoeia databases.',
    icon: 'IconScroll',
  },
  {
    id: 'workspace',
    title: 'Practitioner Workspace & Vault',
    titleKey: 'sitemap.group.workspace',
    description: 'Matter prosecution management, document indexing, and innovation records.',
    icon: 'IconFolder',
  },
  {
    id: 'guidance',
    title: 'Institutional & Legal Policy',
    titleKey: 'sitemap.group.guidance',
    description: 'Data protection governance, terms of service, and directory documentation.',
    icon: 'IconShieldCheck',
  },
]

export const SITEMAP_ROUTES = [
  // --- CORE GROUP ---
  {
    path: '/',
    title: 'Portal Home',
    titleKey: 'sitemap.home.title',
    description: 'National IP & regulatory assistance portal for traditional knowledge, Ayurvedic formulations, and patent eligibility.',
    descriptionKey: 'sitemap.home.description',
    group: 'core',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Public Portal',
  },
  {
    path: '/chat',
    title: 'AI Consultation & Statutory Search',
    titleKey: 'sitemap.chat.title',
    description: 'Interactive statutory reasoning assistant powered by verified IP statutes, TKDL references, and ASU guidelines.',
    descriptionKey: 'sitemap.chat.description',
    group: 'core',
    visibility: 'public',
    footerEligible: true,
    authRequired: true,
    badge: 'Requires Login',
  },
  {
    path: '/login',
    title: 'Account Authentication & Access',
    titleKey: 'sitemap.login.title',
    description: 'Institutional sign-in for registered patent agents, AYUSH innovators, and research practitioners.',
    descriptionKey: 'sitemap.login.description',
    group: 'core',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Auth',
  },

  // --- TOOLS GROUP ---
  {
    path: '/formulation-wizard',
    title: 'Formulation Classification Wizard',
    titleKey: 'sitemap.formulationWizard.title',
    description: 'Evaluate Ayurvedic formulations against Section 3(p) patent bars and ASU Rule 158-B manufacturing pathways.',
    descriptionKey: 'sitemap.formulationWizard.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Statutory Engine',
  },
  {
    path: '/abs-checker',
    title: 'ABS Compliance Checker',
    titleKey: 'sitemap.absChecker.title',
    description: 'Verify mandatory National Biodiversity Authority (NBA) approval triggers under the Biological Diversity Act 2002.',
    descriptionKey: 'sitemap.absChecker.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Biodiversity Act',
  },
  {
    path: '/ip-calculator',
    title: 'Official IP Cost Calculator',
    titleKey: 'sitemap.ipCalculator.title',
    description: 'Compute Indian Patent Office statutory fees across applicant categories (Individual, Startup, Small Entity, Large Entity).',
    descriptionKey: 'sitemap.ipCalculator.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Patents Rules 2003',
  },
  {
    path: '/deadline-calculator',
    title: 'Statutory Deadline Calculator',
    titleKey: 'sitemap.deadlineCalculator.title',
    description: 'Track critical prosecution milestones (RFE, FER response, Convention priority, PCT) to avoid abandonment.',
    descriptionKey: 'sitemap.deadlineCalculator.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Prosecution',
  },
  {
    path: '/checklists',
    title: 'IP Statutory Filing Checklists',
    titleKey: 'sitemap.checklists.title',
    description: 'Interactive procedural roadmaps for Patents, AYUSH Section 3(p) defense, Trademarks (TM-A), GI, and NBA approvals.',
    descriptionKey: 'sitemap.checklists.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Procedural',
  },
  {
    path: '/drafts',
    title: 'Statutory Document Preparation Assistant',
    titleKey: 'sitemap.drafts.title',
    description: 'Draft structured templates for Patent Form-1, Form-2 complete specifications, NBA Form-III, and Section 3(p) petitions.',
    descriptionKey: 'sitemap.drafts.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Drafting',
  },
  {
    path: '/patentability',
    title: 'Patentability Assessment Engine',
    titleKey: 'sitemap.patentability.title',
    description: 'Detailed analysis of novelty, inventive step, and statutory exclusions under Sections 3(a) through 3(p) of the Patents Act.',
    descriptionKey: 'sitemap.patentability.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Patents Act § 3',
  },
  {
    path: '/verdict',
    title: 'Statutory Verdict Engine',
    titleKey: 'sitemap.verdict.title',
    description: 'Multi-statute diagnostic synthesizing patent bar risks, drug regulatory status, and biodiversity clearances.',
    descriptionKey: 'sitemap.verdict.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Diagnostic',
  },
  {
    path: '/roadmap',
    title: 'IP Journey Roadmap',
    titleKey: 'sitemap.roadmap.title',
    description: 'Step-by-step institutional guide from laboratory formulation research to commercial grant and regulatory compliance.',
    descriptionKey: 'sitemap.roadmap.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Milestones',
  },
  {
    path: '/guardian',
    title: 'Dual-Use Bio-Resource Guardian',
    titleKey: 'sitemap.guardian.title',
    description: 'Screen botanical compounds and biological agents against national biosecurity schedules and SCOMET dual-use lists.',
    descriptionKey: 'sitemap.guardian.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Biosecurity',
  },
  {
    path: '/experts',
    title: 'Expert Connect Directory',
    titleKey: 'sitemap.experts.title',
    description: 'Directory of registered Indian patent agents, traditional knowledge attorneys, and ASU regulatory consultants.',
    descriptionKey: 'sitemap.experts.description',
    group: 'tools',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Practitioners',
  },

  // --- SOURCES GROUP ---
  {
    path: '/sources',
    title: 'Official Data Corpora & Statutes',
    titleKey: 'sitemap.sources.title',
    description: 'Verified statutory knowledge base: Patents Act 1970, Biological Diversity Act 2002, Drugs & Cosmetics Act 1940, and TKDL citations.',
    descriptionKey: 'sitemap.sources.description',
    group: 'sources',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Official Corpora',
  },

  // --- WORKSPACE GROUP ---
  {
    path: '/workspace',
    title: 'Matter Workspace',
    titleKey: 'sitemap.workspace.title',
    description: 'Manage filing matters, case timelines, statutory checklists, and client innovation records in one unified workspace.',
    descriptionKey: 'sitemap.workspace.description',
    group: 'workspace',
    visibility: 'public',
    footerEligible: true,
    authRequired: true,
    badge: 'Requires Login',
  },
  {
    path: '/documents',
    title: 'My Documents & Regulatory Vault',
    titleKey: 'sitemap.documents.title',
    description: 'Upload, verify, and index scientific disclosures, lab reports, prior art documents, and official certificates.',
    descriptionKey: 'sitemap.documents.description',
    group: 'workspace',
    visibility: 'public',
    footerEligible: true,
    authRequired: true,
    badge: 'Requires Login',
  },

  // --- GUIDANCE & INSTITUTIONAL POLICY GROUP ---
  {
    path: '/pricing',
    title: 'Pricing & Subscription Tiers',
    titleKey: 'sitemap.pricing.title',
    description: 'Institutional access tiers for individual innovators, research universities, and enterprise IP law departments.',
    descriptionKey: 'sitemap.pricing.description',
    group: 'guidance',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Access',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy & DPDP Governance',
    titleKey: 'sitemap.privacy.title',
    description: 'Digital Personal Data Protection (DPDP) Act 2023 compliance, data encryption standards, and institutional confidentiality.',
    descriptionKey: 'sitemap.privacy.description',
    group: 'guidance',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'DPDP Act',
  },
  {
    path: '/sitemap',
    title: 'Complete Sitemap & Directory',
    titleKey: 'sitemap.sitemapPage.title',
    description: 'Comprehensive, structured directory of all public pages, statutory engines, and regulatory tools in the portal.',
    descriptionKey: 'sitemap.sitemapPage.description',
    group: 'guidance',
    visibility: 'public',
    footerEligible: true,
    authRequired: false,
    badge: 'Directory',
  },
]

/**
 * Returns all routes belonging to a specific group
 */
export function getRoutesByGroup(groupId) {
  return SITEMAP_ROUTES.filter(route => route.group === groupId)
}

/**
 * Returns all routes marked as footer eligible
 */
export function getFooterRoutes() {
  return SITEMAP_ROUTES.filter(route => route.footerEligible)
}

/**
 * Returns the list of all defined sitemap groups
 */
export function getAllGroups() {
  return SITEMAP_GROUPS
}
