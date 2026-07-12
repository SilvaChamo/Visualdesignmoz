// Função corrigida para extrair domínio dinâmico
const getWebmailUrl = () => {
  if (emailOrigem && emailOrigem.includes('@')) {
    const domain = emailOrigem.split('@')[1]
    return `https://mail.${domain}:8090/snappymail/`
  }
  return 'https://37.27.17.25:8090/snappymail/' // Fallback
}

// Uso no JSX
<a href={getWebmailUrl()} target="_blank">
  Webmail
</a>
