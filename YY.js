const { chromium, firefox, webkit, devices } = require('playwright');

(async () => {

    const browser = await chromium.launch({
        headless: true, // 无头模式
    });

    try {

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
            serviceWorkers: 'block' // 禁用 Service Worker
        });

        // 创建新页面并访问网站
        const page = await context.newPage();

        // 拦截请求并阻止加载图片和视频流
        await page.route('**/*', async (route) => {
            const url = route.request().url();
            const request = route.request();
            const resourceType = request.resourceType();
            if (resourceType == 'image' || resourceType == 'media' || url.includes('.flv')) {
                //console.log(`阻止资源加载: ${url}`);
                route.abort();  // 阻止加载图片和视频
            }
            else if (url.includes('.js')) {
                //console.log(url);
                // 获取原始响应内容
                const response = await route.fetch();
                let originalBody = await response.text();
                if (originalBody.includes('抱歉，不能自己送给自己哦！') && originalBody.includes('对不起，月票只能送给签约歌手哦~，选择其他礼物赠送吧！')) {
                    //console.log(url);
                    originalBody = `console.log('1111：js注入成功!');` + originalBody;
                    originalBody = originalBody.replaceAll('id:"chatroom-list"},f.map((function(e,t){', `id:"chatroom-list"},f.map((function(e,t){ console.log("0000：" + JSON.stringify(e)); `);

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
                route.continue();  // 继续加载其他资源 console.log("0000：11111");
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
                //console.log(text);

                let obj = JSON.parse(text.replace('0000：', ''));
                if (msg_ids.includes(obj.uuid)) {
                    if (msg_ids.length >= 1000) msg_ids = [];
                    return;
                }
                msg_ids.push(obj.uuid);
                if (obj.msgType == "") {
                    console.log(`【聊天】${obj.nickname}：${obj.texts.toString()} `);//聊天消息
                }
            }
        });

        await page.goto('https://www.yy.com/76403344');//改成自己想看的主播直播地址
        await page.waitForTimeout(1000 * 5); // 等待 5 秒


        await page.evaluate(() => {

            const elements = document.querySelectorAll('.chat-room__list');
            elements.forEach(element => {
                element.remove();
            });

        });

        setInterval(async () => {
            for (let i = 0; i < 3; i++) {
                //随机移动鼠标防止睡眠
                await page.mouse.move(Math.floor(Math.random() * 1000) + 1, Math.floor(Math.random() * 500) + 1);
                //console.log('*************随机移动鼠标防止睡眠', Math.floor(Math.random() * 1000) + 1, Math.floor(Math.random() * 500) + 1);
                await page.waitForTimeout(100);
            }

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
