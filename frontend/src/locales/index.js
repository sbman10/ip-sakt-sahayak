/**
 * i18n Core System for RAGVYN / IP-SAKTI Sahayak
 * Phase 3 Architecture: Structured dictionaries, zero external APIs,
 * persistent state, fallback to English, and dev-only completeness warnings.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import en from './en'
import hi from './hi'
import mr from './mr'

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: 'EN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: 'HI' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: 'MR' },
]

export const RAW_DICTIONARIES = { en, hi, mr }

/**
 * Recursively flatten a nested dictionary into dot-notation paths,
 * while ALSO preserving the leaf key at the root level for full
 * backward-compatibility with existing legacy flat calls (e.g. t('home')).
 */
function buildFlattenedDictionary(dict) {
  const flattened = {}

  function walk(obj, prefix = '') {
    for (const [k, v] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        walk(v, fullPath)
      } else {
        flattened[fullPath] = v
        // Also register the leaf key if not yet claimed (or prioritize common/navigation)
        if (flattened[k] === undefined) {
          flattened[k] = v
        }
      }
    }
  }

  walk(dict)
  return flattened
}

const FLATTENED_LOCALES = {
  en: buildFlattenedDictionary(en),
  hi: buildFlattenedDictionary(hi),
  mr: buildFlattenedDictionary(mr),
}

/**
 * Resolve a translation key for a given locale with fallback to English,
 * and dev-only console warning for missing keys.
 */
export function getTranslation(lang, key, fallback = '') {
  if (!key) return fallback || ''

  const safeLang = (lang && FLATTENED_LOCALES[lang]) ? lang : 'en'
  const localeDict = FLATTENED_LOCALES[safeLang]
  const enDict = FLATTENED_LOCALES['en']

  // 1. Direct match in requested language
  if (localeDict && localeDict[key] !== undefined && localeDict[key] !== '') {
    return localeDict[key]
  }

  // 2. Fallback to English
  if (enDict && enDict[key] !== undefined && enDict[key] !== '') {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV && safeLang !== 'en') {
      console.warn(`[i18n] Missing translation for key: "${key}" in locale: "${safeLang}". Falling back to English.`)
    }
    return enDict[key]
  }

  // 3. User-provided fallback or human-friendly key
  if (fallback) return fallback

  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    console.warn(`[i18n] Unresolved translation key: "${key}" in all dictionaries.`)
  }

  // Never show raw machine keys with ugly paths if we can avoid it
  return key
}

export const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key, fallback) => getTranslation('en', key, fallback),
  languages: SUPPORTED_LOCALES,
  supportedLocales: SUPPORTED_LOCALES,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('ragvyn_lang') || localStorage.getItem('ip_sakti_lang')
      if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr')) {
        return saved
      }
      // Check browser language
      const browserLang = (navigator.language || '').toLowerCase().slice(0, 2)
      if (browserLang === 'hi' || browserLang === 'mr') {
        return browserLang
      }
    } catch {
      // LocalStorage access may fail in restricted sandboxes
    }
    return 'en'
  })

  const setLang = useCallback((nextLang) => {
    const validLang = (nextLang === 'hi' || nextLang === 'mr') ? nextLang : 'en'
    setLangState(validLang)
    try {
      localStorage.setItem('ragvyn_lang', validLang)
      localStorage.setItem('ip_sakti_lang', validLang)
    } catch {
      // ignore storage errors
    }
    document.documentElement.setAttribute('lang', validLang)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
  }, [lang])

  const t = useCallback((key, fallback) => {
    return getTranslation(lang, key, fallback)
  }, [lang])

  const contextValue = useMemo(() => ({
    lang,
    setLang,
    t,
    languages: SUPPORTED_LOCALES,
    supportedLocales: SUPPORTED_LOCALES,
  }), [lang, setLang, t])

  return React.createElement(
    LanguageContext.Provider,
    { value: contextValue },
    children
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

/**
 * Diagnostic parity validator across all supported locales.
 * Used in tests or build verification to ensure 100% key completeness.
 */
export function validateLocaleParity() {
  const enKeys = Object.keys(FLATTENED_LOCALES.en)
  const missingInHi = []
  const missingInMr = []

  for (const k of enKeys) {
    if (FLATTENED_LOCALES.hi[k] === undefined || FLATTENED_LOCALES.hi[k] === '') {
      missingInHi.push(k)
    }
    if (FLATTENED_LOCALES.mr[k] === undefined || FLATTENED_LOCALES.mr[k] === '') {
      missingInMr.push(k)
    }
  }

  return {
    isValid: missingInHi.length === 0 && missingInMr.length === 0,
    totalEnglishKeys: enKeys.length,
    missingInHi,
    missingInMr,
  }
}
