// Calendario.gs
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Calendario.gs  (v2)
// Calendario tipo almanaque semanal para Producción — SOLO LECTURA
// ═══════════════════════════════════════════════════════════════
//
// Archivo ADITIVO: no modifica Pedidos.gs ni Auth.gs. Lee la hoja Pedidos a
// través de _leerTodosPedidos_() (Pedidos.gs).
//
// DOS PUERTAS DE ENTRADA, MISMO NÚCLEO (_calendarioSemanaCore_):
//   1) getCalendarioSemana(desde, token)   → la pestaña 📅 Calendario dentro
//      de la app de Pedidos (requiere login/PIN). Igual que en la v1.
//   2) getCalendarioPublico(desde, clave)  → la pantalla independiente
//      ?page=calendario (CalendarioProduccion.html), SIN login: pensada para
//      que Producción la abra desde un link, sin usuario ni PIN.
//
// QUÉ MUESTRA: pedidos Aceptados, Terminados y Entregados, agrupados por
// Fecha Estimada de Despacho, una semana (lunes→domingo) por consulta.
//   - Aceptado  = todavía hay que producirlo ("Por hacer" en la pantalla)
//   - Terminado = ya producido, esperando entrega
//   - Entregado = ya salió (se muestra atenuado, para tener el día completo)
// Pendiente / Rechazado / Cancelado / Revertido NO se muestran.
// Además devuelve "atrasados": pedidos Aceptados/Terminados con fecha
// estimada ya vencida (anterior a hoy) que caen FUERA de la semana mostrada
// — los de la semana mostrada ya se ven en su día, marcados como atrasados.
//
// PRIVACIDAD: el payload NUNCA lleva precios, montos ni condición de cobro.
// Como la entrada pública no tiene login, esto se garantiza en el servidor
// (no depende de que el frontend "oculte" nada).
//
// CLAVE OPCIONAL DEL LINK: si existe la Script Property CALENDARIO_KEY, la
// entrada pública exige ?k=<clave> en el link. Si no existe, el link es
// abierto (mismo criterio que el Dashboard). Se activa/rota con
// generarLinkCalendario() y se apaga con quitarClaveCalendario().
//
// OJO — no referenciar PED_ESTADOS a nivel global en este archivo: Apps
// Script carga los archivos en el orden del proyecto y, si este se cargara
// antes que Pedidos.gs, PED_ESTADOS todavía no existiría. Por eso solo se
// usa adentro de las funciones (que corren después de cargar todo).
// ═══════════════════════════════════════════════════════════════

// ── Puerta 1: pestaña dentro de la app de Pedidos (con sesión) ──────────
function getCalendarioSemana(desde, token) {
  var chk = _requiereRol_(token, ['vendedor', 'gerente', 'dueno', 'produccion']);
  if (!chk.ok) return chk;
  return _calendarioSemanaCore_(desde);
}

// ── Puerta 2: pantalla independiente, sin login ─────────────────────────
function getCalendarioPublico(desde, clave) {
  var esperada = PropertiesService.getScriptProperties().getProperty('CALENDARIO_KEY');
  if (esperada && String(clave || '') !== esperada) {
    return { ok: false, bloqueado: true, mensaje: 'Este link ya no es válido. Pedí el link actualizado.' };
  }
  return _calendarioSemanaCore_(desde);
}

// ── Núcleo ──────────────────────────────────────────────────────────────
// desde: "YYYY-MM-DD" de cualquier día de la semana pedida (se normaliza al
// lunes). Vacío = semana actual. Devuelve además las fechas de la semana
// anterior/siguiente para que el frontend navegue sin calcular fechas.
function _calendarioSemanaCore_(desde) {
  var TZ  = 'America/Argentina/Buenos_Aires';
  var DIA = 86400000;
  var NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var visibles = [PED_ESTADOS.ACEPTADO, PED_ESTADOS.TERMINADO, PED_ESTADOS.ENTREGADO];

  var hoyISO = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var partes = String(desde || hoyISO).trim().split('-');
  var y = Number(partes[0]), m = Number(partes[1]), d = Number(partes[2]);
  if (partes.length !== 3 || !y || !m || !d) return { ok: false, mensaje: 'Semana inválida.' };

  // Toda la aritmética de fechas se hace en UTC (Date.UTC + formatear en GMT)
  // para que no dependa del huso configurado en el proyecto de Apps Script.
  var t0 = Date.UTC(y, m - 1, d);
  var lunesMs = t0 - ((new Date(t0).getUTCDay() + 6) % 7) * DIA; // lunes de esa semana
  function fmt(ms, patron) { return Utilities.formatDate(new Date(ms), 'GMT', patron); }

  var dias = [], indice = {};
  for (var i = 0; i < 7; i++) {
    var ms = lunesMs + i * DIA;
    var dia = {
      iso: fmt(ms, 'yyyy-MM-dd'), fecha: fmt(ms, 'dd/MM/yyyy'),
      dd: fmt(ms, 'dd'), mm: fmt(ms, 'MM'),
      diaSemana: NOMBRES_DIA[new Date(ms).getUTCDay()],
      esHoy: false, pedidos: [], resumen: [], pendientes: 0
    };
    dia.esHoy = (dia.iso === hoyISO);
    dias.push(dia);
    indice[dia.fecha] = dia; // _leerTodosPedidos_ devuelve fechaEstimada como "dd/MM/yyyy"
  }

  // Agrupar líneas por pedido (Grupo) dentro de cada día. La clave incluye el
  // día porque editarPedido() puede mover la fecha de UNA línea de un grupo.
  var mapa = {}, sinFecha = [], atrasados = [];
  _leerTodosPedidos_().forEach(function(p) {
    if (visibles.indexOf(p.estado) === -1) return;
    if (p.fechaEstimada) {
      var diaDestino = indice[p.fechaEstimada];
      if (diaDestino) {
        _calAgregarLinea_(mapa, diaDestino.iso + '|' + p.grupo, diaDestino.pedidos, p);
        return;
      }
      // Fuera de la semana mostrada: si ya venció y todavía no salió → atrasado.
      if (p.estado !== PED_ESTADOS.ENTREGADO && _calFechaAISO_(p.fechaEstimada) < hoyISO) {
        _calAgregarLinea_(mapa, 'at|' + p.grupo + '|' + p.fechaEstimada, atrasados, p);
      }
      return;
    }
    // Pedidos viejos (de antes del campo Fecha Estimada). Los Entregados ya
    // salieron, no hace falta agendarlos; los demás se avisan aparte para
    // que no queden invisibles.
    if (p.estado === PED_ESTADOS.ENTREGADO) return;
    _calAgregarLinea_(mapa, 'sf|' + p.grupo, sinFecha, p);
  });

  // Orden por cliente + resumen del día (total por producto y cuánto falta hacer)
  dias.forEach(function(dia) {
    dia.pedidos.sort(function(a, b) { return String(a.cliente).localeCompare(String(b.cliente), 'es'); });
    var acum = {};
    dia.pedidos.forEach(function(g) {
      var tienePendiente = false;
      g.lineas.forEach(function(l) {
        var r = acum[l.etiqueta] || (acum[l.etiqueta] = { etiqueta: l.etiqueta, total: 0, porHacer: 0 });
        r.total += l.unidades;
        if (l.estado === PED_ESTADOS.ACEPTADO) { r.porHacer += l.unidades; tienePendiente = true; }
      });
      if (tienePendiente) dia.pendientes++;
      // Día ya pasado y el pedido todavía no salió por completo → atrasado.
      if (dia.iso < hoyISO) {
        g.atrasado = g.lineas.some(function(l) { return l.estado !== PED_ESTADOS.ENTREGADO; });
      }
    });
    dia.resumen = Object.keys(acum).map(function(k) { return acum[k]; })
      .sort(function(a, b) { return a.etiqueta.localeCompare(b.etiqueta, 'es'); });
  });
  sinFecha.sort(function(a, b) { return String(a.cliente).localeCompare(String(b.cliente), 'es'); });
  atrasados.sort(function(a, b) {
    var fa = _calFechaAISO_(a.fechaEstimada), fb = _calFechaAISO_(b.fechaEstimada);
    return fa < fb ? -1 : fa > fb ? 1 : String(a.cliente).localeCompare(String(b.cliente), 'es');
  });

  return {
    ok: true,
    hoy: hoyISO,
    lunes: dias[0].iso,
    domingo: dias[6].iso,
    semanaAnterior: fmt(lunesMs - 7 * DIA, 'yyyy-MM-dd'),
    semanaSiguiente: fmt(lunesMs + 7 * DIA, 'yyyy-MM-dd'),
    esSemanaActual: dias.some(function(x) { return x.esHoy; }),
    dias: dias,
    atrasados: atrasados,
    sinFecha: sinFecha
  };
}

// Suma una línea de pedido al grupo que le corresponde (lo crea si no existe).
// Si las líneas de un mismo grupo están en estados distintos (pasa cuando una
// entrega falla a mitad de camino, ver marcarEntregado), el grupo queda
// marcado como "mixto" y el frontend lo muestra como Parcial.
function _calAgregarLinea_(mapa, clave, lista, p) {
  var g = mapa[clave];
  if (!g) {
    g = { grupo: p.grupo, cliente: p.cliente, vendedor: p.vendedor || '', fechaEstimada: p.fechaEstimada || '',
          estado: p.estado, mixto: false, atrasado: false, lineas: [] };
    mapa[clave] = g;
    lista.push(g);
  }
  if (g.estado !== p.estado) g.mixto = true;
  g.lineas.push({
    etiqueta: _calEtiquetaProducto_(p.producto, p.variante),
    unidades: Number(p.unidades) || 0,
    unidad: String(p.unidad || ''),
    estado: p.estado,
    obs: String(p.obs || '').trim()
  });
}

// "22/09/2026" → "2026-09-22" (comparable como texto)
function _calFechaAISO_(dmy) {
  var p = String(dmy || '').split('/');
  return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : '';
}

// "Tartines" + "Tartin — Pollo" → "Tartin — Pollo" (la variante ya es
// descriptiva); "Chipalmendras" + "Común" → "Chipalmendras (Común)".
function _calEtiquetaProducto_(producto, variante) {
  producto = String(producto || '').trim();
  variante = String(variante || '').trim();
  if (!variante) return producto;
  return (variante.indexOf('—') > -1 || variante.indexOf(' - ') > -1) ? variante : producto + ' (' + variante + ')';
}

// ════════════════════════════════════════════════════════════════
// LINK DE LA PANTALLA — utilidades para correr desde el editor de
// Apps Script (seleccionar la función arriba y ▷ Ejecutar; el link
// sale en "Registro de ejecución"). No necesitan la Hoja abierta.
// ════════════════════════════════════════════════════════════════
function _calBaseUrl_() {
  // Si se ejecuta desde el editor a veces devuelve la URL de prueba (/dev):
  // la de uso real es siempre /exec.
  return ScriptApp.getService().getUrl().replace(/\/dev$/, '/exec');
}

// Muestra el link tal como está hoy (con clave si está activada).
function verLinkCalendario() {
  var clave = PropertiesService.getScriptProperties().getProperty('CALENDARIO_KEY');
  var url = _calBaseUrl_() + '?page=calendario' + (clave ? '&k=' + clave : '');
  Logger.log((clave ? '🔒 Link con clave:' : '🔓 Link abierto (sin clave):') + '\n' + url);
  return url;
}

// Activa la clave (o la cambia). Al cambiarla, el link viejo deja de andar.
function generarLinkCalendario() {
  var clave = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  PropertiesService.getScriptProperties().setProperty('CALENDARIO_KEY', clave);
  var url = _calBaseUrl_() + '?page=calendario&k=' + clave;
  Logger.log('🔒 Clave activada. Compartí SOLO este link (el anterior ya no funciona):\n' + url);
  return url;
}

// Vuelve al link abierto, sin clave.
function quitarClaveCalendario() {
  PropertiesService.getScriptProperties().deleteProperty('CALENDARIO_KEY');
  var url = _calBaseUrl_() + '?page=calendario';
  Logger.log('🔓 Clave desactivada. Link abierto:\n' + url);
  return url;
}