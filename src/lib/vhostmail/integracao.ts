// VhostMail ↔ painel VisualHost: o que se acrescenta ao maquete aprovado (o desenho não muda).
// Corre no fim do código do maquete, dentro da página do VhostMail (iframe do painel).
//  • abre na pasta pedida (Entrada ou Enviados) e na conta pedida (a que vem em window.VM_CFG)
//  • Sair volta ao painel (a sessão é a do painel, não há login próprio)
//  • "Fazer upgrade" mostra os planos de e-mail que existem (src/lib/email-plans.ts) e "Escolher" abre Planos e preços
//  • o tema claro/escuro do painel passa para o VhostMail
// Escrito só com aspas simples e sem backticks: o texto vai para dentro de um <script>.
export const INTEGRACAO_JS = String.raw`
/* ===== VhostMail: ligação ao painel ===== */
(function(){
  var C=window.VM_CFG||{};
  function painel(m){try{parent.postMessage({vhostmail:1,acao:m},location.origin)}catch(e){}}
  /* Sair: o utilizador já está dentro do painel, por isso regressa a ele */
  showLogin=function(){painel('voltar')};
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
`;
