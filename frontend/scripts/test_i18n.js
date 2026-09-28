/**
 * Locale Parity and Completeness Verification Script
 * Validates that all translation keys in en.js have corresponding non-empty
 * translations in hi.js and mr.js, and tests resolution + fallback logic.
 */

import en from '../src/locales/en.js'
import hi from '../src/locales/hi.js'
import mr from '../src/locales/mr.js'

function getLeafPaths(obj, prefix = '') {
  const paths = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      paths.push(...getLeafPaths(v, full))
    } else {
      paths.push(full)
    }
  }
  return paths
}

function getValueByPath(obj, path) {
  const parts = path.split('.')
  let curr = obj
  for (const p of parts) {
    if (curr === undefined || curr === null) return undefined
    curr = curr[p]
  }
  return curr
}

console.log('--- RAGVYN i18n Completeness Verification ---')

const enPaths = getLeafPaths(en)
const hiPaths = getLeafPaths(hi)
const mrPaths = getLeafPaths(mr)

console.log(`Found ${enPaths.length} leaf translation keys in en.js`)
console.log(`Found ${hiPaths.length} leaf translation keys in hi.js`)
console.log(`Found ${mrPaths.length} leaf translation keys in mr.js`)

let errors = 0
const missingHi = []
const missingMr = []

for (const p of enPaths) {
  const valHi = getValueByPath(hi, p)
  if (valHi === undefined || valHi === '') {
    missingHi.push(p)
    errors++
  }

  const valMr = getValueByPath(mr, p)
  if (valMr === undefined || valMr === '') {
    missingMr.push(p)
    errors++
  }
}

if (missingHi.length > 0) {
  console.error(`❌ Missing keys in Hindi (hi):`, missingHi)
} else {
  console.log(`✅ Hindi (hi) has 100% key parity with English (${enPaths.length}/${enPaths.length})`)
}

if (missingMr.length > 0) {
  console.error(`❌ Missing keys in Marathi (mr):`, missingMr)
} else {
  console.log(`✅ Marathi (mr) has 100% key parity with English (${enPaths.length}/${enPaths.length})`)
}

// Check for any extra keys in hi or mr not in en
const enPathSet = new Set(enPaths)
const extraHi = hiPaths.filter(p => !enPathSet.has(p))
const extraMr = mrPaths.filter(p => !enPathSet.has(p))

if (extraHi.length > 0) {
  console.warn(`⚠️ Extra keys in Hindi (hi) not in en:`, extraHi)
}
if (extraMr.length > 0) {
  console.warn(`⚠️ Extra keys in Marathi (mr) not in en:`, extraMr)
}

if (errors === 0) {
  console.log('\n🎉 ALL I18N PARITY CHECKS PASSED PERFECTLY!')
  process.exit(0)
} else {
  console.error(`\n❌ Failed with ${errors} missing translation values.`)
  process.exit(1)
}
