import { useEffect,useRef,useState } from 'react'
import { Button,Image,Input,Text,Textarea,View } from '@tarojs/components'
import { useLoad,useShareAppMessage } from '@tarojs/taro'
import type { Basics,CaseView,Credential,Mode,Statement,Submission,RuleConfig } from '@court/shared'
import { chooseImages,clearImages,clearInviteLocation,confirm,copy,invitationStorage,inviteLink,invitePath,navigateDev,preview,protectedImage,request,storage,upload } from '../../platform'
import JudgmentView from '../../components/JudgmentView'

const emptyBasics:Basics={title:'',cause:'',course:'',outcome:''}
const emptyStatement:Statement={why:'',happened:'',disagreement:'',discomfort:'',ownFault:'',resolution:''}
const questions:{key:keyof Statement;label:string;placeholder:string;required?:boolean}[]=[
 {key:'why',label:'你认为事情为什么发生？',placeholder:'你所理解的起因（选填）'},
 {key:'happened',label:'实际发生了什么？',placeholder:'描述具体言行与经过，不确定的部分可以说明',required:true},
 {key:'disagreement',label:'双方主要分歧是什么？',placeholder:'你们在哪一点上意见不同？（选填）'},
 {key:'discomfort',label:'哪些行为让你不舒服？为什么？',placeholder:'可以表达感受，也请说明对应行为（选填）'},
 {key:'ownFault',label:'你有没有处理不当的地方？',placeholder:'可以写没有，也可以坦诚说明（选填）'},
 {key:'resolution',label:'你希望如何解决？',placeholder:'一个具体、可行的期待（选填）'}]
type DraftImage={id:string;url:string;left:'A'|'B'|'';note:string}
function EvidenceGallery({credential,view}:{credential:Credential;view:CaseView}){
 const [urls,setUrls]=useState<Record<string,string>>({})
 const ids=view.evidence.map(e=>e.id).join(',')
 useEffect(()=>{let valid=true;Promise.all(view.evidence.map(async e=>[e.id,await protectedImage(credential,e.id)] as const)).then(items=>{if(valid)setUrls(Object.fromEntries(items))}).catch(()=>{});return()=>{valid=false}},[credential.token,ids])
 if(!view.evidence.length)return null
 return <View className='card'><Text className='section-heading'>已提交的截图 · {view.evidence.length} 张</Text><Text className='small muted'>双方完成提交后互相可见。点击预览。</Text><View className='gallery'>{view.evidence.map((e,i)=><View key={e.id} className='gallery-item'>{urls[e.id]&&<Image className='gallery-image' src={urls[e.id]} mode='aspectFill' onClick={()=>preview(Object.values(urls),urls[e.id])}/>}<Text className='small'>{i+1}. {e.owner==='A'?'甲':'乙'}方提交 · 左{e.left==='A'?'甲':'乙'}/右{e.right==='A'?'甲':'乙'}</Text><Text className='small muted'>{e.note}</Text><Text className='reference'>image:{e.id}</Text></View>)}</View></View>
}
export default function CourtPage(){
 const [screen,setScreen]=useState<'home'|'create'|'case'|'invite'>('home')
 const [credential,setCredential]=useState<Credential|null>(null),[view,setView]=useState<CaseView|null>(null)
 const [config,setConfig]=useState<{mode:string;model:string;rules:RuleConfig;retentionDays:number}|null>(null)
 const [basics,setBasics]=useState<Basics>(emptyBasics),[mode,setMode]=useState<Mode>('same_device'),[consent,setConsent]=useState(false)
 const [statement,setStatement]=useState<Statement>(emptyStatement),[images,setImages]=useState<DraftImage[]>([])
 const [invite,setInvite]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('')
 const actionLock=useRef(false)
 useLoad(params=>{
  request<any>('/api/config').then(setConfig).catch(()=>setError('暂时无法连接后端，请确认 API 已启动。'))
  if(params.invite){setInvite(params.invite);setScreen('invite');return}
  const saved=storage.get();if(saved){setCredential(saved);setScreen('case');request<CaseView>(`/api/cases/${saved.caseId}`,'GET',undefined,saved).then(setView).catch(e=>setError(e.message))}
 })
 useShareAppMessage(()=>{const token=invite||(credential?invitationStorage.get(credential.caseId):'');return {title:'邀请你参与情侣法庭 · 独立陈述',path:token?invitePath(token):'/pages/index/index'}})
 useEffect(()=>{if(!credential||!view||view.submitted[view.role])return;let valid=true;const missing=view.evidence.filter(e=>e.owner===view.role&&!images.some(i=>i.id===e.id));if(missing.length)Promise.all(missing.map(async e=>({id:e.id,url:await protectedImage(credential,e.id),left:'' as const,note:''}))).then(list=>{if(valid)setImages(prev=>[...prev,...list.filter(i=>!prev.some(p=>p.id===i.id))])}).catch(()=>{});return()=>{valid=false}},[credential?.token,view?.evidence.map(e=>e.id).join(',')])
 useEffect(()=>{
  if(!credential||!view||view.judgment)return
  const timer=setInterval(()=>{request<CaseView>(`/api/cases/${credential.caseId}`,'GET',undefined,credential).then(setView).catch(()=>{})},4000)
  return()=>clearInterval(timer)
 },[credential?.token,view?.status,view?.judgment?.id])
 async function act(fn:()=>Promise<void>){if(actionLock.current)return;actionLock.current=true;setBusy(true);setError('');setInfo('');try{await fn()}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试')}finally{actionLock.current=false;setBusy(false)}}
 async function enter(c:Credential){storage.set(c);setCredential(c);setStatement(emptyStatement);setImages([]);setView(await request<CaseView>(`/api/cases/${c.caseId}`,'GET',undefined,c));setScreen('case')}
 const create=()=>act(async()=>{
  if(!consent)throw new Error('请先阅读并确认材料处理说明。')
  if(!basics.title.trim()||!basics.cause.trim()||!basics.course.trim())throw new Error('请填写案件名称、起因和经过。')
  const r=await request<{credential:Credential;inviteToken:string|null}>('/api/cases','POST',{basics,mode});setInvite(r.inviteToken||'');if(r.inviteToken)invitationStorage.set(r.credential.caseId,r.inviteToken);await enter(r.credential)
 })
 const addImage=()=>act(async()=>{if(images.length>=6)throw new Error('每方最多上传6张截图。');if(!credential)return;const paths=await chooseImages();for(const p of paths){const e=await upload(credential,p);setImages(prev=>[...prev,{id:e.id,url:p,left:'',note:''}])}})
 const submit=()=>act(async()=>{
  if(!credential||!view)return;if(!statement.happened.trim())throw new Error('请至少填写“实际发生了什么”。');if(images.some(i=>!i.left))throw new Error('请标注每张截图左右两侧分别是谁。')
  if(!await confirm('提交后原始陈述和截图将锁定，不能修改；双方提交完成后，材料将对双方公开。'))return
  const submission:Submission={statement,evidence:images.map(i=>({id:i.id,left:i.left as 'A'|'B',right:i.left==='A'?'B':'A',note:i.note}))}
  setView(await request<CaseView>(`/api/cases/${credential.caseId}/submit`,'POST',submission,credential))
 })
 const judge=()=>act(async()=>{if(!credential)return;if(!await confirm(config?.mode==='real'?'本次审理会将案件描述、双方陈述与截图发送给配置的第三方模型服务商。请确认双方已同意。':'当前为 Mock 演示，不会调用真实模型；真实材料将显示不可评分。是否继续？'))return;await request(`/api/cases/${credential.caseId}/judge`,'POST',{},credential);setView(await request<CaseView>(`/api/cases/${credential.caseId}`,'GET',undefined,credential))})
 const reset=()=>{if(credential)invitationStorage.clear(credential.caseId);storage.clear();clearImages();setView(null);setCredential(null);setStatement(emptyStatement);setImages([]);setBasics(emptyBasics);setInvite('');setScreen('home');setError('');setInfo('')}
 const remove=()=>act(async()=>{if(!credential||!await confirm('将永久删除此案件、双方陈述、判决和关联截图，双方凭证也会失效。'))return;await request(`/api/cases/${credential.caseId}`,'DELETE',undefined,credential);reset();setInfo('案件和关联图片已删除。')})
 const roleName=view?.role==='B'?'乙方':'甲方',isSubmitted=view?view.submitted[view.role]:false
 const progress=view?.judgment?3:screen==='case'?2:1
 const activeInvite=invite||(credential?invitationStorage.get(credential.caseId):'')
 return <View className={'shell '+(screen==='home'?'home-shell':'')}>
  <View className='topbar'><View className='brand' onClick={()=>{if(screen==='create')setScreen('home')}}><View className='brand-mark'>衡</View><View><Text className='brand-name'>情侣法庭</Text><Text className='brand-en'>COUPLE COURT</Text></View></View><Text className='edition'>V1 / 私密审理</Text></View>
  {error&&<View className='notice error-notice'>{error}</View>}{info&&<View className='notice'>{info}</View>}
  {screen==='home'&&<View className='home-content'>
   <View className='hero'><View className='hero-kicker'><View className='status-dot'/><Text>让事实被看见，让感受被听见</Text></View><Text className='hero-title'>先把事情说清楚。<Text className='hero-title-accent'>再看，谁该退一步。</Text></Text><Text className='hero-copy'>为这一次争执，留出一个公平的空间。<Text className='block'>各自陈述、共同举证，依据同一套规则分析。</Text></Text><Button className='primary hero-button' onClick={()=>{setScreen('create');setError('')}}>发起审理 <Text>↗</Text></Button><Text className='hero-caption'>不评价人格 · 不强求和解 · 不默认各打五十大板</Text></View>
   <View className='court-illustration'><View className='illustration-circle'/><View className='scale-top'>＋</View><View className='scale-arm'/><View className='scale-stem'/><View className='scale-pan pan-a'>甲</View><View className='scale-pan pan-b'>乙</View><View className='scale-base'/><Text className='illustration-note'>同一把尺，独立衡量。</Text><View className='paper-stamp'>有据可循</View></View>
   <View className='home-principles'>{[['01','各自陈述','提交前，保留独立表达的空间。'],['02','依据材料','不把猜测当事实，争议可以保留。'],['03','明确结论','有错就指出，证据不足不强判。']].map(([n,t,d])=><View className='principle' key={n}><Text className='principle-number'>{n}</Text><Text className='principle-title'>{t}</Text><Text className='muted small'>{d}</Text></View>)}</View>
   <View className='home-footnote'><Text>这是关系争议分析工具，不是法律咨询，无司法效力。</Text><Text>如有现实人身危险，请优先联系当地警方或紧急服务。</Text></View>
   {process.env.TARO_APP_DEVTOOLS==='1'&&<Button className='text-button dev-entry' onClick={navigateDev}>开发者实验室 →</Button>}
  </View>}
  {screen==='create'&&<View className='flow-content'><View className='steps'>01 立案 <Text>——</Text> 02 独立陈述 <Text>——</Text> 03 审理</View><Text className='page-title'>这次，发生了什么？</Text><Text className='page-subtitle'>从具体的事件开始。这里允许有感受，也允许有不确定。</Text>
   <View className='card'><Text className='section-heading'>案件基本信息</Text>{([{key:'title',label:'案件名称',placeholder:'例如：周末的安排没有谈拢',required:true},{key:'cause',label:'起因',placeholder:'事情是如何开始的？',required:true},{key:'course',label:'经过',placeholder:'按时间描述发生的具体事情',required:true},{key:'outcome',label:'结果',placeholder:'目前是什么状态？（选填）',required:false}] as const).map(f=><View className='field' key={f.key}><Text className='field-label'>{f.label}{f.required&&<Text className='required'> *</Text>}</Text>{f.key==='title'?<Input className='input' placeholder={f.placeholder} maxlength={80} value={basics[f.key]} onInput={e=>setBasics({...basics,[f.key]:e.detail.value})}/>:<Textarea className='textarea' placeholder={f.placeholder} maxlength={2000} autoHeight value={basics[f.key]} onInput={e=>setBasics({...basics,[f.key]:e.detail.value})}/>}</View>)}<Text className='small muted'>聊天截图可在下一步随本人陈述上传。</Text></View>
   <View className='card'><Text className='section-heading'>如何参与</Text>{([['same_device','同一台手机','甲方提交锁定后，将手机交给乙方。'],['remote','邀请对方','生成邀请，对方在自己的设备上独立陈述。'],['solo','单方分析','不强制邀请；保留缺少另一方陈述的局限。']] as const).map(([id,title,desc])=><View key={id} className={'mode-option '+(mode===id?'selected':'')} onClick={()=>setMode(id)}><View className='radio'>{mode===id?'●':''}</View><View><Text className='mode-title'>{title}</Text><Text className='small muted block'>{desc}</Text></View></View>)}</View>
   <View className='privacy-card' onClick={()=>setConsent(!consent)}><Text className={'checkbox '+(consent?'checked':'')}>{consent?'✓':''}</Text><Text>我已知晓：真实模型模式下，材料会发送给第三方模型服务商。请仅提交有权使用的材料，并获得参与者同意。本地 Demo 默认保存 {config?.retentionDays||7} 天，可随时删除。</Text></View>
   <Button className='primary' loading={busy} disabled={busy} onClick={create}>创建案件，开始甲方陈述</Button><Button className='text-button' onClick={()=>setScreen('home')}>返回首页</Button>
  </View>}
  {screen==='invite'&&<View className='flow-content'><Text className='page-title'>留给你的陈述席。</Text><Text className='page-subtitle'>你将以乙方身份参与。提交前，双方不会看到对方尚未公开的陈述。</Text><View className='card'><Text>提交后，双方的正式材料会互相可见；无需认同对方的说法，即可进入审理。</Text><Text className='block muted small'>真实模型模式下，你的陈述和截图可能发送给第三方模型服务商处理。请仅在知晓并同意材料用途后参与。</Text><Text className='block muted small'>邀请是乙方的访问凭证，请勿转发。没有账号实名认证，仅供受信任参与者使用。</Text></View><Button className='primary' loading={busy} disabled={busy} onClick={()=>act(async()=>{const c=await request<Credential>('/api/invitations/accept','POST',{invite});await enter(c);clearInviteLocation()})}>以乙方身份参与</Button></View>}
  {screen==='case'&&(!view?<View className='card'><Text>正在读取案件…</Text><Button className='text-button' onClick={reset}>清除本机凭证并返回</Button></View>:<View className='flow-content'>
   <View className='steps'>01 已立案 <Text>——</Text> 02 {progress===3?'已提交':'独立陈述'} <Text>——</Text> 03 {progress===3?'审理完成':'审理'}</View><View className='case-title-row'><Text className='page-title'>{view.basics.title}</Text><Text className={'role-badge side-'+view.role}>{roleName}席</Text></View>
   <Text className='page-subtitle'>{view.mode==='solo'?'单方分析':view.mode==='same_device'?'同设备 · 双方独立提交':'异地参与 · 独立陈述'} · {view.id.slice(0,8)}</Text>
   <View className='case-summary'><Text className='field-label'>起因</Text><Text>{view.basics.cause}</Text><Text className='field-label'>经过</Text><Text>{view.basics.course}</Text>{view.basics.outcome&&<><Text className='field-label'>结果</Text><Text>{view.basics.outcome}</Text></>}</View>
   {!isSubmitted&&<><View className='notice small'>提交前请知晓：双方完成提交后，正式材料会互相可见。真实模型模式下，陈述和截图会发送给第三方模型服务商处理；请仅在知晓并同意后提交。默认保留 {config?.retentionDays||7} 天，可主动删除案件。</View><View className='card'><Text className='section-heading'>{roleName}独立陈述</Text><Text className='small muted'>只需必填具体经过，其余可简短作答。提交后不可修改。</Text>{questions.map((q,i)=><View className='field' key={q.key}><Text className='field-label'><Text className='question-number'>0{i+1}</Text> {q.label}{q.required&&<Text className='required'> *</Text>}</Text><Textarea className='textarea' placeholder={q.placeholder} autoHeight maxlength={2000} value={statement[q.key]} onInput={e=>setStatement({...statement,[q.key]:e.detail.value})}/></View>)}</View>
    <View className='card'><View className='section-header'><Text className='section-heading'>聊天截图</Text><Text className='small muted'>选填 · {images.length}/6</Text></View><Text className='small muted'>请标注人物，按时间排序。图片会压缩并移除元数据。</Text>
     {images.map((img,i)=><View className='image-draft' key={img.id}><View className='image-draft-head'><Image className='image-thumb' src={img.url} mode='aspectFill' onClick={()=>preview(images.map(e=>e.url),img.url)}/><View className='image-controls'><Text className='field-label'>截图 {i+1} · 左侧是谁？</Text><View className='chip-row'>{(['A','B'] as const).map(s=><Button key={s} className={'chip '+(img.left===s?'active':'')} onClick={()=>setImages(images.map(v=>v.id===img.id?{...v,left:s}:v))}>{s==='A'?'甲方':'乙方'}</Button>)}</View><Text className='small muted'>右侧：{img.left?(img.left==='A'?'乙方':'甲方'):'请先选择左侧'}</Text></View></View><Input className='input small' maxlength={200} placeholder='截图备注（选填）' value={img.note} onInput={e=>setImages(images.map(v=>v.id===img.id?{...v,note:e.detail.value}:v))}/><View className='chip-row'><Button className='text-button small' disabled={i===0||busy} onClick={()=>{const list=[...images];[list[i-1],list[i]]=[list[i],list[i-1]];setImages(list)}}>上移</Button><Button className='text-button small' disabled={i===images.length-1||busy} onClick={()=>{const list=[...images];[list[i+1],list[i]]=[list[i],list[i+1]];setImages(list)}}>下移</Button><Button className='text-button small delete-text' disabled={busy} onClick={()=>act(async()=>{await request(`/api/cases/${view.id}/evidence/${img.id}`,'DELETE',undefined,credential!);setImages(prev=>prev.filter(v=>v.id!==img.id))})}>移除</Button></View></View>)}
     <Button className='secondary upload-button' disabled={busy||images.length>=6} onClick={addImage}>＋ 添加聊天截图</Button>
    </View><Button className='primary' loading={busy} disabled={busy} onClick={submit}>提交并锁定{roleName}陈述</Button></>}
   {isSubmitted&&!view.judgment&&<View className='card status-card'><View className='status-icon'>✓</View><Text className='section-heading'>{roleName}陈述已锁定</Text><Text className='muted block'>{view.status==='collecting'?'等待另一方完成独立陈述。当前不展示对方未公开的材料。':'所需陈述已齐备，无需双方达成一致。'}</Text>
    {view.mode==='same_device'&&view.role==='A'&&!view.submitted.B&&<Button className='primary' loading={busy} disabled={busy} onClick={()=>act(async()=>{if(!await confirm('接下来请把手机交给乙方，乙方将使用独立权限填写。'))return;const c=await request<Credential>(`/api/cases/${view.id}/handoff`,'POST',{},credential!);await enter(c)})}>交给乙方，开始独立陈述</Button>}
    {view.mode==='remote'&&view.role==='A'&&!view.submitted.B&&activeInvite&&<><Button className='secondary' onClick={()=>act(async()=>{await copy(inviteLink(activeInvite));setInfo(process.env.TARO_ENV==='h5'?'邀请链接已复制。另一台设备需要能访问此服务地址。':'小程序邀请路径已复制；请优先使用微信分享。')})}>复制{process.env.TARO_ENV==='h5'?'H5邀请链接':'邀请路径'}</Button>{process.env.TARO_ENV==='weapp'&&<Button className='primary' openType='share'>分享小程序邀请</Button>}<Text className='small muted'>链接持有者拥有乙方权限，请只交给对方。</Text></>}
    {(view.status==='ready'||view.status==='judging')&&<Button className='primary' loading={busy||view.status==='judging'} disabled={busy||view.status==='judging'} onClick={judge}>{view.status==='judging'?'正在审理，请稍候':'材料齐备，开始审理'}</Button>}
   </View>}
   {view.judgment&&<JudgmentView result={view.judgment}/>}
   {isSubmitted&&(view.status!=='collecting'||view.mode==='solo')&&<View className='card'><Text className='section-heading'>双方已公开的原始陈述</Text>{(['A','B'] as const).map(side=>view.statements[side]?<View key={side} className='published-statement'><Text className='mode-title'>{side==='A'?'甲方':'乙方'}</Text>{questions.map(q=>view.statements[side]![q.key]&&<View key={q.key} className='finding'><Text className='small muted'>{q.label}</Text><Text className='block'>{view.statements[side]![q.key]}</Text><Text className='reference'>{side}.{q.key}</Text></View>)}</View>:null)}</View>}
   {credential&&isSubmitted&&<EvidenceGallery credential={credential} view={view}/>}
   <View className='case-footer'><Text className='small muted'>保存至 {view.expiresAt.slice(0,10)} · 凭证仅保存在当前设备</Text><Button className='text-button delete-text' disabled={busy||view.status==='judging'} onClick={remove}>删除案件及关联图片</Button><Button className='text-button' disabled={busy} onClick={async()=>{if(await confirm('返回首页会清除本机访问凭证。若未保留邀请，将无法重新访问此案件。请优先删除不需要的案件。'))reset()}}>清除本机凭证并返回</Button></View>
  </View>)}
  <View className='bottom-note'>以事实为依据，给关系留余地。</View>
 </View>
}
