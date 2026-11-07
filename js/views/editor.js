'use strict';

/* ==========================================================================
   Editor de cuestionarios (crear y modificar).
   Se trabaja sobre una copia: nada se guarda hasta tocar "Guardar" (o Ctrl+S).
   ========================================================================== */

const Editor = (() => {
  let draft = null;
  let original = null;
  let sucio = false;
  let abiertas = new Set();
  let busqueda = '';
  let filtro = 'todas';
  let raizVista = null;
  let listaEl = null;
  let barraEl = null;
  let contadores = {};
  let uid = 0;

  const conUid = p => { p._uid = ++uid; return p; };
  const nodoDe = p => $(`[data-uid="${p._uid}"]`, listaEl);

  const EJEMPLO = `¿Qué capa del modelo OSI se encarga del enrutamiento?
- Enlace de datos
+ Red
- Transporte

¿Cuáles de estos son lenguajes de marcado?
+ HTML
+ XML
- Python
E: Python es un lenguaje de programación.

Explicá qué es el DOM.
R: Es la representación en forma de árbol de un documento HTML,
que permite leerlo y modificarlo desde JavaScript.`;

  function nuevaPregunta(tipo) {
    const vacia = () => ({ texto: '', esCorrecta: false });
    return conUid({
      tipo,
      texto: '',
      opciones: tipo === 'multiple' ? [vacia(), vacia(), vacia(), vacia()] : [],
      respuesta: '',
      explicacion: '',
    });
  }

  function prepararPregunta(p) {
    conUid(p);
    p.opciones ||= [];
    p.respuesta ??= '';
    p.explicacion ??= '';
    return p;
  }

  /* ---------------- Ciclo de vida ---------------- */

  function render(contenedor, [id], query) {
    raizVista = contenedor;
    abiertas = new Set();
    busqueda = '';
    filtro = query.filtro === 'problemas' ? 'problemas' : 'todas';

    if (id) {
      original = Store.cuestionario(id);
      if (!original) return noEncontrado(contenedor);
      draft = clonar(original);
    } else {
      original = null;
      draft = { idCuestionario: null, nombre: '', fechaCreacion: new Date().toISOString(), preguntas: [] };
    }
    draft.materia ||= query.materia || '';
    draft.preguntas.forEach(prepararPregunta);
    sucio = false;

    let destacar = null;
    if (!id) {
      const p = nuevaPregunta('multiple');
      draft.preguntas.push(p);
      abiertas.add(p._uid);
    }
    if (query.q) {
      const p = draft.preguntas.find(x => Store.clave(x) === query.q);
      if (p) { abiertas.add(p._uid); destacar = p; }
    }

    pintar();

    requestAnimationFrame(() => {
      if (destacar) {
        const el = nodoDe(destacar);
        el?.scrollIntoView({ block: 'center' });
        el?.classList.add('destacada');
      } else if (!id) {
        $('#ed-nombre')?.focus();
      }
    });

    App.setCambiosPendientes(() => sucio);
    document.addEventListener('keydown', alPresionar);
    return () => {
      App.setCambiosPendientes(null);
      document.removeEventListener('keydown', alPresionar);
    };
  }

  function alPresionar(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!hayDialogoAbierto()) guardar();
    }
  }

  function marcarCambio() {
    if (!sucio) {
      sucio = true;
      barraEl?.classList.add('sucia');
      const estado = $('.barra-guardar-estado', barraEl);
      if (estado) estado.replaceChildren(icono('alerta'), 'Cambios sin guardar');
    }
    actualizarContadores();
  }

  /* ---------------- Pintado ---------------- */

  function pintar() {
    listaEl = h('div.ed-lista');
    contadores = {
      total: h('span.chip-n'),
      todas: h('span.chip-n'),
      problemas: h('span.chip-n'),
    };

    raizVista.replaceChildren(h('div.editor',
      cabecera(),
      h('section.panel.ed-general',
        h('div.campo.ed-campo-nombre',
          h('label.campo-etiqueta', { for: 'ed-nombre' }, 'Nombre'),
          h('input.input.input-grande', {
            id: 'ed-nombre', value: draft.nombre, placeholder: 'Ej: Clase 3 · Modelo OSI', autocomplete: 'off',
            oninput: e => {
              draft.nombre = e.target.value;
              $('#ed-titulo').textContent = draft.nombre.trim() || 'Sin nombre';
              marcarCambio();
            },
          })),
        h('div.campo',
          h('label.campo-etiqueta', { for: 'ed-materia' }, 'Materia ', h('small', '(opcional, para agrupar)')),
          h('input.input', {
            id: 'ed-materia', list: 'ed-materias', value: draft.materia, placeholder: 'Ej: Redes', autocomplete: 'off',
            oninput: e => { draft.materia = e.target.value; marcarCambio(); },
          }),
          h('datalist', { id: 'ed-materias' }, Store.materias().map(m => h('option', { value: m }))))),

      h('div.seccion-cab.ed-barra',
        h('h2', 'Preguntas', contadores.total),
        h('div.barra-filtros',
          h('div.buscador', icono('buscar'), h('input.input', {
            type: 'search', placeholder: 'Buscar pregunta…', value: busqueda, 'aria-label': 'Buscar pregunta',
            oninput: e => { busqueda = e.target.value; pintarLista(); },
          })),
          h('div.chips',
            h('button.chip', { type: 'button', class: filtro === 'todas' ? 'activo' : null, onclick: () => { filtro = 'todas'; pintar(); } }, 'Todas', contadores.todas),
            h('button.chip.chip-aviso', { type: 'button', class: filtro === 'problemas' ? 'activo' : null, onclick: () => { filtro = 'problemas'; pintar(); } }, icono('alerta'), 'Con problemas', contadores.problemas)))),

      listaEl,

      h('div.ed-agregar',
        h('button.btn.btn-sec', { type: 'button', onclick: () => agregar('multiple') }, icono('mas'), 'Múltiple choice'),
        h('button.btn.btn-sec', { type: 'button', onclick: () => agregar('desarrollar') }, icono('mas'), 'Desarrollo'),
        h('button.btn.btn-ghost', { type: 'button', onclick: agregarDesdeTexto }, icono('texto'), 'Pegar varias de una')),

      barraGuardar()));

    pintarLista();
  }

  function cabecera() {
    const id = original?.idCuestionario;
    return h('div',
      h('a.volver', { href: '#/' }, icono('izquierda'), 'Biblioteca'),
      h('header.pagina-cab',
        h('div',
          h('p.supra', original ? 'Editar cuestionario' : 'Nuevo cuestionario'),
          h('h1', { id: 'ed-titulo' }, draft.nombre.trim() || 'Sin nombre')),
        original ? h('div.fila-botones',
          h('a.btn.btn-sec.btn-sm', { href: `#/ver/${id}` }, icono('ojo'), 'Ver'),
          h('a.btn.btn-sec.btn-sm', { href: `#/estudiar?c=${id}` }, icono('play'), 'Estudiar'),
          h('button.btn.btn-sec.btn-sm', { type: 'button', onclick: exportar }, icono('bajar'), 'Exportar'),
          h('button.btn.btn-sec.btn-sm', { type: 'button', onclick: duplicar }, icono('copiar'), 'Duplicar'),
          h('button.btn.btn-peligro-suave.btn-sm', { type: 'button', onclick: eliminar }, icono('basura'), 'Eliminar')) : null));
  }

  function barraGuardar() {
    barraEl = h('div.barra-guardar', { class: sucio ? 'sucia' : null },
      h('span.barra-guardar-estado', sucio ? [icono('alerta'), 'Cambios sin guardar'] : [icono('check'), original ? 'Todo guardado' : 'Sin guardar todavía']),
      h('span.espaciador'),
      original ? h('button.btn.btn-ghost.btn-sm.solo-sucia', { type: 'button', onclick: descartar }, 'Descartar cambios') : null,
      h('button.btn.btn-pri', { type: 'button', onclick: guardar }, icono('check'), 'Guardar', tocaPantalla() ? null : h('kbd', 'Ctrl S')));
    return barraEl;
  }

  function actualizarContadores() {
    const total = draft.preguntas.length;
    const problemas = draft.preguntas.filter(p => Store.problemas(p).length).length;
    contadores.total.textContent = total;
    contadores.todas.textContent = total;
    contadores.problemas.textContent = problemas;
  }

  function coincide(p) {
    if (filtro === 'problemas' && !Store.problemas(p).length) return false;
    const q = normalizar(busqueda);
    if (!q) return true;
    return normalizar([p.texto, ...p.opciones.map(o => o.texto), p.respuesta || ''].join(' ')).includes(q);
  }

  function pintarLista() {
    const nodos = [];
    draft.preguntas.forEach((p, i) => {
      if (abiertas.has(p._uid)) nodos.push(tarjetaEdicion(p, i));
      else if (coincide(p)) nodos.push(fila(p, i));
    });
    listaEl.replaceChildren(...nodos);
    if (!draft.preguntas.length) {
      listaEl.append(h('div.ed-vacio', icono('libro'), h('p', 'Todavía no hay preguntas. Agregá una con los botones de abajo o pegá varias de una.')));
    } else if (!nodos.length) {
      listaEl.append(h('p.texto-suave.centrado', filtro === 'problemas' && !busqueda ? '¡Ninguna pregunta tiene problemas! 🎉' : 'Ninguna pregunta coincide.'));
    }
    actualizarContadores();
  }

  function repintar(p) {
    const viejo = nodoDe(p);
    const i = draft.preguntas.indexOf(p);
    const nuevo = abiertas.has(p._uid) ? tarjetaEdicion(p, i) : fila(p, i);
    if (viejo) viejo.replaceWith(nuevo);
    return nuevo;
  }

  function fila(p, i) {
    const probs = Store.problemas(p);
    return h('button.ed-fila', {
      type: 'button',
      dataset: { uid: p._uid },
      onclick: () => { abiertas.add(p._uid); repintar(p).querySelector('.ed-texto')?.focus(); },
    },
    h('span.ed-num', i + 1),
    etiquetaTipo(p.tipo),
    h('span.ed-preview', p.texto.trim() || h('em', 'Sin texto')),
    probs.length ? h('span.ed-alerta', { title: probs.join(' · ') }, icono('alerta')) : null,
    icono('lapiz', 'ed-fila-icono'));
  }

  function botonIcono(ic, titulo, onclick, { deshabilitado = false, clase = '' } = {}) {
    return h('button.icono-btn', { type: 'button', title: titulo, 'aria-label': titulo, disabled: deshabilitado, class: clase || null, onclick }, icono(ic));
  }

  function tarjetaEdicion(p, i) {
    const probsEl = h('div.ed-problemas');
    const refrescarProblemas = () => probsEl.replaceChildren(...Store.problemas(p).map(t => h('span', icono('alerta'), t)));
    const cambio = () => { marcarCambio(); refrescarProblemas(); };
    refrescarProblemas();

    const texto = autoAltura(h('textarea.input.ed-texto', {
      rows: 2, value: p.texto, placeholder: 'Escribí la pregunta…',
      oninput: e => { p.texto = e.target.value; cambio(); },
    }));

    let cuerpo;
    if (p.tipo === 'multiple') {
      cuerpo = h('div.ed-opciones',
        h('p.campo-etiqueta', 'Opciones ', h('small', '· tocá el círculo para marcar las correctas · Enter agrega otra')),
        p.opciones.map((o, j) => filaOpcion(p, o, j, cambio)),
        h('button.btn-link', {
          type: 'button',
          onclick: () => { p.opciones.push({ texto: '', esCorrecta: false }); marcarCambio(); repintar(p); enfocarOpcion(p, p.opciones.length - 1); },
        }, icono('mas'), 'Agregar opción'));
    } else {
      cuerpo = h('div.campo',
        h('span.campo-etiqueta', 'Respuesta esperada ', h('small', '· queda oculta hasta que la revelás')),
        autoAltura(h('textarea.input', {
          rows: 3, value: p.respuesta || '', placeholder: 'Lo que debería contener una buena respuesta…',
          oninput: e => { p.respuesta = e.target.value; cambio(); },
        })));
    }

    const ultimo = i === draft.preguntas.length - 1;
    return h('article.ed-card', { dataset: { uid: p._uid } },
      h('div.ed-card-cab',
        h('span.ed-num', i + 1),
        h('div.segmentado.segmentado-chico', ['multiple', 'desarrollar'].map(t => h('button', {
          type: 'button', class: p.tipo === t ? 'activo' : null, onclick: () => cambiarTipo(p, t),
        }, NOMBRE_TIPO[t]))),
        h('span.espaciador'),
        botonIcono('arriba', 'Subir', () => mover(p, -1), { deshabilitado: i === 0 }),
        botonIcono('abajo', 'Bajar', () => mover(p, 1), { deshabilitado: ultimo }),
        botonIcono('copiar', 'Duplicar', () => duplicarPregunta(p)),
        botonIcono('basura', 'Eliminar pregunta', () => eliminarPregunta(p), { clase: 'icono-peligro' }),
        h('button.btn.btn-sec.btn-sm', { type: 'button', onclick: () => { abiertas.delete(p._uid); repintar(p); } }, 'Cerrar')),
      texto,
      cuerpo,
      h('details.ed-explicacion', { open: !!p.explicacion },
        h('summary', 'Explicación ', h('small', '(opcional, se muestra después de responder)')),
        autoAltura(h('textarea.input', {
          rows: 2, value: p.explicacion || '', placeholder: 'Por qué la respuesta es esa, un ejemplo, un truco para recordarla…',
          oninput: e => { p.explicacion = e.target.value; marcarCambio(); },
        }))),
      probsEl);
  }

  function filaOpcion(p, o, j, cambio) {
    const filaEl = h('div.ed-opcion', { class: o.esCorrecta ? 'correcta' : null },
      h('button.ed-opcion-check', {
        type: 'button',
        'aria-pressed': String(o.esCorrecta),
        title: o.esCorrecta ? 'Correcta (clic para desmarcar)' : 'Marcar como correcta',
        onclick: e => {
          o.esCorrecta = !o.esCorrecta;
          filaEl.classList.toggle('correcta', o.esCorrecta);
          e.currentTarget.setAttribute('aria-pressed', String(o.esCorrecta));
          e.currentTarget.title = o.esCorrecta ? 'Correcta (clic para desmarcar)' : 'Marcar como correcta';
          cambio();
        },
      }, icono('check')),
      h('input.input.ed-opcion-texto', {
        type: 'text', value: o.texto, placeholder: `Opción ${j + 1}`,
        oninput: e => { o.texto = e.target.value; cambio(); },
        onkeydown: e => {
          if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            p.opciones.splice(j + 1, 0, { texto: '', esCorrecta: false });
            marcarCambio();
            repintar(p);
            enfocarOpcion(p, j + 1);
          } else if (e.key === 'Backspace' && !e.target.value && p.opciones.length > 1) {
            e.preventDefault();
            p.opciones.splice(j, 1);
            marcarCambio();
            repintar(p);
            enfocarOpcion(p, Math.max(0, j - 1));
          }
        },
      }),
      h('button.icono-btn.ed-opcion-quitar', {
        type: 'button', title: 'Quitar opción', 'aria-label': 'Quitar opción',
        onclick: () => { p.opciones.splice(j, 1); marcarCambio(); repintar(p); },
      }, icono('x')));
    return filaEl;
  }

  function enfocarOpcion(p, j) {
    const inp = $$('.ed-opcion-texto', nodoDe(p) || listaEl)[j];
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  /* ---------------- Acciones sobre preguntas ---------------- */

  function agregar(tipo) {
    const p = nuevaPregunta(tipo);
    draft.preguntas.push(p);
    abiertas.add(p._uid);
    pintarLista();
    const nodo = nodoDe(p);
    nodo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nodo?.querySelector('.ed-texto')?.focus({ preventScroll: true });
  }

  function cambiarTipo(p, tipo) {
    if (p.tipo === tipo) return;
    p.tipo = tipo;
    if (tipo === 'multiple' && !p.opciones.length) p.opciones = [{ texto: '', esCorrecta: false }, { texto: '', esCorrecta: false }];
    marcarCambio();
    repintar(p);
  }

  function mover(p, delta) {
    const i = draft.preguntas.indexOf(p);
    const j = i + delta;
    if (j < 0 || j >= draft.preguntas.length) return;
    [draft.preguntas[i], draft.preguntas[j]] = [draft.preguntas[j], draft.preguntas[i]];
    marcarCambio();
    pintarLista();
    nodoDe(p)?.scrollIntoView({ block: 'nearest' });
  }

  function duplicarPregunta(p) {
    const copia = prepararPregunta(clonar(p));
    draft.preguntas.splice(draft.preguntas.indexOf(p) + 1, 0, copia);
    abiertas.add(copia._uid);
    marcarCambio();
    pintarLista();
    nodoDe(copia)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function eliminarPregunta(p) {
    const d = draft;
    const i = d.preguntas.indexOf(p);
    d.preguntas.splice(i, 1);
    abiertas.delete(p._uid);
    marcarCambio();
    pintarLista();
    toast('Pregunta eliminada', {
      accion: {
        label: 'Deshacer',
        fn: () => {
          if (draft !== d) return;
          d.preguntas.splice(Math.min(i, d.preguntas.length), 0, p);
          abiertas.add(p._uid);
          marcarCambio();
          pintarLista();
        },
      },
    });
  }

  async function agregarDesdeTexto() {
    let detectadas = [];
    let omitirRepetidas = true;
    const estado = h('p.importar-estado.texto-suave', 'Pegá tus preguntas para ver cuántas se detectan.');
    const ta = h('textarea.input.mono', { rows: 14, placeholder: EJEMPLO, spellcheck: false });

    const analizar = () => {
      if (!ta.value.trim()) {
        detectadas = [];
        estado.className = 'importar-estado texto-suave';
        estado.textContent = 'Pegá tus preguntas para ver cuántas se detectan.';
        return;
      }
      try {
        const r = Store.interpretar(ta.value);
        detectadas = [...r.preguntas, ...r.cuestionarios.flatMap(c => c.preguntas)];
        const m = detectadas.filter(p => p.tipo === 'multiple').length;
        const conProblemas = detectadas.filter(p => Store.problemas(p).length).length;
        estado.className = 'importar-estado ok';
        estado.textContent = `Se detectaron ${plural(detectadas.length, 'pregunta')} (${m} múltiple choice, ${detectadas.length - m} de desarrollo)` +
          (conProblemas ? ` · ${conProblemas} con datos incompletos` : '');
      } catch (err) {
        detectadas = [];
        estado.className = 'importar-estado error';
        estado.textContent = err.message;
      }
    };
    ta.addEventListener('input', analizar);

    const ok = await dialogo({
      titulo: 'Agregar varias preguntas',
      ancho: 'grande',
      contenido: h('div.importar-texto',
        ayudaFormato(),
        ta,
        estado,
        interruptor('Saltear preguntas que ya están en este cuestionario', true, v => { omitirRepetidas = v; })),
      acciones: [
        { label: 'Cancelar', valor: false },
        { label: 'Agregar', clase: 'btn-pri', icono: 'mas', valor: () => (detectadas.length ? true : (toast('No se detectó ninguna pregunta.', { tipo: 'aviso' }), false)) },
      ],
      alAbrir: () => ta.focus(),
    });
    if (!ok) return;

    const existentes = new Set(draft.preguntas.map(p => Store.clave(Store.normPregunta(p) || p)));
    const nuevas = omitirRepetidas ? detectadas.filter(p => !existentes.has(Store.clave(p))) : detectadas;
    nuevas.forEach(p => draft.preguntas.push(prepararPregunta(clonar(p))));
    const salteadas = detectadas.length - nuevas.length;
    if (nuevas.length) marcarCambio();
    pintarLista();
    toast(`Se agregaron ${plural(nuevas.length, 'pregunta')}` + (salteadas ? ` (${salteadas} repetidas salteadas)` : '') + '. Acordate de guardar.', { tipo: 'ok', duracion: 5000 });
  }

  function ayudaFormato() {
    return h('details.ayuda-formato',
      h('summary', icono('info'), '¿Cómo tengo que escribirlas?'),
      h('div.ayuda-formato-cuerpo',
        h('ul',
          h('li', 'Separá cada pregunta con una ', h('strong', 'línea en blanco'), '.'),
          h('li', 'Opciones: ', h('code', '+'), ' adelante si es correcta, ', h('code', '-'), ' si es incorrecta (también sirven ', h('code', '[x]'), ' y ', h('code', '[ ]'), ').'),
          h('li', 'Desarrollo: poné la respuesta después de ', h('code', 'R:'), ' (puede ocupar varias líneas).'),
          h('li', 'Opcional: ', h('code', 'E:'), ' para una explicación que se muestra al responder.'),
          h('li', 'También podés pegar el JSON de un backup.')),
        h('pre.ejemplo', EJEMPLO),
        h('button.btn.btn-sec.btn-sm', {
          type: 'button',
          onclick: async () => toast(await copiarAlPortapapeles(Datos.PROMPT_IA) ? 'Instrucciones copiadas: pegalas en tu IA junto con tus apuntes.' : 'No se pudo copiar.', { tipo: 'ok', duracion: 5000 }),
        }, icono('robot'), 'Copiar instrucciones para generarlas con IA')));
  }

  /* ---------------- Guardar y acciones del cuestionario ---------------- */

  function guardar() {
    if (!draft.nombre.trim()) {
      toast('Ponele un nombre al cuestionario.', { tipo: 'aviso' });
      $('#ed-nombre')?.focus();
      return false;
    }
    const vacias = draft.preguntas.filter(p => !p.texto.trim()).length;
    draft.preguntas = draft.preguntas.filter(p => p.texto.trim());
    for (const p of draft.preguntas) {
      if (p.tipo === 'multiple') p.opciones = p.opciones.filter(o => o.texto.trim());
    }
    draft.idCuestionario ||= Store.nuevoId();

    const guardado = Store.guardarCuestionario(draft);
    const esNuevo = !original;
    original = guardado;
    sucio = false;

    const conProblemas = guardado.preguntas.filter(p => Store.problemas(p).length).length;
    let msj = 'Cuestionario guardado';
    if (vacias) msj += ` (se descartaron ${plural(vacias, 'pregunta vacía', 'preguntas vacías')})`;
    toast(msj, {
      tipo: conProblemas ? 'aviso' : 'ok',
      ...(conProblemas ? { accion: { label: `Ver ${conProblemas} con problemas`, fn: () => { filtro = 'problemas'; pintar(); } } } : {}),
    });

    if (esNuevo) location.replace(`#/editar/${guardado.idCuestionario}`);
    else pintar();
    return true;
  }

  async function descartar() {
    if (!await confirmar('Se pierden todos los cambios desde la última vez que guardaste.', { titulo: '¿Descartar cambios?', ok: 'Descartar', peligro: true })) return;
    sucio = false;
    App.refrescar();
  }

  function nombreArchivo(nombre) {
    return nombre.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'cuestionario';
  }

  function exportar() {
    descargarArchivo(`${nombreArchivo(original.nombre)}.json`, Store.exportarCuestionarios([original]));
    if (sucio) toast('Se exportó la última versión guardada (hay cambios sin guardar).', { tipo: 'aviso' });
  }

  function duplicar() {
    const copia = clonar(original);
    copia.idCuestionario = Store.nuevoId();
    copia.nombre = `${original.nombre} (copia)`;
    copia.fechaCreacion = new Date().toISOString();
    const guardada = Store.guardarCuestionario(copia);
    toast('Se creó una copia', { tipo: 'ok' });
    location.hash = `#/editar/${guardada.idCuestionario}`;
  }

  async function eliminar() {
    const ok = await confirmar(
      h('p', 'Se va a borrar ', h('strong', original.nombre), ` con sus ${plural(original.preguntas.length, 'pregunta')}. Tu progreso de estudio no se pierde.`),
      { titulo: '¿Eliminar cuestionario?', ok: 'Eliminar', peligro: true });
    if (!ok) return;
    const respaldo = clonar(original);
    Store.eliminarCuestionario(original.idCuestionario);
    sucio = false;
    location.hash = '#/';
    toast('Cuestionario eliminado', {
      accion: { label: 'Deshacer', fn: () => { Store.importarCuestionarios([respaldo]); App.refrescar(); } },
    });
  }

  return { render };
})();
