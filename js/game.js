// Orquestador de la partida: une el motor de simulación (js/game-engine.js)
// con el renderizador Canvas (js/game-render.js) y gestiona el bucle de
// animación. La API pública (start, stop, noteon, noteoff, tap, resize,
// setSpeed, resetInput, _dbg, _step) no cambia para js/app.js ni los tests.

import { AudioEngine } from './audio.js';
import { GameEngine } from './game-engine.js';
import { GameRenderer } from './game-render.js';

const Game = (() => {
  const engine = GameEngine();
  let renderer = null;
  let running = false, rafId = 0, lastT = 0;

  function ensureRenderer() {
    if (renderer) return renderer;
    const canvas = document.getElementById('stage');
    renderer = GameRenderer(canvas, engine);
    return renderer;
  }

  function start(s, m, uiCallbacks, spd = 1) {
    engine.start(s, m, uiCallbacks, spd);
    ensureRenderer().resize();
    running = true; lastT = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    engine.step(dt);
    renderer.draw(dt);
    // el motor puede terminar solo (fin de canción): corta el bucle
    if (!engine.running) { running = false; cancelAnimationFrame(rafId); return; }
    rafId = requestAnimationFrame(loop);
  }

  // un frame de simulación + dibujo (lo usa el bucle y los tests automáticos)
  function step(dt) {
    engine.step(dt);
    if (renderer) renderer.draw(dt);
  }

  function stop() {
    engine.stop();
    AudioEngine.stopAll();   // corta notas colgadas (eco del teclado) al salir de la partida
    running = false;
    cancelAnimationFrame(rafId);
  }

  function resize() { if (renderer) renderer.resize(); }

  function noteon(midi, vel) { engine.noteon(midi, vel); }
  function noteoff(midi) { engine.noteoff(midi); }
  function tap() { engine.tap(); }
  function setSpeed(spd) { engine.setSpeed(spd); }
  function resetInput() { engine.resetInput(); }

  // depuración (consola del navegador): Game._dbg() · Game._step(dt)
  function _dbg() {
    const e = engine._dbg();
    const size = renderer ? renderer._size() : { W: '0', H: '0' };
    return { ...e, W: size.W, H: size.H };
  }

  window.addEventListener('resize', () => { if (running) resize(); });

  return { start, stop, noteon, noteoff, tap, resize, setSpeed, resetInput, _dbg, _step: step };
})();

export { Game };
