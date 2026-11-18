import React, { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Activity, ArrowDown, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUp, BarChart3, CalendarDays, ChevronDown, CircleAlert, CloudUpload, Database, Download, FileSpreadsheet, LayoutDashboard, Menu, Search, ShieldCheck, Wallet, ReceiptText, X } from 'lucide-react'
import { Button } from './components/button.jsx'
import { analyze, inferMapping, labels, mappingReady, readCsv, required, toCsv } from './csv.js'
import { samples } from './samples.js'
import { amount, won } from './format.js'
import './style.css'

const Charts = lazy(() => import('./charts.jsx'))
const pageSize = 8
const sampleDocument = readCsv(new TextEncoder().encode(samples[0].csv))

function download(name, csv) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function App() {
  const [source, setSource] = useState({ document: sampleDocument, name: samples[0].file, demo: true })
  const [mapping, setMapping] = useState(() => inferMapping(sampleDocument.headers))
  const [showMapping, setShowMapping] = useState(false)
  const [order, setOrder] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [menu, setMenu] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'date', direction: -1 })
  const [page, setPage] = useState(0)
  const input = useRef(null), uploadVersion = useRef(0)
  const ready = source && mappingReady(mapping) && !showMapping
  const { data, issues } = useMemo(() => ready ? analyze(source.document, mapping, order) : { data: [], issues: [] }, [ready, source, mapping, order])
  const total = data.reduce((sum, row) => sum + row.revenue, 0)
  const calculatedCount = data.filter((row) => row.calculated).length
  const dates = useMemo(() => data.map((row) => row.date).sort(), [data])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.filter((row) => [row.date, row.customer, row.service, amount(row.revenue)].some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => {
        const left = a[sort.key], right = b[sort.key]
        if (left == null || right == null) return (left == null) - (right == null)
        return sort.direction * (typeof left === 'number' ? left - right : left.localeCompare(right, 'ko'))
      })
  }, [data, search, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  async function load(file) {
    if (!file) return
    const version = ++uploadVersion.current
    setLoading(true)
    setError('')
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 CSV 파일을 선택해 주세요.')
      const document = readCsv(await file.arrayBuffer())
      if (version !== uploadVersion.current) return
      const next = inferMapping(document.headers)
      setSource({ document, name: file.name, demo: false })
      setMapping(next)
      setOrder('')
      setSearch('')
      setPage(0)
      setShowMapping(!mappingReady(next))
    } catch (exception) {
      if (version !== uploadVersion.current) return
      setError(exception.message)
    } finally {
      if (version === uploadVersion.current) setLoading(false)
    }
  }

  function clear() {
    uploadVersion.current++
    setLoading(false)
    setSource(null)
    setError('')
    setShowMapping(false)
  }

  function exportData() {
    const columns = Object.keys(labels)
    download('ax-sales-normalized.csv', toCsv([columns.map((key) => labels[key]), ...data.map((row) => columns.map((key) => row[key]))]))
  }

  return <div className="app">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <a href="#overview" className="brand" onClick={() => setMobileNav(false)}>
        <span className="brand-icon"><BarChart3 size={22}/></span><span><b>AX러닝랩</b><small>SALES WORKSPACE</small></span>
      </a>
      <nav aria-label="메인 메뉴" onClick={() => setMobileNav(false)}>
        <p>워크스페이스</p>
        <a className="selected" href="#overview"><LayoutDashboard size={18}/>매출 대시보드</a>
        <a href="#upload"><CloudUpload size={18}/>데이터 업로드</a>
        <a href="#transactions"><ReceiptText size={18}/>상세 매출 내역</a>
      </nav>
      <div className="privacy"><ShieldCheck size={18}/><div><b>로컬 데이터 처리</b><small>파일은 브라우저에서만 처리됩니다.</small></div></div>
    </aside>
    <main id="overview">
      <header className="topbar">
        <div className="breadcrumb"><button className="mobile-toggle" aria-label="메뉴" aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)}><Menu size={20}/></button><span>워크스페이스</span><span className="slash">/</span><b>매출 대시보드</b></div>
        <div className="workspace-mark"><span>AX</span><b>AX러닝랩</b></div>
      </header>
      <div className="content">
        <div className="title-row">
          <div><h1>매출 대시보드</h1><p>교육 서비스의 매출 현황을 한눈에 확인하고 분석하세요.</p></div>
          {dates.length > 0 && <div className="date-range"><CalendarDays size={16}/>{dates[0].replaceAll('-', '.')} – {dates.at(-1).replaceAll('-', '.')}</div>}
        </div>
        <section className={`upload ${dragging ? 'dragging' : ''}`} id="upload"
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (event.dataTransfer.files.length > 1) { setError('CSV 파일을 한 번에 하나씩 업로드해 주세요.'); return }
            load(event.dataTransfer.files[0])
          }}>
          <input ref={input} type="file" accept=".csv,.tsv,text/csv" hidden aria-label="CSV 파일 선택" onChange={(event) => { load(event.target.files[0]); event.target.value = '' }}/>
          <div className="upload-copy"><span className="upload-icon"><CloudUpload size={24}/></span><div><h2>CSV 데이터 업로드</h2><p>파일을 끌어다 놓거나 선택하면 매출 데이터를 자동으로 분석합니다.</p></div></div>
          <div className="upload-actions">
            <div className="sample-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false) }} onKeyDown={(event) => { if (event.key === 'Escape') { setMenu(false); event.currentTarget.querySelector('button').focus() } }}>
              <Button variant="outline" aria-expanded={menu} onClick={() => setMenu(!menu)}><Download size={16}/>샘플 CSV<ChevronDown size={14}/></Button>
              {menu && <div className="dropdown">{samples.map((sample) => <button key={sample.file} onClick={() => { download(sample.file, sample.csv); setMenu(false) }}>{sample.name}</button>)}</div>}
            </div>
            <Button onClick={() => input.current.click()} disabled={loading}><CloudUpload size={17}/>{loading ? '분석 중…' : '파일 선택'}</Button>
          </div>
        </section>
        {error && <div className="notice error" role="alert"><CircleAlert size={19}/><div><b>CSV 업로드 오류</b><p>{error}{source && ' 이전 파일을 계속 표시합니다.'}</p></div><button aria-label="오류 닫기" onClick={() => setError('')}><X size={18}/></button></div>}
        {source && <div className="file-status">
          <FileSpreadsheet size={16}/><span className="file-name">{source.name}</span>
          {source.demo && <span className="sample-badge">샘플 데이터</span>}
          {ready && <span className="file-count">{amount(data.length)}건 분석{calculatedCount > 0 && ` · ${calculatedCount}건 매출액 계산`}</span>}
          <div className="file-tools"><button onClick={() => setShowMapping(!showMapping)}>{showMapping ? '매핑 접기' : '컬럼 설정'}</button><button onClick={clear} aria-label="데이터 지우기"><X size={16}/></button></div>
        </div>}
        {source && (showMapping || !mappingReady(mapping)) && <section className="card mapping">
          <h2>CSV 컬럼 확인</h2><p>날짜, 고객사, 서비스와 매출액에 해당하는 열을 선택하세요. 매출액 열이 없으면 수량과 단가를 모두 선택하세요.</p>
          <div className="mapping-grid">{Object.entries(labels).map(([key, label]) => <label key={key}>{label}{required.includes(key) && ' *'}<select value={mapping[key]} onChange={(event) => setMapping({ ...mapping, [key]: Number(event.target.value) })}><option value={-1}>선택 안 함</option>{source.document.headers.map((header, index) => <option key={index} value={index}>{index + 1}열 · {header || '이름 없음'}</option>)}</select></label>)}
          <label>연도가 마지막인 날짜<select value={order} onChange={(event) => setOrder(event.target.value)}><option value="">모호한 값 확인 필요</option><option value="dmy">일 / 월 / 연도</option><option value="mdy">월 / 일 / 연도</option></select></label></div>
          <Button disabled={!mappingReady(mapping)} onClick={() => { setPage(0); setShowMapping(false) }}>매핑 적용</Button>
        </section>}
        {issues.length > 0 && <details className="notice issue"><summary><CircleAlert size={18}/>확인이 필요한 데이터 {issues.length}건<ChevronDown size={16}/></summary><p>아래 행은 분석과 내보내기에서 제외됩니다. 컬럼 및 날짜 설정을 확인하거나 원본 값을 수정해 다시 업로드하세요.</p><ul>{issues.map(({line, reasons}) => <li key={line}>{line}행 · {reasons.join(' / ')}</li>)}</ul></details>}
        <section className="overview" aria-label="매출 요약">
          <div className="section-title"><h2>매출 요약</h2><span><i/> {source?.demo ? '샘플 분석' : ready ? 'CSV 분석' : '데이터 대기'}</span></div>
          <div className="metrics">
            {[['총매출', data.length ? won(total) : '–', '분석 기간의 전체 매출액', Wallet, 'blue'], ['거래 건수', data.length ? `${amount(data.length)}건` : '–', '분석에 포함된 거래 수', ReceiptText, 'violet'], ['평균 거래액', data.length ? won(total / data.length) : '–', '전체 매출액 ÷ 거래 건수', Activity, 'teal']].map(([title, value, description, Icon, tone]) => <article className="card metric" key={title}><div><h3>{title}</h3><strong>{value}</strong><p>{description}</p></div><span className={`metric-icon ${tone}`}><Icon size={21}/></span></article>)}
          </div>
        </section>
        <Suspense fallback={<div className="chart-empty" role="status">차트를 불러오는 중입니다.</div>}><Charts data={data} total={total}/></Suspense>
        <section className="card table-card" id="transactions">
          <div className="table-heading"><div><h2>상세 매출 내역</h2><p>거래별 매출 데이터를 검색하고 확인하세요.</p></div><div className="table-actions"><label className="search"><Search size={17}/><input type="search" placeholder="고객사, 서비스 검색" aria-label="상세 매출 검색" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }}/></label><Button variant="outline" disabled={!data.length} onClick={exportData}><Download size={16}/>CSV 다운로드</Button></div></div>
          <div className="table-scroll"><table><thead><tr>{Object.entries(labels).map(([key, label]) => {
            const Icon = sort.key === key ? sort.direction === 1 ? ArrowUp : ArrowDown : ArrowDownUp
            return <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button onClick={() => { setSort({ key, direction: sort.key === key ? -sort.direction : 1 }); setPage(0) }}>{label}<Icon size={13}/></button></th>
          })}</tr></thead><tbody>{visible.map((row) => <tr key={row.line}><td>{row.date}</td><td className="customer">{row.customer}</td><td><span className="service-tag">{row.service}</span></td><td>{amount(row.quantity)}</td><td>{row.price == null ? '–' : won(row.price)}</td><td className="revenue">{won(row.revenue)}</td></tr>)}
          {!visible.length && <tr><td colSpan={6}><div className="table-empty"><Database size={24}/>{search && data.length ? '검색 조건에 맞는 거래가 없습니다.' : '표시할 거래가 없습니다. CSV 파일을 업로드하거나 컬럼 설정을 확인하세요.'}</div></td></tr>}</tbody></table></div>
          <div className="table-footer"><span>{filtered.length ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, filtered.length)} / ${amount(filtered.length)}건` : '0건'}</span><div><Button variant="outline" aria-label="이전 페이지" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={15}/></Button><span>{currentPage + 1} / {pages}</span><Button variant="outline" aria-label="다음 페이지" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ArrowRight size={15}/></Button></div></div>
        </section>
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)
