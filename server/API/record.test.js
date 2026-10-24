const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const SQLite = require('../sqlite/sqlite');
const createRecordRouter = require('./record');

let store, server, url;

before(async () => {
    store = new SQLite(':memory:');
    const app = express();
    app.use(express.json());
    app.use('/api/records', createRecordRouter(store));
    // 與 server.js 相同的請求錯誤處理
    app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    url = `http://127.0.0.1:${server.address().port}/api/records`;
});

after(() => {
    server.close();
    store.close();
});

beforeEach(() => {
    store.db.exec("DELETE FROM record; DELETE FROM sqlite_sequence WHERE name='record'");
});

// 送出請求，回傳 { status, body }
async function call(method, path = '', body, raw) {
    const opts = { method, headers: {} };
    if (raw !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = raw;
    } else if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url + path, opts);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
}

const rec = (o = {}) => ({ questionName: 'Two Sum', type: 'GeneralSkills', ...o });

describe('POST /', () => {
    test('201 並回傳新增後的記錄', async () => {
        const r = await call('POST', '', rec({ difficulty: 'Easy', tags: ['array'], link: 'http://x' }));
        assert.equal(r.status, 201);
        assert.equal(r.body.id, 1);
        assert.equal(r.body.type, 'generalskills');
        assert.equal(r.body.difficulty, 'easy');
        assert.deepEqual(r.body.tags, ['array']);
        assert.equal(r.body.link, 'http://x');
    });
    test('未提供 time 時自動填入 ISO 時間', async () => {
        const r = await call('POST', '', rec());
        assert.ok(!Number.isNaN(Date.parse(r.body.time)));
    });
    test('提供 time 時正規化為 UTC ISO', async () => {
        const r = await call('POST', '', rec({ time: '2026-01-01T00:00:00Z' }));
        assert.equal(r.body.time, '2026-01-01T00:00:00.000Z');
    });
    test('帶時區偏移的 time 轉為 UTC', async () => {
        const r = await call('POST', '', rec({ time: '2026-01-01T08:00:00+08:00' }));
        assert.equal(r.body.time, '2026-01-01T00:00:00.000Z');
    });
    test('傳入的 id 被忽略', async () => {
        const r = await call('POST', '', rec({ id: 99 }));
        assert.equal(r.body.id, 1);
    });
    test('tags 預設 []、difficulty 可為 null', async () => {
        const r = await call('POST', '', rec({ difficulty: null }));
        assert.deepEqual(r.body.tags, []);
        assert.equal(r.body.difficulty, null);
    });
    test('type 大小寫不分', async () => {
        const r = await call('POST', '', rec({ type: 'WEBEXPLOITATION' }));
        assert.equal(r.body.type, 'webexploitation');
    });

    const bad = [
        ['缺少 questionName', { type: 'Forensics' }, 'questionName is required'],
        ['questionName 為空白', rec({ questionName: '  ' }), 'questionName is required'],
        ['questionName 非字串', rec({ questionName: 5 }), 'questionName is required'],
        ['缺少 type', { questionName: 'x' }, 'type is required'],
        ['type 為 null', rec({ type: null }), 'type is required'],
        ['type 非法', rec({ type: 'nope' }), 'type must be one of'],
        ['difficulty 非法', rec({ difficulty: 'nope' }), 'difficulty must be one of'],
        ['tags 非陣列', rec({ tags: 'a' }), 'tags must be an array of strings'],
        ['tags 含非字串', rec({ tags: ['a', 1] }), 'tags must be an array of strings'],
        ['time 非法', rec({ time: 'not-a-date' }), 'time must be a valid date string'],
        ['time 非字串', rec({ time: 12345 }), 'time must be a valid date string'],
    ];
    for (const [name, body, msg] of bad) {
        test(`400:${name}`, async () => {
            const r = await call('POST', '', body);
            assert.equal(r.status, 400);
            assert.match(r.body.error, new RegExp(msg));
            assert.equal(store.count(), 0);
        });
    }

    test('400:JSON 格式錯誤', async () => {
        const r = await call('POST', '', undefined, '{bad json');
        assert.equal(r.status, 400);
        assert.ok(r.body.error);
    });
    test('沒有 body 時回 400', async () => {
        const r = await call('POST');
        assert.equal(r.status, 400);
    });
});

describe('GET /', () => {
    beforeEach(() => {
        store.createMany([
            rec({ questionName: 'A', type: 'WebExploitation', difficulty: 'Easy', tags: ['sql'] }),
            rec({ questionName: 'B', type: 'WebExploitation', difficulty: 'Hard', tags: ['xss'] }),
            rec({ questionName: 'C', type: 'Forensics', difficulty: 'Easy', tags: ['SQL'] }),
        ]);
    });
    test('空資料表回傳 []', async () => {
        store.db.exec('DELETE FROM record');
        const r = await call('GET');
        assert.deepEqual(r.body, []);
    });
    test('全部,依 id 由小到大', async () => {
        const r = await call('GET');
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.map((x) => x.questionName), ['A', 'B', 'C']);
    });
    test('type 篩選大小寫不分', async () => {
        const r = await call('GET', '?type=WEBEXPLOITATION');
        assert.equal(r.body.length, 2);
    });
    test('difficulty 篩選', async () => {
        const r = await call('GET', '?difficulty=easy');
        assert.equal(r.body.length, 2);
    });
    test('tag 篩選區分大小寫', async () => {
        assert.deepEqual((await call('GET', '?tag=sql')).body.map((x) => x.questionName), ['A']);
        assert.deepEqual((await call('GET', '?tag=SQL')).body.map((x) => x.questionName), ['C']);
    });
    test('組合條件為 AND', async () => {
        const r = await call('GET', '?type=webexploitation&difficulty=easy&tag=sql');
        assert.deepEqual(r.body.map((x) => x.questionName), ['A']);
    });
    test('400:非法 type / difficulty / 空 tag', async () => {
        assert.equal((await call('GET', '?type=nope')).status, 400);
        assert.equal((await call('GET', '?difficulty=nope')).status, 400);
        const r = await call('GET', '?tag=');
        assert.equal(r.status, 400);
        assert.match(r.body.error, /tag must be a non-empty string/);
    });
    test('400:重複參數 (陣列)', async () => {
        assert.equal((await call('GET', '?type=forensics&type=blockchain')).status, 400);
        assert.equal((await call('GET', '?tag=a&tag=b')).status, 400);
    });
});

describe('GET /range', () => {
    beforeEach(async () => {
        for (const t of ['2026-03-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z']) {
            await call('POST', '', rec({ time: t, questionName: t }));
        }
    });
    test('from + to 含頭尾,依 time 由小到大', async () => {
        const r = await call('GET', '/range?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z');
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.map((x) => x.time), ['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z']);
    });
    test('混用時區:+08:00 的 from/to 與 Z 的資料正確比較', async () => {
        // 2026-02-01T08:00:00+08:00 == 2026-02-01T00:00:00Z
        const r = await call('GET', '/range?from=2026-02-01T08:00:00%2B08:00');
        assert.deepEqual(r.body.map((x) => x.questionName), ['2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z']);
    });
    test('混用時區:以 +08:00 寫入的資料也能被正確查到', async () => {
        await call('POST', '', rec({ time: '2026-02-15T08:00:00+08:00', questionName: 'tz' }));
        const r = await call('GET', '/range?from=2026-02-10T00:00:00Z&to=2026-02-20T00:00:00Z');
        assert.deepEqual(r.body.map((x) => x.questionName), ['tz']);
    });
    test('只給 from / 只給 to', async () => {
        assert.equal((await call('GET', '/range?from=2026-02-01T00:00:00Z')).body.length, 2);
        assert.equal((await call('GET', '/range?to=2026-02-01T00:00:00Z')).body.length, 2);
    });
    test('400:兩者皆缺', async () => {
        const r = await call('GET', '/range');
        assert.equal(r.status, 400);
        assert.match(r.body.error, /from or to is required/);
    });
    test('400:日期非法', async () => {
        const r = await call('GET', '/range?from=abc');
        assert.equal(r.status, 400);
        assert.match(r.body.error, /valid date strings/);
    });
    test('400:from 晚於 to', async () => {
        const r = await call('GET', '/range?from=2026-03-01T00:00:00Z&to=2026-01-01T00:00:00Z');
        assert.equal(r.status, 400);
        assert.match(r.body.error, /from must not be later than to/);
    });
    test('/range 不會被 /:id 攔截 (非 400 invalid id)', async () => {
        const r = await call('GET', '/range?from=2026-01-01T00:00:00Z');
        assert.equal(r.status, 200);
    });
});

describe('PUT /:id', () => {
    let id;
    beforeEach(async () => {
        id = Number(store.create(rec({ difficulty: 'Easy', tags: ['a'] })));
    });
    test('部分更新並回傳更新後記錄', async () => {
        const r = await call('PUT', `/${id}`, { difficulty: 'Hard', tags: ['x', 'y'] });
        assert.equal(r.status, 200);
        assert.equal(r.body.difficulty, 'hard');
        assert.deepEqual(r.body.tags, ['x', 'y']);
        assert.equal(r.body.questionName, 'Two Sum');
    });
    test('id 不可被修改', async () => {
        const r = await call('PUT', `/${id}`, { id: 500, questionName: 'New' });
        assert.equal(r.status, 200);
        assert.equal(r.body.id, id);
        assert.equal(store.getById(500), undefined);
    });
    test('空 body 回傳原記錄', async () => {
        const r = await call('PUT', `/${id}`, {});
        assert.equal(r.status, 200);
        assert.equal(r.body.questionName, 'Two Sum');
    });
    test('PUT 的 time 也會正規化為 UTC', async () => {
        const r = await call('PUT', `/${id}`, { time: '2026-05-01T08:00:00+08:00' });
        assert.equal(r.body.time, '2026-05-01T00:00:00.000Z');
    });
    test('difficulty 可設為 null', async () => {
        const r = await call('PUT', `/${id}`, { difficulty: null });
        assert.equal(r.body.difficulty, null);
    });
    test('404:id 不存在', async () => {
        const r = await call('PUT', '/9999', { difficulty: 'Hard' });
        assert.equal(r.status, 404);
        assert.match(r.body.error, /record not found/);
    });
    for (const badId of ['abc', '0', '-1', '1.5']) {
        test(`400:id=${badId}`, async () => {
            const r = await call('PUT', `/${badId}`, {});
            assert.equal(r.status, 400);
            assert.match(r.body.error, /invalid id/);
        });
    }
    const bad = [
        ['questionName 為空', { questionName: '' }, 'questionName must be a non-empty string'],
        ['questionName 非字串', { questionName: 1 }, 'questionName must be a non-empty string'],
        ['type 為 null', { type: null }, 'type must be one of'],
        ['type 非法', { type: 'nope' }, 'type must be one of'],
        ['difficulty 非法', { difficulty: 'nope' }, 'difficulty must be one of'],
        ['tags 非字串陣列', { tags: [1] }, 'tags must be an array of strings'],
        ['time 非法', { time: 'abc' }, 'time must be a valid date string'],
        ['time 為 null', { time: null }, 'time must be a valid date string'],
    ];
    for (const [name, body, msg] of bad) {
        test(`400:${name}`, async () => {
            const r = await call('PUT', `/${id}`, body);
            assert.equal(r.status, 400);
            assert.match(r.body.error, new RegExp(msg));
            assert.equal(store.getById(id).questionName, 'Two Sum');
        });
    }
});

describe('DELETE /:id', () => {
    test('204 並實際刪除', async () => {
        const id = Number(store.create(rec()));
        const r = await call('DELETE', `/${id}`);
        assert.equal(r.status, 204);
        assert.equal(store.getById(id), undefined);
    });
    test('404:id 不存在 / 重複刪除', async () => {
        const id = Number(store.create(rec()));
        await call('DELETE', `/${id}`);
        assert.equal((await call('DELETE', `/${id}`)).status, 404);
    });
    test('400:id 非法', async () => {
        assert.equal((await call('DELETE', '/abc')).status, 400);
        assert.equal((await call('DELETE', '/0')).status, 400);
    });
});

describe('DELETE /', () => {
    beforeEach(() => { store.createMany([rec(), rec(), rec()]); });
    test('200 並回傳實際刪除筆數', async () => {
        const r = await call('DELETE', '', { ids: [1, 2] });
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, { deleted: 2 });
        assert.equal(store.count(), 1);
    });
    test('不存在的 id 被略過', async () => {
        const r = await call('DELETE', '', { ids: [1, 9999] });
        assert.deepEqual(r.body, { deleted: 1 });
    });
    test('數字字串視為合法 id', async () => {
        const r = await call('DELETE', '', { ids: ['3'] });
        assert.deepEqual(r.body, { deleted: 1 });
    });
    const bad = [
        ['缺少 ids', {}],
        ['ids 為空陣列', { ids: [] }],
        ['ids 非陣列', { ids: 1 }],
        ['含非正整數', { ids: [1, 0] }],
        ['含負數', { ids: [-1] }],
        ['含小數', { ids: [1.5] }],
        ['含非數字', { ids: ['a'] }],
    ];
    for (const [name, body] of bad) {
        test(`400:${name}`, async () => {
            const r = await call('DELETE', '', body);
            assert.equal(r.status, 400);
            assert.match(r.body.error, /ids must be a non-empty array of positive integers/);
            assert.equal(store.count(), 3);
        });
    }
    test('400:沒有 body', async () => {
        assert.equal((await call('DELETE')).status, 400);
    });
});

describe('內部錯誤處理', () => {
    test('store 拋出例外時回 500 且不洩漏細節', async () => {
        const app = express();
        app.use(express.json());
        const boom = { find() { throw new Error('secret db detail'); } };
        app.use('/r', createRecordRouter(boom));
        const srv = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
        const origError = console.error;
        console.error = () => {};
        try {
            const res = await fetch(`http://127.0.0.1:${srv.address().port}/r`);
            assert.equal(res.status, 500);
            assert.deepEqual(await res.json(), { error: 'internal server error' });
        } finally {
            console.error = origError;
            srv.close();
        }
    });
});
