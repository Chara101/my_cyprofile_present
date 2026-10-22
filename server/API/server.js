const express = require('express');

const app = express();
const PORT = 3000;

// 解析 JSON 格式的請求本文
app.use(express.json());

// 建立 GET API
app.get('/api/hello', (req, res) => {
    res.json({
        message: 'Hello from Node.js API'
    });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on port ${PORT}`);
});