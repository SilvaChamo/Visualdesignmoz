'use client';

// Mensagem a todos (menu do admin) — pedido do Silva (13/10/2026): junta num só sítio o que no dashboard antigo estava
// em dois: "Escrever mensagem" (1.º separador; o "Enviar Notificação" de src/app/dashboard/NotificationsSection.tsx) e
// "Templates" (Notificações → Templates: o próprio componente do dashboard antigo, src/app/dashboard/TemplatesSection.tsx,
// sem redesenho — os botões Salvar / Cancelar / Eliminar ficam na barra de cima, como lá). Desenho do dashboard antigo
// (Tailwind) dentro do cartão principal do painel (.tw-livre, ver paginas.css).
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AdminSectionChromeProvider, useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import { TemplatesSection } from '@/app/dashboard/TemplatesSection';
import { Send, Users, AlertTriangle, CheckCircle, Info, X, Mail, Eye } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { buildSimpleNotificationEmailHtml } from '@/lib/renewal-templates';
import { NotificationRichEditor } from '@/app/dashboard/NotificationRichEditor';
import type { ScreenFn } from '../screens';
import { useVH } from '../context';
import { Tabs } from './componentes';
import { Confirmar } from './pacotes';

type Aba = 'escrever' | 'templates';
type Tipo = 'info' | 'success' | 'warning' | 'error';

/** Texto simples de HTML — título automático, texto guardado (o sino mostra-o sem HTML) e validação de campo vazio */
function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent || '').replace(/\s+/g, ' ').trim();
}

function deriveTitle(plainText: string): string {
  if (!plainText) return 'Notificação';
  return plainText.length > 60 ? `${plainText.slice(0, 57)}...` : plainText;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'error':
      return <X className="w-4 h-4 text-red-500" />;
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'error':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};

/** "Escrever mensagem": o "Enviar Notificação" do dashboard antigo — para todos os clientes ou um só, no sino do painel e,
 *  se escolhido, também por e-mail (POST /api/notifications/admin) */
function EscreverMensagem() {
  const vh = useVH();
  const [messageHtml, setMessageHtml] = useState('');
  const [type, setType] = useState<Tipo>('info');
  const [category, setCategory] = useState('general');
  const [sendEmail, setSendEmail] = useState(false);
  const [sendToAll, setSendToAll] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [link, setLink] = useState('');
  const [linkText, setLinkText] = useState('');
  const [sending, setSending] = useState(false);

  const enviar = async () => {
    const plainText = htmlToPlainText(messageHtml);
    if (!plainText) return;
    const title = deriveTitle(plainText);
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        message: plainText,
        messageHtml,
        type,
        category,
        sendEmail,
        sendToAll,
        link: link || undefined,
        linkText: linkText || undefined,
      };

      if (!sendToAll && userEmail) {
        // o id do utilizador pelo e-mail
        const resUser = await fetch(`/api/users/search?email=${encodeURIComponent(userEmail)}`);
        const userData = await resUser.json();
        if (!userData.user) {
          vh.toast('Utilizador não encontrado');
          return;
        }
        payload.userId = userData.user.id;
      }

      const res = await fetch('/api/notifications/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        const emailSummary = sendEmail
          ? sendToAll
            ? ` · E-mails: ${data.emailsSent} enviados${data.emailsFailed ? `, ${data.emailsFailed} falharam` : ''}`
            : ` · E-mail: ${data.emailSent ? 'enviado' : `falhou (${data.emailError || 'erro desconhecido'})`}`
          : '';
        vh.toast(`✅ Notificação enviada — ${sendToAll ? `${data.count} utilizadores` : '1 utilizador'}${emailSummary}`);
        // limpar o formulário
        setMessageHtml('');
        setUserEmail('');
        setLink('');
        setLinkText('');
        setSendEmail(false);
      } else {
        vh.toast('❌ Erro: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao enviar:', error);
      vh.toast('❌ Erro ao enviar notificação');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!htmlToPlainText(messageHtml)) return;
    const recipientDesc = sendToAll ? 'TODOS os clientes' : userEmail || 'o utilizador indicado';
    vh.openM(<Confirmar titulo="Enviar a notificação?" texto={`Confirma o envio desta notificação para ${recipientDesc}?`} ok="Enviar" onOk={() => void enviar()} />);
  };

  const previewPlainText = htmlToPlainText(messageHtml);
  const previewTitle = deriveTitle(previewPlainText);
  const previewClientName = !sendToAll && userEmail.trim() ? (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail.trim()) : 'Cliente';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Send className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Enviar Notificação</h3>
            <p className="text-sm text-gray-500">Envie notificações para clientes específicos ou para todos</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Destinatário */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">Destinatário</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={sendToAll} onChange={() => setSendToAll(true)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">Todos os clientes</span>
                <Users className="w-4 h-4 text-gray-400" />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!sendToAll} onChange={() => setSendToAll(false)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">Cliente específico</span>
              </label>
            </div>

            {!sendToAll && (
              <div className="mt-3">
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="email@cliente.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required={!sendToAll}
                />
              </div>
            )}
          </div>

          {/* Mensagem — o mesmo editor completo dos Templates; o título do sino sai do texto escrito aqui */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
            <NotificationRichEditor value={messageHtml} onChange={setMessageHtml} />
          </div>

          {/* Tipo e Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as Tipo)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="info">ℹ️ Informativo</option>
                <option value="success">✅ Sucesso</option>
                <option value="warning">⚠️ Aviso</option>
                <option value="error">❌ Erro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="general">Geral</option>
                <option value="email">Email</option>
                <option value="domain">Domínio</option>
                <option value="payment">Pagamento</option>
                <option value="support">Suporte</option>
                <option value="system">Sistema</option>
              </select>
            </div>
          </div>

          {/* Link opcional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link (opcional)</label>
              <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Link</label>
              <input type="text" value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Ver detalhes" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          {/* Opções */}
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <input type="checkbox" id="sendEmail" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 text-yellow-600" />
            <label htmlFor="sendEmail" className="flex items-center gap-2 text-sm text-yellow-800 cursor-pointer">
              <Mail className="w-4 h-4" />
              Também enviar por email
            </label>
          </div>

          {/* Preview */}
          {previewPlainText && (
            <div className={`p-4 rounded-lg border ${getTypeColor(type)}`}>
              <div className="flex items-start gap-3">
                {getTypeIcon(type)}
                <div>
                  <p className="font-medium">{previewTitle}</p>
                  <p className="text-sm mt-1 opacity-90">{previewPlainText}</p>
                  {link && <p className="text-sm mt-2 underline">{linkText || 'Ver mais'}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Botão Enviar */}
          <button
            type="submit"
            disabled={sending || !previewPlainText}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Spinner className="w-5 h-5" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {sendToAll ? 'Enviar para Todos' : 'Enviar Notificação'}
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5" />
          Preview ao Vivo
        </h4>
        <div className="border border-gray-200 rounded overflow-hidden">
          <div
            dangerouslySetInnerHTML={{
              __html: buildSimpleNotificationEmailHtml({
                clientName: previewClientName,
                title: previewPlainText ? previewTitle : '',
                message: previewPlainText || 'A mensagem que escreveres aqui aparece assim no email.',
                messageHtml: messageHtml || undefined,
                link: link || undefined,
                linkText: linkText || undefined,
                type,
              }),
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Barra de cima das páginas antigas: no dashboard antigo os botões da secção (setChrome({ toolbar })) iam para a barra
// de cima; aqui vão para o mesmo sítio — o lugar dos botões da página na barra do título (`actions` do ecrã).
let alvoBarra: HTMLElement | null = null;
const ouvintesBarra = new Set<() => void>();
const avisarBarra = () => ouvintesBarra.forEach((f) => f());
function LugarBarraAntiga() {
  return (
    <span
      className="tw-livre barra-antiga"
      ref={(el) => {
        if (el) {
          alvoBarra = el;
          avisarBarra();
        } else
          setTimeout(() => {
            if (alvoBarra && !alvoBarra.isConnected) {
              alvoBarra = null;
              avisarBarra();
            }
          });
      }}
    />
  );
}
function PonteBarraAntiga() {
  const { chrome } = useAdminSectionChrome();
  const alvo = useSyncExternalStore(
    (f) => {
      ouvintesBarra.add(f);
      return () => void ouvintesBarra.delete(f);
    },
    () => alvoBarra,
    () => null,
  );
  return chrome?.toolbar && alvo ? createPortal(chrome.toolbar, alvo) : null;
}

function MensagemTodos({ aba }: { aba: Aba }) {
  const vh = useVH();
  return (
    <>
      <Tabs<Aba>
        tabs={[
          ['escrever', 'Escrever mensagem', 'fa-pen-to-square'],
          ['templates', 'Templates', 'fa-file-lines'],
        ]}
        on={aba}
        onChange={(k) => vh.nav('/' + vh.s.level + '/mensagem-todos' + (k === 'templates' ? '/templates' : ''))}
      />
      <div className="tw-livre">
        {aba === 'templates' ? (
          <AdminSectionChromeProvider>
            <PonteBarraAntiga />
            <TemplatesSection />
          </AdminSectionChromeProvider>
        ) : (
          <EscreverMensagem />
        )}
      </div>
    </>
  );
}

export const mensagemTodos: ScreenFn = (vh) => {
  const aba: Aba = vh.s.sub[0] === 'templates' ? 'templates' : 'escrever';
  const base = { t: 'Mensagem a todos', path: '/' + vh.s.level + '/mensagem-todos' };
  return {
    title: 'Mensagem a todos',
    desc: aba === 'templates' ? 'Templates das notificações e dos e-mails enviados aos clientes' : 'Enviar um aviso a todas as contas ou a um cliente',
    crumbs: [base, { t: aba === 'templates' ? 'Templates' : 'Escrever mensagem' }],
    actions: aba === 'templates' ? <LugarBarraAntiga /> : undefined,
    body: <MensagemTodos aba={aba} />,
  };
};
