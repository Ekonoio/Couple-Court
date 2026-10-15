import { defineConfig } from '@playwright/test'
import fs from 'node:fs'
export default defineConfig({
 testDir:'tests/e2e',outputDir:'test-results/e2e-traces',fullyParallel:false,workers:1,timeout:30000,retries:0,
 use:{baseURL:'http://127.0.0.1:3002',viewport:{width:390,height:844},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']}},
 webServer:{command:'npm exec tsx apps/server/src/index.ts',url:'http://127.0.0.1:3002/api/health',reuseExistingServer:false,env:{PORT:'3002',HOST:'127.0.0.1',DB_PATH:'.data/e2e.sqlite',NODE_ENV:'development',LLM_MODE:'mock',DEV_ACCESS_TOKEN:'e2e-dev-token',ALLOWED_ORIGINS:'http://127.0.0.1:3002'}},
 reporter:[['list'],['json',{outputFile:'test-results/e2e-results.json'}]]
})
