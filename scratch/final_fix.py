import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

modified = False

# 1. Fix EmailAccountsSection (approx 3815)
# We find the loading line and ensure it ends before the next div block or after map.
for i in range(len(lines)):
    if '{loading ? <TableSkeleton columns={2}' in lines[i] and 'emails.length > 0 ? (' in lines[i]:
        # Remove any incorrect )} inside the map
        for j in range(i + 1, i + 50):
            if j < len(lines) and lines[j].strip() == ')}' and '</div>' not in lines[j+1]:
                print(f"Removing incorrect closing at L{j+1}")
                lines[j] = ""
                modified = True
            if j < len(lines) and '))}</div>' in lines[j]:
                # Found end of map. Now close ternary.
                lines[j] = lines[j].replace('))}</div>', '))}</div>\n        )}\n')
                print(f"Fixed Email section at L{j+1}")
                modified = True
                break

# 2. Fix titles and other potential regex issues
for i in range(len(lines)):
    if 'Suspender / Activar Websites' in lines[i]:
        lines[i] = lines[i].replace('Suspender / Activar Websites', 'Suspender e Activar Websites')
        modified = True

if modified:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines([l for l in lines if l]) # remove empty lines from our "" deletions
    print("Success")
else:
    print("No changes needed")
