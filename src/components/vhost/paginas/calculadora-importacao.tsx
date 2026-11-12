'use client';

// Admin › Contabilidade › Calculadora (Silva, 12/11/2026): calculadora do custo de importação ("posto no armazém") — direitos
// por linha, IVA ou taxas dos EUA, frete e despesas repartidos por valor, peso ou volume, e preço com a margem pretendida.
// A conta é a de src/lib/calculadora-custo-importacao.ts; o desenho é Tailwind dentro do cartão principal (.tw-livre), como
// as outras páginas da Contabilidade, e adapta-se à largura do cartão (consultas de contentor).
import type { ScreenFn } from '../screens';
import { CalculadoraCustoImportacao } from '../comuns/CalculadoraCustoImportacao';

export const calculadoraImportacaoPagina: ScreenFn = () => ({
  title: 'Calculadora',
  desc: 'Custo por unidade das mercadorias importadas, com direitos, IVA e frete',
  body: (
    <div className="tw-livre">
      <CalculadoraCustoImportacao />
    </div>
  ),
});
