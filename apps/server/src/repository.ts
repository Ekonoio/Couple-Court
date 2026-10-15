import { DatabaseSync } from 'node:sqlite'
import { createHash,randomBytes,randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Basics,CaseView,Credential,Evidence,Judgment,Material,Mode,Side,Submission } from '@court/shared'

export class ApiError extends Error { constructor(public status:number,public code:string,message:string){super(message)} }
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const token=()=>randomBytes(32).toString('base64url')
export class Repository {
 db:DatabaseSync
 constructor(dbPath:string,private retentionDays=7){
  if(dbPath!==':memory:'){fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true,mode:0o700})}
  this.db=new DatabaseSync(dbPath)
  this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
  CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, basics TEXT NOT NULL,mode TEXT NOT NULL,a_hash TEXT NOT NULL,b_hash TEXT,status TEXT NOT NULL DEFAULT 'collecting',a_submission TEXT,b_submission TEXT,judgment TEXT,created TEXT NOT NULL,expires TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,owner TEXT NOT NULL,data BLOB NOT NULL,meta TEXT);
  CREATE TABLE IF NOT EXISTS dev_runs(id TEXT PRIMARY KEY,fixture_id TEXT NOT NULL,swapped INTEGER NOT NULL,result TEXT NOT NULL,saved INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);`)
  this.db.exec("UPDATE cases SET status='ready' WHERE status='judging'")
  this.cleanup()
  if(dbPath!==':memory:')fs.chmodSync(dbPath,0o600)
 }
 cleanup(){const cutoff=new Date().toISOString();this.db.prepare('DELETE FROM cases WHERE expires < ?').run(cutoff);this.db.prepare('DELETE FROM dev_runs WHERE created < ?').run(new Date(Date.now()-this.retentionDays*86400000).toISOString());this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')}
 close(){this.db.close()}
 private row(id:string):any {const row=this.db.prepare('SELECT * FROM cases WHERE id=?').get(id) as any;if(!row)throw new ApiError(404,'NOT_FOUND','案件不存在或已删除');if(row.expires<new Date().toISOString()){this.db.prepare('DELETE FROM cases WHERE id=?').run(id);throw new ApiError(410,'EXPIRED','案件已过保存期')}return row}
 create(basics:Basics,mode:Mode){const id=randomUUID(),a=token(),b=mode==='remote'?token():null,created=new Date().toISOString(),expires=new Date(Date.now()+this.retentionDays*86400000).toISOString();this.db.prepare('INSERT INTO cases(id,basics,mode,a_hash,b_hash,created,expires) VALUES(?,?,?,?,?,?,?)').run(id,JSON.stringify(basics),mode,hash(a),b?hash(b):null,created,expires);return {credential:{caseId:id,token:a,role:'A'} as Credential,inviteToken:b,expiresAt:expires}}
 auth(id:string,credential:string):Side {const row=this.row(id),h=hash(credential);if(h===row.a_hash)return 'A';if(h===row.b_hash)return 'B';throw new ApiError(403,'FORBIDDEN','案件凭证无效')}
 accept(invite:string):Credential {const row=this.db.prepare("SELECT id FROM cases WHERE b_hash=? AND mode='remote'").get(hash(invite)) as any;if(!row)throw new ApiError(404,'INVALID_INVITE','邀请无效或案件已删除');this.row(row.id);return {caseId:row.id,token:invite,role:'B'}}
 handoff(id:string,role:Side):Credential {const row=this.row(id);if(role!=='A'||row.mode!=='same_device'||!row.a_submission||row.b_submission)throw new ApiError(409,'INVALID_HANDOFF','当前不能切换乙方');const b=token();this.db.prepare('UPDATE cases SET b_hash=? WHERE id=?').run(hash(b),id);return {caseId:id,token:b,role:'B'}}
 view(id:string,role:Side):CaseView {const row=this.row(id),submitted={A:!!row.a_submission,B:!!row.b_submission},all=submitted.A&&(submitted.B||row.mode==='solo');const statements:CaseView['statements']={};for(const s of ['A','B'] as const)if(row[s==='A'?'a_submission':'b_submission']&&(all||s===role))statements[s]=JSON.parse(row[s==='A'?'a_submission':'b_submission']).statement;const evidence=this.db.prepare('SELECT id,owner,meta FROM evidence WHERE case_id=? ORDER BY rowid').all(id).filter((e:any)=>all||e.owner===role).map((e:any)=>({id:e.id,owner:e.owner,...(e.meta?JSON.parse(e.meta):{left:'A',right:'B',note:'',position:999})})) as Evidence[];evidence.sort((a,b)=>a.owner.localeCompare(b.owner)||a.position-b.position);return {id,basics:JSON.parse(row.basics),mode:row.mode,role,status:row.status,submitted,statements,evidence,judgment:row.judgment?JSON.parse(row.judgment):null,createdAt:row.created,expiresAt:row.expires}}
 upload(id:string,role:Side,data:Buffer){const row=this.row(id);if(row[role==='A'?'a_submission':'b_submission'])throw new ApiError(409,'LOCKED','陈述已锁定，不能再上传');const count=this.db.prepare('SELECT count(*) n FROM evidence WHERE case_id=? AND owner=?').get(id,role) as any;if(count.n>=6)throw new ApiError(400,'TOO_MANY_IMAGES','每方最多6张截图');const eid=randomUUID();this.db.prepare('INSERT INTO evidence(id,case_id,owner,data) VALUES(?,?,?,?)').run(eid,id,role,data);return {id:eid}}
 removeImage(id:string,role:Side,eid:string){const row=this.row(id);if(row[role==='A'?'a_submission':'b_submission'])throw new ApiError(409,'LOCKED','提交后不能删除证据');this.db.prepare('DELETE FROM evidence WHERE id=? AND case_id=? AND owner=?').run(eid,id,role)}
 image(id:string,role:Side,eid:string):Buffer {this.row(id);const visible=this.view(id,role).evidence.some(e=>e.id===eid);if(!visible)throw new ApiError(404,'NOT_FOUND','图片不存在或尚未公开');const row=this.db.prepare('SELECT data FROM evidence WHERE id=? AND case_id=?').get(eid,id) as any;return Buffer.from(row.data)}
 submit(id:string,role:Side,submission:Submission){const row=this.row(id),field=role==='A'?'a_submission':'b_submission',encoded=JSON.stringify(submission);if(row[field]){if(row[field]===encoded)return this.view(id,role);throw new ApiError(409,'LOCKED','已提交的原始陈述不能修改')}
 const own=this.db.prepare('SELECT id FROM evidence WHERE case_id=? AND owner=?').all(id,role) as {id:string}[]
 if(new Set(submission.evidence.map(e=>e.id)).size!==submission.evidence.length||submission.evidence.some(e=>!own.some(o=>o.id===e.id)))throw new ApiError(400,'INVALID_EVIDENCE','截图不属于当前角色或存在重复')
 this.db.exec('BEGIN IMMEDIATE')
 try{for(const e of own){const i=submission.evidence.findIndex(v=>v.id===e.id);if(i<0)this.db.prepare('DELETE FROM evidence WHERE id=?').run(e.id);else{const {left,right,note}=submission.evidence[i];this.db.prepare('UPDATE evidence SET meta=? WHERE id=?').run(JSON.stringify({left,right,note,position:i}),e.id)}}this.db.prepare(`UPDATE cases SET ${field}=? WHERE id=?`).run(encoded,id);const ready=role==='A'?(row.mode==='solo'||row.b_submission):row.a_submission;if(ready)this.db.prepare("UPDATE cases SET status='ready' WHERE id=?").run(id);this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}return this.view(id,role)}
 material(id:string):{material:Material;images:{id:string;data:Buffer}[]}{const v=this.view(id,'A');if(v.status==='collecting')throw new ApiError(409,'NOT_READY','请先完成所需的独立陈述');return {material:{basics:v.basics,mode:v.mode,statements:v.statements as Material['statements'],evidence:v.evidence},images:(this.db.prepare('SELECT id,data FROM evidence WHERE case_id=?').all(id) as any[]).map(e=>({id:e.id,data:Buffer.from(e.data)}))}}
 setJudging(id:string){this.db.prepare("UPDATE cases SET status='judging' WHERE id=? AND status='ready'").run(id)}
 saveJudgment(id:string,result:Judgment){const row=this.row(id);if(row.judgment)return JSON.parse(row.judgment) as Judgment;this.db.prepare("UPDATE cases SET judgment=?,status='judged' WHERE id=?").run(JSON.stringify(result),id);return result}
 judgeFailed(id:string){this.db.prepare("UPDATE cases SET status='ready' WHERE id=? AND status='judging'").run(id)}
 delete(id:string){this.db.prepare('DELETE FROM cases WHERE id=?').run(id);this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')}
 saveRun(fixtureId:string,swapped:boolean,result:Judgment){const id=randomUUID();this.db.prepare('INSERT INTO dev_runs(id,fixture_id,swapped,result,created) VALUES(?,?,?,?,?)').run(id,fixtureId,swapped?1:0,JSON.stringify(result),new Date().toISOString());return {id,fixtureId,swapped,result,saved:false}}
 pinRun(id:string){const r=this.db.prepare('UPDATE dev_runs SET saved=1 WHERE id=?').run(id);if(!r.changes)throw new ApiError(404,'NOT_FOUND','测试记录不存在')}
 runs(fixtureId:string,swapped:boolean){return (this.db.prepare('SELECT * FROM dev_runs WHERE fixture_id=? AND swapped=? ORDER BY created DESC LIMIT 30').all(fixtureId,swapped?1:0) as any[]).map(r=>({id:r.id,fixtureId:r.fixture_id,swapped:!!r.swapped,result:JSON.parse(r.result),saved:!!r.saved}))}
}
