-- A cotação guarda também as fotos que o Silva troca na foto grande (escolhidas no computador): nova chave 'cotacao-imagens' em calculadora_estado.
ALTER TABLE calculadora_estado DROP CONSTRAINT IF EXISTS calculadora_estado_chave_check;
ALTER TABLE calculadora_estado ADD CONSTRAINT calculadora_estado_chave_check CHECK (chave IN ('calculadora', 'cotacao', 'cotacao-imagens'));
