import { useState } from 'react'
import { Button,Input,Picker,Switch,Text,View } from '@tarojs/components'
import type { Fixture,Judgment,RuleConfig } from '@court/shared'
import { request } from '../../platform'
import JudgmentView from '../../components/JudgmentView'
interface Run {id:string;fixtureId:string;swapped:boolean;result:Judgment;saved:boolean}
export default function DeveloperPage(){
 const [token,setToken]=useState(''),[options,setOptions]=useState<{fixtures:Fixture[];models:{id:string;name:string}[];rules:RuleConfig[]}|null>(null)
 const [fixture,setFixture]=useState(0),[model,setModel]=useState(0),[rule,setRule]=useState(0),[swap,setSwap]=useState(false)
 const [current,setCurrent]=useState<Run|null>(null),[history,setHistory]=useState<Run[]>([]),[baseline,setBaseline]=useState<Run|null>(null)
 const [error,setError]=useState(''),[busy,setBusy]=useState(false)
 if(process.env.TARO_APP_DEVTOOLS!=='1')return <View>页面不可用</View>
 async function act(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){setError(e instanceof Error?e.message:'测试失败')}finally{setBusy(false)}}
 async function loadHistory(id:string,swapped:boolean){const list=await request<Run[]>(`/api/dev/runs?fixtureId=${id}&swapped=${swapped}`,'GET',undefined,undefined,token);setHistory(list);setBaseline(list.find(r=>r.saved)||null)}
 const selected=options?.fixtures[fixture]
 return <View className='shell flow-content dev-shell'><Text className='eyebrow'>COUPLE COURT / LAB</Text><Text className='page-title'>审判实验室</Text><Text className='page-subtitle'>仅开发模式 · 仅虚构案例 · 不读取真实案件</Text>
  {error&&<View className='notice error-notice'>{error}</View>}
  {!options?<View className='card'><Text className='section-heading'>开发者访问凭证</Text><Text className='small muted'>从本地 .data/dev-token 文件或服务端 DEV_ACCESS_TOKEN 获取。凭证只保留在本页内存。</Text><Input className='input' password placeholder='输入开发者凭证' value={token} onInput={e=>setToken(e.detail.value)}/><Button className='primary' loading={busy} disabled={busy} onClick={()=>act(async()=>{setOptions(await request('/api/dev/options','GET',undefined,undefined,token))})}>进入实验室</Button></View>:<>
   <View className='card'><Text className='field-label'>虚构案例</Text><Picker mode='selector' range={options.fixtures.map(f=>f.title)} value={fixture} onChange={e=>{const i=Number(e.detail.value);setFixture(i);setCurrent(null);setBaseline(null);setHistory([]);setSwap(false)}}><View className='select'>{selected?.title} ▾</View></Picker><Text className='small muted'>{selected?.description}</Text>
    <Text className='field-label'>模型</Text><Picker mode='selector' range={options.models.map(m=>m.name)} value={model} onChange={e=>setModel(Number(e.detail.value))}><View className='select'>{options.models[model]?.name} ▾</View></Picker>
    <Text className='field-label'>规则版本</Text><Picker mode='selector' range={options.rules.map(r=>r.version+' · '+r.name)} value={rule} onChange={e=>setRule(Number(e.detail.value))}><View className='select'>{options.rules[rule]?.version} ▾</View></Picker>
    <View className='section-header'><View><Text>交换甲乙身份与材料</Text><Text className='small muted block'>按实际行为检查标签偏差</Text></View><Switch checked={swap} disabled={selected?.material.mode==='solo'} color='#245e50' onChange={e=>{setSwap(e.detail.value);setCurrent(null);setBaseline(null);setHistory([])}}/></View>
    <Button className='primary' loading={busy} disabled={busy} onClick={()=>act(async()=>{const run=await request<Run>('/api/dev/run','POST',{fixtureId:selected!.id,model:options.models[model].id,rulesVersion:options.rules[rule].version,swapped:swap},undefined,token);setCurrent(run);await loadHistory(selected!.id,swap)})}>运行审判</Button>
    <Button className='secondary' disabled={busy} onClick={()=>act(()=>loadHistory(selected!.id,swap))}>加载本案例历史</Button>
   </View>
   <View className='card'><Text className='section-heading'>当前输入材料{swap?'（已交换身份）':''}</Text><Text className='code'>{JSON.stringify(swap&&selected?.material.statements.B?{...selected.material,statements:{A:selected.material.statements.B,B:selected.material.statements.A}}:selected?.material,null,2)}</Text></View>
   {current&&<><View className='card'><Text className='section-heading'>本次运行</Text><Text className='block'>{current.result.provider} / {current.result.model}</Text><Text className='block small'>规则 {current.result.rules.version} · Prompt {current.result.promptVersion}</Text><Text className='block small'>输入 Token：{current.result.usage?.input??'接口未提供'} · 输出 Token：{current.result.usage?.output??'接口未提供'}</Text><Text className='block small'>耗时 {current.result.durationMs} ms · 估算费用：{current.result.estimatedCost===null?'不可用（缺用量或费率）':'$'+current.result.estimatedCost.toFixed(6)}</Text><Button className='secondary' disabled={busy||current.saved} onClick={()=>act(async()=>{await request(`/api/dev/runs/${current.id}/save`,'POST',{},undefined,token);setCurrent({...current,saved:true});await loadHistory(current.fixtureId,current.swapped)})}>{current.saved?'已保存为参考':'保存本次测试结果'}</Button></View><JudgmentView result={current.result}/>
    <View className='card'><Text className='section-heading'>原始结构化输出</Text><Text className='code'>{JSON.stringify(current.result.rawOutput,null,2)}</Text></View></>}
   <View className='card'><Text className='section-heading'>回归对比</Text><Text className='small muted'>仅比较相同案例、相同身份交换状态。选择一条已保存记录作为基准。</Text>{history.filter(r=>r.saved).map(r=><Button key={r.id} className={'history-item '+(baseline?.id===r.id?'selected':'')} onClick={()=>setBaseline(r)}>{r.result.createdAt.slice(0,19)} · {r.result.model} · 规则{r.result.rules.version}</Button>)}
    {baseline&&current?<><Text className='block small'>旧：{baseline.result.model} / {baseline.result.rules.version} → 新：{current.result.model} / {current.result.rules.version}</Text>{current.result.rules.dimensions.map(d=>{const old=baseline.result.output.dimensions.find(v=>v.id===d.id),next=current.result.output.dimensions.find(v=>v.id===d.id);return <View key={d.id} className='diff-row'><Text>{d.name}</Text><Text>甲 {old?.A.score??'—'} → {next?.A.score??'—'} · 乙 {old?.B.score??'—'} → {next?.B.score??'—'}</Text></View>})}<Text className='block'>总分：甲 {baseline.result.totals.A??'—'} → {current.result.totals.A??'—'}；乙 {baseline.result.totals.B??'—'} → {current.result.totals.B??'—'}</Text><Text className='field-label'>旧理由</Text><Text>{baseline.result.output.reasoning.map(r=>r.text).join('\n')}</Text><Text className='field-label'>新理由</Text><Text>{current.result.output.reasoning.map(r=>r.text).join('\n')}</Text></>:<Text className='block muted'>运行案例并保存结果后，可在此比较。</Text>}
   </View>
  </>}
 </View>
}
