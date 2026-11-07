'use strict';

/* ==========================================================================
   Datos: backups, importación (archivo, texto o JSON) y generación con IA.
   ========================================================================== */

const Datos = (() => {
  const PROMPT_IA = `Convertí el material de estudio que te paso al final en preguntas para mi app de cuestionarios.

Devolvé SOLO un JSON válido (sin texto antes ni después, sin bloques de código) con este formato:

[
  {
    "nombre": "Nombre del cuestionario",
    "materia": "Nombre de la materia",
    "preguntas": [
      {
        "tipo": "multiple",
        "texto": "¿Pregunta de opción múltiple?",
        "opciones": [
          { "texto": "Opción correcta", "esCorrecta": true },
          { "texto": "Opción incorrecta pero creíble", "esCorrecta": false },
          { "texto": "Otra opción incorrecta", "esCorrecta": false },
          { "texto": "Otra opción incorrecta", "esCorrecta": false }
        ],
        "explicacion": "Por qué la correcta es correcta (breve)."
      },
      {
        "tipo": "desarrollar",
        "texto": "Pregunta para responder con tus palabras",
        "respuesta": "Respuesta esperada, concisa y con los conceptos clave.",
        "explicacion": "Opcional."
      }
    ]
  }
]

Reglas:
- Cubrí todos los temas importantes del material, sin inventar información que no esté.
- Múltiple choice: entre 3 y 5 opciones. Puede haber más de una correcta, pero SIEMPRE al menos una con "esCorrecta": true.
- Las opciones incorrectas tienen que ser plausibles (errores típicos), no absurdas.
- Evitá "todas las anteriores" y "ninguna de las anteriores".
- Mezclá la posición de la opción correcta.
- Incluí también preguntas de desarrollo para los conceptos que convenga explicar.

Material:
[PEGÁ ACÁ TUS APUNTES]`;

  function render(contenedor) {
    const prefs = Store.prefs();
    const cs = Store.cuestionarios();
    const totalPreguntas = cs.reduce((n, c) => n + c.preguntas.length, 0);
    const uso = Store.usoAlmacenamiento();
    const limite = 5 * 1024 * 1024;

    const inputArchivo = h('input', {
      type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true,
      onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarArchivo(f); },
    });

    const zona = h('label.zona-archivo', { tabindex: 0, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputArchivo.click(); } } },
      inputArchivo,
      h('span.zona-icono', icono('subir')),
      h('strong', 'Elegí un archivo o arrastralo acá'),
      h('span.texto-suave', 'Backups .json de esta app (también los de la versión anterior) o un .txt con preguntas'));
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('arrastrando'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('arrastrando'));
    zona.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      zona.classList.remove('arrastrando');
      const f = e.dataTransfer.files[0];
      if (f) importarArchivo(f);
    });

    contenedor.replaceChildren(h('div.datos',
      h('header.pagina-cab', h('div', h('p.supra', 'Datos'), h('h1', 'Backup e importación'),
        h('p.texto-suave', `${plural(cs.length, 'cuestionario')} · ${plural(totalPreguntas, 'pregunta')}`))),

      h('section.panel',
        h('h2', icono('bajar'), 'Hacer un backup'),
        h('p', 'Tus cuestionarios se guardan ', h('strong', 'sólo en este navegador'), '. Si borrás los datos de navegación o cambiás de compu, se pierden: descargá un backup cada tanto.'),
        h('p', { class: prefs.ultimoBackup ? 'texto-suave' : 'texto-aviso' }, icono(prefs.ultimoBackup ? 'check' : 'alerta'),
          prefs.ultimoBackup ? ` Último backup: ${haceCuanto(prefs.ultimoBackup)}.` : ' Todavía no hiciste ningún backup desde esta versión.'),
        h('div.fila-botones',
          h('button.btn.btn-pri', { type: 'button', disabled: !cs.length, onclick: () => exportar(true) }, icono('bajar'), 'Backup completo (con progreso)'),
          h('button.btn.btn-sec', { type: 'button', disabled: !cs.length, onclick: () => exportar(false) }, 'Sólo cuestionarios'))),

      h('section.panel',
        h('h2', icono('subir'), 'Importar'),
        zona,
        h('div.fila-botones',
          h('button.btn.btn-sec', { type: 'button', onclick: pegar }, icono('texto'), 'Pegar texto o JSON'))),

      h('section.panel.panel-ia',
        h('h2', icono('robot'), 'Generar preguntas con IA'),
        h('ol.lista-pasos',
          h('li', 'Copiá las instrucciones con el botón de abajo.'),
          h('li', 'Pegalas en ChatGPT, Claude o la IA que uses y agregá al final tus apuntes (o adjuntá el PDF).'),
          h('li', 'Copiá el JSON que te devuelve y usá ', h('strong', 'Pegar texto o JSON'), ' acá arriba.')),
        h('p.texto-suave', 'Revisá siempre lo que genera: después podés corregir cualquier pregunta desde el editor.'),
        h('div.fila-botones',
          h('button.btn.btn-sec', {
            type: 'button',
            onclick: async () => toast(await copiarAlPortapapeles(PROMPT_IA) ? 'Instrucciones copiadas' : 'No se pudo copiar', { tipo: 'ok' }),
          }, icono('copiar'), 'Copiar instrucciones'),
          h('button.btn.btn-ghost', {
            type: 'button',
            onclick: () => dialogo({ titulo: 'Instrucciones para la IA', ancho: 'grande', contenido: h('pre.ejemplo', PROMPT_IA) }),
          }, icono('ojo'), 'Ver'))),

      h('section.panel.panel-peligro',
        h('h2', icono('datos'), 'Almacenamiento'),
        h('div.uso',
          h('div.progreso', h('span', { style: { width: Math.min(100, uso / limite * 100) + '%' } })),
          h('span.texto-suave', `${(uso / 1024 / 1024).toFixed(2)} MB usados de unos 5 MB disponibles`)),
        h('div.fila-botones',
          h('button.btn.btn-peligro-suave', { type: 'button', onclick: reiniciarProgreso }, icono('repetir'), 'Reiniciar progreso'),
          h('button.btn.btn-peligro-suave', { type: 'button', onclick: borrarTodo }, icono('basura'), 'Borrar todo')))));
  }

  function exportar(completo) {
    const contenido = completo ? Store.exportarCompleto() : Store.exportarCuestionarios(Store.cuestionarios());
    descargarArchivo(`Backup Cuestionarios${completo ? '' : ' (sólo cuestionarios)'} ${selloArchivo()}.json`, contenido);
    Store.setPrefs({ ultimoBackup: Date.now() });
    toast('Backup descargado', { tipo: 'ok' });
    if (location.hash.startsWith('#/datos')) App.refrescar();
  }

  /* ---------------- Importación ---------------- */

  async function importarArchivo(archivo) {
    try {
      const texto = await leerArchivo(archivo);
      await previsualizar(Store.interpretar(texto), archivo.name);
    } catch (e) {
      toast(e.message || 'No se pudo importar el archivo.', { tipo: 'error', duracion: 6000 });
    }
  }

  async function pegar() {
    const ta = h('textarea.input.mono', { rows: 14, spellcheck: false, placeholder: 'Pegá acá el JSON (de un backup o de una IA) o preguntas en formato de texto…' });
    const texto = await dialogo({
      titulo: 'Pegar texto o JSON',
      ancho: 'grande',
      contenido: h('div', ta),
      acciones: [
        { label: 'Cancelar', valor: null },
        { label: 'Continuar', clase: 'btn-pri', valor: () => ta.value.trim() || (toast('No pegaste nada.', { tipo: 'aviso' }), false) },
      ],
      alAbrir: () => ta.focus(),
    });
    if (!texto) return;
    try {
      await previsualizar(Store.interpretar(texto), '');
    } catch (e) {
      toast(e.message, { tipo: 'error', duracion: 6000 });
    }
  }

  /** "cuestionarios-mdw.json" → "MDW" (sólo si parece una sigla). */
  function materiaDesdeArchivo(nombre) {
    const m = String(nombre).replace(/\.[^.]+$/, '').match(/[-_ ]([a-zA-Z]{2,5})$/);
    return m ? m[1].toUpperCase() : '';
  }

  async function previsualizar(datos, nombreArchivo) {
    if (datos.cuestionarios.length) return previsualizarCuestionarios(datos, nombreArchivo);
    return previsualizarPreguntas(datos.preguntas, nombreArchivo);
  }

  async function previsualizarCuestionarios(datos, nombreArchivo) {
    const elegidos = new Set(datos.cuestionarios.map((_, i) => i));
    let reemplazar = false;
    let conProgreso = !!datos.progreso;
    const sinMateria = datos.cuestionarios.every(c => !c.materia);
    const inputMateria = h('input.input', {
      list: 'imp-materias', placeholder: sinMateria ? 'Ej: Redes' : 'Dejalo vacío para mantener la que traen',
      value: sinMateria ? materiaDesdeArchivo(nombreArchivo) : '',
    });

    const filas = datos.cuestionarios.map((c, i) => {
      const existe = Store.cuestionario(c.idCuestionario);
      return h('label.selector-item.activo',
        h('input', {
          type: 'checkbox', checked: true,
          onchange: e => { e.target.checked ? elegidos.add(i) : elegidos.delete(i); e.target.parentElement.classList.toggle('activo', e.target.checked); },
        }),
        h('span.selector-check', icono('check')),
        h('span.selector-info',
          h('strong', c.nombre),
          h('small', plural(c.preguntas.length, 'pregunta'), c.materia ? ` · ${c.materia}` : '',
            existe ? h('span.texto-aviso', ' · ya existe: se va a actualizar') : null)));
    });

    const ok = await dialogo({
      titulo: `Importar ${plural(datos.cuestionarios.length, 'cuestionario')}`,
      ancho: 'grande',
      contenido: h('div.importar',
        h('div.selector-lista.importar-lista', filas),
        h('div.campo',
          h('label.campo-etiqueta', 'Materia ', h('small', '(opcional, se asigna a todos los importados)')),
          inputMateria,
          h('datalist', { id: 'imp-materias' }, Store.materias().map(m => h('option', { value: m })))),
        datos.progreso ? interruptor('Importar también el progreso de estudio', true, v => { conProgreso = v; }) : null,
        Store.cuestionarios().length ? interruptor('Reemplazar toda mi biblioteca', false, v => { reemplazar = v; },
          'Si lo activás se borran los cuestionarios que tenés ahora') : null),
      acciones: [
        { label: 'Cancelar', valor: false },
        { label: 'Importar', clase: 'btn-pri', icono: 'subir', valor: () => (elegidos.size ? true : (toast('Elegí al menos un cuestionario.', { tipo: 'aviso' }), false)) },
      ],
    });
    if (!ok) return;

    if (reemplazar && !await confirmar(`Se van a borrar tus ${plural(Store.cuestionarios().length, 'cuestionario')} actuales y quedan sólo los importados.`, { titulo: '¿Reemplazar la biblioteca?', ok: 'Reemplazar', peligro: true })) return;

    const materia = inputMateria.value.trim();
    const lista = datos.cuestionarios.filter((_, i) => elegidos.has(i)).map(c => (materia ? { ...c, materia } : c));
    const r = Store.importarCuestionarios(lista, { reemplazarTodo: reemplazar });
    if (conProgreso && datos.progreso) Store.importarProgreso(datos.progreso);

    const partes = [];
    if (r.creados) partes.push(`${r.creados} ${r.creados === 1 ? 'nuevo' : 'nuevos'}`);
    if (r.actualizados) partes.push(`${r.actualizados} ${r.actualizados === 1 ? 'actualizado' : 'actualizados'}`);
    toast(`Importación lista: ${partes.join(', ') || 'sin cambios'}`, { tipo: 'ok' });
    App.ir('#/');
  }

  async function previsualizarPreguntas(preguntas, nombreArchivo) {
    const cs = Store.cuestionarios();
    let destino = 'nuevo';
    const nombreBase = String(nombreArchivo || '').replace(/\.[^.]+$/, '').trim();
    const inputNombre = h('input.input', { value: nombreBase || 'Preguntas importadas', placeholder: 'Nombre del cuestionario' });
    const inputMateria = h('input.input', { list: 'imp-materias', placeholder: 'Opcional', value: materiaDesdeArchivo(nombreArchivo) });
    const selectExistente = h('select.input', { disabled: true }, cs.map(c => h('option', { value: c.idCuestionario }, c.nombre)));
    const m = preguntas.filter(p => p.tipo === 'multiple').length;

    const radio = (valor, texto, extra) => h('label.radio-opcion',
      h('input', {
        type: 'radio', name: 'destino', value: valor, checked: destino === valor,
        onchange: () => {
          destino = valor;
          inputNombre.disabled = inputMateria.disabled = valor !== 'nuevo';
          selectExistente.disabled = valor !== 'existente';
        },
      }),
      h('span', texto), extra);

    const ok = await dialogo({
      titulo: `Importar ${plural(preguntas.length, 'pregunta')}`,
      contenido: h('div.importar',
        h('p.texto-suave', `${m} múltiple choice · ${preguntas.length - m} de desarrollo`),
        radio('nuevo', 'Crear un cuestionario nuevo',
          h('div.radio-extra', inputNombre, inputMateria, h('datalist', { id: 'imp-materias' }, Store.materias().map(x => h('option', { value: x }))))),
        cs.length ? radio('existente', 'Agregarlas a un cuestionario existente', h('div.radio-extra', selectExistente)) : null),
      acciones: [
        { label: 'Cancelar', valor: false },
        { label: 'Importar', clase: 'btn-pri', icono: 'subir', valor: () => (destino === 'nuevo' && !inputNombre.value.trim() ? (toast('Poné un nombre.', { tipo: 'aviso' }), false) : true) },
      ],
    });
    if (!ok) return;

    let id;
    if (destino === 'nuevo') {
      id = Store.guardarCuestionario({
        idCuestionario: Store.nuevoId(),
        nombre: inputNombre.value.trim(),
        materia: inputMateria.value.trim(),
        fechaCreacion: new Date().toISOString(),
        preguntas,
      }).idCuestionario;
      toast(`Se creó el cuestionario con ${plural(preguntas.length, 'pregunta')}`, { tipo: 'ok' });
    } else {
      const c = clonar(Store.cuestionario(selectExistente.value));
      const existentes = new Set(c.preguntas.map(Store.clave));
      const nuevas = preguntas.filter(p => !existentes.has(Store.clave(p)));
      c.preguntas.push(...nuevas);
      id = Store.guardarCuestionario(c).idCuestionario;
      const salteadas = preguntas.length - nuevas.length;
      toast(`Se agregaron ${plural(nuevas.length, 'pregunta')}` + (salteadas ? ` (${salteadas} repetidas salteadas)` : ''), { tipo: 'ok' });
    }
    App.ir(`#/ver/${id}`);
  }

  /* ---------------- Zona de peligro ---------------- */

  async function reiniciarProgreso() {
    if (!await confirmar('Se borra todo lo que la app sabe de lo que estudiaste (aciertos, repasos, racha). Los cuestionarios no se tocan.', { titulo: '¿Reiniciar el progreso?', ok: 'Reiniciar', peligro: true })) return;
    Store.reiniciarProgreso();
    toast('Progreso reiniciado', { tipo: 'ok' });
    App.refrescar();
  }

  async function borrarTodo() {
    if (!await confirmar('Se borran todos los cuestionarios y el progreso de este navegador. Esto no se puede deshacer: hacé un backup antes.', { titulo: '¿Borrar todo?', ok: 'Borrar todo', peligro: true })) return;
    Store.borrarTodo();
    toast('Se borró todo', { tipo: 'ok' });
    App.ir('#/');
  }

  return { render, importarArchivo, PROMPT_IA };
})();
