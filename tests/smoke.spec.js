import { test, expect } from '@playwright/test';

// Abre la suite de tests de navegador (test.html) y verifica que pasa al 100%.
test('suite completa de test.html en verde', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/test.html');
  await page.waitForSelector('.summary', { state: 'visible' });

  // Deben renderizarse las suites (A–D).
  const suites = page.locator('.suite');
  expect(await suites.count()).toBeGreaterThanOrEqual(4);

  // Ninguna prueba en rojo.
  const fails = page.locator('li.fail');
  expect(await fails.count()).toBe(0);

  // Resumen: "Resumen: X/Y correctos" con X === Y > 0.
  const text = (await page.locator('.summary').innerText()).trim();
  const m = text.match(/(\d+)\/(\d+) correctos/);
  expect(m, `resumen inesperado: "${text}"`).not.toBeNull();
  const pass = Number(m[1]);
  const total = Number(m[2]);
  expect(total).toBeGreaterThan(0);
  expect(pass).toBe(total);

  expect(pageErrors).toEqual([]);
});
