-- A folha da cotação de uma encomenda do site (administrador e cliente) guarda-se por encomenda: chaves 'cotacao:<lote>' e 'cotacao-imagens:<lote>' em calculadora_estado.
ALTER TABLE calculadora_estado DROP CONSTRAINT IF EXISTS calculadora_estado_chave_check;
ALTER TABLE calculadora_estado ADD CONSTRAINT calculadora_estado_chave_check CHECK (
  chave IN ('calculadora', 'cotacao', 'cotacao-imagens')
  OR chave ~ '^cotacao(-imagens)?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
