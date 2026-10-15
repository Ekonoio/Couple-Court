import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { schemaForRules, type JudgeOutput, type Judgment, type Material, type RuleConfig } from '@court/shared'
import { summarize } from '@court/court-rules'

export const PROMPT_VERSION='judge-1.0.0'
export class JudgeError extends Error { constructor(public code:string, message:string) {super(message)} }
export interface JudgeConfig { mode:'mock'|'real'; provider:string; model:string; baseUrl:string; apiKey?:string; inputPrice?:number; outputPrice?:number; timeoutMs?:number }
export type ImageInput={id:string;data:Buffer}
export function sourcesFor(material:Material):Record<string,string> {
 const sources:Record<string,string>={'context.participation':material.mode==='solo'?'只有甲方参与，缺少乙方陈述':'双方各自陈述；任何陈述不自动为事实'}
 for(const [key,value] of Object.entries(material.basics)) sources['case.'+key]=value
 for(const side of ['A','B'] as const) for(const [key,value] of Object.entries(material.statements[side]||{})) sources[side+'.'+key]=value
 for(const e of material.evidence) sources['image:'+e.id]=`提交方${e.owner}，顺序${e.position+1}，左侧${e.left}，右侧${e.right}，备注：${e.note}`
 return sources
}
export function validateOutput(raw:unknown, material:Material, rules:RuleConfig):JudgeOutput {
 const parsed=schemaForRules(rules.maxScore).safeParse(raw)
 if(!parsed.success) throw new JudgeError('INVALID_MODEL_OUTPUT','模型输出格式错误：'+parsed.error.issues.map(i=>i.path.join('.')+':'+i.code).slice(0,8).join(', '))
 const o=parsed.data
 const ids=o.dimensions.map(d=>d.id)
 if(new Set(ids).size!==ids.length||rules.dimensions.length!==ids.length||rules.dimensions.some(d=>!ids.includes(d.id))) throw new JudgeError('INVALID_DIMENSIONS','模型返回的评分维度与规则不一致')
 const sources=sourcesFor(material)
 const checkRefs=(refs:string[])=>{if(refs.some(r=>!(r in sources)))throw new JudgeError('INVALID_REFERENCE','模型引用了不存在的材料')}
 for(const v of [...o.facts,...o.reasoning,...o.reasonable.A,...o.reasonable.B,...o.uncertainties,...o.seriousFaults]) checkRefs(v.refs)
 checkRefs(o.safety.refs)
 if(o.safety.detected) {
  if(o.safety.refs.length===0||!o.safety.message)throw new JudgeError('INVALID_SAFETY','安全提示缺少依据或内容')
  o.keyFactsSufficient=false
  for(const d of o.dimensions){d.A.score=null;d.B.score=null}
 }
 for(const side of ['A','B'] as const) {
  const seen=new Set<string>()
  for(const d of o.dimensions) {
   const g=d[side];checkRefs(g.refs)
   if(g.score!==null&&g.score>0&&(g.behaviorIds.length===0||g.refs.every(r=>r==='context.participation')))throw new JudgeError('MISSING_BASIS','正分缺少具体行为依据')
   for(const b of g.behaviorIds){if(seen.has(b))throw new JudgeError('DOUBLE_COUNT','同一行为跨维度重复计分');seen.add(b)}
  }
 }
 if(material.mode==='solo') o.keyFactsSufficient=false
 // Render in configured order, irrespective of the provider's order.
 o.dimensions.sort((a,b)=>rules.dimensions.findIndex(d=>d.id===a.id)-rules.dimensions.findIndex(d=>d.id===b.id))
 return o
}
function mockOutput(material:Material,rules:RuleConfig):JudgeOutput {
 const dangerRefs=Object.entries(sourcesFor(material)).filter(([,text])=>/(拿刀威胁|扬言.{0,5}杀|掐住.{0,3}脖|殴打|跟踪骚扰|不让.{0,5}离开|强制控制)/.test(text)).map(([ref])=>ref)
 const danger=dangerRefs.length>0
 return {
  facts:[{category:'unilateral',text:'Mock 模式未对私人材料进行AI事实认定。',refs:['context.participation']}],
  dimensions:rules.dimensions.map(d=>({id:d.id,A:{score:null,reason:'Mock 模式不推断真实材料的过错；请配置模型后分析。',refs:['context.participation'],behaviorIds:[]},B:{score:null,reason:'Mock 模式不推断真实材料的过错。',refs:['context.participation'],behaviorIds:[]}})),
  reasoning:[{text:'这只是流程演示，没有调用真实模型，不生成虚构分数或聊天内容。',refs:['context.participation']}],
  reasonable:{A:[],B:[]},uncertainties:[{text:'事实未经真实模型分析，所有维度暂不可评分。',refs:['context.participation']}],
  suggestions:{A:['先核对事实与材料；需要实际分析时启用真实模型。'],B:['独立陈述自己的经历，避免把推测当成确定事实。']},
  keyFactsSufficient:false,seriousFaults:[],safety:{detected:danger,message:danger?'材料中出现可能涉及安全风险的词语，未核实。请优先保障安全；现实危险请联系当地警方或紧急服务，不作犯罪认定。':'',refs:dangerRefs.slice(0,20)}
 }
}
export async function runJudge(material:Material,rules:RuleConfig,config:JudgeConfig,images:ImageInput[]=[],fixtureOutput?:JudgeOutput):Promise<Judgment> {
 const started=Date.now();let raw:unknown;let usage:Judgment['usage']=null
 if(config.mode==='mock') raw=fixtureOutput?structuredClone(fixtureOutput):mockOutput(material,rules)
 else {
  if(!config.apiKey)throw new JudgeError('MISSING_API_KEY','真实模型未配置密钥，请在服务端环境设置 LLM_API_KEY')
  const endpoint=new URL(config.baseUrl)
  if(endpoint.protocol!=='https:' && !(['127.0.0.1','localhost'].includes(endpoint.hostname)&&process.env.NODE_ENV!=='production'))throw new JudgeError('INVALID_ENDPOINT','模型服务必须使用 HTTPS')
  const prompt=fs.readFileSync(path.resolve(process.env.COURT_ROOT||process.cwd(),'packages/judge/prompts/judge-v1.md'),'utf8')
  const content:unknown[]=[{type:'text',text:JSON.stringify({rules,mode:material.mode,sources:sourcesFor(material)})}]
  for(const e of material.evidence){const img=images.find(i=>i.id===e.id);if(!img)throw new JudgeError('MISSING_IMAGE','截图材料缺失');content.push({type:'text',text:`引用 image:${e.id}，左侧${e.left}，右侧${e.right}，由${e.owner}提交，顺序${e.position+1}`},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+img.data.toString('base64')}})}
  let response:Response
  try { response=await fetch(config.baseUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.apiKey},signal:AbortSignal.timeout(config.timeoutMs||90000),body:JSON.stringify({model:config.model,messages:[{role:'system',content:prompt},{role:'user',content}],response_format:{type:'json_schema',json_schema:{name:'court_judgment',strict:true,schema:zodToJsonSchema(schemaForRules(rules.maxScore),{$refStrategy:'none'})}}})}) }
  catch {throw new JudgeError('MODEL_UNAVAILABLE','模型请求失败或超时；请检查模型网络与配置，未生成判决')}
  if(!response.ok)throw new JudgeError('MODEL_HTTP_ERROR',`模型服务返回 HTTP ${response.status}；未生成判决，请检查服务端配置和余额`)
  let body:any
  try {body=await response.json();raw=JSON.parse(body.choices?.[0]?.message?.content)} catch {throw new JudgeError('INVALID_MODEL_JSON','模型没有返回有效 JSON，未生成判决')}
  if(body.usage&&Number.isFinite(body.usage.prompt_tokens)&&Number.isFinite(body.usage.completion_tokens))usage={input:body.usage.prompt_tokens,output:body.usage.completion_tokens}
 }
 const rawOutput=structuredClone(raw)
 const output=validateOutput(raw,material,rules)
 const summary=summarize(output,rules)
 // Critical factual uncertainty must not look like a precise overall comparison.
 if(!output.keyFactsSufficient){summary.totals={A:null,B:null};if(summary.verdict!=='safety')summary.verdict='insufficient'}
 return {id:randomUUID(),output,rawOutput,...summary,rules,provider:config.mode==='mock'?'local-mock':config.provider,model:config.mode==='mock'?'mock-flow-v1':config.model,promptVersion:PROMPT_VERSION,mock:config.mode==='mock',durationMs:Date.now()-started,usage,estimatedCost:usage&&config.inputPrice!==undefined&&config.outputPrice!==undefined?(usage.input*config.inputPrice+usage.output*config.outputPrice)/1_000_000:null,createdAt:new Date().toISOString(),limitation:material.mode==='solo'?'单方分析：缺少乙方陈述，不能把甲方说法视为已证实事实，也不作完整的双方责任结论。':null}
}
