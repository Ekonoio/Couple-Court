import { test,expect,type Page } from '@playwright/test'
import sharp from 'sharp'
async function create(page:Page,mode:'same_device'|'solo'|'remote'='same_device'){
 await page.goto('/');await page.getByText('发起审理',{exact:false}).click()
 await page.locator('input[placeholder="例如：周末的安排没有谈拢"],textarea[placeholder="例如：周末的安排没有谈拢"]').fill('虚构：周末安排')
 await page.locator('input[placeholder="事情是如何开始的？"],textarea[placeholder="事情是如何开始的？"]').fill('双方对休息方式有不同想法。')
 await page.locator('input[placeholder="按时间描述发生的具体事情"],textarea[placeholder="按时间描述发生的具体事情"]').fill('甲方想在家，乙方想出门。双方都没有辱骂或威胁。')
 if(mode==='solo')await page.getByText('单方分析',{exact:true}).click()
 if(mode==='remote')await page.getByText('邀请对方',{exact:true}).click()
 await page.getByText('我已知晓：',{exact:false}).click()
 const created=page.waitForResponse(r=>r.url().endsWith('/api/cases')&&r.request().method()==='POST')
 await page.getByText('创建案件，开始甲方陈述',{exact:true}).click()
 return (await (await created).json()) as {credential:{caseId:string;token:string};inviteToken:string}
}
async function acceptModal(page:Page,action:()=>Promise<unknown>){await action();await page.getByText('确认',{exact:true}).last().click()}
async function submit(page:Page,side:'甲'|'乙',content:string){await page.locator('input[placeholder="描述具体言行与经过，不确定的部分可以说明"],textarea[placeholder="描述具体言行与经过，不确定的部分可以说明"]').fill(content);await acceptModal(page,()=>page.getByText(`提交并锁定${side}方陈述`,{exact:true}).click());await expect(page.getByText(`${side}方陈述已锁定`,{exact:true})).toBeVisible()}
test('H5同设备：双方独立填写、上传标注截图、锁定、审理与删除',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 const created=await create(page)
 const file=await sharp({create:{width:100,height:120,channels:3,background:'#d9e3d2'}}).png().toBuffer()
 const chooser=page.waitForEvent('filechooser');await page.getByText('＋ 添加聊天截图',{exact:true}).click();await (await chooser).setFiles({name:'fictional-chat.png',mimeType:'image/png',buffer:file})
 await expect(page.getByText('截图 1 · 左侧是谁？',{exact:true})).toBeVisible()
 await page.locator('.chip').filter({hasText:'甲方'}).click()
 await submit(page,'甲','我想在家休息，也愿意明天见面。')
 await acceptModal(page,()=>page.getByText('交给乙方，开始独立陈述',{exact:true}).click())
 await expect(page.getByText('乙方独立陈述',{exact:true})).toBeVisible();await expect(page.getByText('我想在家休息，也愿意明天见面。',{exact:true})).toHaveCount(0)
 await submit(page,'乙','我想一起出门，但没有强迫对方。')
 await acceptModal(page,()=>page.getByText('材料齐备，开始审理',{exact:true}).click())
 await expect(page.getByText('证据不足，无法确定主要过错方',{exact:true})).toBeVisible()
 await expect(page.getByText('MOCK 演示 · 未调用真实模型，不可作为实际判断',{exact:true})).toBeVisible()
 await expect(page.locator('.score-card')).toHaveCount(4);await expect(page.locator('.gallery-image')).toHaveCount(1)
 await page.screenshot({path:'test-results/same-device-judgment.png',fullPage:true})
 await acceptModal(page,()=>page.getByText('删除案件及关联图片',{exact:true}).click());await expect(page.getByText('发起审理',{exact:false})).toBeVisible()
 expect(errors).toEqual([])
 const deleted=await page.request.get(`/api/cases/${created.credential.caseId}`,{headers:{Authorization:'Bearer '+created.credential.token}});expect(deleted.status()).toBe(404)
})
test('H5单方：无需邀请，保留单方分析局限',async({page})=>{
 await create(page,'solo');await submit(page,'甲','我觉得对方不重视我，但无法确认对方的想法。');await acceptModal(page,()=>page.getByText('材料齐备，开始审理',{exact:true}).click());await expect(page.getByText('单方分析：缺少乙方陈述，',{exact:false})).toBeVisible();await expect(page.getByText('证据不足，无法确定主要过错方',{exact:true})).toBeVisible();await acceptModal(page,()=>page.getByText('删除案件及关联图片',{exact:true}).click())
})
test('H5异地：两个浏览器上下文邀请、隐藏陈述、刷新恢复',async({page,browser})=>{
 const c=await create(page,'remote');await submit(page,'甲','甲方尚未公开的原始文字。')
 const context=await browser.newContext({viewport:{width:390,height:844}}),b=await context.newPage()
 try{await b.goto(`http://127.0.0.1:3002/#/pages/index/index?invite=${c.inviteToken}`);await b.getByText('以乙方身份参与',{exact:true}).click();await expect(b.getByText('乙方独立陈述',{exact:true})).toBeVisible();await expect(b.getByText('甲方尚未公开的原始文字。',{exact:true})).toHaveCount(0);await b.reload();await expect(b.getByText('乙方独立陈述',{exact:true})).toBeVisible();await submit(b,'乙','乙方自己的独立原始文字。');await page.reload();await expect(page.getByText('乙方自己的独立原始文字。',{exact:true})).toBeVisible();await acceptModal(page,()=>page.getByText('材料齐备，开始审理',{exact:true}).click());await expect(page.getByText('证据不足，无法确定主要过错方',{exact:true})).toBeVisible();await acceptModal(page,()=>page.getByText('删除案件及关联图片',{exact:true}).click())}finally{await context.close()}
})
test('开发者页面：鉴权、案例、保存、原始输出与回归对比',async({page})=>{
 await page.goto('/');await page.getByText('开发者实验室 →',{exact:true}).click();await page.locator('input[placeholder="输入开发者凭证"],textarea[placeholder="输入开发者凭证"]').fill('e2e-dev-token');await page.getByText('进入实验室',{exact:true}).click();await expect(page.getByText('虚构案例',{exact:true})).toBeVisible();await page.getByText('运行审判',{exact:true}).click();await expect(page.getByText('暂无明显过错',{exact:true})).toBeVisible();await page.getByText('保存本次测试结果',{exact:true}).click();await expect(page.getByText('已保存为参考',{exact:true})).toBeVisible();await page.getByText('运行审判',{exact:true}).click();await expect(page.getByText('旧理由',{exact:true})).toBeVisible();await expect(page.getByText('原始结构化输出',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/developer-lab.png',fullPage:true})
})
test('手机首页无水平溢出，主要入口可操作',async({page})=>{await page.goto('/');await expect(page.getByText('发起审理',{exact:false})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/home-mobile.png',fullPage:true})})
