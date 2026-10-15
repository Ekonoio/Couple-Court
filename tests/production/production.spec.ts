import { test,expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
test('生产产物不包含测试页面，生产API拒绝测试凭证，普通案件仍可操作',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/');await expect(page.getByText('发起审理',{exact:false})).toBeVisible();await expect(page.getByText('开发者实验室 →',{exact:true})).toHaveCount(0)
 const checkFiles=(dir:string)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())checkFiles(file);else if(file.endsWith('.js')){const text=fs.readFileSync(file,'utf8');expect(text).not.toContain('审判实验室');expect(text).not.toContain('/api/dev/run')}}}
 checkFiles('apps/miniapp/dist/h5');expect(JSON.parse(fs.readFileSync('apps/miniapp/dist/weapp/app.json','utf8')).pages).toEqual(['pages/index/index'])
 const denied=await page.request.get('/api/dev/options',{headers:{'X-Dev-Token':'production-test-token'}});expect(denied.status()).toBe(404)
 await page.getByText('发起审理',{exact:false}).click();await page.locator('input[placeholder="例如：周末的安排没有谈拢"]').fill('生产构建虚构验收');await page.locator('textarea[placeholder="事情是如何开始的？"]').fill('普通需求分歧');await page.locator('textarea[placeholder="按时间描述发生的具体事情"]').fill('彼此尊重，没有不当言行');await page.getByText('单方分析',{exact:true}).click();await page.getByText('我已知晓：',{exact:false}).click();await page.getByText('创建案件，开始甲方陈述',{exact:true}).click();await page.locator('textarea[placeholder="描述具体言行与经过，不确定的部分可以说明"]').fill('这是生产构建的虚构单方材料。');await page.getByText('提交并锁定甲方陈述',{exact:true}).click();await page.getByText('确认',{exact:true}).last().click();await page.getByText('材料齐备，开始审理',{exact:true}).click();await page.getByText('确认',{exact:true}).last().click();await expect(page.getByText('证据不足，无法确定主要过错方',{exact:true})).toBeVisible();await page.getByText('删除案件及关联图片',{exact:true}).click();await page.getByText('确认',{exact:true}).last().click();await expect(page.getByText('发起审理',{exact:false})).toBeVisible();expect(errors).toEqual([])
})
