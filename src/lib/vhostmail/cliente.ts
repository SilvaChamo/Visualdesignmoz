// VhostMail ↔ caixa real: a parte que corre na página do VhostMail (iframe do painel) e troca o conteúdo de exemplo do maquete
// pelas mensagens da caixa da conta aberta. Fala com /api/vhost/vhostmail/caixa (ler, marcar, mover, apagar, enviar…).
// O desenho do maquete não muda: só os dados e o que cada botão faz. Escrito só com aspas simples, sem backticks e sem «${»
// (o texto vai para dentro de um <script>, depois do código do maquete e de INTEGRACAO_JS).
export const CLIENTE_JS = String.raw`
/* ===== VhostMail: caixa real ===== */
(function(){
  var C=window.VM_CFG||{};
  var END=C.conta||'';
  var API='/api/vhost/vhostmail/caixa';
  var MESES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var CORES=['#9BBF3A','#22A9B5','#6C5CE7','#F08A24','#2D7FF9','#B33771','#3B3B98','#1DB954'];
  var NOM={inbox:'INBOX',sent:'Sent',drafts:'Drafts',trash:'Trash',spam:'Junk',archive:'Archive'};
  var FIXO={};
  var PAS=[],IDS={},CARR={},CARG={},TENT={},PROX=0,ERRO={},ANEX=[],RASC=null,CHEIA=false;
  var A_FOLDERS={inbox:1,sent:1,drafts:1,trash:1,spam:1,archive:1,starred:1};

  /* a caixa de exemplo do maquete sai: tudo o que se vê vem do servidor */
  M=[];S.labels=[];S.more=S.more.filter(function(f){return f!=='sched'});
  S.sel=null;S.checked.clear();

  /* o painel às vezes está ocupado (503): tenta mais duas vezes antes de avisar */
  function api(acao,d,tent){
    d=d||{};d.end=END;d.acao=acao;tent=tent||0;
    return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(d)}).then(function(r){
      return r.json().catch(function(){return {}}).then(function(j){
        if(r.status===503&&tent<2)return new Promise(function(ok){setTimeout(ok,1500)}).then(function(){return api(acao,d,tent+1)});
        if(!r.ok)throw new Error(j.erro||'Não foi possível concluir.');
        return j;
      });
    });
  }
  function falha(e){toast(esc((e&&e.message)||'Não foi possível concluir.'))}
  function tam(n){return n<1024?n+' B':n<1048576?Math.round(n/1024)+' KB':(n/1048576).toFixed(1)+' MB'}
  function dois(n){return (n<10?'0':'')+n}
  function quando(ts){
    if(!ts)return '';
    var d=new Date(ts*1000),h=new Date();
    if(d.toDateString()===h.toDateString())return 'hoje '+dois(d.getHours())+':'+dois(d.getMinutes());
    return MESES[d.getMonth()]+' '+d.getDate()+' '+d.getFullYear();
  }
  function longa(ts){
    if(!ts)return '';
    var d=new Date(ts*1000);
    return MESES[d.getMonth()]+' '+d.getDate()+' '+d.getFullYear()+', '+dois(d.getHours())+':'+dois(d.getMinutes());
  }
  function attr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
  function primeiro(para){
    var s=String(para||'').split(',')[0].trim(),m=s.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
    return m?{n:(m[1].trim()||m[2]),e:m[2]}:{n:s,e:s};
  }

  /* ---- pastas: nomes do servidor ↔ chaves do maquete ---- */
  function mapa(){
    var pats={sent:/^(sent|enviad)/i,drafts:/^(draft|rascunho)/i,trash:/^(trash|lixeira|deleted|bin)/i,spam:/^(junk|spam)/i,archive:/^(archive|arquiv)/i};
    PAS.forEach(function(p){
      var base=p.n.split(/[\/.]/).pop();
      for(var k in pats){if(!FIXO[k]&&pats[k].test(base)){NOM[k]=p.n;FIXO[k]=1}}
    });
    var usados={};usados.INBOX=1;for(var k2 in NOM)usados[NOM[k2]]=1;
    S.custom.length=0;
    PAS.forEach(function(p){var base=p.n.split(/[\/.]/).pop(),especial=false;for(var k3 in pats)if(pats[k3].test(base))especial=true;if(!usados[p.n]&&!especial)S.custom.push({id:'c:'+p.n,name:p.n.replace(/[<>&"]/g,'')})});
  }
  function pasta(k){return A_FOLDERS[k]&&NOM[k]?NOM[k]:(String(k).indexOf('c:')===0?String(k).slice(2):NOM[k]||k)}
  function chave(p){
    if(p==='INBOX')return 'inbox';
    for(var k in NOM)if(NOM[k]===p)return k;
    return 'c:'+p;
  }
  function refPastas(){
    return api('pastas').then(function(r){
      PAS=r.pastas||[];mapa();
      var ib=PAS.filter(function(p){return p.n==='INBOX'})[0];
      if(ib&&!PROX)PROX=ib.proximo;
      renderSide();
      return r;
    });
  }
  function novas(k){
    var p=pasta(k),x=PAS.filter(function(q){return q.n===p})[0];
    return x?x.novas:0;
  }

  /* ---- mensagens ---- */
  function conv(x,p){
    var k=chave(p),env=(k==='sent'||k==='drafts'),pr=primeiro(x.para);
    var id=IDS[p+'|'+x.uid]||(IDS[p+'|'+x.uid]=++NID);
    var nome=env?('Para: '+(pr.n||'(sem destinatário)')):(x.de||x.end||'(sem remetente)');
    return {id:id,f:k,from:nome,email:env?pr.e:x.end,to:x.para||'',date:quando(x.quando),subj:x.assunto||'(sem assunto)',prev:(x.snippet||'').replace(/\s+/g,' ').slice(0,160),
      body:['A carregar…'],unread:!x.lida,star:!!x.estrela,att:x.anexo?[{n:'',s:''}]:[],color:CORES[(x.uid||id)%CORES.length],draft:!!x.rascunho,_p:p,_u:x.uid,_dl:longa(x.quando),_q:x.quando||0};
  }
  function carregar(k,forcar){
    if(CARR[k]&&!forcar)return CARR[k];
    var p=pasta(k);delete ERRO[k];CARG[k]=true;TENT[k]=true;
    var pr=api('lista',{pasta:p,max:150}).then(function(r){
      var novos=(r.mensagens||[]).map(function(x){var m=conv(x,p);var antigo=M.filter(function(o){return o._p===p&&o._u===x.uid})[0];if(antigo&&antigo._cor){m._cor=antigo._cor;m.att=antigo.att;m.body=antigo.body}return m});
      M=M.filter(function(m){return m._p!==p}).concat(novos);
      novos.sort(function(a,b){return b._q-a._q});
      CHEIA=true;
      return novos;
    }).catch(function(e){ERRO[k]=e.message||'Não foi possível ler a pasta.';CARR[k]=null;return []}).then(function(n){CARG[k]=false;renderAll();return n});
    CARR[k]=pr;
    return pr;
  }
  function recarregar(ks){ks.forEach(function(k){CARR[k]=null;if(k===S.folder||k==='inbox'||CHEIA)carregar(k,true)});refPastas().catch(function(){})}

  /* lista: a carregar / erro / favoritos de todas as pastas já abertas */
  var _rl=renderList;
  renderList=function(){
    /* cada pasta tenta-se UMA vez sozinha; se falhar, mostra o erro e só volta a tentar no botão (nunca em ciclo) */
    if(S.folder==='starred'){['inbox','sent','archive','drafts'].forEach(function(k){if(!TENT[k])carregar(k)})}
    else if(!S.labelView&&!TENT[S.folder])carregar(S.folder);
    _rl();
    var vazio=$('#list .empty');
    if(vazio&&ERRO[S.folder]){
      vazio.innerHTML='<span>'+esc(ERRO[S.folder])+'<br><button class="btn p" data-vm="retry" style="margin-top:12px">Tentar de novo</button></span>';
    }else if(vazio&&CARG[S.folder]&&!S.q){
      vazio.querySelector('span').textContent='A carregar…';
    }
  };

  /* ---- contadores da barra lateral (os verdadeiros, do servidor) ---- */
  var _rs=renderSide;
  renderSide=function(){
    _rs();
    $$('#sfolders .fold[data-f]').forEach(function(el){
      var f=el.dataset.f,c=el.querySelector('.cnt');if(c)c.remove();
      if(f==='inbox'||f==='spam'||f.indexOf('c:')===0){
        var n=novas(f);
        if(n>0){var s=document.createElement('span');s.className='cnt';s.textContent=n;var fm=el.querySelector('.fmore');el.insertBefore(s,fm||null)}
      }
    });
  };

  /* ---- ler uma mensagem ---- */
  window.vmAjusta=function(f){
    try{
      var d=f.contentDocument;
      var aj=function(){f.style.height=(d.documentElement.scrollHeight+4)+'px'};
      aj();setTimeout(aj,300);
      [].forEach.call(d.querySelectorAll('img'),function(i){i.addEventListener('load',aj)});
    }catch(e){}
  };
  function corpoHTML(m){
    if(!m._cor)return m._erro?esc(m._erro):'A carregar…';
    var x=m._cor,miolo=x.html||('<pre>'+String(x.texto||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</pre>');
    var doc='<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https: http:; style-src \'unsafe-inline\'"><base target="_blank">'+
      '<style>html{background:#fff;color:#222}body{margin:0;font:14px/1.55 -apple-system,system-ui,Segoe UI,sans-serif;word-wrap:break-word}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font:inherit;margin:0}blockquote{margin:0 0 0 8px;padding-left:10px;border-left:3px solid #ddd}a{color:#c01825}</style>'+miolo;
    return '<iframe class="vm-corpo" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" referrerpolicy="no-referrer" srcdoc="'+attr(doc)+'" onload="vmAjusta(this)" style="width:100%;border:0;display:block;height:140px;border-radius:4px;background:#fff"></iframe>';
  }
  var _mc=msgCard;
  msgCard=function(m){
    if(!m._u)return _mc(m);
    var d0=m.date,a0=m.att;m.date=m._dl||m.date;if(!m._cor)m.att=[];
    var h=_mc(m);m.date=d0;m.att=a0;
    return h.replace(/<div class="mbody">[\s\S]*?<\/div>(?=\s*(?:<div class="mfiles">|<div class="mfoot">))/,function(){return '<div class="mbody vm-real">'+corpoHTML(m)+'</div>'});
  };
  function abrirCorpo(m){
    if(m._cor||!m._u||m._pedido)return;
    m._pedido=true;
    api('ler',{pasta:m._p,uids:[m._u]}).then(function(r){
      m._cor=r;m._pedido=false;
      m.att=(r.anexos||[]).map(function(a){return {n:a.nome,s:tam(a.tam),i:a.i}});
      m._para=r.para;m._cc=r.cc;m._mid=r.mid;m._ref=r.ref;m.to=r.para||m.to;
      m.prev=m.prev||String(r.texto||'').replace(/\s+/g,' ').slice(0,160);
      if(S.sel===m.id)renderRead();renderList();
      if(m.f==='drafts'&&m._abrirRascunho){m._abrirRascunho=false;RASC={p:m._p,u:m._u};ANEX=[];openCompose({to:r.para||'',subj:m.subj==='(sem assunto)'?'':m.subj,body:r.html||String(r.texto||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')})}
      refPastas().catch(function(){});
    }).catch(function(e){m._pedido=false;m._erro=e.message||'Não foi possível abrir a mensagem.';if(S.sel===m.id)renderRead()});
  }
  var _om=openMail;
  openMail=function(id){
    var m=get(id);
    if(m&&m._u&&m.f==='drafts'){m._abrirRascunho=true;m.unread=false;abrirCorpo(m);S.sel=null;renderAll();return}
    _om(id);
    if(m&&m._u){m._erro='';abrirCorpo(m)}
  };

  /* ---- anexos: descarregar ---- */
  function descarregar(m,i){
    var a=document.createElement('a');
    a.href=API+'?end='+encodeURIComponent(END)+'&pasta='+encodeURIComponent(m._p)+'&uid='+m._u+'&i='+i;
    a.download='';document.body.appendChild(a);a.click();a.remove();
  }
  attachPreview=function(a){var m=get(S.sel);if(m&&a&&a.i!==undefined)descarregar(m,a.i)};
  function todosAnexos(m){(m.att||[]).forEach(function(a,n){setTimeout(function(){descarregar(m,a.i)},n*400)})}

  /* ---- marcar / mover / apagar ---- */
  function agrupar(ids){
    var g={};
    ids.forEach(function(id){var m=get(id);if(m&&m._u)(g[m._p]=g[m._p]||[]).push(m._u)});
    return g;
  }
  function sinais(ids,juntar,tirar){
    var g=agrupar(ids);
    Object.keys(g).forEach(function(p){
      api('marcar',{pasta:p,uids:g[p],juntar:juntar,tirar:tirar}).then(function(){refPastas().catch(function(){})}).catch(function(e){falha(e);recarregar([chave(p)])});
    });
  }
  function marcaLida(ids,lida){
    ids.forEach(function(id){var m=get(id);if(m)m.unread=!lida});
    sinais(ids,lida?['Seen']:[],lida?[]:['Seen']);
  }
  function marcaEstrela(ids,sim){
    ids.forEach(function(id){var m=get(id);if(m)m.star=sim});
    sinais(ids,sim?['Flagged']:[],sim?[]:['Flagged']);
  }
  moveTo=function(ids,f,msg){
    var g=agrupar(ids),destino=pasta(f),k=chave(destino);
    ids.forEach(function(id){var m=get(id);if(m)m.f=f});
    if(ids.indexOf(S.sel)>=0)S.sel=null;
    S.checked.clear();renderAll();toast(msg);
    var origens=Object.keys(g).map(chave);
    Object.keys(g).forEach(function(p){
      api('mover',{pasta:p,destino:destino,uids:g[p]}).then(function(){recarregar(origens.concat([k]))}).catch(function(e){falha(e);recarregar(origens.concat([k]))});
    });
  };
  del=function(ids){
    if(S.folder==='trash'){
      confirmDlg('Excluir para sempre?','Esta acção não pode ser desfeita.','Excluir',function(){
        var g=agrupar(ids);
        M=M.filter(function(m){return ids.indexOf(m.id)<0});
        S.sel=null;S.checked.clear();renderAll();toast('Excluído permanentemente');
        Object.keys(g).forEach(function(p){api('apagar',{pasta:p,uids:g[p]}).then(function(){refPastas().catch(function(){})}).catch(function(e){falha(e);recarregar(['trash'])})});
      });
      return;
    }
    moveTo(ids,'trash',ids.length>1?ids.length+' conversas movidas para a Lixeira':'Conversa movida para a Lixeira');
  };
  bulk=function(a){
    var ids=[].concat([].slice.call(S.checked));if(!ids.length)return;
    if(a==='b-arch')archive(ids);else if(a==='b-del')del(ids);
    else if(a==='b-read'||a==='b-unread'){S.checked.clear();marcaLida(ids,a==='b-read');renderAll()}
    else if(a==='b-star'){S.checked.clear();marcaEstrela(ids,true);renderAll()}
  };
  /* criar pasta de verdade */
  function criarPasta(nome){
    nome=String(nome||'').trim().replace(/[\/\\"\u0000-\u001f]/g,'').slice(0,60);
    if(!nome)return;
    api('criarPasta',{nome:nome}).then(function(){toast('Pasta “'+esc(nome)+'” criada');return refPastas()}).catch(falha);
  }
  doNf=function(ok){var v=($('#nfi')||{}).value;if(ok&&v&&v.trim())criarPasta(v);renderSide()};
  folderDialog=function(){
    var o=modal('<h3>Criar pasta</h3><p>As pastas ajudam a organizar os seus e-mails.</p><div class="fld"><label for="fn">Nome da pasta</label><input id="fn" placeholder="Ex.: Clientes"></div><div class="fbtns"><button class="btn g" data-c>Cancelar</button><button class="btn p" data-ok>Criar</button></div>','fm');
    var i=o.querySelector('#fn');setTimeout(function(){i.focus()},30);
    var fim=function(){var v=i.value;o.remove();criarPasta(v)};
    o.querySelector('[data-c]').onclick=function(){o.remove()};o.querySelector('[data-ok]').onclick=fim;
    i.onkeydown=function(e){if(e.key==='Enter')fim()};
  };

  /* ---- cliques (apanhados antes do maquete) ---- */
  document.addEventListener('click',function(e){
    var t=e.target;if(!t||!t.closest)return;
    var x;
    if((x=t.closest('[data-vm=retry]'))){e.stopImmediatePropagation();e.preventDefault();carregar(S.folder,true);return}
    if((x=t.closest('#list [data-star]'))){e.stopImmediatePropagation();e.preventDefault();var m=get(+x.dataset.star);if(m){marcaEstrela([m.id],!m.star);renderList();renderRead()}return}
    if(t.closest('[data-act=r-star]')){e.stopImmediatePropagation();e.preventDefault();var m2=get(S.sel);if(m2){marcaEstrela([m2.id],!m2.star);renderAll()}return}
    if(t.closest('[data-dl]')){e.stopImmediatePropagation();e.preventDefault();var m3=get(S.sel),i3=+t.closest('[data-dl]').dataset.dl;if(m3&&m3.att[i3])descarregar(m3,m3.att[i3].i);return}
    if(t.closest('[data-chip]')){e.stopImmediatePropagation();e.preventDefault();var m4=get(S.sel),i4=+t.closest('[data-chip]').dataset.chip;if(m4&&m4.att[i4])descarregar(m4,m4.att[i4].i);return}
    if(t.closest('[data-act=dlall]')){e.stopImmediatePropagation();e.preventDefault();var m5=get(S.sel);if(m5){todosAnexos(m5);toast('A descarregar '+m5.att.length+' anexo(s)')}return}
    if(t.closest('[data-act=forward]')){e.stopImmediatePropagation();e.preventDefault();encaminhar();return}
    if(t.closest('[data-act=upd]')){e.stopImmediatePropagation();e.preventDefault();recarregar([S.folder]);toast('A actualizar a caixa…');return}
    if(t.closest('[data-cb=discard]')){ANEX=[];RASC=t.closest('#compose')?null:RASC}
    if(t.closest('[data-cb=attach]')){e.stopImmediatePropagation();e.preventDefault();anexar(t.closest('#compose')?'compose':'reply');return}
    if((x=t.closest('[data-anx]'))){e.stopImmediatePropagation();e.preventDefault();ANEX.splice(+x.dataset.anx,1);pintaAnexos();return}
  },true);

  /* itens dos menus que mexiam só em dados de exemplo */
  var _menu=menu;
  menu=function(items,anchor,o){
    var m=get(S.sel);
    function ajusta(l){
      return l.filter(function(it){return !(it.t&&/^(Pino|Fixar|Desafixar|Rótulo|Responder com IA|Adicionar a Tarefas|Adicionar aos contactos|Crie uma regra|Limpeza automática|Imprimir|Guardar como modelo|Adicionar à Lista de permissões|Bloquear|Denunciar phishing)/.test(it.t.replace(/<[^>]*>/g,'')))}).map(function(it){
        var n=it.t?it.t.replace(/<[^>]*>/g,''):'',c={};for(var k in it)c[k]=it[k];
        if(it.sub)c.sub=ajusta(it.sub);
        if(n==='Marcar como não lido')c.fn=function(){if(m){marcaLida([m.id],false);S.sel=null;renderAll()}};
        else if(n==='Encaminhar')c.fn=encaminhar;
        else if(n==='Ver original')c.fn=function(){if(m)verOriginal(m)};
        else if(/^Baixar tudo/.test(n))c.fn=function(){if(m)todosAnexos(m)};
        else if(n==='Spam'&&m)c.fn=function(){spam([m.id])};
        return c;
      }).filter(function(it,i,l){return !(it.sep&&(i===0||i===l.length-1||(l[i-1]&&l[i-1].sep)))});
    }
    return _menu(ajusta(items),anchor,o);
  };
  function verOriginal(m){
    api('original',{pasta:m._p,uids:[m._u],naoLida:true}).then(function(r){
      var o=modal('<h3>Mensagem original</h3><pre style="background:var(--pane);border-radius:6px;padding:14px;font-size:12px;white-space:pre-wrap;word-break:break-all;line-height:1.5;margin:12px 0 0;max-height:60vh;overflow:auto"></pre>','fm');
      o.querySelector('pre').textContent=r.texto||'';o.querySelector('.modal').style.width='720px';
    }).catch(falha);
  }

  /* ---- escrever, responder, encaminhar, anexar, rascunhos ---- */
  function pintaAnexos(){
    var box=$('#catt')||$('#ratt');
    if(!box)return;
    box.innerHTML=ANEX.map(function(a,i){return '<span class="mtag" style="padding:4px 8px">'+esc(a.nome)+' · '+tam(a.tam)+' <a data-anx="'+i+'" style="cursor:pointer;margin-left:4px" aria-label="Remover">×</a></span>'}).join('');
  }
  function anexar(ctx){
    var inp=document.createElement('input');inp.type='file';inp.multiple=true;
    inp.onchange=function(){
      var total=ANEX.reduce(function(s,a){return s+a.tam},0);
      [].forEach.call(inp.files,function(f){
        if(f.size>10*1048576||total+f.size>15*1048576){toast('“'+esc(f.name)+'” é demasiado grande (máximo 10 MB por ficheiro e 15 MB no total)');return}
        total+=f.size;
        var r=new FileReader();
        r.onload=function(){ANEX.push({nome:f.name,tipo:f.type||'application/octet-stream',tam:f.size,b64:String(r.result).split(',')[1]||''});
          if(ctx==='reply'&&!$('#ratt')){var cb=$('#replybox .cbar');if(cb)cb.insertAdjacentHTML('beforebegin','<div id="ratt" style="display:flex;flex-wrap:wrap;gap:8px;padding:0 20px"></div>')}
          pintaAnexos()};
        r.readAsDataURL(f);
      });
    };
    inp.click();
  }
  var _oc=openCompose;
  openCompose=function(o){if(!RASC)ANEX=[];_oc(o);pintaAnexos()};
  function htmlParaTexto(h){var d=document.createElement('div');d.innerHTML=String(h||'').replace(/<br\s*\/?>/gi,'\n');return d.textContent||''}
  function encaminhar(){
    var m=get(S.sel);if(!m)return;
    var corpo=m._cor?(m._cor.texto||htmlParaTexto(m._cor.html)):'';
    S.reply={type:'forward',text:'<br><br>---------- Mensagem encaminhada ----------<br>De: '+esc(m.from)+' &lt;'+esc(m.email)+'&gt;<br>Assunto: '+esc(m.subj)+'<br><br>'+esc(corpo).replace(/\n/g,'<br>')};
    renderRead();
  }
  function enderecos(txt){
    return String(txt||'').split(/[;,]/).map(function(s){return s.trim()}).filter(Boolean);
  }
  function semMeu(lista){return lista.filter(function(s){return s.toLowerCase().indexOf(END.toLowerCase())<0})}
  function recolher(ctx){
    var msg={nome:'',para:'',cc:'',cco:'',assunto:'',texto:'',html:'',anexos:ANEX.map(function(a){return {nome:a.nome,tipo:a.tipo,b64:a.b64}})};
    if(ctx==='compose'){
      msg.para=($('#cto').value||'').trim();
      var cc=$('#ccf input'),bcc=$('#bccf input');
      msg.cc=cc?cc.value.trim():'';msg.cco=bcc?bcc.value.trim():'';
      msg.assunto=$('#csubj').value.trim();
      msg.texto=$('#cbody').innerText.trim();msg.html=$('#cbody').innerHTML;
      if(!msg.para){$('#cto').closest('.cf').style.borderColor='var(--brand)';toast('Adicione pelo menos um destinatário');return null}
    }else{
      var m=get(S.sel);if(!m||!S.reply)return null;
      var tipo=S.reply.type,sub=m.subj.replace(/^((re|enc|fwd?):\s*)+/i,'');
      if(tipo==='forward'){var inp=$('#replybox .to input');msg.para=inp?inp.value.trim():'';msg.assunto='Enc: '+sub;if(!msg.para){toast('Indique para quem encaminhar');return null}}
      else if(tipo==='all'){msg.para=m.email;msg.cc=semMeu(enderecos(m._para||m.to).concat(enderecos(m._cc))).filter(function(s){return s.indexOf(m.email)<0}).join(', ');msg.assunto='Re: '+sub}
      else{msg.para=m.email;msg.assunto='Re: '+sub}
      msg.texto=$('#replybody').innerText.trim();msg.html=$('#replybody').innerHTML;
      if(tipo!=='forward'){msg.responde=m._mid||'';msg.referencias=m._ref||''}
    }
    if(!msg.texto&&!ANEX.length&&!msg.assunto){toast('Escreva a mensagem');return null}
    return msg;
  }
  doSend=function(ctx,quandoEnviar){
    if(quandoEnviar){toast('O envio programado ainda não está disponível');return}
    var msg=recolher(ctx);if(!msg)return;
    var botao=document.querySelector('[data-send='+ctx+']');if(botao)botao.disabled=true;
    toast('A enviar…');
    api('enviar',{msg:msg,pastaEnviados:pasta('sent'),apagarRascunho:RASC?{pasta:RASC.p,uid:RASC.u}:undefined}).then(function(){
      if(ctx==='compose'){$('#compose').className='hidden';var ov=$('#cmpov');if(ov)ov.remove()}else{S.reply=null}
      ANEX=[];RASC=null;renderAll();toast('E-mail enviado');
      recarregar(['sent'].concat(RASC?['drafts']:[]));
    }).catch(function(e){if(botao)botao.disabled=false;falha(e)});
  };
  closeCompose=function(guardar){
    var c=$('#compose');
    var assunto=$('#csubj')&&$('#csubj').value,texto=$('#cbody')&&$('#cbody').innerText.trim(),para=$('#cto')&&$('#cto').value;
    var html=$('#cbody')?$('#cbody').innerHTML:'';
    c.className='hidden';var ov=$('#cmpov');if(ov)ov.remove();
    var rasc=RASC;RASC=null;var anexos=ANEX;ANEX=[];
    if(guardar&&(assunto||texto||para||anexos.length)){
      api('rascunho',{msg:{nome:'',para:para||'',assunto:assunto||'',texto:texto||'',html:html,anexos:anexos.map(function(a){return {nome:a.nome,tipo:a.tipo,b64:a.b64}})},pastaRascunhos:pasta('drafts'),apagarRascunho:rasc?{pasta:rasc.p,uid:rasc.u}:undefined})
        .then(function(){toast('Rascunho guardado');recarregar(['drafts'])}).catch(falha);
    }else if(rasc){recarregar(['drafts'])}
  };

  /* ---- e-mails novos: de 45 em 45 s e ao voltar à janela; avisa e toca ---- */
  function sonda(){
    if(document.hidden||!PAS.length)return;
    api('pastas').then(function(r){
      var antes=PROX;PAS=r.pastas||[];mapa();
      var ib=PAS.filter(function(p){return p.n==='INBOX'})[0];
      if(ib&&antes&&ib.proximo>antes){
        PROX=ib.proximo;
        CARR.inbox=null;
        carregar('inbox',true).then(function(l){
          var chegou=l.filter(function(m){return m._u>=antes&&m.unread});
          if(chegou.length){
            if(window.vhostmailAvisar)window.vhostmailAvisar(chegou.length>1?chegou.length+' novos e-mails':chegou[0].from,chegou.length>1?'Caixa de entrada':chegou[0].subj);
            toast(chegou.length>1?chegou.length+' novos e-mails':'Novo e-mail de '+esc(chegou[0].from));
          }
        });
      }else if(ib)PROX=ib.proximo;
      renderSide();
    }).catch(function(){});
  }
  setInterval(sonda,45000);
  window.addEventListener('focus',sonda);

  /* ---- arranque ---- */
  if(!END){toast('Abra o VhostMail a partir de uma conta de e-mail');return}
  S.folder=(C.pasta==='sent')?'sent':'inbox';
  renderAll();
  refPastas().then(function(){S.folder=(C.pasta==='sent')?'sent':'inbox';return carregar(S.folder)}).catch(function(e){ERRO[S.folder]=e.message||'Não foi possível ler a caixa.';renderAll()});
})();
`;

// o que o maquete tinha e não faz nada na caixa real sai da vista (nada fica como ligação morta)
export const CLIENTE_CSS = String.raw`
/* escrever: sem as ferramentas de exemplo (rastrear, design, IA, modelos, faturas, campanhas, lembretes, Drive, imagem, assinatura, HTML, tarefas, enviar mais tarde) */
#compose .ctools,#replybox .ctools{display:none!important}
.cbar [data-cb=campaign],.cbar [data-cb=ai],.cbar [data-cb=remind],.cbar [data-cb=drive],.cbar [data-cb=image],.cbar [data-cb=sig],.cbar [data-cb=html],.cbar [data-cb=task],.cbar [data-later]{display:none!important}
.vm-real{padding:0}
.vm-corpo{min-height:60px}
/* anexos da mensagem: sem Drive nem verificação de vírus de exemplo */
.mfiles [data-act=drive],.mfiles [data-act=virus]{display:none!important}
/* lista e leitura: sem fixar nem resumo/resposta com IA (não têm ligação) */
.it .hact [data-ha=pin],[data-act=summary],[data-act=aireply],.mfoot .aib{display:none!important}
/* barra lateral: sem pasta de opções (3 pontos), sem rótulos */
#side .fmore,[data-act=newlabel],#side .fold[data-f=ai]{display:none!important}
/* sem ligações mortas: o que o maquete mostrava e não tem ligação ao servidor (aplicações, calendário, chat, partilha, recibos,
   ajuda, novidades, erro/recurso, pesquisa avançada, conta extra, preferências de exemplo, tarefas iniciais) sai da vista.
   A palavra-passe, o reencaminhamento e a resposta automática da caixa continuam em Contas de e-mail, no painel. */
[data-act=ub-acct],[data-act=receipts],[data-act=help],[data-act=ub-chat],[data-act=ub-talk],[data-act=ub-share],[data-act=apps],
[data-act=addacct],[data-act=bug],[data-act=feature],[data-act=news],[data-act=newmenu],[data-act=adv],[data-act=sidepanel],
[data-act=prefs],[data-act=getapp],[data-act=default],[data-act=imap],[data-act=kbd],[data-act=popout],#setup,#side .sdiv,
.dsec:has([data-act=grp-on]){display:none!important}
`;
