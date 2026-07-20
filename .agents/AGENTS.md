# Diretrizes de Padronização e Consistência de Design

Para garantir que o código e o design do site permaneçam limpos, harmónicos e consistentes, siga estritamente estas regras de estilo em qualquer alteração ou criação de componentes no workspace:

## 1. Alinhamento de Layout e Spacing (Espaçamento)
- **Margens de Container Principal**: O container de conteúdo padrão nas páginas é `<div className="container mx-auto max-w-7xl px-4 sm:px-6 relative z-10">`. Nunca adicione margens internas adicionais (como `mx-5`) que desalitem o conteúdo lateralmente com o resto do cabeçalho, rodapé ou secções vizinhas.
- **Breakpoints Responsivos**: Padronize os breakpoints de colunas de grid. Se a página usa `lg:grid-cols-12` para secções de duas colunas, continue a usar `lg:grid-cols-12` e `lg:col-span-*` nas novas secções da mesma página, em vez de misturar breakpoints como `md:` noutros elementos.
- **Padding de Cards**: Utilize padding uniforme. Em vez de inventar valores grandes ou arbitrários (ex: `p-10`), copie o padrão já estabelecido, geralmente `p-5`, `p-6` ou `p-6 sm:p-8`.

## 2. Tipografia e Cores
- **Tamanho e Peso dos Textos**: Analise a hierarquia tipográfica da página (ex: títulos `text-2xl sm:text-3xl md:text-4xl font-extrabold`, descrições `text-base text-zinc-600 dark:text-zinc-400`). Copie exatamente as classes de tipografia existentes.
- **Paleta de Cores**: Utilize rigorosamente a paleta do projeto (ex: tons de `zinc` para fundo escuro, `red-600`/`red-500` para destaque e botões). Não crie variações de tons personalizadas sem necessidade.

## 3. Bordas, Cantos e Sombras
- **Cantos Arredondados (`border-radius`)**: Respeite os padrões de raio da página (geralmente `rounded-xl` ou `rounded-lg`). Evite misturar `rounded-2xl` onde o padrão é menor.
- **Bordas e Divisórias**: Siga o padrão de bordas subtis do projeto, ex: `border-zinc-200/80 dark:border-white/10`.
