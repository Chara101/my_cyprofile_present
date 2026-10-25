import { useState } from 'react'
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  TYPES,
  TYPE_LABEL,
  toLocalInput,
  fromLocalInput,
} from '../constants.js'

// 新增與修改共用的表單。onSubmit 收到可直接送給 API 的物件。
export default function RecordForm({ initial, submitText, onSubmit, busy }) {
  const [name, setName] = useState(initial?.questionName ?? '')
  const [type, setType] = useState(initial?.type ?? TYPES[0])
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? '')
  const [time, setTime] = useState(toLocalInput(initial?.time))
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [link, setLink] = useState(initial?.link ?? '')

  const submit = (e) => {
    e.preventDefault()
    onSubmit({
      questionName: name.trim(),
      type,
      difficulty: difficulty || null,
      time: fromLocalInput(time),
      tags: tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      link: link.trim() || null,
    })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        題目名稱 *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        學習維度 *
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        難度
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">未設定</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
      </label>
      <label>
        解題時間
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      <label>
        標籤(以逗號分隔)
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <label>
        題目連結
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://"
        />
      </label>
      <button className="primary" type="submit" disabled={busy}>
        {submitText}
      </button>
    </form>
  )
}
