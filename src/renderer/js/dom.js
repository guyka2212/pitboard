export const $ = (id) => document.getElementById(id);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child != null && child !== false) node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  refresh: ['M21 12a9 9 0 1 1-2.64-6.36L21 8', 'M21 3v5h-5'],
  settings: ['M4 6h10', 'M18 6h2', 'M16 4v4', 'M4 12h4', 'M12 12h8', 'M10 10v4', 'M4 18h12', 'M20 18h0', 'M18 16v4'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  check: ['M20 6 9 17l-5-5'],
  scout: ['M3 3v18h18', 'M8 17v-5', 'M13 17V8', 'M18 17v-8'],
  sort: ['M8 9l4-4 4 4', 'M16 15l-4 4-4-4'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
};

/** A team number that opens the team card when clicked (see main.js). */
export function teamLink(team) {
  return el('button', {
    type: 'button',
    class: 'team-link',
    'data-team': team.number,
    title: team.surrogate ? 'Surrogate: this match does not count for their ranking. Click for team stats.' : 'Team stats',
  }, team.display || String(team.number), team.surrogate && el('span', { class: 'surrogate' }, '*'));
}

export function icon(name, size = 18) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
