//ProductosConfig.gs
// ═══════════════════════════════════════════════════════════════
// ✅ ARCHIVO NUEVO — se agrega como pestaña nueva del proyecto de Apps Script
//    (Archivos → + → Script → pegar todo esto, nombre "ProductosConfig").
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Configuración de productos + datos del "Pedido particular"
// ---------------------------------------------------------------
// Qué hace este archivo:
//   1. listarProductosConfig()   → una fila por producto terminado con su rubro,
//                                  precios (Libre / P1 / Añañai), costo (receta ×
//                                  últimas compras), receta y qué le falta.
//   2. guardarProductoConfig()   → cambia rubro y precios de UN producto.
//   3. crearProductoNuevo()      → alta de un producto (Catálogo + Alias + fila de
//                                  precios + rubro) para que ya se pueda producir,
//                                  recetar y pedir.
//   4. getDatosPedidoParticular()→ productos + recetas + subrubros para la pestaña
//                                  "Pedido particular" (solo LEE).
//   5. getAnanaiPrecios_() / getFlavorsEfectivos_() → los usan Código.gs (pedidos y
//                                  despacho) para respetar el "precio propio" de un
//                                  sabor y el precio Añañai editado desde el panel.
//
// QUÉ NO TOCA: stock, pedidos, compras, recetas. Los precios siguen viviendo en la
// hoja "Productos" (la de siempre); lo único nuevo es:
//   · la hoja "Productos Config" (SKU → rubro; solo guarda lo que se cambió a mano,
//     el resto sale de la lista de rubros por defecto de más abajo),
//   · la columna G "Precio Añañai ($)" de la hoja "Productos" (se crea sola al
//     editar un precio Añañai; mientras esté vacía rige el precio de siempre del
//     código — ANANAI_PRECIOS en Código.gs).
//
// DE QUÉ DEPENDE (ya existe): _requiereRol_, _conLock_, _sanObj_, _norm, _textoCrudo_,
// ensureHojaCatalogo_, ensureHojaAlias_, ensureHojaRecetas_, ensureHojaComprasInsumos_,
// _convertirCantidad_, _UNIDAD_INFO_, _leerSubrubros_, estiloHeader, FLAVORS,
// ANANAI_PRECIOS, SKU_OCULTOS_EN_FORMULARIOS, H_PRODUCTOS, DATA_ROW.
// ═══════════════════════════════════════════════════════════════

var H_PROD_CONFIG = 'Productos Config';
var ENCABEZADOS_PROD_CONFIG = ['SKU', 'Rubro', 'Actualizado', 'Usuario'];
var COL_ANANAI_PRODUCTOS = 7; // columna G de la hoja "Productos"
var RUBRO_PRODUCTO_OTROS = 'Otros';

// Orden en que se muestran los rubros de productos. Cualquier rubro nuevo que
// alguien escriba va después de estos (y "Otros" siempre al final).
var RUBROS_PRODUCTO_ORDEN = [
  'Tartines', 'Pizzas', 'Panes', 'Bases y masas', 'Facturas', 'Pastas',
  'Chipas', 'Sandwiches', 'Galletitas y cookies', RUBRO_PRODUCTO_OTROS
];

// Rubro por defecto de cada producto. Los dudosos (Canastitas, Creps) quedan en
// "Otros" a propósito. Todo producto que no figure acá (por ejemplo uno nuevo)
// toma el rubro de su prefijo de SKU, y si tampoco, "Otros".
var RUBRO_PRODUCTO_POR_SKU = {
  'TART-001': 'Tartines', 'TART-002': 'Tartines', 'TART-003': 'Tartines', 'TART-004': 'Tartines',
  'TART-005': 'Tartines', 'TART-006': 'Tartines', 'TART-007': 'Tartines', 'TART-008': 'Tartines',
  'PIZZ-001': 'Pizzas', 'PIZZ-002': 'Pizzas', 'PIZZ-003': 'Pizzas', 'PIZZ-004': 'Pizzas',
  'PIZZ-005': 'Pizzas', 'PIZZ-006': 'Pizzas', 'PIZZ-007': 'Pizzas',
  'PAN-001': 'Panes', 'PAN-002': 'Panes', 'PAN-003': 'Panes', 'PAN-004': 'Panes',
  'PAN-006': 'Panes', 'PAN-015': 'Panes', 'PAN-016': 'Panes',
  'PAN-005': 'Bases y masas', 'PAN-007': 'Bases y masas', 'PAN-008': 'Bases y masas',
  'PAN-011': 'Bases y masas', 'PAN-014': 'Bases y masas',
  'FAC-001': 'Facturas', 'PAN-012': 'Facturas', 'PAN-013': 'Facturas',
  'PAST-001': 'Pastas', 'PAST-002': 'Pastas', 'PAST-003': 'Pastas', 'PAST-004': 'Pastas',
  'CHIP-001': 'Chipas', 'CHIP-002': 'Chipas', 'CHIP-003': 'Chipas',
  'SAND-001': 'Sandwiches', 'SAND-002': 'Sandwiches', 'SAND-003': 'Sandwiches',
  'OTR-001': 'Galletitas y cookies', 'OTR-003': 'Galletitas y cookies',
  'PAN-009': RUBRO_PRODUCTO_OTROS, 'OTR-002': RUBRO_PRODUCTO_OTROS
};
var RUBRO_PRODUCTO_POR_PREFIJO = {
  'TART': 'Tartines', 'PIZZ': 'Pizzas', 'PAST': 'Pastas', 'CHIP': 'Chipas', 'SAND': 'Sandwiches',
  'FAC': 'Facturas', 'PAN': 'Panes', 'OTR': RUBRO_PRODUCTO_OTROS
};
// Prefijo de SKU para un producto nuevo según su rubro.
var PREFIJO_SKU_POR_RUBRO = {
  'Tartines': 'TART', 'Pizzas': 'PIZZ', 'Pastas': 'PAST', 'Chipas': 'CHIP', 'Sandwiches': 'SAND',
  'Facturas': 'FAC', 'Panes': 'PAN', 'Bases y masas': 'PAN'
};
// Categoría que se le pone en el Catálogo a un producto nuevo (las pantallas de
// Producción y Stock agrupan por esa categoría, así que se reusan las de siempre).
var CATEGORIA_CATALOGO_POR_RUBRO = {
  'Tartines': 'Tartines', 'Pizzas': 'Pizzas', 'Pastas': 'Pastas', 'Chipas': 'Chipalmendras',
  'Sandwiches': 'Sandwiches', 'Facturas': 'Facturas', 'Panes': 'Panificados',
  'Bases y masas': 'Panificados', 'Galletitas y cookies': 'Otros'
};

// ───────────────────────────────────────────────────────────────
// LECTURAS INTERNAS
// ───────────────────────────────────────────────────────────────
function _rubroPorDefectoDeSku_(sku) {
  sku = String(sku || '').trim();
  if (RUBRO_PRODUCTO_POR_SKU[sku]) return RUBRO_PRODUCTO_POR_SKU[sku];
  var pref = sku.split('-')[0];
  return RUBRO_PRODUCTO_POR_PREFIJO[pref] || RUBRO_PRODUCTO_OTROS;
}

function ensureHojaProdConfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_PROD_CONFIG);
  if (!ws) {
    ws = ss.insertSheet(H_PROD_CONFIG);
    ws.getRange('A1').setValue('AÑAÑAI · Productos Config — rubro de cada producto terminado. Solo se escriben los que se cambiaron desde el panel (Productos); el resto usa el rubro por defecto. Se puede editar a mano.');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_PROD_CONFIG.length), '#2F6B4F'); // Código.gs
    ws.getRange(2, 1, 1, ENCABEZADOS_PROD_CONFIG.length).setValues([ENCABEZADOS_PROD_CONFIG]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

// {sku: {rubro, fila}} — solo lee si la hoja existe (no la crea).
function _leerRubrosConfig_() {
  var out = {};
  var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PROD_CONFIG);
  if (!ws) return out;
  var last = ws.getLastRow();
  if (last < DATA_ROW) return out;
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 2).getValues().forEach(function(r, i) {
    var sku = String(r[0] || '').trim();
    var rubro = String(r[1] || '').trim();
    if (sku && rubro) out[sku] = { rubro: rubro, fila: DATA_ROW + i };
  });
  return out;
}

function _guardarRubroSku_(sku, rubro, usuario) {
  var ws = ensureHojaProdConfig_();
  var existentes = _leerRubrosConfig_();
  var ahora = new Date();
  if (existentes[sku]) {
    ws.getRange(existentes[sku].fila, 2, 1, 3).setValues([[_sanTxt_(rubro), ahora, _sanTxt_(usuario || '')]]);
  } else {
    var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
    ws.getRange(fila, 1, 1, ENCABEZADOS_PROD_CONFIG.length).setValues([[sku, _sanTxt_(rubro), ahora, _sanTxt_(usuario || '')]]);
  }
}

// Productos terminados del Catálogo: {sku: {sku, nombre, categoria, fila}} + orden
function _leerTerminados_() {
  var ws = ensureHojaCatalogo_();
  var last = ws.getLastRow();
  var porSku = {}, orden = [];
  if (last < DATA_ROW) return { porSku: porSku, orden: orden };
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues().forEach(function(r, i) {
    if (String(r[3]).trim() !== 'Terminado') return;
    var sku = String(r[0]).trim();
    if (!sku || porSku[sku]) return;
    var mn = r[7];
    porSku[sku] = { sku: sku, nombre: String(r[1] || '').trim(), categoria: String(r[2] || '').trim(), fila: DATA_ROW + i,
      minimo: (mn === '' || mn == null || !isFinite(Number(mn))) ? null : Number(mn),
      factor: _factorDe_(r[6]), unidadProduccion: String(r[4] || '').trim(), unidadDespacho: String(r[5] || '').trim() };
    orden.push(sku);
  });
  return { porSku: porSku, orden: orden };
}

// {norm(texto crudo): sku} — el primero que aparece gana (igual que _claveStock_).
function _mapaAlias_() {
  var ws = ensureHojaAlias_();
  var last = ws.getLastRow();
  var map = {};
  if (last < DATA_ROW) return map;
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 2).getValues().forEach(function(r) {
    var k = _norm(r[0]);
    if (k && map[k] === undefined) map[k] = String(r[1] || '').trim();
  });
  return map;
}

// Filas de la hoja "Productos" (maestro de precios). Lee 7 columnas: la G
// (Precio Añañai) puede no existir todavía.
function _leerProductosFilas_() {
  var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PRODUCTOS);
  if (!ws) return [];
  var last = ws.getLastRow();
  if (last < DATA_ROW) return [];
  var n = last - DATA_ROW + 1, raw;
  try { raw = ws.getRange(DATA_ROW, 1, n, COL_ANANAI_PRODUCTOS).getValues(); }
  catch (e) { raw = ws.getRange(DATA_ROW, 1, n, 6).getValues().map(function(r) { return r.concat(['']); }); }
  var out = [];
  raw.forEach(function(r, i) {
    if (!r[0]) return;
    out.push({
      fila: DATA_ROW + i,
      producto: String(r[0]).trim(),
      variante: String(r[1] == null ? '' : r[1]).trim(),
      unidad: r[2] == null ? '' : r[2],
      pLibre: r[3] || null,
      p1: r[4] || null,
      ananai: (r[6] == null ? '' : r[6])
    });
  });
  return out;
}

// ───────────────────────────────────────────────────────────────
// PRECIO AÑAÑAI y SABORES con precio propio (los usa Código.gs)
// ───────────────────────────────────────────────────────────────
// Precios Añañai vigentes = los de siempre (ANANAI_PRECIOS en Código.gs) con lo
// que se haya editado desde el panel por encima. Una celda G con un número > 0
// pisa el precio del código; un 0 significa "este producto ya no tiene precio
// Añañai especial". Si algo falla, se usa el mapa de siempre.
function getAnanaiPrecios_() {
  var out = {};
  Object.keys(ANANAI_PRECIOS).forEach(function(k) { out[k] = ANANAI_PRECIOS[k]; });
  try {
    _leerProductosFilas_().forEach(function(p) {
      if (p.variante || p.ananai === '' || p.ananai == null) return;
      var n = Number(p.ananai);
      if (!isFinite(n)) return;
      Object.keys(out).forEach(function(k) { if (_norm(k) === _norm(p.producto)) delete out[k]; });
      if (n > 0) out[p.producto] = n;
    });
  } catch (e) { /* si algo falla, queda el mapa de siempre */ }
  return out;
}

// FLAVORS (sabores con su grupo de precio) + el "precio propio" que se haya
// dado desde el panel: si existe una fila de precios (Familia, Sabor) con P1
// cargado, ese sabor deja de usar el precio de su grupo y usa el suyo.
// Devuelve una COPIA — nunca modifica FLAVORS.
function getFlavorsEfectivos_() {
  var out = JSON.parse(JSON.stringify(FLAVORS));
  try {
    var filas = _leerProductosFilas_();
    Object.keys(out).forEach(function(F) {
      var fam = out[F];
      (fam.sabores || []).forEach(function(s) {
        for (var i = 0; i < filas.length; i++) {
          var p = filas[i];
          if (_norm(p.producto) === _norm(F) && p.variante && _norm(p.variante) === _norm(s.sabor) && p.p1 != null) {
            if (!fam.tierPrecio) fam.tierPrecio = {};
            fam.tierPrecio[s.sabor] = p.p1;
            s.tier = s.sabor;
            return;
          }
        }
      });
    });
  } catch (e) { return JSON.parse(JSON.stringify(FLAVORS)); }
  return out;
}

// ───────────────────────────────────────────────────────────────
// VÍNCULO PRODUCTO (SKU) ↔ FILA DE PRECIOS
// ───────────────────────────────────────────────────────────────
// Los precios viven en la hoja "Productos" (por nombre de producto/variante) y
// los SKU en el Catálogo; el puente es la hoja Alias (el mismo que usan
// Despacho y Producción). Para cada SKU terminado devuelve de dónde sale su
// precio:
//   fuente 'grupo'    → precio compartido de un grupo (Tartines — Altos, Pizzas — Bajo…)
//   fuente 'propio'   → una fila propia del sabor (Tartines — Pollo)
//   fuente 'producto' → un producto con su fila (Pan de Molde, Medialunas…)
//   fuente null       → todavía no tiene fila de precios (no se puede pedir)
function _vinculosPrecio_(terminados) {
  var filas = _leerProductosFilas_();
  var alias = _mapaAlias_();
  var porSku = {}, huerfanas = [];
  var familias = {};
  Object.keys(FLAVORS).forEach(function(F) { familias[_norm(F)] = F; });

  function buscar(prod, vari) {
    for (var i = 0; i < filas.length; i++) {
      if (_norm(filas[i].producto) === _norm(prod) && _norm(filas[i].variante) === _norm(vari)) return filas[i];
    }
    return null;
  }

  Object.keys(FLAVORS).forEach(function(F) {
    var fam = FLAVORS[F];
    (fam.sabores || []).forEach(function(s) {
      var sku = alias[_norm(_textoCrudo_(F, s.variante))];
      if (!sku || !terminados[sku] || porSku[sku]) return;
      var propia = buscar(F, s.sabor);
      var grupoFila = buscar(F, s.tier || '');
      var constP1 = (fam.tierPrecio && s.tier && fam.tierPrecio[s.tier] != null) ? fam.tierPrecio[s.tier] : null;
      var v = {
        sku: sku, familia: F, sabor: s.sabor, tier: s.tier || '',
        grupoNombre: F + (s.tier ? ' — ' + s.tier : ''),
        grupoFila: grupoFila, propiaFila: propia, constP1: constP1, fila: null, fuente: null
      };
      if (propia && propia.p1 != null) { v.fuente = 'propio'; v.fila = propia; }
      else if (grupoFila) { v.fuente = 'grupo'; v.fila = grupoFila; }
      else { v.fuente = 'grupo'; v.fila = null; } // el grupo existe aunque su fila de precios todavía no
      porSku[sku] = v;
    });
  });

  filas.forEach(function(p) {
    if (familias[_norm(p.producto)]) return; // familia con sabores: ya resuelta arriba
    var sku = alias[_norm(_textoCrudo_(p.producto, p.variante))];
    if (!sku) { huerfanas.push((p.producto + (p.variante ? ' · ' + p.variante : ''))); return; }
    if (!terminados[sku] || porSku[sku]) return; // p. ej. «Laminado» es un insumo, no un producto terminado
    porSku[sku] = { sku: sku, familia: '', sabor: '', tier: '', grupoNombre: '', grupoFila: null, propiaFila: null, constP1: null, fila: p, fuente: 'producto' };
  });

  // Filas de las familias con sabores que no corresponden a ningún tier ni sabor
  // (precio sobrante) no se consideran huérfanas: no molestan a nadie.
  return { porSku: porSku, huerfanas: huerfanas };
}

// ───────────────────────────────────────────────────────────────
// COSTOS — receta × precio promedio de la familia (misma cuenta que
// calcularCostoReceta, pero leyendo cada hoja UNA vez para todos los productos)
// ───────────────────────────────────────────────────────────────
// Peso total de una receta POR 1 UNIDAD, en gramos / mililitros / unidades sueltas
// (para que se vea de un vistazo "esta receta pesa ~246 g": sirve para chequear que la
// unidad de venta sea la que se cree — por ejemplo una bolsa de 500 g o un lote de 4).
function _pesoReceta_(lineas) {
  var g = 0, ml = 0, u = 0;
  (lineas || []).forEach(function(l) {
    var q = Number(l.cantidadPorUnidad) || 0;
    var info = _UNIDAD_INFO_[_normalizarUnidad_(l.unidad)];
    if (info && info.grupo === 'masa') g += q * info.factor;
    else if (info && info.grupo === 'volumen') ml += q * info.factor;
    else u += q;
  });
  return { g: Math.round(g * 10) / 10, ml: Math.round(ml * 10) / 10, u: Math.round(u * 100) / 100 };
}

// "Bolsa 500g" → 500 ; "Pack 1 kg" → 1000 ; "Unidad" → null.
function _gramosPorUnidad_(texto) {
  var m = String(texto || '').match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilos?|g|gr|grs|gramos?)(?![A-Za-zÁÉÍÓÚáéíóú])/i);
  if (!m) return null;
  var n = Number(m[1].replace(',', '.'));
  if (!(n > 0)) return null;
  return Math.round((m[2].toLowerCase().charAt(0) === 'k' ? n * 1000 : n) * 10) / 10;
}

// Unidad de venta de un producto = el texto «Unidad» de su fila de precios (hoja Productos)
// — la misma que ven Pedidos y Despachos. Sin fila de precios → «Unidad».
function _unidadVentaDe_(v) {
  var u = (v && v.fila && v.fila.unidad) ? String(v.fila.unidad).trim() : '';
  return u || 'Unidad';
}

// Equivalencia (Catálogo, col. «Factor equivalencia»): cuántas unidades de PRODUCCIÓN hacen 1 unidad de
// VENTA/DESPACHO. 1 = se produce y se vende en la misma unidad. Ej.: Medialunas se cargan de a una en
// Producción pero se venden en bandeja de 4 → factor 4: el Stock queda en bandejas (cantidad ÷ 4) y la
// receta es por 1 bandeja. Vacío / inválido = 1.
function _factorDe_(x) {
  var n = Number(x);
  return (isFinite(n) && n > 0) ? n : 1;
}
// '' → {vacio}; número > 0 (hasta 1000, coma o punto, 3 decimales) → {n}; otra cosa → {error}.
function _parseFactor_(x) {
  if (x === '' || x == null) return { vacio: true };
  var t = String(x).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return { error: 'La equivalencia tiene que ser un número mayor a 0 (por ejemplo 4).' };
  var n = Number(t);
  if (!isFinite(n) || n <= 0) return { error: 'La equivalencia tiene que ser un número mayor a 0 (por ejemplo 4).' };
  if (n > 1000) return { error: 'La equivalencia es demasiado grande (máximo 1000).' };
  return { n: Math.round(n * 1000) / 1000 };
}
// Texto de la columna «Unidad de despacho» del Catálogo (es lo que muestra la hoja Stock y la pantalla
// de Stock de planta): con equivalencia > 1 es la unidad de venta («Bandeja x4»); si no, la de producción.
function _etiquetaUnidadStock_(factor, unidadVenta, unidadProduccion) {
  var uv = String(unidadVenta || '').trim();
  if (!(factor > 1)) return unidadProduccion || 'unidades';
  return (uv && _norm(uv) !== 'unidad') ? uv : 'unidades de venta';
}
// {sku: stock actual} leyendo la hoja Stock una sola vez.
function _mapaStockActual_() {
  var out = {};
  var ws = ensureHojaStock_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return out;
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 3).getValues().forEach(function(r) {
    var sku = String(r[0] || '').trim();
    if (sku && out[sku] === undefined) out[sku] = Number(r[2]) || 0;
  });
  return out;
}

// Stock mínimo: '' / null = sin configurar. Si no, número ≥ 0 (acepta coma decimal).
function _parseMinimo_(x) {
  if (x === '' || x == null) return { vacio: true };
  var t = String(x).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return { error: 'El stock mínimo tiene que ser un número mayor o igual a 0.' };
  var n = Number(t);
  if (!isFinite(n) || n > 1000000) return { error: 'El stock mínimo es demasiado grande.' };
  return { n: Math.round(n * 100) / 100 };
}

// Datos de cada SKU del Stock para la pantalla «Stock teórico»: tipo, rubro del producto,
// stock mínimo y unidad de venta. {sku: {tipo, rubro, minimo, unidadVenta}}
function _metaStockPorSku_() {
  var out = {};
  var ws = ensureHojaCatalogo_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return out;
  var term = _leerTerminados_();
  var rubrosCfg = _leerRubrosConfig_();
  var vinc = _vinculosPrecio_(term.porSku);
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues().forEach(function(r) {
    var sku = String(r[0] || '').trim();
    if (!sku) return;
    var tipo = String(r[3] || '').trim();
    var mn = r[7];
    var minimo = (mn === '' || mn == null || !isFinite(Number(mn))) ? null : Number(mn);
    if (tipo === 'Terminado') {
      out[sku] = { tipo: tipo, rubro: rubrosCfg[sku] ? rubrosCfg[sku].rubro : _rubroPorDefectoDeSku_(sku),
        minimo: minimo, unidadVenta: _unidadVentaDe_(vinc.porSku[sku] || null), factor: _factorDe_(r[6]) };
    } else {
      out[sku] = { tipo: tipo || 'Insumo', rubro: 'Insumos', minimo: minimo, unidadVenta: '' };
    }
  });
  return out;
}

function _recetasPorSkuCompleto_() {
  var ws = ensureHojaRecetas_();
  var last = ws.getLastRow();
  var out = {};
  if (last < DATA_ROW) return out;
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_RECETAS.length).getValues().forEach(function(r) {
    var sku = String(r[0] || '').trim();
    if (!sku) return;
    if (!out[sku]) out[sku] = [];
    out[sku].push({ familia: String(r[2] || '').trim(), cantidadPorUnidad: Number(r[3]) || 0, unidad: String(r[4] || '') });
  });
  return out;
}

function _costosPorSku_(recetas) {
  var cat = ensureHojaCatalogo_();
  var lastC = cat.getLastRow();
  var insumosPorFamilia = {};
  if (lastC >= DATA_ROW) {
    cat.getRange(DATA_ROW, 1, lastC - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues().forEach(function(r) {
      if (String(r[3]).trim() !== 'Insumo') return;
      var fam = String(r[2] || '').trim();
      var sku = String(r[0] || '').trim();
      if (!sku) return;
      if (!insumosPorFamilia[fam]) insumosPorFamilia[fam] = [];
      insumosPorFamilia[fam].push({ sku: sku, unidadCatalogo: r[4] });
    });
  }
  // última compra de cada insumo (las filas están en orden cronológico)
  var ultimo = {};
  var led = ensureHojaComprasInsumos_();
  var lastL = led.getLastRow();
  if (lastL >= DATA_ROW) {
    led.getRange(DATA_ROW, 1, lastL - DATA_ROW + 1, ENCABEZADOS_COMPRAS_INSUMOS.length).getValues().forEach(function(r) {
      var sku = String(r[3]).trim();
      if (sku) ultimo[sku] = { precioUnitario: Number(r[7]) || 0, unidad: String(r[6] || '') };
    });
  }
  var memo = {};
  function precioFamilia(familia, unidadReceta) {
    var k = familia + '||' + unidadReceta;
    if (memo[k] !== undefined) return memo[k];
    var precios = [];
    (insumosPorFamilia[familia] || []).forEach(function(ins) {
      var precio = ultimo[ins.sku];
      if (!precio || !(precio.precioUnitario > 0)) return;
      var p = precio.precioUnitario;
      var unidadPrecio = precio.unidad || ins.unidadCatalogo;
      if (unidadReceta && unidadPrecio) {
        var uno = _convertirCantidad_(1, unidadReceta, unidadPrecio);
        if (!uno.ok) return;
        p = p * uno.cantidad;
      }
      precios.push(p);
    });
    memo[k] = precios.length ? precios.reduce(function(s, x) { return s + x; }, 0) / precios.length : null;
    return memo[k];
  }
  var out = {};
  Object.keys(recetas).forEach(function(sku) {
    var total = 0, incompleto = false, sinPrecio = 0;
    var detalle = recetas[sku].map(function(li) {
      var pp = precioFamilia(li.familia, li.unidad);
      if (pp == null) { incompleto = true; sinPrecio++; return { familia: li.familia, cantidadPorUnidad: li.cantidadPorUnidad, unidad: li.unidad, subtotal: null }; }
      var sub = li.cantidadPorUnidad * pp;
      total += sub;
      return { familia: li.familia, cantidadPorUnidad: li.cantidadPorUnidad, unidad: li.unidad, subtotal: sub };
    });
    out[sku] = { total: incompleto ? null : total, incompleto: incompleto, sinPrecio: sinPrecio, detalle: detalle };
  });
  return out;
}

// ───────────────────────────────────────────────────────────────
// LISTA PARA EL PANEL
// ───────────────────────────────────────────────────────────────
function _armarListaProductosConfig_() {
  var term = _leerTerminados_();
  var rubrosCfg = _leerRubrosConfig_();
  var vinc = _vinculosPrecio_(term.porSku);
  var recetas = _recetasPorSkuCompleto_();
  var costos = _costosPorSku_(recetas);
  var anan = getAnanaiPrecios_();
  var ananN = {};
  Object.keys(anan).forEach(function(k) { ananN[_norm(k)] = anan[k]; });
  var ocultos = (typeof SKU_OCULTOS_EN_FORMULARIOS !== 'undefined') ? SKU_OCULTOS_EN_FORMULARIOS : [];
  var stockMapa = _mapaStockActual_();

  var items = term.orden.map(function(sku) {
    var t = term.porSku[sku];
    var v = vinc.porSku[sku] || null;
    var p1 = null, pLibre = null, libreEstimado = false, ananai = null, ananaiAplica = false;
    if (v) {
      if (v.fila) { p1 = v.fila.p1; pLibre = v.fila.pLibre; }
      else if (v.constP1 != null) { p1 = v.constP1; }
      if (p1 != null && pLibre == null) { pLibre = Math.round(p1 * 1.05); libreEstimado = true; }
      if (v.fuente === 'producto') {
        ananaiAplica = true;
        var a = ananN[_norm(v.fila.producto)];
        ananai = (a === undefined) ? null : a;
      }
    }
    var compartidoCon = [];
    if (v && v.fuente === 'grupo') {
      term.orden.forEach(function(o) {
        var w = vinc.porSku[o];
        if (o !== sku && w && w.fuente === 'grupo' && w.grupoNombre === v.grupoNombre) compartidoCon.push(term.porSku[o].nombre);
      });
    }
    var rec = recetas[sku] || null;
    var c = costos[sku] || null;
    var costo = c ? c.total : null;
    var margen = (costo != null && p1 != null && p1 > 0) ? Math.round(((p1 - costo) / p1) * 1000) / 10 : null;
    return {
      sku: sku, nombre: t.nombre, categoriaCatalogo: t.categoria,
      rubro: rubrosCfg[sku] ? rubrosCfg[sku].rubro : _rubroPorDefectoDeSku_(sku),
      rubroPersonalizado: !!rubrosCfg[sku],
      oculto: ocultos.indexOf(sku) > -1,
      precio: {
        fuente: v ? v.fuente : null,
        grupo: v ? v.grupoNombre : '',
        familia: v ? v.familia : '',
        sabor: v ? v.sabor : '',
        tienePropiaFila: !!(v && v.propiaFila),
        unidad: (v && v.fila) ? (v.fila.unidad || '') : '',
        compartidoCon: compartidoCon,
        p1: p1, pLibre: pLibre, libreEstimado: libreEstimado,
        ananai: ananai, ananaiAplica: ananaiAplica,
        tienePrecio: p1 != null
      },
      receta: { lineas: rec ? rec.length : 0, detalle: c ? c.detalle : [], peso: _pesoReceta_(rec) },
      stockMinimo: t.minimo,
      unidadVenta: _unidadVentaDe_(v),
      gramosPorUnidad: _gramosPorUnidad_(_unidadVentaDe_(v)),
      factor: t.factor, unidadProduccion: t.unidadProduccion,
      stock: stockMapa[sku] === undefined ? null : Math.round(stockMapa[sku] * 1000) / 1000,
      costo: { total: costo, incompleto: !!(c && c.incompleto), lineasSinPrecio: c ? c.sinPrecio : 0 },
      margenP1: margen
    };
  });

  var rubros = RUBROS_PRODUCTO_ORDEN.slice(0, RUBROS_PRODUCTO_ORDEN.length - 1);
  items.forEach(function(it) { if (rubros.indexOf(it.rubro) === -1 && it.rubro !== RUBRO_PRODUCTO_OTROS) rubros.push(it.rubro); });
  rubros.push(RUBRO_PRODUCTO_OTROS);
  return { items: items, rubros: rubros, huerfanas: vinc.huerfanas };
}

function listarProductosConfig(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  var r = _armarListaProductosConfig_();
  return { ok: true, productos: r.items, rubros: r.rubros, avisos: r.huerfanas.length
    ? ['Filas de la hoja Productos sin un producto del Catálogo asociado (revisar los Alias): ' + r.huerfanas.join(', ') + '.'] : [] };
}

// ───────────────────────────────────────────────────────────────
// GUARDAR CAMBIOS DE UN PRODUCTO
// ───────────────────────────────────────────────────────────────
function _numPrecio_(v, etiqueta) {
  if (v === '' || v == null) return { vacio: true };
  var n = Number(String(v).replace(',', '.'));
  if (!isFinite(n) || n < 0 || n > 99999999) return { error: 'El ' + etiqueta + ' tiene que ser un número entre 0 y 99.999.999.' };
  return { n: Math.round(n * 100) / 100 };
}

function _asegurarColumnaAnanai_(ws) {
  var h = ws.getRange(2, COL_ANANAI_PRODUCTOS);
  if (h.getValue() !== 'Precio Añañai ($)') {
    h.setValue('Precio Añañai ($)');
    h.setFontWeight('bold').setFontColor('#ffffff').setBackground('#1F3864');
  }
}

// Asegura que el nombre canónico del Catálogo resuelva al SKU en la hoja Alias
// (así Despacho y Producción encuentran el stock). Devuelve '' si está bien o un
// mensaje de error si ese nombre ya apunta a OTRO producto.
function _asegurarAlias_(texto, sku) {
  var alias = _mapaAlias_();
  var k = _norm(texto);
  if (alias[k] !== undefined) {
    return alias[k] === sku ? '' : 'El nombre «' + texto + '» ya está asignado al producto ' + alias[k] + ' en la hoja Alias.';
  }
  var ws = ensureHojaAlias_();
  var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
  ws.getRange(fila, 1, 1, 2).setValues([[_sanTxt_(texto), sku]]);
  return '';
}

function guardarProductoConfig(sku, cambios, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  sku = String(sku || '').trim();
  if (!sku) return { ok: false, mensaje: 'Falta indicar el producto.' };
  cambios = _sanObj_(cambios || {});
  var usuario = (chk.sesion && (chk.sesion.nombre || chk.sesion.rol)) || chk.rol || '';

  return _conLock_(function() {
    var term = _leerTerminados_();
    var t = term.porSku[sku];
    if (!t) return { ok: false, mensaje: 'No se encontró ese producto terminado en el Catálogo.' };
    var vinc = _vinculosPrecio_(term.porSku);
    var v = vinc.porSku[sku] || null;

    // ── 1) validar TODO antes de escribir nada ──
    var rubro = null;
    if (cambios.rubro !== undefined) {
      rubro = String(cambios.rubro || '').trim().replace(/\s+/g, ' ');
      if (!rubro) rubro = RUBRO_PRODUCTO_OTROS;
      if (rubro.length > 40) return { ok: false, mensaje: 'El rubro es demasiado largo (máximo 40 letras).' };
    }
    var minimo;
    if (cambios.stockMinimo !== undefined) {
      var pm = _parseMinimo_(cambios.stockMinimo);
      if (pm.error) return { ok: false, mensaje: pm.error };
      minimo = pm.vacio ? '' : pm.n;
    }
    var nFactor = null, convertirStock = false;
    if (cambios.equivalencia !== undefined && cambios.equivalencia !== null) {
      var eq = cambios.equivalencia;
      var pf = _parseFactor_(eq.factor);
      if (pf.error) return { ok: false, mensaje: pf.error };
      nFactor = pf.vacio ? 1 : pf.n;
      convertirStock = eq.convertirStock === true || eq.convertirStock === 'true';
    }
    var pr = cambios.precios;
    var modo = pr ? String(pr.modo || '') : '';
    var nP1 = null, nLibre = null, nAnanai = null, unidadVenta = null;
    var quiereVolverAGrupo = pr && modo === 'grupo' && v && v.fuente === 'propio';
    if (pr && !quiereVolverAGrupo) {
      if (pr.p1 !== undefined) {
        nP1 = _numPrecio_(pr.p1, 'precio P1');
        if (nP1.error) return { ok: false, mensaje: nP1.error };
        if (nP1.vacio || !(nP1.n > 0)) return { ok: false, mensaje: 'El precio P1 tiene que ser mayor a 0.' };
      }
      if (pr.pLibre !== undefined) {
        nLibre = _numPrecio_(pr.pLibre, 'precio Libre');
        if (nLibre.error) return { ok: false, mensaje: nLibre.error };
      }
      if (pr.ananai !== undefined) {
        nAnanai = _numPrecio_(pr.ananai, 'precio Añañai');
        if (nAnanai.error) return { ok: false, mensaje: nAnanai.error };
      }
      if (pr.unidad !== undefined) {
        unidadVenta = String(pr.unidad || '').trim();
        if (unidadVenta.length > 30) return { ok: false, mensaje: 'La unidad de venta es demasiado larga (máximo 30 letras).' };
      }
    }
    if (modo === 'propio' && !(v && v.familia)) return { ok: false, mensaje: 'Este producto no pertenece a un grupo de precios (Tartines, Pizzas…): no tiene "precio propio" para darle.' };
    if (nAnanai && !nAnanai.vacio && v && v.fuente !== 'producto') {
      return { ok: false, mensaje: 'El precio Añañai solo se puede cargar en productos con fila de precios propia (no en los de un grupo como Tartines o Pizzas).' };
    }
    if (pr && !v && !nP1) {
      // sin fila de precios todavía: para crearla hace falta el P1
      return { ok: false, mensaje: 'Este producto todavía no tiene precio: cargá primero el precio P1.' };
    }

    // ── 2) escribir ──
    var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PRODUCTOS);
    if (pr && !ws) return { ok: false, mensaje: 'No se encontró la hoja de precios (Productos).' };
    var avisos = [];
    if (rubro !== null) _guardarRubroSku_(sku, rubro, usuario);
    if (minimo !== undefined) ensureHojaCatalogo_().getRange(t.fila, ENCABEZADOS_CATALOGO.length).setValue(minimo);
    var cambioFactor = (nFactor !== null && nFactor !== t.factor);
    var cambioUnidad = !!(pr && unidadVenta !== null && unidadVenta);
    if (cambioFactor || (cambioUnidad && t.factor > 1)) {
      var factorFinal = (nFactor !== null) ? nFactor : t.factor;
      var uvFinal = cambioUnidad ? unidadVenta : _unidadVentaDe_(v);
      var wsCat = ensureHojaCatalogo_();
      if (cambioFactor) wsCat.getRange(t.fila, 7).setValue(factorFinal);
      wsCat.getRange(t.fila, 6).setValue(_sanTxt_(_etiquetaUnidadStock_(factorFinal, uvFinal, t.unidadProduccion)));
      if (cambioFactor) {
        var stockAntes = _leerStockActual_(sku);
        if (convertirStock && stockAntes !== 0) {
          var stockNuevo = Math.round(stockAntes * t.factor / factorFinal * 1000) / 1000;
          var rAj = _moverStock_(sku, 'ajuste', stockNuevo, { detalle: 'Equivalencia cambiada: 1 ' + uvFinal + ' = ' + factorFinal + ' unidades de producción · stock convertido de ' + stockAntes + ' a ' + stockNuevo });
          if (!rAj.ok) avisos.push('No se pudo convertir el stock: ' + rAj.mensaje);
          else avisos.push('Stock convertido: ' + stockAntes + ' → ' + stockNuevo + '.');
        } else if (stockAntes !== 0) {
          avisos.push('El stock que ya había (' + stockAntes + ') quedó como estaba: si estaba contado en la unidad anterior, corregilo con un ajuste en Stock.');
        }
        avisos.push('Equivalencia: se produce en ' + (t.unidadProduccion || 'unidades') + ' y 1 ' + uvFinal + ' = ' + factorFinal + ' de esas. La receta es por 1 ' + uvFinal + '.');
      }
    }

    if (pr) {
      var libreVal = (nLibre && !nLibre.vacio) ? nLibre.n : (nLibre && nLibre.vacio ? '' : undefined);
      if (quiereVolverAGrupo) {
        ws.getRange(v.propiaFila.fila, 4, 1, 3).setValues([['', '', 'No — pendiente']]);
        avisos.push('Vuelve a usar el precio del grupo ' + v.grupoNombre + '.');
      } else if (v && v.fuente === 'producto') {
        var f = v.fila.fila;
        if (nP1) { ws.getRange(f, 5).setValue(nP1.n); ws.getRange(f, 6).setValue('Sí'); }
        if (libreVal !== undefined) ws.getRange(f, 4).setValue(libreVal);
        if (unidadVenta !== null && unidadVenta) ws.getRange(f, 3).setValue(_sanTxt_(unidadVenta));
        if (nAnanai) {
          _asegurarColumnaAnanai_(ws);
          if (nAnanai.vacio) {
            var hayAnan = getAnanaiPrecios_();
            var tenia = Object.keys(hayAnan).some(function(k) { return _norm(k) === _norm(v.fila.producto); });
            if (tenia) ws.getRange(f, COL_ANANAI_PRODUCTOS).setValue(0); // 0 = sin precio Añañai especial
          } else {
            ws.getRange(f, COL_ANANAI_PRODUCTOS).setValue(nAnanai.n);
          }
        }
      } else if (v && v.familia && (modo === 'propio' || v.fuente === 'propio')) {
        // precio propio del sabor (crear la fila o actualizarla)
        if (!nP1) return { ok: false, mensaje: 'Para darle precio propio a este producto hace falta el precio P1.' };
        var unidadGrupo = (v.grupoFila && v.grupoFila.unidad) || 'Unidad';
        if (v.propiaFila) {
          ws.getRange(v.propiaFila.fila, 4, 1, 3).setValues([[libreVal === undefined ? (v.propiaFila.pLibre || '') : libreVal, nP1.n, 'Sí']]);
        } else {
          var nf = Math.max(DATA_ROW, ws.getLastRow() + 1);
          ws.getRange(nf, 1, 1, 6).setValues([[_sanTxt_(v.familia), _sanTxt_(v.sabor), unidadGrupo, libreVal === undefined ? '' : libreVal, nP1.n, 'Sí']]);
        }
        avisos.push('Ahora ' + t.nombre + ' tiene precio propio (ya no sigue al grupo ' + v.grupoNombre + ').');
      } else if (v && v.fuente === 'grupo') {
        if (v.fila) {
          if (nP1) { ws.getRange(v.fila.fila, 5).setValue(nP1.n); ws.getRange(v.fila.fila, 6).setValue('Sí'); }
          if (libreVal !== undefined) ws.getRange(v.fila.fila, 4).setValue(libreVal);
        } else {
          if (!nP1) return { ok: false, mensaje: 'Hace falta el precio P1.' };
          var nf2 = Math.max(DATA_ROW, ws.getLastRow() + 1);
          ws.getRange(nf2, 1, 1, 6).setValues([[_sanTxt_(v.familia), _sanTxt_(v.tier), 'Unidad', libreVal === undefined ? '' : libreVal, nP1.n, 'Sí']]);
        }
        var otros = [];
        term.orden.forEach(function(o) { var w = vinc.porSku[o]; if (o !== sku && w && w.fuente === 'grupo' && w.grupoNombre === v.grupoNombre) otros.push(term.porSku[o].nombre); });
        if (otros.length) avisos.push('El precio es del grupo ' + v.grupoNombre + ': también cambió para ' + otros.join(', ') + '.');
      } else if (!v) {
        // sin fila de precios: se crea con el nombre del Catálogo
        if (!nP1) return { ok: false, mensaje: 'Para cargar el precio de este producto hace falta el precio P1.' };
        var prods = _leerProductosFilas_();
        for (var i = 0; i < prods.length; i++) {
          if (_norm(prods[i].producto) === _norm(t.nombre) && !prods[i].variante) {
            return { ok: false, mensaje: 'Ya hay una fila de precios llamada «' + t.nombre + '» que no está vinculada a este producto: revisá la hoja Alias.' };
          }
        }
        var errAlias = _asegurarAlias_(_textoCrudo_(t.nombre, ''), sku);
        if (errAlias) return { ok: false, mensaje: errAlias };
        var nf3 = Math.max(DATA_ROW, ws.getLastRow() + 1);
        ws.getRange(nf3, 1, 1, 6).setValues([[_sanTxt_(t.nombre), '', unidadVenta || 'Unidad', libreVal === undefined ? '' : libreVal, nP1.n, 'Sí']]);
        if (nAnanai && !nAnanai.vacio && nAnanai.n > 0) { _asegurarColumnaAnanai_(ws); ws.getRange(nf3, COL_ANANAI_PRODUCTOS).setValue(nAnanai.n); }
        avisos.push('Se creó la fila de precios de ' + t.nombre + ': ya se puede cargar en pedidos y despachos.');
      }
    }

    var lista = _armarListaProductosConfig_();
    var item = lista.items.filter(function(x) { return x.sku === sku; })[0] || null;
    return { ok: true, mensaje: '✅ Guardado: ' + t.nombre + '.' + (avisos.length ? ' ' + avisos.join(' ') : ''), producto: item, avisos: avisos };
  });
}

// ───────────────────────────────────────────────────────────────
// ALTA DE UN PRODUCTO NUEVO
// ───────────────────────────────────────────────────────────────
function _siguienteSku_(prefijo, existentes) {
  var max = 0;
  Object.keys(existentes).forEach(function(s) {
    var m = String(s).match(/^([A-Z]+)-(\d+)$/);
    if (m && m[1] === prefijo) max = Math.max(max, Number(m[2]));
  });
  return prefijo + '-' + ('000' + (max + 1)).slice(-3);
}

function crearProductoNuevo(datos, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  datos = _sanObj_(datos || {});
  var usuario = (chk.sesion && (chk.sesion.nombre || chk.sesion.rol)) || chk.rol || '';

  var nombre = String(datos.nombre || '').trim().replace(/\s+/g, ' ');
  if (!nombre) return { ok: false, mensaje: 'Falta el nombre del producto.' };
  if (nombre.length > 60) return { ok: false, mensaje: 'El nombre es demasiado largo (máximo 60 letras).' };
  if (/[\u0000-\u001f<>]/.test(nombre)) return { ok: false, mensaje: 'El nombre tiene caracteres que no se pueden usar.' };
  var rubro = String(datos.rubro || '').trim().replace(/\s+/g, ' ') || RUBRO_PRODUCTO_OTROS;
  if (rubro.length > 40) return { ok: false, mensaje: 'El rubro es demasiado largo (máximo 40 letras).' };
  var nP1 = _numPrecio_(datos.p1, 'precio P1');
  if (nP1.error) return { ok: false, mensaje: nP1.error };
  if (!nP1.vacio && !(nP1.n > 0)) return { ok: false, mensaje: 'El precio P1 tiene que ser mayor a 0 (o dejalo vacío para cargarlo después).' };
  var nLibre = _numPrecio_(datos.pLibre, 'precio Libre');
  if (nLibre.error) return { ok: false, mensaje: nLibre.error };
  var unidadVenta = String(datos.unidad || '').trim() || 'Unidad';
  if (unidadVenta.length > 30) return { ok: false, mensaje: 'La unidad de venta es demasiado larga (máximo 30 letras).' };
  var pMin = _parseMinimo_(datos.stockMinimo);
  if (pMin.error) return { ok: false, mensaje: pMin.error };

  return _conLock_(function() {
    var wsCat = ensureHojaCatalogo_();
    var lastC = wsCat.getLastRow();
    var todos = {}, nombres = {};
    if (lastC >= DATA_ROW) {
      wsCat.getRange(DATA_ROW, 1, lastC - DATA_ROW + 1, 2).getValues().forEach(function(r) {
        var s = String(r[0] || '').trim();
        if (s) { todos[s] = true; nombres[_norm(r[1])] = s; }
      });
    }
    var alias = _mapaAlias_();
    var kNombre = _norm(nombre);
    if (nombres[kNombre] || alias[kNombre] !== undefined) {
      return { ok: false, mensaje: 'Ya existe un producto o alias llamado «' + nombre + '» (' + (nombres[kNombre] || alias[kNombre]) + '). Usá otro nombre.' };
    }
    var filas = _leerProductosFilas_();
    for (var i = 0; i < filas.length; i++) {
      if (_norm(filas[i].producto) === kNombre) return { ok: false, mensaje: 'Ya hay una fila de precios llamada «' + nombre + '».' };
    }

    var prefijo = PREFIJO_SKU_POR_RUBRO[rubro] || 'OTR';
    var sku = _siguienteSku_(prefijo, todos);
    var categoria = CATEGORIA_CATALOGO_POR_RUBRO[rubro] || 'Otros';

    // Catálogo
    var fc = Math.max(DATA_ROW, wsCat.getLastRow() + 1);
    var filaCat = [sku, _sanTxt_(nombre), categoria, 'Terminado', 'unidades', 'unidades', 1];
    while (filaCat.length < ENCABEZADOS_CATALOGO.length) filaCat.push('');
    if (!pMin.vacio) filaCat[ENCABEZADOS_CATALOGO.length - 1] = pMin.n;
    wsCat.getRange(fc, 1, 1, ENCABEZADOS_CATALOGO.length).setValues([filaCat]);
    // Alias
    var wsAl = ensureHojaAlias_();
    wsAl.getRange(Math.max(DATA_ROW, wsAl.getLastRow() + 1), 1, 1, 2).setValues([[_sanTxt_(nombre), sku]]);
    // Fila de precios (aunque todavía no tenga precio: igual que Fajitas, Creps, etc.)
    var wsPr = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PRODUCTOS);
    var tiene = !nP1.vacio;
    var fp = Math.max(DATA_ROW, wsPr.getLastRow() + 1);
    wsPr.getRange(fp, 1, 1, 6).setValues([[_sanTxt_(nombre), '', unidadVenta, nLibre.vacio ? '' : nLibre.n, nP1.vacio ? '' : nP1.n, tiene ? 'Sí' : 'No — pendiente']]);
    var nAn = _numPrecio_(datos.ananai, 'precio Añañai');
    if (!nAn.error && !nAn.vacio && nAn.n > 0) { _asegurarColumnaAnanai_(wsPr); wsPr.getRange(fp, COL_ANANAI_PRODUCTOS).setValue(nAn.n); }
    // Rubro (si no es el que le correspondería por defecto)
    if (rubro !== _rubroPorDefectoDeSku_(sku)) _guardarRubroSku_(sku, rubro, usuario);

    var lista = _armarListaProductosConfig_();
    var item = lista.items.filter(function(x) { return x.sku === sku; })[0] || null;
    return { ok: true, sku: sku, producto: item,
      mensaje: '✅ Producto creado: ' + nombre + ' (' + sku + ').' + (tiene ? '' : ' Todavía no tiene precio: cargalo para poder usarlo en pedidos.') + ' Falta cargarle la receta.' };
  });
}

// ───────────────────────────────────────────────────────────────
// PEDIDO PARTICULAR — datos (solo lectura)
// ───────────────────────────────────────────────────────────────
// Todo lo que necesita la pestaña para calcular en pantalla qué comprar:
// productos (con rubro), recetas y subrubros (rubro + unidad base de compra).
function getDatosPedidoParticular(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  var term = _leerTerminados_();
  var rubrosCfg = _leerRubrosConfig_();
  var ocultos = (typeof SKU_OCULTOS_EN_FORMULARIOS !== 'undefined') ? SKU_OCULTOS_EN_FORMULARIOS : [];
  var recetas = _recetasPorSkuCompleto_();
  var vinc = _vinculosPrecio_(term.porSku);

  var productos = [];
  term.orden.forEach(function(sku) {
    if (ocultos.indexOf(sku) > -1) return;
    var t = term.porSku[sku];
    var uv = _unidadVentaDe_(vinc.porSku[sku] || null);
    productos.push({
      sku: sku, nombre: t.nombre,
      rubro: rubrosCfg[sku] ? rubrosCfg[sku].rubro : _rubroPorDefectoDeSku_(sku),
      lineas: recetas[sku] ? recetas[sku].length : 0,
      unidadVenta: uv,
      factor: t.factor,
      gramosPorUnidad: _gramosPorUnidad_(uv),
      pesoReceta: _pesoReceta_(recetas[sku])
    });
  });
  var rubros = RUBROS_PRODUCTO_ORDEN.slice(0, RUBROS_PRODUCTO_ORDEN.length - 1);
  productos.forEach(function(p) { if (rubros.indexOf(p.rubro) === -1 && p.rubro !== RUBRO_PRODUCTO_OTROS) rubros.push(p.rubro); });
  rubros.push(RUBRO_PRODUCTO_OTROS);

  var subrubros = {};
  _leerSubrubros_().forEach(function(s) {
    var k = _norm(s.nombre);
    if (!subrubros[k]) subrubros[k] = { nombre: s.nombre, rubro: s.rubro, unidad: s.unidad };
  });
  return { ok: true, productos: productos, rubros: rubros, recetas: recetas, subrubros: subrubros, unidades: _UNIDAD_INFO_ };
}
