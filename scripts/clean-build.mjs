import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
const target=process.argv[2]
if(!['h5','weapp'].includes(target))throw new Error('Unknown build target')
fs.rmSync(fileURLToPath(new URL('../apps/miniapp/dist/'+target+'/',import.meta.url)),{recursive:true,force:true})
