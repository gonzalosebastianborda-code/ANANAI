// ═══════════════════════════════════════════════════════════════
// ✅ ESTE SÍ ES UN ARCHIVO NUEVO — se agrega como pestaña nueva en el
// proyecto de Apps Script, con este nombre o el que prefieras.
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · ETAPA 2 (bonus) — módulo de Recetas (archivo nuevo)
// ═══════════════════════════════════════════════════════════════
// ⚠ CORREGIDO — esta es la 2° versión. Al armar la Etapa 4 (Consultas)
// volví a revisar a fondo el mockup y encontré que renderRecetaDetail()/
// agregarIngrediente() (la pantalla de Recetas real que ya aprobaste)
// arma cada línea de receta por FAMILIA de insumo ("Harinas y
// cereales", "Lácteos y grasas", etc.), no por un insumo puntual — la
// razón, tal cual la dejé anotada en el propio mockup: "el costo se
// calcula con el precio promedio de la familia, no de una marca
// puntual — así la receta sigue siendo válida aunque compres la harina
// a distintos proveedores en distintos momentos". Mi primera versión
// de este archivo ataba cada línea a un SKU de insumo específico, lo
// cual no coincide. Esta versión ya sigue la lógica por familia, igual
// que precioPromedioFamilia() del mockup. Si ya habías pegado la
// versión anterior en tu copia de prueba, reemplazala entera por esta
// (incluida la hoja "Recetas" — cambian sus columnas).
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO: la hoja nueva "Recetas" (no existía nada de esto en el
// sistema real — lo confirmé revisando todo el proyecto), configurable
// a mano o desde un panel del Dashboard, sin tocar código para cargar
// recetas reales — es el requisito de "que sea fácil configurar las
// recetas después" que habías pedido. Cada línea es: qué FAMILIA de
// insumo (la misma que ya usa el Catálogo en su columna "Categoría"
// para los SKU tipo Insumo) y cuánta cantidad de esa familia lleva una
// unidad del producto terminado.
//
// CÓMO SE CALCULA EL COSTO, calcado de precioPromedioFamilia() del
// mockup: para cada familia de la receta, se promedia el ÚLTIMO precio
// pagado (de la hoja "Compras Insumos", NUEVO-Compras.gs) de TODOS los
// insumos del Catálogo que estén en esa familia y que ya tengan al
// menos una compra itemizada — sin ponderar por stock ni por volumen,
// simple promedio aritmético, igual que el mockup. Si ninguno de los
// insumos de una familia tiene todavía compras registradas, el costo
// de esa línea (y por lo tanto el total) se marca incompleto en vez de
// devolver un número que en realidad vale $0 sin avisar.
//
// DE QUÉ DEPENDE (ya existe, no hace falta tocar nada):
//   - _catalogoPorSku_(), ensureHojaCatalogo_(), ENCABEZADOS_CATALOGO,
//     estiloHeader(), DATA_ROW → Produccion.gs / Código.gs
//   - _requiereRol_(), _conLock_() → Auth.gs / Pedidos.gs
//   - getUltimoPrecioInsumo_() → NUEVO-Compras.gs (se entrega junto con
//     este archivo — hace falta agregar ESE archivo también)
//
// CÓMO PROBAR EN LA COPIA:
//   1. Creá 2 insumos en la misma familia con crearInsumoNuevo() (ej.
//      'Harina 000' y 'Harina integral', familia 'Harinas y cereales').
//   2. guardarReceta('FAC-001', [
//        {familia:'Harinas y cereales', cantidadPorUnidad:0.05, unidad:'kg'}
//      ], token) con token de Gerente (FAC-001 = Medialunas).
//      → tiene que devolver ok:true, lineasGuardadas:1. Revisar la hoja
//        "Recetas" nueva → una fila con esos datos.
//   3. calcularCostoReceta('FAC-001', token) ANTES de cargar ninguna
//      compra de esos insumos → tiene que devolver ok:true,
//      incompleto:true, costoTotal:null.
//   4. Registrar una compra itemizada (NUEVO-Compras.gs) de 'Harina
//      000' a $800/kg y otra de 'Harina integral' a $900/kg. Volver a
//      llamar calcularCostoReceta('FAC-001', token) → ahora tiene que
//      devolver incompleto:false y costoTotal = 0.05 × 850 (el
//      promedio de 800 y 900), tal cual haría precioPromedioFamilia()
//      en el mockup.
//   5. guardarReceta('FAC-001', [...nueva lista...], token) de nuevo con
//      líneas distintas → tiene que reemplazar TODAS las líneas viejas
//      de FAC-001 por las nuevas (no acumularlas), sin tocar las líneas
//      de ningún otro producto.
// ═══════════════════════════════════════════════════════════════

var H_RECETAS = 'Recetas';
var ENCABEZADOS_RECETAS = [
  'SKU Producto', 'Producto', 'Familia de Insumo', 'Cantidad por unidad', 'Unidad', 'Obs'
];

function ensureHojaRecetas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_RECETAS);
  if (!ws) {
    ws = ss.insertSheet(H_RECETAS);
    ws.getRange('A1').setValue('AÑAÑAI · Recetas — cuánta FAMILIA de insumo lleva cada unidad de un producto terminado (no un insumo puntual, para que la receta no dependa de a qué proveedor le compraste ese mes). Se puede completar acá a mano o desde el panel de Recetas del Dashboard.');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_RECETAS.length), '#5B3A29'); // Código.gs
    ws.getRange(2, 1, 1, ENCABEZADOS_RECETAS.length).setValues([ENCABEZADOS_RECETAS]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  // Las recetas "limpias" (RecetasLimpias.gs) se cargan solas, UNA vez por
  // versión, la primera vez que se usa la hoja. Sin ese archivo no pasa nada.
  if (typeof _asegurarRecetasLimpias_ === 'function') _asegurarRecetasLimpias_();
  return ws;
}

// Interno — lee las líneas de Recetas para un producto, sin control de rol
// (lo usan las funciones públicas de abajo, que sí controlan el token).
function _lineasDeReceta_(skuProducto) {
  var ws = ensureHojaRecetas_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return [];
  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_RECETAS.length).getValues();
  return filas.filter(function(r) { return String(r[0]).trim() === skuProducto; })
    .map(function(r) {
      return { skuProducto: r[0], producto: r[1], familia: String(r[2] || '').trim(),
               cantidadPorUnidad: Number(r[3]) || 0, unidad: r[4], obs: r[5] };
    });
}

// Guarda la receta completa de un producto: REEMPLAZA todas las líneas
// existentes de ese SKU por las que llegan acá (no las suma, no las
// mergea) — simple y sin ambigüedad. Las líneas de los demás productos
// no se tocan.
// lineas: [{ familia, cantidadPorUnidad, unidad, obs }, ...] — familia
// es texto libre (mismo criterio que "+ Nueva familia" en el mockup: no
// hace falta que ya exista ningún insumo en esa familia todavía).
function guardarReceta(skuProducto, lineas, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var cat = _catalogoPorSku_(skuProducto); // Producción.gs
  if (!cat) return { ok: false, mensaje: 'SKU de producto no encontrado en el Catálogo.' };
  if (!lineas) lineas = [];

  return _conLock_(function() {
    var ws = ensureHojaRecetas_();
    var last = ws.getLastRow();

    var filasAConservar = [];
    if (last >= DATA_ROW) {
      var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_RECETAS.length).getValues();
      filas.forEach(function(r) { if (String(r[0]).trim() !== skuProducto) filasAConservar.push(r); });
      ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_RECETAS.length).clearContent();
    }

    var nuevasFilas = [];
    var errores = [];
    lineas.forEach(function(li) {
      var familia = String(li.familia || '').trim();
      var cantidad = Number(li.cantidadPorUnidad);
      if (!familia) { errores.push('Falta la familia de insumo en una línea.'); return; }
      if (!cantidad || cantidad <= 0) { errores.push('Falta la cantidad por unidad de "' + familia + '".'); return; }
      if (!isFinite(cantidad)) { errores.push('La cantidad por unidad de "' + familia + '" no es un número válido.'); return; }
      nuevasFilas.push([skuProducto, _sanTxt_(cat.nombre), _sanTxt_(familia), cantidad, _sanTxt_(li.unidad || ''), _sanTxt_(li.obs || '')]);
    });

    var todasLasFilas = filasAConservar.concat(nuevasFilas);
    if (todasLasFilas.length) {
      ws.getRange(DATA_ROW, 1, todasLasFilas.length, ENCABEZADOS_RECETAS.length).setValues(todasLasFilas);
    }

    var mensaje = '✅ Receta de ' + cat.nombre + ' guardada — ' + nuevasFilas.length + ' familia(s) de insumo.';
    if (errores.length) mensaje += ' ⚠ Se ignoraron: ' + errores.join(' · ');
    return { ok: true, sku: skuProducto, lineasGuardadas: nuevasFilas.length, errores: errores, mensaje: mensaje };
  });
}

// Devuelve la receta de un producto (para prellenar una pantalla de edición).
function getRecetaDeProducto(skuProducto, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  return { ok: true, lineas: _lineasDeReceta_(skuProducto) };
}

// Lista todas las recetas cargadas, agrupadas por producto — para un
// panel general de "Recetas" en el Dashboard.
function listarRecetasTodas(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var ws = ensureHojaRecetas_();
  var last = ws.getLastRow();
  if (last < DATA_ROW) return { ok: true, recetas: [] };

  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_RECETAS.length).getValues();
  var porProducto = {};
  var orden = [];
  filas.forEach(function(r) {
    var sku = String(r[0]).trim();
    if (!sku) return;
    if (!porProducto[sku]) { porProducto[sku] = { skuProducto: sku, producto: r[1], lineas: [] }; orden.push(sku); }
    porProducto[sku].lineas.push({
      familia: String(r[2] || '').trim(), cantidadPorUnidad: Number(r[3]) || 0, unidad: r[4], obs: r[5]
    });
  });

  return { ok: true, recetas: orden.map(function(sku) { return porProducto[sku]; }) };
}

// Interno — precio promedio de una familia de insumo: promedio simple
// del ÚLTIMO precio pagado (NUEVO-Compras.gs) de todos los SKU del
// Catálogo que sean Tipo='Insumo' y tengan esa Categoría, y que ya
// tengan al menos una compra itemizada. Mismo criterio exacto que
// precioPromedioFamilia() en el mockup.
//
// ── AUDITORÍA H1 ── el precio de cada compra está expresado en la unidad
// en que se compró (ej. $6.000 por kg) y la receta puede usar otra (ej. 20
// gramos). Antes se promediaban los precios tal cual y se multiplicaban por
// los 20 gramos: 20 g × $6.000/kg daba $120.000 en vez de $120. Ahora, si se
// pasa "unidadReceta", cada precio se lleva primero a esa unidad. Una marca
// cuya unidad no se puede convertir a la de la receta (ej. kg vs. paquete)
// no entra al promedio y se informa en "sinConversion". Sin "unidadReceta"
// (o con receta sin unidad) se comporta exactamente como antes.
function _precioPromedioFamiliaInfo_(familia, unidadReceta) {
  var ws = ensureHojaCatalogo_(); // Producción.gs
  var last = ws.getLastRow();
  if (last < DATA_ROW) return { precio: null, sinConversion: [] };
  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues();

  var precios = [];
  var sinConversion = [];
  filas.forEach(function(r) {
    if (String(r[3]).trim() !== 'Insumo') return;
    if (String(r[2] || '').trim() !== familia) return;
    var precio = getUltimoPrecioInsumo_(String(r[0]).trim()); // NUEVO-Compras.gs
    if (!precio || !(precio.precioUnitario > 0)) return;
    var p = precio.precioUnitario;
    var unidadPrecio = precio.unidad || r[4]; // unidad del ledger; si falta, la del Catálogo
    if (unidadReceta && unidadPrecio) {
      // 1 unidad de receta = x unidades de precio  →  precio por unidad de receta = p × x
      var uno = _convertirCantidad_(1, unidadReceta, unidadPrecio); // Producción.gs
      if (!uno.ok) { sinConversion.push(String(r[1] || r[0]) + ' (' + unidadPrecio + ' ↔ ' + unidadReceta + ')'); return; }
      p = p * uno.cantidad;
    }
    precios.push(p);
  });

  if (!precios.length) return { precio: null, sinConversion: sinConversion };
  return { precio: precios.reduce(function(s, p) { return s + p; }, 0) / precios.length, sinConversion: sinConversion };
}

function _precioPromedioFamilia_(familia, unidadReceta) {
  return _precioPromedioFamiliaInfo_(familia, unidadReceta).precio;
}

// Costo por unidad de un producto terminado, según su receta y el
// precio promedio de cada familia de insumo. Si alguna familia de la
// receta todavía no tiene ningún insumo con compras itemizadas, el
// costo se marca incompleto en vez de devolver un número que ignora
// esa parte sin avisar.
function calcularCostoReceta(skuProducto, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var lineas = _lineasDeReceta_(skuProducto);
  if (!lineas.length) return { ok: false, mensaje: 'Este producto todavía no tiene receta cargada.' };

  var costoTotal = 0;
  var incompleto = false;
  var avisosUnidades = [];
  var detalle = lineas.map(function(li) {
    var info = _precioPromedioFamiliaInfo_(li.familia, li.unidad);
    var precioProm = info.precio;
    if (info.sinConversion.length) {
      avisosUnidades.push('Familia "' + li.familia + '": no se pudo comparar unidades de ' + info.sinConversion.join(', ') + '.');
    }
    if (precioProm == null) {
      incompleto = true;
      return { familia: li.familia, cantidadPorUnidad: li.cantidadPorUnidad, unidad: li.unidad, precioPromedio: null, subtotal: null };
    }
    var subtotal = li.cantidadPorUnidad * precioProm;
    costoTotal += subtotal;
    return { familia: li.familia, cantidadPorUnidad: li.cantidadPorUnidad, unidad: li.unidad, precioPromedio: precioProm, subtotal: subtotal };
  });

  return {
    ok: true, sku: skuProducto, costoTotal: incompleto ? null : costoTotal, detalle: detalle, incompleto: incompleto,
    avisosUnidades: avisosUnidades,
    mensaje: incompleto
      ? '⚠ Costo incompleto — todavía falta al menos una compra itemizada de algún insumo de alguna de las familias de esta receta.'
        + (avisosUnidades.length ? ' ' + avisosUnidades.join(' ') : '')
      : '✅ Costo por unidad: $' + costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + '.'
        + (avisosUnidades.length ? ' ⚠ ' + avisosUnidades.join(' ') : '')
  };
}

// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · ETAPA 5 (agregado a este mismo archivo) — le faltaba al
// PedidosForm.html extendido una forma de listar los productos
// TERMINADOS del Catálogo (no los insumos) para el selector "¿qué
// producto tiene esta receta?" de la pantalla de Recetas. Mismo patrón
// exacto que getCatalogoInsumos() (NUEVO-Insumos.gs), filtrando el otro
// Tipo del mismo Catálogo.
// ═══════════════════════════════════════════════════════════════
function getCatalogoTerminados(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var ws = ensureHojaCatalogo_(); // Producción.gs
  var last = ws.getLastRow();
  if (last < DATA_ROW) return { ok: true, productos: [] };

  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues();
  var productos = [];
  filas.forEach(function(r) {
    if (String(r[3]).trim() !== 'Terminado') return;
    var sku = String(r[0]).trim();
    if (!sku) return;
    productos.push({ sku: sku, nombre: r[1], categoria: r[2],
      factor: (Number(r[6]) > 0 ? Number(r[6]) : 1), unidadDespacho: String(r[5] || '').trim(), unidadProduccion: String(r[4] || '').trim() });
  });

  return { ok: true, productos: productos };
}
