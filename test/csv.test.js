import assert from 'node:assert/strict'
import test from 'node:test'
import { analyze, inferMapping, labels, mappingReady, parseDate, parseNumber, readCsv, toCsv } from '../src/csv.js'
import { sampleRows, samples } from '../src/samples.js'

const parse = (text) => readCsv(new TextEncoder().encode(text))
const run = (text) => {
  const document = parse(text)
  const mapping = inferMapping(document.headers)
  assert.ok(mappingReady(mapping))
  return analyze(document, mapping)
}

test('표준 가상 데이터 50건의 날짜와 매출액을 보존한다', () => {
  const { data, issues } = run(samples[0].csv)
  assert.equal(data.length, 50)
  assert.equal(issues.length, 0)
  assert.deepEqual(data.map(({ date, revenue }) => [date, revenue]), sampleRows.map((row) => [row[0], row[5]]))
})

test('한글 양식의 수량과 원화 단가로 매출액을 계산한다', () => {
  const { data, issues } = run(samples[1].csv)
  assert.equal(issues.length, 0)
  assert.equal(data.filter((row) => row.calculated).length, 10)
  assert.deepEqual(data.map((row) => row.revenue), sampleRows.slice(0, 10).map((row) => row[5]))
})

test('영문 세미콜론 양식에서 선택 항목 없이 매출액을 읽는다', () => {
  const { data, issues } = run(samples[2].csv)
  assert.equal(issues.length, 0)
  assert.equal(data.length, 10)
  assert.equal(data[0].quantity, null)
  assert.deepEqual(data.map((row) => row.revenue), sampleRows.slice(10, 20).map((row) => row[5]))
})

test('CP949 한글과 UTF-8 BOM을 읽는다', () => {
  const bytes = Buffer.concat([Buffer.from('b3afc2a52cb0edb0b4bbe72cbcadbaf1bdba2cb8c5c3e2bed7', 'hex'), Buffer.from('\n2026-01-01,A,B,100')])
  const document = readCsv(bytes)
  assert.deepEqual(document.headers, ['날짜', '고객사', '서비스', '매출액'])
  assert.equal(run('\uFEFF' + samples[0].csv).data.length, 50)
})

test('헤더 충돌과 필수 매핑 누락은 확인이 필요하다', () => {
  const mapping = inferMapping(['date', '거래일', '회사명', '서비스', 'amount'])
  assert.equal(mapping.date, -1)
  assert.equal(mapping.revenue, -1)
  assert.equal(mappingReady(mapping), false)
  assert.equal(mappingReady({ ...mapping, date: 0, revenue: 4 }), true)
  assert.equal(mappingReady({ ...mapping, date: 2, revenue: 4 }), false)
})

test('모호한 날짜와 잘못된 금액·빈 값·누락 열을 해당 행 번호로 보고한다', () => {
  const { data, issues } = run('날짜,고객사,서비스,매출액\n03/04/2026,A,B,5\n2026-02-30,A,B,10\n2026-03-03,,B,10\n2026-03-04,A,B,abc\n2026-03-05,A,B\n2026-03-06,A,B,0')
  assert.deepEqual(issues.map((issue) => issue.line), [2, 3, 4, 5, 6])
  assert.equal(data[0].revenue, 0)
  assert.equal(parseDate('03/04/2026', 'dmy'), '2026-04-03')
  assert.equal(parseDate('03/04/2026', 'mdy'), '2026-03-04')
  assert.equal(parseDate('20260305'), '2026-03-05')
  assert.equal(parseNumber('12,34원'), null)
  assert.equal(parseNumber('(₩1,234.50)'), -1234.5)
})

test('CSV 따옴표, 쉼표, 줄바꿈 및 재가져오기를 지원한다', () => {
  const csv = toCsv([Object.values(labels), ['2026-03-05', 'A, B\n"C"', '교육', null, null, -100]])
  const { data } = run(csv)
  assert.equal(data[0].customer, 'A, B\n"C"')
  assert.equal(data[0].revenue, -100)
  assert.throws(() => parse('날짜,고객사\n2026-03-05,"A'), /따옴표/)
})
