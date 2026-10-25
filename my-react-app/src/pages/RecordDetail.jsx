import { useEffect, useState } from 'react'
import { deleteRecord, listRecords, updateRecord } from '../api.js'
import { useDialog } from '../Dialog.jsx'
import { DIFFICULTY_LABEL, TYPE_LABEL, fmtTime } from '../constants.js'
import RecordForm from './RecordForm.jsx'

export default function RecordDetail({ id }) {
  const dialog = useDialog()
  const [record, setRecord] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listRecords()
      .then((all) => {
        const r = all.find((x) => x.id === id)
        if (r) setRecord(r)
        else dialog.alert('找不到此記錄').then(() => (window.location.hash = '#/records'))
      })
      .catch((e) => dialog.alert(`載入失敗:${e.message}`))
  }, [id, dialog])

  const onSubmit = async (data) => {
    if (!(await dialog.confirm('確定要儲存修改嗎?'))) return
    setBusy(true)
    try {
      setRecord(await updateRecord(id, data))
      setEditing(false)
      await dialog.alert('修改成功')
    } catch (e) {
      await dialog.alert(`修改失敗:${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!(await dialog.confirm(`確定要刪除「${record.questionName}」嗎?`))) return
    setBusy(true)
    try {
      await deleteRecord(id)
      await dialog.alert('刪除成功')
      window.location.hash = '#/records'
    } catch (e) {
      await dialog.alert(`刪除失敗:${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <nav className="nav">
        <a className="btn" href="#/records">← 回記錄列表</a>
        {record && (
          <button className="danger" onClick={onDelete} disabled={busy}>
            刪除記錄
          </button>
        )}
        <label className="switch">
          <input
            type="checkbox"
            checked={editing}
            onChange={(e) => setEditing(e.target.checked)}
            disabled={!record || busy}
          />
          <span>{editing ? '修改模式' : '展示模式'}</span>
        </label>
      </nav>
      {!record ? (
        <p>載入中…</p>
      ) : editing ? (
        <RecordForm initial={record} submitText="儲存修改" onSubmit={onSubmit} busy={busy} />
      ) : (
        <dl className="detail">
          <dt>題目名稱</dt><dd>{record.questionName}</dd>
          <dt>學習維度</dt><dd>{TYPE_LABEL[record.type] ?? record.type}</dd>
          <dt>難度</dt><dd>{DIFFICULTY_LABEL[record.difficulty] ?? '未設定'}</dd>
          <dt>解題時間</dt><dd>{fmtTime(record.time)}</dd>
          <dt>標籤</dt>
          <dd>
            {record.tags?.length
              ? record.tags.map((t) => <span key={t} className="tag">{t}</span>)
              : '-'}
          </dd>
          <dt>題目連結</dt>
          <dd>
            {record.link ? (
              <a href={record.link} target="_blank" rel="noreferrer">{record.link}</a>
            ) : '-'}
          </dd>
        </dl>
      )}
    </>
  )
}
