const express = require('express');
const path = require('path');
const SQLite = require('./sqlite/sqlite');
const createRecordRouter = require('./API/record');

const app = express();
const PORT = 3000;

// 解析 JSON 格式的請求本文
app.use(express.json());

// 建立資料庫並注入 API (依賴反轉)
const recordStore = new SQLite(path.join(__dirname, 'data.db'));
app.use('/api/records', createRecordRouter(recordStore));

// 建立 GET API
app.get('/api/hello', (req, res) => {
    res.json({
        message: 'Hello from Node.js API'
    });
});

// JSON 格式錯誤等請求錯誤處理
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
});

// 啟動伺服器
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on port ${PORT}`);
});

// 結束時關閉資料庫
process.on('SIGINT', () => {
    server.close(() => {
        recordStore.close();
        process.exit(0);
    });
});
