/* Crea o amplía la colección "cuestionarios" en localStorage */
document.addEventListener('DOMContentLoaded', () => {
  const form               = document.getElementById('form-cuestionario');
  const preguntasContainer = document.getElementById('preguntas-container');
  const btnAgregarPregunta  = document.getElementById('btn-agregar-pregunta');

  let contadorPreguntas = 0;

  // --- Agregar pregunta dinámica ---
  btnAgregarPregunta.addEventListener('click', () => {
    crearPreguntaUI();
    actualizarNumeracionPreguntas();
  });

  // --- Guardar cuestionario ---
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nombre = form['nombre-cuestionario'].value.trim();
    if (!nombre) return alert('Ingrese el nombre del cuestionario');

    const preguntas = recolectarPreguntas();
    if (!preguntas.length) return;

    const cuestionarios = cargarCuestionarios();     // array existentes
    const nuevoCuestionario = {
      idCuestionario : Date.now(),                  // ID único
      nombre,
      fechaCreacion  : new Date().toISOString(),
      preguntas
    };

    cuestionarios.push(nuevoCuestionario);
    localStorage.setItem('cuestionarios', JSON.stringify(cuestionarios));

    alert('Cuestionario guardado con éxito.');
    form.reset();
    preguntasContainer.innerHTML = '';
    contadorPreguntas = 0;
  });

  // ---------- Helpers ----------

  function crearPreguntaUI() {
    const div = document.createElement('div');
    div.className = 'pregunta';
    div.innerHTML = `
      <fieldset>
        <legend>Pregunta</legend>

        <label>Tipo:
          <select class="tipo-pregunta" required>
            <option value="">Seleccionar...</option>
            <option value="multiple">Multiple Choice</option>
            <option value="desarrollar">Desarrollar</option>
          </select>
        </label>

        <label>Texto de la pregunta:
          <textarea class="texto-pregunta" rows="2" required></textarea>
        </label>

        <div class="opciones-container">
          <label>Opciones:</label>
          <div class="opciones-lista"></div>
          <div class="btn-container">
            <button type="button" class="btn-agregar-opcion">Agregar opción</button>
            <button type="button" class="btn-eliminar-pregunta btn-rojo">Eliminar pregunta</button>
          </div>
        </div>

        <div class="respuesta-desarrollar-container" style="display: none;">
          <label>Respuesta esperada:
            <textarea class="respuesta-desarrollar" rows="2"></textarea>
          </label>
        </div>
      </fieldset>
    `;
    preguntasContainer.appendChild(div);

    // referencias internas
    const tipoSelect          = div.querySelector('.tipo-pregunta');
    const contOpciones        = div.querySelector('.opciones-container');
    const listaOpciones       = div.querySelector('.opciones-lista');
    const contDesarrollar     = div.querySelector('.respuesta-desarrollar-container');
    const btnAddOpcion        = div.querySelector('.btn-agregar-opcion');
    const btnEliminarPregunta = div.querySelector('.btn-eliminar-pregunta');

    tipoSelect.addEventListener('change', () => {
      if (tipoSelect.value === 'multiple') {
        contOpciones.classList.add('visible');
        contDesarrollar.style.display = 'none';
        if (listaOpciones.childElementCount === 0) {
          crearOpcionUI(listaOpciones);
          crearOpcionUI(listaOpciones);
        }
      } else if (tipoSelect.value === 'desarrollar') {
        contOpciones.classList.remove('visible');
        listaOpciones.innerHTML = '';
        contDesarrollar.style.display = 'block';
      } else {
        contOpciones.classList.remove('visible');
        listaOpciones.innerHTML = '';
        contDesarrollar.style.display = 'none';
      }
    });

    btnAddOpcion.addEventListener('click', () => crearOpcionUI(listaOpciones));

    btnEliminarPregunta.addEventListener('click', () => {
      div.remove();
      actualizarNumeracionPreguntas();
    });
  }

  function crearOpcionUI(container) {
    const div = document.createElement('div');
    div.className = 'opcion';
    div.innerHTML = `
      <label><input type="checkbox" class="correcta-opcion"></label>
      <input type="text" class="texto-opcion" placeholder="Texto" required>
      <div class="btn-container">
        <button type="button" class="btn-eliminar-opcion btn-rojo">X</button>
      </div>
    `;
    container.appendChild(div);
    div.querySelector('.btn-eliminar-opcion').addEventListener('click', () => div.remove());
  }

  function recolectarPreguntas() {
    const preguntas = [];
    preguntasContainer.querySelectorAll('.pregunta').forEach(div => {
      const tipo  = div.querySelector('.tipo-pregunta').value;
      const texto = div.querySelector('.texto-pregunta').value.trim();
      if (!tipo || !texto) return alert('Complete todos los campos de las preguntas');

      if (tipo === 'multiple') {
        const opciones = [];
        let tieneCorrecta = false;
        div.querySelectorAll('.opcion').forEach(opDiv => {
          const t = opDiv.querySelector('.texto-opcion').value.trim();
          const c = opDiv.querySelector('.correcta-opcion').checked;
          if (t === '') return;
          opciones.push({ texto: t, esCorrecta: c });
          if (c) tieneCorrecta = true;
        });
        if (opciones.length < 2) return alert('Cada pregunta múltiple necesita al menos 2 opciones');
        if (!tieneCorrecta) return alert('Marque al menos una opción correcta');
        preguntas.push({ tipo, texto, opciones });
      } else if (tipo === 'desarrollar') {
        const respuesta = div.querySelector('.respuesta-desarrollar')?.value.trim() || '';
        preguntas.push({ tipo, texto, respuesta, opciones: [] });
      }
    });
    return preguntas;
  }

  function cargarCuestionarios() {
    return JSON.parse(localStorage.getItem('cuestionarios')) || [];
  }

  function actualizarNumeracionPreguntas() {
    const preguntas = preguntasContainer.querySelectorAll('.pregunta');
    preguntas.forEach((div, index) => {
      const legend = div.querySelector('legend');
      if (legend) legend.textContent = `Pregunta Nº${index + 1}`;
    });
  }
});
