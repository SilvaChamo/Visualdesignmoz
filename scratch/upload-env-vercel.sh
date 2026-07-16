#!/bin/bash
# Upload variables from .env.local to Vercel

set -e

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found!"
  exit 1
fi

echo "Reading environment variables from $ENV_FILE and adding to Vercel..."

while IFS= read -r line || [ -n "$line" ]; do
  # Skip comments and empty lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  
  # Parse KEY and VALUE
  if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    
    # Strip leading/trailing whitespaces from key and value
    key=$(echo "$key" | xargs)
    val=$(echo "$val" | xargs)
    
    # Strip wrapping quotes from value if present
    if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
      val="${BASH_REMATCH[1]}"
    fi
    
    # Skip local dev URL overrides to keep Vercel production clean
    if [ "$key" = "NEXT_PUBLIC_APP_URL" ] || [ "$key" = "NEXT_PUBLIC_SITE_URL" ] || [ "$key" = "NEXT_PUBLIC_PANEL_URL" ]; then
      if [ "$key" = "NEXT_PUBLIC_SITE_URL" ]; then
        # Set production site URL on Vercel
        val="https://visualdesignmoz.com"
      elif [ "$key" = "NEXT_PUBLIC_APP_URL" ] || [ "$key" = "NEXT_PUBLIC_PANEL_URL" ]; then
        val="https://visualdesignmoz.com"
      fi
    fi
    
    echo "Adding $key to Vercel..."
    echo -n "$val" | npx vercel env add "$key" production,preview --yes --force
  fi
done < "$ENV_FILE"

echo "All environment variables uploaded successfully!"
