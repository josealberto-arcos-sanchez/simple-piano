// Modo de prueba SIN teclado real: las teclas del ordenador simulan el piano.
// Sirve para probar la app en un PC antes de conectar el teclado de verdad.

const DevKeys = (() => {
  const KEYMAP = {
    // mano izquierda (DO3 … SOL3)
    z: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54, b: 55,
    // mano derecha (DO4 … SOL4)
    q: 60, 2: 61, w: 62, 3: 63, e: 64, r: 65, 5: 66, t: 67,
  };
  let active = false;
  const held = new Set();

  function enable(v) { active = v; }
  function handle(e, down) {
    if (!active || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = KEYMAP[e.key.toLowerCase()];
    if (m === undefined) return;
    if (down && !held.has(m)) {
      held.add(m);
      App.route('noteon', m, 100);
      e.preventDefault();
    } else if (!down && held.has(m)) {
      held.delete(m);
      App.route('noteoff', m);
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', (e) => handle(e, true));
  window.addEventListener('keyup', (e) => handle(e, false));
  window.addEventListener('blur', () => { held.forEach((m) => App.route('noteoff', m)); held.clear(); });

  return { enable, get active() { return active; }, KEYMAP };
})();
