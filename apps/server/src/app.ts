import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import multer from 'multer'
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { basicsSchema,modeSchema,submitSchema, type Judgment,type Side } from '@court/shared'
import { getRules,listRules } from '@court/court-rules'
import { JudgeError,runJudge } from '@court/judge'
import { fixtures,swapFixture } from '../../../tests/cases/index.js'
import { ApiError,Repository } from './repository.js'
import type { ServerConfig } from './config.js'

const createSchema=z.object({basics:basicsSchema,mode:modeSchema}).strict()
const devRunSchema=z.object({fixtureId:z.string(),model:z.enum(['mock','configured']),rulesVersion:z.string().default('1.0.0'),swapped:z.boolean().default(false)}).strict()
const safeEqual=(a:string,b:string)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
export function createApp(config:ServerConfig,repo=new Repository(config.dbPath,config.retentionDays)) {
 const app=express();app.disable('x-powered-by')
 app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:{policy:'same-site'},referrerPolicy:{policy:'no-referrer'}}))
 app.use(cors({origin:(origin,cb)=>cb(null,!origin||config.allowedOrigins.includes(origin)),allowedHeaders:['Authorization','Content-Type','X-Dev-Token']}))
 app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next()})
 app.use(express.json({limit:'128kb'}))
 // Small local-demo rate limit; no proxy trust and no unbounded request logs.
 const limits=new Map<string,{start:number;count:number}>()
 app.use('/api',(req,_res,next)=>{const now=Date.now();for(const [key,v] of limits)if(now-v.start>60000)limits.delete(key);const key=req.ip||'local';const v=limits.get(key)||{start:now,count:0};v.count++;limits.set(key,v);if(v.count>240)return next(new ApiError(429,'RATE_LIMIT','请求过于频繁，请稍后再试'));next()})
 app.get('/api/health',(_req,res)=>res.json({ok:true,mode:config.judge.mode}))
 app.get('/api/config',(_req,res)=>res.json({rules:getRules(),mode:config.judge.mode,model:config.judge.mode==='mock'?'mock-flow-v1':config.judge.model,retentionDays:config.retentionDays}))
 app.post('/api/cases',(req,res)=>{const body=createSchema.parse(req.body);res.status(201).json(repo.create(body.basics,body.mode))})
 app.post('/api/invitations/accept',(req,res)=>{const {invite}=z.object({invite:z.string().regex(/^[\w-]{43}$/)}).strict().parse(req.body);res.json(repo.accept(invite))})
 const role=(req:express.Request):Side=>{const authorization=req.get('authorization');if(!authorization?.startsWith('Bearer '))throw new ApiError(401,'UNAUTHORIZED','需要案件访问凭证');return repo.auth(req.params.id as string,authorization.slice(7))}
 app.get('/api/cases/:id',(req,res)=>res.json(repo.view(req.params.id as string,role(req))))
 app.post('/api/cases/:id/handoff',(req,res)=>res.json(repo.handoff(req.params.id as string,role(req))))
 app.post('/api/cases/:id/submit',(req,res)=>{const side=role(req);res.json(repo.submit(req.params.id as string,side,submitSchema.parse(req.body)))})
 app.delete('/api/cases/:id',(req,res)=>{role(req);if(active.has(req.params.id as string))throw new ApiError(409,'BUSY','审理进行中，请完成后删除');repo.delete(req.params.id as string);res.status(204).end()})
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0}})
 app.post('/api/cases/:id/evidence',(req,res,next)=>{try{res.locals.role=role(req);next()}catch(e){next(e)}},upload.single('image'),async(req,res)=>{
  if(!req.file)throw new ApiError(400,'NO_IMAGE','请选择图片')
  let data:Buffer
  try{const img=sharp(req.file.buffer,{limitInputPixels:24_000_000,animated:false});const meta=await img.metadata();if(!['jpeg','png','webp'].includes(meta.format||''))throw new Error('format');data=await img.rotate().resize({width:1800,height:2400,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer()}
  catch{throw new ApiError(400,'INVALID_IMAGE','仅支持有效的 JPEG / PNG / WebP，最多2400万像素')}
  res.status(201).json(repo.upload(req.params.id as string,res.locals.role,data))
 })
 app.get('/api/cases/:id/evidence/:eid',(req,res)=>{const image=repo.image(req.params.id as string,role(req),req.params.eid as string);res.type('image/jpeg').send(image)})
 app.delete('/api/cases/:id/evidence/:eid',(req,res)=>{repo.removeImage(req.params.id as string,role(req),req.params.eid as string);res.status(204).end()})
 const active=new Map<string,Promise<Judgment>>()
 app.post('/api/cases/:id/judge',async(req,res)=>{
  const id=req.params.id as string,side=role(req),v=repo.view(id,side)
  if(v.judgment){res.json(v.judgment);return}
  if(!active.has(id)) {
   const {material,images}=repo.material(id);repo.setJudging(id)
   const promise=runJudge(material,getRules(),config.judge,images).then(result=>repo.saveJudgment(id,result)).catch(e=>{repo.judgeFailed(id);throw e}).finally(()=>active.delete(id))
   active.set(id,promise)
  }
  res.json(await active.get(id))
 })
 // Test APIs never accept a real case ID. Both development mode AND a separate capability are required.
 app.use('/api/dev',(req,_res,next)=>{if(config.nodeEnv!=='development')return next(new ApiError(404,'NOT_FOUND','接口不存在'));if(!config.devToken||!safeEqual(req.get('x-dev-token')||'',config.devToken))return next(new ApiError(403,'DEV_FORBIDDEN','需要独立的开发者访问凭证'));next()})
 app.get('/api/dev/options',(_req,res)=>res.json({fixtures:fixtures.map(({mockOutput,...f})=>f),models:[{id:'mock',name:'Mock · 虚构案例参考值'},...(config.judge.apiKey?[{id:'configured',name:config.judge.model}]:[])],rules:listRules()}))
 let devRunning=false
 app.post('/api/dev/run',async(req,res)=>{
  const body=devRunSchema.parse(req.body);const f=fixtures.find(f=>f.id===body.fixtureId);if(!f)throw new ApiError(404,'NOT_FOUND','案例不存在');if(!listRules().some(r=>r.version===body.rulesVersion))throw new ApiError(400,'INVALID_RULES','规则版本不存在')
  if(devRunning)throw new ApiError(409,'BUSY','已有测试正在运行');devRunning=true
  try{const selected=body.swapped?swapFixture(f):f;if(body.model==='configured'&&!config.judge.apiKey)throw new ApiError(400,'MISSING_API_KEY','没有配置真实模型密钥');const judgeConfig=body.model==='mock'?{...config.judge,mode:'mock' as const}:{...config.judge,mode:'real' as const};const result=await runJudge(selected.material,getRules(body.rulesVersion),judgeConfig,[],body.model==='mock'?selected.mockOutput:undefined);res.json(repo.saveRun(f.id,body.swapped,result))}finally{devRunning=false}
 })
 app.get('/api/dev/runs',(req,res)=>{const params=z.object({fixtureId:z.string(),swapped:z.enum(['true','false']).default('false')}).parse(req.query);res.json(repo.runs(params.fixtureId,params.swapped==='true'))})
 app.post('/api/dev/runs/:runId/save',(req,res)=>{repo.pinRun(req.params.runId as string);res.json({ok:true})})
 app.use('/api',(_req,_res,next)=>next(new ApiError(404,'NOT_FOUND','接口不存在')))
 const h5=path.resolve('apps/miniapp/dist/h5')
 if(fs.existsSync(h5)){app.use(express.static(h5,{setHeaders:res=>res.setHeader('Referrer-Policy','no-referrer')}));app.get(/.*/,(_req,res)=>res.sendFile(path.join(h5,'index.html')))}
 app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(err instanceof z.ZodError){res.status(400).json({code:'INVALID_INPUT',message:'输入格式不正确',fields:err.issues.map(i=>({path:i.path.join('.'),message:i.message}))});return}
  if(err instanceof ApiError){res.status(err.status).json({code:err.code,message:err.message});return}
  if(err instanceof JudgeError){console.error(JSON.stringify({event:'judge_error',code:err.code,at:new Date().toISOString()}));res.status(502).json({code:err.code,message:err.message});return}
  if(err instanceof multer.MulterError){res.status(400).json({code:err.code,message:'上传限制：每次1张图片，每张不超过8MB'});return}
  if(err?.type==='entity.too.large'||err instanceof SyntaxError){res.status(400).json({code:'INVALID_BODY',message:'请求格式错误或内容过大'});return}
  console.error(JSON.stringify({event:'internal_error',type:err?.name||'Error',at:new Date().toISOString()}));res.status(500).json({code:'INTERNAL_ERROR',message:'服务发生错误，请稍后重试'})
 })
 return {app,repo}
}
