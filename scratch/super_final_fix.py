import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Work from bottom up to avoid index shifting if we delete lines?
# No, I'll just be careful.

# Section 1: EmailAccountsSection (was approx 3815)
# L3818: remove
# L3825: remove
# L3826: remove (empty)
# L3827: fix
lines[3817] = "" # L3818 (0-indexed 3817)
lines[3824] = "" # L3825
lines[3825] = "" # L3826
lines[3826] = '        ) : selectedDomain ? <p className="text-sm text-gray-400 text-center py-8">No emails found.</p> : null}\n'

# Section 2: EmailLimitsSection (was approx 3862 in grep earlier, now shifted)
# I'll search for it.
for i in range(len(lines)):
    if 'export function EmailLimitsSection' in lines[i]:
        # Search for ternary start
        for j in range(i, i+50):
            if j < len(lines) and '{loading ? <TableSkeleton columns={2}' in lines[j] and 'emails.length > 0 ? (' in lines[j]:
                # Found it. Now find the bad inserts.
                for k in range(j+1, j+100):
                    if k < len(lines) and lines[k].strip() == ')}' and ') :' not in lines[k+1]:
                        lines[k] = ""
                    if k < len(lines) and ') : selectedDomain ? <p' in lines[k] and '}' not in lines[k]:
                        lines[k] = lines[k].strip() + '}\n'
                break

# Section 3: EmailForwardingSection
for i in range(len(lines)):
    if 'export function EmailForwardingSection' in lines[i]:
        for j in range(i, i+50):
            if j < len(lines) and '{loading ? <TableSkeleton columns={2}' in lines[j] and 'emails.length > 0 ? (' in lines[j]:
                for k in range(j+1, j+100):
                    if k < len(lines) and lines[k].strip() == ')}' and ') :' not in lines[k+1]:
                        lines[k] = ""
                    if k < len(lines) and ') : selectedDomain ? <p' in lines[k] and '}' not in lines[k]:
                        lines[k] = lines[k].strip() + '}\n'
                break

# Section 4: BackupManagerSection
# L5097 in audit earlier
for i in range(len(lines)):
    if 'export function BackupManagerSection' in lines[i]:
        for j in range(i, i+150):
            if j < len(lines) and '        )}' in lines[j] and '</div>' in lines[j+1]:
                # This one might be correct. Wait.
                # Line 5031: {!selectedDomain ? (
                # Line 5035: ) : loading ? (
                # Line 5039: ) : backups.length === 0 ? (
                # Line 5088: )}
                # Total: 3 ( and 1 { -> needs )} ? yes.
                pass

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines([l for l in lines if l != ""])

print("Success")
