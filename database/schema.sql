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
