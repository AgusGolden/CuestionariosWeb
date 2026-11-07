'use strict';

/* ==========================================================================
   Utilidades generales: creación de DOM, iconos, texto, fechas, diálogos.
   ========================================================================== */

/* ---------- DOM ---------- */

const PROPS_DIRECTAS = new Set([
  'value', 'checked', 'disabled', 'selected', 'hidden', 'htmlFor',
  'tabIndex', 'readOnly', 'indeterminate', 'open', 'min', 'max',
]);

/**
 * Crea un elemento. h('button.btn.btn-pri', { onclick }, 'Texto', otroNodo)
 * El texto siempre se inserta como texto (nunca como HTML), así que es seguro
 * usarlo con contenido cargado por el usuario.
 */
function h(sel, props, ...hijos) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    hijos.unshift(props);
    props = {};
  }
  const [tag, ...clases] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (clases.length) el.classList.add(...clases);

  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') String(v).split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (PROPS_DIRECTAS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  agregarHijos(el, hijos);
  return el;
}

function agregarHijos(el, hijos) {
  for (const hijo of hijos) {
    if (hijo == null || hijo === false || hijo === true) continue;
    if (Array.isArray(hijo)) agregarHijos(el, hijo);
    else el.append(hijo instanceof Node ? hijo : String(hijo));
  }
}

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

function hayDialogoAbierto() {
  return !!document.querySelector('dialog[open]');
}

function esCampoDeTexto(el) {
  return !!el && (el.matches?.('textarea, select, [contenteditable="true"]') ||
    (el.matches?.('input') && !['checkbox', 'radio', 'button', 'submit', 'range'].includes(el.type)));
}

/** Textarea que crece con el contenido. */
function autoAltura(ta) {
  const ajustar = () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
  };
  ta.addEventListener('input', ajustar);
  requestAnimationFrame(ajustar);
  return ta;
}

const tocaPantalla = () => window.matchMedia('(pointer: coarse)').matches;

/* ---------- Iconos (SVG en línea, estilo trazo) ---------- */

const ICONOS = {
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoNo: '<path d="M9.9 4.2A9.5 9.5 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.5 9.5 0 0 0 5.4-1.6"/><path d="M2 2l20 20"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
  lapiz: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  basura: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  bajar: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  subir: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  bandera: '<path d="M5 22V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  arriba: '<path d="m18 15-6-6-6 6"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  derecha: '<path d="m9 18 6-6-6-6"/>',
  izquierda: '<path d="m15 18-6-6 6-6"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  fuego: '<path d="M12 22c4 0 7-3 7-7.5 0-3.5-2.5-6-4-8.5-.8 2-2 3-3.5 3 .2-2.5-.8-5-2.5-7-1 4.5-5 7-5 12.5C4 19 8 22 12 22z"/>',
  libro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  chispas: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/>',
  diana: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  mezclar: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  teclado: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  alerta: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  capas: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  datos: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  grilla: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  texto: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/>',
  repetir: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  pausa: '<path d="M9 5v14M15 5v14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  bombilla: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V18h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 14h.01M15 14h.01"/><circle cx="12" cy="3.5" r="1"/>',
  carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
};

function icono(nombre, clase = '') {
  const s = document.createElement('span');
  s.className = 'icono' + (clase ? ' ' + clase : '');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre] || ''}</svg>`;
  return s;
}

/* ---------- Texto ---------- */

function sinAcentos(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Minúsculas, sin acentos y con espacios colapsados: para comparar y buscar. */
function normalizar(s) {
  return sinAcentos(String(s ?? '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : (pluralForma || singular + 's')}`;
}

/** Hash rápido y estable (cyrb53) para identificar preguntas por su contenido. */
function hashTexto(str, semilla = 0) {
  let h1 = 0xdeadbeef ^ semilla, h2 = 0x41c6ce57 ^ semilla;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- Fechas y tiempos ---------- */

const DIA_MS = 86400000;
const dosDigitos = n => String(n).padStart(2, '0');

function claveDia(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

function inicioDelDia(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function haceCuanto(ts) {
  if (!ts) return 'nunca';
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  const min = (Date.now() - t) / 60000;
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${Math.floor(min)} min`;
  const hs = min / 60;
  if (hs < 24 && claveDia(t) === claveDia()) return `hace ${Math.floor(hs)} h`;
  const dias = Math.round((inicioDelDia() - inicioDelDia(t)) / DIA_MS);
  if (dias <= 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${plural(meses, 'mes', 'meses')}`;
  return 'hace más de un año';
}

/** "3 min 05 s", "1 h 12 min", "42 s" */
function duracionLegible(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const hs = Math.floor(m / 60);
  if (hs) return `${hs} h ${m % 60} min`;
  if (m) return `${m} min ${dosDigitos(s % 60)} s`;
  return `${s} s`;
}

/** Reloj "mm:ss" (o "h:mm:ss"). */
function formatoReloj(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hs = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (hs ? hs + ':' + dosDigitos(m) : m) + ':' + dosDigitos(s % 60);
}

function selloArchivo(fecha = new Date()) {
  return `${fecha.getFullYear()}_${dosDigitos(fecha.getMonth() + 1)}_${dosDigitos(fecha.getDate())} - ` +
    `${dosDigitos(fecha.getHours())}_${dosDigitos(fecha.getMinutes())}`;
}

/* ---------- Arrays ---------- */

function mezclar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- Archivos y portapapeles ---------- */

function descargarArchivo(nombre, contenido, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function leerArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo, 'utf-8');
  });
}

async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = h('textarea', { value: texto, style: { position: 'fixed', opacity: '0' } });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/* ---------- Avisos (toasts) ---------- */

function toast(mensaje, { tipo = 'info', accion = null, duracion = 3500 } = {}) {
  const contenedor = document.getElementById('toasts');
  const iconos = { ok: 'check', error: 'alerta', aviso: 'alerta', info: 'info' };
  const t = h(`div.toast.toast-${tipo}`, { role: 'status' }, icono(iconos[tipo] || 'info'), h('span', mensaje));

  let timer;
  const cerrar = () => {
    clearTimeout(timer);
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 250);
  };
  if (accion) {
    t.append(h('button.toast-accion', { type: 'button', onclick: () => { cerrar(); accion.fn(); } }, accion.label));
  }
  contenedor.append(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  timer = setTimeout(cerrar, accion ? Math.max(duracion, 7000) : duracion);
  return cerrar;
}

/* ---------- Diálogos modales ---------- */

/**
 * Abre un diálogo y devuelve una promesa con el valor de la acción elegida
 * (null si se cierra con Escape, la X o clic afuera).
 * acciones: [{ label, valor, clase: 'btn-pri' | 'btn-peligro' | ... }]
 * Si `valor` es una función, se ejecuta al hacer clic; si devuelve false el
 * diálogo queda abierto (útil para validar).
 */
function dialogo({ titulo, contenido, acciones = [{ label: 'Cerrar', valor: null }], ancho = '', alAbrir } = {}) {
  return new Promise(resolve => {
    let resultado = null;
    const dlg = h('dialog.dialogo', { class: ancho ? 'dialogo-' + ancho : null });
    const cerrar = () => dlg.close();

    const botones = acciones.map(a => h(`button.btn.${a.clase || 'btn-sec'}`, {
      type: 'button',
      onclick: async () => {
        if (typeof a.valor === 'function') {
          const r = await a.valor();
          if (r === false) return;
          resultado = r ?? null;
        } else {
          resultado = a.valor ?? null;
        }
        cerrar();
      },
    }, a.icono ? icono(a.icono) : null, a.label));

    dlg.append(h('div.dialogo-caja', { tabindex: -1 },
      h('header.dialogo-cab',
        h('h2', titulo),
        h('button.icono-btn', { type: 'button', 'aria-label': 'Cerrar', onclick: () => { resultado = null; cerrar(); } }, icono('x'))),
      h('div.dialogo-cuerpo', contenido),
      botones.length ? h('footer.dialogo-pie', botones) : null,
    ));

    dlg.addEventListener('click', e => { if (e.target === dlg) cerrar(); });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(resultado); });
    document.body.append(dlg);
    dlg.showModal();
    if (alAbrir) alAbrir(dlg);
    else dlg.querySelector('.dialogo-caja').focus();
  });
}

async function confirmar(mensaje, { titulo = '¿Seguro?', ok = 'Aceptar', cancelar = 'Cancelar', peligro = false } = {}) {
  const r = await dialogo({
    titulo,
    contenido: typeof mensaje === 'string' ? h('p', mensaje) : mensaje,
    acciones: [
      { label: cancelar, valor: false },
      { label: ok, valor: true, clase: peligro ? 'btn-peligro' : 'btn-pri' },
    ],
  });
  return r === true;
}

/* ---------- Componentes chicos reutilizables ---------- */

const NOMBRE_TIPO = { multiple: 'Múltiple choice', desarrollar: 'Desarrollo' };

function etiquetaTipo(tipo) {
  return h(`span.etiqueta.etiqueta-${tipo}`, NOMBRE_TIPO[tipo] || tipo);
}

/** Barra segmentada: dominadas / aprendiendo / nuevas. */
function barraProgreso(st) {
  const total = st.total || 1;
  const pct = n => (n / total * 100).toFixed(2) + '%';
  return h('div.barra-niveles', { title: `${st.dominadas} dominadas · ${st.aprendiendo} aprendiendo · ${st.nuevas} sin ver` },
    h('span.nivel-dominada', { style: { width: pct(st.dominadas) } }),
    h('span.nivel-aprendiendo', { style: { width: pct(st.aprendiendo) } }));
}

function interruptor(etiqueta, checked, onchange, ayuda) {
  return h('label.interruptor',
    h('input', { type: 'checkbox', checked, onchange: e => onchange(e.target.checked) }),
    h('span.interruptor-pista'),
    h('span.interruptor-texto', etiqueta, ayuda ? h('small', ayuda) : null));
}

function vacio({ icono: ic = 'libro', titulo, texto, acciones = [] }) {
  return h('div.vacio',
    h('div.vacio-icono', icono(ic)),
    h('h2', titulo),
    texto ? h('p', texto) : null,
    acciones.length ? h('div.fila-botones.centrado', acciones) : null);
}

function noEncontrado(raiz, que = 'cuestionario') {
  raiz.replaceChildren(vacio({
    icono: 'alerta',
    titulo: `No se encontró el ${que}`,
    texto: 'Puede que se haya borrado o que el enlace esté mal.',
    acciones: [h('a.btn.btn-pri', { href: '#/' }, 'Ir a la biblioteca')],
  }));
}
