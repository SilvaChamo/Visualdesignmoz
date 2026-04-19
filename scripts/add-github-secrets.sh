#!/bin/bash
# Adiciona secrets ao repositório GitHub via API
# Usa o GITHUB_TOKEN do .env.local

set -e

REPO_OWNER="SilvaChamo"
REPO_NAME="Visualdesigne"

# Ler token do .env.local
if [ -f ".env.local" ]; then
  TOKEN=$(grep GITHUB_TOKEN .env.local | cut -d'=' -f2 | tr -d '"' | head -1)
fi

if [ -z "$TOKEN" ]; then
  echo "❌ GITHUB_TOKEN não encontrado em .env.local"
  exit 1
fi

echo "🔐 A adicionar secrets ao repositório $REPO_OWNER/$REPO_NAME..."

# Função para adicionar secret
add_secret() {
  local name=$1
  local value=$2
  
  # Obter chave pública do repositório para encriptação
  PUB_KEY=$(curl -s -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/public-key")
  
  KEY_ID=$(echo "$PUB_KEY" | grep -o '"key_id": "[^"]*"' | cut -d'"' -f4)
  KEY=$(echo "$PUB_KEY" | grep -o '"key": "[^"]*"' | cut -d'"' -f4)
  
  if [ -z "$KEY_ID" ]; then
    echo "⚠️  Não foi possível obter a chave pública. Verifica o token."
    echo "Resposta: $PUB_KEY"
    return 1
  fi
  
  # Encriptar o valor usando libsodium (requer sodium-cli instalado)
  # Ou usar base64 simples (não é seguro, apenas para demo)
  # Melhor alternativa: usar gh CLI
  
  echo "  - $name: a adicionar..."
  
  # Usar GitHub CLI se disponível
  if command -v gh &> /dev/null; then
    echo "$value" | gh secret set "$name" --repo="$REPO_OWNER/$REPO_NAME"
    echo "    ✅ $name adicionado via gh CLI"
  else
    echo "    ⚠️  Instala gh CLI para adicionar secrets automaticamente:"
    echo "       brew install gh"
    echo "       gh auth login"
    echo ""
    echo "    Ou adiciona manualmente em:"
    echo "    https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
    return 1
  fi
}

echo ""
echo "📋 Secrets necessários:"
echo ""

cat << 'EOF'
┌─────────────────────────────────────────────────────────────────┐
│  SECRET NAME                    │  VALOR                      │
├─────────────────────────────────────────────────────────────────┤
│  SERVER_HOST                    │  109.199.104.22             │
│  SERVER_USER                    │  root                       │
│  SERVER_SSH_KEY                 │  (conteúdo da chave SSH)    │
│  NEXT_PUBLIC_SUPABASE_URL       │  https://gwankhxcbkrtgx...  │
│  NEXT_PUBLIC_SUPABASE_ANON_KEY  │  eyJhbGciOiJIUzI1NiIs...   │
└─────────────────────────────────────────────────────────────────┘
EOF

echo ""

# Verificar se gh CLI está instalado
if ! command -v gh &> /dev/null; then
  echo "⚠️  GitHub CLI (gh) não está instalado."
  echo ""
  echo "Para adicionar secrets automaticamente, instala:"
  echo "  brew install gh"
  echo ""
  echo "Depois corre:"
  echo "  gh auth login"
  echo "  gh secret set SERVER_HOST --repo=SilvaChamo/Visualdesigne --body=\"109.199.104.22\""
  echo ""
  echo "Ou adiciona manualmente em:"
  echo "  https://github.com/SilvaChamo/Visualdesigne/settings/secrets/actions"
  exit 1
fi

# Verificar autenticação gh
if ! gh auth status &> /dev/null; then
  echo "🔑 GitHub CLI não está autenticado."
  echo "Corre: gh auth login"
  exit 1
fi

# Perguntar antes de continuar
echo "🚀 Pronto para adicionar os secrets?"
echo ""
read -p "Continuar? (s/N): " confirm
if [[ ! $confirm =~ ^[Ss]$ ]]; then
  echo "Cancelado."
  exit 0
fi

# Adicionar secrets
add_secret "SERVER_HOST" "109.199.104.22"
add_secret "SERVER_USER" "root"

# Chave SSH - precisa do ficheiro
SSH_KEY_FILE="/Users/macbook/.ssh/visualdesign_cyberpanel_key"
if [ -f "$SSH_KEY_FILE" ]; then
  SSH_KEY=$(cat "$SSH_KEY_FILE")
  add_secret "SERVER_SSH_KEY" "$SSH_KEY"
else
  echo "⚠️  Chave SSH não encontrada em $SSH_KEY_FILE"
  echo "    Adiciona manualmente: https://github.com/SilvaChamo/Visualdesigne/settings/secrets/actions"
fi

add_secret "NEXT_PUBLIC_SUPABASE_URL" "https://gwankhxcbkrtgxopbxwd.supabase.co"
add_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY"
add_secret "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY"

echo ""
echo "✅ Secrets adicionados com sucesso!"
echo ""
echo "Verifica em: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
