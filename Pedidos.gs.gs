// Pedidos.gs
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Pedidos.gs
// Módulo de Pedidos — capa previa a Despachos, con aprobación del gerente
// ═══════════════════════════════════════════════════════════════
//
// FLUJO: Vendedor/Gerente/Dueño/CFO cargan un pedido (Estado=Pendiente,
// precio ya definido en este paso, fecha estimada de despacho
// OBLIGATORIA) → Gerente/CFO lo Acepta (=aviso a producción) o lo
// Rechaza (con motivo) → una vez Aceptado, Gerente/CFO lo puede
// Cancelar (con motivo) o marcarlo Terminado → desde Terminado,
// Gerente/CFO lo puede seguir Cancelando o marcarlo Entregado, lo que
// recién ahí genera el Despacho real (reutiliza guardarDespacho() de
// Código.gs — mismo DES-ID, mismo descuento de stock, misma lógica de
// "sin stock suficiente" que ya existe hoy).
//
// TODAS las transiciones de estado están gateadas estrictamente a
// Gerente y CFO — por decisión explícita: ni el Dueño ni el Vendedor
// pueden aprobar, rechazar, cancelar ni marcar avances, aunque ambos
// puedan cargar pedidos nuevos.
//
// Un pedido puede tener varias líneas (varios productos para el mismo
// cliente en una sola carga) — comparten un "Grupo" para poder
// aceptarse/rechazarse/etc. todas juntas, igual que un carrito. La
// fecha estimada de despacho es UNA por Grupo (no por línea): se pide
// una sola vez al cargar el pedido y se replica en todas sus líneas.
//
// CONCURRENCIA: las funciones que escriben en la hoja están envueltas
// en LockService (ver _conLock_) para que dos ejecuciones simultáneas
// no pisen el mismo PED-ID ni la misma fila — es la misma clase de bug
// que generó los DES-ID duplicados en Despachos. OJO: esto protege las
// escrituras que pasan por ESTE archivo, pero marcarEntregado() llama
// a guardarDespacho() de Código.gs, que hoy NO tiene el mismo lock —
// ver la nota aparte sobre el patch opcional para ese archivo.
//
// INSTALACIÓN (además de Auth.gs):
//   1. Ejecutar inicializarPedidos() UNA SOLA VEZ.
//   2. Agregar pedidosOnOpen(); dentro del onOpen() de Código.gs.
//   3. Agregar el branch page==='pedidos' a doGet() de Código.gs.
//   (ambos patches, tal cual, en el mensaje de chat que acompaña esto)
//
// IMPORTANTE — cómo correr inicializarPedidos()/inicializarAuth():
//   Corrélas SIEMPRE desde el menú 🧾 AÑAÑAI Pedidos dentro de la Hoja
//   ya abierta (no desde el botón ▷ Ejecutar del editor de Apps
//   Script). Ninguna de las dos usa SpreadsheetApp.getUi() — usan
//   toast(), que no lo necesita — pero correrlas desde el editor sigue
//   siendo menos confiable en general para funciones ligadas a Sheets.
//
// IMPORTANTE — orden de columnas de la hoja "Pedidos":
//   Todo el código direcciona columnas por nombre simbólico (el objeto
//   PC de abajo), nunca por posición visual. Está bien agregar columnas
//   nuevas al FINAL (como se hizo con Fecha Estimada Despacho), pero
//   NUNCA arrastrar/reordenar columnas a mano desde la interfaz de
//   Google Sheets — eso rompe la correspondencia entre PC y la
//   posición real, silenciosamente.
// ═══════════════════════════════════════════════════════════════

var H_PEDIDOS    = 'Pedidos';
var H_VENDEDORES = 'Vendedores';
var PED_DATA_ROW = 3;

var PED_ESTADOS = {
  PENDIENTE: 'Pendiente',
  ACEPTADO:  'Aceptado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
  TERMINADO: 'Terminado',
  ENTREGADO: 'Entregado',
  REVERTIDO: 'Revertido'
};

// Columnas (1-indexed) — mismo criterio que Despachos: fila 1 título,
// fila 2 headers, PED_DATA_ROW=3 en adelante. FECHA_ESTIMADA se agregó
// al final a propósito, para no correr los índices de las columnas
// preexistentes (ver nota de "orden de columnas" arriba).
var PC = {
  ID: 1, GRUPO: 2, FECHA: 3, CLI_ID: 4, CLIENTE: 5, PRODUCTO: 6, VARIANTE: 7,
  UNIDAD: 8, UNIDADES: 9, PRECIO: 10, PRECIO_TIPO: 11, MONTO: 12, CONDICION: 13,
  ESTADO: 14, VENDEDOR: 15, MOTIVO: 16, EDITADO: 17, LOG: 18, DES_ID: 19,
  FECHA_CARGA: 20, ULT_ACT: 21, OBS: 22, FECHA_ESTIMADA: 23
};
var PED_NUM_COLS = 23;

// ════════════════════════════════════════════════════════════════
// MENÚ E INICIALIZACIÓN
// ════════════════════════════════════════════════════════════════
function pedidosOnOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧾 AÑAÑAI Pedidos')
    .addItem('⚙ Inicializar módulo Pedidos (1° vez)', 'inicializarPedidos')
    .addItem('🔐 Inicializar Auth / PINs (1° vez)', 'inicializarAuth')
    .addToUi();
}

// FIX: se sacó "var ui = SpreadsheetApp.getUi();" — era vestigial (venía
// del ui.alert() original) y quedó colgando la ejecución cuando se corre
// desde el editor de Apps Script en vez de desde el menú de la Hoja.
// toast() no necesita getUi() para nada.
function inicializarPedidos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(H_PEDIDOS)) crearHojaPedidos(ss);

  if (!ss.getSheetByName(H_VENDEDORES)) {
    var sh = ss.insertSheet(H_VENDEDORES);
    sh.getRange(1, 1).setValue('Nombre').setFontWeight('bold');
    sh.setColumnWidth(1, 200);
    sh.hideSheet();
  }

  ss.toast(
    'Hoja "Pedidos" creada (y "Vendedores", oculta, para el autocompletado).\n\n'
    + 'Recordá también ejecutar inicializarAuth() si todavía no lo hiciste, '
    + 'aplicar los 2 patches a Código.gs (onOpen y doGet), y volver a desplegar '
    + 'el Web App para que ?page=pedidos quede accesible.',
    '✅ Módulo Pedidos iniciado',
    8
  );
}

function crearHojaPedidos(ss) {
  var ws = ss.insertSheet(H_PEDIDOS);
  ws.getRange('A1').setValue('AÑAÑAI · Pedidos — capa previa a Despachos, no editar a mano salvo Estado/Obs');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['PED-ID','Grupo','Fecha','CLI-ID','Cliente','Producto','Variante','Unidad','Unidades',
              'Precio Unit ($)','Precio Tipo','Monto Total ($)','Condición','Estado','Vendedor',
              'Motivo','Editado','Log ediciones','DES-ID generado','Fecha carga','Última actualización',
              'Obs','Fecha Estimada Despacho'];
  var rng = ws.getRange(2, 1, 1, hdrs.length);
  rng.setBackground('#2F5496').setFontColor('#FFFFFF').setFontWeight('bold')
     .setHorizontalAlignment('center').setWrap(true);
  ws.getRange(2, 1, 1, hdrs.length).setValues([hdrs]);
  ws.setRowHeight(2, 34);

  var widths = [90,100,90,80,180,160,110,90,80,100,100,110,90,100,120,220,70,260,100,140,150,200,140];
  widths.forEach(function(w, i) { ws.setColumnWidth(i + 1, w); });
  ws.setFrozenRows(2);
  ws.setFrozenColumns(2);
  return ws;
}

// ── Lock helper — ver nota de concurrencia arriba ──────────────
function _conLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { ok: false, mensaje: '⏳ El sistema está ocupado procesando otro cambio — probá de nuevo en unos segundos.' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// Arma un Date a partir de "YYYY-MM-DD" (lo que manda un <input type="date">)
// usando los componentes LOCALES, no UTC. "new Date('YYYY-MM-DD')" se
// interpreta como medianoche UTC, lo que con el huso de Argentina
// (UTC-3) corre la fecha un día para atrás al formatearla — este
// helper evita ese corrimiento.
function _parsearFechaLocal_(str) {
  if (!str) return null;
  var partes = String(str).trim().split('-');
  if (partes.length !== 3) return null;
  var y = Number(partes[0]), m = Number(partes[1]), d = Number(partes[2]);
  if (!y || !m || !d) return null;
  var fecha = new Date(y, m - 1, d);
  return isNaN(fecha.getTime()) ? null : fecha;
}

// ════════════════════════════════════════════════════════════════
// CREAR PEDIDO — Vendedor, Gerente, Dueño o CFO
// ════════════════════════════════════════════════════════════════
// items: [{cliId, clienteNombre, producto, variante, unidad, unidades,
//          precio, precioTipo, condicion, obs}, ...] — todas las líneas
// de un mismo envío comparten un "Grupo" para gestionarse juntas.
// fechaEstimada: string "YYYY-MM-DD" — OBLIGATORIA, una sola para todo
// el pedido (no por línea/producto).
function crearPedido(items, fechaEstimada, token) {
  var chk = _requiereRol_(token, ['vendedor', 'gerente', 'dueno']);
  if (!chk.ok) return chk;
  var sesion = chk.sesion;

  if (!items || !items.length) return { ok: false, mensaje: 'El pedido no tiene ítems.' };

  var fechaEstDate = _parsearFechaLocal_(fechaEstimada);
  if (!fechaEstDate) return { ok: false, mensaje: 'Falta indicar la fecha estimada de despacho.' };

  var vendedorLabel = sesion.rol === 'vendedor' ? sesion.vendedor : _nombreRol_(sesion.rol);
  if (sesion.rol === 'vendedor' && !sesion.vendedor) {
    return { ok: false, mensaje: 'Falta elegir tu nombre antes de cargar un pedido.' };
  }

  return _conLock_(function() {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var hoja  = ss.getSheetByName(H_PEDIDOS);
    var TZ    = 'America/Argentina/Buenos_Aires';
    var grupo = 'GRP-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss');
    var fecha = new Date();
    var ids   = [];

    items.forEach(function(it) {
      var unidades = Number(it.unidades);
      var precio   = Number(it.precio);
      if (!it.cliId || !it.producto || !unidades || !precio) return; // ítem incompleto: se ignora

      var fila  = Math.max(hoja.getLastRow() + 1, PED_DATA_ROW);
      var pedId = genId('PED-', H_PEDIDOS); // definida en Código.gs
      var monto = unidades * precio;

      var row = [];
      row[PC.ID-1]=pedId; row[PC.GRUPO-1]=grupo; row[PC.FECHA-1]=fecha;
      row[PC.CLI_ID-1]=it.cliId; row[PC.CLIENTE-1]=it.clienteNombre;
      row[PC.PRODUCTO-1]=it.producto; row[PC.VARIANTE-1]=it.variante||'';
      row[PC.UNIDAD-1]=it.unidad||''; row[PC.UNIDADES-1]=unidades;
      row[PC.PRECIO-1]=precio; row[PC.PRECIO_TIPO-1]=it.precioTipo||'';
      row[PC.MONTO-1]=monto; row[PC.CONDICION-1]=it.condicion||'Crédito';
      row[PC.ESTADO-1]=PED_ESTADOS.PENDIENTE; row[PC.VENDEDOR-1]=vendedorLabel;
      row[PC.MOTIVO-1]=''; row[PC.EDITADO-1]='No'; row[PC.LOG-1]='';
      row[PC.DES_ID-1]=''; row[PC.FECHA_CARGA-1]=fecha; row[PC.ULT_ACT-1]=fecha;
      row[PC.OBS-1]=it.obs||''; row[PC.FECHA_ESTIMADA-1]=fechaEstDate;

      hoja.getRange(fila, 1, 1, row.length).setValues([row]);
      hoja.getRange(fila, PC.FECHA).setNumberFormat('DD/MM/YYYY');
      hoja.getRange(fila, PC.PRECIO).setNumberFormat('$#,##0');
      hoja.getRange(fila, PC.MONTO).setNumberFormat('$#,##0');
      hoja.getRange(fila, PC.FECHA_CARGA).setNumberFormat('DD/MM/YYYY HH:mm');
      hoja.getRange(fila, PC.ULT_ACT).setNumberFormat('DD/MM/YYYY HH:mm');
      hoja.getRange(fila, PC.FECHA_ESTIMADA).setNumberFormat('DD/MM/YYYY');

      ids.push(pedId);
    });

    if (!ids.length) return { ok: false, mensaje: 'Ningún ítem tenía los datos completos (cliente, producto, unidades y precio).' };

    return { ok: true, grupo: grupo, ids: ids, mensaje: '✅ Pedido ' + grupo + ' cargado — ' + ids.length + ' línea(s), a la espera de aprobación del gerente.' };
  });
}

// ════════════════════════════════════════════════════════════════
// LECTURA — listar pedidos según lo que puede ver cada rol
// ════════════════════════════════════════════════════════════════
function listarPedidos(token) {
  var chk = _requiereRol_(token, ['vendedor', 'gerente', 'dueno']);
  if (!chk.ok) return chk;
  var sesion = chk.sesion;

  var todos = _leerTodosPedidos_();
  var visibles;

  if (sesion.rol === 'vendedor') {
    // Ve: pedidos Aceptados (pendientes de ser enviados) de cualquier
    // vendedor, + todos SUS PROPIOS pedidos en cualquier estado (para
    // poder hacer seguimiento de lo que cargó).
    visibles = todos.filter(function(p) {
      return p.estado === PED_ESTADOS.ACEPTADO || p.vendedor === sesion.vendedor;
    });
  } else {
    // Gerente, Dueño y CFO ven todo.
    visibles = todos;
  }

  visibles.sort(function(a, b) { return a.grupo < b.grupo ? 1 : -1; }); // más nuevos primero
  return { ok: true, pedidos: visibles };
}

function _leerTodosPedidos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(H_PEDIDOS);
  if (!hoja || hoja.getLastRow() < PED_DATA_ROW) return [];
  var n = hoja.getLastRow() - PED_DATA_ROW + 1;
  var raw = hoja.getRange(PED_DATA_ROW, 1, n, PED_NUM_COLS).getValues();
  var TZ = 'America/Argentina/Buenos_Aires';
  return raw.map(function(r, idx) {
    return {
      fila: PED_DATA_ROW + idx,
      id: r[PC.ID-1], grupo: r[PC.GRUPO-1],
      fecha: r[PC.FECHA-1] instanceof Date ? Utilities.formatDate(r[PC.FECHA-1], TZ, 'dd/MM/yyyy') : '',
      cliId: r[PC.CLI_ID-1], cliente: r[PC.CLIENTE-1],
      producto: r[PC.PRODUCTO-1], variante: r[PC.VARIANTE-1], unidad: r[PC.UNIDAD-1],
      unidades: r[PC.UNIDADES-1], precio: r[PC.PRECIO-1], precioTipo: r[PC.PRECIO_TIPO-1],
      monto: r[PC.MONTO-1], condicion: r[PC.CONDICION-1], estado: r[PC.ESTADO-1],
      vendedor: r[PC.VENDEDOR-1], motivo: r[PC.MOTIVO-1], editado: r[PC.EDITADO-1],
      log: r[PC.LOG-1], desId: r[PC.DES_ID-1], obs: r[PC.OBS-1],
      fechaEstimada: r[PC.FECHA_ESTIMADA-1] instanceof Date ? Utilities.formatDate(r[PC.FECHA_ESTIMADA-1], TZ, 'dd/MM/yyyy') : ''
    };
  }).filter(function(p) { return p.id; });
}

// ════════════════════════════════════════════════════════════════
// TRANSICIONES DE ESTADO — estrictamente Gerente y CFO
// ════════════════════════════════════════════════════════════════
function aceptarPedido(grupo, token) {
  return _cambiarEstadoGrupo_(grupo, token, [PED_ESTADOS.PENDIENTE], PED_ESTADOS.ACEPTADO, null);
}

function rechazarPedido(grupo, motivo, token) {
  if (!motivo || !motivo.trim()) return { ok: false, mensaje: 'El motivo es obligatorio para rechazar un pedido.' };
  return _cambiarEstadoGrupo_(grupo, token, [PED_ESTADOS.PENDIENTE], PED_ESTADOS.RECHAZADO, motivo);
}

function cancelarPedido(grupo, motivo, token) {
  if (!motivo || !motivo.trim()) return { ok: false, mensaje: 'El motivo es obligatorio para cancelar un pedido.' };
  return _cambiarEstadoGrupo_(grupo, token, [PED_ESTADOS.ACEPTADO, PED_ESTADOS.TERMINADO], PED_ESTADOS.CANCELADO, motivo);
}

function marcarTerminado(grupo, token) {
  return _cambiarEstadoGrupo_(grupo, token, [PED_ESTADOS.ACEPTADO], PED_ESTADOS.TERMINADO, null);
}

function _cambiarEstadoGrupo_(grupo, token, estadosOrigenValidos, estadoDestino, motivo) {
  var chk = _requiereRol_(token, ['gerente']); // CFO pasa igual por el bypass de _requiereRol_
  if (!chk.ok) return chk;

  return _conLock_(function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_PEDIDOS);
    var lineas = _leerTodosPedidos_().filter(function(p) { return p.grupo === grupo; });
    if (!lineas.length) return { ok: false, mensaje: 'Grupo de pedido no encontrado.' };

    var invalidas = lineas.filter(function(p) { return estadosOrigenValidos.indexOf(p.estado) === -1; });
    if (invalidas.length) {
      return { ok: false, mensaje: '⛔ No se puede pasar a "' + estadoDestino + '": '
        + invalidas.map(function(p){return p.id+' está en '+p.estado;}).join(', ') };
    }

    var ahora = new Date();
    lineas.forEach(function(p) {
      hoja.getRange(p.fila, PC.ESTADO).setValue(estadoDestino);
      if (motivo) hoja.getRange(p.fila, PC.MOTIVO).setValue(motivo);
      hoja.getRange(p.fila, PC.ULT_ACT).setValue(ahora).setNumberFormat('DD/MM/YYYY HH:mm');
    });

    return { ok: true, mensaje: '✅ Pedido ' + grupo + ' → ' + estadoDestino + ' (' + lineas.length + ' línea/s).' };
  });
}

// Marcar Entregado genera el Despacho real — reutiliza guardarDespacho()
// de Código.gs línea por línea, así el stock, el DES-ID y la lógica de
// "sin stock suficiente" quedan idénticos a un despacho cargado directo
// desde el formulario existente.
//
// MÉTODO DE COBRO: se confirma/define ACÁ, en el momento de la entrega
// — es cuando se sabe de verdad cómo paga el cliente. condicionConfirmada
// pisa lo que se haya pactado (o no) al cargar el pedido — el pedido
// puede haber quedado en "A definir" y acá se resuelve, sin excepción:
// toda entrega termina siendo Contado o Crédito. Si es Contado,
// formaPago es obligatoria y el sistema genera AUTOMÁTICAMENTE la fila
// en Cobros (reutilizando guardarCobro() de Código.gs), con las
// DES-IDs cubiertos apuntando exactamente a los despachos de ESTE
// pedido — así no depende de que alguien lo cargue a mano después.
//
// OJO — esto es exclusivo del flujo Pedidos: guardarDespacho() y
// guardarCobro() en Código.gs NO se tocaron, así que el sidebar manual
// de Despacho sigue funcionando exactamente igual que antes, sin
// auto-cobro. La limitación conocida de guardarCobro() (solo marca
// 'Cobrado' en despachos con Condición='Crédito', nunca en Contado —
// el mismo bug que motiva repararCxCContado() en Código.gs) se
// resuelve acá aparte, con _marcarDespachosComoCobrados_, sin tocar
// esa función compartida.
function marcarEntregado(grupo, condicionConfirmada, formaPago, referenciaPago, token) {
  var chk = _requiereRol_(token, ['gerente']);
  if (!chk.ok) return chk;

  condicionConfirmada = (String(condicionConfirmada||'').trim() === 'Contado') ? 'Contado' : 'Crédito';
  if (condicionConfirmada === 'Contado' && (!formaPago || !String(formaPago).trim())) {
    return { ok: false, mensaje: 'Falta indicar la forma de pago para confirmar la entrega como Contado.' };
  }

  return _conLock_(function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_PEDIDOS);
    var lineas = _leerTodosPedidos_().filter(function(p) { return p.grupo === grupo; });
    if (!lineas.length) return { ok: false, mensaje: 'Grupo de pedido no encontrado.' };

    var noTerminadas = lineas.filter(function(p) { return p.estado !== PED_ESTADOS.TERMINADO; });
    if (noTerminadas.length) {
      return { ok: false, mensaje: '⛔ Todas las líneas tienen que estar en "Terminado" antes de entregar. Faltan: '
        + noTerminadas.map(function(p){return p.id;}).join(', ') };
    }

    var resultados = [];
    var montoContado = 0;
    var desIdsContado = [];
    lineas.forEach(function(p) {
      var r = guardarDespacho({ // definida en Código.gs — misma lógica que el despacho manual
        cliId: p.cliId, clienteNombre: p.cliente, producto: p.producto, variante: p.variante,
        unidad: p.unidad, unidades: p.unidades, precio: p.precio, precioTipo: p.precioTipo,
        condicion: condicionConfirmada, obs: (p.obs || '') + ' · origen ' + p.id,
        forzarSinStock: false, motivoForzado: ''
      });
      resultados.push({ pedId: p.id, ok: r.ok, desId: r.desId, monto: r.monto, mensaje: r.mensaje });
      if (r.ok) {
        hoja.getRange(p.fila, PC.ESTADO).setValue(PED_ESTADOS.ENTREGADO);
        hoja.getRange(p.fila, PC.DES_ID).setValue(r.desId);
        hoja.getRange(p.fila, PC.CONDICION).setValue(condicionConfirmada); // confirma/pisa lo pactado en el pedido
        hoja.getRange(p.fila, PC.ULT_ACT).setValue(new Date()).setNumberFormat('DD/MM/YYYY HH:mm');
        if (condicionConfirmada === 'Contado') {
          montoContado += (Number(r.monto) || 0);
          desIdsContado.push(r.desId);
        }
      }
    });

    var fallidas = resultados.filter(function(x) { return !x.ok; });
    if (fallidas.length) {
      return {
        ok: false, parcial: true, resultados: resultados,
        mensaje: '⚠ ' + (resultados.length - fallidas.length) + ' de ' + resultados.length
          + ' línea(s) se despacharon. Revisá manualmente: '
          + fallidas.map(function(x){return x.pedId+' — '+x.mensaje;}).join(' · ')
      };
    }

    var mensaje = '✅ Pedido entregado — se generaron ' + resultados.length + ' despacho(s).';

    if (condicionConfirmada === 'Contado' && desIdsContado.length) {
      var p0 = lineas[0];
      var cobroRes = guardarCobro({ // definida en Código.gs — misma función que el sidebar de Cobros
        cliId: p0.cliId, clienteNombre: p0.cliente,
        monto: montoContado, descuento: 0,
        formaPago: formaPago, referencia: referenciaPago || '',
        caja: 'Distribuidora', desIds: desIdsContado.join(', '),
        obs: 'Auto-generado al entregar pedido ' + grupo
      });
      if (cobroRes.ok) {
        // guardarCobro() no marca 'Cobrado' despachos Contado (ver nota arriba) — se completa acá.
        _marcarDespachosComoCobrados_(desIdsContado);
        mensaje += ' 💰 Cobro ' + cobroRes.cobId + ' registrado automáticamente por $' + montoContado.toLocaleString('es-AR') + '.';
      } else {
        mensaje += ' ⚠ Los despachos se guardaron bien pero el cobro automático falló: ' + cobroRes.mensaje + ' — cargalo a mano en Cobros.';
      }
    }

    return { ok: true, resultados: resultados, mensaje: mensaje };
  });
}

// Fuerza Estado='Cobrado' en Despachos para los DES-IDs recibidos.
// Existe porque guardarCobro() (Código.gs) SOLO marca 'Cobrado' cuando
// la Condición del despacho es 'Crédito' — nunca en Contado (el mismo
// límite que motiva repararCxCContado()). No toca guardarCobro().
function _marcarDespachosComoCobrados_(desIds) {
  if (!desIds || !desIds.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hDes = ss.getSheetByName(H_DESPACHOS);
  var last = hDes.getLastRow();
  if (last < DATA_ROW) return;
  var ids = hDes.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (desIds.indexOf(String(ids[i][0]).trim()) > -1) {
      hDes.getRange(DATA_ROW + i, 13).setValue('Cobrado'); // col 13 = Estado en Despachos
    }
  }
}

// ════════════════════════════════════════════════════════════════
// REVERTIR UN PEDIDO ENTREGADO — exclusivo CFO (más restrictivo que
// el resto, que es Gerente+CFO, porque acá se deshace stock + despacho
// + CXC de una). Línea por línea: 1) devuelve el stock (vía el mismo
// mecanismo de "corrección" que usa deshacerMovimientoStock() en
// Producción.gs), 2) anula el despacho (Estado='Anulado', no se
// borra), 3) pasa el pedido a Estado='Revertido'.
//
// PRE-CHEQUEO TODO O NADA antes de tocar cualquier cosa: si algún
// despacho del grupo está 'Cobrado', se bloquea TODO el revert — salvo
// un caso puntual y seguro: que ese cobro sea el que este mismo
// sistema generó automáticamente al entregar (marcarEntregado(), acá
// arriba) para ESTE grupo. Ese caso es identificable sin ambigüedad
// (marca fija en Obs del Cobro) y cubre exactamente los DES-ID de este
// grupo — nunca despachos de otro pedido. Ahí sí es seguro deshacer
// despacho + cobro juntos. Cualquier otro caso (cobro cargado a mano,
// datos viejos de antes de esta funcionalidad) sigue bloqueado como
// siempre: esa es una decisión de plata que tiene que tomar una
// persona.
//
// Si una línea falla a mitad de camino, se corta ahí (no sigue con las
// demás) — a diferencia de marcarEntregado(), que sí sigue y reporta
// parcial. Acá preferí ser conservador: es una acción rara y sensible,
// mejor pararse en seco y que se revise a mano que las anteriores ya
// se revirtieron bien.
// ════════════════════════════════════════════════════════════════
function revertirPedido(grupo, motivo, token) {
  var chk = _requiereCFO_(token); // Auth.gs — exclusivo CFO
  if (!chk.ok) return chk;
  if (!motivo || !motivo.trim()) return { ok: false, mensaje: 'El motivo es obligatorio para revertir un pedido.' };

  return _conLock_(function() {
    var lineas = _leerTodosPedidos_().filter(function(p) { return p.grupo === grupo; });
    if (!lineas.length) return { ok: false, mensaje: 'Grupo de pedido no encontrado.' };

    var noEntregadas = lineas.filter(function(p) { return p.estado !== PED_ESTADOS.ENTREGADO; });
    if (noEntregadas.length) {
      return { ok: false, mensaje: '⛔ Solo se puede revertir un pedido Entregado. No lo están: '
        + noEntregadas.map(function(p){return p.id+' está en '+p.estado;}).join(', ') };
    }
    var sinDesId = lineas.filter(function(p) { return !p.desId; });
    if (sinDesId.length) {
      return { ok: false, mensaje: '⛔ Faltan DES-ID en: ' + sinDesId.map(function(p){return p.id;}).join(', ') };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_PEDIDOS);
    var hDes = ss.getSheetByName(H_DESPACHOS);
    var lastD = hDes.getLastRow();
    var infoDespachos = {};
    if (lastD >= DATA_ROW) {
      hDes.getRange(DATA_ROW, 1, lastD - DATA_ROW + 1, 13).getValues().forEach(function(r) {
        infoDespachos[String(r[0]).trim()] = { condicion: String(r[11] || '').trim(), estado: String(r[12] || '').trim() };
      });
    }

    var cobroAuto = _buscarCobroAutoGenerado_(grupo); // null si no existe

    // ── pre-chequeo: nada se toca hasta confirmar que TODO el grupo es seguro ──
    var bloqueos = [];
    lineas.forEach(function(p) {
      var info = infoDespachos[p.desId];
      if (!info) { bloqueos.push(p.desId + ': no se encontró en Despachos.'); return; }
      if (info.estado === 'Cobrado') {
        var cubiertoPorAuto = cobroAuto && cobroAuto.desIds.indexOf(p.desId) > -1;
        if (!cubiertoPorAuto) {
          bloqueos.push(p.desId + ' ya está Cobrado (y no es un cobro auto-generado por este sistema para este pedido) — hay que resolver la plata a mano primero.');
        }
      }
    });
    if (bloqueos.length) {
      return { ok: false, mensaje: '⛔ No se puede revertir: ' + bloqueos.join(' · ') };
    }

    // ── a partir de acá, todo lo que se toca ya está validado como seguro ──
    if (cobroAuto) {
      _anularCobro_(cobroAuto.fila, 'revertido junto con pedido ' + grupo + ' — ' + motivo);
    }

    var resultados = [];
    for (var i = 0; i < lineas.length; i++) {
      var p = lineas[i];
      var resStock = _revertirStockDeDespacho_(p.desId, p.producto, p.variante, Number(p.unidades) || 0, grupo, motivo);
      if (!resStock.ok) {
        return { ok: false, parcial: resultados, mensaje: '⛔ ' + p.desId + ': ' + resStock.mensaje + ' — no se tocó nada de esta línea en adelante, revisá a mano las anteriores'
          + (cobroAuto ? ' (el cobro ' + cobroAuto.cobId + ' ya quedó anulado, ojo con eso también)' : '') + '.' };
      }
      var resDesp = _anularDespacho_(p.desId, 'Revertido desde pedido ' + grupo + ' — ' + motivo);
      if (!resDesp.ok) {
        return { ok: false, parcial: resultados, mensaje: '⛔ ' + p.desId + ': ' + resDesp.mensaje + ' — el stock de esta línea YA se devolvió, revisalo a mano.' };
      }

      hoja.getRange(p.fila, PC.ESTADO).setValue(PED_ESTADOS.REVERTIDO);
      hoja.getRange(p.fila, PC.MOTIVO).setValue(motivo);
      hoja.getRange(p.fila, PC.ULT_ACT).setValue(new Date()).setNumberFormat('DD/MM/YYYY HH:mm');
      resultados.push(p.desId);
    }

    var mensaje = '✅ Pedido ' + grupo + ' revertido — ' + resultados.length + ' despacho(s) anulado(s), stock devuelto.';
    if (cobroAuto) mensaje += ' Cobro ' + cobroAuto.cobId + ' anulado también.';
    return { ok: true, mensaje: mensaje, desIds: resultados };
  });
}

// Busca en Cobros un registro auto-generado por marcarEntregado() para
// ESTE grupo puntual (marca fija en Obs). Devuelve null si no existe —
// eso es lo normal para Crédito, o para Contado cargado antes de esta
// funcionalidad.
function _buscarCobroAutoGenerado_(grupo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hCob = ss.getSheetByName(H_COBROS);
  var last = hCob.getLastRow();
  if (last < DATA_ROW) return null;
  var marcador = 'Auto-generado al entregar pedido ' + grupo;
  var raw = hCob.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 11).getValues(); // hasta col 11 = Obs
  for (var i = 0; i < raw.length; i++) {
    var obs = String(raw[i][10] || '');
    if (obs.indexOf(marcador) > -1 && obs.indexOf('ANULADO') === -1) {
      return {
        fila: DATA_ROW + i,
        cobId: raw[i][0],
        desIds: String(raw[i][9] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean)
      };
    }
  }
  return null;
}

// Anula un Cobro sin borrar la fila (misma trazabilidad que
// _anularDespacho_ en Código.gs): anota la marca en Obs. Cobros no
// tiene columna Estado propia — por eso el marcador vive en Obs, y
// getCXC()/getDatosParaDashboard() (Código.gs) ya lo excluyen.
function _anularCobro_(fila, motivo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hCob = ss.getSheetByName(H_COBROS);
  var obsActual = hCob.getRange(fila, 11).getValue() || '';
  hCob.getRange(fila, 11).setValue((obsActual ? obsActual + ' · ' : '') + '⚠ ANULADO — ' + motivo);
}

// Busca en "Movimientos Stock" (Producción.gs) el movimiento 'Despacho'
// que generó este DES-ID y lo revierte con el mismo patrón que
// deshacerMovimientoStock(): marca esa fila 'Anulado' y aplica una
// 'Corrección' con el delta exactamente opuesto al guardado. Si no
// encuentra la fila (dato viejo, de antes de este historial), aplica
// igual la corrección a partir de las unidades del pedido, avisando.
function _revertirStockDeDespacho_(desId, producto, variante, unidadesPedido, grupo, motivo) {
  var res = _claveStock_(producto, variante); // Producción.gs
  if (!res.ok) return { ok: false, mensaje: 'No se pudo resolver el SKU (' + res.mensaje + ') — el stock NO se tocó.' };

  var ws = ensureHojaMovimientosStock_(); // Producción.gs
  var last = ws.getLastRow();
  var filaEncontrada = null, cantidadGuardada = null;
  if (last >= DATA_ROW) {
    var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_MOVIMIENTOS_STOCK.length).getValues();
    for (var i = filas.length - 1; i >= 0; i--) { // de más reciente a más viejo
      var r = filas[i];
      if (String(r[3]) === 'Despacho' && String(r[9] || 'Vigente') === 'Vigente'
          && String(r[7] || '').indexOf(desId) > -1 && String(r[1]).trim() === res.sku) {
        filaEncontrada = DATA_ROW + i;
        cantidadGuardada = Number(r[4]) || 0; // delta guardado (negativo)
        break;
      }
    }
  }

  if (filaEncontrada) {
    ws.getRange(filaEncontrada, 10).setValue('Anulado');
    var r2 = _moverStock_(res.sku, 'correccion', -cantidadGuardada, {
      detalle: 'Corrección · revierte ' + desId + ' del pedido ' + grupo + ' (fila ' + filaEncontrada + ') · ' + motivo
    });
    return r2.ok ? { ok: true } : { ok: false, mensaje: r2.mensaje };
  }

  var r3 = _moverStock_(res.sku, 'correccion', unidadesPedido, {
    detalle: 'Corrección · revierte ' + desId + ' del pedido ' + grupo + ' — ⚠ no se encontró el movimiento original, aplicado por unidades del pedido · ' + motivo
  });
  return r3.ok ? { ok: true } : { ok: false, mensaje: r3.mensaje };
}

// ════════════════════════════════════════════════════════════════
// EDITAR UN PEDIDO YA ACEPTADO — gerente, queda log acumulado
// ════════════════════════════════════════════════════════════════
// cambios: { unidades, precio, cliId, clienteNombre, obs, fechaEstimada }
// — solo se tocan las claves presentes. Producto/variante NO son
// editables acá (si cambia el producto, mejor rechazar y cargar un
// pedido nuevo). fechaEstimada, si viene, se espera como "YYYY-MM-DD".
function editarPedido(pedId, cambios, motivoEdicion, token) {
  var chk = _requiereRol_(token, ['gerente']);
  if (!chk.ok) return chk;
  if (!motivoEdicion || !motivoEdicion.trim()) return { ok: false, mensaje: 'Indicá qué cambió y por qué (queda en el log del pedido).' };

  return _conLock_(function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_PEDIDOS);
    var p = _leerTodosPedidos_().filter(function(x) { return x.id === pedId; })[0];
    if (!p) return { ok: false, mensaje: 'Pedido no encontrado.' };
    if ([PED_ESTADOS.ENTREGADO, PED_ESTADOS.RECHAZADO, PED_ESTADOS.CANCELADO].indexOf(p.estado) > -1) {
      return { ok: false, mensaje: '⛔ No se puede editar un pedido en estado ' + p.estado + '.' };
    }

    var TZ = 'America/Argentina/Buenos_Aires';
    var camposEditables = { unidades: PC.UNIDADES, precio: PC.PRECIO, cliId: PC.CLI_ID,
                             clienteNombre: PC.CLIENTE, obs: PC.OBS, fechaEstimada: PC.FECHA_ESTIMADA };
    var camposFecha = { fechaEstimada: true }; // se tratan como Date, no como texto/número plano
    var cambiosTexto = [];

    Object.keys(cambios || {}).forEach(function(campo) {
      var col = camposEditables[campo];
      if (!col) return;
      var valorAnterior = hoja.getRange(p.fila, col).getValue();

      if (camposFecha[campo]) {
        var nuevaFecha = _parsearFechaLocal_(cambios[campo]);
        var anteriorTxt = valorAnterior instanceof Date ? Utilities.formatDate(valorAnterior, TZ, 'dd/MM/yyyy') : '(sin fecha)';
        var nuevoTxt = nuevaFecha ? Utilities.formatDate(nuevaFecha, TZ, 'dd/MM/yyyy') : '(sin fecha)';
        if (anteriorTxt === nuevoTxt) return;
        if (!nuevaFecha) return; // no permitimos vaciar la fecha estimada desde acá — es obligatoria
        hoja.getRange(p.fila, col).setValue(nuevaFecha).setNumberFormat('DD/MM/YYYY');
        cambiosTexto.push(campo + ': "' + anteriorTxt + '" → "' + nuevoTxt + '"');
        return;
      }

      var valorNuevo = cambios[campo];
      if (String(valorAnterior) === String(valorNuevo)) return;
      hoja.getRange(p.fila, col).setValue(valorNuevo);
      cambiosTexto.push(campo + ': "' + valorAnterior + '" → "' + valorNuevo + '"');
    });

    if (!cambiosTexto.length) return { ok: false, mensaje: 'No se detectaron cambios.' };

    // Recalcular monto si cambió unidades o precio
    var unidadesFin = Number(hoja.getRange(p.fila, PC.UNIDADES).getValue());
    var precioFin   = Number(hoja.getRange(p.fila, PC.PRECIO).getValue());
    hoja.getRange(p.fila, PC.MONTO).setValue(unidadesFin * precioFin);

    var ahora = new Date();
    var sello = Utilities.formatDate(ahora, TZ, 'dd/MM HH:mm') + ' — ' + motivoEdicion + ' (' + cambiosTexto.join('; ') + ')';
    var logPrevio = hoja.getRange(p.fila, PC.LOG).getValue();
    hoja.getRange(p.fila, PC.LOG).setValue(logPrevio ? logPrevio + '\n' + sello : sello);
    hoja.getRange(p.fila, PC.EDITADO).setValue('Sí');
    hoja.getRange(p.fila, PC.ULT_ACT).setValue(ahora).setNumberFormat('DD/MM/YYYY HH:mm');

    return { ok: true, mensaje: '✅ ' + pedId + ' editado — queda registrado en el log del pedido.' };
  });
}

// ════════════════════════════════════════════════════════════════
// STOCK TEÓRICO — stock actual menos lo comprometido en pedidos
// Aceptados o Terminados (ya tomaron el compromiso de venta, pero
// todavía no se descontó del stock real porque eso pasa recién al
// marcar Entregado).
// ════════════════════════════════════════════════════════════════
function getStockTeorico(token) {
  var chk = _requiereRol_(token, ['vendedor', 'gerente', 'dueno']);
  if (!chk.ok) return chk;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hStock = ss.getSheetByName('Stock');
  var actual = {};
  // Misma convención que el resto: fila 1 título, fila 2 header, datos desde DATA_ROW.
  if (hStock && hStock.getLastRow() >= DATA_ROW) {
    hStock.getRange(DATA_ROW, 1, hStock.getLastRow() - DATA_ROW + 1, 3).getValues().forEach(function(r) {
      if (r[0]) actual[r[0]] = { producto: r[1], stock: Number(r[2]) || 0 };
    });
  }

  var comprometido = {};
  _leerTodosPedidos_()
    .filter(function(p) { return p.estado === PED_ESTADOS.ACEPTADO || p.estado === PED_ESTADOS.TERMINADO; })
    .forEach(function(p) {
      var res = _claveStock_(p.producto, p.variante); // definida en Producción.gs — misma resolución de SKU que usa guardarDespacho
      if (!res || !res.ok) return;
      comprometido[res.sku] = (comprometido[res.sku] || 0) + (Number(p.unidades) || 0);
    });

  var out = Object.keys(actual).map(function(sku) {
    var a = actual[sku];
    var c = comprometido[sku] || 0;
    return { sku: sku, producto: a.producto, stockActual: a.stock, comprometido: c, stockTeorico: a.stock - c };
  });

  return { ok: true, items: out };
}

// ════════════════════════════════════════════════════════════════
// CALENDARIO DE PEDIDOS — Aceptados y Terminados (compromisos ya
// confirmados con Producción), agrupados por fecha estimada de
// despacho. Visible para los 4 roles, sin filtrar por vendedor —
// es una vista compartida de planificación, igual que Stock teórico.
// ════════════════════════════════════════════════════════════════
function getCalendarioPedidos(token) {
  var chk = _requiereRol_(token, ['vendedor', 'gerente', 'dueno']);
  if (!chk.ok) return chk;

  var relevantes = _leerTodosPedidos_().filter(function(p) {
    return p.estado === PED_ESTADOS.ACEPTADO || p.estado === PED_ESTADOS.TERMINADO;
  });

  var porFecha = {};
  relevantes.forEach(function(p) {
    var clave = p.fechaEstimada || '(sin fecha)'; // solo pedidos viejos, de antes de este campo
    if (!porFecha[clave]) porFecha[clave] = [];
    porFecha[clave].push(p);
  });

  // Orden cronológico real (no alfabético) de claves "dd/MM/yyyy"
  var claves = Object.keys(porFecha).filter(function(k) { return k !== '(sin fecha)'; });
  claves.sort(function(a, b) {
    var da = a.split('/').reverse().join('-'); // -> "yyyy-MM-dd", comparable como texto
    var db = b.split('/').reverse().join('-');
    return da < db ? -1 : da > db ? 1 : 0;
  });
  if (porFecha['(sin fecha)']) claves.push('(sin fecha)');

  var dias = claves.map(function(fecha) {
    return { fecha: fecha, pedidos: porFecha[fecha] };
  });

  return { ok: true, dias: dias };
}

// ════════════════════════════════════════════════════════════════
// CXC PARA EL GERENTE/DUEÑO — reusa getCXC() de Código.gs
// (aplicá el patch de normalización que va en el mensaje de chat)
// ════════════════════════════════════════════════════════════════
function getCXCParaPedido(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  return { ok: true, cxc: getCXC() };
}

// ════════════════════════════════════════════════════════════════
// ÚLTIMOS COBROS DE UN CLIENTE — para cruzar, desde la tabla de CXC,
// cuánto debe un cliente contra cuándo fue su último pago y con qué
// frecuencia cobra. Mismo gate que getCXCParaPedido: Gerente y Dueño
// (CFO pasa siempre por el bypass de _requiereRol_).
// ════════════════════════════════════════════════════════════════
function getUltimosCobrosCliente(cliNombre, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  if (!cliNombre) return { ok: false, mensaje: 'Falta indicar el cliente.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hCob = ss.getSheetByName(H_COBROS); // 'Cobros', definida en Código.gs
  if (!hCob || hCob.getLastRow() < DATA_ROW) return { ok: true, cobros: [] };

  var TZ = 'America/Argentina/Buenos_Aires';
  var claveBuscada = _norm(cliNombre); // _norm() definida en Código.gs
  var cobros = [];

  // Cols hoja Cobros: 1=COB-ID 2=Fecha 3=CLI-ID 4=Cliente 5=Monto 6=Descuento
  //                   7=MontoNeto 8=FormaPago 9=Referencia ...
  hCob.getRange(DATA_ROW, 1, hCob.getLastRow() - DATA_ROW + 1, 9).getValues().forEach(function(r) {
    var cli = String(r[3]).trim();
    if (!cli || _norm(cli) !== claveBuscada) return;
    var fecha = r[1] instanceof Date ? r[1] : null;
    cobros.push({
      fecha: fecha ? Utilities.formatDate(fecha, TZ, 'dd/MM/yyyy') : '',
      fechaOrden: fecha ? fecha.getTime() : 0,
      monto: Number(r[4]) || 0,
      neto: Number(r[6]) || Number(r[4]) || 0,
      formaPago: String(r[7] || '').trim(),
      referencia: String(r[8] || '').trim()
    });
  });

  cobros.sort(function(a, b) { return b.fechaOrden - a.fechaOrden; }); // más reciente primero

  var ultimos = cobros.slice(0, 10).map(function(c) {
    return { fecha: c.fecha, monto: c.monto, neto: c.neto, formaPago: c.formaPago, referencia: c.referencia };
  });

  return { ok: true, cobros: ultimos };
}