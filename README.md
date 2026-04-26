# NutriGuide｜專業營養衛教查詢系統

## 專案結構

```
nutriguide/
├── index.html          ← 網頁入口
├── package.json        ← 套件設定
├── vite.config.js      ← 建置設定
└── src/
    ├── main.jsx        ← React 掛載點
    └── App.jsx         ← 主程式（所有元件）
```

## 功能清單
- 🔍 即時食品搜尋（支援 FDA Excel 匯入）
- 📊 營養素儀表板（DRI% / 雷達圖 / 份量代換）
- 🚦 疾病交通燈號（一般老年 / 糖尿病 / 腎臟病 / 自訂）
- ⚖️ 食品並排比較（最多3項）
- 🍱 餐點計算器（含 TDEE 佔比）
- 👤 病人資料管理（localStorage 儲存）
- 🖨 衛教單列印 + HTML 下載存 PDF
- ✏️ 自訂疾病模式編輯器

---

## 部署方式

### 方法一：本機開發（推薦先測試）

**需求：** Node.js 18 以上（https://nodejs.org）

```bash
# 1. 進入專案資料夾
cd nutriguide

# 2. 安裝套件（只需執行一次）
npm install

# 3. 啟動開發伺服器
npm run dev
```

瀏覽器會自動開啟 http://localhost:3000

---

### 方法二：部署到 Vercel（免費，推薦院內使用）

1. 前往 https://github.com 註冊帳號（免費）
2. 建立新的 Repository，命名為 `nutriguide`
3. 上傳所有檔案（或用 git push）
4. 前往 https://vercel.com，用 GitHub 帳號登入
5. 點「New Project」→ 選剛剛的 Repository
6. 設定：
   - Framework Preset：**Vite**
   - Build Command：`npm run build`
   - Output Directory：`dist`
7. 點「Deploy」，約 1 分鐘完成
8. 取得網址，例如 `https://nutriguide.vercel.app`

---

### 方法三：部署到醫院內網（最安全）

**步驟 1：在任一電腦建置**
```bash
cd nutriguide
npm install
npm run build
```
會產生 `dist/` 資料夾，裡面是純靜態檔案（HTML + JS + CSS）

**步驟 2：複製到院內伺服器**
- 將整個 `dist/` 資料夾複製到院內 Web Server（IIS / Nginx / Apache）
- 設定任意路徑，例如 `/nutriguide/`
- 不需要後端，純靜態部署即可

**Nginx 設定範例：**
```nginx
server {
    listen 80;
    server_name 你的院內IP;
    root /var/www/nutriguide/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

### 方法四：直接用 npx 跑（最快，不用安裝 Node）

如果電腦已安裝 Node.js：
```bash
cd nutriguide
npx serve dist
```
開啟 http://localhost:3000

---

## 更新 FDA 資料

1. 至衛福部下載最新 Excel：
   https://consumer.fda.gov.tw/Food/TFND.aspx
2. 點系統右上角「匯入 FDA Excel」
3. 選擇下載的 .xlsx 檔案
4. 資料即時更新，不需重新部署

## 注意事項

- 病人資料儲存在瀏覽器 localStorage，**清除瀏覽器快取會遺失**
- 如需長久保存病人資料，建議定期在病人管理頁截圖備份
- 本系統純前端，**不上傳任何資料到網路**，符合病人隱私保護
