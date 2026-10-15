import type { Fixture, JudgeOutput, Material, Statement } from '@court/shared'

const say = (happened:string, extra:Partial<Statement>={}):Statement => ({why:'',happened,disagreement:'',discomfort:'',ownFault:'',resolution:'希望把事情讲清楚',...extra})
const examples = [
 ['needs','只是需求不同','甲方想周末独处，乙方想一起出门，双方都尊重对方的选择。','我们事前没有约定，我想在家休息，也愿意明天一起吃饭。','我们没有约定一定出门，我希望见面但尊重对方休息。',[0,0,0,0],[0,0,0,0],'none'],
 ['boundary','单方越界行为','双方承认甲方未经同意翻看乙方手机并删除联系人。','我未经同意查看了手机，还删除了乙方的朋友，我承认这不合适。','甲方未经我同意翻看手机并删除朋友，我没有辱骂或威胁。',[4,0,0,0],[0,0,0,0],'A'],
 ['both','双方都有过错','双方承认甲方辱骂，乙方摔坏了甲方的杯子。','我先说你是废物，乙方摔了我的杯子。我承认我骂人。','甲方骂我是废物，我摔了杯子。我承认摔杯子不对。',[0,0,3,0],[3,0,0,0],'close'],
 ['misunderstanding','语言误解','双方把“晚点再说”理解成不同含义，解释后接受对方意思。','我说晚点再说只是要开会，没有拒绝沟通。','我误以为对方不想谈，澄清后接受解释，没有继续指责。',[0,0,0,0],[0,0,0,0],'none'],
 ['promise','违反明确约定','双方事前约定晚八点告知是否回家吃饭，甲方承认故意没有告知。','我答应八点告知，但我故意没发消息，乙方等了很久。','我等到十点，对方没有按明确约定告知。我表达了失望。',[3,0,0,0],[0,0,0,0],'A'],
 ['contradiction','矛盾且缺少证据','是否提前约定归家时间，双方说法矛盾，无截图或其他材料。','我们明确约定八点回家。','我们从未约定八点回家。',[null,null,null,null],[null,null,null,null],'insufficient'],
 ['solo','仅有单方陈述','甲方独自参与，无法核实乙方的说法。','我觉得对方总是不重视我，但这只是我的感受。',null,[null,null,null,null],[null,null,null,null],'insufficient'],
 ['safety','现实安全风险','甲方称乙方拿刀威胁，不让其离开。该材料未独立核实。','对方拿刀威胁我，还不让我离开，我现在很害怕。','我情绪失控拿了刀。',[null,null,null,null],[null,null,null,null],'safety']
] as const

export const fixtures: Fixture[] = examples.map(([id,title,course,a,b,as,bs,expected])=>{
 const material:Material = {basics:{title,cause:'虚构案例，仅用于开发测试',course,outcome:'等待分析'},mode:b===null?'solo':'remote',statements:{A:say(a),...(b===null?{}:{B:say(b)})},evidence:[]}
 const unknown = expected==='insufficient'||expected==='safety'
 const output:JudgeOutput = {
  facts:[{category:b===null?'unilateral':unknown?'disputed':'agreed',text:course,refs:b===null?['A.happened']:['A.happened','B.happened']}],
  dimensions:['conduct','attribution','communication','resolution'].map((key,i)=>({id:key,
   A:{score:as[i],reason:as[i]===null?'虚构样例：材料不足或安全优先，本维度不评分。':as[i]!>0?'虚构样例：甲方承认的具体行为与本维度直接相关。':'虚构样例：已提供材料中未发现本维度明确不当行为。',refs:['A.happened'],behaviorIds:as[i]!>0?[`A-${key}`]:[]},
   B:{score:bs[i],reason:bs[i]===null?'虚构样例：缺少可靠材料或安全优先，不评分。':bs[i]!>0?'虚构样例：乙方承认的具体行为与本维度直接相关。':'虚构样例：已提供材料中未发现本维度明确不当行为。',refs:[b===null?'context.participation':'B.happened'],behaviorIds:bs[i]!>0?[`B-${key}`]:[]}})),
  reasoning:[{text:`虚构样例参考判断：${course} 本结果为测试参考值，并非模型推理。`,refs:['case.course']}],
  reasonable:{A:[{text:'愿意提供自己的陈述。',refs:['A.happened']}],B:b===null?[]:[{text:'愿意提供自己的陈述。',refs:['B.happened']}]},
  uncertainties:unknown?[{text:expected==='safety'?'安全风险需优先核实和处理，不作普通评分。':'材料有限，不能推定未证实的事实。',refs:['context.participation']}]:[],
  suggestions:{A:['先确保安全，再明确表达具体需求与边界。'],B:['尊重对方边界，回应具体事实。']},
  keyFactsSufficient:!unknown,seriousFaults:[],safety:{detected:expected==='safety',message:expected==='safety'?'请优先保障人身安全；如存在现实危险，联系当地警方或紧急服务。此处不认定犯罪。':'',refs:expected==='safety'?['A.happened']:[]}
 }
 return {id,title,description:course,material,expected,mockOutput:output}
})

export function swapFixture(fixture:Fixture):Fixture {
 if (!fixture.material.statements.B) throw new Error('单方案例不能交换身份')
 const swapText=(text:string)=>text.replace(/甲方|乙方/g,t=>t==='甲方'?'乙方':'甲方')
 const swapStatement=(s:Statement)=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,swapText(v)])) as Statement
 const swapRefs=(refs:string[])=>refs.map(r=>r.startsWith('A.')?'B.'+r.slice(2):r.startsWith('B.')?'A.'+r.slice(2):r)
 const swapFind=(v:{text:string;refs:string[]})=>({...v,text:swapText(v.text),refs:swapRefs(v.refs)})
 const o=structuredClone(fixture.mockOutput)
 o.dimensions=o.dimensions.map(d=>({id:d.id,A:{...d.B,reason:swapText(d.B.reason),refs:swapRefs(d.B.refs),behaviorIds:d.B.behaviorIds.map(v=>'swapped-'+v)},B:{...d.A,reason:swapText(d.A.reason),refs:swapRefs(d.A.refs),behaviorIds:d.A.behaviorIds.map(v=>'swapped-'+v)}}))
 o.facts=o.facts.map(swapFind) as JudgeOutput['facts'];o.reasoning=o.reasoning.map(swapFind);o.uncertainties=o.uncertainties.map(swapFind);o.seriousFaults=o.seriousFaults.map(swapFind)
 o.reasonable={A:o.reasonable.B.map(swapFind),B:o.reasonable.A.map(swapFind)}
 o.suggestions={A:o.suggestions.B,B:o.suggestions.A};o.safety.refs=swapRefs(o.safety.refs)
 return {...fixture,material:{...fixture.material,basics:Object.fromEntries(Object.entries(fixture.material.basics).map(([k,v])=>[k,swapText(v)])) as Material['basics'],statements:{A:swapStatement(fixture.material.statements.B),B:swapStatement(fixture.material.statements.A)},evidence:fixture.material.evidence.map(e=>({...e,owner:e.owner==='A'?'B':'A',left:e.left==='A'?'B':'A',right:e.right==='A'?'B':'A',note:swapText(e.note)}))},expected:fixture.expected==='A'?'B':fixture.expected==='B'?'A':fixture.expected,mockOutput:o}
}
