export const fields = {
  date: ['날짜', '거래일', '매출일', '거래일자', '판매일', '결제일', '일자', 'date', 'transactiondate', 'salesdate', 'orderdate', 'paymentdate'],
  customer: ['고객사', '고객', '회사명', '기업명', '거래처', '고객명', 'customer', 'company', 'client', 'customername', 'account'],
  service: ['서비스', '서비스명', '교육과정', '과정명', '교육명', '상품', '상품명', 'service', 'product', 'course', 'program', 'servicename'],
  quantity: ['수량', '인원', '참가인원', '참여인원', '교육인원', '참가자수', 'quantity', 'qty', 'units', 'participants', 'headcount'],
  price: ['단가', '교육단가', '인당단가', '1인당금액', 'unitprice', 'price', 'rate', 'priceperperson'],
  revenue: ['매출액', '매출', '총매출', '결제금액', '합계금액', '공급가액', 'revenue', 'salesamount', 'totalamount'],
}
export const required = ['date', 'customer', 'service']
export const labels = Object.fromEntries(Object.entries(fields).map(([key, aliases]) => [key, aliases[0]]))
const normalize = (value) => value.normalize('NFKC').toLowerCase().replace(/\((?:원|krw)\)|[\s_.-]/g, '')

export function parseCsv(text, delimiter) {
  const rows = []
  let row = [], cell = '', quoted = false, closed = false, line = 1, start = 1
  text = text.replace(/^\uFEFF/, '')
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false }
  const pushRow = () => {
    pushCell()
    if (row.some(Boolean) || row.length > 1) rows.push({ cells: row, line: start })
    row = []
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++ }
      else if (char === '"') { quoted = false; closed = true }
      else {
        cell += char
        if (char === '\n' || (char === '\r' && text[index + 1] !== '\n')) line++
      }
    } else if (char === delimiter) pushCell()
    else if (char === '\n' || char === '\r') {
      pushRow()
      if (char === '\r' && text[index + 1] === '\n') index++
      start = ++line
    } else if (char === '"' && !closed && !cell.trim()) { cell = ''; quoted = true }
    else if (char === '"' || (closed && !/\s/.test(char))) throw new Error(`${line}행의 따옴표 형식을 확인해 주세요.`)
    else cell += char
  }
  if (quoted) throw new Error(`${start}행에 닫히지 않은 따옴표가 있습니다.`)
  if (row.length || cell || closed) pushRow()
  return rows
}

export function readCsv(bytes) {
  const raw = new Uint8Array(bytes)
  let text
  const utf16 = raw[0] === 255 && raw[1] === 254 ? 'utf-16le' :
    raw[0] === 254 && raw[1] === 255 ? 'utf-16be' : null
  try { text = new TextDecoder(utf16 || 'utf-8', { fatal: true }).decode(raw) }
  catch {
    if (utf16) throw new Error('UTF-16 파일을 읽을 수 없습니다.')
    try { text = new TextDecoder('euc-kr', { fatal: true }).decode(raw) }
    catch { throw new Error('파일을 UTF-8 또는 CP949 인코딩으로 다시 저장해 주세요.') }
  }
  if (!text.trim() || text.includes('\0')) throw new Error('읽을 수 있는 CSV 데이터가 없습니다.')
  const candidates = []
  const errors = []
  for (const delimiter of [',', '\t', ';']) {
    try {
      const [header, ...rows] = parseCsv(text, delimiter)
      if (!header || header.cells.length < 2) continue
      const hits = header.cells.filter((name) => Object.values(fields).some((aliases) => aliases.map(normalize).includes(normalize(name)))).length
      const matches = rows.filter(({ cells }) => cells.length === header.cells.length).length
      candidates.push({ headers: header.cells, rows, hits, matches })
    } catch (error) { errors.push(error) }
  }
  candidates.sort((a, b) => b.hits - a.hits || b.matches - a.matches || b.headers.length - a.headers.length)
  const best = candidates[0]
  if (!best) throw errors[0] || new Error('쉼표, 탭 또는 세미콜론으로 구분된 CSV 헤더가 필요합니다.')
  if (!best.rows.length) throw new Error('헤더 아래에 매출 데이터가 없습니다.')
  return best
}

export function inferMapping(headers) {
  return Object.fromEntries(Object.entries(fields).map(([key, aliases]) => {
    const names = aliases.map(normalize)
    const matches = headers.flatMap((header, index) => names.includes(normalize(header)) ? [index] : [])
    return [key, matches.length === 1 ? matches[0] : -1]
  }))
}

export function mappingReady(mapping) {
  const selected = Object.values(mapping).filter((index) => index >= 0)
  return new Set(selected).size === selected.length && required.every((key) => mapping[key] >= 0)
    && (mapping.revenue >= 0 || (mapping.quantity >= 0 && mapping.price >= 0))
}

export function parseDate(value, order = '') {
  let match = value.match(/^(\d{4})\s*(?:[-/.]|년)\s*(\d{1,2})\s*(?:[-/.]|월)\s*(\d{1,2})(?:\s*일|\.)?(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/)
    || value.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (!match) {
    const split = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
    if (!split) return null
    const [, first, second, year] = split
    const chosen = order || (+first > 12 ? 'dmy' : +second > 12 || +first === +second ? 'mdy' : '')
    if (!chosen) return null
    match = ['', year, ...(chosen === 'dmy' ? [second, first] : [first, second])]
  }
  const [, y, m, d] = match
  const date = new Date(Date.UTC(+y, +m - 1, +d))
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() + 1 !== +m || date.getUTCDate() !== +d) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseNumber(value) {
  const trimmed = value.trim()
  const wrapped = /^\(.*\)$/.test(trimmed)
  const normalized = (wrapped ? trimmed.slice(1, -1) : trimmed)
    .replace(/^([+-]?)\s*(?:₩|￦|KRW)\s*/i, '$1').replace(/\s*(?:원|KRW)$/i, '').trim()
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)) return null
  if (wrapped && /^[+-]/.test(normalized)) return null
  const number = Number(normalized.replaceAll(',', '')) * (wrapped ? -1 : 1)
  return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : null
}

export function analyze(document, mapping, order) {
  const data = [], issues = []
  for (const { cells, line } of document.rows) {
    const get = (key) => cells[mapping[key]] ?? ''
    const date = parseDate(get('date'), order)
    const customer = get('customer'), service = get('service')
    const quantity = parseNumber(get('quantity')), price = parseNumber(get('price'))
    const calculated = !get('revenue') && quantity !== null && price !== null
    const revenue = calculated ? Math.round(quantity * price * 100) / 100 : parseNumber(get('revenue'))
    const reasons = []
    if (cells.length !== document.headers.length) reasons.push('헤더와 열 개수가 다릅니다')
    if (!date) reasons.push(`날짜 확인 필요 (${get('date') || '빈 값'})`)
    if (!customer) reasons.push('고객사 누락')
    if (!service) reasons.push('서비스 누락')
    if (get('quantity') && quantity === null) reasons.push('수량 형식 확인 필요')
    if (get('price') && price === null) reasons.push('단가 형식 확인 필요')
    if (revenue === null || !Number.isFinite(revenue) || Math.abs(revenue) > Number.MAX_SAFE_INTEGER) reasons.push('매출액 또는 수량·단가 확인 필요')
    if (reasons.length) issues.push({ line, reasons })
    else data.push({ date, customer, service, quantity, price, revenue, calculated, line })
  }
  return { data, issues }
}

export function toCsv(rows) {
  return rows.map((row) => row.map((value) => {
    const safe = typeof value === 'string' && /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value
    return '"' + String(safe ?? '').replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}
