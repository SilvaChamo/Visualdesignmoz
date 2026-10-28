# Pedido à Vodacom — passar o M-Pesa de teste (sandbox) para produção

Mensagem pronta para enviar à equipa de integração M-Pesa da Vodacom Moçambique. Os campos entre `[ ]` preenchem-se antes de enviar.

---

**Assunto:** Pedido de passagem a produção — integração M-Pesa C2B Single Stage — VisualDesign

Exmos. Senhores,

A **[nome legal da empresa]** (NUIT **[NUIT]**), titular do site https://visualdesignmoz.com, tem a integração **M-Pesa C2B Single Stage**
concluída e testada no ambiente de teste (sandbox), e vem solicitar a passagem ao ambiente de **produção**.

**O que pedimos**
1. As credenciais de produção da nossa conta: **API Key**, **Public Key** e **Service Provider Code**.
2. O endereço (host) e a porta de produção da API (no teste usamos `api.sandbox.vm.co.mz:18352`; confirmem o de produção).
3. A autorização (lista de IPs permitidos), se aplicável, para o IP do nosso servidor: **169.58.148.144**.
4. O procedimento e o prazo para a validação final (go-live) e para a conta onde serão liquidados os valores.

**Como usamos a API**
- Cobrança por `c2bPayment/singleStage` (`/ipg/v1x/c2bPayment/singleStage/`), pedida pelo cliente no checkout, para compras de domínios,
  hospedagem e e-mail. Moeda: MZN. Autenticação: API Key cifrada com a Public Key (RSA, PKCS#1 v1.5) como Bearer token.
- Guardamos a referência da transacção, o ID da transacção e o ID da conversa de cada pagamento, para reconciliação e suporte.

**Contacto técnico:** [nome] — [telefone] — silva.chamo@visualdesignmoz.com

Com os melhores cumprimentos,
[nome], [cargo]
VisualDesign — https://visualdesignmoz.com

---

## Para nós (não enviar)
- Quando chegarem as credenciais: criar/actualizar os secrets do GitHub `MPESA_API_KEY`, `MPESA_PUBLIC_KEY`, `MPESA_SERVICE_PROVIDER_CODE`,
  `MPESA_HOST`, `MPESA_PORT`, e em `.github/workflows/deploy-visualdesign.yml` mudar `MPESA_ENV` e `NEXT_PUBLIC_MPESA_ENV` de `sandbox` para
  `production`. Envolve dinheiro real: só com o "avança" do Silva e depois de um pagamento de teste de valor mínimo.
