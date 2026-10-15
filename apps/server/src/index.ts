import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
const config=loadConfig()
if(config.nodeEnv==='development'&&!config.devToken){const dir=path.dirname(path.resolve(config.dbPath));fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'dev-token');if(!fs.existsSync(file))fs.writeFileSync(file,randomBytes(32).toString('base64url'),{mode:0o600});config.devToken=fs.readFileSync(file,'utf8').trim()}
const {app,repo}=createApp(config)
const port=Number(process.env.PORT||3001),host=process.env.HOST||'127.0.0.1'
const server=app.listen(port,host,()=>console.log(`Couple Court API started on port ${port}; LLM mode=${config.judge.mode}; environment=${config.nodeEnv}.`))
const cleanup=setInterval(()=>repo.cleanup(),60*60*1000);cleanup.unref()
const stop=()=>{clearInterval(cleanup);server.close(()=>{repo.close();process.exit(0)})}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
