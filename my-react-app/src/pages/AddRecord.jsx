import { useState } from 'react'
import { createRecord } from '../api.js'
import { useDialog } from '../Dialog.jsx'
import RecordForm from './RecordForm.jsx'

export default function AddRecord() {
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)

  const onSubmit = async (data) => {
    if (!(await dialog.confirm(`確定要新增「${data.questionName}」嗎?`))) return
    setBusy(true)
    try {
      await createRecord(data)
      window.location.hash = '#/records'
    } catch (e) {
      await dialog.alert(`新增失敗:${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <nav className="nav">
        <a className="btn" href="#/">🏠 回首頁</a>
      </nav>
      <h2>新增記錄</h2>
      <RecordForm submitText="新增" onSubmit={onSubmit} busy={busy} />
    </>
  )
}
