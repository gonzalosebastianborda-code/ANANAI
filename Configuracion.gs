// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Configuracion.gs
// Constantes globales, CMV y taxonomía de gastos
// Compartido por todos los módulos del proyecto
// ═══════════════════════════════════════════════════════════════

// ── HOJAS ────────────────────────────────────────────────────────
var H_GASTOS    = 'Gastos';
var H_PAGOS_PR  = 'Pagos Proveedores';
var H_PROVEED   = 'Proveedores';
var H_CONFIG    = 'Configuración';
var GASTOS_START = 3;
var PAGOS_START  = 3;

// ── CAJAS (Tier 1) ───────────────────────────────────────────────
// Dos cajas operativas: la de la Distribuidora (empresa actual) y la de
// Añañai (empresa anterior, cuya caja se usa como soporte). Toda erogación
// o cobro se imputa a una caja para poder llevar el control por separado.
var CAJAS = ['Distribuidora', 'Añañai'];
// Saldo inicial de cada caja al arrancar el sistema. EDITAR con el saldo real.
var SALDO_INICIAL_CAJA = { 'Distribuidora': 0, 'Añañai': 0 };

function getCajas() { return CAJAS.slice(); }

// Opciones <option> para los dropdowns de caja (una sola fuente de verdad)
function cajaOptionsHTML(sel) {
  sel = sel || 'Distribuidora';
  return CAJAS.map(function(c) {
    return '<option' + (c === sel ? ' selected' : '') + '>' + c + '</option>';
  }).join('');
}

// Usuario que carga el registro (auditoría). Puede venir vacío fuera de Workspace.
function _usuarioActual() {
  try { var e = Session.getActiveUser().getEmail(); if (e) return e; } catch (_e) {}
  try { var e2 = Session.getEffectiveUser().getEmail(); if (e2) return e2; } catch (_e2) {}
  return '';
}

// Saldo por caja + neto intercompany. Entradas = cobros; salidas = gastos
// pagados + pagos a proveedores efectivamente debitados (cheque pendiente NO
// debita todavía). Útil para el semáforo de Caja del Flash Report y para
// medir cuánto se está financiando la Distribuidora con la caja de Añañai.
function getSaldosPorCaja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var res = {};
  CAJAS.forEach(function(c) {
    res[c] = { inicial: (SALDO_INICIAL_CAJA[c] || 0), entradas: 0, salidas: 0, saldo: 0 };
  });

  // Entradas: Cobros (col 5 = Monto Cobrado, col 12 = Caja)
  var hC = ss.getSheetByName(H_COBROS);
  if (hC && hC.getLastRow() >= DATA_ROW) {
    hC.getRange(DATA_ROW, 1, hC.getLastRow() - DATA_ROW + 1, 12).getValues().forEach(function(r) {
      if (!r[0]) return;
      var caja = String(r[11] || '').trim() || 'Distribuidora';
      if (res[caja]) res[caja].entradas += Number(r[4]) || 0;
    });
  }
  // Salidas: Gastos efectivamente pagados (col 7 = Monto, col 10 = Estado, col 12 = Caja)
  var hG = ss.getSheetByName(H_GASTOS);
  if (hG && hG.getLastRow() >= GASTOS_START) {
    hG.getRange(GASTOS_START, 1, hG.getLastRow() - GASTOS_START + 1, 12).getValues().forEach(function(r) {
      if (!r[0]) return;
      if (String(r[9] || '').toLowerCase().indexOf('pagado') === -1) return;
      var caja = String(r[11] || '').trim() || 'Distribuidora';
      if (res[caja]) res[caja].salidas += Number(r[6]) || 0;
    });
  }
  // Salidas: Pagos a proveedores debitados (col 4 = Monto, col 7 = Estado, col 10 = Caja)
  var hP = ss.getSheetByName(H_PAGOS_PR);
  if (hP && hP.getLastRow() >= PAGOS_START) {
    hP.getRange(PAGOS_START, 1, hP.getLastRow() - PAGOS_START + 1, 10).getValues().forEach(function(r) {
      if (!r[0]) return;
      if (String(r[6] || '').toLowerCase().indexOf('pagado') === -1) return; // cheque pendiente no debita
      var caja = String(r[9] || '').trim() || 'Distribuidora';
      if (res[caja]) res[caja].salidas += Number(r[3]) || 0;
    });
  }
  CAJAS.forEach(function(c) { res[c].saldo = res[c].inicial + res[c].entradas - res[c].salidas; });

  // Neto intercompany: lo que la Distribuidora le debe a Añañai =
  // (salidas pagadas desde caja Añañai) − (entradas cobradas hacia caja Añañai)
  var an = res['Añañai'] || { entradas: 0, salidas: 0 };
  res._intercompany = { distribuidora_debe_a_ananai: an.salidas - an.entradas };
  return res;
}

// ── TAXONOMÍA DE GASTOS ──────────────────────────────────────────
// Estructura: [Grupo, Subgrupo, Tipo (F=Fijo, V=Variable, C=CAPEX), Hint para el usuario]
var TAXONOMIA = [
  ['A. Materia Prima', 'A1. Proveedor consolidado',        'V', 'ej: Nutrilleti, El Jujeño, Cheek — pago el total sin desglosar'],
  ['A. Materia Prima', 'A2. Compra individual de insumo',  'V', 'ej: cebolla $13.000, aceite $9.500 — una descripción por ítem'],
  ['A. Materia Prima', 'A3. Insumos de producción',        'V', 'ej: resipack, stickers, bolsas de hielo, moldes descartables'],
  ['B. Logística',     'B1. Envíos y distribución',        'V', 'ej: Uber, flete, cadete — solo el monto'],
  ['C. Gastos Fijos',  'C1. Servicios y mantenimiento',    'F', 'ej: alarma, arreglo heladera, limpieza, internet, teléfono'],
  ['C. Gastos Fijos',  'C2. Mano de obra operativa',       'F', 'ej: personal de producción, ayudantes — NO usar Honorarios para esto'],
  ['C. Gastos Fijos',  'C3. Honorarios profesionales',     'F', 'ej: contaduría, asesoría externa, ingeniería — servicios profesionales'],
  ['D. CAPEX',         'D1. Equipamiento e infraestructura','C', '⚠ No afecta el resultado mensual — ej: máquinas, moldes, habilitaciones, reformas'],
];

// ── CMV POR PRODUCTO (Costo Variable Unitario) ───────────────────
// Formato: [nombre_en_despachos, variante_keyword_o_null, cvu, descripcion]
var CMV_CONFIG = [
  ['Pan Hamburguesa',  null,       332.90,  'Pan Hamburguesa'],
  ['Pan Ovalado',      null,       404.30,  'Pan Ovalado'],
  ['Pan Árabe',        null,       207.80,  'Pan Árabe'],
  ['Focaccias',        null,       425.40,  'Focaccias'],
  ['Bollos Pizza',     null,       810.40,  'Bollos Pizza'],
  ['Prepizzas',        null,       924.90,  'Prepizzas'],
  ['Pan de Molde',     null,      1850.00,  'Pan de Molde'],
  ['Tartines',         'bajo',    2791.00,  'Tartín bajo (Espinaca, Cebolla, Capresse)'],
  ['Tartines',         'alto',    3142.00,  'Tartín alto (JyQ, Verdura, Pollo, Atún)'],
  ['Pizzas',           'bajo',    2632.00,  'Pizza bajo'],
  ['Pizzas',           'alto',    3076.00,  'Pizza alto'],
  ['Chipalmendras (bolsa 500g)', null, 2108.00, 'Chipalmendras bolsa 500g'],
  ['Medialunas (unidades en docena)', null, 325.00, 'Medialuna por unidad (prorrateado de $1.300/pack4)'],
  ['pan',              null,       332.90,  'Pan (varios)'],
  ['bollos',           null,       810.40,  'Bollos'],
  ['prepizzas',        null,       924.90,  'Prepizzas'],
  ['focaccia',         null,       425.40,  'Focaccia'],
];

// ── FUNCIÓN: obtener CVU para un despacho dado ───────────────────
function getCVU(producto, variante) {
  var p = String(producto || '').trim().toLowerCase();
  var v = String(variante  || '').trim().toLowerCase();
  for (var i = 0; i < CMV_CONFIG.length; i++) {
    var cfg = CMV_CONFIG[i];
    var cfgProd = String(cfg[0]).trim().toLowerCase();
    var cfgVar  = cfg[1] ? String(cfg[1]).trim().toLowerCase() : null;
    if (p === cfgProd || p.indexOf(cfgProd) === 0 || cfgProd.indexOf(p) === 0) {
      if (!cfgVar) return cfg[2];          // no variante → match directo
      if (v && v.indexOf(cfgVar) > -1) return cfg[2];  // variante match
    }
  }
  return null;  // sin CVU configurado
}

// ── FUNCIÓN: actualizar CMV desde hoja Configuración ─────────────
function getCMVDesdeHoja() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_CONFIG);
  if (!hoja) return CMV_CONFIG;
  var last = hoja.getLastRow();
  if (last < 4) return CMV_CONFIG;
  var raw = hoja.getRange(4, 1, last - 3, 4).getValues();
  var result = [];
  raw.forEach(function(r) {
    if (r[0] && r[2]) result.push([String(r[0]), r[1]||null, Number(r[2]), String(r[3]||'')]);
  });
  return result.length ? result : CMV_CONFIG;
}

// ── PUENTE SKU → CVU (para "capital inmovilizado" en la pantalla de Stock) ──
// A propósito NO uso matching difuso (indexOf/substring) como getCVU() de
// arriba — ese tipo de matching fue justamente la causa del bug de
// Chipalmendras/Pan de Molde que corregimos en Despachos. Acá, mejor un SKU
// sin costo visible que un costo mal asignado sin que nadie lo note.
// Cada SKU mapea a [nombre, variante] tal como aparecen en CMV_CONFIG / la
// hoja "Configuración" — si cambian los valores ahí, este puente los toma
// solos, no hay que tocar código de nuevo.
// Los SKU que NO están acá (Fajitas, Canastitas, Raps, Croissant, Rolls de
// Canela, Disco de Empanadas, Mini Tartín, las 4 Pastas, Chipalmendras
// Vegano/Saludable, Pan de Molde con/sin Semilla, Medialunas, Galletitas,
// Creps, Cookies, los 3 Sandwiches) quedan sin costo a propósito — no hay
// match confiable hoy. Agregalos acá cuando definan el costo real (Pan de
// Molde con/sin Semilla y Medialunas quedaron afuera por duda real: no sabemos
// si el costo de la semilla difiere del común, y el CVU de Medialunas está
// expresado por unidad individual mientras que el Stock las cuenta de a 4
// — hay que resolver esa conversión antes de sumarlas al total).
var CVU_SKU_BRIDGE = {
  'PAN-001': ['Pan de Molde', null],
  'PAN-002': ['Pan Hamburguesa', null],
  'PAN-003': ['Pan Ovalado', null],
  'PAN-004': ['Pan Árabe', null],
  'PAN-005': ['Bollos Pizza', null],
  'PAN-006': ['Focaccias', null],
  'PAN-007': ['Prepizzas', null],
  'CHIP-001': ['Chipalmendras (bolsa 500g)', null],
  'TART-001': ['Tartines', 'alto'],
  'TART-002': ['Tartines', 'alto'],
  'TART-003': ['Tartines', 'bajo'],
  'TART-004': ['Tartines', 'alto'],
  'TART-005': ['Tartines', 'bajo'],
  'TART-006': ['Tartines', 'alto'],
  'TART-007': ['Tartines', 'bajo'],
  'PIZZ-001': ['Pizzas', 'alto'],
  'PIZZ-002': ['Pizzas', 'alto'],
  'PIZZ-003': ['Pizzas', 'bajo'],
  'PIZZ-004': ['Pizzas', 'bajo'],
  'PIZZ-005': ['Pizzas', 'bajo'],
  'PIZZ-006': ['Pizzas', 'bajo'],
  'PIZZ-007': ['Pizzas', 'bajo']
};

function getCVUPorSku_(sku) {
  var clave = CVU_SKU_BRIDGE[String(sku).trim()];
  if (!clave) return null;
  var nombreBuscado = _norm(clave[0]);
  var tierBuscado = clave[1] ? _norm(clave[1]) : null;
  var config = getCMVDesdeHoja();
  for (var i = 0; i < config.length; i++) {
    var fila = config[i];
    if (_norm(fila[0]) !== nombreBuscado) continue;
    var tierFila = fila[1] ? _norm(fila[1]) : null;
    if (tierBuscado === tierFila) return Number(fila[2]) || null;
  }
  return null;
}

// ── FUNCIÓN: leer lista de proveedores ───────────────────────────
function getProveedores() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_PROVEED);
  if (!hoja || hoja.getLastRow() < 3) return [];
  var raw = hoja.getRange(3, 1, hoja.getLastRow()-2, 4).getValues();
  return raw.filter(function(r){ return r[0] && r[1]; })
            .map(function(r){
              return { id: String(r[0]), nombre: String(r[1]),
                       condicion: String(r[2]||'Contado'), diasPago: Number(r[3])||0 };
            });
}

// ── FUNCIÓN: obtener CXP por proveedor (gastos en cta cte - pagos) ──
function getCXP() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var factu = {}, pagado = {};

  var hG = ss.getSheetByName(H_GASTOS);
  if (hG && hG.getLastRow() >= GASTOS_START) {
    var rawG = hG.getRange(GASTOS_START, 1, hG.getLastRow()-GASTOS_START+1, 11).getValues();
    rawG.forEach(function(r) {
      // col: 0=GAS-ID, 1=Fecha, 2=Grupo, 3=Subgrupo, 4=Descripcion,
      //      5=Proveedor, 6=Monto, 7=Condicion, 8=DiasPago, 9=EstadoPago, 10=Obs
      var prov = String(r[5]).trim();
      var mt   = Number(r[6]) || 0;
      var cond = String(r[7]).trim();
      if (prov && mt > 0 && cond === 'Cuenta corriente') {
        factu[prov] = (factu[prov] || 0) + mt;
      }
    });
  }

  var hP = ss.getSheetByName(H_PAGOS_PR);
  if (hP && hP.getLastRow() >= PAGOS_START) {
    var rawP = hP.getRange(PAGOS_START, 1, hP.getLastRow()-PAGOS_START+1, 9).getValues();
    rawP.forEach(function(r) {
      // col: 0=PAG-ID, 1=Fecha, 2=Proveedor, 3=Monto, 4=FormaPago,
      //      5=FechaVenc, 6=EstadoCheque, 7=GAS-IDs, 8=Obs
      var prov = String(r[2]).trim();
      var mt   = Number(r[3]) || 0;
      var est  = String(r[6]).trim();
      // Cuenta como pagado solo si está debitado/pagado, no si cheque pendiente
      if (prov && mt > 0 && est !== 'Cheque emitido — pendiente débito') {
        pagado[prov] = (pagado[prov] || 0) + mt;
      }
    });
  }

  var cxp = {};
  Object.keys(factu).forEach(function(p) {
    var saldo = (factu[p] || 0) - (pagado[p] || 0);
    if (saldo > 1) cxp[p] = Math.round(saldo);
  });
  return cxp;
}

// ── FUNCIÓN: datos de gastos para el dashboard ───────────────────
function getDatosGastosParaDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hG = ss.getSheetByName(H_GASTOS);
  var TZ = 'America/Argentina/Buenos_Aires';
  var gastos = [];

  if (hG && hG.getLastRow() >= GASTOS_START) {
    var rawG = hG.getRange(GASTOS_START, 1, hG.getLastRow()-GASTOS_START+1, 11).getValues();
    rawG.forEach(function(r) {
      var fecha = r[1] instanceof Date ? r[1] : null;
      var mt    = Number(r[6]) || 0;
      if (!fecha || !mt) return;
      var grupo   = String(r[2]).trim();
      var tipo    = grupo.charAt(0); // 'A','B','C','D'
      gastos.push({
        id:      String(r[0]).trim(),
        f:       fecha ? Utilities.formatDate(fecha, TZ, 'yyyy-MM-dd') : '',
        m:       fecha ? Utilities.formatDate(fecha, TZ, 'yyyy-MM') : '',
        sem:     fecha ? _semLabel(fecha, TZ) : '',
        grupo:   grupo,
        sub:     String(r[3]).trim(),
        desc:    String(r[4]).trim(),
        prov:    String(r[5]).trim(),
        mt:      mt,
        cond:    String(r[7]).trim(),
        estado:  String(r[9]).trim(),
        tipo:    tipo,   // A=variable, B=variable, C=fijo, D=capex
        isVar:   tipo === 'A' || tipo === 'B',
        isFijo:  tipo === 'C',
        isCapex: tipo === 'D',
      });
    });
  }

  // CMV config for dashboard
  var cmv = CMV_CONFIG.map(function(c){
    return { prod: c[0], var: c[1], cvu: c[2], desc: c[3] };
  });

  return { gastos: gastos, cmv: cmv };
}

// ════════════════════════════════════════════════════════════════
// PIN DE CORRECCIONES — protege "Deshacer movimiento" y "Auditoría
// semanal" en la pantalla de Stock (solo CFOs externos). No es una
// autenticación real (la webapp es de acceso anónimo) — es un candado
// simple para que nadie entre ahí por error. El PIN se guarda como
// Script Property, nunca queda escrito en el código ni visible en el
// HTML que le llega al navegador.
// ════════════════════════════════════════════════════════════════
function _verificarPin_(pin) {
  var real = PropertiesService.getScriptProperties().getProperty('PIN_CORRECCIONES');
  if (!real) return false; // sin PIN configurado, no entra nadie — más seguro por defecto
  return String(pin || '').trim() === real;
}

// Wrapper público: lo llama Stock.html para validar el PIN apenas se
// tipea, antes de mostrar Correcciones/Auditoría semanal. La protección
// real igual está en cada función sensible (_verificarPin_ se vuelve a
// chequear ahí) — esto es solo para la respuesta rápida en pantalla.
function verificarPinCorrecciones(pin) {
  return { ok: _verificarPin_(pin) };
}

function configurarPinCorrecciones_() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(
    'PIN de Correcciones',
    'Ingresá el PIN para "Deshacer movimiento" y "Auditoría semanal" en la pantalla de Stock.\nDejalo en blanco para desactivar el acceso a esas dos secciones.',
    ui.ButtonSet.OK_CANCEL
  );
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var pin = r.getResponseText().trim();
  PropertiesService.getScriptProperties().setProperty('PIN_CORRECCIONES', pin);
  ui.alert(pin ? '✅ PIN actualizado.' : '🔒 PIN desactivado — nadie va a poder deshacer movimientos ni cargar ajustes hasta que configures uno nuevo.');
}

// Cambiar el PIN desde el panel de Configuración del Dashboard (sin pasar
// por el menú de Sheets). Pide el PIN actual para poder cambiarlo — evita
// que alguien que encuentre la pantalla sin querer lo pueda tocar.
function cambiarPinCorrecciones(pinActual, pinNuevo) {
  if (!_verificarPin_(pinActual)) return { ok: false, mensaje: 'PIN actual incorrecto.' };
  PropertiesService.getScriptProperties().setProperty('PIN_CORRECCIONES', String(pinNuevo || '').trim());
  return { ok: true, mensaje: pinNuevo ? '✅ PIN actualizado.' : '🔒 PIN desactivado.' };
}

// ════════════════════════════════════════════════════════════════
// METAS DE PRODUCCIÓN SEMANAL — reemplaza el placeholder fijo
// (META_SEMANAL_FICTICIA) por un valor real y editable por SKU.
// Vive en su propia hoja para no mezclar con el Catálogo. Cacheada
// dentro de una misma ejecución para no releer la hoja por cada SKU.
// ════════════════════════════════════════════════════════════════
var H_METAS_PRODUCCION = 'Metas Producción';
var ENCABEZADOS_METAS_PRODUCCION = ['SKU', 'Producto', 'Meta semanal'];
var _metasProduccionCache_ = null;

function ensureHojaMetasProduccion_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_METAS_PRODUCCION);
  if (!ws) {
    ws = ss.insertSheet(H_METAS_PRODUCCION);
    ws.getRange('A1').setValue('AÑAÑAI · Metas de producción semanal — se edita desde Configuración en el Dashboard, no hace falta tocar esta hoja a mano');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_METAS_PRODUCCION.length), '#2F6B4F');
    ws.getRange(2, 1, 1, ENCABEZADOS_METAS_PRODUCCION.length).setValues([ENCABEZADOS_METAS_PRODUCCION]);
    ws.setFrozenRows(2);
  }
  return ws;
}

function obtenerMetaSemanal_(sku) {
  if (_metasProduccionCache_ === null) {
    _metasProduccionCache_ = {};
    var ws = ensureHojaMetasProduccion_();
    var last = ws.getLastRow();
    if (last >= DATA_ROW) {
      ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 3).getValues().forEach(function(r) {
        if (r[0]) _metasProduccionCache_[String(r[0]).trim()] = Number(r[2]) || 0;
      });
    }
  }
  return _metasProduccionCache_[sku] || null;
}

function getMetasProduccion(pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  var wsCat = ensureHojaCatalogo_();
  var lastCat = wsCat.getLastRow();
  var catalogo = lastCat >= DATA_ROW ? wsCat.getRange(DATA_ROW, 1, lastCat - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues() : [];
  _metasProduccionCache_ = null; // fuerzo relectura por si cambió desde la última carga
  var items = [];
  catalogo.forEach(function(r) {
    if (r[3] !== 'Terminado') return;
    items.push({ sku: r[0], nombre: r[1], meta: obtenerMetaSemanal_(r[0]) || 0 });
  });
  return { ok: true, items: items };
}

function guardarMetasProduccion(items, pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  var ws = ensureHojaMetasProduccion_();
  var last = ws.getLastRow();
  if (last >= DATA_ROW) ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 3).clearContent();
  var filas = (items || []).map(function(it) { return [it.sku, it.nombre, Number(it.meta) || 0]; });
  if (filas.length) ws.getRange(DATA_ROW, 1, filas.length, 3).setValues(filas);
  _metasProduccionCache_ = null;
  return { ok: true, mensaje: filas.length + ' meta(s) guardada(s).' };
}

// ── CARGA INICIAL — semana del 24 al 28/08/2026, pasada por el CFO ──
// Correr UNA SOLA VEZ desde el editor (elegí esta función en el desplegable
// de arriba y apretá ▷ Ejecutar). Después de esto, todo el ajuste futuro se
// hace desde Configuración → Metas de producción semanal en el Dashboard,
// nunca más hace falta tocar código ni hojas para esto.
// Tartines y Pizzas: el total de la lista se repartió en partes iguales
// entre sus 7 sabores (no había otro criterio de reparto indicado).
// Chipas Vegano/Saludable: 20 kg = 40 bolsas de 500g cada una (confirmado).
// Pan de Molde: los 300 van enteros a PAN-001 (Común) — es el único que
// se sigue usando en los formularios, con/sin Semilla quedaron unificados.
function seedMetasProduccionInicial() {
  var metasIniciales = {
    'TART-001': 36, 'TART-002': 36, 'TART-003': 36, 'TART-004': 36, 'TART-005': 36, 'TART-006': 35, 'TART-007': 35, // Tartines: 250 ÷ 7
    'PIZZ-001': 15, 'PIZZ-002': 15, 'PIZZ-003': 14, 'PIZZ-004': 14, 'PIZZ-005': 14, 'PIZZ-006': 14, 'PIZZ-007': 14, // Pizzas: 100 ÷ 7
    'PAN-002': 120, // Panes de hamburguesa
    'PAN-003': 120, // Panes ovalados
    'PAN-004': 48,  // Panes árabes
    'PAN-001': 300, // Panes de molde (todo a Común)
    'PAN-008': 480, // Fajitas
    'PAN-007': 120, // Prepizzas
    'PAN-005': 150, // Bollos de pizza
    'PAN-006': 25,  // Focaccia
    'FAC-001': 100, // Medialunas (docenas/bolsas, mismo criterio que el sistema)
    'CHIP-002': 40, // Chipas Vegano — 20 kg = 40 bolsas
    'CHIP-003': 40  // Chipa Saludable — 20 kg = 40 bolsas
  };

  var wsCat = ensureHojaCatalogo_();
  var lastCat = wsCat.getLastRow();
  var catalogo = wsCat.getRange(DATA_ROW, 1, lastCat - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues();

  var items = [];
  catalogo.forEach(function(r) {
    var sku = String(r[0] || '').trim(), tipo = r[3];
    if (tipo !== 'Terminado') return;
    if (SKU_OCULTOS_EN_FORMULARIOS.indexOf(sku) > -1) return; // Pan de Molde con/sin Semilla, no aplica
    items.push({ sku: sku, nombre: r[1], meta: metasIniciales[sku] || 0 });
  });

  var ws = ensureHojaMetasProduccion_();
  var last = ws.getLastRow();
  if (last >= DATA_ROW) ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 3).clearContent();
  var filas = items.map(function(it) { return [it.sku, it.nombre, it.meta]; });
  ws.getRange(DATA_ROW, 1, filas.length, 3).setValues(filas);
  _metasProduccionCache_ = null;

  Logger.log('Cargadas ' + filas.length + ' metas — ' + Object.keys(metasIniciales).length + ' con valor real, el resto en 0 (no vino en la lista).');
}

// ── CARGA INICIAL DE LA GRILLA DIARIA — semana del 22/08 (sáb) al 28/08
// (vie) al 2026, tal como la armó el operario. Correr UNA SOLA VEZ desde
// el editor, igual que seedMetasProduccionInicial.
// Índice de días en cada array: [Sáb, Dom, Lun, Mar, Mié, Jue, Vie].
// Quedaron afuera a propósito:
//  - Tartines (martes y miércoles): el plan solo decía "armar 3 sabores",
//    sin cantidad total — no hay número que cargar.
//  - Masa para Medialuna (INSU-001) y Laminado (INSU-005): son insumos,
//    no productos terminados — el sistema de metas/plan hoy es solo para
//    terminados, no se cargan.
//  - Pizzas del viernes (100 u., sin desglose por sabor): se repartieron
//    en partes iguales entre los 7 sabores, mismo criterio que ya usamos
//    para la meta semanal (15,15,14,14,14,14,14).
//  - Chipas Vegano/Saludable (20 kg cada una, jueves): convertidas a
//    bolsas con el mismo criterio ya confirmado (20 kg = 40 bolsas).
function seedPlanSemanalInicial() {
  var SEMANA = '22/08';
  // [Sáb, Dom, Lun, Mar, Mié, Jue, Vie]
  var planInicial = {
    'PAN-001': [0, 0, 61, 61, 61, 61, 61],   // Pan de Molde — todos los días
    'PAN-002': [0, 0, 38, 38, 38, 38, 38],   // Pan Hamburguesa — todos los días
    'PAN-003': [0, 0, 22, 22, 22, 22, 22],   // Pan Ovalado — todos los días
    'PAN-004': [0, 0, 0, 48, 0, 0, 0],       // Pan Árabe — solo martes
    'PAN-005': [0, 0, 0, 36, 36, 36, 36],    // Bollo — martes a viernes
    'PAN-006': [0, 0, 0, 25, 0, 0, 0],       // Focaccia — solo martes
    'PAN-007': [0, 0, 226, 0, 0, 0, 0],      // Prepizza — solo lunes
    'PAN-008': [0, 0, 0, 0, 480, 0, 0],      // Fajitas — solo miércoles
    'PAN-009': [0, 0, 250, 0, 0, 0, 0],      // Canastitas — solo lunes
    'CHIP-002': [0, 0, 0, 0, 0, 40, 0],      // Chipalmendras Vegano — jueves, 20kg→40 bolsas
    'CHIP-003': [0, 0, 0, 0, 0, 40, 0],      // Chipa Saludable — jueves, 20kg→40 bolsas
    'PIZZ-001': [0, 0, 0, 0, 0, 0, 15],      // Pizzas viernes ÷7 sabores
    'PIZZ-002': [0, 0, 0, 0, 0, 0, 15],
    'PIZZ-003': [0, 0, 0, 0, 0, 0, 14],
    'PIZZ-004': [0, 0, 0, 0, 0, 0, 14],
    'PIZZ-005': [0, 0, 0, 0, 0, 0, 14],
    'PIZZ-006': [0, 0, 0, 0, 0, 0, 14],
    'PIZZ-007': [0, 0, 0, 0, 0, 0, 14]
  };

  var wsCat = ensureHojaCatalogo_();
  var lastCat = wsCat.getLastRow();
  var catalogo = wsCat.getRange(DATA_ROW, 1, lastCat - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues();

  var filas = [];
  catalogo.forEach(function(r) {
    var sku = String(r[0] || '').trim(), tipo = r[3];
    if (tipo !== 'Terminado') return;
    if (SKU_OCULTOS_EN_FORMULARIOS.indexOf(sku) > -1) return;
    var d = planInicial[sku] || [0, 0, 0, 0, 0, 0, 0];
    filas.push([SEMANA, sku, r[1], d[0], d[1], d[2], d[3], d[4], d[5], d[6]]);
  });

  var ws = ensureHojaPlanSemanal_();
  var last = ws.getLastRow();
  if (last >= DATA_ROW) {
    var actuales = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_PLAN_SEMANAL.length).getValues();
    var conservar = actuales.filter(function(r) { return String(r[0]).trim() !== SEMANA && r[0]; });
    ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_PLAN_SEMANAL.length).clearContent();
    if (conservar.length) ws.getRange(DATA_ROW, 1, conservar.length, ENCABEZADOS_PLAN_SEMANAL.length).setValues(conservar);
    last = DATA_ROW + conservar.length - 1;
  }
  var filaLibre = Math.max(DATA_ROW, last + 1);
  ws.getRange(filaLibre, 1, filas.length, ENCABEZADOS_PLAN_SEMANAL.length).setValues(filas);

  Logger.log('Cargada la distribución diaria de la semana ' + SEMANA + ' — ' + Object.keys(planInicial).length + ' productos con plan real, el resto sin planificar esta semana.');
}

// ════════════════════════════════════════════════════════════════
// DISTRIBUCIÓN DIARIA (grilla semanal) — el CFO reparte la meta de
// cada producto en los 7 días de la semana (sáb→vie, mismo criterio
// que el resto del sistema). Se guarda una fila por SKU por semana.
// ════════════════════════════════════════════════════════════════
var H_PLAN_SEMANAL = 'Plan Semanal';
var ENCABEZADOS_PLAN_SEMANAL = ['Semana', 'SKU', 'Producto', 'Sáb', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

function ensureHojaPlanSemanal_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_PLAN_SEMANAL);
  if (!ws) {
    ws = ss.insertSheet(H_PLAN_SEMANAL);
    ws.getRange('A1').setValue('AÑAÑAI · Distribución diaria de la meta semanal — se edita desde Configuración en el Dashboard');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_PLAN_SEMANAL.length), '#2F6B4F');
    ws.getRange(2, 1, 1, ENCABEZADOS_PLAN_SEMANAL.length).setValues([ENCABEZADOS_PLAN_SEMANAL]);
    ws.setFrozenRows(2);
  }
  return ws;
}

// Sábado de la semana de "hoy", en formato dd/MM — mismo criterio que
// _semLabel() en Código.gs (Despachos/Gastos) y semDeFecha() en Dashboard.
function _semanaActualPlan_() {
  var TZ = 'America/Argentina/Buenos_Aires';
  var d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return Utilities.formatDate(d, TZ, 'dd/MM');
}

function getPlanSemanal(semana, pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  semana = semana || _semanaActualPlan_();
  var wsCat = ensureHojaCatalogo_();
  var lastCat = wsCat.getLastRow();
  var catalogo = lastCat >= DATA_ROW ? wsCat.getRange(DATA_ROW, 1, lastCat - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues() : [];
  var terminados = catalogo.filter(function(r) { return r[3] === 'Terminado'; });

  var ws = ensureHojaPlanSemanal_();
  var last = ws.getLastRow();
  var existentes = {};
  if (last >= DATA_ROW) {
    ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_PLAN_SEMANAL.length).getValues().forEach(function(r) {
      if (String(r[0]).trim() === semana && r[1]) existentes[String(r[1]).trim()] = r;
    });
  }
  _metasProduccionCache_ = null;
  var items = terminados.map(function(r) {
    var sku = r[0];
    var fila = existentes[sku];
    return {
      sku: sku, nombre: r[1],
      metaSemanal: obtenerMetaSemanal_(sku) || 0,
      dias: fila ? [fila[3], fila[4], fila[5], fila[6], fila[7], fila[8], fila[9]].map(function(v) { return Number(v) || 0; }) : [0, 0, 0, 0, 0, 0, 0]
    };
  });
  return { ok: true, semana: semana, items: items };
}

function guardarPlanSemanal(semana, items, pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  if (!semana) return { ok: false, mensaje: 'Falta indicar la semana.' };
  var ws = ensureHojaPlanSemanal_();
  var last = ws.getLastRow();
  // Borro solo las filas de ESA semana (no toco otras semanas ya cargadas)
  if (last >= DATA_ROW) {
    var actuales = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_PLAN_SEMANAL.length).getValues();
    var conservar = actuales.filter(function(r) { return String(r[0]).trim() !== semana && r[0]; });
    ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_PLAN_SEMANAL.length).clearContent();
    if (conservar.length) ws.getRange(DATA_ROW, 1, conservar.length, ENCABEZADOS_PLAN_SEMANAL.length).setValues(conservar);
    last = DATA_ROW + conservar.length - 1;
  }
  var filaLibre = Math.max(DATA_ROW, last + 1);
  var nuevas = (items || []).map(function(it) {
    var d = it.dias || [0, 0, 0, 0, 0, 0, 0];
    return [semana, it.sku, it.nombre, d[0] || 0, d[1] || 0, d[2] || 0, d[3] || 0, d[4] || 0, d[5] || 0, d[6] || 0];
  });
  if (nuevas.length) ws.getRange(filaLibre, 1, nuevas.length, ENCABEZADOS_PLAN_SEMANAL.length).setValues(nuevas);
  return { ok: true, mensaje: nuevas.length + ' producto(s) planificado(s) para la semana del ' + semana + '.' };
}

// ════════════════════════════════════════════════════════════════
// CVU (Costo Variable Unitario) — editor HTML sobre la hoja
// "Configuración" que ya usa getCMVDesdeHoja(). No cambia el formato
// de esa hoja, solo evita tener que tocarla a mano.
// ════════════════════════════════════════════════════════════════
function getCVUConfig(pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  return {
    ok: true,
    items: getCMVDesdeHoja().map(function(c) { return { nombre: c[0], variante: c[1] || '', cvu: c[2], desc: c[3] || '' }; })
  };
}

function guardarCVUConfig(items, pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_CONFIG);
  if (!hoja) {
    hoja = ss.insertSheet(H_CONFIG);
    hoja.getRange('A1').setValue('AÑAÑAI · Configuración de CVU (Costo Variable Unitario) — se edita desde el Dashboard');
    hoja.getRange(3, 1, 1, 4).setValues([['Producto', 'Variante', 'CVU', 'Descripción']]);
    hoja.setFrozenRows(3);
  }
  var last = hoja.getLastRow();
  if (last >= 4) hoja.getRange(4, 1, last - 3, 4).clearContent();
  var filas = (items || []).map(function(it) { return [it.nombre, it.variante || '', Number(it.cvu) || 0, it.desc || '']; });
  if (filas.length) hoja.getRange(4, 1, filas.length, 4).setValues(filas);
  return { ok: true, mensaje: filas.length + ' línea(s) de CVU guardada(s).' };
}