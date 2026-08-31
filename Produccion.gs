// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Producción.gs — Stock por SKU
// Catálogo + Alias + movimientos de Stock (Producción suma, Despachos resta)
// registrarProduccion() vive acá abajo; guardarDespacho() (en Código.gs)
// llama a restarStockPorDespacho_() antes de guardar la fila. Todavía no
// está conectado a ningún formulario HTML.
// ═══════════════════════════════════════════════════════════════

// ── HOJAS ──────────────────────────────────────────────────────
var H_CATALOGO     = 'Catálogo';
var H_ALIAS        = 'Alias';
var H_STOCK        = 'Stock';
var H_PRODUCCIONES = 'Produccion_Produccion';  // nombre real de la pestaña en el sandbox

var ENCABEZADOS_CATALOGO = [
  'SKU', 'Nombre canónico', 'Categoría', 'Tipo', 'Unidad de producción', 'Unidad de despacho', 'Factor equivalencia'
];
var ENCABEZADOS_ALIAS = ['Texto crudo', 'SKU'];
var ENCABEZADOS_STOCK = [
  'SKU', 'Producto', 'Stock actual', 'Unidad', 'Merma acumulada', 'Última actualización', 'Último movimiento'
];

// ── FORMULARIO — datos que todavía no vienen de una fuente real ──────
// Meta semanal: hoy es un número global fijo para todos los Terminado.
// Punto único de reemplazo: cuando haya metas reales por SKU (ej. una
// hoja "Metas de Producción"), solo hay que reescribir obtenerMetaSemanal_.
// obtenerMetaSemanal_(sku) ahora vive en Configuracion.gs, con datos reales
// editables desde Configuración en el Dashboard (antes era un número fijo acá).

// Unidades para la categoría "Otro" (sin SKU, no hay Catálogo que las defina)
var UNIDADES_OTRO = ['kg', 'unidades', 'litros', 'docenas', 'paquetes'];

// SKU que existen en el Catálogo (no se borran, siguen con su historial y
// su stock) pero NO se muestran en los formularios de carga de Producción
// ni Despacho — hoy: Pan de Molde con/sin Semilla, unificados en un solo
// "Pan de Molde" (PAN-001) porque las 3 variantes confundían al operario.
var SKU_OCULTOS_EN_FORMULARIOS = ['PAN-015', 'PAN-016'];

// ── CATÁLOGO — un SKU por producto terminado (o insumo) ──────────
// Factor equivalencia = cuántas unidades de producción hacen 1 unidad
// despachada. Hoy es 1 para TODOS los terminados a propósito: el Stock
// vive siempre en la unidad de venta (bolsas, bandejas), nunca en la
// unidad bruta de producción (kg, unidades sueltas) — así la conversión
// no depende de un cálculo escondido que alguien pueda cargar mal. Los
// INSU-* no despachan directo,
// por eso no tienen unidad de despacho ni factor.
// Pan de Molde / con Semilla / sin Semilla son 3 SKUs distintos (confirmado
// en la nota de la hoja "Stock" de AÑAÑAI_Stock_Valorizado_(negativos_en_cero):
// no son el mismo producto, quedan en categorías separadas). Laminado es
// insumo intermedio, no producto terminado (misma fuente).
var CATALOGO_DATA = [
  ['PAN-001', 'Pan de Molde',                 'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-002', 'Pan Hamburguesa',              'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-003', 'Pan Ovalado',                  'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-004', 'Pan Árabe',                    'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-005', 'Bollo',                        'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-006', 'Focaccia',                     'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-007', 'Prepizza',                     'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-008', 'Fajitas',                      'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-009', 'Canastitas',                   'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-011', 'Raps',                         'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-012', 'Croissant',                    'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-013', 'Rolls de Canela',              'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-014', 'Disco de Empanadas',           'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-015', 'Pan de Molde con Semilla',     'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['PAN-016', 'Pan de Molde sin Semilla',     'Panificados',   'Terminado', 'unidades',      'unidades', 1],
  ['FAC-001', 'Medialunas',                   'Facturas',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-001', 'Tartín Jamón y Queso',        'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-002', 'Tartín Pollo',                'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-003', 'Tartín Cebolla y Queso',      'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-004', 'Tartín Verduras y Roquefort', 'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-005', 'Tartín Capresse',             'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-006', 'Tartín Atún',                 'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-007', 'Tartín Espinaca',             'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['TART-008', 'Mini Tartín',                 'Tartines',      'Terminado', 'unidades',      'unidades', 1],
  ['PIZZ-001', 'Pizza Cuatro Poderes',        'Pizzas',        'Terminado', 'unidades',      'unidades', 1],
  ['PIZZ-002', 'Pizza Especial',              'Pizzas',        'Terminado', 'unidades',      'unidades', 1],
  ['PIZZ-003', 'Pizza Pesto',                 'Pizzas',        'Terminado', 'unidades',      'unidades', 1],
  ['PIZZ-004', 'Pizza Napoleón',              'Pizzas',        'Terminado', 'unidades',      'unidades', 1],
  ['PIZZ-005', 'Pizza Fugaza',                'Pizzas',        'Terminado', 'unidades',      'unidades', 1],
  ['PIZZ-006', 'Pizza Jota',                  'Pizzas',        'Terminado', 'unidades',      'unidades', 1],
  ['PIZZ-007', 'Pizza Capresse',              'Pizzas',        'Terminado', 'unidades',      'unidades', 1],
  ['PAST-001', 'Fideos Fettuccine',           'Pastas',        'Terminado', 'unidades',      'unidades', 1],
  ['PAST-002', 'Sorrentinos',                 'Pastas',        'Terminado', 'unidades',      'unidades', 1],
  ['PAST-003', 'Sorrentino Jamón y Queso',    'Pastas',        'Terminado', 'unidades',      'unidades', 1],
  ['PAST-004', 'Sorrentino Calabaza',         'Pastas',        'Terminado', 'unidades',      'unidades', 1],
  ['CHIP-001', 'Chipalmendras Común',         'Chipalmendras', 'Terminado', 'unidades',      'unidades', 1],
  ['CHIP-002', 'Chipalmendras Vegano',        'Chipalmendras', 'Terminado', 'unidades',      'unidades', 1],
  ['CHIP-003', 'Chipa Saludable',             'Chipalmendras', 'Terminado', 'unidades',      'unidades', 1],
  ['OTR-001', 'Galletitas',                   'Otros',         'Terminado', 'unidades',      'unidades', 1],
  ['OTR-002', 'Creps',                        'Otros',         'Terminado', 'unidades',      'unidades', 1],
  ['OTR-003', 'Cookies',                      'Otros',         'Terminado', 'unidades',      'unidades', 1],
  ['SAND-001', 'Sandwich Pollo',              'Sandwiches',    'Terminado', 'unidades',      'unidades', 1],
  ['SAND-002', 'Sandwich Jamón y Queso',      'Sandwiches',    'Terminado', 'unidades',      'unidades', 1],
  ['SAND-003', 'Sandwich Verdura',            'Sandwiches',    'Terminado', 'unidades',      'unidades', 1],
  ['INSU-001', 'Masa para Medialuna',         'Insumos',       'Insumo',    'kg o unidades', '', ''],
  ['INSU-002', 'Relleno para Sandwich',       'Insumos',       'Insumo',    'kg o unidades', '', ''],
  ['INSU-003', 'Relleno de Pollo',            'Insumos',       'Insumo',    'kg o unidades', '', ''],
  ['INSU-004', 'Relleno Capresse',            'Insumos',       'Insumo',    'kg o unidades', '', ''],
  ['INSU-005', 'Laminado',                    'Insumos',       'Insumo',    'kg o unidades', '', '']
];

// ── ALIAS — texto tal cual aparece en el historial de Producción/Despachos ──
// "Texto crudo" = Producto, o "Producto · Variante" cuando hay variante
// (mismo formato que arma _textoCrudo_ más abajo). Construido a partir del
// historial real (planillas de Producción y Despachos) — cada fila de acá
// tiene un texto crudo que efectivamente apareció cargado alguna vez, salvo
// "laminado" (sin uso histórico, agregado igual como alias preventivo).
var ALIAS_DATA = [
  // Chipalmendras
  ['Chipalmendras (bolsa 500g)', 'CHIP-001'],
  ['Chipalmendras (bolsa 500g) · Chipalmendra — Vegano', 'CHIP-002'],
  ['Chipalmendras (bolsa 500g) · Vegano', 'CHIP-002'],
  ['chipa saludable', 'CHIP-003'],
  ['Chipalmendras bolsa500g', 'CHIP-001'],
  ['Chipalmendras bolsa500g · Chipalmendra Comun', 'CHIP-001'],
  ['chipa comun', 'CHIP-001'],
  ['chipa vegano bolsa500g', 'CHIP-002'],

  // Medialunas
  ['Medialunas (4 unidades lote)', 'FAC-001'],
  ['Medialunas (4 unidades lote) · Medialunas', 'FAC-001'],
  ['Medialunas docena', 'FAC-001'],
  ['Medialunas docena · Medialunas', 'FAC-001'],

  // Panificados
  ['Pan Hamburguesa', 'PAN-002'],
  ['Pan de Molde', 'PAN-001'],
  ['Pan de Molde · Pan de Molde', 'PAN-001'],
  ['pan · arabe', 'PAN-004'],
  ['pan · ovalado', 'PAN-003'],
  ['pan · ovalados', 'PAN-003'],
  ['pan · Pan de Molde', 'PAN-001'],
  ['pan · Pan de Molde con semilla', 'PAN-015'],
  ['pan · Pan de Molde sin semilla', 'PAN-016'],
  ['bollo', 'PAN-005'],
  ['bollos', 'PAN-005'],
  ['canastitas', 'PAN-009'],
  ['croisant', 'PAN-012'],
  ['disco de empanadas', 'PAN-014'],
  ['fajitas', 'PAN-008'],
  ['fajitas para tacos', 'PAN-008'],
  ['focaccia', 'PAN-006'],
  ['prepizza', 'PAN-007'],
  ['prepizzas', 'PAN-007'],
  ['raps', 'PAN-011'],
  ['rolls de canela', 'PAN-013'],
  ['laminado', 'INSU-005'],

  // Tartines
  ['Tartines · Tartin — Atún', 'TART-006'],
  ['Tartines · Tartin Atun', 'TART-006'],
  ['Tartines · Tartin — Capresse', 'TART-005'],
  ['Tartines · Tartin Capresse', 'TART-005'],
  ['Tartines · Tartin — Cebolla y Queso', 'TART-003'],
  ['Tartines · Tartin Cebolla y Queso', 'TART-003'],
  ['Tartines · Tartin — Espinaca', 'TART-007'],
  ['Tartines · Tartin Espinaca', 'TART-007'],
  ['Tartines · Tartin — Jamón y Queso', 'TART-001'],
  ['Tartines · Tartin Jamon y Queso', 'TART-001'],
  ['Tartines · Tartin — Pollo', 'TART-002'],
  ['Tartines · Tartin Pollo', 'TART-002'],
  ['Tartines · Tartin — Verduras y Roquefort', 'TART-004'],
  ['Tartines · Tartin Verduras y Roquefort', 'TART-004'],
  ['mini tartin', 'TART-008'],

  // Pizzas
  ['Pizzas · Pizza — Cuatro Poderes', 'PIZZ-001'],
  ['Pizzas · Pizza Cuatro Poderes', 'PIZZ-001'],
  ['Pizzas · Pizza - Especial', 'PIZZ-002'],
  ['Pizzas · Pizza Especial', 'PIZZ-002'],
  ['Pizzas · Pizza — Pesto', 'PIZZ-003'],
  ['Pizzas · Pizza Pesto', 'PIZZ-003'],
  ['Pizzas · Pizza — Napoleón', 'PIZZ-004'],
  ['Pizzas · Pizza Napoleon', 'PIZZ-004'],
  ['Pizzas · fugaza', 'PIZZ-005'],
  ['Pizzas · fugazza', 'PIZZ-005'],
  ['Pizzas · Pizza Jota', 'PIZZ-006'],
  ['Pizzas · Pizza capresse', 'PIZZ-007'],

  // Pastas
  ['fideos · fetuchini', 'PAST-001'],
  ['fideos · fetucchini', 'PAST-001'],
  ['fideos · sorrentinos', 'PAST-002'],
  ['sorrentino', 'PAST-002'],

  // Otros
  ['galletitas', 'OTR-001'],
  ['creps', 'OTR-002'],
  ['cookis', 'OTR-003'],

  // Sandwiches
  ['sandwich pollo', 'SAND-001'],
  ['sandwich jyq', 'SAND-002'],
  ['sandwich verdura', 'SAND-003'],

  // Insumos (sin uso histórico en Producción/Despachos — nombre canónico
  // agregado igual, mismo criterio que 'laminado' → INSU-005)
  ['Masa para Medialuna', 'INSU-001'],
  ['Relleno para Sandwich', 'INSU-002'],
  ['Relleno de Pollo', 'INSU-003'],
  ['Relleno Capresse', 'INSU-004'],

  // Nombre canónico del Catálogo (el dropdown del formulario siempre manda
  // este texto exacto — no reemplaza los alias históricos de arriba, los
  // complementa). Derivado programáticamente: son los 28 SKUs cuyo nombre
  // canónico no coincidía con ningún alias existente después de normalizar.
  ['Pan Ovalado', 'PAN-003'],
  ['Pan Árabe', 'PAN-004'],
  ['Croissant', 'PAN-012'],
  ['Pan de Molde con Semilla', 'PAN-015'],
  ['Pan de Molde sin Semilla', 'PAN-016'],
  ['Medialunas', 'FAC-001'],
  ['Tartín Jamón y Queso', 'TART-001'],
  ['Tartín Pollo', 'TART-002'],
  ['Tartín Cebolla y Queso', 'TART-003'],
  ['Tartín Verduras y Roquefort', 'TART-004'],
  ['Tartín Capresse', 'TART-005'],
  ['Tartín Atún', 'TART-006'],
  ['Tartín Espinaca', 'TART-007'],
  ['Pizza Cuatro Poderes', 'PIZZ-001'],
  ['Pizza Especial', 'PIZZ-002'],
  ['Pizza Pesto', 'PIZZ-003'],
  ['Pizza Napoleón', 'PIZZ-004'],
  ['Pizza Fugaza', 'PIZZ-005'],
  ['Pizza Jota', 'PIZZ-006'],
  ['Pizza Capresse', 'PIZZ-007'],
  ['Fideos Fettuccine', 'PAST-001'],
  ['Sorrentinos', 'PAST-002'],
  ['Sorrentino Jamón y Queso', 'PAST-003'],
  ['Sorrentino Calabaza', 'PAST-004'],
  ['Chipalmendras Común', 'CHIP-001'],
  ['Chipalmendras Vegano', 'CHIP-002'],
  ['Cookies', 'OTR-003'],
  ['Sandwich Jamón y Queso', 'SAND-002'],

  // Dropdown de Despacho (H_PRODUCTOS + FLAVORS hardcodeado en
  // buildFormDespachoHTML, Código.js) — fuente de datos separada del
  // Catálogo, mismo problema de alias faltantes que ya resolvimos del
  // lado de Producción. "Chipalmendras" y "Fideos" son ambiguos (el
  // dropdown no distingue variante): confirmado Común y Fettuccine.
  ['Chipalmendras', 'CHIP-001'],
  ['Pizzas · Pizza — Especial', 'PIZZ-002'],
  ['Pizzas · Pizza — Jota', 'PIZZ-006'],
  ['Pizzas · Pizza — Fugazza', 'PIZZ-005'],
  ['Pizzas · Pizza — Capresse', 'PIZZ-007'],
  ['Focaccias', 'PAN-006'],
  ['Bollos Pizza', 'PAN-005'],
  ['Fideos', 'PAST-001'],
  ['Disco Empanadas', 'PAN-014'],

  // ── Desambiguación Chipalmendras / Pan de Molde / Fideos ──────────
  // El dropdown de Despacho ahora pide variante para estos 3 productos
  // (antes mandaban el nombre genérico, que siempre resolvía al primer
  // SKU y descontaba stock del sabor equivocado). Los alias viejos de
  // arriba NO se tocan — quedan como estaban para no romper el
  // histórico — estos son alias nuevos, adicionales.
  ['Chipalmendras · Común', 'CHIP-001'],
  ['Chipalmendras · Vegano', 'CHIP-002'],
  ['Chipalmendras · Chipa Saludable', 'CHIP-003'],
  ['Pan de Molde · Común', 'PAN-001'],
  ['Pan de Molde · Con Semilla', 'PAN-015'],
  ['Pan de Molde · Sin Semilla', 'PAN-016'],
  ['Fideos · Fettuccine', 'PAST-001'],
  ['Fideos · Sorrentinos', 'PAST-002'],
  ['Fideos · Sorrentino Jamón y Queso', 'PAST-003'],
  ['Fideos · Sorrentino Calabaza', 'PAST-004']
];

// ════════════════════════════════════════════════════════════════
// SETUP — crea/completa las hojas Catálogo, Alias y Stock
// ════════════════════════════════════════════════════════════════
function ensureHojaCatalogo_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_CATALOGO);
  if (!ws) ws = ss.insertSheet(H_CATALOGO);
  if (ws.getRange(2, 1).getValue() !== 'SKU') {
    ws.getRange('A1').setValue('AÑAÑAI · Catálogo de productos — SKU único por producto, no editar sin avisar a Producción/Ventas');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_CATALOGO.length), '#2F6B4F');
    ws.getRange(2, 1, 1, ENCABEZADOS_CATALOGO.length).setValues([ENCABEZADOS_CATALOGO]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  var existentes = {};
  var last = ws.getLastRow();
  if (last >= DATA_ROW) {
    ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 1).getValues().forEach(function(r) {
      if (r[0]) existentes[String(r[0]).trim()] = true;
    });
  }
  var faltantes = CATALOGO_DATA.filter(function(r) { return !existentes[r[0]]; });
  if (faltantes.length) {
    var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
    ws.getRange(fila, 1, faltantes.length, ENCABEZADOS_CATALOGO.length).setValues(faltantes);
  }
  return ws;
}

function ensureHojaAlias_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_ALIAS);
  if (!ws) ws = ss.insertSheet(H_ALIAS);
  if (ws.getRange(2, 1).getValue() !== 'Texto crudo') {
    ws.getRange('A1').setValue('AÑAÑAI · Alias — mapea el texto tal cual se tipeó en Producción/Despachos a un SKU del Catálogo');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_ALIAS.length), '#7B2D00');
    ws.getRange(2, 1, 1, ENCABEZADOS_ALIAS.length).setValues([ENCABEZADOS_ALIAS]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  var existentes = {};
  var last = ws.getLastRow();
  if (last >= DATA_ROW) {
    ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 1).getValues().forEach(function(r) {
      if (r[0]) existentes[_norm(r[0])] = true;
    });
  }
  var faltantes = ALIAS_DATA.filter(function(r) { return !existentes[_norm(r[0])]; });
  if (faltantes.length) {
    var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
    ws.getRange(fila, 1, faltantes.length, ENCABEZADOS_ALIAS.length).setValues(faltantes);
  }
  return ws;
}

function ensureHojaStock_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_STOCK);
  if (!ws) ws = ss.insertSheet(H_STOCK);
  if (ws.getRange(2, 1).getValue() !== 'SKU') {
    ws.getRange('A1').setValue('AÑAÑAI · Stock de fábrica (en unidad de despacho) — lo actualizan Producción y Despachos, no editar a mano');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_STOCK.length), '#2F6B4F');
    ws.getRange(2, 1, 1, ENCABEZADOS_STOCK.length).setValues([ENCABEZADOS_STOCK]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

function inicializarStockSKU() {
  ensureHojaCatalogo_();
  ensureHojaAlias_();
  ensureHojaStock_();
  Logger.log('✅ Catálogo, Alias y Stock listos — ' + CATALOGO_DATA.length + ' SKUs y ' + ALIAS_DATA.length + ' alias cargados. La hoja Stock queda vacía hasta el primer movimiento.');
}

// ════════════════════════════════════════════════════════════════
// RESOLUCIÓN DE SKU
// ════════════════════════════════════════════════════════════════
function _textoCrudo_(producto, variante) {
  producto = String(producto == null ? '' : producto).trim();
  variante = String(variante == null ? '' : variante).trim();
  return variante ? producto + ' · ' + variante : producto;
}

function _catalogoPorSku_(sku) {
  var ws = ensureHojaCatalogo_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return null;
  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues();
  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][0]).trim() === String(sku).trim()) {
      return {
        sku: filas[i][0],
        nombre: filas[i][1],
        categoria: filas[i][2],
        tipo: filas[i][3],
        unidadProduccion: filas[i][4],
        unidadDespacho: filas[i][5],
        factor: filas[i][6] === '' ? null : Number(filas[i][6])
      };
    }
  }
  return null;
}

// Busca el SKU de un texto crudo de Producción/Despachos en la hoja Alias.
// No crea nada nuevo: si no hay alias cargado, devuelve ok:false para que
// se revise a mano antes de que el producto entre al Catálogo/Stock.
function _claveStock_(producto, variante) {
  var textoCrudo = _textoCrudo_(producto, variante);
  var clave = _norm(textoCrudo);

  var ws = ensureHojaAlias_();
  var last = ws.getLastRow();
  if (last >= DATA_ROW) {
    var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 2).getValues();
    for (var i = 0; i < filas.length; i++) {
      if (_norm(filas[i][0]) === clave) {
        var sku = String(filas[i][1]).trim();
        var cat = _catalogoPorSku_(sku);
        if (!cat) {
          return { ok: false, mensaje: 'El alias "' + textoCrudo + '" apunta al SKU "' + sku + '", que no existe en el Catálogo.' };
        }
        return { ok: true, textoCrudo: textoCrudo, sku: sku, catalogo: cat };
      }
    }
  }
  return { ok: false, mensaje: 'SKU no encontrado para "' + textoCrudo + '". Cargalo en la hoja Alias antes de registrar el movimiento.' };
}

// ════════════════════════════════════════════════════════════════
// MOVIMIENTOS DE STOCK
// ════════════════════════════════════════════════════════════════
// Aplica un movimiento sobre la hoja Stock para un SKU ya resuelto.
// tipo 'produccion': cantidad viene en la unidad de producción del SKU y va
//   ENTERA al Stock — la merma NO se descuenta acá. "Cantidad producida" y
//   "Merma" son dos datos independientes a propósito: si se restaran, un
//   operario que no entienda bien esa relación puede terminar cargando mal
//   sin darse cuenta (típicamente escribiendo la cantidad buena Y la merma
//   por separado, esperando que se sumen, cuando en realidad se restaban).
//   La merma se guarda igual, aparte, en su propia columna ("Merma
//   acumulada") — es un dato de seguimiento/calidad, no afecta el Stock.
// tipo 'despacho': cantidad ya está en unidad de despacho. Si no hay stock
//   suficiente, RECHAZA el movimiento (no toca la hoja) y devuelve ok:false.
function _moverStock_(sku, tipo, cantidad, opts) {
  opts = opts || {};
  var cat = _catalogoPorSku_(sku);
  if (!cat) return { ok: false, mensaje: 'SKU "' + sku + '" no existe en el Catálogo.' };

  var ws = ensureHojaStock_();
  var last = ws.getLastRow();
  var fila = null, stockActual = 0, mermaActual = 0;
  if (last >= DATA_ROW) {
    var claves = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 1).getValues();
    for (var i = 0; i < claves.length; i++) {
      if (String(claves[i][0]).trim() === sku) { fila = DATA_ROW + i; break; }
    }
  }
  if (fila) {
    stockActual = Number(ws.getRange(fila, 3).getValue()) || 0;
    mermaActual = Number(ws.getRange(fila, 5).getValue()) || 0;
  }

  var merma   = Number(opts.merma) || 0;
  var detalle = opts.detalle || '';
  var delta;
  var sinStockSuficiente = false;

  if (tipo === 'produccion') {
    var factor = cat.factor || 1;
    delta = Number(cantidad) / factor; // la merma NO se resta acá (ver comentario de arriba)
  } else if (tipo === 'despacho') {
    if (cat.tipo === 'Insumo') return { ok: false, mensaje: 'El SKU "' + sku + '" es un insumo, no tiene equivalencia de despacho.' };
    delta = -Number(cantidad);
    sinStockSuficiente = (stockActual + delta) < 0;
    // Sin stock suficiente y todavía no confirmaron "igual imputar": no tocamos
    // la hoja, devolvemos la alerta para que el formulario pida el motivo.
    if (sinStockSuficiente && !opts.forzar) {
      return {
        ok: false,
        necesitaConfirmacion: true,
        stockActual: stockActual,
        mensaje: 'No hay stock suficiente de ' + cat.nombre + '. Stock actual: ' + stockActual + ', solicitado: ' + cantidad + '.'
      };
    }
    // opts.forzar=true → seguimos igual; el stock puede quedar negativo a
    // propósito, como señal visible de que hay que revisar/corregir después.
  } else if (tipo === 'ajuste') {
    // Auditoría semanal: "cantidad" acá es el STOCK REAL declarado (un valor
    // absoluto, no un delta) — se usa para pisar el número del sistema con
    // el conteo físico real.
    delta = Number(cantidad) - stockActual;
  } else if (tipo === 'correccion') {
    // Deshacer un movimiento: "cantidad" ya viene como el delta exacto a
    // aplicar (típicamente el opuesto de un movimiento anterior) — sin
    // ninguna otra transformación ni validación de stock negativo, porque
    // el objetivo es revertir exactamente lo que pasó, sea lo que sea.
    delta = Number(cantidad);
  } else {
    return { ok: false, mensaje: 'Tipo de movimiento inválido: ' + tipo };
  }

  var nuevoStock = stockActual + delta;
  var nuevaMerma = mermaActual + merma;
  var ahora = new Date();

  if (!fila) {
    fila = Math.max(DATA_ROW, last + 1);
    ws.getRange(fila, 1, 1, 2).setValues([[sku, cat.nombre]]);
  }
  ws.getRange(fila, 3).setValue(nuevoStock);
  ws.getRange(fila, 4).setValue(cat.unidadDespacho || cat.unidadProduccion);
  ws.getRange(fila, 5).setValue(nuevaMerma);
  ws.getRange(fila, 6).setValue(ahora).setNumberFormat('DD/MM/YYYY HH:mm');
  var detalleFinal = detalle + (sinStockSuficiente ? ' · ⚠ imputado sin stock suficiente' : '');
  ws.getRange(fila, 7).setValue(detalleFinal);

  // Historial completo: la hoja Stock de arriba solo guarda el ÚLTIMO
  // movimiento por SKU (lo pisa cada vez); acá queda cada movimiento por
  // separado, para el historial de la pantalla de Stock.
  var TIPO_LABEL = { produccion: 'Producción', despacho: 'Despacho', ajuste: 'Ajuste', correccion: 'Corrección' };
  registrarMovimientoStock_({
    sku: sku, producto: cat.nombre,
    tipo: TIPO_LABEL[tipo] || tipo,
    cantidad: delta, merma: merma, stockResultante: nuevoStock, detalle: detalleFinal
  });

  return {
    ok: true, sku: sku, stockActual: nuevoStock, merma: nuevaMerma,
    stockPrevio: stockActual, sinStockSuficiente: sinStockSuficiente
  };
}

// Suma stock cuando se registra una producción.
// producto/variante = texto tal cual se cargó (se resuelve a SKU vía Alias).
// opts: { merma, lote }
function sumarStockPorProduccion_(producto, variante, cantidadProducida, opts) {
  opts = opts || {};
  var res = _claveStock_(producto, variante);
  if (!res.ok) return res;
  return _moverStock_(res.sku, 'produccion', cantidadProducida, {
    merma: opts.merma,
    detalle: 'Producción' + (opts.lote ? ' · ' + opts.lote : '')
  });
}

// Resta stock cuando se registra un despacho. Rechaza (ok:false) si no
// alcanza el stock — quien llame a esta función NO debe guardar el despacho
// si la respuesta viene con ok:false.
// opts: { desId }
function restarStockPorDespacho_(producto, variante, unidadesDespachadas, opts) {
  opts = opts || {};
  var res = _claveStock_(producto, variante);
  if (!res.ok) return res;
  return _moverStock_(res.sku, 'despacho', unidadesDespachadas, {
    detalle: 'Despacho' + (opts.desId ? ' · ' + opts.desId : ''),
    forzar: !!opts.forzar
  });
}

// ════════════════════════════════════════════════════════════════
// ALERTAS DE STOCK — trazabilidad de despachos imputados sin stock
// suficiente (el usuario confirmó "igual imputar la venta" con un
// motivo). Sirve para revisar y corregir el stock más tarde sin tener
// que buscarlo a mano en Despachos/Stock.
// ════════════════════════════════════════════════════════════════
var H_ALERTAS_STOCK = 'Alertas Stock';
var ENCABEZADOS_ALERTAS_STOCK = [
  'Fecha', 'DES-ID', 'SKU', 'Producto', 'Variante',
  'Unidades despachadas', 'Stock disponible al momento', 'Motivo', 'Usuario', 'Estado'
];

function ensureHojaAlertasStock_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_ALERTAS_STOCK);
  if (!ws) ws = ss.insertSheet(H_ALERTAS_STOCK);
  if (ws.getRange(2, 1).getValue() !== 'Fecha') {
    ws.getRange('A1').setValue('AÑAÑAI · Despachos imputados sin stock suficiente — revisar y resolver, no editar a mano salvo la columna Estado');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_ALERTAS_STOCK.length), '#a05010');
    ws.getRange(2, 1, 1, ENCABEZADOS_ALERTAS_STOCK.length).setValues([ENCABEZADOS_ALERTAS_STOCK]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

function registrarAlertaStock_(datos) {
  var ws = ensureHojaAlertasStock_();
  ws.appendRow([
    new Date(), datos.desId, datos.sku, datos.producto, datos.variante || '',
    datos.cantidad, datos.stockAlMomento, datos.motivo || '', _usuarioActual(), 'Pendiente de revisión'
  ]);
}

// Marca una alerta de stock como revisada desde la pantalla de Stock.
// "fila" es el número de fila real en la hoja Alertas Stock (viene del
// payload que arma getDatosStockParaPantalla, no hace falta buscarlo).
function marcarAlertaRevisada(fila) {
  try {
    var ws = ensureHojaAlertasStock_();
    ws.getRange(Number(fila), 10).setValue('Resuelto · ' + _usuarioActual());
    return { ok: true };
  } catch (e) {
    return { ok: false, mensaje: '❌ ' + e.message };
  }
}

// ════════════════════════════════════════════════════════════════
// DESHACER MOVIMIENTO — corrige un error de carga (Producción o
// Despacho) sin tocar celdas a mano. Nunca borra el movimiento
// original: lo marca "Anulado" y agrega uno nuevo que lo cancela
// exactamente, para que el Stock quede correcto y quede el rastro
// completo de qué pasó. Protegido por PIN — ver _verificarPin_.
// ════════════════════════════════════════════════════════════════
function deshacerMovimientoStock(fila, pin, motivo) {
  try {
    if (!_verificarPin_(pin)) return { ok: false, mensaje: '🔒 PIN incorrecto.' };
    fila = Number(fila);
    var ws = ensureHojaMovimientosStock_();
    if (fila < DATA_ROW || fila > ws.getLastRow()) return { ok: false, mensaje: 'No se encontró ese movimiento.' };

    var row = ws.getRange(fila, 1, 1, ENCABEZADOS_MOVIMIENTOS_STOCK.length).getValues()[0];
    var sku = String(row[1] || '').trim();
    var cantidadOriginal = Number(row[4]) || 0;
    var detalleOriginal = String(row[7] || '');
    var tipoOriginal = String(row[3] || '');
    var estadoActual = String(row[9] || 'Vigente');

    if (!sku) return { ok: false, mensaje: 'Ese movimiento no tiene SKU, no se puede deshacer.' };
    if (estadoActual === 'Anulado') return { ok: false, mensaje: 'Ese movimiento ya estaba anulado.' };
    if (tipoOriginal === 'Corrección') return { ok: false, mensaje: 'No se puede deshacer una corrección. Si hizo falta deshacer algo más, generá un ajuste desde Auditoría semanal.' };

    var resultado = _moverStock_(sku, 'correccion', -cantidadOriginal, {
      detalle: 'Corrección · anula fila ' + fila + ' (' + detalleOriginal + ')' + (motivo ? ' · Motivo: ' + motivo : '')
    });
    if (!resultado.ok) return resultado;

    ws.getRange(fila, 10).setValue('Anulado');

    // Best-effort: deja una nota en el registro de origen (Producción o
    // Despachos) para que no quede "suelto". Si no lo encuentra, no pasa
    // nada grave — la corrección del Stock ya se aplicó igual.
    try { _anotarOrigenAnulado_(detalleOriginal, fila); } catch (eAnotar) {}

    return {
      ok: true,
      mensaje: '✅ Movimiento anulado. Stock de ' + cantidadOriginal + ' corregido: ' + resultado.stockPrevio + ' → ' + resultado.stockActual + '.'
    };
  } catch (e) {
    return { ok: false, mensaje: '❌ ' + e.message };
  }
}

function _anotarOrigenAnulado_(detalleOriginal, filaMov) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nota = '⚠ ANULADO (ver Movimientos Stock fila ' + filaMov + ')';

  var mLote = detalleOriginal.match(/LOTE-[\w-]+/);
  if (mLote) {
    var wsP = ss.getSheetByName(H_PRODUCCIONES);
    if (!wsP) return;
    var lastP = wsP.getLastRow();
    if (lastP < 2) return;
    var lotes = wsP.getRange(2, 7, lastP - 1, 1).getValues(); // col G = Lote
    for (var i = 0; i < lotes.length; i++) {
      if (String(lotes[i][0]).trim() === mLote[0]) {
        var filaP = 2 + i;
        var obsActual = wsP.getRange(filaP, 9).getValue(); // col I = Observaciones
        wsP.getRange(filaP, 9).setValue((obsActual ? obsActual + ' · ' : '') + nota);
        return;
      }
    }
    return;
  }

  var mDes = detalleOriginal.match(/DES-\d+/);
  if (mDes) {
    var wsD = ss.getSheetByName(H_DESPACHOS);
    if (!wsD) return;
    var lastD = wsD.getLastRow();
    if (lastD < DATA_ROW) return;
    var ids = wsD.getRange(DATA_ROW, 1, lastD - DATA_ROW + 1, 1).getValues();
    for (var j = 0; j < ids.length; j++) {
      if (String(ids[j][0]).trim() === mDes[0]) {
        var filaD = DATA_ROW + j;
        var obsD = wsD.getRange(filaD, 14).getValue(); // col N = Obs
        wsD.getRange(filaD, 14).setValue((obsD ? obsD + ' · ' : '') + nota);
        return;
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// AUDITORÍA SEMANAL — carga el conteo físico real y ajusta el Stock
// de una sola vez. Cada ajuste queda registrado en Movimientos Stock
// como un movimiento más (tipo "Ajuste"), con el motivo — es tu
// historial de desvíos semana a semana. Protegido por PIN.
// ajustes: [{sku, stockReal}, ...]
// ════════════════════════════════════════════════════════════════
function registrarAjustesStock(ajustes, pin, motivo) {
  if (!_verificarPin_(pin)) return { ok: false, mensaje: '🔒 PIN incorrecto.' };
  if (!ajustes || !ajustes.length) return { ok: false, mensaje: 'No hay ajustes para guardar.' };
  var aplicados = 0, errores = [];
  ajustes.forEach(function(a) {
    var cat = _catalogoPorSku_(a.sku);
    if (!cat) { errores.push(a.sku + ': SKU no encontrado'); return; }
    var r = _moverStock_(a.sku, 'ajuste', a.stockReal, {
      detalle: 'Conteo semanal · stock real declarado: ' + a.stockReal + (motivo ? ' · ' + motivo : '')
    });
    if (r.ok) aplicados++; else errores.push(a.sku + ': ' + r.mensaje);
  });
  return {
    ok: errores.length === 0,
    aplicados: aplicados,
    mensaje: aplicados + ' ajuste(s) aplicado(s)' + (errores.length ? ' · Errores: ' + errores.join(' | ') : '')
  };
}

// ════════════════════════════════════════════════════════════════
// HISTORIAL COMPLETO DE MOVIMIENTOS — a diferencia de la hoja Stock
// (que solo guarda el último movimiento por SKU), acá queda CADA
// movimiento por separado: quién lo cargó, cuándo, cuánto y por qué.
// Alimenta el historial que se ve al tocar un producto en la pantalla
// de Stock. No reemplaza nada existente, es un agregado.
// ════════════════════════════════════════════════════════════════
var H_MOVIMIENTOS_STOCK = 'Movimientos Stock';
var ENCABEZADOS_MOVIMIENTOS_STOCK = [
  'Fecha', 'SKU', 'Producto', 'Tipo', 'Cantidad', 'Merma', 'Stock resultante', 'Detalle', 'Usuario', 'Estado'
];

function ensureHojaMovimientosStock_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_MOVIMIENTOS_STOCK);
  if (!ws) ws = ss.insertSheet(H_MOVIMIENTOS_STOCK);
  if (ws.getRange(2, 1).getValue() !== 'Fecha') {
    ws.getRange('A1').setValue('AÑAÑAI · Historial completo de movimientos de Stock — no editar a mano, lo completa el sistema');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_MOVIMIENTOS_STOCK.length), '#2F6B4F');
    ws.getRange(2, 1, 1, ENCABEZADOS_MOVIMIENTOS_STOCK.length).setValues([ENCABEZADOS_MOVIMIENTOS_STOCK]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  } else if (ws.getRange(2, ENCABEZADOS_MOVIMIENTOS_STOCK.length).getValue() !== 'Estado') {
    // Migración chica y única: se sumó la columna "Estado" (Vigente/Anulado)
    // para poder deshacer movimientos — si la hoja es de antes de este
    // cambio, se agrega sola una vez y las filas viejas quedan "Vigente"
    // (nunca se anularon).
    var colEstado = ENCABEZADOS_MOVIMIENTOS_STOCK.length;
    ws.getRange(2, colEstado).setValue('Estado');
    var last = ws.getLastRow();
    if (last >= DATA_ROW) {
      var n = last - DATA_ROW + 1, valores = [];
      for (var i = 0; i < n; i++) valores.push(['Vigente']);
      ws.getRange(DATA_ROW, colEstado, n, 1).setValues(valores);
    }
  }
  return ws;
}

function registrarMovimientoStock_(datos) {
  var ws = ensureHojaMovimientosStock_();
  var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
  ws.getRange(fila, 1, 1, ENCABEZADOS_MOVIMIENTOS_STOCK.length).setValues([[
    new Date(), datos.sku, datos.producto, datos.tipo,
    datos.cantidad, datos.merma || 0, datos.stockResultante, datos.detalle || '', _usuarioActual(), 'Vigente'
  ]]);
  return fila;
}

// ════════════════════════════════════════════════════════════════
// API PARA LA PANTALLA DE STOCK — un solo viaje al servidor al abrir
// la página (mismo patrón que obtenerDatosFormularioProduccion).
// ════════════════════════════════════════════════════════════════
function getDatosStockParaPantalla() {
  var wsCat = ensureHojaCatalogo_();
  var lastCat = wsCat.getLastRow();
  var catalogo = lastCat >= DATA_ROW
    ? wsCat.getRange(DATA_ROW, 1, lastCat - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues()
    : [];

  var wsStock = ensureHojaStock_();
  var lastStock = wsStock.getLastRow();
  var stockInfo = {};
  if (lastStock >= DATA_ROW) {
    wsStock.getRange(DATA_ROW, 1, lastStock - DATA_ROW + 1, 7).getValues().forEach(function(r) {
      var sku = String(r[0] || '').trim();
      if (!sku) return;
      stockInfo[sku] = {
        stock: Number(r[2]) || 0,
        merma: Number(r[4]) || 0,
        actualizado: r[5] instanceof Date ? r[5].getTime() : null,
        ultimoMovimiento: String(r[6] || '')
      };
    });
  }

  var productos = [];
  var capitalInmovilizado = 0;
  var sinCostoCargado = 0;
  var totalTerminados = 0;
  catalogo.forEach(function(r) {
    var sku = String(r[0] || '').trim();
    if (!sku) return;
    var nombre = r[1], categoria = r[2], tipo = r[3];
    var unidad = r[5] || r[4];
    var info = stockInfo[sku] || { stock: 0, merma: 0, actualizado: null, ultimoMovimiento: '' };
    var cvu = null, valorAcosto = null;
    if (tipo === 'Terminado') {
      totalTerminados++;
      cvu = getCVUPorSku_(sku);  // de Configuracion.gs — null si no hay match confiable
      if (cvu != null) {
        valorAcosto = info.stock * cvu;
        capitalInmovilizado += valorAcosto;
      } else {
        sinCostoCargado++;
      }
    }
    productos.push({
      sku: sku, nombre: nombre, categoria: categoria, tipo: tipo, unidad: unidad,
      stock: info.stock, merma: info.merma, actualizado: info.actualizado,
      ultimoMovimiento: info.ultimoMovimiento,
      // metaSemanal solo aplica a Terminados — es la referencia para la
      // alerta de "stock bajo" (< 20% de la meta). Insumos no tienen
      // meta semanal todavía, quedan sin semáforo hasta que la haya.
      metaSemanal: tipo === 'Terminado' ? obtenerMetaSemanal_(sku) : null,
      cvu: cvu, valorAcosto: valorAcosto
    });
  });

  // Historial completo de movimientos, más reciente primero. Si esta hoja
  // crece mucho (miles de filas) con el tiempo, acá es el lugar para sumar
  // un filtro por fecha — no hace falta todavía con el volumen actual.
  var wsMov = ensureHojaMovimientosStock_();
  var lastMov = wsMov.getLastRow();
  var movimientos = [];
  if (lastMov >= DATA_ROW) {
    wsMov.getRange(DATA_ROW, 1, lastMov - DATA_ROW + 1, ENCABEZADOS_MOVIMIENTOS_STOCK.length).getValues().forEach(function(r, i) {
      if (!r[1]) return;
      movimientos.push({
        fila: DATA_ROW + i,
        f: r[0] instanceof Date ? r[0].getTime() : null,
        sku: String(r[1]).trim(), producto: String(r[2] || ''), tipo: String(r[3] || ''),
        cantidad: Number(r[4]) || 0, merma: Number(r[5]) || 0, stockResultante: Number(r[6]) || 0,
        detalle: String(r[7] || ''), usuario: String(r[8] || ''), estado: String(r[9] || 'Vigente')
      });
    });
    movimientos.reverse();
  }

  // Despachos imputados sin stock suficiente (trazabilidad ya armada)
  var wsAlertas = ensureHojaAlertasStock_();
  var lastAl = wsAlertas.getLastRow();
  var alertas = [];
  if (lastAl >= DATA_ROW) {
    wsAlertas.getRange(DATA_ROW, 1, lastAl - DATA_ROW + 1, ENCABEZADOS_ALERTAS_STOCK.length).getValues().forEach(function(r, i) {
      if (!r[1]) return;
      alertas.push({
        fila: DATA_ROW + i,
        f: r[0] instanceof Date ? r[0].getTime() : null,
        desId: String(r[1] || ''), sku: String(r[2] || ''), producto: String(r[3] || ''),
        variante: String(r[4] || ''), cantidad: Number(r[5]) || 0, stockAlMomento: Number(r[6]) || 0,
        motivo: String(r[7] || ''), usuario: String(r[8] || ''), estado: String(r[9] || '')
      });
    });
    alertas.reverse();
  }

  return {
    productos: productos, movimientos: movimientos, alertas: alertas,
    capital: {
      valor: capitalInmovilizado,
      sinCosto: sinCostoCargado,
      totalTerminados: totalTerminados
    }
  };
}

// ════════════════════════════════════════════════════════════════
// REGISTRAR PRODUCCIÓN — genera el lote y sincroniza Stock (todo o nada)
// ════════════════════════════════════════════════════════════════
function generarLote_(fecha, letraTurno) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var contador = Number(props.getProperty('CONTADOR_LOTE')) || 1000;
    contador += 1;
    props.setProperty('CONTADOR_LOTE', String(contador));

    var tz = Session.getScriptTimeZone();
    var fechaTexto = Utilities.formatDate(fecha, tz, 'yyyyMMdd');
    return 'LOTE-' + fechaTexto + '-' + letraTurno + '-' + String(contador).padStart(4, '0');
  } finally {
    lock.releaseLock();
  }
}

// La hoja Produccion_Produccion existía de antes en el sandbox donde se armó
// este módulo — nunca se creó por código, alguien la armó a mano. Por eso
// registrarProduccion() daba "Cannot read properties of null (reading
// 'appendRow')" en una planilla nueva: getSheetByName devolvía null y nadie
// la creaba. Esto reemplaza a la vieja ensureColumnasProduccion_ (que solo
// parcheaba columnas y se quedaba callada si la hoja no existía) por una que
// además la crea de cero la primera vez, igual que ensureHojaCatalogo_/
// ensureHojaStock_/etc.
var ENCABEZADOS_PRODUCCION = [
  'Fecha carga', 'Fecha producción', 'Turno', 'SKU', 'Producto',
  'Cantidad', 'Lote', '', 'Observaciones', 'Unidad', 'Merma'
];

function ensureHojaProduccion_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_PRODUCCIONES);
  if (!ws) {
    ws = ss.insertSheet(H_PRODUCCIONES);
    ws.getRange(1, 1, 1, ENCABEZADOS_PRODUCCION.length).setValues([ENCABEZADOS_PRODUCCION]);
    estiloHeader(ws.getRange(1, 1, 1, ENCABEZADOS_PRODUCCION.length), '#2F6B4F');
    ws.setFrozenRows(1);
    return ws;
  }
  // Hoja ya existente (p.ej. la del sandbox) — asegura las columnas Unidad(10)
  // y Merma(11) sin pisar nada de lo que ya tenía cargado.
  if (ws.getRange(1, 10).getValue() !== 'Unidad') ws.getRange(1, 10).setValue('Unidad');
  if (ws.getRange(1, 11).getValue() !== 'Merma')  ws.getRange(1, 11).setValue('Merma');
  return ws;
}

function registrarProduccion(datos) {
  try {
    var cantidad = Number(datos.cantidad) || 0;
    if (cantidad <= 0) return { ok: false, mensaje: 'La cantidad tiene que ser mayor a 0' };
    if (!datos.fecha) return { ok: false, mensaje: 'Elegí una fecha' };

    // ── resolver SKU ANTES de generar lote o tocar cualquier hoja ──
    var res = _claveStock_(datos.producto, datos.variante);
    if (!res.ok) return { ok: false, mensaje: res.mensaje };

    var fecha = new Date(datos.fecha + 'T00:00:00');
    var turno = ['Mañana', 'Tarde', 'Noche'].indexOf(datos.turno) > -1 ? datos.turno : 'Mañana';
    var letraTurno = { 'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N' }[turno];
    var lote = generarLote_(fecha, letraTurno);
    var merma = Number(datos.merma) || 0;

    // ── sumar a Stock; si falla (p. ej. SKU inválido), no se guarda la producción ──
    var movimiento = sumarStockPorProduccion_(datos.producto, datos.variante, cantidad, {
      merma: merma,
      lote: lote
    });
    if (!movimiento.ok) return { ok: false, mensaje: movimiento.mensaje };

    var hojaProducciones = ensureHojaProduccion_();
    hojaProducciones.appendRow([
      new Date(), fecha, turno, res.sku, res.catalogo.nombre, cantidad, lote, '', datos.observaciones || '', res.catalogo.unidadProduccion, merma
    ]);

    var tz = Session.getScriptTimeZone();
    return {
      ok: true,
      lote: lote,
      sku: res.sku,
      producto: res.catalogo.nombre,
      cantidad: cantidad,
      stockActual: movimiento.stockActual,
      fecha: Utilities.formatDate(fecha, tz, 'dd/MM/yyyy')
    };
  } catch (e) {
    return { ok: false, mensaje: '❌ ' + e.message };
  }
}

// ════════════════════════════════════════════════════════════════
// REGISTRAR PRODUCCIÓN LIBRE — categoría "Otro", sin SKU, sin Stock
// La merma acá es solo informativa (columna Merma del lote): no hay
// _moverStock_ de por medio porque "Otro" no tiene SKU ni equivalencia.
// ════════════════════════════════════════════════════════════════
function registrarProduccionLibre(datos) {
  try {
    var cantidad = Number(datos.cantidad) || 0;
    if (cantidad <= 0) return { ok: false, mensaje: 'La cantidad tiene que ser mayor a 0' };
    if (!datos.producto || !String(datos.producto).trim()) return { ok: false, mensaje: 'Escribí qué se produjo' };
    if (!datos.unidad) return { ok: false, mensaje: 'Elegí una unidad' };
    if (!datos.fecha) return { ok: false, mensaje: 'Elegí una fecha' };

    var fecha = new Date(datos.fecha + 'T00:00:00');
    var turno = ['Mañana', 'Tarde', 'Noche'].indexOf(datos.turno) > -1 ? datos.turno : 'Mañana';
    var letraTurno = { 'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N' }[turno];
    var lote = generarLote_(fecha, letraTurno);
    var merma = Number(datos.merma) || 0;

    var hojaProducciones = ensureHojaProduccion_();
    hojaProducciones.appendRow([
      new Date(), fecha, turno, '—', String(datos.producto).trim(), cantidad, lote, '', datos.observaciones || '', datos.unidad, merma
    ]);

    var tz = Session.getScriptTimeZone();
    return {
      ok: true,
      lote: lote,
      producto: String(datos.producto).trim(),
      cantidad: cantidad,
      unidad: datos.unidad,
      merma: merma,
      fecha: Utilities.formatDate(fecha, tz, 'dd/MM/yyyy')
    };
  } catch (e) {
    return { ok: false, mensaje: '❌ ' + e.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API PARA EL FORMULARIO — un solo viaje al servidor al abrir la página
// ════════════════════════════════════════════════════════════════
function obtenerDatosFormularioProduccion() {
  var wsCat = ensureHojaCatalogo_();
  var lastCat = wsCat.getLastRow();
  var catalogo = lastCat >= DATA_ROW
    ? wsCat.getRange(DATA_ROW, 1, lastCat - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues()
    : [];

  var wsStock = ensureHojaStock_();
  var lastStock = wsStock.getLastRow();
  var stockPorSku = {};
  if (lastStock >= DATA_ROW) {
    wsStock.getRange(DATA_ROW, 1, lastStock - DATA_ROW + 1, 3).getValues().forEach(function(r) {
      if (r[0]) stockPorSku[String(r[0]).trim()] = Number(r[2]) || 0;
    });
  }

  var terminados = [];
  var insumos = [];
  catalogo.forEach(function(r) {
    var sku = String(r[0] || '').trim();
    if (!sku) return;
    if (SKU_OCULTOS_EN_FORMULARIOS.indexOf(sku) > -1) return; // ver definición arriba
    var nombre = r[1], categoria = r[2], tipo = r[3];
    var stock = stockPorSku[sku] || 0;
    if (tipo === 'Terminado') {
      terminados.push({ sku: sku, nombre: nombre, categoria: categoria, stock: stock, metaSemanal: obtenerMetaSemanal_(sku), unidadProduccion: r[4] });
    } else if (tipo === 'Insumo') {
      insumos.push({ sku: sku, nombre: nombre, categoria: categoria, stock: stock });
    }
  });

  return {
    terminados: terminados,
    insumos: insumos,
    unidadesOtro: UNIDADES_OTRO
  };
}

// ════════════════════════════════════════════════════════════════
// MENÚ — se agrega al onOpen() de Código.gs (mismo patrón que gastoOnOpen())
// ════════════════════════════════════════════════════════════════
function produccionOnOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏭 AÑAÑAI Producción')
    .addItem('📱 Abrir Producción', 'abrirProduccionSidebar')
    .addToUi();
}

function abrirProduccionSidebar() {
  var tp = HtmlService.createTemplateFromFile('ProduccionForm');
  tp.manifestUrl = ScriptApp.getService().getUrl() + '?page=manifest';
  tp.icon192DataUri = 'data:image/png;base64,' + ICON_192_PRODUCCION_BASE64;
  SpreadsheetApp.getUi().showSidebar(
    tp.evaluate().setTitle('🏭 Producción').setWidth(400)
  );
}

// ════════════════════════════════════════════════════════════════
// MENÚ Y ACCESO — pantalla de Stock (página completa, mismo patrón
// de acceso que el Dashboard: se abre con su propio link, no un sidebar)
// ════════════════════════════════════════════════════════════════
function stockOnOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📦 AÑAÑAI Stock')
    .addItem('📊 Ver Stock', 'abrirStockModal_')
    .addItem('🔗 Copiar link de Stock (Web App)', 'abrirStockWeb_')
    .addSeparator()
    .addItem('🔑 Configurar PIN de Correcciones', 'configurarPinCorrecciones_')
    .addToUi();
}

// Acceso rápido — no depende de que la Web App esté deployada/actualizada.
// Se abre directo desde el menú, igual que Producción con su sidebar: usa el
// código que está guardado ahora mismo en el editor, sin pasar por ?page=stock
// ni por ninguna versión publicada.
function abrirStockModal_() {
  var tp = HtmlService.createTemplateFromFile('Stock');
  tp.datos = JSON.stringify(getDatosStockParaPantalla());
  var dashUrl = '';
  try { dashUrl = ScriptApp.getService().getUrl(); } catch (e) {}
  tp.dashboardUrl = dashUrl;
  var html = tp.evaluate().setWidth(1100).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, '📦 Stock');
}

// Link para compartir fuera de la planilla (sí depende de tener la Web App
// deployada con la última versión — ver abrirStockModal_ para el acceso rápido).
function abrirStockWeb_() {
  var url = ScriptApp.getService().getUrl() + '?page=stock';
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:18px;text-align:center">' +
    '<p style="margin:0 0 14px;color:#333">📦 Pantalla de Stock — se abre en una pestaña nueva</p>' +
    '<a href="' + url + '" target="_blank" ' +
    'style="display:inline-block;background:#2F6B4F;color:#fff;padding:10px 22px;' +
    'border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Abrir Stock ↗</a>' +
    '</div>'
  ).setWidth(300).setHeight(130);
  SpreadsheetApp.getUi().showModalDialog(html, 'Stock');
}

// ════════════════════════════════════════════════════════════════
// AUDITORÍA DE PRODUCCIÓN — un solo viaje al servidor para la pantalla
// nueva del Dashboard: movimientos de producción (últimos 90 días),
// toda la Distribución diaria cargada, y las Metas semanales. Todo el
// cruce día-por-día/semana-por-semana se arma en el cliente.
// ════════════════════════════════════════════════════════════════
function getDatosAuditoria() {
  var TZ = 'America/Argentina/Buenos_Aires';
  var LIMITE_DIAS = 90;
  var corte = new Date(); corte.setDate(corte.getDate() - LIMITE_DIAS);

  var wsMov = ensureHojaMovimientosStock_();
  var lastMov = wsMov.getLastRow();
  var movimientos = [];
  if (lastMov >= DATA_ROW) {
    wsMov.getRange(DATA_ROW, 1, lastMov - DATA_ROW + 1, ENCABEZADOS_MOVIMIENTOS_STOCK.length).getValues().forEach(function(r) {
      if (!r[1] || r[3] !== 'Producción' || r[9] === 'Anulado') return;
      var fecha = r[0] instanceof Date ? r[0] : null;
      if (!fecha || fecha < corte) return;
      movimientos.push({
        f: fecha.getTime(),
        fDia: Utilities.formatDate(fecha, TZ, 'yyyy-MM-dd'),
        hora: Utilities.formatDate(fecha, TZ, 'HH:mm'),
        sku: String(r[1]).trim(), producto: String(r[2] || ''),
        cantidad: Number(r[4]) || 0, detalle: String(r[7] || ''), usuario: String(r[8] || '')
      });
    });
  }

  var wsPlan = ensureHojaPlanSemanal_();
  var lastPlan = wsPlan.getLastRow();
  var plan = [];
  if (lastPlan >= DATA_ROW) {
    wsPlan.getRange(DATA_ROW, 1, lastPlan - DATA_ROW + 1, ENCABEZADOS_PLAN_SEMANAL.length).getValues().forEach(function(r) {
      if (!r[1]) return;
      plan.push({
        semana: String(r[0]).trim(), sku: String(r[1]).trim(), producto: String(r[2] || ''),
        dias: [r[3], r[4], r[5], r[6], r[7], r[8], r[9]].map(function(v) { return Number(v) || 0; })
      });
    });
  }

  var wsCat = ensureHojaCatalogo_();
  var lastCat = wsCat.getLastRow();
  var catalogo = lastCat >= DATA_ROW ? wsCat.getRange(DATA_ROW, 1, lastCat - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues() : [];
  _metasProduccionCache_ = null;
  var metas = {};
  catalogo.forEach(function(r) { if (r[3] === 'Terminado') metas[r[0]] = obtenerMetaSemanal_(r[0]) || 0; });

  return { movimientos: movimientos, plan: plan, metas: metas };
}

// ════════════════════════════════════════════════════════════════
// MANIFEST — "agregar a pantalla de inicio" (mismo patrón que ~/Produccion)
// start_url apunta a ?page=produccion, no a la raíz — si no, instalarla
// como PWA abriría el Dashboard de Ventas en vez del formulario.
// ════════════════════════════════════════════════════════════════
function getManifestProduccion_() {
  return {
    name: 'Producción — Guía de planta',
    short_name: 'Producción',
    start_url: ScriptApp.getService().getUrl() + '?page=produccion',
    display: 'standalone',
    background_color: '#22261F',
    theme_color: '#2F6B4F',
    icons: [
      { src: 'data:image/png;base64,' + ICON_192_PRODUCCION_BASE64, sizes: '192x192', type: 'image/png' },
      { src: 'data:image/png;base64,' + ICON_512_PRODUCCION_BASE64, sizes: '512x512', type: 'image/png' }
    ]
  };
}