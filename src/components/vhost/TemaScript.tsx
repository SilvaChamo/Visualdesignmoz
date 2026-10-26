'use client';

// O script que põe o tema certo no painel antes de o navegador o pintar. Só existe no HTML que o servidor envia: se o React
// o voltasse a desenhar no navegador (recarregamento a quente, router.refresh) avisava na consola que «scripts dentro de
// componentes não são executados» — por isso depois da hidratação deixa de ser desenhado (já correu) e, quando a página é
// desenhada só no navegador, nem chega a ser criado.
import { useSyncExternalStore } from 'react';

const semOuvir = () => () => {};

export function TemaScript({ codigo }: { codigo: string }) {
  const emHtmlDoServidor = useSyncExternalStore(semOuvir, () => false, () => true);
  if (!emHtmlDoServidor) return null;
  return <script dangerouslySetInnerHTML={{ __html: codigo }} />;
}
