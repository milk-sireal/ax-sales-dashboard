import { useState } from 'react'
import { FileSpreadsheet, X } from 'lucide-react'
import { integratedLabels, mappingReady, required } from '../csv.js'
import { Button } from './button.jsx'

export function SourceSettings({ source, onApply, onClose }) {
  const [mapping, setMapping] = useState(source.mapping)
  const [platform, setPlatform] = useState(source.platform)
  const [order, setOrder] = useState(source.order)
  const platformReady = platform.trim() || (mapping.platform >= 0 && source.document.rows.every(({ cells }) => cells[mapping.platform]?.trim()))
  return <form className="card mapping" onSubmit={(event) => {
    event.preventDefault()
    if (platformReady && mappingReady(mapping)) onApply({ mapping, platform: platform.trim(), order, pending: false })
  }}>
    <h2>CSV 컬럼 및 플랫폼 확인</h2>
    <p>필수 열을 연결하고, 플랫폼 열이 없거나 값이 비어 있으면 기본 플랫폼을 지정하세요.</p>
    <div className="mapping-grid">
      {Object.entries(integratedLabels).map(([key, label]) => <label key={key}>{label}{required.includes(key) && ' *'}
        <select value={mapping[key]} onChange={(event) => setMapping({ ...mapping, [key]: Number(event.target.value) })}>
          <option value={-1}>선택 안 함</option>
          {source.document.headers.map((header, index) => <option key={index} value={index}>{index + 1}열 · {header || '이름 없음'}</option>)}
        </select>
      </label>)}
      <label>기본 플랫폼<input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="예: 직접 판매"/></label>
      <label>연도가 마지막인 날짜<select value={order} onChange={(event) => setOrder(event.target.value)}>
        <option value="">모호한 값 확인 필요</option><option value="dmy">일 / 월 / 연도</option><option value="mdy">월 / 일 / 연도</option>
      </select></label>
    </div>
    <div className="settings-actions"><Button type="submit" disabled={!platformReady || !mappingReady(mapping)}>매핑 적용</Button><Button type="button" variant="outline" onClick={onClose}>닫기</Button></div>
  </form>
}

export function SourceList({ sources, editing, setEditing, onApply, onRemove }) {
  return <div className="source-list">
    {sources.map((source) => <div key={source.id}>
      <div className="file-status">
        <FileSpreadsheet size={16}/><span className="file-name" title={source.name}>{source.name}</span>
        {source.demo && <span className="sample-badge">샘플 데이터</span>}
        {source.pending && <span className="pending-badge">확인 필요</span>}
        <div className="file-tools">
          <button aria-expanded={editing === source.id} onClick={() => setEditing(editing === source.id ? null : source.id)}>{source.pending ? '플랫폼·컬럼 확인' : '컬럼 설정'}</button>
          <button onClick={() => onRemove(source.id)} aria-label={`${source.name} 제거`}><X size={16}/></button>
        </div>
      </div>
      {editing === source.id && <SourceSettings source={source} onApply={(settings) => onApply(source.id, settings)} onClose={() => setEditing(null)}/>}
    </div>)}
  </div>
}
