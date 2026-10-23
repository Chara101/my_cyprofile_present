# 解題記錄 API

- Base URL:`http://localhost:3000/api/records`
- 格式:請求與回應皆為 JSON(`Content-Type: application/json`)
- 實作:[record.js](./record.js)

## 記錄格式

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | integer | 記錄 ID,自動產生 |
| `questionName` | string | 題目名稱,**必填** |
| `time` | string | 記錄時間,ISO 8601;新增時未提供則自動填入 |
| `difficulty` | string \| null | 難度 |
| `link` | string \| null | 題目連結 |

範例:

```json
{
  "id": 1,
  "questionName": "Two Sum",
  "time": "2026-01-01T00:00:00Z",
  "difficulty": "easy",
  "link": "https://leetcode.com/problems/two-sum/"
}
```

## 端點總覽

| 功能 | 方法 | 路徑 | 成功狀態碼 |
|---|---|---|---|
| 查詢全部 | GET | `/` | 200 |
| 查詢區間 | GET | `/range` | 200 |
| 新增 | POST | `/` | 201 |
| 更新 | PUT | `/:id` | 200 |
| 刪除單個 | DELETE | `/:id` | 204 |
| 刪除多個 | DELETE | `/` | 200 |

---

## 查詢全部

`GET /api/records`

- 依 `id` 由小到大排序
- 回應 `200`:記錄陣列

```bash
curl http://localhost:3000/api/records
```

---

## 查詢區間

`GET /api/records/range?from=&to=`

依 `time` 篩選,含頭尾,依 `time` 由小到大排序。

| 參數 | 說明 |
|---|---|
| `from` | 起始時間(ISO 8601) |
| `to` | 結束時間(ISO 8601) |

- `from`、`to` 至少要給一個
- 兩者都給時,`from` 不可晚於 `to`
- 回應 `200`:記錄陣列

```bash
curl "http://localhost:3000/api/records/range?from=2026-01-15T00:00:00Z&to=2026-02-15T00:00:00Z"
```

---

## 新增

`POST /api/records`

| 欄位 | 必填 | 說明 |
|---|---|---|
| `questionName` | 是 | 非空字串 |
| `time` | 否 | 合法日期字串,預設為目前時間 |
| `difficulty` | 否 | |
| `link` | 否 | |

- 傳入的 `id` 會被忽略
- 回應 `201`:新增後的記錄

```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{"questionName":"Two Sum","difficulty":"easy"}'
```

---

## 更新

`PUT /api/records/:id`

- body 只需帶要修改的欄位(`id` 不可修改)
- 回應 `200`:更新後的記錄
- `id` 不存在回 `404`

```bash
curl -X PUT http://localhost:3000/api/records/1 \
  -H "Content-Type: application/json" \
  -d '{"difficulty":"hard"}'
```

---

## 刪除單個

`DELETE /api/records/:id`

- 回應 `204`,無內容
- `id` 不存在回 `404`

```bash
curl -X DELETE http://localhost:3000/api/records/1
```

---

## 刪除多個

`DELETE /api/records`

| body 欄位 | 說明 |
|---|---|
| `ids` | 正整數陣列,不可為空 |

- 回應 `200`:`{ "deleted": 實際刪除筆數 }`
- 不存在的 id 會被略過,不報錯

```bash
curl -X DELETE http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{"ids":[2,3]}'
```

---

## 錯誤回應

格式:`{ "error": "訊息" }`

| 狀態碼 | 情況 |
|---|---|
| 400 | 參數或 body 驗證失敗、`id` 不是正整數、JSON 格式錯誤 |
| 404 | 找不到指定 `id` 的記錄 |
| 500 | 伺服器內部錯誤 |

常見 400 訊息:

- `questionName is required`
- `questionName must be a non-empty string`
- `time must be a valid date string`
- `from or to is required`
- `from/to must be valid date strings`
- `from must not be later than to`
- `ids must be a non-empty array of positive integers`
- `invalid id`
