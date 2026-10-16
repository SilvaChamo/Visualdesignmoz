# Diretrizes de Padronização, Preservação e Consistência de Design

Para garantir que o código e o design do site permaneçam limpos, harmónicos, seguros e consistentes, siga estritamente estas regras no workspace:

## 1. Preservação Total e Integridade (NUNCA ELIMINAR NADA)
- **Zero Eliminações**: É expressamente proibido eliminar ou remover configurações, ficheiros, bases de dados, caixas de e-mail ou código que já estavam configurados e funcionais.
- **Modo Incremental/Preservativo**: Em sincronizações e transferências entre servidores ou pastas, usar sempre métodos que preservem dados pré-existentes (ex.: sem `--delete` em ficheiros de utilizadores/sites).

## 2. Rotas Estritas da Aplicação
- **Não Criar Novas Rotas Arbitrárias**: É estritamente proibido criar rotas diferentes ou paralelas às já estabelecidas na arquitetura do projeto.
- **Comunicação Obrigatória**: Se houver real necessidade técnica de criar ou alterar uma rota, deve-se obrigatoriamente informar e consultar o utilizador antes de qualquer alteração.

## 3. Criação de Componentes e Interface (Zero Invenção)
- **Não Inventar Estilos**: Ao criar novos componentes, modais ou páginas, utilize rigorosamente o layout e os estilos pré-definidos do sistema existente.
- **Arredondamentos (`border-radius`)**: Respeite os padrões de raio da aplicação (variável `--r` ou `rounded-xl`/`rounded-lg`). Nunca use valores arbitrários fora do padrão.
- **Botões**: Use exclusivamente as classes pré-definidas de botões (`.btn`, `.btn.r`, `.btn.g`, `.btn.sm`, `.btn.btn-ed`, etc.), mantendo alturas, preenchimentos e estados de foco/hover idênticos.
- **Paleta de Cores**: Respeite a paleta oficial (vermelho de destaque `var(--red)` / `red-600`, verde `#16a34a` / `#22c55e` em ações de confirmação/DNS, tons de `zinc` / neutros).
- **Temas Claro e Escuro**: Todo e qualquer componente deve suportar nativamente tanto o tema claro como o tema escuro (`data-theme="dark"` / classes `dark:`), com contrastes testados.

## 4. Alinhamento de Layout e Spacing (Espaçamento)
- **Margens de Container Principal**: O container de conteúdo padrão nas páginas é `<div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">`. Nunca adicione margens internas adicionais (como `mx-5`) que desalitem o conteúdo lateralmente com o resto do cabeçalho, rodapé ou secções vizinhas.
- **Breakpoints Responsivos**: Padronize os breakpoints de colunas de grid. Se a página usa `lg:grid-cols-12` para secções de duas colunas, continue a usar `lg:grid-cols-12` e `lg:col-span-*` nas novas secções da mesma página, em vez de misturar breakpoints como `md:` noutros elementos.
- **Padding de Cards**: Utilize padding uniforme. Em vez de inventar valores grandes ou arbitrários (ex: `p-10`), copie o padrão já estabelecido, geralmente `p-5`, `p-6` ou `p-6 sm:p-8`.

## 5. Tipografia e Bordas
- **Tamanho e Peso dos Textos**: Analise a hierarquia tipográfica da página (ex: títulos `text-2xl sm:text-3xl md:text-4xl font-extrabold`, descrições `text-base text-zinc-600 dark:text-zinc-400`). Copie exatamente as classes de tipografia existentes.
- **Bordas e Divisórias**: Siga o padrão de bordas subtis do projeto, ex: `border-zinc-200/80 dark:border-white/10` ou `var(--line)`.
