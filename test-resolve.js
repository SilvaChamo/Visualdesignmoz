const FOLDER_VARIATIONS = {
  'sent':    ['Sent', 'Sent Items', 'Enviados', 'INBOX.Sent'],
  'trash':   ['Deleted Items', 'Trash', 'Bin', 'Lixo', 'INBOX.Deleted Items', 'INBOX.Trash'],
  'junk':    ['Junk', 'Junk E-mail', 'Spam', 'INBOX.Junk', 'INBOX.Spam'],
  'drafts':  ['Drafts', 'Draft', 'Rascunhos', 'INBOX.Drafts'],
  'archive': ['Archive', 'Arquivados', 'Arquivo', 'INBOX.Archive'],
}

const resolveFolder = (folderPath, folderList) => {
  const existingPaths = new Set(folderList.map(m => m.path))
  const existingLowers = new Map(folderList.map(m => [m.path.toLowerCase(), m.path]))

  const p = folderPath.toLowerCase()
  const variations = FOLDER_VARIATIONS[p] || [folderPath]
  if (!variations.includes(folderPath)) variations.unshift(folderPath)

  for (const v of variations) {
    if (existingPaths.has(v)) return v
    if (existingLowers.has(v.toLowerCase())) return existingLowers.get(v.toLowerCase())
  }
  return null
}

const folders = [
  { path: 'Archive' },
  { path: 'Drafts' },
  { path: 'INBOX' },
  { path: 'Junk E-mail' },
  { path: 'Sent' },
  { path: 'Deleted Items' }
]

console.log("INBOX resolved to:", resolveFolder('INBOX', folders));
console.log("Sent resolved to:", resolveFolder('Sent', folders));
console.log("Trash resolved to:", resolveFolder('Trash', folders));
