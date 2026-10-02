import { $, el } from './dom.js';

function renderProgress({ settings, checklistState }) {
  const ids = new Set(settings.checklist.map((item) => item.id));
  const done = checklistState.checked.filter((id) => ids.has(id)).length;
  const total = ids.size;
  const progress = $('check-progress');
  progress.textContent = total ? `${done}/${total}${done === total ? ' · מוכנים' : ''}` : '';
  progress.classList.toggle('done', total > 0 && done === total);
}

export function renderChecklist(state, { onToggle }) {
  const list = $('checklist');
  list.replaceChildren();
  const checked = new Set(state.checklistState.checked);

  if (!state.settings.checklist.length) {
    list.append(el('li', { class: 'empty-note' }, 'אין פריטים. מוסיפים אותם בהגדרות.'));
  }
  for (const item of state.settings.checklist) {
    const box = el('input', { type: 'checkbox', checked: checked.has(item.id) });
    box.addEventListener('change', async () => {
      box.disabled = true;
      try {
        state.checklistState = await onToggle(item.id, box.checked);
      } finally {
        box.disabled = false;
        box.checked = state.checklistState.checked.includes(item.id);
        renderProgress(state);
      }
    });
    list.append(el('li', {}, el('label', {}, box, el('span', {}, item.text))));
  }
  renderProgress(state);
}
