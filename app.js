/**
 * Todo List 應用程式主要邏輯
 * 純 JavaScript 實作，無框架依賴
 */

// ===== 預設 Todo 資料 =====
const defaultTodos = [
    { 
        id: 1, 
        name: 'todo 1', 
        description: '這是 todo 1 的描述內容。你可以在這裡加入更多關於這個待辦事項的詳細說明。', 
        checked: false,
        expanded: false
    },
    { 
        id: 2, 
        name: 'todo3', 
        description: '這是 todo3 的描述內容。點擊任務可以展開或收合這個描述區域。', 
        checked: false,
        expanded: false
    }
];

// ===== 應用程式狀態 =====
let todos = [];
let nextId = 3;

// ===== DOM 元素參考 =====
const todoInput = document.getElementById('todoInput');
const descriptionInput = document.getElementById('descriptionInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');

// ===== 初始化應用程式 =====
function initApp() {
    // 複製預設資料（避免修改原始資料）
    todos = JSON.parse(JSON.stringify(defaultTodos));
    nextId = Math.max(...todos.map(t => t.id)) + 1;
    
    // 綁定事件
    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });
    
    // 渲染初始列表
    renderTodos();
}

// ===== 新增 Todo =====
function addTodo() {
    const name = todoInput.value.trim();
    const description = descriptionInput.value.trim();
    
    // 驗證：名稱不能為空
    if (!name) {
        todoInput.focus();
        return;
    }
    
    // 建立新的 todo
    const newTodo = {
        id: nextId++,
        name: name,
        description: description || '（無描述）',
        checked: false,
        expanded: false
    };
    
    // 加入列表末端
    todos.push(newTodo);
    
    // 清空輸入框
    todoInput.value = '';
    descriptionInput.value = '';
    
    // 重新渲染
    renderTodos();
    
    // 將焦點移回輸入框
    todoInput.focus();
}

// ===== 刪除 Todo =====
function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    renderTodos();
}

// ===== 切換 Checkbox 狀態 =====
function toggleCheck(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.checked = !todo.checked;
        renderTodos();
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

// ===== 渲染所有 Todos =====
function renderTodos() {
    // 清空列表
    todoList.innerHTML = '';
    
    // 渲染每個 todo
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        li.dataset.id = todo.id;
        
        // 主要內容區域
        const mainDiv = document.createElement('div');
        mainDiv.className = 'todo-item-main';
        
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.checked = todo.checked;
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCheck(todo.id);
        });
        
        // 名稱
        const nameSpan = document.createElement('span');
        nameSpan.className = 'todo-name';
        nameSpan.textContent = todo.name;
        
        // 刪除按鈕
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTodo(todo.id);
        });
        
        // 組裝主要區域
        mainDiv.appendChild(checkbox);
        mainDiv.appendChild(nameSpan);
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
        const descP = document.createElement('p');
        descP.textContent = todo.description;
        descDiv.appendChild(descP);
        
        // 組裝 todo item
        li.appendChild(mainDiv);
        li.appendChild(descDiv);
        
        // 加入列表
        todoList.appendChild(li);
    });
}

// ===== 啟動應用程式 =====
document.addEventListener('DOMContentLoaded', initApp);
