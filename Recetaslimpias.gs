// ═══════════════════════════════════════════════════════════════
// ✅ ARCHIVO NUEVO — se agrega como pestaña nueva en el proyecto de
// Apps Script (Archivo → Nuevo → Script), con el nombre "RecetasLimpias".
// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Carga de las recetas limpias (las del Excel "Recetas y
// catálogo limpios") al sistema
// ═══════════════════════════════════════════════════════════════
//
// QUÉ ES ESTO: las 25 recetas de tu planilla de recetas ya limpias (por
// UNIDAD de producto, líquidos en ml, nombres unificados a subrubros).
// DESDE 12/10/2026 SE CARGAN SOLAS en la hoja "Recetas", sin ningún botón:
// ver "CARGA AUTOMÁTICA" más abajo. (El botón "Cargar recetas del Excel
// limpio" se sacó del panel; las funciones previsualizarRecetasLimpias /
// importarRecetasLimpias siguen en este archivo, sin botón, por si hicieran
// falta de nuevo.)
//
// LA MASA: cada receta de tartín y de pizza trae adentro la masa tal cual
// la del Excel de recetas original (no la detallan las fichas de
// producción): tartín = harina de almendras 100 g, sal 3 g, aceite 15 ml,
// polvo de hornear 4 g, mix de semillas 6 g, pimienta 1 g, pimentón 5 g;
// pizza = harina de almendras 200 g, levadura 0,5 g, aceite de oliva 6 ml,
// sal 12 g, tomate 50 g. Lo único que no se carga es el agua (no se compra).
// La sal y la pimienta del relleno de la ficha se SUMAN a las de la masa.
//
// ACTUALIZACIÓN 10/2026 — las que llevan el 4º dato 'Ficha de producción
// 06/10/2026' (6 tartines + Pizza Napoleón / Cuatro Poderes / Pesto y la
// nueva Pizza Fugaza) se rehicieron con las FICHAS DE PRODUCCIÓN nuevas:
//   · el relleno / la cobertura sale de la ficha; la MASA de tartín y de
//     pizza se mantiene como estaba (la ficha no la detalla);
//   · Pollo y Espinaca vienen pesados COCIDOS en la ficha: acá se cargan
//     en crudo (lo que se compra); Ajo y Huevo vienen en gramos: acá van en
//     unidades (1 huevo = 50 g, 1 cabeza de ajo = 50 g);
//   · Gouda = Queso holanda · Roquefort = Queso azul · Pechuga = Suprema;
//   · los "c/n" (cantidad necesaria) no tienen cantidad: solo se mantienen
//     los que la receta anterior ya traía (aceite de ajo, orégano).
// Al cargarlas, el panel muestra qué línea cambia respecto a la receta
// que hay hoy (antes → ahora).
//
// ACTUALIZACIÓN 12/10/2026 — las que llevan el 4º dato 'Planilla CVU
// 12/10/2026' salen de la hoja "CVU" de precios_productos.xlsx:
//   · NUEVAS (no tenían receta): Pan Ovalado, Pan Árabe, Bollo, Focaccia y
//     Prepizza;
//   · ACTUALIZADA: Fajitas (la planilla dice 35 g de harina + 1 g de sal);
//   · Pan Hamburguesa ("P Burguer") ya coincidía con la planilla: no cambia.
//   · El aceite de la planilla está en g: se carga en ml (1 g ≈ 1 ml, igual
//     que en el resto de las recetas).
// En las fichas de tartines, "Queso Gouda" de la ficha = Queso holanda del
// sistema y "Roquefort" = Queso azul (queda anotado en cada línea).
//
// SEGURIDAD: la carga automática se hace UNA sola vez por versión
// (RECETAS_LIMPIAS_VERSION_), reemplaza solo las líneas de los productos de
// este archivo y copia antes en la hoja "Recetas Respaldo" lo que hubiera
// cargado distinto. Después, lo que se edite desde el panel NO se pisa.
//
// DE QUÉ DEPENDE (ya existe): guardarReceta, _lineasDeReceta_, H_RECETAS,
// ensureHojaRecetas_ (Nuevo recetas.gs, que es quien la dispara) ·
// ensureHojaCatalogo_ (Produccion.gs) · _leerSubrubros_, SUBRUBROS_INICIALES
// (Rubros.gs).
// ═══════════════════════════════════════════════════════════════

// [SKU producto, nombre, [[subrubro (= familia de la receta), cantidad por unidad, unidad, obs], ...]]
var RECETAS_LIMPIAS_ = [
  ['TART-002', 'Tartín Pollo', [
    ['Harina de almendras', 100, 'g', ''],
    ['Sal himalaya', 3.4, 'g', 'suma 2 líneas (Masa 3 + Relleno 0,4)'],
    ['Aceite', 15, 'ml', ''],
    ['Polvo de hornear', 4, 'g', ''],
    ['Mix de semillas', 6, 'g', ''],
    ['Pimienta', 1.1, 'g', 'suma 2 líneas (Masa 1 + Relleno 0,1)'],
    ['Pimentón', 5, 'g', ''],
    ['Suprema', 100, 'g', 'ficha: 75 g de pechuga COCIDA ÷ 0,75 de rendimiento = 100 g crudos'],
    ['Cebolla', 25, 'g', ''],
    ['Morrón', 17, 'g', ''],
    ['Zanahoria', 17, 'g', ''],
    ['Puerro', 10, 'g', ''],
    ['Ajo', 0.04, 'unidad', 'ficha: 2 g ÷ 50 g por cabeza'],
    ['Perejil', 6, 'g', ''],
    ['Queso crema', 15, 'g', ''],
    ['Queso cremoso', 15, 'g', ''],
    ['Queso holanda', 15, 'g', 'ficha: Queso Gouda rallado'],
    ['Aceite de oliva', 4, 'ml', ''],
    ['Nuez moscada', 0.1, 'g', ''],
    ['Huevo', 0.78, 'unidad', 'ficha: huevo duro 14 g + huevo batido 25 g = 39 g ÷ 50 g por huevo']
  ], 'Ficha de producción 06/10/2026'],
  ['TART-007', 'Tartín Espinaca', [
    ['Harina de almendras', 100, 'g', ''],
    ['Sal himalaya', 3.4, 'g', 'suma 2 líneas (Masa 3 + Relleno 0,4)'],
    ['Aceite', 15, 'ml', ''],
    ['Polvo de hornear', 4, 'g', ''],
    ['Mix de semillas', 6, 'g', ''],
    ['Pimienta', 1.05, 'g', 'suma 2 líneas (Masa 1 + Relleno 0,05)'],
    ['Pimentón', 5, 'g', ''],
    ['Espinaca', 200, 'g', 'ficha: 67 g cocida y escurrida ≈ 200 g crudos (misma proporción 1:3 de la receta anterior)'],
    ['Ricota', 17, 'g', ''],
    ['Queso crema', 11, 'g', ''],
    ['Queso cremoso', 11, 'g', ''],
    ['Queso holanda', 8, 'g', 'ficha: Queso Gouda rallado'],
    ['Cebolla', 22, 'g', ''],
    ['Verdeo', 11, 'g', ''],
    ['Morrón', 11, 'g', ''],
    ['Perejil', 6, 'g', ''],
    ['Aceite de oliva', 3, 'ml', ''],
    ['Nuez moscada', 0.03, 'g', ''],
    ['Huevo', 0.84, 'unidad', 'ficha: huevo duro 14 g + huevo batido 28 g = 42 g ÷ 50 g por huevo']
  ], 'Ficha de producción 06/10/2026'],
  ['TART-005', 'Tartín Capresse', [
    ['Harina de almendras', 100, 'g', ''],
    ['Sal himalaya', 3.5, 'g', 'suma 2 líneas (Masa 3 + Relleno 0,5)'],
    ['Aceite', 19.5, 'ml', 'suma 2 líneas (Masa 15 + aceite de albahaca 4,5)'],
    ['Polvo de hornear', 4, 'g', ''],
    ['Mix de semillas', 6, 'g', ''],
    ['Pimienta', 1.1, 'g', 'suma 2 líneas (Masa 1 + Relleno 0,1)'],
    ['Pimentón', 5, 'g', ''],
    ['Tomate cherry', 91, 'g', ''],
    ['Queso cremoso', 45.5, 'g', ''],
    ['Queso holanda', 45.5, 'g', 'ficha: Queso Gouda rallado'],
    ['Albahaca', 0.015, 'unidad', 'aceite de albahaca de la ficha: 4,5 ml de los 30 ml anteriores → albahaca proporcional']
  ], 'Ficha de producción 06/10/2026'],
  ['TART-003', 'Tartín Cebolla y Queso', [
    ['Harina de almendras', 100, 'g', ''],
    ['Sal himalaya', 3.8, 'g', 'suma 2 líneas (Masa 3 + Relleno 0,8)'],
    ['Aceite', 15, 'ml', ''],
    ['Polvo de hornear', 4, 'g', ''],
    ['Mix de semillas', 6, 'g', ''],
    ['Pimienta', 1.1, 'g', 'suma 2 líneas (Masa 1 + Relleno 0,1)'],
    ['Pimentón', 5, 'g', ''],
    ['Cebolla', 200, 'g', ''],
    ['Queso cremoso', 60, 'g', ''],
    ['Queso crema', 20, 'g', ''],
    ['Queso holanda', 60, 'g', 'ficha: Queso Gouda rallado'],
    ['Aceite de oliva', 5, 'ml', ''],
    ['Orégano', 0.4, 'g', ''],
    ['Nuez moscada', 0.05, 'g', ''],
    ['Huevo', 1, 'unidad', 'ficha: huevo batido 50 g = 50 g ÷ 50 g por huevo']
  ], 'Ficha de producción 06/10/2026'],
  ['TART-004', 'Tartín Verduras y Roquefort', [
    ['Harina de almendras', 100, 'g', ''],
    ['Sal himalaya', 3.6, 'g', 'suma 2 líneas (Masa 3 + Relleno 0,6)'],
    ['Aceite', 15, 'ml', ''],
    ['Polvo de hornear', 4, 'g', ''],
    ['Mix de semillas', 6, 'g', ''],
    ['Pimienta', 1.1, 'g', 'suma 2 líneas (Masa 1 + Relleno 0,1)'],
    ['Pimentón', 5, 'g', ''],
    ['Cebolla', 70, 'g', ''],
    ['Morrón', 45, 'g', ''],
    ['Puerro', 25, 'g', ''],
    ['Tomate cherry', 35, 'g', ''],
    ['Calabaza', 45, 'g', ''],
    ['Ajo', 0.06, 'unidad', 'ficha: 3 g ÷ 50 g por cabeza'],
    ['Aceite de oliva', 6, 'ml', ''],
    ['Queso crema', 25, 'g', ''],
    ['Queso cremoso', 25, 'g', ''],
    ['Queso holanda', 30, 'g', 'ficha: Queso Gouda rallado'],
    ['Queso azul', 25, 'g', 'ficha: Roquefort en trozos'],
    ['Orégano', 0.3, 'g', ''],
    ['Huevo', 0.6, 'unidad', 'ficha: huevo batido 30 g = 30 g ÷ 50 g por huevo']
  ], 'Ficha de producción 06/10/2026'],
  ['TART-001', 'Tartín Jamón y Queso', [
    ['Harina de almendras', 100, 'g', ''],
    ['Sal himalaya', 4, 'g', 'suma 2 líneas (Masa, Relleno)'],
    ['Aceite', 15, 'ml', ''],
    ['Polvo de hornear', 4, 'g', ''],
    ['Mix de semillas', 6, 'g', ''],
    ['Pimienta', 1, 'g', ''],
    ['Pimentón', 5, 'g', ''],
    ['Jamón cocido', 100, 'g', ''],
    ['Queso holanda', 50, 'g', ''],
    ['Queso cremoso', 50, 'g', ''],
    ['Queso crema', 20, 'g', ''],
    ['Huevo', 1, 'unidad', '']
  ]],
  ['TART-006', 'Tartín Atún', [
    ['Harina de almendras', 100, 'g', ''],
    ['Sal himalaya', 3.4, 'g', 'suma 2 líneas (Masa 3 + Relleno 0,4)'],
    ['Aceite', 15, 'ml', ''],
    ['Polvo de hornear', 4, 'g', ''],
    ['Mix de semillas', 6, 'g', ''],
    ['Pimienta', 1.1, 'g', 'suma 2 líneas (Masa 1 + Relleno 0,1)'],
    ['Pimentón', 5, 'g', ''],
    ['Atún', 63, 'g', ''],
    ['Cebolla', 83, 'g', ''],
    ['Morrón', 42, 'g', ''],
    ['Zanahoria', 52, 'g', ''],
    ['Puerro', 21, 'g', ''],
    ['Ajo', 0.04, 'unidad', 'ficha: 2 g ÷ 50 g por cabeza'],
    ['Perejil', 10, 'g', ''],
    ['Queso crema', 21, 'g', ''],
    ['Queso cremoso', 21, 'g', ''],
    ['Queso holanda', 21, 'g', 'ficha: Queso Gouda rallado'],
    ['Aceite de oliva', 3, 'ml', ''],
    ['Orégano', 0.5, 'g', ''],
    ['Huevo', 0.84, 'unidad', 'ficha: huevo duro 16 g + huevo batido 26 g = 42 g ÷ 50 g por huevo']
  ], 'Ficha de producción 06/10/2026'],
  ['CHIP-001', 'Chipalmendras Común', [
    ['Fécula de mandioca', 250, 'g', ''],
    ['Queso de almendras', 150, 'g', ''],
    ['Leche de almendras', 50, 'ml', ''],
    ['Huevo', 0.5, 'unidad', ''],
    ['Sal himalaya', 8, 'g', ''],
    ['Aceite', 25, 'ml', ''],
    ['Naranja', 0.25, 'unidad', ''],
    ['Polvo de hornear', 10, 'g', '']
  ]],
  ['CHIP-002', 'Chipalmendras Vegano', [
    ['Fécula de mandioca', 250, 'g', ''],
    ['Queso de almendras', 150, 'g', ''],
    ['Leche de almendras', 50, 'ml', ''],
    ['Lino', 10, 'g', ''],
    ['Sal himalaya', 8, 'g', ''],
    ['Aceite', 25, 'ml', ''],
    ['Naranja', 0.25, 'unidad', ''],
    ['Polvo de hornear', 10, 'g', '']
  ]],
  ['PAN-001', 'Pan de Molde', [
    ['Harina de almendras', 500, 'g', ''],
    ['Sal himalaya', 28, 'g', ''],
    ['Aceite', 50, 'ml', ''],
    ['Levadura', 20, 'g', ''],
    ['Azúcar mascabo', 40, 'g', '']
  ]],
  ['PAN-002', 'Pan Hamburguesa', [
    ['Harina de almendras', 70, 'g', ''],
    ['Sal himalaya', 2, 'g', ''],
    ['Huevo', 0.1, 'unidad', ''],
    ['Azúcar mascabo', 2, 'g', ''],
    ['Manteca', 4, 'g', ''],
    ['Levadura', 1.5, 'g', '']
  ]],
  ['PAN-003', 'Pan Ovalado', [
    ['Harina de almendras', 80, 'g', ''],
    ['Sal himalaya', 2, 'g', ''],
    ['Huevo', 0.1, 'unidad', ''],
    ['Azúcar mascabo', 2, 'g', ''],
    ['Manteca', 8, 'g', ''],
    ['Levadura', 1.5, 'g', '']
  ], 'Planilla CVU 12/10/2026'],
  ['PAN-004', 'Pan Árabe', [
    ['Harina de almendras', 50, 'g', ''],
    ['Aceite', 3, 'ml', 'planilla CVU: 3 g de aceite de girasol, se carga en ml (1 g ≈ 1 ml)'],
    ['Sal himalaya', 2, 'g', ''],
    ['Levadura', 1, 'g', '']
  ], 'Planilla CVU 12/10/2026'],
  ['PAN-005', 'Bollo', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 2, 'g', ''],
    ['Aceite de oliva', 6, 'ml', 'planilla CVU: 6 g de aceite de oliva, se carga en ml (1 g ≈ 1 ml)'],
    ['Sal himalaya', 12, 'g', '']
  ], 'Planilla CVU 12/10/2026'],
  ['PAN-006', 'Focaccia', [
    ['Harina de almendras', 100, 'g', ''],
    ['Levadura', 2, 'g', ''],
    ['Aceite de oliva', 6, 'ml', 'planilla CVU: 6 g de aceite de oliva, se carga en ml (1 g ≈ 1 ml)'],
    ['Sal himalaya', 6, 'g', '']
  ], 'Planilla CVU 12/10/2026'],
  ['PAN-007', 'Prepizza', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 0.5, 'g', ''],
    ['Aceite de oliva', 6, 'ml', 'planilla CVU: 6 g de aceite de oliva, se carga en ml (1 g ≈ 1 ml)'],
    ['Sal himalaya', 12, 'g', ''],
    ['Tomate', 50, 'g', '']
  ], 'Planilla CVU 12/10/2026'],
  ['PIZZ-004', 'Pizza Napoleón', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 0.5, 'g', ''],
    ['Aceite de oliva', 6, 'ml', ''],
    ['Sal himalaya', 12, 'g', ''],
    ['Tomate', 50, 'g', ''],
    ['Salsa', 100, 'g', ''],
    ['Queso muzzarella', 160, 'g', ''],
    ['Tomate cherry', 100, 'g', ''],
    ['Aceitunas', 40, 'g', ''],
    ['Ajo', 0.1, 'unidad', 'ficha: "aceite de ajo c/n" → se mantiene la cantidad anterior'],
    ['Aceite', 10, 'ml', 'ficha: "aceite de ajo c/n" → se mantiene la cantidad anterior']
  ], 'Ficha de producción 06/10/2026'],
  ['PIZZ-005', 'Pizza Fugaza', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 0.5, 'g', ''],
    ['Aceite de oliva', 6, 'ml', ''],
    ['Sal himalaya', 12, 'g', ''],
    ['Tomate', 50, 'g', ''],
    ['Salsa', 100, 'g', ''],
    ['Queso muzzarella', 160, 'g', ''],
    ['Cebolla', 140, 'g', 'ficha: cebolla blanca 100 g + cebolla morada 40 g'],
    ['Aceitunas', 30, 'g', '']
  ], 'Ficha de producción 06/10/2026'],
  ['PIZZ-001', 'Pizza Cuatro Poderes', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 0.5, 'g', ''],
    ['Aceite de oliva', 6, 'ml', ''],
    ['Sal himalaya', 12, 'g', ''],
    ['Tomate', 50, 'g', ''],
    ['Salsa', 100, 'g', ''],
    ['Queso muzzarella', 100, 'g', ''],
    ['Queso azul', 40, 'g', ''],
    ['Queso holanda', 60, 'g', ''],
    ['Queso sardo', 40, 'g', ''],
    ['Aceitunas', 60, 'g', ''],
    ['Orégano', 1, 'g', 'ficha: "orégano c/n" → se mantiene la cantidad anterior']
  ], 'Ficha de producción 06/10/2026'],
  ['PIZZ-003', 'Pizza Pesto', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 0.5, 'g', ''],
    ['Aceite de oliva', 36, 'ml', 'suma 2 líneas (Masa 6 + Pesto 30)'],
    ['Sal himalaya', 13, 'g', 'suma 2 líneas (Masa 12 + Pesto 1)'],
    ['Tomate', 50, 'g', ''],
    ['Albahaca', 0.3, 'unidad', 'pesto (receta base): se mantiene desglosado; la ficha dice 50 g de salsa pesto'],
    ['Nuez', 10, 'g', ''],
    ['Queso sardo', 5, 'g', ''],
    ['Ajo', 0.1, 'unidad', ''],
    ['Queso muzzarella', 160, 'g', ''],
    ['Queso parmesano', 20, 'g', ''],
    ['Aceitunas', 40, 'g', '']
  ], 'Ficha de producción 06/10/2026'],
  ['PIZZ-006', 'Pizza Jota', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 0.5, 'g', ''],
    ['Aceite de oliva', 6, 'ml', ''],
    ['Sal himalaya', 12, 'g', ''],
    ['Tomate', 50, 'g', ''],
    ['Queso muzzarella', 150, 'g', ''],
    ['Salsa', 80, 'g', ''],
    ['Jamón crudo', 40, 'g', ''],
    ['Albahaca', 0.2, 'unidad', ''],
    ['Ajo', 0.1, 'unidad', ''],
    ['Aceitunas', 40, 'g', ''],
    ['Aceite', 10, 'ml', '']
  ]],
  ['PIZZ-002', 'Pizza Especial', [
    ['Harina de almendras', 200, 'g', ''],
    ['Levadura', 0.5, 'g', ''],
    ['Aceite de oliva', 6, 'ml', ''],
    ['Sal himalaya', 12, 'g', ''],
    ['Tomate', 50, 'g', ''],
    ['Queso muzzarella', 150, 'g', ''],
    ['Jamón cocido', 80, 'g', ''],
    ['Aceitunas', 40, 'g', ''],
    ['Orégano', 1, 'g', ''],
    ['Salsa', 80, 'g', '']
  ]],
  ['FAC-001', 'Medialunas', [
    ['Harina de almendras', 125, 'g', ''],
    ['Leche descremada', 25, 'ml', ''],
    ['Manteca', 62.5, 'g', ''],
    ['Azúcar mascabo', 25, 'g', ''],
    ['Sal himalaya', 2.5, 'g', ''],
    ['Levadura', 6.25, 'g', '']
  ]],
  ['PAN-008', 'Fajitas', [
    ['Harina de almendras', 35, 'g', ''],
    ['Sal himalaya', 1, 'g', '']
  ], 'Planilla CVU 12/10/2026'],
  ['OTR-002', 'Creps', [
    ['Harina de almendras', 66.666667, 'g', ''],
    ['Sal himalaya', 2, 'g', ''],
    ['Aceite', 3.333333, 'ml', '']
  ]]
];

function _recetasLimpiasLineas_(item) {
  return item[2].map(function(l) {
    return { familia: l[0], cantidadPorUnidad: l[1], unidad: l[2], obs: l[3] };
  });
}

// Cuántas líneas de receta tiene hoy cada SKU (para avisar qué se pisaría).
function _lineasPorSkuRecetas_() {
  var out = {};
  var act = _recetasActualesPorSku_();
  Object.keys(act).forEach(function(k) { out[k] = act[k].length; });
  return out;
}

// Todas las líneas de la hoja Recetas agrupadas por SKU (una sola lectura).
function _recetasActualesPorSku_() {
  var out = {};
  var ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_RECETAS);
  if (!ws) return out;
  var last = ws.getLastRow();
  if (last < DATA_ROW) return out;
  ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, 6).getValues().forEach(function(r) {
    var k = String(r[0] || '').trim();
    if (!k) return;
    (out[k] = out[k] || []).push({ familia: String(r[2] || '').trim(), cantidad: Number(r[3]) || 0, unidad: String(r[4] || '').trim() });
  });
  return out;
}

// Cantidad llevada a la unidad más chica de su grupo (g / ml / unidad) para
// poder decir si dos líneas son "la misma cantidad" aunque estén en kg y g.
function _cantBaseCmp_(q, u) {
  var n = _normalizarUnidad_(u);
  var info = n ? _UNIDAD_INFO_[n] : null;
  return info ? { v: q * info.factor, g: info.grupo } : { v: q, g: n || '' };
}
function _fmtCantCmp_(q, u) {
  var x = Math.round(Number(q) * 1000) / 1000;
  return String(x).replace('.', ',') + ' ' + String(u || '');
}

// Qué cambia la receta nueva respecto de la que hay cargada hoy.
function _cambiosContraActual_(item, actual) {
  var porFam = {};
  (actual || []).forEach(function(l) { porFam[_norm(l.familia)] = l; });
  var vistos = {}, res = { iguales: 0, cambian: [], nuevas: [], quitadas: [] };
  item[2].forEach(function(l) {
    var k = _norm(l[0]);
    vistos[k] = true;
    var a = porFam[k];
    if (!a) { res.nuevas.push(l[0] + ' ' + _fmtCantCmp_(l[1], l[2])); return; }
    var x = _cantBaseCmp_(a.cantidad, a.unidad), y = _cantBaseCmp_(l[1], l[2]);
    if (x.g === y.g && Math.abs(x.v - y.v) < 1e-6) res.iguales++;
    else res.cambian.push(l[0] + ': ' + _fmtCantCmp_(a.cantidad, a.unidad) + ' → ' + _fmtCantCmp_(l[1], l[2]));
  });
  (actual || []).forEach(function(l) {
    if (!vistos[_norm(l.familia)]) res.quitadas.push(l.familia + ' ' + _fmtCantCmp_(l.cantidad, l.unidad));
  });
  return res;
}

// ═══════════════════════════════════════════════════════════════
// CARGA AUTOMÁTICA (12/10/2026) — sin botones
// ═══════════════════════════════════════════════════════════════
// Las recetas de RECETAS_LIMPIAS_ se cargan SOLAS en la hoja "Recetas" la
// primera vez que el sistema usa una receta (abrir el panel, producir, ver
// un costo, la planilla de compras…): ensureHojaRecetas_() (Nuevo
// recetas.gs) llama a _asegurarRecetasLimpias_().
//   · UNA sola vez por versión: queda anotado en una propiedad del script
//     (RECETAS_LIMPIAS_AUTO_VERSION). Después, lo que se modifique desde el
//     panel (Recetas → modificar) se respeta y NO se vuelve a pisar.
//     Si algún día se cambia una receta de este archivo, se sube
//     RECETAS_LIMPIAS_VERSION_ y en el próximo uso se vuelven a cargar.
//   · Reemplaza SOLO las líneas de los productos de RECETAS_LIMPIAS_; las
//     recetas de cualquier otro producto no se tocan. Si una receta ya está
//     igual, no se toca.
//   · Lo que hubiera cargado distinto para esos productos se copia ANTES en
//     la hoja "Recetas Respaldo" (nada se pierde).
//   · Si falta un subrubro en el registro, se vuelve a crear con su rubro y
//     unidad de SUBRUBROS_INICIALES.
//   · No toma el lock a propósito: ensureHojaRecetas_ también se llama
//     desde adentro de funciones que ya lo tienen y el lock no es
//     reentrante. Escribe todo en UNA sola pasada y es idempotente.
//   · Si falla, NO marca la versión como cargada (reintenta en el próximo
//     uso) y nunca corta la pantalla ni la producción que la disparó.
var RECETAS_LIMPIAS_VERSION_ = '2026-10-12';
var PROP_RECETAS_LIMPIAS_AUTO_ = 'RECETAS_LIMPIAS_AUTO_VERSION';
var H_RECETAS_RESPALDO = 'Recetas Respaldo';
var ENCABEZADOS_RECETAS_RESPALDO = ['Fecha', 'Motivo', 'SKU Producto', 'Producto', 'Familia de Insumo', 'Cantidad por unidad', 'Unidad', 'Obs'];
var _recetasAutoListo_ = false;     // ya se resolvió en esta ejecución
var _recetasAutoEnCurso_ = false;   // evita volver a entrar mientras carga

function _asegurarRecetasLimpias_() {
  if (_recetasAutoListo_ || _recetasAutoEnCurso_) return;
  _recetasAutoEnCurso_ = true;
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(PROP_RECETAS_LIMPIAS_AUTO_) !== RECETAS_LIMPIAS_VERSION_) {
      var res = _cargarRecetasLimpiasAuto_();
      props.setProperty(PROP_RECETAS_LIMPIAS_AUTO_, RECETAS_LIMPIAS_VERSION_);
      Logger.log('Recetas limpias (carga automática ' + RECETAS_LIMPIAS_VERSION_ + '): ' + res.cargadas.length + ' cargadas, '
        + res.iguales.length + ' ya estaban iguales, ' + res.omitidas.length + ' omitidas'
        + (res.omitidas.length ? ' (' + res.omitidas.join(' · ') + ')' : '') + ', ' + res.respaldadas + ' líneas respaldadas.');
    }
  } catch (e) {
    try { Logger.log('Recetas limpias (carga automática): ' + e); } catch (x) {}
  } finally {
    _recetasAutoListo_ = true;       // un solo intento por ejecución, salga bien o mal
    _recetasAutoEnCurso_ = false;
  }
}

// Hoja donde se copia lo que la carga automática reemplaza.
function _hojaRespaldoRecetas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_RECETAS_RESPALDO);
  if (!ws) {
    ws = ss.insertSheet(H_RECETAS_RESPALDO);
    ws.getRange('A1').setValue('AÑAÑAI · Recetas Respaldo — copia de las líneas de receta que reemplazó la carga automática de recetas (RecetasLimpias.gs). Solo se agrega; el sistema no la usa para nada más.');
    ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');
    estiloHeader(ws.getRange(2, 1, 1, ENCABEZADOS_RECETAS_RESPALDO.length), '#5B3A29'); // Código.gs
    ws.getRange(2, 1, 1, ENCABEZADOS_RECETAS_RESPALDO.length).setValues([ENCABEZADOS_RECETAS_RESPALDO]);
    ws.setRowHeight(2, 30);
    ws.setFrozenRows(2);
  }
  return ws;
}

function _cargarRecetasLimpiasAuto_() {
  var res = { cargadas: [], iguales: [], omitidas: [], respaldadas: 0, subrubrosCreados: [] };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(H_RECETAS);   // ya la creó ensureHojaRecetas_
  if (!ws) return res;

  // 1) Catálogo de productos terminados: SKU → nombre (una sola lectura)
  var nombres = {};
  var wc = ensureHojaCatalogo_();          // Produccion.gs
  var lc = wc.getLastRow();
  if (lc >= DATA_ROW) {
    wc.getRange(DATA_ROW, 1, lc - DATA_ROW + 1, ENCABEZADOS_CATALOGO.length).getValues().forEach(function(r) {
      var sku = String(r[0] || '').trim();
      if (sku && String(r[3]).trim() === 'Terminado') nombres[sku] = String(r[1] || '').trim();
    });
  }

  // 2) Subrubros que falten en el registro (se vuelven a crear)
  var reg = _leerSubrubros_();
  var iniciales = {};
  SUBRUBROS_INICIALES.forEach(function(r) { iniciales[_norm(r[1])] = r; });
  var wsSub = null;
  RECETAS_LIMPIAS_.forEach(function(item) {
    if (!nombres[item[0]]) return;
    item[2].forEach(function(l) {
      if (_subrubroPorNombre_(reg, l[0])) return;
      var ini = iniciales[_norm(l[0])];
      if (!ini) return;                     // sin datos para crearlo: la línea se carga igual (la familia es texto libre)
      wsSub = wsSub || ensureHojaSubrubros_();
      var rubro = _rubroCanonico_(reg, ini[0]) || ini[0];
      var fila = Math.max(DATA_ROW, wsSub.getLastRow() + 1);
      wsSub.getRange(fila, 1, 1, ENCABEZADOS_SUBRUBROS.length).setValues([[_sanTxt_(rubro), _sanTxt_(ini[1]), ini[2], new Date(), 'Carga automática de recetas']]);
      reg.push({ rubro: rubro, nombre: ini[1], unidad: ini[2], fila: fila });
      res.subrubrosCreados.push(ini[1]);
    });
  });

  // 3) Lo que hay hoy en la hoja Recetas, por SKU
  var last = ws.getLastRow();
  var filas = last >= DATA_ROW ? ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_RECETAS.length).getValues() : [];
  var porSku = {};
  filas.forEach(function(r) { var k = String(r[0] || '').trim(); if (k) (porSku[k] = porSku[k] || []).push(r); });

  // 4) Qué recetas hay que cargar: las que no existen o son distintas
  var reemplazar = {}, nuevas = [], respaldo = [], ahora = new Date();
  RECETAS_LIMPIAS_.forEach(function(item) {
    var sku = item[0];
    if (!nombres[sku]) { res.omitidas.push(sku + ' ' + item[1] + ': no está en el Catálogo'); return; }
    var hoy = porSku[sku] || [];
    if (hoy.length) {
      var act = hoy.map(function(r) { return { familia: String(r[2] || '').trim(), cantidad: Number(r[3]) || 0, unidad: String(r[4] || '').trim() }; });
      var c = _cambiosContraActual_(item, act);
      if (hoy.length === item[2].length && !c.cambian.length && !c.nuevas.length && !c.quitadas.length) { res.iguales.push(sku); return; }
      hoy.forEach(function(r) {
        respaldo.push([ahora, 'Reemplazada por la carga automática de recetas ' + RECETAS_LIMPIAS_VERSION_, r[0], r[1], r[2], r[3], r[4], r[5]]);
      });
    }
    reemplazar[sku] = true;
    item[2].forEach(function(l) {
      nuevas.push([sku, _sanTxt_(nombres[sku]), _sanTxt_(l[0]), l[1], _sanTxt_(l[2]), _sanTxt_(l[3] || '')]);
    });
    res.cargadas.push(sku);
  });
  if (!res.cargadas.length) return res;

  // 5) Respaldo de lo que se reemplaza (solo si había algo distinto cargado)
  if (respaldo.length) {
    var wr = _hojaRespaldoRecetas_();
    wr.getRange(Math.max(DATA_ROW, wr.getLastRow() + 1), 1, respaldo.length, ENCABEZADOS_RECETAS_RESPALDO.length).setValues(respaldo);
    res.respaldadas = respaldo.length;
  }

  // 6) Escribir: se conserva todo lo de los demás productos y se agregan las nuevas
  var conservar = filas.filter(function(r) { return !reemplazar[String(r[0] || '').trim()]; });
  var todas = conservar.concat(nuevas);
  if (last >= DATA_ROW) ws.getRange(DATA_ROW, 1, last - DATA_ROW + 1, ENCABEZADOS_RECETAS.length).clearContent();
  ws.getRange(DATA_ROW, 1, todas.length, ENCABEZADOS_RECETAS.length).setValues(todas);
  return res;
}

// Vista previa: qué productos trae el Excel limpio, si están en el
// Catálogo, cuántas líneas tiene cada uno, si ya tienen receta cargada y,
// si la tienen, QUÉ cambiaría (línea por línea, antes → ahora).
function previsualizarRecetasLimpias(token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;

  var actuales = _recetasActualesPorSku_();
  var reg = _leerSubrubros_();
  var productos = RECETAS_LIMPIAS_.map(function(item) {
    var cat = _catalogoPorSku_(item[0]);
    var faltan = [];
    item[2].forEach(function(l) {
      if (!_subrubroPorNombre_(reg, l[0]) && faltan.indexOf(l[0]) === -1) faltan.push(l[0]);
    });
    var act = actuales[item[0]] || [];
    return {
      sku: item[0], nombre: item[1], enCatalogo: !!(cat && cat.tipo === 'Terminado'),
      nombreCatalogo: cat ? cat.nombre : '', lineas: item[2].length,
      lineasActuales: act.length, subrubrosPorCrear: faltan,
      fuente: item[3] || '',
      cambios: act.length ? _cambiosContraActual_(item, act) : null
    };
  });
  return { ok: true, productos: productos };
}

// Carga las recetas elegidas (lista de SKU). Cada una reemplaza solo las
// líneas de su producto. Si algún subrubro de la receta no está en el
// registro (alguien lo borró), se vuelve a crear antes con su rubro/unidad.
function importarRecetasLimpias(skus, token) {
  var chk = _requiereRol_(token, ['gerente', 'dueno']);
  if (!chk.ok) return chk;
  if (!skus || !skus.length) return { ok: false, mensaje: 'No elegiste ninguna receta para cargar.' };

  var iniciales = {};
  SUBRUBROS_INICIALES.forEach(function(r) { iniciales[_norm(r[1])] = r; });

  var cargadas = [], errores = [];
  skus.forEach(function(sku) {
    sku = String(sku || '').trim();
    var item = null;
    for (var i = 0; i < RECETAS_LIMPIAS_.length; i++) if (RECETAS_LIMPIAS_[i][0] === sku) { item = RECETAS_LIMPIAS_[i]; break; }
    if (!item) { errores.push(sku + ': no es una de las recetas del Excel limpio.'); return; }
    var cat = _catalogoPorSku_(sku);
    if (!cat || cat.tipo !== 'Terminado') { errores.push(sku + ' (' + item[1] + '): el producto no está en el Catálogo.'); return; }

    // Subrubros que falten en el registro
    var reg = _leerSubrubros_();
    var fallo = false;
    item[2].forEach(function(l) {
      if (fallo || _subrubroPorNombre_(reg, l[0])) return;
      var ini = iniciales[_norm(l[0])];
      if (!ini) { errores.push(sku + ': el subrubro "' + l[0] + '" no existe.'); fallo = true; return; }
      var rs = crearSubrubro(ini[0], ini[1], ini[2], token);
      if (!rs.ok) { errores.push(sku + ': ' + rs.mensaje); fallo = true; }
    });
    if (fallo) return;

    var r = guardarReceta(sku, _recetasLimpiasLineas_(item), token);
    if (r.ok && r.lineasGuardadas === item[2].length) cargadas.push({ sku: sku, nombre: item[1], lineas: r.lineasGuardadas });
    else errores.push(sku + ' (' + item[1] + '): ' + (r.mensaje || 'no se pudo guardar') + (r.errores && r.errores.length ? ' — ' + r.errores.join(' · ') : ''));
  });

  return {
    ok: cargadas.length > 0, cargadas: cargadas, errores: errores,
    mensaje: (cargadas.length ? '✅ ' + cargadas.length + ' receta(s) cargadas.' : '❌ No se cargó ninguna receta.')
      + (errores.length ? ' ⚠ ' + errores.join(' · ') : '')
  };
}
