// 對應 server/sqlite/format.js;後端一律回傳小寫
export const DIFFICULTIES = ['easy', 'medium', 'hard']
export const DIFFICULTY_LABEL = { easy: '簡單', medium: '中等', hard: '困難' }

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
