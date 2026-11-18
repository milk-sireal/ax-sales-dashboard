import { toCsv } from './csv.js'

export const services = ['기업 AX 워크숍', 'AI 리더십 과정', '생성형 AI 실무', 'AX 컨설팅', '맞춤형 교육']
const companies = ['모티브웍스', '노바플로우', '오르빗랩', '루멘피크', '핀치스튜디오', '코발트웨이브', '플레인큐브', '하이브릿지', '바이올렛웍스', '그로브포인트']

export const sampleRows = Array.from({ length: 50 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 0, 4 + index * 3 + Math.floor(index / 10) * 5)).toISOString().slice(0, 10)
  const serviceIndex = (index * 7 + Math.floor(index / 5)) % services.length
  const customer = `가상 ${companies[(index * 3 + Math.floor(index / 10)) % companies.length]}`
  const quantity = 10 + (index * 7 % 24)
  const price = [280000, 220000, 160000, 350000, 120000][serviceIndex]
  return [date, customer, services[serviceIndex], quantity, price, quantity * price]
}).reverse()

export const samples = [
  { name: '표준 양식 · 50건', file: 'ax-sales-sample.csv', csv: toCsv([['날짜', '고객사', '서비스', '수량', '단가', '매출액'], ...sampleRows]) },
  { name: '한글 양식 · 매출액 계산', file: 'ax-sales-quantity.csv', csv: toCsv([['교육과정', '참가인원', '거래처', '교육단가', '거래일자'], ...sampleRows.slice(0, 10).map(([date, customer, service, quantity, price]) =>
    [service, quantity, customer, `₩${price.toLocaleString('en-US')}`, date.replaceAll('-', '.')])]) },
  { name: '영문 양식 · 세미콜론 구분', file: 'ax-sales-english.csv', csv: ['Client;Program;Sales Amount;Payment Date', ...sampleRows.slice(10, 20).map(([date, customer, service, , , revenue]) =>
    [customer, service, `${revenue.toLocaleString('en-US')} KRW`, date.replaceAll('-', '/')].join(';'))].join('\r\n') },
]
