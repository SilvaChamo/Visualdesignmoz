// Painel VisualHost. Ícones (Font Awesome) e estilos só carregam nesta parte do site.
// O painel vive no layout para não perder o estado ao mudar de ecrã (/vhost/admin, /vhost/admin/dns, …).
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

export default function VisualHostLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VisualHostApp />
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </>
  );
}
