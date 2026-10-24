const express = require('express');
const { Difficulty, Type } = require('../sqlite/format');

// 關於記錄建立：包含讀取、寫入、修改、刪除的API
// 依賴反轉：store 由外部(server.js)注入，需實作
// find / findBetween / getById / create / update / delete / deleteMany
function createRecordRouter(store) {
    const router = express.Router();

    const isValidDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
    // 時間一律正規化為 UTC ISO 8601 (結尾 Z)，讓字串比較等同時間先後比較
    const normalizeTime = (v) => new Date(v).toISOString();
    const parseId = (v) => {
        const id = Number(v);
        return Number.isInteger(id) && id > 0 ? id : null;
    };

    // 列舉值 (大小寫不分) 驗證
    const isEnum = (enumObj, v) =>
        typeof v === 'string' && Object.values(enumObj).some((e) => e.toLowerCase() === v.toLowerCase());
    const enumMessage = (name, enumObj) => `${name} must be one of: ${Object.values(enumObj).join(', ')}`;

    // 驗證 type / difficulty / tags，回傳錯誤訊息；通過回傳 null
    // type 不可為 null；difficulty 可為 null；tags 必須為字串陣列
    const validateFields = (body) => {
        if (body.type !== undefined && !isEnum(Type, body.type)) return enumMessage('type', Type);
        if (body.difficulty !== undefined && body.difficulty !== null && !isEnum(Difficulty, body.difficulty)) {
            return enumMessage('difficulty', Difficulty);
        }
        if (body.tags !== undefined && (!Array.isArray(body.tags) || !body.tags.every((t) => typeof t === 'string'))) {
            return 'tags must be an array of strings';
        }
        return null;
    };

    // 查詢記錄，可用 type / difficulty / tag 過濾
    router.get('/', (req, res) => {
        const { type, difficulty, tag } = req.query;
        if (type !== undefined && !isEnum(Type, type)) {
            return res.status(400).json({ error: enumMessage('type', Type) });
        }
        if (difficulty !== undefined && !isEnum(Difficulty, difficulty)) {
            return res.status(400).json({ error: enumMessage('difficulty', Difficulty) });
        }
        if (tag !== undefined && (typeof tag !== 'string' || !tag)) {
            return res.status(400).json({ error: 'tag must be a non-empty string' });
        }
        res.json(store.find({ type, difficulty, tag }, { orderBy: 'id' }));
    });

    // 查詢特定區間的記錄 (依 time)，需在 /:id 之前
    router.get('/range', (req, res) => {
        const { from, to } = req.query;
        if (from === undefined && to === undefined) {
            return res.status(400).json({ error: 'from or to is required' });
        }
        if ((from !== undefined && !isValidDate(from)) || (to !== undefined && !isValidDate(to))) {
            return res.status(400).json({ error: 'from/to must be valid date strings' });
        }
        if (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to)) {
            return res.status(400).json({ error: 'from must not be later than to' });
        }
        res.json(store.findBetween(
            'time',
            from !== undefined ? normalizeTime(from) : undefined,
            to !== undefined ? normalizeTime(to) : undefined
        ));
    });

    // 新增記錄
    router.post('/', (req, res) => {
        const body = req.body || {};
        if (typeof body.questionName !== 'string' || !body.questionName.trim()) {
            return res.status(400).json({ error: 'questionName is required' });
        }
        if (body.type === undefined || body.type === null) {
            return res.status(400).json({ error: 'type is required' });
        }
        if (body.time !== undefined && !isValidDate(body.time)) {
            return res.status(400).json({ error: 'time must be a valid date string' });
        }
        const fieldError = validateFields(body);
        if (fieldError) return res.status(400).json({ error: fieldError });
        const data = { ...body, time: normalizeTime(body.time ?? new Date().toISOString()) };
        delete data.id;
        const id = store.create(data);
        res.status(201).json(store.getById(id));
    });

    // 刪除多個記錄 { ids: [...] }
    router.delete('/', (req, res) => {
        const ids = req.body && req.body.ids;
        if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => parseId(i) !== null)) {
            return res.status(400).json({ error: 'ids must be a non-empty array of positive integers' });
        }
        res.json({ deleted: store.deleteMany(ids.map(Number)) });
    });

    // 更新記錄
    router.put('/:id', (req, res) => {
        const id = parseId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'invalid id' });
        const body = req.body || {};
        if (body.questionName !== undefined && (typeof body.questionName !== 'string' || !body.questionName.trim())) {
            return res.status(400).json({ error: 'questionName must be a non-empty string' });
        }
        if (body.time !== undefined && !isValidDate(body.time)) {
            return res.status(400).json({ error: 'time must be a valid date string' });
        }
        const fieldError = validateFields(body);
        if (fieldError) return res.status(400).json({ error: fieldError });
        if (!store.getById(id)) return res.status(404).json({ error: 'record not found' });
        store.update(id, body.time !== undefined ? { ...body, time: normalizeTime(body.time) } : body);
        res.json(store.getById(id));
    });

    // 刪除單個記錄
    router.delete('/:id', (req, res) => {
        const id = parseId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'invalid id' });
        if (store.delete(id) === 0) return res.status(404).json({ error: 'record not found' });
        res.status(204).end();
    });

    // 統一錯誤處理
    router.use((err, req, res, next) => {
        console.error(err);
        res.status(500).json({ error: 'internal server error' });
    });

    return router;
}

module.exports = createRecordRouter;
