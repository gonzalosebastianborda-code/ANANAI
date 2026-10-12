// ═══════════════════════════════════════════════════════════════
// ✅ ESTE SÍ ES UN ARCHIVO NUEVO — se agrega como pestaña nueva en el
// proyecto de Apps Script, con este nombre o el que prefieras.
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · ETAPA 4 — módulo de Consultas (archivo nuevo)
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO: el backend real detrás de la pestaña 🔎 Consultas del
// mockup ("reemplazo del Excel"), que hoy en el mockup lee de arrays de
// ejemplo (PEDIDOS_HIST, GASTOS_HIST, y el propio historial de
// CLIENTES/PROVEEDORES). Esta función (getConsultas) devuelve
// EXACTAMENTE la misma forma de datos que ya arma getConsRegistros()
// en el mockup — { fecha, entidad, texto, meta, monto, grupo? } — así
// que cuando se conecte el Dashboard real (Etapa 5), alcanza con
// reemplazar el array de ejemplo por el resultado de este llamado, sin
// tocar nada de renderConsultas()/toggleConsGrupo() (el agrupado por
// día/entidad/detalle es puramente de pantalla, no hace falta tocarlo).
//
// Los 4 módulos son los mismos 4 que ya tiene el mockup:
//   'pedidos' → hoja Pedidos (vía _leerTodosPedidos_(), Pedidos.gs)
//   'gastos'  → hoja Gastos
//   'cobros'  → hoja Cobros
//   'pagos'   → hoja Pagos Proveedores
//
// LOS FILTROS son los mismos 4 que ya tiene renderConsultas() del
// mockup, aplicados acá del lado del servidor (no tiene sentido mandar
// 1500 despachos o 250 gastos al navegador para filtrarlos ahí):
//   - periodoDias: 0 = todo el historial; >0 = solo lo de los últimos
//     N días. (El mockup usaba una fecha demo fija; acá se usa HOY de
//     verdad, con el mismo huso horario que el resto del sistema.)
//   - entidad: nombre exacto de cliente/proveedor, o vacío = todos.
//   - grupo: solo aplica al módulo 'gastos' (A/B/C/D de la taxonomía),
//     vacío = todos.
//   - busqueda: texto libre, busca en la descripción Y en la entidad
//     (mismo criterio que el mockup).
// El orden de salida es el mismo que ya usa el mockup: más reciente
// primero.
//
// DE QUÉ DEPENDE (ya existe, no hace falta tocar nada):
//   - _leerTodosPedidos_() → Pedidos.gs
//   - H_GASTOS, GASTOS_START, H_PAGOS_PR, PAGOS_START → Configuracion.gs
//   - H_COBROS, DATA_ROW → Código.gs
//   - _requiereRol_() → Auth.gs
//
// SOBRE LA EXPORTACIÓN A CSV: el mockup arma el .csv en el propio
// navegador a partir de este mismo arreglo filtrado — esa parte no
// necesita nada nuevo de acá. Lo único que ojo: usa
// window.claude.use('downloads'), que es específico del entorno de
// vista previa de Claude y NO existe en una Web App de Apps Script real
// — hay que reemplazarlo (por ejemplo generando el CSV en el servidor
// con esta misma función y devolviéndolo como texto para que el
// navegador lo descargue con un link normal, o guardándolo en Drive).
// Lo dejo anotado para resolverlo en la Etapa 5 (ahí vamos a estar
// tocando esa pantalla igual), no hace falta nada ahora.
//
// CÓMO PROBAR EN LA COPIA:
//   1. getConsultas('gastos', 0, '', '', '', token) con token de
//      Gerente → tiene que devolver ok:true y un registro por cada fila
//      real de la hoja Gastos (deberían ser ~130+ si ya corriste
//      importarHistoricosGastos()), el más reciente primero.
//   2. getConsultas('gastos', 30, '', '', '', token) → mismo, pero solo
//      los de los últimos 30 días.
//   3. getConsultas('cobros', 0, '<nombre de un cliente real>', '', '',
//      token) → solo los cobros de ese cliente.
//   4. getConsultas('pedidos', 0, '', '', 'medialuna', token) → solo
//      pedidos cuyo producto o cliente contenga "medialuna".
//   5. Sumar el campo "monto" de la respuesta y confirmar que coincide
//      con lo que ya sabés que hay cargado (por ejemplo, contra el
//      total que muestra getCXP()/getCXC() para ese cliente/proveedor
//      puntual, si filtraste por uno solo).
// ═══════════════════════════════════════════════════════════════

var TZ_CONSULTAS = 'America/Argentina/Buenos_Aires';

function _fmtMontoConsultas_(n) {
  return '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
}

// Días de diferencia entre una fecha real (Date) y hoy, en el huso de
// Argentina — mismo concepto que consDiasAtras() del mockup, pero con
// fechas reales en vez de una fecha demo fija.
function _diasDesdeHoy_(fecha) {
  if (!(fecha instanceof Date)) return Infinity; // sin fecha válida: nunca entra en un filtro de período
  var hoy = new Date();
  var msPorDia = 24 * 60 * 60 * 1000;
  var diaFecha = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
  var diaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  return Math.round((diaHoy - diaFecha) / msPorDia);
}

// OJO: no se reusa _leerTodosPedidos_() (Pedidos.gs) porque esa función
// devuelve la fecha ya como texto formateado ("dd/MM/yyyy"), y acá hace
// falta la fecha real (Date) para poder filtrar por período y ordenar
// por más-reciente. Se lee la hoja directo, con las mismas constantes
// globales (H_PEDIDOS, PC, PED_DATA_ROW) que ya usa Pedidos.gs — no
// hace falta tocar ese archivo para esto.
function _registrosPedidosConsultas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_PEDIDOS);
  var out = [];
  if (hoja && hoja.getLastRow() >= PED_DATA_ROW) {
    var n = hoja.getLastRow() - PED_DATA_ROW + 1;
    hoja.getRange(PED_DATA_ROW, 1, n, PED_NUM_COLS).getValues().forEach(function(r) {
      if (!r[PC.ID - 1]) return;
      var fecha = r[PC.FECHA - 1] instanceof Date ? r[PC.FECHA - 1] : null;
      var producto = String(r[PC.PRODUCTO - 1] || '');
      var variante = String(r[PC.VARIANTE - 1] || '');
      out.push({
        fechaTxt: fecha ? Utilities.formatDate(fecha, TZ_CONSULTAS, 'dd/MM/yyyy') : '',
        fechaOrden: fecha,
        entidad: String(r[PC.CLIENTE - 1] || ''), texto: producto + (variante ? ' ' + variante : ''),
        meta: (Number(r[PC.UNIDADES - 1]) || 0) + ' u. × ' + _fmtMontoConsultas_(r[PC.PRECIO - 1]) + ' · ' + String(r[PC.ESTADO - 1] || ''),
        monto: Number(r[PC.MONTO - 1]) || 0
      });
    });
  }
  return out;
}

function _registrosGastosConsultas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hG = ss.getSheetByName(H_GASTOS);
  var out = [];
  if (hG && hG.getLastRow() >= GASTOS_START) {
    hG.getRange(GASTOS_START, 1, hG.getLastRow() - GASTOS_START + 1, 11).getValues().forEach(function(r) {
      var fecha = r[1] instanceof Date ? r[1] : null;
      if (!r[0]) return;
      out.push({
        fechaTxt: fecha ? Utilities.formatDate(fecha, TZ_CONSULTAS, 'dd/MM/yyyy') : '',
        fechaOrden: fecha,
        entidad: String(r[5] || '').trim(), texto: String(r[4] || '').trim(),
        meta: String(r[3] || '') + ' · ' + String(r[9] || ''),
        monto: Number(r[6]) || 0, grupo: String(r[2] || '')
      });
    });
  }
  return out;
}

function _registrosCobrosConsultas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hCob = ss.getSheetByName(H_COBROS);
  var out = [];
  if (hCob && hCob.getLastRow() >= DATA_ROW) {
    hCob.getRange(DATA_ROW, 1, hCob.getLastRow() - DATA_ROW + 1, 8).getValues().forEach(function(r) {
      var fecha = r[1] instanceof Date ? r[1] : null;
      if (!r[0]) return;
      out.push({
        fechaTxt: fecha ? Utilities.formatDate(fecha, TZ_CONSULTAS, 'dd/MM/yyyy') : '',
        fechaOrden: fecha,
        entidad: String(r[3] || '').trim(), texto: 'Cobro — ' + String(r[7] || ''),
        meta: '', monto: Number(r[6]) || Number(r[4]) || 0
      });
    });
  }
  return out;
}

function _registrosPagosConsultas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hP = ss.getSheetByName(H_PAGOS_PR);
  var out = [];
  if (hP && hP.getLastRow() >= PAGOS_START) {
    hP.getRange(PAGOS_START, 1, hP.getLastRow() - PAGOS_START + 1, 5).getValues().forEach(function(r) {
      var fecha = r[1] instanceof Date ? r[1] : null;
      if (!r[0]) return;
      out.push({
        fechaTxt: fecha ? Utilities.formatDate(fecha, TZ_CONSULTAS, 'dd/MM/yyyy') : '',
        fechaOrden: fecha,
        entidad: String(r[2] || '').trim(), texto: 'Pago — ' + String(r[4] || ''),
        meta: '', monto: Number(r[3]) || 0
      });
    });
  }
  return out;
}

// Consulta unificada — reemplaza a getConsRegistros() del mockup con
// datos reales, ya filtrados y ordenados del lado del servidor.
function getConsultas(modulo, periodoDias, entidad, grupo, busqueda, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var MODULOS = { pedidos: _registrosPedidosConsultas_, gastos: _registrosGastosConsultas_, cobros: _registrosCobrosConsultas_, pagos: _registrosPagosConsultas_ };
  var fn = MODULOS[modulo];
  if (!fn) return { ok: false, mensaje: 'Módulo de consulta inválido: ' + modulo };

  periodoDias = Number(periodoDias) || 0;
  entidad = String(entidad || '').trim();
  grupo = (modulo === 'gastos') ? String(grupo || '').trim() : '';
  var q = String(busqueda || '').trim().toLowerCase();

  var regs = fn().filter(function(r) {
    if (periodoDias > 0 && _diasDesdeHoy_(r.fechaOrden) > periodoDias) return false;
    if (entidad && r.entidad !== entidad) return false;
    if (grupo && r.grupo !== grupo) return false;
    if (q && r.texto.toLowerCase().indexOf(q) === -1 && r.entidad.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });

  // Más reciente primero — igual que el mockup. Sin fecha válida, al final.
  regs.sort(function(a, b) {
    var da = a.fechaOrden instanceof Date ? a.fechaOrden.getTime() : -Infinity;
    var db = b.fechaOrden instanceof Date ? b.fechaOrden.getTime() : -Infinity;
    return db - da;
  });

  // La forma que espera el frontend (getConsRegistros() del mockup) no
  // incluye fechaOrden — es un dato interno solo para filtrar/ordenar acá.
  var registros = regs.map(function(r) {
    var out = { fecha: r.fechaTxt, entidad: r.entidad, texto: r.texto, meta: r.meta, monto: r.monto };
    if (modulo === 'gastos') out.grupo = r.grupo;
    return out;
  });

  var total = registros.reduce(function(s, r) { return s + r.monto; }, 0);
  return {
    ok: true, registros: registros,
    resumen: { movimientos: registros.length, total: total, promedio: registros.length ? total / registros.length : 0 }
  };
}
