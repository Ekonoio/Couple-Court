import 'dotenv/config'
import type { JudgeConfig } from '@court/judge'
export interface ServerConfig { dbPath:string; nodeEnv:string; retentionDays:number; allowedOrigins:string[]; judge:JudgeConfig; devToken?:string }
export function loadConfig():ServerConfig {
 const mode=process.env.LLM_MODE||'mock'
 if(mode!=='mock'&&mode!=='real')throw new Error('LLM_MODE 必须为 mock 或 real')
 const days=Number(process.env.DATA_RETENTION_DAYS||7)
 if(!Number.isInteger(days)||days<1||days>30)throw new Error('DATA_RETENTION_DAYS 必须是1至30之间整数')
 const price=(s:string|undefined)=>s!==undefined&&s!==''?Number(s):undefined
 return {dbPath:process.env.DB_PATH||'.data/court.sqlite',nodeEnv:process.env.NODE_ENV||'development',retentionDays:days,allowedOrigins:(process.env.ALLOWED_ORIGINS||'http://localhost:10086,http://127.0.0.1:10086,http://localhost:3001,http://127.0.0.1:3001').split(','),devToken:process.env.DEV_ACCESS_TOKEN,
 judge:{mode,provider:process.env.LLM_PROVIDER||'openai-compatible',model:process.env.LLM_MODEL||'gpt-4.1-mini',baseUrl:process.env.LLM_BASE_URL||'https://api.openai.com/v1',apiKey:process.env.LLM_API_KEY,inputPrice:price(process.env.LLM_INPUT_PRICE_PER_MILLION),outputPrice:price(process.env.LLM_OUTPUT_PRICE_PER_MILLION)}}
}
