// Web MIDI: recibe las notas del teclado real conectado por USB.
// Requiere Chrome/Edge (en Android también funciona, con cable USB-OTG o USB-C).

const MIDI = (() => {
  let access = null;
  const handlers = new Set();
  // estado.device  = hay un teclado conectado
  // estado.ready    = ya hemos recibido al menos una nota (prueba superada)
  const state = { supported: null, device: false, ready: false, lastName: '' };

  async function init() {
    if (!navigator.requestMIDIAccess) {
      state.supported = false;
      emit('status');
      return;
    }
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      state.supported = true;
      access.addEventListener('statechange', () => { bindInputs(); emit('status'); });
      bindInputs();
      emit('status');
    } catch (e) {
      state.supported = false;
      emit('status');
    }
  }

  function bindInputs() {
    let any = false;
    access.inputs.forEach((inp) => { inp.onmidimessage = onMessage; any = true; });
    state.device = any;
    if (!any) state.ready = false;
  }

  function onMessage(ev) {
    const [status, note, vel] = ev.data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && vel > 0) {
      state.ready = true;
      state.lastName = (ev.target && ev.target.name) ? ev.target.name : state.lastName;
      emit('noteon', note, vel);
      emit('status');
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      emit('noteoff', note);
    }
  }

  function on(fn) { handlers.add(fn); return () => handlers.delete(fn); }
  function emit(type, note, vel) { handlers.forEach((fn) => fn(type, note, vel)); }

  return { init, on, state };
})();

export { MIDI };
