import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

modified = False

# 1. Revert accidental change at line 5966+
for i in range(len(lines)):
    if i+2 < len(lines) and '{d.limit && (' in lines[i] and 'setEditingEmail(d.email)' in lines[i+1]:
        print(f"Removing accidental insert at L{i+1}")
        lines[i] = ""
        lines[i+1] = ""
        lines[i+2] = ""
        modified = True

# 2. Fix the REAL issue in EmailLimitsSection
for i in range(len(lines)):
    if 'export function EmailLimitsSection' in lines[i]:
        for j in range(i, i+100):
            if j < len(lines) and 'editingEmail === em.email ? (' in lines[j]:
                for k in range(j+1, j+50):
                    if k < len(lines) and ') : (' in lines[k]:
                        if ')}' in lines[k+1] and 'button' not in lines[k+1]:
                            print(f"Restoring button and fixing syntax at L{k+1}")
                            lines[k+1] = '                <button onClick={() => { setEditingEmail(em.email); setLimit(\'500\') }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md font-medium">Set Limit</button>\n              )}\n'
                            modified = True
                        elif 'button' in lines[k+1] and ')}' not in lines[k+2]:
                            print(f"Adding missing )}} at L{k+2}")
                            lines.insert(k+2, '              )}\n')
                            modified = True
                        break
                break

if modified:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines([l for l in lines if l != ""])
    print("Success")
else:
    print("No changes found to apply")
