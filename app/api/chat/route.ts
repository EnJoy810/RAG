import {
    embed,
    streamText
} from 'ai';
import {
    createOpenAI
} from '@ai-sdk/openai';
import {
    createClient
} from '@supabase/supabase-js';

interface ChunkData {
    id: string;
    content: string;
    url: string;
    date_updated: string;
    similarity: number;
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL,
})

async function generateEmbedding(message: string) {
    return embed({
        model: openai.embedding('text-embedding-3-small'),
        value: message
    })
}

async function fetchRelevantRecipes(embedding: number[]) {
    const {
        data,
        error
    } = await supabase.rpc("get_relevant_recipes", {
        query_vector: embedding,
        match_threshold: 0.7,
        match_count: 3
    })

    if (error) throw error;
    console.log(data, '////////////////')
    return JSON.stringify(
        data.map((item: ChunkData) => `
        内容来源: ${item.url}
        更新时间: ${item.date_updated}
        详细内容: ${item.content}
      `)
    )
}


const createRecipePrompt = (context: string, userQuestion: string) => {
    return {
        role: "system",
        content: `
            你是一个专业的营养师和烹饪顾问，专门为用户提供个性化的菜谱推荐和营养搭配建议。
      
      请使用以下菜谱数据库信息来回答问题：
      ----------------
      菜谱知识库开始
      ${context}
      菜谱知识库结束
      ----------------
      
      你的专业能力包括：
      1. 根据用户的饮食需求、健康状况、口味偏好推荐合适的菜谱
      2. 分析菜谱的营养成分和健康价值
      3. 提供食材替换建议（过敏、不喜欢某种食材等）
      4. 解释烹饪技巧和注意事项
      5. 设计营养均衡的一日三餐搭配方案
      6. 针对特殊人群（老人、儿童、孕妇、糖尿病患者等）给出专业建议
      
      回答要求：
      - 用markdown格式返回答案，包含相关菜谱链接和营养分析
      - 如果菜谱库信息不足，可以基于营养学知识补充，但要说明这些信息来源于通用知识
      - 如果用户问题与烹饪营养无关，请礼貌地引导回到美食话题
      - 对于食材过敏或特殊饮食要求，必须给出安全提醒
      
      ----------------
      用户问题: ${userQuestion}
      ----------------
        `
    }
}

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const latestMessage = messages.at(-1).content;
        // embedding
        const { embedding } = await generateEmbedding(latestMessage);
        // console.log(embedding);
        // 相似度计算
        const context = await fetchRelevantRecipes(embedding);
        const prompt = createRecipePrompt(context, latestMessage)
        console.log(prompt)
        const result = streamText({
            model: openai("gpt-4o-mini"),
            messages: [prompt, ...messages]
        })
        return result.toDataStreamResponse()
    } catch (err) {
        throw err
    }
}