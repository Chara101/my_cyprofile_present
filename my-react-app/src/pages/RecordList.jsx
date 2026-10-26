import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteRecords, listRecords, listRecordsInRange } from '../api.js'
import { useDialog } from '../Dialog.jsx'
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  TYPES,
  TYPE_LABEL,
  diffRank,
  fmtTime,
} from '../constants.js'

export default function RecordList() {
  const dialog = useDialog()
  const [records, setRecords] = useState(null)

  // 排序:key = time | difficulty;dir = 預設方向 default / 反向 reverse
  const [sortKey, setSortKey] = useState('time')
  const [reversed, setReversed] = useState(false)
  // 篩選
  const [fDiff, setFDiff] = useState('')
  const [fType, setFType] = useState('')
  const [fTag, setFTag] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  // 批量操作
  const [multi, setMulti] = useState(false)
  const [selected, setSelected] = useState(new Set())
  // 連線狀態
  const [connError, setConnError] = useState(null)
  const [retrying, setRetrying] = useState(false)

  // 篩選交給後端:type/difficulty/tag 用 GET /,時間區間用 GET /range,兩者以 id 取交集
  const load = useCallback(async () => {
    setRetrying(true)
    try {
      const list = await listRecords({ type: fType, difficulty: fDiff, tag: fTag.trim() })
      if (fFrom || fTo) {
        const rangeList = await listRecordsInRange({ from: fFrom || undefined, to: fTo || undefined })
        const ids = new Set(rangeList.map((r) => r.id))
        setRecords(list.filter((r) => ids.has(r.id)))
      } else {
        setRecords(list)
      }
      setConnError(null)
    } catch (e) {
      setRecords([])
      setConnError(e.message)
    } finally {
      setRetrying(false)
    }
  }, [fType, fDiff, fTag, fFrom, fTo])
  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    if (!records) return []
    let list = records
    // 時間預設:新→舊;難度預設:簡單→難
    const cmp =
      sortKey === 'time'
        ? (a, b) => new Date(b.time) - new Date(a.time)
        : (a, b) => diffRank(a.difficulty) - diffRank(b.difficulty)
    list = [...list].sort(cmp)
    return reversed ? list.reverse() : list
  }, [records, sortKey, reversed])

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const exitMulti = () => {
    setMulti(false)
    setSelected(new Set())
  }

  const batchDelete = async () => {
    if (!selected.size) return
    if (!(await dialog.confirm(`確定要刪除選取的 ${selected.size} 筆記錄嗎?`))) return
    try {
      const res = await deleteRecords([...selected])
      await dialog.alert(`已刪除 ${res.deleted} 筆記錄`)
      exitMulti()
      await load()
    } catch (e) {
      await dialog.alert(`刪除失敗:${e.message}`)
    }
  }

  const open = (id) => {
    if (multi) toggle(id)
    else window.location.hash = `#/records/${id}`
  }

  return (
    <>
      <nav className="nav">
        <a className="btn" href="#/">🏠 回首頁</a>
        <button onClick={() => (multi ? exitMulti() : setMulti(true))}>
          {multi ? '結束操作多個' : '操作多個'}
        </button>
      </nav>

      {connError && (
        <div className="offline-banner" role="status">
          <span>
            ⚠️ 目前無法連上後端伺服器（{connError}），暫時無法顯示記錄，您的既有資料並未遺失。
          </span>
          <button onClick={load} disabled={retrying}>
            {retrying ? '連線中…' : '🔄 重新連線'}
          </button>
        </div>
      )}

      {multi && (
        <div className="toolbar">
          <span>已選 {selected.size} 筆</span>
          <button className="danger" disabled={!selected.size} onClick={batchDelete}>
            批量刪除
          </button>
        </div>
      )}

      <div className="filters">
        <label>
          排序
          <select value={sortKey} onChange={(e) => { setSortKey(e.target.value); setReversed(false) }}>
            <option value="time">記錄建立時間</option>
            <option value="difficulty">記錄難度</option>
          </select>
        </label>
        <button onClick={() => setReversed((v) => !v)}>
          {sortKey === 'time'
            ? reversed ? '舊 → 新' : '新 → 舊'
            : reversed ? '難 → 簡單' : '簡單 → 難'}
        </button>
        <label>
          難度
          <select value={fDiff} onChange={(e) => setFDiff(e.target.value)}>
            <option value="">全部</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>
            ))}
          </select>
        </label>
        <label>
          學習維度
          <select value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">全部</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label>
          標籤
          <input
            placeholder="輸入完整標籤"
            value={fTag}
            onChange={(e) => setFTag(e.target.value)}
          />
        </label>
        <label>
          起始時間 (from)
          <input type="datetime-local" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </label>
        <label>
          結束時間 (to)
          <input type="datetime-local" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </label>
        {(fDiff || fType || fTag || fFrom || fTo) && (
          <button onClick={() => { setFDiff(''); setFType(''); setFTag(''); setFFrom(''); setFTo('') }}>
            清除篩選
          </button>
        )}
      </div>

      {!records ? (
        <p>載入中…</p>
      ) : shown.length === 0 ? (
        <p>沒有符合的記錄</p>
      ) : (
        <ul className="capsules">
          {shown.map((r) => (
            <li
              key={r.id}
              className={`capsule${selected.has(r.id) ? ' selected' : ''}`}
              onClick={() => open(r.id)}
            >
              {multi && <input type="checkbox" checked={selected.has(r.id)} readOnly />}
              <span className="c-name">{r.questionName}</span>
              {r.tags?.length > 0 && (
                <span className="c-tags">
                  {r.tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </span>
              )}
              <span className="c-type">{TYPE_LABEL[r.type] ?? r.type}</span>
              <span className={`c-diff diff-${r.difficulty}`}>
                {DIFFICULTY_LABEL[r.difficulty] ?? '未設定'}
              </span>
              <span className="c-time">{fmtTime(r.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
