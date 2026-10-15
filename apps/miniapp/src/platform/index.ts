import Taro from '@tarojs/taro'
import type { Credential } from '@court/shared'

export const API_BASE=process.env.TARO_APP_API_BASE||(process.env.TARO_ENV==='h5'?'':'http://127.0.0.1:3001')
const key='court-credential-v1'
export const storage={get:():Credential|null=>Taro.getStorageSync(key)||null,set:(v:Credential)=>Taro.setStorageSync(key,v),clear:()=>Taro.removeStorageSync(key)}
export const invitationStorage={get:(id:string):string=>Taro.getStorageSync('court-invite-'+id)||'',set:(id:string,value:string)=>Taro.setStorageSync('court-invite-'+id,value),clear:(id:string)=>Taro.removeStorageSync('court-invite-'+id)}
export const navigateDev=()=>Taro.navigateTo({url:'/pages/dev/index'})
export function invitePath(invite:string){return '/pages/index/index?invite='+encodeURIComponent(invite)}
export function inviteLink(invite:string){if(process.env.TARO_ENV==='h5')return window.location.origin+window.location.pathname+'#'+invitePath(invite);return invitePath(invite)}
export function clearInviteLocation(){if(process.env.TARO_ENV==='h5')window.history.replaceState(null,'',window.location.pathname+'#/pages/index/index')}
export async function copy(text:string){await Taro.setClipboardData({data:text})}
export async function chooseImages(){const r=await Taro.chooseImage({count:1,sizeType:['compressed'],sourceType:['album']});return r.tempFilePaths}
export async function preview(urls:string[],current:string){await Taro.previewImage({urls,current})}
export async function confirm(content:string){return (await Taro.showModal({title:'请确认',content,confirmText:'确认',confirmColor:'#245e50'})).confirm}
export async function request<T>(path:string,method:'GET'|'POST'|'DELETE'='GET',data?:unknown,credential?:Credential,devToken?:string):Promise<T>{
 const result=await Taro.request({url:API_BASE+path,method,data,timeout:110000,header:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential.token}:{}),...(devToken?{'X-Dev-Token':devToken}:{})}})
 if(result.statusCode<200||result.statusCode>=300)throw new Error(result.data?.message||`请求失败 (${result.statusCode})`)
 return result.data as T
}
export async function upload(credential:Credential,filePath:string){
 const r=await Taro.uploadFile({url:API_BASE+`/api/cases/${credential.caseId}/evidence`,filePath,name:'image',header:{Authorization:'Bearer '+credential.token}})
 const data=typeof r.data==='string'?JSON.parse(r.data):r.data
 if(r.statusCode!==201)throw new Error(data.message||'上传失败')
 return data as {id:string}
}
const imageCache=new Map<string,string>()
export async function protectedImage(credential:Credential,id:string):Promise<string>{
 const cacheKey=credential.token+':'+id
 if(imageCache.has(cacheKey))return imageCache.get(cacheKey)!
 const url=API_BASE+`/api/cases/${credential.caseId}/evidence/${id}`
 let local:string
 if(process.env.TARO_ENV==='h5'){
  const r=await fetch(url,{headers:{Authorization:'Bearer '+credential.token}})
  if(!r.ok)throw new Error('图片无权访问');local=URL.createObjectURL(await r.blob())
 }else{const r=await Taro.downloadFile({url,header:{Authorization:'Bearer '+credential.token}});if(r.statusCode!==200)throw new Error('图片读取失败');local=r.tempFilePath}
 imageCache.set(cacheKey,local);return local
}
export function clearImages(){if(process.env.TARO_ENV==='h5')for(const url of imageCache.values())URL.revokeObjectURL(url);imageCache.clear()}
