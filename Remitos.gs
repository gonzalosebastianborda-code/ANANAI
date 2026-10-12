// ═══════════════════════════════════════════════════════════════
// ✅ ARCHIVO NUEVO — se agrega como pestaña nueva en el proyecto de
// Apps Script (Archivo → Nuevo → Script), con el nombre "Remitos".
// No pisa nada existente.
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Remitos descargables / imprimibles por pedido
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO: el Gerente puede sacar el remito de cualquier pedido, en
// cualquier estado (Pendiente de aprobación, Aceptado, Terminado,
// Entregado…), SIN precios o CON precios — lo elige al descargar. El
// servidor arma los datos con lo que ya hay cargado en el pedido; el panel
// los dibuja y abre el diálogo de impresión (imprimir o "Guardar como PDF"),
// igual que el comprobante interno de compras.
//
//   · Es un REMITO INTERNO: lleva el cartel "Documento no válido como
//     factura". El número (R-0001, R-0002…) es correlativo, se asigna la
//     primera vez que se emite el remito de un pedido y NO cambia si se
//     vuelve a bajar (se cuenta cuántas veces se emitió en la hoja
//     "Remitos").
//   · En la versión SIN precios el servidor ni siquiera envía los precios
//     ni los montos: no hay forma de que se "cuelen" en la impresión.
//   · Datos de la empresa (razón social, CUIT, domicilio, teléfono…): se
//     cargan una vez desde el mismo cuadro del remito. Lo que quede vacío
//     no se imprime.
//   · Datos del cliente: nombre y código (los que ya tiene el pedido). Si
//     en la hoja "Clientes" agregás columnas con el encabezado Domicilio,
//     Localidad, Teléfono, CUIT o Email, salen en el remito automáticamente.
//
// DE QUÉ DEPENDE (ya existe): _leerTodosPedidos_, PED_ESTADOS (Pedidos.gs),
// _conLock_ (Pedidos.gs), _requiereRol_ (Auth.gs), H_CLIENTES, DATA_ROW,
// _norm, estiloHeader (Código.gs), _sanTxt_ (Produccion.gs), _usuarioActual
// (Configuracion.gs).
// ═══════════════════════════════════════════════════════════════

var H_REMITOS = 'Remitos';
var ENCABEZADOS_REMITOS = ['Número', 'Grupo', 'Cliente', 'Primera emisión', 'Última emisión', 'Emisiones', 'Última versión', 'Estado al emitir', 'Usuario'];
var PROP_EMPRESA_REMITO = 'REMITO_EMPRESA';
var CAMPOS_EMPRESA_REMITO = ['razonSocial', 'cuit', 'domicilio', 'telefono', 'email', 'leyenda'];

function ensureHojaRemitos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_REMITOS);
  if (!ws) {
    ws = ss.insertSheet(H_REMITOS);
    ws.getRange('A1').setValue('AÑAÑAI · Remitos emitidos — un renglón por pedido (grupo). El número es correlativo y fijo. Se llena solo desde el panel, no editar a mano.');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_REMITOS.length), '#5B3A29');
    ws.getRange(2, 1, 1, ENCABEZADOS_REMITOS.length).setValues([ENCABEZADOS_REMITOS]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

function _empresaRemito_() {
  var out = { razonSocial: 'AÑAÑAI', cuit: '', domicilio: '', telefono: '', email: '', leyenda: '' };
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_EMPRESA_REMITO);
    if (raw) {
      var o = JSON.parse(raw);
      CAMPOS_EMPRESA_REMITO.forEach(function(k) { if (typeof o[k] === 'string') out[k] = o[k]; });
    }
  } catch (e) {}
  return out;
}

function getDatosEmpresaRemito(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  return { ok: true, empresa: _empresaRemito_() };
}

// Guarda los datos de la empresa que salen en el encabezado del remito.
// Son texto que se imprime tal cual (el panel los escapa al dibujarlos).
function guardarDatosEmpresaRemito(datos, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  datos = datos || {};
  var limites = { razonSocial: 80, cuit: 20, domicilio: 120, telefono: 40, email: 80, leyenda: 160 };
  var o = {};
  CAMPOS_EMPRESA_REMITO.forEach(function(k) {
    o[k] = String(datos[k] == null ? '' : datos[k]).replace(/[\r\n\t]+/g, ' ').trim().slice(0, limites[k]);
  });
  if (!o.razonSocial) return { ok: false, mensaje: 'La razón social / nombre de la empresa no puede quedar vacío.' };
  PropertiesService.getScriptProperties().setProperty(PROP_EMPRESA_REMITO, JSON.stringify(o));
  return { ok: true, empresa: o, mensaje: '✅ Datos de la empresa guardados para los remitos.' };
}

// Datos extra del cliente (domicilio, teléfono, CUIT…) si la hoja Clientes
// tiene columnas con esos encabezados. No inventa nada: lo que no está,
// queda vacío y no se imprime.
function _datosClienteRemito_(cliId, nombre) {
  var out = { cliId: String(cliId || ''), nombre: String(nombre || ''), domicilio: '', localidad: '', telefono: '', cuit: '', email: '' };
  try {
    var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_CLIENTES);
    if (!ws) return out;
    var last = ws.getLastRow(), lastCol = Number(ws.getLastColumn()) || 5;
    if (last < DATA_ROW) return out;
    var cab = ws.getRange(2, 1, 1, lastCol).getValues()[0].map(function(h) { return _norm(h); });
    var mapa = { domicilio: ['domicilio', 'direccion'], localidad: ['localidad', 'ciudad'], telefono: ['telefono', 'tel', 'celular'], cuit: ['cuit', 'cuil', 'cuit/cuil', 'dni'], email: ['email', 'mail', 'correo'] };
    var idx = {};
    Object.keys(mapa).forEach(function(k) {
      for (var j = 0; j < cab.length; j++) if (mapa[k].indexOf(cab[j]) > -1) { idx[k] = j; break; }
    });
    if (!Object.keys(idx).length) return out;
    var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, lastCol).getValues();
    var fila = null;
    for (var i = 0; i < filas.length && !fila; i++) if (cliId && String(filas[i][0]).trim() === String(cliId).trim()) fila = filas[i];
    for (var i2 = 0; i2 < filas.length && !fila; i2++) if (_norm(filas[i2][1]) === _norm(nombre)) fila = filas[i2];
    if (!fila) return out;
    Object.keys(idx).forEach(function(k) { out[k] = String(fila[idx[k]] == null ? '' : fila[idx[k]]).trim(); });
  } catch (e) {}
  return out;
}

// Arma los datos del remito de un pedido (grupo) y registra la emisión.
// version: 'sin' (sin precios, por defecto) | 'con' (con precios).
function getRemitoData(grupo, version, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  grupo = String(grupo || '').trim();
  if (!grupo) return { ok: false, mensaje: 'Falta el pedido.' };
  var conPrecios = (String(version || '').toLowerCase() === 'con');

  var lineas = _leerTodosPedidos_().filter(function(p) { return String(p.grupo) === grupo; }); // Pedidos.gs
  if (!lineas.length) return { ok: false, mensaje: 'No se encontró el pedido "' + grupo + '".' };
  var p0 = lineas[0];
  var TZ = 'America/Argentina/Buenos_Aires';

  var reg = _conLock_(function() {
    var ws = ensureHojaRemitos_();
    var last = ws.getLastRow();
    var ahora = new Date();
    var usuario = (chk.sesion && chk.sesion.rol ? chk.sesion.rol : '') + (_usuarioActual() ? ' · ' + _usuarioActual() : '');
    var filas = last >= DATA_ROW ? ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_REMITOS.length).getValues() : [];
    var maxNum = 0, filaExistente = -1, numero = '', emisiones = 0, primera = ahora;
    filas.forEach(function(r, i) {
      var m = String(r[0]).match(/^R-(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
      if (String(r[1]).trim() === grupo) { filaExistente = i; numero = String(r[0]); emisiones = Number(r[5]) || 0; if (r[3] instanceof Date) primera = r[3]; }
    });
    if (filaExistente === -1) {
      var n = maxNum + 1;
      numero = 'R-' + (n < 10 ? '000' + n : n < 100 ? '00' + n : n < 1000 ? '0' + n : String(n));
      var fila = Math.max(DATA_ROW, last + 1);
      ws.getRange(fila, 1, 1, ENCABEZADOS_REMITOS.length).setValues([[
        numero, grupo, _sanTxt_(String(p0.cliente || '')), ahora, ahora, 1, conPrecios ? 'Con precios' : 'Sin precios', String(p0.estado || ''), _sanTxt_(usuario)
      ]]);
      emisiones = 1;
    } else {
      var f = DATA_ROW + filaExistente;
      emisiones += 1;
      ws.getRange(f, 5, 1, 5).setValues([[ahora, emisiones, conPrecios ? 'Con precios' : 'Sin precios', String(p0.estado || ''), _sanTxt_(usuario)]]);
    }
    return { numero: numero, emisiones: emisiones, primera: primera, ahora: ahora };
  });
  if (reg && reg.ok === false) return reg; // "sistema ocupado" de _conLock_

  var obs = [];
  lineas.forEach(function(l) {
    var o = String(l.obs || '').trim();
    if (o && obs.indexOf(o) === -1) obs.push(o);
  });

  var totalUnidades = 0, total = 0;
  var items = lineas.map(function(l) {
    var u = Number(l.unidades) || 0;
    totalUnidades += u;
    var it = { producto: String(l.producto || ''), variante: String(l.variante || ''), unidad: String(l.unidad || ''), unidades: u };
    if (conPrecios) {
      var monto = Number(l.monto) || 0;
      it.precio = Number(l.precio) || 0;
      it.monto = monto;
      total += monto;
    }
    return it;
  });

  var estado = String(p0.estado || '');
  var salida = {
    ok: true,
    remito: {
      numero: reg.numero, emision: Utilities.formatDate(reg.ahora, TZ, 'dd/MM/yyyy HH:mm'),
      reimpresion: reg.emisiones > 1, emisiones: reg.emisiones,
      version: conPrecios ? 'con' : 'sin', grupo: grupo, estadoPedido: estado,
      estadoLeyenda: estado === 'Pendiente' ? 'Pedido pendiente de aprobación'
        : (estado === 'Rechazado' || estado === 'Cancelado' || estado === 'Revertido') ? 'Pedido ' + estado.toLowerCase() + ' — este remito no representa una entrega' : '',
      empresa: _empresaRemito_(),
      cliente: _datosClienteRemito_(p0.cliId, p0.cliente),
      vendedor: String(p0.vendedor || ''), fechaPedido: String(p0.fecha || ''), fechaEstimada: String(p0.fechaEstimada || ''),
      condicion: (p0.condicion === 'Contado' || p0.condicion === 'Crédito') ? String(p0.condicion) : '',
      observaciones: obs, motivo: String(p0.motivo || ''),
      lineas: items, totalUnidades: totalUnidades
    }
  };
  if (conPrecios) salida.remito.total = total;
  return salida;
}
