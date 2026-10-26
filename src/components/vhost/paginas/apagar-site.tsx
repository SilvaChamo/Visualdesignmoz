'use client';

// Popup "Apagar" da lista e da página de um domínio (Silva, 26/10/2026): o que se apaga é escolhido na hora — só o site (os ficheiros), o site e a base de
// dados, ou tudo; o que não se escolher fica. É para TODAS as contas e planos, cada uma nos seus domínios (o servidor confirma que o domínio é da conta).
// As escolhas dependem do que o domínio tem: site (as 3), só e-mail (só o e-mail, ou tudo) ou só domínio (tudo).
import { useState } from 'react';
import { useVH } from '../context';
import { EN } from '../generated/data';

export type ModoApagar = 'site' | 'site-bd' | 'tudo';

{
  const novas: Record<string, string> = {
    'Só o site': 'Only the site',
    'Apaga o site e os ficheiros. Ficam o e-mail (com as caixas), o DNS e as bases de dados.': 'Deletes the site and its files. The email (with the mailboxes), the DNS and the databases stay.',
    'O site e a base de dados': 'The site and its database',
    'Apaga também a base de dados do site (WordPress) e os agendamentos dele. Fica o e-mail e o DNS.': 'Also deletes the (WordPress) database of the site and its scheduled tasks. The email and the DNS stay.',
    Tudo: 'Everything',
    'Apaga o site, a base de dados, o e-mail (com as caixas e as mensagens) e o DNS do domínio.': 'Deletes the site, the database, the email (with the mailboxes and the messages) and the DNS of the domain.',
    'Não se pode desfazer. Guarde antes uma cópia do que ainda precisar.': 'This cannot be undone. Save a copy of anything you still need first.',
    'Isto apaga também as mensagens de e-mail do domínio.': 'This also deletes the email messages of the domain.',
    'O que apagar?': 'What to delete?',
    'Só o e-mail': 'Only the email',
    'Apaga o e-mail do domínio, com as caixas e as mensagens. Fica o DNS.': 'Deletes the email of the domain, with the mailboxes and messages. The DNS stays.',
    'Apaga o e-mail do domínio (caixas e mensagens) e o DNS.': 'Deletes the email of the domain (mailboxes and messages) and the DNS.',
    'Tira o domínio do servidor: apaga a zona DNS e o que tiver associado.': 'Removes the domain from the server: deletes the DNS zone and whatever is associated with it.',
    'Não se pode desfazer. Isto apaga também as mensagens de e-mail do domínio.': 'This cannot be undone. It also deletes the email messages of the domain.',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

/** O que o domínio tem: site (alojamento), só e-mail ou só domínio (só a zona DNS) */
export type TipoDominio = 'site' | 'email' | 'dominio';

const OPCOES: Record<TipoDominio, { k: ModoApagar; titulo: string; texto: string }[]> = {
  site: [
    { k: 'site', titulo: 'Só o site', texto: 'Apaga o site e os ficheiros. Ficam o e-mail (com as caixas), o DNS e as bases de dados.' },
    { k: 'site-bd', titulo: 'O site e a base de dados', texto: 'Apaga também a base de dados do site (WordPress) e os agendamentos dele. Fica o e-mail e o DNS.' },
    { k: 'tudo', titulo: 'Tudo', texto: 'Apaga o site, a base de dados, o e-mail (com as caixas e as mensagens) e o DNS do domínio.' },
  ],
  email: [
    { k: 'site', titulo: 'Só o e-mail', texto: 'Apaga o e-mail do domínio, com as caixas e as mensagens. Fica o DNS.' },
    { k: 'tudo', titulo: 'Tudo', texto: 'Apaga o e-mail do domínio (caixas e mensagens) e o DNS.' },
  ],
  dominio: [{ k: 'tudo', titulo: 'Tudo', texto: 'Tira o domínio do servidor: apaga a zona DNS e o que tiver associado.' }],
};

export function ApagarSite({ dominios, tipo, aoApagar }: { dominios: string[]; tipo: TipoDominio; aoApagar: (modo: ModoApagar) => void }) {
  const { t, closeM } = useVH();
  const opcoes = OPCOES[tipo];
  const [modo, setModo] = useState<ModoApagar>(opcoes[0].k);
  const comMensagens = modo === 'tudo' || tipo === 'email';
  return (
    <>
      <h3>
        {t('Apagar')} {dominios.join(', ')}?
      </h3>
      <div className="vh-apagar-ops" role="radiogroup" aria-label={t('O que apagar?')}>
        {opcoes.map((o) => (
          <label key={o.k} className={'vh-apagar-op' + (modo === o.k ? ' on' : '')}>
            <input type="radio" name="vh-modo-apagar" checked={modo === o.k} onChange={() => setModo(o.k)} />
            <span>
              <b>{t(o.titulo)}</b>
              <small>{t(o.texto)}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="vh-apagar-aviso">
        <i className="fa-solid fa-triangle-exclamation" /> {t(comMensagens ? 'Não se pode desfazer. Isto apaga também as mensagens de e-mail do domínio.' : 'Não se pode desfazer. Guarde antes uma cópia do que ainda precisar.')}
      </p>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={() => {
            closeM();
            aoApagar(modo);
          }}
        >
          {t('Apagar')}
        </button>
      </div>
    </>
  );
}

/** O pedido ao servidor para cada escolha: "tudo" usa o eliminar-tudo (site, base, e-mail e DNS); as outras, o apagar com modo */
export const corpoApagar = (modo: ModoApagar, dominio: string): Record<string, unknown> =>
  modo === 'tudo' ? { acao: 'dominio-eliminar-tudo', dominio, bd: true } : { acao: 'dominio-apagar', dominio, modo };

/** O tipo que vale para vários domínios escolhidos: só se todos forem do mesmo tipo (site ou só e-mail); com tipos misturados fica "só domínio" (a opção "Tudo") */
export function tipoDosDominios(todos: { name: string; soEmail?: boolean; soDominio?: boolean }[], nomes: string[]): TipoDominio {
  const tipos = nomes.map((n) => {
    const x = todos.find((y) => y.name === n);
    return x?.soEmail ? 'email' : x?.soDominio ? 'dominio' : 'site';
  });
  return tipos.every((x) => x === 'site') ? 'site' : tipos.every((x) => x === 'email') ? 'email' : 'dominio';
}
