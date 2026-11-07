'use strict';

/* ==========================================================================
   Arranque: rutas (#/...), navegación, tema claro/oscuro y atajos globales.
   ========================================================================== */

const App = (() => {
  const RUTAS = [
    { patron: /^\/?$/, vista: Biblioteca, nav: 'inicio' },
    { patron: /^\/estudiar$/, vista: Configurar, nav: 'estudiar' },
    { patron: /^\/sesion$/, vista: Sesion, nav: 'estudiar' },
    { patron: /^\/resultados$/, vista: Resultados, nav: 'estudiar' },
    { patron: /^\/ver\/(\d+)$/, vista: Ver, nav: 'inicio' },
    { patron: /^\/editar\/(\d+)$/, vista: Editor, nav: 'inicio' },
    { patron: /^\/nuevo$/, vista: Editor, nav: 'nuevo' },
    { patron: /^\/datos$/, vista: Datos, nav: 'datos' },
  ];

  let limpieza = null;
  let cambiosPendientes = null;
  let hashActual = '';

  function parsear(hash) {
    const [ruta, qs = ''] = (hash.replace(/^#/, '') || '/').split('?');
    return { ruta, query: Object.fromEntries(new URLSearchParams(qs)) };
  }

  function renderizar() {
    const { ruta, query } = parsear(location.hash);
    let ruteo = null, coincidencia = null;
    for (const r of RUTAS) {
      coincidencia = ruta.match(r.patron);
      if (coincidencia) { ruteo = r; break; }
    }

    if (limpieza) {
      try { limpieza(); } catch (e) { console.error(e); }
      limpieza = null;
    }
    cambiosPendientes = null;
    hashActual = location.hash;

    const contenedor = document.getElementById('app');
    contenedor.replaceChildren();
    window.scrollTo(0, 0);
    actualizarNav(ruteo?.nav);

    if (!ruteo) return noEncontrado(contenedor, 'página');
    try {
      limpieza = ruteo.vista.render(contenedor, coincidencia.slice(1), query) || null;
    } catch (e) {
      console.error(e);
      contenedor.replaceChildren(vacio({
        icono: 'alerta', titulo: 'Algo salió mal', texto: e.message,
        acciones: [h('a.btn.btn-pri', { href: '#/' }, 'Volver al inicio')],
      }));
    }
  }

  async function alCambiarHash() {
    if (location.hash === hashActual) return;
    if (cambiosPendientes?.()) {
      const salir = await confirmar('Tenés cambios sin guardar. Si salís ahora, se pierden.', {
        titulo: '¿Salir sin guardar?', ok: 'Salir sin guardar', cancelar: 'Quedarme', peligro: true,
      });
      if (!salir) {
        history.replaceState(null, '', hashActual || '#/');
        return;
      }
    }
    renderizar();
  }

  function actualizarNav(seccion) {
    $$('#nav a').forEach(a => a.classList.toggle('activo', a.dataset.nav === seccion));
  }

  /** Navega a un hash; si ya estás ahí, vuelve a pintar la vista. */
  function ir(hash) {
    if (location.hash === hash || (hash === '#/' && !location.hash)) renderizar();
    else location.hash = hash;
  }

  /* --- Tema --- */

  const TEMAS = { auto: ['auto', 'Tema: automático'], light: ['sol', 'Tema: claro'], dark: ['luna', 'Tema: oscuro'] };

  function aplicarTema(tema) {
    if (tema === 'light' || tema === 'dark') document.documentElement.dataset.theme = tema;
    else delete document.documentElement.dataset.theme;
    const btn = document.getElementById('btn-tema');
    const [ic, titulo] = TEMAS[tema] || TEMAS.auto;
    btn.replaceChildren(icono(ic));
    btn.title = titulo + ' (clic para cambiar)';
    btn.setAttribute('aria-label', titulo);
  }

  function cambiarTema() {
    const orden = ['auto', 'light', 'dark'];
    const actual = Store.prefs().tema;
    const siguiente = orden[(orden.indexOf(actual) + 1) % orden.length];
    Store.setPrefs({ tema: siguiente });
    aplicarTema(siguiente);
    toast(TEMAS[siguiente][1], { duracion: 1500 });
  }

  /* --- Atajos --- */

  function mostrarAtajos() {
    const fila = (teclas, texto) => h('tr', h('td', teclas.map(t => h('kbd', t))), h('td', texto));
    dialogo({
      titulo: 'Atajos de teclado',
      contenido: h('div.atajos-ayuda',
        h('h3', 'Mientras estudiás'),
        h('table', h('tbody',
          fila(['1', '…', '9'], 'Marcar / desmarcar una opción'),
          fila(['Enter'], 'Comprobar · pasar a la siguiente'),
          fila(['N'], 'No sé (muestra la respuesta)'),
          fila(['Ctrl', 'Enter'], 'Revelar la respuesta de desarrollo'),
          fila(['1', '2', '3'], 'Autoevaluarte: no la sabía · más o menos · la sabía'),
          fila(['←', '→'], 'Moverte entre preguntas (simulacro)'),
          fila(['F'], 'Marcar la pregunta para repasarla'),
          fila(['E'], 'Editar la pregunta'),
          fila(['Esc'], 'Pausar o salir'))),
        h('h3', 'En el editor'),
        h('table', h('tbody',
          fila(['Ctrl', 'S'], 'Guardar'),
          fila(['Enter'], 'En una opción: agregar otra debajo'),
          fila(['Backspace'], 'En una opción vacía: borrarla'))),
        h('h3', 'En cualquier lado'),
        h('table', h('tbody', fila(['?'], 'Mostrar esta ayuda')))),
    });
  }

  /* --- Arrastrar archivos a cualquier parte --- */

  function configurarArrastre() {
    const tieneArchivos = e => [...(e.dataTransfer?.types || [])].includes('Files');
    window.addEventListener('dragover', e => {
      if (!tieneArchivos(e)) return;
      e.preventDefault();
      document.body.classList.add('soltando');
    });
    window.addEventListener('dragleave', e => {
      if (!e.relatedTarget) document.body.classList.remove('soltando');
    });
    window.addEventListener('drop', e => {
      document.body.classList.remove('soltando');
      if (!tieneArchivos(e)) return;
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) Datos.importarArchivo(f);
    });
  }

  function iniciar() {
    aplicarTema(Store.prefs().tema);
    document.getElementById('btn-tema').addEventListener('click', cambiarTema);
    document.getElementById('btn-atajos').addEventListener('click', mostrarAtajos);

    window.addEventListener('hashchange', alCambiarHash);
    window.addEventListener('beforeunload', e => {
      if (cambiosPendientes?.()) { e.preventDefault(); e.returnValue = ''; }
    });
    document.addEventListener('keydown', e => {
      if (e.key === '?' && !esCampoDeTexto(e.target) && !hayDialogoAbierto()) {
        e.preventDefault();
        mostrarAtajos();
      }
    });
    configurarArrastre();
    renderizar();
  }

  return {
    iniciar, ir,
    refrescar: renderizar,
    setCambiosPendientes: fn => { cambiosPendientes = fn; },
  };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
