// ═══════════════════════════════════════════════════════════════
// ✅ ESTE SÍ ES UN ARCHIVO NUEVO — se agrega como pestaña nueva en el
// proyecto de Apps Script (Archivo → Nuevo → Script), con este mismo
// nombre o el que prefieras (no pisa nada existente, así que el nombre
// no es crítico como en los parches — pero "NUEVO-Insumos" ayuda a
// distinguirlo de un vistazo).
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · ETAPA 2 (parte 2 de 3) — módulo de Insumos (archivo nuevo)
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO: hoy el Catálogo (Produccion.gs) ya distingue dos "Tipo"
// de SKU: 'Terminado' (lo que se vende) e 'Insumo' (materia prima /
// insumos de producción) — de hecho ya hay 5 insumos de ejemplo
// cargados (INSU-001 a INSU-005: Masa para Medialuna, Relleno para
// Sandwich, Relleno de Pollo, Relleno Capresse, Laminado) y la hoja
// "Stock" ya trackea su cantidad exactamente igual que a los
// Terminados. Es decir: el "maestro de insumos" ya existe, es una
// parte del Catálogo — este archivo solo agrega la forma de sumarle
// insumos nuevos sin tocar la hoja a mano (el botón "+ Nuevo" del
// mockup) y una función simple para listarlos en un dropdown.
//
// DE QUÉ DEPENDE (ya existe, no hace falta tocar nada):
//   - H_CATALOGO, ENCABEZADOS_CATALOGO, ensureHojaCatalogo_(),
//     ensureHojaAlias_(), DATA_ROW → Produccion.gs / Código.gs
//   - _requiereRol_(), _conLock_(), _norm() → Auth.gs / Pedidos.gs / Código.gs
//
// CÓMO PROBAR EN LA COPIA:
//   1. Llamar crearInsumoNuevo('Queso rallado', 'Insumos', 'kg', token)
//      con un token de sesión de Gerente → tiene que devolver ok:true
//      y un SKU nuevo tipo INSU-006 (el próximo libre, sin chocar con
//      los 5 que ya existen).
//   2. Revisar la hoja Catálogo → tiene que aparecer la fila nueva con
//      Tipo="Insumo". Revisar la hoja Alias → tiene que aparecer
//      "Queso rallado" apuntando a ese SKU.
//   3. Llamar crearInsumoNuevo() de nuevo con el mismo nombre → tiene
//      que devolver el SKU existente (ok:true, existente:true) en vez
//      de duplicarlo.
//   4. Llamar getCatalogoInsumos(token) → tiene que listar los 5
//      insumos originales + el nuevo, cada uno con su stock actual
//      (0 para el que recién se creó, hasta la primera compra).
// ═══════════════════════════════════════════════════════════════

// Da de alta un insumo nuevo en el Catálogo (Tipo='Insumo') y le siembra
// un alias preventivo con su propio nombre, para que _claveStock_ lo
// resuelva sin pasos manuales la primera vez que se compre o se use en
// una receta. Es el botón "+ Nuevo insumo" del panel de Compras/Recetas.
//
// "familia" es el mismo concepto que FAMILIAS_INSUMO en el mockup (ej.
// "Harinas y cereales", "Lácteos y grasas") — se guarda en la columna
// "Categoría" del Catálogo, que ya existía. Es texto libre a propósito:
// el mockup permite escribir una familia nueva sobre la marcha ("+
// Nueva familia"), no hace falta que ya exista. NUEVO-Recetas.gs arma
// el costo de cada receta agrupando los insumos por esta misma familia
// — por eso importa que acá y en Recetas se escriba siempre igual
// (mismas mayúsculas/tildes) para la misma familia.
function crearInsumoNuevo(nombre, familia, unidad, token, minimo, rubro) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  nombre = String(nombre || '').trim();
  if (!nombre) return { ok: false, mensaje: 'Falta el nombre del insumo.' };
  familia = String(familia || '').trim() || 'Insumos';
  unidad = String(unidad || '').trim() || 'kg';
  // Rubro (opcional): solo agrupa la pantalla de Stock — ver Rubros.gs. Sin
  // rubro, el insumo se crea igual que siempre (la columna queda vacía).
  rubro = String(rubro || '').trim();
  // Stock mínimo para la alerta de "bajo mínimo" — opcional, en la misma
  // unidad del insumo. '' / null / undefined = sin configurar (no dispara
  // alerta, mismo criterio que ya usa insEstado() en el frontend).
  var minimoVal = (minimo === '' || minimo == null) ? '' : Number(minimo);
  if (minimoVal !== '' && (!(minimoVal >= 0) || !isFinite(minimoVal))) {
    return { ok: false, mensaje: 'El stock mínimo tiene que ser un número mayor o igual a 0.' };
  }

  return _conLock_(function() {
    var ws = ensureHojaCatalogo_(); // Producción.gs
    var last = ws.getLastRow();

    // ¿Ya existe un insumo con ese nombre (sin importar mayúsculas/acentos)?
    // Si es así, no se duplica — se devuelve el SKU existente para que la
    // línea de Compras/Receta lo use directo.
    if (last >= DATA_ROW) {
      var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues();
      for (var i = 0; i < filas.length; i++) {
        if (String(filas[i][3]).trim() === 'Insumo' && _norm(filas[i][1]) === _norm(nombre)) {
          return {
            ok: true, existente: true, sku: filas[i][0], nombre: filas[i][1],
            mensaje: 'Ya existía un insumo con ese nombre — se usa "' + filas[i][0] + '".'
          };
        }
      }
    }

    // ── AUDITORÍA H9 ── el alias que se siembra más abajo es el nombre tal
    // cual. Si ese nombre YA resuelve a algo que no es un insumo (ej. un
    // producto terminado "Medialunas"), el insumo nuevo quedaría con un
    // alias duplicado y nunca se podría resolver por nombre sin pisar o
    // ser pisado por el producto. Se frena antes de crear nada.
    var yaResuelve = _claveStock_(nombre, ''); // Producción.gs
    if (yaResuelve.ok && yaResuelve.catalogo && yaResuelve.catalogo.tipo !== 'Insumo') {
      return {
        ok: false,
        mensaje: '⛔ "' + nombre + '" ya es el nombre de un producto (' + yaResuelve.sku + ' — ' + yaResuelve.catalogo.nombre
          + '). Elegí otro nombre para el insumo, por ejemplo agregando la marca o "(insumo)".'
      };
    }

    // Genera el próximo SKU INSU-### mirando solo los SKU que ya empiezan
    // con "INSU-". OJO: genId() (Código.gs) NO sirve acá — mira TODA la
    // columna A del Catálogo, que tiene PAN-, TART-, PIZZ-, FAC-, etc.
    // mezclados con los INSU-, y devolvería un número mal (por ejemplo
    // "INSU-017" si el máximo de la hoja es PAN-016, en vez de "INSU-006").
    var maxNum = 0;
    if (last >= DATA_ROW) {
      var col = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 1).getValues();
      col.forEach(function(r) {
        var m = String(r[0]).match(/^INSU-(\d+)$/);
        if (m) { var n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
      });
    }
    var seq = maxNum + 1;
    var sku = 'INSU-' + (seq < 10 ? '00' + seq : seq < 100 ? '0' + seq : String(seq));

    var fila = Math.max(DATA_ROW, ws.getLastRow() + 1);
    // Mismo formato de fila que CATALOGO_DATA: SKU, Nombre, Categoría, Tipo,
    // Unidad de producción, Unidad de despacho, Factor equivalencia. Los
    // insumos no despachan directo, así que unidad de despacho y factor
    // quedan vacíos (igual que INSU-001..005 ya cargados).
    // Los textos libres se guardan neutralizados ("=..." no se evalúa); la
    // lógica de arriba y lo que se devuelve usan el texto original.
    ws.getRange(fila, 1, 1, ENCABEZADOS_CATALOGO.length).setValues([[sku, _sanTxt_(nombre), _sanTxt_(familia), 'Insumo', _sanTxt_(unidad), '', '', minimoVal]]);
    // Rubro en su columna propia (se agrega sola al final del Catálogo la
    // primera vez; no toca ninguna columna existente).
    if (rubro && typeof _colRubro_ === 'function') {
      ws.getRange(fila, _colRubro_(ws)).setValue(_sanTxt_(rubro));
    }

    // Alias preventivo: el texto tal cual se escribió → este SKU.
    var wsAlias = ensureHojaAlias_(); // Producción.gs
    var filaAlias = Math.max(DATA_ROW, wsAlias.getLastRow() + 1);
    wsAlias.getRange(filaAlias, 1, 1, 2).setValues([[_sanTxt_(nombre), sku]]);

    return {
      ok: true, existente: false, sku: sku, nombre: nombre,
      mensaje: '✅ Insumo nuevo creado: ' + sku + ' — ' + nombre + '.'
    };
  });
}

// Lista los insumos activos (Tipo='Insumo' en el Catálogo) con su stock
// actual, para poblar el selector de insumos en Compras y en Recetas.
function getCatalogoInsumos(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var ws = ensureHojaCatalogo_(); // Producción.gs
  var last = ws.getLastRow();
  if (last < DATA_ROW) return { ok: true, insumos: [] };

  var wsStock = ensureHojaStock_(); // Producción.gs
  var lastStock = wsStock.getLastRow();
  var stockPorSku = {};
  if (lastStock >= DATA_ROW) {
    wsStock.getRange(DATA_ROW, 1, lastStock - DATA_ROW + 1, 3).getValues().forEach(function(r) {
      if (r[0]) stockPorSku[String(r[0]).trim()] = Number(r[2]) || 0;
    });
  }

  var filas = ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues();
  // Rubro de cada insumo (Rubros.gs): el del registro de subrubros si su
  // familia está ahí; si no, el guardado en el Catálogo; si no, "Sin clasificar".
  var rubroCol = null, registro = [];
  if (typeof _colRubro_ === 'function' && typeof _leerSubrubros_ === 'function') {
    try {
      rubroCol = ws.getRange(DATA_ROW, _colRubro_(ws), last - DATA_ROW + 1, 1).getValues();
      registro = _leerSubrubros_();
    } catch (eRubro) { rubroCol = null; registro = []; }
  }
  var insumos = [];
  filas.forEach(function(r, i) {
    if (String(r[3]).trim() !== 'Insumo') return;
    var sku = String(r[0]).trim();
    if (!sku) return;
    var rubroGuardado = rubroCol ? String(rubroCol[i][0] || '').trim() : '';
    insumos.push({
      sku: sku, nombre: r[1], familia: r[2], unidad: r[4],
      stock: stockPorSku[sku] || 0,
      minimo: (r[7] === '' || r[7] == null) ? null : Number(r[7]),
      rubro: rubroCol ? _rubroDeFamilia_(registro, String(r[2] || '').trim(), rubroGuardado) : ''
    });
  });

  return { ok: true, insumos: insumos };
}
