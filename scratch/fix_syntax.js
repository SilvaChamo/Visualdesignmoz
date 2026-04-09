const fs = require('fs');
const path = require('path');

const filePath = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// Fix SuspenderWebsiteSection (line 3250 needs )} before </div>)
// In the current lines array, index is line_number - 1
// Line 3250 is index 3249
if (lines[3249].trim() === '</div>' && lines[3248].trim() === '</table>') {
    lines.splice(3249, 0, '        )}');
    console.log('Fixed SuspenderWebsiteSection');
}

// Fix DeleteWebsiteSection
// After splice, lines shifted. Let's find index again.
const content2 = lines.join('\n');
const lines2 = content2.split('\n');
// Let's find DeleteWebsiteSection table end
const deleteEndIndex = lines2.findIndex((l, i) => i > 3250 && l.trim() === '</table>' && lines2[i+1].trim() === '</div>' && lines2[i-1].includes('))}</tbody>'));
if (deleteEndIndex !== -1) {
    lines2.splice(deleteEndIndex + 1, 0, '        )}');
    console.log('Fixed DeleteWebsiteSection at line ' + (deleteEndIndex + 2));
}

// Fix SecuritySection (line 5083)
const content3 = lines2.join('\n');
const lines3 = content3.split('\n');
// SecuritySection end (confirmed near 5083 earlier)
const securityEndIndex = lines3.findIndex((l, i) => i > 5000 && l.trim() === '</table>' && lines3[i+1].trim() === '</div>' && lines3[i-1].includes('</tbody>'));
if (securityEndIndex !== -1) {
    lines3.splice(securityEndIndex + 1, 0, '        )}');
    console.log('Fixed SecuritySection at line ' + (securityEndIndex + 2));
}

fs.writeFileSync(filePath, lines3.join('\n'));
console.log('Successfully updated CyberPanelSections.tsx');
