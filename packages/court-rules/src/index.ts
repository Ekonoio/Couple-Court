import fs from 'node:fs'
import path from 'node:path'
import type { JudgeOutput, RuleConfig, Verdict } from '@court/shared'
import { z } from 'zod'
const ruleSchema=z.object({version:z.string().min(1),name:z.string().min(1),dimensions:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9_-]*$/),name:z.string().min(1),description:z.string().min(1)})).min(1).max(20),maxScore:z.number().int().min(1).max(20),closeGap:z.number().int().min(0),lowTotal:z.number().int().min(0),scale:z.array(z.object({score:z.number().int().min(0),label:z.string().min(1)})).min(2),evidenceRules:z.array(z.string()).min(1),antiDoubleCount:z.string().min(1),safety:z.string().min(1)})
export function listRules():RuleConfig[]{
 const directory=path.resolve(process.env.COURT_ROOT || process.cwd(),'packages/court-rules/config')
 const all=fs.readdirSync(directory).filter(f=>f.endsWith('.json')).map(file=>{
  const r=ruleSchema.parse(JSON.parse(fs.readFileSync(path.join(directory,file),'utf8')))
  if(new Set(r.dimensions.map(d=>d.id)).size!==r.dimensions.length||new Set(r.scale.map(s=>s.score)).size!==r.maxScore+1||r.scale.some(s=>s.score>r.maxScore)||r.closeGap>r.maxScore*r.dimensions.length||r.lowTotal>r.maxScore*r.dimensions.length)throw new Error('规则配置无效')
  return r
 })
 if(new Set(all.map(r=>r.version)).size!==all.length)throw new Error('规则版本重复')
 return all
}
export function getRules(version = process.env.COURT_RULES_VERSION||'1.0.0'): RuleConfig {
 const rules=listRules().find(r=>r.version===version)
 if(!rules)throw new Error('未知规则版本')
 return rules
}
export function summarize(output: JudgeOutput, rules: RuleConfig): {totals:{A:number|null;B:number|null};verdict:Verdict} {
 if (output.safety.detected) return { totals:{A:null,B:null}, verdict:'safety' }
 const total = (side:'A'|'B') => output.dimensions.every(d=>d[side].score !== null) ? output.dimensions.reduce((n,d)=>n+d[side].score!,0) : null
 const totals = {A:total('A'),B:total('B')}
 let verdict: Verdict = 'insufficient'
 if (output.keyFactsSufficient && totals.A !== null && totals.B !== null) {
  if (totals.A <= rules.lowTotal && totals.B <= rules.lowTotal) verdict='none'
  else if (Math.abs(totals.A-totals.B)<=rules.closeGap) verdict='close'
  else verdict=totals.A>totals.B?'A':'B'
 }
 return {totals,verdict}
}
