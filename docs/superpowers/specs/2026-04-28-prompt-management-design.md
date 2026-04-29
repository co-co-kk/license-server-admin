# Prompt Management Feature Design

**Date:** 2026-04-28
**Status:** Approved (user confirmed in prior session)

## Overview

Add a prompt management system to the license-server-admin project. This feature collects user prompts and summary reports from external clients, stores them with token usage metrics, and provides an admin UI for reviewing, editing, and managing the records.

---

## 1. Database Schema

### New table: `prompt_records`

```sql
CREATE TABLE IF NOT EXISTS prompt_records (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key         TEXT    NOT NULL,
    machine_code        TEXT    NOT NULL,
    prompt_content      TEXT    NOT NULL,
    report_content      TEXT    NOT NULL,
    input_tokens        INTEGER NOT NULL DEFAULT 0,
    output_tokens       INTEGER NOT NULL DEFAULT 0,
    status              TEXT    NOT NULL DEFAULT 'pending',
    admin_notes         TEXT,
    created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at          DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (license_key) REFERENCES license_keys(key)
);

CREATE INDEX IF NOT EXISTS idx_prompt_records_license ON prompt_records(license_key);
CREATE INDEX IF NOT EXISTS idx_prompt_records_status ON prompt_records(status);
CREATE INDEX IF NOT EXISTS idx_prompt_records_created ON prompt_records(created_at);
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER PK | Auto-increment primary key |
| `license_key` | TEXT NOT NULL | Foreign key referencing `license_keys.key` |
| `machine_code` | TEXT NOT NULL | Client device identifier |
| `prompt_content` | TEXT NOT NULL | User's submitted prompt text |
| `report_content` | TEXT NOT NULL | User's submitted summary report |
| `input_tokens` | INTEGER | Input token count (default 0) |
| `output_tokens` | INTEGER | Output token count (default 0) |
| `status` | TEXT | `pending`, `reviewed`, `archived` |
| `admin_notes` | TEXT | Admin review notes (nullable) |
| `created_at` | DATETIME | Record creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

### Migration

Add table creation and indexes in `server/db.ts` `initDb()` function.

---

## 2. API Endpoints

### External Collection API (Client-facing)

```
POST /api/v1/submit-prompt
Rate-limited: yes (uses existing rateLimit middleware)

Request body:
{
  "prompt": "string (required)",
  "report": "string (required)",
  "machine_code": "string (required)",
  "license_key": "string (required)",
  "input_tokens": "number (optional, default 0)",
  "output_tokens": "number (optional, default 0)"
}

Success (200):
{ "code": 0, "message": "提示词已收录" }

Error - missing fields (400):
{ "code": 4000, "message": "缺少必填参数" }

Error - license not found (404):
{ "code": 4004, "message": "卡密不存在" }
```

### Admin APIs

#### List with pagination
```
GET /api/admin/prompts?page=1&pageSize=20&status=pending&search=keyword

Response:
{
  "code": 0,
  "data": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "list": [
      {
        "id": 1,
        "license_key": "XXXX-XXXX-XXXX-XXXX",
        "machine_code": "HW-ABC-123",
        "prompt_content": "...",
        "report_content": "...",
        "input_tokens": 1500,
        "output_tokens": 800,
        "status": "pending",
        "admin_notes": null,
        "created_at": "2026-04-28 10:00:00",
        "updated_at": "2026-04-28 10:00:00"
      }
    ]
  }
}
```

#### Get single record
```
GET /api/admin/prompts/:id

Response: { code: 0, data: { ...record } }
```

#### Update record (status, notes)
```
PUT /api/admin/prompts/:id

Request body:
{
  "status": "reviewed | archived",
  "admin_notes": "string (optional)"
}

Response: { code: 0, message: "已更新" }
```

#### Delete record
```
DELETE /api/admin/prompts/:id

Response: { code: 0, message: "已删除" }
```

#### Stats
```
GET /api/admin/prompts/stats

Response:
{
  "code": 0,
  "data": {
    "pending": 15,
    "reviewed": 30,
    "archived": 5,
    "total": 50
  }
}
```

---

## 3. Frontend UI — "提示词管理" Tab

### Navigation

New sidebar item "提示词管理" (Prompt Management) between "授权列表" and system status widget. Icon: `MessageSquareText` from lucide-react.

### Page Layout

**Header section:**
- Title: "提示词管理"
- Subtitle: "收录和审查用户提交的提示词与总结报告"

**Stats row (4 cards):**
- 总收录 (Total)
- 待处理 (Pending) — accent color
- 已审阅 (Reviewed)
- 已归档 (Archived)

**Filter bar:**
- Status tabs: 全部 / 待处理 / 已审阅 / 已归档
- Keyword search input (searches prompt_content)

**Data table:**
Columns:
- Prompt preview (truncated to 60 chars)
- License key
- Machine code
- Tokens (input/output)
- Status badge
- Created time
- Actions (view/edit/delete)

**Detail/Edit modal:**
- Full prompt content (read-only textarea)
- Full report content (read-only textarea)
- Token usage display (input/output with total)
- Status dropdown selector
- Admin notes textarea
- Save and Delete buttons

### State management

All in-component `useState` following existing App.tsx patterns:
- `promptRecords` list
- `promptStats` object
- `promptPage`, `promptSearch`, `promptStatusFilter`
- `detailPrompt` for modal
- `loading` state

---

## 4. File Changes

| File | Change |
|------|--------|
| `server/db.ts` | Add `prompt_records` table + indexes in `initDb()` |
| `server.ts` | Add 5 new API route handlers |
| `src/App.tsx` | Add new tab, sidebar button, and all UI components |

---

## 5. Error Handling

- External API: validate all required fields present, verify license key exists
- Admin API: handle not-found cases with 404
- Frontend: try/catch on all fetch calls, display error alerts
