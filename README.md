# 谱线 · DSP 学习台

一个纯静态的数字信号处理学习网站：系统笔记、公式速查、Canvas 交互实验、练习题与错题本。

- 无需后端、无需数据库、无需构建工具
- 中文界面，响应式，支持浅色 / 深色 / 跟随系统
- 公式使用本地 KaTeX 渲染，断网也能显示
- 学习进度、错题、练习记录保存在浏览器 `localStorage`

---

## 1. 在本机打开

> 不要直接双击 `index.html`。部分浏览器在 `file://` 下会限制字体、存储或脚本，建议用本地服务器。

### 方法 A：双击启动脚本（推荐）

双击 `start-server.bat`，它会：

1. 在项目目录启动 Python 静态服务器；
2. 自动打开 <http://127.0.0.1:8000/>。

关闭黑色命令行窗口即停止服务。

### 方法 B：命令行

```bash
cd dsp-site
python -m http.server 8000 --bind 127.0.0.1
```

然后浏览器访问 <http://127.0.0.1:8000/>。

> 需要 Python 3。没有 Python 也可以用 VS Code 的 Live Server 插件，或 `npx serve`。

---

## 2. 为什么别人打不开？

`127.0.0.1` / `localhost` 永远只指向“当前这台电脑”。你把地址发给别人，对方的 `127.0.0.1` 是他自己的电脑，所以打不开。

想让别人通过互联网访问，必须把整个 `dsp-site` 文件夹放到一个公开的静态托管服务上。下面任选一种。

### 方案 A：Netlify Drop（最快，推荐）

1. 打开 <https://app.netlify.com/drop>（免费注册 / 登录）。
2. 把整个 `dsp-site` 文件夹拖进页面（不是只拖 `index.html`）。
3. 等几秒，会得到一个 `https://随机名字.netlify.app` 的网址。
4. 把这个网址发给别人即可，手机也能打开。

以后修改：重新把文件夹拖一次，或把项目接到 GitHub 实现自动部署。

### 方案 B：GitHub Pages（适合长期维护、版本管理）

1. 在 GitHub 新建一个仓库。
2. 把 `dsp-site` **里面的内容**上传到仓库根目录，确保根目录能看到 `index.html`、`assets/`。
3. 仓库 `Settings → Pages`：
   - Source 选 `Deploy from a branch`
   - Branch 选 `main`，目录选 `/ (root)`
4. 访问 `https://你的用户名.github.io/仓库名/`。

本项目使用 hash 路由（地址形如 `#/notes/convolution`），不需要配置服务器重写规则。

### 方案 C：Vercel / Cloudflare Pages

- Framework Preset：`Other` 或 `None`
- Build Command：留空
- Output Directory：`.`（仓库根目录）
- 直接部署即可。

### 方案 D：同一 Wi-Fi 下临时给人看

双击 `start-server-lan.bat`，它会启动允许局域网访问的服务器并显示本机 IP，例如：

```text
http://192.168.1.23:8000/
```

同一个 Wi-Fi 下的电脑 / 手机可以访问。需要注意：

- Windows 防火墙弹窗要允许“专用网络”；
- 你的电脑必须一直开着，关掉命令行窗口服务就停了；
- 这仍然不是公网地址，外网访问不了。

---

## 3. 目录结构

```text
dsp-site/
├─ index.html                 # 页面外壳、侧栏、顶部栏、脚本入口
├─ start-server.bat           # 本机启动脚本
├─ start-server-lan.bat       # 局域网临时演示脚本
├─ README.md
└─ assets/
   ├─ css/style.css           # 设计系统、布局、深浅色主题、响应式
   ├─ img/favicon.svg         # Logo / 站点图标
   ├─ js/
   │  ├─ data-notes.js        # 6 个章节 + 31 篇笔记正文
   │  ├─ data-formulas.js     # 9 组共 56 条公式
   │  ├─ data-quiz.js         # 48 道练习题
   │  ├─ markdown.js          # 轻量 Markdown + KaTeX 渲染
   │  ├─ lab.js               # 5 个 Canvas 交互实验
   │  └─ app.js               # 路由、各页面视图、题库逻辑、主题等
   └─ vendor/katex/           # 本地 KaTeX（含字体），不要删
```

没有 `node_modules`，没有打包产物。改完文件刷新浏览器即可。

---

## 4. 怎么改内容

### 改笔记

编辑 `assets/js/data-notes.js`：

```js
{
  slug: "my-note",              // 唯一，会出现在 #/notes/my-note
  chapter: "basics",            // 必须是 CHAPTERS 里已有的 id
  title: "笔记标题",
  summary: "列表页显示的一句话摘要",
  minutes: 8,
  level: "基础",
  tags: ["标签1", "标签2"],
  body: String.raw`
## 小节标题

正文支持 **粗体**、*斜体*、列表、表格、引用块。

行内公式：$x[n]=\cos(\omega_0 n)$

独立公式：

$$
X[k]=\sum_{n=0}^{N-1}x[n]e^{-j2\pi kn/N}
$$

> [!tip] 提示
> 引用块支持 note / tip / warn / key 四种提示框。
`,
}
```

注意：

- `body` 里写反斜杠建议用 `String.raw`，避免 `\n`、`\t` 被 JavaScript 转义；
- 公式里的 `<`、`>` 已在渲染器中做转义处理，可以正常写 `$f<f_s$`；
- 新增章节时在 `CHAPTERS` 里加对象，并在笔记里引用相同的 `chapter` id。

### 改公式速查

编辑 `assets/js/data-formulas.js` 的 `FORMULA_GROUPS`。每项：

```js
{
  name: "公式名",
  tex: String.raw`H(e^{j\omega})=\sum_{n}h[n]e^{-j\omega n}`,
  note: "一句话解释",
}
```

### 改题库

编辑 `assets/js/data-quiz.js` 的 `QUIZ_BANK`：

```js
{
  id: "q49",                    // 唯一
  chapter: "filters",           // CHAPTERS 的 id
  difficulty: "基础",           // 基础 / 进阶
  question: String.raw`题干，支持 $公式$`,
  options: ["选项 A", "选项 B", "选项 C", "选项 D"],
  answer: 2,                    // 正确选项下标，从 0 开始
  explain: String.raw`解析文字，支持公式。`,
}
```

### 改颜色 / 字体 / 深浅色

编辑 `assets/css/style.css` 顶部 `:root` 与 `[data-theme="dark"]` 中的 CSS 变量，例如：

```css
:root {
  --primary: #1d4ed8;
  --cyan: #0891b2;
  --bg: #f4f7fd;
}
```

### 改交互实验

编辑 `assets/js/lab.js` 顶部的 `LABS` 数组。每个实验包含元信息、`render()`（HTML 结构）和 `init(root)`（Canvas 绘制与控件绑定）。公共绘图函数在文件后半部分。

### 改完内容不生效？

浏览器缓存。`index.html` 里给 CSS / JS 加了版本参数：

```html
<script src="assets/js/app.js?v=20261030"></script>
```

每次修改 `assets/js/*.js` 或 `style.css` 后，把 `?v=20261030` 改成任意新值（例如当天日期 `20261101`），再刷新，所有访客都会拿到新文件。

---

## 5. 数据说明

学习数据只存在当前浏览器、当前域名下，键名：

| 键 | 内容 |
| --- | --- |
| `spx.read` | 已读笔记与时间 |
| `spx.mistakes` | 错题及错误次数 |
| `spx.attempts` | 练习记录 |
| `spx.activity` | 学习动态 |
| `spx.theme` | 主题偏好 |
| `spx.readingSize` | 正文字号 |

注意：

- 换浏览器、换设备、清理浏览器数据都会丢失进度；
- `http://127.0.0.1:8000` 和 `https://xxx.netlify.app` 是两个不同域，进度不互通；
- 没有账号系统，也不会把任何数据上传到服务器。

---

## 6. 常见问题

**页面空白 / 样式全丢**
用本地服务器打开，确认 `assets/` 目录完整，且 `index.html` 与 `assets` 在同一级。

**公式显示成 `$$...$$` 原文**
确认 `assets/vendor/katex/` 存在，且 `index.html` 里 KaTeX 的脚本在业务脚本之前加载。

**别人打不开**
按第 2 节部署到 Netlify / GitHub Pages。`127.0.0.1` 不能分享。

**端口被占用**
把启动脚本里的 `8000` 改成 `8080` 等其他端口。

**手机上侧栏打不开**
点左上角菜单按钮；侧栏是抽屉式，点遮罩关闭。

**改完没变化**
提升 `?v=` 版本号，并强制刷新（`Ctrl + F5`）。

---

## 7. 交付与备份

- 源码目录：`dsp-site/`
- 可直接发送的压缩包：`谱线-DSP学习台.zip`
- 压缩包根目录就是站点根目录，解压后双击 `start-server.bat` 即可本地预览；也可以直接拖到 Netlify Drop 发布。

本项目没有第三方运行依赖；唯一需要保留的“库”是 `assets/vendor/katex/`。KaTeX 使用 MIT 许可证，许可证原文见 `assets/vendor/katex/LICENSE`。
