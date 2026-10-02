// Checklist state is { matchKey, checked: [itemId] }. It belongs to one "next match":
// when the next match changes, every item is unchecked again.

function forNextMatch(state, matchKey) {
  if (state.matchKey === matchKey) return state;
  // First data after start-up or a settings change: adopt the match without wiping progress.
  if (state.matchKey === null) return { matchKey, checked: state.checked };
  return { matchKey, checked: [] };
}

function setChecked(state, itemId, checked, validIds) {
  const set = new Set(state.checked.filter((id) => validIds.has(id)));
  if (checked) set.add(itemId);
  else set.delete(itemId);
  return { ...state, checked: [...set] };
}

const cleared = (state) => ({ ...state, checked: [] });

module.exports = { forNextMatch, setChecked, cleared };
