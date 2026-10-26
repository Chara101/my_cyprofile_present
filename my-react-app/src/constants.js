// 對應 server/sqlite/format.js;後端一律回傳小寫
export const DIFFICULTIES = ['easy', 'medium', 'hard']
export const DIFFICULTY_LABEL = { easy: '簡單', medium: '中等', hard: '困難' }

// 邊界條件與格式驗證
export const MAX_NAME_LENGTH = 50
export const MAX_TAG_LENGTH = 20
export const MAX_TAGS_COUNT = 10
export const VALID_NAME_REGEX = /^[\p{L}\p{N}_ -]+$/u
export const VALID_TAG_REGEX = /^[\p{L}\p{N}_-]+$/u

export const validateQuestionName = (name) => {
  const s = (name ?? '').trim()
  if (!s) return '請輸入題目名稱'
  if (s.length > MAX_NAME_LENGTH) return `題目名稱最多 ${MAX_NAME_LENGTH} 字（目前 ${s.length} 字）`
  if (!VALID_NAME_REGEX.test(s)) return '題目名稱不能包含特殊符號（僅允許中英文、數字、空白、_ 與 -）'
  return null
}

export const validateTag = (tag, existingTags = []) => {
  const s = (tag ?? '').trim()
  if (!s) return '請輸入標籤內容'
  if (s.length > MAX_TAG_LENGTH) return `標籤長度最多 ${MAX_TAG_LENGTH} 字（目前 ${s.length} 字）`
  if (!VALID_TAG_REGEX.test(s)) return '標籤不能包含特殊符號或空白（僅允許中英文、數字、_ 與 -）'
  if (existingTags.includes(s)) return '此標籤已存在'
  if (existingTags.length >= MAX_TAGS_COUNT) return `每筆記錄最多只能新增 ${MAX_TAGS_COUNT} 個標籤`
  return null
}

export const TYPES = [
  'webexploitation',
  'reverseengineering',
  'forensics',
  'binaryexploitation',
  'cryptography',
  'generalskills',
  'artificialintelligence',
  'blockchain',
]
export const TYPE_LABEL = {
  webexploitation: 'Web Exploitation',
  reverseengineering: 'Reverse Engineering',
  forensics: 'Forensics',
  binaryexploitation: 'Binary Exploitation',
  cryptography: 'Cryptography',
  generalskills: 'General Skills',
  artificialintelligence: 'Artificial Intelligence',
  blockchain: 'Blockchain',
}

export const diffRank = (d) => {
  const i = DIFFICULTIES.indexOf(d)
  return i < 0 ? DIFFICULTIES.length : i
}

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : '-')

// ISO <-> <input type="datetime-local">
export const toLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : undefined)
