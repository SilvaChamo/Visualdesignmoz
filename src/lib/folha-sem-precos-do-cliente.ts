// O cliente edita a mesma folha da cotação mas nunca fixa preços: do que ele grava ficam só os preços que a equipa já tinha (o valor que o cliente paga vem da autorização, nunca da folha).
// Sem imports: o teste corre com `node --test`.
type Edicoes = Record<string, Record<string, unknown>>

export function semPrecosDoCliente(novo: object, antigo: unknown): object {
  const ed = (novo as { edicoes?: Edicoes }).edicoes
  if (!ed || typeof ed !== 'object') return novo
  const velhas = (antigo as { edicoes?: Edicoes } | null)?.edicoes ?? {}
  const edicoes = Object.fromEntries(
    Object.entries(ed).map(([id, e]) => {
      const { preco: _descartado, ...resto } = e ?? {}
      void _descartado
      return [id, velhas[id]?.preco === undefined ? resto : { ...resto, preco: velhas[id].preco }]
    }),
  )
  return { ...novo, edicoes }
}
