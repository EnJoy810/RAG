-- RAG项目Supabase数据库初始化脚本
-- 请在Supabase控制台的SQL编辑器中执行以下脚本

-- 1. 启用向量扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 创建chunks表（用于存储向量化的文档片段）
CREATE TABLE IF NOT EXISTS public.chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content text,
  vector vector(1536), -- OpenAI text-embedding-3-small的向量维度
  url text,
  date_updated timestamp without time zone DEFAULT now(),
  CONSTRAINT chunks_pkey PRIMARY KEY (id)
);

-- 3. 创建向量相似度搜索函数
CREATE OR REPLACE FUNCTION get_relevant_chunks(
  query_vector vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  url text,
  date_updated timestamp,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    url,
    date_updated,
    1 - (chunks.vector <=> query_vector) as similarity
  FROM chunks
  WHERE 1 - (chunks.vector <=> query_vector) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- 4. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS chunks_vector_idx ON chunks USING ivfflat (vector vector_cosine_ops);

-- 5. 设置行级安全（RLS）- 可选
-- ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

-- 验证配置
SELECT 'Database setup complete!' as message;