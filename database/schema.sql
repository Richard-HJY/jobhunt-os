-- 求职助手 数据库 Schema
-- 每类资源一张表，数据以 JSON 存储保持兼容性

CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS online_resumes (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_resumes (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

-- AI 配置表
CREATE TABLE IF NOT EXISTS ai_config (
    cfg_key   TEXT PRIMARY KEY,
    cfg_value TEXT NOT NULL
);
INSERT OR IGNORE INTO ai_config(cfg_key, cfg_value) VALUES ('base_url', '');
INSERT OR IGNORE INTO ai_config(cfg_key, cfg_value) VALUES ('api_key',  '');
INSERT OR IGNORE INTO ai_config(cfg_key, cfg_value) VALUES ('model',    '');
