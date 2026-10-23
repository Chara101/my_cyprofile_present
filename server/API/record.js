const express = require('express');

// 關於記錄建立：包含讀取、寫入、修改、刪除的API
// 依賴反轉：store 由外部(server.js)注入，需實作
// getAll / findBetween / getById / create / update / delete / deleteMany
function createRecordRouter(store) {
    const router = express.Router();

    const isValidDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
    const parseId = (v) => {
        const id = Number(v);
        return Number.isInteger(id) && id > 0 ? id : null;
    };

    // 查詢全部記錄
    router.get('/', (req, res) => {
        res.json(store.getAll({ orderBy: 'id' }));
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
        res.json(store.findBetween('time', from, to));
    });

    // 新增記錄
    router.post('/', (req, res) => {
        const body = req.body || {};
        if (typeof body.questionName !== 'string' || !body.questionName.trim()) {
            return res.status(400).json({ error: 'questionName is required' });
        }
        if (body.time !== undefined && !isValidDate(body.time)) {
            return res.status(400).json({ error: 'time must be a valid date string' });
        }
        const data = { ...body, time: body.time ?? new Date().toISOString() };
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
        if (!store.getById(id)) return res.status(404).json({ error: 'record not found' });
        store.update(id, body);
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
