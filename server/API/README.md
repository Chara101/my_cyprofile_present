# 解題記錄 API

- Base URL:`http://localhost:3000/api/records`
- 格式:請求與回應皆為 JSON(`Content-Type: application/json`)
- 實作:[record.js](./record.js)

## 記錄格式

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | integer | 記錄 ID,自動產生 |
| `questionName` | string | 題目名稱,**必填**,長度 1–50 字,僅允許中英文、數字、空白、`_` 與 `-` |
| `time` | string | 記錄時間,ISO 8601;新增時未提供則自動填入。一律正規化並回傳為 UTC(結尾 `Z`),例如傳 `2026-01-01T08:00:00+08:00` 會存成 `2026-01-01T00:00:00.000Z`。建議傳帶 `Z` 或時區偏移量的格式,沒有時區的輸入會依 JavaScript 解析規則處理 |
| `difficulty` | string \| null | 難度,見下方「列舉值」 |
| `type` | string | 題目類型,**必填**,見下方「列舉值」 |
| `tags` | string[] | 題目標籤,最多 10 個;每個標籤長度 1–20 字,僅允許中英文、數字、`_` 與 `-`;未提供為 `[]` |
| `link` | string \| null | 題目連結 |

### 列舉值

`difficulty`、`type` 傳入時大小寫皆可,但**一律以小寫儲存與回傳**(例如傳 `WebExploitation`,回傳 `webexploitation`)。

| 欄位 | 可用值 |
|---|---|
| `difficulty` | `Easy`、`Medium`、`Hard` |
| `type` | `WebExploitation`、`ReverseEngineering`、`Forensics`、`BinaryExploitation`、`Cryptography`、`GeneralSkills`、`ArtificialIntelligence`、`Blockchain` |

範例:

```json
{
  "id": 1,
  "questionName": "Two Sum",
  "time": "2026-01-01T00:00:00Z",
  "difficulty": "easy",
  "type": "generalskills",
  "tags": ["array", "hash-table"],
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

`GET /api/records?type=&difficulty=&tag=`

| 參數 | 說明 |
|---|---|
| `type` | 只回傳該題目類型,大小寫不分 |
| `difficulty` | 只回傳該難度,大小寫不分 |
| `tag` | 只回傳 `tags` 包含此標籤的記錄(區分大小寫) |

- 參數皆為選填,可組合使用(AND)
- 依 `id` 由小到大排序
- 回應 `200`:記錄陣列

```bash
curl http://localhost:3000/api/records
curl "http://localhost:3000/api/records?type=WebExploitation&tag=sql"
```

---

## 查詢區間

`GET /api/records/range?from=&to=`

依 `time` 篩選,含頭尾,依 `time` 由小到大排序。

| 參數 | 說明 |
|---|---|
| `from` | 起始時間(ISO 8601,會先正規化為 UTC 再比較) |
| `to` | 結束時間(ISO 8601,會先正規化為 UTC 再比較) |

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
| `questionName` | 是 | 非空字串,長度 1–50 字,僅允許中英文、數字、空白、`_` 與 `-` |
| `type` | 是 | 題目類型,見「列舉值」 |
| `time` | 否 | 合法日期字串,預設為目前時間;儲存時轉為 UTC ISO 8601 |
| `difficulty` | 否 | 難度,見「列舉值」,可為 `null` |
| `tags` | 否 | 字串陣列(最多 10 個,單個 1–20 字,僅允許中英文、數字、`_` 與 `-`),預設 `[]` |
| `link` | 否 | |

- 傳入的 `id` 會被忽略
- 回應 `201`:新增後的記錄

```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{"questionName":"Two Sum","type":"GeneralSkills","difficulty":"Easy","tags":["array"]}'
```

---

## 更新

`PUT /api/records/:id`

- body 只需帶要修改的欄位(`id` 不可修改)
- `type` 若有帶,不可為 `null`;`tags` 若有帶,會整個取代原本的標籤
- 回應 `200`:更新後的記錄
- `id` 不存在回 `404`

```bash
curl -X PUT http://localhost:3000/api/records/1 \
  -H "Content-Type: application/json" \
  -d '{"difficulty":"Hard","tags":["array","two-pointers"]}'
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
- `questionName must be at most 50 characters`
- `questionName contains invalid characters (only letters, numbers, spaces, _ and - are allowed)`
- `type is required`
- `type must be one of: ...`
- `difficulty must be one of: ...`
- `tags must be an array of strings`
- `tags cannot exceed 10 items`
- `each tag must be 1-20 characters`
- `tags contain invalid characters (only letters, numbers, _ and - are allowed)`
- `tag must be a non-empty string`
- `time must be a valid date string`
- `from or to is required`
- `from/to must be valid date strings`
- `from must not be later than to`
- `ids must be a non-empty array of positive integers`
- `invalid id`
