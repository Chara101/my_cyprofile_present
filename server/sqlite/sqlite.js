const Database = require('better-sqlite3');

// 解題記錄格式 (對應 format.js)
const RECORD_COLUMNS = {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT', //記錄ID
    questionName: 'TEXT NOT NULL', //題目名稱
    time: 'TEXT', //記錄時間
    difficulty: 'TEXT', //難度
    link: 'TEXT' //題目連結
};

class SQLite {
    /**
     * @param {string} dbPath 資料庫路徑，預設為記憶體資料庫
     * @param {string} table 資料表名稱
     * @param {object} columns 欄位定義 { 欄位名: 'SQL型別' }，預設為解題記錄格式
     */
    constructor(dbPath = ':memory:', table = 'record', columns = RECORD_COLUMNS) {
        this._assertIdentifier(table);
        Object.keys(columns).forEach((c) => this._assertIdentifier(c));
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

    // 建立資料表
    createTable() {
        const defs = Object.entries(this.columns)
            .map(([name, type]) => `${name} ${type}`)
            .join(', ');
        this.db.exec(`CREATE TABLE IF NOT EXISTS ${this.table} (${defs})`);
    }

    // 新增一筆，回傳新增資料的 id
    create(data) {
        const row = this._pick(data);
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
        return this.db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
    }

    // 條件查詢 (等值條件)，options: { orderBy, desc, limit, offset }
    find(where = {}, options = {}) {
        const cond = this._pick(where);
        const keys = Object.keys(cond);
        let sql = `SELECT * FROM ${this.table}`;
        if (keys.length) sql += ' WHERE ' + keys.map((k) => `${k} = @${k}`).join(' AND ');
        if (options.orderBy) {
            this._assertIdentifier(options.orderBy);
            sql += ` ORDER BY ${options.orderBy} ${options.desc ? 'DESC' : 'ASC'}`;
        }
        const params = { ...cond };
        if (options.limit !== undefined) {
            sql += ' LIMIT @_limit';
            params._limit = Number(options.limit);
            if (options.offset !== undefined) {
                sql += ' OFFSET @_offset';
                params._offset = Number(options.offset);
            }
        }
        return this.db.prepare(sql).all(params);
    }

    // 查詢全部
    getAll(options = {}) {
        return this.find({}, options);
    }

    // 依 id 更新，回傳受影響筆數
    update(id, data) {
        const row = this._pick(data);
        delete row.id;
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
        const cond = this._pick(where);
        const keys = Object.keys(cond);
        if (!keys.length) throw new Error('deleteWhere requires at least one condition');
        const sql = `DELETE FROM ${this.table} WHERE ${keys.map((k) => `${k} = @${k}`).join(' AND ')}`;
        return this.db.prepare(sql).run(cond).changes;
    }

    // 計數
    count(where = {}) {
        const cond = this._pick(where);
        const keys = Object.keys(cond);
        let sql = `SELECT COUNT(*) AS n FROM ${this.table}`;
        if (keys.length) sql += ' WHERE ' + keys.map((k) => `${k} = @${k}`).join(' AND ');
        return this.db.prepare(sql).get(cond).n;
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
        return this.db.prepare(sql).all(params);
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
