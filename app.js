const { chromium, firefox, webkit, devices } = require('playwright');
const fs = require('fs');
const uuid = require('uuid');

(async () => {

    const browser = await firefox.launch({
        headless: true, // 无头模式
    });

    try {

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
            serviceWorkers: 'block' // 禁用 Service Worker
        });

        // 设置 Cookie
        await context.addCookies([
            {
                name: 'sessionid',
                value: uuid.v4().replaceAll('-', ''),
                domain: '.douyin.com',
                path: '/',
                expires: Math.floor(Date.now() / 1000) + 3600 * 12 // 12 小时后过期
            }
        ]);

        // 创建新页面并访问网站
        const page = await context.newPage();

        // 拦截请求并阻止加载图片和视频流
        await page.route('**/*', async (route) => {
            const url = route.request().url();
            const request = route.request();
            const resourceType = request.resourceType();
            if (resourceType == 'image' || resourceType == 'media' || url.includes('.flv') || url.includes('/webcast/assets/effects/')) {
                //console.log(`阻止资源加载: ${url}`);
                route.abort();  // 阻止加载图片和视频
            }
            else if (url.includes('webcast/douyin_live/chunks') && url.includes('.js')) {
                // 获取原始响应内容
                const response = await route.fetch();
                let originalBody = await response.text();
                if (originalBody.includes('取消关注了主播') && originalBody.includes('送出了')) {
                    //console.log(url);
                    originalBody = originalBody.replace('"use strict";', `"use strict";console.log('1111：js注入成功!');`);
                    originalBody = originalBody.replaceAll('let{message:t}=e,', ' console.log("0000：" + JSON.stringify(e)); let{message:t}=e,');
                    // 返回修改后的内容
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/javascript',
                        body: originalBody
                    });
                }
                else {
                    route.continue();
                }
            }
            else {
                route.continue();  // 继续加载其他资源
            }
        });


        // 监听 'console' 事件
        let msg_ids = [];
        page.on('console', async msg => {
            // 获取消息类型 (log, info, warning, error, debug, etc.)
            //const type = msg.type();

            // 获取消息文本内容
            const text = msg.text();
            if (text.includes(`1111：`)) {
                console.log(text.replace('1111：', ''));
            }
            if (text.includes(`0000：`)) {
                let obj = JSON.parse(text.replace('0000：', ''));
                if (msg_ids.includes(obj.message.msg_id)) {
                    if (msg_ids.length >= 1000) msg_ids = [];
                    return;
                }
                msg_ids.push(obj.message.msg_id);

                if (obj.message.method == 'WebcastChatMessage')
                    console.log(`【${obj.message.payload.user.nickname}】 ${obj.message.payload.content} `);//聊天消息
                if (obj.message.method == 'WebcastMemberMessage')
                    console.log(`【${obj.message.payload.user.nickname}】 来了`);//来人消息
                if (obj.message.method == 'WebcastLikeMessage')
                    console.log(`【${obj.message.payload.user.nickname}】 点赞`);//点赞消息
                if (obj.message.method == 'WebcastGiftMessage')
                    console.log(`【${obj.message.payload.user.nickname}】 ${obj.message.payload.common.describe.split(':')[1]} `);//礼物消息

            }
        });

        await page.goto('https://live.douyin.com/812195156626');//改成自己想看的主播直播地址
        await page.waitForTimeout(1000 * 5); // 等待 5 秒

        const element = await page.locator('.basicPlayer');
        await element.waitFor({ timeout: 1000 * 5 }); // 等待元素出现
        const text = await element.textContent();
        if (text.includes('直播已结束')) {
            console.log('直播已结束,退出程序....');
            await browser.close();
            return;
        }

        await page.evaluate(() => {
            const elements = document.querySelectorAll('.basicPlayer');
            elements.forEach(element => {
                element.remove();
            });
        });

        setInterval(async () => {
            //随机移动鼠标防止睡眠
            await page.mouse.move(Math.floor(Math.random() * 1000) + 1, Math.floor(Math.random() * 500) + 1);
            //console.log('*************随机移动鼠标防止睡眠', Math.floor(Math.random() * 1000) + 1, Math.floor(Math.random() * 500) + 1);
        }, 1000 * 60);

        process.on('exit', async () => {
            console.log('程序退出');
            await browser.close();
        })
        process.on('SIGINT', async () => {
            console.log('程序退出');
            await browser.close();
        })

    } catch (error) {
        console.log('出现错误:', error);
        await browser.close();
    }

})();
