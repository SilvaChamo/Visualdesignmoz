# deepmerge — correcção local

Baseado em deepmerge 4.3.1, licenciado sob MIT (ver `license.txt`).

Esta cópia local rejeita as chaves `__proto__`, `constructor` e `prototype` e cria
propriedades com `Object.defineProperty`, evitando a alteração do protótipo do
objecto resultante. A alteração mitiga GHSA-gcqx-w48m-w2h4 enquanto não existe
uma versão corrigida do pacote original.
