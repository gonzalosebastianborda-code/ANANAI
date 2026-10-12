// ═══════════════════════════════════════════════════════════════
// ✅ ESTE SÍ ES UN ARCHIVO NUEVO — se agrega como pestaña nueva en el
// proyecto de Apps Script, con este nombre o el que prefieras (no pisa
// nada existente).
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · ETAPA 3 — módulo de Cuentas: Cobrar / Pagar / Ajustar saldo
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO: en el mockup que ya viste, la pantalla de Cuentas
// (Cobros y Proveedores) tiene un botón "💰 Cobrar" / "💵 Pagar" que
// paga contra el SALDO TOTAL de un cliente/proveedor (no contra una
// factura puntual elegida a mano), y un botón "🔒 Ajustar saldo" que en
// el mockup todavía es un cartel ("reservado al CFO") sin función real
// detrás. Este archivo pone el backend real de los tres.
//
// LO QUE DESCUBRÍ REVISANDO getCXC()/getCXP() (Código.gs/Configuracion.gs)
// antes de tocar nada: el saldo de cada cliente/proveedor NO es un
// número guardado en ningún lado — se recalcula siempre sumando
// Despachos/Gastos y restando Cobros/Pagos ("neteo puro"). Esto es
// clave porque significa que:
//   - Cobrar/pagar "contra el saldo total" (como hace el mockup) YA
//     funciona con guardarCobro()/guardarPagoProveedor() tal cual
//     existen hoy, sin tocarlas — el parámetro de DES-ID/GAS-IDs
//     cubiertos es upcional y solo sirve para que ESAS filas puntuales
//     queden marcadas "Cobrado"/"Pagado" prolijamente, pero el saldo
//     total ya se actualiza solo aunque se mande vacío.
//   - Por eso las funciones de acá abajo (pagarProveedorSaldo,
//     cobrarClienteSaldo) hacen un FIFO simple: buscan las facturas/
//     despachos más viejos todavía pendientes de ese cliente/proveedor y
//     los van marcando como cubiertos hasta agotar el monto pagado —
//     así la pantalla de "últimos pagos" de cada gasto/despacho queda
//     prolija sin que el Gerente tenga que elegir factura por factura.
//     Es la respuesta a la nota "④ Gastos parciales" que dejé en el
//     propio mockup. Si el pago no llega a cubrir una factura entera,
//     esa queda Pendiente igual (es la misma limitación que ya tiene
//     guardarPagoProveedor() hoy — no es algo que yo haya empeorado).
//   - "Ajustar saldo" no tiene ningún mecanismo propio — lo armé
//     reusando EXACTAMENTE los mismos caminos que un cobro/pago/gasto
//     real, para no tener que tocar getCXC()/getCXP() (que son
//     compartidas y ya probadas): bajar un saldo = un Cobro o Pago
//     "sintético"; subirlo = un Gasto sintético (proveedor) o una fila
//     sintética en Despachos escrita DIRECTO, sin pasar por
//     guardarDespacho() ni tocar Stock (esto no es una venta real, es
//     una corrección contable — por eso el producto queda anotado
//     como "Ajuste de cuenta (CFO)", clarísimo para no confundirlo con
//     una venta en ningún reporte).
//
// DE QUÉ DEPENDE (ya existe, no hace falta tocar nada):
//   - guardarCobro(), guardarDespacho()... en realidad NO se llama a
//     guardarDespacho() para el ajuste (a propósito, ver arriba) —
//     pero sí se usan H_DESPACHOS, DATA_ROW, genId(), _usuarioActual()
//     → Código.gs
//   - guardarGasto(), guardarPagoProveedor(), H_GASTOS, GASTOS_START
//     → Gastos.gs / Configuracion.gs
//   - _requiereRol_(), _requiereCFO_(), _conLock_() → Auth.gs / Pedidos.gs
//
// QUIÉN PUEDE HACER QUÉ:
//   - pagarProveedorSaldo() / cobrarClienteSaldo(): Gerente y Dueño
//     (mismo nivel que getCXCParaPedido, ya existente).
//   - ajustarSaldoCliente() / ajustarSaldoProveedor(): exclusivo CFO —
//     tal cual ya lo anuncia el candado del mockup.
//
// CÓMO PROBAR EN LA COPIA:
//   1. Elegí un proveedor con 2-3 gastos "Cuenta corriente" Pendientes
//      en la hoja Gastos (podés usar los históricos reales, ej. "El
//      Jujeño"). Sumá el monto de los más viejos hasta cubrir 2 de
//      ellos y llamá pagarProveedorSaldo('El Jujeño', <esa suma>,
//      'Transferencia', '', '', token) con token de Gerente.
//      → tiene que devolver ok:true y gasIdsCubiertos con esos 2
//        GAS-ID. Revisar la hoja Gastos → esos 2 pasaron a "Pagado",
//        los demás siguen "Pendiente".
//   2. Mismo con cobrarClienteSaldo() del lado de un cliente con
//      despachos Pendientes.
//   3. ajustarSaldoCliente('CLI-001', 'nombre real', -5000, 'Descuento
//      por flete demorado', tokenCFO) → tiene que devolver ok:true y
//      generar un Cobro por $5.000 con "Ajuste CFO" como forma de pago.
//   4. ajustarSaldoCliente('CLI-001', 'nombre real', 8000, 'Venta de
//      mostrador no cargada', tokenCFO) → tiene que devolver ok:true y
//      generar una fila nueva en Despachos con producto "Ajuste de
//      cuenta (CFO)", monto 8000, Condición Crédito, Estado Pendiente
//      — y confirmar que la hoja Stock NO se tocó (a propósito).
//   5. Repetir 3 y 4 con un token que NO sea CFO (por ejemplo Gerente)
//      → tiene que devolver ok:false, "Solo el CFO puede realizar esta
//      acción."
// ═══════════════════════════════════════════════════════════════

// ── PAGAR A UN PROVEEDOR CONTRA SU SALDO TOTAL (no factura por factura) ──
function pagarProveedorSaldo(proveedorNombre, monto, formaPago, referencia, obs, token, caja) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  proveedorNombre = String(proveedorNombre || '').trim();
  monto = Number(monto);
  if (!proveedorNombre) return { ok: false, mensaje: 'Falta el proveedor.' };
  if (!monto || monto <= 0 || !isFinite(monto)) return { ok: false, mensaje: 'Falta el monto a pagar.' };
  caja = String(caja || '').trim() || 'Distribuidora';

  return _conLock_(function() {
    // FIFO: junta los GAS-ID de este proveedor, Cuenta corriente,
    // todavía Pendientes, del más viejo al más nuevo, hasta cubrir el
    // monto pagado.
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hG = ss.getSheetByName(H_GASTOS);
    var pendientes = [];
    if (hG && hG.getLastRow() >= GASTOS_START) {
      var raw = hG.getRange(GASTOS_START, 1, hG.getLastRow() - GASTOS_START + 1, 10).getValues();
      raw.forEach(function(r) {
        var prov = String(r[5] || '').trim();
        var cond = String(r[7] || '').trim();
        var estado = String(r[9] || '').trim();
        if (prov === proveedorNombre && cond === 'Cuenta corriente' && estado === 'Pendiente') {
          pendientes.push({ gasId: String(r[0]).trim(), fecha: r[1] instanceof Date ? r[1].getTime() : 0, monto: Number(r[6]) || 0 });
        }
      });
    }
    pendientes.sort(function(a, b) { return a.fecha - b.fecha; });

    var restante = monto;
    var gasIdsCubiertos = [];
    pendientes.forEach(function(g) {
      if (g.monto > 0 && restante >= g.monto) {
        gasIdsCubiertos.push(g.gasId);
        restante -= g.monto;
      }
    });

    var res = guardarPagoProveedor({ // Gastos.gs — sin cambios
      proveedor: _sanTxt_(proveedorNombre), monto: monto, formaPago: _sanTxt_(formaPago),
      gasIds: gasIdsCubiertos.join(', '), obs: _sanTxt_(obs || ''), caja: _sanTxt_(caja)
    });
    if (!res.ok) return res;

    return {
      ok: true, pagId: res.pagId, gasIdsCubiertos: gasIdsCubiertos,
      mensaje: res.mensaje + (gasIdsCubiertos.length
        ? ' · cubrió íntegro: ' + gasIdsCubiertos.join(', ')
        : ' · no alcanzó a cubrir ningún gasto completo (queda como pago a cuenta)')
    };
  });
}

// ── COBRARLE A UN CLIENTE CONTRA SU SALDO TOTAL (no despacho por despacho) ──
function cobrarClienteSaldo(cliId, clienteNombre, monto, formaPago, referencia, obs, token, caja) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  clienteNombre = String(clienteNombre || '').trim();
  monto = Number(monto);
  if (!clienteNombre) return { ok: false, mensaje: 'Falta el cliente.' };
  if (!monto || monto <= 0 || !isFinite(monto)) return { ok: false, mensaje: 'Falta el monto cobrado.' };
  caja = String(caja || '').trim() || 'Distribuidora';

  return _conLock_(function() {
    // FIFO igual que pagarProveedorSaldo, del lado de Despachos: junta
    // los DES-ID de este cliente que sigan Pendientes (no Cobrado /
    // Devuelto / Anulado), del más viejo al más nuevo. Guardar Cobro
    // (Código.gs) solo marca "Cobrado" los que sean Condición=Crédito
    // — los de Contado siguen el mismo criterio que ya usa el sistema
    // hoy (ver repararCxCContado en Código.gs), no lo estoy cambiando.
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hDes = ss.getSheetByName(H_DESPACHOS);
    var pendientes = [];
    if (hDes && hDes.getLastRow() >= DATA_ROW) {
      var raw = hDes.getRange(DATA_ROW, 1, hDes.getLastRow() - DATA_ROW + 1, 13).getValues();
      raw.forEach(function(r) {
        var cli = String(r[3] || '').trim();
        var estado = String(r[12] || '').trim();
        if (cli === clienteNombre && estado === 'Pendiente') {
          pendientes.push({ desId: String(r[0]).trim(), fecha: r[1] instanceof Date ? r[1].getTime() : 0, monto: Number(r[10]) || 0 });
        }
      });
    }
    pendientes.sort(function(a, b) { return a.fecha - b.fecha; });

    var restante = monto;
    var desIdsCubiertos = [];
    pendientes.forEach(function(d) {
      if (d.monto > 0 && restante >= d.monto) {
        desIdsCubiertos.push(d.desId);
        restante -= d.monto;
      }
    });

    var res = guardarCobro({ // Código.gs — sin cambios
      cliId: cliId || '', clienteNombre: _sanTxt_(clienteNombre), monto: monto, descuento: 0,
      formaPago: _sanTxt_(formaPago), referencia: _sanTxt_(referencia || ''), caja: _sanTxt_(caja),
      desIds: desIdsCubiertos.join(', '), obs: _sanTxt_(obs || '')
    });
    if (!res.ok) return res;

    return {
      ok: true, cobId: res.cobId, desIdsCubiertos: desIdsCubiertos,
      mensaje: res.mensaje + (desIdsCubiertos.length
        ? ' · cubrió íntegro: ' + desIdsCubiertos.join(', ')
        : ' · no alcanzó a cubrir ningún despacho completo (queda como pago a cuenta)')
    };
  });
}

// ── AJUSTAR SALDO DE UN CLIENTE — exclusivo CFO, motivo obligatorio ──
// montoAjuste NEGATIVO = se le reduce/perdona lo que debe (ej. un
//   descuento post-venta). montoAjuste POSITIVO = se le suma deuda (ej.
//   una venta real que no se había cargado).
function ajustarSaldoCliente(cliId, clienteNombre, montoAjuste, motivo, token) {
  var chk = _requiereCFO_(token); // Auth.gs — exclusivo CFO, tal cual lo anuncia el candado del mockup
  if (!chk.ok) return chk;

  clienteNombre = String(clienteNombre || '').trim();
  montoAjuste = Number(montoAjuste);
  if (!clienteNombre) return { ok: false, mensaje: 'Falta el cliente.' };
  if (!montoAjuste || !isFinite(montoAjuste)) return { ok: false, mensaje: 'El ajuste no puede ser $0.' };
  if (!motivo || !String(motivo).trim()) return { ok: false, mensaje: 'El motivo es obligatorio para ajustar una cuenta.' };

  var etiqueta = '⚠ AJUSTE MANUAL DE CUENTA — CFO — ' + motivo;

  if (montoAjuste < 0) {
    // Reduce lo que debe: un Cobro sintético — getCXC() lo netea solo,
    // igual que un cobro real.
    var res = guardarCobro({ // Código.gs — sin cambios
      cliId: cliId || '', clienteNombre: _sanTxt_(clienteNombre), monto: Math.abs(montoAjuste), descuento: 0,
      formaPago: 'Ajuste CFO', referencia: '', caja: 'Distribuidora', desIds: '', obs: etiqueta
    });
    if (!res.ok) return res;
    return { ok: true, cobId: res.cobId, mensaje: '✅ Cuenta de ' + clienteNombre + ' ajustada — $' + Math.abs(montoAjuste).toLocaleString('es-AR') + ' menos. (' + res.cobId + ')' };
  }

  // Aumenta lo que debe: una fila sintética en Despachos, escrita
  // DIRECTO (sin pasar por guardarDespacho ni tocar Stock — esto no es
  // una venta física, es una corrección contable). Queda clarísimo en
  // la hoja: producto "Ajuste de cuenta (CFO)" + el motivo en Obs.
  return _conLock_(function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_DESPACHOS);
    var fila = Math.max(hoja.getLastRow() + 1, DATA_ROW);
    var desId = genId('DES-', H_DESPACHOS); // Código.gs
    var fecha = new Date();

    hoja.getRange(fila, 1).setValue(desId);
    hoja.getRange(fila, 2).setValue(fecha).setNumberFormat('DD/MM/YYYY');
    hoja.getRange(fila, 3).setValue(_sanTxt_(cliId || ''));
    hoja.getRange(fila, 4).setValue(_sanTxt_(clienteNombre));
    hoja.getRange(fila, 5).setValue('Ajuste de cuenta (CFO)');
    hoja.getRange(fila, 6).setValue('');
    hoja.getRange(fila, 7).setValue('');
    hoja.getRange(fila, 8).setValue(1);
    hoja.getRange(fila, 9).setValue(montoAjuste).setNumberFormat('$#,##0');
    hoja.getRange(fila, 10).setValue('Ajuste');
    hoja.getRange(fila, 11).setValue(montoAjuste).setNumberFormat('$#,##0');
    hoja.getRange(fila, 12).setValue('Crédito');
    hoja.getRange(fila, 13).setValue('Pendiente');
    hoja.getRange(fila, 14).setValue(etiqueta);
    hoja.getRange(fila, 15).setValue(fecha).setNumberFormat('DD/MM/YYYY HH:mm');
    hoja.getRange(fila, 16).setValue(_usuarioActual()); // Código.gs

    return { ok: true, desId: desId, mensaje: '✅ Cuenta de ' + clienteNombre + ' ajustada — $' + montoAjuste.toLocaleString('es-AR') + ' más. (' + desId + ')' };
  });
}

// ── AJUSTAR SALDO DE UN PROVEEDOR — exclusivo CFO, motivo obligatorio ──
// montoAjuste NEGATIVO = se le reduce la deuda (se pagó de más, o un
//   gasto se había cargado de más). montoAjuste POSITIVO = se le suma
//   deuda (un gasto real que no se había cargado).
// grupo/subgrupo son opcionales — solo aplican cuando montoAjuste es
// positivo (hace falta clasificarlo como un Gasto). Si no se
// especifican, cae en un cajón neutro ("C1. Servicios y
// mantenimiento") — conviene que la pantalla del CFO deje elegir la
// categoría real cuando se sepa cuál es.
function ajustarSaldoProveedor(proveedorNombre, montoAjuste, motivo, token, grupo, subgrupo) {
  var chk = _requiereCFO_(token);
  if (!chk.ok) return chk;

  proveedorNombre = String(proveedorNombre || '').trim();
  montoAjuste = Number(montoAjuste);
  if (!proveedorNombre) return { ok: false, mensaje: 'Falta el proveedor.' };
  if (!montoAjuste || !isFinite(montoAjuste)) return { ok: false, mensaje: 'El ajuste no puede ser $0.' };
  if (!motivo || !String(motivo).trim()) return { ok: false, mensaje: 'El motivo es obligatorio para ajustar una cuenta.' };

  var etiqueta = '⚠ AJUSTE MANUAL DE CUENTA — CFO — ' + motivo;

  if (montoAjuste < 0) {
    // Reduce la deuda: un Pago sintético — mismo mecanismo que un pago real.
    var res = guardarPagoProveedor({ // Gastos.gs — sin cambios
      proveedor: _sanTxt_(proveedorNombre), monto: Math.abs(montoAjuste), formaPago: 'Ajuste CFO', obs: etiqueta
    });
    if (!res.ok) return res;
    return { ok: true, pagId: res.pagId, mensaje: '✅ Cuenta de ' + proveedorNombre + ' ajustada — $' + Math.abs(montoAjuste).toLocaleString('es-AR') + ' menos. (' + res.pagId + ')' };
  }

  // Aumenta la deuda: un Gasto sintético en Cuenta corriente — mismo
  // mecanismo que un gasto real.
  var res2 = guardarGasto({ // Gastos.gs — sin cambios
    grupo: _sanTxt_(grupo || 'C. Gastos Fijos'), subgrupo: _sanTxt_(subgrupo || 'C1. Servicios y mantenimiento'),
    descripcion: 'Ajuste de cuenta (CFO)', proveedor: _sanTxt_(proveedorNombre), monto: montoAjuste,
    condicion: 'Cuenta corriente', diasPago: 0, obs: etiqueta
  });
  if (!res2.ok) return res2;
  return { ok: true, gasId: res2.gasId, mensaje: '✅ Cuenta de ' + proveedorNombre + ' ajustada — $' + montoAjuste.toLocaleString('es-AR') + ' más. (' + res2.gasId + ')' };
}

// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · ETAPA 5 (agregado a este mismo archivo) — 4 funciones que le
// faltaban a la pantalla de Cuentas/Gastos del PedidosForm.html
// extendido: ver el saldo de PROVEEDORES (el mockup ya tenía "CXC" para
// clientes en Pedidos.gs, pero nada del lado de Proveedores todavía),
// ver los últimos pagos de un proveedor puntual (mismo espejo que
// getUltimosCobrosCliente en Pedidos.gs), la taxonomía de Grupo/Subgrupo
// para poblar el formulario de Gastos, y el registro de un gasto
// operativo suelto (alquiler, sueldos, fletes — todo lo que NO es una
// compra de insumos, que ya tiene su propio camino en
// registrarCompraItemizada de NUEVO-Compras.gs).
// ═══════════════════════════════════════════════════════════════

// ── VISTA DE PROVEEDORES (CXP) — mismo patrón que getCXCParaPedido() (Pedidos.gs) ──
function getCXPParaVista(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  return { ok: true, cxp: getCXP(), proveedores: getProveedores() }; // Configuracion.gs — sin cambios
}

// ── ÚLTIMOS PAGOS DE UN PROVEEDOR — mismo patrón que getUltimosCobrosCliente() (Pedidos.gs) ──
function getUltimosPagosProveedor(provNombre, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  if (!provNombre) return { ok: false, mensaje: 'Falta indicar el proveedor.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hP = ss.getSheetByName(H_PAGOS_PR); // Configuracion.gs
  if (!hP || hP.getLastRow() < PAGOS_START) return { ok: true, pagos: [] };

  var TZ = 'America/Argentina/Buenos_Aires';
  var claveBuscada = _norm(provNombre); // Código.gs
  var pagos = [];
  // Cols hoja Pagos Proveedores: 1=PAG-ID 2=Fecha 3=Proveedor 4=Monto
  //                              5=FormaPago 6=FechaVenc 7=EstadoCheque ...
  hP.getRange(PAGOS_START, 1, hP.getLastRow() - PAGOS_START + 1, 7).getValues().forEach(function(r) {
    var prov = String(r[2]).trim();
    if (!prov || _norm(prov) !== claveBuscada) return;
    var fecha = r[1] instanceof Date ? r[1] : null;
    pagos.push({
      fecha: fecha ? Utilities.formatDate(fecha, TZ, 'dd/MM/yyyy') : '',
      fechaOrden: fecha ? fecha.getTime() : 0,
      monto: Number(r[3]) || 0,
      formaPago: String(r[4] || '').trim(),
      estadoCheque: String(r[6] || '').trim()
    });
  });

  pagos.sort(function(a, b) { return b.fechaOrden - a.fechaOrden; });
  var top = pagos.slice(0, 10).map(function(p) {
    return { fecha: p.fecha, monto: p.monto, formaPago: p.formaPago, estadoCheque: p.estadoCheque };
  });
  return { ok: true, pagos: top };
}

// ── MOVIMIENTOS DE UNA CUENTA (compras/entregas y pagos/cobros, juntos) ──
// tipo 'prov': compras a cuenta corriente (hoja Gastos) + pagos (Pagos Proveedores) de un
//              proveedor, con los comprobantes de cada compra.
// tipo 'cli' : entregas (Despachos, agrupadas por día) + cobros (Cobros) de un cliente.
// Usa las MISMAS reglas que getCXP() / getCXC() para qué cuenta y qué no, así que lo que se ve
// acá explica el saldo de la lista. Solo lectura. Devuelve los 40 más recientes.
function getMovimientosCuenta(tipo, nombre, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  tipo = String(tipo || '').trim();
  nombre = String(nombre || '').trim();
  if (!nombre) return { ok: false, mensaje: 'Falta indicar la cuenta.' };
  if (tipo !== 'prov' && tipo !== 'cli') return { ok: false, mensaje: 'Tipo de cuenta no válido.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var TZ = 'America/Argentina/Buenos_Aires';
  var clave = _norm(nombre);
  var fmt = function(d) { return Utilities.formatDate(d, TZ, 'dd/MM/yyyy'); };
  var movs = [];

  if (tipo === 'prov') {
    // compra (GAS-ID) → número de compra (COM-…) y comprobantes
    var comDeGas = {};
    var hCI = ss.getSheetByName(H_COMPRAS_INSUMOS);
    if (hCI && hCI.getLastRow() >= DATA_ROW) {
      hCI.getRange(DATA_ROW, 1, hCI.getLastRow() - DATA_ROW + 1, 3).getValues().forEach(function(r) {
        var com = String(r[1] || '').trim(), gas = String(r[2] || '').trim();
        if (com && gas && !comDeGas[gas]) comDeGas[gas] = com;
      });
    }
    var comps = {};
    try { if (typeof _comprobantesPorCompra_ === 'function') comps = _comprobantesPorCompra_(); } catch (e) { comps = {}; }

    var hG = ss.getSheetByName(H_GASTOS);
    if (hG && hG.getLastRow() >= GASTOS_START) {
      hG.getRange(GASTOS_START, 1, hG.getLastRow() - GASTOS_START + 1, 11).getValues().forEach(function(r) {
        var prov = String(r[5]).trim(), mt = Number(r[6]) || 0, cond = String(r[7]).trim();
        if (!prov || _norm(prov) !== clave || !(mt > 0) || cond !== 'Cuenta corriente') return;
        var f = r[1] instanceof Date ? r[1] : null;
        var gasId = String(r[0] || '').trim();
        var compraId = comDeGas[gasId] || '';
        movs.push({
          t: 'c', fecha: f ? fmt(f) : '', fechaOrden: f ? f.getTime() : 0,
          doc: compraId || gasId, gasId: gasId, compraId: compraId,
          detalle: String(r[4] || '').trim().slice(0, 120), monto: mt,
          comprobantes: (compraId && comps[compraId]) ? comps[compraId].map(function(c) { return { nombre: c.nombre, tipo: c.tipo, id: c.id, kb: c.kb, url: c.url }; }) : []
        });
      });
    }
    var hP = ss.getSheetByName(H_PAGOS_PR);
    if (hP && hP.getLastRow() >= PAGOS_START) {
      hP.getRange(PAGOS_START, 1, hP.getLastRow() - PAGOS_START + 1, 9).getValues().forEach(function(r) {
        var prov = String(r[2]).trim(), mt = Number(r[3]) || 0;
        if (!prov || _norm(prov) !== clave || !(mt > 0)) return;
        var f = r[1] instanceof Date ? r[1] : null;
        var est = String(r[6] || '').trim();
        movs.push({
          t: 'p', fecha: f ? fmt(f) : '', fechaOrden: f ? f.getTime() : 0,
          doc: String(r[0] || '').trim(), monto: mt, forma: String(r[4] || '').trim(),
          pendiente: est === 'Cheque emitido — pendiente débito', estadoCheque: est
        });
      });
    }
  } else {
    var hDes = ss.getSheetByName(H_DESPACHOS);
    var dias = {}, ordenDias = [];
    if (hDes && hDes.getLastRow() >= DATA_ROW) {
      hDes.getRange(DATA_ROW, 1, hDes.getLastRow() - DATA_ROW + 1, 13).getValues().forEach(function(r) {
        var cli = String(r[3]).trim(), mt = Number(r[10]) || 0, est = String(r[12] || '').trim();
        if (!cli || _norm(cli) !== clave || !(mt > 0) || est === 'Anulado') return;
        var f = r[1] instanceof Date ? r[1] : null;
        var k = f ? fmt(f) : '(sin fecha)';
        if (!dias[k]) { dias[k] = { t: 'c', fecha: f ? k : '', fechaOrden: f ? f.getTime() : 0, ids: [], items: [], monto: 0 }; ordenDias.push(k); }
        var d = dias[k];
        d.ids.push(String(r[0] || '').trim());
        var pr = String(r[4] || '').trim() + (r[5] ? ' · ' + String(r[5]).trim() : '');
        d.items.push(pr + ' ×' + (Number(r[7]) || 0));
        d.monto += mt;
      });
    }
    ordenDias.forEach(function(k) {
      var d = dias[k];
      var ids = d.ids.filter(function(x) { return x; });
      var doc = !ids.length ? '' : (ids.length === 1 ? ids[0] : ids[0] + ' … ' + ids[ids.length - 1]);
      var detalle = d.items.slice(0, 3).join(' · ') + (d.items.length > 3 ? ' · +' + (d.items.length - 3) + ' más' : '');
      movs.push({ t: 'c', fecha: d.fecha, fechaOrden: d.fechaOrden, doc: doc, detalle: detalle.slice(0, 160), monto: Math.round(d.monto), lineas: d.items.length });
    });
    var hCob = ss.getSheetByName(H_COBROS);
    if (hCob && hCob.getLastRow() >= DATA_ROW) {
      hCob.getRange(DATA_ROW, 1, hCob.getLastRow() - DATA_ROW + 1, 11).getValues().forEach(function(r) {
        var cli = String(r[3]).trim(), neto = Number(r[6]) || Number(r[4]) || 0, obs = String(r[10] || '');
        if (!cli || _norm(cli) !== clave || !(neto > 0) || obs.indexOf('ANULADO') !== -1) return;
        var f = r[1] instanceof Date ? r[1] : null;
        movs.push({ t: 'p', fecha: f ? fmt(f) : '', fechaOrden: f ? f.getTime() : 0, doc: String(r[0] || '').trim(), monto: neto, forma: String(r[7] || '').trim(), referencia: String(r[8] || '').trim() });
      });
    }
  }

  movs.sort(function(a, b) { return b.fechaOrden - a.fechaOrden; });

  // Resumen: último pago/cobro y lo pagado/cobrado en los últimos 90 días (los cheques
  // emitidos y todavía no debitados no cuentan: igual que en el saldo).
  var hace90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
  var pagos = movs.filter(function(m) { return m.t === 'p' && !m.pendiente; });
  var ult = pagos[0] || null;
  var resumen = {
    ultimoFecha: ult ? ult.fecha : '', ultimoOrden: ult ? ult.fechaOrden : 0, ultimoMonto: ult ? ult.monto : 0, ultimoForma: ult ? ult.forma : '',
    pagado90: pagos.filter(function(m) { return m.fechaOrden >= hace90; }).reduce(function(a, m) { return a + m.monto; }, 0),
    cantidad: movs.length
  };
  return { ok: true, tipo: tipo, movimientos: movs.slice(0, 40), resumen: resumen };
}

// ── TAXONOMÍA DE GASTOS, para el selector Grupo → Subgrupo del formulario ──
// Lee la misma TAXONOMIA global que ya existe en Configuracion.gs — no
// se duplica acá, solo se expone tal cual para que el webapp (que solo
// puede pedir datos por google.script.run, no leer variables de
// servidor directamente) pueda armar los dos selectores encadenados,
// igual que ya hace a mano el sidebar de Proveedores.gs.
function getTaxonomiaGastos() {
  var grupos = [], subMap = {};
  TAXONOMIA.forEach(function(t) { // Configuracion.gs
    if (grupos.indexOf(t[0]) === -1) grupos.push(t[0]);
    if (!subMap[t[0]]) subMap[t[0]] = [];
    subMap[t[0]].push({ sub: t[1], tipo: t[2], hint: t[3] });
  });
  return { ok: true, grupos: grupos, subMap: subMap };
}

// ── REGISTRAR UN GASTO OPERATIVO DIRECTO (no ligado a una compra de insumos) ──
// Es el mismo guardarGasto() que ya usa el sidebar de Proveedores.gs
// (Gastos → hoja de cálculo), con el mismo shape de datos — pero acá SÍ
// hace falta el gate de token/rol que ese sidebar no necesita (ahí solo
// entra quien ya tiene permiso de editar la Planilla; acá cualquiera con
// un PIN de Gerente puede llegar a esta pantalla desde el celular).
function registrarGastoOperativo(grupo, subgrupo, descripcion, proveedor, monto, condicion, diasPago, obs, token, caja) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  grupo = String(grupo || '').trim();
  subgrupo = String(subgrupo || '').trim();
  monto = Number(monto);
  if (!grupo) return { ok: false, mensaje: 'Falta el grupo.' };
  if (!subgrupo) return { ok: false, mensaje: 'Falta el subgrupo.' };
  if (!monto || monto <= 0 || !isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' };
  condicion = (String(condicion || '').trim() === 'Cuenta corriente') ? 'Cuenta corriente' : 'Contado';

  return _conLock_(function() {
    return guardarGasto({ // Gastos.gs — sin cambios, mismo shape que ya usa Proveedores.gs
      grupo: _sanTxt_(grupo), subgrupo: _sanTxt_(subgrupo), descripcion: _sanTxt_(descripcion || ''),
      proveedor: _sanTxt_(proveedor || ''), monto: monto, condicion: condicion,
      diasPago: diasPago || 0, obs: _sanTxt_(obs || ''), caja: _sanTxt_(caja || '')
    });
  });
}
