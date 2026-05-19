"""
数据库模块 — SQLite 连接管理、建表、读写操作
"""
import json
import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db")

ALLOWED_TABLES = {"deliveries", "calendar_events", "online_resumes", "custom_resumes"}


def _check_table(table: str):
    if table not in ALLOWED_TABLES:
        raise ValueError(f"非法表名: {table}")


@contextmanager
def get_connection():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def init_db():
    schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "database", "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            sql = f.read()
        with get_connection() as con:
            con.executescript(sql)
    else:
        with get_connection() as con:
            for table in ALLOWED_TABLES:
                con.execute(f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)")


def get_all(table: str) -> list:
    """获取某张表的所有记录，返回对象列表"""
    _check_table(table)
    with get_connection() as con:
        rows = con.execute(f"SELECT data FROM {table}").fetchall()
    return [json.loads(row[0]) for row in rows]


def set_all(table: str, items: list):
    """全量替换某张表的数据"""
    _check_table(table)
    with get_connection() as con:
        con.execute(f"DELETE FROM {table}")
        for item in items:
            item_id = item.get("id", "")
            con.execute(
                f"INSERT INTO {table}(id, data) VALUES(?, ?)",
                (item_id, json.dumps(item, ensure_ascii=False)),
            )
