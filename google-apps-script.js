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
      case 'complete':
        return completeTodo(params);
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

  // 防止公式注入 (Formula Injection)
  const safeName = (name && name.toString().startsWith('=')) ? "'" + name : name;
  const safeDescription = (description && description.toString().startsWith('=')) ? "'" + description : description;

  // 設定資料
  sheet.getRange(newRow, COL.CREATED_AT).setValue(createdAt);
  sheet.getRange(newRow, COL.NAME).setValue(safeName);
  sheet.getRange(newRow, COL.PRIORITY).setValue(priority);
  sheet.getRange(newRow, COL.DESCRIPTION).setValue(safeDescription);
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

// ===== 標記完成並更新完成日期 =====
function completeTodo(params) {
  const sheet = getSheet();
  const id = params.id;
  const completedAt = params.completedAt;  // 格式：YYYY-MM-DD

  // 尋找對應的列
  const lastRow = sheet.getLastRow();
  const idRange = sheet.getRange(HEADER_ROW + 1, COL.ID, lastRow - HEADER_ROW, 1);
  const ids = idRange.getValues();

  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      const rowNum = HEADER_ROW + 1 + i;
      // 設定完成日期
      sheet.getRange(rowNum, COL.COMPLETED_AT).setValue(completedAt);

      // 呼叫搬移函式，將資料移到「生活待辦完成」分頁
      try {
        moveRowWithFormat(sheet, "生活待辦完成", rowNum);
      } catch (e) {
        // 如果搬移失敗，記錄錯誤但仍回傳成功（日期已更新）
        console.log('搬移資料列失敗: ' + e.message);
      }

      return createJsonResponse({ success: true, message: '完成日期更新成功並已搬移' });
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

/**
 * 自動雙向搬移資料列（含格式版 + 自動增列防呆）
 */
function onEdit(e) {
  const ss = e.source;
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const row = range.getRow();
  const col = range.getColumn();
  const value = range.getValue();

  // --- 設定區域 ---
  const MAIN_SHEET = "生活";
  const TARGET_SHEET = "生活待辦完成";
  const DATE_COL = 4;            // 假設日期在 D 欄
  // ----------------

  if (row <= 1) return;

  // 1. 移至「已完成」 (檢查是否為該分頁、該欄位、且值為日期物件)
  if (sheetName === MAIN_SHEET && col === DATE_COL && value instanceof Date) {
    moveRowWithFormat(sheet, TARGET_SHEET, row);
  }
  // 2. 移回「原始資料」 (檢查是否為該分頁、該欄位、且值被清空)
  else if (sheetName === TARGET_SHEET && col === DATE_COL && value === "") {
    moveRowWithFormat(sheet, MAIN_SHEET, row);
  }
}

/**
 * 帶格式搬移的核心函式
 */
function moveRowWithFormat(sourceSheet, destSheetName, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const destSheet = ss.getSheetByName(destSheetName);

  // 來源資料範圍
  const lastCol = sourceSheet.getLastColumn();
  const sourceRange = sourceSheet.getRange(row, 1, 1, lastCol);

  // --- 修改重點開始：檢查目標分頁是否有空間 ---
  const destLastRow = destSheet.getLastRow(); // 目標分頁最後一筆有資料的列
  const destMaxRows = destSheet.getMaxRows(); // 目標分頁總共有幾列網格

  // 如果最後一筆資料的位置 已經等於 格子總數，代表沒位子了，需新增一列
  if (destLastRow >= destMaxRows) {
    destSheet.insertRowAfter(destMaxRows);
  }
  // --- 修改重點結束 ---

  // 設定目標寫入位置 (最後一筆資料的下一列)
  const destRow = destLastRow + 1;
  const destRange = destSheet.getRange(destRow, 1, 1, lastCol);

  // 將整列含格式複製到目標位置
  sourceRange.copyTo(destRange);

  // 刪除原始列
  sourceSheet.deleteRow(row);
}
