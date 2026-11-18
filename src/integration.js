import { analyze, ambiguousFields, inferMapping, mappingReady } from './csv.js'

const platforms = {
  '직접 판매': ['직접 판매', '자사몰', 'direct', 'direct sales'],
  '네이버 스마트스토어': ['네이버 스마트스토어', '네이버', '스마트스토어', 'naver', 'smartstore', 'naver smartstore'],
  '크몽': ['크몽', 'kmong'],
  '클래스101': ['클래스101', 'class101'],
  '11번가': ['11번가', '11st', 'eleven street'],
  '쿠팡': ['쿠팡', 'coupang'],
  '카페24': ['카페24', 'cafe24'],
}
const statuses = {
  normal: ['정상', '완료', '정상매출', '결제완료', '구매확정', '판매완료', '거래완료', 'normal', 'paid', 'completed', 'confirmed'],
  cancelled: ['취소', '취소완료', '주문취소', '결제취소', 'cancelled', 'canceled'],
  refunded: ['환불', '환불완료', '전액환불', '반품환불', 'refunded', 'fullrefund', 'refund'],
}
export const statusLabels = { normal: '정상', cancelled: '취소', refunded: '환불' }
const nameKey = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
const token = (value) => nameKey(value).replace(/[\s_-]+/g, '')
const matchAlias = (groups, value) => Object.entries(groups).find(([, aliases]) => aliases.some((alias) => token(alias) === token(value)))?.[0]
const canonicalPlatform = (value) => matchAlias(platforms, value) || value.trim()

export function platformFromFilename(name) {
  const words = nameKey(name.replace(/\.[^.]+$/, '')).split(/[^\p{L}\p{N}]+/u)
  const matches = Object.entries(platforms).filter(([, aliases]) => aliases.some((alias) => {
    const parts = nameKey(alias).split(' ')
    return words.some((_, index) => parts.every((part, offset) => words[index + offset] === part))
  })).map(([label]) => label)
  return matches.length === 1 ? matches[0] : ''
}

export function prepareSource(document, name, id, demo = false) {
  const mapping = inferMapping(document.headers)
  const platform = demo ? '샘플' : platformFromFilename(name)
  const hasPlatform = platform || (mapping.platform >= 0 && document.rows.every(({ cells }) => cells[mapping.platform]?.trim()))
  return { id, name, document, demo, mapping, platform, order: '', pending: !hasPlatform || !mappingReady(mapping) || ambiguousFields(document.headers).length > 0 }
}

export function analyzeSource(source) {
  if (source.pending) return { data: [], issues: [] }
  const { data, issues } = analyze(source.document, source.mapping, source.order, (get, revenue, reasons) => {
    const originalPlatform = get('platform') || source.platform
    const originalStatus = get('status')
    const status = originalStatus ? matchAlias(statuses, originalStatus) : source.mapping.status < 0 ? 'normal' : undefined
    if (!originalPlatform) reasons.push('판매 플랫폼 확인 필요')
    if (!status || (status === 'normal' && revenue < 0)) reasons.push(`거래 상태 확인 필요 (${originalStatus || '빈 값 또는 음수 금액'})`)
    return { platform: canonicalPlatform(originalPlatform), orderId: get('orderId'), status }
  })
  return {
    data: data.map((row) => ({ ...row, sourceId: source.id, sourceName: source.name })),
    issues: issues.map((row) => ({ ...row, sourceId: source.id, sourceName: source.name })),
  }
}

const fingerprint = (row) => JSON.stringify([nameKey(row.platform), row.date, nameKey(row.customer), nameKey(row.service), row.revenue, row.status])
const owner = (row) => JSON.stringify([nameKey(row.customer), nameKey(row.service)])

export function integrateSources(sources) {
  const data = [], issues = [], unidentified = [], orders = new Map(), recognized = new Map(), names = new Map()
  let duplicates = 0, superseded = 0
  for (const source of sources) {
    const result = analyzeSource(source)
    issues.push(...result.issues)
    for (const row of result.data) {
      const key = nameKey(row.platform)
      if (!names.has(key)) names.set(key, row.platform)
      row.platform = names.get(key)
      if (!row.orderId) { unidentified.push(row); continue }
      const order = JSON.stringify([key, row.orderId.normalize('NFKC')])
      if (!orders.has(order)) orders.set(order, [])
      orders.get(order).push(row)
      const signature = fingerprint(row)
      if (!recognized.has(signature)) recognized.set(signature, new Set())
      recognized.get(signature).add(order)
    }
  }

  for (const rows of orders.values()) {
    const distinct = new Map()
    for (const row of rows) {
      const key = fingerprint(row)
      const previous = distinct.get(key)
      if (!previous || ((row.quantity !== null || row.price !== null) && previous.quantity === null && previous.price === null)) {
        distinct.set(key, row)
      }
    }
    duplicates += rows.length - distinct.size
    const versions = [...distinct.values()]
    const adjustments = versions.filter((row) => row.status !== 'normal')
    if (versions.length === 1) data.push(versions[0])
    else if (adjustments.length === 1 && versions.every((row) => owner(row) === owner(adjustments[0]))) {
      data.push(adjustments[0])
      superseded += versions.length - 1
    } else {
      issues.push(...versions.map((row) => ({
        ...row, reasons: [`주문번호 ${row.orderId}의 내역이 서로 다릅니다. 원본을 확인해 주세요.`],
      })))
    }
  }

  const occurrences = new Map()
  for (const row of unidentified) {
    const key = fingerprint(row)
    if (!occurrences.has(key)) occurrences.set(key, new Map())
    const batches = occurrences.get(key)
    if (!batches.has(row.sourceId)) batches.set(row.sourceId, [])
    batches.get(row.sourceId).push(row)
  }
  for (const [key, batches] of occurrences) {
    const largest = [...batches.values()].reduce((best, rows) => rows.length > best.length ? rows : best, [])
    const unmatched = largest.slice(recognized.get(key)?.size ?? 0)
    duplicates += [...batches.values()].reduce((sum, rows) => sum + rows.length, 0) - unmatched.length
    data.push(...unmatched)
  }
  return { data, issues, duplicates, superseded, platforms: [...names.values()].sort((a, b) => a.localeCompare(b, 'ko')) }
}

export function selectRows(rows, { platform = '', start = '', end = '' } = {}) {
  return rows.filter((row) => (!platform || row.platform === platform) && (!start || row.date >= start) && (!end || row.date <= end))
}

export function summarize(rows) {
  const normal = rows.filter((row) => row.status === 'normal')
  const total = normal.reduce((sum, row) => sum + row.revenue, 0)
  const cancelled = rows.filter((row) => row.status === 'cancelled').length
  const refunds = rows.filter((row) => row.status === 'refunded')
  return { normal, total, cancelled, refunds: refunds.length, refundAmount: refunds.reduce((sum, row) => sum + Math.abs(row.revenue), 0) }
}

export function platformTotals(rows) {
  const totals = new Map()
  for (const { platform, status, revenue } of rows) {
    totals.set(platform, (totals.get(platform) || 0) + (status === 'normal' ? revenue : 0))
  }
  return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'ko'))
}
