// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Gastos.gs
// Módulo de Gastos: hojas, formularios, migración histórica
// ═══════════════════════════════════════════════════════════════

// ── PROVEEDORES INICIALES ────────────────────────────────────────
var PROVEEDORES_INIT = [
  ['PRV-001', 'El Jujeño',           'Cuenta corriente', 7],
  ['PRV-002', 'Nutrilleti',          'Cuenta corriente', 30],
  ['PRV-003', 'Heladería Polo Sur',  'Contado',          0],
  ['PRV-004', 'Cheek',               'Cuenta corriente', 15],
  ['PRV-005', 'Boninn',              'Cuenta corriente', 15],
  ['PRV-006', 'La Madrid',           'Cuenta corriente', 7],
  ['PRV-007', 'Nardelli SRL',        'Contado',          0],
  ['PRV-008', 'Carrefour',           'Contado',          0],
  ['PRV-009', 'San Carlos 365 SRL',  'Contado',          0],
  ['PRV-010', 'Econova Asesores',    'Cuenta corriente', 30],
  ['PRV-011', 'Añañai',              'Interno',          0],
];

// ── DATOS HISTÓRICOS EMBEBIDOS ───────────────────────────────────
// 117 registros migrados · período 24/04/2026 – 29/06/2026
// Columnas: [GAS-ID, Fecha, Grupo, Subgrupo, Descripcion, Proveedor,
//            Monto, Condicion, DiasPago, Estado, Obs]
var HIST_GASTOS = [["GAS-001", "2026-04-24", "A. Materia Prima", "A1. Proveedor consolidado", "nutriletti", "nutriletti", 950220, "Contado", 0, "Pendiente", ""], ["GAS-002", "2026-04-28", "D. CAPEX", "D1. Equipamiento e infraestructura", "seña campana", "", 100000, "Contado", 0, "Pagado", "transferencia"], ["GAS-003", "2026-04-29", "A. Materia Prima", "A1. Proveedor consolidado", "cebolla", "El jujeño", 13000, "Contado", 0, "Pagado", "transferencia"], ["GAS-004", "2026-04-29", "A. Materia Prima", "A1. Proveedor consolidado", "zanahoria chica", "El jujeño", 12000, "Contado", 0, "Pagado", "transferencia"], ["GAS-005", "2026-04-29", "A. Materia Prima", "A1. Proveedor consolidado", "tomate cherry", "El jujeño", 10000, "Contado", 0, "Pagado", "transferencia"], ["GAS-006", "2026-04-29", "A. Materia Prima", "A1. Proveedor consolidado", "", "El jujeño", 9500, "Contado", 0, "Pagado", "transferencia"], ["GAS-007", "2026-04-29", "A. Materia Prima", "A1. Proveedor consolidado", "puerro", "El jujeño", 3000, "Contado", 0, "Pagado", "transferencia"], ["GAS-008", "2026-04-29", "A. Materia Prima", "A1. Proveedor consolidado", "espinaca", "El jujeño", 48000, "Contado", 0, "Pagado", "transferencia"], ["GAS-009", "2026-04-30", "A. Materia Prima", "A1. Proveedor consolidado", "morron rojo", "El jujeño", 23000, "Contado", 0, "Pagado", "transferencia"], ["GAS-010", "2026-04-30", "A. Materia Prima", "A1. Proveedor consolidado", "cebolla", "El jujeño", 13000, "Contado", 0, "Pagado", "transferencia"], ["GAS-011", "2026-04-30", "A. Materia Prima", "A1. Proveedor consolidado", "atun", "", 122976, "Contado", 0, "Pendiente", ""], ["GAS-012", "2026-04-30", "D. CAPEX", "D1. Equipamiento e infraestructura", "stickers tartines", "", 150000, "Contado", 0, "Pagado", "transferencia"], ["GAS-013", "2026-05-04", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "Arreglo de heladera", "San Carlos 365 srl", 80000, "Contado", 0, "Pagado", "Transferencia"], ["GAS-014", "2026-05-04", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "Mano de obra de zócalos", "Nelson Adrián londero", 270000, "Contado", 0, "Pagado", "Transferencia"], ["GAS-015", "2026-05-04", "D. CAPEX", "D1. Equipamiento e infraestructura", "Molde budín x3 unidades", "Nardelli srl", 39531.22, "Contado", 0, "Pagado", "Transferencia"], ["GAS-016", "2026-05-05", "D. CAPEX", "D1. Equipamiento e infraestructura", "Molde budin x7 unidades", "", 42700, "Contado", 0, "Pagado", "Transferencia"], ["GAS-017", "2026-05-05", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "Ingenieras habilitación", "", 230000, "Contado", 0, "Pagado", "Transferencia"], ["GAS-018", "2026-05-07", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 12300, "Contado", 0, "Pagado", "Transferencia"], ["GAS-019", "2026-05-07", "C. Gastos Operativos", "C3. Honorarios profesionales", "Proyecto y datos", "Asesores", 750000, "Contado", 0, "Pagado", "Transferencia"], ["GAS-020", "2026-05-09", "B. Logística", "B1. Envíos y distribución", "Gasto Uber", "Añañai", 2930, "Contado", 0, "Pendiente", ""], ["GAS-021", "2026-05-11", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "Productos de limpieza", "", 19500, "Contado", 0, "Pagado", "Transferencia"], ["GAS-022", "2026-05-11", "B. Logística", "B1. Envíos y distribución", "gasto uber", "añañai", 5600, "Contado", 0, "Pagado", "transferencia"], ["GAS-023", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "morron rojo", "el jujeño", 25000, "Contado", 0, "Pagado", "transferencia"], ["GAS-024", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "cebolla", "el jujeño", 19000, "Contado", 0, "Pagado", "transferencia"], ["GAS-025", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "zanahoria", "el jujeño", 9000, "Contado", 0, "Pagado", "transferencia"], ["GAS-026", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "albahaca", "el jujeño", 16700, "Contado", 0, "Pagado", "transferencia"], ["GAS-027", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "cherry", "el jujeño", 15000, "Contado", 0, "Pagado", "transferencia"], ["GAS-028", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "perejil", "el jujeño", 12500, "Contado", 0, "Pagado", "transferencia"], ["GAS-029", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "cebollita", "el jujeño", 10500, "Contado", 0, "Pagado", "transferencia"], ["GAS-030", "2026-05-11", "A. Materia Prima", "A1. Proveedor consolidado", "espinaca", "el jujeño", 25000, "Contado", 0, "Pagado", "transferencia"], ["GAS-031", "2026-05-12", "A. Materia Prima", "A1. Proveedor consolidado", "nutriletti", "nutriletti", 109678, "Contado", 0, "Pendiente", ""], ["GAS-032", "2026-05-12", "B. Logística", "B1. Envíos y distribución", "Gasto Uber", "Añañai", 3400, "Contado", 0, "Pendiente", ""], ["GAS-033", "2026-05-12", "B. Logística", "B1. Envíos y distribución", "gasto uber", "añañai", 2900, "Contado", 0, "Pendiente", ""], ["GAS-034", "2026-05-13", "B. Logística", "B1. Envíos y distribución", "gasto uber", "añañai", 3000, "Contado", 0, "Pendiente", ""], ["GAS-035", "2026-05-14", "A. Materia Prima", "A1. Proveedor consolidado", "la madrid", "", 818276.47, "Contado", 0, "Pendiente", ""], ["GAS-036", "2026-05-14", "B. Logística", "B1. Envíos y distribución", "Gasto Uber", "Añañai", 2500, "Contado", 0, "Pendiente", ""], ["GAS-037", "2026-05-14", "A. Materia Prima", "A1. Proveedor consolidado", "El jujeño", "", 16500, "Contado", 0, "Pagado", "Transferencia"], ["GAS-038", "2026-05-15", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 11700, "Contado", 0, "Pagado", "Transferencia"], ["GAS-039", "2026-05-15", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6200, "Contado", 0, "Pendiente", ""], ["GAS-040", "2026-05-15", "A. Materia Prima", "A1. Proveedor consolidado", "atun", "cheek", 1450, "Contado", 0, "Pagado", "transferencia pago añañai"], ["GAS-041", "2026-05-15", "A. Materia Prima", "A1. Proveedor consolidado", "aceite 900 cc", "cheek", 1800, "Contado", 0, "Pagado", "transferencia pago añañai"], ["GAS-042", "2026-05-18", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3100, "Contado", 0, "Pendiente", ""], ["GAS-043", "2026-05-18", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3300, "Contado", 0, "Pendiente", ""], ["GAS-044", "2026-05-18", "A. Materia Prima", "A1. Proveedor consolidado", "", "nutrletti", 1485000, "Contado", 0, "Pendiente", ""], ["GAS-045", "2026-05-19", "A. Materia Prima", "A1. Proveedor consolidado", "leche de almendra x 4 u", "chino", 15200, "Contado", 0, "Pagado", "transferencia"], ["GAS-046", "2026-05-19", "A. Materia Prima", "A1. Proveedor consolidado", "levadura 500g 15u", "la madrid", 53000, "Contado", 0, "Pendiente", ""], ["GAS-047", "2026-05-19", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6800, "Contado", 0, "Pendiente", ""], ["GAS-048", "2026-05-20", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3500, "Contado", 0, "Pendiente", ""], ["GAS-049", "2026-05-21", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3100, "Contado", 0, "Pendiente", ""], ["GAS-050", "2026-05-26", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 5600, "Contado", 0, "Pendiente", ""], ["GAS-051", "2026-05-26", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 11700, "Contado", 0, "Pagado", ""], ["GAS-052", "2026-05-27", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3400, "Contado", 0, "Pendiente", ""], ["GAS-053", "2026-05-28", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "chip y carga de credito celular", "distribuidora añañai", 7000, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-054", "2026-05-28", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3000, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-055", "2026-05-29", "D. CAPEX", "D1. Equipamiento e infraestructura", "campaña", "", 400000, "Contado", 0, "Pagado", "transferencia"], ["GAS-056", "2026-05-29", "A. Materia Prima", "A1. Proveedor consolidado", "el jujeño", "", 53100, "Contado", 0, "Pagado", "transferencia pago distribuidora"], ["GAS-057", "2026-05-29", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6900, "Contado", 0, "Pendiente", ""], ["GAS-058", "2026-05-29", "A. Materia Prima", "A1. Proveedor consolidado", "la madrid", "", 432544.39, "Contado", 0, "Pendiente", ""], ["GAS-059", "2026-06-01", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "resipack", "", 367139, "Contado", 0, "Pagado", "transferencia pago añañai"], ["GAS-060", "2026-06-01", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3100, "Contado", 0, "Pendiente", ""], ["GAS-061", "2026-06-02", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "stickers", "", 434992, "Contado", 0, "Pagado", "transferencia - pago añañai"], ["GAS-062", "2026-06-02", "A. Materia Prima", "A1. Proveedor consolidado", "nutrilleti", "", 2026804.5, "Contado", 0, "Pendiente", ""], ["GAS-063", "2026-06-02", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "sise alarma", "", 50000, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-064", "2026-06-03", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "pago talonario", "", 4400, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-065", "2026-06-03", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3300, "Contado", 0, "Pendiente", ""], ["GAS-066", "2026-06-03", "A. Materia Prima", "A1. Proveedor consolidado", "Rothex huevos", "", 30000, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-067", "2026-06-04", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3300, "Contado", 0, "Pendiente", ""], ["GAS-068", "2026-06-04", "A. Materia Prima", "A1. Proveedor consolidado", "el jujeño", "", 29100, "Contado", 0, "Pagado", "transferencia pago añañai"], ["GAS-069", "2026-06-04", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 11800, "Contado", 0, "Pagado", "transferencia pago distribuidora"], ["GAS-070", "2026-06-05", "A. Materia Prima", "A1. Proveedor consolidado", "caja de suprema", "boninn", 110000, "Contado", 0, "Pendiente", ""], ["GAS-071", "2026-06-05", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6600, "Contado", 0, "Pendiente", ""], ["GAS-072", "2026-06-05", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "pago a nutriletti", "", 400000, "Contado", 0, "Pendiente", "transferencia pago añañai (parcial)"], ["GAS-073", "2026-06-07", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "pago mano de obra distribuidora", "", 130000, "Contado", 0, "Pagado", "transferencia pago distribuidora"], ["GAS-074", "2026-06-08", "A. Materia Prima", "A1. Proveedor consolidado", "la madrid", "", 79869, "Contado", 0, "Pendiente", ""], ["GAS-075", "2026-06-08", "A. Materia Prima", "A1. Proveedor consolidado", "copim condimentos", "", 38001, "Contado", 0, "Pagado", "pago añañai efectivo"], ["GAS-076", "2026-06-08", "A. Materia Prima", "A1. Proveedor consolidado", "nutriletti", "", 58590, "Contado", 0, "Pendiente", ""], ["GAS-077", "2026-06-09", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "compra contact publicidad", "", 34856, "Contado", 0, "Pagado", "transferencia pago distribuidora"], ["GAS-078", "2026-06-09", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 7600, "Contado", 0, "Pendiente", ""], ["GAS-079", "2026-06-10", "A. Materia Prima", "A1. Proveedor consolidado", "el jujeño", "", 80100, "Contado", 0, "Pendiente", "evento 12/6/2026/ pago distribuidora"], ["GAS-080", "2026-06-10", "A. Materia Prima", "A1. Proveedor consolidado", "la madrid", "", 57410, "Contado", 0, "Pendiente", "evento 12/6/2026"], ["GAS-081", "2026-06-10", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3200, "Contado", 0, "Pendiente", ""], ["GAS-082", "2026-06-11", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 11800, "Contado", 0, "Pagado", "transferencia pago distribuidora"], ["GAS-083", "2026-06-12", "B. Logística", "B1. Envíos y distribución", "Gasto Uber", "", 2400, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-084", "2026-06-12", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "Gasto colador", "", 3000, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-085", "2026-06-12", "A. Materia Prima", "A1. Proveedor consolidado", "tomate", "", 6000, "Contado", 0, "Pagado", "Transferencia pago distribuidora"], ["GAS-086", "2026-06-12", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "Resipack", "", 16840, "Contado", 0, "Pagado", "Evento 12/6 cortesía"], ["GAS-087", "2026-06-12", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6100, "Contado", 0, "Pendiente", ""], ["GAS-088", "2026-06-12", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "la virginia", "", 344394, "Contado", 0, "Pagado", "evento 12/6 cortesia"], ["GAS-089", "2026-06-15", "A. Materia Prima", "A1. Proveedor consolidado", "Verduras", "", 12000, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-090", "2026-06-15", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3000, "Contado", 0, "Pendiente", ""], ["GAS-091", "2026-06-17", "A. Materia Prima", "A1. Proveedor consolidado", "el jujeño", "", 145490, "Contado", 0, "Pendiente", "pago con cheque"], ["GAS-092", "2026-06-17", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3000, "Contado", 0, "Pendiente", ""], ["GAS-093", "2026-06-18", "C. Gastos Operativos", "C3. Honorarios profesionales", "barrios maximiliano", "", 700000, "Contado", 0, "Pagado", "300 distribuidora- 400 añañai"], ["GAS-094", "2026-06-18", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 1400, "Contado", 0, "Pendiente", ""], ["GAS-095", "2026-06-18", "A. Materia Prima", "A1. Proveedor consolidado", "la madrid", "", 761168, "Contado", 0, "Pendiente", ""], ["GAS-096", "2026-06-18", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6100, "Contado", 0, "Pendiente", ""], ["GAS-097", "2026-06-19", "A. Materia Prima", "A1. Proveedor consolidado", "el jujeño", "", 34500, "Contado", 0, "Pendiente", ""], ["GAS-098", "2026-06-19", "A. Materia Prima", "A1. Proveedor consolidado", "caja de leche", "carrefour", 21578, "Contado", 0, "Pendiente", "Pago transferencia distribuidora"], ["GAS-099", "2026-06-19", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 8100, "Contado", 0, "Pendiente", ""], ["GAS-100", "2026-06-22", "A. Materia Prima", "A1. Proveedor consolidado", "aceite 900 cc", "", 3600, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-101", "2026-06-22", "B. Logística", "B1. Envíos y distribución", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 11800, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-102", "2026-06-22", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "Resipack", "", 192531, "Contado", 0, "Pendiente", ""], ["GAS-103", "2026-06-22", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 4100, "Contado", 0, "Pendiente", ""], ["GAS-104", "2026-06-22", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3800, "Contado", 0, "Pendiente", ""], ["GAS-105", "2026-06-24", "A. Materia Prima", "A1. Proveedor consolidado", "supermercado (aceite)", "", 18300, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-106", "2026-06-23", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 2900, "Contado", 0, "Pendiente", ""], ["GAS-107", "2026-06-24", "A. Materia Prima", "A1. Proveedor consolidado", "el jujeño", "", 44000, "Contado", 0, "Pendiente", ""], ["GAS-108", "2026-06-24", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "pago beto( el parque)", "", 28000, "Contado", 0, "Pagado", ""], ["GAS-109", "2026-06-24", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 2900, "Contado", 0, "Pendiente", ""], ["GAS-110", "2026-06-25", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 2900, "Contado", 0, "Pendiente", ""], ["GAS-111", "2026-06-26", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 11800, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-112", "2026-06-26", "A. Materia Prima", "A1. Proveedor consolidado", "leche descremada y albahaca", "", 20800, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-113", "2026-06-26", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 1800, "Contado", 0, "Pendiente", ""], ["GAS-114", "2026-06-26", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6100, "Contado", 0, "Pendiente", ""], ["GAS-115", "2026-06-27", "C. Gastos Operativos", "C3. Honorarios profesionales", "elias , mauro, mario", "", 150000, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-116", "2026-06-29", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 2900, "Contado", 0, "Pendiente", ""], ["GAS-117", "2026-06-29", "A. Materia Prima", "A1. Proveedor consolidado", "aceite 900 cc", "", 8900, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-118", "2026-06-30", "A. Materia Prima", "A1. Proveedor consolidado", "aceite 900 cc", "", 7600, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-119", "2026-06-30", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 6200, "Contado", 0, "Pendiente", ""], ["GAS-120", "2026-07-01", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "aceite y productos de limpieza", "", 12400, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-121", "2026-07-01", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3100, "Contado", 0, "Pendiente", ""], ["GAS-122", "2026-07-02", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 3000, "Contado", 0, "Pendiente", ""], ["GAS-123", "2026-07-02", "A. Materia Prima", "A1. Proveedor consolidado", "aceite y leche", "la quebrada", 44840, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-124", "2026-07-03", "A. Materia Prima", "A1. Proveedor consolidado", "leche", "la quebrada", 23840, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-125", "2026-07-03", "B. Logística", "B1. Envíos y distribución", "gasto uber", "", 9100, "Contado", 0, "Pendiente", ""], ["GAS-126", "2026-07-04", "A. Materia Prima", "A1. Proveedor consolidado", "la madrid", "", 338248, "Contado", 0, "Pendiente", ""], ["GAS-127", "2026-07-06", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "bolsa de hielo x10 kg 2 unidades", "heladeria polo sur", 12200, "Contado", 0, "Pagado", "Pago transferencia distribuidora"], ["GAS-128", "2026-07-06", "A. Materia Prima", "A1. Proveedor consolidado", "el jujeño", "", 100000, "Contado", 0, "Pagado", "pago pàrcial (pago distribuidora)"], ["GAS-129", "2026-07-06", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "limpieza del predio", "", 130000, "Contado", 0, "Pendiente", ""], ["GAS-130", "2026-07-06", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "electricista", "", 60000, "Contado", 0, "Pendiente", ""], ["GAS-131", "2026-07-06", "C. Gastos Operativos", "C1. Servicios y mantenimiento", "albañiles", "", 90000, "Contado", 0, "Pendiente", ""]];

// ════════════════════════════════════════════════════════════════
// INICIALIZAR MÓDULO GASTOS
// ════════════════════════════════════════════════════════════════
function inicializarGastos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  if (ss.getSheetByName(H_GASTOS)) {
    if (ui.alert('¿Reinicializar gastos?',
        'Las hojas de Gastos ya existen. ¿Recrearlas? Se perderán los datos.',
        ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    [H_GASTOS, H_PAGOS_PR, H_PROVEED, H_CONFIG].forEach(function(n){
      var h = ss.getSheetByName(n); if (h) ss.deleteSheet(h);
    });
  }

  crearHojaGastos(ss);
  crearHojaPagosProveedores(ss);
  crearHojaProveedores(ss);
  crearHojaConfiguracion(ss);

  ss.getSheetByName(H_PROVEED).hideSheet();
  ss.getSheetByName(H_CONFIG).hideSheet();

  ui.alert('✅ Módulo Gastos iniciado',
    'Hojas creadas.\n\nPróximo paso: Menú 💸 AÑAÑAI Gastos → 📥 Cargar históricos gastos',
    ui.ButtonSet.OK);
}

// ── CREAR HOJA GASTOS ────────────────────────────────────────────
function crearHojaGastos(ss) {
  var ws = ss.insertSheet(H_GASTOS);
  ws.getRange('A1').setValue('AÑAÑAI · Gastos — completar con el formulario del menú 💸');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['GAS-ID','Fecha','Grupo','Subgrupo','Descripción',
              'Proveedor','Monto ($)','Condición','Días pago est.','Estado pago','Observaciones',
              'Caja','Fecha carga','Usuario carga'];
  var hRow = ws.getRange(2, 1, 1, hdrs.length);
  hRow.setValues([hdrs]);
  hRow.setBackground('#1F3864').setFontColor('#FFFFFF')
      .setFontWeight('bold').setHorizontalAlignment('center')
      .setWrap(true).setRowHeight !== undefined && ws.setRowHeight(2, 34);

  var widths = [90,110,160,200,200,160,110,130,110,130,200];
  widths.forEach(function(w,i){ ws.setColumnWidth(i+1, w); });
  ws.setFrozenRows(2);
  ws.setFrozenColumns(2);
}

// ── CREAR HOJA PAGOS PROVEEDORES ─────────────────────────────────
function crearHojaPagosProveedores(ss) {
  var ws = ss.insertSheet(H_PAGOS_PR);
  ws.getRange('A1').setValue('AÑAÑAI · Pagos a Proveedores — completar con el formulario del menú 💸');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['PAG-ID','Fecha','Proveedor','Monto pagado ($)',
              'Forma de pago','Fecha venc. cheque','Estado cheque',
              'GAS-IDs cubiertos','Observaciones','Caja','Fecha carga','Usuario carga'];
  var hRow = ws.getRange(2, 1, 1, hdrs.length);
  hRow.setValues([hdrs]);
  hRow.setBackground('#7B2D00').setFontColor('#FFFFFF')
      .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
  ws.setRowHeight(2, 34);

  var widths = [90,110,180,130,130,140,180,220,200];
  widths.forEach(function(w,i){ ws.setColumnWidth(i+1, w); });
  ws.setFrozenRows(2);
}

// ── CREAR HOJA PROVEEDORES ───────────────────────────────────────
function crearHojaProveedores(ss) {
  var ws = ss.insertSheet(H_PROVEED);
  ws.getRange('A1').setValue('AÑAÑAI · Maestro de Proveedores — no editar directamente');
  ws.getRange('A1').setFontStyle('italic').setFontColor('#888888');

  var hdrs = ['PRV-ID','Nombre','Condición default','Días pago est.','Activo'];
  ws.getRange(2, 1, 1, 5).setValues([hdrs])
    .setBackground('#2F5496').setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center');

  PROVEEDORES_INIT.forEach(function(r, i){
    ws.getRange(3+i, 1, 1, 5).setValues([[r[0],r[1],r[2],r[3],'Sí']]);
  });

  [1,2,3,4,5].forEach(function(c,i){
    ws.setColumnWidth(c, [90,200,140,110,70][i]);
  });
  ws.setFrozenRows(2);
}

// ── CREAR HOJA CONFIGURACIÓN (CMV) ──────────────────────────────
function crearHojaConfiguracion(ss) {
  var ws = ss.insertSheet(H_CONFIG);
  ws.getRange('A1').setValue('AÑAÑAI · Configuración de CMV — editar con cuidado');
  ws.getRange('A1').setFontColor('#888888').setFontStyle('italic');
  ws.getRange('A2').setValue('Producto (exacto como aparece en Despachos)');
  ws.getRange('B2').setValue('Variante keyword (opcional)');
  ws.getRange('C2').setValue('CVU ($)');
  ws.getRange('D2').setValue('Descripción');
  ws.getRange(2,1,1,4).setBackground('#2F5496').setFontColor('#FFFFFF').setFontWeight('bold');

  CMV_CONFIG.forEach(function(r, i){
    ws.getRange(3+i, 1, 1, 4).setValues([[r[0], r[1]||'', r[2], r[3]]]);
    ws.getRange(3+i, 3).setNumberFormat('$#,##0.00');
  });

  [1,2,3,4].forEach(function(c,i){
    ws.setColumnWidth(c, [220,160,100,280][i]);
  });
  ws.setFrozenRows(2);
}

// ════════════════════════════════════════════════════════════════
// IMPORTAR HISTÓRICOS
// ════════════════════════════════════════════════════════════════
function importarHistoricosGastos() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var hG  = ss.getSheetByName(H_GASTOS);
  if (!hG) { ui.alert('Ejecutá primero inicializarGastos().'); return; }

  var hasData = hG.getLastRow() >= GASTOS_START;
  if (hasData) {
    if (ui.alert('Ya hay datos','¿Agregar los históricos igualmente?',
        ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  }

  var start  = Math.max(hG.getLastRow() + 1, GASTOS_START);
  var batch  = HIST_GASTOS.map(function(r) {
    var fecha = r[1] ? new Date(r[1]) : '';
    return [r[0], fecha, r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]];
  });

  if (batch.length > 0) {
    hG.getRange(start, 1, batch.length, 11).setValues(batch);
    hG.getRange(start, 2, batch.length, 1).setNumberFormat('DD/MM/YYYY');
    hG.getRange(start, 7, batch.length, 1).setNumberFormat('$#,##0');
  }

  ss.toast(batch.length + ' gastos históricos cargados correctamente.', '✅ Históricos gastos', 5);
}

// ════════════════════════════════════════════════════════════════
// GUARDAR GASTO
// ════════════════════════════════════════════════════════════════
function guardarGasto(datos) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_GASTOS);
    var colA = hoja.getRange('A'+GASTOS_START+':A2000').getValues();
    var fila = GASTOS_START;
    for (var i = 0; i < colA.length; i++) {
      if (!colA[i][0]) { fila = GASTOS_START + i; break; }
    }
    var seq   = fila - GASTOS_START + 1;
    var gasId = 'GAS-' + (seq < 10 ? '00'+seq : seq < 100 ? '0'+seq : seq);
    var fecha = new Date();
    var estado = datos.condicion === 'Cuenta corriente' ? 'Pendiente' : 'Pagado';

    hoja.getRange(fila, 1).setValue(gasId);
    hoja.getRange(fila, 2).setValue(fecha).setNumberFormat('DD/MM/YYYY');
    hoja.getRange(fila, 3).setValue(datos.grupo);
    hoja.getRange(fila, 4).setValue(datos.subgrupo);
    hoja.getRange(fila, 5).setValue(datos.descripcion || '');
    hoja.getRange(fila, 6).setValue(datos.proveedor || '');
    hoja.getRange(fila, 7).setValue(Number(datos.monto)).setNumberFormat('$#,##0');
    hoja.getRange(fila, 8).setValue(datos.condicion || 'Contado');
    hoja.getRange(fila, 9).setValue(Number(datos.diasPago) || 0);
    hoja.getRange(fila,10).setValue(estado);
    hoja.getRange(fila,11).setValue(datos.obs || '');
    hoja.getRange(fila,12).setValue(datos.caja || 'Distribuidora');
    hoja.getRange(fila,13).setValue(fecha).setNumberFormat('DD/MM/YYYY HH:mm');
    hoja.getRange(fila,14).setValue(_usuarioActual());

    var bg = fila % 2 === 0 ? '#EEF3FA' : '#FFFFFF';
    hoja.getRange(fila, 1, 1, 14).setBackground(bg);

    return {
      ok: true, gasId: gasId, estado: estado,
      mensaje: '✅ ' + gasId + ' — ' + datos.subgrupo +
               ' · $' + Number(datos.monto).toLocaleString('es-AR') +
               ' · ' + (datos.condicion || 'Contado')
    };
  } catch(e) { return { ok: false, mensaje: '❌ ' + e.message }; }
}

// ════════════════════════════════════════════════════════════════
// GUARDAR PAGO A PROVEEDOR
// ════════════════════════════════════════════════════════════════
function guardarPagoProveedor(datos) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_PAGOS_PR);
    var colA = hoja.getRange('A'+PAGOS_START+':A2000').getValues();
    var fila = PAGOS_START;
    for (var i = 0; i < colA.length; i++) {
      if (!colA[i][0]) { fila = PAGOS_START + i; break; }
    }
    var seq   = fila - PAGOS_START + 1;
    var pagId = 'PAG-' + (seq < 10 ? '00'+seq : seq < 100 ? '0'+seq : seq);
    var fecha = new Date();

    // Estado cheque
    var esChequeDif = datos.formaPago === 'Cheque diferido';
    var estadoCheque = esChequeDif ? 'Cheque emitido — pendiente débito' : 'Pagado';
    var fechaVenc = esChequeDif && datos.fechaVenc ? new Date(datos.fechaVenc) : '';

    hoja.getRange(fila, 1).setValue(pagId);
    hoja.getRange(fila, 2).setValue(fecha).setNumberFormat('DD/MM/YYYY');
    hoja.getRange(fila, 3).setValue(datos.proveedor);
    hoja.getRange(fila, 4).setValue(Number(datos.monto)).setNumberFormat('$#,##0');
    hoja.getRange(fila, 5).setValue(datos.formaPago || '');
    if (fechaVenc) hoja.getRange(fila, 6).setValue(fechaVenc).setNumberFormat('DD/MM/YYYY');
    hoja.getRange(fila, 7).setValue(estadoCheque);
    hoja.getRange(fila, 8).setValue(datos.gasIds || '');
    hoja.getRange(fila, 9).setValue(datos.obs || '');
    hoja.getRange(fila,10).setValue(datos.caja || 'Distribuidora');
    hoja.getRange(fila,11).setValue(fecha).setNumberFormat('DD/MM/YYYY HH:mm');
    hoja.getRange(fila,12).setValue(_usuarioActual());

    var bg = fila % 2 === 0 ? '#FFF0E8' : '#FFF8F4';
    hoja.getRange(fila, 1, 1, 12).setBackground(bg);

    // Si no es cheque diferido → marcar GAS-IDs como Pagado
    var actualizados = 0;
    if (!esChequeDif && datos.gasIds) {
      var ids = datos.gasIds.split(',').map(function(s){ return s.trim(); });
      var hG = ss.getSheetByName(H_GASTOS);
      if (hG && hG.getLastRow() >= GASTOS_START) {
        var rawG = hG.getRange(GASTOS_START, 1, hG.getLastRow()-GASTOS_START+1, 10).getValues();
        rawG.forEach(function(r, idx){
          if (ids.indexOf(String(r[0]).trim()) > -1) {
            hG.getRange(GASTOS_START + idx, 10).setValue('Pagado');
            actualizados++;
          }
        });
      }
    }
    // Si es cheque diferido → marcar como "Cheque emitido"
    if (esChequeDif && datos.gasIds) {
      var ids2 = datos.gasIds.split(',').map(function(s){ return s.trim(); });
      var hG2 = ss.getSheetByName(H_GASTOS);
      if (hG2 && hG2.getLastRow() >= GASTOS_START) {
        var rawG2 = hG2.getRange(GASTOS_START, 1, hG2.getLastRow()-GASTOS_START+1, 10).getValues();
        rawG2.forEach(function(r, idx){
          if (ids2.indexOf(String(r[0]).trim()) > -1) {
            hG2.getRange(GASTOS_START + idx, 10).setValue('Cheque emitido — pdte. débito');
            actualizados++;
          }
        });
      }
    }

    return {
      ok: true, pagId: pagId, estadoCheque: estadoCheque,
      mensaje: '✅ ' + pagId + ' — ' + datos.proveedor +
               ' · $' + Number(datos.monto).toLocaleString('es-AR') +
               ' · ' + estadoCheque +
               (actualizados ? ' · ' + actualizados + ' gasto/s actualizados' : '')
    };
  } catch(e) { return { ok: false, mensaje: '❌ ' + e.message }; }
}

// ════════════════════════════════════════════════════════════════
// CONFIRMAR DÉBITO DE CHEQUE
// ════════════════════════════════════════════════════════════════
function confirmarDebitoCheque(pagId) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hP   = ss.getSheetByName(H_PAGOS_PR);
    var last = hP.getLastRow();
    var raw  = hP.getRange(PAGOS_START, 1, last-PAGOS_START+1, 9).getValues();
    for (var i = 0; i < raw.length; i++) {
      if (String(raw[i][0]).trim() === pagId) {
        var fila  = PAGOS_START + i;
        hP.getRange(fila, 7).setValue('Debitado — pagado');
        // Marcar GAS-IDs como Pagado
        var gasIds = String(raw[i][7]).split(',').map(function(s){ return s.trim(); });
        var hG = ss.getSheetByName(H_GASTOS);
        if (hG && hG.getLastRow() >= GASTOS_START) {
          var rawG = hG.getRange(GASTOS_START,1,hG.getLastRow()-GASTOS_START+1,10).getValues();
          rawG.forEach(function(r, idx){
            if (gasIds.indexOf(String(r[0]).trim()) > -1) {
              hG.getRange(GASTOS_START+idx, 10).setValue('Pagado');
            }
          });
        }
        return { ok: true, mensaje: '✅ Cheque ' + pagId + ' marcado como debitado' };
      }
    }
    return { ok: false, mensaje: '❌ PAG-ID no encontrado: ' + pagId };
  } catch(e) { return { ok: false, mensaje: '❌ ' + e.message }; }
}

// ════════════════════════════════════════════════════════════════
// GUARDAR PROVEEDOR NUEVO
// ════════════════════════════════════════════════════════════════
function guardarProveedorNuevo(datos) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(H_PROVEED);
    var last = hoja.getLastRow();
    var fila = Math.max(last + 1, 3);
    var seq  = fila - 3 + 1;
    var id   = 'PRV-' + (seq < 10 ? '00'+seq : seq < 100 ? '0'+seq : seq);
    hoja.getRange(fila, 1, 1, 5).setValues([[
      id, datos.nombre, datos.condicion, Number(datos.diasPago)||0, 'Sí'
    ]]);
    return { ok: true, id: id, mensaje: '✅ ' + id + ' — ' + datos.nombre + ' agregado.' };
  } catch(e) { return { ok: false, mensaje: '❌ ' + e.message }; }
}

// ════════════════════════════════════════════════════════════════
// VER CXP SIDEBAR
// ════════════════════════════════════════════════════════════════
function verCXP() {
  var cxp  = getCXP();
  var provs = getProveedores();
  var html = buildCXPHTML(cxp, provs);
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(html).setTitle('CXP — Cuentas a Pagar')
  );
}

function buildCXPHTML(cxp, provs) {
  var total = Object.keys(cxp).reduce(function(s,k){ return s+(cxp[k]||0); }, 0);
  var rows  = Object.keys(cxp).sort(function(a,b){ return (cxp[b]||0)-(cxp[a]||0); })
    .map(function(p){
      return '<tr><td>'+p+'</td><td style="text-align:right;font-weight:700;color:#c0392b">$'
             +Math.round(cxp[p]).toLocaleString('es-AR')+'</td></tr>';
    }).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    +'body{font-family:"Segoe UI",sans-serif;font-size:13px;padding:12px}'
    +'h3{color:#7B2D00;margin-bottom:12px}'
    +'table{width:100%;border-collapse:collapse}'
    +'td{padding:8px 10px;border-bottom:1px solid #e0e6f0}'
    +'tr:hover td{background:#fdf0e8}'
    +'.tot td{font-weight:700;border-top:2px solid #7B2D00;color:#7B2D00}'
    +'</style></head><body>'
    +'<h3>💸 CXP — Cuentas a Pagar</h3>'
    +'<table><tbody>'+rows
    +'<tr class="tot"><td>TOTAL</td><td style="text-align:right">$'
    +Math.round(total).toLocaleString('es-AR')+'</td></tr>'
    +'</tbody></table>'
    +'<p style="font-size:10px;color:#888;margin-top:12px">Solo gastos en Cuenta corriente con saldo pendiente o cheque emitido</p>'
    +'</body></html>';
}