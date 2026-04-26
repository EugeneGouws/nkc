/**
 * xlsxParser.js — parse restaurant-style costing spreadsheets into recipe sheets.
 *
 * parseXlsx(buffer) → RecipeSheet[]
 *
 * RecipeSheet: {
 *   title: string,
 *   sections: Section[],
 *   costPerServing: number,   // sum of all section costs per serving
 * }
 *
 * Section: {
 *   label: string,            // section heading or "Main"
 *   ingredients: Ingredient[],
 *   subtotal: number,
 *   yield: number,
 *   use: number,
 *   costPerServing: number,
 * }
 *
 * Ingredient: {
 *   name: string,             // normalised to lowercase
 *   pricePerUnit: number,
 *   unit: string,             // 'kg' | 'l' | 'each' | ''
 *   qtyUsed: number,
 *   lineTotal: number,
 * }
 */

import * as XLSX from 'xlsx'

const SKIP_SHEETS = new Set(['NOTES AND FORMULA', 'Sheet5', 'Sheet6'])

function isEmpty(v) {
  return v === null || v === undefined || v === ''
}

function isNum(v) {
  return typeof v === 'number' && !isNaN(v)
}

function toNum(v) {
  if (isNum(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(',', '.').trim()
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function titleCase(s) {
  return s.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')
}

function normaliseUnit(u) {
  if (typeof u !== 'string') return ''
  const t = u.trim().toLowerCase()
  if (t === 'kg') return 'kg'
  if (t === 'l')  return 'l'
  if (t === 'each') return 'each'
  return ''
}

// "YIELD 3KG" / "YIELD:1" / "YIELD:0,870" / "YIELD 2 PORTIONS" → number
// "USE 1KG" / "USE:" → number (use defaults to 1 if empty)
function parseYieldOrUse(str, defaultVal = 0) {
  if (typeof str !== 'string') return defaultVal
  // Strip label + colon, leave number + optional unit/words
  const stripped = str.replace(/^(YIELD|USE)\s*:?\s*/i, '').trim()
  if (!stripped) return defaultVal
  // Find first number (allow comma decimal)
  const m = stripped.match(/[\d]+(?:[.,][\d]+)?/)
  if (!m) return defaultVal
  return parseFloat(m[0].replace(',', '.'))
}

function isHeaderLabelRow(row) {
  const c0 = row[0]
  if (typeof c0 !== 'string') return false
  const upper = c0.toUpperCase()
  return upper.includes('INGREDIENT') || upper.includes('PRICE')
}

function isSectionLabelRow(row) {
  const c0 = row[0]
  if (typeof c0 !== 'string' || c0.trim() === '') return false
  return isEmpty(row[1]) && isEmpty(row[2]) && isEmpty(row[3]) && isEmpty(row[4])
}

function isIngredientRow(row) {
  const c0 = row[0]
  if (typeof c0 !== 'string' || c0.trim() === '') return false
  if (!isNum(row[3]) || row[3] <= 0) return false
  return true
}

function newSection(label) {
  return {
    label,
    ingredients: [],
    subtotal: 0,
    yield: 0,
    use: 1,
    costPerServing: 0,
  }
}

function finaliseSection(section) {
  // If subtotal not explicitly set, derive from ingredient line totals
  if (!section.subtotal) {
    section.subtotal = section.ingredients.reduce((s, i) => s + i.lineTotal, 0)
  }
  const divisor = section.yield > 0 ? section.yield / Math.max(section.use, 0.0000001) : 1
  section.costPerServing = divisor > 0 ? section.subtotal / divisor : section.subtotal
}

function parseSheet(rows, sheetName) {
  const titleCell = rows[0]?.[0]
  const title = typeof titleCell === 'string' && titleCell.trim()
    ? titleCase(titleCell)
    : titleCase(sheetName)

  const sections = []
  let current = newSection('Main')

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    if (isHeaderLabelRow(row)) continue

    if (isSectionLabelRow(row)) {
      if (current.ingredients.length > 0) {
        finaliseSection(current)
        sections.push(current)
      }
      current = newSection(row[0].trim())
      continue
    }

    if (isIngredientRow(row)) {
      const lineTotal = isNum(row[4]) ? row[4] : 0
      current.ingredients.push({
        name:         String(row[0]).trim().toLowerCase(),
        pricePerUnit: toNum(row[1]),
        unit:         normaliseUnit(row[2]),
        qtyUsed:      toNum(row[3]),
        lineTotal,
      })
      continue
    }

    // Yield row
    if (typeof row[4] === 'string' && /YIELD/i.test(row[4])) {
      current.yield = parseYieldOrUse(row[4], 0)
      continue
    }

    // Use row
    if (typeof row[4] === 'string' && /USE/i.test(row[4])) {
      current.use = parseYieldOrUse(row[4], 1) || 1
      continue
    }

    // Subtotal row: col 0 empty, col 4 numeric
    if (isEmpty(row[0]) && isNum(row[4])) {
      current.subtotal = row[4]
      continue
    }
  }

  if (current.ingredients.length > 0) {
    finaliseSection(current)
    sections.push(current)
  }

  if (sections.length === 0) return null

  const costPerServing = sections.reduce((s, sec) => s + (sec.costPerServing || 0), 0)
  return { title, sections, costPerServing }
}

export function parseXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const out = []

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) continue
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false })
    if (!rows || rows.length === 0) continue

    const recipe = parseSheet(rows, sheetName)
    if (recipe && recipe.sections.length > 0) {
      out.push(recipe)
    }
  }

  return out
}
