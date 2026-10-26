import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  listRecords,
  listRecordsInRange,
  listRecordsBefore,
  createRecord,
  updateRecord,
  deleteRecord,
  deleteRecords,
} from './api.js'
import {
  DIFFICULTIES,
  TYPES,
  MAX_NAME_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS_COUNT,
  validateQuestionName,
  validateTag,
  fromLocalInput,
  toLocalInput,
} from './constants.js'

const require = createRequire(import.meta.url)
const express = require('../../server/node_modules/express')
const SQLite = require('../../server/sqlite/sqlite')
const createRecordRouter = require('../../server/API/record')
const { Difficulty, Type } = require('../../server/sqlite/format')

let store, server, baseOrigin
const realFetch = globalThis.fetch

before(async () => {
  store = new SQLite(':memory:')
  const app = express()
  app.use(express.json())
  app.use('/api/records', createRecordRouter(store))
  app.use((err, req, res, _next) =>
    res.status(err.status || 500).json({ error: err.message }),
  )
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  baseOrigin = `http://127.0.0.1:${server.address().port}`

  // 將前端相對路徑 /api/records 導向測試伺服器
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' && input.startsWith('/') ? baseOrigin + input : input
    return realFetch(url, init)
  }
})

after(() => {
  globalThis.fetch = realFetch
  server.close()
  store.close()
})

beforeEach(() => {
  store.db.exec("DELETE FROM record; DELETE FROM sqlite_sequence WHERE name='record'")
})

describe('constants.js 與後端 format.js 對齊', () => {
  test('DIFFICULTIES 與 TYPES 對應後端列舉小寫', () => {
    assert.deepEqual(
      DIFFICULTIES,
      Object.values(Difficulty).map((v) => v.toLowerCase()),
    )
    assert.deepEqual(
      TYPES,
      Object.values(Type).map((v) => v.toLowerCase()),
    )
  })

  test('fromLocalInput 空值回傳 undefined,合法值轉 ISO', () => {
    assert.equal(fromLocalInput(''), undefined)
    assert.equal(fromLocalInput(null), undefined)
    const iso = fromLocalInput('2026-05-01T12:30')
    assert.ok(iso.endsWith('Z'))
    assert.equal(toLocalInput(iso), '2026-05-01T12:30')
  })

  test('validateQuestionName 驗證題目名稱長度 (50字) 與用字限制', () => {
    assert.equal(validateQuestionName('Two Sum 題目_01-A'), null)
    assert.equal(validateQuestionName('a'.repeat(MAX_NAME_LENGTH)), null)
    assert.match(validateQuestionName('   '), /請輸入題目名稱/)
    assert.match(validateQuestionName('a'.repeat(MAX_NAME_LENGTH + 1)), /最多 50 字/)
    assert.match(validateQuestionName('SQLi@101!'), /不能包含特殊符號/)
  })

  test('validateTag 驗證單個標籤長度 (20字)、數量上限 (10個)、重複與用字限制', () => {
    assert.equal(validateTag('hash-table_01', []), null)
    assert.equal(validateTag('資料結構_陣列-1', []), null)
    assert.equal(validateTag('a'.repeat(MAX_TAG_LENGTH), []), null)
    assert.match(validateTag('', []), /請輸入標籤內容/)
    assert.match(validateTag('a'.repeat(MAX_TAG_LENGTH + 1), []), /最多 20 字/)
    assert.match(validateTag('bad tag', []), /不能包含特殊符號或空白/)
    assert.match(validateTag('tag@1', []), /不能包含特殊符號或空白/)
    assert.match(validateTag('dup', ['dup']), /已存在/)
    const tenTags = Array.from({ length: MAX_TAGS_COUNT }, (_, i) => `t${i}`)
    assert.match(validateTag('new_tag', tenTags), /最多只能新增 10 個標籤/)
  })
})

describe('api.js 與 server/API 端對端整合', () => {
  test('createRecord + listRecords (type / difficulty / tag 篩選)', async () => {
    const r1 = await createRecord({
      questionName: 'SQLi 101',
      type: 'webexploitation',
      difficulty: 'easy',
      tags: ['sqli', 'login'],
      time: '2026-01-10T00:00:00Z',
      link: 'https://example.com/1',
    })
    const r2 = await createRecord({
      questionName: 'RSA Baby',
      type: 'cryptography',
      difficulty: 'hard',
      tags: ['rsa'],
      time: '2026-02-10T00:00:00Z',
    })
    assert.equal(r1.id, 1)
    assert.equal(r2.id, 2)

    const all = await listRecords()
    assert.equal(all.length, 2)

    const byType = await listRecords({ type: 'webexploitation' })
    assert.deepEqual(byType.map((x) => x.id), [1])

    const byDiff = await listRecords({ difficulty: 'hard' })
    assert.deepEqual(byDiff.map((x) => x.id), [2])

    const byTag = await listRecords({ tag: 'sqli' })
    assert.deepEqual(byTag.map((x) => x.id), [1])

    const byCombo = await listRecords({
      type: 'webexploitation',
      difficulty: 'easy',
      tag: 'login',
    })
    assert.deepEqual(byCombo.map((x) => x.id), [1])
  })

  test('createRecord 未填 time 時由後端自動填入', async () => {
    const r = await createRecord({
      questionName: 'Auto Time',
      type: 'generalskills',
      time: fromLocalInput(''),
    })
    assert.ok(r.time.endsWith('Z'))
  })

  test('listRecordsInRange (from / to) 與 listRecordsBefore', async () => {
    await createRecord({ questionName: 'Jan', type: 'forensics', time: '2026-01-01T00:00:00Z' })
    await createRecord({ questionName: 'Feb', type: 'forensics', time: '2026-02-01T00:00:00Z' })
    await createRecord({ questionName: 'Mar', type: 'forensics', time: '2026-03-01T00:00:00Z' })

    const mid = await listRecordsInRange({
      from: '2026-01-15T00:00:00Z',
      to: '2026-02-15T00:00:00Z',
    })
    assert.deepEqual(mid.map((x) => x.questionName), ['Feb'])

    const fromOnly = await listRecordsInRange({ from: '2026-02-01T00:00:00Z' })
    assert.deepEqual(fromOnly.map((x) => x.questionName), ['Feb', 'Mar'])

    const toOnly = await listRecordsBefore('2026-02-01T00:00:00Z')
    assert.deepEqual(toOnly.map((x) => x.questionName), ['Jan', 'Feb'])
  })

  test('updateRecord 修改記錄', async () => {
    const r = await createRecord({
      questionName: 'Old',
      type: 'forensics',
      difficulty: 'easy',
    })
    const updated = await updateRecord(r.id, {
      questionName: 'New',
      difficulty: 'hard',
      tags: ['pcap'],
    })
    assert.equal(updated.questionName, 'New')
    assert.equal(updated.difficulty, 'hard')
    assert.deepEqual(updated.tags, ['pcap'])
  })

  test('deleteRecord 單筆刪除 (204 -> null)', async () => {
    const r = await createRecord({ questionName: 'DelMe', type: 'blockchain' })
    const res = await deleteRecord(r.id)
    assert.equal(res, null)
    assert.deepEqual(await listRecords(), [])
  })

  test('deleteRecords 批量刪除 (200 -> { deleted })', async () => {
    const a = await createRecord({ questionName: 'A', type: 'blockchain' })
    const b = await createRecord({ questionName: 'B', type: 'blockchain' })
    const res = await deleteRecords([a.id, b.id])
    assert.deepEqual(res, { deleted: 2 })
    assert.deepEqual(await listRecords(), [])
  })

  test('後端 400 / 404 錯誤訊息能被前端正確捕獲', async () => {
    await assert.rejects(
      () => createRecord({ questionName: '', type: 'forensics' }),
      /questionName is required/,
    )
    await assert.rejects(
      () => deleteRecord(9999),
      /record not found/,
    )
    await assert.rejects(
      () =>
        listRecordsInRange({
          from: '2026-03-01T00:00:00Z',
          to: '2026-01-01T00:00:00Z',
        }),
      /from must not be later than to/,
    )
  })

  test('後端不可用 (網路連線拒絕或 Vite proxy 500/502) 時統一拋出無法連線到伺服器', async () => {
    const prevFetch = globalThis.fetch
    try {
      globalThis.fetch = async () => {
        throw new TypeError('fetch failed')
      }
      await assert.rejects(() => listRecords(), /無法連線到伺服器/)

      globalThis.fetch = async () => new Response('Bad Gateway', { status: 502 })
      await assert.rejects(() => listRecords(), /無法連線到伺服器/)

      globalThis.fetch = async () => new Response('', { status: 500 })
      await assert.rejects(() => listRecords(), /無法連線到伺服器/)
    } finally {
      globalThis.fetch = prevFetch
    }
  })
})
