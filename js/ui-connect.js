// Overlay de conexión del teclado (Web MIDI / modo prueba).
// Recibe vía ConnectUI.init(ctx) las acciones de la app (launchGame, overlays, eco).

import { MIDI } from './midi.js';
import { midiToName } from './songs.js';
import { DevKeys } from './keyboard-dev.js';

const ConnectUI = (() => {
  const $ = (s) => document.querySelector(s);

  let ctx = null;
  let devMode = false;

  function init(c) {
    ctx = c;
    bind();
  }

  function show() {
    ctx.showOverlay('#connect-overlay');
    $('#connect-last-note').textContent = '';
    updateLive();
  }

  function updateLive() {
    if ($('#connect-overlay').classList.contains('hidden')) return;
    const el = $('#connect-status');
    const st = MIDI.state;
    const startBtn = $('#connect-start');
    let html;
    if (st.supported === false) {
      html = '⚠️ Este navegador no lee teclados MIDI.<br>Abre Simple Piano con <b>Chrome</b> y prueba otra vez.';
    } else if (st.ready) {
      html = `✅ ¡Perfecto! <b>${st.lastName || 'Teclado'}</b> conectado y sonando.`;
    } else if (st.device) {
      html = `🎹 Teclado detectado (<b>${st.lastName || 'ok'}</b>).<br>¡Toca cualquier tecla para probar!`;
    } else {
      html = '🔌 Esperando… Conecta el cable USB y enciende el teclado.<br><small>En el teclado, si hay menú USB, elige <b>MIDI</b>.</small>';
    }
    el.innerHTML = html;
    const canStart = st.device || devMode;
    startBtn.disabled = !canStart;
    startBtn.textContent = devMode ? '¡A jugar! (modo prueba)' : canStart ? '¡A jugar! 🎹' : 'Esperando teclado…';
  }

  function testNote(midi) {
    if ($('#connect-overlay').classList.contains('hidden')) return;
    const el = $('#connect-last-note');
    el.textContent = `${midiToName(midi)} 🎉`;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function bind() {
    $('#connect-start').addEventListener('click', () => {
      ctx.hideOverlay('#connect-overlay');
      ctx.launchGame();
    });
    $('#connect-close').addEventListener('click', () => ctx.hideOverlay('#connect-overlay'));
    $('#connect-dev').addEventListener('click', () => {
      devMode = true;
      DevKeys.enable(true);
      $('#dev-keys').classList.remove('hidden');
      updateLive();
    });
    $('#connect-echo').addEventListener('change', (e) => {
      ctx.setEcho(e.target.checked);
    });
  }

  return { init, show, updateLive, testNote, isDevMode: () => devMode };
})();

export { ConnectUI };
