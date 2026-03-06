const fs = require('fs');
const content = fs.readFileSync('src/app/client/page.tsx', 'utf8');
const lines = content.split('\n');

const imports = `\'use client\'\n\nimport { useState, useEffect, useRef } from \'react\'\n`;
const coresPaleta = lines.slice(29, 36).join('\n') + '\n\n';

let componentSource = lines.slice(179, 1442).join('\n');
componentSource = componentSource.replace('function EmailWebmailSection', 'export function EmailWebmailSection');

const finalContent = imports + coresPaleta + componentSource;
fs.writeFileSync('src/components/dashboard/EmailWebmailSection.tsx', finalContent);

// Also remove it from client/page.tsx
const newClientPage = [...lines.slice(0, 179), ...lines.slice(1442)].join('\n');
fs.writeFileSync('src/app/client/page.tsx', newClientPage);
console.log('done');
