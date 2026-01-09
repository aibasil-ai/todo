# Todo List 應用程式

一個簡潔的待辦事項管理應用程式，使用純 JavaScript 開發，並整合 Google Sheets 作為雲端資料庫。

## ✨ 功能特色

- 📝 新增/刪除待辦事項
- ✅ 勾選完成狀態
- 📊 依優先權排序（無 > 高 > 中 > 低）
- 🎨 優先權色彩標示（紅/橘/綠/灰）
- 📅 自動記錄建立日期
- ☁️ Google Sheets 雲端同步
- ⚙️ 可自訂 Google Script URL

## 🚀 快速開始

### 1. 設定 Google Apps Script

1. 開啟您的 [Google Sheets](https://sheets.google.com)
2. 點選「擴充功能」>「Apps Script」
3. 複製 `google-apps-script.js` 的內容貼入
4. 儲存並部署為「網頁應用程式」
   - 執行身分：我
   - 誰可以存取：所有人
5. 複製 Web App URL

### 2. 設定前端

1. 開啟 `index.html`
2. 點擊右上角 ⚙️ 設定按鈕
3. 貼上 Web App URL 並儲存

## 📁 檔案結構

```
todo-js/
├── index.html              # 主頁面
├── app.js                  # 前端邏輯
├── style.css               # 樣式
├── google-apps-script.js   # Google Apps Script 後端程式碼
├── package.json            # 專案資訊
└── README.md               # 本文件
```

## 📊 Google Sheets 欄位對應

| 欄位 | 內容 |
|------|------|
| A - 紀錄日期 | 自動填入 `YYYY-MM-DD HH:mm:ss` |
| B - 待辦事項 | Todo 名稱 |
| C - 優先權 | 高/中/低 |
| D - 完成日期 | （暫未使用） |
| E - 檢查狀態 | 勾選狀態 |
| F - 備註 | Todo 描述 |
| G - ID | 唯一識別碼（自動產生） |

## ⌨️ 快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Enter` | 在名稱輸入框送出 |
| `Ctrl+Enter` | 在任意輸入框送出 |

## 🔒 安全性說明

目前 Web App 設定為「所有人都能存取」，URL 本身即為存取憑證。請勿將 URL 分享給不信任的人。

## 📄 授權

MIT License
