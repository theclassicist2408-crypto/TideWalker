type Child = Node | string | null | undefined | false;

interface Props {
  class?: string;
  text?: string;
  html?: string;
  onclick?: (e: Event) => void;
  [attr: string]: unknown;
}

/** Tiny DOM builder: h('button', { class: 'btn', onclick }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'html') el.innerHTML = String(value);
    else if (key === 'onclick') el.addEventListener('click', value as EventListener);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
  return el;
}

/** Inline SVG icons. Stroke-based, drawn on a 24x24 grid, coloured by `currentColor`. */
const ICON_PATHS: Record<string, string> = {
  back: '<path d="M14.5 5 8 12l6.5 7"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  lock: '<rect x="6.5" y="11" width="11" height="8.5" rx="2"/><path d="M9 11V8.5a3 3 0 0 1 6 0V11"/>',
  shell: '<path d="M4.5 15c-1-6 4-10.5 9.5-9 4 1.2 6 5.500 4 9-1.500 2.600-5 3.400-8.500 3-2.600-.3-4.400-1.200-5-3z"/><path d="M12.500 12.500a1.600 1.600 0 1 0-1.600-1.600c0 2.200 2 3.800 4.200 3.400"/>',
  route: '<path d="M5 19c0-5 4-4 4-8s4-3 4-6"/><circle cx="5" cy="19" r="1.500"/><circle cx="13" cy="5" r="1.500"/><path d="M17 13l2 2-2 2"/>',
  clock: '<circle cx="12" cy="12" r="7.500"/><path d="M12 8v4.500l3 1.800"/>',
  pulse: '<circle cx="12" cy="12" r="2.200"/><circle cx="12" cy="12" r="5.600" opacity=".7"/><circle cx="12" cy="12" r="9" opacity=".4"/>',
  eye: '<path d="M3 12c2.500-4 5.500-6 9-6s6.500 2 9 6c-2.500 4-5.500 6-9 6s-6.500-2-9-6z"/><circle cx="12" cy="12" r="2.500"/>',
  tide: '<path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M12 11V4M9 6.500 12 4l3 2.500"/>',
  ebb: '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M12 13v7M9 17.500 12 20l3-2.500"/>',
  moon: '<path d="M16.500 14.500A7 7 0 0 1 9.500 5a7.500 7.500 0 1 0 9 9.500 7 7 0 0 1-2 0z"/>',
  dark: '<circle cx="12" cy="12" r="7.500" stroke-dasharray="2 3"/>',
  fog: '<path d="M4 8h13M7 12h13M4 16h11"/>',
  storm: '<path d="M7 14a4 4 0 0 1 .500-8 5 5 0 0 1 9.500 1.500A3.300 3.300 0 0 1 17 14"/><path d="m12 12-2 4h3l-2 4"/>',
  calm: '<path d="M4 12h16"/><circle cx="12" cy="7.500" r="2"/><circle cx="12" cy="16.500" r="2" opacity=".45"/>',
  check: '<path d="m5.500 12.500 4 4 9-9.500"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.500v3M12 17.500v3M3.500 12h3M17.500 12h3M6 6l2.100 2.100M15.900 15.900 18 18M6 18l2.100-2.100M15.900 8.100 18 6"/>',
};

export function icon(name: string, size = 24): HTMLElement {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] ?? ''}</svg>`;
  return span;
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
