'use strict';

/* ==========================================================================
   Configurar sesión: qué cuestionarios, qué modo y con qué opciones.
   ========================================================================== */

const Configurar = (() => {
  let cfg = null;
  let elegidos = null;
  let busqueda = '';
  let raizVista = null;

  function render(contenedor, _params, query) {
    raizVista = contenedor;
    const todos = Store.cuestionarios();
    if (!todos.length) {
      contenedor.replaceChildren(vacio({
        icono: 'libro',
        titulo: 'Todavía no hay nada para estudiar',
        texto: 'Creá un cuestionario o importá un backup para empezar.',
        acciones: [h('a.btn.btn-pri', { href: '#/nuevo' }, icono('mas'), 'Crear cuestionario'), h('a.btn.btn-sec', { href: '#/datos' }, icono('subir'), 'Importar')],
      }));
      return;
    }

    const p = Store.prefs();
    cfg = {
      modo: Sesion.MODOS[query.modo] ? query.modo : p.modo,
      cantidad: p.cantidad,
      tipos: { ...p.tipos },
      filtro: query.filtro || p.filtro,
      mezclarOpciones: p.mezclarOpciones,
      mostrarCantidad: p.mostrarCantidad,
      minutos: p.minutos,
    };

    if (query.c === 'todos' || !query.c) {
      const todosIds = todos.map(c => c.idCuestionario);
      elegidos = new Set(query.c === 'todos' || todos.length === 1 ? todosIds : []);
    } else {
      elegidos = new Set(query.c.split(',').map(Number).filter(id => Store.cuestionario(id)));
    }
    busqueda = '';
    pintar();
  }

  function pintar() {
    raizVista.replaceChildren(h('div.configurar',
      h('header.pagina-cab',
        h('div', h('p.supra', 'Nueva sesión'), h('h1', '¿Qué querés estudiar?'))),
      h('div.configurar-grilla',
        seccionCuestionarios(),
        h('div.configurar-lateral', seccionModo(), seccionOpciones(), resumenInicio()))));
  }

  /* --- Selección de cuestionarios --- */

  function seccionCuestionarios() {
    const todos = Store.cuestionarios();
    const q = normalizar(busqueda);
    const visibles = todos.filter(c => !q || normalizar(c.nombre + ' ' + (c.materia || '')).includes(q));
    const grupos = new Map();
    for (const c of visibles) {
      const m = c.materia || 'Sin materia';
      if (!grupos.has(m)) grupos.set(m, []);
      grupos.get(m).push(c);
    }
    const ordenGrupos = [...grupos.keys()].sort((a, b) => (a === 'Sin materia') - (b === 'Sin materia') || a.localeCompare(b, 'es'));

    const listado = h('div.selector-lista');
    for (const m of ordenGrupos) {
      const cs = grupos.get(m);
      const todosElegidos = cs.every(c => elegidos.has(c.idCuestionario));
      if (grupos.size > 1 || m !== 'Sin materia') {
        listado.append(h('div.selector-grupo',
          h('span', m),
          h('button.btn-link', {
            type: 'button',
            onclick: () => { cs.forEach(c => todosElegidos ? elegidos.delete(c.idCuestionario) : elegidos.add(c.idCuestionario)); pintar(); },
          }, todosElegidos ? 'Quitar todos' : 'Elegir todos')));
      }
      for (const c of cs) {
        const st = Store.estadisticas(c.preguntas);
        const marcado = elegidos.has(c.idCuestionario);
        listado.append(h('label.selector-item', { class: marcado ? 'activo' : null },
          h('input', {
            type: 'checkbox', checked: marcado,
            onchange: e => { e.target.checked ? elegidos.add(c.idCuestionario) : elegidos.delete(c.idCuestionario); pintar(); },
          }),
          h('span.selector-check', icono('check')),
          h('span.selector-info',
            h('strong', c.nombre),
            h('small', plural(st.total, 'pregunta'),
              st.pendientes ? h('span.texto-pendiente', ` · ${st.pendientes} para repasar`) : null,
              st.nuevas === st.total ? ' · sin empezar' : ` · ${Math.round(st.dominadas / st.total * 100)}% dominado`)),
          barraProgreso(st)));
      }
    }
    if (!visibles.length) listado.append(h('p.texto-suave', 'Ningún cuestionario coincide con la búsqueda.'));

    const todosVisiblesElegidos = visibles.length && visibles.every(c => elegidos.has(c.idCuestionario));
    return h('section.panel.selector',
      h('div.panel-cab',
        h('h2', 'Cuestionarios', h('span.chip-n', elegidos.size)),
        h('button.btn-link', {
          type: 'button',
          onclick: () => { visibles.forEach(c => todosVisiblesElegidos ? elegidos.delete(c.idCuestionario) : elegidos.add(c.idCuestionario)); pintar(); },
        }, todosVisiblesElegidos ? 'Quitar todos' : 'Elegir todos')),
      todosLosCuestionarios().length > 6 ? campoBusqueda() : null,
      listado);
  }

  const todosLosCuestionarios = () => Store.cuestionarios();

  function campoBusqueda() {
    const input = h('input.input', {
      type: 'search', placeholder: 'Buscar cuestionario o materia…', value: busqueda,
      oninput: e => {
        busqueda = e.target.value;
        const pos = e.target.selectionStart;
        pintar();
        const nuevo = $('.selector .buscador input', raizVista);
        nuevo?.focus();
        nuevo?.setSelectionRange(pos, pos);
      },
    });
    return h('div.buscador', icono('buscar'), input);
  }

  /* --- Modo --- */

  function seccionModo() {
    return h('section.panel',
      h('h2', 'Modo'),
      h('div.modos', Object.entries(Sesion.MODOS).map(([id, m]) => h('label.modo', { class: cfg.modo === id ? 'activo' : null },
        h('input', { type: 'radio', name: 'modo', value: id, checked: cfg.modo === id, onchange: () => { cfg.modo = id; pintar(); } }),
        h('span.modo-icono', icono(m.icono)),
        h('span.modo-texto', h('strong', m.nombre), h('small', m.desc))))));
  }

  /* --- Opciones --- */

  function seccionOpciones() {
    const cantidades = [10, 20, 30, 50, 0];
    return h('section.panel.opciones-sesion',
      h('h2', 'Opciones'),

      h('div.campo',
        h('span.campo-etiqueta', 'Cantidad de preguntas'),
        h('div.segmentado', cantidades.map(n => h('button', {
          type: 'button', class: cfg.cantidad === n ? 'activo' : null,
          onclick: () => { cfg.cantidad = n; pintar(); },
        }, n ? String(n) : 'Todas')))),

      h('div.campo',
        h('span.campo-etiqueta', 'Incluir'),
        h('div.segmentado', [['multiple', 'Múltiple choice'], ['desarrollar', 'Desarrollo']].map(([t, label]) => h('button', {
          type: 'button', class: cfg.tipos[t] ? 'activo' : null, 'aria-pressed': String(cfg.tipos[t]),
          onclick: () => {
            const otro = t === 'multiple' ? 'desarrollar' : 'multiple';
            cfg.tipos[t] = !cfg.tipos[t];
            if (!cfg.tipos[t] && !cfg.tipos[otro]) cfg.tipos[otro] = true;
            pintar();
          },
        }, cfg.tipos[t] ? icono('check') : null, label)))),

      h('div.campo',
        h('label.campo-etiqueta', { for: 'filtro-preguntas' }, 'Preguntas'),
        h('select.input', {
          id: 'filtro-preguntas',
          onchange: e => { cfg.filtro = e.target.value; pintar(); },
        }, [
          ['todas', 'Todas'],
          ['pendientes', 'Sólo las que tocan repasar hoy'],
          ['falladas', 'Sólo las que fallé la última vez'],
          ['nuevas', 'Sólo las que nunca vi'],
          ['marcadas', 'Sólo las marcadas'],
        ].map(([v, t]) => h('option', { value: v, selected: cfg.filtro === v }, t)))),

      interruptor('Mezclar opciones', cfg.mezclarOpciones, v => { cfg.mezclarOpciones = v; }, '“Todas las anteriores” y similares quedan al final'),
      interruptor('Decirme cuántas son correctas', cfg.mostrarCantidad, v => { cfg.mostrarCantidad = v; }, 'Más fácil: indica cuántas opciones marcar'),

      cfg.modo === 'examen' ? h('div.campo',
        h('span.campo-etiqueta', 'Tiempo límite'),
        h('div.segmentado', [0, 10, 20, 30, 60].map(n => h('button', {
          type: 'button', class: cfg.minutos === n ? 'activo' : null,
          onclick: () => { cfg.minutos = n; pintar(); },
        }, n ? `${n} min` : 'Sin límite')))) : null);
  }

  /* --- Resumen y botón de inicio --- */

  function resumenInicio() {
    const ids = [...elegidos];
    const pool = ids.length ? Sesion.construirPool(ids, cfg) : [];
    const n = cfg.cantidad > 0 ? Math.min(cfg.cantidad, pool.length) : pool.length;

    let texto;
    if (!ids.length) texto = 'Elegí al menos un cuestionario.';
    else if (!pool.length) texto = 'No hay preguntas que coincidan con estos filtros.';
    else texto = `${plural(n, 'pregunta')} de ${pool.length} disponibles`;

    return h('div.panel.inicio-sesion',
      h('p', { class: n ? null : 'texto-suave' }, texto),
      h('button.btn.btn-pri.btn-lg.btn-bloque', { type: 'button', disabled: !n, onclick: empezar },
        icono('play'), 'Empezar'));
  }

  function empezar() {
    const { modo, cantidad, tipos, filtro, mezclarOpciones, mostrarCantidad, minutos } = cfg;
    Store.setPrefs({ modo, cantidad, tipos, filtro, mezclarOpciones, mostrarCantidad, minutos });
    Sesion.iniciar({ ...cfg, cids: [...elegidos] });
  }

  return { render };
})();
