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