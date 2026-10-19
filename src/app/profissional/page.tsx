import ResellerPage from '@/app/revendedor/page';
import { PROFISSIONAL_MENU_DEFS } from '@/lib/panel-admin-menu';

/**
 * Painel Profissional — o mesmo painel do revendedor (mesma página,
 * componentes e rotas de API), só com o menu sem o grupo "Hospedagem" e as
 * rotas internas em /profissional em vez de /revendedor. Ver plano "Painel
 * Profissional para compradores self-service".
 */
export default function ProfissionalPage() {
  return <ResellerPage menuDefs={PROFISSIONAL_MENU_DEFS} basePath="/profissional" />;
}
