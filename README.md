# 4K超分动漫网盘链接提取工具

自动化浏览器操作工具，从金山文档分享页面视觉定位提取动漫标题及对应网盘（夸克/百度）分享链接。

## 技术方案

- **浏览器引擎**: Playwright + Chromium-1228
- **交互方式**: MCP Server (`@playwright/mcp@0.0.78`)
- **运行环境**: MonkeyCode AI Coding Agent
- **页面定位**: 纯视觉/文本匹配，不解析 HTML、不调用 API、不逆向网页

## 核心流程

1. 打开金山文档分享链接，自动关闭登录弹窗
2. 分段滚动虚拟列表容器，加载全部条目
3. 通过 `window.open` override 拦截所有 `MouseEvent` 触发的中间跳转 URL
4. 从跳转 URL (`kdocs.cn/office/link?target=...`) 中反解析出真实网盘链接
5. 多滚动位置去重合并，输出动漫标题-夸克链接-百度链接对照表

## 提取脚本

### 1. 检测页面容器
```javascript
const c = document.querySelector('.virtual-list-container.gallery-view');
const info = { scrollHeight: c.scrollHeight, clientHeight: c.clientHeight };
```

### 2. 分段滚动 + 拦截提取
```javascript
const positions = [];
for (let i = 0; i <= scrollHeight; i += 9000) positions.push(i);

for (const pos of positions) {
  // 滚动到指定位置
  page.evaluate(s => {
    const c = document.querySelector('.virtual-list-container.gallery-view');
    if (c) c.scrollTop = s;
  }, pos);
  await page.waitForTimeout(1500);

  // 提取当前可见区域的链接
  const entries = await page.evaluate(() => {
    const result = [];
    const origOpen = window.open;
    window.open = function(url) {
      const last = result[result.length - 1];
      if (last) last.url = url;
      return { close() {}, closed: true };
    };

    document.querySelectorAll('button').forEach(btn => {
      const text = btn.textContent.trim();
      if (text.includes('夸克网盘') || text.includes('百度网盘')) {
        // 向上遍历 DOM 树查找动漫标题
        let el = btn.parentElement;
        let title = '';
        for (let i = 0; i < 14 && el; i++) {
          const firstDiv = el.querySelector(':scope > div');
          if (firstDiv) {
            const t = firstDiv.textContent.trim();
            if (t.length > 2 && t.length < 80 && !t.includes('链接') && !t.includes('↓') &&
                !['标签', '备注', '放送星期', '最后修改时间', 'TMDB链接'].includes(t)) {
              title = t;
            }
          }
          el = el.parentElement;
        }
        result.push({ title, type: text.includes('夸克') ? 'quark' : 'baidu', url: null });
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    window.open = origOpen;
    return result;
  });
}
```

### 3. 关闭登录弹窗
```javascript
const popup = page.locator('.component-login-modal-pop').first();
if (await popup.isVisible().catch(() => false)) {
  await popup.locator('button').first().click().catch(() => {});
}
```

## 文件结构

```
anime-links-extractor/
├── README.md              # 本文档
├── scripts/
│   └── extract.js          # 核心提取脚本
├── output/
│   ├── 四月新番.txt        # 41 条目
│   ├── 往期资源.txt        # 192 条目
│   ├── 一月新番.txt        # 30 条目
│   └── 七月新番.txt        # 32 条目
└── browser-operation/
    └── SKILL.md            # Playwright 浏览器操作 Skill 配置
```
