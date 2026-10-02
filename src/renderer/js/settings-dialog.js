import { $, el, icon } from './dom.js';

const TEXT_FIELDS = ['teamNumber', 'season', 'eventCode', 'refreshSeconds', 'serverPort', 'joinCode', 'alertMessage'];

const form = () => $('settings-form');
const dialog = () => $('settings');

function showErrors(errors = {}) {
  for (const slot of form().querySelectorAll('[data-error-for]')) {
    const message = errors[slot.dataset.errorFor] || '';
    slot.textContent = message;
    const input = form().elements[slot.dataset.errorFor];
    if (input && input.setAttribute) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  const first = Object.keys(errors).map((name) => form().elements[name]).find(Boolean);
  if (first && first.focus) first.focus();
}

async function copy(text, button) {
  await window.hub.copyText(text);
  button.replaceChildren(icon('check', 14), 'Copied');
  setTimeout(() => button.replaceChildren('Copy'), 1200);
}

function copyRow(value) {
  const button = el('button', { type: 'button', class: 'text-btn' }, 'Copy');
  button.addEventListener('click', () => copy(value, button));
  return el('div', { class: 'sb-row' }, el('code', {}, value), button);
}

export function renderServerBox({ serverStatus, addresses, settings }) {
  const box = $('server-box');
  box.replaceChildren();
  if (!serverStatus) return;

  const ok = serverStatus.running && !serverStatus.error;
  box.classList.toggle('error', !ok);
  box.append(
    el('div', { class: 'sb-status' }, el('span', { class: 'sb-dot' }),
      ok ? 'Server running, port open' : `Server not running${serverStatus.error ? `: ${serverStatus.error}` : ''}`),
  );
  if (!ok) return;

  box.append(el('div', { class: 'sb-port' }, 'Port', el('b', {}, String(serverStatus.port))));
  for (const url of [`http://localhost:${serverStatus.port}`, ...addresses.map((a) => `http://${a}:${serverStatus.port}`)]) {
    box.append(copyRow(url));
  }
  box.append(
    settings.joinCode
      ? el('div', { class: 'sb-port' }, 'Join code', el('b', {}, settings.joinCode))
      : el('p', { class: 'sb-warning' }, 'No join code: anyone who knows the address can join the list.'),
  );
}

export function openSettings(state) {
  const f = form();
  for (const name of TEXT_FIELDS) f.elements[name].value = state.settings[name] ?? '';
  f.elements.demoMode.checked = Boolean(state.settings.demoMode);
  f.elements.checklist.value = state.settings.checklist.map((item) => item.text).join('\n');

  $('season-input').placeholder = `Empty = automatic (${state.seasonGuess})`;

  showErrors();
  renderServerBox(state);
  dialog().showModal();

  // The PC may have joined a different network (e.g. the venue Wi-Fi) since start-up.
  window.hub.getAddresses().then((addresses) => {
    state.addresses = addresses;
    renderServerBox(state);
  });
}

function readForm() {
  const f = form();
  const input = {};
  for (const name of TEXT_FIELDS) input[name] = f.elements[name].value;
  input.demoMode = f.elements.demoMode.checked;
  input.checklist = f.elements.checklist.value.split('\n');
  return input;
}

export function initSettingsDialog(state, { onSaved }) {
  form().addEventListener('submit', async (event) => {
    event.preventDefault();
    const save = $('btn-save');
    if (save.disabled) return;
    save.disabled = true;
    try {
      const result = await window.hub.saveSettings(readForm());
      if (!result.ok) {
        showErrors(result.errors);
        return;
      }
      state.settings = result.settings;
      dialog().close();
      onSaved();
    } catch (err) {
      showErrors({ form: `Saving failed: ${err.message}` });
    } finally {
      save.disabled = false;
    }
  });

  $('btn-cancel').addEventListener('click', () => dialog().close());
}
