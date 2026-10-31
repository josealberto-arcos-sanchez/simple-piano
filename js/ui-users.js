// Overlay de jugadores: lista, formulario, colores y exportar/importar.
// Recibe vía UsersUI.init(ctx) las acciones de la app (sync, renderHome, overlays).

import { Users } from './users.js';
import { Progression } from './progression.js';

const UsersUI = (() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  let ctx = null;
  let selectedColor = Users.colors()[0].id;
  let forcedNew = false;

  function init(c) {
    ctx = c;
    bind();
  }

  function flashMsg(text) {
    const el = $('#user-msg');
    el.textContent = text;
    clearTimeout(flashMsg.timer);
    flashMsg.timer = setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function countStars(u) { return Progression.starTotal(u); }

  function renderList() {
    const list = $('#user-list');
    list.innerHTML = '';
    const eaBtn = $('#user-export-active');
    if (eaBtn) {
      eaBtn.textContent = ctx.activeUser
        ? `📤 Guardar copia de ${ctx.activeUser.name} (archivo)`
        : '📤 Guardar copia de este jugador (archivo)';
    }
    const users = Users.all();
    if (users.length === 0) {
      list.innerHTML = '<p class="user-empty">Todavía no hay jugadores.</p>';
      return;
    }
    const selId = ctx.activeUser ? ctx.activeUser.id : null;
    users.forEach((u) => {
      const c = Users.colorOf(u.color);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'user-card' + (u.id === selId ? ' on' : '');

      const avatar = document.createElement('span');
      avatar.className = 'user-avatar';
      avatar.style.background = c.color;
      avatar.textContent = u.name.charAt(0).toUpperCase();

      const info = document.createElement('span');
      info.className = 'user-info';
      const nm = document.createElement('span'); nm.className = 'user-name'; nm.textContent = u.name;
      const st = document.createElement('span'); st.className = 'user-stars'; st.textContent = `⭐ ${countStars(u)}`;
      info.appendChild(nm); info.appendChild(st);

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'mini-btn';
      edit.textContent = '📝';
      edit.title = 'Editar';
      edit.addEventListener('click', (ev) => { ev.stopPropagation(); showForm(u); });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'mini-btn danger';
      del.textContent = '🗑️';
      del.title = 'Borrar';
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (confirm(`¿Borrar a ${u.name}? Su progreso se perderá.`)) {
          Users.deleteUser(u.id);
          ctx.syncUserState();
          renderList();
        }
      });

      card.addEventListener('click', () => {
        Users.selectUser(u.id);
        ctx.syncUserState();
        hideForm();
        ctx.renderHome();
        forcedNew = false;
        ctx.hideOverlay('#user-overlay');
      });

      card.appendChild(avatar); card.appendChild(info); card.appendChild(edit); card.appendChild(del);
      list.appendChild(card);
    });
  }

  function showForm(u) {
    const form = $('#user-form');
    form.classList.remove('hidden');
    $('#user-add').classList.add('hidden');
    $('#user-form-title').textContent = u ? `Editar a ${u.name}` : '➕ Nuevo jugador';
    $('#user-input').value = u ? u.name : '';
    selectedColor = u ? u.color : Users.colors()[0].id;
    const picker = $('#user-color-picker');
    picker.innerHTML = '';
    Users.colors().forEach((c) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'color-swatch' + (c.id === selectedColor ? ' on' : '');
      sw.style.background = c.color;
      sw.addEventListener('click', () => {
        selectedColor = c.id;
        $$('.color-swatch').forEach((x) => x.classList.toggle('on', x === sw));
      });
      picker.appendChild(sw);
    });
    $('#user-save').dataset.mode = u ? u.id : 'new';
    $('#user-input').focus();
  }

  function hideForm() {
    $('#user-form').classList.add('hidden');
    $('#user-add').classList.remove('hidden');
    $('#user-input').value = '';
  }

  function open(opts) {
    opts = opts || {};
    forcedNew = !!opts.forceNew;
    renderList();
    if (forcedNew) {
      $('#user-close').classList.add('hidden');
      $('#user-transfer').classList.add('hidden');
      showForm(null);
    } else {
      $('#user-close').classList.remove('hidden');
      $('#user-transfer').classList.remove('hidden');
      hideForm();
    }
    ctx.showOverlay('#user-overlay');
  }

  function afterImportOrSelect() {
    ctx.syncUserState();
    renderList();
    ctx.renderHome();
    if (forcedNew && Users.active()) {
      forcedNew = false;
      ctx.hideOverlay('#user-overlay');
    }
  }

  function bind() {
    $('#user-chip').addEventListener('click', () => open());
    $('#user-close').addEventListener('click', () => {
      forcedNew = false;
      ctx.hideOverlay('#user-overlay');
    });
    $('#user-add').addEventListener('click', () => showForm(null));

    $('#user-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#user-input').value.trim();
      if (!name) { flashMsg('Escribe un nombre antes de continuar.'); return; }
      const mode = $('#user-save').dataset.mode;
      let created = false;
      if (mode === 'new') {
        created = !!Users.createUser(name, selectedColor);
        if (created) flashMsg('¡Jugador creado! 🎉');
      } else {
        Users.updateUser(mode, { name, color: selectedColor });
        flashMsg('Jugador actualizado.');
      }
      hideForm();
      ctx.syncUserState();
      renderList();
      ctx.renderHome();
      if (forcedNew && created) {
        forcedNew = false;
        ctx.hideOverlay('#user-overlay');
      }
    });

    $('#user-export').addEventListener('click', () => {
      const data = Users.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simple-piano-usuarios-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      flashMsg('Fichero descargado ✅');
    });

    $('#user-export-active').addEventListener('click', () => {
      const u = Users.active();
      if (!u) { flashMsg('No hay ningún jugador activo.'); return; }
      const data = Users.exportActive();
      if (!data) { flashMsg('No se pudo exportar el jugador.'); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = u.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'jugador';
      a.download = `simple-piano-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      flashMsg(`Fichero de ${u.name} descargado ✅`);
    });

    $('#user-copy').addEventListener('click', async () => {
      const code = Users.encodeObj(Users.exportAll());
      if (!code) { flashMsg('No se pudo generar el código.'); return; }
      try {
        await navigator.clipboard.writeText(code);
        flashMsg('Código copiado ✔ Pégalo en el otro dispositivo.');
      } catch (e) {
        prompt('Copia este texto manualmente:', code);
      }
    });

    $('#user-paste').addEventListener('click', () => {
      const code = prompt('Pega aquí el código de usuarios (empieza por SP1:):');
      if (!code) return;
      const obj = Users.decodeStr(code);
      if (!obj) { flashMsg('El código no es válido ❌'); return; }
      const n = Users.importData(obj);
      afterImportOrSelect();
      flashMsg(n > 0 ? `Añadidos ${n} jugador(es) ✅` : 'Progreso fusionado ✅');
    });

    $('#user-import').addEventListener('click', () => $('#user-import-file').click());
    $('#user-import-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const n = Users.importData(JSON.parse(reader.result));
          afterImportOrSelect();
          flashMsg(n > 0 ? `Añadidos ${n} jugador(es) ✅` : 'Progreso fusionado ✅');
        } catch (err) {
          flashMsg('El fichero no es válido ❌');
        }
      };
      reader.readAsText(f);
      e.target.value = '';
    });
  }

  return { init, open };
})();

export { UsersUI };
