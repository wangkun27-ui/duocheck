# DuoCheck 24小时外网免服务器部署指南

DuoCheck 现在已经完成了 **PostgreSQL 云数据库支持** 的升级！你可以直接利用免费云托管服务把网站上线到互联网上，实现 24 小时一直开放，并且不需要购买云服务器，完全免费。

主要使用两个免费平台：
1. **Supabase** — 提供免费的 PostgreSQL 数据库（数据永久保存，支持 2 个免费库）
2. **Render.com** — 提供免费的 Node.js 服务运行环境（24小时在线）

下面是超简单的三步部署教程：

---

## 🛠️ 第一步：将代码托管到 GitHub (私有/公有)

1. 在你的 GitHub 账号中新建一个仓库，名字可以叫 `duocheck`；
2. 将本地 `d:\Documents\code\duocheck` 目录下的代码提交并推送到该 GitHub 仓库中。
   *（提示：`.env`、本地临时 `uploads` 文件夹和 `node_modules` 不需要上传，已在配置中忽略）*

---

## 💾 第二步：获取免费的云数据库 (Supabase)

1. 浏览器打开并注册 [Supabase.com](https://supabase.com)；
2. 登录后点击 **"New Project"** 创建一个新项目：
   - **Name**: 输入 `duocheck-db`
   - **Database Password**: 输入一个你记得住的密码（避免使用特殊字符如 `@`、`/`，以免影响连接串解析）
   - **Region**: 选择靠近中国的地区（推荐 `Singapore` 新加坡 或 `Tokyo` 东京）
   - **Pricing Plan**: 选择 **Free** 免费套餐
3. 点击 **"Create new project"**，等待约 2 分钟数据库初始化完毕；
4. 页面左侧导航栏点击 **"Project Settings"** (齿轮图标) -> **"Database"**；
5. 下拉找到 **"Connection string"** (连接字符串)，选择 **URI** 标签，**复制**那串 `postgresql://...` 开头的地址。
   *（注意：把连接串里的 `[YOUR-PASSWORD]` 部分手动替换为你自己刚才设置的实际数据库密码）*

---

## 🚀 第三步：一键托管上线到 Render.com

1. 打开并注册 [Render.com](https://render.com)（可以直接用 GitHub 账号授权登录）；
2. 登录后点击右上角 **"New +"** 并选择 **"Web Service"**；
3. 选择 **"Build and deploy from a Git repository"**，然后授权连接你的 GitHub，选择刚才创建的 `duocheck` 仓库；
4. 填写基本配置：
   - **Name**: 比如 `duocheck`
   - **Region**: 比如 `Singapore` (与数据库同区域速度最快)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 在页面下方的 **"Advanced"** 板块中，点击 **"Add Environment Variable"** 添加环境变量：
   - **Key**: `DATABASE_URL`
   - **Value**: 填入你刚才在第二步中**替换密码后的 Supabase 数据库连接字符串**。
6. 点击最下方的 **"Create Web Service"**，Render 会自动下载你的代码、安装依赖并启动服务；
7. 部署成功后，页面左上方会显示你的专属公网网址，比如 `https://duocheck-xxxx.onrender.com`。

把这个网址发送给你的搭档，你们就可以在互联网上随时随地互相打卡和监督了！

---

## 💡 本地开发与调试
如果你想先在本地开发测试连接云端数据库：
1. 打开本地的 `d:\Documents\code\duocheck\.env` 文件；
2. 把刚才复制并替换完密码的 Supabase 连接串填入 `DATABASE_URL=` 后面，保存文件；
3. 在终端运行 `node server.js`，本地服务就会直接连接并初始化云端数据库，你可以在本地运行体验。
