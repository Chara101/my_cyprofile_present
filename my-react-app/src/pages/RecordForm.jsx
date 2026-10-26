import { useState } from 'react'
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  TYPES,
  TYPE_LABEL,
  MAX_NAME_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS_COUNT,
  validateQuestionName,
  validateTag,
  toLocalInput,
  fromLocalInput,
} from '../constants.js'

// 新增與修改共用的表單。onSubmit 收到可直接送給 API 的物件。
export default function RecordForm({ initial, submitText, onSubmit, busy }) {
  const [name, setName] = useState(initial?.questionName ?? '')
  const [nameError, setNameError] = useState(null)
  const [type, setType] = useState(initial?.type ?? TYPES[0])
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? '')
  const [time, setTime] = useState(toLocalInput(initial?.time))
  const [tags, setTags] = useState(initial?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [tagError, setTagError] = useState(null)
  const [link, setLink] = useState(initial?.link ?? '')

  const handleNameChange = (e) => {
    const val = e.target.value
    setName(val)
    if (val.trim()) {
      setNameError(validateQuestionName(val))
    } else {
      setNameError(null)
    }
  }

  const handleTagInputChange = (e) => {
    const val = e.target.value
    setTagInput(val)
    if (tagError) setTagError(null)
  }

  const addTag = () => {
    const err = validateTag(tagInput, tags)
    if (err) {
      setTagError(err)
      return
    }
    setTags((prev) => [...prev, tagInput.trim()])
    setTagInput('')
    setTagError(null)
  }

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const removeTag = (target) => {
    setTags((prev) => prev.filter((t) => t !== target))
    if (tagError) setTagError(null)
  }

  const submit = (e) => {
    e.preventDefault()
    const nErr = validateQuestionName(name)
    if (nErr) {
      setNameError(nErr)
      return
    }
    // 若標籤輸入框還有未點「新增標籤」的內容，提示使用者先點擊新增或清空
    if (tagInput.trim()) {
      setTagError('輸入框尚有未新增的標籤，請點擊「新增標籤」或清空輸入框')
      return
    }
    onSubmit({
      questionName: name.trim(),
      type,
      difficulty: difficulty || null,
      time: fromLocalInput(time),
      tags,
      link: link.trim() || null,
    })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        <span>
          題目名稱 * <small className="char-hint">({name.trim().length}/{MAX_NAME_LENGTH} 字，僅限中英文、數字、_ 與 -)</small>
        </span>
        <input
          value={name}
          onChange={handleNameChange}
          maxLength={MAX_NAME_LENGTH}
          placeholder="例如：Two Sum 或 SQL_Injection-101"
          required
        />
        {nameError && <span className="field-error" role="alert">{nameError}</span>}
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
      <div className="field-group">
        <span className="field-label">
          標籤 <small className="char-hint">(已新增 {tags.length}/{MAX_TAGS_COUNT} 個，每標籤最多 {MAX_TAG_LENGTH} 字，僅限中英文、數字、_ 與 -)</small>
        </span>
        <div className="tag-input-row">
          <input
            value={tagInput}
            onChange={handleTagInputChange}
            onKeyDown={handleTagKeyDown}
            maxLength={MAX_TAG_LENGTH}
            placeholder={tags.length >= MAX_TAGS_COUNT ? '已達標籤數量上限' : '輸入單一標籤後點擊新增'}
            disabled={busy || tags.length >= MAX_TAGS_COUNT}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={busy || tags.length >= MAX_TAGS_COUNT || !tagInput.trim()}
          >
            新增標籤
          </button>
        </div>
        {tagError && <span className="field-error" role="alert">{tagError}</span>}
        {tags.length > 0 && (
          <div className="tag-list">
            {tags.map((t) => (
              <span key={t} className="tag tag-editable">
                {t}
                <button
                  type="button"
                  className="tag-remove"
                  onClick={() => removeTag(t)}
                  aria-label={`移除標籤 ${t}`}
                  disabled={busy}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
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
