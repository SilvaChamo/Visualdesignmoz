import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

modified = False

# Fix SuspenderWebsiteSection (table end at approx index 3248)
# We find line with </table> and check context
for i in range(3200, 3260):
    if i < len(lines) and '</table>' in lines[i] and '</div>' in lines[i+1] and '))}</tbody>' in lines[i-1]:
        if ')}' not in lines[i+1] and ')}' not in lines[i]:
            lines.insert(i+1, '        )}\n')
            print(f"Fixed SuspenderWebsiteSection at index {i+1}")
            modified = True
            break

# Fix DeleteWebsiteSection (starts 3277)
for i in range(3270, 3350):
    if i < len(lines) and '</table>' in lines[i] and '</div>' in lines[i+1] and '))}</tbody>' in lines[i-1]:
        if ')}' not in lines[i+1] and ')}' not in lines[i]:
            lines.insert(i+1, '        )}\n')
            print(f"Fixed DeleteWebsiteSection at index {i+1}")
            modified = True
            break

# Fix SecuritySection (between 5000 and 5100)
for i in range(5000, 5100):
    if i < len(lines) and '</table>' in lines[i] and '</div>' in lines[i+1] and '</tbody>' in lines[i-1]:
         if ')}' not in lines[i+1] and ')}' not in lines[i]:
            lines.insert(i+1, '        )}\n')
            print(f"Fixed SecuritySection at index {i+1}")
            modified = True
            break

if modified:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("File saved successfully.")
else:
    print("No changes needed or matching sections not found.")
