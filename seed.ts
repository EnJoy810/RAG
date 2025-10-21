// supabase 去做向量化的食谱知识库数据
// 首先加载环境变量
require('dotenv').config({ path: '.env.local' });

// 调试：检查环境变量是否正确加载
console.log('环境变量检查:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_KEY 长度:', process.env.SUPABASE_KEY?.length || 0);
console.log('SUPABASE_KEY 前缀:', process.env.SUPABASE_KEY?.substring(0, 20) || '无');
console.log('OPENAI_API_KEY 前缀:', process.env.OPENAI_API_KEY?.substring(0, 20) || '无');

import { createOpenAI } from "@ai-sdk/openai";
// langchain  loader 是 RAG的基础功能 txt,pdf,excel....
// 加载网页内容
import {
    PuppeteerWebBaseLoader
} from '@langchain/community/document_loaders/web/puppeteer'
import {
    RecursiveCharacterTextSplitter
} from 'langchain/text_splitter'
import {
    embed // 向量嵌入
} from 'ai'
import { createClient } from "@supabase/supabase-js"

// 创建 Supabase 客户端实例
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);
// 验证 Supabase 连接
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('错误: Supabase 环境变量未设置!');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '已设置' : '未设置');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置');   
    process.exit(1);
}
// 取出环境变量里的 URL 和密钥
const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
})

console.log('开始向量化食谱知识库数据');
// 文本分块工具（每段 512个字符，并且段与段之间重叠100个字符）
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512, // 切割的长度 包含一个比较独立的语义
    chunkOverlap: 100, // 切割的重叠长度 为了避免切割的句子中间被截断 100字符
})
// 爬取网页
const scrapePage = async (url: string): Promise<string> => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            headless: true,

        },
        gotoOptions: {
            waitUntil: 'domcontentloaded',
        },
        evaluate: async (page, browser) => {
            const result = await page.evaluate(() => document.body.innerHTML);
            await browser.close();
            return result;
        }
    });
    // gm 正则修饰符
    // ^在[^]表示不是>的字符
    return (await loader.scrape()).replace(/<[^>]*>?/gm, "");
    // 去掉所有 HTML 标签，只保留纯文字内容
}
// 处理数据
const loadData = async (webpages: string[]) => {
    let totalChunks = 0;
    const maxChunks = 150; // 限制最多处理150条信息

    for (const url of webpages) {
        if (totalChunks >= maxChunks) {
            console.log(`已达到最大处理数量 ${maxChunks} 条，停止处理`);
            break;
        }

        console.log(`正在处理网页: ${url}`);
        const content = await scrapePage(url);
        const chunks = await splitter.splitText(content);
        console.log(`从 ${url} 获取到 ${chunks.length} 个文本块`);

        for (let chunk of chunks) {
            if (totalChunks >= maxChunks) {
                console.log(`已达到最大处理数量 ${maxChunks} 条，停止处理当前页面`);
                break;
            }

            const { embedding } = await embed({
                model: openai.embedding('text-embedding-3-small'),
                value: chunk,
            })

            const { error } = await supabase.from("chunks").insert({
                content: chunk,
                vector: embedding,
                url,
            })

            if (error) {
                console.error('插入数据时出错:', error);
            } else {
                totalChunks++;
                console.log(`已处理 ${totalChunks}/${maxChunks} 条食谱信息`);
            }
        }
    }

    console.log(`食谱知识库构建完成，总共处理了 ${totalChunks} 条信息`);
}

loadData([
  "https://www.xiachufang.com/category/40076/",     // 下厨房家常菜
  "https://www.xiachufang.com/category/40077/",     // 下厨房素食
  "https://www.xiachufang.com/category/40078/",     // 下厨房汤粥
  "https://www.meishij.net/china-food/caixi/",      // 美食杰各地菜系
  "https://www.meishij.net/china-food/chufang/jiachang/", // 美食杰家常菜
]);