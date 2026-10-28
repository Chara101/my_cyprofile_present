import { useCallback, useEffect, useState } from 'react'
import { listRecords } from '../api.js'
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  TYPES,
  TYPE_LABEL,
} from '../constants.js'

const DIFF_COLORS = {
  easy: { stroke: '#16a34a', fill: 'rgba(22, 163, 74, 0.2)' },
  medium: { stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.2)' },
  hard: { stroke: '#dc2626', fill: 'rgba(220, 38, 38, 0.2)' },
}

function RadarChart({ records }) {
  const [visibleDiffs, setVisibleDiffs] = useState({
    easy: true,
    medium: true,
    hard: true,
  })

  // 計算每個維度在各難度下的題數
  const counts = {}
  let maxDataVal = 0
  for (const t of TYPES) {
    counts[t] = {}
    for (const d of DIFFICULTIES) {
      const n = records.filter((r) => r.type === t && r.difficulty === d).length
      counts[t][d] = n
      if (n > maxDataVal) maxDataVal = n
    }
  }

  // 外圈最大值：以資料最大值為準，若全為 0 則預設以 5 作為刻度上限
  const maxVal = maxDataVal > 0 ? maxDataVal : 5
  const levels = 5

  const size = 560
  const height = 420
  const cx = size / 2
  const cy = height / 2
  const radius = 140
  const labelRadius = radius + 24
  const totalAxes = TYPES.length

  const angleFor = (i) => (Math.PI * 2 * i) / totalAxes - Math.PI / 2

  const pointAt = (i, r) => {
    const a = angleFor(i)
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  const toggleDiff = (d) => {
    setVisibleDiffs((prev) => ({ ...prev, [d]: !prev[d] }))
  }

  return (
    <div className="radar-card">
      <div className="radar-legend" role="group" aria-label="難度圖層切換">
        {DIFFICULTIES.map((d) => {
          const active = visibleDiffs[d]
          return (
            <button
              key={d}
              type="button"
              className={`radar-legend-item diff-${d} ${active ? 'active' : 'inactive'}`}
              onClick={() => toggleDiff(d)}
              aria-pressed={active}
              title="點擊切換顯示/隱藏此難度圖層"
            >
              <span className="radar-dot" />
              <span>{DIFFICULTY_LABEL[d]}</span>
            </button>
          )
        })}
      </div>

      <div className="radar-wrap">
        <svg
          viewBox={`0 0 ${size} ${height}`}
          className="radar-svg"
          role="img"
          aria-label="各學習維度與難度分佈雷達圖"
        >
          {/* 同心多邊形網格 */}
          {Array.from({ length: levels }, (_, idx) => {
            const level = idx + 1
            const r = (radius * level) / levels
            const pts = TYPES.map((_, i) => pointAt(i, r).join(',')).join(' ')
            return (
              <polygon
                key={level}
                points={pts}
                className="radar-grid-polygon"
              />
            )
          })}

          {/* 軸線 */}
          {TYPES.map((t, i) => {
            const [x, y] = pointAt(i, radius)
            return (
              <line
                key={t}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                className="radar-axis"
              />
            )
          })}

          {/* 刻度數值（標示在正上方軸線旁） */}
          {Array.from({ length: levels }, (_, idx) => {
            const level = idx + 1
            const r = (radius * level) / levels
            const val = Number(((maxVal * level) / levels).toFixed(1))
            return (
              <text
                key={level}
                x={cx + 6}
                y={cy - r + 4}
                className="radar-tick"
              >
                {val}
              </text>
            )
          })}

          {/* 三種難度的資料多邊形與端點 */}
          {DIFFICULTIES.map((d) => {
            if (!visibleDiffs[d]) return null
            const color = DIFF_COLORS[d]
            const pts = TYPES.map((t, i) => {
              const val = counts[t][d]
              const r = (val / maxVal) * radius
              return pointAt(i, r)
            })
            const polygonPoints = pts.map((p) => p.join(',')).join(' ')

            return (
              <g key={d} className={`radar-layer diff-${d}`}>
                <polygon
                  points={polygonPoints}
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                {pts.map(([x, y], i) => {
                  const t = TYPES[i]
                  const val = counts[t][d]
                  return (
                    <circle
                      key={t}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={color.stroke}
                      stroke="#fff"
                      strokeWidth="1.5"
                    >
                      <title>{`${TYPE_LABEL[t]} - ${DIFFICULTY_LABEL[d]}: ${val}`}</title>
                    </circle>
                  )
                })}
              </g>
            )
          })}

          {/* 維度標籤 */}
          {TYPES.map((t, i) => {
            const [x, y] = pointAt(i, labelRadius)
            const cos = Math.cos(angleFor(i))
            const sin = Math.sin(angleFor(i))
            let textAnchor = 'middle'
            if (cos > 0.2) textAnchor = 'start'
            else if (cos < -0.2) textAnchor = 'end'

            let dy = '0.35em'
            if (sin < -0.8) dy = '0em'
            else if (sin > 0.8) dy = '0.7em'

            const eCount = counts[t].easy
            const mCount = counts[t].medium
            const hCount = counts[t].hard

            return (
              <text
                key={t}
                x={x}
                y={y}
                dy={dy}
                textAnchor={textAnchor}
                className="radar-label"
              >
                {TYPE_LABEL[t]}
                <title>{`${TYPE_LABEL[t]}（簡單: ${eCount}, 中等: ${mCount}, 困難: ${hCount}）`}</title>
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default function Home() {
  const [records, setRecords] = useState(null)
  const [connError, setConnError] = useState(null)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setRetrying(true)
    try {
      const data = await listRecords()
      setRecords(data)
      setConnError(null)
    } catch (e) {
      setRecords([])
      setConnError(e.message)
    } finally {
      setRetrying(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const nav = (
    <nav className="nav">
      <a className="btn" href="#/records">記錄管理</a>
      <a className="btn primary" href="#/add">新增記錄</a>
    </nav>
  )

  const offlineBanner = connError && (
    <div className="offline-banner" role="status">
      <span>
        ⚠️ 目前無法連上後端伺服器（{connError}），暫時顯示空白統計，您的既有記錄並未遺失。
      </span>
      <button onClick={load} disabled={retrying}>
        {retrying ? '連線中…' : '🔄 重新連線'}
      </button>
    </div>
  )

  if (!records) return <>{nav}<p>載入中…</p></>

  const countBy = (fn) => records.filter(fn).length

  return (
    <>
      {nav}
      {offlineBanner}
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

      <h2>能力維度雷達圖</h2>
      <RadarChart records={records} />
    </>
  )
}
