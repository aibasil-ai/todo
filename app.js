/**
 * Todo List 應用程式主要邏輯
 * 純 JavaScript 實作，整合 Google Sheets 作為資料來源
 */

// ===== Google Sheets API 設定 =====
// 從 localStorage 讀取，若無則使用預設值
const STORAGE_KEY = 'todoApp_googleScriptUrl';
const DEFAULT_URL = '';
let GOOGLE_SCRIPT_URL = localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;

// ===== 應用程式狀態 =====
let todos = [];
let isLoading = false;

// ===== DOM 元素參考 =====
const todoInput = document.getElementById('todoInput');
const descriptionInput = document.getElementById('descriptionInput');
const priorityInput = document.getElementById('priorityInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const scriptUrlInput = document.getElementById('scriptUrlInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const composerShell = document.getElementById('composerShell');
const composerBackdrop = document.getElementById('composerBackdrop');
const mobileComposerBtn = document.getElementById('mobileComposerBtn');
const closeComposerBtn = document.getElementById('closeComposerBtn');
const MOBILE_MEDIA_QUERY = window.matchMedia('(max-width: 480px)');

// 確認對話框 DOM 元素
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYesBtn = document.getElementById('confirmYesBtn');
const confirmNoBtn = document.getElementById('confirmNoBtn');
let confirmResolve = null;

// ===== 初始化應用程式 =====
function initApp() {
    // 設定面板事件
    settingsBtn.addEventListener('click', toggleSettingsPanel);
    saveSettingsBtn.addEventListener('click', saveSettings);
    cancelSettingsBtn.addEventListener('click', hideSettingsPanel);

    // 綁定事件
    addBtn.addEventListener('click', addTodo);
    mobileComposerBtn.addEventListener('click', openComposer);
    closeComposerBtn.addEventListener('click', closeComposer);
    composerBackdrop.addEventListener('click', closeComposer);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });

    // Ctrl+Enter 快捷鍵送出（在兩個輸入框都可以使用）
    const handleCtrlEnter = (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            addTodo();
        }
    };
    todoInput.addEventListener('keydown', handleCtrlEnter);
    descriptionInput.addEventListener('keydown', handleCtrlEnter);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeComposer();
        }
    });
    MOBILE_MEDIA_QUERY.addEventListener('change', () => {
        setComposerOpen(false);
    });

    setComposerOpen(false);

    // 從 Google Sheets 載入資料
    loadTodosFromSheet();
}

function setComposerOpen(open) {
    const shouldOpen = MOBILE_MEDIA_QUERY.matches && open;
    const composerHidden = MOBILE_MEDIA_QUERY.matches && !shouldOpen;

    composerShell.dataset.open = shouldOpen ? 'true' : 'false';
    composerBackdrop.dataset.open = shouldOpen ? 'true' : 'false';
    composerShell.setAttribute('aria-hidden', composerHidden ? 'true' : 'false');
    mobileComposerBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    mobileComposerBtn.setAttribute('aria-hidden', shouldOpen ? 'true' : 'false');
    mobileComposerBtn.tabIndex = shouldOpen ? -1 : 0;
    document.body.classList.toggle('drawer-open', shouldOpen);

    if (shouldOpen) {
        todoInput.focus();
    }
}

function openComposer() {
    if (!MOBILE_MEDIA_QUERY.matches) {
        todoInput.focus();
        return;
    }

    setComposerOpen(true);
}

function closeComposer() {
    const wasOpen = composerShell.dataset.open === 'true';

    setComposerOpen(false);

    if (MOBILE_MEDIA_QUERY.matches && wasOpen) {
        mobileComposerBtn.focus();
    }
}

// ===== 自訂確認對話框 =====
function showConfirmModal(message) {
    return new Promise((resolve) => {
        confirmMessage.textContent = message;
        confirmModal.style.display = 'flex';
        confirmResolve = resolve;
    });
}

function hideConfirmModal() {
    confirmModal.style.display = 'none';
    confirmResolve = null;
}

// 確認按鈕事件
confirmYesBtn.addEventListener('click', () => {
    if (confirmResolve) confirmResolve(true);
    hideConfirmModal();
});

confirmNoBtn.addEventListener('click', () => {
    if (confirmResolve) confirmResolve(false);
    hideConfirmModal();
});

// 點擊背景也可以取消
document.querySelector('.confirm-modal-backdrop')?.addEventListener('click', () => {
    if (confirmResolve) confirmResolve(false);
    hideConfirmModal();
});
// ===== 設定面板功能 =====
function toggleSettingsPanel() {
    if (settingsPanel.style.display === 'none') {
        showSettingsPanel();
    } else {
        hideSettingsPanel();
    }
}

function showSettingsPanel() {
    settingsPanel.style.display = 'block';
    scriptUrlInput.value = GOOGLE_SCRIPT_URL;
    scriptUrlInput.focus();
}

function hideSettingsPanel() {
    settingsPanel.style.display = 'none';
}

function saveSettings() {
    const url = scriptUrlInput.value.trim();

    if (!url) {
        showError('請輸入 Google Apps Script URL');
        return;
    }

    if (!url.startsWith('https://script.google.com/')) {
        showError('URL 格式不正確，應以 https://script.google.com/ 開頭');
        return;
    }

    // 儲存到 localStorage
    localStorage.setItem(STORAGE_KEY, url);
    GOOGLE_SCRIPT_URL = url;

    hideSettingsPanel();

    // 重新載入資料
    loadTodosFromSheet();
}

// ===== 輔助函式：格式化日期時間 =====
function formatDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// ===== 輔助函式：格式化日期 (僅日期) =====
function formatDateOnly(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ===== 輔助函式：產生唯一 ID =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ===== 從 Google Sheets 載入 Todos =====
async function loadTodosFromSheet() {
    // 若未設定 URL，提示使用者並開啟設定面板
    if (!GOOGLE_SCRIPT_URL) {
        showSettingsPanel();
        showError('請先設定 Google Apps Script URL 以啟用同步功能');
        renderErrorState('尚未設定 Google Apps Script URL');
        return;
    }

    isLoading = true;
    renderLoadingState();

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const result = await response.json();

        if (result.success) {
            todos = result.data.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                priority: item.priority || '',
                checked: item.checked,
                expanded: false,
                createdAt: item.createdAt
            }));

            // 排序：優先權（高>中>低）> 日期（新>舊）
            sortTodos();

            isLoading = false;
            renderTodos();
        } else {
            throw new Error(result.error || '載入失敗');
        }
    } catch (error) {
        console.error('載入 Todo 失敗:', error);
        isLoading = false;
        renderErrorState(error.message);
    }
}

// ===== 優先權排序值 =====
function getPriorityOrder(priority) {
    // 無 = 0（最優先）, 高 = 1, 中 = 2, 低 = 3
    const priorityMap = {
        '高': 1,
        '中': 2,
        '低': 3
    };
    return priorityMap[priority] || 0; // 未填優先權排最上面
}

// ===== 排序 Todos =====
function sortTodos() {
    todos.sort((a, b) => {
        // 先比較優先權
        const priorityA = getPriorityOrder(a.priority);
        const priorityB = getPriorityOrder(b.priority);

        if (priorityA !== priorityB) {
            return priorityA - priorityB; // 優先權高的排前面
        }

        // 優先權相同，比較日期（新的排前面）
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
    });
}

// ===== 同步新增 Todo 到 Google Sheets =====
async function syncAddToSheet(todo) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: 'add',
                id: todo.id,
                name: todo.name,
                description: todo.description,
                priority: todo.priority,
                createdAt: todo.createdAt
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '新增同步失敗');
        }

        return true;
    } catch (error) {
        console.error('同步新增失敗:', error);
        throw error;
    }
}

// ===== 同步刪除 Todo 從 Google Sheets =====
async function syncDeleteFromSheet(id) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: 'delete',
                id: id
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '刪除同步失敗');
        }

        return true;
    } catch (error) {
        console.error('同步刪除失敗:', error);
        throw error;
    }
}

// ===== 同步勾選狀態到 Google Sheets =====
async function syncToggleToSheet(id, checked) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: 'toggle',
                id: id,
                checked: checked
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '狀態同步失敗');
        }

        return true;
    } catch (error) {
        console.error('同步勾選狀態失敗:', error);
        throw error;
    }
}

// ===== 同步完成日期到 Google Sheets =====
async function syncCompleteToSheet(id, completedAt) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: 'complete',
                id: id,
                completedAt: completedAt
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '完成日期同步失敗');
        }

        return true;
    } catch (error) {
        console.error('同步完成日期失敗:', error);
        throw error;
    }
}

// ===== 同步優先權更新到 Google Sheets =====
async function syncUpdatePriorityToSheet(id, priority) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: 'updatePriority',
                id: id,
                priority: priority
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '優先權同步失敗');
        }

        return true;
    } catch (error) {
        console.error('同步優先權失敗:', error);
        throw error;
    }
}

// ===== 新增 Todo =====
async function addTodo() {
    const name = todoInput.value.trim();
    const description = descriptionInput.value.trim();

    // 驗證：名稱不能為空
    if (!name) {
        todoInput.focus();
        return;
    }

    // 建立新的 todo
    const newTodo = {
        id: generateId(),
        name: name,
        description: description,
        priority: priorityInput.value,
        checked: false,
        expanded: false,
        createdAt: formatDateTime()
    };

    // 禁用按鈕，顯示載入狀態
    addBtn.disabled = true;
    addBtn.textContent = '新增中...';

    try {
        // 先同步到 Google Sheets
        await syncAddToSheet(newTodo);

        // 同步成功後，加入本地列表開頭
        todos.unshift(newTodo);

        // 重新排序
        sortTodos();

        // 重新渲染
        renderTodos();

        // 清空輸入框
        todoInput.value = '';
        descriptionInput.value = '';
        priorityInput.value = '';

        if (MOBILE_MEDIA_QUERY.matches) {
            closeComposer();
        } else {
            todoInput.focus();
        }
    } catch (error) {
        // 同步失敗，顯示錯誤訊息，不更新本地狀態
        showError('新增失敗：' + error.message);
    } finally {
        // 恢復按鈕狀態
        addBtn.disabled = false;
        addBtn.textContent = '新增';
    }
}

// ===== 標記完成 =====
async function completeTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    // 確認對話框
    const confirmed = await showConfirmModal(`確定要將「${todo.name}」標記為完成嗎？`);
    if (!confirmed) return;

    // 暫時標記為完成中
    todo.completing = true;
    renderTodos();

    const completedAt = formatDateOnly();

    try {
        // 先同步到 Google Sheets
        await syncCompleteToSheet(id, completedAt);

        // 同步成功後，從本地列表中移除（因為後端會將資料搬移到已完成分頁）
        todos = todos.filter(t => t.id !== id);
        renderTodos();
    } catch (error) {
        // 同步失敗，恢復狀態，顯示錯誤訊息
        todo.completing = false;
        renderTodos();
        showError('標記完成失敗：' + error.message);
    }
}

// ===== 刪除 Todo =====
async function deleteTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    // 確認對話框
    const confirmed = await showConfirmModal(`確定要刪除「${todo.name}」嗎？此操作無法復原。`);
    if (!confirmed) return;

    // 暫時標記為刪除中
    todo.deleting = true;
    renderTodos();

    try {
        // 先同步到 Google Sheets
        await syncDeleteFromSheet(id);

        // 同步成功後，從本地列表移除
        todos = todos.filter(t => t.id !== id);
        renderTodos();
    } catch (error) {
        // 同步失敗，恢復狀態，顯示錯誤訊息
        todo.deleting = false;
        renderTodos();
        showError('刪除失敗：' + error.message);
    }
}

// ===== 切換 Checkbox 狀態 =====
async function toggleCheck(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const newChecked = !todo.checked;

    // 暫時標記為更新中
    todo.updating = true;
    renderTodos();

    try {
        // 先同步到 Google Sheets
        await syncToggleToSheet(id, newChecked);

        // 同步成功後，更新本地狀態
        todo.checked = newChecked;
        todo.updating = false;
        renderTodos();
    } catch (error) {
        // 同步失敗，恢復狀態，顯示錯誤訊息
        todo.updating = false;
        renderTodos();
        showError('狀態更新失敗：' + error.message);
    }
}

// ===== 展開/收合 Description =====
function toggleExpand(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.expanded = !todo.expanded;
        renderTodos();
    }
}

// ===== 更新優先權 =====
async function updateTodoPriority(id, newPriority) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    // 如果優先權沒有變化，不執行任何操作
    if (todo.priority === newPriority) return;

    // 顯示確認對話框
    const priorityText = newPriority || '無';
    const confirmed = await showConfirmModal(`確定要將「${todo.name}」的優先權改為「${priorityText}」嗎？`);
    if (!confirmed) {
        // 取消：重新渲染以恢復下拉選單的值
        renderTodos();
        return;
    }

    // 暫時標記為更新中
    todo.updatingPriority = true;
    renderTodos();

    try {
        // 同步到 Google Sheets
        await syncUpdatePriorityToSheet(id, newPriority);

        // 同步成功後，更新本地狀態
        todo.priority = newPriority;
        todo.updatingPriority = false;

        // 重新排序並渲染
        sortTodos();
        renderTodos();
    } catch (error) {
        // 同步失敗，恢復狀態，顯示錯誤訊息
        todo.updatingPriority = false;
        renderTodos();
        showError('優先權更新失敗：' + error.message);
    }
}

// ===== 顯示錯誤訊息 =====
function showError(message) {
    // 建立錯誤提示元素
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(errorDiv);

    // 3 秒後自動移除
    setTimeout(() => {
        errorDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
}

// ===== 渲染載入中狀態 =====
function renderLoadingState() {
    todoList.innerHTML = `
        <li class="loading-state" style="text-align: center; padding: 40px; color: #666;">
            <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
            <div>載入中...</div>
        </li>
    `;
}

// ===== 渲染錯誤狀態（含重試按鈕） =====
// ===== 渲染錯誤狀態（含重試按鈕） =====
function renderErrorState(message) {
    todoList.innerHTML = '';

    // 建立錯誤訊息容器
    const li = document.createElement('li');
    li.className = 'error-state';
    li.style.cssText = 'text-align: center; padding: 40px; color: #ef4444;';

    // 圖示
    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'font-size: 24px; margin-bottom: 10px;';
    iconDiv.textContent = '❌';

    // 錯誤訊息文字 (使用 textContent 防止 XSS)
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = '15px';
    msgDiv.textContent = '載入失敗：' + message;

    // 重試按鈕
    const retryBtn = document.createElement('button');
    retryBtn.textContent = '🔄 重試';
    retryBtn.style.cssText = `
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
    `;
    retryBtn.addEventListener('click', () => {
        loadTodosFromSheet();
    });

    // 組裝
    li.appendChild(iconDiv);
    li.appendChild(msgDiv);
    li.appendChild(retryBtn);

    todoList.appendChild(li);
}

// ===== 渲染所有 Todos =====
function renderTodos() {
    // 清空列表
    todoList.innerHTML = '';

    // 若無資料，顯示空狀態
    if (todos.length === 0) {
        todoList.innerHTML = `
            <li class="empty-state" style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 24px; margin-bottom: 10px;">📝</div>
                <div>尚無待辦事項</div>
            </li>
        `;
        return;
    }

    // 渲染每個 todo
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        if (todo.deleting) li.classList.add('deleting');
        if (todo.updating) li.classList.add('updating');
        li.dataset.id = todo.id;

        // 主要內容區域
        const mainDiv = document.createElement('div');
        mainDiv.className = 'todo-item-main';

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.checked = todo.checked;
        checkbox.disabled = todo.updating || todo.deleting;
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCheck(todo.id);
        });

        // 優先權色彩圖示
        const priorityDot = document.createElement('span');
        priorityDot.className = 'priority-dot';
        const priorityColors = {
            '高': '#ef4444', // 紅色
            '中': '#f97316', // 橘色
            '低': '#22c55e'  // 綠色
        };
        const color = priorityColors[todo.priority] || '#9ca3af'; // 預設灰色
        priorityDot.style.cssText = `
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: ${color};
            margin-right: 10px;
            flex-shrink: 0;
        `;
        priorityDot.title = todo.priority ? `優先權：${todo.priority}` : '無優先權';

        // 名稱
        const nameSpan = document.createElement('span');
        nameSpan.className = 'todo-name';
        nameSpan.textContent = todo.name;

        // 刪除按鈕
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = todo.deleting ? '...' : '刪除';
        deleteBtn.disabled = todo.deleting || todo.updating;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTodo(todo.id);
        });

        // 完成按鈕
        const completeBtn = document.createElement('button');
        completeBtn.className = 'complete-btn';
        completeBtn.textContent = todo.completing ? '...' : '完成';
        completeBtn.disabled = todo.completing || todo.deleting || todo.updating;
        completeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            completeTodo(todo.id);
        });

        // 組裝主要區域
        mainDiv.appendChild(checkbox);
        mainDiv.appendChild(priorityDot);
        mainDiv.appendChild(nameSpan);
        mainDiv.appendChild(completeBtn);
        mainDiv.appendChild(deleteBtn);

        // 點擊主區域展開/收合 description
        mainDiv.addEventListener('click', (e) => {
            // 避免點擊 checkbox 或 delete 按鈕時觸發
            if (e.target !== checkbox && e.target !== deleteBtn) {
                toggleExpand(todo.id);
            }
        });

        // Description 區域
        const descDiv = document.createElement('div');
        descDiv.className = 'todo-description' + (todo.expanded ? ' expanded' : '');

        // Description 內容區域
        const descContentDiv = document.createElement('div');
        descContentDiv.className = 'desc-content';

        const descP = document.createElement('p');
        descP.textContent = todo.description || '（無描述）';
        descContentDiv.appendChild(descP);

        // 優先權調整區域
        const priorityEditDiv = document.createElement('div');
        priorityEditDiv.className = 'priority-edit';

        const priorityLabel = document.createElement('label');
        priorityLabel.textContent = '優先權：';
        priorityLabel.className = 'priority-edit-label';

        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'priority-edit-select';
        prioritySelect.disabled = todo.updatingPriority || todo.deleting || todo.updating;

        // 優先權選項
        const priorityOptions = [
            { value: '', text: '無' },
            { value: '高', text: '🔴 高' },
            { value: '中', text: '🟠 中' },
            { value: '低', text: '🟢 低' }
        ];

        priorityOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (todo.priority === opt.value) {
                option.selected = true;
            }
            prioritySelect.appendChild(option);
        });

        // 監聽選擇變更事件
        prioritySelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateTodoPriority(todo.id, e.target.value);
        });

        // 防止點擊時觸發展開/收合
        prioritySelect.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        priorityEditDiv.appendChild(priorityLabel);
        priorityEditDiv.appendChild(prioritySelect);

        // 如果正在更新，顯示載入狀態
        if (todo.updatingPriority) {
            const loadingSpan = document.createElement('span');
            loadingSpan.className = 'priority-loading';
            loadingSpan.textContent = ' 更新中...';
            priorityEditDiv.appendChild(loadingSpan);
        }

        descDiv.appendChild(descContentDiv);
        descDiv.appendChild(priorityEditDiv);

        // 組裝 todo item
        li.appendChild(mainDiv);
        li.appendChild(descDiv);

        // 加入列表
        todoList.appendChild(li);
    });
}

// ===== 啟動應用程式 =====
document.addEventListener('DOMContentLoaded', initApp);
