(function(){
'use strict';

/* ============================== constants ============================== */
var CATS = [
  {key:'sgl', label:'Quarto Individual (SGL)'},
  {key:'dbl', label:'Quarto Duplo (DBL)'},
  {key:'tpl', label:'Quarto Triplo (TPL)'},
  {key:'cafe', label:'Café da Manhã'},
  {key:'almoco', label:'Almoço'},
  {key:'jantar', label:'Jantar'},
  {key:'coffee', label:'Coffee Break'},
  {key:'salao', label:'Salão de Eventos'},
  {key:'fachada', label:'Fachada / Geral'}
];
function catLabel(key){ for (var i=0;i<CATS.length;i++){ if (CATS[i].key===key) return CATS[i].label; } return key; }
var TAX_OPTIONS = [
  {key:'iss5', label:'ISS 5% sobre a tarifa'},
  {key:'incluso', label:'ISS já incluso na tarifa'},
  {key:'impostos', label:'+ impostos (CBS/IBS, sem % definido)'},
  {key:'isento', label:'Isento de ISS (evento)'}
];
function taxLabel(key){ for (var i=0;i<TAX_OPTIONS.length;i++){ if (TAX_OPTIONS[i].key===key) return TAX_OPTIONS[i].label; } return key; }
var UNIT_LABELS = { business:'Victory Business Hotel', suites:'Victory Suítes' };
var ROOM_TYPES = ['Individual (SGL)','Duplo (DBL)','Triplo (TPL)','Quádruplo (QDL)'];
var ROOM_TO_CAT = {'Individual (SGL)':'sgl','Duplo (DBL)':'dbl','Triplo (TPL)':'tpl'};
var SERVICE_TO_CAT = {'Almoço':'almoco','Jantar':'jantar','Coffee Break':'coffee','Locação de espaço':'salao'};
var DEFAULT_CONDICOES = [
  'Café da manhã incluso em todas as diárias, sem custo adicional.',
  'Check-in a partir das 14h e check-out até as 12h.',
  'Cotação sujeita à disponibilidade no momento da confirmação.',
  'Relação de hóspedes (rooming list) e confirmação final de apartamentos e refeições: a combinar com a nossa central de reservas.',
  'Reservas exclusivamente pela nossa central de reservas — e-mail, WhatsApp ou telefone.',
  'Proposta com validade de {{validade}} dias a partir da data de emissão.',
  'Demais condições (pagamento, cancelamento) a confirmar com a nossa central de reservas.'
];

/* ============================== utils ============================== */
function uid(){ return 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function round2(n){ return Math.round((Number(n)||0 + Number.EPSILON)*100)/100; }
function brl(n){ n = round2(n); return 'R$ ' + n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function todayPtBR(){ return new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}); }
function addDaysPtBR(dias){ var d = new Date(); d.setDate(d.getDate()+(Number(dias)||30)); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}); }
function numeroProposta(){ var d=new Date(); function p(n){ return String(n).padStart(2,'0'); } return 'PC-VH-'+String(d.getFullYear()).slice(2)+p(d.getMonth()+1)+p(d.getDate()); }
function toast(msg, kind){
  var el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show' + (kind?(' '+kind):'');
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ el.classList.remove('show'); }, 3200);
}
function debounce(fn, ms){ var t; return function(){ var a=arguments, c=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(c,a); }, ms); }; }

/* ============================== API client (Netlify Functions) ============================== */
var API = {
  password: null,
  async request(path, opts){
    opts = opts || {};
    var headers = Object.assign({}, opts.headers||{});
    if (this.password) headers['x-app-password'] = this.password;
    if (opts.body && !headers['content-type']) headers['content-type'] = 'application/json';
    var res = await fetch('/.netlify/functions/' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401){ var err = new Error('unauthorized'); err.code = 401; throw err; }
    if (!res.ok){ var e2 = new Error('http_'+res.status); e2.code = res.status; throw e2; }
    if (res.status === 204) return null;
    var ct = res.headers.get('content-type')||'';
    if (ct.indexOf('application/json')>=0) return res.json();
    return res.arrayBuffer();
  }
};

async function withAuthRetry(fn){
  try { return await fn(); }
  catch(e){
    if (e && e.code === 401){ await showAuthGate(); return fn(); }
    throw e;
  }
}
function showAuthGate(){
  return new Promise(function(resolve){
    var gate = document.getElementById('authGate');
    var input = document.getElementById('authInput');
    var btn = document.getElementById('authBtn');
    var errEl = document.getElementById('authErr');
    gate.classList.remove('hidden');
    errEl.textContent = '';
    function tryLogin(){
      var val = input.value;
      API.password = val;
      try { localStorage.setItem('victory_app_password', val); } catch(e){}
      API.request('proposals').then(function(){
        gate.classList.add('hidden');
        btn.removeEventListener('click', tryLogin);
        resolve();
      }).catch(function(){
        errEl.textContent = 'Senha incorreta. Tente novamente.';
      });
    }
    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', function(e){ if (e.key==='Enter') tryLogin(); });
    input.focus();
  });
}

/* ============================== state ============================== */
function freshMeta(){
  return {
    numero: numeroProposta(), emissao: todayPtBR(), validadeDias: 30,
    cliente:'', aCuidado:'', cnpj:'', referencia:'', periodo:'', diarias:'', pessoas:'',
    assinaturaNome:'Diogo Lima', assinaturaCargo:'Gerente Comercial — Victory Hotéis', cidade:'Juiz de Fora / MG'
  };
}
function blankState(){ return { id:null, isExample:false, meta: freshMeta(), hospedagem: [], alimentacao: [], condicoes: DEFAULT_CONDICOES.slice() }; }
function exampleState(){
  var m = freshMeta();
  m.cliente = 'Empresa Exemplo Ltda.'; m.aCuidado = 'A/C Fulano de Tal'; m.cnpj = '00.000.000/0001-00';
  m.referencia = 'Cotação de hospedagem e alimentação — exemplo';
  m.periodo = '10 a 12 de dezembro de 2026'; m.diarias = '2 (duas) diárias'; m.pessoas = '20 pessoas';
  return {
    id:null, isExample:true, meta:m,
    hospedagem: [
      { id:uid(), unidade:'business', tipo:'Individual (SGL)', tarifa:249, descontoPct:0, regraImposto:'iss5', obs:'Café da manhã incluso', fotoId:null },
      { id:uid(), unidade:'business', tipo:'Duplo (DBL)', tarifa:290, descontoPct:0, regraImposto:'iss5', obs:'Café da manhã incluso', fotoId:null },
      { id:uid(), unidade:'business', tipo:'Triplo (TPL)', tarifa:330, descontoPct:0, regraImposto:'iss5', obs:'Café da manhã incluso', fotoId:null }
    ],
    alimentacao: [
      { id:uid(), servico:'Almoço', qtdLabel:'20 pessoas', valor:55, unidadeValor:'pessoa', obs:'Água e refrigerante inclusos', fotoId:null },
      { id:uid(), servico:'Jantar', qtdLabel:'20 pessoas', valor:55, unidadeValor:'pessoa', obs:'Água e refrigerante inclusos', fotoId:null }
    ],
    condicoes: DEFAULT_CONDICOES.slice()
  };
}

var DEFAULT_LOGO = { contentType:'image/png', url:'assets/victory-logo.png' };
var STATE = exampleState();
var PHOTOS = [];
var LOGO = { contentType:'image/png', url:'assets/victory-logo.png' };
var SAVED = [];
var ACTIVE_TAB = 'dados';

/* ============================== boot / data loading ============================== */
async function boot(){
  try { API.password = localStorage.getItem('victory_app_password') || null; } catch(e){}
  renderTab();
  try {
    await withAuthRetry(async function(){ await refreshAll(); });
  } catch(e){ toast('Não foi possível conectar ao servidor.', 'err'); }
  renderTab();
}
async function refreshAll(){
  var [pRes, lRes, sRes] = await Promise.all([
    API.request('photos'), API.request('logo'), API.request('proposals')
  ]);
  PHOTOS = (pRes && pRes.photos) || [];
  PHOTOS.forEach(function(p){ p.url = '/.netlify/functions/photos?raw=' + encodeURIComponent(p.id); });
  LOGO = (lRes && lRes.exists) ? { contentType: lRes.contentType, url: '/.netlify/functions/logo?raw=1' } : DEFAULT_LOGO;
  SAVED = (sRes && sRes.proposals) || [];
}

/* ============================== rate math ============================== */
function calcHosp(row){
  var tarifa = Number(row.tarifa)||0;
  var desconto = (row.descontoPct===null || row.descontoPct===undefined || row.descontoPct==='') ? 0 : Number(row.descontoPct);
  var base = round2(tarifa * (1 - desconto/100));
  var regra = row.regraImposto || 'iss5';
  var comImposto = base;
  if (regra === 'iss5') comImposto = round2(base * 1.05);
  return { tarifa: round2(tarifa), desconto: desconto, base: base, comImposto: comImposto, regra: regra };
}
function groupHospByUnit(){
  var order = [], map = {};
  STATE.hospedagem.forEach(function(r){ if (!map[r.unidade]){ map[r.unidade]=[]; order.push(r.unidade);} map[r.unidade].push(r); });
  return order.map(function(u){ return { unidade:u, rows:map[u] }; });
}
function unitTaxNote(rows){
  var regras = {}; rows.forEach(function(r){ regras[r.regraImposto||'iss5']=1; });
  var keys = Object.keys(regras);
  if (keys.length===1){
    var k = keys[0];
    if (k==='iss5') return 'ISS de 5% já demonstrado na tabela acima.';
    if (k==='incluso') return 'O ISS já está incluso nos valores apresentados.';
    if (k==='impostos') return 'Os valores serão acrescidos de impostos (CBS/IBS); a alíquota ainda não está definida pela reforma tributária.';
    if (k==='isento') return 'Tarifas isentas de ISS (locação de espaço para eventos).';
  }
  return 'Cada tipo de apartamento pode ter uma regra de imposto distinta — ver detalhes na tabela.';
}
function fotoById(id){ return PHOTOS.find(function(p){ return p.id===id; }); }

/* ============================== tabs shell ============================== */
var TABS = [
  { key:'dados', label:'Dados' }, { key:'hospedagem', label:'Hospedagem' },
  { key:'alimentacao', label:'Alimentação & Eventos' }, { key:'condicoes', label:'Condições' },
  { key:'fotos', label:'Fotos' }, { key:'salvas', label:'Minhas propostas' }
];
function renderTabbar(){
  var html = TABS.map(function(t){
    var count = '';
    if (t.key==='hospedagem') count = '<span class="count">'+STATE.hospedagem.length+'</span>';
    if (t.key==='alimentacao') count = '<span class="count">'+STATE.alimentacao.length+'</span>';
    if (t.key==='fotos') count = '<span class="count">'+PHOTOS.length+'</span>';
    if (t.key==='salvas') count = '<span class="count">'+SAVED.length+'</span>';
    return '<button class="tab'+(ACTIVE_TAB===t.key?' active':'')+'" data-tab="'+t.key+'">'+esc(t.label)+count+'</button>';
  }).join('');
  document.getElementById('tabbarInner').innerHTML = html;
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(btn){
    btn.addEventListener('click', function(){ ACTIVE_TAB = btn.getAttribute('data-tab'); renderTab(); });
  });
}
function renderTab(){
  renderTabbar();
  var col = document.getElementById('formCol');
  if (ACTIVE_TAB==='dados') col.innerHTML = tplDados();
  else if (ACTIVE_TAB==='hospedagem') col.innerHTML = tplHospedagem();
  else if (ACTIVE_TAB==='alimentacao') col.innerHTML = tplAlimentacao();
  else if (ACTIVE_TAB==='condicoes') col.innerHTML = tplCondicoes();
  else if (ACTIVE_TAB==='fotos') col.innerHTML = tplFotos();
  else if (ACTIVE_TAB==='salvas') col.innerHTML = tplSalvas();
  bindTabEvents();
  renderPreview();
}

/* ============================== tab: dados ============================== */
function tplDados(){
  var m = STATE.meta;
  var banner = STATE.isExample ? '<div class="example-banner"><span><b>Exemplo pré-carregado.</b> Edite os campos ou clique em “+ Nova” para começar do zero.</span></div>' : '';
  return banner + '<div class="panel"><h2>Dados da proposta <span class="tag">metadados</span></h2><p class="panel-sub">Número, datas e para quem é a proposta.</p>'+
    '<div class="field-grid">'+ field('numero','Nº da proposta', m.numero) + field('emissao','Emissão', m.emissao) + field('validadeDias','Validade (dias)', m.validadeDias, 'number') + field('cidade','Cidade / UF', m.cidade) + '</div></div>'+
  '<div class="panel"><h2>Cliente</h2><div class="field-grid">'+ field('cliente','Empresa / cliente', m.cliente) + field('aCuidado','A/C (contato)', m.aCuidado) + field('cnpj','CNPJ', m.cnpj) + field('referencia','Referência (linha "Ref.:")', m.referencia) + '</div></div>'+
  '<div class="panel"><h2>Evento / grupo</h2><p class="panel-sub">Resumos que aparecem na tabela “Dados do grupo”.</p><div class="field-grid">'+ field('periodo','Período', m.periodo) + field('diarias','Diárias', m.diarias) + field('pessoas','Nº de pessoas', m.pessoas) + '</div></div>'+
  '<div class="panel"><h2>Assinatura</h2><div class="field-grid">'+ field('assinaturaNome','Nome', m.assinaturaNome) + field('assinaturaCargo','Cargo', m.assinaturaCargo) + '</div></div>';
}
function field(key, label, value, type){ return '<label class="field">'+esc(label)+'<input type="'+(type||'text')+'" value="'+esc(value)+'" data-meta-input="'+key+'"></label>'; }
function bindMetaInputs(root){
  Array.prototype.forEach.call(root.querySelectorAll('[data-meta-input]'), function(inp){
    inp.addEventListener('input', debounce(function(){
      var k = inp.getAttribute('data-meta-input');
      STATE.meta[k] = inp.type==='number' ? Number(inp.value) : inp.value;
      renderPreview();
    }, 150));
  });
}

/* ============================== tab: hospedagem ============================== */
function tplHospedagem(){
  if (!STATE.hospedagem.length) return '<div class="panel"><h2>Hospedagem</h2><p class="empty-note">Nenhum tipo de apartamento ainda.</p>'+addRowBtn('hosp')+'</div>';
  var html = '<div class="panel"><h2>Hospedagem <span class="tag">tarifas</span></h2><p class="panel-sub">Cada quarto pode ter desconto e regra de imposto próprios.</p>';
  STATE.hospedagem.forEach(function(r){
    var calc = calcHosp(r);
    html += '<div class="row-card" data-row="'+r.id+'">'+
      '<div class="row-card-top"><span class="row-badge'+(r.unidade==='suites'?' suites':'')+'">'+esc(UNIT_LABELS[r.unidade]||r.unidade)+'</span><span style="flex:1"></span>'+
      '<button class="icon-btn" data-del-hosp="'+r.id+'" title="Remover">×</button></div>'+
      '<div class="row-grid">'+
        rowSelect(r.id,'hosp','unidade','Unidade', [['business','Victory Business Hotel'],['suites','Victory Suítes']], r.unidade) +
        rowSelect(r.id,'hosp','tipo','Tipo de apartamento', ROOM_TYPES.map(function(t){return [t,t];}).concat([['Outro','Outro (digitar)']]), r.tipo, true) +
        rowInput(r.id,'hosp','tarifa','Tarifa de tabela (R$)', r.tarifa, 'number') +
        rowInput(r.id,'hosp','descontoPct','Desconto (%)', r.descontoPct, 'number') +
        rowSelect(r.id,'hosp','regraImposto','Regra de imposto', TAX_OPTIONS.map(function(o){return [o.key,o.label];}), r.regraImposto, false, true) +
        rowInput(r.id,'hosp','obs','Observação', r.obs, 'text', true) +
        rowPhotoSelect(r.id,'hosp', r.fotoId, ROOM_TO_CAT[r.tipo]) +
      '</div>'+
      '<div class="p-note" style="padding-top:8px;">'+
        (calc.desconto>0 ? ('Tabela: <s>'+brl(calc.tarifa)+'</s> → Com desconto: <b>'+brl(calc.base)+'</b>. ') : '') +
        'Valor final ('+esc(taxLabel(calc.regra))+'): <b>'+brl(calc.comImposto)+'</b>'+
      '</div></div>';
  });
  html += addRowBtn('hosp') + '</div>';
  return html;
}
function rowInput(id, kind, key, label, value, type, wide){ return '<label class="field'+(wide?' wide':'')+'">'+esc(label)+'<input type="'+(type||'text')+'" value="'+esc(value==null?'':value)+'" data-row-input data-kind="'+kind+'" data-row-id="'+id+'" data-row-key="'+key+'"></label>'; }
function rowSelect(id, kind, key, label, options, value, withCustom, wide){
  var opts = options.map(function(o){ return '<option value="'+esc(o[0])+'"'+(o[0]===value?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('');
  if (withCustom && options.every(function(o){return o[0]!==value;}) && value){ opts += '<option value="'+esc(value)+'" selected>'+esc(value)+'</option>'; }
  return '<label class="field'+(wide?' wide':'')+'">'+esc(label)+'<select data-row-select data-kind="'+kind+'" data-row-id="'+id+'" data-row-key="'+key+'">'+opts+'</select></label>';
}
function rowPhotoSelect(id, kind, fotoId, suggestedCat){
  var list = PHOTOS.slice();
  if (suggestedCat){ list.sort(function(a,b){ var av=a.category===suggestedCat?0:1, bv=b.category===suggestedCat?0:1; return av-bv; }); }
  var opts = '<option value="">— sem foto —</option>' + list.map(function(p){ return '<option value="'+esc(p.id)+'"'+(p.id===fotoId?' selected':'')+'>'+esc(catLabel(p.category))+' · '+esc(p.name||'foto')+'</option>'; }).join('');
  return '<label class="field wide">Foto de referência<select data-row-select data-kind="'+kind+'" data-row-id="'+id+'" data-row-key="fotoId">'+opts+'</select></label>';
}
function addRowBtn(kind){ return '<button class="add-row-btn" data-add="'+kind+'">+ Adicionar '+(kind==='hosp'?'tipo de apartamento':'item')+'</button>'; }

/* ============================== tab: alimentação & eventos ============================== */
function tplAlimentacao(){
  if (!STATE.alimentacao.length) return '<div class="panel"><h2>Alimentação &amp; Eventos</h2><p class="empty-note">Nenhum item ainda.</p>'+addRowBtn('alim')+'</div>';
  var html = '<div class="panel"><h2>Alimentação &amp; Eventos <span class="tag">serviços</span></h2><p class="panel-sub">Refeições, coffee break ou locação de espaço.</p>';
  STATE.alimentacao.forEach(function(r){
    html += '<div class="row-card" data-row="'+r.id+'">'+
      '<div class="row-card-top"><span class="row-badge">'+esc(r.servico||'Item')+'</span><span style="flex:1"></span>'+
      '<button class="icon-btn" data-del-alim="'+r.id+'" title="Remover">×</button></div>'+
      '<div class="row-grid">'+
        rowSelect(r.id,'alim','servico','Serviço', [['Almoço','Almoço'],['Jantar','Jantar'],['Coffee Break','Coffee Break'],['Locação de espaço','Locação de espaço'],['Outro','Outro']], r.servico, true) +
        rowInput(r.id,'alim','qtdLabel','Quantidade (texto livre)', r.qtdLabel) +
        rowInput(r.id,'alim','valor','Valor (R$)', r.valor, 'number') +
        rowSelect(r.id,'alim','unidadeValor','Por', [['pessoa','pessoa'],['diaria','diária'],['evento','evento (fechado)']], r.unidadeValor) +
        rowInput(r.id,'alim','obs','Observação', r.obs, 'text', true) +
        rowPhotoSelect(r.id,'alim', r.fotoId, SERVICE_TO_CAT[r.servico]) +
      '</div></div>';
  });
  html += addRowBtn('alim') + '</div>';
  return html;
}

/* ============================== tab: condições ============================== */
function tplCondicoes(){
  var html = '<div class="panel"><h2>Condições especiais</h2><p class="panel-sub">Lista exibida ao final da proposta. Use <code>{{validade}}</code> para inserir os dias de validade automaticamente.</p>';
  STATE.condicoes.forEach(function(c, i){
    html += '<div class="cond-item" data-cond-idx="'+i+'"><span class="cond-drag">✓</span><textarea data-cond-input data-idx="'+i+'">'+esc(c)+'</textarea>'+
      '<button class="icon-btn" data-del-cond="'+i+'" title="Remover" style="margin-top:4px;">×</button></div>';
  });
  html += '<button class="add-row-btn" data-add="cond">+ Adicionar condição</button>'+
    '<button class="btn btn-line btn-sm" style="margin-top:10px;" id="btnResetCond">Restaurar padrão</button></div>';
  return html;
}

/* ============================== tab: fotos ============================== */
function tplFotos(){
  var logoHtml = '<div class="panel"><h2>Logomarca</h2><p class="panel-sub">Usada no cabeçalho da pré-visualização e do PDF. Enviada uma vez, fica salva para sempre.</p>'+
    '<div class="logo-slot">' + '<img src="'+esc((LOGO||DEFAULT_LOGO).url)+'" alt="logo">' +
      '<div style="display:flex; flex-direction:column; gap:6px;"><input type="file" accept="image/png,image/jpeg" id="logoInput">'+
      (LOGO ? '<button class="btn btn-line btn-sm" id="btnRemoveLogo">Remover logo</button>' : '') + '</div></div></div>';

  var uploadHtml = '<div class="panel"><h2>Adicionar foto</h2>'+
    '<div class="field-grid">'+
      '<label class="field">Categoria<select id="newPhotoCat">'+CATS.map(function(c){return '<option value="'+c.key+'">'+esc(c.label)+'</option>';}).join('')+'</select></label>'+
      '<label class="field">Nome / legenda<input type="text" id="newPhotoName" placeholder="ex.: Apartamento Duplo Superior"></label>'+
    '</div>'+
    '<div class="upload-zone" id="dropZone">Arraste uma foto aqui ou <label style="color:var(--gold); cursor:pointer; text-decoration:underline;">escolha um arquivo<input type="file" accept="image/png,image/jpeg" id="photoInput" class="hidden"></label><br>PNG ou JPEG</div></div>';

  var grouped = {}; PHOTOS.forEach(function(p){ (grouped[p.category]=grouped[p.category]||[]).push(p); });
  var galleryHtml = '<div class="panel"><h2>Biblioteca de fotos <span class="tag">'+PHOTOS.length+' fotos</span></h2>';
  if (!PHOTOS.length){ galleryHtml += '<p class="empty-note">Nenhuma foto cadastrada ainda. Fotos enviadas aqui ficam disponíveis para todas as propostas e para todos que acessarem este site.</p>'; }
  else {
    CATS.forEach(function(c){
      var list = grouped[c.key]; if (!list || !list.length) return;
      galleryHtml += '<h3 style="font-size:12px; margin-top:14px;">'+esc(c.label)+'</h3><div class="photo-grid">';
      list.forEach(function(p){
        galleryHtml += '<div class="photo-card"><img src="'+esc(p.url)+'" alt="'+esc(p.name||'')+'" loading="lazy">'+
          '<div class="pc-body"><div class="pc-name">'+esc(p.name||'sem nome')+'</div></div>'+
          '<div class="pc-actions"><button class="icon-btn" data-del-photo="'+p.id+'" title="Excluir">×</button></div></div>';
      });
      galleryHtml += '</div>';
    });
  }
  galleryHtml += '</div>';
  return logoHtml + uploadHtml + galleryHtml;
}

/* ============================== tab: salvas ============================== */
function tplSalvas(){
  var html = '<div class="panel"><h2>Minhas propostas <span class="tag">'+SAVED.length+'</span></h2><p class="panel-sub">Propostas salvas ficam disponíveis para todos que acessarem este site.</p>';
  if (!SAVED.length){ html += '<p class="empty-note">Nenhuma proposta salva ainda. Monte a proposta nas abas acima e clique em “Salvar” no topo.</p>'; }
  SAVED.forEach(function(s){
    var dt = s.updatedAt ? new Date(s.updatedAt).toLocaleString('pt-BR') : '';
    html += '<div class="prop-row"><div class="pr-main"><div class="pr-title">'+esc(s.cliente||'(sem cliente)')+'</div><div class="pr-sub">'+esc(s.numero||'')+' · '+esc(dt)+'</div></div>'+
      '<div class="pr-actions"><button class="btn btn-line btn-sm" data-load-prop="'+s.id+'">Abrir</button>'+
      '<button class="btn btn-line btn-sm" data-dup-prop="'+s.id+'">Duplicar</button>'+
      '<button class="icon-btn" data-del-prop="'+s.id+'" title="Excluir">×</button></div></div>';
  });
  return html;
}

/* ============================== binding ============================== */
function bindTabEvents(){
  var col = document.getElementById('formCol');
  bindMetaInputs(col);
  Array.prototype.forEach.call(col.querySelectorAll('[data-row-input]'), function(inp){ inp.addEventListener('input', debounce(function(){ onRowChange(inp); }, 150)); });
  Array.prototype.forEach.call(col.querySelectorAll('[data-row-select]'), function(sel){ sel.addEventListener('change', function(){ onRowChange(sel, true); }); });
  Array.prototype.forEach.call(col.querySelectorAll('[data-del-hosp]'), function(btn){ btn.addEventListener('click', function(){ STATE.hospedagem = STATE.hospedagem.filter(function(r){ return r.id !== btn.getAttribute('data-del-hosp'); }); renderTab(); }); });
  Array.prototype.forEach.call(col.querySelectorAll('[data-del-alim]'), function(btn){ btn.addEventListener('click', function(){ STATE.alimentacao = STATE.alimentacao.filter(function(r){ return r.id !== btn.getAttribute('data-del-alim'); }); renderTab(); }); });
  var addBtn = col.querySelector('[data-add="hosp"]');
  if (addBtn) addBtn.addEventListener('click', function(){ STATE.hospedagem.push({ id:uid(), unidade:'business', tipo:'Individual (SGL)', tarifa:0, descontoPct:0, regraImposto:'iss5', obs:'Café da manhã incluso', fotoId:null }); renderTab(); });
  var addAlim = col.querySelector('[data-add="alim"]');
  if (addAlim) addAlim.addEventListener('click', function(){ STATE.alimentacao.push({ id:uid(), servico:'Almoço', qtdLabel:'', valor:0, unidadeValor:'pessoa', obs:'', fotoId:null }); renderTab(); });
  var addCond = col.querySelector('[data-add="cond"]');
  if (addCond) addCond.addEventListener('click', function(){ STATE.condicoes.push(''); renderTab(); });
  var resetCond = col.querySelector('#btnResetCond');
  if (resetCond) resetCond.addEventListener('click', function(){ STATE.condicoes = DEFAULT_CONDICOES.slice(); renderTab(); });
  Array.prototype.forEach.call(col.querySelectorAll('[data-del-cond]'), function(btn){ btn.addEventListener('click', function(){ STATE.condicoes.splice(Number(btn.getAttribute('data-del-cond')),1); renderTab(); }); });
  Array.prototype.forEach.call(col.querySelectorAll('[data-cond-input]'), function(ta){ ta.addEventListener('input', debounce(function(){ STATE.condicoes[Number(ta.getAttribute('data-idx'))] = ta.value; renderPreview(); }, 150)); });

  var photoInput = col.querySelector('#photoInput');
  if (photoInput) photoInput.addEventListener('change', function(){ if (photoInput.files[0]) handlePhotoUpload(photoInput.files[0]); });
  var dropZone = col.querySelector('#dropZone');
  if (dropZone){
    dropZone.addEventListener('dragover', function(e){ e.preventDefault(); dropZone.classList.add('drag'); });
    dropZone.addEventListener('dragleave', function(){ dropZone.classList.remove('drag'); });
    dropZone.addEventListener('drop', function(e){ e.preventDefault(); dropZone.classList.remove('drag'); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handlePhotoUpload(f); });
  }
  var logoInput = col.querySelector('#logoInput');
  if (logoInput) logoInput.addEventListener('change', function(){ if (logoInput.files[0]) handleLogoUpload(logoInput.files[0]); });
  var btnRemoveLogo = col.querySelector('#btnRemoveLogo');
  if (btnRemoveLogo) btnRemoveLogo.addEventListener('click', removeLogo);
  Array.prototype.forEach.call(col.querySelectorAll('[data-del-photo]'), function(btn){ btn.addEventListener('click', function(){ deletePhoto(btn.getAttribute('data-del-photo')); }); });

  Array.prototype.forEach.call(col.querySelectorAll('[data-load-prop]'), function(btn){ btn.addEventListener('click', function(){ loadProposal(btn.getAttribute('data-load-prop')); }); });
  Array.prototype.forEach.call(col.querySelectorAll('[data-dup-prop]'), function(btn){ btn.addEventListener('click', function(){ loadProposal(btn.getAttribute('data-dup-prop'), true); }); });
  Array.prototype.forEach.call(col.querySelectorAll('[data-del-prop]'), function(btn){ btn.addEventListener('click', function(){ deleteProposal(btn.getAttribute('data-del-prop')); }); });
}
function onRowChange(el, isSelect){
  var kind = el.getAttribute('data-kind'), id = el.getAttribute('data-row-id'), key = el.getAttribute('data-row-key');
  var list = kind==='hosp' ? STATE.hospedagem : STATE.alimentacao;
  var row = list.find(function(r){ return r.id === id; });
  if (!row) return;
  var val = el.value; if (el.type==='number') val = Number(val);
  row[key] = val;
  if (isSelect && (key==='tipo' || key==='servico' || key==='unidade')){ renderTab(); return; }
  if (kind==='hosp'){ renderTab(); } else { renderPreview(); }
}

/* ============================== photo / logo upload ============================== */
function fileToBase64(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(String(reader.result).split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function handlePhotoUpload(file){
  var col = document.getElementById('formCol');
  var cat = (col.querySelector('#newPhotoCat')||{}).value || 'fachada';
  var name = (col.querySelector('#newPhotoName')||{}).value || file.name;
  toast('Enviando foto…');
  try {
    var b64 = await fileToBase64(file);
    await withAuthRetry(function(){ return API.request('photos', { method:'POST', body:{ category:cat, name:name, contentType:file.type||'image/jpeg', dataBase64:b64 } }); });
    await refreshAll(); renderTab();
    toast('Foto adicionada.', 'ok');
  } catch(e){ toast('Falha ao enviar a foto.', 'err'); }
}
async function deletePhoto(id){
  try {
    await withAuthRetry(function(){ return API.request('photos?id='+encodeURIComponent(id), { method:'DELETE' }); });
    await refreshAll(); renderTab();
    toast('Foto removida.', 'ok');
  } catch(e){ toast('Não foi possível remover esta foto.', 'err'); }
}
async function handleLogoUpload(file){
  toast('Enviando logo…');
  try {
    var b64 = await fileToBase64(file);
    await withAuthRetry(function(){ return API.request('logo', { method:'POST', body:{ contentType:file.type||'image/png', dataBase64:b64 } }); });
    await refreshAll(); renderTab();
    toast('Logo salva.', 'ok');
  } catch(e){ toast('Falha ao enviar a logo.', 'err'); }
}
async function removeLogo(){
  try {
    await withAuthRetry(function(){ return API.request('logo', { method:'DELETE' }); });
    await refreshAll(); renderTab();
    toast('Logo removida.', 'ok');
  } catch(e){ toast('Não foi possível remover a logo.', 'err'); }
}

/* ============================== save / load proposals ============================== */
async function saveProposal(){
  toast('Salvando…');
  try {
    var res = await withAuthRetry(function(){
      return API.request('proposals', { method:'POST', body:{ id: STATE.id||undefined, cliente: STATE.meta.cliente||'(sem nome)', numero: STATE.meta.numero, stateJson: JSON.stringify(STATE) } });
    });
    STATE.id = res.id; STATE.isExample = false;
    await refreshAll(); renderTabbar();
    toast('Proposta salva.', 'ok');
  } catch(e){ toast('Não foi possível salvar.', 'err'); }
}
async function loadProposal(id, asDuplicate){
  try {
    var res = await withAuthRetry(function(){ return API.request('proposals?id='+encodeURIComponent(id)); });
    var parsed = JSON.parse(res.stateJson);
    parsed.id = asDuplicate ? null : id; parsed.isExample = false;
    STATE = parsed; ACTIVE_TAB = 'dados';
    toast(asDuplicate ? 'Proposta duplicada — edite e salve.' : 'Proposta carregada.', 'ok');
    renderTab();
  } catch(e){ toast('Não foi possível abrir esta proposta.', 'err'); }
}
async function deleteProposal(id){
  try {
    await withAuthRetry(function(){ return API.request('proposals?id='+encodeURIComponent(id), { method:'DELETE' }); });
    if (STATE.id===id) STATE.id=null;
    await refreshAll(); renderTab();
    toast('Proposta excluída.', 'ok');
  } catch(e){ toast('Não foi possível excluir.', 'err'); }
}

/* ============================== live HTML preview ============================== */
function renderPreview(){
  var m = STATE.meta;
  var validadeData = addDaysPtBR(m.validadeDias);
  var groups = groupHospByUnit();
  var unitLabel = groups.map(function(g){ return UNIT_LABELS[g.unidade]||g.unidade; }).join(' e ') || '—';

  var headerRow = LOGO ? '<div class="p-header-row"><img src="'+esc(LOGO.url)+'" alt="logo"></div>'
    : '<div class="p-header-row"><div class="wordmark"><b>VICTORY</b><span>HOTÉIS</span></div></div>';

  var html = headerRow;
  html += '<div class="p-titleblock"><h1>PROPOSTA COMERCIAL</h1><div class="sub">'+esc(m.referencia || 'Cotação de hospedagem')+'</div></div>';
  html += '<div class="p-info">'+ infoCell('Nº da proposta', m.numero) + infoCell('Emissão', m.emissao) + infoCell('Validade', validadeData+' ('+esc(m.validadeDias)+' dias)') + '</div>';
  html += '<div class="p-para"><div class="lbl">PARA</div><div class="nm">'+esc(m.cliente||'—')+(m.aCuidado?(' — '+esc(m.aCuidado)):'')+'</div>'+
    '<div class="rf">Ref.: '+esc(m.referencia||'—')+(m.cnpj?(' — CNPJ '+esc(m.cnpj)):'')+'</div></div>';
  html += '<div class="p-section"><h3>Dados do grupo</h3><table class="p-kv">'+ kvRow('Período', m.periodo||'—') + kvRow('Diárias', m.diarias||'—') + kvRow('Pessoas', m.pessoas||'—') + kvRow('Unidade(s)', unitLabel) + '</table></div>';

  groups.forEach(function(g){
    html += '<div class="p-section"><h3>Hospedagem — '+esc(UNIT_LABELS[g.unidade]||g.unidade)+'</h3>';
    var anyDiscount = g.rows.some(function(r){ return (Number(r.descontoPct)||0) > 0; });
    if (anyDiscount) html += '<div class="p-rate-banner">DESCONTO APLICADO — valor de tabela riscado e valor final em destaque</div>';
    html += '<table class="p-rate"><tr><th style="text-align:left;">Tipo</th><th>Tarifa</th><th>Valor final</th><th>Observação</th></tr>';
    g.rows.forEach(function(r, i){
      var c = calcHosp(r);
      html += '<tr class="'+(i%2?'odd':'')+'"><td>'+esc(r.tipo)+'</td>'+
        '<td>'+(c.desconto>0 ? ('<span class="p-strike">'+brl(c.tarifa)+'</span>') : brl(c.tarifa))+'</td>'+
        '<td><span class="p-final">'+brl(c.comImposto)+'</span><br><small style="font-weight:400;color:var(--paper-gray2);font-size:9.5px;">'+esc(taxLabel(c.regra))+'</small></td>'+
        '<td>'+esc(r.obs||'')+'</td></tr>';
    });
    html += '</table><div class="p-note">'+esc(unitTaxNote(g.rows))+'</div>';
    var photos = g.rows.map(function(r){ return fotoById(r.fotoId); }).filter(Boolean);
    if (photos.length) html += thumbsHtml(photos);
    html += '</div>';
  });

  if (STATE.alimentacao.length){
    html += '<div class="p-section"><h3>Alimentação &amp; Eventos</h3><table class="p-rate"><tr><th style="text-align:left;">Serviço</th><th>Qtd.</th><th>Valor</th><th>Observação</th></tr>';
    STATE.alimentacao.forEach(function(r, i){
      html += '<tr class="'+(i%2?'odd':'')+'"><td>'+esc(r.servico)+'</td><td>'+esc(r.qtdLabel||'—')+'</td>'+
        '<td><b style="color:var(--navy);">'+brl(r.valor)+'</b><br><small style="font-weight:400;color:var(--paper-gray2);font-size:9.5px;">por '+esc(r.unidadeValor)+'</small></td>'+
        '<td>'+esc(r.obs||'')+'</td></tr>';
    });
    html += '</table>';
    var aphotos = STATE.alimentacao.map(function(r){ return fotoById(r.fotoId); }).filter(Boolean);
    if (aphotos.length) html += thumbsHtml(aphotos);
    html += '</div>';
  }

  html += '<div class="p-section"><h3>Condições especiais</h3><ul class="p-cond">'+
    STATE.condicoes.filter(function(c){return c && c.trim();}).map(function(c){ return '<li><span class="ck">✓</span><span>'+esc(c.replace('{{validade}}', String(m.validadeDias)))+'</span></li>'; }).join('') + '</ul></div>';

  html += '<div class="p-sign">'+esc(m.cidade||'')+', '+esc(m.emissao||'')+'<div class="ln"></div><b>'+esc(m.assinaturaNome||'')+'</b>'+esc(m.assinaturaCargo||'')+'</div>';
  html += '<div class="p-closing"></div>';
  html += '<div class="p-footer"><b>Victory Hotéis</b> · Victory Business Hotel &amp; Victory Suítes — Juiz de Fora / MG<br>centraldereservas@victoryhoteis.com · www.victoryhoteis.com</div>';

  document.getElementById('paper').innerHTML = html;
}
function thumbsHtml(photos){
  return '<div class="p-thumbs">'+photos.map(function(p){
    return '<figure><img src="'+esc(p.url)+'" alt="'+esc(p.name||'')+'">'+
      '<figcaption><b>'+esc(p.name||'Foto')+'</b>'+esc(catLabel(p.category))+'</figcaption></figure>';
  }).join('')+'</div>';
}
function infoCell(label, value){ return '<div><b>'+esc(label)+'</b><span>'+esc(value)+'</span></div>'; }
function kvRow(k, v){ return '<tr><td class="k">'+esc(k)+'</td><td class="v"><b>'+esc(v)+'</b></td></tr>'; }

/* ============================== PDF export (jsPDF + autoTable) ============================== */
var PDF_BLACK = [10,10,10], PDF_NAVY = [27,47,102], PDF_GOLD = [27,47,102],
    PDF_SKY = [141,211,240], PDF_LTGRAY = [250,248,244],
    PDF_G1 = [74,74,74], PDF_G2 = [107,101,93], PDF_G3 = [168,162,154];

function fetchAsDataUrl(url){
  return fetch(url).then(function(res){
    if (!res.ok) throw new Error('fetch failed');
    return res.blob();
  }).then(function(blob){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(String(reader.result)); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  });
}
function imgFormatFromContentType(ct){
  if (!ct) return null;
  if (ct.indexOf('png')>=0) return 'PNG';
  if (ct.indexOf('jpeg')>=0 || ct.indexOf('jpg')>=0) return 'JPEG';
  return null;
}
function getImageSize(dataUrl){
  return new Promise(function(resolve){
    var img = new Image();
    img.onload = function(){ resolve({w:img.naturalWidth,h:img.naturalHeight}); };
    img.onerror = function(){ resolve({w:0,h:0}); };
    img.src = dataUrl;
  });
}

async function buildPdf(){
  var jsPDFCtor = window.jspdf.jsPDF;
  var doc = new jsPDFCtor({ unit:'pt', format:'a4' });
  var pageW = doc.internal.pageSize.getWidth();
  var pageH = doc.internal.pageSize.getHeight();
  var margin = 40, usableW = pageW - margin*2;
  var y = 0;

  function ensure(need){
    if (y + need > pageH - 50){ doc.addPage(); y = margin; }
  }

  var m = STATE.meta;
  var validadeData = addDaysPtBR(m.validadeDias);
  var groups = groupHospByUnit();
  var unitLabel = groups.map(function(g){ return UNIT_LABELS[g.unidade]||g.unidade; }).join(' e ') || '—';

  // ---- title band ----
  doc.setFillColor.apply(doc, PDF_BLACK);
  doc.rect(0, 0, pageW, 64, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(19);
  doc.text('PROPOSTA COMERCIAL', margin, 32);
  doc.setTextColor.apply(doc, PDF_SKY); doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
  doc.text(m.referencia || 'Cotação de hospedagem', margin, 48);

  // logo (top right, over the band) or wordmark
  try {
    if (LOGO){
      var dataUrl = await fetchAsDataUrl(LOGO.url);
      var fmt = imgFormatFromContentType(LOGO.contentType);
      if (fmt){
        var dims = await getImageSize(dataUrl);
        var lw = 86, lh = dims.w ? Math.round(lw * dims.h / dims.w) : 32;
        if (lh > 44){ lh = 44; lw = dims.h ? Math.round(lh * dims.w / dims.h) : 86; }
        doc.addImage(dataUrl, fmt, pageW - margin - lw, 10, lw, lh);
      }
    } else {
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(14);
      doc.text('VICTORY', pageW - margin, 26, { align:'right' });
      doc.setTextColor.apply(doc, PDF_GOLD); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text('H O T É I S', pageW - margin, 36, { align:'right' });
    }
  } catch(e){ /* logo optional */ }

  y = 84;

  // ---- info row ----
  doc.autoTable({
    startY: y, margin:{left:margin, right:margin},
    head:[['Nº DA PROPOSTA','EMISSÃO','VALIDADE DA PROPOSTA']],
    body:[[m.numero||'—', m.emissao||'—', validadeData+' ('+m.validadeDias+' dias)']],
    theme:'plain',
    headStyles:{ fillColor:PDF_NAVY, textColor:255, fontSize:8, fontStyle:'bold' },
    bodyStyles:{ fontSize:11, textColor:PDF_NAVY, fontStyle:'bold' },
    styles:{ cellPadding:5 }
  });
  y = doc.lastAutoTable.finalY + 10;

  // ---- PARA block ----
  ensure(50);
  doc.setTextColor.apply(doc, PDF_GOLD); doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text('PARA', margin, y);
  y += 13;
  doc.setTextColor(17,17,17); doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text((m.cliente||'—') + (m.aCuidado?(' — '+m.aCuidado):''), margin, y);
  y += 13;
  doc.setTextColor.apply(doc, PDF_G1); doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
  doc.text('Ref.: '+(m.referencia||'—') + (m.cnpj?(' — CNPJ '+m.cnpj):''), margin, y);
  y += 10;
  doc.setDrawColor(217,217,217); doc.line(margin, y, pageW-margin, y);
  y += 16;

  function heading(text){
    ensure(26);
    doc.setTextColor.apply(doc, PDF_GOLD); doc.setFont('helvetica','bold'); doc.setFontSize(10.5);
    doc.text(text.toUpperCase(), margin, y);
    doc.setDrawColor.apply(doc, PDF_GOLD); doc.setLineWidth(1.2);
    doc.line(margin, y+3, pageW-margin, y+3);
    doc.setLineWidth(0.5);
    y += 16;
  }
  async function fotosBlock(rows){
    var ids = rows.map(function(r){ return r.fotoId; }).filter(Boolean);
    if (!ids.length) return;
    var cols = Math.min(3, ids.length), gap = 10;
    var cellW = (usableW - gap*(cols-1)) / cols, cellH = cellW * 0.62;
    ensure(cellH + 30);
    var startY = y;
    for (var i=0; i<ids.length; i++){
      var ph = fotoById(ids[i]); if (!ph) continue;
      var col = i % cols;
      if (col === 0 && i > 0){ y += cellH + 26; ensure(cellH + 30); startY = y; }
      var x = margin + col*(cellW+gap);
      var fmt = imgFormatFromContentType(ph.contentType);
      try {
        if (fmt){ doc.addImage(await fetchAsDataUrl(ph.url), fmt, x, startY, cellW, cellH, undefined, 'FAST'); }
        else { doc.setDrawColor(220,220,220); doc.rect(x, startY, cellW, cellH); }
      } catch(e){ doc.setDrawColor(220,220,220); doc.rect(x, startY, cellW, cellH); }
      doc.setTextColor(10,10,10); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
      doc.text(ph.name||'Foto', x, startY + cellH + 9, { maxWidth: cellW });
      doc.setTextColor.apply(doc, PDF_G2); doc.setFont('helvetica','normal'); doc.setFontSize(7);
      doc.text(catLabel(ph.category), x, startY + cellH + 17, { maxWidth: cellW });
    }
    y = startY + cellH + 26;
  }

  function note(text){
    ensure(24);
    doc.setTextColor.apply(doc, PDF_G2); doc.setFont('helvetica','italic'); doc.setFontSize(8.5);
    var lines = doc.splitTextToSize(text, usableW);
    doc.text(lines, margin, y);
    y += lines.length * 10 + 8;
  }

  // ---- dados do grupo ----
  heading('Dados do grupo');
  doc.autoTable({
    startY: y, margin:{left:margin, right:margin}, theme:'grid',
    body:[['PERÍODO', m.periodo||'—'], ['DIÁRIAS', m.diarias||'—'], ['PESSOAS', m.pessoas||'—'], ['UNIDADE(S)', unitLabel]],
    styles:{ fontSize:9.5, cellPadding:5 },
    columnStyles:{ 0:{cellWidth:120} },
    didParseCell: function(data){
      if (data.column.index===0){ data.cell.styles.fillColor = PDF_NAVY; data.cell.styles.textColor = 255; data.cell.styles.fontStyle='bold'; }
      else { data.cell.styles.textColor = PDF_NAVY; data.cell.styles.fontStyle='bold'; if (data.row.index%2===0) data.cell.styles.fillColor = PDF_LTGRAY; }
    }
  });
  y = doc.lastAutoTable.finalY + 14;

  // ---- hospedagem per unit ----
  for (var gi=0; gi<groups.length; gi++){
    var g = groups[gi];
    heading('Hospedagem — ' + (UNIT_LABELS[g.unidade]||g.unidade));
    var anyDiscount = g.rows.some(function(r){ return (Number(r.descontoPct)||0) > 0; });
    if (anyDiscount){
      ensure(14);
      doc.setTextColor.apply(doc, PDF_GOLD); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
      doc.text('DESCONTO APLICADO — tarifa de tabela → valor final com desconto', margin, y);
      y += 12;
    }
    var body = g.rows.map(function(r){
      var c = calcHosp(r);
      var tarifaTxt = c.desconto>0 ? ('de '+brl(c.tarifa)+'\npor '+brl(c.base)+' (-'+c.desconto+'%)') : brl(c.tarifa);
      var finalTxt = brl(c.comImposto) + '\n' + taxLabel(c.regra);
      return [r.tipo, tarifaTxt, finalTxt, r.obs||''];
    });
    doc.autoTable({
      startY: y, margin:{left:margin, right:margin}, theme:'grid',
      head:[['TIPO DE APARTAMENTO','TARIFA','VALOR FINAL','OBSERVAÇÃO']],
      body: body,
      headStyles:{ fillColor:PDF_NAVY, textColor:255, fontSize:8.5 },
      alternateRowStyles:{ fillColor:PDF_LTGRAY },
      styles:{ fontSize:9, cellPadding:5, valign:'middle' },
      columnStyles:{ 1:{halign:'center'}, 2:{halign:'center', fontStyle:'bold', textColor:PDF_NAVY}, 3:{halign:'center', fontSize:8} }
    });
    y = doc.lastAutoTable.finalY + 4;
    note(unitTaxNote(g.rows));
    await fotosBlock(g.rows);
  }

  // ---- alimentação & eventos ----
  if (STATE.alimentacao.length){
    heading('Alimentação & Eventos');
    var abody = STATE.alimentacao.map(function(r){
      return [r.servico, r.qtdLabel||'—', brl(r.valor)+' / '+r.unidadeValor, r.obs||''];
    });
    doc.autoTable({
      startY: y, margin:{left:margin, right:margin}, theme:'grid',
      head:[['SERVIÇO','QTD.','VALOR','OBSERVAÇÃO']], body: abody,
      headStyles:{ fillColor:PDF_NAVY, textColor:255, fontSize:8.5 },
      alternateRowStyles:{ fillColor:PDF_LTGRAY },
      styles:{ fontSize:9, cellPadding:5, valign:'middle' },
      columnStyles:{ 1:{halign:'center'}, 2:{halign:'center', fontStyle:'bold', textColor:PDF_NAVY}, 3:{halign:'center', fontSize:8} }
    });
    y = doc.lastAutoTable.finalY + 10;
    await fotosBlock(STATE.alimentacao);
  }

  // ---- condições especiais ----
  heading('Condições especiais');
  var condList = STATE.condicoes.filter(function(c){return c && c.trim();}).map(function(c){ return c.replace('{{validade}}', String(m.validadeDias)); });
  if (condList.length){
    doc.autoTable({
      startY: y, margin:{left:margin, right:margin}, theme:'plain',
      body: condList.map(function(c){ return ['✓', c]; }),
      styles:{ fontSize:9, cellPadding:5 },
      columnStyles:{ 0:{cellWidth:18, textColor:PDF_GOLD, fontStyle:'bold'} },
      alternateRowStyles:{ fillColor:PDF_LTGRAY }
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  // ---- signature ----
  ensure(70);
  doc.setTextColor.apply(doc, PDF_G1); doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
  doc.text((m.cidade||'')+', '+(m.emissao||''), pageW/2, y, { align:'center' });
  y += 26;
  doc.setDrawColor.apply(doc, PDF_G1);
  doc.line(pageW/2 - 110, y, pageW/2 + 110, y);
  y += 14;
  doc.setTextColor.apply(doc, PDF_NAVY); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text(m.assinaturaNome||'', pageW/2, y, { align:'center' });
  y += 13;
  doc.setTextColor.apply(doc, PDF_G2); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(m.assinaturaCargo||'', pageW/2, y, { align:'center' });

  // ---- footer on every page ----
  var pageCount = doc.internal.getNumberOfPages();
  for (var pi=1; pi<=pageCount; pi++){
    doc.setPage(pi);
    doc.setFillColor.apply(doc, PDF_BLACK);
    doc.rect(0, pageH-26, pageW, 4, 'F');
    doc.setTextColor.apply(doc, PDF_G2); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.text('Victory Hotéis  |  Victory Business Hotel & Victory Suítes — Juiz de Fora / MG', pageW/2, pageH-13, { align:'center' });
    doc.setFontSize(7);
    doc.text('Página '+pi+' de '+pageCount, pageW-margin, pageH-13, { align:'right' });
  }

  return doc;
}

async function exportPdf(){
  toast('Gerando PDF…');
  try {
    var doc = await buildPdf();
    var fname = 'Proposta Comercial - ' + (STATE.meta.cliente || 'Victory Hoteis').replace(/[\\/:*?"<>|]/g,'-') + '.pdf';
    doc.save(fname);
    toast('PDF baixado.', 'ok');
  } catch(e){ toast('Não foi possível gerar o PDF.', 'err'); }
}

/* ============================== top bar wiring ============================== */
document.getElementById('btnNew').addEventListener('click', function(){ STATE = blankState(); ACTIVE_TAB='dados'; renderTab(); toast('Nova proposta em branco.', 'ok'); });
document.getElementById('btnSave').addEventListener('click', saveProposal);
document.getElementById('btnExport').addEventListener('click', exportPdf);

boot();
})();
