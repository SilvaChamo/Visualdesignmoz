import { LoginDividido } from '@/components/auth/LoginDividido'

/**
 * Entrar, Registar, Recuperar a senha e Nova senha partilham o mesmo fundo (a foto, a aba do logótipo e os botões do
 * canto): fica montado ao passar de uma para a outra e só o formulário do cartão muda — sem a tela branca e sem a foto
 * a piscar pelo meio (Silva, 14/10/2026). As ligações entre estas páginas são <Link> (sem recarregar a página).
 */
export default function EntradaLayout({ children }: { children: React.ReactNode }) {
  return <LoginDividido>{children}</LoginDividido>
}
