// Auth.gs
//═══════════════════════════════════════════════════════════════
// AÑAÑAI · Auth.gs
// Login por PIN de rol + identidad de sesión (token) para Pedidos
// ═══════════════════════════════════════════════════════════════
//
// MODELO: el PIN es por ROL (Vendedor / Gerente / Dueño / CFO), no por
// persona — decisión tomada porque hoy no hay un listado cerrado de
// vendedores. Para saber QUIÉN cargó cada pedido dentro del rol
// Vendedor, después de validar el PIN se le pide el nombre (texto libre
// con autocompletado contra la hoja "Vendedores", que se declara y
// crea en Pedidos.gs — este archivo depende de esa hoja existiendo).
// Gerente/Dueño/CFO son cada uno una sola persona, así que el rol ya
// alcanza como identidad — no se les pide nombre.
//
// SEGURIDAD: todas las funciones de Pedidos.gs que cambian estado
// reciben un "token" de sesión y llaman a _requiereRol_(token, [...])
// ANTES de tocar la hoja. Ocultar un botón en el HTML no es un control
// de acceso real — cualquiera con la URL puede llamar a cualquier
// función del proyecto desde la consola del navegador una vez que el
// Web App está desplegado como "Anyone" — así que la validación
// server-side es la que manda, no la interfaz.
//
// LIMITACIÓN CONOCIDA: CacheService tiene un techo de 6 horas por
// entrada — es lo que se usa acá para guardar la sesión. Pasado ese
// tiempo, el token vence y hay que volver a poner el PIN. Para el uso
// esperado (una jornada de trabajo) alcanza; si en el futuro hiciera
// falta sesiones más largas, habría que migrar a otro mecanismo.
//
// INSTALACIÓN:
//   1. Ejecutar inicializarAuth() UNA SOLA VEZ para fijar los PINs
//      default — CAMBIALOS antes de usar esto en producción real.
//   Corrélo desde el menú 🧾 AÑAÑAI Pedidos → 🔐 Inicializar Auth / PINs
//   dentro de la Hoja ya abierta, no desde el botón ▷ Ejecutar del
//   editor de Apps Script.
// ═══════════════════════════════════════════════════════════════

var ROLES_PEDIDOS   = ['vendedor', 'gerente', 'dueno', 'cfo'];
var SESSION_TTL_SEC = 6 * 60 * 60; // 6 horas — máximo que permite CacheService

// PINs default — SOLO para el primer arranque. Cambiarlos desde la
// pantalla de Config (rol CFO) o llamando cambiarPinRol() a mano.
var PIN_DEFAULT = { vendedor: '1111', gerente: '2222', dueno: '3333', cfo: '4444' };

// FIX: se reemplazó SpreadsheetApp.getUi().alert(...) por
// SpreadsheetApp.getActiveSpreadsheet().toast(...) — el alert()
// necesita getUi(), que se cuelga si la función se corre desde el
// editor de Apps Script en vez de desde un menú dentro de la Hoja
// abierta. toast() no depende de getUi() para nada.
function inicializarAuth() {
  var props = PropertiesService.getScriptProperties();
  ROLES_PEDIDOS.forEach(function(r) {
    if (!props.getProperty('PIN_' + r)) props.setProperty('PIN_' + r, PIN_DEFAULT[r]);
  });
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'PINs default seteados (vendedor 1111 · gerente 2222 · dueño 3333 · cfo 4444).\n\n'
    + '⚠ CAMBIALOS antes de usar esto en producción real — desde la pestaña ⚙ PINs '
    + 'dentro de Pedidos (rol CFO), o ejecutando cambiarPinRol(rol, token, pinNuevo) '
    + 'desde el editor de Apps Script.',
    '✅ Auth iniciado',
    8
  );
}

// ── LOGIN — paso 1 (todos los roles) ───────────────────────────
// Valida el PIN del rol elegido y crea una sesión. Para Vendedor, la
// sesión queda "incompleta" (sin nombre) hasta setVendedorNombre().
function loginPedidos(rol, pin) {
  rol = String(rol || '').toLowerCase();
  if (ROLES_PEDIDOS.indexOf(rol) === -1) return { ok: false, mensaje: 'Rol inválido.' };

  var props = PropertiesService.getScriptProperties();
  var pinGuardado = props.getProperty('PIN_' + rol);
  if (!pinGuardado) return { ok: false, mensaje: 'Auth no está inicializado todavía — avisá al CFO.' };
  if (String(pin).trim() !== pinGuardado) return { ok: false, mensaje: '❌ PIN incorrecto.' };

  var token = Utilities.getUuid();
  var sesion = { rol: rol, vendedor: null, creada: new Date().getTime() };
  CacheService.getScriptCache().put('SESION_' + token, JSON.stringify(sesion), SESSION_TTL_SEC);

  return {
    ok: true,
    token: token,
    rol: rol,
    requiereNombre: (rol === 'vendedor'),
    mensaje: '✅ Ingresaste como ' + _nombreRol_(rol)
  };
}

// ── LOGIN — paso 2 (solo Vendedor) ─────────────────────────────
// Asocia el nombre elegido/tipeado a la sesión ya autenticada, y lo
// agrega al padrón de autocompletado (hoja Vendedores) si es nuevo.
function setVendedorNombre(token, nombre) {
  var sesion = _leerSesion_(token);
  if (!sesion) return { ok: false, mensaje: 'Sesión inválida o vencida — volvé a ingresar el PIN.' };
  if (sesion.rol !== 'vendedor') return { ok: false, mensaje: 'Este paso es solo para el rol Vendedor.' };
  nombre = String(nombre || '').trim();
  if (!nombre) return { ok: false, mensaje: 'Ingresá un nombre.' };

  sesion.vendedor = nombre;
  CacheService.getScriptCache().put('SESION_' + token, JSON.stringify(sesion), SESSION_TTL_SEC);
  _agregarVendedorSiNuevo_(nombre);

  return { ok: true, mensaje: '✅ Hola, ' + nombre };
}

function getVendedoresSugeridos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(H_VENDEDORES); // declarada en Pedidos.gs
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .map(function(r) { return String(r[0]).trim(); })
    .filter(Boolean);
}

function _agregarVendedorSiNuevo_(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(H_VENDEDORES);
  if (!sh) return; // se crea en inicializarPedidos(); si no corrió todavía, no rompemos el login
  var existentes = getVendedoresSugeridos();
  // _norm() está definida en Código.gs (minúsculas + sin acentos + trim)
  var yaExiste = existentes.some(function(n) { return _norm(n) === _norm(nombre); });
  if (!yaExiste) sh.appendRow([nombre]);
}

// ── VALIDACIÓN DE SESIÓN Y PERMISOS ────────────────────────────
function _leerSesion_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('SESION_' + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// Uso:  var chk = _requiereRol_(token, ['gerente']); if (!chk.ok) return chk;
//       var sesion = chk.sesion;
// El CFO siempre pasa, sea cual sea la lista de roles permitidos —
// es el rol de administración total del sistema.
function _requiereRol_(token, rolesPermitidos) {
  var sesion = _leerSesion_(token);
  if (!sesion) return { ok: false, mensaje: '⛔ Sesión inválida o vencida. Volvé a ingresar tu PIN.' };
  if (sesion.rol === 'cfo') return { ok: true, sesion: sesion };
  if (rolesPermitidos.indexOf(sesion.rol) === -1) {
    return { ok: false, mensaje: '⛔ Esta acción no está disponible para el rol ' + _nombreRol_(sesion.rol) + '.' };
  }
  return { ok: true, sesion: sesion };
}

function _requiereCFO_(token) {
  var sesion = _leerSesion_(token);
  if (!sesion) return { ok: false, mensaje: '⛔ Sesión inválida o vencida.' };
  if (sesion.rol !== 'cfo') return { ok: false, mensaje: '⛔ Solo el CFO puede realizar esta acción.' };
  return { ok: true, sesion: sesion };
}

function _nombreRol_(rol) {
  return { vendedor: 'Vendedor', gerente: 'Gerente', dueno: 'Dueño', cfo: 'CFO' }[rol] || rol;
}

// ── ADMIN DE PINES — exclusivo CFO ─────────────────────────────
function cambiarPinRol(rolAModificar, token, pinNuevo) {
  var chk = _requiereCFO_(token);
  if (!chk.ok) return chk;
  rolAModificar = String(rolAModificar || '').toLowerCase();
  if (ROLES_PEDIDOS.indexOf(rolAModificar) === -1) return { ok: false, mensaje: 'Rol inválido.' };
  if (!pinNuevo || String(pinNuevo).trim().length < 4) return { ok: false, mensaje: 'El PIN debe tener al menos 4 caracteres.' };
  PropertiesService.getScriptProperties().setProperty('PIN_' + rolAModificar, String(pinNuevo).trim());
  return { ok: true, mensaje: '✅ PIN de ' + _nombreRol_(rolAModificar) + ' actualizado.' };
}
