const BASE = '/api/records'
export const OFFLINE_MSG = '無法連線到伺服器'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error(OFFLINE_MSG)
  }
  if (!res.ok) {
    let msg = `請求失敗 (${res.status})`
    let hasJsonError = false
    try {
      const body = await res.json()
      if (body && body.error) {
        msg = body.error
        hasJsonError = true
      }
    } catch {
      /* 無內容 */
    }
    // Vite proxy 在後端未啟動時會回傳無 JSON body 的 500/502/503/504
    if (!hasJsonError && res.status >= 500) {
      throw new Error(OFFLINE_MSG)
    }
    throw new Error(msg)
  }
  return res.status === 204 ? null : res.json()
}

// GET /?type=&difficulty=&tag=(type/difficulty 大小寫不分,tag 區分大小寫,皆選填)
export const listRecords = ({ type, difficulty, tag } = {}) => {
  const q = new URLSearchParams()
  if (type) q.set('type', type)
  if (difficulty) q.set('difficulty', difficulty)
  if (tag) q.set('tag', tag)
  const s = q.toString()
  return request(s ? `/?${s}` : '/')
}
// GET /range?from=&to=(依 time,含頭尾;送出前轉成 UTC ISO)
export const listRecordsInRange = ({ from, to } = {}) => {
  const q = new URLSearchParams()
  if (from) q.set('from', new Date(from).toISOString())
  if (to) q.set('to', new Date(to).toISOString())
  return request(`/range?${q.toString()}`)
}
export const listRecordsBefore = (to) => listRecordsInRange({ to })
export const createRecord = (data) =>
  request('/', { method: 'POST', body: JSON.stringify(data) })
export const updateRecord = (id, data) =>
  request(`/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteRecord = (id) =>
  request(`/${id}`, { method: 'DELETE' })
export const deleteRecords = (ids) =>
  request('/', { method: 'DELETE', body: JSON.stringify({ ids }) })
