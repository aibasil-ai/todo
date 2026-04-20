const { test, expect } = require('@playwright/test');

async function bootstrapApp(page, { todos = [], getResolver, postResolver } = {}) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'todoApp_googleScriptUrl',
      'https://script.google.com/mock/exec'
    );
  });

  await page.route('https://script.google.com/mock/exec', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      const result = getResolver
        ? await getResolver()
        : { success: true, data: todos };

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(result),
      });
      return;
    }

    const payload = JSON.parse(request.postData() || '{}');
    const result = postResolver
      ? await postResolver(payload)
      : { success: true };

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });

  await page.goto('/');
}

test('mobile viewport shows list-first shell and add entry point', async ({ page }) => {
  await bootstrapApp(page);

  await expect(page.locator('.todo-list-container')).toBeVisible();
  await expect(page.locator('#mobileComposerBtn')).toBeVisible();
  await expect(page.locator('#composerShell')).toBeHidden();
});

test('mobile add drawer opens, focuses the title field, and closes after add', async ({ page }) => {
  await bootstrapApp(page, { todos: [] });

  await page.getByRole('button', { name: '新增待辦' }).click();

  await expect(page.locator('#composerShell')).toBeVisible();
  await expect(page.locator('#todoInput')).toBeFocused();

  await page.locator('#todoInput').fill('買牛奶');
  await page.locator('#descriptionInput').fill('超商鮮奶');
  await page.locator('#priorityInput').selectOption('高');
  await page.getByRole('button', { name: '新增', exact: true }).click();

  await expect(page.getByText('買牛奶')).toBeVisible();
  await expect(page.locator('#composerShell')).toBeHidden();
});

test('mobile drawer closes and returns focus to the add button', async ({ page }) => {
  await bootstrapApp(page, { todos: [] });

  const mobileComposerBtn = page.locator('#mobileComposerBtn');

  await mobileComposerBtn.click();
  await expect(page.locator('#composerShell')).toBeVisible();
  await expect(page.locator('#todoInput')).toBeFocused();

  await page.locator('#closeComposerBtn').click();

  await expect(page.locator('#composerShell')).toBeHidden();
  await expect(mobileComposerBtn).toBeFocused();
});

test('mobile empty state guides the user to the add button', async ({ page }) => {
  await bootstrapApp(page, { todos: [] });

  await expect(page.getByText('點選下方「新增待辦」開始建立第一筆待辦。')).toBeVisible();
});

test('mobile add failures render inside the message bar', async ({ page }) => {
  await bootstrapApp(page, {
    todos: [],
    postResolver: async (payload) => {
      if (payload.action === 'add') {
        return { success: false, error: 'Mock add failed' };
      }

      return { success: true };
    },
  });

  await page.getByRole('button', { name: '新增待辦' }).click();
  await page.locator('#todoInput').fill('買咖啡');
  await page.getByRole('button', { name: '新增', exact: true }).click();

  await expect(page.locator('#statusMessageBar')).toContainText('新增失敗：Mock add failed');
});

test('mobile retry button reloads once and recovers from the error state', async ({ page }) => {
  let getAttempts = 0;
  let resolveRetryLoad;
  const retryLoad = new Promise((resolve) => {
    resolveRetryLoad = resolve;
  });

  await bootstrapApp(page, {
    getResolver: async () => {
      getAttempts += 1;

      if (getAttempts === 1) {
        return { success: false, error: 'Mock load failed' };
      }

      await retryLoad;
      return {
        success: true,
        data: [
          {
            id: 'todo-1',
            name: '買麵包',
            description: '',
            priority: '',
            checked: false,
            createdAt: '2026-04-20 10:00:00',
          },
        ],
      };
    },
  });

  await expect(page.getByText('載入失敗')).toBeVisible();

  await page.evaluate(() => {
    const retryButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === '重新載入'
    );

    retryButton.click();
    retryButton.click();
  });

  resolveRetryLoad();

  await expect(page.getByText('買麵包')).toBeVisible();
  expect(getAttempts).toBe(2);
});

test('mobile row keeps complete and delete inside the expanded section', async ({ page }) => {
  await bootstrapApp(page, {
    todos: [
      {
        id: 'todo-1',
        name: '買牛奶',
        description: '超商鮮奶',
        priority: '高',
        checked: false,
        createdAt: '2026-04-20 09:00:00',
      },
    ],
  });

  const todoItem = page.locator('.todo-item').first();
  const secondaryActions = todoItem.locator('.todo-secondary-actions');

  await expect(secondaryActions).toBeHidden();

  await todoItem.locator('.todo-item-main').click();

  await expect(secondaryActions).toBeVisible();
  await expect(secondaryActions.getByRole('button', { name: '完成' })).toBeVisible();
  await expect(secondaryActions.getByRole('button', { name: '刪除' })).toBeVisible();
});
