# vd-bloqueio.inc — incluído em cada site (ver vd-bloqueio.conf). Não editar à mão: o vd-bloqueio-instalar repõe-no.
if ($vd_spam_410) { return 410; }
if ($vd_sonda_444) { return 444; }
