const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const SQLite = require('./sqlite');
const { Difficulty, Type } = require('./format');

const base = (o = {}) => ({ questionName: 'Two Sum', type: 'GeneralSkills', ...o });

let s;
beforeEach(() => { s = new SQLite(':memory:'); });
afterEach(() => { s.close(); });

describe('建表與識別字', () => {
    test('資料表存在', () => {
        const r = s.db.prepare("SELECT name FROM sqlite_master WHERE name='record'").get();
        assert.equal(r.name, 'record');
    });
    test('重複 createTable 不報錯', () => {
        assert.doesNotThrow(() => s.createTable());
    });
    test('非法表名丟出錯誤', () => {
        assert.throws(() => new SQLite(':memory:', 'a;drop'), /Invalid identifier/);
    });
    test('非法欄位名丟出錯誤', () => {
        assert.throws(() => new SQLite(':memory:', 't', { 'a b': 'TEXT' }), /Invalid identifier/);
    });
});

describe('create', () => {
    test('回傳遞增 id', () => {
        const a = Number(s.create(base()));
        const b = Number(s.create(base()));
        assert.equal(b, a + 1);
    });
    test('缺少必填欄位', () => {
        assert.throws(() => s.create({ type: 'Forensics' }), /questionName is required/);
        assert.throws(() => s.create({ questionName: 'x' }), /type is required/);
    });
    test('必填欄位為 null 或空白', () => {
        assert.throws(() => s.create(base({ questionName: null })), /questionName is required/);
        assert.throws(() => s.create(base({ questionName: '   ' })), /questionName is required/);
    });
    test('tags 預設為 []', () => {
        const id = s.create(base());
        assert.deepEqual(s.getById(id).tags, []);
    });
    test('tags: null 視為未提供', () => {
        const id = s.create(base({ tags: null }));
        assert.deepEqual(s.getById(id).tags, []);
    });
    test('未知欄位被忽略', () => {
        const id = s.create(base({ foo: 1 }));
        assert.equal('foo' in s.getById(id), false);
    });
    test('傳入的 id 仍會被寫入 (記錄現況)', () => {
        const id = s.create(base({ id: 99 }));
        assert.equal(Number(id), 99);
    });
});

describe('列舉驗證', () => {
    test('大小寫不分並以小寫儲存', () => {
        const id = s.create(base({ type: 'WebExploitation', difficulty: 'HARD' }));
        const r = s.getById(id);
        assert.equal(r.type, 'webexploitation');
        assert.equal(r.difficulty, 'hard');
    });
    test('所有列舉值皆可寫入', () => {
        for (const t of Object.values(Type)) s.create(base({ type: t }));
        for (const d of Object.values(Difficulty)) s.create(base({ difficulty: d }));
        assert.equal(s.count(), Object.keys(Type).length + Object.keys(Difficulty).length);
    });
    test('非法 type / difficulty', () => {
        assert.throws(() => s.create(base({ type: 'nope' })), /type must be one of/);
        assert.throws(() => s.create(base({ difficulty: 'nope' })), /difficulty must be one of/);
    });
    test('difficulty 可為 null', () => {
        const id = s.create(base({ difficulty: null }));
        assert.equal(s.getById(id).difficulty, null);
    });
});

describe('tags', () => {
    test('非陣列丟出錯誤', () => {
        assert.throws(() => s.create(base({ tags: 'abc' })), /tags must be an array/);
    });
    test('往返 (含中文與特殊字元)', () => {
        const tags = ['陣列', 'a"b', "it's", 'x,y'];
        const id = s.create(base({ tags }));
        assert.deepEqual(s.getById(id).tags, tags);
    });
});

describe('getById', () => {
    test('找不到回傳 undefined', () => {
        assert.equal(s.getById(12345), undefined);
    });
});

describe('find / getAll / count', () => {
    beforeEach(() => {
        s.createMany([
            base({ questionName: 'A', type: 'WebExploitation', difficulty: 'Easy', tags: ['sql', 'web'] }),
            base({ questionName: 'B', type: 'WebExploitation', difficulty: 'Hard', tags: ['xss'] }),
            base({ questionName: 'C', type: 'Forensics', difficulty: 'Easy', tags: ['SQL'] }),
        ]);
    });
    test('getAll', () => assert.equal(s.getAll().length, 3));
    test('type 篩選大小寫不分', () => {
        assert.equal(s.find({ type: 'WEBEXPLOITATION' }).length, 2);
    });
    test('difficulty 篩選', () => {
        assert.equal(s.find({ difficulty: 'EASY' }).length, 2);
    });
    test('tag 篩選區分大小寫', () => {
        assert.deepEqual(s.find({ tag: 'sql' }).map((r) => r.questionName), ['A']);
        assert.deepEqual(s.find({ tag: 'SQL' }).map((r) => r.questionName), ['C']);
    });
    test('組合條件為 AND', () => {
        assert.deepEqual(
            s.find({ type: 'WebExploitation', difficulty: 'Easy', tag: 'sql' }).map((r) => r.questionName),
            ['A']
        );
    });
    test('orderBy + desc', () => {
        assert.deepEqual(s.getAll({ orderBy: 'id', desc: true }).map((r) => r.questionName), ['C', 'B', 'A']);
    });
    test('limit + offset', () => {
        assert.deepEqual(s.getAll({ orderBy: 'id', limit: 1, offset: 1 }).map((r) => r.questionName), ['B']);
    });
    test('非法 orderBy', () => {
        assert.throws(() => s.getAll({ orderBy: 'id; DROP TABLE record' }), /Invalid identifier/);
    });
    test('count', () => {
        assert.equal(s.count(), 3);
        assert.equal(s.count({ type: 'forensics' }), 1);
        assert.equal(s.count({ tag: 'xss' }), 1);
    });
});

describe('findBetween', () => {
    beforeEach(() => {
        for (const t of ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z']) {
            s.create(base({ time: t, questionName: t }));
        }
    });
    test('含頭尾', () => {
        const r = s.findBetween('time', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z');
        assert.equal(r.length, 2);
    });
    test('只給 from / 只給 to', () => {
        assert.equal(s.findBetween('time', '2026-02-01T00:00:00Z').length, 2);
        assert.equal(s.findBetween('time', undefined, '2026-02-01T00:00:00Z').length, 2);
    });
    test('desc 排序', () => {
        const r = s.findBetween('time', undefined, undefined, { desc: true });
        assert.equal(r[0].time, '2026-03-01T00:00:00Z');
    });
    test('未知欄位', () => {
        assert.throws(() => s.findBetween('nope', 1, 2), /Unknown column/);
    });
});

describe('update', () => {
    let id;
    beforeEach(() => { id = s.create(base({ difficulty: 'Easy', tags: ['a'] })); });
    test('部分更新並回傳筆數', () => {
        assert.equal(s.update(id, { difficulty: 'Hard' }), 1);
        const r = s.getById(id);
        assert.equal(r.difficulty, 'hard');
        assert.equal(r.questionName, 'Two Sum');
    });
    test('tags 整個取代', () => {
        s.update(id, { tags: ['x', 'y'] });
        assert.deepEqual(s.getById(id).tags, ['x', 'y']);
    });
    test('id 不存在回傳 0', () => assert.equal(s.update(9999, { difficulty: 'Hard' }), 0));
    test('id 不可被修改', () => {
        s.update(id, { id: 500, difficulty: 'Hard' });
        assert.ok(s.getById(id));
        assert.equal(s.getById(500), undefined);
    });
    test('空資料回傳 0', () => assert.equal(s.update(id, {}), 0));
    test('非法列舉值', () => {
        assert.throws(() => s.update(id, { type: 'nope' }), /type must be one of/);
    });
    test('type: null 會失敗', () => {
        assert.throws(() => s.update(id, { type: null }));
    });
});

describe('delete / deleteWhere / deleteMany', () => {
    beforeEach(() => {
        s.createMany([
            base({ type: 'Forensics' }),
            base({ type: 'Forensics' }),
            base({ type: 'Blockchain' }),
        ]);
    });
    test('delete 單筆', () => {
        const id = s.getAll()[0].id;
        assert.equal(s.delete(id), 1);
        assert.equal(s.delete(id), 0);
    });
    test('deleteWhere 無條件丟出錯誤', () => {
        assert.throws(() => s.deleteWhere({}), /requires at least one condition/);
        assert.equal(s.count(), 3);
    });
    test('deleteWhere 以小寫值刪除', () => {
        assert.equal(s.deleteWhere({ type: 'forensics' }), 2);
    });
    test('deleteWhere 列舉值大小寫不分', () => {
        assert.equal(s.deleteWhere({ type: 'Forensics' }), 2);
    });
    test('deleteWhere 支援 tag', () => {
        s.create(base({ tags: ['zzz'] }));
        assert.equal(s.deleteWhere({ tag: 'zzz' }), 1);
        assert.equal(s.count(), 3);
    });
    test('deleteWhere 只有 JSON 欄位或未知欄位時丟出錯誤', () => {
        assert.throws(() => s.deleteWhere({ tags: ['a'] }), /requires at least one condition/);
        assert.throws(() => s.deleteWhere({ foo: 1 }), /requires at least one condition/);
        assert.equal(s.count(), 3);
    });
    test('deleteMany 略過不存在的 id', () => {
        const ids = s.getAll().map((r) => r.id);
        assert.equal(s.deleteMany([ids[0], ids[1], 9999]), 2);
        assert.equal(s.count(), 1);
    });
});

describe('createMany', () => {
    test('全部成功', () => {
        const ids = s.createMany([base(), base()]);
        assert.equal(ids.length, 2);
        assert.equal(s.count(), 2);
    });
    test('其中一筆失敗時整批回滾', () => {
        assert.throws(() => s.createMany([base(), base({ type: 'bad' })]));
        assert.equal(s.count(), 0);
    });
});

describe('SQL injection', () => {
    test('值被原樣儲存、資料表仍在', () => {
        const evil = "'; DROP TABLE record;--";
        const id = s.create(base({ questionName: evil, tags: [evil] }));
        assert.equal(s.getById(id).questionName, evil);
        assert.equal(s.find({ tag: evil }).length, 1);
        assert.equal(s.count(), 1);
    });
});

describe('format.js', () => {
    test('Difficulty / Type 與文件一致', () => {
        assert.deepEqual(Object.values(Difficulty), ['Easy', 'Medium', 'Hard']);
        assert.deepEqual(Object.values(Type), [
            'WebExploitation', 'ReverseEngineering', 'Forensics', 'BinaryExploitation',
            'Cryptography', 'GeneralSkills', 'ArtificialIntelligence', 'Blockchain',
        ]);
    });
});
