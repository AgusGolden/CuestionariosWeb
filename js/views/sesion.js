'use strict';

/* ==========================================================================
   Sesión de estudio: arma la lista de preguntas y la presenta de a una.
   La respuesta correcta no se agrega a la página hasta que la pedís, así que
   no hay forma de leerla sin querer.
   ========================================================================== */

const Sesion = (() => {
  const MODOS = {
    repaso: {
      nombre: 'Repaso inteligente',
      icono: 'chispas',
      desc: 'Primero lo que te toca repasar, después lo nuevo. Lo que errás vuelve al final de la sesión.',
    },
    practica: {
      nombre: 'Práctica libre',
      icono: 'mezclar',
      desc: 'Preguntas al azar con corrección inmediata.',
    },
    examen: {
      nombre: 'Simulacro de examen',
      icono: 'diana',
      desc: 'Sin correcciones hasta el final. Podés ir y volver entre preguntas y poner tiempo límite.',
    },
  };

  /* ---------------- Armado de la sesión ---------------- */

  /** Preguntas disponibles (sin repetir) de los cuestionarios elegidos, según los filtros. */
  function construirPool(cids, { tipos, filtro = 'todas' }) {
    const vistas = new Set();
    const pool = [];
    for (const cid of cids) {
      const c = Store.cuestionario(cid);
      if (!c) continue;
      for (const p of c.preguntas) {
        const key = Store.clave(p);
        if (vistas.has(key)) continue;
        vistas.add(key);
        if (tipos && !tipos[p.tipo]) continue;
        const e = Store.estado(key);
        const vista = !!e?.vistas;
        if (filtro === 'falladas' && !(vista && e.ultimo !== 'bien')) continue;
        if (filtro === 'marcadas' && !e?.marcada) continue;
        if (filtro === 'nuevas' && vista) continue;
        if (filtro === 'pendientes' && !Store.esPendiente(key)) continue;
        pool.push({ key, cid: c.idCuestionario, cnombre: c.nombre, p });
      }
    }
    return pool;
  }

  function ordenar(pool, modo) {
    if (modo !== 'repaso') return mezclar(pool.slice());
    const ahora = Date.now();
    return pool
      .map(it => {
        const e = Store.estado(it.key);
        let prioridad;
        if (e?.vistas && e.proxima <= ahora) prioridad = (e.caja || 0) * 0.1;        // pendientes, las más flojas primero
        else if (!e?.vistas) prioridad = 1;                                          // nuevas
        else prioridad = 2 + (e.proxima - ahora) / (DIA_MS * 365);                   // el resto, las más próximas primero
        return { it, prioridad: prioridad + Math.random() * 0.05 };
      })
      .sort((a, b) => a.prioridad - b.prioridad)
      .map(x => x.it);
  }

  // Opciones como "Todas las anteriores" o "A y B" no se mezclan: quedan al final.
  const OPCION_FIJA = /\b(todas|ninguna|ambas)\b.*\b(anteriores|opciones|correctas|incorrectas|mencionadas)\b|^[a-e]\s*(y|e)\s*[a-e]\b/i;

  function ordenOpciones(p, mezclarlas) {
    const indices = p.opciones.map((_, i) => i);
    if (!mezclarlas) return indices;
    const fijas = indices.filter(i => OPCION_FIJA.test(p.opciones[i].texto));
    const libres = mezclar(indices.filter(i => !fijas.includes(i)));
    return [...libres, ...fijas];
  }

  function nuevoItem(e, mezclarOpciones, extra = {}) {
    return {
      key: e.key, cid: e.cid, cnombre: e.cnombre,
      p: clonar(e.p),
      orden: e.p.tipo === 'multiple' ? ordenOpciones(e.p, mezclarOpciones) : null,
      r: null,
      ...extra,
    };
  }

  function tituloPara(cids) {
    const nombres = cids.map(id => Store.cuestionario(id)?.nombre).filter(Boolean);
    if (nombres.length === 1) return nombres[0];
    if (nombres.length > 2 && nombres.length === Store.cuestionarios().length) return 'Toda la biblioteca';
    if (nombres.length === 2) return nombres.join(' + ');
    return `${nombres[0]} y ${nombres.length - 1} más`;
  }

  function seleccionar(cfg) {
    const pool = ordenar(construirPool(cfg.cids, cfg), cfg.modo);
    return cfg.cantidad > 0 ? pool.slice(0, cfg.cantidad) : pool;
  }

  function iniciar(cfg) {
    const elegidas = seleccionar(cfg);
    if (!elegidas.length) {
      toast('No hay preguntas que coincidan con esos filtros.', { tipo: 'aviso' });
      return false;
    }
    return iniciarConItems(elegidas, { ...cfg, titulo: cfg.titulo || tituloPara(cfg.cids) });
  }

  function iniciarConItems(entradas, { modo = 'practica', titulo = 'Sesión', mezclarOpciones = true, mostrarCantidad = false, minutos = 0 }) {
    const sesion = {
      id: Date.now(),
      modo,
      titulo,
      inicio: Date.now(),
      tiempoMs: 0,
      limiteMs: modo === 'examen' && minutos > 0 ? minutos * 60000 : 0,
      cfg: { mezclarOpciones, mostrarCantidad, minutos },
      items: entradas.map(e => nuevoItem(e, mezclarOpciones)),
      pos: 0,
      terminada: false,
    };
    Store.setSesion(sesion);
    location.hash = '#/sesion';
    return true;
  }

  /* ---------------- Corrección ---------------- */

  function evaluarMultiple(p, seleccion) {
    const elegidas = new Set(seleccion);
    const correctas = p.opciones.map((o, i) => (o.esCorrecta ? i : -1)).filter(i => i >= 0);
    const aciertos = correctas.filter(i => elegidas.has(i)).length;
    const errores = seleccion.filter(i => !p.opciones[i]?.esCorrecta).length;
    if (!errores && aciertos === correctas.length) return 'bien';
    if (!errores && aciertos > 0) return 'parcial';
    return 'mal';
  }

  const PALABRAS_VACIAS = new Set(`
    porque aunque cuando donde desde hasta entre sobre tambien ademas mientras mediante segun puede pueden
    tiene tienen hacer hacen siendo estos estas otros otras todos todas mismo misma mismos mismas cuales
    dicho dicha debe deben forma manera traves parte seria tener estar estan fueron habia ellos ellas
    nuestro nuestra alguna alguno algunos algunas varios varias muchos muchas menos antes despues luego
    siempre nunca sino entonces incluso ejemplo cosas cosa donde aquel aquella aquellos sean cada cuanto
    tanto tantos tanta tantas punto vista
    which there their these those about would could should where while`.trim().split(/\s+/));

  const raiz = palabra => (palabra.length > 6 ? palabra.slice(0, 6) : palabra);

  /**
   * Compara tu respuesta con la esperada: marca qué palabras clave de la
   * esperada mencionaste. Es una ayuda para autoevaluarte, no una nota.
   */
  function analizarCobertura(esperada, propia) {
    const propias = new Set((normalizar(propia).match(/[a-z0-9]+/g) || []).map(raiz));
    const claves = new Map();
    const partes = String(esperada).split(/([\p{L}\p{N}]+)/u);
    const nodos = partes.map((parte, i) => {
      if (i % 2 === 0) return parte;
      const norm = normalizar(parte);
      const sigla = /^[A-Z0-9]{2,}$/.test(parte) && /[A-Z]/.test(parte);
      if (!sigla && (norm.length < 5 || PALABRAS_VACIAS.has(norm))) return parte;
      const r = raiz(norm);
      const ok = propias.has(r);
      claves.set(r, ok);
      return h('span', { class: ok ? 'clave clave-ok' : 'clave clave-falta' }, parte);
    });
    const total = claves.size;
    const cubiertas = [...claves.values()].filter(Boolean).length;
    return { nodos, total, cubiertas };
  }

  const respondidaEnExamen = it => (it.p.tipo === 'multiple' ? it.r?.sel?.length > 0 : !!it.r?.texto?.trim());

  /* ---------------- Reproductor ---------------- */

  let s = null;          // sesión actual
  let raizVista = null;  // contenedor
  let desde = 0;         // momento desde el que corre el reloj
  let tick = null;
  let posPintada = -1;
  let diferido = null;

  const actual = () => s.items[s.pos];
  const respuestaDe = it => (it.r ||= { sel: [], texto: '', res: null, revelada: false });
  const transcurrido = () => (s.tiempoMs || 0) + (Date.now() - desde);

  function guardar() {
    if (!s) return;
    clearTimeout(diferido);
    s.tiempoMs = transcurrido();
    desde = Date.now();
    Store.setSesion(s);
  }

  function guardarDiferido() {
    clearTimeout(diferido);
    diferido = setTimeout(guardar, 500);
  }

  function render(contenedor) {
    s = Store.getSesion();
    if (!s || !Array.isArray(s.items) || !s.items.length) { location.replace('#/'); return; }
    if (s.terminada) { location.replace('#/resultados'); return; }
    raizVista = contenedor;
    desde = Date.now();
    posPintada = -1;
    document.body.classList.add('modo-foco');
    pintar();
    document.addEventListener('keydown', alPresionar);
    window.addEventListener('pagehide', guardar);
    tick = setInterval(actualizarReloj, 1000);

    return () => {
      guardar();
      document.body.classList.remove('modo-foco');
      document.removeEventListener('keydown', alPresionar);
      window.removeEventListener('pagehide', guardar);
      clearInterval(tick);
      s = null;
    };
  }

  function pintar() {
    const it = actual();
    const r = respuestaDe(it);
    const entrando = posPintada !== s.pos;
    posPintada = s.pos;

    raizVista.replaceChildren(h('div.sesion',
      barraSuperior(it, r),
      tarjeta(it, r, entrando),
      s.modo === 'examen' ? navegador() : null,
      tocaPantalla() ? null : atajos(it, r),
    ));

    if (entrando) window.scrollTo({ top: 0 });
    const ta = $('.resp-propia', raizVista);
    if (ta && entrando && !tocaPantalla()) ta.focus();
  }

  function contar() {
    const c = { bien: 0, parcial: 0, mal: 0 };
    for (const it of s.items) if (!it.repeticion && it.r?.res) c[it.r.res]++;
    return c;
  }

  function barraSuperior(it, r) {
    const total = s.items.length;
    const examen = s.modo === 'examen';
    const hechas = examen ? s.items.filter(respondidaEnExamen).length : s.pos + (r.res ? 1 : 0);
    const c = contar();
    const reloj = s.limiteMs ? s.limiteMs - transcurrido() : transcurrido();

    return h('header.sesion-barra',
      h('div.sesion-barra-fila',
        h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: salir, title: 'Salir (Esc)' }, icono('izquierda'), 'Salir'),
        h('div.sesion-titulo', h('strong', s.titulo), h('span', MODOS[s.modo].nombre)),
        h('div.sesion-marcador',
          examen ? null : [
            h('span.cuenta.cuenta-bien', { title: 'Correctas' }, icono('check'), c.bien),
            c.parcial ? h('span.cuenta.cuenta-parcial', { title: 'Parciales' }, '½', c.parcial) : null,
            h('span.cuenta.cuenta-mal', { title: 'Incorrectas' }, icono('x'), c.mal),
          ],
          h('span.cuenta.cuenta-reloj', { class: s.limiteMs && reloj < 60000 ? 'urgente' : null, title: s.limiteMs ? 'Tiempo restante' : 'Tiempo' },
            icono('reloj'), h('span', { id: 'reloj-texto' }, formatoReloj(reloj))))),
      h('div.sesion-progreso',
        h('div.progreso', h('span', { style: { width: (hechas / total * 100) + '%' } })),
        h('span.sesion-contador', `${s.pos + 1} / ${total}`)));
  }

  function tarjeta(it, r, entrando) {
    const p = it.p;
    const marcada = Store.estaMarcada(it.key);
    const variosCuestionarios = new Set(s.items.map(i => i.cid)).size > 1;
    const revelada = r.revelada && s.modo !== 'examen';

    return h('article.pregunta-tarjeta', { class: [entrando && 'entrando', revelada && r.res && 'res-' + r.res].filter(Boolean).join(' ') },
      h('div.pregunta-meta',
        etiquetaTipo(p.tipo),
        it.repeticion ? h('span.etiqueta.etiqueta-repeticion', icono('repetir'), 'Segundo intento') : null,
        variosCuestionarios ? h('span.pregunta-origen', { title: it.cnombre }, it.cnombre) : null,
        h('span.espaciador'),
        h('button.icono-btn.btn-bandera', {
          type: 'button', class: marcada ? 'activa' : null, 'aria-pressed': String(marcada),
          title: marcada ? 'Quitar marca (F)' : 'Marcar para repasar después (F)', onclick: marcar,
        }, icono('bandera')),
        h('button.icono-btn', { type: 'button', title: 'Editar esta pregunta (E)', onclick: editar }, icono('lapiz'))),
      h('h2.pregunta-texto', p.texto),
      p.tipo === 'multiple' ? cuerpoMultiple(it, r) : cuerpoDesarrollo(it, r),
      acciones(it, r));
  }

  function cuerpoMultiple(it, r) {
    const p = it.p;
    const revelada = r.revelada && s.modo !== 'examen';
    const nCorrectas = p.opciones.filter(o => o.esCorrecta).length;
    const elegidas = new Set(r.sel);

    const vf = esVerdaderoFalso(p);
    let pista = null;
    if (!revelada) {
      if (vf) pista = '¿Verdadero o falso?';
      else pista = s.cfg.mostrarCantidad && nCorrectas
        ? (nCorrectas === 1 ? 'Elegí 1 opción' : `Elegí ${nCorrectas} opciones`)
        : 'Marcá todas las que sean correctas';
    }

    const opciones = it.orden.map((idx, n) => {
      const o = p.opciones[idx];
      const elegida = elegidas.has(idx);
      const clases = [elegida && 'elegida'];
      let marca = null;
      if (revelada) {
        if (o.esCorrecta && elegida) { clases.push('acierto'); marca = icono('check'); }
        else if (o.esCorrecta) { clases.push('faltante'); marca = h('span.opcion-nota', icono('check'), 'Correcta'); }
        else if (elegida) { clases.push('error'); marca = icono('x'); }
        else clases.push('apagada');
      }
      return h('button.opcion', {
        type: 'button',
        class: clases.filter(Boolean).join(' '),
        'aria-pressed': String(elegida),
        disabled: revelada,
        onclick: () => alternarOpcion(idx),
      },
      h('span.opcion-tecla', n < 9 ? String(n + 1) : '•'),
      h('span.opcion-texto', vf ? textoVF(o.texto) : o.texto),
      marca ? h('span.opcion-marca', marca) : null);
    });

    return h('div.pregunta-cuerpo',
      pista ? h('p.pregunta-pista', pista) : null,
      h('div.opciones', { role: 'group' }, opciones),
      revelada ? devolucionMultiple(it, r) : null);
  }

  // Preguntas cargadas con opciones "V" / "F": se muestran como verdadero o falso.
  const VF = { v: 'Verdadero', verdadero: 'Verdadero', f: 'Falso', falso: 'Falso' };
  const claveVF = t => normalizar(t).replace(/[.\s]+$/, '');
  const esVerdaderoFalso = p => p.opciones.length === 2 && p.opciones.every(o => VF[claveVF(o.texto)]);
  const textoVF = t => VF[claveVF(t)] || t;

  function devolucionMultiple(it, r) {
    const p = it.p;
    const textos = {
      bien: ['¡Correcto!', 'check'],
      parcial: ['Casi: te faltó marcar alguna correcta', 'alerta'],
      mal: [r.noSe ? 'Estas eran las correctas' : 'Incorrecto', 'x'],
    };
    const [mensaje, ic] = textos[r.res];
    return h('div.devolucion',
      h(`div.veredicto.veredicto-${r.res}`, icono(ic), h('span', mensaje)),
      p.opciones.some(o => o.esCorrecta) ? null : h('div.aviso', icono('alerta'),
        h('span', 'Esta pregunta no tiene ninguna opción cargada como correcta. ',
          h('a', { href: enlaceEditar(it) }, 'Corregila en el editor'))),
      p.explicacion ? bloqueExplicacion(p.explicacion) : null);
  }

  function bloqueExplicacion(texto) {
    return h('div.explicacion', icono('bombilla'), h('div', h('strong', 'Explicación'), h('p', texto)));
  }

  function cuerpoDesarrollo(it, r) {
    const p = it.p;
    const examen = s.modo === 'examen';

    if (examen || !r.revelada) {
      const ta = autoAltura(h('textarea.resp-propia', {
        rows: 4,
        value: r.texto,
        placeholder: examen ? 'Escribí tu respuesta…' : 'Escribí tu respuesta (opcional): después la comparás con la esperada.',
        oninput: e => { r.texto = e.target.value; guardarDiferido(); },
      }));
      return h('div.pregunta-cuerpo', ta,
        examen ? null : h('p.pregunta-pista', 'Pensala, y cuando quieras revelá la respuesta',
          tocaPantalla() ? '.' : [' (', h('kbd', 'Ctrl'), ' + ', h('kbd', 'Enter'), ').']));
    }

    const propia = r.texto.trim();
    const cobertura = propia && p.respuesta ? analizarCobertura(p.respuesta, propia) : null;

    return h('div.pregunta-cuerpo',
      h('div.comparacion', { class: propia ? 'dos-columnas' : null },
        propia ? h('section.comparacion-col', h('h3', 'Tu respuesta'), h('div.texto-largo', propia)) : null,
        h('section.comparacion-col.comparacion-esperada',
          h('h3', 'Respuesta esperada'),
          h('div.texto-largo', cobertura ? cobertura.nodos : (p.respuesta || 'No hay respuesta esperada cargada.')),
          cobertura?.total ? h('p.cobertura',
            h('span.cobertura-barra', h('span', { style: { width: (cobertura.cubiertas / cobertura.total * 100) + '%' } })),
            `Mencionaste ${cobertura.cubiertas} de ${cobertura.total} palabras clave`) : null)),
      p.explicacion ? bloqueExplicacion(p.explicacion) : null,
      r.res ? null : h('div.autoevaluacion',
        h('p', '¿Cómo te fue?'),
        h('div.autoevaluacion-botones',
          botonAutoevaluacion('mal', 1, 'No la sabía'),
          botonAutoevaluacion('parcial', 2, 'Más o menos'),
          botonAutoevaluacion('bien', 3, 'La sabía'))));
  }

  function botonAutoevaluacion(res, tecla, texto) {
    return h(`button.btn.btn-eval.btn-eval-${res}`, { type: 'button', onclick: () => autoevaluar(res) },
      tocaPantalla() ? null : h('kbd', tecla), texto);
  }

  function acciones(it, r) {
    const ultimo = s.pos === s.items.length - 1;
    const tecla = t => (tocaPantalla() ? null : h('kbd', t));

    if (s.modo === 'examen') {
      return h('div.pregunta-acciones',
        h('button.btn.btn-sec', { type: 'button', disabled: s.pos === 0, onclick: anterior }, icono('izquierda'), 'Anterior'),
        h('span.espaciador'),
        ultimo
          ? h('button.btn.btn-pri.btn-lg', { type: 'button', onclick: terminarExamen }, 'Terminar examen', icono('check'))
          : h('button.btn.btn-pri.btn-lg', { type: 'button', onclick: siguiente }, 'Siguiente', icono('derecha')));
    }

    if (it.p.tipo === 'multiple') {
      if (!r.revelada) {
        return h('div.pregunta-acciones',
          h('button.btn.btn-ghost', { type: 'button', onclick: noSe, title: 'Muestra la respuesta y la cuenta como no sabida (N)' }, 'No sé'),
          h('span.espaciador'),
          h('button.btn.btn-pri.btn-lg', { type: 'button', onclick: comprobar }, 'Comprobar', tecla('Enter')));
      }
      return h('div.pregunta-acciones', h('span.espaciador'),
        h('button.btn.btn-pri.btn-lg', { type: 'button', onclick: siguiente }, ultimo ? 'Ver resultados' : 'Siguiente', tecla('Enter')));
    }

    if (!r.revelada) {
      return h('div.pregunta-acciones', h('span.espaciador'),
        h('button.btn.btn-pri.btn-lg', { type: 'button', onclick: revelar }, icono('ojo'), 'Revelar respuesta'));
    }
    return null;
  }

  function navegador() {
    return h('nav.navegador', { 'aria-label': 'Ir a la pregunta' },
      s.items.map((it, i) => h('button.navegador-punto', {
        type: 'button',
        class: [i === s.pos && 'actual', respondidaEnExamen(it) && 'respondida', Store.estaMarcada(it.key) && 'marcada'].filter(Boolean).join(' '),
        title: `Pregunta ${i + 1}${respondidaEnExamen(it) ? ' · respondida' : ''}`,
        onclick: () => { s.pos = i; guardar(); pintar(); },
      }, i + 1)));
  }

  function atajos(it, r) {
    const examen = s.modo === 'examen';
    const lista = [];
    if (it.p.tipo === 'multiple' && (examen || !r.revelada)) lista.push(['1–9', 'elegir opción']);
    if (examen) lista.push(['← →', 'moverse']);
    else if (it.p.tipo === 'multiple') lista.push(['Enter', r.revelada ? 'siguiente' : 'comprobar'], ...(r.revelada ? [] : [['N', 'no sé']]));
    else if (!r.revelada) lista.push(['Ctrl+Enter', 'revelar']);
    else if (!r.res) lista.push(['1 · 2 · 3', 'autoevaluarte']);
    lista.push(['F', 'marcar'], ['E', 'editar'], ['Esc', 'salir']);
    return h('p.atajos', lista.map(([k, t]) => h('span', h('kbd', k), ' ', t)));
  }

  /* ---------------- Acciones ---------------- */

  function registrar(it, res) {
    if (it.repeticion) return;
    Store.registrarRespuesta(it.key, res);
    if (res === 'mal' && s.modo === 'repaso') {
      s.items.push(nuevoItem(it, s.cfg.mezclarOpciones, { repeticion: true }));
    }
  }

  function alternarOpcion(idx) {
    const r = respuestaDe(actual());
    if (r.revelada && s.modo !== 'examen') return;
    const i = r.sel.indexOf(idx);
    if (i >= 0) r.sel.splice(i, 1); else r.sel.push(idx);
    guardar();
    pintar();
  }

  function comprobar() {
    const it = actual();
    const r = respuestaDe(it);
    if (r.revelada) return;
    r.res = evaluarMultiple(it.p, r.sel);
    r.revelada = true;
    registrar(it, r.res);
    guardar();
    pintar();
  }

  function noSe() {
    const it = actual();
    const r = respuestaDe(it);
    if (r.revelada) return;
    r.noSe = true;
    r.sel = [];
    r.res = 'mal';
    r.revelada = true;
    registrar(it, 'mal');
    guardar();
    pintar();
  }

  function revelar() {
    const r = respuestaDe(actual());
    r.revelada = true;
    guardar();
    pintar();
  }

  function autoevaluar(res) {
    const it = actual();
    const r = respuestaDe(it);
    if (!r.revelada || r.res) return;
    r.res = res;
    registrar(it, res);
    guardar();
    siguiente();
  }

  function accionPrincipal() {
    const it = actual();
    const r = respuestaDe(it);
    if (s.modo === 'examen') return siguiente();
    if (it.p.tipo === 'multiple') return r.revelada ? siguiente() : comprobar();
    if (!r.revelada) return revelar();
    if (r.res) return siguiente();
    toast('Elegí cómo te fue: 1, 2 o 3', { duracion: 2000 });
  }

  function siguiente() {
    if (s.modo !== 'examen' && !respuestaDe(actual()).res) return;
    if (s.pos < s.items.length - 1) {
      s.pos++;
      guardar();
      pintar();
    } else if (s.modo === 'examen') {
      terminarExamen();
    } else {
      terminar();
    }
  }

  function anterior() {
    if (s.modo !== 'examen' || s.pos === 0) return;
    s.pos--;
    guardar();
    pintar();
  }

  async function terminarExamen() {
    const sinResponder = s.items.filter(it => !respondidaEnExamen(it)).length;
    if (sinResponder) {
      const ok = await confirmar(`Te quedan ${plural(sinResponder, 'pregunta')} sin responder; se van a contar como incorrectas.`, {
        titulo: '¿Terminar el examen?', ok: 'Terminar igual', cancelar: 'Seguir respondiendo',
      });
      if (!ok || !s) return;
    }
    terminar();
  }

  function terminar() {
    if (!s || s.terminada) return;
    if (s.modo === 'examen') {
      for (const it of s.items) {
        const r = respuestaDe(it);
        r.revelada = true;
        if (!respondidaEnExamen(it)) {
          r.res = 'mal';
          r.sinResponder = true;
        } else if (it.p.tipo === 'multiple') {
          r.res = evaluarMultiple(it.p, r.sel);
        } else {
          r.res = null; // se autoevalúa en la pantalla de resultados
          continue;
        }
        Store.registrarRespuesta(it.key, r.res);
      }
    } else {
      // Lo que quedó a medias no cuenta.
      for (const it of s.items) if (it.r && !it.r.res) it.r = null;
    }
    s.terminada = true;
    s.fin = Date.now();
    guardar();
    location.hash = '#/resultados';
  }

  function marcar() {
    const it = actual();
    const ahora = Store.alternarMarcada(it.key);
    const b = $('.btn-bandera', raizVista);
    if (b) {
      b.classList.toggle('activa', ahora);
      b.setAttribute('aria-pressed', String(ahora));
      b.title = ahora ? 'Quitar marca (F)' : 'Marcar para repasar después (F)';
    }
    toast(ahora ? 'Marcada para repasar después' : 'Se quitó la marca', { duracion: 1800 });
  }

  function enlaceEditar(it) {
    return `#/editar/${it.cid}?q=${it.key}`;
  }

  function editar() {
    guardar();
    location.hash = enlaceEditar(actual());
  }

  async function salir() {
    const v = await dialogo({
      titulo: 'Salir de la sesión',
      contenido: h('p', 'Tu avance queda guardado: podés seguir más tarde desde la biblioteca.'),
      acciones: [
        { label: 'Cancelar', valor: null },
        { label: 'Terminar y ver resultados', valor: 'terminar' },
        { label: 'Pausar y salir', valor: 'pausar', clase: 'btn-pri', icono: 'pausa' },
      ],
    });
    if (!s) return;
    if (v === 'pausar') location.hash = '#/';
    else if (v === 'terminar') terminar();
  }

  function actualizarReloj() {
    if (!s || s.terminada) return;
    const el = document.getElementById('reloj-texto');
    const t = transcurrido();
    if (s.limiteMs) {
      const resta = s.limiteMs - t;
      if (el) {
        el.textContent = formatoReloj(resta);
        el.parentElement.classList.toggle('urgente', resta < 60000);
      }
      if (resta <= 0) {
        toast('¡Se terminó el tiempo!', { tipo: 'aviso' });
        terminar();
      }
    } else if (el) {
      el.textContent = formatoReloj(t);
    }
  }

  function alPresionar(e) {
    if (!s || s.terminada || hayDialogoAbierto()) return;
    const it = actual();
    const r = respuestaDe(it);
    const examen = s.modo === 'examen';

    if (e.key === 'Escape') {
      if (esCampoDeTexto(e.target)) e.target.blur(); else salir();
      return;
    }
    if (esCampoDeTexto(e.target)) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); accionPrincipal(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Si hay un botón con foco, Enter y Espacio lo activan a él.
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a, summary')) return;

    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k)) {
      const n = Number(k);
      if (it.p.tipo === 'multiple' && (examen || !r.revelada)) {
        const idx = it.orden[n - 1];
        if (idx != null) alternarOpcion(idx);
      } else if (it.p.tipo === 'desarrollar' && !examen && r.revelada && !r.res && n <= 3) {
        autoevaluar(['mal', 'parcial', 'bien'][n - 1]);
      }
      e.preventDefault();
      return;
    }
    if (k === 'enter' || k === ' ') { e.preventDefault(); accionPrincipal(); }
    else if (k === 'f') marcar();
    else if (k === 'e') editar();
    else if (k === 'n' && !examen && it.p.tipo === 'multiple' && !r.revelada) noSe();
    else if (k === 'arrowright' && examen) siguiente();
    else if (k === 'arrowleft' && examen) anterior();
  }

  return {
    MODOS, construirPool, iniciar, iniciarConItems, tituloPara,
    evaluarMultiple, analizarCobertura, render,
  };
})();
