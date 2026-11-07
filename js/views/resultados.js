'use strict';

/* ==========================================================================
   Resultados de la sesión: puntaje, autoevaluación pendiente (simulacro)
   y revisión pregunta por pregunta.
   ========================================================================== */

const Resultados = (() => {
  let s = null;
  let raizVista = null;
  let filtro = 'todas';

  const originales = () => s.items.filter(it => !it.repeticion && it.r);

  function calcular() {
    const c = { bien: 0, parcial: 0, mal: 0, pendientes: 0 };
    for (const it of originales()) {
      if (it.r.res) c[it.r.res]++;
      else c.pendientes++;
    }
    c.corregidas = c.bien + c.parcial + c.mal;
    c.puntaje = c.corregidas ? Math.round((c.bien + c.parcial * 0.5) / c.corregidas * 100) : 0;
    return c;
  }

  function resumen() {
    const c = calcular();
    return {
      id: s.id, fecha: s.fin || Date.now(), titulo: s.titulo, modo: s.modo,
      total: c.corregidas, bien: c.bien, parcial: c.parcial, mal: c.mal, puntaje: c.puntaje,
      duracionMs: s.tiempoMs || 0,
    };
  }

  function render(contenedor) {
    s = Store.getSesion();
    if (!s || !s.terminada) { location.replace('#/'); return; }
    raizVista = contenedor;
    filtro = 'todas';
    if (originales().length && !s.registrada) {
      Store.registrarSesion(resumen());
      s.registrada = true;
      Store.setSesion(s);
    }
    pintar();
  }

  function pintar() {
    const c = calcular();
    if (!originales().length) {
      raizVista.replaceChildren(vacio({
        icono: 'info',
        titulo: 'No respondiste ninguna pregunta',
        texto: 'La sesión terminó antes de responder. ¡Probá de nuevo cuando quieras!',
        acciones: [h('a.btn.btn-pri', { href: '#/estudiar' }, 'Nueva sesión'), h('a.btn.btn-sec', { href: '#/' }, 'Ir a la biblioteca')],
      }));
      return;
    }

    const falladas = originales().filter(it => it.r.res && it.r.res !== 'bien');
    const promedio = (s.tiempoMs || 0) / Math.max(1, originales().length);

    raizVista.replaceChildren(h('div.resultados',
      h('section.res-hero',
        anillo(c.puntaje, c.pendientes > 0),
        h('div.res-hero-texto',
          h('p.supra', Sesion.MODOS[s.modo]?.nombre || 'Sesión'),
          h('h1', c.pendientes ? 'Falta autoevaluarte' : mensaje(c.puntaje)),
          h('p.res-sub', s.titulo),
          h('div.res-stats',
            stat('Correctas', c.bien, 'bien'),
            c.parcial ? stat('Parciales', c.parcial, 'parcial') : null,
            stat('Incorrectas', c.mal, 'mal'),
            stat('Tiempo', duracionLegible(s.tiempoMs || 0)),
            stat('Por pregunta', duracionLegible(promedio))))),

      c.pendientes ? seccionPendientes() : null,

      h('div.fila-botones.res-acciones',
        falladas.length ? h('button.btn.btn-pri', { type: 'button', onclick: () => repasar(falladas) }, icono('repetir'), `Repasar las ${plural(falladas.length, 'fallada')}`) : null,
        h('button.btn.btn-sec', { type: 'button', onclick: repetir }, icono('mezclar'), 'Repetir sesión'),
        h('a.btn.btn-ghost', { href: '#/' }, 'Volver a la biblioteca')),

      seccionRevision()));
  }

  function mensaje(pct) {
    if (pct >= 90) return '¡Excelente!';
    if (pct >= 70) return '¡Muy bien!';
    if (pct >= 50) return 'Vas bien';
    return 'A seguir practicando';
  }

  function stat(etiqueta, valor, tipo) {
    return h('div.res-stat', { class: tipo ? 'res-stat-' + tipo : null }, h('strong', valor), h('span', etiqueta));
  }

  function anillo(pct, incompleto) {
    const r = 52, circ = 2 * Math.PI * r;
    const color = pct >= 70 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)';
    const svg = `
      <svg viewBox="0 0 120 120" width="148" height="148" aria-hidden="true">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
        <circle class="anillo-valor" cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
          style="--final:${circ * (1 - pct / 100)}" transform="rotate(-90 60 60)"/>
      </svg>`;
    const el = h('div.anillo', { role: 'img', 'aria-label': `Puntaje ${pct}%` });
    el.innerHTML = svg;
    el.append(h('div.anillo-centro', h('strong', `${pct}%`), h('span', incompleto ? 'parcial' : 'puntaje')));
    return el;
  }

  /* --- Autoevaluación de desarrollo (sólo en simulacro) --- */

  function seccionPendientes() {
    const pendientes = originales().filter(it => !it.r.res);
    return h('section.res-pendientes',
      h('h2', icono('lapiz'), `Autoevaluá tus respuestas de desarrollo (${pendientes.length})`),
      h('p.texto-suave', 'Compará lo que escribiste con la respuesta esperada y decidí cómo te fue.'),
      pendientes.map(it => {
        const cob = it.p.respuesta ? Sesion.analizarCobertura(it.p.respuesta, it.r.texto) : null;
        return h('article.tarjeta.pendiente',
          h('h3.pregunta-texto-chico', it.p.texto),
          h('div.comparacion.dos-columnas',
            h('section.comparacion-col', h('h3', 'Tu respuesta'), h('div.texto-largo', it.r.texto)),
            h('section.comparacion-col.comparacion-esperada', h('h3', 'Respuesta esperada'),
              h('div.texto-largo', cob ? cob.nodos : (it.p.respuesta || 'No hay respuesta esperada cargada.')),
              cob?.total ? h('p.cobertura', `Mencionaste ${cob.cubiertas} de ${cob.total} palabras clave`) : null)),
          h('div.autoevaluacion-botones',
            ['mal', 'parcial', 'bien'].map((res, i) => h(`button.btn.btn-eval.btn-eval-${res}`, {
              type: 'button',
              onclick: () => calificar(it, res),
            }, ['No la sabía', 'Más o menos', 'La sabía'][i]))));
      }));
  }

  function calificar(it, res) {
    it.r.res = res;
    Store.registrarRespuesta(it.key, res);
    Store.setSesion(s);
    Store.registrarSesion(resumen());
    pintar();
  }

  /* --- Revisión --- */

  function seccionRevision() {
    const items = originales().filter(it => it.r.res);
    const cuenta = res => items.filter(it => it.r.res === res).length;
    const filtros = [
      ['todas', 'Todas', items.length],
      ['mal', 'Incorrectas', cuenta('mal')],
      ['parcial', 'Parciales', cuenta('parcial')],
      ['bien', 'Correctas', cuenta('bien')],
    ].filter(([id, , n]) => id === 'todas' || n);

    const visibles = filtro === 'todas' ? items : items.filter(it => it.r.res === filtro);
    const lista = h('div.revision-lista', visibles.map(itemRevision));

    return h('section.res-revision',
      h('div.seccion-cab',
        h('h2', 'Revisión'),
        h('div.chips', filtros.map(([id, label, n]) => h('button.chip', {
          type: 'button', class: filtro === id ? 'activo' : null,
          onclick: () => { filtro = id; pintar(); },
        }, label, h('span.chip-n', n))))),
      visibles.length ? lista : h('p.texto-suave', 'No hay preguntas en esta categoría.'));
  }

  function itemRevision(it) {
    const p = it.p;
    const iconos = { bien: 'check', parcial: 'alerta', mal: 'x' };
    const n = s.items.indexOf(it) + 1;

    let detalle;
    if (p.tipo === 'multiple') {
      const elegidas = new Set(it.r.sel || []);
      detalle = h('ul.revision-opciones', it.orden.map(idx => {
        const o = p.opciones[idx];
        const el = elegidas.has(idx);
        return h('li', { class: [o.esCorrecta && 'correcta', el && 'elegida', el && !o.esCorrecta && 'error'].filter(Boolean).join(' ') },
          h('span.revision-marca', o.esCorrecta ? icono('check') : el ? icono('x') : ''),
          h('span', o.texto),
          el ? h('span.revision-tuya', 'tu elección') : null);
      }));
    } else {
      detalle = h('div.comparacion', { class: it.r.texto?.trim() ? 'dos-columnas' : null },
        it.r.texto?.trim() ? h('section.comparacion-col', h('h3', 'Tu respuesta'), h('div.texto-largo', it.r.texto)) : null,
        h('section.comparacion-col.comparacion-esperada', h('h3', 'Respuesta esperada'), h('div.texto-largo', p.respuesta || '—')));
    }

    return h('details.revision-item', { class: 'res-' + it.r.res },
      h('summary',
        h('span.revision-estado', icono(iconos[it.r.res])),
        h('span.revision-num', n),
        h('span.revision-texto', p.texto),
        it.r.sinResponder ? h('span.etiqueta', 'sin responder') : null,
        icono('abajo', 'revision-flecha')),
      h('div.revision-detalle',
        detalle,
        p.explicacion ? h('div.explicacion', icono('bombilla'), h('div', h('strong', 'Explicación'), h('p', p.explicacion))) : null,
        h('div.revision-pie',
          h('span.texto-suave', it.cnombre),
          h('a.btn.btn-ghost.btn-sm', { href: `#/editar/${it.cid}?q=${it.key}` }, icono('lapiz'), 'Editar'))));
  }

  /* --- Nuevas sesiones --- */

  function repasar(items) {
    Sesion.iniciarConItems(mezclar(items.map(it => ({ key: it.key, cid: it.cid, cnombre: it.cnombre, p: it.p }))), {
      modo: 'practica',
      titulo: `Falladas · ${s.titulo}`,
      mezclarOpciones: s.cfg?.mezclarOpciones ?? true,
      mostrarCantidad: s.cfg?.mostrarCantidad ?? false,
    });
  }

  function repetir() {
    const items = s.items.filter(it => !it.repeticion);
    Sesion.iniciarConItems(mezclar(items.map(it => ({ key: it.key, cid: it.cid, cnombre: it.cnombre, p: it.p }))), {
      modo: s.modo,
      titulo: s.titulo,
      mezclarOpciones: s.cfg?.mezclarOpciones ?? true,
      mostrarCantidad: s.cfg?.mostrarCantidad ?? false,
      minutos: s.cfg?.minutos || 0,
    });
  }

  return { render };
})();
