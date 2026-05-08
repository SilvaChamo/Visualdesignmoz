const fs = require('fs');
const path = require('path');

const baseDir = '/Users/macbook/Desktop/APP/visualdesign/public/cloned/aamihe.com';

function fixStructure() {
  const files = fs.readdirSync(baseDir);
  
  files.forEach(file => {
    if (file.startsWith('_') && file.endsWith('.html')) {
      // Remover os underscores iniciais e finais
      let newName = file.replace(/^_+|_+$/g, '').replace(/\.html$/, '');
      
      // Se for algo como 'en' ou 'fr' ou 'about'
      const targetDir = path.join(baseDir, newName);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      
      fs.renameSync(path.join(baseDir, file), path.join(targetDir, 'index.html'));
      console.log(`✅ Moved ${file} to ${newName}/index.html`);
    }
  });
}

fixStructure();
