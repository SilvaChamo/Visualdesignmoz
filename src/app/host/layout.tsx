// Painel VisualHost. Ícones (Font Awesome) e estilos só carregam nesta parte do site.
// O painel vive no layout para não perder o estado ao mudar de ecrã (/host:2026/admin, /host:2026/admin/dns, …).
import { cookies } from 'next/headers';
import { preload } from 'react-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@/components/vhost/generated/maquete.css';
import '@/components/vhost/paginas/paginas.css';
import { VisualHostApp } from '@/components/vhost/VisualHostApp';

export const metadata = {
  title: 'VisualHost',
  description: 'Painel de alojamento da VisualDesign',
};

// Aplica o tema escuro guardado antes de o painel aparecer (evita piscar em branco)
const THEME_SCRIPT = `try{var t=localStorage.getItem('visualhost_theme');var e=document.querySelector('.vh');if(t&&e)e.dataset.theme=t}catch(e){}`;

export default async function VisualHostLayout({ children }: { children: React.ReactNode }) {
  // há cookie de sessão do site? Sem ele, o painel desenha logo a página de entrada (não pisca a roda antes)
  const temSessao = (await cookies()).getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
  // o fundo da entrada já vem em cache quando a página aparece (não pisca a cor lisa antes da foto)
  preload('/assets/fundo-login.jpg', { as: 'image', fetchPriority: 'high' });
  return (
    <>
      <VisualHostApp temSessao={temSessao} />
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </>
  );
}
