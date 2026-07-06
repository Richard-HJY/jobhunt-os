# JobHunt OS

一站式求职管理工具 —— 从简历制作、投递追踪到面试日程，覆盖求职全流程。

## 功能模块

| 模块 | 说明 |
|------|------|
| **首页看板** | 投递总数、面试邀请率、Offer 率、平均响应天数等关键指标；阶段转化漏斗；渠道效果 & 简历效能排行 |
| **简历管理** | 在线简历编辑器（基本信息 / 学历 / 工作 / 项目 / 证书 & 技能）；工作经历支持实习标记；多版本简历管理；导出PDF |
| **投递看板** | 看板 + 列表双视图；自定义阶段列；多维度筛选（公司 / 阶段 / 状态 / 渠道 / 时间）；批量操作；跟进日志 |
| **日程看板** | 周视图 / 月视图；面试、笔试、Offer 事件管理；今日提醒；关联投递记录 |
| **AI 优化** | 接入 LLM（OpenAI + Anthropic 协议识别），批量优化 / 单条精修简历的工作经历与项目经历；支持自定义指令与 JD 匹配两种模式；推理模型自动延长超时 |


## 快速开始

**Windows** —— 双击 `start.bat`

**Linux / macOS**：

```bash
chmod +x start.sh && ./start.sh
```

**手动启动**：

```bash
pip install fastapi uvicorn pydantic python-multipart httpx
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

浏览器打开 `http://localhost:8000`。

**使用 AI 功能**：点击导航栏右侧齿轮图标，填写 LLM API 地址、Key 和模型名称保存即可。支持 OpenAI 兼容接口和 Anthropic 原生接口（根据 Base URL 自动识别）。
