# vd-xmlrpc.inc — bloqueio total do xmlrpc.php (ver vd-bloqueio-instalar e vd-xmlrpc-bloquear.lista). Não editar à mão.
# $request_uri apanha também o //xmlrpc.php que os robôs usam; a ligação fecha-se sem resposta e nunca chega ao PHP.
if ($request_uri ~* "^/+xmlrpc\.php") { return 444; }
