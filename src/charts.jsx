import { Activity, Layers3 } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { amount, won } from './format.js'

const colors = ['#245be8', '#5683f0', '#81a4fa', '#a8c0fd', '#c8d8ff', '#657aa9']

export default function Charts({ data, total }) {
  const months = new Map(), categories = new Map()
  for (const row of data) {
    const month = row.date.slice(0, 7)
    months.set(month, (months.get(month) || 0) + row.revenue)
    categories.set(row.service, (categories.get(row.service) || 0) + row.revenue)
  }
  const series = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, revenue]) => ({ month, revenue }))
  const allServices = [...categories].sort((a, b) => b[1] - a[1])
  const entries = allServices.length > 5 ? [...allServices.slice(0, 5), ['기타 서비스', allServices.slice(5).reduce((sum, entry) => sum + entry[1], 0)]] : allServices
  const services = entries.map(([name, value], index) => ({ name, value, color: colors[index] }))
  const hasShare = total > 0 && allServices.every(([, value]) => value >= 0)
  return <div className="chart-grid">
    <section className="card chart-card">
      <div className="chart-heading"><div><h2>월별 매출 추이</h2><p>월별 매출액의 변화를 확인하세요.</p></div><span className="chart-unit">단위: 원</span></div>
      {data.length ? <div className="area-chart" role="img" aria-label={series.map(({month, revenue}) => `${month} ${won(revenue)}`).join(', ')}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={series} margin={{ top: 12, left: 0, right: 10, bottom: 0 }}>
            <defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5484fc" stopOpacity={0.24}/><stop offset="100%" stopColor="#5484fc" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e9eef7" strokeDasharray="4 4"/>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(month) => `${month.slice(2,4)}.${month.slice(5)}`} tick={{ fill: '#65738a', fontSize: 11 }}/>
            <YAxis axisLine={false} tickLine={false} width={64} tickFormatter={(n) => Math.abs(n) >= 100000000 ? `${amount(n / 100000000)}억` : Math.abs(n) >= 10000 ? `${amount(n / 10000)}만` : amount(n)} tick={{ fill: '#65738a', fontSize: 11 }}/>
            <Tooltip formatter={(value) => [won(value), '매출액']}/>
            <Area type="monotone" dataKey="revenue" stroke="#2c64ed" strokeWidth={3} fill="url(#sales-fill)" dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div> : <div className="chart-empty"><Activity size={24}/>표시할 매출 데이터가 없습니다.</div>}
    </section>
    <section className="card chart-card">
      <div className="chart-heading"><div><h2>서비스별 매출 비중</h2><p>서비스별 매출 구성과 점유율입니다.</p></div></div>
      {hasShare ? <div className="share">
        <div className="donut" role="img" aria-label={services.map(({name, value}) => `${name} ${amount(value / total * 100)}%`).join(', ')}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={services} dataKey="value" nameKey="name" innerRadius="69%" outerRadius="96%" stroke="white" strokeWidth={3} isAnimationActive={false}>
              {services.map((entry, index) => <Cell key={index} fill={entry.color}/>)}
            </Pie><Tooltip formatter={(value) => won(value)}/></PieChart>
          </ResponsiveContainer>
          <div className="donut-label"><Layers3 size={20}/><strong>{categories.size}개</strong><small>서비스</small></div>
        </div>
        <ul className="legend">{services.map(({name, value, color}, index) => <li key={index}><i style={{background: color}}/><span title={name}>{name}</span><b>{amount(value / total * 100)}%</b></li>)}</ul>
      </div> : <div className="chart-empty"><Layers3 size={24}/>{data.length ? '서비스 매출 합계가 0 이하이거나 음수 항목이 있어 비중을 표시할 수 없습니다.' : '표시할 매출 데이터가 없습니다.'}</div>}
    </section>
  </div>
}
