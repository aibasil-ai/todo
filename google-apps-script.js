/**
 * Google Apps Script - Todo List 與 Google Sheets 整合 API
 * 
 * 使用方式：
 * 1. 在 Google Sheets 中，點選「擴充功能」>「Apps Script」
 * 2. 將此程式碼貼入編輯器
 * 3. 點選「部署」>「新增部署」
 * 4. 選擇「網頁應用程式」
 * 5. 設定「誰可以存取」為「任何人」
 * 6. 點選「部署」並複製 Web App URL
 */

// ===== 設定 =====
const HEADER_ROW = 1;        // 標題列位置

// 欄位索引（從 1 開始）
const COL = {
  CREATED_AT: 1,    // A - 紀錄日期
  NAME: 2,          // B - 待辦事項
  PRIORITY: 3,      // C - 優先權
  COMPLETED_AT: 4,  // D - 完成日期
  CHECKED: 5,       // E - 檢查狀態
  DESCRIPTION: 6,   // F - 備註
  ID: 7             // G - 隱藏 ID（新增欄位）
};

// 取得工作表（使用第一個工作表，避免名稱問題）
function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

// ===== GET 請求：讀取所有 Todo =====
function doGet(e) {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();

    // 若只有標題列，回傳空陣列
    if (lastRow <= HEADER_ROW) {
      return createJsonResponse({ success: true, data: [] });
    }

    // 讀取所有資料（跳過標題列）
    const range = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, COL.ID);
    const values = range.getValues();

    // 轉換為 JSON 格式，對於沒有 ID 的舊資料，自動產生並回填 ID
    const todos = [];
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const name = row[COL.NAME - 1] || '';

      // 跳過沒有名稱的空行
      if (!name) continue;

      let id = row[COL.ID - 1] || '';

      // 如果沒有 ID，自動產生並回填到試算表
      if (!id) {
        id = 'legacy_' + (Date.now() + i).toString(36);
        const rowNum = HEADER_ROW + 1 + i;
        sheet.getRange(rowNum, COL.ID).setValue(id);
      }

      todos.push({
        id: id,
        name: name,
        description: row[COL.DESCRIPTION - 1] || '',
        priority: row[COL.PRIORITY - 1] || '',
        checked: row[COL.CHECKED - 1] === true || row[COL.CHECKED - 1] === 'TRUE',
        createdAt: formatDate(row[COL.CREATED_AT - 1])
      });
    }

    return createJsonResponse({ success: true, data: todos });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

// ===== POST 請求：新增/刪除/更新 Todo =====
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;

    switch (action) {
      case 'add':
        return addTodo(params);
      case 'delete':
        return deleteTodo(params);
      case 'toggle':
        return toggleTodo(params);
      default:
        return createJsonResponse({ success: false, error: '未知的操作: ' + action });
    }

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

// ===== 新增 Todo =====
function addTodo(params) {
  const sheet = getSheet();

  const id = params.id;
  const name = params.name;
  const description = params.description || '';
  const priority = params.priority || '';
  const createdAt = params.createdAt;

  // 在最後一行之後新增資料
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;

  // 設定資料
  sheet.getRange(newRow, COL.CREATED_AT).setValue(createdAt);
  sheet.getRange(newRow, COL.NAME).setValue(name);
  sheet.getRange(newRow, COL.PRIORITY).setValue(priority);
  sheet.getRange(newRow, COL.DESCRIPTION).setValue(description);
  sheet.getRange(newRow, COL.CHECKED).insertCheckboxes().setValue(false);
  sheet.getRange(newRow, COL.ID).setValue(id);

  return createJsonResponse({ success: true, message: '新增成功' });
}

// ===== 刪除 Todo =====
function deleteTodo(params) {
  const sheet = getSheet();
  const id = params.id;

  // 尋找對應的列
  const lastRow = sheet.getLastRow();
  const idRange = sheet.getRange(HEADER_ROW + 1, COL.ID, lastRow - HEADER_ROW, 1);
  const ids = idRange.getValues();

  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      // 刪除該列
      sheet.deleteRow(HEADER_ROW + 1 + i);
      return createJsonResponse({ success: true, message: '刪除成功' });
    }
  }

  return createJsonResponse({ success: false, error: '找不到對應的 Todo' });
}

// ===== 切換勾選狀態 =====
function toggleTodo(params) {
  const sheet = getSheet();
  const id = params.id;
  const checked = params.checked;

  // 尋找對應的列
  const lastRow = sheet.getLastRow();
  const idRange = sheet.getRange(HEADER_ROW + 1, COL.ID, lastRow - HEADER_ROW, 1);
  const ids = idRange.getValues();

  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      // 更新勾選狀態
      const rowNum = HEADER_ROW + 1 + i;
      sheet.getRange(rowNum, COL.CHECKED).setValue(checked);

      return createJsonResponse({ success: true, message: '更新成功' });
    }
  }

  return createJsonResponse({ success: false, error: '找不到對應的 Todo' });
}

// ===== 輔助函式 =====

// 建立 JSON 回應
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// 格式化日期為 YYYY-MM-DD HH:mm:ss
function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 取得當前日期時間
function getCurrentDateTime() {
  return formatDate(new Date());
}
