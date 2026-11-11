// VhostMail ↔ painel VisualHost: o que se acrescenta ao maquete aprovado (o desenho não muda).
// Corre no fim do código do maquete, dentro da página do VhostMail (iframe do painel).
//  • abre na pasta pedida (Entrada ou Enviados) e na conta pedida (a que vem em window.VM_CFG)
//  • Sair volta logo às Contas de e-mail do painel (a sessão é a do painel, não há login próprio)
//  • "Fazer upgrade" mostra os planos de e-mail que existem (src/lib/email-plans.ts) e "Escolher" abre Planos e preços
//  • o tema claro/escuro do painel passa para o VhostMail
// Escrito só com aspas simples e sem backticks: o texto vai para dentro de um <script>.
export const INTEGRACAO_JS = String.raw`
/* ===== VhostMail: ligação ao painel ===== */
(function(){
  var C=window.VM_CFG||{};
  function painel(m){try{parent.postMessage({vhostmail:1,acao:m},location.origin)}catch(e){}}
  /* Sair: o utilizador já está dentro do painel, por isso volta logo às Contas de e-mail (sem a pergunta de «iniciar sessão novamente»).
     Apanha-se na janela, antes de qualquer outro tratamento do clique, em todos os botões Sair (barra de cima, menu, definições). */
  showLogin=function(){painel('voltar')};
  window.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-act=logout]')){e.stopImmediatePropagation();e.preventDefault();painel('voltar')}
  },true);
  /* Fazer upgrade: os planos de e-mail da VisualDesign */
  plansModal=function(){
    var P=C.planos||[];
    var h='<h2>Escolha o seu plano VhostMail</h2><div class="pg">'+P.map(function(p){
      return '<div class="plan '+(p.popular?'hl':'')+'"><h4>'+esc(p.nome)+'</h4><div class="pr">'+esc(p.preco)+' <small>'+esc(p.ciclo)+'</small></div><ul>'+
        p.itens.map(function(f){return '<li>'+ic('check')+esc(f)+'</li>'}).join('')+'</ul>'+
        '<button class="btn '+(p.popular?'p':'o')+' w" data-pl="'+esc(p.id)+'"'+(p.actual?' disabled':'')+'>'+(p.actual?'Plano actual':'Escolher')+'</button></div>';
    }).join('')+'</div><p style="text-align:center;color:var(--muted);font-size:12.5px;margin:18px 0 0">Preços por ano. Também pode pagar por semestre ou por mês. O domínio escolhe-se depois de contratar.</p>';
    var o=modal(h,'plans');
    o.querySelectorAll('[data-pl]').forEach(function(b){b.onclick=function(){o.remove();window.open('/precos/email','_blank','noopener')}});
  };
  /* tema do painel */
  function tema(t){var dk=(t==='dark');S.dark=dk;document.body.classList.toggle('dark',dk);try{renderDrawer()}catch(e){}}
  if(C.tema==='dark')tema('dark');
  window.addEventListener('message',function(e){
    if(e.origin!==location.origin)return;
    var d=e.data;if(d&&d.vhostmail&&d.tema)tema(d.tema);
  });
  /* letra da conta */
  var av=document.querySelector('.uav');if(av&&ME)av.textContent=ME.charAt(0).toUpperCase();
  /* sem os e-mails importados (quem não é administrador) a caixa mostra só mensagens de exemplo, e diz-se */
  if(C.exemplo){
    var _rlx=renderList;
    renderList=function(){_rlx();
      if(S.folder==='inbox'&&!S.q&&!S.labelView&&$('#list .items')&&!$('#list .impnote'))
        $('#list .items').insertAdjacentHTML('afterbegin','<div class="impnote">'+ic('info')+'<span>Mensagens de exemplo: a ligação à sua caixa de correio real ainda não está activa.</span></div>');
    };
  }
  /* barra lateral compacta (como a do Entrecampos): ao passar o rato num ícone, o nome sai à direita, colado à barra.
     Fica por cima de tudo (position:fixed) porque a lista da barra tem scroll e cortaria uma dica normal. */
  (function(){
    var fly=null,mx=0,my=0;
    function quita(){if(fly){fly.remove();fly=null}}
    function nome(t){
      var n=t.getAttribute('data-tip-side')||t.getAttribute('aria-label');
      if(!n){var s=t.querySelector('.em')||t.querySelector('span:not(.av):not(.cnt):not(.sq)');n=s?s.textContent:''}
      return (n||'').trim();
    }
    function mostra(el){
      quita();
      var t=el&&el.closest&&el.closest('#side .fold,#side .acct,#side .addacct,#side .appsw,#side .sfoot button');
      var side=document.getElementById('side');
      if(!t||!side||side.offsetWidth>120)return;
      var n=nome(t);if(!n)return;
      var r=t.getBoundingClientRect(),sr=side.getBoundingClientRect();
      fly=document.createElement('div');fly.className='sidefly';fly.textContent=n;
      document.body.appendChild(fly);
      /* a gaveta nasce na linha vermelha da barra (cobre-a nesta altura) e abraça a linha do ícone, 2 px por cima e por baixo */
      fly.style.left=Math.round(sr.right-2)+'px';
      fly.style.top=Math.round(r.top-2)+'px';
      fly.style.height=Math.round(r.height+4)+'px';
    }
    document.addEventListener('mouseover',function(e){mx=e.clientX;my=e.clientY;mostra(e.target)});
    document.addEventListener('mouseout',function(e){var r=e.relatedTarget;if(!r||!r.closest||!r.closest('#side'))quita()});
    /* depois de um clique a barra volta a desenhar-se: mostra outra vez o nome do ícone que está debaixo do rato */
    document.addEventListener('click',function(){quita();setTimeout(function(){mostra(document.elementFromPoint(mx,my))},80)},true);
    var sc=document.getElementById('sfolders');if(sc)sc.addEventListener('scroll',quita);
    window.addEventListener('blur',quita);
  })();
  /* Notificações a sério: a faixa vermelha só surge passados uns segundos (nunca logo ao entrar), «Ativar notificações» pede
     a permissão ao navegador e, se for dada, a faixa desaparece e fica activa; se se fechar a faixa, volta na próxima vez que
     se entrar, enquanto as notificações não estiverem activadas. Ao chegar um e-mail novo, vhostmailAvisar() toca e avisa. */
  (function(){
    var ac=null;
    function perm(){return ('Notification' in window)?Notification.permission:'unsupported'}
    function audio(){
      try{
        var A=window.AudioContext||window.webkitAudioContext;if(!A)return null;
        if(!ac)ac=new A();
        if(ac.state==='suspended')ac.resume();
      }catch(e){ac=null}
      return ac;
    }
    function som(){
      var c=audio();if(!c)return;
      var t=c.currentTime;
      [[880,0],[1175,0.17]].forEach(function(n){
        var o=c.createOscillator(),g=c.createGain(),i=t+n[1];
        o.type='sine';o.frequency.value=n[0];
        g.gain.setValueAtTime(0.0001,i);g.gain.exponentialRampToValueAtTime(0.25,i+0.02);g.gain.exponentialRampToValueAtTime(0.0001,i+0.45);
        o.connect(g);g.connect(c.destination);o.start(i);o.stop(i+0.5);
      });
    }
    /* o navegador só deixa tocar depois de um clique: o primeiro clique na página prepara o som */
    document.addEventListener('click',function(){if(perm()==='granted')audio()},{capture:true,once:true});
    window.vhostmailAvisar=function(de,assunto){
      if(perm()!=='granted')return;
      som();
      try{var n=new Notification(de||'VhostMail',{body:assunto||'Novo e-mail',tag:'vhostmail-novo'});n.onclick=function(){window.focus();n.close()}}catch(e){}
    };
    function mostraFaixa(){document.body.classList.add('vm-bn-on')}
    function escondeFaixa(){document.body.classList.remove('vm-bn-on')}
    function ligar(doSetup){
      if(!('Notification' in window)){toast('Este navegador não suporta notificações');return}
      var p0=perm();
      if(p0==='granted'){escondeFaixa();toast('As notificações já estão activadas');return}
      if(p0==='denied'){escondeFaixa();toast('As notificações estão bloqueadas no navegador: active-as nas definições do site');return}
      var feito=false;
      function fim(p){
        if(feito)return;feito=true;
        if(p==='granted'){
          escondeFaixa();audio();som();
          try{new Notification('VhostMail',{body:'Vai receber um aviso quando chegar um e-mail novo.',tag:'vhostmail-novo'})}catch(e){}
          toast('Notificações activadas');
          if(doSetup&&typeof markDone==='function')markDone('notif');
        }else if(p==='denied'){escondeFaixa();toast('Notificações bloqueadas no navegador')}
      }
      try{var r=Notification.requestPermission(fim);if(r&&r.then)r.then(fim)}catch(e){}
    }
    window.addEventListener('click',function(e){
      var t=e.target;if(!t||!t.closest)return;
      if(t.closest('[data-act=notif]')){e.stopImmediatePropagation();e.preventDefault();ligar(false);return}
      if(t.closest('[data-act=banner-x]')){e.stopImmediatePropagation();e.preventDefault();escondeFaixa();return}
      if(t.closest('[data-setup=notif]')){e.stopImmediatePropagation();e.preventDefault();ligar(true)}
    },true);
    /* enquanto não estiverem activadas (nem sequer bloqueadas no navegador, onde a faixa explica como desbloquear), a faixa volta em cada visita */
    if(perm()!=='granted'&&perm()!=='unsupported')setTimeout(mostraFaixa,8000);
  })();
  /* abre na pasta pedida: Entrada ou Enviados */
  S.folder=(C.pasta==='sent')?'sent':'inbox';S.sel=null;S.checked.clear();
  renderAll();
})();
`;

// Barra preta de cima, ligeiramente mais pequena (Silva, 11/11/2026): ícones e texto um pouco menores. A altura da
// barra (44 → 40 px) também desce o que depende dela (a página e a gaveta das definições).
export const INTEGRACAO_CSS = String.raw`
#ubar{height:40px}
#ubar button{height:28px;font-size:13px;gap:6px;padding:0 9px}
#ubar button svg{width:15px;height:15px}
#ubar .ui svg:last-child{width:12px;height:12px}
#ubar .ui2{width:30px;padding:0}
#ubar .ui2 svg{width:17px;height:17px}
#ubar .uav{width:24px;height:24px;font-size:12px;padding:0}
#app{height:calc(100vh - 80px)}
body.nobanner #app{height:calc(100vh - 40px)}
#drawer{top:80px}
body.nobanner #drawer{top:40px}
@media (max-width:900px){#ubar .ub svg{width:16px;height:16px}}
/* barra lateral compacta como a do Entrecampos (Silva, 11/11/2026): o ícone da pasta aberta e o do que está debaixo do rato
   ficam na cor de realce e o menu abre como uma GAVETA, igual à do painel: encostada à barra, sem cantos arredondados,
   da cor da barra, com a linha vermelha a acompanhar o cartão aberto (em cima, à direita e em baixo) e a sombra só para o lado em que abre */
#side .fold.sel svg,#side .fold:hover svg,#side .acct:hover svg,#side .addacct:hover svg,#side .sfoot button:hover svg,#side .appsw:hover svg{color:#FF2B3A}
.sidefly{position:fixed;z-index:300;display:flex;align-items:center;box-sizing:border-box;padding:0 22px 0 16px;background:var(--side,#1E1E20);color:#FF2B3A;border:2px solid var(--brand,#E5202E);border-left:0;border-radius:0;box-shadow:12px 0 30px rgba(0,0,0,.18);font-size:12.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap;pointer-events:none;animation:vmfly .22s ease}
/* sai da barra a deslizar, como a gaveta do painel (transição de .22s): descobre-se da esquerda para a direita */
@keyframes vmfly{from{clip-path:inset(-8px 100% -8px 0)}to{clip-path:inset(-8px -40px -8px 0)}}
/* faixa vermelha das notificações: só surge uns segundos depois de entrar (a classe vm-bn-on põe-na); sem ela a página ocupa o lugar da faixa */
body:not(.vm-bn-on) #banner{display:none}
body:not(.vm-bn-on) #app{height:calc(100vh - 40px)}
body:not(.vm-bn-on) #drawer{top:40px}
#banner{overflow:hidden;animation:vmbn .35s ease}
@keyframes vmbn{from{height:0;opacity:0}to{height:40px;opacity:1}}
#app{transition:height .35s ease}
`;
