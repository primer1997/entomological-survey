import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/* ================= types ================= */
interface RowEntry {
  id: string
  head: string
  persons: string
  containers: string
  checked: string
  positive: string
  emptied: string
}
interface SurveyPage {
  id: string
  village: string
  population: string
  date: string
  rows: RowEntry[]
  createdAt: string
  updatedAt: string
}

/* ================= helpers ================= */
const num = (s: string) => {
  const n = parseInt(String(s).replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
const dev = (s: string | number) => String(s).replace(/[0-9]/g, (d) => '०१२३४५६७८९'[+d])
const fmtDate = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const todayISO = () => {
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}
const emptyRow = (): RowEntry => ({ id: uid(), head: '', persons: '', containers: '', checked: '', positive: '', emptied: '' })
const blankRows = (n: number) => Array.from({ length: n }, emptyRow)

function rowFilled(r: RowEntry) {
  return r.head.trim() !== '' || num(r.persons) > 0 || num(r.containers) > 0 || num(r.checked) > 0 || num(r.positive) > 0 || num(r.emptied) > 0
}

function calc(rows: RowEntry[]) {
  const filled = rows.filter(rowFilled)
  const houses = filled.length
  const housesPos = filled.filter((r) => num(r.positive) > 0).length
  const persons = filled.reduce((a, r) => a + num(r.persons), 0)
  const contTotal = filled.reduce((a, r) => a + num(r.containers), 0)
  const contChecked = filled.reduce((a, r) => a + num(r.checked), 0)
  const contPos = filled.reduce((a, r) => a + num(r.positive), 0)
  const contEmptied = filled.reduce((a, r) => a + num(r.emptied), 0)
  const hi = houses ? (housesPos * 100) / houses : 0
  const ci = contChecked ? (contPos * 100) / contChecked : 0
  const bi = houses ? (contPos * 100) / houses : 0
  return { houses, housesPos, persons, contTotal, contChecked, contPos, contEmptied, hi, ci, bi }
}
const f2 = (n: number) => n.toFixed(2)

const LS_PAGES = 'ento-survey:pages'
const LS_PROFILE = 'ento-survey:profile'
const LS_DRAFT = 'ento-survey:draft'

function loadPages(): SurveyPage[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PAGES) || '[]')
  } catch {
    return []
  }
}

/* ================= print sheet (register replica) ================= */
const COLS = [
  { label: 'एम. नं.', w: '6%' },
  { label: 'कुटुंब प्रमुखाचे नांव', w: '29%' },
  { label: 'घरातील व्यक्तींची संख्या', w: '12%' },
  { label: 'घरातील कंटेनरची संख्या', w: '13%' },
  { label: 'तपासलेल्या कंटेनरची संख्या', w: '13%' },
  { label: 'डास, अळ्या आढळून आलेले कंटेनरची संख्या', w: '15%' },
  { label: 'रिकामे केलेल्या कंटेनरची संख्या', w: '12%' },
]
const ROWS_PER_SHEET = 15

function Sheet({ page, rows, pageNo, pageCount, showIndices, stacked }: {
  page: SurveyPage
  rows: RowEntry[]
  pageNo: number
  pageCount: number
  showIndices: boolean
  stacked?: boolean
}) {
  const c = calc(page.rows)
  const padded = [...rows]
  while (padded.length < ROWS_PER_SHEET) padded.push(emptyRow())
  return (
    <div className={stacked ? 'sheet stacked' : 'sheet'}>
      <h1>दैनिक किटकशास्त्रीय सर्वेक्षण</h1>
      <div className="sub">Daily Entomological Survey</div>
      <div className="meta">
        <span>गावाचे नांव : <span className="fill">{page.village || '—'}</span></span>
        <span>गावाची लोकसंख्या : <span className="fill">{page.population ? dev(page.population) : '—'}</span></span>
        <span>भेटीचा दिनांक : <span className="fill">{dev(fmtDate(page.date))}</span></span>
        {pageCount > 1 && <span>पान क्र. {dev(pageNo)}/{dev(pageCount)}</span>}
      </div>
      <table className="reg">
        <thead>
          <tr>{COLS.map((col) => <th key={col.label} style={{ width: col.w }}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {padded.map((r, i) => (
            <tr key={r.id + i}>
              <td>{dev((pageNo - 1) * ROWS_PER_SHEET + i + 1)}</td>
              <td className="nm">{r.head}</td>
              <td>{r.persons ? dev(r.persons) : ''}</td>
              <td>{r.containers ? dev(r.containers) : ''}</td>
              <td>{r.checked ? dev(r.checked) : ''}</td>
              <td>{r.positive ? dev(r.positive) : ''}</td>
              <td>{r.emptied ? dev(r.emptied) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showIndices && (
        <div className="indices">
          <div className="idx">
            <span className="nm2">हाऊस इंडेक्स =</span>
            <span className="frac">
              <span className="fn">{dev(c.housesPos)} X १००</span>
              <span className="fd">{dev(c.houses)}</span>
            </span>
            <span className="res">= {dev(f2(c.hi))} %</span>
          </div>
          <div className="idx">
            <span className="nm2">कंटेनर इंडेक्स =</span>
            <span className="frac">
              <span className="fn">{dev(c.contPos)} X १००</span>
              <span className="fd">{dev(c.contChecked)}</span>
            </span>
            <span className="res">= {dev(f2(c.ci))} %</span>
          </div>
          <div className="idx">
            <span className="nm2">ब्रेट्यू इंडेक्स =</span>
            <span className="frac">
              <span className="fn">{dev(c.contPos)} X १००</span>
              <span className="fd">{dev(c.houses)}</span>
            </span>
            <span className="res">= {dev(f2(c.bi))}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= app ================= */
export default function App() {
  const [tab, setTab] = useState<'entry' | 'records'>('entry')
  const [pages, setPages] = useState<SurveyPage[]>(loadPages)
  const [savedNote, setSavedNote] = useState('')
  const [pdfTarget, setPdfTarget] = useState<SurveyPage | null>(null)
  const [pdfPair, setPdfPair] = useState<SurveyPage[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [pdfBusy, setPdfBusy] = useState(false)
  const sheetHostRef = useRef<HTMLDivElement>(null)
  const pairHostRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState<SurveyPage>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(LS_DRAFT) || 'null')
      if (d && d.rows) return d
    } catch { /* ignore */ }
    let profile = { village: '', population: '' }
    try {
      profile = JSON.parse(localStorage.getItem(LS_PROFILE) || '{}')
    } catch { /* ignore */ }
    return {
      id: uid(),
      village: profile.village || '',
      population: profile.population || '',
      date: todayISO(),
      rows: blankRows(10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  useEffect(() => {
    localStorage.setItem(LS_PAGES, JSON.stringify(pages))
  }, [pages])
  useEffect(() => {
    localStorage.setItem(LS_DRAFT, JSON.stringify(draft))
  }, [draft])

  const totals = useMemo(() => calc(draft.rows), [draft.rows])

  const setRow = (id: string, key: keyof RowEntry, value: string) => {
    setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)) }))
  }
  const addRow = () => setDraft((d) => ({ ...d, rows: [...d.rows, emptyRow()] }))
  const add10Rows = () => setDraft((d) => ({ ...d, rows: [...d.rows, ...blankRows(10)] }))
  const delRow = (id: string) => setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }))

  const newPage = () => {
    if (draft.rows.some(rowFilled) && !confirm('या पानावर नोंदी आहेत. नवीन पान सुरू करायचे? (जतन न केलेल्या नोंदी जातील)')) return
    let profile = { village: '', population: '' }
    try {
      profile = JSON.parse(localStorage.getItem(LS_PROFILE) || '{}')
    } catch { /* ignore */ }
    setDraft({
      id: uid(),
      village: profile.village || '',
      population: profile.population || '',
      date: todayISO(),
      rows: blankRows(10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setSavedNote('')
    setTab('entry')
  }

  const savePage = () => {
    if (!draft.village.trim()) {
      alert('कृपया गावाचे नांव भरा.')
      return
    }
    if (!draft.rows.some(rowFilled)) {
      alert('कमीत कमी एका घराची नोंद भरा.')
      return
    }
    const clean: SurveyPage = {
      ...draft,
      rows: draft.rows.filter(rowFilled),
      updatedAt: new Date().toISOString(),
    }
    setPages((prev) => {
      const exists = prev.some((p) => p.id === clean.id)
      return exists ? prev.map((p) => (p.id === clean.id ? clean : p)) : [clean, ...prev]
    })
    localStorage.setItem(LS_PROFILE, JSON.stringify({ village: clean.village, population: clean.population }))
    setDraft(clean)
    setSavedNote(`नोंद जतन झाली — ${clean.village}, ${fmtDate(clean.date)} (${clean.rows.length} घरे)`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openPage = (p: SurveyPage) => {
    setDraft({ ...p, rows: p.rows.length ? p.rows : blankRows(10) })
    setSavedNote('')
    setTab('entry')
    window.scrollTo({ top: 0 })
  }

  const deletePage = (p: SurveyPage) => {
    if (!confirm(`${p.village} (${fmtDate(p.date)}) ही नोंद कायमची हटवायची?`)) return
    setPages((prev) => prev.filter((x) => x.id !== p.id))
  }

  const exportPDF = async (page: SurveyPage) => {
    if (pdfBusy) return
    setPdfBusy(true)
    setPdfTarget(page)
    try {
      await new Promise((r) => setTimeout(r, 120))
      const host = sheetHostRef.current
      if (!host) return
      const sheets = host.querySelectorAll('.sheet')
      const pdf = new jsPDF('p', 'mm', 'a4')
      for (let i = 0; i < sheets.length; i++) {
        const canvas = await html2canvas(sheets[i] as HTMLElement, { scale: 2, backgroundColor: '#ffffff' })
        const img = canvas.toDataURL('image/jpeg', 0.95)
        const h = (210 * canvas.height) / canvas.width
        if (i > 0) pdf.addPage()
        pdf.addImage(img, 'JPEG', 0, 0, 210, h)
      }
      pdf.save(`kitak-survey-${page.date}.pdf`)
    } finally {
      setPdfTarget(null)
      setPdfBusy(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  const exportPairPDF = async () => {
    if (pdfBusy || selected.length !== 2) return
    const chosen = selected
      .map((id) => pages.find((p) => p.id === id))
      .filter((p): p is SurveyPage => !!p)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (chosen.length !== 2) return
    setPdfBusy(true)
    setPdfPair(chosen)
    try {
      await new Promise((r) => setTimeout(r, 120))
      const host = pairHostRef.current
      if (!host) return
      const pageEls = host.querySelectorAll('.pair-page')
      const pdf = new jsPDF('p', 'mm', 'a4')
      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await html2canvas(pageEls[i] as HTMLElement, { scale: 2, backgroundColor: '#ffffff' })
        const img = canvas.toDataURL('image/jpeg', 0.95)
        const h = (210 * canvas.height) / canvas.width
        if (i > 0) pdf.addPage()
        pdf.addImage(img, 'JPEG', 0, 0, 210, h)
      }
      pdf.save(`kitak-survey-${chosen[0].date}-${chosen[1].date}.pdf`)
    } finally {
      setPdfPair(null)
      setPdfBusy(false)
    }
  }

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt)),
    [pages],
  )

  const pdfSheets = useMemo(() => {
    if (!pdfTarget) return []
    const chunks: RowEntry[][] = []
    for (let i = 0; i < pdfTarget.rows.length; i += ROWS_PER_SHEET) chunks.push(pdfTarget.rows.slice(i, i + ROWS_PER_SHEET))
    if (!chunks.length) chunks.push([])
    return chunks
  }, [pdfTarget])

  /* forms for the 2-days-on-one-page (portrait) PDF */
  const pairPages = useMemo(() => {
    if (!pdfPair) return []
    interface Form { page: SurveyPage; rows: RowEntry[]; chunkNo: number; chunkCount: number; showIndices: boolean }
    const forms: Form[] = []
    for (const pg of pdfPair) {
      const chunks: RowEntry[][] = []
      for (let i = 0; i < pg.rows.length; i += ROWS_PER_SHEET) chunks.push(pg.rows.slice(i, i + ROWS_PER_SHEET))
      if (!chunks.length) chunks.push([])
      chunks.forEach((rows, i) => forms.push({ page: pg, rows, chunkNo: i + 1, chunkCount: chunks.length, showIndices: i === chunks.length - 1 }))
    }
    const grouped: Form[][] = []
    for (let i = 0; i < forms.length; i += 2) grouped.push(forms.slice(i, i + 2))
    return grouped
  }, [pdfPair])

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">कि</div>
          <div>
            <div className="brand-title">दैनिक किटकशास्त्रीय सर्वेक्षण</div>
            <div className="brand-sub">Daily Entomological Survey — डिजिटल रजिस्टर</div>
          </div>
        </div>
        <div className="tabs">
          <button className={tab === 'entry' ? 'active' : ''} onClick={() => setTab('entry')}>नोंदणी</button>
          <button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>नोंदी ({pages.length})</button>
        </div>
      </div>

      {tab === 'entry' && (
        <div className="wrap">
          {savedNote && <div className="saved-note">{savedNote}</div>}

          <div className="card">
            <h3>गावाची माहिती</h3>
            <div className="grid3">
              <div className="field">
                <label>गावाचे नांव</label>
                <input value={draft.village} onChange={(e) => setDraft({ ...draft, village: e.target.value })} placeholder="उदा. वडगाव गुप्ता" />
              </div>
              <div className="field">
                <label>गावाची लोकसंख्या</label>
                <input inputMode="numeric" value={draft.population} onChange={(e) => setDraft({ ...draft, population: e.target.value })} placeholder="उदा. 2500" />
              </div>
              <div className="field">
                <label>भेटीचा दिनांक</label>
                <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3>घरांची नोंद</h3>
            <div className="table-scroll">
              <table className="entry">
                <thead>
                  <tr>
                    <th>एम.<br />नं.</th>
                    <th>कुटुंब प्रमुखाचे नांव</th>
                    <th>घरातील व्यक्तींची संख्या</th>
                    <th>घरातील कंटेनरची संख्या</th>
                    <th>तपासलेल्या कंटेनरची संख्या</th>
                    <th>डास, अळ्या आढळून आलेले कंटेनर</th>
                    <th>रिकामे केलेल्या कंटेनरची संख्या</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.rows.map((r, i) => (
                    <tr key={r.id} className={num(r.positive) > 0 ? 'positive-row' : ''}>
                      <td className="sno">{i + 1}</td>
                      <td><input className="name" value={r.head} onChange={(e) => setRow(r.id, 'head', e.target.value)} placeholder="नांव" /></td>
                      <td><input inputMode="numeric" value={r.persons} onChange={(e) => setRow(r.id, 'persons', e.target.value)} /></td>
                      <td><input inputMode="numeric" value={r.containers} onChange={(e) => setRow(r.id, 'containers', e.target.value)} /></td>
                      <td><input inputMode="numeric" value={r.checked} onChange={(e) => setRow(r.id, 'checked', e.target.value)} /></td>
                      <td><input inputMode="numeric" value={r.positive} onChange={(e) => setRow(r.id, 'positive', e.target.value)} /></td>
                      <td><input inputMode="numeric" value={r.emptied} onChange={(e) => setRow(r.id, 'emptied', e.target.value)} /></td>
                      <td className="del-cell"><button className="row-del" onClick={() => delRow(r.id)} title="ओळ हटवा">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={addRow}>+ एक ओळ वाढवा</button>
              <button className="btn btn-ghost" onClick={add10Rows}>+ १० ओळी वाढवा</button>
            </div>
            <div className="hint">ज्या घरात डास/अळ्या आढळतील ती ओळ आपोआप ठळक दिसेल. रिकाम्या ओळी जतन करताना वगळल्या जातात.</div>
          </div>

          <div className="card">
            <h3>एकूण व निर्देशांक</h3>
            <div className="totals">
              <div className="total-box"><div className="t-label">तपासलेली घरे</div><div className="t-value">{totals.houses}</div></div>
              <div className="total-box"><div className="t-label">अळ्या आढळलेली घरे</div><div className="t-value">{totals.housesPos}</div></div>
              <div className="total-box"><div className="t-label">एकूण व्यक्ती</div><div className="t-value">{totals.persons}</div></div>
              <div className="total-box"><div className="t-label">एकूण कंटेनर</div><div className="t-value">{totals.contTotal}</div></div>
              <div className="total-box"><div className="t-label">तपासलेले कंटेनर</div><div className="t-value">{totals.contChecked}</div></div>
              <div className="total-box"><div className="t-label">अळ्या आढळलेले कंटेनर</div><div className="t-value">{totals.contPos}</div></div>
              <div className="total-box"><div className="t-label">रिकामे केलेले कंटेनर</div><div className="t-value">{totals.contEmptied}</div></div>
            </div>
            <div style={{ height: 10 }} />
            <div className="index-grid">
              <div className={`index-box ${totals.hi > 1 ? 'risk' : 'safe'}`}>
                <div className="i-name">हाऊस इंडेक्स</div>
                <div className="i-frac">{totals.housesPos} × 100 / {totals.houses}</div>
                <div className="i-val">{f2(totals.hi)} %</div>
              </div>
              <div className={`index-box ${totals.ci > 3 ? 'risk' : 'safe'}`}>
                <div className="i-name">कंटेनर इंडेक्स</div>
                <div className="i-frac">{totals.contPos} × 100 / {totals.contChecked}</div>
                <div className="i-val">{f2(totals.ci)} %</div>
              </div>
              <div className={`index-box ${totals.bi > 5 ? 'risk' : 'safe'}`}>
                <div className="i-name">ब्रेट्यू इंडेक्स</div>
                <div className="i-frac">{totals.contPos} × 100 / {totals.houses}</div>
                <div className="i-val">{f2(totals.bi)}</div>
              </div>
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-green" onClick={savePage}>जतन करा</button>
            <button className="btn btn-amber" onClick={() => exportPDF({ ...draft, rows: draft.rows.filter(rowFilled) })} disabled={pdfBusy || !draft.rows.some(rowFilled)}>
              {pdfBusy ? 'PDF तयार होत आहे…' : 'PDF काढा'}
            </button>
            <button className="btn btn-ghost" onClick={newPage}>नवीन पान</button>
          </div>
          <div className="hint">PDF हे अगदी रजिस्टरच्या पानासारखे तयार होते — प्रिंट करून फाईलमध्ये ठेवता येईल.</div>
        </div>
      )}

      {tab === 'records' && (
        <div className="wrap">
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="btn btn-green" onClick={newPage}>+ नवीन नोंद</button>
          </div>
          {sortedPages.length >= 2 && (
            <div className="selbar">
              {selected.length === 0 && <span>रजिस्टरसारखे <b>२ दिवस एका पानावर</b> छापायचे असतील तर खाली दोन नोंदी निवडा.</span>}
              {selected.length === 1 && <span><b>१ दिवस निवडला.</b> आणखी एक दिवस निवडा.</span>}
              {selected.length === 2 && <span><b>२ दिवस निवडले.</b></span>}
              {selected.length === 2 && (
                <button className="btn btn-amber" onClick={exportPairPDF} disabled={pdfBusy}>
                  {pdfBusy ? 'PDF तयार होत आहे…' : 'एका पानावर PDF (२ दिवस)'}
                </button>
              )}
              {selected.length > 0 && (
                <button className="btn btn-ghost" onClick={() => setSelected([])}>निवड रद्द करा</button>
              )}
            </div>
          )}
          {sortedPages.length === 0 && <div className="card empty">अद्याप एकही नोंद जतन केलेली नाही.<br />"नोंदणी" मध्ये जाऊन पहिली नोंद भरा.</div>}
          {sortedPages.map((p) => {
            const c = calc(p.rows)
            const isSel = selected.includes(p.id)
            return (
              <div className={`card ${isSel ? 'selected' : ''}`} key={p.id}>
                <label className="sel-check">
                  <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} />
                  <span>एका पानावरील PDF साठी निवडा</span>
                </label>
                <button className="rec-card" onClick={() => openPage(p)}>
                  <span className="rec-head">
                    <span className="rec-village">{p.village}</span>
                    <span className="rec-date">{fmtDate(p.date)}</span>
                  </span>
                  <span className="rec-meta">
                    <span className="chip">घरे: {c.houses}</span>
                    <span className="chip">तपासलेले कंटेनर: {c.contChecked}</span>
                    <span className={`chip ${c.contPos > 0 ? 'warn' : ''}`}>अळ्या आढळले: {c.contPos}</span>
                    <span className="chip">HI: {f2(c.hi)}%</span>
                    <span className="chip">CI: {f2(c.ci)}%</span>
                    <span className="chip">BI: {f2(c.bi)}</span>
                  </span>
                </button>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn btn-amber" onClick={() => exportPDF(p)} disabled={pdfBusy}>{pdfBusy ? 'PDF तयार होत आहे…' : 'PDF काढा'}</button>
                  <button className="btn btn-red-ghost" onClick={() => deletePage(p)}>हटवा</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* off-screen sheets for PDF */}
      <div className="sheet-host" ref={sheetHostRef}>
        {pdfTarget &&
          pdfSheets.map((chunk, i) => (
            <Sheet
              key={i}
              page={pdfTarget}
              rows={chunk}
              pageNo={i + 1}
              pageCount={pdfSheets.length}
              showIndices={i === pdfSheets.length - 1}
            />
          ))}
      </div>

      {/* off-screen portrait pages: 2 days stacked on one A4 sheet */}
      <div className="sheet-host" ref={pairHostRef}>
        {pdfPair &&
          pairPages.map((forms, pi) => (
            <div className="pair-page" key={pi}>
              {forms.map((f, fi) => (
                <Sheet
                  key={fi}
                  page={f.page}
                  rows={f.rows}
                  pageNo={f.chunkNo}
                  pageCount={f.chunkCount}
                  showIndices={f.showIndices}
                  stacked
                />
              ))}
              {forms.length === 1 && <div className="sheet stacked" />}
            </div>
          ))}
      </div>
    </div>
  )
}
