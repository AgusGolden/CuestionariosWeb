'use strict';

/* ==========================================================================
   Ver cuestionario: leer las preguntas con las respuestas tapadas.
   Cada respuesta se destapa con un clic (o todas juntas con el interruptor).
   ========================================================================== */

const Ver = (() => {
  let c = null;
  let raizVista = null;
  let lista = null;
  let busqueda = '';
  let tipo = 'todos';
  let nivel = 'todos';
  let mostrarTodas = false;
  let destapadas = new Set();

  function render(contenedor, [id]) {
    c = Store.cuestionario(id);
    if (!c) return noEncontrado(contenedor);
    raizVista = contenedor;
    busqueda = '';
    tipo = 'todos';
    nivel = 'todos';
    mostrarTodas = false;
    destapadas = new Set();
    pintar();
  }

  function pintar() {
    const st = Store.estadisticas(c.preguntas);
    lista = h('div.ver-lista');

    raizVista.replaceChildren(h('div.ver',
      h('a.volver', { href: '#/' }, icono('izquierda'), 'Biblioteca'),
      h('header.pagina-cab',
        h('div',
          c.materia ? h('p.supra', c.materia) : null,
          h('h1', c.nombre),
          h('p.texto-suave', `${plural(st.total, 'pregunta')} · ${st.dominadas} dominadas · ${st.aprendiendo} aprendiendo · ${st.nuevas} sin ver`)),
        h('div.fila-botones',
          h('a.btn.btn-sec', { href: `#/editar/${c.idCuestionario}` }, icono('lapiz'), 'Editar'),
          h('a.btn.btn-pri', { href: `#/estudiar?c=${c.idCuestionario}`, class: st.total ? null : 'deshabilitado' }, icono('play'), 'Estudiar'))),
      h('div.barra-filtros.ver-filtros',
        h('div.buscador', icono('buscar'), h('input.input', {
          type: 'search', placeholder: 'Buscar en las preguntas…', 'aria-label': 'Buscar en las preguntas',
          oninput: e => { busqueda = e.target.value; pintarLista(); },
        })),
        h('select.input', { 'aria-label': 'Tipo', onchange: e => { tipo = e.target.value; pintarLista(); } },
          h('option', { value: 'todos' }, 'Todos los tipos'),
          h('option', { value: 'multiple' }, 'Múltiple choice'),
          h('option', { value: 'desarrollar' }, 'Desarrollo')),
        h('select.input', { 'aria-label': 'Estado', onchange: e => { nivel = e.target.value; pintarLista(); } },
          h('option', { value: 'todos' }, 'Cualquier estado'),
          h('option', { value: 'nueva' }, 'Sin ver'),
          h('option', { value: 'aprendiendo' }, 'Aprendiendo'),
          h('option', { value: 'dominada' }, 'Dominadas'),
          h('option', { value: 'marcadas' }, 'Marcadas')),
        interruptor('Mostrar respuestas', mostrarTodas, v => { mostrarTodas = v; destapadas.clear(); pintarLista(); })),
      lista));
    pintarLista();
  }

  function pintarLista() {
    const q = normalizar(busqueda);
    const items = c.preguntas
      .map((p, i) => ({ p, i, k: Store.clave(p) }))
      .filter(({ p, k }) => {
        if (tipo !== 'todos' && p.tipo !== tipo) return false;
        if (nivel === 'marcadas' ? !Store.estaMarcada(k) : nivel !== 'todos' && Store.nivel(k) !== nivel) return false;
        if (!q) return true;
        return normalizar(p.texto + ' ' + p.opciones.map(o => o.texto).join(' ')).includes(q);
      });

    lista.replaceChildren(
      h('p.texto-suave.ver-cuenta', items.length === c.preguntas.length ? plural(items.length, 'pregunta') : `Mostrando ${items.length} de ${c.preguntas.length}`),
      ...items.map(tarjeta));
  }

  const NIVELES = { nueva: 'Sin ver', aprendiendo: 'Aprendiendo', dominada: 'Dominada' };

  function tarjeta({ p, i, k }) {
    const visible = mostrarTodas || destapadas.has(i);
    const nv = Store.nivel(k);
    const marcada = Store.estaMarcada(k);

    const alternar = () => {
      if (destapadas.has(i)) destapadas.delete(i); else destapadas.add(i);
      card.replaceWith(tarjeta({ p, i, k }));
    };

    let cuerpo;
    if (p.tipo === 'multiple') {
      cuerpo = h('ul.ver-opciones', p.opciones.map(o => h('li', {
        class: visible ? (o.esCorrecta ? 'correcta' : 'incorrecta') : null,
      }, h('span.ver-marca', visible && o.esCorrecta ? icono('check') : null), h('span', o.texto))));
    } else {
      cuerpo = visible
        ? h('div.texto-largo.ver-respuesta', p.respuesta || 'Sin respuesta esperada cargada.')
        : h('button.tapada', { type: 'button', onclick: alternar }, icono('ojo'), 'Tocá para ver la respuesta');
    }

    const card = h('article.ver-card', { class: visible ? 'destapada' : null },
      h('div.ver-card-cab',
        h('span.ver-num', `#${i + 1}`),
        etiquetaTipo(p.tipo),
        h(`span.punto-nivel.nivel-${nv}`, { title: NIVELES[nv] }),
        h('span.espaciador'),
        h('button.icono-btn.btn-bandera', {
          type: 'button', class: marcada ? 'activa' : null, title: marcada ? 'Quitar marca' : 'Marcar para repasar',
          onclick: () => { Store.alternarMarcada(k); card.replaceWith(tarjeta({ p, i, k })); },
        }, icono('bandera')),
        h('a.icono-btn', { href: `#/editar/${c.idCuestionario}?q=${k}`, title: 'Editar' }, icono('lapiz'))),
      h('p.ver-texto', p.texto),
      cuerpo,
      visible && p.explicacion ? h('div.explicacion', icono('bombilla'), h('div', h('strong', 'Explicación'), h('p', p.explicacion))) : null,
      p.tipo === 'multiple' && !mostrarTodas
        ? h('button.btn-link.ver-toggle', { type: 'button', onclick: alternar }, icono(visible ? 'ojoNo' : 'ojo'), visible ? 'Ocultar respuesta' : 'Ver respuesta')
        : (p.tipo === 'desarrollar' && visible && !mostrarTodas
          ? h('button.btn-link.ver-toggle', { type: 'button', onclick: alternar }, icono('ojoNo'), 'Ocultar respuesta')
          : null));
    return card;
  }

  return { render };
})();
