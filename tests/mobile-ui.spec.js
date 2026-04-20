const { test, expect } = require('@playwright/test');

async function bootstrapApp(page, { todos = [], postResolver } = {}) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'todoApp_googleScriptUrl',
      'https://script.google.com/mock/exec'
    );
  });

  await page.route('https://script.google.com/mock/exec', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: todos }),
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
  await expect.soft(page.locator('#mobileComposerBtn')).toBeVisible();
  await expect.soft(page.locator('#composerShell')).toBeAttached();
  await expect.soft(page.locator('#composerShell')).toBeHidden();
});
