import { useEffect, useState } from 'react'
import { listRecords } from '../api.js'
import { useDialog } from '../Dialog.jsx'
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  TYPES,
  TYPE_LABEL,
} from '../constants.js'

export default function Home() {
  const dialog = useDialog()
  const [records, setRecords] = useState(null)

  useEffect(() => {
    listRecords()
      .then(setRecords)
      .catch((e) => dialog.alert(`載入失敗:${e.message}`))
  }, [dialog])

  const nav = (
    <nav className="nav">
      <a className="btn" href="#/records">記錄管理</a>
      <a className="btn primary" href="#/add">新增記錄</a>
    </nav>
  )

  if (!records) return <>{nav}<p>載入中…</p></>

  const countBy = (fn) => records.filter(fn).length

  return (
    <>
      {nav}
      <h2>難度統計</h2>
      <div className="stat-row">
        {DIFFICULTIES.map((d) => (
          <div key={d} className={`stat diff-${d}`}>
            <div className="num">{countBy((r) => r.difficulty === d)}</div>
            <div>{DIFFICULTY_LABEL[d]}</div>
          </div>
        ))}
      </div>

      <h2>學習維度統計</h2>
      <div className="type-grid">
        {TYPES.map((t) => {
          const list = records.filter((r) => r.type === t)
          return (
            <div key={t} className="card">
              <div className="card-head">
                <strong>{TYPE_LABEL[t]}</strong>
                <span className="num-sm">{list.length}</span>
              </div>
              {DIFFICULTIES.map((d) => {
                const n = list.filter((r) => r.difficulty === d).length
                const pct = list.length ? (n / list.length) * 100 : 0
                return (
                  <div key={d} className="bar-row">
                    <span className="bar-label">{DIFFICULTY_LABEL[d]}</span>
                    <div className="bar">
                      <div className={`fill diff-${d}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="bar-n">{n}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}
