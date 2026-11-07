'use strict';

/* ==========================================================================
   Datos: cuestionarios, progreso de estudio, sesión en curso y preferencias.
   Todo vive en localStorage. La clave "cuestionarios" mantiene el mismo
   formato que la versión anterior, así que los backups viejos siguen sirviendo.
   ========================================================================== */

const Store = (() => {
  const K = {
    cuestionarios: 'cuestionarios',
    progreso: 'cuestionarios.progreso',
    sesion: 'cuestionarios.sesion',
    prefs: 'cuestionarios.prefs',
  };

  function leer(clave, porDefecto) {
    try {
      const v = JSON.parse(localStorage.getItem(clave));
      return v ?? porDefecto;
    } catch {
      return porDefecto;
    }
  }

  function escribir(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar: el almacenamiento del navegador está lleno.', { tipo: 'error', duracion: 7000 });
      return false;
    }
  }

  /* ---------------- Normalización ---------------- */

  const TIPOS = ['multiple', 'desarrollar'];
  let ultimoId = 0;

  function nuevoId() {
    let id = Date.now();
    if (id <= ultimoId) id = ultimoId + 1;
    ultimoId = id;
    return id;
  }

  /** Devuelve una pregunta limpia o null si no es una pregunta válida. */
  function normPregunta(p) {
    if (!p || typeof p !== 'object') return null;
    const opciones = Array.isArray(p.opciones)
      ? p.opciones.filter(o => o && typeof o === 'object').map(o => ({
        texto: String(o.texto ?? '').trim(),
        esCorrecta: o.esCorrecta === true || o.esCorrecta === 'true',
      }))
      : [];
    const tipo = TIPOS.includes(p.tipo) ? p.tipo
      : opciones.length ? 'multiple'
        : p.respuesta != null ? 'desarrollar' : null;
    const texto = String(p.texto ?? '').trim();
    if (!tipo || !texto) return null;

    const out = tipo === 'multiple'
      ? { tipo, texto, opciones: opciones.filter(o => o.texto) }
      : { tipo, texto, respuesta: String(p.respuesta ?? '').trim(), opciones: [] };
    const explicacion = String(p.explicacion ?? '').trim();
    if (explicacion) out.explicacion = explicacion;
    return out;
  }

  function normCuestionario(c) {
    if (!c || typeof c !== 'object' || !Array.isArray(c.preguntas)) return null;
    const out = {
      idCuestionario: Number(c.idCuestionario) || nuevoId(),
      nombre: String(c.nombre ?? '').trim() || 'Sin nombre',
      fechaCreacion: c.fechaCreacion || new Date().toISOString(),
      preguntas: c.preguntas.map(normPregunta).filter(Boolean),
    };
    const materia = String(c.materia ?? '').trim();
    if (materia) out.materia = materia;
    if (c.fechaModificacion) out.fechaModificacion = c.fechaModificacion;
    return out;
  }

  function idsUnicos(lista) {
    const vistos = new Set();
    for (const c of lista) {
      while (vistos.has(c.idCuestionario)) c.idCuestionario = nuevoId();
      vistos.add(c.idCuestionario);
    }
    return lista;
  }

  /* ---------------- Cuestionarios ---------------- */

  let lista = null;

  function cuestionarios() {
    if (!lista) {
      const crudo = leer(K.cuestionarios, []);
      const arr = Array.isArray(crudo) ? crudo : Array.isArray(crudo?.cuestionarios) ? crudo.cuestionarios : [];
      lista = idsUnicos(arr.map(normCuestionario).filter(Boolean));
    }
    return lista;
  }

  const persistir = () => escribir(K.cuestionarios, lista);

  function cuestionario(id) {
    return cuestionarios().find(c => c.idCuestionario === Number(id)) || null;
  }

  function guardarCuestionario(c) {
    const limpio = normCuestionario(c);
    limpio.fechaModificacion = new Date().toISOString();
    const arr = cuestionarios();
    const i = arr.findIndex(x => x.idCuestionario === limpio.idCuestionario);
    if (i >= 0) arr[i] = limpio;
    else arr.push(limpio);
    persistir();
    return limpio;
  }

  function eliminarCuestionario(id) {
    lista = cuestionarios().filter(c => c.idCuestionario !== Number(id));
    persistir();
  }

  /** Agrega o actualiza (por id). Devuelve cuántos se crearon y cuántos se reemplazaron. */
  function importarCuestionarios(nuevos, { reemplazarTodo = false } = {}) {
    if (reemplazarTodo) {
      lista = idsUnicos(nuevos.map(normCuestionario).filter(Boolean));
      persistir();
      return { creados: lista.length, actualizados: 0 };
    }
    let creados = 0, actualizados = 0;
    const arr = cuestionarios();
    for (const c of nuevos) {
      const n = normCuestionario(c);
      if (!n) continue;
      const i = arr.findIndex(x => x.idCuestionario === n.idCuestionario);
      if (i >= 0) { arr[i] = n; actualizados++; } else { arr.push(n); creados++; }
    }
    persistir();
    return { creados, actualizados };
  }

  function materias() {
    return [...new Set(cuestionarios().map(c => c.materia).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  /* ---------------- Identidad de cada pregunta ----------------
     El progreso se guarda por "huella" de contenido (tipo + texto + opciones).
     Así una misma pregunta comparte progreso aunque esté en varios
     cuestionarios (por ejemplo "Clase 3" y "1er Parcial"), y reimportar un
     backup no pierde lo estudiado. */

  const cacheClaves = new WeakMap();

  function clave(p) {
    let k = cacheClaves.get(p);
    if (!k) {
      let base = p.tipo + '|' + normalizar(p.texto);
      if (p.tipo === 'multiple') base += '|' + (p.opciones || []).map(o => normalizar(o.texto)).sort().join('|');
      k = hashTexto(base);
      cacheClaves.set(p, k);
    }
    return k;
  }

  function problemas(p) {
    const out = [];
    if (!String(p.texto || '').trim()) out.push('Falta el texto de la pregunta');
    if (p.tipo === 'multiple') {
      const llenas = (p.opciones || []).filter(o => String(o.texto || '').trim());
      if (llenas.length < 2) out.push('Tiene menos de 2 opciones');
      if (!llenas.some(o => o.esCorrecta)) out.push('Ninguna opción está marcada como correcta');
    } else if (!String(p.respuesta || '').trim()) {
      out.push('Falta la respuesta esperada');
    }
    return out;
  }

  /* ---------------- Progreso y repaso espaciado ----------------
     Sistema de cajas (Leitner):
       caja 1 → repasar ya · 2 → mañana · 3 → en 3 días · 4 → en 7 · 5 → en 16
     Acertar sube una caja, fallar vuelve a la 1. Caja 4+ = "dominada". */

  const INTERVALO_DIAS = [0, 0, 1, 3, 7, 16];
  let prog = null;

  function progreso() {
    if (!prog) {
      prog = leer(K.progreso, {});
      if (typeof prog !== 'object' || Array.isArray(prog)) prog = {};
      prog.preguntas ||= {};
      prog.dias ||= {};
      prog.sesiones ||= [];
    }
    return prog;
  }

  const guardarProgreso = () => escribir(K.progreso, progreso());

  const estado = k => progreso().preguntas[k] || null;

  function registrarRespuesta(k, resultado) {
    const P = progreso();
    const ahora = Date.now();
    const e = P.preguntas[k] || { caja: 0, vistas: 0, aciertos: 0, fallos: 0 };
    e.vistas = (e.vistas || 0) + 1;
    if (resultado === 'bien') {
      e.aciertos = (e.aciertos || 0) + 1;
      e.caja = e.caja ? Math.min(5, e.caja + 1) : 2;
    } else if (resultado === 'parcial') {
      e.caja = Math.max(1, Math.min(e.caja || 0, 2));
    } else {
      e.fallos = (e.fallos || 0) + 1;
      e.caja = 1;
    }
    e.ultimo = resultado;
    e.ultima = ahora;
    const dias = INTERVALO_DIAS[e.caja];
    e.proxima = dias ? inicioDelDia(ahora) + dias * DIA_MS : ahora;
    P.preguntas[k] = e;
    const hoy = claveDia();
    P.dias[hoy] = (P.dias[hoy] || 0) + 1;
    guardarProgreso();
  }

  function nivel(k) {
    const e = estado(k);
    if (!e || !e.vistas) return 'nueva';
    return e.caja >= 4 ? 'dominada' : 'aprendiendo';
  }

  function esPendiente(k, ahora = Date.now()) {
    const e = estado(k);
    return !!(e && e.vistas && e.proxima <= ahora);
  }

  const estaMarcada = k => !!estado(k)?.marcada;

  function alternarMarcada(k) {
    const P = progreso();
    const e = P.preguntas[k] || { caja: 0, vistas: 0, aciertos: 0, fallos: 0, proxima: 0 };
    if (e.marcada) delete e.marcada; else e.marcada = true;
    P.preguntas[k] = e;
    guardarProgreso();
    return !!e.marcada;
  }

  /** Estadísticas de una lista de preguntas (sin contar repetidas). */
  function estadisticas(preguntas) {
    const ahora = Date.now();
    const vistas = new Set();
    const st = { total: 0, nuevas: 0, aprendiendo: 0, dominadas: 0, pendientes: 0, marcadas: 0, problemas: 0, ultima: 0 };
    for (const p of preguntas) {
      const k = clave(p);
      if (vistas.has(k)) continue;
      vistas.add(k);
      st.total++;
      const e = estado(k);
      if (!e || !e.vistas) st.nuevas++;
      else if (e.caja >= 4) st.dominadas++;
      else st.aprendiendo++;
      if (e?.vistas && e.proxima <= ahora) st.pendientes++;
      if (e?.marcada) st.marcadas++;
      if (e?.ultima > st.ultima) st.ultima = e.ultima;
      if (problemas(p).length) st.problemas++;
    }
    return st;
  }

  function todasLasPreguntas() {
    return cuestionarios().flatMap(c => c.preguntas);
  }

  function racha() {
    const dias = progreso().dias;
    const d = new Date();
    if (!dias[claveDia(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (dias[claveDia(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  const respondidasHoy = () => progreso().dias[claveDia()] || 0;

  function registrarSesion(resumen) {
    const P = progreso();
    const i = P.sesiones.findIndex(s => s.id === resumen.id);
    if (i >= 0) P.sesiones[i] = resumen; else P.sesiones.unshift(resumen);
    P.sesiones = P.sesiones.slice(0, 100);
    guardarProgreso();
  }

  function reiniciarProgreso() {
    prog = { preguntas: {}, dias: {}, sesiones: [] };
    guardarProgreso();
  }

  function importarProgreso(otro) {
    if (!otro || typeof otro !== 'object') return;
    const P = progreso();
    for (const [k, e] of Object.entries(otro.preguntas || {})) {
      const actual = P.preguntas[k];
      if (!actual || (e.ultima || 0) > (actual.ultima || 0)) P.preguntas[k] = e;
    }
    for (const [d, n] of Object.entries(otro.dias || {})) P.dias[d] = Math.max(P.dias[d] || 0, n);
    const ids = new Set(P.sesiones.map(s => s.id));
    P.sesiones = [...P.sesiones, ...(otro.sesiones || []).filter(s => !ids.has(s.id))]
      .sort((a, b) => b.id - a.id).slice(0, 100);
    guardarProgreso();
  }

  /* ---------------- Sesión en curso y preferencias ---------------- */

  const getSesion = () => leer(K.sesion, null);
  const setSesion = s => escribir(K.sesion, s);
  const borrarSesion = () => localStorage.removeItem(K.sesion);

  const PREFS_DEFECTO = {
    tema: 'auto',
    modo: 'repaso',
    cantidad: 20,
    tipos: { multiple: true, desarrollar: true },
    filtro: 'todas',
    mezclarOpciones: true,
    mostrarCantidad: false,
    minutos: 0,
    ultimoBackup: 0,
  };

  function prefs() {
    const p = leer(K.prefs, {});
    return { ...PREFS_DEFECTO, ...p, tipos: { ...PREFS_DEFECTO.tipos, ...(p.tipos || {}) } };
  }

  const setPrefs = cambios => escribir(K.prefs, { ...prefs(), ...cambios });

  /* ---------------- Exportar / importar ---------------- */

  /** Formato clásico: un array de cuestionarios (compatible con la versión anterior). */
  const exportarCuestionarios = arr => JSON.stringify(arr, null, 2);

  function exportarCompleto() {
    return JSON.stringify({
      app: 'cuestionarios-web',
      version: 2,
      exportado: new Date().toISOString(),
      cuestionarios: cuestionarios(),
      progreso: progreso(),
    }, null, 2);
  }

  /**
   * Interpreta lo que venga de un archivo o del portapapeles:
   * - JSON: array de cuestionarios, un cuestionario, un backup completo o un array de preguntas.
   * - Texto plano con el formato simple (ver parsearTexto).
   */
  function interpretar(texto) {
    texto = String(texto).replace(/^﻿/, '').trim();
    if (!texto) throw new Error('No hay nada para importar.');

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      if (/^[[{]/.test(texto)) throw new Error('El JSON tiene un error de formato (revisá comas y llaves).');
      const preguntas = parsearTexto(texto);
      if (!preguntas.length) throw new Error('No se encontraron preguntas en el texto.');
      return { cuestionarios: [], preguntas, progreso: null, formato: 'texto' };
    }

    if (Array.isArray(datos)) {
      if (datos.some(x => x && Array.isArray(x.preguntas))) {
        return { cuestionarios: datos.map(normCuestionario).filter(Boolean), preguntas: [], progreso: null, formato: 'json' };
      }
      const preguntas = datos.map(normPregunta).filter(Boolean);
      if (preguntas.length) return { cuestionarios: [], preguntas, progreso: null, formato: 'json' };
    } else if (datos && typeof datos === 'object') {
      if (Array.isArray(datos.cuestionarios)) {
        return {
          cuestionarios: datos.cuestionarios.map(normCuestionario).filter(Boolean),
          preguntas: [],
          progreso: datos.progreso && typeof datos.progreso === 'object' ? datos.progreso : null,
          formato: 'json',
        };
      }
      if (Array.isArray(datos.preguntas)) {
        const c = normCuestionario(datos);
        return { cuestionarios: c ? [c] : [], preguntas: [], progreso: null, formato: 'json' };
      }
      const p = normPregunta(datos);
      if (p) return { cuestionarios: [], preguntas: [p], progreso: null, formato: 'json' };
    }
    throw new Error('No se reconoce el formato. Tiene que ser un backup de esta app o preguntas en el formato de texto.');
  }

  /**
   * Formato de texto simple. Preguntas separadas por una línea en blanco:
   *
   *   ¿Qué significa HTML?
   *   + HyperText Markup Language      ← correcta (también "*" o "[x]")
   *   - High Tech Modern Language      ← incorrecta (también "[ ]")
   *
   *   Explicá qué es el DOM.
   *   R: Es la representación en árbol del documento…   ← pregunta de desarrollo
   *   E: (opcional) explicación que se muestra después de responder
   */
  function parsearTexto(texto) {
    const bloques = texto.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/);
    const preguntas = [];

    for (const bloque of bloques) {
      const lineas = bloque.split('\n').filter(l => !/^\s*#/.test(l));
      if (!lineas.some(l => l.trim())) continue;

      const enunciado = [], opciones = [], respuesta = [], explicacion = [];
      let modo = 'enunciado';

      for (const cruda of lineas) {
        const l = cruda.trim();
        if (!l && modo !== 'respuesta') continue;
        let m;
        if (modo !== 'respuesta' && modo !== 'explicacion' && (m = l.match(/^R(?:ta|espuesta)?\s*:\s*(.*)$/i))) {
          modo = 'respuesta';
          if (m[1]) respuesta.push(m[1]);
          continue;
        }
        if ((m = l.match(/^E(?:xplicaci[oó]n)?\s*:\s*(.*)$/i))) {
          modo = 'explicacion';
          if (m[1]) explicacion.push(m[1]);
          continue;
        }
        if (modo === 'respuesta') { respuesta.push(cruda.trimEnd()); continue; }
        if (modo === 'explicacion') { explicacion.push(l); continue; }
        if ((m = l.match(/^(?:\+|\*|\[[xX✓✔]\])\s*(.+)$/))) {
          opciones.push({ texto: m[1].trim(), esCorrecta: true });
          modo = 'opciones';
          continue;
        }
        if ((m = l.match(/^(?:-|–|\[\s?\])\s*(.+)$/))) {
          opciones.push({ texto: m[1].trim(), esCorrecta: false });
          modo = 'opciones';
          continue;
        }
        if (modo === 'enunciado') {
          enunciado.push(enunciado.length ? l : l.replace(/^(?:P(?:regunta)?\s*:|\d+\s*[.)])\s*/i, ''));
        } else if (opciones.length) {
          opciones[opciones.length - 1].texto += ' ' + l;
        }
      }

      const p = normPregunta({
        tipo: opciones.length ? 'multiple' : 'desarrollar',
        texto: enunciado.join('\n'),
        opciones,
        respuesta: respuesta.join('\n').trim(),
        explicacion: explicacion.join('\n'),
      });
      if (p) preguntas.push(p);
    }
    return preguntas;
  }

  function usoAlmacenamiento() {
    let bytes = 0;
    for (const k of Object.values(K)) bytes += (localStorage.getItem(k) || '').length * 2;
    return bytes;
  }

  function borrarTodo() {
    Object.values(K).forEach(k => localStorage.removeItem(k));
    lista = null;
    prog = null;
  }

  return {
    nuevoId, normPregunta, normCuestionario,
    cuestionarios, cuestionario, guardarCuestionario, eliminarCuestionario, importarCuestionarios, materias,
    clave, problemas, todasLasPreguntas,
    estado, nivel, esPendiente, estaMarcada, alternarMarcada, registrarRespuesta, estadisticas,
    racha, respondidasHoy, progreso, registrarSesion, reiniciarProgreso, importarProgreso,
    getSesion, setSesion, borrarSesion, prefs, setPrefs,
    exportarCuestionarios, exportarCompleto, interpretar, parsearTexto, usoAlmacenamiento, borrarTodo,
  };
})();
