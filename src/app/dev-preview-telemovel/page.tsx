// Só no servidor local (npm run dev): o painel (ou qualquer página do site) em computador e telemóvel lado a lado,
// para ver as alterações em tempo real enquanto se mexe no código (pedido do Silva, 15/10/2026). Em produção não existe.
import { notFound } from 'next/navigation';
import LadoALado from './LadoALado';

export const metadata = { title: 'Computador + telemóvel', robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LadoALado />;
}
