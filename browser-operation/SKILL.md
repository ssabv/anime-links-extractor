---
name: browser-operation
description: 使用 Playwright 浏览器执行视觉交互任务。当用户需要打开网页、截图查看页面、模拟鼠标点击页面元素、处理弹窗和页面跳转、获取最终 URL 时触发。适用于网盘分享链接提取、金山文档分享页操作、网页内容视觉定位等场景。
---

# 浏览器操作 Skill

使用 Playwright MCP Server 提供的浏览器工具执行视觉交互任务。

## 核心工具

通过 `@playwright/mcp` 的 `--caps vision` 启用视觉能力后，Agent 获得以下关键工具：

### 页面导航
- `browser_navigate(url)` - 导航到指定 URL
- `browser_navigate_back` - 返回上一页

### 页面感知
- `browser_snapshot(target?, depth?, boxes?)` - 获取页面可访问性快照（结构化元素树，带 ref 引用，可用于定位和点击）
  - 设置 `boxes: true` 可获取每个元素的坐标位置
  - 是点击操作的首选定位方式
- `browser_take_screenshot(element?, target?, type?, filename?, fullPage?)` - 截图保存到文件
  - 设置 `fullPage: true` 可截取完整页面
  - 用于视觉确认页面状态
- `browser_find(text, regex?)` - 在页面快照中搜索文本

### 页面交互
- `browser_click(element?, target, doubleClick?, button?, modifiers?)` - 点击元素
  - `target` 参数使用 `browser_snapshot` 返回的 ref 值
  - `element` 参数是给人类的说明文字（用于权限确认）
- `browser_type(element?, target, text, submit?, slowly?)` - 文本输入
- `browser_press_key(key)` - 按键操作
- `browser_hover(element?, target)` - 鼠标悬停
- `browser_select_option(element?, target, values)` - 下拉选择
- `browser_handle_dialog(accept, promptText?)` - 处理浏览器对话框
- `browser_wait_for(time?, text?, textGone?)` - 等待条件

### 标签页管理
- `browser_tabs(action, index?, url?)` - 管理标签页
  - action: list / new / close / select
  - 点击链接后可能在新标签页打开，需要切换

### JS 执行
- `browser_evaluate(element?, target?, function, filename?)` - 执行 JavaScript
  - 用于读取 URL、操作剪贴板等

### 网络监控
- `browser_network_requests(static?, filter?)` - 列出自页面加载以来的网络请求
- `browser_network_request(index, part?)` - 获取单个请求详情

### 控制台
- `browser_console_messages(level?, all?)` - 获取控制台消息

## 网盘分享链接提取工作流

用户提供金山文档分享页面 URL 时，执行以下流程：

### 1. 打开目标页面

```
browser_navigate(url: "用户提供的金山文档分享URL")
```

### 2. 等待页面加载

```
browser_wait_for(time: 3)
```

### 3. 获取页面快照

```
browser_snapshot(boxes: true)
```

从快照中搜索绿色网盘按钮的关键文本：
- "夸克网盘"
- "百度网盘"
- "网盘下载"
- "禁止转载"

使用 `browser_find(text: "夸克网盘")` 或 `browser_find(text: "百度网盘")` 快速定位。

### 4. 滚动到按钮位置（如需要）

如果按钮不在当前可见区域，使用 `browser_evaluate` 滚动：

```
browser_evaluate(function: "() => { window.scrollBy(0, 300); }")
```

滚动后重新获取快照确认按钮可见。

### 5. 截图确认

```
browser_take_screenshot(filename: "page-before-click.png")
```

便于视觉确认按钮位置和样式。

### 6. 点击网盘按钮

使用快照中按钮元素的 ref 值：

```
browser_click(
  element: "绿色按钮上的夸克网盘链接",
  target: "<快照中的ref值>"
)
```

### 7. 处理点击后的结果

**场景A：新标签页打开**
```
browser_tabs(action: "list")
browser_tabs(action: "select", index: <新标签页索引>)
```
然后在新标签页中获取 URL。

**场景B：当前页面跳转**
```
browser_wait_for(time: 3)
browser_evaluate(function: "() => window.location.href")
```

**场景C：弹窗出现**
- 使用 `browser_take_screenshot` 截图分析弹窗内容
- 使用 `browser_snapshot` 获取弹窗中的元素
- 在弹窗中找到链接或复制按钮并点击
- 如有关闭按钮，使用 `browser_handle_dialog`

**场景D：复制到剪贴板**
```
browser_evaluate(function: "() => navigator.clipboard.readText()")
```

### 8. 获取最终链接

```
browser_evaluate(function: "() => window.location.href")
```

## 错误处理

### 弹窗/对话框
页面可能出现以下弹窗：
- "请先登录" -- 查找"游客模式"或"跳过"按钮
- "确定要离开" -- 使用 `browser_handle_dialog(accept: true)`
- 广告弹窗 -- 截图确认后关闭

### 人机验证
如果遇到验证码，截图保存并报告用户。不要尝试绕过。

### 网络超时
增加 `browser_wait_for(time: 5)` 等待时间，或重试导航。

## 注意事项

- 使用 `browser_snapshot` 定位元素后，用 `browser_click` 精确点击
- `browser_snapshot` 返回的 ref 是点击的精确引用，不要自己构造
- 截图用于视觉确认和理解，action 始终基于 snapshot
- 每次操作后获取新 snapshot，因为 ref 值随着页面变化而失效
- 所有操作基于结构化快照，不分析底层 HTML 源码
