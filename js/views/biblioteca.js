'use strict';

/* ==========================================================================
   Biblioteca: inicio con resumen de estudio y la lista de cuestionarios.
   ========================================================================== */

const Biblioteca = (() => {
  let raizVista = null;
  let grilla = null;
  let busqueda = '';
  let materia = 'todas';
  const seleccion = new Set();

  function render(contenedor) {
    raizVista = contenedor;
    for (const id of [...seleccion]) if (!Store.cuestionario(id)) seleccion.delete(id);
    if (materia !== 'todas' && materia !== '' && !Store.materias().includes(materia)) materia = 'todas';
    pintar();
    return () => $('.barra-seleccion')?.remove();
  }

  function pintar() {
    if (!Store.cuestionarios().length) {
      raizVista.replaceChildren(bienvenida());
      return;
    }
    raizVista.replaceChildren(h('div.biblioteca',
      bannerSesion(),
      panelResumen(),
      seccionCuestionarios()));
    actualizarBarraSeleccion();
  }

  const filtradosPorMateria = () => Store.cuestionarios()
    .filter(c => materia === 'todas' || (c.materia || '') === materia);

  /* --- Sesión pausada --- */

  function bannerSesion() {
    const s = Store.getSesion();
    if (!s || s.terminada || !s.items?.length) return null;
    return h('div.banner-sesion',
      h('span.banner-icono', icono('pausa')),
      h('div.banner-texto',
        h('strong', 'Tenés una sesión sin terminar'),
        h('span', `${s.titulo} · pregunta ${s.pos + 1} de ${s.items.length}`)),
      h('div.fila-botones',
        h('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          onclick: async () => {
            if (await confirmar('Se pierde el avance de esa sesión (lo que ya respondiste sí queda registrado en tu progreso).', { titulo: '¿Descartar la sesión?', ok: 'Descartar', peligro: true })) {
              Store.borrarSesion();
              pintar();
            }
          },
        }, 'Descartar'),
        h('a.btn.btn-pri.btn-sm', { href: '#/sesion' }, icono('play'), 'Continuar')));
  }

  /* --- Resumen de estudio --- */

  function panelResumen() {
    const cs = filtradosPorMateria();
    const st = Store.estadisticas(cs.flatMap(c => c.preguntas));
    const racha = Store.racha();
    const pct = st.total ? Math.round(st.dominadas / st.total * 100) : 0;
    const ambito = materia === 'todas' ? '' : ` · ${materia || 'Sin materia'}`;

    return h('section.resumen',
      h('div.resumen-stats',
        tile('fuego', racha, racha === 1 ? 'día de racha' : 'días de racha', 'racha'),
        tile('repetir', st.pendientes, 'para repasar hoy', st.pendientes ? 'pendiente' : null),
        tile('check', `${pct}%`, `dominado · ${st.dominadas} de ${st.total}`),
        tile('chispas', Store.respondidasHoy(), 'respondidas hoy')),
      h('div.resumen-actividad',
        h('div.resumen-actividad-cab', h('span', 'Actividad'), h('small', 'últimas 18 semanas')),
        mapaActividad()),
      h('div.resumen-cta',
        h('button.btn.btn-pri.btn-lg', { type: 'button', onclick: () => repasoRapido(cs), disabled: !st.total },
          icono('chispas'), st.pendientes ? `Repasar ahora${ambito}` : `Repaso rápido${ambito}`),
        h('p.texto-suave', st.pendientes
          ? `Arranca por las ${Math.min(st.pendientes, 20)} que más necesitás repasar.`
          : st.nuevas ? '20 preguntas, empezando por las que nunca viste.' : '20 preguntas al azar de lo que ya sabés.'),
        h('a.btn-link', { href: '#/estudiar' + (cs.length ? '?c=' + cs.map(c => c.idCuestionario).join(',') : '') }, 'Elegir modo y opciones', icono('derecha'))));
  }

  function tile(ic, valor, etiqueta, tipo) {
    return h('div.tile', { class: tipo ? 'tile-' + tipo : null },
      h('span.tile-icono', icono(ic)),
      h('strong', valor),
      h('span', etiqueta));
  }

  function mapaActividad() {
    const semanas = 18;
    const dias = Store.progreso().dias;
    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    const diaSemana = (hoy.getDay() + 6) % 7; // lunes = 0
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - ((semanas - 1) * 7 + diaSemana));

    const celdas = [];
    for (const d = new Date(inicio); d <= hoy; d.setDate(d.getDate() + 1)) {
      const n = dias[claveDia(d)] || 0;
      const nivel = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4;
      const fecha = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
      celdas.push(h('span.celda', { class: 'n' + nivel, title: `${fecha}: ${n ? plural(n, 'respuesta') : 'sin actividad'}` }));
    }
    return h('div.mapa', celdas);
  }

  function repasoRapido(cs) {
    const p = Store.prefs();
    Sesion.iniciar({
      cids: cs.map(c => c.idCuestionario),
      modo: 'repaso',
      cantidad: 20,
      tipos: p.tipos.multiple || p.tipos.desarrollar ? p.tipos : { multiple: true, desarrollar: true },
      filtro: 'todas',
      mezclarOpciones: p.mezclarOpciones,
      mostrarCantidad: p.mostrarCantidad,
      titulo: materia === 'todas' ? 'Repaso rápido' : `Repaso rápido · ${materia || 'Sin materia'}`,
    });
  }

  /* --- Cuestionarios --- */

  function seccionCuestionarios() {
    const materias = Store.materias();
    const haySinMateria = Store.cuestionarios().some(c => !c.materia);
    const opcionesMateria = materias.length
      ? [['todas', 'Todas'], ...materias.map(m => [m, m]), ...(haySinMateria ? [['', 'Sin materia']] : [])]
      : [];

    grilla = h('div.grilla-wrap');
    const seccion = h('section.seccion-cuestionarios',
      h('div.seccion-cab',
        h('h2', 'Tus cuestionarios'),
        h('div.fila-botones',
          h('a.btn.btn-sec.btn-sm', { href: '#/datos' }, icono('subir'), 'Importar'),
          h('a.btn.btn-pri.btn-sm', { href: '#/nuevo' + (materia && materia !== 'todas' ? '?materia=' + encodeURIComponent(materia) : '') }, icono('mas'), 'Nuevo'))),
      h('div.barra-filtros',
        h('div.buscador', icono('buscar'), h('input.input', {
          type: 'search', placeholder: 'Buscar…', value: busqueda, 'aria-label': 'Buscar cuestionario',
          oninput: e => { busqueda = e.target.value; pintarGrilla(); },
        })),
        opcionesMateria.length ? h('div.chips', opcionesMateria.map(([valor, label]) => h('button.chip', {
          type: 'button', class: materia === valor ? 'activo' : null,
          onclick: () => { materia = valor; pintar(); },
        }, label))) : null),
      grilla);
    pintarGrilla();
    return seccion;
  }

  function pintarGrilla() {
    const q = normalizar(busqueda);
    const lista = filtradosPorMateria().filter(c => !q || normalizar(c.nombre + ' ' + (c.materia || '')).includes(q));

    if (!lista.length) {
      grilla.replaceChildren(h('p.texto-suave.centrado', 'No hay cuestionarios que coincidan.'));
      return;
    }

    const agrupar = materia === 'todas' && Store.materias().length > 0;
    if (!agrupar) {
      grilla.replaceChildren(h('div.grilla', lista.map(tarjeta)));
      return;
    }
    const grupos = new Map();
    for (const c of lista) {
      const m = c.materia || 'Sin materia';
      if (!grupos.has(m)) grupos.set(m, []);
      grupos.get(m).push(c);
    }
    const orden = [...grupos.keys()].sort((a, b) => (a === 'Sin materia') - (b === 'Sin materia') || a.localeCompare(b, 'es'));
    grilla.replaceChildren(...orden.map(m => h('div.grupo',
      h('h3.grupo-titulo', icono('carpeta'), m, h('span.chip-n', grupos.get(m).length)),
      h('div.grilla', grupos.get(m).map(tarjeta)))));
  }

  function tarjeta(c) {
    const id = c.idCuestionario;
    const st = Store.estadisticas(c.preguntas);
    const nMultiple = c.preguntas.filter(p => p.tipo === 'multiple').length;
    const nDesarrollo = c.preguntas.length - nMultiple;
    const elegido = seleccion.has(id);
    const pct = st.total ? Math.round(st.dominadas / st.total * 100) : 0;

    return h('article.cuest', { class: elegido ? 'seleccionado' : null },
      h('label.cuest-check', { title: 'Seleccionar para estudiar junto con otros' },
          h('input', {
            type: 'checkbox', checked: elegido, 'aria-label': `Seleccionar ${c.nombre}`,
            onchange: e => {
              e.target.checked ? seleccion.add(id) : seleccion.delete(id);
              e.target.closest('.cuest').classList.toggle('seleccionado', e.target.checked);
              actualizarBarraSeleccion();
            },
          }),
          h('span.selector-check', icono('check'))),
      h('h3.cuest-nombre', h('a', { href: `#/ver/${id}` }, c.nombre)),
      h('p.cuest-meta', plural(st.total, 'pregunta'),
        nMultiple && nDesarrollo ? ` · ${nMultiple} múltiple · ${nDesarrollo} desarrollo` : ''),
      barraProgreso(st),
      h('div.cuest-estado',
        h('span', st.nuevas === st.total ? 'Sin empezar' : `${pct}% dominado`),
        st.pendientes ? h('span.texto-pendiente', `${st.pendientes} para repasar`) : null,
        st.problemas ? h('a.texto-aviso', { href: `#/editar/${id}?filtro=problemas`, title: 'Preguntas con datos incompletos (clic para revisarlas)' }, icono('alerta'), st.problemas) : null),
      h('p.cuest-fecha', st.ultima ? `Último repaso ${haceCuanto(st.ultima)}` : 'Nunca estudiado'),
      h('div.cuest-acciones',
        h('a.btn.btn-pri.btn-sm', { href: `#/estudiar?c=${id}`, class: st.total ? null : 'deshabilitado' }, icono('play'), 'Estudiar'),
        h('a.btn.btn-sec.btn-sm', { href: `#/ver/${id}` }, icono('ojo'), 'Ver'),
        h('a.icono-btn', { href: `#/editar/${id}`, title: 'Editar', 'aria-label': 'Editar' }, icono('lapiz'))));
  }

  function actualizarBarraSeleccion() {
    $('.barra-seleccion')?.remove();
    if (!seleccion.size) return;
    const ids = [...seleccion];
    const total = Store.estadisticas(ids.flatMap(id => Store.cuestionario(id)?.preguntas || [])).total;
    document.body.append(h('div.barra-seleccion',
      h('span', h('strong', plural(ids.length, 'cuestionario')), ` · ${plural(total, 'pregunta')}`),
      h('button.btn.btn-ghost.btn-sm', {
        type: 'button',
        onclick: () => { seleccion.clear(); pintar(); },
      }, 'Limpiar'),
      h('a.btn.btn-pri.btn-sm', { href: `#/estudiar?c=${ids.join(',')}` }, icono('play'), 'Estudiar juntos')));
  }

  /* --- Primera vez --- */

  function bienvenida() {
    const paso = (n, titulo, texto) => h('li.paso', h('span.paso-n', n), h('div', h('strong', titulo), h('p', texto)));
    return h('div.bienvenida',
      h('div.bienvenida-hero',
        h('p.supra', 'Cuestionarios'),
        h('h1', 'Estudiá con tus preguntas, sin espiar las respuestas'),
        h('p.bienvenida-sub', 'Cargá tus preguntas una vez y practicalas como si fuera un examen. La app recuerda qué sabés y qué no, y te muestra lo que más necesitás repasar.'),
        h('div.fila-botones.centrado',
          h('a.btn.btn-pri.btn-lg', { href: '#/nuevo' }, icono('mas'), 'Crear cuestionario'),
          h('a.btn.btn-sec.btn-lg', { href: '#/datos' }, icono('subir'), 'Importar backup'))),
      h('ol.pasos',
        paso(1, 'Cargá preguntas', 'Escribilas en el editor, pegalas como texto o importá un archivo. También podés pedirle a una IA que las genere desde tus apuntes.'),
        paso(2, 'Respondé a ciegas', 'La respuesta recién aparece cuando la pedís. En desarrollo escribís lo tuyo y lo comparás.'),
        paso(3, 'Repasá lo justo', 'El repaso inteligente prioriza lo que fallaste y lo que hace rato no ves.')));
  }

  return { render };
})();
