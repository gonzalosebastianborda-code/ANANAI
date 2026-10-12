// ═══════════════════════════════════════════════════════════════
// ✅ ARCHIVO NUEVO — se agrega como pestaña nueva en el proyecto de
// Apps Script (Archivo → Nuevo → Script), con el nombre "Rubros".
// No pisa nada existente.
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Rubros y subrubros de insumos + compra por planilla
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO
//   Orden nuevo del catálogo de insumos, en tres niveles:
//     RUBRO     (ej. "Harinas y panificación") → solo AGRUPA la pantalla de
//               Stock de insumos. No toca recetas ni stock.
//     SUBRUBRO  (ej. "Harina de almendras") → es lo que antes se llamaba
//               "familia" (columna "Categoría" del Catálogo). Las recetas
//               descuentan stock del subrubro, sea cual sea la marca.
//     MARCA     (opcional, ej. "Norte") → insumo puntual dentro del
//               subrubro: "Harina de almendras Norte". Si no se escribe
//               marca, el insumo se llama igual que el subrubro.
//   La unidad en que se compra y se guarda (kg / litro / unidad / paquete)
//   vive en el subrubro: todas las marcas de un subrubro comparten unidad.
//
// QUÉ AGREGA (todo es aditivo: no cambia ninguna columna existente)
//   - Hoja nueva "Subrubros" (registro: rubro, subrubro, unidad base). Se
//     crea sola la primera vez, ya cargada con los 47 subrubros de las
//     recetas reales.
//   - Columna nueva "Rubro" al final del Catálogo (se agrega sola).
//   - Hoja nueva "Altas Insumos": quién dio de alta cada insumo, cuándo y
//     en qué compra (para poder rastrear cada alta).
//   - getCatalogoPlanilla / crearSubrubro / registrarCompraPlanilla: lo que
//     usa la planilla de "Registrar compra".
//   - getLimpiezaInsumos / aplicarLimpiezaInsumos: para llevar los insumos
//     que ya existían al orden nuevo (rubro + subrubro + unidad correcta).
//
// DE QUÉ DEPENDE (ya existe): ensureHojaCatalogo_, ensureHojaStock_,
//   ENCABEZADOS_CATALOGO, _convertirCantidad_, _moverStock_, _sanTxt_,
//   _sanObj_ (Produccion.gs) · DATA_ROW, _norm, estiloHeader (Código.gs) ·
//   _requiereRol_, _conLock_ (Auth.gs / Pedidos.gs) · crearInsumoNuevo
//   (Nuevo insumos.gs) · registrarCompraItemizada (Nuevo compras.gs) ·
//   _usuarioActual (Configuracion.gs).
// ═══════════════════════════════════════════════════════════════

var H_SUBRUBROS = 'Subrubros';
var ENCABEZADOS_SUBRUBROS = ['Rubro', 'Subrubro', 'Unidad base', 'Alta', 'Usuario'];
var H_ALTAS_INSUMOS = 'Altas Insumos';
var ENCABEZADOS_ALTAS_INSUMOS = ['Fecha', 'Compra', 'SKU', 'Insumo', 'Rubro', 'Subrubro', 'Unidad', 'Usuario'];
var RUBRO_SIN_CLASIFICAR = 'Sin clasificar';
var UNIDADES_BASE_SUBRUBRO = ['kg', 'litro', 'unidad', 'paquete'];
// Unidades que se pueden TIPEAR en la planilla según la unidad base del subrubro.
var UNIDADES_PERMITIDAS_POR_BASE = { kg: ['kg', 'g'], litro: ['litro', 'ml'], unidad: ['unidad'], paquete: ['paquete'] };

// Subrubros con los que arranca el registro (sacados de las recetas reales
// del Excel de distribuidora). Solo se usan al CREAR la hoja "Subrubros";
// después manda lo que haya en la hoja.
var SUBRUBROS_INICIALES = [
  ['Verdulería y frescos', 'Cebolla', 'kg'],
  ['Verdulería y frescos', 'Zanahoria', 'kg'],
  ['Verdulería y frescos', 'Morrón', 'kg'],
  ['Verdulería y frescos', 'Tomate', 'kg'],
  ['Verdulería y frescos', 'Tomate cherry', 'kg'],
  ['Verdulería y frescos', 'Calabaza', 'kg'],
  ['Verdulería y frescos', 'Espinaca', 'kg'],
  ['Verdulería y frescos', 'Puerro', 'kg'],
  ['Verdulería y frescos', 'Verdeo', 'kg'],
  ['Verdulería y frescos', 'Perejil', 'kg'],
  ['Verdulería y frescos', 'Ajo', 'unidad'],
  ['Verdulería y frescos', 'Albahaca', 'unidad'],
  ['Verdulería y frescos', 'Naranja', 'unidad'],
  ['Quesos y lácteos', 'Queso holanda', 'kg'],
  ['Quesos y lácteos', 'Queso cremoso', 'kg'],
  ['Quesos y lácteos', 'Queso crema', 'kg'],
  ['Quesos y lácteos', 'Queso muzzarella', 'kg'],
  ['Quesos y lácteos', 'Queso sardo', 'kg'],
  ['Quesos y lácteos', 'Queso azul', 'kg'],
  ['Quesos y lácteos', 'Queso parmesano', 'kg'],
  ['Quesos y lácteos', 'Ricota', 'kg'],
  ['Quesos y lácteos', 'Manteca', 'kg'],
  ['Quesos y lácteos', 'Queso de almendras', 'kg'],
  ['Quesos y lácteos', 'Leche descremada', 'litro'],
  ['Quesos y lácteos', 'Leche de almendras', 'litro'],
  ['Carnes y fiambres', 'Suprema', 'kg'],
  ['Carnes y fiambres', 'Jamón cocido', 'kg'],
  ['Carnes y fiambres', 'Jamón crudo', 'kg'],
  ['Carnes y fiambres', 'Atún', 'kg'],
  ['Harinas y panificación', 'Harina de almendras', 'kg'],
  ['Harinas y panificación', 'Fécula de mandioca', 'kg'],
  ['Harinas y panificación', 'Polvo de hornear', 'kg'],
  ['Harinas y panificación', 'Levadura', 'kg'],
  ['Harinas y panificación', 'Azúcar mascabo', 'kg'],
  ['Almacén y condimentos', 'Sal himalaya', 'kg'],
  ['Almacén y condimentos', 'Pimienta', 'kg'],
  ['Almacén y condimentos', 'Pimentón', 'kg'],
  ['Almacén y condimentos', 'Orégano', 'kg'],
  ['Almacén y condimentos', 'Nuez moscada', 'kg'],
  ['Almacén y condimentos', 'Mostaza', 'kg'],
  ['Almacén y condimentos', 'Aceitunas', 'kg'],
  ['Almacén y condimentos', 'Salsa', 'kg'],
  ['Almacén y condimentos', 'Nuez', 'kg'],
  ['Almacén y condimentos', 'Mix de semillas', 'kg'],
  ['Almacén y condimentos', 'Lino', 'kg'],
  ['Almacén y condimentos', 'Aceite', 'litro'],
  ['Almacén y condimentos', 'Aceite de oliva', 'litro'],
  ['Huevos', 'Huevo', 'unidad']
];

// Nombres escritos "a la antigua" → subrubro correcto. Solo se usan para
// SUGERIR en la limpieza de insumos que ya existían; el Gerente confirma.
var _ALIAS_SUBRUBRO_ = {
  'polvo h': 'Polvo de hornear', 'quesa crema': 'Queso crema', 'sardo': 'Queso sardo',
  'aceituna': 'Aceitunas', 'aceite oliva': 'Aceite de oliva', 'leche almendras': 'Leche de almendras',
  'harina almendras': 'Harina de almendras', 'fecula mandioca': 'Fécula de mandioca',
  'queso almendras': 'Queso de almendras', 'mix semillas': 'Mix de semillas', 'huevos': 'Huevo',
  'tomates': 'Tomate', 'cebollas': 'Cebolla', 'zanahorias': 'Zanahoria', 'naranjas': 'Naranja', 'morrones': 'Morrón'
};

// ── HOJAS ──────────────────────────────────────────────────────────
function ensureHojaSubrubros_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_SUBRUBROS);
  if (!ws) {
    ws = ss.insertSheet(H_SUBRUBROS);
    ws.getRange('A1').setValue('AÑAÑAI · Subrubros de insumos — el rubro solo agrupa; el subrubro es lo que usan las recetas para descontar stock. Se edita desde el panel (Registrar compra / Limpiar insumos).');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_SUBRUBROS.length), '#2F6B4F');
    ws.getRange(2, 1, 1, ENCABEZADOS_SUBRUBROS.length).setValues([ENCABEZADOS_SUBRUBROS]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
    var ahora = new Date();
    var filas = SUBRUBROS_INICIALES.map(function(r) { return [r[0], r[1], r[2], ahora, 'Carga inicial']; });
    ws.getRange(DATA_ROW, 1, filas.length, ENCABEZADOS_SUBRUBROS.length).setValues(filas);
  }
  return ws;
}

function ensureHojaAltasInsumos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_ALTAS_INSUMOS);
  if (!ws) {
    ws = ss.insertSheet(H_ALTAS_INSUMOS);
    ws.getRange('A1').setValue('AÑAÑAI · Altas de insumos — quién creó cada insumo nuevo desde la planilla de compras, cuándo y en qué compra. Se llena sola, no editar a mano.');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_ALTAS_INSUMOS.length), '#5B3A29');
    ws.getRange(2, 1, 1, ENCABEZADOS_ALTAS_INSUMOS.length).setValues([ENCABEZADOS_ALTAS_INSUMOS]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

// Devuelve el número de columna donde vive "Rubro" en el Catálogo; si
// todavía no existe la agrega al final (a partir de la columna 9) sin tocar
// ninguna columna existente. Nunca pisa una columna que ya tenga otro rótulo.
function _colRubro_(ws) {
  var lastCol = Number(ws.getLastColumn()) || ENCABEZADOS_CATALOGO.length;
  var ancho = Math.max(lastCol, ENCABEZADOS_CATALOGO.length);
  var cab = ws.getRange(2, 1, 1, ancho).getValues()[0];
  for (var j = ENCABEZADOS_CATALOGO.length; j < cab.length; j++) {
    if (String(cab[j]).trim() === 'Rubro') return j + 1;
  }
  var col = Math.max(ENCABEZADOS_CATALOGO.length + 1, lastCol + 1);
  try {
    var maxCols = Number(ws.getMaxColumns());
    if (maxCols && maxCols < col) ws.insertColumnsAfter(maxCols, col - maxCols);
  } catch (e) {}
  ws.getRange(2, col).setValue('Rubro');
  ws.getRange(2, col).setFontWeight('bold').setFontColor('#ffffff').setBackground('#2F6B4F');
  return col;
}

// ── LECTURAS INTERNAS ──────────────────────────────────────────────
function _leerSubrubros_() {
  var ws = ensureHojaSubrubros_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return [];
  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_SUBRUBROS.length).getValues();
  var out = [];
  filas.forEach(function(r, i) {
    var nombre = String(r[1] || '').trim();
    if (!nombre) return;
    out.push({
      rubro: String(r[0] || '').trim() || RUBRO_SIN_CLASIFICAR,
      nombre: nombre,
      unidad: String(r[2] || '').trim() || 'kg',
      fila: DATA_ROW + i
    });
  });
  return out;
}

function _subrubroPorNombre_(lista, nombre) {
  var k = _norm(nombre);
  if (!k) return null;
  for (var i = 0; i < lista.length; i++) if (_norm(lista[i].nombre) === k) return lista[i];
  return null;
}

// Si ya existe un rubro con ese nombre (sin importar mayúsculas/tildes) se
// usa el escrito original — así "quesos y lacteos" no crea un rubro duplicado.
function _rubroCanonico_(lista, rubro) {
  var k = _norm(rubro);
  for (var i = 0; i < lista.length; i++) if (_norm(lista[i].rubro) === k) return lista[i].rubro;
  return String(rubro || '').trim();
}

// Insumos del Catálogo (Tipo='Insumo') con su rubro guardado, si lo tienen.
function _filasInsumosConRubro_() {
  var ws = ensureHojaCatalogo_();
  var colR = _colRubro_(ws);
  var last = ws.getLastRow();
  var out = [];
  if (last >= DATA_ROW) {
    var n = last - DATA_ROW + 1;
    var filas = ws.getRange(DATA_ROW, 1, n, ENCABEZADOS_CATALOGO.length).getValues();
    var rubros = ws.getRange(DATA_ROW, colR, n, 1).getValues();
    filas.forEach(function(r, i) {
      if (String(r[3]).trim() !== 'Insumo') return;
      var sku = String(r[0] || '').trim();
      if (!sku) return;
      out.push({
        fila: DATA_ROW + i, sku: sku, nombre: String(r[1] || '').trim(),
        familia: String(r[2] || '').trim(), unidad: String(r[4] || '').trim(),
        minimo: (r[7] === '' || r[7] == null) ? null : Number(r[7]),
        rubro: String(rubros[i][0] || '').trim()
      });
    });
  }
  return { ws: ws, colR: colR, insumos: out };
}

function _stockPorSku_() {
  var wsStock = ensureHojaStock_();
  var last = wsStock.getLastRow();
  var out = {};
  if (last >= DATA_ROW) {
    wsStock.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 3).getValues().forEach(function(r) {
      if (r[0]) out[String(r[0]).trim()] = Number(r[2]) || 0;
    });
  }
  return out;
}

// Rubro de un insumo: el del registro de subrubros si su familia está ahí;
// si no, el que tenga guardado en el Catálogo; si no, "Sin clasificar".
function _rubroDeFamilia_(registro, familia, rubroGuardado) {
  var s = _subrubroPorNombre_(registro, familia);
  if (s) return s.rubro;
  return rubroGuardado || RUBRO_SIN_CLASIFICAR;
}

// Parte "marca" del nombre de un insumo: lo que sigue al subrubro.
function _marcaDe_(nombreInsumo, subrubro) {
  var n = String(nombreInsumo || '').trim(), s = String(subrubro || '').trim();
  if (!n || !s) return '';
  if (_norm(n) === _norm(s)) return '';
  if (_norm(n).indexOf(_norm(s) + ' ') === 0) return n.slice(s.length).trim();
  return '';
}

// ── PANTALLAS ──────────────────────────────────────────────────────
// Todo lo que necesita la planilla de compras en una sola llamada:
// rubros → subrubros (con unidad base y stock) → insumos/marcas.
function getCatalogoPlanilla(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var reg = _leerSubrubros_();
  var info = _filasInsumosConRubro_();
  var stock = _stockPorSku_();
  var usos = _recetasPorFamilia_();

  var subs = {}, ordenSubs = [];
  reg.forEach(function(s) {
    var k = _norm(s.nombre);
    if (subs[k]) return;
    subs[k] = { nombre: s.nombre, rubro: s.rubro, unidad: s.unidad, enRegistro: true, insumos: [] };
    ordenSubs.push(k);
  });
  var pendientes = 0;
  info.insumos.forEach(function(ins) {
    var fam = ins.familia || 'Sin familia';
    var k = _norm(fam);
    var s = subs[k];
    if (!s) {
      s = { nombre: fam, rubro: ins.rubro || RUBRO_SIN_CLASIFICAR, unidad: ins.unidad || 'kg', enRegistro: false, insumos: [] };
      subs[k] = s; ordenSubs.push(k);
    }
    s.insumos.push({
      sku: ins.sku, nombre: ins.nombre, marca: _marcaDe_(ins.nombre, s.nombre), unidad: ins.unidad,
      stock: stock[ins.sku] || 0, minimo: ins.minimo
    });
    if (!s.enRegistro) pendientes++;
  });

  var rubros = {}, ordenRubros = [];
  ordenSubs.forEach(function(k) {
    var s = subs[k];
    var total = null;
    if (s.insumos.length) {
      total = 0;
      s.insumos.forEach(function(i) {
        if (_norm(i.unidad) !== _norm(s.unidad)) total = null;
        else if (total != null) total += i.stock;
      });
    }
    var rk = s.rubro || RUBRO_SIN_CLASIFICAR;
    if (!rubros[rk]) { rubros[rk] = { nombre: rk, subrubros: [] }; ordenRubros.push(rk); }
    rubros[rk].subrubros.push({ nombre: s.nombre, unidad: s.unidad, enRegistro: s.enRegistro, stock: total, insumos: s.insumos, recetas: usos[k] || [] });
  });
  // "Sin clasificar" siempre al final
  ordenRubros.sort(function(a, b) {
    var sa = a === RUBRO_SIN_CLASIFICAR ? 1 : 0, sb = b === RUBRO_SIN_CLASIFICAR ? 1 : 0;
    return sa - sb;
  });
  return { ok: true, rubros: ordenRubros.map(function(k) { return rubros[k]; }), pendientes: pendientes };
}

// Alta de un subrubro nuevo en el registro (ej. "Frutos secos / Almendras /
// kg"). Si ya existe uno con ese nombre devuelve el existente, no duplica.
function crearSubrubro(rubro, nombre, unidad, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  rubro = String(rubro || '').trim();
  nombre = String(nombre || '').trim();
  unidad = String(unidad || '').trim().toLowerCase();
  if (!nombre) return { ok: false, mensaje: 'Falta el nombre del subrubro.' };
  if (!rubro) return { ok: false, mensaje: 'Falta el rubro del subrubro "' + nombre + '".' };
  if (nombre.length > 60 || rubro.length > 60) return { ok: false, mensaje: 'El rubro y el subrubro pueden tener hasta 60 caracteres.' };
  if (UNIDADES_BASE_SUBRUBRO.indexOf(unidad) === -1) {
    return { ok: false, mensaje: 'La unidad del subrubro tiene que ser una de: ' + UNIDADES_BASE_SUBRUBRO.join(', ') + '.' };
  }

  return _conLock_(function() {
    var ws = ensureHojaSubrubros_();
    var reg = _leerSubrubros_();
    var ya = _subrubroPorNombre_(reg, nombre);
    if (ya) {
      return { ok: true, existente: true, rubro: ya.rubro, nombre: ya.nombre, unidad: ya.unidad,
        mensaje: 'Ya existía el subrubro "' + ya.nombre + '" (' + ya.rubro + ', ' + ya.unidad + ').' };
    }
    var rubroFinal = _rubroCanonico_(reg, rubro);
    var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
    ws.getRange(fila, 1, 1, ENCABEZADOS_SUBRUBROS.length).setValues([[
      _sanTxt_(rubroFinal), _sanTxt_(nombre), unidad, new Date(), _sanTxt_(_usuarioActual() || chk.sesion && chk.sesion.rol || '')
    ]]);
    return { ok: true, existente: false, rubro: rubroFinal, nombre: nombre, unidad: unidad,
      mensaje: '✅ Subrubro nuevo: ' + nombre + ' (' + rubroFinal + ', ' + unidad + ').' };
  });
}

// ── COMPRA POR PLANILLA ────────────────────────────────────────────
// datos = {
//   proveedor, condicion ('Contado' | 'Cuenta corriente'), diasPago, obs, caja,
//   filas: [{ rubro, subrubro, marca, cantidad, unidad, modo ('unitario'|'total'),
//             precio, unidadBase }]
// }
//  · modo 'unitario': precio = $ por cada unidad tipeada (ej. $ por kg).
//  · modo 'total':    precio = $ total de la fila (se divide por la cantidad).
//  · rubro / unidadBase solo se usan si el subrubro todavía no existe.
// Pasos: (1) valida TODO sin escribir nada; (2) da de alta lo que falte
// (subrubros e insumos, con su registro en "Altas Insumos"); (3) cierra la
// compra con registrarCompraItemizada (UN solo gasto, stock, ledger).
// No toma el lock acá: cada paso toma el suyo (el lock no es reentrante).
function registrarCompraPlanilla(datos, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  datos = _sanObj_(datos || {});
  var proveedor = String(datos.proveedor || '').trim();
  if (!proveedor) return { ok: false, mensaje: 'Falta el proveedor.' };
  var filas = datos.filas || [];
  if (!filas.length) return { ok: false, mensaje: 'La planilla no tiene filas con datos.' };
  if (filas.length > 150) return { ok: false, mensaje: 'La planilla tiene demasiadas filas (máximo 150 por compra).' };

  var reg = _leerSubrubros_();
  var info = _filasInsumosConRubro_();
  var errores = [];
  var plan = [];                    // una entrada por fila, ya resuelta
  var subrubrosNuevos = {};         // norm(nombre) → {rubro, nombre, unidad}
  var subsVirtuales = {};           // familias del Catálogo que no están en el registro
  info.insumos.forEach(function(ins) {
    var k = _norm(ins.familia);
    if (k && !subsVirtuales[k]) subsVirtuales[k] = { nombre: ins.familia, rubro: ins.rubro || '', unidad: ins.unidad || 'kg' };
  });

  filas.forEach(function(f, i) {
    var n = i + 1;
    var subNombre = String(f.subrubro || '').trim();
    var marca = String(f.marca || '').trim();
    var unidad = String(f.unidad || '').trim().toLowerCase();
    var cantidad = Number(f.cantidad), precio = Number(f.precio);
    var modo = f.modo === 'total' ? 'total' : 'unitario';
    if (!subNombre) { errores.push('Fila ' + n + ': falta el subrubro.'); return; }
    if (subNombre.length > 60 || marca.length > 40) { errores.push('Fila ' + n + ': el subrubro / la marca son demasiado largos.'); return; }
    if (!(cantidad > 0) || !isFinite(cantidad)) { errores.push('Fila ' + n + ' (' + subNombre + '): la cantidad tiene que ser un número mayor a 0.'); return; }
    if (!(precio > 0) || !isFinite(precio) || !isFinite(cantidad * precio)) { errores.push('Fila ' + n + ' (' + subNombre + '): el precio tiene que ser un número mayor a 0.'); return; }

    var k = _norm(subNombre);
    var sub = _subrubroPorNombre_(reg, subNombre);
    var nuevo = false;
    if (!sub && subrubrosNuevos[k]) sub = subrubrosNuevos[k];
    if (!sub && subsVirtuales[k]) {
      var v = subsVirtuales[k];
      sub = { nombre: v.nombre, rubro: v.rubro, unidad: v.unidad, virtual: true };
    }
    if (!sub) {
      var rubroNuevo = String(f.rubro || '').trim();
      var unidadBase = String(f.unidadBase || '').trim().toLowerCase();
      if (!rubroNuevo) { errores.push('Fila ' + n + ' (' + subNombre + '): el subrubro no existe todavía — elegí su rubro.'); return; }
      if (UNIDADES_BASE_SUBRUBRO.indexOf(unidadBase) === -1) { errores.push('Fila ' + n + ' (' + subNombre + '): elegí la unidad del subrubro nuevo (kg, litro, unidad o paquete).'); return; }
      sub = { nombre: subNombre, rubro: _rubroCanonico_(reg, rubroNuevo), unidad: unidadBase, nuevo: true };
      subrubrosNuevos[k] = sub; nuevo = true;
    }

    var permitidas = UNIDADES_PERMITIDAS_POR_BASE[_normalizarUnidad_(sub.unidad)] || [sub.unidad];
    var uNorm = _normalizarUnidad_(unidad);
    if (!uNorm) uNorm = _normalizarUnidad_(sub.unidad);
    if (permitidas.indexOf(uNorm) === -1) {
      errores.push('Fila ' + n + ' (' + sub.nombre + '): este subrubro se carga en ' + permitidas.join(' o ') + ', no en "' + unidad + '".');
      return;
    }

    var nombreInsumo = marca ? sub.nombre + ' ' + marca : sub.nombre;
    var existente = null;
    for (var j = 0; j < info.insumos.length; j++) {
      if (_norm(info.insumos[j].nombre) === _norm(nombreInsumo)) { existente = info.insumos[j]; break; }
    }
    if (existente) {
      if (_norm(existente.familia) !== _norm(sub.nombre)) {
        errores.push('Fila ' + n + ': el insumo "' + existente.nombre + '" ya existe pero dentro de "' + (existente.familia || 'sin familia') + '", no de "' + sub.nombre + '". Ordenalo primero en Stock de insumos → Limpiar insumos.');
        return;
      }
      var convOk = _convertirCantidad_(1, uNorm, existente.unidad);
      if (!convOk.ok) {
        errores.push('Fila ' + n + ': "' + existente.nombre + '" está guardado en ' + existente.unidad + ' y vos cargás ' + uNorm + '. Corregí su unidad en Stock de insumos → Limpiar insumos.');
        return;
      }
    }
    plan.push({
      n: n, sub: sub, subNuevo: nuevo, nombreInsumo: nombreInsumo, existente: existente,
      cantidad: cantidad, unidad: uNorm, modo: modo, precio: precio
    });
  });

  if (errores.length) {
    return { ok: false, errores: errores, mensaje: '⛔ La planilla tiene datos para corregir antes de cerrar la compra: ' + errores.join(' · ') };
  }

  // ── Altas (recién ahora se escribe algo) ──
  var altasSubrubros = [];
  var nuevosNombres = Object.keys(subrubrosNuevos);
  for (var a = 0; a < nuevosNombres.length; a++) {
    var sn = subrubrosNuevos[nuevosNombres[a]];
    var rs = crearSubrubro(sn.rubro, sn.nombre, sn.unidad, token);
    if (!rs.ok) return rs;
    if (!rs.existente) altasSubrubros.push({ rubro: rs.rubro, nombre: rs.nombre, unidad: rs.unidad });
  }

  var altas = [];
  var skuPorNombre = {};
  var lineas = [];
  for (var p = 0; p < plan.length; p++) {
    var it = plan[p];
    var sku;
    var kn = _norm(it.nombreInsumo);
    if (it.existente) {
      sku = it.existente.sku;
    } else if (skuPorNombre[kn]) {
      sku = skuPorNombre[kn];
    } else {
      var rubroCol = (it.sub.rubro && it.sub.rubro !== RUBRO_SIN_CLASIFICAR) ? it.sub.rubro : '';
      var rc = crearInsumoNuevo(it.nombreInsumo, it.sub.nombre, it.sub.unidad, token, '', rubroCol);
      if (!rc.ok) {
        _logAltasInsumos_('(compra sin cerrar)', altas, chk.sesion);
        return { ok: false, mensaje: '⛔ Fila ' + it.n + ': ' + rc.mensaje + (altas.length ? ' (Ya se habían dado de alta ' + altas.length + ' insumo(s) de esta planilla: quedan en el Catálogo.)' : ''), altas: altas, altasSubrubros: altasSubrubros };
      }
      sku = rc.sku;
      if (!rc.existente) altas.push({ sku: rc.sku, nombre: rc.nombre, rubro: it.sub.rubro, subrubro: it.sub.nombre, unidad: it.sub.unidad });
    }
    skuPorNombre[kn] = sku;
    lineas.push({
      sku: sku, cantidad: it.cantidad, unidad: it.unidad,
      precioUnitario: it.modo === 'total' ? it.precio / it.cantidad : it.precio
    });
  }

  var res = registrarCompraItemizada(proveedor, datos.condicion, Number(datos.diasPago) || 0, lineas, datos.obs || '', token, datos.caja || '');
  _logAltasInsumos_((res && res.compraId) ? res.compraId : '(compra sin cerrar)', altas, chk.sesion);

  var salida = {};
  Object.keys(res || {}).forEach(function(k2) { salida[k2] = res[k2]; });
  salida.altas = altas;
  salida.altasSubrubros = altasSubrubros;
  if (res && res.ok && (altas.length || altasSubrubros.length)) {
    salida.mensaje += ' ℹ Altas: ' + altas.length + ' insumo(s)' + (altasSubrubros.length ? ' y ' + altasSubrubros.length + ' subrubro(s)' : '') + ' nuevos.';
  }
  return salida;
}

function _logAltasInsumos_(compraId, altas, sesion) {
  if (!altas || !altas.length) return;
  try {
    var usuario = (sesion && sesion.rol ? sesion.rol : '') + (_usuarioActual() ? ' · ' + _usuarioActual() : '');
    var ahora = new Date();
    var filas = altas.map(function(x) {
      return [ahora, _sanTxt_(compraId), x.sku, _sanTxt_(x.nombre), _sanTxt_(x.rubro || ''), _sanTxt_(x.subrubro || ''), x.unidad, _sanTxt_(usuario)];
    });
    // Con el candado puesto: dos compras cerradas a la vez no se pisan las filas.
    _conLock_(function() {
      var ws = ensureHojaAltasInsumos_();
      var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
      ws.getRange(fila, 1, filas.length, ENCABEZADOS_ALTAS_INSUMOS.length).setValues(filas);
    });
  } catch (e) { /* el registro de altas es auxiliar: nunca frena la compra */ }
}

// ── LIMPIEZA DE INSUMOS QUE YA EXISTÍAN ────────────────────────────
// Factor para pasar el stock de una unidad a otra al cambiar la unidad de
// un insumo. Misma magnitud (g→kg, ml→litro): factor exacto. Masa↔volumen
// (g/kg → ml/litro): se toma 1 g = 1 ml, que es el criterio acordado para
// los líquidos (aceite, leche…) — se marca "aproximado" para que el
// Gerente lo vea antes de aplicar.
function _factorCambioUnidad_(unidadActual, unidadNueva) {
  var a = _normalizarUnidad_(unidadActual), b = _normalizarUnidad_(unidadNueva);
  if (!a || !b || a === b) return { ok: true, factor: 1, aproximado: false };
  var ia = _UNIDAD_INFO_[a], ib = _UNIDAD_INFO_[b];
  if (!ia || !ib) return { ok: false, mensaje: 'no se puede pasar de "' + unidadActual + '" a "' + unidadNueva + '"' };
  if (ia.grupo === ib.grupo) return { ok: true, factor: ia.factor / ib.factor, aproximado: false };
  var masaVol = (ia.grupo === 'masa' && ib.grupo === 'volumen') || (ia.grupo === 'volumen' && ib.grupo === 'masa');
  if (masaVol) return { ok: true, factor: ia.factor / ib.factor, aproximado: true };
  return { ok: false, mensaje: 'no se puede pasar de "' + unidadActual + '" a "' + unidadNueva + '" (unidades no relacionadas)' };
}

function _sugerirSubrubro_(ins, reg) {
  var s = _subrubroPorNombre_(reg, ins.familia);
  if (s) return s;
  s = _subrubroPorNombre_(reg, ins.nombre);
  if (s) return s;
  var alias = _ALIAS_SUBRUBRO_[_norm(ins.nombre)] || _ALIAS_SUBRUBRO_[_norm(ins.familia)];
  if (alias) { s = _subrubroPorNombre_(reg, alias); if (s) return s; }
  // "Harina de almendras Norte" → empieza con el subrubro (gana el nombre más largo)
  var mejor = null;
  reg.forEach(function(r) {
    if (_norm(ins.nombre).indexOf(_norm(r.nombre) + ' ') === 0) {
      if (!mejor || r.nombre.length > mejor.nombre.length) mejor = r;
    }
  });
  return mejor;
}

// Lista TODOS los insumos con lo que tienen hoy y lo que se propone: para
// llevarlos al orden nuevo desde la pantalla "Limpiar insumos".
function getLimpiezaInsumos(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var reg = _leerSubrubros_();
  var info = _filasInsumosConRubro_();
  var stock = _stockPorSku_();
  var lista = info.insumos.map(function(ins) {
    var sug = _sugerirSubrubro_(ins, reg);
    var actual = _subrubroPorNombre_(reg, ins.familia);
    var ok = !!(actual && _norm(ins.rubro) === _norm(actual.rubro) && _normalizarUnidad_(ins.unidad) === _normalizarUnidad_(actual.unidad));
    var cambio = null;
    if (sug && !ok) {
      var f = _factorCambioUnidad_(ins.unidad, sug.unidad);
      cambio = { subrubro: sug.nombre, rubro: sug.rubro, unidad: sug.unidad, factor: f.ok ? f.factor : null, aproximado: !!f.aproximado, error: f.ok ? '' : f.mensaje };
    }
    return {
      sku: ins.sku, nombre: ins.nombre, familia: ins.familia, rubro: ins.rubro || (actual ? actual.rubro : ''), unidad: ins.unidad,
      stock: stock[ins.sku] || 0, estado: ok ? 'ok' : 'revisar', sugerencia: cambio
    };
  });
  return {
    ok: true, insumos: lista,
    subrubros: reg.map(function(r) { return { rubro: r.rubro, nombre: r.nombre, unidad: r.unidad }; })
  };
}

// Aplica los cambios que el Gerente confirmó.
// cambios: [{ sku, subrubro, rubro, unidadBase }] — rubro/unidadBase solo
// si el subrubro es nuevo. Por cada insumo: guarda subrubro (Categoría),
// rubro y unidad; si la unidad cambia, re-expresa el stock en la unidad
// nueva con un Ajuste que queda en Movimientos Stock. NO toca el historial
// de compras ni las recetas (avisa si alguna receta usa el nombre viejo).
function aplicarLimpiezaInsumos(cambios, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  cambios = _sanObj_(cambios || []);
  if (!cambios.length) return { ok: false, mensaje: 'No hay cambios para aplicar.' };
  if (cambios.length > 300) return { ok: false, mensaje: 'Demasiados cambios juntos (máximo 300).' };

  // Subrubros nuevos primero (cada alta toma su propio lock).
  var vistos = {};
  for (var i = 0; i < cambios.length; i++) {
    var c = cambios[i];
    var k = _norm(c.subrubro);
    if (!k || vistos[k]) continue;
    vistos[k] = true;
    var reg0 = _leerSubrubros_();
    if (!_subrubroPorNombre_(reg0, c.subrubro)) {
      var rs = crearSubrubro(c.rubro, c.subrubro, c.unidadBase, token);
      if (!rs.ok) return rs;
    }
  }

  return _conLock_(function() {
    var reg = _leerSubrubros_();
    var info = _filasInsumosConRubro_();
    var aplicados = [], errores = [], avisos = [];
    var recetasPorFamilia = _contarLineasRecetaPorFamilia_();

    cambios.forEach(function(c) {
      var ins = null;
      for (var j = 0; j < info.insumos.length; j++) if (info.insumos[j].sku === String(c.sku || '').trim()) { ins = info.insumos[j]; break; }
      if (!ins) { errores.push((c.sku || '(sin SKU)') + ': no es un insumo del Catálogo.'); return; }
      var sub = _subrubroPorNombre_(reg, c.subrubro);
      if (!sub) { errores.push(ins.sku + ': el subrubro "' + c.subrubro + '" no existe.'); return; }

      var f = _factorCambioUnidad_(ins.unidad, sub.unidad);
      if (!f.ok) { errores.push(ins.sku + ' (' + ins.nombre + '): ' + f.mensaje + ' — no se tocó.'); return; }

      var stockViejo = _leerStockActual_(ins.sku);
      var familiaVieja = ins.familia;
      var ws = info.ws;
      ws.getRange(ins.fila, 3).setValue(_sanTxt_(sub.nombre));                 // Categoría = subrubro
      ws.getRange(ins.fila, info.colR).setValue(_sanTxt_(sub.rubro));          // Rubro
      var cambioUnidad = _normalizarUnidad_(ins.unidad) !== _normalizarUnidad_(sub.unidad);
      if (cambioUnidad) ws.getRange(ins.fila, 5).setValue(sub.unidad);         // Unidad de producción

      var detalleStock = '';
      if (cambioUnidad && stockViejo !== 0) {
        var stockNuevo = Math.round(stockViejo * f.factor * 1000000) / 1000000;
        var mv = _moverStock_(ins.sku, 'ajuste', stockNuevo, {
          detalle: 'Limpieza de insumos · unidad ' + ins.unidad + ' → ' + sub.unidad + ' (stock ' + stockViejo + ' → ' + stockNuevo + ')'
        });
        if (!mv.ok) errores.push(ins.sku + ': la unidad cambió pero no se pudo re-expresar el stock (' + mv.mensaje + ') — revisalo a mano.');
        else detalleStock = ' · stock ' + stockViejo + ' ' + ins.unidad + ' → ' + stockNuevo + ' ' + sub.unidad + (f.aproximado ? ' (1 g = 1 ml)' : '');
      } else if (cambioUnidad) {
        // Sin stock: igual se refresca la unidad que muestra la hoja Stock.
        _moverStock_(ins.sku, 'ajuste', 0, { detalle: 'Limpieza de insumos · unidad ' + ins.unidad + ' → ' + sub.unidad });
      }
      var usadas = recetasPorFamilia[_norm(familiaVieja)] || 0;
      if (usadas && _norm(familiaVieja) !== _norm(sub.nombre)) {
        avisos.push('"' + familiaVieja + '" lo usan ' + usadas + ' línea(s) de receta: cambiá su familia a "' + sub.nombre + '" en Recetas.');
      }
      aplicados.push({ sku: ins.sku, nombre: ins.nombre, subrubro: sub.nombre, rubro: sub.rubro, unidad: sub.unidad, detalleStock: detalleStock });
    });

    return {
      ok: aplicados.length > 0, aplicados: aplicados, errores: errores, avisos: avisos,
      mensaje: (aplicados.length ? '✅ ' + aplicados.length + ' insumo(s) ordenados.' : '❌ No se aplicó ningún cambio.')
        + (errores.length ? ' ⚠ ' + errores.join(' · ') : '') + (avisos.length ? ' ℹ ' + avisos.join(' · ') : '')
    };
  });
}

// Qué productos tienen receta que usa cada familia/subrubro: { norm(familia): [producto, ...] }
// (sin repetidos). Lo usa la planilla de compras para mostrar "lo descuentan N recetas".
function _recetasPorFamilia_() {
  var out = {};
  try {
    var ws = ensureHojaRecetas_();   // Nuevo recetas.gs (carga solas las recetas limpias la 1ª vez)
    var last = ws.getLastRow();
    if (last < DATA_ROW) return out;
    ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 3).getValues().forEach(function(r) {
      var k = _norm(r[2]), prod = String(r[1] || '').trim();
      if (!k || !prod) return;
      if (!out[k]) out[k] = [];
      if (out[k].indexOf(prod) === -1) out[k].push(prod);
    });
  } catch (e) {}
  return out;
}

// Cuántas líneas de receta usan cada familia (para avisar si se renombra una).
function _contarLineasRecetaPorFamilia_() {
  var out = {};
  try {
    var ws = ensureHojaRecetas_();   // Nuevo recetas.gs (carga solas las recetas limpias la 1ª vez)
    var last = ws.getLastRow();
    if (last < DATA_ROW) return out;
    ws.getRange(DATA_ROW, 3, last - DATA_ROW + 1, 1).getValues().forEach(function(r) {
      var k = _norm(r[0]);
      if (k) out[k] = (out[k] || 0) + 1;
    });
  } catch (e) {}
  return out;
}
