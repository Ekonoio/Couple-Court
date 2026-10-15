import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
import {config} from 'dotenv'
config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true})
const file=fileURLToPath(new URL('../apps/miniapp/dist/weapp/project.config.json',import.meta.url))
const project=JSON.parse(fs.readFileSync(file,'utf8'))
if(process.env.WEAPP_APPID)project.appid=process.env.WEAPP_APPID
fs.writeFileSync(file,JSON.stringify(project,null,2)+'\n')
console.log('微信构建产物已生成；AppID '+(process.env.WEAPP_APPID?'来自服务端构建环境':'使用游客占位值，未进行真机验证'))
