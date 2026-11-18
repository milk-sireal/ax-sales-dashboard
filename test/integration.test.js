import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { integratedLabels, readCsv, toCsv } from '../src/csv.js'
import { integrateSources, platformFromFilename, platformTotals, prepareSource, selectRows, statusLabels, summarize } from '../src/integration.js'
import { integrationSamples, samples } from '../src/samples.js'

function fixture(file, id) {
  return prepareSource(readCsv(readFileSync(new URL('../public/samples/' + file, import.meta.url))), file, id)
}

const source = (name, id, text) => prepareSource(readCsv(new TextEncoder().encode(text)), name, id)
const header = '날짜,고객사,서비스,매출액,주문번호,상태'
const naver = '네이버 스마트스토어'

test('다른 양식의 파일을 통합하고 같은 플랫폼의 주문만 중복 제거한다', () => {
  const [orders, channels] = integrationSamples.map(({ file }, index) => fixture(file, index))
  assert.equal(orders.platform, naver)
  assert.equal(channels.platform, '')
  const before = summarize(integrateSources([orders]).data)
  assert.equal(before.total, 500000)
  for (const files of [[orders, channels], [channels, orders]]) {
    const { data, issues, duplicates, superseded } = integrateSources(files)
    assert.equal(issues.length, 0)
    assert.equal(duplicates, 1)
    assert.equal(superseded, 1)
    assert.equal(data.length, 4)
    assert.equal(data.filter(({ orderId }) => orderId === 'N-001').length, 2)
    const { normal, total, cancelled, refunds, refundAmount } = summarize(data)
    assert.deepEqual([normal.length, total, cancelled, refunds, refundAmount], [2, 650000, 1, 1, 300000])
  }
})

test('기간과 플랫폼 필터는 양 끝 날짜를 포함하며 집계와 플랫폼 차트를 제한한다', () => {
  const { data } = integrateSources(integrationSamples.map(({ file }, index) => fixture(file, index)))
  const march = selectRows(data, { platform: naver, start: '2026-03-01', end: '2026-03-04' })
  assert.equal(march.length, 3)
  assert.equal(summarize(march).total, 200000)
  assert.deepEqual(platformTotals(march), [{ name: naver, value: 200000 }])
  assert.deepEqual(platformTotals(data), [{ name: '크몽', value: 450000 }, { name: naver, value: 200000 }])
  assert.equal(selectRows(data, { start: '2026-04-01', end: '2026-04-01' }).length, 1)
  assert.equal(selectRows(data, { start: '2026-05-01' }).length, 0)
})

test('플랫폼이 모호하면 파일별 확인을 기다리고 ID 없는 같은 내역은 파일 간 중복 제거한다', () => {
  const files = [samples[0], samples[1]].map(({ file }, index) => fixture(file, index))
  assert.equal(platformFromFilename('naver_kmong_report.csv'), '')
  assert.equal(platformFromFilename('indirect-orders.csv'), '')
  assert.ok(files.every(({ pending }) => pending))
  assert.equal(integrateSources(files).data.length, 0)
  const result = integrateSources(files.map((file) => ({ ...file, platform: 'Direct', pending: false })))
  assert.equal(result.data.length, 50)
  assert.equal(result.duplicates, 10)
})

test('상태가 불명확하거나 주문 ID가 충돌한 행을 확인 대상으로 분리한다', () => {
  const first = source('naver-01.csv', 1, header + '\n2026-03-01,A,B,100,001,Paid\n2026-03-01,A,B,17,002,Partial Refund\n2026-03-01,A,B,44,003,')
  const second = source('naver-02.csv', 2, header + '\n2026-03-01,A,B,200,001,Paid\n2026-03-01,A,B,-30,004,Paid')
  const { data, issues } = integrateSources([first, second])
  assert.equal(data.length, 0)
  assert.equal(issues.filter(({ reasons }) => reasons.some((reason) => reason.includes('주문번호 001'))).length, 2)
  assert.equal(issues.filter(({ reasons }) => reasons.some((reason) => reason.includes('거래 상태'))).length, 3)
})

test('통합 CSV 재가져오기에서 플랫폼과 거래 상태를 유지한다', () => {
  const { data } = integrateSources(integrationSamples.map(({ file }, index) => fixture(file, index)))
  const keys = Object.keys(integratedLabels)
  const csv = toCsv([Object.values(integratedLabels), ...data.map((row) => keys.map((key) => key === 'status' ? statusLabels[row.status] : row[key]))])
  const roundTrip = integrateSources([source('ax-sales-integrated.csv', 99, csv)])
  assert.equal(roundTrip.issues.length, 0)
  assert.deepEqual(platformTotals(roundTrip.data), platformTotals(data))
  assert.equal(summarize(roundTrip.data).refundAmount, 300000)
})

test('주문번호가 없는 동일 내역의 파일별 건수 차이는 업로드 순서에 관계없이 보존한다', () => {
  const headers = '날짜,고객사,서비스,매출액'
  const row = '\n2026-03-01,A,B,100'
  const first = source('naver-a.csv', 1, headers + row)
  const second = source('naver-b.csv', 2, headers + row + row)
  for (const files of [[first, second], [second, first]]) {
    const { data, duplicates } = integrateSources(files)
    assert.equal(data.length, 2)
    assert.equal(duplicates, 1)
  }
})
