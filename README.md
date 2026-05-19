# JobHunt OS

一站式求职管理工具 —— 从简历制作、投递追踪到面试日程，覆盖求职全流程。

## 功能模块

| 模块 | 说明 |
|------|------|
| **首页看板** | 投递总数、面试邀请率、Offer 率、平均响应天数等关键指标；阶段转化漏斗；渠道效果 & 简历效能排行 |
| **简历管理** | 在线简历编辑器（基本信息 / 学历 / 工作 / 项目 / 证书 & 技能）；工作经历支持实习标记；多版本简历管理；导出 A4 PDF |
| **投递看板** | 看板 + 列表双视图；自定义阶段列；多维度筛选（公司 / 阶段 / 状态 / 渠道 / 时间）；批量操作；跟进日志 |
| **日程看板** | 周视图 / 月视图；面试、笔试、Offer 事件管理；今日提醒；关联投递记录 |

## 技术栈

- **后端**：Python / FastAPI + SQLite
- **前端**：原生 HTML + CSS + JavaScript（SPA 架构）
- **图标**：Lucide Icons
- **PDF**：浏览器原生打印 + PDF.js

## 快速开始

**Windows** —— 双击 `start.bat`

**Linux / macOS**：

```bash
chmod +x start.sh && ./start.sh
```

**手动启动**：

```bash
pip install fastapi uvicorn pydantic python-multipart
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

浏览器打开 `http://localhost:8000`。

## 项目结构

```
jobhunt-os/
├── backend/
│   ├── main.py          # FastAPI 入口
│   ├── database.py      # SQLite 连接与读写
│   ├── models.py        # Pydantic 模型
│   └── routes/
│       └── api.py       # /api/save 和 /api/load
├── database/
│   └── schema.sql       # 数据库建表脚本
├── frontend/
│   ├── index.html       # SPA 入口
│   ├── css/
│   │   └── style.css    # 全局样式
│   └── js/
│       ├── app.js       # 初始化 & 路由
│       ├── state.js     # 全局状态 & 导航
│       ├── api.js       # 后端持久化
│       ├── home.js      # 首页看板
│       ├── resume.js    # 简历管理
│       ├── delivery.js  # 投递看板
│       ├── calendar.js  # 日程看板
│       ├── ai.js        # AI 辅助（预留）
│       └── utils.js     # 工具函数
├── start.bat            # Windows 一键启动
└── start.sh             # Linux / macOS 一键启动
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/load` | 加载全部数据（投递 / 日程 / 简历） |
| POST | `/api/save` | 全量保存数据 |

数据以 SQLite 存储，每类资源独立建表，内容以 JSON 格式保存。

## License

MIT
