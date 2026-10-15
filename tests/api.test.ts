import { afterEach,describe,it,expect } from 'vitest'
import request from 'supertest'
import { createServer } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { createApp } from '../apps/server/src/app.js'
import type { ServerConfig } from '../apps/server/src/config.js'
import { Repository } from '../apps/server/src/repository.js'
import { fixtures } from './cases/index.js'
const config:ServerConfig={dbPath:':memory:',retentionDays:7,nodeEnv:'development',allowedOrigins:['http://localhost:10086'],devToken:'test-dev-capability',judge:{mode:'mock',provider:'openai-compatible',model:'test',baseUrl:'https://api.openai.com/v1'}}
const opened:Repository[]=[]
function app(c:ServerConfig=config){const result=createApp(c);opened.push(result.repo);return result}
afterEach(()=>{for(const r of opened.splice(0)){try{r.close()}catch{}}})
const statement=fixtures[0].material.statements.A
const submit=(happened:string)=>({statement:{...statement,happened},evidence:[]})
const bearer=(token:string)=>({Authorization:'Bearer '+token})
async function make(api:ReturnType<typeof request>,mode='remote') {const r=await api.post('/api/cases').send({basics:fixtures[0].material.basics,mode}).expect(201);return r.body as {credential:{caseId:string;token:string};inviteToken:string}}
describe('案件、角色与证据权限',()=>{
 it('异地双方独立提交，锁定原文，公开后审理幂等',async()=>{
  const {app:a}=app(),api=request(a),created=await make(api),{caseId:id,token:A}=created.credential,B=created.inviteToken
  expect(A).not.toBe(B);expect(A.length).toBeGreaterThanOrEqual(43)
  await api.get(`/api/cases/${id}`).expect(401);await api.get(`/api/cases/${id}`).set(bearer('wrong')).expect(403)
  const joined=await api.post('/api/invitations/accept').send({invite:B}).expect(200);expect(joined.body.role).toBe('B')
  await api.post(`/api/cases/${id}/judge`).set(bearer(A)).send({}).expect(409)
  const original=submit('仅甲方可见的陈述');await api.post(`/api/cases/${id}/submit`).set(bearer(A)).send(original).expect(200)
  const bv=await api.get(`/api/cases/${id}`).set(bearer(B)).expect(200);expect(bv.body.statements.A).toBeUndefined();expect(bv.body.role).toBe('B')
  await api.post(`/api/cases/${id}/submit`).set(bearer(A)).send(original).expect(200)
  await api.post(`/api/cases/${id}/submit`).set(bearer(A)).send(submit('试图修改')).expect(409)
  await api.post(`/api/cases/${id}/submit`).set(bearer(B)).send({...submit('乙方自己的陈述'),role:'A'}).expect(400)
  const ready=await api.post(`/api/cases/${id}/submit`).set(bearer(B)).send(submit('乙方自己的陈述')).expect(200)
  expect(ready.body.statements.A.happened).toBe('仅甲方可见的陈述');expect(ready.body.statements.B.happened).toBe('乙方自己的陈述');expect(ready.body.status).toBe('ready')
  const results=await Promise.all([api.post(`/api/cases/${id}/judge`).set(bearer(A)).send({}),api.post(`/api/cases/${id}/judge`).set(bearer(B)).send({})]);expect(results.map(r=>r.status)).toEqual([200,200]);expect(results[0].body.id).toBe(results[1].body.id)
  const repeated=await api.post(`/api/cases/${id}/judge`).set(bearer(A)).send({}).expect(200);expect(repeated.body.id).toBe(results[0].body.id)
 })
 it('同设备必须先锁定甲方，乙方看不到甲方未公开材料',async()=>{const {app:a}=app(),api=request(a),{credential:c}=await make(api,'same_device');const p=`/api/cases/${c.caseId}`;await api.post(p+'/handoff').set(bearer(c.token)).send({}).expect(409);await api.post(p+'/submit').set(bearer(c.token)).send(submit('甲方原文')).expect(200);const b=await api.post(p+'/handoff').set(bearer(c.token)).send({}).expect(200);const view=await api.get(p).set(bearer(b.body.token)).expect(200);expect(view.body.statements.A).toBeUndefined();expect(view.body.role).toBe('B');const done=await api.post(p+'/submit').set(bearer(b.body.token)).send(submit('乙方原文')).expect(200);expect(done.body.status).toBe('ready')})
 it('单方模式不要求乙方，明确报告局限',async()=>{const {app:a}=app(),api=request(a),{credential:c}=await make(api,'solo');await api.post(`/api/cases/${c.caseId}/submit`).set(bearer(c.token)).send(submit('我的主观感受')).expect(200);const result=await api.post(`/api/cases/${c.caseId}/judge`).set(bearer(c.token)).send({}).expect(200);expect(result.body.limitation).toContain('单方');expect(result.body.verdict).toBe('insufficient')})
 it('截图授权、人物必填、顺序、删除和案件隔离',async()=>{
  const {app:a,repo}=app(),api=request(a),c=await make(api),other=await make(api),id=c.credential.caseId,auth=bearer(c.credential.token)
  const png=await sharp({create:{width:20,height:20,channels:3,background:'#eee'}}).png().toBuffer()
  const one=await api.post(`/api/cases/${id}/evidence`).set(auth).attach('image',png,{filename:'one.png',contentType:'image/png'}).expect(201)
  const two=await api.post(`/api/cases/${id}/evidence`).set(auth).attach('image',png,{filename:'two.png',contentType:'image/png'}).expect(201)
  const eid=one.body.id,p=`/api/cases/${id}`
  await api.get(p+'/evidence/'+eid).expect(401);await api.get(p+'/evidence/'+eid).set(bearer(other.credential.token)).expect(403);await api.get(p+'/evidence/'+eid).set(bearer(c.inviteToken)).expect(404)
  await api.post(p+'/submit').set(auth).send({...submit('截图材料'),evidence:[{id:eid,left:'A',right:'A',note:''}]}).expect(400)
  await api.post(p+'/submit').set(auth).send({...submit('截图材料'),evidence:[{id:two.body.id,left:'B',right:'A',note:'先发生'},{id:eid,left:'A',right:'B',note:'后发生'}]}).expect(200)
  await api.delete(p+'/evidence/'+eid).set(auth).expect(409)
  await api.post(p+'/evidence').set(auth).attach('image',png,'new.png').expect(409)
  await api.post(p+'/submit').set(bearer(c.inviteToken)).send(submit('乙方陈述')).expect(200)
  const view=await api.get(p).set(bearer(c.inviteToken)).expect(200);expect(view.body.evidence.map((e:any)=>e.id)).toEqual([two.body.id,eid]);await api.get(p+'/evidence/'+eid).set(bearer(c.inviteToken)).expect(200).expect('Content-Type',/jpeg/)
  await api.delete(p).set(auth).expect(204);await api.get(p).set(auth).expect(404);expect((repo.db.prepare('SELECT count(*) n FROM evidence').get() as any).n).toBe(0)
 })
 it('拒绝伪装图片与其他案件的截图ID',async()=>{const {app:a}=app(),api=request(a),c=await make(api),p=`/api/cases/${c.credential.caseId}`;await api.post(p+'/evidence').set(bearer(c.credential.token)).attach('image',Buffer.from('<script>bad</script>'),'fake.png').expect(400);await api.post(p+'/submit').set(bearer(c.credential.token)).send({...submit('引用不存在材料'),evidence:[{id:'00000000-0000-4000-8000-000000000000',left:'A',right:'B',note:''}]}).expect(400)})
 it('SQLite重启后仍可恢复原陈述和双方权限',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'court-persist-')),file=path.join(dir,'court.sqlite');try{const first=createApp({...config,dbPath:file}),api=request(first.app),c=await make(api);await api.post(`/api/cases/${c.credential.caseId}/submit`).set(bearer(c.credential.token)).send(submit('持久化陈述')).expect(200);first.repo.close();const second=app({...config,dbPath:file});const saved=await request(second.app).get(`/api/cases/${c.credential.caseId}`).set(bearer(c.credential.token)).expect(200);expect(saved.body.statements.A.happened).toBe('持久化陈述');second.repo.close();opened.pop()}finally{fs.rmSync(dir,{recursive:true,force:true})}})
 it('保存期后自动清理案件和证据',async()=>{const {app:a,repo}=app(),c=await make(request(a));repo.db.prepare('UPDATE cases SET expires=? WHERE id=?').run('2000-01-01T00:00:00.000Z',c.credential.caseId);repo.cleanup();await request(a).get(`/api/cases/${c.credential.caseId}`).set(bearer(c.credential.token)).expect(404)})
})
describe('开发者隔离与回归',()=>{
 it('生产环境完全拒绝测试接口',async()=>{const {app:a}=app({...config,nodeEnv:'production'});await request(a).get('/api/dev/options').set('X-Dev-Token',config.devToken!).expect(404);await request(a).post('/api/dev/run').set('X-Dev-Token',config.devToken!).send({fixtureId:'needs',model:'mock'}).expect(404)})
 it('开发环境也需要独立凭证，并只能运行虚构案例',async()=>{const {app:a}=app(),api=request(a),h={'X-Dev-Token':config.devToken!};await api.get('/api/dev/options').expect(403);const options=await api.get('/api/dev/options').set(h).expect(200);expect(options.body.fixtures).toHaveLength(8);await api.post('/api/dev/run').set(h).send({fixtureId:'needs',model:'mock',caseId:'real-case'}).expect(400);const run=await api.post('/api/dev/run').set(h).send({fixtureId:'boundary',model:'mock',swapped:true}).expect(200);expect(run.body.result.verdict).toBe('B');await api.post(`/api/dev/runs/${run.body.id}/save`).set(h).send({}).expect(200);const saved=await api.get('/api/dev/runs?fixtureId=boundary&swapped=true').set(h).expect(200);expect(saved.body[0].saved).toBe(true);expect(saved.body[0].id).toBe(run.body.id)})
})
describe('真实接口路径（本地协议测试，不替代外部模型验收）',()=>{
 it('单次多模态请求携带Schema和图片；并发审理仅调用一次',async()=>{
  let calls=0,received:any
  const mockProvider=createServer(async(req,res)=>{calls++;let body='';for await(const chunk of req)body+=chunk;received=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(fixtures[0].mockOutput)}}],usage:{prompt_tokens:100,completion_tokens:20}}))})
  await new Promise<void>(resolve=>mockProvider.listen(0,'127.0.0.1',resolve));const address=mockProvider.address() as {port:number}
  try{const {app:a}=app({...config,judge:{...config.judge,mode:'real',apiKey:'local-test-only',baseUrl:`http://127.0.0.1:${address.port}`,inputPrice:1,outputPrice:2}}),api=request(a),c=await make(api),p=`/api/cases/${c.credential.caseId}`,auth=bearer(c.credential.token)
   const png=await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer();const image=await api.post(p+'/evidence').set(auth).attach('image',png,'chat.png').expect(201)
   await api.post(p+'/submit').set(auth).send({...submit('甲方陈述'),evidence:[{id:image.body.id,left:'A',right:'B',note:'测试图'}]}).expect(200);await api.post(p+'/submit').set(bearer(c.inviteToken)).send(submit('乙方陈述')).expect(200)
   const results=await Promise.all([api.post(p+'/judge').set(auth).send({}),api.post(p+'/judge').set(auth).send({})]);expect(results.every(r=>r.status===200)).toBe(true);expect(calls).toBe(1);expect(received.response_format.type).toBe('json_schema');expect(received.messages[1].content.some((v:any)=>v.type==='image_url')).toBe(true);expect(results[0].body.mock).toBe(false);expect(results[0].body.totals).toEqual({A:0,B:0});expect(results[0].body.estimatedCost).toBeCloseTo(0.00014)
  }finally{await new Promise<void>(resolve=>mockProvider.close(()=>resolve()))}
 })
 it('模型输出损坏时返回明确错误，不保存伪造判决',async()=>{const provider=createServer((_q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({choices:[{message:{content:'{"bad":true}'}}]}))});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));try{const port=(provider.address() as any).port,{app:a,repo}=app({...config,judge:{...config.judge,mode:'real',apiKey:'local-test-only',baseUrl:`http://127.0.0.1:${port}`}}),api=request(a),c=await make(api,'solo'),p=`/api/cases/${c.credential.caseId}`,h=bearer(c.credential.token);await api.post(p+'/submit').set(h).send(submit('单方材料')).expect(200);const failed=await api.post(p+'/judge').set(h).send({}).expect(502);expect(failed.body.code).toBe('INVALID_MODEL_OUTPUT');expect(repo.view(c.credential.caseId,'A').judgment).toBeNull();expect(repo.view(c.credential.caseId,'A').status).toBe('ready')}finally{await new Promise<void>(r=>provider.close(()=>r()))}})
})
