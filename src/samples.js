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

export const integrationSamples = [
  {
    name: '통합 실습 · 네이버 주문',
    file: 'naver-integration-orders.csv',
    csv: toCsv([
      ['주문번호', '거래일자', '거래처', '교육과정', '참가인원', '교육단가', '주문상태'],
      ['N-001', '2026.03.01', '가상 모티브웍스', '기업 AX 워크숍', 2, '₩100,000', '결제완료'],
      ['N-002', '2026.03.02', '가상 루멘피크', '생성형 AI 실무', 1, '₩300,000', '결제완료'],
      ['N-003', '2026.03.03', '가상 오르빗랩', 'AI 리더십 과정', 2, '₩100,000', '취소'],
    ]),
  },
  {
    name: '통합 실습 · 채널별 거래',
    file: 'integration-channel-report.csv',
    csv: [
      'Channel;Order ID;Client;Program;Sales Amount;Payment Date;Status',
      'Naver;N-001;가상 모티브웍스;기업 AX 워크숍;200,000 KRW;2026/03/01;Paid',
      'Naver;N-002;가상 루멘피크;생성형 AI 실무;-300,000 KRW;2026/03/04;Refunded',
      'Kmong;N-001;가상 노바플로우;AX 컨설팅;450,000 KRW;2026/04/01;Completed',
    ].join('\r\n'),
  },
]
