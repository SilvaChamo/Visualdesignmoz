# vd-busca-spam.inc — spam de pesquisa do WordPress (/?s=…): robôs SEM referer que obrigam o WordPress a pesquisar na base de dados, sem cache
# (o mltmark.com chegou a 47 mil por dia, 74% de todo o tráfego, em 25/10/2026). Uma pesquisa verdadeira sai de uma página do próprio site e leva
# sempre referer. Só vale para os domínios de /etc/nginx/vd-busca-spam.lista (ver vd-bloqueio-instalar). Não editar à mão: o instalador repõe-no.
set $vd_busca_spam 0;
if ($arg_s != "") { set $vd_busca_spam 1; }
if ($http_referer != "") { set $vd_busca_spam 0; }
if ($vd_busca_spam = 1) { return 403; }
