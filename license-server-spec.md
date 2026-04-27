# 卡密验证服务端方案

> 本文档描述卡密验证服务端（license-server）的完整设计，供在独立项目中实现。
> 技术栈：React（前端管理页面）+ Node/Express（后端 API）+ SQLite（数据库）

---

## 1. 系统概述

### 1.1 目标

为 chatlog_alpha 客户端提供远程卡密验证服务，实现：

- 卡密有效性校验
- **一次性消费** — 一个卡密只能绑定一台机器，消费后不可换机
- **永久有效** — 无时间限制，绑定后永久可用
- 机器绑定 — 消费后仅限绑定机器使用
- 防篡改缓存签名
- **管理页面** — 卡密生成、查询、列表、撤销、解绑等操作全部通过 Web 管理页面完成，无需登录

### 1.2 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 后端 | Node.js + Express | 轻量、易开发 |
| 前端 | React + Vite | SPA 管理页面 |
| UI 组件 | Ant Design 或 shadcn/ui | 快速搭建管理界面 |
| 数据库 | better-sqlite3 | 同步 SQLite，单进程高性能 |
| 签名 | HMAC-SHA256 | 服务端持有密钥，客户端仅存储 |
| 部署 | 前后端同进程或 Nginx 反代 | 单台小服务器即可 |

### 1.3 整体架构

```
                    +---------------------------+
                    |  license-server :8080     |
  chatlog_alpha     |                           |
  (客户端) -------->  |  POST /api/v1/verify      |  ← 验证 API
                     |  GET  /health             |  ← 健康检查
                     |                           |
                     |  React SPA (管理页面)      |  ← 浏览器访问
                     |  /admin                   |
                     |    - 卡密生成              |
                     |    - 卡密列表/搜索         |
                     |    - 撤销/解绑             |
                     |    - 统计概览              |
                     |                           |
                     |  SQLite DB                |
                     |  - license_keys            |
                     |  - consumptions            |
                     +---------------------------+
```

---

## 2. 数据库设计

### 2.1 `license_keys` — 卡密主表

```sql
CREATE TABLE IF NOT EXISTS license_keys (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    key             TEXT    NOT NULL UNIQUE,
    status          TEXT    NOT NULL DEFAULT 'active',
    generated_by    TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at         DATETIME,
    revoked_at      DATETIME
);

CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| key | TEXT | 卡密字符串，如 `K7H3-MQ2R-9FXT-4BNW` |
| status | TEXT | active / used / revoked |
| generated_by | TEXT | 生成批次标识（可选） |
| created_at | DATETIME | 创建时间 |
| used_at | DATETIME | 首次消费时间 |
| revoked_at | DATETIME | 撤销时间 |

> 所有卡密均为永久有效，无时间/过期相关字段。

### 2.2 `license_consumptions` — 消费记录表

```sql
CREATE TABLE IF NOT EXISTS license_consumptions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id              INTEGER NOT NULL,
    machine_fingerprint TEXT    NOT NULL UNIQUE,
    consumed_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consumptions_key_id ON license_consumptions(key_id);
CREATE INDEX IF NOT EXISTS idx_consumptions_fingerprint ON license_consumptions(machine_fingerprint);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| key_id | INTEGER | 关联 license_keys.id |
| machine_fingerprint | TEXT | 客户端机器指纹（UNIQUE） |
| consumed_at | DATETIME | 消费时间 |

> 永久有效，无续期、无过期概念。一台机器一条记录。

---

## 3. 后端 API 设计

### 3.1 客户端验证 — `POST /api/v1/verify`

**请求体：**
```json
{
    "key": "A1B2-C3D4-E5F6-G7H8",
    "machine_fingerprint": "sha256:xxxx...",
    "app_version": "1.0.0",
    "platform": "windows"
}
```

#### 首次消费（成功）

```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "action": "consumed",
        "license_key": "A1B2-C3D4-E5F6-G7H8",
        "type": "permanent",
        "signature": "hmac-sha256-base64-encoded-token"
    }
}
```

#### 已消费，同机器（成功）

```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "action": "verified",
        "license_key": "A1B2-C3D4-E5F6-G7H8",
        "type": "permanent",
        "signature": "hmac-sha256-base64-encoded-token"
    }
}
```

#### 错误响应

| 场景 | code | message |
|------|------|---------|
| 卡密不存在 | 4004 | "卡密不存在或已失效" |
| 已被其他设备使用 | 4001 | "该卡密已被其他设备绑定，无法重复使用" |
| 已被撤销 | 4005 | "该卡密已被撤销" |

### 3.2 健康检查 — `GET /health`

```json
{
    "status": "ok",
    "timestamp": "2026-04-27T20:00:00Z"
}
```

### 3.3 管理端 API（内部调用，由前端 SPA 使用）

无需登录认证，管理页面直接调用：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/generate` | 批量生成卡密 |
| GET | `/api/admin/licenses` | 卡密列表（分页/过滤） |
| GET | `/api/admin/licenses/:id` | 卡密详情 |
| GET | `/api/admin/stats` | 统计概览 |
| POST | `/api/admin/licenses/:id/revoke` | 撤销卡密 |
| POST | `/api/admin/licenses/:id/unbind` | 解绑机器 |

#### `POST /api/admin/generate`

**请求：**
```json
{
    "count": 100,
    "batch": "20260427-001"
}
```

**响应：**
```json
{
    "code": 0,
    "data": {
        "keys": ["K7H3-MQ2R-9FXT-4BNW", "XXXX-XXXX-XXXX-XXXX", ...],
        "count": 100,
        "batch": "20260427-001"
    }
}
```

#### `GET /api/admin/licenses`

**查询参数：**
- `page` — 页码（默认 1）
- `pageSize` — 每页条数（默认 20）
- `status` — 过滤：active / used / revoked / all
- `search` — 按卡密关键词搜索

**响应：**
```json
{
    "code": 0,
    "data": {
        "total": 500,
        "page": 1,
        "pageSize": 20,
        "list": [
            {
                "id": 1,
                "key": "K7H3-MQ2R-9FXT-4BNW",
                "status": "used",
                "created_at": "2026-04-27T10:00:00Z",
                "used_at": "2026-04-27T12:30:00Z",
                "machine_fingerprint": "sha256:xxxx..."
            }
        ]
    }
}
```

#### `GET /api/admin/stats`

**响应：**
```json
{
    "code": 0,
    "data": {
        "total": 500,
        "active": 200,
        "used": 280,
        "revoked": 20,
        "today_consumed": 15
    }
}
```

#### `POST /api/admin/licenses/:id/revoke`

**响应：**
```json
{ "code": 0, "message": "已撤销" }
```

#### `POST /api/admin/licenses/:id/unbind`

**响应：**
```json
{ "code": 0, "message": "已解绑" }
```

---

## 4. 签名方案

### 4.1 HMAC-SHA256 Token

**签名载荷：**
```json
{
    "key": "A1B2-C3D4-E5F6-G7H8",
    "machine_fingerprint": "sha256:xxxx",
    "type": "permanent",
    "issued_at": "2026-04-27T20:00:00Z"
}
```

**算法（Node.js）：**
```js
const crypto = require('crypto');

function sign(payload, secret) {
    const json = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(json);
    return hmac.digest('base64');
}
```

- `secret`：服务端环境变量 `HMAC_SECRET`，32 字节随机字符串
- 客户端收到 `{payload + signature}` 后原样存储到本地

### 4.2 防篡改策略

1. **服务端校验** — 再次验证时核对 machine_fingerprint 是否匹配
2. **本地简单防护** — 客户端存储时将 `{payload + signature}` 一起写入，用户伪造需破解 HMAC

---

## 5. 核心验证逻辑

```
收到 POST /api/v1/verify {key, fingerprint}
    |
    +-- 查询 license_keys WHERE key = ?
    |
    +-- 不存在 --> 4004 "卡密不存在"
    |
    +-- status = 'revoked' --> 4005 "卡密已被撤销"
    |
    +-- status = 'active' (未消费)
    |   +-- 创建 consumption 记录 (key_id, fingerprint, consumed_at)
    |   +-- 更新 license_keys: status='used', used_at=NOW()
    |   +-- 生成 HMAC signature
    |   +-- 返回 200 {action: "consumed", type: "permanent", signature}
    |
    +-- status = 'used' (已消费)
        +-- 查询 consumption WHERE key_id = ?
        |
        +-- fingerprint != 请求指纹 --> 4001 "已被其他设备绑定"
        |
        +-- 匹配
            +-- 生成新 HMAC signature
            +-- 返回 200 {action: "verified", type: "permanent", signature}
```

---

## 6. 卡密生成算法

### 6.1 格式

```
XXXX-XXXX-XXXX-XXXX
```

使用 base32 字符集（去掉易混淆字符 0/1/I/O）：

```
可用字符: 23456789ABCDEFGHJKLMNPQRSTUVWXYZ
32 个字符，每段 4 字符，共 4 段，16 字符 + 3 个分隔符
```

### 6.2 核心原则

**不靠随机性防重复，靠数据库唯一约束 + 重试兜底。**

`crypto.randomInt` 生成的随机值在 2^80 空间内碰撞概率极低，但"极低"不等于"不会"。实际生产环境必须做到：

1. **数据库 UNIQUE 约束兜底** — `license_keys.key` 列有 UNIQUE 索引，即使代码生成了重复值，SQLite 会直接拒绝 INSERT
2. **批量生成时用 Set 去重** — 内存中去重后再批量 INSERT
3. **支持导入外部生成的卡密** — 比如从 Excel/CSV 导入第三方平台生成的卡密

### 6.3 服务端生成代码（`server/services/generator.js`）

```js
const crypto = require('crypto');
const db = require('../db');

const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHARSET_LEN = CHARSET.length; // 32

function randomSegment() {
    let part = '';
    for (let i = 0; i < 4; i++) {
        part += CHARSET[crypto.randomInt(0, CHARSET_LEN)];
    }
    return part;
}

function generateOne() {
    return `${randomSegment()}-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

/**
 * 批量生成卡密并写入数据库
 * @param {number} count - 生成数量
 * @param {string} batch - 批次标识（可选）
 * @returns {string[]} 生成的卡密列表
 */
function generateBatch(count, batch = '') {
    const generated = new Set();
    const insertStmt = db.prepare(
        'INSERT OR IGNORE INTO license_keys (key, generated_by) VALUES (?, ?)'
    );

    const maxAttempts = count * 10; // 防死循环安全阀
    let attempts = 0;

    const insertMany = db.transaction((keys) => {
        for (const key of keys) {
            insertStmt.run(key, batch);
        }
    });

    while (generated.size < count && attempts < maxAttempts) {
        generated.add(generateOne());
        attempts++;
    }

    if (generated.size < count) {
        throw new Error(
            `生成失败：尝试 ${maxAttempts} 次后仍不足 ${count} 个，` +
            `可能字符池过小或已有大量重复`
        );
    }

    const keys = Array.from(generated);
    insertMany(keys);

    return keys;
}

/**
 * 从外部列表导入卡密（支持 CSV/Excel 导入后调用）
 * @param {string[]} keys - 外部卡密列表
 * @param {string} batch - 批次标识
 * @returns {{ imported: number, skipped: number }}
 */
function importKeys(keys, batch = '') {
    const insertStmt = db.prepare(
        'INSERT OR IGNORE INTO license_keys (key, generated_by) VALUES (?, ?)'
    );

    let imported = 0;
    let skipped = 0;

    const importMany = db.transaction((items) => {
        for (const key of items) {
            const result = insertStmt.run(key, batch);
            if (result.changes > 0) {
                imported++;
            } else {
                skipped++; // UNIQUE 冲突，已存在
            }
        }
    });

    importMany(keys);
    return { imported, skipped };
}

module.exports = { generateBatch, importKeys, generateOne };
```

### 6.4 关键设计说明

| 设计 | 原因 |
|------|------|
| `INSERT OR IGNORE` | 随机碰撞时 SQLite 自动跳过，不会报错中断 |
| 事务批量写入 | 100 个卡密一次事务，要么全成功要么全回滚 |
| `maxAttempts` 安全阀 | 防止极端情况下 while 死循环 |
| `importKeys` 函数 | 支持从第三方系统导入卡密，不局限于程序生成 |
| 返回 `{imported, skipped}` | 导入时明确知道多少成功、多少已存在 |

### 6.5 碰撞概率分析

| 场景 | 碰撞概率 |
|------|----------|
| 生成 1 万个卡密 | ~10^-17（远低于硬件故障率） |
| 生成 100 万个卡密 | ~10^-13 |
| 生成 10 亿个卡密 | ~10^-7 |

2^80 空间下即使生成 10 亿个卡密，碰撞概率仍远低于磁盘坏道概率。**真正的风险不是碰撞，而是代码 bug 或数据库未加 UNIQUE 约束。** 所以唯一索引是必须的，不是可选的。

### 6.6 管理页面生成流程

```
用户在管理页面输入：数量 100，批次 "20260427-001"
    → 前端 POST /api/admin/generate {count: 100, batch: "20260427-001"}
    → 后端 generateBatch(100, "20260427-001")
    → 数据库 INSERT OR IGNORE（事务）
    → 返回生成的 100 个卡密列表
    → 前端展示表格 + 一键复制 + 导出 CSV
```

---

## 7. 项目结构

```
license-server/
+-- package.json
+-- .env.example
+-- server/
|   +-- index.js                 # Express 入口
|   +-- config.js                # 配置加载（端口、HMAC密钥、数据库路径）
|   +-- db.js                    # SQLite 初始化 + 迁移
|   +-- routes/
|   |   +-- api.js               # 客户端验证 API
|   |   +-- admin.js             # 管理端 API
|   +-- services/
|   |   +-- license.js           # 核心验证逻辑
|   |   +-- generator.js         # 卡密生成
|   |   +-- signature.js         # HMAC 签名
|   +-- middleware/
|       +-- rateLimit.js         # 验证接口限流
+-- admin/                       # React 前端（Vite）
|   +-- package.json
|   +-- vite.config.js
|   +-- index.html
|   +-- src/
|       +-- main.jsx
|       +-- App.jsx
|       +-- pages/
|       |   +-- Dashboard.jsx    # 统计概览
|       |   +-- Generate.jsx     # 批量生成
|       |   +-- List.jsx         # 卡密列表
|       |   +-- Detail.jsx       # 卡密详情
|       +-- components/
|       |   +-- StatsCards.jsx   # 概览卡片
|       |   +-- KeyTable.jsx     # 卡密表格
|       |   +-- GenerateForm.jsx # 生成表单
|       |   +-- ActionMenu.jsx   # 操作菜单
|       +-- api.js               # API 请求封装
|       +-- utils.js             # 工具函数
+-- data/                        # SQLite 数据库目录
|   +-- license.db               # 运行时生成
+-- Dockerfile                   # 容器化部署（可选）
+-- nginx.conf                   # Nginx 配置（可选）
```

---

## 8. 配置项

通过环境变量或 `.env` 文件：

```bash
# 服务监听地址
PORT=8080

# HMAC 签名密钥（32字节，务必保密）
HMAC_SECRET=your-32-byte-secret-key-here

# SQLite 数据库路径
DB_PATH=./data/license.db

# 日志级别
LOG_LEVEL=info

# HTTPS（生产环境必须）
TLS_CERT=
TLS_KEY=
```

---

## 9. 管理页面设计

### 9.1 页面布局

```
+------------------------------------------+
|  License Server Admin                    |
+------------------+-----------------------+
|  Sidebar         |  Content             |
|                  |                       |
|  [概览]          |  统计卡片行            |
|  [生成卡密]      |  +----+ +----+ +----+  |
|  [卡密列表]      |  |总计| |可用| |已用|  |
|                  |  +----+ +----+ +----+  |
|                  |                       |
|                  |  最近使用记录表格       |
|                  |  +------------------+  |
|                  |  | 卡密  | 状态 | 时间 | |
|                  |  +------------------+  |
+------------------+-----------------------+
```

### 9.2 概览页（Dashboard）

- 统计卡片：总卡密数、可用数、已用数、已撤销数、今日消费数
- 最近使用记录表格（最近 20 条）
- 消费趋势折线图（可选）

### 9.3 生成卡密页（Generate）

- 输入框：生成数量（默认 10）
- 输入框：批次标识（可选，自动填充日期+序号）
- 生成按钮
- 生成结果展示：表格 + 一键复制 + 导出 CSV

### 9.4 卡密列表页（List）

- 状态筛选：全部 / 可用 / 已用 / 已撤销
- 搜索框：按卡密关键词搜索
- 分页表格
- 操作列：查看详情、撤销、解绑

### 9.5 卡密详情页（Detail）

- 卡密基本信息：卡密、状态、创建时间、消费时间
- 绑定机器指纹
- 操作按钮：撤销 / 解绑

---

## 10. 安全要求

### 10.1 必须项

1. **HTTPS 部署** — 卡密和机器指纹传输必须 TLS 加密
2. **HMAC 密钥保密** — 存服务端环境变量，绝不返回客户端
3. **速率限制** — `/api/v1/verify` 接口 IP 级别限流（建议 10 req/min）
4. **输入校验** — 卡密格式、指纹长度严格校验
5. **管理页面无登录** — 按需求无需登录，建议生产环境通过 Nginx Basic Auth 或内网访问限制

### 10.2 建议项

1. **审计日志** — 记录所有 verify 请求到独立日志文件
2. **异常告警** — 同一 IP 大量不同指纹、同一指纹尝试多个不同卡密
3. **定期备份** — SQLite 数据库定时备份（cron + cp 或 sqlite3 .dump）
4. **SQLCipher 加密** — 数据库文件加密存储（可选）

---

## 11. 客户端交互协议摘要

### 11.1 首次验证

1. 用户输入卡密
2. 采集机器指纹
3. `POST /api/v1/verify` 发送 `{key, fingerprint, app_version, platform}`
4. 收到 `{type: "permanent", signature}` 写入本地缓存
5. 进入主程序

### 11.2 本地缓存检查

1. 读取本地缓存文件
2. 检查缓存是否存在
3. 存在 → 直接使用，无需联网
4. 不存在 → 要求输入卡密并重新验证

### 11.3 网络不可用处理

| 场景 | 行为 |
|------|------|
| 首次验证无网络 | 拒绝使用，提示需要联网验证 |
| 缓存有效但无网络 | 正常使用，不需要联网 |
| 缓存文件损坏 | 要求重新联网验证 |

---

## 12. 部署方案

### 12.1 最小部署（初期 < 1000 用户）

- 1核2G 云服务器
- Node.js + Express 直接运行，pm2 或 systemd 管理
- React 管理页面构建后由 Express 静态文件服务
- SQLite 单文件数据库
- Nginx 反向代理 + Let's Encrypt TLS

### 12.2 启动脚本示例

```bash
# 构建前端
cd admin && npm install && npm run build && cd ..

# 安装后端依赖
npm install

# 启动
NODE_ENV=production node server/index.js
```

### 12.3 Docker 部署（可选）

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY server/ ./server/
COPY admin/dist/ ./admin/dist/
EXPOSE 8080
CMD ["node", "server/index.js"]
```

初期单台小服务器足够，验证仅在首次绑定时需要联网，后续使用本地缓存，服务器压力极低。
