document.addEventListener('DOMContentLoaded', () => {
  inicializar();
});

let cuestionarios = [];
let cuestionarioSeleccionado = null;
let preguntasRestantes = [];
let puntaje = 0;
let totalPreguntas = 0;
let indicePreguntaActual = -1;

function inicializar() {
  cargarCuestionarios();
  configurarEventos();
  resetearPractica();
}

function cargarCuestionarios() {
  const select = document.getElementById('lista-cuestionarios');
  cuestionarios = JSON.parse(localStorage.getItem('cuestionarios')) || [];
  select.innerHTML = '<option value="">-- Elegir --</option>';
  cuestionarios.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.idCuestionario;
    opt.textContent = c.nombre;
    select.appendChild(opt);
  });
}

function configurarEventos() {
  document.getElementById('lista-cuestionarios').addEventListener('change', e => {
    const id = e.target.value;
    cuestionarioSeleccionado = cuestionarios.find(c => c.idCuestionario == id);
    document.getElementById('btn-iniciar').disabled = !cuestionarioSeleccionado;
  });

  document.getElementById('btn-iniciar').addEventListener('click', iniciarPractica);
  document.getElementById('btn-mostrar-respuesta').addEventListener('click', toggleMostrarRespuesta);
  document.getElementById('btn-siguiente').addEventListener('click', siguientePregunta);
  document.getElementById('btn-reiniciar').addEventListener('click', resetearPractica);
}

function resetearPractica() {
  puntaje = 0;
  totalPreguntas = 0;
  preguntasRestantes = [];
  cuestionarioSeleccionado = null;
  indicePreguntaActual = -1;

  document.getElementById('practica').classList.add('oculto');
  document.getElementById('resultado').classList.add('oculto');
  document.getElementById('btn-mostrar-respuesta').classList.add('oculto');
  limpiarPregunta();

  document.getElementById('btn-iniciar').disabled = true;
}

function iniciarPractica() {
  if (!cuestionarioSeleccionado || !cuestionarioSeleccionado.preguntas.length) return;

  preguntasRestantes = barajarArray([...cuestionarioSeleccionado.preguntas]);
  totalPreguntas = preguntasRestantes.length;
  puntaje = 0;

  // Ocultar resultado anterior (si estaba visible)
  document.getElementById('resultado').classList.add('oculto');

  mostrarPreguntaAleatoria();
  document.getElementById('practica').classList.remove('oculto');
}


function mostrarPreguntaAleatoria() {
  limpiarPregunta();

  if (preguntasRestantes.length === 0) {
    mostrarResultado();
    return;
  }

  indicePreguntaActual = 0;
  const pregunta = preguntasRestantes[indicePreguntaActual];

  const cont = document.getElementById('contenedor-pregunta');

  const tipo = document.createElement('p');
  tipo.innerHTML = `<strong>Tipo:</strong> ${pregunta.tipo}`;
  const texto = document.createElement('p');
  texto.textContent = pregunta.texto;

  cont.appendChild(tipo);
  cont.appendChild(texto);

  if (pregunta.tipo === 'multiple') {
    const ul = document.createElement('ul');
    ul.classList.add('opciones');
    pregunta.opciones.forEach((op, i) => {
      const li = document.createElement('li');
      li.classList.add('opcion');
      li.innerHTML = `
        <label>
          <input type="checkbox" data-index="${i}" />
          ${op.texto}
        </label>
      `;
      ul.appendChild(li);
    });
    cont.appendChild(ul);
  } else if (pregunta.tipo === 'desarrollar') {
    const textarea = document.createElement('textarea');
    textarea.id = 'respuesta-usuario';
    textarea.placeholder = 'Escribí tu respuesta acá...';
    cont.appendChild(textarea);
  }

  const btnMostrar = document.getElementById('btn-mostrar-respuesta');
  btnMostrar.classList.remove('oculto');
  btnMostrar.textContent = 'Mostrar respuesta';

  limpiarRespuestaMostrada();
}

function toggleMostrarRespuesta() {
  const cont = document.getElementById('contenedor-pregunta');
  let resp = cont.querySelector('.respuesta');
  const pregunta = preguntasRestantes[indicePreguntaActual];
  const btnMostrar = document.getElementById('btn-mostrar-respuesta');

  if (!pregunta) return;

  if (resp) {
    resp.remove();
    btnMostrar.textContent = 'Mostrar respuesta';
  } else {
    resp = document.createElement('div');
    resp.className = 'respuesta';

    if (pregunta.tipo === 'multiple') {
      const correctas = pregunta.opciones
        .map((op, i) => op.esCorrecta ? pregunta.opciones[i].texto : null)
        .filter(Boolean)
        .join('<br>');
      resp.innerHTML = `<strong>Correctas:</strong><br>${correctas}`;
    } else if (pregunta.tipo === 'desarrollar') {
      resp.innerHTML = `<strong>Respuesta esperada:</strong> ${pregunta.respuesta || 'No disponible'}`;
    }

    cont.appendChild(resp);
    btnMostrar.textContent = 'Ocultar respuesta';
  }
}

function siguientePregunta() {
  if (indicePreguntaActual < 0 || indicePreguntaActual >= preguntasRestantes.length) return;

  const preguntaActual = preguntasRestantes[indicePreguntaActual];
  validarRespuestaActual(preguntaActual);

  preguntasRestantes.splice(indicePreguntaActual, 1);
  indicePreguntaActual = -1;

  if (preguntasRestantes.length === 0) {
    mostrarResultado();
  } else {
    mostrarPreguntaAleatoria();
  }
}

function validarRespuestaActual(pregunta) {
  let esCorrecta = false;

  if (pregunta.tipo === 'multiple') {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const seleccionadas = Array.from(checkboxes).map(cb => cb.checked);
    esCorrecta = pregunta.opciones.every((op, i) => op.esCorrecta === seleccionadas[i]);
  } else if (pregunta.tipo === 'desarrollar') {
    const entrada = document.getElementById('respuesta-usuario');
    const rta = entrada?.value?.trim()?.toLowerCase();
    const esperada = pregunta.respuesta?.trim()?.toLowerCase();
    esCorrecta = rta === esperada;
  }

  if (esCorrecta) puntaje++;
}

function mostrarResultado() {
  document.getElementById('practica').classList.add('oculto');
  const puntajeTexto = `${puntaje} / ${totalPreguntas} respuestas correctas`;
  document.getElementById('puntaje').textContent = puntajeTexto;
  document.getElementById('resultado').classList.remove('oculto');
}

function limpiarPregunta() {
  document.getElementById('contenedor-pregunta').innerHTML = '';
}

function limpiarRespuestaMostrada() {
  const cont = document.getElementById('contenedor-pregunta');
  const resp = cont.querySelector('.respuesta');
  if (resp) resp.remove();
}

function barajarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
