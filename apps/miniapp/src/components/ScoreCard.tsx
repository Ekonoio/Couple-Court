import { Text,View } from '@tarojs/components'
import type { RuleConfig,JudgeOutput,Side } from '@court/shared'
import { refLabel } from './references'
export default function ScoreCard({rule,scores,maxScore}:{rule:RuleConfig['dimensions'][number];scores:JudgeOutput['dimensions'][number];maxScore:number}){
 return <View className='score-card'>
  <View className='score-title'>{rule.name}</View>
  {(['A','B'] as Side[]).map(side=><View key={side} className={'score-side side-'+side}>
   <View className='score-row'><Text className='side-label'>{side==='A'?'甲方':'乙方'}</Text><View className='score-cells'>{Array.from({length:maxScore},(_,i)=><View key={i} className={'score-cell '+(scores[side].score!==null&&i<scores[side].score!?'filled':'')}/>)}</View><Text className='score-number'>{scores[side].score===null?'不可评分':scores[side].score+' 分'}</Text></View>
   <Text className='score-reason'>{scores[side].reason}</Text><Text className='reference'>依据：{scores[side].refs.map(refLabel).join(' · ')}</Text>
  </View>)}
 </View>
}
