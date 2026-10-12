// ═══════════════════════════════════════════════════════════════
// ✅ ESTE SÍ ES UN ARCHIVO NUEVO — se agrega como pestaña nueva en el
// proyecto de Apps Script, con este nombre o el que prefieras.
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · ETAPA 2 (parte 3 de 3) — módulo de Compras (archivo nuevo)
// ═══════════════════════════════════════════════════════════════
// ⚠ CORREGIDO — esta es la 2° versión de este archivo. Al armar la
// Etapa 3 volví a mirar el mockup que ya aprobaste (función cerrarCompra()
// del carrito de Compras) para diseñar Cobros/Pagos, y ahí encontré que
// mi primera versión de este archivo no coincidía con el mockup: yo
// había hecho un Gasto por CADA insumo de la compra; el mockup en
// realidad cierra SIEMPRE un único Gasto por compra (con el monto
// total y una descripción que junta los nombres), y el subgrupo A1/A2
// se elige solo por la cantidad de insumos que entraron en esa compra
// — no por si el proveedor "no desglosa". Esta versión ya sigue esa
// lógica exacta. Si ya habías pegado la versión anterior en tu copia
// de prueba, reemplazala entera por esta.
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO: la forma de cerrar una compra de insumos (el carrito de
// 🚚 Compras → Registrar compra del mockup) de manera que quede UN
// Gasto cargado — igual que si se hubiera hecho a mano desde 🧾 Gastos
// — y que además sume el stock de cada insumo automáticamente, cosa
// que hoy Gastos no hace (Gastos solo anota plata, nunca toca Stock).
//
// CÓMO ARMA EL GASTO, calcado de cerrarCompra() en el mockup:
//   - Un solo guardarGasto() por compra cerrada (no uno por insumo).
//   - grupo = "A. Materia Prima" siempre.
//   - subgrupo = "A1. Proveedor consolidado" si la compra tuvo MÁS DE
//     UN insumo, "A2. Compra individual de insumo" si tuvo uno solo.
//   - descripcion = los nombres de los insumos separados por coma (si
//     son más de 2, se truncan: "cebolla, aceite y 3 más" — mismo
//     criterio que usa el mockup).
//   - monto = la suma de cantidad×precio de todas las líneas.
//   - condicion/diasPago = los que se eligieron UNA VEZ para toda la
//     compra (no por línea) — igual que en el mockup, donde el
//     proveedor y la condición se traban apenas se agrega el primer
//     insumo al carrito.
//
// Aparte del Gasto único, por CADA línea del carrito se hacen dos
// cosas más (esto no lo tiene el mockup, que es solo la maqueta visual
// — es lo que hace falta en el backend real para que Insumos y Recetas
// funcionen de verdad):
//   1. Sumar el stock de ese insumo puntual — usa el tipo 'compra' de
//      _moverStock_(), agregado en el parche de Produccion.gs que se
//      entrega junto con este archivo. Hace falta aplicar ESE parche
//      antes de usar esta función.
//   2. Anotar esa línea (SKU, cantidad, precio unitario, y el GAS-ID
//      del gasto único que le corresponde) en una hoja nueva, "Compras
//      Insumos" — es la base para "último precio pagado" que usa
//      calcularCostoReceta() en NUEVO-Recetas.gs.
//
// SOBRE LA CAJA: el sistema ya tiene dos cajas operativas,
// 'Distribuidora' y 'Añañai' (ver Configuracion.gs, var CAJAS — Añañai
// es la empresa de fábrica, Distribuidora la comercial). Las compras de
// insumos son gasto de fábrica, así que esta función usa 'Añañai' como
// caja por default si no se manda una explícita — pero queda como
// parámetro para que el frontend pueda mandar la que corresponda si en
// la práctica se paga desde la otra. Conviene confirmar esto con una
// compra de prueba y mirar cómo se ve en el resto del sistema (Flash
// Report / saldo por caja) antes de usarlo en serio.
//
// DE QUÉ DEPENDE (ya existe, no hace falta tocar nada):
//   - guardarGasto() → Gastos.gs (sin cambios, se llama tal cual está)
//   - _catalogoPorSku_(), _moverStock_() con tipo 'compra' → Produccion.gs
//     (ESTE ÚLTIMO NECESITA el parche que se entrega junto con este
//     archivo — sin ese parche, 'compra' no es un tipo válido)
//   - _requiereRol_(), _conLock_() → Auth.gs / Pedidos.gs
//
// CÓMO PROBAR EN LA COPIA (aplicar antes el parche de Produccion.gs):
//   1. registrarCompraItemizada('El Jujeño', 'Contado', 0,
//        [{sku:'INSU-001', cantidad:10, unidad:'kg', precioUnitario:500},
//         {sku:'INSU-002', cantidad:5, unidad:'kg', precioUnitario:300}],
//        'prueba', token) con token de Gerente.
//      → tiene que devolver ok:true, un compraId tipo "COM-20260924-...",
//        y UN SOLO GAS-ID.
//   2. Revisar Gastos → tiene que aparecer UNA fila nueva, grupo "A.
//      Materia Prima", subgrupo "A1. Proveedor consolidado" (porque son
//      2 insumos), descripción "Masa para Medialuna, Relleno para
//      Sandwich", monto 6500 (5000 + 1500).
//   3. Revisar Stock → INSU-001 sumó 10, INSU-002 sumó 5 (dos
//      movimientos distintos, cada uno con su propio detalle).
//   4. Revisar la hoja nueva "Compras Insumos" → dos filas, una por
//      insumo, cada una con el MISMO GAS-ID (porque comparten el mismo
//      gasto) pero su propio SKU/cantidad/precio.
//   5. Repetir con una sola línea → confirmar que el subgrupo sale "A2.
//      Compra individual de insumo".
// ═══════════════════════════════════════════════════════════════

var H_COMPRAS_INSUMOS = 'Compras Insumos';
var ENCABEZADOS_COMPRAS_INSUMOS = [
  'Fecha', 'Compra', 'GAS-ID', 'SKU Insumo', 'Insumo',
  'Cantidad', 'Unidad', 'Precio unitario', 'Monto', 'Proveedor', 'Condición'
];

function ensureHojaComprasInsumos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_COMPRAS_INSUMOS);
  if (!ws) {
    ws = ss.insertSheet(H_COMPRAS_INSUMOS);
    ws.getRange('A1').setValue('AÑAÑAI · Compras de insumos itemizadas — una fila por insumo comprado. Se llena sola desde registrarCompraItemizada(), no editar a mano.');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_COMPRAS_INSUMOS.length), '#5B3A29'); // Código.gs
    ws.getRange(2, 1, 1, ENCABEZADOS_COMPRAS_INSUMOS.length).setValues([ENCABEZADOS_COMPRAS_INSUMOS]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

// Arma la descripción del Gasto único a partir de los nombres de los
// insumos del carrito — mismo truncado que usa cerrarCompra() en el
// mockup: hasta 2 nombres completos, de ahí en más "y N más".
function _descripcionCompra_(nombres) {
  if (nombres.length > 2) {
    return nombres.slice(0, 2).join(', ') + ' y ' + (nombres.length - 2) + ' más';
  }
  return nombres.join(', ');
}

// Cierra una compra de insumos: UN solo Gasto (A1 si hay más de un
// insumo, A2 si hay uno solo — igual que cerrarCompra() del mockup) y,
// por cada línea, suma el stock de ese insumo puntual y deja registro
// en "Compras Insumos" con el precio pagado.
// lineas: [{ sku, cantidad, unidad, precioUnitario }, ...] — el sku
// tiene que ser un Insumo que ya exista en el Catálogo (usar
// crearInsumoNuevo() primero si es la primera vez que se compra).
function registrarCompraItemizada(proveedorNombre, condicion, diasPago, lineas, obs, token, caja) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  proveedorNombre = String(proveedorNombre || '').trim();
  if (!proveedorNombre) return { ok: false, mensaje: 'Falta el proveedor.' };
  if (!lineas || !lineas.length) return { ok: false, mensaje: 'La compra no tiene ítems.' };
  condicion = (String(condicion || '').trim() === 'Cuenta corriente') ? 'Cuenta corriente' : 'Contado';
  caja = String(caja || '').trim() || 'Añañai'; // ver nota sobre cajas arriba
  // Neutraliza "=..." en los textos libres antes de que lleguen a la hoja
  // (ver _sanTxt_ en Produccion.gs).
  proveedorNombre = _sanTxt_(proveedorNombre);
  obs = _sanTxt_(obs);
  caja = _sanTxt_(caja);
  lineas = _sanObj_(lineas);

  return _conLock_(function() {
    // El sufijo al azar es nuevo: antes el ID era solo "COM-" + fecha/hora
    // al segundo, así que dos compras cerradas dentro del mismo segundo
    // (poco común a mano, pero real si se usa dos veces seguidas rápido)
    // generaban el MISMO compraId y quedaban mezcladas como si fueran una
    // sola al agruparlas en getHistorialCompras(). Con este sufijo ya no
    // puede pasar, y el formato sigue siendo "COM-20260924-..." como
    // siempre de cara al Gerente.
    var compraId = 'COM-' + Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyyMMdd-HHmmss')
      + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

    // ── validar y resolver TODAS las líneas ANTES de escribir nada,
    // mismo criterio de "todo o nada al momento de decidir" que ya usan
    // los otros módulos (Pedidos, por ejemplo) — evita dejar stock
    // sumado de algunas líneas si otra línea de la misma compra tiene
    // un SKU inválido.
    var resueltas = [];
    var errores = [];
    var conversiones = [];
    lineas.forEach(function(li) {
      var cantidad = Number(li.cantidad);
      var precioUnitario = Number(li.precioUnitario);
      // ── AUDITORÍA H4 ── antes alcanzaba con que el número fuera "verdadero":
      // -3 (resta stock), -10 (monto negativo) e Infinity (stock infinito)
      // pasaban. Ahora tienen que ser números FINITOS y MAYORES A 0.
      if (!li.sku || !(cantidad > 0) || !(precioUnitario > 0) || !isFinite(cantidad) || !isFinite(precioUnitario) || !isFinite(cantidad * precioUnitario)) {
        errores.push('Ítem inválido (falta SKU, o la cantidad / el precio no es un número mayor a 0): ' + (li.sku || '(sin SKU)'));
        return;
      }
      var cat = _catalogoPorSku_(li.sku); // Producción.gs
      if (!cat || cat.tipo !== 'Insumo') {
        errores.push('El SKU "' + li.sku + '" no es un insumo válido del Catálogo.');
        return;
      }
      // ── AUDITORÍA H10 ── el stock del insumo se lleva en SU unidad del
      // Catálogo. Si la línea llega en otra unidad compatible (500 g de un
      // insumo que se lleva en kg), antes se sumaban 500 kg. Ahora se
      // convierte la cantidad (0,5 kg) y el precio unitario queda por
      // unidad de stock; lo pagado (monto) no cambia. Si las unidades no se
      // pueden convertir (ej. kg vs. paquete) la línea se rechaza en vez de
      // sumar un número sin sentido.
      var unidadLinea = String(li.unidad || '').trim() || cat.unidadProduccion;
      var cantidadStock = cantidad, precioStock = precioUnitario, unidadStock = unidadLinea;
      // Centavos: con precios por "total de la fila" (total ÷ cantidad) el producto
      // cantidad × precio puede traer 0,00000000000001 de ruido de punto flotante.
      var monto = Math.round(cantidad * precioUnitario * 100) / 100;
      if (cat.unidadProduccion && unidadLinea) {
        var conv = _convertirCantidad_(cantidad, unidadLinea, cat.unidadProduccion); // Producción.gs
        if (!conv.ok) {
          errores.push('"' + cat.nombre + '": ' + conv.mensaje + ' — se ignoró la línea, ajustá la unidad.');
          return;
        }
        unidadStock = cat.unidadProduccion;
        if (conv.cantidad !== cantidad) {
          cantidadStock = conv.cantidad;
          precioStock = monto / cantidadStock;
          conversiones.push('"' + cat.nombre + '": ' + cantidad + ' ' + unidadLinea + ' → ' + cantidadStock + ' ' + unidadStock);
        }
      }
      if (!(cantidadStock > 0) || !isFinite(cantidadStock) || !isFinite(precioStock)) {
        errores.push('"' + cat.nombre + '": la conversión de unidades dio un valor inválido — se ignoró la línea.');
        return;
      }
      resueltas.push({ sku: cat.sku, nombre: cat.nombre, unidad: unidadStock, cantidad: cantidadStock, precioUnitario: precioStock, monto: monto });
    });

    if (!resueltas.length) {
      return { ok: false, compraId: compraId, mensaje: '❌ Ningún ítem de la compra era válido: ' + errores.join(' · ') };
    }

    var montoTotal = resueltas.reduce(function(s, r) { return s + r.monto; }, 0);
    var subgrupo = resueltas.length > 1 ? 'A1. Proveedor consolidado' : 'A2. Compra individual de insumo';
    // Los nombres vienen del Catálogo (ya guardados como texto): si alguno
    // empezara con "=" o similar, se neutraliza otra vez al reescribirlo.
    var descripcion = _sanTxt_(_descripcionCompra_(resueltas.map(function(r) { return r.nombre; })));

    // ── UN solo Gasto para toda la compra ──
    var gasRes = guardarGasto({ // Gastos.gs — se llama directo, esa función no tiene control de rol propio
      grupo: 'A. Materia Prima', subgrupo: subgrupo, descripcion: descripcion,
      proveedor: proveedorNombre, monto: montoTotal, condicion: condicion, diasPago: diasPago,
      obs: (obs || '') + ' · ' + compraId, caja: caja
    });
    if (!gasRes.ok) return gasRes;

    // ── por cada línea: sumar stock del insumo + anotar en el ledger ──
    var wsLedger = ensureHojaComprasInsumos_();
    resueltas.forEach(function(r) {
      var mov = _moverStock_(r.sku, 'compra', r.cantidad, { // Produccion.gs — necesita el parche de este mismo envío
        detalle: 'Compra ' + compraId + ' · ' + gasRes.gasId
      });
      // Antes el resultado no se miraba: si el movimiento fallaba, igual se
      // anotaba la línea en el ledger y quedaba una compra "fantasma".
      if (!mov || !mov.ok) {
        errores.push('"' + r.nombre + '": no se pudo sumar al stock (' + ((mov && mov.mensaje) || 'error desconocido') + ') — la línea NO quedó en el historial; revisá el Gasto ' + gasRes.gasId + '.');
        return;
      }
      var filaLedger = Math.max(DATA_ROW, wsLedger.getLastRow() + 1);
      wsLedger.getRange(filaLedger, 1, 1, ENCABEZADOS_COMPRAS_INSUMOS.length).setValues([[
        new Date(), compraId, gasRes.gasId, r.sku, _sanTxt_(r.nombre),
        r.cantidad, r.unidad, r.precioUnitario, r.monto, proveedorNombre, condicion
      ]]);
    });

    var mensaje = '✅ Compra ' + compraId + ' cerrada — ' + resueltas.length + ' insumo(s), $' + montoTotal.toLocaleString('es-AR')
      + ' · Gasto ' + gasRes.gasId + ' (' + subgrupo + ').';
    if (conversiones.length) mensaje += ' ℹ Unidades convertidas a las del insumo: ' + conversiones.join(' · ') + '.';
    if (errores.length) mensaje += ' ⚠ Se ignoraron ' + errores.length + ' línea(s): ' + errores.join(' · ');

    return { ok: true, compraId: compraId, gasId: gasRes.gasId, subgrupo: subgrupo, montoTotal: montoTotal, resueltas: resueltas, errores: errores, mensaje: mensaje };
  });
}

// ═══════════════════════════════════════════════════════════════
// HISTORIAL DE COMPRAS — hasta ahora una compra de insumos solo se veía
// en Consultas como una línea más de Gasto genérica ("Harina 000, Aceite
// y 2 más — $45.000"), sin poder abrir el detalle de qué insumo, cuánto
// y a qué precio. El ledger "Compras Insumos" de arriba ya guarda eso
// línea por línea desde el principio — esto solo lo agrupa por compra
// para mostrarlo.
// ═══════════════════════════════════════════════════════════════

// Historial de compras agrupado por compra (no por línea), más reciente
// primero. periodoDias=0 o vacío trae todo el historial, igual criterio
// que getConsultas() en NUEVO-Consultas.gs.
function getHistorialCompras(token, periodoDias) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var ws = ensureHojaComprasInsumos_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return { ok: true, compras: [] };

  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_COMPRAS_INSUMOS.length).getValues();

  var limiteMs = null;
  if (periodoDias && Number(periodoDias) > 0) {
    limiteMs = Date.now() - Number(periodoDias) * 24 * 60 * 60 * 1000;
  }

  var porCompra = {};
  var orden = [];
  filas.forEach(function(r) {
    var compraId = String(r[1] || '').trim();
    if (!compraId) return;
    var fechaMs = r[0] instanceof Date ? r[0].getTime() : null;
    if (limiteMs != null && fechaMs != null && fechaMs < limiteMs) return;

    if (!porCompra[compraId]) {
      porCompra[compraId] = {
        compraId: compraId, gasId: String(r[2] || ''), fecha: fechaMs,
        proveedor: String(r[9] || ''), condicion: String(r[10] || ''),
        items: [], montoTotal: 0
      };
      orden.push(compraId);
    }
    var cant = Number(r[5]) || 0, monto = Number(r[8]) || 0;
    porCompra[compraId].items.push({
      sku: String(r[3] || ''), nombre: String(r[4] || ''),
      cantidad: cant, unidad: String(r[6] || ''),
      precioUnitario: Number(r[7]) || 0, monto: monto
    });
    porCompra[compraId].montoTotal += monto;
  });

  var compras = orden.map(function(id) { return porCompra[id]; })
    .sort(function(a, b) { return (b.fecha || 0) - (a.fecha || 0); });

  // Comprobantes (foto/PDF) guardados en Drive para cada compra — ver
  // Comprobantes.gs. Solo se agrega el campo cuando la compra tiene alguno;
  // si ese archivo no está pegado todavía, esto no hace nada.
  try {
    if (typeof _comprobantesPorCompra_ === 'function') {
      var comp = _comprobantesPorCompra_();
      compras.forEach(function(c) { if (comp[c.compraId]) c.comprobantes = comp[c.compraId]; });
    }
  } catch (e) { /* los comprobantes son un extra: nunca rompen el historial */ }

  return { ok: true, compras: compras };
}

// Última compra registrada a un proveedor puntual (comparación sin
// importar mayúsculas/tildes, mismo criterio que usa _norm() en el resto
// del sistema) — para el botón "Repetir última compra a este proveedor"
// del carrito de Registrar compra. Devuelve null si ese proveedor nunca
// tuvo una compra itemizada.
function getUltimaCompraProveedor(proveedorNombre, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var clave = _norm(proveedorNombre);
  if (!clave) return { ok: true, compra: null };

  var r = getHistorialCompras(token, 0);
  if (!r.ok) return r;

  var match = r.compras.filter(function(c) { return _norm(c.proveedor) === clave; })[0] || null;
  return { ok: true, compra: match };
}

// Interno — de uso exclusivo de calcularCostoReceta() en NUEVO-Recetas.gs.
// Busca el precio unitario de la compra itemizada más reciente de un
// insumo.
function getUltimoPrecioInsumo_(sku) {
  var ws = ensureHojaComprasInsumos_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return null;
  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_COMPRAS_INSUMOS.length).getValues();
  var ultimo = null;
  // Las filas se van agregando en orden cronológico (más adelante en la
  // hoja = más reciente), así que la última coincidencia del recorrido
  // es siempre la compra más reciente de ese SKU.
  filas.forEach(function(r) {
    if (String(r[3]).trim() === sku) {
      // "unidad" es la unidad en la que está expresado precioUnitario (col. G
      // del ledger) — hace falta para llevar el precio a la unidad de la
      // receta (auditoría H1) en vez de promediar kg con gramos.
      ultimo = { precioUnitario: Number(r[7]) || 0, fecha: r[0], compraId: r[1], unidad: String(r[6] || '') };
    }
  });
  return ultimo;
}
