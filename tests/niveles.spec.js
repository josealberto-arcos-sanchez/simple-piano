import { test, expect } from '@playwright/test';

// Casos de la checklist de niveles (docs/pruebas-automatizadas.md §7) que dependen
// de la interfaz. La lógica pura está en test.html.

// El service worker recarga la página al activarse por primera vez, lo que
// interrumpiría los formularios de las pruebas.
test.use({ serviceWorkers: 'block' });

function vigilarErrores(page) {
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Chrome registra como error el 404 de /favicon.ico (la app no tiene icono propio).
    if (m.location().url.endsWith('/favicon.ico')) return;
    errores.push(m.text());
  });
  return errores;
}

async function primerJugador(page, nombre) {
  await expect(page.locator('#user-overlay')).toBeVisible();
  await page.locator('#user-input').fill(nombre);
  await page.locator('#user-save').click();
  await expect(page.locator('#user-overlay')).toBeHidden();
}

async function nuevoJugador(page, nombre, indiceColor) {
  await page.locator('#user-chip').click();
  await page.locator('#user-add').click();
  await page.locator('#user-input').fill(nombre);
  await page.locator('.color-swatch').nth(indiceColor).click();
  await page.locator('#user-save').click();
  // Desde el menú, al crear un jugador el overlay se queda abierto con la lista.
  await expect(page.locator('#user-list .user-card', { hasText: nombre })).toBeVisible();
  await page.locator('#user-close').click();
  await expect(page.locator('#user-overlay')).toBeHidden();
}

async function cambiarJugador(page, nombre) {
  await page.locator('#user-chip').click();
  await page.locator('#user-overlay .user-main', { hasText: nombre }).click();
  await expect(page.locator('#user-overlay')).toBeHidden();
}

async function modosVisibles(page) {
  return page.locator('#song-view .mode-btn:not(.hidden)')
    .evaluateAll((els) => els.map((e) => e.dataset.mode));
}

test('menú principal: una tarjeta por nivel, todas abiertas, con sus estrellas máximas', async ({ page }) => {
  const errores = vigilarErrores(page);
  await page.goto('/');
  await primerJugador(page, 'Ana');

  const tarjetas = page.locator('#level-list .level-card');
  await expect(tarjetas).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await expect(tarjetas.nth(i)).toBeEnabled();
  }
  await expect(page.locator('#level-list .level-score')).toHaveText([
    '⭐ 0 / 36',
    '⭐ 0 / 36',
    '⭐ 0 / 48',
    '⭐ 0 / 60',
    '⭐ 0 / 60',
  ]);
  expect(errores).toEqual([]);
});

test('cada nivel muestra sus modos: 1 y 2 una mano, 3, 4 y 5 dos manos', async ({ page }) => {
  const errores = vigilarErrores(page);
  await page.goto('/');
  await primerJugador(page, 'Ana');

  const esperado = [
    ['listen', 'rh', 'free'],
    ['listen', 'lh', 'free'],
    ['listen', 'rh', 'lh', 'both', 'free'],
    ['listen', 'rh', 'lh', 'both', 'free'],
    ['listen', 'rh', 'lh', 'both', 'free'],
  ];
  for (let i = 0; i < esperado.length; i++) {
    await page.locator('#level-list .level-card').nth(i).click();
    await page.locator('#song-list .song-list-card').first().click();
    await expect(page.locator('#song-view')).toBeVisible();
    expect(await modosVisibles(page)).toEqual(esperado[i]);
    await page.locator('#btn-back-songs').click();
    await page.locator('#btn-back-levels').click();
    await expect(page.locator('#levels-view')).toBeVisible();
  }
  expect(errores).toEqual([]);
});

test('tras recargar, cada jugador vuelve a la misma vista, nivel y canción', async ({ page }) => {
  const errores = vigilarErrores(page);
  await page.goto('/');
  await primerJugador(page, 'Ana');

  await page.locator('#level-list .level-card').nth(1).click();
  await page.locator('#song-list .song-list-card').nth(1).click();
  await expect(page.locator('#song-view')).toBeVisible();
  const cancion = await page.locator('#song-title').innerText();

  await page.reload();
  await expect(page.locator('#song-view')).toBeVisible();
  await expect(page.locator('#song-title')).toHaveText(cancion);
  await expect(page.locator('#song-view-level-sub')).toContainText('Mano izquierda');

  await page.locator('#btn-back-songs').click();
  await expect(page.locator('#level-view')).toBeVisible();
  await page.reload();
  await expect(page.locator('#level-view')).toBeVisible();
  await expect(page.locator('#level-sub')).toContainText('Mano izquierda');
  expect(errores).toEqual([]);
});

test('cambiar de jugador restaura la vista de cada uno por separado', async ({ page }) => {
  const errores = vigilarErrores(page);
  await page.goto('/');
  await primerJugador(page, 'Ana');

  await page.locator('#level-list .level-card').nth(1).click();
  await expect(page.locator('#level-view')).toBeVisible();

  await nuevoJugador(page, 'Luis', 1);
  await expect(page.locator('#levels-view')).toBeVisible();
  await page.locator('#level-list .level-card').nth(3).click();
  await expect(page.locator('#level-sub')).toContainText('Manos en equipo');

  await cambiarJugador(page, 'Ana');
  await expect(page.locator('#level-view')).toBeVisible();
  await expect(page.locator('#level-sub')).toContainText('Mano izquierda');

  await cambiarJugador(page, 'Luis');
  await expect(page.locator('#level-view')).toBeVisible();
  await expect(page.locator('#level-sub')).toContainText('Manos en equipo');
  expect(errores).toEqual([]);
});

test('completar un modo suma estrellas y "Siguiente" salta al modo correcto', async ({ page }) => {
  const errores = vigilarErrores(page);
  await page.goto('/');
  await primerJugador(page, 'Ana');

  await page.locator('#level-list .level-card').nth(0).click();
  await page.locator('#song-list .song-list-card').first().click();
  await page.locator('#song-view .mode-btn[data-mode="rh"]').click();

  // Sin teclado: el overlay de conexión ofrece el modo prueba con las teclas del ordenador.
  await expect(page.locator('#connect-overlay')).toBeVisible();
  await page.locator('#connect-dev').click();
  await page.locator('#connect-start').click();
  await expect(page.locator('#screen-game')).toBeVisible();

  // Se toca cada nota que pide la partida hasta que termina (mismo método que test.html).
  await page.evaluate(() => {
    const G = window.__debug__.Game;
    let guardia = 0;
    while (G._dbg().running && guardia++ < 3000000) {
      const d = G._dbg();
      if (d.pending) for (const m of d.pending.need) { G.noteon(m, 100); G.noteoff(m); }
      G._step(0.03);
    }
  });

  await expect(page.locator('#win-overlay')).toBeVisible();
  await expect(page.locator('#win-stars .star.on')).toHaveCount(3);
  await expect(page.locator('#win-next')).toHaveText('Siguiente: 🎵 ¡Toca libre!');

  await page.locator('#win-home').click();
  await expect(page.locator('#song-view')).toBeVisible();
  await expect(page.locator('#stars-rh')).toHaveText('⭐⭐⭐');
  await expect(page.locator('#song-stars')).toHaveText('⭐ 3 / 6');

  await page.locator('#btn-back-songs').click();
  await expect(page.locator('#level-stars')).toHaveText('⭐ 3 / 36');
  expect(errores).toEqual([]);
});
