import { obtenerCuestionarios, guardarCuestionarios } from './storage.js';

document.addEventListener('DOMContentLoaded', inicializar);

let cuestionarios = [];
let cuestionario = null;

function inicializar() {
  cuestionarios = obtenerCuestionarios();
  llenarSelect();
  configurarEventos();
  ocultarDetalle();
}

function llenarSelect() {
  const sel = document.getElementById('cuestionarios-select');
  sel.innerHTML = '<option value="">-- Seleccionar --</option>';
  cuestionarios.forEach(q => {
    const opt = document.createElement('option');
    opt.value = q.idCuestionario;
    opt.textContent = q.nombre;
    sel.appendChild(opt);
  });
}

function configurarEventos() {
    const sel = document.getElementById('cuestionarios-select');
    sel.addEventListener('change', () => {
    const id = Number(sel.value);
    console.log('Select cambio, id seleccionado:', id);
    cuestionario = cuestionarios.find(q => q.idCuestionario === id);
    if (!cuestionario) {
        console.warn('No se encontró cuestionario con id:', id);
        ocultarDetalle();
    } else {
        console.log('Cuestionario encontrado:', cuestionario);
        cargarDetalle();
    }
    });

  document.getElementById('btn-eliminar-cuestionario').addEventListener('click', () => {
    if (!cuestionario) return;
    if (confirm(`Eliminar "${cuestionario.nombre}"?`)) {
      cuestionarios = cuestionarios.filter(q => q.idCuestionario !== cuestionario.idCuestionario);
      guardarCuestionarios(cuestionarios);
      cuestionario = null;
      llenarSelect();
      ocultarDetalle();
    }
  });

  document.getElementById('btn-agregar-pregunta').addEventListener('click', mostrarSelectorTipoPregunta);

  document.getElementById('btn-guardar-cuestionario').addEventListener('click', () => {
    guardarEdiciones();
    alert('Cuestionario actualizado');
  });
}

function ocultarDetalle() {
  const cont = document.getElementById('contenedor-pregunta');
  if (cont && !cont.classList.contains('oculto')) cont.classList.add('oculto');
}

function cargarDetalle() {
  const cont = document.getElementById('contenedor-pregunta');
  if (cont && cont.classList.contains('oculto')) cont.classList.remove('oculto');
  document.getElementById('nombre-cuestionario-editar').value = cuestionario.nombre || '';
  renderPreguntas();
}

function guardarEstadoTemporal() {
  if (!cuestionario) return;
  const cont = document.getElementById('lista-preguntas');
  const preguntasEditDivs = cont.querySelectorAll('.pregunta-edit');
  preguntasEditDivs.forEach(div => {
    const idx = Number(div.dataset.idx);
    const p = cuestionario.preguntas[idx];
    if (!p) {
      console.warn(`Pregunta con índice ${idx} no encontrada`);
      return;
    }

    // Guardar texto de la pregunta desde textarea
    const textareaPregunta = div.querySelector('textarea');
    p.texto = textareaPregunta.value.trim();

    if (p.tipo === 'multiple') {
      const rows = div.querySelectorAll('.opcion-edit');
      rows.forEach(r => {
        const checkbox = r.querySelector('input[type="checkbox"]');
        const j = Number(checkbox.dataset.idx);
        if (p.opciones[j]) {
          p.opciones[j].esCorrecta = checkbox.checked;
          const inputTexto = r.querySelector('input[type="text"]');
          p.opciones[j].texto = inputTexto.value.trim();
        } else {
          console.warn(`Índice de opción fuera de rango: ${j}`, p.opciones);
        }
      });
    } else {
      // Para preguntas de desarrollar, guarda la respuesta del segundo textarea
      const textareaResp = div.querySelectorAll('textarea')[1];
      if (textareaResp) p.respuesta = textareaResp.value.trim();
    }
  });
}


function renderPreguntas() {
  if (!cuestionario) return;
  guardarEstadoTemporal();

  const cont = document.getElementById('lista-preguntas');
  cont.innerHTML = '';

  cuestionario.preguntas.forEach((p, idx) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'pregunta-edit';
    fieldset.dataset.idx = idx;

    const legend = document.createElement('legend');
    legend.textContent = `Pregunta ${idx + 1}`;
    fieldset.appendChild(legend);

    const text = document.createElement('textarea');
    text.value = p.texto || '';
    fieldset.appendChild(text);

    if (p.tipo === 'multiple') {
      p.opciones.forEach((opt, j) => {
        const row = document.createElement('div');
        row.className = 'opcion-edit';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = opt.esCorrecta;
        chk.dataset.idx = j;  // <-- importante que sea el índice actualizado
        row.appendChild(chk);

        // Texto opción
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = opt.texto || '';
        row.appendChild(inp);

        // Botón eliminar opción
        const btnEliminarOpcion = document.createElement('button');
        btnEliminarOpcion.type = 'button';
        btnEliminarOpcion.textContent = 'X';
        btnEliminarOpcion.className = 'btn-rojo btn-eliminar-opcion';
        btnEliminarOpcion.style.marginLeft = '10px';
        btnEliminarOpcion.addEventListener('click', () => {
          guardarEstadoTemporal();
          p.opciones.splice(j, 1);
          renderPreguntas();
        });
        row.appendChild(btnEliminarOpcion);

        fieldset.appendChild(row);
      });

      const btnContainer = document.createElement('div');
      btnContainer.className = 'btn-container';

      const btnAdd = document.createElement('button');
      btnAdd.textContent = 'Agregar opción';
      btnAdd.type = 'button';
      btnAdd.addEventListener('click', () => {
        guardarEstadoTemporal();
        p.opciones.push({ texto: '', esCorrecta: false });
        renderPreguntas();
      });
      btnContainer.appendChild(btnAdd);

      const btnEliminar = document.createElement('button');
      btnEliminar.textContent = 'Eliminar pregunta';
      btnEliminar.type = 'button';
      btnEliminar.className = 'btn-rojo';
      btnEliminar.addEventListener('click', () => {
        cuestionario.preguntas.splice(idx, 1);
        renderPreguntas();
      });
      btnContainer.appendChild(btnEliminar);

      fieldset.appendChild(btnContainer);
    } else if (p.tipo === 'desarrollar') {
      const resp = document.createElement('textarea');
      resp.value = p.respuesta || '';
      resp.placeholder = 'Respuesta esperada...';
      fieldset.appendChild(resp);

      const btnEliminarContainer = document.createElement('div');
      btnEliminarContainer.className = 'btn-container';

      const btnEliminar = document.createElement('button');
      btnEliminar.textContent = 'Eliminar pregunta';
      btnEliminar.type = 'button';
      btnEliminar.className = 'btn-rojo';
      btnEliminar.addEventListener('click', () => {
        cuestionario.preguntas.splice(idx, 1);
        renderPreguntas();
      });

      btnEliminarContainer.appendChild(btnEliminar);
      fieldset.appendChild(btnEliminarContainer);
    }

    cont.appendChild(fieldset);
  });
}

function mostrarSelectorTipoPregunta() {
  const contenedor = document.createElement('div');
  contenedor.className = 'modal-tipo-pregunta';

  const label = document.createElement('label');
  label.textContent = 'Tipo de pregunta: ';
  contenedor.appendChild(label);

  const select = document.createElement('select');
  select.innerHTML = `
    <option value="">Seleccionar...</option>
    <option value="multiple">Multiple</option>
    <option value="desarrollar">Desarrollar</option>
  `;
  contenedor.appendChild(select);

  const btnContainer = document.createElement('div');
  btnContainer.className = 'btn-container';

  const btnAceptar = document.createElement('button');
  btnAceptar.textContent = 'Agregar';
  btnAceptar.disabled = true;
  btnAceptar.type = 'button';

  btnAceptar.addEventListener('click', () => {
    const tipo = select.value;
    if (!tipo) return;
    agregarPregunta(tipo);
    document.body.removeChild(contenedor);
  });

  select.addEventListener('change', () => {
    btnAceptar.disabled = !select.value;
  });

  btnContainer.appendChild(btnAceptar);
  contenedor.appendChild(btnContainer);

  Object.assign(contenedor.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '1rem',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    zIndex: 1000,
    borderRadius: '6px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    minWidth: '280px',
  });

  document.body.appendChild(contenedor);
}

function agregarPregunta(tipo) {
  if (!cuestionario) {
    alert('Primero selecciona un cuestionario');
    return;
  }
  const nueva = { tipo, texto: '', opciones: [], respuesta: '' };
  if (tipo === 'multiple') {
    nueva.opciones = [
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
    ];
  }
  cuestionario.preguntas.push(nueva);
  renderPreguntas();
}

function guardarEdiciones() {
  if (!cuestionario) return;
  guardarEstadoTemporal();
  const nombreInput = document.getElementById('nombre-cuestionario-editar');
  if (nombreInput) cuestionario.nombre = nombreInput.value.trim();

  guardarCuestionarios(cuestionarios);
  // console.log('Cuestionarios guardados:', cuestionarios);
}

export {};
