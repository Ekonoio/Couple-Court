import { Text,View } from '@tarojs/components'
import { verdictLabels,type Judgment } from '@court/shared'
import ScoreCard from './ScoreCard'
import { refLabel } from './references'
const categories={agreed:'双方认可',supported:'材料支持',unilateral:'单方陈述',disputed:'说法矛盾',unknown:'无法确认'}
export default function JudgmentView({result}:{result:Judgment}){
 const out=result.output
 const findings=(title:string,items:{text:string;refs:string[]}[])=><View className='result-section'><Text className='section-heading'>{title}</Text>{items.length?items.map((f,i)=><View key={i} className='finding'><Text>{f.text}</Text><Text className='reference'>依据：{f.refs.map(refLabel).join(' · ')}</Text></View>):<Text className='muted'>现有材料未确认此项，不作推定。</Text>}</View>
 return <View className='judgment'>
  {result.mock&&<View className='notice mock-notice'>MOCK 演示 · 未调用真实模型，不可作为实际判断</View>}
  {out.safety.detected&&<View className='notice safety-notice'>{out.safety.message}</View>}
  <View className={'verdict-paper '+(out.safety.detected?'danger':'')}>
   <Text className='eyebrow'>COUPLE COURT / ANALYSIS</Text><Text className='verdict-heading'>{verdictLabels[result.verdict]}</Text>
   <Text className='muted'>仅针对本次争议，不评价任何人的人格。</Text>
   <View className='total-row'>{(['A','B'] as const).map(s=><View key={s} className={'total side-'+s}><Text>{s==='A'?'甲方':'乙方'}总分</Text><Text className='total-number'>{result.totals[s]===null?'—':result.totals[s]}<Text className='total-max'> / {result.rules.dimensions.length*result.rules.maxScore}</Text></Text><Text className='small'>{result.totals[s]===null?'材料不足或暂停评分':'分数越高，有依据的过错越重'}</Text></View>)}</View>
  </View>
  {result.limitation&&<View className='notice'>{result.limitation}</View>}
  <Text className='small muted'>0 分表示未发现足够过错依据；不可评分表示材料不足。分数不是科学测量值。</Text>
  <View className='section-header'><Text className='section-heading'>逐项审视</Text><Text className='small muted'>{result.rules.name}</Text></View>
  {result.rules.dimensions.map(rule=>{const score=out.dimensions.find(d=>d.id===rule.id);return score?<ScoreCard key={rule.id} rule={rule} scores={score} maxScore={result.rules.maxScore}/>:null})}
  <View className='result-section'><Text className='section-heading'>事实认定</Text>{out.facts.map((f,i)=><View className='finding' key={i}><Text className='fact-tag'>{categories[f.category]}</Text><Text>{f.text}</Text><Text className='reference'>依据：{f.refs.map(refLabel).join(' · ')}</Text></View>)}</View>
  {findings('判决理由',out.reasoning)}
  {out.seriousFaults.length>0&&findings('需要单独关注的重大问题',out.seriousFaults)}
  {findings('甲方的合理之处',out.reasonable.A)}{findings('乙方的合理之处',out.reasonable.B)}{findings('尚未确认的争议',out.uncertainties)}
  {(['A','B'] as const).map(s=><View key={s} className='result-section'><Text className='section-heading'>给{s==='A'?'甲方':'乙方'}的建议</Text>{out.suggestions[s].map((text,i)=><View key={i} className='suggestion'><Text className='suggestion-number'>0{i+1}</Text><Text>{text}</Text></View>)}</View>)}
  <View className='metadata'><Text>规则 {result.rules.version} · Prompt {result.promptVersion}</Text><Text>{result.model} · {result.durationMs} ms</Text><Text>非法律意见，无司法效力。仅根据所提交材料分析。</Text></View>
 </View>
}
