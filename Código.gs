//Codigo.gs
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Módulo Ventas & Cobros
// Apps Script — Setup + Formularios + Lógica de negocio
// ---------------------------------------------------------------
// INSTALACIÓN:
//   1. Crear un Google Sheet nuevo llamado "AÑAÑAI - Ventas & Cobros"
//   2. Extensions → Apps Script → pegar este código completo
//   3. Guardar → ejecutar inicializar() UNA SOLA VEZ
//   4. Recargar la planilla → aparece menú 🛒 AÑAÑAI Ventas
// ═══════════════════════════════════════════════════════════════

// ── CONSTANTES ──────────────────────────────────────────────────
var H_CLIENTES  = 'Clientes';
var H_PRODUCTOS = 'Productos';
var H_DESPACHOS = 'Despachos';
var H_COBROS    = 'Cobros';
var H_NC        = 'Notas de Crédito';
var DATA_ROW    = 3;  // primera fila de datos en todas las hojas

// ── PRECIO: siempre P1. UMBRAL solo para alerta informativa ──
var UMBRAL_P1   = 400;  // solo para detección, no cambia el precio aplicado

// ── PRECIOS ESPECIALES AÑAÑAI (sucursal interna) ─────────────────
// Claves = nombre del producto en el maestro. El match es normalizado
// (ignora mayúsculas/acentos/espacios), así que renombres menores no rompen.
var ANANAI_PRECIOS = {
  'Pan Hamburguesa': 433,
  'Pan Ovalado':     526,
  'Pan Árabe':       270,
  'Focaccias':       553,
  'Bollos Pizza':   1054,
  'Prepizzas':      1202,
  'Pan de Molde':   2960,
};

// ── SABORES por producto con tier oculto (Tartines / Pizzas) ──────
// El usuario ve el sabor; el sistema lee el tier (Alto/Bajo) para el
// precio. Tiers deducidos del histórico real. tierPrecio es fallback
// si la hoja no tuviera la fila. GLOBAL: la usan tanto
// buildFormDespachoHTML() (Despacho manual) como getCatalogoParaPedidos()
// (formulario de Pedidos) — una sola fuente de verdad para sabores y
// tiers, así no se desincronizan entre los dos formularios.
var FLAVORS = {
  'Tartines': { tierPrecio: {'Altos':6300, 'Bajos':5600}, sabores: [
    {sabor:'Jamón y Queso',        tier:'Altos', variante:'Tartin — Jamón y Queso'},
    {sabor:'Pollo',                tier:'Altos', variante:'Tartin — Pollo'},
    {sabor:'Atún',                 tier:'Altos', variante:'Tartin — Atún'},
    {sabor:'Verduras y Roquefort', tier:'Altos', variante:'Tartin — Verduras y Roquefort'},
    {sabor:'Capresse',             tier:'Bajos', variante:'Tartin — Capresse'},
    {sabor:'Espinaca',             tier:'Bajos', variante:'Tartin — Espinaca'},
    {sabor:'Cebolla y Queso',      tier:'Bajos', variante:'Tartin — Cebolla y Queso'}
  ]},
  'Pizzas': { tierPrecio: {'Alto':8500, 'Bajo':8000}, sabores: [
    {sabor:'Especial',       tier:'Alto', variante:'Pizza — Especial'},
    {sabor:'Cuatro Poderes', tier:'Alto', variante:'Pizza — Cuatro Poderes'},
    {sabor:'Pesto',          tier:'Bajo', variante:'Pizza — Pesto'},
    {sabor:'Napoleón',       tier:'Bajo', variante:'Pizza — Napoleón'},
    {sabor:'Jota',           tier:'Bajo', variante:'Pizza — Jota'},
    {sabor:'Fugazza',        tier:'Bajo', variante:'Pizza — Fugazza'},
    {sabor:'Capresse',       tier:'Bajo', variante:'Pizza — Capresse'}
  ]},
  // ── Sin tier: mismo precio para cualquier variante, pero cada una es
  // un SKU de Stock distinto — antes el dropdown mandaba el nombre
  // genérico y siempre descontaba del primer SKU (ej. Chipalmendras
  // Común) sin importar cuál se vendió en realidad.
  'Chipalmendras': { sabores: [
    {sabor:'Común',           variante:'Común'},
    {sabor:'Vegano',          variante:'Vegano'},
    {sabor:'Chipa Saludable', variante:'Chipa Saludable'}
  ]},
  // Pan de Molde: unificado a un solo producto (PAN-001) — con/sin Semilla
  // quedaron en el Catálogo (por si hacen falta después) pero ya no se
  // ofrecen acá, confundían al operario. Por eso NO tiene entrada en
  // FLAVORS: al no tener variantes configuradas, el desplegable no
  // pregunta sabor y el despacho resuelve directo a PAN-001 vía Alias.
  'Fideos': { sabores: [
    {sabor:'Fettuccine',               variante:'Fettuccine'},
    {sabor:'Sorrentinos',              variante:'Sorrentinos'},
    {sabor:'Sorrentino Jamón y Queso', variante:'Sorrentino Jamón y Queso'},
    {sabor:'Sorrentino Calabaza',      variante:'Sorrentino Calabaza'}
  ]}
};

// ── MAESTRO DE PRODUCTOS ────────────────────────────────────────
var PRODUCTOS_DATA = [
  // [Nombre, Variante, Unidad, PLibre, P1]
  ['Chipalmendras',   '',       'Bolsa 500g', 5460,   5200],
  ['Tartines',        'Altos',  'Unidad',     6615,   6300],
  ['Tartines',        'Bajos',  'Unidad',     5880,   5600],
  ['Pizzas',          'Alto',   'Unidad',     8925,   8500],
  ['Pizzas',          'Bajo',   'Unidad',     8400,   8000],
  ['Medialunas',      '',       'Unidad',     5460,   5200],
  ['Pan de Molde',    '',       'Unidad',     7140,   6800],
  ['Pan Hamburguesa', '',       'Unidad',     570,    543],
  ['Pan Ovalado',     '',       'Unidad',     680,    648],
  ['Pan Árabe',       '',       'Unidad',     350,    333],
  ['Focaccias',       '',       'Unidad',     720,    686],
  ['Bollos Pizza',    '',       'Unidad',     1380,   1314],
  ['Prepizzas',       '',       'Unidad',     1570,   1495],
  ['Fajitas',         '',       'Unidad',     null,   null],
  ['Creps',           '',       'Unidad',     null,   null],
  ['Mini Tartín',     '',       'Unidad',     null,   null],
  ['Canastitas',      '',       'Unidad',     null,   null],
  ['Fideos',          '',       'Unidad',     null,   null],
  ['Disco Empanadas', '',       'Unidad',     null,   null],
  ['Raps',            '',       'Unidad',     null,   null],
  ['Laminado',        '',       'Unidad',     null,   null],
  ['Galletitas',      '',       'Unidad',     null,   null],
];

// ── MAESTRO DE CLIENTES ─────────────────────────────────────────
var CLIENTES_DATA = [
  // [CLI-ID, Nombre, Condición default, Días crédito]
  ['CLI-001', 'Añañai',               'Crédito', 30],
  ['CLI-002', 'Distribuidora',         'Crédito', 15],
  ['CLI-003', 'La Esperanza',          'Crédito', 30],
  ['CLI-004', 'Exhibidora Marconi',    'Crédito', 30],
  ['CLI-005', 'Exhibidora Pacentini',  'Crédito', 30],
  ['CLI-006', 'Nutrilleti',            'Contado', 0],
  ['CLI-007', 'Benja Peker',           'Contado', 0],
  ['CLI-008', 'Marcela Blanco',        'Contado', 0],
  ['CLI-009', 'Llevo Carlos Losch',    'Contado', 0],
  ['CLI-010', 'Parque',                'Contado', 0],
  ['CLI-011', 'Dietética Liniers',     'Contado', 0],
  ['CLI-012', 'Gena',                  'Contado', 0],
  ['CLI-013', 'Amauta',                'Crédito', 15],
  ['CLI-014', 'Ayelen Ginesta',        'Contado', 0],
  ['CLI-015', 'Supermercado El Apú',   'Crédito', 15],
  ['CLI-016', 'Zona Cero Don Bosco',   'Contado', 0],
  ['CLI-017', 'Evento',                'Contado', 0],
];

// ════════════════════════════════════════════════════════════════
// INICIALIZACIÓN — ejecutar UNA SOLA VEZ
// ════════════════════════════════════════════════════════════════
function inicializar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  if (ss.getSheetByName(H_DESPACHOS)) {
    if (ui.alert('¿Reinicializar?', 'Las hojas ya existen. ¿Querés recrearlas? Se perderán los datos.',
        ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    [H_CLIENTES, H_PRODUCTOS, H_DESPACHOS, H_COBROS, H_NC].forEach(function(n) {
      var h = ss.getSheetByName(n);
      if (h) ss.deleteSheet(h);
    });
  }

  crearHojaClientes(ss);
  crearHojaProductos(ss);
  crearHojaDespachos(ss);
  crearHojaCobros(ss);
  crearHojaNC(ss);

  // Ocultar hojas maestro
  ss.getSheetByName(H_CLIENTES).hideSheet();
  ss.getSheetByName(H_PRODUCTOS).hideSheet();

  ui.alert('✅ Módulo iniciado', 'Hojas creadas correctamente.\n\nUsá el menú 🛒 AÑAÑAI Ventas para cargar despachos y cobros.', ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════════
// CREAR HOJAS
// ════════════════════════════════════════════════════════════════
function estiloHeader(rng, color) {
  rng.setBackground(color || '#2F5496')
     .setFontColor('#FFFFFF')
     .setFontWeight('bold')
     .setHorizontalAlignment('center')
     .setWrap(true);
}

function crearHojaClientes(ss) {
  var ws = ss.insertSheet(H_CLIENTES);
  ws.getRange('A1').setValue('AÑAÑAI · Maestro de Clientes — no editar directamente, usar menú');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['CLI-ID', 'Nombre', 'Condición default', 'Días crédito', 'Activo'];
  estiloHeader(ws.getRange(2, 1, 1, hdrs.length));
  ws.getRange(2, 1, 1, hdrs.length).setValues([hdrs]);
  ws.setRowHeight(2, 30);

  CLIENTES_DATA.forEach(function(r, i) {
    ws.getRange(DATA_ROW + i, 1, 1, 5).setValues([[r[0], r[1], r[2], r[3], 'Sí']]);
  });

  ws.setColumnWidth(1, 90);
  ws.setColumnWidth(2, 220);
  ws.setColumnWidth(3, 130);
  ws.setColumnWidth(4, 100);
  ws.setColumnWidth(5, 70);
  ws.setFrozenRows(2);
}

function crearHojaProductos(ss) {
  var ws = ss.insertSheet(H_PRODUCTOS);
  ws.getRange('A1').setValue('AÑAÑAI · Maestro de Productos y Precios — no editar directamente');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['Producto', 'Variante', 'Unidad', 'Precio Libre ($)', 'Precio P1 ($)', 'Tiene precio'];
  estiloHeader(ws.getRange(2, 1, 1, hdrs.length), '#1F3864');
  ws.getRange(2, 1, 1, hdrs.length).setValues([hdrs]);
  ws.setRowHeight(2, 30);

  PRODUCTOS_DATA.forEach(function(r, i) {
    var tienePrecio = r[3] !== null ? 'Sí' : 'No — pendiente';
    ws.getRange(DATA_ROW + i, 1, 1, 6).setValues([[r[0], r[1], r[2], r[3] || '', r[4] || '', tienePrecio]]);
    if (r[3] === null) {
      ws.getRange(DATA_ROW + i, 6).setFontColor('#cc0000');
    }
  });

  [1,2,3,4,5,6].forEach(function(c, i) {
    ws.setColumnWidth(c, [180, 100, 100, 120, 100, 120][i]);
  });
  ws.setFrozenRows(2);
}

function crearHojaDespachos(ss) {
  var ws = ss.insertSheet(H_DESPACHOS);
  ws.getRange('A1').setValue('AÑAÑAI · Registro de Despachos — completar con el formulario del menú 🛒');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['DES-ID','Fecha','CLI-ID','Cliente','Producto','Variante','Unidad','Unidades',
              'Precio Unit ($)','Precio aplicado','Monto Total ($)','Condición','Estado','Obs',
              'Fecha carga','Usuario carga'];
  estiloHeader(ws.getRange(2, 1, 1, hdrs.length));
  ws.getRange(2, 1, 1, hdrs.length).setValues([hdrs]);
  ws.setRowHeight(2, 34);

  var widths = [90,100,80,180,160,100,90,80,110,110,120,90,110,200,140,170];
  widths.forEach(function(w, i) { ws.setColumnWidth(i+1, w); });
  ws.setFrozenRows(2);
  ws.setFrozenColumns(2);
}

function crearHojaCobros(ss) {
  var ws = ss.insertSheet(H_COBROS);
  ws.getRange('A1').setValue('AÑAÑAI · Registro de Cobros — completar con el formulario del menú 🛒');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['COB-ID','Fecha','CLI-ID','Cliente','Monto Cobrado ($)','Descuento Pronto Pago ($)',
              'Monto Neto Aplicado ($)','Forma de Pago','Referencia','DES-IDs cubiertos','Obs',
              'Caja','Fecha carga','Usuario carga'];
  estiloHeader(ws.getRange(2, 1, 1, hdrs.length), '#1F3864');
  ws.getRange(2, 1, 1, hdrs.length).setValues([hdrs]);
  ws.setRowHeight(2, 34);

  var widths = [90,100,80,180,130,150,150,120,160,200,200,120,140,170];
  widths.forEach(function(w, i) { ws.setColumnWidth(i+1, w); });
  ws.setFrozenRows(2);
}

function crearHojaNC(ss) {
  var ws = ss.insertSheet(H_NC);
  ws.getRange('A1').setValue('AÑAÑAI · Notas de Crédito — completar con el formulario del menú 🛒');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['NC-ID','Fecha','CLI-ID','Cliente','DES-ID origen','Monto NC ($)','Motivo','Aplica a','Estado'];
  estiloHeader(ws.getRange(2, 1, 1, hdrs.length), '#7B2D00');
  ws.getRange(2, 1, 1, hdrs.length).setValues([hdrs]);
  ws.setRowHeight(2, 34);

  var widths = [90,100,80,180,120,120,200,160,110];
  widths.forEach(function(w, i) { ws.setColumnWidth(i+1, w); });
  ws.setFrozenRows(2);
}

// ════════════════════════════════════════════════════════════════
// MENÚ
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// WEB APP — DASHBOARD
// 1. Agregar archivo HTML al proyecto: + → HTML → nombre: Dashboard
// 2. Pegar el contenido de Dashboard.html en ese archivo
// 3. Ejecutar guardarSheetId() UNA VEZ desde el editor
// 4. Deploy → New deployment → Web App → Execute as: Me → Anyone
// ════════════════════════════════════════════════════════════════
// ── METAS del mes: objetivo de ventas y costos fijos esperados (editables en la hoja «Metas») ──
function getMetas() {
  var defObj = 35900000, defCf = 5400000;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Metas');
    if (!sh) sh = crearHojaMetas(ss, defObj, defCf);
    var obj = Number(sh.getRange('B3').getValue()) || defObj;
    var cf  = Number(sh.getRange('B4').getValue()) || defCf;
    return { objetivo: obj, cf: cf };
  } catch (e) {
    return { objetivo: defObj, cf: defCf };
  }
}
function crearHojaMetas(ss, defObj, defCf) {
  var sh = ss.insertSheet('Metas');
  sh.getRange('A1').setValue('AÑAÑAI · Metas del mes — editá los valores de la columna B').setFontWeight('bold');
  sh.getRange('A3').setValue('Objetivo de ventas mensual ($)');
  sh.getRange('B3').setValue(defObj);
  sh.getRange('A4').setValue('Costos fijos esperados ($/mes)');
  sh.getRange('B4').setValue(defCf);
  sh.getRange('A6').setValue('Alimentan el objetivo y el punto de equilibrio del dashboard. Actualizá mensualmente.');
  sh.setColumnWidth(1, 280); sh.setColumnWidth(2, 140);
  sh.getRange('B3:B4').setNumberFormat('$#,##0').setFontWeight('bold');
  sh.getRange('A1').setFontColor('#2F5496');
  return sh;
}
function abrirMetas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Metas') || crearHojaMetas(ss, 35900000, 5400000);
  ss.setActiveSheet(sh);
  SpreadsheetApp.getUi().alert('Metas del mes',
    'Editá en la columna B el objetivo de ventas mensual y los costos fijos esperados. '
    + 'El dashboard los toma al recargar (no requiere redeploy).', SpreadsheetApp.getUi().ButtonSet.OK);
}

// Wrappers PIN-gated para editar la meta de ventas mensual desde el panel
// de Configuración del Dashboard, en vez de entrar a la hoja "Metas" a mano.
function getMetaVentasMensual(pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  var m = getMetas();
  return { ok: true, objetivo: m.objetivo, cf: m.cf };
}

function guardarMetaVentasMensual(objetivo, cf, pin) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: 'PIN incorrecto.' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Metas') || crearHojaMetas(ss, 0, 0);
  sh.getRange('B3').setValue(Number(objetivo) || 0);
  sh.getRange('B4').setValue(Number(cf) || 0);
  return { ok: true, mensaje: '✅ Meta de ventas mensual actualizada.' };
}

// ═══════════════════════════════════════════════════════════════
// REEMPLAZO COMPLETO de la función doGet() en Código.gs
// (borrá la doGet actual entera y pegá esta en su lugar).
// Es la misma de siempre + UNA rama nueva: page === 'calendario'.
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  var page = e && e.parameter && e.parameter.page;

  if (page === 'manifest') {
    return ContentService.createTextOutput(JSON.stringify(getManifestProduccion_()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (page === 'produccion') {
    var tp = HtmlService.createTemplateFromFile('ProduccionForm');
    tp.manifestUrl = ScriptApp.getService().getUrl() + '?page=manifest';
    tp.icon192DataUri = 'data:image/png;base64,' + ICON_192_PRODUCCION_BASE64;
    return tp.evaluate()
      .setTitle('Producción — Guía de planta')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (page === 'pedidos') {
  var tPed = HtmlService.createTemplateFromFile('PedidosForm');
  return tPed.evaluate()
    .setTitle('AÑAÑAI · Pedidos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
  // ── NUEVO: calendario de producción (sin login, solo lectura, sin precios) ──
  if (page === 'calendario') {
    var tCal = HtmlService.createTemplateFromFile('CalendarioProduccion');
    // La clave del link (?k=...) se limpia a alfanumérico antes de meterla en la página.
    tCal.clave = String((e && e.parameter && e.parameter.k) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    return tCal.evaluate()
      .setTitle('AÑAÑAI · Calendario de Producción')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (page === 'stock') {
    var tStock = HtmlService.createTemplateFromFile('Stock');
    tStock.datos = JSON.stringify(getDatosStockParaPantalla());  // from Producción.gs
    tStock.dashboardUrl = ScriptApp.getService().getUrl();
    return tStock.evaluate()
      .setTitle('AÑAÑAI · Stock')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var t       = HtmlService.createTemplateFromFile('Dashboard');
  var ventas  = getDatosParaDashboard();
  var gastos  = getDatosGastosParaDashboard();   // from Configuracion.gs
  t.datos     = JSON.stringify(ventas);
  t.gastos    = JSON.stringify(gastos);
  return t.evaluate()
    .setTitle('AÑAÑAI · Ventas & Cobros')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function getDatosParaDashboard() {
  var ss;
  var sid = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (sid) { try { ss = SpreadsheetApp.openById(sid); } catch(e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  }
  if (!ss) return { despachos:[], cobros:[], meta:{} };

  var hDes = ss.getSheetByName(H_DESPACHOS);
  var hCob = ss.getSheetByName(H_COBROS);
  var hoy  = new Date(); hoy.setHours(0,0,0,0);
  var TZ   = 'America/Argentina/Buenos_Aires';
  var despachos = [];

  if (hDes && hDes.getLastRow() >= DATA_ROW) {
    var rawD = hDes.getRange(DATA_ROW, 1, hDes.getLastRow()-DATA_ROW+1, 13).getValues();
    rawD.forEach(function(r) {
      var cli = String(r[3]).trim();
      if (!cli || cli === 'undefined' || cli === '') return;
      if (String(r[12]||'').trim() === 'Anulado') return; // despacho revertido — no cuenta como venta
      var fecha = r[1] instanceof Date ? r[1] : null;
      var fStr  = fecha ? Utilities.formatDate(fecha, TZ, 'yyyy-MM-dd') : '';
      var fl    = fecha ? Utilities.formatDate(fecha, TZ, 'dd/MM')      : '';
      var mes   = fecha ? Utilities.formatDate(fecha, TZ, 'yyyy-MM')    : '';
      var sem   = fecha ? _semLabel(fecha, TZ)                          : '';
      despachos.push({
        id:    String(r[0]).trim(),
        f:     fStr, fl: fl, sem: sem, m: mes,
        cli:   cli,
        p:     String(r[4]).trim(),
        v:     String(r[5]).trim(),
        u:     (r[7] !== '' && r[7] !== null) ? Number(r[7])  : null,
        pr:    (r[8] !== '' && r[8] !== null) ? Number(r[8])  : null,
        mt:    (r[10]!== '' && r[10]!== null) ? Number(r[10]) : null,
        cond:  String(r[11]).trim() || 'Crédito',
        isInt: cli.toLowerCase().indexOf('a') === 0 && cli.toLowerCase().replace(/[^a-z]/g,'') === 'ananai'
      });
    });
  }

  var cobros = [];
  if (hCob && hCob.getLastRow() >= DATA_ROW) {
    var rawC = hCob.getRange(DATA_ROW, 1, hCob.getLastRow()-DATA_ROW+1, 11).getValues();
    rawC.forEach(function(r) {
      var cli = String(r[3]).trim();
      if (!cli || cli === '') return;
      if (String(r[10]||'').indexOf('ANULADO') > -1) return; // cobro anulado — no cuenta
      var fecha = r[1] instanceof Date ? r[1] : null;
      cobros.push({
        id:    String(r[0]).trim(),
        f:     fecha ? Utilities.formatDate(fecha, TZ, 'yyyy-MM-dd') : '',
        cli:   cli,
        mt:    Number(r[4]) || 0,
        neto:  Number(r[6]) || Number(r[4]) || 0,
        fp:    String(r[7]).trim(),
        isInt: cli.toLowerCase().replace(/[^a-z]/g,'') === 'ananai'
      });
    });
  }

  var fechas = despachos.map(function(r){ return r.f; }).filter(Boolean).sort();
  var desde  = fechas[0]                || Utilities.formatDate(hoy, TZ, 'yyyy-MM-dd');
  var hasta  = fechas[fechas.length-1] || desde;
  var days   = Math.max(1, Math.round((new Date(hasta)-new Date(desde))/864e5)+1);

  var metas = getMetas();
  return {
    despachos: despachos,
    cobros:    cobros,
    meta: {
      period_days: days,
      fecha_desde: desde,
      fecha_hasta: hasta,
      hoy: Utilities.formatDate(hoy, TZ, 'yyyy-MM-dd'),
      objetivo: metas.objetivo,
      cf: metas.cf
    }
  };
}

// Semana sábado→viernes (semana comercial). d.getDay(): sáb=6, dom=0, lun=1...
// El offset (+1)%7 lleva cualquier día de vuelta al sábado de esa semana.
function _semLabel(fecha, tz) {
  var d = new Date(fecha); d.setHours(0,0,0,0);
  d.setDate(d.getDate()-((d.getDay()+1)%7));
  return Utilities.formatDate(d, tz, 'dd/MM');
}

function guardarSheetId() {
  var sid = SpreadsheetApp.getActiveSpreadsheet().getId();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', sid);
  SpreadsheetApp.getUi().alert('\u2705 Sheet ID guardado. Ahora pod\u00e9s deployar el Web App.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛒 AÑAÑAI Ventas')
    .addItem('📦 Registrar despacho',      'abrirFormDespacho')
    .addItem('💰 Registrar cobro',          'abrirFormCobro')
    .addItem('↩ Registrar nota de crédito', 'abrirFormNC')
    .addSeparator()
    .addItem('👤 Agregar cliente nuevo',    'abrirFormCliente')
    .addItem('💲 Actualizar precio',        'abrirFormPrecio')
    .addSeparator()
    .addItem('📊 Ver CXC por cliente',      'verCXC')
    .addItem('🔧 Reparar CxC (contado)',     'repararCxCContado')
    .addItem('🔎 Diagnosticar CxC',          'diagnosticarCxC')
    .addItem('🎯 Metas del mes',             'abrirMetas')
    .addSeparator()
    .addItem('⚙ Inicializar módulo (1° vez)', 'inicializar')
    .addItem('📥 Cargar históricos (2° paso)', 'importarDatosHistoricos')
    .addItem('🔑 Guardar Sheet ID (Web App)',   'guardarSheetId')
    .addToUi();

  gastoOnOpen();  // crea el menú 💸 AÑAÑAI Gastos (definido en Proveedores.gs)
  produccionOnOpen();  // crea el menú 🏭 AÑAÑAI Producción (definido en Producción.gs)
  stockOnOpen();  // crea el menú 📦 AÑAÑAI Stock (definido en Producción.gs)
  pedidosOnOpen();  // crea el menú 🧾 AÑAÑAI Pedidos (definido en Pedidos.gs)
}

// ════════════════════════════════════════════════════════════════
// HELPERS — LEER MAESTROS
// ════════════════════════════════════════════════════════════════
function getClientes() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_CLIENTES);
  var last = hoja.getLastRow();
  if (last < DATA_ROW) return [];
  var raw  = hoja.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 5).getValues();
  return raw.filter(function(r) { return r[0] && r[4] === 'Sí'; })
            .map(function(r) { return { id:r[0], nombre:String(r[1]).trim(), condicion:String(r[2]).trim(), diasCred:r[3] }; });
}

function getProductos() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_PRODUCTOS);
  var last = hoja.getLastRow();
  if (last < DATA_ROW) return [];
  var raw  = hoja.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 6).getValues();
  return raw.filter(function(r) { return r[0]; })
            .map(function(r) {
              return { nombre:r[0], variante:r[1], unidad:r[2],
                       pLibre: r[3]||null, p1: r[4]||null, tienePrecio: r[5]==='Sí' };
            });
}

// Bundle para el formulario de Pedidos: catálogo + sabores/tiers +
// precios especiales Añañai + umbral, en un solo viaje al servidor
// (en vez de 3 llamadas separadas). Misma fuente de datos que usa el
// formulario de Despacho — ver FLAVORS y ANANAI_PRECIOS arriba.
function getCatalogoParaPedidos() {
  return { productos: getProductos(), flavors: FLAVORS, ananaiPrecios: ANANAI_PRECIOS, umbral: UMBRAL_P1 };
}

// Acumulado de unidades del cliente en el mes actual
function getAcumuladoMes(cliId) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_DESPACHOS);
  var last = hoja.getLastRow();
  if (last < DATA_ROW) return 0;
  var raw  = hoja.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 8).getValues();
  var hoy  = new Date();
  var mes  = hoy.getMonth();
  var anio = hoy.getFullYear();
  var total = 0;
  raw.forEach(function(r) {
    if (r[2] === cliId && r[1] instanceof Date &&
        r[1].getMonth() === mes && r[1].getFullYear() === anio) {
      total += Number(r[7]) || 0;
    }
  });
  return total;
}

// Normaliza texto: trim + minúsculas + sin acentos (para comparar condición/estado)
function _norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// CXC pendiente por cliente
// CXC = saldo acumulado: facturado (crédito + contado no cobrado) − cobrado, por cliente
function getCXC() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var factu = {}, cobrado = {}, display = {};
  getClientes().forEach(function(c) { display[_norm(c.nombre)] = c.nombre; });
  function key(nombre) {
    var k = _norm(nombre);
    if (!display[k]) display[k] = String(nombre).trim();
    return k;
  }
  var hDes = ss.getSheetByName(H_DESPACHOS);
  if (hDes && hDes.getLastRow() >= DATA_ROW) {
    hDes.getRange(DATA_ROW, 1, hDes.getLastRow()-DATA_ROW+1, 13).getValues().forEach(function(r) {
      var cli = String(r[3]).trim(); var mt = Number(r[10])||0;
      var estado = String(r[12]||'').trim();
      // Despacho Anulado (revertido) no factura — no debe sumar a la CxC.
      if (cli && mt > 0 && estado !== 'Anulado') { var k = key(cli); factu[k] = (factu[k]||0) + mt; }
    });
  }
  var hCob = ss.getSheetByName(H_COBROS);
  if (hCob && hCob.getLastRow() >= DATA_ROW) {
    // Rango ampliado a 11 columnas (antes 8) para poder leer Obs (col 11):
    // ahí es donde queda anotado un cobro anulado (ver _anularCobro_ en Pedidos.gs).
    hCob.getRange(DATA_ROW, 1, hCob.getLastRow()-DATA_ROW+1, 11).getValues().forEach(function(r) {
      var cli = String(r[3]).trim(); var neto = Number(r[6])||Number(r[4])||0;
      var obs = String(r[10]||'');
      // Cobro anulado (revertido junto con un pedido) no debe descontar de la CxC.
      if (cli && neto > 0 && obs.indexOf('ANULADO') === -1) { var k = key(cli); cobrado[k] = (cobrado[k]||0) + neto; }
    });
  }
  var cxc = {};
  Object.keys(factu).forEach(function(k) {
    var saldo = (factu[k]||0) - (cobrado[k]||0);
    if (saldo > 1) cxc[display[k]] = Math.round(saldo);
  });
  return cxc;
}

// Generar ID secuencial
function genId(prefijo, hoja_nombre) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(hoja_nombre);
  var last = hoja.getLastRow();
  if (last < DATA_ROW) return prefijo + '001';
  var ids = hoja.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 1).getValues();
  var maxNum = 0;
  ids.forEach(function(r) {
    var m = String(r[0]).match(/(\d+)$/);
    if (m) { var n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
  });
  var seq = maxNum + 1;
  return prefijo + (seq < 10 ? '00'+seq : seq < 100 ? '0'+seq : String(seq));
}

// ════════════════════════════════════════════════════════════════
// GUARDAR DESPACHO
// ════════════════════════════════════════════════════════════════
function guardarDespacho(datos) {
  try {
    var unidades = Number(datos.unidades);

    // ── resolver SKU y validar/restar stock ANTES de guardar nada ──
    var res = _claveStock_(datos.producto, datos.variante);
    if (!res.ok) return { ok: false, mensaje: res.mensaje };

    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_DESPACHOS);
    var desId = genId('DES-', H_DESPACHOS);

    var forzar = !!datos.forzarSinStock;
    var movimiento = restarStockPorDespacho_(datos.producto, datos.variante, unidades, { desId: desId, forzar: forzar });

    if (!movimiento.ok) {
      // Sin stock suficiente y todavía no confirmó "igual imputar": no se
      // guarda nada, se devuelve la alerta para que el formulario pida el motivo.
      if (movimiento.necesitaConfirmacion) {
        return { ok: false, necesitaConfirmacion: true, mensaje: movimiento.mensaje, stockActual: movimiento.stockActual };
      }
      return { ok: false, mensaje: movimiento.mensaje };
    }

        // Agregar siempre al final real de la hoja
    var fila = Math.max(hoja.getLastRow() + 1, DATA_ROW);

    var fecha    = new Date();
    var precio   = Number(datos.precio);
    var monto    = unidades * precio;
    var estado   = 'Pendiente';  // toda venta nace en CxC; el cobro imputado la cierra (incluso Contado)

    hoja.getRange(fila, 1).setValue(desId);
    hoja.getRange(fila, 2).setValue(fecha).setNumberFormat('DD/MM/YYYY');
    hoja.getRange(fila, 3).setValue(datos.cliId);
    hoja.getRange(fila, 4).setValue(datos.clienteNombre);
    hoja.getRange(fila, 5).setValue(datos.producto);
    hoja.getRange(fila, 6).setValue(datos.variante || '');
    hoja.getRange(fila, 7).setValue(datos.unidad);
    hoja.getRange(fila, 8).setValue(unidades);
    hoja.getRange(fila, 9).setValue(precio).setNumberFormat('$#,##0');
    hoja.getRange(fila, 10).setValue(datos.precioTipo); // 'PLibre' o 'P1 (>400u/mes)'
    hoja.getRange(fila, 11).setValue(monto).setNumberFormat('$#,##0');
    hoja.getRange(fila, 12).setValue(datos.condicion);
    hoja.getRange(fila, 13).setValue(estado);
    hoja.getRange(fila, 14).setValue((datos.obs || '') + (movimiento.sinStockSuficiente ? ' ⚠ imputado sin stock suficiente' : ''));
    hoja.getRange(fila, 15).setValue(fecha).setNumberFormat('DD/MM/YYYY HH:mm');
    hoja.getRange(fila, 16).setValue(_usuarioActual());

    // Alternar color de fila
    var bg = (fila % 2 === 0) ? '#EEF3FA' : '#FFFFFF';
    hoja.getRange(fila, 1, 1, 16).setBackground(bg);

    // Trazabilidad: si se imputó igual sin stock suficiente, queda registrado
    // en "Alertas Stock" para poder revisarlo y corregirlo más tarde.
    if (movimiento.sinStockSuficiente) {
      registrarAlertaStock_({
        desId: desId, sku: res.sku, producto: res.catalogo.nombre, variante: datos.variante || '',
        cantidad: unidades, stockAlMomento: movimiento.stockPrevio, motivo: datos.motivoForzado || ''
      });
    }

    return {
      ok: true,
      desId: desId,
      monto: monto,
      estado: estado,
      sinStockSuficiente: !!movimiento.sinStockSuficiente,
      mensaje: (movimiento.sinStockSuficiente ? '⚠ Imputado SIN stock suficiente — queda anotado en "Alertas Stock" para revisar. · ' : '') +
               '✅ ' + desId + ' — ' + datos.clienteNombre + ' · ' + datos.producto +
               (datos.variante ? ' ' + datos.variante : '') +
               ' · ' + unidades + ' u. · $' + monto.toLocaleString('es-AR') +
               ' · ' + datos.condicion +
               (datos.condicion === 'Contado' ? ' · \u26a0 registrá también el cobro' : '')
    };
  } catch(e) { return { ok:false, mensaje:'❌ '+e.message }; }
}

// ════════════════════════════════════════════════════════════════
// GUARDAR COBRO
// ════════════════════════════════════════════════════════════════
function guardarCobro(datos) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_COBROS);

    var fila = Math.max(hoja.getLastRow() + 1, DATA_ROW);

    var cobId    = genId('COB-', H_COBROS);
    var fecha    = new Date();
    var monto    = Number(datos.monto);
    var descuento= Number(datos.descuento) || 0;
    var neto     = monto + descuento; // descuento suma al crédito del cliente

    hoja.getRange(fila, 1).setValue(cobId);
    hoja.getRange(fila, 2).setValue(fecha).setNumberFormat('DD/MM/YYYY');
    hoja.getRange(fila, 3).setValue(datos.cliId);
    hoja.getRange(fila, 4).setValue(datos.clienteNombre);
    hoja.getRange(fila, 5).setValue(monto).setNumberFormat('$#,##0');
    hoja.getRange(fila, 6).setValue(descuento || '').setNumberFormat('$#,##0');
    hoja.getRange(fila, 7).setValue(neto).setNumberFormat('$#,##0');
    hoja.getRange(fila, 8).setValue(datos.formaPago || '');
    hoja.getRange(fila, 9).setValue(datos.referencia || '');
    hoja.getRange(fila, 10).setValue(datos.desIds || '');
    hoja.getRange(fila, 11).setValue(datos.obs || '');
    hoja.getRange(fila, 12).setValue(datos.caja || 'Distribuidora');
    hoja.getRange(fila, 13).setValue(fecha).setNumberFormat('DD/MM/YYYY HH:mm');
    hoja.getRange(fila, 14).setValue(_usuarioActual());

    var bg = (fila % 2 === 0) ? '#EEF3FA' : '#FFFFFF';
    hoja.getRange(fila, 1, 1, 14).setBackground(bg);

    // Si hay DES-IDs específicos, actualizar su estado a Cobrado
    var actualizados = 0;
    if (datos.desIds && datos.desIds.trim()) {
      var ids = datos.desIds.split(',').map(function(s) { return s.trim(); });
      var hDes = ss.getSheetByName(H_DESPACHOS);
      var lastD = hDes.getLastRow();
      if (lastD >= DATA_ROW) {
        var desData = hDes.getRange(DATA_ROW, 1, lastD - DATA_ROW + 1, 13).getValues();
        desData.forEach(function(r, idx) {
          if (ids.indexOf(r[0]) > -1 && String(r[11]).trim() === 'Crédito') {
            hDes.getRange(DATA_ROW + idx, 13).setValue('Cobrado');
            actualizados++;
          }
        });
      }
    }

    return {
      ok: true,
      cobId: cobId,
      mensaje: '✅ ' + cobId + ' — ' + datos.clienteNombre +
               ' · $' + monto.toLocaleString('es-AR') +
               (descuento ? ' (+ $' + descuento.toLocaleString('es-AR') + ' dto. pronto pago)' : '') +
               (actualizados ? ' · ' + actualizados + ' despacho/s marcados como cobrados' : '')
    };
  } catch(e) { return { ok:false, mensaje:'❌ '+e.message }; }
}

// ════════════════════════════════════════════════════════════════
// GUARDAR NOTA DE CRÉDITO
// ════════════════════════════════════════════════════════════════
function guardarNC(datos) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_NC);

    var fila = Math.max(hoja.getLastRow() + 1, DATA_ROW);

    var ncId  = genId('NC-', H_NC);
    var fecha = new Date();
    var monto = Number(datos.monto);

    hoja.getRange(fila, 1).setValue(ncId);
    hoja.getRange(fila, 2).setValue(fecha).setNumberFormat('DD/MM/YYYY');
    hoja.getRange(fila, 3).setValue(datos.cliId);
    hoja.getRange(fila, 4).setValue(datos.clienteNombre);
    hoja.getRange(fila, 5).setValue(datos.desIdOrigen || '');
    hoja.getRange(fila, 6).setValue(monto).setNumberFormat('$#,##0');
    hoja.getRange(fila, 7).setValue(datos.motivo || '');
    hoja.getRange(fila, 8).setValue(datos.aplicaA || '');
    hoja.getRange(fila, 9).setValue('Activa');

    // Marcar despacho origen como Devuelto si se indicó
    if (datos.desIdOrigen) {
      var hDes = ss.getSheetByName(H_DESPACHOS);
      var lastD = hDes.getLastRow();
      if (lastD >= DATA_ROW) {
        var desData = hDes.getRange(DATA_ROW, 1, lastD - DATA_ROW + 1, 13).getValues();
        desData.forEach(function(r, idx) {
          if (r[0] === datos.desIdOrigen) {
            hDes.getRange(DATA_ROW + idx, 13).setValue('Devuelto');
          }
        });
      }
    }

    var bg = (fila % 2 === 0) ? '#FFF0E8' : '#FFF8F4';
    hoja.getRange(fila, 1, 1, 9).setBackground(bg);

    return {
      ok: true,
      ncId: ncId,
      mensaje: '✅ ' + ncId + ' — NC por $' + monto.toLocaleString('es-AR') +
               ' para ' + datos.clienteNombre
    };
  } catch(e) { return { ok:false, mensaje:'❌ '+e.message }; }
}

// ════════════════════════════════════════════════════════════════
// ANULAR DESPACHO — usada exclusivamente por revertirPedido() (Pedidos.gs)
// No borra la fila (trazabilidad): marca Estado='Anulado' y anota el
// motivo en Obs. getCXC() y getDatosParaDashboard() ya excluyen estos
// despachos del cálculo.
//
// OJO: esta función NO valida si el despacho está 'Cobrado' — esa
// decisión (si es seguro anular un despacho ya cobrado) la toma
// revertirPedido() ANTES de llamar acá, con su propio pre-chequeo.
// Se deja así para no duplicar esa lógica de negocio en dos lugares.
// ════════════════════════════════════════════════════════════════
function _anularDespacho_(desId, motivo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_DESPACHOS);
  var last = hoja.getLastRow();
  if (last < DATA_ROW) return { ok: false, mensaje: 'No hay despachos cargados.' };
  var raw = hoja.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 14).getValues();
  for (var i = 0; i < raw.length; i++) {
    if (String(raw[i][0]).trim() === String(desId).trim()) {
      var fila = DATA_ROW + i;
      var estadoActual = String(raw[i][12] || '').trim();
      if (estadoActual === 'Anulado') return { ok: false, mensaje: desId + ' ya estaba anulado.' };
      var obsActual = raw[i][13] || '';
      hoja.getRange(fila, 13).setValue('Anulado');
      hoja.getRange(fila, 14).setValue((obsActual ? obsActual + ' · ' : '') + '⚠ ANULADO — ' + motivo);
      return { ok: true };
    }
  }
  return { ok: false, mensaje: 'No se encontró el despacho ' + desId + '.' };
}

// ════════════════════════════════════════════════════════════════
// GUARDAR CLIENTE NUEVO
// ════════════════════════════════════════════════════════════════
function guardarClienteNuevo(datos) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_CLIENTES);
    var last = hoja.getLastRow();
    var fila = Math.max(last + 1, DATA_ROW);
    var seq  = fila - DATA_ROW + 1;
    var cliId = 'CLI-' + (seq < 10 ? '00'+seq : seq < 100 ? '0'+seq : seq);

    hoja.getRange(fila, 1, 1, 5).setValues([[
      cliId, String(datos.nombre).trim(), datos.condicion, Number(datos.diasCred)||0, 'Sí'
    ]]);

    return { ok:true, cliId:cliId, mensaje:'✅ '+cliId+' — '+datos.nombre+' agregado correctamente.' };
  } catch(e) { return { ok:false, mensaje:'❌ '+e.message }; }
}

// ════════════════════════════════════════════════════════════════
// ACTUALIZAR PRECIO
// ════════════════════════════════════════════════════════════════
function actualizarPrecio(datos) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_PRODUCTOS);
    var last = hoja.getLastRow();
    var raw  = hoja.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 6).getValues();
    var encontrado = false;
    raw.forEach(function(r, idx) {
      if (r[0] === datos.producto && r[1] === datos.variante) {
        hoja.getRange(DATA_ROW + idx, 4).setValue(Number(datos.pLibre));
        hoja.getRange(DATA_ROW + idx, 5).setValue(Number(datos.p1));
        hoja.getRange(DATA_ROW + idx, 6).setValue('Sí');
        encontrado = true;
      }
    });
    return encontrado
      ? { ok:true, mensaje:'✅ Precio actualizado para '+datos.producto+' '+datos.variante }
      : { ok:false, mensaje:'❌ Producto no encontrado' };
  } catch(e) { return { ok:false, mensaje:'❌ '+e.message }; }
}

// ════════════════════════════════════════════════════════════════
// VER CXC — tabla lateral
// ════════════════════════════════════════════════════════════════
function verCXC() {
  var clientes = getClientes();
  var cxc      = getCXC();
  var html = buildCXCHTML(clientes, cxc);
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(html).setTitle('CXC por cliente')
  );
}

function buildCXCHTML(clientes, cxc) {
  var total = Object.keys(cxc).reduce(function(s,k){return s+(cxc[k]||0);},0);
  // Iteramos la CxC directamente: muestra a TODO cliente con saldo, sin depender
  // de que figure en el maestro ni de un matcheo exacto de nombre.
  var rows  = Object.keys(cxc)
    .sort(function(a,b){ return (cxc[b]||0)-(cxc[a]||0); })
    .map(function(nombre){
      var v = cxc[nombre]||0;
      return '<tr><td>'+nombre+'</td><td style="text-align:right;font-weight:700;color:#2F5496">$'+
             v.toLocaleString('es-AR')+'</td></tr>';
    }).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    +'body{font-family:"Segoe UI",sans-serif;font-size:13px;color:#1a1a2e;padding:12px}'
    +'h3{color:#2F5496;margin-bottom:12px}table{width:100%;border-collapse:collapse}'
    +'td{padding:8px 10px;border-bottom:1px solid #e0e6f0}'
    +'tr:hover td{background:#f5f7fb}.total td{font-weight:700;border-top:2px solid #2F5496;color:#2F5496}'
    +'</style></head><body>'
    +'<h3>💰 CXC Pendiente</h3>'
    +'<table><tbody>'+rows
    +'<tr class="total"><td>TOTAL</td><td style="text-align:right">$'+total.toLocaleString('es-AR')+'</td></tr>'
    +'</tbody></table>'
    +'<p style="font-size:10px;color:#888;margin-top:12px">Facturado (crédito + contado no cobrado) neto de cobros, por cliente</p>'
    +'</body></html>';
}

// ════════════════════════════════════════════════════════════════
// REPARAR CxC — despachos contado del sistema mal marcados 'Cobrado'
// ════════════════════════════════════════════════════════════════
// Los despachos importados (seed) de contado quedan en 'Cobrado' porque ya se
// liquidaron. Pero los despachos NUEVOS de contado cargados con una versión
// anterior del formulario también quedaron en 'Cobrado' y por eso getCXC los
// descarta. Esta función los devuelve a 'Pendiente' (solo los del sistema, no el
// histórico) para que vuelvan a sumar a la CxC hasta que se registre el cobro.
function repararCxCContado() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var hDes = ss.getSheetByName(H_DESPACHOS);
  if (!hDes || hDes.getLastRow() < DATA_ROW) { ui.alert('No hay despachos para revisar.'); return; }

  // Máximo DES-ID del histórico importado: por encima de eso son despachos del sistema.
  var maxSeed = 421;
  try {
    var m = 0;
    HIST_DESPACHOS.forEach(function(r){
      var num = parseInt(String(r[0]).replace(/[^0-9]/g,''), 10);
      if (num > m) m = num;
    });
    if (m > 0) maxSeed = m;
  } catch(e) {}

  var n = hDes.getLastRow() - DATA_ROW + 1;
  var v = hDes.getRange(DATA_ROW, 1, n, 13).getValues();
  var cambios = 0;
  for (var i = 0; i < v.length; i++) {
    var r = v[i]; if (!r[0]) continue;
    var num = parseInt(String(r[0]).replace(/[^0-9]/g,''), 10);
    var cond = String(r[11]).trim(), estado = String(r[12]).trim();
    if (num > maxSeed && cond === 'Contado' && estado === 'Cobrado') {
      hDes.getRange(DATA_ROW + i, 13).setValue('Pendiente');
      cambios++;
    }
  }
  ui.alert('Reparación de CxC',
    cambios + ' despacho(s) de contado cargados en el sistema se pasaron a "Pendiente" y ahora suman a la CxC del cliente. '
    + 'Se cerrarán al registrar el cobro. El histórico importado (hasta DES-' + maxSeed + ') quedó intacto.',
    ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════════
// DIAGNÓSTICO CxC — vuelca a una hoja qué computa getCXC por cliente
// ════════════════════════════════════════════════════════════════
function diagnosticarCxC() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var hDes = ss.getSheetByName(H_DESPACHOS);
  var cxc = getCXC();

  var factu = {}, cobrado = {}, nDesp = {};
  if (hDes && hDes.getLastRow() >= DATA_ROW) {
    hDes.getRange(DATA_ROW, 1, hDes.getLastRow() - DATA_ROW + 1, 13).getValues().forEach(function(r) {
      var cli = String(r[3]).trim(); if (!cli) return;
      var mt = Number(r[10]) || 0;
      factu[cli] = (factu[cli] || 0) + mt;
      nDesp[cli] = (nDesp[cli] || 0) + 1;
    });
  }
  if (hCob && hCob.getLastRow() >= DATA_ROW) {
    hCob.getRange(DATA_ROW, 1, hCob.getLastRow() - DATA_ROW + 1, 8).getValues().forEach(function(r) {
      var cli = String(r[3]).trim(); if (!cli) return;
      var neto = Number(r[6]) || Number(r[4]) || 0;
      cobrado[cli] = (cobrado[cli] || 0) + neto;
    });
  }

  var todos = {};
  Object.keys(factu).forEach(function(c){ todos[c] = true; });
  Object.keys(cobrado).forEach(function(c){ todos[c] = true; });

  var out = ss.getSheetByName('Diagnóstico CxC') || ss.insertSheet('Diagnóstico CxC');
  out.clear();
  out.getRange(1, 1, 1, 6).setValues([['Cliente (entre « »)', '# Desp.', 'Total facturado', 'Total cobrado', 'CxC (facturado − cobrado)', 'Alerta']]);
  out.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#2F5496').setFontColor('#FFFFFF');
  var rows = Object.keys(todos).sort().map(function(cli) {
    var fa = factu[cli] || 0, co = cobrado[cli] || 0, saldo = fa - co;
    var alerta = (co > fa + 1) ? '⚠ Cobros migrados > ventas (revisar migración)' : '';
    return ['«' + cli + '»', nDesp[cli] || 0, fa, co, cxc[cli] || 0, alerta];
  });
  if (rows.length) out.getRange(2, 1, rows.length, 6).setValues(rows);
  out.setColumnWidth(1, 220); out.setColumnWidth(6, 320);
  out.getRange(2, 3, Math.max(rows.length,1), 3).setNumberFormat('$#,##0');

  ui.alert('Diagnóstico CxC',
    'Generé la hoja "Diagnóstico CxC" con el neteo por cliente:\n\n'
    + '• Total facturado (todas las ventas) − Total cobrado = CxC.\n'
    + '• Donde veas la alerta "Cobros migrados > ventas", ese cliente tiene más cobros cargados que ventas: '
    + 'es data de la migración para revisar (faltan ventas o hay cobros de más). Su CxC queda en 0.\n',
    ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════════
// ABRIR FORMULARIOS
// ════════════════════════════════════════════════════════════════
function abrirFormDespacho() {
  var clientes = getClientes();
  var productos = getProductos();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormDespachoHTML(clientes, productos))
      .setTitle('Registrar Despacho').setWidth(520)
  );
}

function abrirFormCobro() {
  var clientes = getClientes();
  var cxc      = getCXC();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormCobroHTML(clientes, cxc))
      .setTitle('Registrar Cobro').setWidth(520)
  );
}

function abrirFormNC() {
  var clientes = getClientes();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormNCHTML(clientes))
      .setTitle('Nota de Crédito').setWidth(520)
  );
}

function abrirFormCliente() {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormClienteHTML())
      .setTitle('Nuevo Cliente').setWidth(420)
  );
}

function abrirFormPrecio() {
  var productos = getProductos();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormPrecioHTML(productos))
      .setTitle('Actualizar Precio').setWidth(420)
  );
}

// ════════════════════════════════════════════════════════════════
// HTML — CSS COMPARTIDO
// ════════════════════════════════════════════════════════════════
function sharedCSS() {
  return '<style>'
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:"Segoe UI",Arial,sans-serif;font-size:13px;background:#f5f7fa;color:#1a1a2e}'
    +'.hdr{padding:14px 17px 12px;color:#fff;border-bottom:3px solid rgba(0,0,0,.2)}'
    +'.hdr h2{font-size:14px;font-weight:700;margin-bottom:2px}'
    +'.hdr p{font-size:11px;opacity:.8}'
    +'.body{padding:15px 17px}'
    +'.field{margin-bottom:12px}'
    +'label{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5a6580;margin-bottom:4px}'
    +'label span.req{color:#e05555;margin-left:2px}'
    +'select,input,textarea{width:100%;padding:8px 10px;border:1.5px solid #d0d7e8;border-radius:6px;font-size:13px;font-family:inherit;background:#fff;color:#1a1a2e;outline:none}'
    +'select:focus,input:focus,textarea:focus{border-color:#2F5496}'
    +'textarea{resize:vertical;min-height:50px}'
    +'.r2{display:grid;grid-template-columns:1fr 1fr;gap:9px}'
    +'.r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}'
    +'.hint{margin-top:5px;padding:7px 10px;border-radius:5px;font-size:11.5px;font-weight:600;display:none}'
    +'.hint.show{display:block}'
    +'.hint-info{background:#eef3fb;border:1px solid #c5d5f0;border-left:3px solid #2F5496;color:#2F5496}'
    +'.hint-warn{background:#fff4e6;border:1px solid #f0c070;border-left:3px solid #e07020;color:#a05010}'
    +'.hint-ok{background:#e8f8ef;border:1px solid #a0d8b8;border-left:3px solid #1a7a40;color:#1a7a40}'
    +'.btns{display:flex;gap:8px;margin-top:4px}'
    +'button{flex:1;padding:10px;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}'
    +'.b1{color:#fff}.b1:hover{opacity:.88}.b2{background:#e8ecf4;color:#5a6580}'
    +'.msg{margin-top:11px;padding:9px 12px;border-radius:6px;font-size:12px;font-weight:600;display:none}'
    +'.msg.ok{background:#e8f8ef;color:#1a7a40;border:1px solid #a0d8b8}'
    +'.msg.er{background:#fde8e8;color:#b82020;border:1px solid #f0b0b0}'
    +'.sp{display:none;text-align:center;padding:7px;color:#5a6580;font-size:11px}'
    + formUXCSS()
    +'</style>';
}

function sharedJS() {
  return '<script>'
    +'function v(id){return document.getElementById(id).value.trim();}'
    +'function show(txt,ok){var el=document.getElementById("msg");el.textContent=txt;el.className="msg "+(ok?"ok":"er");el.style.display="block";if(ok)setTimeout(function(){el.style.display="none";},6000);}'
    +'function sp(on){document.getElementById("sp").style.display=on?"block":"none";}'
    +'<\/script>';
}

// ════════════════════════════════════════════════════════════════
// UX COMPARTIDA — anti doble-clic, overlay de carga y confirmación
// Usado por TODOS los formularios (ventas, cobros, gastos, pagos, config).
// formUXCSS() devuelve CSS sin <style>; formUXJS() devuelve JS sin <script>.
// ════════════════════════════════════════════════════════════════
function formUXCSS() {
  return ''
    + '.ovl{position:fixed;inset:0;background:rgba(20,28,45,.55);display:none;align-items:center;justify-content:center;z-index:99999}'
    + '.ovl.show{display:flex}'
    + '.ovl-box{background:#fff;border-radius:12px;padding:20px 26px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.28);min-width:170px}'
    + '.ovl-spin{width:38px;height:38px;border:4px solid #dfe6f2;border-top-color:#2F5496;border-radius:50%;animation:ovspin .8s linear infinite}'
    + '@keyframes ovspin{to{transform:rotate(360deg)}}'
    + '.ovl-check{width:46px;height:46px;border-radius:50%;background:#1a7a40;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:700;animation:ovpop .35s cubic-bezier(.2,1.3,.5,1)}'
    + '@keyframes ovpop{0%{transform:scale(0)}100%{transform:scale(1)}}'
    + '.ovl-txt{font-size:13px;font-weight:700;color:#2F5496}'
    + '.msg.ok{animation:ovpop .3s ease}'
    + 'button:disabled{opacity:.5;cursor:not-allowed}'
    + 'button.loading{position:relative;color:transparent!important}'
    + 'button.loading::after{content:"";position:absolute;top:50%;left:50%;width:15px;height:15px;margin:-8px 0 0 -8px;border:2.5px solid rgba(255,255,255,.55);border-top-color:#fff;border-radius:50%;animation:ovspin .7s linear infinite}';
}

function formUXJS() {
  return ''
    + 'var __busy=false;'
    // Crea el overlay una sola vez y lo devuelve
    + 'function __ovlEnsure(){var o=document.getElementById("__ovl");if(!o){o=document.createElement("div");o.id="__ovl";o.className="ovl";o.innerHTML=\'<div class="ovl-box"><div id="__ovlicon" class="ovl-spin"></div><div id="__ovltxt" class="ovl-txt">Guardando…</div></div>\';document.body.appendChild(o);}return o;}'
    // sp(true)=cargando (overlay + bloquea botones + flag); sp(false)=libera
    + 'function sp(on){__busy=!!on;var o=__ovlEnsure();var ic=document.getElementById("__ovlicon");var tx=document.getElementById("__ovltxt");if(on){ic.className="ovl-spin";ic.textContent="";tx.textContent=(typeof on==="string")?on:"Guardando…";o.className="ovl show";}else{o.className="ovl";}var bs=document.querySelectorAll("button");for(var i=0;i<bs.length;i++){bs[i].disabled=!!on;if((" "+bs[i].className+" ").indexOf(" b1 ")>-1){if(on){bs[i].classList.add("loading");}else{bs[i].classList.remove("loading");}}}}'
    // Flash de ✓ "¡Registrado!" por ~1.1s
    + 'function __flashOk(txt){var o=__ovlEnsure();var ic=document.getElementById("__ovlicon");var tx=document.getElementById("__ovltxt");ic.className="ovl-check";ic.textContent="\\u2713";tx.textContent=txt||"\\u00a1Registrado!";o.className="ovl show";setTimeout(function(){o.className="ovl";ic.className="ovl-spin";ic.textContent="";},1100);}'
    // show: banner prominente. En éxito dispara el flash ✓ y auto-oculta a los 6.5s
    + 'function show(txt,ok){if(ok){__flashOk("\\u00a1Registrado!");}var el=document.getElementById("msg");if(el){el.innerHTML=(ok?"\\u2705 ":"\\u26a0\\ufe0f ")+txt;el.className="msg "+(ok?"ok":"er");el.style.display="block";try{el.scrollIntoView({behavior:"smooth",block:"nearest"});}catch(e){}if(ok){setTimeout(function(){el.style.display="none";},6500);}}}'
    + 'function v(id){return document.getElementById(id).value.trim();}'
    // Guardia de captura: mientras __busy, cualquier clic en botón se bloquea
    + 'document.addEventListener("click",function(e){if(!__busy){return;}var n=e.target;while(n&&n!==document){if(n.tagName==="BUTTON"){e.preventDefault();e.stopPropagation();return;}n=n.parentNode;}},true);';
}

// ════════════════════════════════════════════════════════════════
// HTML — FORMULARIO DESPACHO
// ════════════════════════════════════════════════════════════════
function buildFormDespachoHTML(clientes, productos) {
  var cliOpts = clientes.map(function(c){
    return '<option value="'+c.id+'" data-nombre="'+c.nombre+'" data-cond="'+c.condicion+'">'+c.nombre+'</option>';
  }).join('');

  // Mapa de productos para el JS: {clave: {pLibre, p1, unidad, tienePrecio, nombre, variante}}
  var prodMap = {};
  productos.forEach(function(p) {
    var key = p.nombre + (p.variante ? ' — ' + p.variante : '');
    prodMap[key] = { pLibre: p.pLibre, p1: p.p1, unidad: p.unidad, tienePrecio: p.tienePrecio,
                     nombre: p.nombre, variante: p.variante };
  });

  // Nombres únicos para el primer dropdown
  var prodNombres = [];
  productos.forEach(function(p) {
    if (prodNombres.indexOf(p.nombre) === -1) prodNombres.push(p.nombre);
  });
  var prodNombreOpts = prodNombres.map(function(n){
    return '<option value="'+n+'">'+n+'</option>';
  }).join('');

  // ── SABORES por producto con tier oculto (Tartines / Pizzas) ──
  // FLAVORS ahora es una variable global (ver el bloque junto a
  // ANANAI_PRECIOS, arriba en el archivo) — se comparte con Pedidos.gs
  // para que el desplegable de sabores sea el mismo en los dos formularios.

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + sharedCSS()
    + '<style>'
    + '.panel-precios{display:none;margin:12px 0;padding:12px;border-radius:10px;background:#eef3fa;border:1px solid #cdd9ec}'
    + '.panel-precios.show{display:block}'
    + '.pp-title{font-size:12px;color:#1F3864;font-weight:600;margin-bottom:8px}'
    + '.pp-row{display:flex;gap:10px;flex-wrap:wrap}'
    + '.pp-chip{flex:1;min-width:135px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;border-radius:8px;border:1px solid #2F5496;background:#fff;cursor:pointer;text-align:left}'
    + '.pp-chip:hover{background:#f0f4ff}'
    + '.pp-chip.pp-ana{border-color:#1e7a46}'
    + '.pp-chip.pp-eq{cursor:default;border-style:dashed;opacity:.85}'
    + '.pp-lbl{font-size:11px;color:#666}'
    + '.pp-val{font-size:18px;font-weight:800;color:#1F3864}'
    + '.pp-ana .pp-val{color:#1e7a46}'
    + '.pp-chip.pp-libre{border-color:#b7841a}'
    + '.pp-libre .pp-val{color:#b7841a}'
    + '.pp-hint{margin-top:8px;font-size:12px;color:#1e7a46;font-weight:600}'
    + '.pp-nota{font-size:13px;color:#a15b00;font-weight:600}'
    + '</style>'
    + '</head><body>'
    + '<div class="hdr" style="background:#2F5496"><h2>📦 Registrar Despacho</h2>'
    + '<p>El precio unitario se carga manual. Al elegir el producto se muestran los precios de referencia (Libre, P1 y Añañai).</p></div>'
    + '<div class="body">'

    // Cliente
    + '<div class="field"><label>Cliente<span class="req">*</span></label>'
    + '<select id="cliSel" onchange="onCliChange()"><option value="">— Seleccioná —</option>'+cliOpts+'</select>'
    + '<div class="hint hint-info" id="hintCli"></div></div>'

    // Producto
    + '<div class="field"><label>Producto<span class="req">*</span></label>'
    + '<select id="prodSel" onchange="onProdChange()"><option value="">— Seleccioná —</option>'+prodNombreOpts+'</select></div>'

    // Variante / Sabor
    + '<div class="field" id="varWrap" style="display:none"><label>Variante<span class="req">*</span></label>'
    + '<select id="varSel" onchange="onVarChange()"><option value="">— Elegí la variante —</option></select></div>'

    // Panel de precios de referencia
    + '<div class="panel-precios" id="panelPrecios"></div>'

    // Unidades + Precio
    + '<div class="r2" style="margin-top:12px">'
    + '<div class="field"><label>Unidades<span class="req">*</span></label>'
    + '<input type="number" id="uniInp" min="1" placeholder="0" style="font-size:17px;font-weight:700;text-align:center;color:#2F5496" oninput="calcMonto()"></div>'
    + '<div class="field"><label>Precio unitario ($) <span style="font-weight:400;font-size:10px;color:#888">— manual</span></label>'
    + '<input type="number" id="precioInp" min="0" placeholder="Ingresá el precio" style="font-weight:700;color:#1F3864" oninput="calcMonto()"></div>'
    + '</div>'

    // Monto total
    + '<div class="field" style="margin-top:8px"><label>Monto total ($) — calculado</label>'
    + '<input type="number" id="montoInp" readonly style="background:#f0f4ff;font-size:16px;font-weight:700;color:#2F5496"></div>'

    // Condición
    + '<div class="field"><label>Condición<span class="req">*</span></label>'
    + '<select id="condSel" onchange="onCondChange()"><option value="Crédito">Crédito</option><option value="Contado">Contado</option></select>'
    + '<div id="hintCond" style="display:none;margin-top:6px;padding:8px 10px;background:#fff4e6;border:1px solid #f0c070;border-left:4px solid #e07020;border-radius:5px;font-size:11.5px;font-weight:600;color:#a05010">\ud83d\udca1 Toda venta genera cuenta corriente. Si es <b>Contado</b>, registrá igual el cobro en la pantalla \ud83d\udcb0 <b>Cobros</b> (mismo día) para que la CXC del cliente cierre.</div></div>'

    // Obs
    + '<div class="field"><label>Observaciones</label>'
    + '<textarea id="obsInp" placeholder="Aclaraciones, variantes específicas…"></textarea></div>'

    // Bloque de confirmación cuando no hay stock suficiente — oculto por
    // defecto, se muestra solo si el servidor responde necesitaConfirmacion
    + '<div class="field" id="wrapForzar" style="display:none;margin-top:10px;padding:12px;border-radius:8px;background:#fff4e6;border:1px solid #f0c070">'
    + '<div style="font-size:12.5px;font-weight:700;color:#a05010;margin-bottom:8px" id="txtForzar"></div>'
    + '<label>Motivo <span style="font-weight:400;font-size:10px;color:#888">— obligatorio para imputar igual</span></label>'
    + '<textarea id="motivoInp" placeholder="Ej: hay stock físico pero falta cargar la última producción…"></textarea>'
    + '<div class="btns" style="margin-top:8px">'
    + '<button type="button" class="b1" style="background:#e07020" onclick="confirmarForzar()">⚠ Igual imputar la venta</button>'
    + '<button type="button" class="b2" onclick="cancelarForzar()">Cancelar</button>'
    + '</div></div>'

    + '<div class="btns"><button class="b1" style="background:#2F5496" onclick="guardar()">💾 Guardar despacho</button>'
    + '<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    + '<div class="sp" id="sp">⏳ Guardando…</div>'
    + '<div class="msg" id="msg"></div>'
    + '</div>'

    // ═══════════════ JS ═══════════════
    + '<script>'
    + 'var PROD_MAP=' + JSON.stringify(prodMap) + ';'
    + 'var ANANAI_MAP=' + JSON.stringify(ANANAI_PRECIOS) + ';'
    + 'var FLAVORS=' + JSON.stringify(FLAVORS) + ';'
    + 'var UMBRAL=' + UMBRAL_P1 + ';'
    + 'var acumMes=0; var esAnanai=false;'

    // ── Normalización: minúsculas, sin acentos (ñ→n), sin espacios ──
    + 'function norm(s){return String(s==null?"":s).toLowerCase()'
    + '  .normalize("NFD").replace(/[\\u0300-\\u036f]/g,"")'
    + '  .replace(/[^a-z0-9]/g,"");}'
    + 'var PROD_MAP_N={};for(var _k in PROD_MAP){PROD_MAP_N[norm(_k)]=PROD_MAP[_k];}'
    + 'var ANANAI_N={};for(var _a in ANANAI_MAP){ANANAI_N[norm(_a)]=ANANAI_MAP[_a];}'

    // Precio Añañai especial de un producto (por nombre) o null si no aplica
    + 'function precioAnanaiDe(prod){'
    + '  var val=(ANANAI_MAP[prod]!==undefined)?ANANAI_MAP[prod]:ANANAI_N[norm(prod)];'
    + '  return (val===undefined||val===null)?null:val;'
    + '}'

    // P1 de un producto (con tier si corresponde), robusto a variaciones de nombre
    + 'function p1De(prod,tier){'
    + '  if(tier){'
    + '    var k=prod+" — "+tier;'
    + '    if(PROD_MAP[k]&&PROD_MAP[k].p1!=null) return PROD_MAP[k].p1;'
    + '    if(PROD_MAP_N[norm(k)]&&PROD_MAP_N[norm(k)].p1!=null) return PROD_MAP_N[norm(k)].p1;'
    + '    if(FLAVORS[prod]&&FLAVORS[prod].tierPrecio[tier]!=null) return FLAVORS[prod].tierPrecio[tier];'
    + '    return null;'
    + '  }'
    + '  if(PROD_MAP[prod]&&PROD_MAP[prod].p1!=null) return PROD_MAP[prod].p1;'
    + '  if(PROD_MAP_N[norm(prod)]&&PROD_MAP_N[norm(prod)].p1!=null) return PROD_MAP_N[norm(prod)].p1;'
    + '  return null;'
    + '}'

    // Precio Libre (el más alto): del maestro, o P1 + 5% como fallback
    + 'function pLibreDe(prod,tier){'
    + '  if(tier){'
    + '    var k=prod+" — "+tier;'
    + '    if(PROD_MAP[k]&&PROD_MAP[k].pLibre!=null) return PROD_MAP[k].pLibre;'
    + '    if(PROD_MAP_N[norm(k)]&&PROD_MAP_N[norm(k)].pLibre!=null) return PROD_MAP_N[norm(k)].pLibre;'
    + '  } else {'
    + '    if(PROD_MAP[prod]&&PROD_MAP[prod].pLibre!=null) return PROD_MAP[prod].pLibre;'
    + '    if(PROD_MAP_N[norm(prod)]&&PROD_MAP_N[norm(prod)].pLibre!=null) return PROD_MAP_N[norm(prod)].pLibre;'
    + '  }'
    + '  var b=p1De(prod,tier); return (b!=null)?Math.round(b*1.05):null;'
    + '}'

    // Unidad de medida del producto
    + 'function unidadDe(prod,tier){'
    + '  var k=tier?prod+" — "+tier:prod;'
    + '  if(PROD_MAP[k]&&PROD_MAP[k].unidad) return PROD_MAP[k].unidad;'
    + '  if(PROD_MAP_N[norm(k)]&&PROD_MAP_N[norm(k)].unidad) return PROD_MAP_N[norm(k)].unidad;'
    + '  if(PROD_MAP[prod]&&PROD_MAP[prod].unidad) return PROD_MAP[prod].unidad;'
    + '  return "Unidad";'
    + '}'

    // ── Cliente ──
    + 'function onCliChange(){'
    + '  var sel=document.getElementById("cliSel");'
    + '  var opt=sel.options[sel.selectedIndex];'
    + '  var cliId=sel.value;'
    + '  var cliNom=opt.getAttribute("data-nombre")||"";'
    + '  var cond=opt.getAttribute("data-cond")||"Crédito";'
    + '  document.getElementById("condSel").value=cond;'
    + '  acumMes=0;'
    + '  esAnanai=norm(cliNom).indexOf("ananai")>-1;'
    + '  var hint=document.getElementById("hintCli");'
    + '  if(esAnanai){'
    + '    hint.textContent="🏪 Sucursal interna Añañai — usá el precio Añañai cuando corresponda";'
    + '    hint.className="hint hint-ok show";'
    + '  } else { hint.className="hint"; }'
    + '  if(v("prodSel")) refrescarPrecios();'   // actualizar panel si ya hay producto
    + '  if(!cliId) return;'
    + '  google.script.run.withSuccessHandler(function(n){'
    + '    acumMes=n;'
    + '    if(!esAnanai){'
    + '      hint.textContent="Acumulado este mes: "+n.toLocaleString("es-AR")+" u."+(n>=UMBRAL?" — supera 400 u.":"");'
    + '      hint.className="hint hint-"+(n>=UMBRAL?"ok":"info")+" show";'
    + '    }'
    + '  }).getAcumuladoMes(cliId);'
    + '}'

    // ── Producto ──
    + 'function onProdChange(){'
    + '  var prod=v("prodSel");'
    + '  var varSel=document.getElementById("varSel");'
    + '  var varWrap=document.getElementById("varWrap");'
    + '  limpiarPrecio();'
    + '  if(FLAVORS[prod]){'
    + '    varSel.innerHTML=\'<option value="">— Elegí la variante —</option>\';'
    + '    FLAVORS[prod].sabores.forEach(function(s){'
    + '      varSel.innerHTML+=\'<option value="\'+s.variante+\'"\'+(s.tier?\' data-tier="\'+s.tier+\'"\':\'\')+\'>\'+s.sabor+\'</option>\';'
    + '    });'
    + '    varWrap.style.display="block";'
    + '  } else {'
    + '    varWrap.style.display="none";'
    + '    varSel.innerHTML=\'<option value=""></option>\';'
    + '    mostrarPrecios(prod,null);'   // producto de precio único
    + '  }'
    + '}'

    // ── Sabor / Variante ──
    // Nota: "tier" solo existe para Tartines/Pizzas (precio distinto según
    // Alto/Bajo). Chipalmendras, Pan de Molde y Fideos no tienen tier —
    // el precio es el mismo para cualquier variante — así que lo que
    // decide si hay que mostrar el panel es si HAY una opción elegida
    // (sel.value), no si tiene tier.
    + 'function onVarChange(){'
    + '  var prod=v("prodSel");'
    + '  var sel=document.getElementById("varSel");'
    + '  if(!sel.value){ limpiarPrecio(); return; }'
    + '  var opt=sel.options[sel.selectedIndex];'
    + '  var tier=opt?opt.getAttribute("data-tier"):null;'
    + '  mostrarPrecios(prod,tier||null);'
    + '}'

    // Re-renderiza el panel según selección actual (usado al cambiar cliente)
    + 'function refrescarPrecios(){'
    + '  var prod=v("prodSel");'
    + '  if(!prod) return;'
    + '  if(FLAVORS[prod]){'
    + '    var sel=document.getElementById("varSel");'
    + '    if(!sel.value) return;'
    + '    var opt=sel.options[sel.selectedIndex];'
    + '    var tier=opt?opt.getAttribute("data-tier"):null;'
    + '    mostrarPrecios(prod,tier||null);'
    + '  } else { mostrarPrecios(prod,null); }'
    + '}'

    // ── Panel de precios de referencia ──
    + 'function mostrarPrecios(prod,tier){'
    + '  var panel=document.getElementById("panelPrecios");'
    + '  var p1=p1De(prod,tier);'
    + '  if(p1==null){'
    + '    panel.innerHTML=\'<div class="pp-nota">⚠ Este producto no tiene precio configurado. Cargá el precio unitario a mano.</div>\';'
    + '    panel.className="panel-precios show";'
    + '    return;'
    + '  }'
    + '  var pa=precioAnanaiDe(prod);'
    + '  var ananai=(pa!==null)?pa:p1;'
    + '  var esEspecial=(pa!==null);'
    + '  var h=\'<div class="pp-title">💡 Precios de referencia — tocá para usar, o copialo a mano</div><div class="pp-row">\';'
    + '  var pl=pLibreDe(prod,tier);'
    + '  if(pl!=null){ h+=\'<button type="button" class="pp-chip pp-libre" onclick="usarPrecio(\'+pl+\')"><span class="pp-lbl">Precio Libre</span><span class="pp-val">$\'+pl.toLocaleString("es-AR")+\'</span></button>\'; }'
    + '  h+=\'<button type="button" class="pp-chip" onclick="usarPrecio(\'+p1+\')"><span class="pp-lbl">Precio P1</span><span class="pp-val">$\'+p1.toLocaleString("es-AR")+\'</span></button>\';'
    + '  if(esEspecial){'
    + '    h+=\'<button type="button" class="pp-chip pp-ana" onclick="usarPrecio(\'+ananai+\')"><span class="pp-lbl">Precio Añañai</span><span class="pp-val">$\'+ananai.toLocaleString("es-AR")+\'</span></button>\';'
    + '  } else {'
    + '    h+=\'<div class="pp-chip pp-eq"><span class="pp-lbl">Precio Añañai</span><span class="pp-val">= P1 ($\'+ananai.toLocaleString("es-AR")+\')</span></div>\';'
    + '  }'
    + '  h+=\'</div>\';'
    + '  if(esAnanai&&esEspecial){ h+=\'<div class="pp-hint">🏪 Cliente Añañai: corresponde el precio Añañai ($\'+ananai.toLocaleString("es-AR")+\').</div>\'; }'
    + '  panel.innerHTML=h;'
    + '  panel.className="panel-precios show";'
    + '}'

    + 'function usarPrecio(val){'
    + '  document.getElementById("precioInp").value=val;'
    + '  calcMonto();'
    + '}'

    + 'function limpiarPrecio(){'
    + '  var panel=document.getElementById("panelPrecios");'
    + '  panel.innerHTML=""; panel.className="panel-precios";'
    + '}'

    + 'function calcMonto(){'
    + '  var uni=Number(document.getElementById("uniInp").value)||0;'
    + '  var precio=Number(document.getElementById("precioInp").value)||0;'
    + '  var montoInp=document.getElementById("montoInp");'
    + '  montoInp.value=(uni>0&&precio>0)?uni*precio:"";'
    + '}'

    // ── Guardar ──
    + 'function onCondChange(){var c=v("condSel");var h=document.getElementById("hintCond");if(h)h.style.display=(c==="Contado")?"block":"none";}'
    + 'function guardar(){'
    + '  var cliSel=document.getElementById("cliSel");'
    + '  var opt=cliSel.options[cliSel.selectedIndex];'
    + '  var cliId=cliSel.value;'
    + '  var clienteNombre=opt.getAttribute("data-nombre")||"";'
    + '  var prod=v("prodSel");'
    + '  var varSel=document.getElementById("varSel");'
    + '  var vopt=varSel.options[varSel.selectedIndex];'
    + '  var tier=vopt?vopt.getAttribute("data-tier"):null;'
    + '  var variante=FLAVORS[prod]?varSel.value:"";'
    + '  var uniVal=v("uniInp");'
    + '  var precioVal=document.getElementById("precioInp").value;'
    + '  var condicion=v("condSel"); var obs=v("obsInp");'
    + '  var err=[];'
    + '  if(!cliId) err.push("Cliente");'
    + '  if(!prod) err.push("Producto");'
    + '  if(FLAVORS[prod]&&!variante) err.push("Sabor");'
    + '  if(!uniVal||Number(uniVal)<=0) err.push("Unidades");'
    + '  if(!precioVal||Number(precioVal)<=0) err.push("Precio unitario");'
    + '  if(err.length){show("Completá: "+err.join(", "),false);return;}'
    + '  var precio=Number(precioVal);'
    + '  var unidad=unidadDe(prod,tier);'
    // precioTipo: si el precio ingresado coincide con el Añañai especial, se etiqueta así
    + '  var pa=precioAnanaiDe(prod);'
    + '  var precioTipo=(esAnanai&&pa!==null&&precio===pa)?"Precio Añañai":"P1";'
    + '  var payload={cliId:cliId,clienteNombre:clienteNombre,producto:prod,variante:variante,'
    + '    unidad:unidad,unidades:uniVal,precio:precio,precioTipo:precioTipo,'
    + '    condicion:condicion,obs:obs,forzarSinStock:false,motivoForzado:""};'
    + '  document.getElementById("wrapForzar").style.display="none";'
    + '  enviarDespacho(payload);'
    + '}'

    // Envía el despacho al servidor. Si vuelve con necesitaConfirmacion=true
    // (no hay stock suficiente), NO se guardó nada todavía: se muestra el
    // aviso y se pide un motivo antes de reintentar con forzarSinStock=true.
    + 'var pendienteForzar=null;'
    + 'function enviarDespacho(payload){'
    + '  sp(true);'
    + '  google.script.run'
    + '    .withSuccessHandler(function(r){'
    + '      sp(false);'
    + '      if(!r.ok && r.necesitaConfirmacion){'
    + '        pendienteForzar=payload;'
    + '        document.getElementById("txtForzar").innerHTML="⚠ "+r.mensaje+" Si confirmás, la venta se guarda igual y el stock puede quedar en negativo — va a quedar anotado en la hoja \'Alertas Stock\' para revisar después.";'
    + '        var wf=document.getElementById("wrapForzar"); wf.style.display="block";'
    + '        wf.scrollIntoView({behavior:"smooth",block:"nearest"});'
    + '        return;'
    + '      }'
    + '      show(r.mensaje,r.ok);'
    + '      if(r.ok) limpiar();'
    + '    })'
    + '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})'
    + '    .guardarDespacho(payload);'
    + '}'

    + 'function confirmarForzar(){'
    + '  var motivo=document.getElementById("motivoInp").value.trim();'
    + '  if(!motivo){ show("Escribí el motivo para poder imputar igual.",false); return; }'
    + '  if(!pendienteForzar) return;'
    + '  pendienteForzar.forzarSinStock=true;'
    + '  pendienteForzar.motivoForzado=motivo;'
    + '  document.getElementById("wrapForzar").style.display="none";'
    + '  enviarDespacho(pendienteForzar);'
    + '}'

    + 'function cancelarForzar(){'
    + '  pendienteForzar=null;'
    + '  document.getElementById("wrapForzar").style.display="none";'
    + '  document.getElementById("motivoInp").value="";'
    + '}'

    + 'function limpiar(){'
    + '  ["cliSel","prodSel","varSel","condSel","obsInp"].forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});'
    + '  ["uniInp","precioInp","montoInp"].forEach(function(id){document.getElementById(id).value="";});'
    + '  document.getElementById("hintCli").className="hint";'
    + '  document.getElementById("varWrap").style.display="none";'
    + '  limpiarPrecio();'
    + '  esAnanai=false; acumMes=0; pendienteForzar=null;'
    + '  document.getElementById("motivoInp").value="";'
    + '  document.getElementById("wrapForzar").style.display="none";'
    + '  document.getElementById("msg").style.display="none";'
    + '}'

    + 'function v(id){return document.getElementById(id).value.trim();}'
    + 'function show(txt,ok){var el=document.getElementById("msg");el.textContent=txt;el.className="msg "+(ok?"ok":"er");el.style.display="block";}'
    + 'function sp(on){document.getElementById("sp").style.display=on?"block":"none";}'
    + formUXJS()
    + '<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// HTML — FORMULARIO COBRO
// ════════════════════════════════════════════════════════════════
function buildFormCobroHTML(clientes, cxc) {
  var cliOpts = clientes.map(function(c){
    var saldo = cxc[c.nombre] ? ' — CXC: $'+Math.round(cxc[c.nombre]).toLocaleString('es-AR') : '';
    return '<option value="'+c.id+'" data-nombre="'+c.nombre+'" data-cxc="'+(cxc[c.nombre]||0)+'">'+c.nombre+saldo+'</option>';
  }).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + sharedCSS()+'</head><body>'
    + '<div class="hdr" style="background:#1F3864"><h2>💰 Registrar Cobro</h2>'
    + '<p>El saldo CXC del cliente se muestra al seleccionarlo</p></div>'
    + '<div class="body">'

    + '<div class="field"><label>Cliente<span class="req">*</span></label>'
    + '<select id="cliSel" onchange="onCliChange()"><option value="">— Seleccioná —</option>'+cliOpts+'</select>'
    + '<div class="hint hint-info" id="hintCXC"></div></div>'

    + '<div class="r2">'
    + '<div class="field"><label>Monto cobrado ($)<span class="req">*</span></label>'
    + '<input type="number" id="montoInp" placeholder="0" style="font-size:16px;font-weight:700;color:#1F3864" oninput="calcNeto()"></div>'
    + '<div class="field"><label>Dto. pronto pago ($) <span style="font-weight:400;color:#888">(opcional)</span></label>'
    + '<input type="number" id="descInp" placeholder="0" oninput="calcNeto()"></div>'
    + '</div>'

    + '<div class="hint hint-ok" id="hintNeto" style="margin-bottom:10px"></div>'

    + '<div class="r2">'
    + '<div class="field"><label>Forma de pago</label>'
    + '<select id="formaSel"><option value="">— Seleccioná —</option>'
    + '<option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Otro</option></select></div>'
    + '<div class="field"><label>N° de transferencia / referencia</label>'
    + '<input type="text" id="refInp" placeholder="ej: 0000123456"></div>'
    + '</div>'

    + '<div class="field"><label>Caja<span class="req">*</span> <span style="font-weight:400;color:#888">— a qué caja entra el dinero</span></label>'
    + '<select id="cajaSel">'+cajaOptionsHTML('Distribuidora')+'</select></div>'

    + '<div class="field"><label>DES-IDs cubiertos <span style="font-weight:400;color:#888">(opcional)</span></label>'
    + '<input type="text" id="desIdsInp" placeholder="ej: DES-023, DES-024 — o \'acumulado junio\'"></div>'

    + '<div class="field"><label>Observaciones</label>'
    + '<textarea id="obsInp" placeholder="Notas adicionales…"></textarea></div>'

    + '<div class="btns"><button class="b1" style="background:#1F3864" onclick="guardar()">💾 Registrar cobro</button>'
    + '<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    + '<div class="sp" id="sp">⏳ Guardando…</div>'
    + '<div class="msg" id="msg"></div>'
    + '</div>'

    + '<script>'
    + 'function onCliChange(){'
    + '  var sel=document.getElementById("cliSel");'
    + '  var cxc=Number(sel.options[sel.selectedIndex].getAttribute("data-cxc"))||0;'
    + '  var hint=document.getElementById("hintCXC");'
    + '  if(!sel.value){hint.className="hint";return;}'
    + '  hint.textContent=cxc>0?"CXC pendiente: $"+Math.round(cxc).toLocaleString("es-AR"):"✓ Sin saldo pendiente registrado";'
    + '  hint.className="hint "+(cxc>0?"hint-warn":"hint-ok")+" show";'
    + '}'
    + 'function calcNeto(){'
    + '  var m=Number(document.getElementById("montoInp").value)||0;'
    + '  var d=Number(document.getElementById("descInp").value)||0;'
    + '  var hint=document.getElementById("hintNeto");'
    + '  if(d>0){hint.textContent="Monto neto aplicado al CXC: $"+(m+d).toLocaleString("es-AR")+" ($"+m.toLocaleString("es-AR")+" cobrado + $"+d.toLocaleString("es-AR")+" descuento)";hint.className="hint hint-ok show";}'
    + '  else{hint.className="hint";}'
    + '}'
    + 'function guardar(){'
    + '  var sel=document.getElementById("cliSel");'
    + '  var opt=sel.options[sel.selectedIndex];'
    + '  var cliId=sel.value; var nombre=opt.getAttribute("data-nombre")||"";'
    + '  var monto=v("montoInp");'
    + '  var err=[];'
    + '  if(!cliId)err.push("Cliente");'
    + '  if(!monto||Number(monto)<=0)err.push("Monto");'
    + '  if(err.length){show("Completá: "+err.join(", "),false);return;}'
    + '  sp(true);'
    + '  google.script.run'
    + '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);if(r.ok)limpiar();})'
    + '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})'
    + '    .guardarCobro({cliId:cliId,clienteNombre:nombre,monto:monto,'
    + '      descuento:v("descInp"),formaPago:v("formaSel"),referencia:v("refInp"),'
    + '      caja:v("cajaSel"),desIds:v("desIdsInp"),obs:v("obsInp")});'
    + '}'
    + 'function limpiar(){'
    + '  ["cliSel","formaSel","obsInp","refInp","desIdsInp"].forEach(function(id){document.getElementById(id).value="";});'
    + '  var cj=document.getElementById("cajaSel"); if(cj) cj.value="Distribuidora";'
    + '  ["montoInp","descInp"].forEach(function(id){document.getElementById(id).value="";});'
    + '  ["hintCXC","hintNeto"].forEach(function(id){document.getElementById(id).className="hint";});'
    + '  document.getElementById("msg").style.display="none";'
    + '}'
    + 'function v(id){return document.getElementById(id).value.trim();}'
    + 'function show(txt,ok){var el=document.getElementById("msg");el.textContent=txt;el.className="msg "+(ok?"ok":"er");el.style.display="block";}'
    + 'function sp(on){document.getElementById("sp").style.display=on?"block":"none";}'
    + formUXJS()
    + '<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// HTML — FORMULARIO NOTA DE CRÉDITO
// ════════════════════════════════════════════════════════════════
function buildFormNCHTML(clientes) {
  var cliOpts = clientes.map(function(c){
    return '<option value="'+c.id+'" data-nombre="'+c.nombre+'">'+c.nombre+'</option>';
  }).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + sharedCSS()+'</head><body>'
    + '<div class="hdr" style="background:#7B2D00"><h2>↩ Nota de Crédito</h2>'
    + '<p>Registrá una devolución · afecta CXC y facturación neta</p></div>'
    + '<div class="body">'
    + '<div class="field"><label>Cliente<span class="req">*</span></label>'
    + '<select id="cliSel"><option value="">— Seleccioná —</option>'+cliOpts+'</select></div>'
    + '<div class="field"><label>DES-ID del despacho original <span style="font-weight:400;color:#888">(opcional)</span></label>'
    + '<input type="text" id="desIdInp" placeholder="ej: DES-023"></div>'
    + '<div class="field"><label>Monto de la nota de crédito ($)<span class="req">*</span></label>'
    + '<input type="number" id="montoInp" placeholder="0" style="font-size:16px;font-weight:700;color:#7B2D00"></div>'
    + '<div class="field"><label>Motivo<span class="req">*</span></label>'
    + '<select id="motivoSel"><option value="">— Seleccioná —</option>'
    + '<option>Producto en mal estado</option>'
    + '<option>Error en pedido</option>'
    + '<option>Exceso de stock</option>'
    + '<option>Otro</option></select></div>'
    + '<div class="field"><label>El crédito se aplica a</label>'
    + '<select id="aplicaSel">'
    + '<option value="Próximo despacho">Próximo despacho (crédito a favor)</option>'
    + '<option value="Reintegro efectivo">Reintegro en efectivo</option>'
    + '</select></div>'
    + '<div class="btns"><button class="b1" style="background:#7B2D00" onclick="guardar()">💾 Registrar NC</button>'
    + '<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    + '<div class="sp" id="sp">⏳ Guardando…</div>'
    + '<div class="msg" id="msg"></div>'
    + '</div>'
    + '<script>'
    + 'function guardar(){'
    + '  var sel=document.getElementById("cliSel");'
    + '  var opt=sel.options[sel.selectedIndex];'
    + '  var cliId=sel.value; var nombre=opt.getAttribute("data-nombre")||"";'
    + '  var monto=v("montoInp"); var motivo=v("motivoSel");'
    + '  var err=[];'
    + '  if(!cliId)err.push("Cliente");'
    + '  if(!monto||Number(monto)<=0)err.push("Monto");'
    + '  if(!motivo)err.push("Motivo");'
    + '  if(err.length){show("Completá: "+err.join(", "),false);return;}'
    + '  sp(true);'
    + '  google.script.run'
    + '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);if(r.ok)limpiar();})'
    + '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})'
    + '    .guardarNC({cliId:cliId,clienteNombre:nombre,desIdOrigen:v("desIdInp"),'
    + '      monto:monto,motivo:v("motivoSel"),aplicaA:v("aplicaSel")});'
    + '}'
    + 'function limpiar(){'
    + '  ["cliSel","desIdInp","motivoSel","aplicaSel"].forEach(function(id){document.getElementById(id).value="";});'
    + '  document.getElementById("montoInp").value="";'
    + '  document.getElementById("msg").style.display="none";'
    + '}'
    + 'function v(id){return document.getElementById(id).value.trim();}'
    + 'function show(txt,ok){var el=document.getElementById("msg");el.textContent=txt;el.className="msg "+(ok?"ok":"er");el.style.display="block";}'
    + 'function sp(on){document.getElementById("sp").style.display=on?"block":"none";}'
    + formUXJS()
    + '<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// HTML — FORMULARIO CLIENTE NUEVO
// ════════════════════════════════════════════════════════════════
function buildFormClienteHTML() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + sharedCSS()+'</head><body>'
    + '<div class="hdr" style="background:#2F5496"><h2>👤 Nuevo Cliente</h2>'
    + '<p>Se agrega al maestro y queda disponible en todos los formularios</p></div>'
    + '<div class="body">'
    + '<div class="field"><label>Nombre completo<span class="req">*</span></label>'
    + '<input type="text" id="nomInp" placeholder="Nombre del cliente"></div>'
    + '<div class="r2">'
    + '<div class="field"><label>Condición default</label>'
    + '<select id="condSel"><option value="Crédito">Crédito</option><option value="Contado">Contado</option></select></div>'
    + '<div class="field"><label>Días de crédito</label>'
    + '<input type="number" id="diasInp" placeholder="0" min="0"></div>'
    + '</div>'
    + '<div class="btns"><button class="b1" style="background:#2F5496" onclick="guardar()">💾 Agregar cliente</button>'
    + '<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    + '<div class="sp" id="sp">⏳ Guardando…</div>'
    + '<div class="msg" id="msg"></div>'
    + '</div>'
    + '<script>'
    + 'function guardar(){'
    + '  var nom=v("nomInp");'
    + '  if(!nom){show("Completá el nombre",false);return;}'
    + '  sp(true);'
    + '  google.script.run'
    + '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);if(r.ok)limpiar();})'
    + '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})'
    + '    .guardarClienteNuevo({nombre:nom,condicion:v("condSel"),diasCred:v("diasInp")});'
    + '}'
    + 'function limpiar(){["nomInp","diasInp"].forEach(function(id){document.getElementById(id).value="";});document.getElementById("condSel").value="Crédito";document.getElementById("msg").style.display="none";}'
    + 'function v(id){return document.getElementById(id).value.trim();}'
    + 'function show(txt,ok){var el=document.getElementById("msg");el.textContent=txt;el.className="msg "+(ok?"ok":"er");el.style.display="block";}'
    + 'function sp(on){document.getElementById("sp").style.display=on?"block":"none";}'
    + formUXJS()
    + '<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// HTML — ACTUALIZAR PRECIO
// ════════════════════════════════════════════════════════════════
function buildFormPrecioHTML(productos) {
  var opts = productos.map(function(p){
    var label = p.nombre + (p.variante ? ' — '+p.variante : '');
    var suffix = p.tienePrecio ? '' : ' ⚠ sin precio';
    return '<option value="'+label+'" data-nombre="'+p.nombre+'" data-var="'+p.variante+'" data-plibre="'+(p.pLibre||'')+'" data-p1="'+(p.p1||'')+'">'+label+suffix+'</option>';
  }).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + sharedCSS()+'</head><body>'
    + '<div class="hdr" style="background:#1F3864"><h2>💲 Actualizar Precio</h2>'
    + '<p>PLibre = precio base · P1 = precio si cliente acumula +400 u./mes</p></div>'
    + '<div class="body">'
    + '<div class="field"><label>Producto<span class="req">*</span></label>'
    + '<select id="prodSel" onchange="onProdSel()"><option value="">— Seleccioná —</option>'+opts+'</select></div>'
    + '<div class="r2">'
    + '<div class="field"><label>Precio Libre ($)<span class="req">*</span></label>'
    + '<input type="number" id="pLibreInp" placeholder="0"></div>'
    + '<div class="field"><label>Precio P1 ($) — +400 u.<span class="req">*</span></label>'
    + '<input type="number" id="p1Inp" placeholder="0"></div>'
    + '</div>'
    + '<div class="btns"><button class="b1" style="background:#1F3864" onclick="guardar()">💾 Actualizar</button>'
    + '<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    + '<div class="sp" id="sp">⏳ Guardando…</div>'
    + '<div class="msg" id="msg"></div>'
    + '</div>'
    + '<script>'
    + 'function onProdSel(){'
    + '  var sel=document.getElementById("prodSel");'
    + '  var opt=sel.options[sel.selectedIndex];'
    + '  var pL=opt.getAttribute("data-plibre"); var p1=opt.getAttribute("data-p1");'
    + '  document.getElementById("pLibreInp").value=pL||"";'
    + '  document.getElementById("p1Inp").value=p1||"";'
    + '}'
    + 'function guardar(){'
    + '  var sel=document.getElementById("prodSel");'
    + '  var opt=sel.options[sel.selectedIndex];'
    + '  var prod=opt.getAttribute("data-nombre"); var vari=opt.getAttribute("data-var");'
    + '  var pL=v("pLibreInp"); var p1=v("p1Inp");'
    + '  var err=[];'
    + '  if(!sel.value)err.push("Producto");'
    + '  if(!pL||Number(pL)<=0)err.push("Precio Libre");'
    + '  if(!p1||Number(p1)<=0)err.push("Precio P1");'
    + '  if(err.length){show("Completá: "+err.join(", "),false);return;}'
    + '  sp(true);'
    + '  google.script.run'
    + '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);})'
    + '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})'
    + '    .actualizarPrecio({producto:prod,variante:vari||"",pLibre:pL,p1:p1});'
    + '}'
    + 'function limpiar(){["prodSel","pLibreInp","p1Inp"].forEach(function(id){document.getElementById(id).value="";});document.getElementById("msg").style.display="none";}'
    + 'function v(id){return document.getElementById(id).value.trim();}'
    + 'function show(txt,ok){var el=document.getElementById("msg");el.textContent=txt;el.className="msg "+(ok?"ok":"er");el.style.display="block";}'
    + 'function sp(on){document.getElementById("sp").style.display=on?"block":"none";}'
    + formUXJS()
    + '<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// DATOS HISTÓRICOS EMBEBIDOS
// 543 despachos + 49 cobros — regenerados del Registro Operativo (todo a crédito/CxC)
// Período: 05/05/2026 – 27/06/2026
// Transformaciones: clientes normalizados, precios completados (P1),
// montos recalculados, 1 cobro duplicado excluido
// ════════════════════════════════════════════════════════════════
var HIST_DESPACHOS = [["DES-001", "2026-05-05", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-002", "2026-05-05", "Añañai", "bollos", "", 36, 1054, "Registrado", 37944, "Crédito", "Pendiente", 0, false, ""], ["DES-003", "2026-05-05", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 30, 6300, "Registrado", 189000, "Crédito", "Pendiente", 0, false, ""], ["DES-004", "2026-05-05", "Añañai", "Tartines", "Tartin — Capresse", 30, 5600, "Registrado", 168000, "Crédito", "Pendiente", 0, false, ""], ["DES-005", "2026-05-05", "Añañai", "Tartines", "Tartin — Espinaca", 15, 5600, "Registrado", 84000, "Crédito", "Pendiente", 0, false, ""], ["DES-006", "2026-05-05", "Añañai", "Pan de Molde", "Pan de Molde", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-007", "2026-05-05", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-008", "2026-05-05", "Añañai", "focaccia", "", 10, 553, "Registrado", 5530, "Crédito", "Pendiente", 0, false, ""], ["DES-009", "2026-05-05", "Añañai", "fajitas para tacos", "", 100, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-010", "2026-05-06", "Añañai", "Pan de Molde", "Pan de Molde", 37, 2960, "Registrado", 109520, "Crédito", "Pendiente", 0, false, ""], ["DES-011", "2026-05-06", "Añañai", "Pan Hamburguesa", "", 30, 433, "Registrado", 12990, "Crédito", "Pendiente", 0, false, ""], ["DES-012", "2026-05-06", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-013", "2026-05-06", "Añañai", "Tartines", "Tartin — Pollo", 30, 6300, "Registrado", 189000, "Crédito", "Pendiente", 0, false, ""], ["DES-014", "2026-05-07", "Añañai", "fajitas para tacos", "", 150, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-015", "2026-05-07", "Añañai", "bollos", "", 24, 1054, "Registrado", 25296, "Crédito", "Pendiente", 0, false, ""], ["DES-016", "2026-05-07", "Añañai", "pan", "ovalados", 6, 526, "Registrado", 3156, "Crédito", "Pendiente", 0, false, ""], ["DES-017", "2026-05-07", "Añañai", "Pan Hamburguesa", "", 30, 433, "Registrado", 12990, "Crédito", "Pendiente", 0, false, ""], ["DES-018", "2026-05-07", "Añañai", "Pan de Molde", "Pan de Molde", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-019", "2026-05-07", "Llevo Carlos Losch", "Tartines", "Tartin — Atún", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-020", "2026-05-07", "Llevo Carlos Losch", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-021", "2026-05-07", "Llevo Carlos Losch", "Tartines", "Tartin — Espinaca", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-022", "2026-05-07", "Llevo Carlos Losch", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-023", "2026-05-07", "Llevo Carlos Losch", "Tartines", "Tartin — Cebolla y Queso", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-024", "2026-05-07", "Llevo Carlos Losch", "Tartines", "Tartin — Capresse", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-025", "2026-05-07", "Llevo Carlos Losch", "Tartines", "Tartin — Pollo", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-026", "2026-05-07", "Llevo Carlos Losch", "Pizzas", "Pizza - Especial", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-027", "2026-05-07", "Llevo Carlos Losch", "Pizzas", "Pizza — Pesto", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-028", "2026-05-07", "Llevo Carlos Losch", "Pizzas", "Pizza - capresse", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-029", "2026-05-08", "Añañai", "Pan Hamburguesa", "", 150, 433, "Registrado", 64950, "Crédito", "Pendiente", 0, false, ""], ["DES-030", "2026-05-08", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-031", "2026-05-08", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-032", "2026-05-08", "Añañai", "Medialunas (unidades en docena)", "Medialunas", 37, 1300, "Registrado", 48100, "Crédito", "Pendiente", 0, false, ""], ["DES-033", "2026-05-08", "Añañai", "Chipalmendras (bolsa 500g)", "Chipalmendra — Común", 6, 5200, "Registrado", 31200, "Crédito", "Pendiente", 0, false, ""], ["DES-034", "2026-05-09", "Añañai", "Medialunas (unidades en docena)", "Medialunas", 80, 1300, "Registrado", 104000, "Crédito", "Pendiente", 0, false, ""], ["DES-035", "2026-05-11", "Añañai", "pan", "Pan de Molde", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-036", "2026-05-11", "Añañai", "pan", "Pan de Molde", 12, 2960, "Registrado", 35520, "Crédito", "Pendiente", 0, false, ""], ["DES-037", "2026-05-12", "Añañai", "pan", "Pan de Molde", 12, 2960, "Registrado", 35520, "Crédito", "Pendiente", 0, false, ""], ["DES-038", "2026-05-13", "Añañai", "pan", "Pan de Molde", 17, 2960, "Registrado", 50320, "Crédito", "Pendiente", 0, false, ""], ["DES-039", "2026-05-13", "Añañai", "Medialunas (unidades en docena)", "Medialunas", 48, 1300, "Registrado", 62400, "Crédito", "Pendiente", 0, false, ""], ["DES-040", "2026-05-13", "Añañai", "creps", "", 20, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-041", "2026-05-13", "Añañai", "pan", "Pan de Molde", 18, 2960, "Registrado", 53280, "Crédito", "Pendiente", 0, false, ""], ["DES-042", "2026-05-14", "Añañai", "pan", "Pan de Molde", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-043", "2026-05-14", "Añañai", "pan", "arabe", 20, 270, "Registrado", 5400, "Crédito", "Pendiente", 0, false, ""], ["DES-044", "2026-05-15", "Añañai", "Medialunas (unidades en docena)", "", 120, 1300, "Registrado", 156000, "Crédito", "Pendiente", 0, false, ""], ["DES-045", "2026-05-15", "Añañai", "fajitas para tacos", "", 90, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-046", "2026-05-15", "Añañai", "pan", "Pan de Molde", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-047", "2026-05-15", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-048", "2026-05-15", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-049", "2026-05-15", "Añañai", "bollos", "", 36, 1054, "Registrado", 37944, "Crédito", "Pendiente", 0, false, ""], ["DES-050", "2026-05-15", "Añañai", "focaccia", "", 9, 553, "Registrado", 4977, "Crédito", "Pendiente", 0, false, ""], ["DES-051", "2026-05-15", "Añañai", "Medialunas (unidades en docena)", "Medialunas", 120, 1300, "Registrado", 156000, "Crédito", "Pendiente", 0, false, ""], ["DES-052", "2026-05-15", "Añañai", "fajitas para tacos", "", 90, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-053", "2026-05-18", "Añañai", "Medialunas (unidades en docena)", "Medialunas", 86, 1300, "Registrado", 111800, "Crédito", "Pendiente", 0, false, ""], ["DES-054", "2026-05-18", "Añañai", "Tartines", "Tartin — Jamón y Queso", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-055", "2026-05-18", "Añañai", "Tartines", "Tartin — Cebolla y Queso", 20, 5600, "Registrado", 112000, "Crédito", "Pendiente", 0, false, ""], ["DES-056", "2026-05-18", "Añañai", "Tartines", "Tartin — Pollo", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-057", "2026-05-18", "Añañai", "Pan Hamburguesa", "", 30, 433, "Registrado", 12990, "Crédito", "Pendiente", 0, false, ""], ["DES-058", "2026-05-18", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-059", "2026-05-18", "Añañai", "Tartines", "Tartin — Espinaca", 30, 5600, "Registrado", 168000, "Crédito", "Pendiente", 0, false, ""], ["DES-060", "2026-05-18", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-061", "2026-05-18", "Añañai", "pan", "Pan de Molde", 46, 6800, "Registrado", 312800, "Crédito", "Pendiente", 0, false, ""], ["DES-062", "2026-05-19", "Añañai", "bollos", "", 18, 1054, "Registrado", 18972, "Crédito", "Pendiente", 0, false, ""], ["DES-063", "2026-05-19", "Añañai", "pan", "Pan de Molde", 46, 2960, "Registrado", 136160, "Crédito", "Pendiente", 0, false, ""], ["DES-064", "2026-05-19", "Añañai", "Chipalmendras (bolsa 500g)", "", 20, 5200, "Registrado", 104000, "Crédito", "Pendiente", 0, false, ""], ["DES-065", "2026-05-19", "Añañai", "creps", "", 20, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-066", "2026-05-19", "Añañai", "pan", "arabe", 20, 270, "Registrado", 5400, "Crédito", "Pendiente", 0, false, ""], ["DES-067", "2026-05-20", "Añañai", "pan", "Pan de Molde", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-068", "2026-05-20", "Añañai", "focaccia", "", 20, 553, "Registrado", 11060, "Crédito", "Pendiente", 0, false, ""], ["DES-069", "2026-05-21", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-070", "2026-05-21", "Añañai", "Medialunas (unidades en docena)", "Medialunas", 124, 1300, "Registrado", 161200, "Crédito", "Pendiente", 0, false, ""], ["DES-071", "2026-05-21", "Añañai", "fajitas para tacos", "", 150, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-072", "2026-05-21", "Añañai", "Tartines", "Tartin — Cebolla y Queso", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-073", "2026-05-21", "Añañai", "Tartines", "Tartin — Capresse", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-074", "2026-05-21", "Añañai", "Tartines", "Tartin — Espinaca", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-075", "2026-05-21", "Añañai", "Tartines", "Tartin — Pollo", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-076", "2026-05-21", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-077", "2026-05-21", "Añañai", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-078", "2026-05-22", "Añañai", "sorrentino", "", 80, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-079", "2026-05-22", "Añañai", "fideos", "fetucchini", null, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-080", "2026-05-22", "Añañai", "disco de empanadas", "", 192, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-081", "2026-05-22", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-082", "2026-05-22", "Añañai", "Pan Hamburguesa", "", 150, 433, "Registrado", 64950, "Crédito", "Pendiente", 0, false, ""], ["DES-083", "2026-05-22", "Añañai", "Pan de Molde", "Pan de Molde", 37, 2960, "Registrado", 109520, "Crédito", "Pendiente", 0, false, ""], ["DES-084", "2026-05-22", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-085", "2026-05-22", "Añañai", "bollos", "", null, 1054, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-086", "2026-05-22", "Exhibidora Marconi", "Pizzas", "Pizza — Pesto", 5, 8000, "Registrado", 40000, "Crédito", "Pendiente", 0, false, ""], ["DES-087", "2026-05-22", "Exhibidora Marconi", "Pizzas", "Pizza - Especial", 5, 8500, "Registrado", 42500, "Crédito", "Pendiente", 0, false, ""], ["DES-088", "2026-05-22", "Exhibidora Marconi", "Pizzas", "Pizza — Napoleón", 5, 8000, "Registrado", 40000, "Crédito", "Pendiente", 0, false, ""], ["DES-089", "2026-05-22", "Exhibidora Marconi", "Pizzas", "Pizza — Cuatro Poderes", 5, 8500, "Registrado", 42500, "Crédito", "Pendiente", 0, false, ""], ["DES-090", "2026-05-22", "Exhibidora Marconi", "Tartines", "Tartin — Atún", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-091", "2026-05-22", "Exhibidora Marconi", "Tartines", "Tartin — Pollo", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-092", "2026-05-22", "Exhibidora Marconi", "Tartines", "Tartin — Verduras y Roquefort", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-093", "2026-05-22", "Exhibidora Marconi", "Tartines", "Tartin — Jamón y Queso", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-094", "2026-05-22", "Exhibidora Marconi", "Tartines", "Tartin — Cebolla y Queso", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-095", "2026-05-22", "Exhibidora Marconi", "Tartines", "Tartin — Capresse", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-096", "2026-05-22", "Exhibidora Marconi", "Tartines", "Tartin — Espinaca", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-097", "2026-05-22", "Exhibidora Marconi", "chipa vegano (bolsa 500g)", "", 10, 5200, "Registrado", 52000, "Crédito", "Pendiente", 0, false, ""], ["DES-098", "2026-05-22", "Exhibidora Marconi", "Medialunas (unidades en docena)", "", 32, 1300, "Registrado", 41600, "Crédito", "Pendiente", 0, false, ""], ["DES-099", "2026-05-26", "Añañai", "Pan de Molde", "", 46, 2960, "Registrado", 136160, "Crédito", "Pendiente", 0, false, ""], ["DES-100", "2026-05-26", "Añañai", "bollos", "", 32, 1054, "Registrado", 33728, "Crédito", "Pendiente", 0, false, ""], ["DES-101", "2026-05-26", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 30, 6300, "Registrado", 189000, "Crédito", "Pendiente", 0, false, ""], ["DES-102", "2026-05-26", "Añañai", "Tartines", "Tartin — Espinaca", 30, 5600, "Registrado", 168000, "Crédito", "Pendiente", 0, false, ""], ["DES-103", "2026-05-26", "Añañai", "Tartines", "Tartin — Pollo", 30, 6300, "Registrado", 189000, "Crédito", "Pendiente", 0, false, ""], ["DES-104", "2026-05-26", "Añañai", "creps", "", 30, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-105", "2026-05-26", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-106", "2026-05-26", "Añañai", "pan", "arabe", 20, 270, "Registrado", 5400, "Crédito", "Pendiente", 0, false, ""], ["DES-107", "2026-05-27", "Añañai", "pan", "Pan de Molde", 20, 2960, "Registrado", 59200, "Crédito", "Pendiente", 0, false, ""], ["DES-108", "2026-05-27", "Añañai", "Chipalmendras (bolsa 500g)", "", 10, 5200, "Registrado", 52000, "Crédito", "Pendiente", 0, false, ""], ["DES-109", "2026-05-27", "Añañai", "Medialunas (unidades en docena)", "", 36, 1300, "Registrado", 46800, "Crédito", "Pendiente", 0, false, ""], ["DES-110", "2026-05-27", "Añañai", "pan", "arabe", 24, 270, "Registrado", 6480, "Crédito", "Pendiente", 0, false, ""], ["DES-111", "2026-05-28", "Añañai", "pan", "arabe", 55, 270, "Registrado", 14850, "Crédito", "Pendiente", 0, false, ""], ["DES-112", "2026-05-28", "Añañai", "creps", "", 86, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-113", "2026-05-28", "Añañai", "Chipalmendras (bolsa 500g)", "", 6, 5200, "Registrado", 31200, "Crédito", "Pendiente", 0, false, ""], ["DES-114", "2026-05-28", "Añañai", "Pan Hamburguesa", "", 100, 433, "Registrado", 43300, "Crédito", "Pendiente", 0, false, ""], ["DES-115", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Tartin — Jamón y Queso", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-116", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Tartin — Capresse", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-117", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Tartin — Cebolla y Queso", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-118", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Tartin — Verduras y Roquefort", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-119", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Tartin — Atún", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-120", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Tartin — Pollo", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-121", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Tartin — Espinaca", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-122", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Pizza — Napoleón", 4, 8000, "Registrado", 32000, "Crédito", "Pendiente", 0, false, ""], ["DES-123", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Pizza — Pesto", 4, 8000, "Registrado", 32000, "Crédito", "Pendiente", 0, false, ""], ["DES-124", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Pizza — Cuatro Poderes", 4, 8500, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-125", "2026-05-28", "Exhibidora Pacentini", "Tartines", "Pizza - Especial", 4, 8500, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-126", "2026-05-28", "Llevo Carlos Losch", "Tartines", "Tartin — Capresse", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-127", "2026-05-28", "Llevo Carlos Losch", "Tartines", "Tartin — Espinaca", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-128", "2026-05-28", "La Esperanza", "Medialunas (unidades en docena)", "Medialunas", 16, 1300, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-129", "2026-05-28", "La Esperanza", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-130", "2026-05-28", "La Esperanza", "Tartines", "Tartin — Pollo", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-131", "2026-05-28", "La Esperanza", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-132", "2026-05-28", "La Esperanza", "Tartines", "Tartin — Espinaca", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-133", "2026-05-28", "La Esperanza", "Tartines", "Tartin — Atún", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-134", "2026-05-29", "Añañai", "prepizzas", "", 87, 1202, "Registrado", 104574, "Crédito", "Pendiente", 0, false, ""], ["DES-135", "2026-05-29", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-136", "2026-05-29", "Añañai", "fajitas para tacos", "", 60, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-137", "2026-05-29", "Añañai", "Medialunas (unidades en docena)", "", 36, 1300, "Registrado", 46800, "Crédito", "Pendiente", 0, false, ""], ["DES-138", "2026-05-29", "Añañai", "pan", "Pan de Molde", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-139", "2026-05-29", "Añañai", "bollos", "", 24, 1054, "Registrado", 25296, "Crédito", "Pendiente", 0, false, ""], ["DES-140", "2026-05-30", "Añañai", "Medialunas (unidades en docena)", "", 48, 1300, "Registrado", 62400, "Crédito", "Pendiente", 0, false, ""], ["DES-141", "2026-06-01", "La Esperanza", "Medialunas (unidades en docena)", "", 28, 1300, "Registrado", 36400, "Crédito", "Pendiente", 0, false, ""], ["DES-142", "2026-06-01", "La Esperanza", "Tartines", "Tartin — Jamón y Queso", 3, 6300, "Registrado", 18900, "Crédito", "Pendiente", 0, false, ""], ["DES-143", "2026-06-01", "La Esperanza", "Tartines", "Tartin — Pollo", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-144", "2026-06-01", "La Esperanza", "Tartines", "Tartin — Espinaca", 3, 5600, "Registrado", 16800, "Crédito", "Pendiente", 0, false, ""], ["DES-145", "2026-06-01", "La Esperanza", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-146", "2026-06-01", "La Esperanza", "Tartines", "Tartin — Atún", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-147", "2026-06-01", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-148", "2026-06-02", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-149", "2026-06-02", "Añañai", "creps", "", 60, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-150", "2026-06-02", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-151", "2026-06-02", "Añañai", "Pan Hamburguesa", "", 30, 433, "Registrado", 12990, "Crédito", "Pendiente", 0, false, ""], ["DES-152", "2026-06-02", "Añañai", "Medialunas (unidades en docena)", "", 120, 1300, "Registrado", 156000, "Crédito", "Pendiente", 0, false, ""], ["DES-153", "2026-06-02", "Añañai", "Tartines", "Tartin — Pollo", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-154", "2026-06-02", "Añañai", "Tartines", "Tartin — Capresse", 20, 5600, "Registrado", 112000, "Crédito", "Pendiente", 0, false, ""], ["DES-155", "2026-06-02", "Añañai", "Tartines", "Tartin — Cebolla y Queso", 30, 5600, "Registrado", 168000, "Crédito", "Pendiente", 0, false, ""], ["DES-156", "2026-06-03", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-157", "2026-06-03", "Añañai", "fajitas para tacos", "", 60, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-158", "2026-06-03", "Añañai", "Chipalmendras (bolsa 500g)", "", 6, 5200, "Registrado", 31200, "Crédito", "Pendiente", 0, false, ""], ["DES-159", "2026-06-03", "Añañai", "bollos", "", 38, 1054, "Registrado", 40052, "Crédito", "Pendiente", 0, false, ""], ["DES-160", "2026-06-04", "Añañai", "pan", "arabe", 24, 270, "Registrado", 6480, "Crédito", "Pendiente", 0, false, ""], ["DES-161", "2026-06-04", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-162", "2026-06-04", "Añañai", "bollos", "", 30, 1054, "Registrado", 31620, "Crédito", "Pendiente", 0, false, ""], ["DES-163", "2026-06-04", "Añañai", "Pan de Molde", "", 46, 2960, "Registrado", 136160, "Crédito", "Pendiente", 0, false, ""], ["DES-164", "2026-06-04", "Distribuidora", "Pizzas", "Pizza — Napoleón", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, "combos"], ["DES-165", "2026-06-04", "Distribuidora", "Pizzas", "Pizza — Pesto", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, "combos"], ["DES-166", "2026-06-04", "Distribuidora", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, "combos"], ["DES-167", "2026-06-04", "Distribuidora", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, "combos"], ["DES-168", "2026-06-04", "Distribuidora", "Tartines", "Tartin — Cebolla y Queso", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, "combos"], ["DES-169", "2026-06-04", "Distribuidora", "Tartines", "Tartin — Espinaca", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, "combos"], ["DES-170", "2026-06-05", "Amauta", "Medialunas (unidades en docena)", "", 48, 1300, "Registrado", 62400, "Crédito", "Pendiente", 0, false, ""], ["DES-171", "2026-06-05", "Añañai", "Pan Hamburguesa", "", 150, 433, "Registrado", 64950, "Crédito", "Pendiente", 0, false, ""], ["DES-172", "2026-06-05", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-173", "2026-06-05", "Añañai", "fajitas para tacos", "", 60, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-174", "2026-06-05", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-175", "2026-06-05", "Añañai", "focaccia", "", 8, 553, "Registrado", 4424, "Crédito", "Pendiente", 0, false, ""], ["DES-176", "2026-06-05", "Añañai", "bollos", "", 30, 1054, "Registrado", 31620, "Crédito", "Pendiente", 0, false, ""], ["DES-177", "2026-06-05", "Añañai", "Pan de Molde", "", 29, 2960, "Registrado", 85840, "Crédito", "Pendiente", 0, false, ""], ["DES-178", "2026-06-05", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-179", "2026-06-05", "Añañai", "Pizzas", "Pizza — Napoleón", 3, 8000, "Registrado", 24000, "Crédito", "Pendiente", 0, false, ""], ["DES-180", "2026-06-05", "Añañai", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-181", "2026-06-05", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-182", "2026-06-05", "Añañai", "Tartines", "Tartin — Cebolla y Queso", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-183", "2026-06-05", "Añañai", "Tartines", "Tartin — Pollo", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-184", "2026-06-05", "Añañai", "Tartines", "Tartin — Atún", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-185", "2026-06-05", "Añañai", "Tartines", "Tartin — Jamón y Queso", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-186", "2026-06-05", "Añañai", "Medialunas (unidades en docena)", "", 28, 1300, "Registrado", 36400, "Crédito", "Pendiente", 0, false, ""], ["DES-187", "2026-06-05", "Amauta", "Medialunas (unidades en docena)", "", 48, 1300, "Registrado", 62400, "Crédito", "Pendiente", 0, false, ""], ["DES-188", "2026-06-05", "La Esperanza", "Pan de Molde", "", 4, 6800, "Registrado", 27200, "Crédito", "Pendiente", 0, false, ""], ["DES-189", "2026-06-05", "La Esperanza", "Tartines", "Tartin — Espinaca", 4, 5600, "Registrado", 22400, "Crédito", "Pendiente", 0, false, ""], ["DES-190", "2026-06-05", "La Esperanza", "Tartines", "Tartin — Verduras y Roquefort", 3, 6300, "Registrado", 18900, "Crédito", "Pendiente", 0, false, ""], ["DES-191", "2026-06-05", "La Esperanza", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-192", "2026-06-05", "Añañai", "chipa vegano (bolsa 500g)", "", 4, 5200, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-193", "2026-06-08", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-194", "2026-06-08", "La Esperanza", "Pan de Molde", "", 5, 6800, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-195", "2026-06-08", "La Esperanza", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-196", "2026-06-08", "La Esperanza", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-197", "2026-06-09", "Añañai", "Chipalmendras (bolsa 500g)", "", 12, 5200, "Registrado", 62400, "Crédito", "Pendiente", 0, false, ""], ["DES-198", "2026-06-09", "Añañai", "Medialunas (unidades en docena)", "", 12, 1300, "Registrado", 15600, "Crédito", "Pendiente", 0, false, ""], ["DES-199", "2026-06-09", "Añañai", "bollos", "", 24, 1054, "Registrado", 25296, "Crédito", "Pendiente", 0, false, ""], ["DES-200", "2026-06-09", "Añañai", "Pan de Molde", "", 35, 2960, "Registrado", 103600, "Crédito", "Pendiente", 0, false, ""], ["DES-201", "2026-06-09", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-202", "2026-06-09", "Añañai", "creps", "", 60, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-203", "2026-06-09", "Añañai", "fajitas para tacos", "", 50, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-204", "2026-06-09", "Añañai", "Medialunas (unidades en docena)", "", 48, 1300, "Registrado", 62400, "Crédito", "Pendiente", 0, false, ""], ["DES-205", "2026-06-09", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-206", "2026-06-09", "Añañai", "Tartines", "Tartin — Espinaca", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-207", "2026-06-10", "Distribuidora", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-208", "2026-06-10", "Distribuidora", "Tartines", "Tartin — Jamón y Queso", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-209", "2026-06-10", "Distribuidora", "Pizzas", "Pizza — Napoleón", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-210", "2026-06-10", "Añañai", "Medialunas (unidades en docena)", "", 36, 1300, "Registrado", 46800, "Crédito", "Pendiente", 0, false, ""], ["DES-211", "2026-06-10", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-212", "2026-06-10", "Añañai", "fajitas para tacos", "", 70, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-213", "2026-06-10", "Añañai", "Tartines", "Tartin — Pollo", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-214", "2026-06-10", "Parque", "Pan de Molde", "", 10, 6800, "Registrado", 68000, "Crédito", "Pendiente", 0, false, ""], ["DES-215", "2026-06-11", "Parque", "Medialunas (unidades en docena)", "", 120, 1300, "Registrado", 156000, "Crédito", "Pendiente", 0, false, ""], ["DES-216", "2026-06-11", "Parque", "Chipalmendras (bolsa 500g)", "", null, 5200, "Sin precio", null, "Crédito", "Pendiente", 0, false, "ver el chipa (facu)"], ["DES-217", "2026-06-11", "Añañai", "Medialunas (unidades en docena)", "", 120, 1300, "Registrado", 156000, "Crédito", "Pendiente", 0, false, ""], ["DES-218", "2026-06-11", "Añañai", "prepizzas", "", 80, 1202, "Registrado", 96160, "Crédito", "Pendiente", 0, false, ""], ["DES-219", "2026-06-11", "Añañai", "Pan de Molde", "", 33, 2960, "Registrado", 97680, "Crédito", "Pendiente", 0, false, ""], ["DES-220", "2026-06-11", "Añañai", "Chipalmendras (bolsa 500g)", "", 9, 5200, "Registrado", 46800, "Crédito", "Pendiente", 0, false, ""], ["DES-221", "2026-06-11", "Añañai", "bollos", "", 34, 1054, "Registrado", 35836, "Crédito", "Pendiente", 0, false, ""], ["DES-222", "2026-06-12", "Añañai", "Pan Hamburguesa", "", 150, 433, "Registrado", 64950, "Crédito", "Pendiente", 0, false, ""], ["DES-223", "2026-06-12", "Añañai", "pan", "ovalados", 60, 526, "Registrado", 31560, "Crédito", "Pendiente", 0, false, ""], ["DES-224", "2026-06-12", "Añañai", "fajitas para tacos", "", 110, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-225", "2026-06-12", "Dietética Liniers", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-226", "2026-06-12", "Dietética Liniers", "Pizzas", "Pizza — Pesto", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-227", "2026-06-12", "Dietética Liniers", "Pizzas", "Pizza — Napoleón", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-228", "2026-06-12", "Dietética Liniers", "Pizzas", "Pizza - Especial", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-229", "2026-06-12", "Dietética Liniers", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-230", "2026-06-12", "Dietética Liniers", "Tartines", "Tartin — Atún", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-231", "2026-06-12", "Dietética Liniers", "Tartines", "Tartin — Pollo", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-232", "2026-06-12", "Dietética Liniers", "Tartines", "Tartin — Capresse", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-233", "2026-06-12", "Dietética Liniers", "Tartines", "Tartin — Cebolla y Queso", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-234", "2026-06-12", "Dietética Liniers", "Tartines", "Tartin — Espinaca", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-235", "2026-06-12", "Dietética Liniers", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-236", "2026-06-12", "Dietética Liniers", "Medialunas (unidades en docena)", "", 8, 1300, "Registrado", 10400, "Crédito", "Pendiente", 0, false, ""], ["DES-237", "2026-06-12", "Añañai", "focaccia", "", 10, 553, "Registrado", 5530, "Crédito", "Pendiente", 0, false, ""], ["DES-238", "2026-06-12", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-239", "2026-06-12", "Añañai", "bollos", "", 30, 1054, "Registrado", 31620, "Crédito", "Pendiente", 0, false, ""], ["DES-240", "2026-06-12", "Distribuidora", "Tartines", "Tartin — Espinaca", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-241", "2026-06-12", "Distribuidora", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-242", "2026-06-12", "Distribuidora", "Tartines", "Tartin — Cebolla y Queso", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-243", "2026-06-12", "Distribuidora", "Tartines", "Tartin — Atún", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-244", "2026-06-12", "Distribuidora", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-245", "2026-06-12", "Distribuidora", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-246", "2026-06-12", "Distribuidora", "Pizzas", "Pizza — Napoleón", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-247", "2026-06-12", "Distribuidora", "chipa vegano (bolsa 500g)", "", 2, 5200, "Registrado", 10400, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-248", "2026-06-12", "Distribuidora", "Medialunas (unidades en docena)", "", 4, 1300, "Registrado", 5200, "Crédito", "Pendiente", 0, false, "combo argentina"], ["DES-249", "2026-06-12", "La Esperanza", "Tartines", "Tartin — Jamón y Queso", 6, 6300, "Registrado", 37800, "Crédito", "Pendiente", 0, false, ""], ["DES-250", "2026-06-12", "La Esperanza", "Tartines", "Tartin — Verduras y Roquefort", 6, 6300, "Registrado", 37800, "Crédito", "Pendiente", 0, false, ""], ["DES-251", "2026-06-12", "La Esperanza", "Tartines", "Tartin — Espinaca", 6, 5600, "Registrado", 33600, "Crédito", "Pendiente", 0, false, ""], ["DES-252", "2026-06-12", "La Esperanza", "Tartines", "Tartin — Atún", 4, 6300, "Registrado", 25200, "Crédito", "Pendiente", 0, false, ""], ["DES-253", "2026-06-12", "La Esperanza", "Tartines", "Tartin — Pollo", 4, 6300, "Registrado", 25200, "Crédito", "Pendiente", 0, false, ""], ["DES-254", "2026-06-12", "Evento", "mini tartin", "", 850, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-255", "2026-06-12", "Evento", "sandwich pollo", "", 40, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-256", "2026-06-12", "Evento", "sandwich jyq", "", 40, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-257", "2026-06-12", "Evento", "sandwich verdura", "", 30, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-258", "2026-06-12", "Evento", "Medialunas (unidades en docena)", "", 150, 1300, "Completado (P1)", 195000, "Crédito", "Pendiente", 0, false, ""], ["DES-259", "2026-06-12", "Evento", "cookis", "", 380, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-260", "2026-06-12", "Evento", "chipa comun", "", null, 5200, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-261", "2026-06-15", "Añañai", "Pan de Molde", "", 30, 2960, "Registrado", 88800, "Crédito", "Pendiente", 0, false, ""], ["DES-262", "2026-06-15", "La Esperanza", "Medialunas (unidades en docena)", "", 28, 1300, "Registrado", 36400, "Crédito", "Pendiente", 0, false, ""], ["DES-263", "2026-06-16", "Añañai", "Pan de Molde", "", 14, 2960, "Registrado", 41440, "Crédito", "Pendiente", 0, false, ""], ["DES-264", "2026-06-16", "Añañai", "chipa comun", "", 10, 5200, "Registrado", 52000, "Crédito", "Pendiente", 0, false, ""], ["DES-265", "2026-06-16", "Añañai", "Pan Hamburguesa", "", 6, 433, "Registrado", 2598, "Crédito", "Pendiente", 0, false, ""], ["DES-266", "2026-06-16", "Añañai", "pan", "ovalados", 6, 526, "Registrado", 3156, "Crédito", "Pendiente", 0, false, ""], ["DES-267", "2026-06-16", "Añañai", "pan", "arabe", 6, 270, "Registrado", 1620, "Crédito", "Pendiente", 0, false, ""], ["DES-268", "2026-06-16", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-269", "2026-06-16", "Añañai", "pan", "arabe", 24, 270, "Registrado", 6480, "Crédito", "Pendiente", 0, false, ""], ["DES-270", "2026-06-16", "Añañai", "fajitas para tacos", "", 120, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-271", "2026-06-16", "Añañai", "Medialunas (unidades en docena)", "", 60, 1300, "Registrado", 78000, "Crédito", "Pendiente", 0, false, ""], ["DES-272", "2026-06-16", "Añañai", "Tartines", "Tartin — Capresse", 18, 5600, "Registrado", 100800, "Crédito", "Pendiente", 0, false, ""], ["DES-273", "2026-06-16", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 48, 6300, "Registrado", 302400, "Crédito", "Pendiente", 0, false, ""], ["DES-274", "2026-06-16", "Añañai", "Tartines", "Tartin — Pollo", 18, 6300, "Registrado", 113400, "Crédito", "Pendiente", 0, false, ""], ["DES-275", "2026-06-16", "Añañai", "Tartines", "Tartin — Atún", 18, 6300, "Registrado", 113400, "Crédito", "Pendiente", 0, false, ""], ["DES-276", "2026-06-16", "Añañai", "Tartines", "Tartin — Espinaca", 8, 5600, "Registrado", 44800, "Crédito", "Pendiente", 0, false, ""], ["DES-277", "2026-06-16", "Añañai", "Tartines", "Tartin — Jamón y Queso", 8, 6300, "Registrado", 50400, "Crédito", "Pendiente", 0, false, ""], ["DES-278", "2026-06-16", "Añañai", "Pan de Molde", "", 17, 2960, "Registrado", 50320, "Crédito", "Pendiente", 0, false, ""], ["DES-279", "2026-06-16", "Añañai", "bollos", "", 24, 1054, "Registrado", 25296, "Crédito", "Pendiente", 0, false, ""], ["DES-280", "2026-06-16", "Añañai", "chipa comun", "", 7, 5200, "Registrado", 36400, "Crédito", "Pendiente", 0, false, ""], ["DES-281", "2026-06-16", "Añañai", "chipa comun", "", 4, 5200, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-282", "2026-06-16", "Añañai", "Pizzas", "Pizza - Especial", 5, 8500, "Registrado", 42500, "Crédito", "Pendiente", 0, false, ""], ["DES-283", "2026-06-16", "Añañai", "Pizzas", "Pizza — Pesto", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-284", "2026-06-16", "Gena", "Pan de Molde", "", 3, 2960, "Completado (P1)", 8880, "Crédito", "Pendiente", 0, false, ""], ["DES-285", "2026-06-16", "Gena", "Pan Hamburguesa", "", 4, 433, "Completado (P1)", 1732, "Crédito", "Pendiente", 0, false, ""], ["DES-286", "2026-06-16", "Gena", "pan", "ovalados", 4, 526, "Completado (P1)", 2104, "Crédito", "Pendiente", 0, false, ""], ["DES-287", "2026-06-16", "Gena", "chipa comun", "", 3, 5200, "Completado (P1)", 15600, "Crédito", "Pendiente", 0, false, ""], ["DES-288", "2026-06-16", "Gena", "prepizzas", "", 4, 1202, "Completado (P1)", 4808, "Crédito", "Pendiente", 0, false, ""], ["DES-289", "2026-06-17", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-290", "2026-06-17", "Añañai", "fajitas para tacos", "", 150, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-291", "2026-06-17", "Zona Cero Don Bosco", "Medialunas (unidades en docena)", "", 4, 1300, "Completado (P1)", 5200, "Crédito", "Pendiente", 0, false, "prueba"], ["DES-292", "2026-06-17", "Zona Cero Don Bosco", "chipa comun", "", 1, 5200, "Completado (P1)", 5200, "Crédito", "Pendiente", 0, false, "prueba"], ["DES-293", "2026-06-17", "Zona Cero Don Bosco", "Pizzas", "Pizza - Especial", 1, 8500, "Completado (P1)", 8500, "Crédito", "Pendiente", 0, false, "prueba"], ["DES-294", "2026-06-17", "Zona Cero Don Bosco", "Tartines", "Tartin — Pollo", 1, 6300, "Completado (P1)", 6300, "Crédito", "Pendiente", 0, false, "prueba"], ["DES-295", "2026-06-17", "Zona Cero Don Bosco", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Completado (P1)", 6300, "Crédito", "Pendiente", 0, false, "prueba"], ["DES-296", "2026-06-18", "Benja Peker", "Tartines", "Tartin — Espinaca", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-297", "2026-06-18", "Benja Peker", "Tartines", "Tartin — Atún", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-298", "2026-06-18", "Benja Peker", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-299", "2026-06-18", "Benja Peker", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-300", "2026-06-18", "Benja Peker", "Tartines", "Tartin — Pollo", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-301", "2026-06-18", "Benja Peker", "Tartines", "Tartin — Espinaca", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-302", "2026-06-18", "Distribuidora", "", "", null, 26000, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-303", "2026-06-18", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-304", "2026-06-18", "Añañai", "Pizzas", "Pizza — Jota", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-305", "2026-06-18", "Distribuidora", "chipa comun", "", 2, 5200, "Registrado", 10400, "Crédito", "Pendiente", 0, false, "combo merienda"], ["DES-306", "2026-06-18", "Distribuidora", "Medialunas (unidades en docena)", "", 12, 1300, "Registrado", 15600, "Crédito", "Pendiente", 0, false, "combo merienda"], ["DES-307", "2026-06-18", "Distribuidora", "Pan de Molde", "", 1, 6800, "Registrado", 6800, "Crédito", "Pendiente", 0, false, "combo semanal"], ["DES-308", "2026-06-18", "Distribuidora", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, "combo semanal"], ["DES-309", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, "combo semanal"], ["DES-310", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Cebolla y Queso", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, "combo semanal"], ["DES-311", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Capresse", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, "combo semanal"], ["DES-312", "2026-06-18", "Distribuidora", "Pizzas", "Pizza — Napoleón", null, 8000, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-313", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Atún", null, 6300, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-314", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Pollo", null, 6300, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-315", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Espinaca", null, 5600, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-316", "2026-06-18", "Distribuidora", "Pizzas", "Pizza - Especial", null, 8500, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-317", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Verduras y Roquefort", null, 6300, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-318", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Cebolla y Queso", null, 5600, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-319", "2026-06-18", "Distribuidora", "Tartines", "Tartin — Capresse", null, 5600, "Sin precio", null, "Crédito", "Pendiente", 0, false, "combo"], ["DES-320", "2026-06-18", "Marcela Blanco", "Tartines", "Tartin — Cebolla y Queso", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-321", "2026-06-18", "Marcela Blanco", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-322", "2026-06-18", "Marcela Blanco", "Tartines", "Tartin — Atún", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-323", "2026-06-18", "Marcela Blanco", "Medialunas (unidades en docena)", "", 8, 1300, "Registrado", 10400, "Crédito", "Pendiente", 0, false, ""], ["DES-324", "2026-06-18", "Marcela Blanco", "chipa comun", "", 2, 5200, "Registrado", 10400, "Crédito", "Pendiente", 0, false, ""], ["DES-325", "2026-06-19", "Añañai", "Pan Hamburguesa", "", 132, 433, "Registrado", 57156, "Crédito", "Pendiente", 0, false, ""], ["DES-326", "2026-06-19", "Añañai", "pan", "ovalados", 52, 526, "Registrado", 27352, "Crédito", "Pendiente", 0, false, ""], ["DES-327", "2026-06-19", "Añañai", "bollos", "", 36, 1054, "Registrado", 37944, "Crédito", "Pendiente", 0, false, ""], ["DES-328", "2026-06-19", "Añañai", "Pan de Molde", "", 42, 2960, "Registrado", 124320, "Crédito", "Pendiente", 0, false, ""], ["DES-329", "2026-06-19", "Añañai", "Medialunas (unidades en docena)", "", 102, 1300, "Registrado", 132600, "Crédito", "Pendiente", 0, false, ""], ["DES-330", "2026-06-19", "Dietética Liniers", "Tartines", "Tartin — Jamón y Queso", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-331", "2026-06-19", "Dietética Liniers", "Tartines", "Tartin — Espinaca", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-332", "2026-06-19", "Dietética Liniers", "Tartines", "Tartin — Capresse", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-333", "2026-06-19", "Dietética Liniers", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-334", "2026-06-19", "Dietética Liniers", "Pizzas", "Pizza — Pesto", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-335", "2026-06-20", "Gena", "Pan Hamburguesa", "", 8, 543, "Registrado", 4344, "Crédito", "Pendiente", 0, false, ""], ["DES-336", "2026-06-20", "Gena", "pan", "ovalados", 8, 648, "Registrado", 5184, "Crédito", "Pendiente", 0, false, ""], ["DES-337", "2026-06-20", "Gena", "Pan de Molde", "", 2, 6800, "Registrado", 13600, "Crédito", "Pendiente", 0, false, ""], ["DES-338", "2026-06-20", "Gena", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-339", "2026-06-20", "Gena", "Pizzas", "Pizza — Napoleón", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-340", "2026-06-20", "Parque", "Medialunas (unidades en docena)", "", 120, 1300, "Registrado", 156000, "Crédito", "Pendiente", 0, false, ""], ["DES-341", "2026-06-20", "Parque", "Chipalmendras (bolsa 500g)", "", 10, 5200, "Registrado", 52000, "Crédito", "Pendiente", 0, false, ""], ["DES-342", "2026-06-20", "Añañai", "chipa comun", "", 10, 5200, "Registrado", 52000, "Crédito", "Pendiente", 0, false, ""], ["DES-343", "2026-06-22", "Añañai", "Pan de Molde", "", 33, 2960, "Registrado", 97680, "Crédito", "Pendiente", 0, false, ""], ["DES-344", "2026-06-22", "Ayelen Ginesta", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Completado (P1)", 8500, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-345", "2026-06-22", "Ayelen Ginesta", "Pizzas", "Pizza - Especial", 1, 8500, "Completado (P1)", 8500, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-346", "2026-06-22", "Ayelen Ginesta", "Pizzas", "fugazza", 1, 8000, "Completado (P1)", 8000, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-347", "2026-06-22", "Ayelen Ginesta", "Tartines", "Tartin — Capresse", 1, 5600, "Completado (P1)", 5600, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-348", "2026-06-22", "Ayelen Ginesta", "Tartines", "Tartin — Cebolla y Queso", 1, 5600, "Completado (P1)", 5600, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-349", "2026-06-22", "Ayelen Ginesta", "Tartines", "Tartin — Jamón y Queso", 1, 6300, "Completado (P1)", 6300, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-350", "2026-06-22", "Ayelen Ginesta", "Tartines", "Tartin — Atún", 1, 6300, "Completado (P1)", 6300, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-351", "2026-06-22", "Ayelen Ginesta", "chipa comun", "", 2, 5200, "Completado (P1)", 10400, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-352", "2026-06-22", "Ayelen Ginesta", "Medialunas (unidades en docena)", "", 1, 1300, "Completado (P1)", 1300, "Crédito", "Pendiente", 0, false, "combo mundial"], ["DES-353", "2026-06-22", "Añañai", "chipa comun", "", 20, 5200, "Registrado", 104000, "Crédito", "Pendiente", 0, false, ""], ["DES-354", "2026-06-22", "Añañai", "chipa vegano (bolsa 500g)", "", 10, 5200, "Registrado", 52000, "Crédito", "Pendiente", 0, false, ""], ["DES-355", "2026-06-23", "Añañai", "Tartines", "Tartin — Capresse", 20, 5600, "Registrado", 112000, "Crédito", "Pendiente", 0, false, ""], ["DES-356", "2026-06-23", "Añañai", "Tartines", "Tartin — Pollo", 10, 6300, "Registrado", 63000, "Crédito", "Pendiente", 0, false, ""], ["DES-357", "2026-06-23", "Añañai", "Tartines", "Tartin — Espinaca", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-358", "2026-06-23", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-359", "2026-06-23", "Añañai", "Pan de Molde", "", 29, 2960, "Registrado", 85840, "Crédito", "Pendiente", 0, false, ""], ["DES-360", "2026-06-23", "Nutrilleti", "Pan de Molde", "", 5, 6800, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-361", "2026-06-23", "Añañai", "Pizzas", "Pizza — Pesto", 3, 8000, "Registrado", 24000, "Crédito", "Pendiente", 0, false, ""], ["DES-362", "2026-06-23", "Añañai", "Pizzas", "Pizza - Especial", 3, 8500, "Registrado", 25500, "Crédito", "Pendiente", 0, false, ""], ["DES-363", "2026-06-23", "Añañai", "Pizzas", "Pizza — Napoleón", 3, 8000, "Registrado", 24000, "Crédito", "Pendiente", 0, false, ""], ["DES-364", "2026-06-23", "Añañai", "Pizzas", "fugazza", 3, 8000, "Registrado", 24000, "Crédito", "Pendiente", 0, false, ""], ["DES-365", "2026-06-23", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 3, 8500, "Registrado", 25500, "Crédito", "Pendiente", 0, false, ""], ["DES-366", "2026-06-23", "Supermercado El Apú", "Tartines", "Tartin — Jamón y Queso", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-367", "2026-06-23", "Supermercado El Apú", "Tartines", "Tartin — Cebolla y Queso", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-368", "2026-06-23", "Supermercado El Apú", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-369", "2026-06-23", "Supermercado El Apú", "Tartines", "Tartin — Pollo", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-370", "2026-06-23", "Supermercado El Apú", "Tartines", "Tartin — Atún", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-371", "2026-06-23", "Supermercado El Apú", "Tartines", "Tartin — Espinaca", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, ""], ["DES-372", "2026-06-23", "Supermercado El Apú", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-373", "2026-06-23", "Supermercado El Apú", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-374", "2026-06-23", "Supermercado El Apú", "Pizzas", "Pizza — Pesto", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-375", "2026-06-23", "Supermercado El Apú", "Pan de Molde", "", 5, 6800, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-376", "2026-06-23", "Marcela Blanco", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-377", "2026-06-23", "Marcela Blanco", "Tartines", "Tartin — Capresse", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-378", "2026-06-23", "Marcela Blanco", "Tartines", "Tartin — Pollo", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-379", "2026-06-23", "Marcela Blanco", "Chipalmendras (bolsa 500g)", "", 1, 5200, "Registrado", 5200, "Crédito", "Pendiente", 0, false, ""], ["DES-380", "2026-06-24", "Nutrilleti", "Pan de Molde", "", 5, 6800, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-381", "2026-06-24", "Añañai", "pan", "ovalados", 25, 526, "Registrado", 13150, "Crédito", "Pendiente", 0, false, ""], ["DES-382", "2026-06-24", "Añañai", "bollos", "", 24, 1054, "Registrado", 25296, "Crédito", "Pendiente", 0, false, ""], ["DES-383", "2026-06-24", "Añañai", "Pan de Molde", "", 29, 2960, "Registrado", 85840, "Crédito", "Pendiente", 0, false, ""], ["DES-384", "2026-06-25", "Añañai", "Medialunas (unidades en docena)", "", 36, 1300, "Registrado", 46800, "Crédito", "Pendiente", 0, false, ""], ["DES-385", "2026-06-25", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-386", "2026-06-25", "Añañai", "Pan Hamburguesa", "", 80, 433, "Registrado", 34640, "Crédito", "Pendiente", 0, false, ""], ["DES-387", "2026-06-25", "Añañai", "fajitas para tacos", "", 120, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-388", "2026-06-25", "Añañai", "prepizzas", "", 30, 1202, "Registrado", 36060, "Crédito", "Pendiente", 0, false, ""], ["DES-389", "2026-06-25", "Nutrilleti", "Pizzas", "Pizza — Pesto", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, "se descuenta la deuda con ellos"], ["DES-390", "2026-06-25", "Nutrilleti", "Pizzas", "Pizza — Napoleón", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, "se descuenta la deuda con ellos"], ["DES-391", "2026-06-25", "Nutrilleti", "Tartines", "Tartin — Espinaca", 2, 5600, "Registrado", 11200, "Crédito", "Pendiente", 0, false, "se descuenta la deuda con ellos"], ["DES-392", "2026-06-25", "Nutrilleti", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, "se descuenta la deuda con ellos"], ["DES-393", "2026-06-25", "Nutrilleti", "Tartines", "Tartin — Pollo", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, "se descuenta la deuda con ellos"], ["DES-394", "2026-06-25", "Nutrilleti", "Medialunas (unidades en docena)", "", 8, 1300, "Registrado", 10400, "Crédito", "Pendiente", 0, false, "se descuenta la deuda con ellos"], ["DES-395", "2026-06-25", "Marcela Blanco", "Tartines", "Tartin — Pollo", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-396", "2026-06-25", "Marcela Blanco", "Tartines", "Tartin — Espinaca", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-397", "2026-06-25", "Marcela Blanco", "Tartines", "Tartin — Capresse", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-398", "2026-06-25", "Marcela Blanco", "Tartines", "Tartin — Cebolla y Queso", 1, 5600, "Registrado", 5600, "Crédito", "Pendiente", 0, false, ""], ["DES-399", "2026-06-25", "Marcela Blanco", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-400", "2026-06-25", "Marcela Blanco", "Tartines", "Tartin — Jamón y Queso", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-401", "2026-06-25", "Marcela Blanco", "Tartines", "Tartin — Atún", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-402", "2026-06-25", "Marcela Blanco", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-403", "2026-06-25", "Marcela Blanco", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-404", "2026-06-25", "Marcela Blanco", "Pizzas", "fugazza", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-405", "2026-06-25", "Marcela Blanco", "Chipalmendras (bolsa 500g)", "", 2, 5200, "Registrado", 10400, "Crédito", "Pendiente", 0, false, ""], ["DES-406", "2026-06-25", "Marcela Blanco", "chipa comun", "", 1, 5200, "Registrado", 5200, "Crédito", "Pendiente", 0, false, ""], ["DES-407", "2026-06-26", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-408", "2026-06-26", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-409", "2026-06-26", "Añañai", "Pan Hamburguesa", "", 142, 433, "Registrado", 61486, "Crédito", "Pendiente", 0, false, ""], ["DES-410", "2026-06-26", "Añañai", "pan", "arabe", 24, 270, "Registrado", 6480, "Crédito", "Pendiente", 0, false, ""], ["DES-411", "2026-06-26", "Añañai", "Pizzas", "Pizza — Pesto", 4, 8000, "Registrado", 32000, "Crédito", "Pendiente", 0, false, ""], ["DES-412", "2026-06-26", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 5, 8500, "Registrado", 42500, "Crédito", "Pendiente", 0, false, ""], ["DES-413", "2026-06-26", "Añañai", "Pizzas", "Pizza — Napoleón", 4, 8000, "Registrado", 32000, "Crédito", "Pendiente", 0, false, ""], ["DES-414", "2026-06-26", "Añañai", "Pizzas", "fugazza", 4, 8000, "Registrado", 32000, "Crédito", "Pendiente", 0, false, ""], ["DES-415", "2026-06-26", "Añañai", "Pizzas", "Pizza - Especial", 4, 8500, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-416", "2026-06-26", "Añañai", "fajitas para tacos", "", 129, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-417", "2026-06-26", "Añañai", "Medialunas (unidades en docena)", "", 72, 1300, "Registrado", 93600, "Crédito", "Pendiente", 0, false, ""], ["DES-418", "2026-06-27", "Supermercado Los Olivos", "Pan de Molde", "", 3, 6800, "Registrado", 20400, "Crédito", "Pendiente", 0, false, ""], ["DES-419", "2026-06-27", "Supermercado Los Olivos", "Pizzas", "fugazza", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-420", "2026-06-27", "Supermercado Los Olivos", "Pizzas", "Pizza - Especial", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-421", "2026-06-27", "Supermercado Los Olivos", "Pizzas", "Pizza — Cuatro Poderes", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-422", "2026-06-29", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-423", "2026-06-29", "Añañai", "creps", "", 60, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-424", "2026-06-29", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-425", "2026-06-29", "Añañai", "Tartines", "Tartin — Espinaca", 20, 5600, "Registrado", 112000, "Crédito", "Pendiente", 0, false, ""], ["DES-426", "2026-06-29", "Añañai", "Tartines", "Tartin — Pollo", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-427", "2026-06-29", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-428", "2026-06-29", "Añañai", "Pizzas", "Pizza — Pesto", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-429", "2026-06-29", "Añañai", "Pizzas", "Pizza — Napoleón", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-430", "2026-06-29", "Añañai", "Pizzas", "fugazza", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-431", "2026-06-29", "Añañai", "Pizzas", "Pizza - Especial", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-432", "2026-06-29", "Añañai", "chipa comun", "", 20, 5200, "Registrado", 104000, "Crédito", "Pendiente", 0, false, ""], ["DES-433", "2026-06-29", "Añañai", "chipa vegano (bolsa 500g)", "", 7, 5200, "Registrado", 36400, "Crédito", "Pendiente", 0, false, ""], ["DES-434", "2026-06-29", "Añañai", "Medialunas (unidades en docena)", "", 60, 1300, "Registrado", 78000, "Crédito", "Pendiente", 0, false, ""], ["DES-435", "2026-06-30", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-436", "2026-06-30", "Añañai", "focaccia", "", 10, 553, "Registrado", 5530, "Crédito", "Pendiente", 0, false, ""], ["DES-437", "2026-06-30", "Añañai", "Medialunas (unidades en docena)", "", 60, 1300, "Registrado", 78000, "Crédito", "Pendiente", 0, false, ""], ["DES-438", "2026-06-30", "Añañai", "pan", "ovalados", 14, 526, "Registrado", 7364, "Crédito", "Pendiente", 0, false, ""], ["DES-439", "2026-06-30", "Añañai", "fajitas para tacos", "", 120, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-440", "2026-06-30", "Añañai", "bollos", "", 36, 1054, "Registrado", 37944, "Crédito", "Pendiente", 0, false, ""], ["DES-441", "2026-07-01", "Añañai", "Pan de Molde", "", 30, 2960, "Registrado", 88800, "Crédito", "Pendiente", 0, false, ""], ["DES-442", "2026-07-01", "Añañai", "Pan Hamburguesa", "", 30, 433, "Registrado", 12990, "Crédito", "Pendiente", 0, false, ""], ["DES-443", "2026-07-01", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-444", "2026-07-01", "Añañai", "Pizzas", "fugazza", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-445", "2026-07-01", "Añañai", "Pizzas", "Pizza — Pesto", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-446", "2026-07-01", "Añañai", "Pizzas", "Pizza — Napoleón", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-447", "2026-07-01", "Añañai", "Medialunas (unidades en docena)", "", 60, 1300, "Registrado", 78000, "Crédito", "Pendiente", 0, false, ""], ["DES-448", "2026-07-01", "Supermercado Los Olivos", "Pan de Molde", "", 2, 6800, "Registrado", 13600, "Crédito", "Pendiente", 0, false, ""], ["DES-449", "2026-07-01", "Supermercado Los Olivos", "pan", "ovalados", 16, 648, "Registrado", 10368, "Crédito", "Pendiente", 0, false, ""], ["DES-450", "2026-07-01", "Distribuidora", "Pan Hamburguesa", "", 6, 543, "Registrado", 3258, "Crédito", "Pendiente", 0, false, ""], ["DES-451", "2026-07-01", "Distribuidora", "pan", "ovalados", 6, 648, "Registrado", 3888, "Crédito", "Pendiente", 0, false, ""], ["DES-452", "2026-07-01", "Supermercado Los Olivos", "Pan de Molde", "", 4, 6800, "Registrado", 27200, "Crédito", "Pendiente", 0, false, ""], ["DES-453", "2026-07-01", "Supermercado Los Olivos", "pan", "ovalados", 16, 648, "Registrado", 10368, "Crédito", "Pendiente", 0, false, ""], ["DES-454", "2026-07-02", "Añañai", "Pan de Molde", "", 17, 2960, "Registrado", 50320, "Crédito", "Pendiente", 0, false, ""], ["DES-455", "2026-07-02", "Gena", "Medialunas (unidades en docena)", "", 60, 1300, "Registrado", 78000, "Crédito", "Pendiente", 0, false, ""], ["DES-456", "2026-07-02", "Marcela Blanco", "Pan de Molde", "", 1, 6800, "Registrado", 6800, "Crédito", "Pendiente", 0, false, ""], ["DES-457", "2026-07-02", "Marcela Blanco", "Medialunas (unidades en docena)", "", 16, 1300, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-458", "2026-07-02", "Miriam Blanco", "chipa comun", "", 4, 5200, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-459", "2026-07-02", "Miriam Blanco", "Medialunas (unidades en docena)", "", 8, 1300, "Registrado", 10400, "Crédito", "Pendiente", 0, false, ""], ["DES-460", "2026-07-02", "Miriam Blanco", "Pizzas", "Pizza - Especial", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-461", "2026-07-02", "Miriam Blanco", "Pizzas", "Pizza — Napoleón", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-462", "2026-07-02", "Miriam Blanco", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-463", "2026-07-02", "Miriam Blanco", "Pizzas", "fugazza", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-464", "2026-07-02", "Miriam Blanco", "Tartines", "Tartin — Verduras y Roquefort", 4, 6300, "Registrado", 25200, "Crédito", "Pendiente", 0, false, ""], ["DES-465", "2026-07-02", "Miriam Blanco", "Tartines", "Tartin — Pollo", 4, 6300, "Registrado", 25200, "Crédito", "Pendiente", 0, false, ""], ["DES-466", "2026-07-02", "Miriam Blanco", "Tartines", "Tartin — Espinaca", 4, 5600, "Registrado", 22400, "Crédito", "Pendiente", 0, false, ""], ["DES-467", "2026-07-02", "Miriam Blanco", "Tartines", "Tartin — Capresse", 4, 5600, "Registrado", 22400, "Crédito", "Pendiente", 0, false, ""], ["DES-468", "2026-07-02", "Miriam Blanco", "Tartines", "Tartin — Cebolla y Queso", 4, 5600, "Registrado", 22400, "Crédito", "Pendiente", 0, false, ""], ["DES-469", "2026-07-02", "Miriam Blanco", "Tartines", "Tartin — Jamón y Queso", 4, 6300, "Registrado", 25200, "Crédito", "Pendiente", 0, false, ""], ["DES-470", "2026-07-02", "Añañai", "Pan de Molde", "", 18, 2960, "Registrado", 53280, "Crédito", "Pendiente", 0, false, ""], ["DES-471", "2026-07-02", "Añañai", "pan", "ovalados", 14, 526, "Registrado", 7364, "Crédito", "Pendiente", 0, false, ""], ["DES-472", "2026-07-02", "Añañai", "bollos", "", 35, 1054, "Registrado", 36890, "Crédito", "Pendiente", 0, false, ""], ["DES-473", "2026-07-02", "Añañai", "fajitas para tacos", "", 120, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-474", "2026-07-02", "Añañai", "prepizzas", "", 22, 1202, "Registrado", 26444, "Crédito", "Pendiente", 0, false, ""], ["DES-475", "2026-07-03", "Añañai", "Medialunas (unidades en docena)", "", 72, 1300, "Registrado", 93600, "Crédito", "Pendiente", 0, false, ""], ["DES-476", "2026-07-03", "Añañai", "fajitas para tacos", "", 150, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-477", "2026-07-03", "Añañai", "pan", "ovalados", 30, 526, "Registrado", 15780, "Crédito", "Pendiente", 0, false, ""], ["DES-478", "2026-07-03", "Añañai", "Pan de Molde", "", 34, 2960, "Registrado", 100640, "Crédito", "Pendiente", 0, false, ""], ["DES-479", "2026-07-03", "Añañai", "Pizzas", "Pizza — Pesto", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-480", "2026-07-03", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-481", "2026-07-03", "Añañai", "Pizzas", "fugazza", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-482", "2026-07-03", "Añañai", "Pizzas", "Pizza — Napoleón", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-483", "2026-07-03", "Añañai", "Pizzas", "Pizza - Especial", 1, 8500, "Registrado", 8500, "Crédito", "Pendiente", 0, false, ""], ["DES-484", "2026-07-03", "Añañai", "disco de empanadas", "", 48, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-485", "2026-07-03", "Marcela Blanco", "Medialunas (unidades en docena)", "", 16, 1300, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-486", "2026-07-03", "Marcela Blanco", "Tartines", "Tartin — Verduras y Roquefort", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-487", "2026-07-04", "Supermercado Los Olivos", "Pizzas", "Pizza — Napoleón", 1, 8400, "Registrado", 8400, "Crédito", "Pendiente", 0, false, ""], ["DES-488", "2026-07-04", "Supermercado Los Olivos", "Pizzas", "Pizza - Especial", 1, 8925, "Registrado", 8925, "Crédito", "Pendiente", 0, false, ""], ["DES-489", "2026-07-04", "Supermercado Los Olivos", "Pizzas", "Pizza — Pesto", 1, 8400, "Registrado", 8400, "Crédito", "Pendiente", 0, false, ""], ["DES-490", "2026-07-04", "Supermercado Los Olivos", "Pizzas", "fugazza", 1, 8400, "Registrado", 8400, "Crédito", "Pendiente", 0, false, ""], ["DES-491", "2026-07-04", "Supermercado Los Olivos", "Pan Hamburguesa", "", 20, 570, "Registrado", 11400, "Crédito", "Pendiente", 0, false, ""], ["DES-492", "2026-07-04", "Supermercado Los Olivos", "pan", "ovalados", 16, 680, "Registrado", 10880, "Crédito", "Pendiente", 0, false, ""], ["DES-493", "2026-07-04", "Supermercado Los Olivos", "prepizzas", "", 8, 1570, "Registrado", 12560, "Crédito", "Pendiente", 0, false, ""], ["DES-494", "2026-07-05", "Añañai", "Tartines", "Tartin — Espinaca", 5, 5600, "Registrado", 28000, "Crédito", "Pendiente", 0, false, ""], ["DES-495", "2026-07-05", "Añañai", "chipa comun", "", 2, 5200, "Registrado", 10400, "Crédito", "Pendiente", 0, false, ""], ["DES-496", "2026-07-06", "Benja Peker", "Tartines", "Tartin — Cebolla y Queso", 4, 5600, "Registrado", 22400, "Crédito", "Pendiente", 0, false, ""], ["DES-497", "2026-07-06", "Benja Peker", "Tartines", "Tartin — Jamón y Queso", 4, 6300, "Registrado", 25200, "Crédito", "Pendiente", 0, false, ""], ["DES-498", "2026-07-06", "Benja Peker", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-499", "2026-07-06", "Benja Peker", "Tartines", "Tartin — Pollo", 1, 6300, "Registrado", 6300, "Crédito", "Pendiente", 0, false, ""], ["DES-500", "2026-07-06", "Supermercado El Apú", "Tartines", "Tartin — Jamón y Queso", 3, 6300, "Registrado", 18900, "Crédito", "Pendiente", 0, false, ""], ["DES-501", "2026-07-06", "Supermercado El Apú", "Tartines", "Tartin — Cebolla y Queso", 3, 5600, "Registrado", 16800, "Crédito", "Pendiente", 0, false, ""], ["DES-502", "2026-07-06", "Supermercado El Apú", "Tartines", "Tartin — Verduras y Roquefort", 2, 6300, "Registrado", 12600, "Crédito", "Pendiente", 0, false, ""], ["DES-503", "2026-07-06", "Añañai", "Medialunas (unidades en docena)", "", 60, 1300, "Registrado", 78000, "Crédito", "Pendiente", 0, false, ""], ["DES-504", "2026-07-06", "Añañai", "Pizzas", "Pizza - Especial", 4, 8500, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-505", "2026-07-06", "Añañai", "Pizzas", "Pizza — Pesto", 1, 8000, "Registrado", 8000, "Crédito", "Pendiente", 0, false, ""], ["DES-506", "2026-07-06", "Añañai", "Pizzas", "fugazza", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-507", "2026-07-06", "Añañai", "Pizzas", "Pizza — Napoleón", 2, 8000, "Registrado", 16000, "Crédito", "Pendiente", 0, false, ""], ["DES-508", "2026-07-06", "Añañai", "Pizzas", "Pizza — Cuatro Poderes", 2, 8500, "Registrado", 17000, "Crédito", "Pendiente", 0, false, ""], ["DES-509", "2026-07-06", "Añañai", "Tartines", "Tartin — Pollo", 30, 6300, "Registrado", 189000, "Crédito", "Pendiente", 0, false, ""], ["DES-510", "2026-07-06", "Añañai", "Tartines", "Tartin — Espinaca", 16, 5600, "Registrado", 89600, "Crédito", "Pendiente", 0, false, ""], ["DES-511", "2026-07-06", "Añañai", "Tartines", "Tartin — Capresse", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-512", "2026-07-06", "Añañai", "Tartines", "Tartin — Cebolla y Queso", 10, 5600, "Registrado", 56000, "Crédito", "Pendiente", 0, false, ""], ["DES-513", "2026-07-06", "Añañai", "Tartines", "Tartin — Verduras y Roquefort", 20, 6300, "Registrado", 126000, "Crédito", "Pendiente", 0, false, ""], ["DES-514", "2026-07-06", "Añañai", "Chipalmendras (bolsa 500g)", "", 10, 5200, "Registrado", 52000, "Crédito", "Pendiente", 0, false, ""], ["DES-515", "2026-07-06", "Añañai", "Pan de Molde", "", 32, 2960, "Registrado", 94720, "Crédito", "Pendiente", 0, false, ""], ["DES-516", "2026-07-06", "Añañai", "creps", "", 30, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-517", "2026-07-06", "Supermercado Los Olivos", "prepizzas", "", 12, 1495, "Registrado", 17940, "Crédito", "Pendiente", 0, false, ""], ["DES-518", "2026-07-06", "Supermercado Los Olivos", "chipa comun", "", 4, 5200, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-519", "2026-07-06", "Supermercado Los Olivos", "Medialunas (unidades en docena)", "", 16, 1300, "Registrado", 20800, "Crédito", "Pendiente", 0, false, ""], ["DES-520", "2026-07-06", "Supermercado Los Olivos", "Pan Hamburguesa", "", 16, 543, "Registrado", 8688, "Crédito", "Pendiente", 0, false, ""], ["DES-521", "2026-07-06", "Supermercado Los Olivos", "pan", "ovalados", 16, 648, "Registrado", 10368, "Crédito", "Pendiente", 0, false, ""], ["DES-522", "2026-07-06", "Nutrilleti", "Pan de Molde", "", 5, 6800, "Registrado", 34000, "Crédito", "Pendiente", 0, false, ""], ["DES-523", "2026-07-07", "Almacén Buena Vida", "Tartines", "Tartin — Pollo", 2, 6615, "Registrado", 13230, "Crédito", "Pendiente", 0, false, ""], ["DES-524", "2026-07-07", "Almacén Buena Vida", "Tartines", "Tartin — Atún", 2, 6615, "Registrado", 13230, "Crédito", "Pendiente", 0, false, ""], ["DES-525", "2026-07-07", "Almacén Buena Vida", "Tartines", "Tartin — Verduras y Roquefort", 2, 6615, "Registrado", 13230, "Crédito", "Pendiente", 0, false, ""], ["DES-526", "2026-07-07", "Almacén Buena Vida", "Medialunas (unidades en docena)", "", 16, 1375, "Registrado", 22000, "Crédito", "Pendiente", 0, false, ""], ["DES-527", "2026-07-07", "Almacén Buena Vida", "chipa comun", "", 2, 5460, "Registrado", 10920, "Crédito", "Pendiente", 0, false, ""], ["DES-528", "2026-07-07", "Almacén Buena Vida", "Pizzas", "Pizza — Pesto", 1, 8400, "Registrado", 8400, "Crédito", "Pendiente", 0, false, ""], ["DES-529", "2026-07-07", "Almacén Buena Vida", "Pizzas", "fugazza", 1, 8400, "Registrado", 8400, "Crédito", "Pendiente", 0, false, ""], ["DES-530", "2026-07-07", "Almacén Buena Vida", "Pizzas", "Pizza — Napoleón", 1, 8400, "Registrado", 8400, "Crédito", "Pendiente", 0, false, ""], ["DES-531", "2026-07-07", "Almacén Buena Vida", "Pizzas", "Pizza — Cuatro Poderes", 1, 8925, "Registrado", 8925, "Crédito", "Pendiente", 0, false, ""], ["DES-532", "2026-07-07", "Almacén Buena Vida", "Pizzas", "Pizza - Especial", 1, 8925, "Registrado", 8925, "Crédito", "Pendiente", 0, false, ""], ["DES-533", "2026-07-07", "Añañai", "Pan de Molde", "", 33, 2960, "Registrado", 97680, "Crédito", "Pendiente", 0, false, ""], ["DES-534", "2026-07-07", "Marcela Blanco", "Pan de Molde", "", 1, 6800, "Registrado", 6800, "Crédito", "Pendiente", 0, false, ""], ["DES-535", "2026-07-07", "La Esperanza", "Tartines", "Tartin — Verduras y Roquefort", 8, 6300, "Registrado", 50400, "Crédito", "Pendiente", 0, false, ""], ["DES-536", "2026-07-07", "La Esperanza", "Tartines", "Tartin — Espinaca", 3, 5600, "Registrado", 16800, "Crédito", "Pendiente", 0, false, ""], ["DES-537", "2026-07-07", "La Esperanza", "Pan de Molde", "", 2, 6800, "Registrado", 13600, "Crédito", "Pendiente", 0, false, ""], ["DES-538", "2026-07-07", "Añañai", "Medialunas (unidades en docena)", "", 60, 1300, "Registrado", 78000, "Crédito", "Pendiente", 0, false, ""], ["DES-539", "2026-07-07", "Añañai", "prepizzas", "", 38, 1202, "Registrado", 45676, "Crédito", "Pendiente", 0, false, ""], ["DES-540", "2026-07-07", "Añañai", "fajitas para tacos", "", 128, null, "Sin precio", null, "Crédito", "Pendiente", 0, false, ""], ["DES-541", "2026-07-07", "Añañai", "focaccia", "", 10, 553, "Registrado", 5530, "Crédito", "Pendiente", 0, false, ""], ["DES-542", "2026-07-07", "Añañai", "bollos", "", 30, 1054, "Registrado", 31620, "Crédito", "Pendiente", 0, false, ""], ["DES-543", "2026-07-07", "Añañai", "pan", "ovalados", 22, 526, "Registrado", 11572, "Crédito", "Pendiente", 0, false, ""]];
var HIST_COBROS    = [["COB-001", "2026-05-28", "La Esperanza", 60000, "Transferencia", "", "PAGADO"], ["COB-002", "2026-06-01", "La Esperanza", 108985, "Transferencia", "", "PAGAGO"], ["COB-003", "2026-06-03", "La Esperanza", 63300, "Transferencia", "", "PAGADO"], ["COB-004", "2026-06-04", "Distribuidora", 26200, "Transferencia", "", "PAGADO"], ["COB-005", "2026-06-04", "Distribuidora", 26200, "Transferencia", "", "PAGADO"], ["COB-006", "2026-06-05", "La Esperanza", 81100, "Transferencia", "", "PAGADO"], ["COB-007", "2026-06-05", "Amauta", 62400, "Transferencia", "", "PAGADO"], ["COB-008", "2026-06-08", "La Esperanza", 59200, "Transferencia", "", "PAGADO"], ["COB-009", "2026-06-10", "Distribuidora", 20600, "Transferencia", "", "PAGADO"], ["COB-010", "2026-06-12", "La Esperanza", 159600, "Transferencia", "", "PAGADO"], ["COB-011", "2026-06-12", "Distribuidora", 88000, "Transferencia", "", "PAGADO"], ["COB-012", "2026-06-13", "Supermercado Los Olivos", 168420, "", "", "PENDIENTE"], ["COB-013", "2026-06-15", "La Esperanza", 36400, "Transferencia", "", "PAGADO"], ["COB-014", "2026-06-16", "Supermercado Los Olivos", 49080, "", "", "PENDIENTE"], ["COB-015", "2026-06-16", "Nutrilleti", 162540, "", "", "PAGADO (SE DESCUENTA LA DEUDA)"], ["COB-016", "2026-05-18", "Benja Peker", 43400, "Transferencia", "", "PAGADO"], ["COB-017", "2026-06-18", "Benja Peker", 11900, "", "", "PENDIENTE"], ["COB-018", "2026-06-18", "Distribuidora", 26000, "Transferencia", "", "PAGADO"], ["COB-019", "2026-06-18", "Distribuidora", 26200, "Transferencia", "", "PAGADO"], ["COB-020", "2026-06-18", "Distribuidora", 33000, "Transferencia", "", "PAGADO"], ["COB-021", "2026-06-18", "Distribuidora", 28000, "Transferencia", "", "PAGADO"], ["COB-022", "2026-06-18", "Marcela Blanco", 39000, "", "", "PENDIENTE"], ["COB-023", "2026-06-20", "Supermercado Los Olivos", 75730, "", "", "PENDIENTE"], ["COB-024", "2026-06-20", "Dietética Liniers", 47460, "Transferencia", "", "PAGADO(27/06/2026)"], ["COB-025", "2026-06-23", "Nutrilleti", 34000, "Efectivo", "", "PAGADO"], ["COB-026", "2026-06-23", "Supermercado El Apú", 131800, "Transferencia", "", "PAGADO"], ["COB-027", "2026-06-23", "Marcela Blanco", 25600, "", "", "PENDIENTE"], ["COB-028", "2026-06-24", "Nutrilleti", 34000, "Transferencia", "", "PAGADO (SE DESCUENTA LA DEUDA)"], ["COB-029", "2026-06-25", "Nutrilleti", 78800, "", "", "PAGADO (SE DESCUENTA LA DEUDA)"], ["COB-030", "2026-06-25", "Marcela Blanco", 82600, "", "", ""], ["COB-031", "2026-06-26", "Distribuidora", 15000, "", "", ""], ["COB-032", "2026-06-27", "Supermercado Los Olivos", 61900, "", "", ""], ["COB-033", "2026-07-01", "Supermercado Los Olivos", 23698, "", "", ""], ["COB-034", "2026-07-07", "Distribuidora", 7200, "Transferencia", "", "PAGADO"], ["COB-035", "2026-07-02", "Marcela Blanco", 27600, "", "", ""], ["COB-036", "2026-07-04", "Supermercado Los Olivos", 68965, "", "", ""], ["COB-037", "2026-07-06", "Supermercado Los Olivos", 78596, "", "", ""], ["COB-038", "2026-07-06", "Nutrilleti", 34000, "", "", ""], ["COB-039", "2026-07-06", "Supermercado El Apú", 59100, "", "", ""], ["COB-040", "2026-07-06", "Benja Peker", 66500, "", "", ""], ["COB-041", "2026-07-07", "Marcela Blanco", 6800, "", "", ""], ["COB-042", "2026-07-07", "Almacén Buena Vida", 102430, "", "", ""], ["COB-043", "2026-07-07", "La Esperanza", 80800, "", "", ""], ["COB-044", "2026-06-27", "Supermercado Los Olivos", 100000, "", "", "pago parcial"], ["COB-045", "2026-07-02", "Marcela Blanco", 48000, "", "", "pago parcial"], ["COB-046", "2026-07-03", "Marcela Blanco", 16400, "", "", "pago parcial"], ["COB-047", "2026-07-05", "Supermercado Los Olivos", 50000, "", "", "pago parcial"], ["COB-048", "2026-07-06", "Supermercado Los Olivos", 67500, "", "", "pago parcial"], ["COB-049", "2026-07-08", "Marcela Blanco", 33400, "", "", "Pago parcial"]];

function importarDatosHistoricos() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var hDes = ss.getSheetByName(H_DESPACHOS);
  var hCob = ss.getSheetByName(H_COBROS);

  if (!hDes || !hCob) {
    ui.alert('Error', 'Ejecutá primero inicializar() para crear las hojas.', ui.ButtonSet.OK);
    return;
  }

  // Verificar que las hojas estén vacías antes de importar
  var tieneData = hDes.getLastRow() >= DATA_ROW;
  if (tieneData) {
    var resp = ui.alert(
      '⚠ Ya hay datos',
      'La hoja Despachos ya tiene registros. ¿Querés agregar los históricos igual?',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;
  }

  // ── IMPORTAR DESPACHOS ──
  // Cols hoja: 1=DES-ID 2=Fecha 3=CLI-ID 4=Cliente 5=Producto 6=Variante
  //            7=Unidad 8=Unidades 9=Precio 10=PrecioTipo 11=Monto
  //            12=Condición 13=Estado 14=Obs
  var desStart = Math.max(hDes.getLastRow() + 1, DATA_ROW);
  var desBatch = [];

  HIST_DESPACHOS.forEach(function(r) {
    // r: [DES-ID, fecha, cliente, producto, variante, unidades,
    //     precio, fuente, monto, condicion, estado, acum, supera, obs]
    var fecha = r[1] ? new Date(r[1]) : '';
    var row = [
      r[0],                          // DES-ID
      fecha,                         // Fecha
      '',                            // CLI-ID (sin FK en migración)
      r[2],                          // Cliente
      r[3],                          // Producto
      r[4] || '',                    // Variante
      '',                            // Unidad (se completa desde maestro)
      r[5] || '',                    // Unidades
      r[6] || '',                    // Precio Unit
      r[7],                          // Fuente precio
      r[8] || '',                    // Monto Total
      r[9] || 'Crédito',             // Condición
      r[10] || 'Pendiente',          // Estado
      r[13] || ''                    // Obs
    ];
    desBatch.push(row);
  });

  if (desBatch.length > 0) {
    hDes.getRange(desStart, 1, desBatch.length, 14).setValues(desBatch);
    // Format fecha col
    hDes.getRange(desStart, 2, desBatch.length, 1).setNumberFormat('DD/MM/YYYY');
    // Format precio y monto
    hDes.getRange(desStart, 9, desBatch.length, 1).setNumberFormat('$#,##0');
    hDes.getRange(desStart, 11, desBatch.length, 1).setNumberFormat('$#,##0');
  }

  // ── IMPORTAR COBROS ──
  // Cols hoja: 1=COB-ID 2=Fecha 3=CLI-ID 4=Cliente 5=Monto 6=Descuento
  //            7=MontoNeto 8=FormaPago 9=Referencia 10=DES-IDs 11=Obs
  var cobStart = Math.max(hCob.getLastRow() + 1, DATA_ROW);
  var cobBatch = [];

  HIST_COBROS.forEach(function(r) {
    // r: [COB-ID, fecha, cliente, monto, forma, ref, obs]
    var fecha = r[1] ? new Date(r[1]) : '';
    cobBatch.push([
      r[0],         // COB-ID
      fecha,        // Fecha
      '',           // CLI-ID
      r[2],         // Cliente
      r[3] || '',   // Monto cobrado
      '',           // Descuento pronto pago
      r[3] || '',   // Monto neto = monto (sin descuento en históricos)
      r[4] || '',   // Forma pago
      r[5] || '',   // Referencia
      '(migrado)',  // DES-IDs cubiertos
      r[6] || ''    // Obs
    ]);
  });

  if (cobBatch.length > 0) {
    hCob.getRange(cobStart, 1, cobBatch.length, 11).setValues(cobBatch);
    hCob.getRange(cobStart, 2, cobBatch.length, 1).setNumberFormat('DD/MM/YYYY');
    hCob.getRange(cobStart, 5, cobBatch.length, 1).setNumberFormat('$#,##0');
    hCob.getRange(cobStart, 7, cobBatch.length, 1).setNumberFormat('$#,##0');
  }

  ss.toast(
    desBatch.length + ' despachos y ' + cobBatch.length + ' cobros importados correctamente.',
    '✅ Históricos cargados', 6
  );
}