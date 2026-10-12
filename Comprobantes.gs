//Comprobantes.gs
// ═══════════════════════════════════════════════════════════════
// ✅ ARCHIVO NUEVO — se agrega como pestaña nueva del proyecto de Apps Script
//    (Archivos → + → Script → pegar todo esto, nombre "Comprobantes").
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Comprobantes de compra (foto o PDF)
// ---------------------------------------------------------------
// Qué hace: guarda la foto/PDF de la factura o remito de una compra en una
// carpeta de Google Drive y deja el enlace anotado en la hoja "Comprobantes
// Compras" (una fila por archivo, con el número de compra).
//
//   Carpeta: «AÑAÑAI · Comprobantes de compras» (se crea sola la primera vez, en
//            el Drive de quien publicó la web app), con una subcarpeta por mes
//            (2026-10, 2026-11…). Cada archivo se llama
//            «COM-… · Proveedor · n.jpg».
//   Privacidad: los archivos quedan PRIVADOS (solo los ve el dueño del Drive). Si
//            otra persona tiene que abrirlos, se comparte la carpeta con ella
//            desde Drive. No se publica nada con enlace abierto.
//
// PRIMERA VEZ (una sola): como este archivo usa Google Drive, Apps Script pide
// un permiso nuevo. En el editor, elegir la función «autorizarDrive» y tocar
// Ejecutar → Revisar permisos → Permitir. Después, Implementar → Administrar
// implementaciones → ✏️ → Nueva versión.
//
// DE QUÉ DEPENDE (ya existe): _requiereRol_, _conLock_, _sanTxt_, _norm,
// ensureHojaComprasInsumos_, ENCABEZADOS_COMPRAS_INSUMOS, estiloHeader, DATA_ROW.
// ═══════════════════════════════════════════════════════════════

var H_COMPROBANTES = 'Comprobantes Compras';
var ENCABEZADOS_COMPROBANTES = ['Fecha', 'Compra', 'Proveedor', 'Archivo', 'Tipo', 'KB', 'ID Drive', 'Enlace', 'Usuario'];
var CARPETA_COMPROBANTES = 'AÑAÑAI · Comprobantes de compras';
var PROP_CARPETA_COMPROBANTES = 'COMPROBANTES_CARPETA_ID';
var MAX_BYTES_COMPROBANTE = 6 * 1024 * 1024; // 6 MB ya decodificado
var MAX_COMPROBANTES_POR_COMPRA = 10;
var TIPOS_COMPROBANTE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

// Se ejecuta a mano UNA vez desde el editor para conceder el permiso de Drive.
function autorizarDrive() {
  var carpeta = _carpetaComprobantes_();
  Logger.log('✅ Drive autorizado. Carpeta de comprobantes: ' + carpeta.getUrl());
  return carpeta.getUrl();
}

function ensureHojaComprobantes_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_COMPROBANTES);
  if (!ws) {
    ws = ss.insertSheet(H_COMPROBANTES);
    ws.getRange('A1').setValue('AÑAÑAI · Comprobantes de compras — un archivo (foto/PDF) por fila, guardado en Drive. Se llena solo desde el panel de Compras, no editar a mano.');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_COMPROBANTES.length), '#5B3A29'); // Código.gs
    ws.getRange(2, 1, 1, ENCABEZADOS_COMPROBANTES.length).setValues([ENCABEZADOS_COMPROBANTES]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

// Carpeta raíz de comprobantes: se busca por el ID guardado y, si no está (o se
// borró), por nombre; si tampoco existe, se crea.
function _carpetaComprobantes_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_CARPETA_COMPROBANTES);
  if (id) {
    try {
      var c = DriveApp.getFolderById(id);
      if (!c.isTrashed()) return c;
    } catch (e) { /* si no se puede abrir, se busca/crea de nuevo */ }
  }
  var it = DriveApp.getFoldersByName(CARPETA_COMPROBANTES);
  var carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_COMPROBANTES);
  props.setProperty(PROP_CARPETA_COMPROBANTES, carpeta.getId());
  return carpeta;
}

function _subcarpetaMes_(raiz, fecha) {
  var nombre = Utilities.formatDate(fecha, 'America/Argentina/Buenos_Aires', 'yyyy-MM');
  var it = raiz.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : raiz.createFolder(nombre);
}

// Nombre de archivo seguro: sin barras ni caracteres raros, largo acotado.
function _nombreArchivoSeguro_(txt) {
  return String(txt == null ? '' : txt)
    .replace(/[\\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// Verifica que los primeros bytes del archivo correspondan al tipo declarado
// (evita guardar, por ejemplo, un HTML con extensión .jpg).
function _firmaCoincide_(bytes, mime) {
  function b(i) { return bytes[i] < 0 ? bytes[i] + 256 : bytes[i]; }
  if (!bytes || bytes.length < 12) return false;
  if (mime === 'image/jpeg') return b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF;
  if (mime === 'image/png') return b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47;
  if (mime === 'application/pdf') return b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46;
  if (mime === 'image/webp') return b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50;
  return false;
}

// Datos de la compra (proveedor, fecha) a partir del ledger. null si no existe.
function _compraPorId_(compraId) {
  var ws = ensureHojaComprasInsumos_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return null;
  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_COMPRAS_INSUMOS.length).getValues();
  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][1] || '').trim() === compraId) {
      return { compraId: compraId, proveedor: String(filas[i][9] || ''), fecha: filas[i][0] instanceof Date ? filas[i][0] : new Date() };
    }
  }
  return null;
}

// {compraId: [{nombre, url, tipo}]} — solo lee si la hoja existe.
function _comprobantesPorCompra_() {
  var out = {};
  var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_COMPROBANTES);
  if (!ws) return out;
  var last = ws.getLastRow();
  if (last < DATA_ROW) return out;
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_COMPROBANTES.length).getValues().forEach(function(r) {
    var id = String(r[1] || '').trim();
    var url = String(r[7] || '');
    if (!id || url.indexOf('https://') !== 0) return;
    if (!out[id]) out[id] = [];
    out[id].push({ nombre: String(r[3] || ''), url: url, tipo: String(r[4] || ''), id: String(r[6] || ''), kb: Number(r[5]) || 0 });
  });
  return out;
}

// ───────────────────────────────────────────────────────────────
// SUBIR UN COMPROBANTE
// ───────────────────────────────────────────────────────────────
// compraId: la compra ya registrada. nombreOriginal: solo informativo.
// mime: image/jpeg, image/png, image/webp o application/pdf.
// base64: contenido del archivo (sin el prefijo "data:...").
function subirComprobanteCompra(compraId, nombreOriginal, mime, base64, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  compraId = String(compraId || '').trim();
  mime = String(mime || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9-]{3,60}$/.test(compraId)) return { ok: false, mensaje: 'Número de compra inválido.' };
  if (!TIPOS_COMPROBANTE[mime]) return { ok: false, mensaje: 'Solo se aceptan fotos (JPG, PNG, WEBP) o PDF.' };
  if (typeof base64 !== 'string' || !base64) return { ok: false, mensaje: 'El archivo llegó vacío.' };
  if (base64.length > Math.ceil(MAX_BYTES_COMPROBANTE * 4 / 3) + 16) return { ok: false, mensaje: 'El archivo pesa demasiado (máximo 6 MB). Sacale la foto más chica o usá un PDF más liviano.' };

  var compra = _compraPorId_(compraId);
  if (!compra) return { ok: false, mensaje: 'No se encontró la compra ' + compraId + '.' };

  var bytes;
  try { bytes = Utilities.base64Decode(base64); }
  catch (e) { return { ok: false, mensaje: 'El archivo está dañado (no se pudo leer).' }; }
  if (!bytes || !bytes.length) return { ok: false, mensaje: 'El archivo llegó vacío.' };
  if (bytes.length > MAX_BYTES_COMPROBANTE) return { ok: false, mensaje: 'El archivo pesa demasiado (máximo 6 MB).' };
  if (!_firmaCoincide_(bytes, mime)) return { ok: false, mensaje: 'El contenido no coincide con el tipo de archivo (' + TIPOS_COMPROBANTE[mime].toUpperCase() + '). Probá sacando la foto de nuevo.' };

  var previos = _comprobantesPorCompra_()[compraId] || [];
  if (previos.length >= MAX_COMPROBANTES_POR_COMPRA) return { ok: false, mensaje: 'Esta compra ya tiene ' + MAX_COMPROBANTES_POR_COMPRA + ' comprobantes.' };

  var carpetaMes;
  try {
    var r1 = _conLock_(function() {
      var raiz = _carpetaComprobantes_();
      return { ok: true, carpeta: _subcarpetaMes_(raiz, compra.fecha) };
    });
    if (!r1.ok) return r1;
    carpetaMes = r1.carpeta;
  } catch (e) {
    return { ok: false, mensaje: 'No se pudo acceder a Google Drive. Falta autorizar el permiso: en el editor de Apps Script ejecutá la función «autorizarDrive» una vez y publicá una nueva versión. (' + e.message + ')' };
  }

  var ext = TIPOS_COMPROBANTE[mime];
  var n = previos.length + 1;
  var nombre = _nombreArchivoSeguro_(compraId + ' · ' + (compra.proveedor || 'sin proveedor') + ' · ' + n) + '.' + ext;
  var archivo;
  try {
    var blob = Utilities.newBlob(bytes, mime, nombre);
    archivo = carpetaMes.createFile(blob);
    try { archivo.setDescription('Comprobante de la compra ' + compraId + (nombreOriginal ? ' · original: ' + _nombreArchivoSeguro_(nombreOriginal) : '')); } catch (e2) {}
  } catch (e) {
    return { ok: false, mensaje: 'No se pudo guardar el archivo en Drive: ' + e.message };
  }

  var usuario = (chk.sesion && (chk.sesion.nombre || chk.sesion.rol)) || chk.rol || '';
  var url = archivo.getUrl();
  var reg = _conLock_(function() {
    var ws = ensureHojaComprobantes_();
    var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
    ws.getRange(fila, 1, 1, ENCABEZADOS_COMPROBANTES.length).setValues([[
      new Date(), compraId, _sanTxt_(compra.proveedor), _sanTxt_(nombre), mime, Math.round(bytes.length / 1024), archivo.getId(), url, _sanTxt_(usuario)
    ]]);
    return { ok: true };
  });
  if (!reg.ok) {
    // el archivo ya está en Drive, pero no quedó anotado: se avisa para reintentar
    return { ok: false, mensaje: 'El archivo se guardó en Drive pero no se pudo anotar en la planilla (' + reg.mensaje + '). Probá de nuevo.' };
  }
  return { ok: true, compraId: compraId, nombre: nombre, url: url, archivoId: archivo.getId(), tipo: mime, kb: Math.round(bytes.length / 1024),
    mensaje: '📎 Comprobante guardado en Drive (' + nombre + ').' };
}

function listarComprobantesCompra(compraId, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  return { ok: true, comprobantes: _comprobantesPorCompra_()[String(compraId || '').trim()] || [] };
}

// ───────────────────────────────────────────────────────────────
// VER / DESCARGAR UN COMPROBANTE DESDE EL PANEL (sin entrar a Drive)
// ───────────────────────────────────────────────────────────────
// El panel pide el archivo y el servidor (que sí tiene acceso a la carpeta de Drive) se lo
// devuelve en base64: así lo puede ver o descargar el Gerente aunque su cuenta de Google no
// tenga permiso sobre esos archivos. Solo entrega archivos que figuren en la hoja
// «Comprobantes Compras» para esa compra — nunca un ID de Drive cualquiera.
function obtenerComprobanteArchivo(compraId, idDrive, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  compraId = String(compraId || '').trim();
  idDrive = String(idDrive || '').trim();
  if (!/^[A-Za-z0-9-]{3,60}$/.test(compraId) || !/^[A-Za-z0-9_-]{3,120}$/.test(idDrive)) {
    return { ok: false, mensaje: 'Comprobante no válido.' };
  }
  var reg = (_comprobantesPorCompra_()[compraId] || []).filter(function(c) { return c.id === idDrive; })[0];
  if (!reg) return { ok: false, mensaje: 'Ese comprobante no figura en esa compra.' };
  try {
    var blob = DriveApp.getFileById(idDrive).getBlob();
    var bytes = blob.getBytes();
    if (!bytes || !bytes.length) return { ok: false, mensaje: 'El archivo está vacío.' };
    if (bytes.length > MAX_BYTES_COMPROBANTE + 1024) {
      return { ok: false, mensaje: 'El archivo es muy pesado para verlo acá. Abrilo desde Drive.' };
    }
    var mime = String(blob.getContentType() || reg.tipo || '').toLowerCase();
    if (!TIPOS_COMPROBANTE[mime]) mime = String(reg.tipo || '').toLowerCase();
    if (!TIPOS_COMPROBANTE[mime]) return { ok: false, mensaje: 'Tipo de archivo no reconocido.' };
    return { ok: true, nombre: reg.nombre, mime: mime, kb: Math.round(bytes.length / 1024), base64: Utilities.base64Encode(bytes) };
  } catch (e) {
    return { ok: false, mensaje: 'No se pudo leer el archivo de Drive. Si es la primera vez, ejecutá «autorizarDrive» en el editor y publicá una nueva versión. (' + e.message + ')' };
  }
}
