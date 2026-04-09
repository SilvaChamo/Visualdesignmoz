import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

modified = False

# 1. Fix PHPConfigsSection (near 2624)
for i in range(len(lines)):
    if 'loading ? <FormSkeleton fields={6} />' in lines[i] and 'config && (' in lines[i]:
        # Search for the end of the <> ... </> block or before next section
        for j in range(i+1, i+100):
            if j < len(lines) and '</>' in lines[j] and ')}' not in lines[j+1]:
                print(f"Fixing PHPConfigs at L{j+1}")
                lines[j] = lines[j].replace('</>', '</>\n        )}')
                modified = True
                break

# 2. Fix DKIMManagerSection (near 4152)
for i in range(len(lines)):
    if 'dkim && (' in lines[i] and 'loading ? (' in lines[i-1]:
        for j in range(i+1, i+50):
            if j < len(lines) and '</div>' in lines[j] and ')}' not in lines[j+1] and 'export' in lines[j+2]:
                print(f"Fixing DKIMManager at L{j+1}")
                lines[j] = lines[j].replace('</div>', '</div>\n        )}')
                modified = True
                break

# 3. Fix Email Catch-All Patterns (near 4013)
for i in range(len(lines)):
    if 'loading ? <TableSkeleton columns={3} rows={3} />' in lines[i] and 'patterns.length > 0 && (' in lines[i]:
        for j in range(i+1, i+50):
            # The patterns list is a simplified one-line list
            if j < len(lines) and '</div>' in lines[j] and ')}' not in lines[j+1]:
                 print(f"Fixing Catch-All at L{j+1}")
                 lines[j] = lines[j].replace('</div>', '</div>\n        )}')
                 modified = True
                 break

if modified:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Success")
else:
    print("No changes found to apply")
