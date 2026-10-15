import { describe,it,expect } from 'vitest'
import { getRules,summarize } from '@court/court-rules'
import { validateOutput,runJudge,JudgeError } from '@court/judge'
import { fixtures,swapFixture } from './cases/index.js'
const rules=getRules()
describe('独立规则与输出校验',()=>{
 it.each(fixtures)('$title 的参考评分符合规则',f=>{const o=validateOutput(f.mockOutput,f.material,rules);expect(summarize(o,rules).verdict).toBe(f.expected)})
 it('双方分数独立求和，不共享分数',()=>{const o=structuredClone(fixtures[2].mockOutput);o.dimensions[0].A.score=2;expect(summarize(o,rules).totals).toEqual({A:5,B:3})})
 it('分数接近与双方低分分别处理',()=>{const o=structuredClone(fixtures[0].mockOutput);o.dimensions[0].A.score=2;expect(summarize(o,rules).verdict).toBe('none');o.dimensions[0].A.score=3;o.dimensions[0].B.score=2;expect(summarize(o,rules).verdict).toBe('close')})
 it('任何不可评分项不被当成0分',()=>{const o=structuredClone(fixtures[1].mockOutput);o.dimensions[1].A.score=null;expect(summarize(o,rules).totals.A).toBeNull();expect(summarize(o,rules).verdict).toBe('insufficient')})
 it.each([6,-1,1.5])('拒绝非法分数 %s',n=>{const o=structuredClone(fixtures[0].mockOutput);o.dimensions[0].A.score=n;expect(()=>validateOutput(o,fixtures[0].material,rules)).toThrow(JudgeError)})
 it('拒绝缺失维度及捏造来源',()=>{const o=structuredClone(fixtures[0].mockOutput);o.dimensions.pop();expect(()=>validateOutput(o,fixtures[0].material,rules)).toThrow('维度');const b=structuredClone(fixtures[0].mockOutput);b.reasoning[0].refs=['image:invented'];expect(()=>validateOutput(b,fixtures[0].material,rules)).toThrow('不存在')})
 it('拒绝同一行为跨维度重复计分',()=>{const o=structuredClone(fixtures[1].mockOutput);o.dimensions[1].A={...o.dimensions[0].A};expect(()=>validateOutput(o,fixtures[1].material,rules)).toThrow('重复计分')})
 it('安全风险暂停分数',()=>{const o=structuredClone(fixtures[7].mockOutput);o.dimensions[0].A.score=4;expect(validateOutput(o,fixtures[7].material,rules).dimensions[0].A.score).toBeNull();expect(summarize(o,rules).verdict).toBe('safety')})
 it('身份交换后过错跟随行为',()=>{const f=swapFixture(fixtures[1]);const o=validateOutput(f.mockOutput,f.material,rules);expect(summarize(o,rules)).toEqual({totals:{A:0,B:4},verdict:'B'});expect(f.material.statements.A.happened).toContain('乙方未经我同意');expect(f.material.basics.course).toContain('乙方未经同意');expect(swapFixture(f).material).toEqual(fixtures[1].material)})
 it('评分范围与维度可由独立规则配置调整',()=>{const custom={...rules,maxScore:7,dimensions:[...rules.dimensions,{id:'new_dimension',name:'新增维度',description:'用于验证动态规则'}]};const o=structuredClone(fixtures[0].mockOutput);o.dimensions[0].A.score=7;o.dimensions[0].A.behaviorIds=['custom-behavior'];o.dimensions.push({id:'new_dimension',A:{score:0,reason:'没有依据',refs:['A.happened'],behaviorIds:[]},B:{score:0,reason:'没有依据',refs:['B.happened'],behaviorIds:[]}});expect(validateOutput(o,fixtures[0].material,custom).dimensions).toHaveLength(5);expect(summarize(o,custom).totals.A).toBe(7)})
 it('真实材料的Mock不会伪造分数',async()=>{const result=await runJudge(fixtures[1].material,rules,{mode:'mock',model:'x',provider:'x',baseUrl:'https://api.openai.com/v1'});expect(result.mock).toBe(true);expect(result.totals).toEqual({A:null,B:null});expect(result.verdict).toBe('insufficient')})
 it('单方模式即使得到完整分数也不形成双人结论',async()=>{const m={...fixtures[0].material,mode:'solo' as const};const result=await runJudge(m,rules,{mode:'mock',model:'x',provider:'x',baseUrl:'https://api.openai.com/v1'},[],fixtures[0].mockOutput);expect(result.verdict).toBe('insufficient');expect(result.limitation).toContain('单方');expect(result.totals.A).toBeNull()})
})
