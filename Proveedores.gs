// ═══════════════════════════════════════════════════════════════
// AÑAÑAI · Proveedores.gs
// Formularios de Gastos y Pago a Proveedores
// ═══════════════════════════════════════════════════════════════

// ── MENÚ — se agrega al onOpen del Código.gs ────────────────────
// Llamar gastoOnOpen() desde el onOpen() existente

function gastoOnOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💸 AÑAÑAI Gastos')
    .addItem('🧾 Registrar gasto',           'abrirFormGasto')
    .addItem('🏦 Pagar a proveedor',          'abrirFormPagoProveedor')
    .addSeparator()
    .addItem('📋 Ver CXP por proveedor',      'verCXP')
    .addItem('✅ Confirmar débito cheque',     'abrirFormConfirmarDebito')
    .addSeparator()
    .addItem('👤 Agregar proveedor nuevo',    'abrirFormProveedorNuevo')
    .addItem('💲 Ver / editar CMV',           'irAConfiguracion')
    .addSeparator()
    .addItem('⚙ Inicializar módulo gastos',   'inicializarGastos')
    .addItem('📥 Cargar históricos gastos',   'importarHistoricosGastos')
    .addToUi();
}

function irAConfiguracion() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_CONFIG);
  if (h) { h.showSheet(); h.activate(); }
}

// ════════════════════════════════════════════════════════════════
// ABRIR FORMULARIOS
// ════════════════════════════════════════════════════════════════
function abrirFormGasto() {
  var provs = getProveedores();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormGastoHTML(provs))
      .setTitle('🧾 Registrar Gasto').setWidth(520)
  );
}

function abrirFormPagoProveedor() {
  var provs = getProveedores();
  var cxp   = getCXP();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormPagoHTML(provs, cxp))
      .setTitle('🏦 Pagar a Proveedor').setWidth(520)
  );
}

function abrirFormProveedorNuevo() {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormProveedorHTML())
      .setTitle('👤 Nuevo Proveedor').setWidth(420)
  );
}

function abrirFormConfirmarDebito() {
  var pendientes = getChequesEmitidosPendientes();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(buildFormConfirmarDebitoHTML(pendientes))
      .setTitle('✅ Confirmar débito cheque').setWidth(480)
  );
}

function getChequesEmitidosPendientes() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hP   = ss.getSheetByName(H_PAGOS_PR);
  if (!hP || hP.getLastRow() < PAGOS_START) return [];
  var raw  = hP.getRange(PAGOS_START, 1, hP.getLastRow()-PAGOS_START+1, 9).getValues();
  var out  = [];
  raw.forEach(function(r) {
    if (String(r[6]).indexOf('pendiente débito') > -1 ||
        String(r[6]).indexOf('pendiente debito') > -1) {
      var venc = r[5] instanceof Date ?
        Utilities.formatDate(r[5],'America/Argentina/Buenos_Aires','dd/MM/yyyy') : '—';
      out.push({ pagId: String(r[0]), prov: String(r[2]),
                 monto: Number(r[3])||0, venc: venc });
    }
  });
  return out;
}

// ════════════════════════════════════════════════════════════════
// HTML — FORMULARIO GASTO
// ════════════════════════════════════════════════════════════════
function buildFormGastoHTML(provs) {
  var provOpts = ['<option value="">— Sin proveedor —</option>']
    .concat(provs.map(function(p){
      return '<option value="'+p.nombre+'" data-cond="'+p.condicion
             +'" data-dias="'+p.diasPago+'">'+p.nombre+'</option>';
    })).join('');

  // Build taxonomy dropdowns
  var grupos = [];
  var subMap = {};
  TAXONOMIA.forEach(function(t) {
    if (grupos.indexOf(t[0]) === -1) grupos.push(t[0]);
    if (!subMap[t[0]]) subMap[t[0]] = [];
    subMap[t[0]].push({ sub: t[1], tipo: t[2], hint: t[3] });
  });

  var grupoOpts = grupos.map(function(g){
    return '<option value="'+g+'">'+g+'</option>';
  }).join('');

  var css = sharedFormCSS();
  var extraCSS = [
    '.capex-warn{display:none;padding:9px 12px;background:#fff4e6;border:1px solid #f0c070;',
    'border-left:4px solid #e07020;border-radius:6px;font-size:11.5px;color:#a05010;margin-bottom:10px}',
    '.capex-warn.show{display:block}',
    '.hint-sub{font-size:10.5px;color:var(--muted,#888);font-style:italic;margin-top:4px;display:none}',
    '.hint-sub.show{display:block}',
  ].join('');

  var js = [
    'var SUB_MAP='+JSON.stringify(subMap)+';',
    'function onGrupoChange(){',
    '  var g=v("grupoSel"); var sub=document.getElementById("subSel");',
    '  sub.innerHTML=\'<option value="">— Seleccioná —</option>\';',
    '  if(!g)return;',
    '  (SUB_MAP[g]||[]).forEach(function(s){',
    '    var safeHint=s.hint.replace(/&/g,"&amp;").replace(/"/g,"&quot;");',
    '    sub.innerHTML+=\'<option value="\'+s.sub+\'" data-hint="\'+safeHint+\'" data-tipo="\'+s.tipo+\'">\'+s.sub+\'</option>\';',
    '  });',
    '  onSubChange();',
    '}',
    'function onSubChange(){',
    '  var sel=document.getElementById("subSel");',
    '  var opt=sel.options[sel.selectedIndex];',
    '  var hint=opt.getAttribute("data-hint")||"";',
    '  var tipo=opt.getAttribute("data-tipo")||"";',
    '  document.getElementById("hintSub").textContent=hint;',
    '  document.getElementById("hintSub").className="hint-sub"+(hint?" show":"");',
    '  var warn=document.getElementById("capexWarn");',
    '  warn.className="capex-warn"+(tipo==="C"?" show":"");',
    '  // Show/hide proveedor based on subgrupo',
    '  var showProv=tipo!=="B";',
    '  document.getElementById("provWrap").style.display=showProv?"block":"none";',
    '}',
    'function onProvChange(){',
    '  var sel=document.getElementById("provSel");',
    '  var opt=sel.options[sel.selectedIndex];',
    '  var cond=opt.getAttribute("data-cond")||"Contado";',
    '  var dias=opt.getAttribute("data-dias")||"0";',
    '  document.getElementById("condSel").value=cond;',
    '  document.getElementById("diasInp").value=dias;',
    '  onCondChange();',
    '}',
    'function onCondChange(){',
    '  var cond=v("condSel");',
    '  document.getElementById("diasWrap").style.display=cond==="Cuenta corriente"?"block":"none";',
    '}',
    'function guardar(){',
    '  var grupo=v("grupoSel"),sub=v("subSel"),monto=v("montoInp");',
    '  var err=[];',
    '  if(!grupo)err.push("Grupo"); if(!sub)err.push("Subgrupo");',
    '  if(!monto||Number(monto)<=0)err.push("Monto");',
    '  if(err.length){show("Completá: "+err.join(", "),false);return;}',
    '  sp(true);',
    '  google.script.run',
    '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);if(r.ok)limpiar();})',
    '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})',
    '    .guardarGasto({grupo:grupo,subgrupo:sub,descripcion:v("descInp"),',
    '      proveedor:v("provSel"),monto:monto,condicion:v("condSel"),',
    '      diasPago:v("diasInp"),caja:v("cajaSel"),obs:v("obsInp")});',
    '}',
    'function limpiar(){',
    '  ["grupoSel","subSel","provSel","condSel","obsInp","descInp"].forEach(function(id){',
    '    var el=document.getElementById(id);if(el)el.value="";});',
    '  var gcj=document.getElementById("cajaSel"); if(gcj) gcj.value="Distribuidora";',
    '  document.getElementById("montoInp").value="";',
    '  document.getElementById("diasInp").value="0";',
    '  document.getElementById("diasWrap").style.display="none";',
    '  document.getElementById("hintSub").className="hint-sub";',
    '  document.getElementById("capexWarn").className="capex-warn";',
    '  document.getElementById("msg").style.display="none";',
    '}',
    sharedFormJS(),
  ].join('\n');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+css+extraCSS+'</style></head><body>'
    +'<div class="hdr" style="background:#1F3864"><h2>🧾 Registrar Gasto</h2>'
    +'<p>Elegí el grupo — los campos se adaptan automáticamente</p></div>'
    +'<div class="body">'

    // Grupo
    +'<div class="field"><label>Grupo<span class="req">*</span></label>'
    +'<select id="grupoSel" onchange="onGrupoChange()"><option value="">— Seleccioná —</option>'
    +grupoOpts+'</select></div>'

    // Subgrupo
    +'<div class="field"><label>Subgrupo<span class="req">*</span></label>'
    +'<select id="subSel" onchange="onSubChange()"><option value="">— Seleccioná grupo primero —</option></select>'
    +'<div class="hint-sub" id="hintSub"></div></div>'

    // CAPEX warning
    +'<div class="capex-warn" id="capexWarn">⚠ CAPEX — Este gasto va a inversión, '
    +'no afecta el resultado mensual. Asegurate de que sea equipamiento o infraestructura.</div>'

    // Descripción
    +'<div class="field"><label>Descripción</label>'
    +'<input type="text" id="descInp" placeholder="Detalle del gasto…"></div>'

    // Proveedor
    +'<div class="field" id="provWrap"><label>Proveedor</label>'
    +'<select id="provSel" onchange="onProvChange()">'+provOpts+'</select></div>'

    // Monto
    +'<div class="field"><label>Monto ($)<span class="req">*</span></label>'
    +'<input type="number" id="montoInp" min="1" placeholder="0" '
    +'style="font-size:18px;font-weight:700;text-align:center;color:#1F3864"></div>'

    // Condición
    +'<div class="r2">'
    +'<div class="field"><label>Condición de pago</label>'
    +'<select id="condSel" onchange="onCondChange()">'
    +'<option value="Contado">Contado</option>'
    +'<option value="Cuenta corriente">Cuenta corriente</option>'
    +'</select></div>'
    +'<div class="field" id="diasWrap" style="display:none"><label>Días est. de pago</label>'
    +'<input type="number" id="diasInp" value="0" min="0" placeholder="7, 15, 30…"></div>'
    +'</div>'

    // Caja
    +'<div class="field"><label>Caja<span class="req">*</span> <span style="font-weight:400;color:#888">— de qué caja sale el pago</span></label>'
    +'<select id="cajaSel">'+cajaOptionsHTML('Distribuidora')+'</select></div>'

    // Obs
    +'<div class="field"><label>Observaciones</label>'
    +'<textarea id="obsInp" placeholder="Aclaraciones…"></textarea></div>'

    +'<div class="btns">'
    +'<button class="b1" style="background:#1F3864" onclick="guardar()">💾 Guardar gasto</button>'
    +'<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    +'<div class="sp" id="sp">⏳ Guardando…</div>'
    +'<div class="msg" id="msg"></div>'
    +'</div>'
    +'<script>'+js+'<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// HTML — FORMULARIO PAGO A PROVEEDOR
// ════════════════════════════════════════════════════════════════
function buildFormPagoHTML(provs, cxp) {
  var provOpts = ['<option value="">— Seleccioná —</option>']
    .concat(provs.filter(function(p){ return p.condicion !== 'Interno'; })
    .map(function(p){
      var saldo = cxp[p.nombre] ? ' — CXP: $'+Math.round(cxp[p.nombre]).toLocaleString('es-AR') : '';
      return '<option value="'+p.nombre+'" data-cxp="'+(cxp[p.nombre]||0)+'">'
             +p.nombre+saldo+'</option>';
    })).join('');

  var css = sharedFormCSS();

  var js = [
    'function onProvChange(){',
    '  var sel=document.getElementById("provSel");',
    '  var opt=sel.options[sel.selectedIndex];',
    '  var cxpV=Number(opt.getAttribute("data-cxp"))||0;',
    '  var hint=document.getElementById("hintCXP");',
    '  if(!sel.value){hint.style.display="none";return;}',
    '  hint.textContent=cxpV>0?"Saldo CXP: $"+Math.round(cxpV).toLocaleString("es-AR"):"✓ Sin saldo pendiente en cta. cte.";',
    '  hint.style.display="block";',
    '  hint.style.borderLeftColor=cxpV>0?"#e07020":"#27ae60";',
    '}',
    'function onFormaChange(){',
    '  var f=v("formaSel");',
    '  document.getElementById("vencWrap").style.display=f==="Cheque diferido"?"block":"none";',
    '}',
    'function guardar(){',
    '  var prov=v("provSel"),monto=v("montoInp"),forma=v("formaSel");',
    '  var err=[];',
    '  if(!prov)err.push("Proveedor"); if(!monto||Number(monto)<=0)err.push("Monto");',
    '  if(!forma)err.push("Forma de pago");',
    '  if(forma==="Cheque diferido"&&!v("vencInp"))err.push("Fecha vencimiento del cheque");',
    '  if(err.length){show("Completá: "+err.join(", "),false);return;}',
    '  sp(true);',
    '  google.script.run',
    '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);if(r.ok)limpiar();})',
    '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})',
    '    .guardarPagoProveedor({proveedor:prov,monto:monto,formaPago:forma,',
    '      fechaVenc:v("vencInp"),gasIds:v("gasIdsInp"),caja:v("cajaSel"),obs:v("obsInp")});',
    '}',
    'function limpiar(){',
    '  ["provSel","formaSel","gasIdsInp","obsInp"].forEach(function(id){',
    '    var el=document.getElementById(id);if(el)el.value="";});',
    '  var pcj=document.getElementById("cajaSel"); if(pcj) pcj.value="Distribuidora";',
    '  document.getElementById("montoInp").value="";',
    '  document.getElementById("vencWrap").style.display="none";',
    '  document.getElementById("hintCXP").style.display="none";',
    '  document.getElementById("msg").style.display="none";',
    '}',
    sharedFormJS(),
  ].join('\n');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+css+'</style></head><body>'
    +'<div class="hdr" style="background:#7B2D00"><h2>🏦 Pagar a Proveedor</h2>'
    +'<p>Registrá un pago o emisión de cheque a un proveedor</p></div>'
    +'<div class="body">'

    +'<div class="field"><label>Proveedor<span class="req">*</span></label>'
    +'<select id="provSel" onchange="onProvChange()">'+provOpts+'</select>'
    +'<div id="hintCXP" style="display:none;margin-top:5px;padding:7px 10px;'
    +'background:#fff4e6;border:1px solid #f0c070;border-left:4px solid #e07020;'
    +'border-radius:5px;font-size:11.5px;font-weight:600;color:#a05010"></div></div>'

    +'<div class="field"><label>Monto ($)<span class="req">*</span></label>'
    +'<input type="number" id="montoInp" min="1" placeholder="0" '
    +'style="font-size:18px;font-weight:700;text-align:center;color:#7B2D00"></div>'

    +'<div class="field"><label>Forma de pago<span class="req">*</span></label>'
    +'<select id="formaSel" onchange="onFormaChange()">'
    +'<option value="">— Seleccioná —</option>'
    +'<option value="Transferencia">Transferencia</option>'
    +'<option value="Efectivo">Efectivo</option>'
    +'<option value="Cheque al día">Cheque al día</option>'
    +'<option value="Cheque diferido">Cheque diferido (registra compromiso — confirmar débito cuando se acredite)</option>'
    +'</select></div>'

    +'<div class="field" id="vencWrap" style="display:none">'
    +'<label>Fecha vencimiento cheque<span class="req">*</span></label>'
    +'<input type="date" id="vencInp"></div>'

    +'<div class="field"><label>GAS-IDs cubiertos <span style="font-weight:400;color:#888">(opcional)</span></label>'
    +'<input type="text" id="gasIdsInp" placeholder="ej: GAS-001, GAS-002 — o dejar vacío si es pago global"></div>'

    +'<div class="field"><label>Caja<span class="req">*</span> <span style="font-weight:400;color:#888">— de qué caja sale el pago</span></label>'
    +'<select id="cajaSel">'+cajaOptionsHTML('Distribuidora')+'</select></div>'

    +'<div class="field"><label>Observaciones</label>'
    +'<textarea id="obsInp" placeholder="Aclaraciones…"></textarea></div>'

    +'<div class="btns">'
    +'<button class="b1" style="background:#7B2D00" onclick="guardar()">💾 Registrar pago</button>'
    +'<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    +'<div class="sp" id="sp">⏳ Guardando…</div>'
    +'<div class="msg" id="msg"></div>'
    +'</div><script>'+js+'<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// HTML — CONFIRMAR DÉBITO CHEQUE
// ════════════════════════════════════════════════════════════════
function buildFormConfirmarDebitoHTML(pendientes) {
  if (!pendientes.length) {
    return '<html><body style="font-family:Arial;padding:20px;color:#555">'
      +'<h3 style="color:#27ae60">✅ Sin cheques pendientes de débito</h3>'
      +'<p>No hay cheques emitidos esperando confirmación de débito bancario.</p>'
      +'</body></html>';
  }

  var opts = pendientes.map(function(p){
    return '<option value="'+p.pagId+'">'+p.pagId+' · '+p.prov
           +' · $'+Math.round(p.monto).toLocaleString('es-AR')
           +' · Vence: '+p.venc+'</option>';
  }).join('');

  var css = sharedFormCSS();
  var js = [
    'function confirmar(){',
    '  var sel=v("cheqSel");',
    '  if(!sel){show("Seleccioná un cheque",false);return;}',
    '  sp(true);',
    '  google.script.run',
    '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);})',
    '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})',
    '    .confirmarDebitoCheque(sel);',
    '}',
    sharedFormJS(),
  ].join('\n');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+css+'</style></head><body>'
    +'<div class="hdr" style="background:#27ae60"><h2>✅ Confirmar débito cheque</h2>'
    +'<p>Marcá el cheque como debitado cuando el banco lo procese</p></div>'
    +'<div class="body">'
    +'<div class="field"><label>Cheque pendiente de débito<span class="req">*</span></label>'
    +'<select id="cheqSel"><option value="">— Seleccioná —</option>'+opts+'</select></div>'
    +'<div class="btns"><button class="b1" style="background:#27ae60" onclick="confirmar()">✅ Confirmar débito</button></div>'
    +'<div class="sp" id="sp">⏳ Actualizando…</div>'
    +'<div class="msg" id="msg"></div>'
    +'</div><script>'+js+'<\/script></body></html>';
}

// ════════════════════════════════════════════════════════════════
// HTML — FORMULARIO PROVEEDOR NUEVO
// ════════════════════════════════════════════════════════════════
function buildFormProveedorHTML() {
  var css = sharedFormCSS();
  var js = [
    'function guardar(){',
    '  var nom=v("nomInp");',
    '  if(!nom){show("Completá el nombre",false);return;}',
    '  sp(true);',
    '  google.script.run',
    '    .withSuccessHandler(function(r){sp(false);show(r.mensaje,r.ok);if(r.ok)limpiar();})',
    '    .withFailureHandler(function(e){sp(false);show("Error: "+e.message,false);})',
    '    .guardarProveedorNuevo({nombre:nom,condicion:v("condSel"),diasPago:v("diasInp")});',
    '}',
    'function limpiar(){',
    '  ["nomInp","diasInp"].forEach(function(id){document.getElementById(id).value="";});',
    '  document.getElementById("condSel").value="Contado";',
    '  document.getElementById("msg").style.display="none";',
    '}',
    'function onCondChange(){',
    '  document.getElementById("diasWrap").style.display=v("condSel")==="Cuenta corriente"?"block":"none";',
    '}',
    sharedFormJS(),
  ].join('\n');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+css+'</style></head><body>'
    +'<div class="hdr" style="background:#2F5496"><h2>👤 Nuevo Proveedor</h2>'
    +'<p>Se agrega al maestro y queda disponible en formularios</p></div>'
    +'<div class="body">'
    +'<div class="field"><label>Nombre<span class="req">*</span></label>'
    +'<input type="text" id="nomInp" placeholder="Nombre del proveedor"></div>'
    +'<div class="r2">'
    +'<div class="field"><label>Condición default</label>'
    +'<select id="condSel" onchange="onCondChange()">'
    +'<option value="Contado">Contado</option>'
    +'<option value="Cuenta corriente">Cuenta corriente</option></select></div>'
    +'<div class="field" id="diasWrap" style="display:none"><label>Días est. pago</label>'
    +'<input type="number" id="diasInp" placeholder="7, 15, 30…" min="0"></div>'
    +'</div>'
    +'<div class="btns"><button class="b1" style="background:#2F5496" onclick="guardar()">💾 Agregar</button>'
    +'<button class="b2" onclick="limpiar()">🗑 Limpiar</button></div>'
    +'<div class="sp" id="sp">⏳ Guardando…</div>'
    +'<div class="msg" id="msg"></div>'
    +'</div><script>'+js+'<\/script></body></html>';
}

// ── CSS Y JS COMPARTIDO ENTRE FORMULARIOS ────────────────────────
function sharedFormCSS() {
  return [
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:"Segoe UI",Arial,sans-serif;font-size:13px;background:#f5f7fa;color:#1a1a2e}',
    '.hdr{padding:14px 17px 12px;color:#fff;border-bottom:3px solid rgba(0,0,0,.2)}',
    '.hdr h2{font-size:14px;font-weight:700;margin-bottom:2px}',
    '.hdr p{font-size:11px;opacity:.8}',
    '.body{padding:15px 17px}',
    '.field{margin-bottom:12px}',
    'label{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5a6580;margin-bottom:4px}',
    'label .req{color:#e05555;margin-left:2px}',
    'select,input,textarea{width:100%;padding:8px 10px;border:1.5px solid #d0d7e8;border-radius:6px;font-size:13px;font-family:inherit;background:#fff;color:#1a1a2e;outline:none}',
    'select:focus,input:focus,textarea:focus{border-color:#2F5496}',
    'textarea{resize:vertical;min-height:50px}',
    '.r2{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
    '.btns{display:flex;gap:8px;margin-top:4px}',
    'button{flex:1;padding:10px;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}',
    '.b1{color:#fff}.b1:hover{opacity:.88}.b2{background:#e8ecf4;color:#5a6580}',
    '.msg{margin-top:11px;padding:9px 12px;border-radius:6px;font-size:12px;font-weight:600;display:none}',
    '.msg.ok{background:#e8f8ef;color:#1a7a40;border:1px solid #a0d8b8}',
    '.msg.er{background:#fde8e8;color:#b82020;border:1px solid #f0b0b0}',
    '.sp{display:none;text-align:center;padding:7px;color:#5a6580;font-size:11px}',
    ':root{--muted:#888}',
  ].join('') + formUXCSS();
}

function sharedFormJS() {
  // Delega en la capa UX compartida (definida en VentasCobros_FINAL.gs):
  // v(), show() con flash de confirmación, sp() con overlay + bloqueo anti doble-clic.
  return formUXJS();
}