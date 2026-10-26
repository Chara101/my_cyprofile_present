const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { Difficulty, Type } = require('./format');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'db_source', 'data.db');

// 解題記錄格式 (對應 format.js)
const RECORD_COLUMNS = {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT', //記錄ID
    questionName: 'TEXT NOT NULL', //題目名稱
    time: 'TEXT', //記錄時間
    difficulty: 'TEXT', //難度
    type: 'TEXT NOT NULL', //題目類型
    tags: "TEXT DEFAULT '[]'", //題目標籤 (以 JSON 陣列字串儲存，對外為陣列)
    link: 'TEXT' //題目連結
};

// 這些欄位一律存成小寫，且值必須屬於 format.js 定義的列舉 (大小寫不分)
const ENUM_COLUMNS = {
    difficulty: Object.values(Difficulty).map((v) => v.toLowerCase()),
    type: Object.values(Type).map((v) => v.toLowerCase())
};

// 這些欄位以 JSON 字串儲存
const JSON_COLUMNS = ['tags'];

class SQLite {
    /**
     * @param {string} dbPath 資料庫路徑，預設為 server/db_source/data.db
     * @param {string} table 資料表名稱
     * @param {object} columns 欄位定義 { 欄位名: 'SQL型別' }，預設為解題記錄格式
     */
    constructor(dbPath = DEFAULT_DB_PATH, table = 'record', columns = RECORD_COLUMNS) {
        this._assertIdentifier(table);
        Object.keys(columns).forEach((c) => this._assertIdentifier(c));
        if (dbPath !== ':memory:') {
            fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        }
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.table = table;
        this.columns = columns;
        this.createTable();
    }

    _assertIdentifier(name) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            throw new Error(`Invalid identifier: ${name}`);
        }
    }

    // 只保留合法欄位
    _pick(data) {
        const result = {};
        for (const key of Object.keys(data || {})) {
            if (key in this.columns && data[key] !== undefined) result[key] = data[key];
        }
        return result;
    }

    // 必填欄位：定義含 NOT NULL，且不是主鍵、沒有 DEFAULT
    _required() {
        return Object.entries(this.columns)
            .filter(([, def]) => /NOT NULL/i.test(def) && !/PRIMARY KEY|DEFAULT/i.test(def))
            .map(([name]) => name);
    }

    // 寫入前轉換：列舉欄位驗證並轉小寫、JSON 欄位轉字串
    _serialize(row) {
        const result = { ...row };
        for (const [col, allowed] of Object.entries(ENUM_COLUMNS)) {
            if (!(col in result) || result[col] === null) continue; // 如果欄位不存在或為 null，則不驗證
            const v = typeof result[col] === 'string' ? result[col].toLowerCase() : result[col];
            if (!allowed.includes(v)) { // 確認值是否屬於列舉範圍
                throw new Error(`${col} must be one of: ${allowed.join(', ')}`);
            }
            result[col] = v;
        }
        for (const col of JSON_COLUMNS) {
            if (!(col in result) || result[col] === null) continue; // 如果欄位不存在或為 null，則不處理
            if (!Array.isArray(result[col])) throw new Error(`${col} must be an array`);
            result[col] = JSON.stringify(result[col]);
        }
        return result;
    }

    // 讀出後轉換：JSON 欄位還原為陣列
    _parse(row) {
        if (!row) return row;
        const result = { ...row };
        for (const col of JSON_COLUMNS) {
            if (typeof result[col] === 'string') result[col] = JSON.parse(result[col]);
        }
        return result;
    }

    // 組合等值查詢條件：列舉欄位轉小寫；tag 以 json_each 比對 tags 陣列；JSON 欄位不做等值比對
    _buildWhere(where) {
        const cond = this._pick(where);
        for (const col of JSON_COLUMNS) delete cond[col];
        for (const col of Object.keys(ENUM_COLUMNS)) {
            if (typeof cond[col] === 'string') cond[col] = cond[col].toLowerCase();
        }
        const clauses = Object.keys(cond).map((k) => `${k} = @${k}`);
        const params = { ...cond };
        if (where && where.tag !== undefined && 'tags' in this.columns) {
            clauses.push('EXISTS (SELECT 1 FROM json_each(tags) WHERE value = @_tag)');
            params._tag = where.tag;
        }
        return { clauses, params };
    }

    // 建立資料表
    createTable() {
        const defs = Object.entries(this.columns)
            .map(([name, type]) => `${name} ${type}`)
            .join(', ');
        this.db.exec(`CREATE TABLE IF NOT EXISTS ${this.table} (${defs})`);
    }

    // 新增一筆，回傳新增資料的 id
    create(data) {
        const picked = this._pick(data);
        // JSON 欄位傳 null 視為未提供，改用資料表預設值
        for (const col of JSON_COLUMNS) {
            if (picked[col] === null) delete picked[col];
        }
        // 必填欄位 (NOT NULL 且無預設值)：缺少、null 或空白字串都視為未填
        for (const col of this._required()) {
            const v = picked[col];
            if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
                throw new Error(`${col} is required`);
            }
        }
        const row = this._serialize(picked);
        const keys = Object.keys(row);
        const sql = keys.length
            ? `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${keys.map((k) => '@' + k).join(', ')})`
            : `INSERT INTO ${this.table} DEFAULT VALUES`;
        return this.db.prepare(sql).run(row).lastInsertRowid;
    }

    // 批次新增 (transaction)
    createMany(list) {
        const tx = this.db.transaction((items) => items.map((item) => this.create(item)));
        return tx(list);
    }

    // 依 id 查詢單筆
    getById(id) {
        return this._parse(this.db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id));
    }

    // 條件查詢 (等值條件，另支援 tag 過濾)，options: { orderBy, desc, limit, offset }
    find(where = {}, options = {}) {
        const { clauses, params } = this._buildWhere(where);
        let sql = `SELECT * FROM ${this.table}`;
        if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
        if (options.orderBy) {
            this._assertIdentifier(options.orderBy);
            sql += ` ORDER BY ${options.orderBy} ${options.desc ? 'DESC' : 'ASC'}`;
        }
        if (options.limit !== undefined) {
            sql += ' LIMIT @_limit';
            params._limit = Number(options.limit);
            if (options.offset !== undefined) {
                sql += ' OFFSET @_offset';
                params._offset = Number(options.offset);
            }
        }
        return this.db.prepare(sql).all(params).map((r) => this._parse(r));
    }

    // 查詢全部
    getAll(options = {}) {
        return this.find({}, options);
    }

    // 依 id 更新，回傳受影響筆數
    update(id, data) {
        const picked = this._pick(data);
        delete picked.id;
        const row = this._serialize(picked);
        const keys = Object.keys(row);
        if (!keys.length) return 0;
        const sql = `UPDATE ${this.table} SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @_id`;
        return this.db.prepare(sql).run({ ...row, _id: id }).changes;
    }

    // 依 id 刪除，回傳受影響筆數
    delete(id) {
        return this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id).changes;
    }

    // 條件刪除 (等值條件，不可為空以免誤刪全部)
    deleteWhere(where) {
        const { clauses, params } = this._buildWhere(where);
        if (!clauses.length) throw new Error('deleteWhere requires at least one condition');
        const sql = `DELETE FROM ${this.table} WHERE ${clauses.join(' AND ')}`;
        return this.db.prepare(sql).run(params).changes;
    }

    // 計數
    count(where = {}) {
        const { clauses, params } = this._buildWhere(where);
        let sql = `SELECT COUNT(*) AS n FROM ${this.table}`;
        if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
        return this.db.prepare(sql).get(params).n;
    }

    // 區間查詢 (含頭尾)，from / to 可只給其一
    findBetween(column, from, to, options = {}) {
        this._assertIdentifier(column);
        if (!(column in this.columns)) throw new Error(`Unknown column: ${column}`);
        const conds = [];
        const params = {};
        if (from !== undefined) { conds.push(`${column} >= @_from`); params._from = from; }
        if (to !== undefined) { conds.push(`${column} <= @_to`); params._to = to; }
        let sql = `SELECT * FROM ${this.table}`;
        if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
        sql += ` ORDER BY ${column} ${options.desc ? 'DESC' : 'ASC'}`;
        return this.db.prepare(sql).all(params).map((r) => this._parse(r));
    }

    // 批次刪除 (transaction)，回傳實際刪除筆數
    deleteMany(ids) {
        const stmt = this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`);
        const tx = this.db.transaction((list) => list.reduce((n, id) => n + stmt.run(id).changes, 0));
        return tx(ids);
    }

    // 關閉資料庫
    close() {
        this.db.close();
    }
}

module.exports = SQLite;
module.exports.RECORD_COLUMNS = RECORD_COLUMNS;
