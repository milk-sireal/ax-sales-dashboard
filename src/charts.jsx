import { Activity, Layers3, Store } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { amount, won } from './format.js'

const colors = ['#245be8', '#5683f0', '#81a4fa', '#a8c0fd', '#c8d8ff', '#657aa9']

const axisTick = { fill: '#65738a', fontSize: 11 }
const compactWon = (value) => Math.abs(value) >= 100000000 ? `${amount(value / 100000000)}억` :
  Math.abs(value) >= 10000 ? `${amount(value / 10000)}만` : amount(value)

function ShareChart({ entries, total, count, unit, Icon, caption, empty }) {
  const segments = entries.map(({ name, value }, index) => ({ name, value, color: colors[index % colors.length] }))
  if (total <= 0) return <div className="chart-empty"><Icon size={24}/>{empty}</div>
  return <div className="share">
    <div className="donut" role="img" aria-label={`${caption} · ` + segments.map(({name, value}) => `${name} ${amount(value / total * 100)}%`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={segments} dataKey="value" nameKey="name" innerRadius="69%" outerRadius="96%" stroke="white" strokeWidth={3} isAnimationActive={false}>
          {segments.map((entry, index) => <Cell key={index} fill={entry.color}/>)}
        </Pie><Tooltip formatter={(value) => won(value)}/></PieChart>
      </ResponsiveContainer>
      <div className="donut-label"><Icon size={20}/><strong>{count}개</strong><small>{unit}</small></div>
    </div>
    <ul className="legend scroll-legend">{segments.map(({name, value, color}, index) => <li key={index}><i style={{background: color}}/><span title={name}>{name}</span><b>{amount(value / total * 100)}%</b></li>)}</ul>
  </div>
}

function PlatformCharts({ byPlatform, total }) {
  const series = [{ name: '전체 매출', value: total }, ...byPlatform]
  return <div className="chart-grid">
    <section className="card chart-card">
      <div className="chart-heading"><div><h2>전체·플랫폼별 매출 비교</h2><p>선택한 조건에 해당하는 정상 매출을 비교합니다.</p></div><span className="chart-unit">단위: 원</span></div>
      {byPlatform.length ? <div className="platform-bar" role="img" aria-label={series.map(({name, value}) => `${name} ${won(value)}`).join(', ')}>
        <div style={{ height: Math.max(220, series.length * 34 + 36) }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={series} layout="vertical" margin={{ top: 10, left: 0, right: 16, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="#e9eef7" strokeDasharray="4 4"/>
              <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={compactWon} tick={axisTick}/>
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={104} tick={axisTick} tickFormatter={(name) => name.length > 12 ? name.slice(0, 11) + '…' : name}/>
              <Tooltip formatter={(value) => [won(value), '정상 매출']}/>
              <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={24} isAnimationActive={false}>
                {series.map((entry, index) => <Cell key={index} fill={index === 0 ? '#245be8' : '#81a4fa'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div> : <div className="chart-empty"><Activity size={24}/>비교할 매출 데이터가 없습니다.</div>}
    </section>
    <section className="card chart-card">
      <div className="chart-heading"><div><h2>플랫폼별 매출 비중</h2><p>선택한 조건의 정상 매출에서 플랫폼이 차지하는 비중입니다.</p></div></div>
      <ShareChart entries={byPlatform} total={total} count={byPlatform.length} unit="플랫폼" Icon={Store} caption="플랫폼별 매출 비중" empty="비중을 표시할 정상 매출이 없습니다."/>
    </section>
  </div>
}

export default function Charts({ data, total, byPlatform }) {
  const months = new Map(), categories = new Map()
  for (const row of data) {
    const month = row.date.slice(0, 7)
    months.set(month, (months.get(month) || 0) + row.revenue)
    categories.set(row.service, (categories.get(row.service) || 0) + row.revenue)
  }
  const series = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, revenue]) => ({ month, revenue }))
  const allServices = [...categories].sort((a, b) => b[1] - a[1])
  const entries = allServices.length > 5 ? [...allServices.slice(0, 5), ['기타 서비스', allServices.slice(5).reduce((sum, entry) => sum + entry[1], 0)]] : allServices
  const services = entries.map(([name, value]) => ({ name, value }))
  return <>
    <PlatformCharts byPlatform={byPlatform} total={total}/>
    <div className="chart-grid">
    <section className="card chart-card">
      <div className="chart-heading"><div><h2>월별 매출 추이</h2><p>월별 매출액의 변화를 확인하세요.</p></div><span className="chart-unit">단위: 원</span></div>
      {data.length ? <div className="area-chart" role="img" aria-label={series.map(({month, revenue}) => `${month} ${won(revenue)}`).join(', ')}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={series} margin={{ top: 12, left: 0, right: 10, bottom: 0 }}>
            <defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5484fc" stopOpacity={0.24}/><stop offset="100%" stopColor="#5484fc" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e9eef7" strokeDasharray="4 4"/>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(month) => `${month.slice(2,4)}.${month.slice(5)}`} tick={{ fill: '#65738a', fontSize: 11 }}/>
            <YAxis axisLine={false} tickLine={false} width={64} tickFormatter={compactWon} tick={{ fill: '#65738a', fontSize: 11 }}/>
            <Tooltip formatter={(value) => [won(value), '매출액']}/>
            <Area type="monotone" dataKey="revenue" stroke="#2c64ed" strokeWidth={3} fill="url(#sales-fill)" dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div> : <div className="chart-empty"><Activity size={24}/>표시할 매출 데이터가 없습니다.</div>}
    </section>
    <section className="card chart-card">
      <div className="chart-heading"><div><h2>서비스별 매출 비중</h2><p>서비스별 매출 구성과 점유율입니다.</p></div></div>
      <ShareChart entries={services} total={total} count={categories.size} unit="서비스" Icon={Layers3} caption="서비스별 매출 비중" empty="비중을 표시할 정상 매출이 없습니다."/>
    </section>
    </div>
  </>
}
