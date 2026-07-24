// 4K超分动漫网盘链接提取脚本
// 运行环境：Playwright MCP Server (@playwright/mcp@0.0.78)
// 在 Playwright browser_run_code_unsafe 中执行

async function extractAllLinks(page) {
  // 1. 关闭登录弹窗
  await page.waitForTimeout(2000);
  const popup = page.locator('.component-login-modal-pop').first();
  if (await popup.isVisible().catch(() => false)) {
    await popup.locator('button').first().click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // 2. 检测虚拟滚动容器尺寸
  const scrollInfo = await page.evaluate(() => {
    const c = document.querySelector('.virtual-list-container.gallery-view');
    return c
      ? { scrollHeight: c.scrollHeight, clientHeight: c.clientHeight }
      : { scrollHeight: 0, clientHeight: 0 };
  });

  // 3. 生成滚动位置（每9000px一步，覆盖全量）
  const positions = [];
  for (let i = 0; i <= scrollInfo.scrollHeight; i += 9000) {
    positions.push(i);
  }

  // 4. 逐位置滚动并提取
  const allEntries = new Map();

  for (const pos of positions) {
    await page.evaluate((s) => {
      const c = document.querySelector('.virtual-list-container.gallery-view');
      if (c) c.scrollTop = s;
    }, pos);
    await page.waitForTimeout(1500);

    const entries = await page.evaluate(() => {
      const result = [];
      // 拦截 window.open 以获取跳转 URL
      const origOpen = window.open;
      window.open = function (url) {
        const last = result[result.length - 1];
        if (last) last.url = url;
        return { close() {}, closed: true };
      };

      document.querySelectorAll('button').forEach((btn) => {
        const text = btn.textContent.trim();
        if (text.includes('夸克网盘') || text.includes('百度网盘')) {
          // 向上遍历 DOM 树查找动漫标题
          let el = btn.parentElement;
          let title = '';
          for (let i = 0; i < 14 && el; i++) {
            const firstDiv = el.querySelector(':scope > div');
            if (firstDiv) {
              const t = firstDiv.textContent.trim();
              if (
                t.length > 2 &&
                t.length < 80 &&
                !t.includes('链接') &&
                !t.includes('↓') &&
                !['标签', '备注', '放送星期', '最后修改时间', 'TMDB链接'].includes(t)
              ) {
                title = t;
              }
            }
            el = el.parentElement;
          }

          const type = text.includes('夸克') ? 'quark' : 'baidu';
          result.push({
            title: title || 'unknown',
            type,
            url: null,
          });

          // 模拟点击，window.open 会被上述 override 拦截
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });

      window.open = origOpen;
      return result;
    });

    // 5. 去重合并
    for (const e of entries) {
      if (e.url && e.title !== 'unknown') {
        if (!allEntries.has(e.title)) {
          allEntries.set(e.title, { quark: null, baidu: null });
        }
        const entry = allEntries.get(e.title);
        if (e.type === 'quark') entry.quark = e.url;
        if (e.type === 'baidu') entry.baidu = e.url;
      }
    }
  }

  // 6. 关闭弹窗后残留的新标签页
  const pages = page.context().pages();
  for (let i = pages.length - 1; i > 0; i--) {
    try { await pages[i].close(); } catch (e) {}
  }

  // 7. 输出结果
  const final = [];
  for (const [title, links] of allEntries) {
    final.push({ title, ...links });
  }

  return {
    scrollInfo,
    positions: positions.length,
    total: final.length,
    entries: final,
  };
}
