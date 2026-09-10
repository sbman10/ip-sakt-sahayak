/**
 * IP Cost Calculator - Fee Configuration Data
 * 
 * This file contains configurable fee structures for different IP types,
 * jurisdictions, applicant categories, and professional services.
 * 
 * DISCLAIMER: These are estimated fees for reference only. Actual fees may vary
 * based on government updates, currency fluctuations, complexity, and service providers.
 * Always verify with official sources before filing.
 * 
 * Last Updated: September 2026
 * Currency: INR (Indian Rupees)
 */

// ============================================================
// IP TYPES
// ============================================================
export const IP_TYPES = [
  { 
    id: 'patent', 
    name: 'Patent', 
    icon: '📜',
    description: 'Protect novel inventions, processes, or formulations',
    examples: ['Novel drug delivery system', 'New extraction process', 'Synergistic herbal combination']
  },
  { 
    id: 'trademark', 
    name: 'Trademark', 
    icon: '™️',
    description: 'Protect brand names, logos, and product identities',
    examples: ['Brand name', 'Logo design', 'Product packaging', 'Tagline']
  },
  { 
    id: 'copyright', 
    name: 'Copyright', 
    icon: '©️',
    description: 'Protect original creative works and documentation',
    examples: ['Research papers', 'Product literature', 'Software', 'Marketing materials']
  },
  { 
    id: 'design', 
    name: 'Industrial Design', 
    icon: '🎨',
    description: 'Protect unique visual appearance of products',
    examples: ['Packaging design', 'Product shape', 'Container design', 'Label artwork']
  },
  { 
    id: 'gi', 
    name: 'Geographical Indication', 
    icon: '🏷️',
    description: 'Protect products with specific geographical origin',
    examples: ['Darjeeling Tea', 'Alphonso Mango', 'Kashmir Saffron', 'Tirupati Laddu']
  },
]

// ============================================================
// JURISDICTIONS
// ============================================================
export const JURISDICTIONS = [
  { id: 'india', name: 'India', flag: '🇮🇳', currency: 'INR', symbol: '₹' },
  { id: 'usa', name: 'United States', flag: '🇺🇸', currency: 'USD', symbol: '$' },
  { id: 'eu', name: 'European Union', flag: '🇪🇺', currency: 'EUR', symbol: '€' },
  { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', symbol: '£' },
  { id: 'china', name: 'China', flag: '🇨🇳', currency: 'CNY', symbol: '¥' },
  { id: 'japan', name: 'Japan', flag: '🇯🇵', currency: 'JPY', symbol: '¥' },
  { id: 'wipo', name: 'WIPO (PCT/Madrid)', flag: '🌍', currency: 'CHF', symbol: 'CHF' },
]

// ============================================================
// APPLICANT CATEGORIES
// ============================================================
export const APPLICANT_CATEGORIES = [
  { 
    id: 'individual', 
    name: 'Individual / Natural Person',
    description: 'Solo inventor, researcher, or Vaidya',
    discount: 0.2, // 80% fee for individuals in India
    icon: '👤'
  },
  { 
    id: 'startup', 
    name: 'Startup (DPIIT Recognized)',
    description: 'DPIIT registered startup entity',
    discount: 0.2, // 80% fee for startups in India
    icon: '🚀'
  },
  { 
    id: 'small', 
    name: 'Small Entity / MSME',
    description: 'Micro, Small, or Medium Enterprise',
    discount: 0.5, // 50% fee for small entities
    icon: '🏪'
  },
  { 
    id: 'large', 
    name: 'Large Entity / Corporation',
    description: 'Large company or multinational',
    discount: 1.0, // Full fee
    icon: '🏢'
  },
  { 
    id: 'educational', 
    name: 'Educational Institution',
    description: 'University, college, or research institute',
    discount: 0.2, // 80% fee for educational
    icon: '🎓'
  },
]

// ============================================================
// FILING TYPES
// ============================================================
export const FILING_TYPES = [
  { id: 'new', name: 'New Application', icon: '📝' },
  { id: 'renewal', name: 'Renewal / Maintenance', icon: '🔄' },
  { id: 'amendment', name: 'Amendment / Modification', icon: '✏️' },
  { id: 'pct', name: 'PCT International Filing', icon: '🌍' },
  { id: 'paris', name: 'Paris Convention Filing', icon: '🗼' },
  { id: 'opposition', name: 'Opposition Proceedings', icon: '⚖️' },
]

// ============================================================
// PROFESSIONAL SERVICES
// ============================================================
export const PROFESSIONAL_SERVICES = [
  {
    id: 'prior_art_search',
    name: 'Prior Art / Novelty Search',
    description: 'Comprehensive search of existing patents and publications',
    icon: '🔍',
    estimatedTime: '5-10 days',
    recommended: true,
  },
  {
    id: 'drafting',
    name: 'Patent / Trademark Drafting',
    description: 'Professional preparation of application documents',
    icon: '📄',
    estimatedTime: '10-20 days',
    recommended: true,
  },
  {
    id: 'legal_review',
    name: 'Legal Review & Opinion',
    description: 'Expert legal analysis and patentability opinion',
    icon: '⚖️',
    estimatedTime: '7-14 days',
    recommended: false,
  },
  {
    id: 'filing_assistance',
    name: 'Filing Assistance',
    description: 'Complete filing and submission support',
    icon: '📬',
    estimatedTime: '2-5 days',
    recommended: true,
  },
  {
    id: 'translation',
    name: 'Translation Services',
    description: 'Professional translation for international filings',
    icon: '🌐',
    estimatedTime: '5-15 days',
    recommended: false,
  },
  {
    id: 'office_action',
    name: 'Office Action Response',
    description: 'Prepare and file responses to examiner objections',
    icon: '📩',
    estimatedTime: '15-30 days',
    recommended: false,
  },
  {
    id: 'expedited',
    name: 'Expedited Processing',
    description: 'Fast-track examination and processing',
    icon: '⚡',
    estimatedTime: 'Reduced timeline',
    recommended: false,
  },
  {
    id: 'renewal_monitoring',
    name: 'Renewal Monitoring & Management',
    description: 'Track and manage renewal deadlines',
    icon: '📅',
    estimatedTime: 'Ongoing',
    recommended: false,
  },
]

// ============================================================
// FEE STRUCTURES BY IP TYPE AND JURISDICTION
// All fees in INR (base fees for large entity, others get discounts)
// ============================================================
export const FEE_STRUCTURES = {
  patent: {
    india: {
      // Government Fees (base for large entity)
      government: {
        filing: 8000,
        publication: 2500,
        examination: 20000,
        grant: 22500,
        certificate: 1000,
        // Annual renewal fees (years 3-20)
        renewal: {
          year3to6: 4800,
          year7to10: 12000,
          year11to15: 24000,
          year16to20: 48000,
        },
      },
      // Professional Service Fees (estimated ranges)
      professional: {
        prior_art_search: { min: 15000, max: 50000 },
        drafting: { min: 40000, max: 150000 },
        legal_review: { min: 20000, max: 75000 },
        filing_assistance: { min: 10000, max: 30000 },
        translation: { min: 5000, max: 25000 },
        office_action: { min: 15000, max: 50000 },
        expedited: { min: 60000, max: 125000 },
        renewal_monitoring: { min: 5000, max: 15000 },
      },
      // Additional costs
      additional: {
        perClaim: 1600, // Additional claims beyond 10
        perPage: 320, // Additional pages beyond 30
        perInventor: 0, // No extra fee per inventor in India
        lateRenewal: 0.1, // 10% surcharge per month
      },
      timeline: '3-5 years for grant',
    },
    usa: {
      government: {
        filing: 128000, // ~$1600 converted
        search: 52000,
        examination: 64000,
        grant: 80000,
        renewal: {
          year3to4: 128000,
          year7to8: 296000,
          year11to12: 496000,
        },
      },
      professional: {
        prior_art_search: { min: 80000, max: 200000 },
        drafting: { min: 240000, max: 640000 },
        legal_review: { min: 80000, max: 240000 },
        filing_assistance: { min: 40000, max: 120000 },
        translation: { min: 40000, max: 160000 },
        office_action: { min: 120000, max: 320000 },
        expedited: { min: 200000, max: 400000 },
        renewal_monitoring: { min: 16000, max: 48000 },
      },
      additional: {
        perClaim: 8000,
        perPage: 0,
        perInventor: 0,
        lateRenewal: 0.5,
      },
      timeline: '2-4 years for grant',
    },
    wipo: {
      government: {
        filing: 120000, // PCT international filing
        search: 160000,
        examination: 0, // National phase
        transmittal: 8000,
        designation: 55000, // Per country
      },
      professional: {
        prior_art_search: { min: 60000, max: 150000 },
        drafting: { min: 80000, max: 300000 },
        legal_review: { min: 60000, max: 200000 },
        filing_assistance: { min: 40000, max: 100000 },
        translation: { min: 80000, max: 300000 },
        office_action: { min: 80000, max: 250000 },
        expedited: { min: 150000, max: 350000 },
        renewal_monitoring: { min: 30000, max: 80000 },
      },
      additional: {
        perClaim: 4000,
        perPage: 1200,
        perCountry: 55000,
        lateRenewal: 0.5,
      },
      timeline: '30 months to enter national phase',
    },
  },
  trademark: {
    india: {
      government: {
        filing: 9000, // Per class (e-filing)
        certificate: 500,
        renewal: 9000, // Every 10 years
        opposition: 3000,
      },
      professional: {
        prior_art_search: { min: 5000, max: 15000 },
        drafting: { min: 8000, max: 25000 },
        legal_review: { min: 10000, max: 30000 },
        filing_assistance: { min: 5000, max: 15000 },
        translation: { min: 2000, max: 8000 },
        office_action: { min: 8000, max: 25000 },
        expedited: { min: 25000, max: 50000 },
        renewal_monitoring: { min: 3000, max: 8000 },
      },
      additional: {
        perClass: 9000,
        lateRenewal: 0.1,
      },
      timeline: '12-18 months for registration',
    },
    wipo: {
      government: {
        filing: 53000, // Madrid Protocol basic fee
        designation: 8000, // Per country designation
        renewal: 53000, // Every 10 years
      },
      professional: {
        prior_art_search: { min: 20000, max: 60000 },
        drafting: { min: 25000, max: 80000 },
        legal_review: { min: 30000, max: 100000 },
        filing_assistance: { min: 20000, max: 50000 },
        translation: { min: 15000, max: 60000 },
        office_action: { min: 25000, max: 80000 },
        expedited: { min: 50000, max: 120000 },
        renewal_monitoring: { min: 15000, max: 40000 },
      },
      additional: {
        perClass: 8000,
        perCountry: 8000,
        lateRenewal: 0.5,
      },
      timeline: '12-18 months for international registration',
    },
  },
  copyright: {
    india: {
      government: {
        filing: 500, // Literary work
        filingArtistic: 500,
        filingSoftware: 2000,
        filingFilm: 5000,
      },
      professional: {
        drafting: { min: 5000, max: 20000 },
        legal_review: { min: 8000, max: 25000 },
        filing_assistance: { min: 3000, max: 10000 },
      },
      additional: {},
      timeline: '1-2 months for registration',
    },
  },
  design: {
    india: {
      government: {
        filing: 4000, // Per design
        renewal: 4000, // Every 5 years (up to 15 years total)
        certificate: 500,
      },
      professional: {
        prior_art_search: { min: 8000, max: 25000 },
        drafting: { min: 15000, max: 50000 },
        legal_review: { min: 10000, max: 35000 },
        filing_assistance: { min: 5000, max: 15000 },
        office_action: { min: 10000, max: 30000 },
      },
      additional: {
        perDesign: 1000,
        lateRenewal: 0.1,
      },
      timeline: '6-12 months for registration',
    },
    wipo: {
      government: {
        filing: 26000, // Hague System basic fee
        publication: 14000,
        designation: 4200, // Per contracting party
      },
      professional: {
        prior_art_search: { min: 20000, max: 50000 },
        drafting: { min: 30000, max: 100000 },
        legal_review: { min: 25000, max: 80000 },
        filing_assistance: { min: 15000, max: 40000 },
        translation: { min: 10000, max: 40000 },
      },
      additional: {
        perDesign: 3500,
        perCountry: 4200,
      },
      timeline: '6-12 months for international registration',
    },
  },
  gi: {
    india: {
      government: {
        filing: 5000, // Application fee
        registration: 5000,
        renewal: 3000, // Every 10 years
      },
      professional: {
        prior_art_search: { min: 20000, max: 60000 },
        drafting: { min: 30000, max: 100000 },
        legal_review: { min: 25000, max: 75000 },
        filing_assistance: { min: 15000, max: 40000 },
      },
      additional: {},
      timeline: '12-24 months for registration',
    },
  },
}

// ============================================================
// CURRENCY CONVERSION RATES (approximate, for display only)
// Base currency: INR
// ============================================================
export const CURRENCY_RATES = {
  INR: 1,
  USD: 0.012, // 1 INR = 0.012 USD (approx)
  EUR: 0.011,
  GBP: 0.0095,
  CHF: 0.011,
  CNY: 0.086,
  JPY: 1.8,
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get fee structure for specific IP type and jurisdiction
 */
export function getFeeStructure(ipType, jurisdiction) {
  return FEE_STRUCTURES[ipType]?.[jurisdiction] || FEE_STRUCTURES[ipType]?.india
}

/**
 * Apply applicant category discount to a fee
 */
export function applyDiscount(fee, applicantCategory) {
  const category = APPLICANT_CATEGORIES.find(c => c.id === applicantCategory)
  return Math.round(fee * (category?.discount || 1))
}

/**
 * Convert currency
 */
export function convertCurrency(amountINR, toCurrency) {
  const rate = CURRENCY_RATES[toCurrency] || 1
  return Math.round(amountINR * rate)
}

/**
 * Format currency for display
 */
export function formatCurrency(amount, currency = 'INR') {
  const jurisdiction = JURISDICTIONS.find(j => j.currency === currency)
  const symbol = jurisdiction?.symbol || '₹'
  
  if (currency === 'INR') {
    // Indian numbering system (lakhs, crores)
    if (amount >= 10000000) {
      return `${symbol}${(amount / 10000000).toFixed(2)} Cr`
    } else if (amount >= 100000) {
      return `${symbol}${(amount / 100000).toFixed(2)} L`
    } else if (amount >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(1)}K`
    }
    return `${symbol}${amount.toLocaleString('en-IN')}`
  }
  
  return `${symbol}${amount.toLocaleString()}`
}

/**
 * Calculate total government fees for a filing
 */
export function calculateGovernmentFees(config) {
  const { ipType, jurisdiction, applicantCategory, filingType, claims = 10, pages = 30, classes = 1, countries = 1 } = config
  
  const feeStructure = getFeeStructure(ipType, jurisdiction)
  if (!feeStructure) return { total: 0, breakdown: [] }
  
  const breakdown = []
  let total = 0
  
  const govt = feeStructure.government
  const additional = feeStructure.additional || {}
  
  if (filingType === 'new') {
    // Filing fee
    if (govt.filing) {
      const fee = applyDiscount(govt.filing, applicantCategory)
      breakdown.push({ name: 'Filing Fee', amount: fee })
      total += fee
    }
    
    // Search fee (if applicable)
    if (govt.search) {
      const fee = applyDiscount(govt.search, applicantCategory)
      breakdown.push({ name: 'Search Fee', amount: fee })
      total += fee
    }
    
    // Examination fee
    if (govt.examination) {
      const fee = applyDiscount(govt.examination, applicantCategory)
      breakdown.push({ name: 'Examination Fee', amount: fee })
      total += fee
    }
    
    // Publication fee
    if (govt.publication) {
      const fee = applyDiscount(govt.publication, applicantCategory)
      breakdown.push({ name: 'Publication Fee', amount: fee })
      total += fee
    }
    
    // Grant/Registration fee
    if (govt.grant) {
      const fee = applyDiscount(govt.grant, applicantCategory)
      breakdown.push({ name: 'Grant/Registration Fee', amount: fee })
      total += fee
    }
    
    // Additional claims (patents)
    if (ipType === 'patent' && claims > 10 && additional.perClaim) {
      const extraClaims = claims - 10
      const fee = applyDiscount(additional.perClaim * extraClaims, applicantCategory)
      breakdown.push({ name: `Extra Claims (${extraClaims})`, amount: fee })
      total += fee
    }
    
    // Additional pages (patents)
    if (ipType === 'patent' && pages > 30 && additional.perPage) {
      const extraPages = pages - 30
      const fee = applyDiscount(additional.perPage * extraPages, applicantCategory)
      breakdown.push({ name: `Extra Pages (${extraPages})`, amount: fee })
      total += fee
    }
    
    // Additional classes (trademarks)
    if (ipType === 'trademark' && classes > 1 && additional.perClass) {
      const extraClasses = classes - 1
      const fee = applyDiscount(additional.perClass * extraClasses, applicantCategory)
      breakdown.push({ name: `Extra Classes (${extraClasses})`, amount: fee })
      total += fee
    }
    
    // International designations
    if ((jurisdiction === 'wipo' || filingType === 'pct') && countries > 1 && (additional.perCountry || govt.designation)) {
      const feePerCountry = additional.perCountry || govt.designation
      const extraCountries = countries - 1
      const fee = feePerCountry * extraCountries
      breakdown.push({ name: `Country Designations (${extraCountries})`, amount: fee })
      total += fee
    }
  } else if (filingType === 'renewal') {
    // Renewal fees
    if (govt.renewal) {
      if (typeof govt.renewal === 'object') {
        // Patent-style annual renewals
        const avgRenewal = Object.values(govt.renewal).reduce((a, b) => a + b, 0) / Object.keys(govt.renewal).length
        const fee = applyDiscount(avgRenewal, applicantCategory)
        breakdown.push({ name: 'Annual Renewal (Average)', amount: fee })
        total += fee
      } else {
        const fee = applyDiscount(govt.renewal, applicantCategory)
        breakdown.push({ name: 'Renewal Fee', amount: fee })
        total += fee
      }
    }
  }
  
  return { total, breakdown }
}

/**
 * Calculate professional service fees
 */
export function calculateProfessionalFees(config) {
  const { ipType, jurisdiction, services = [] } = config
  
  const feeStructure = getFeeStructure(ipType, jurisdiction)
  if (!feeStructure || !feeStructure.professional) return { min: 0, max: 0, breakdown: [] }
  
  const breakdown = []
  let minTotal = 0
  let maxTotal = 0
  
  services.forEach(serviceId => {
    const serviceFee = feeStructure.professional[serviceId]
    if (serviceFee) {
      const service = PROFESSIONAL_SERVICES.find(s => s.id === serviceId)
      breakdown.push({
        name: service?.name || serviceId,
        min: serviceFee.min,
        max: serviceFee.max,
      })
      minTotal += serviceFee.min
      maxTotal += serviceFee.max
    }
  })
  
  return { min: minTotal, max: maxTotal, breakdown }
}

// ============================================================
// COST ESTIMATE SUMMARY GENERATOR
// ============================================================
export function generateCostEstimate(config) {
  const {
    ipType,
    jurisdiction,
    applicantCategory,
    filingType,
    claims = 10,
    pages = 30,
    classes = 1,
    countries = 1,
    services = [],
  } = config
  
  const govtFees = calculateGovernmentFees({
    ipType,
    jurisdiction,
    applicantCategory,
    filingType,
    claims,
    pages,
    classes,
    countries,
  })
  
  const profFees = calculateProfessionalFees({
    ipType,
    jurisdiction,
    services,
  })
  
  const feeStructure = getFeeStructure(ipType, jurisdiction)
  
  // Calculate totals
  const minTotal = govtFees.total + profFees.min
  const maxTotal = govtFees.total + profFees.max
  const recommendedBudget = Math.round((minTotal + maxTotal) / 2 * 1.15) // 15% buffer
  
  // One-time vs recurring
  const oneTimeCosts = govtFees.total + profFees.min
  const recurringCosts = feeStructure?.government?.renewal 
    ? (typeof feeStructure.government.renewal === 'object' 
        ? Object.values(feeStructure.government.renewal)[0] 
        : feeStructure.government.renewal)
    : 0
  
  return {
    ipType: IP_TYPES.find(t => t.id === ipType),
    jurisdiction: JURISDICTIONS.find(j => j.id === jurisdiction),
    applicantCategory: APPLICANT_CATEGORIES.find(c => c.id === applicantCategory),
    filingType: FILING_TYPES.find(f => f.id === filingType),
    
    governmentFees: govtFees,
    professionalFees: profFees,
    
    summary: {
      minTotal,
      maxTotal,
      recommendedBudget,
      oneTimeCosts,
      recurringCosts,
      timeline: feeStructure?.timeline || 'Varies',
    },
    
    config,
    generatedAt: new Date().toISOString(),
    
    disclaimer: 'These are estimated fees for reference only. Actual fees may vary based on government updates, currency fluctuations, case complexity, and professional service providers. Always verify with official sources before filing. This does not constitute legal or financial advice.',
  }
}
