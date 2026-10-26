import { redirect } from 'next/navigation';

// O antigo painel de visitante (/guest) deixou de existir: quem só tem encomendas fica no painel das encomendas
// (Silva, 26/10/2026). O endereço continua a funcionar para links e favoritos antigos.
export default function GuestPage() {
  redirect('/encomendas');
}
