import { defineConfig } from '@tarojs/cli'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
loadEnv({path:path.resolve(__dirname,'../../../.env'),quiet:true})
const sharedSource=path.resolve(__dirname,'../../../packages/shared')

export default defineConfig({
 projectName:'couple-court',date:'2026-10-15',designWidth:375,deviceRatio:{375:2,640:1.17,750:1,828:0.905},
 sourceRoot:'src',outputRoot:`dist/${process.env.TARO_ENV||'weapp'}`,
 framework:'react',compiler:{type:'webpack5',prebundle:{enable:false}},cache:{enable:false},
 plugins:['@tarojs/plugin-platform-weapp','@tarojs/plugin-platform-h5'],
 defineConstants:{'process.env.TARO_APP_API_BASE':JSON.stringify(process.env.TARO_APP_API_BASE||''),'process.env.TARO_APP_DEVTOOLS':JSON.stringify(process.env.TARO_APP_DEVTOOLS||'0')},
 alias:{'@court/shared':path.resolve(sharedSource,'src/index.ts'),'@tarojs/plugin-framework-react':path.dirname(require.resolve('@tarojs/plugin-framework-react/package.json')),'@tarojs/router':path.dirname(require.resolve('@tarojs/router/package.json'))},
 mini:{compile:{include:[sharedSource]},postcss:{pxtransform:{enable:true},cssModules:{enable:false}}},
 h5:{publicPath:'/',staticDirectory:'static',router:{mode:'hash'},
  devServer:{host:'127.0.0.1',port:10086,proxy:[{context:['/api'],target:'http://127.0.0.1:3001'}]},
  compile:{include:[sharedSource]},postcss:{pxtransform:{enable:true},autoprefixer:{enable:true}}
 },
 logger:{quiet:false,stats:false}
})
