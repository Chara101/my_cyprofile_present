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

    // 邊界條件與用字限制
    const MAX_NAME_LENGTH = 50;
    const MAX_TAG_LENGTH = 20;
    const MAX_TAGS_COUNT = 10;
    const VALID_NAME_REGEX = /^[\p{L}\p{N}_ -]+$/u;
    const VALID_TAG_REGEX = /^[\p{L}\p{N}_-]+$/u;

    const validateQuestionName = (name) => {
        const s = name.trim();
        if (s.length > MAX_NAME_LENGTH) return `questionName must be at most ${MAX_NAME_LENGTH} characters`;
        if (!VALID_NAME_REGEX.test(s)) return 'questionName contains invalid characters (only letters, numbers, spaces, _ and - are allowed)';
        return null;
    };

    // 驗證 type / difficulty / tags，回傳錯誤訊息；通過回傳 null
    // type 不可為 null；difficulty 可為 null；tags 必須為字串陣列且符合數量、長度與字元限制
    const validateFields = (body) => {
        if (body.type !== undefined && !isEnum(Type, body.type)) return enumMessage('type', Type);
        if (body.difficulty !== undefined && body.difficulty !== null && !isEnum(Difficulty, body.difficulty)) {
            return enumMessage('difficulty', Difficulty);
        }
        if (body.tags !== undefined) {
            if (!Array.isArray(body.tags) || !body.tags.every((t) => typeof t === 'string')) {
                return 'tags must be an array of strings';
            }
            if (body.tags.length > MAX_TAGS_COUNT) {
                return `tags cannot exceed ${MAX_TAGS_COUNT} items`;
            }
            for (const rawTag of body.tags) {
                const t = rawTag.trim();
                if (!t || t.length > MAX_TAG_LENGTH) {
                    return `each tag must be 1-${MAX_TAG_LENGTH} characters`;
                }
                if (!VALID_TAG_REGEX.test(t)) {
                    return 'tags contain invalid characters (only letters, numbers, _ and - are allowed)';
                }
            }
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
        const nameErr = validateQuestionName(body.questionName);
        if (nameErr) return res.status(400).json({ error: nameErr });
        if (body.type === undefined || body.type === null) {
            return res.status(400).json({ error: 'type is required' });
        }
        if (body.time !== undefined && !isValidDate(body.time)) {
            return res.status(400).json({ error: 'time must be a valid date string' });
        }
        const fieldError = validateFields(body);
        if (fieldError) return res.status(400).json({ error: fieldError });
        const data = {
            ...body,
            questionName: body.questionName.trim(),
            ...(body.tags !== undefined ? { tags: body.tags.map((t) => t.trim()) } : {}),
            time: normalizeTime(body.time ?? new Date().toISOString()),
        };
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
        if (body.questionName !== undefined) {
            if (typeof body.questionName !== 'string' || !body.questionName.trim()) {
                return res.status(400).json({ error: 'questionName must be a non-empty string' });
            }
            const nameErr = validateQuestionName(body.questionName);
            if (nameErr) return res.status(400).json({ error: nameErr });
        }
        if (body.time !== undefined && !isValidDate(body.time)) {
            return res.status(400).json({ error: 'time must be a valid date string' });
        }
        const fieldError = validateFields(body);
        if (fieldError) return res.status(400).json({ error: fieldError });
        if (!store.getById(id)) return res.status(404).json({ error: 'record not found' });
        const updates = {
            ...body,
            ...(body.questionName !== undefined ? { questionName: body.questionName.trim() } : {}),
            ...(body.tags !== undefined ? { tags: body.tags.map((t) => t.trim()) } : {}),
            ...(body.time !== undefined ? { time: normalizeTime(body.time) } : {}),
        };
        store.update(id, updates);
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
