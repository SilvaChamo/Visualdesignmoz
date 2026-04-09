import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def fix_all():
    # We want to remove all "        )}" lines that are redundant.
    # A line is redundant if it doesn't close a specific ternary we want.
    
    # Let's start by removing ALL "        )}" lines that I inserted.
    # I'll identify them by the exact content "        )}\n"
    
    new_lines = []
    removed_count = 0
    
    for line in lines:
        if line == "        )}\n":
            removed_count += 1
            continue # Skip it for now
        new_lines.append(line)
    
    print(f"Removed {removed_count} potentially redundant closing lines.")
    
    # Now, we manually re-insert ONLY in the 4 areas we KNOW need them.
    # 1. SuspenderWebsiteSection
    # 2. DeleteWebsiteSection
    # 3. EmailAccountsSection
    # 4. EmailLimitsSection
    # 5. EmailForwardingSection
    # 6. BackupManagerSection
    
    # I'll do this by searching for the end of the lists in those sections.
    
    current_lines = new_lines
    final_lines = []
    
    i = 0
    while i < len(current_lines):
        line = current_lines[i]
        final_lines.append(line)
        
        # Suspender / Delete
        if '))}</tbody>' in line and (i+1 < len(current_lines) and '</table>' in current_lines[i+1]):
            # Check if this is one of our sections
            # We look back for titles
            found_title = False
            for j in range(max(0, i-100), i):
                if 'Suspender e Activar Websites' in current_lines[j] or 'export function DeleteWebsiteSection' in current_lines[j]:
                    found_title = True
                    break
            if found_title:
                final_lines.append(current_lines[i+1])
                final_lines.append('        )}\n')
                print(f"Re-inserted closing at table end (Line {i+1})")
                i += 1 # skip table line
        
        # Email sections
        elif '))}</div>' in line:
            found_email_title = False
            for j in range(max(0, i-100), i):
                if 'EmailAccountsSection' in current_lines[j] or 'EmailLimitsSection' in current_lines[j] or 'EmailForwardingSection' in current_lines[j]:
                    found_email_title = True
                    break
            if found_email_title:
                final_lines.append('        )}\n')
                print(f"Re-inserted closing at email list end (Line {i+1})")
        
        # Backup section
        elif '))}</tbody>' in line and (i+1 < len(current_lines) and '</table>' in current_lines[i+1]):
             # Check for Backup title
             for j in range(max(0, i-150), i):
                if 'export function BackupManagerSection' in current_lines[j]:
                    final_lines.append(current_lines[i+1])
                    final_lines.append('        )}\n')
                    print(f"Re-inserted closing at backup table end (Line {i+1})")
                    i += 1
                    break
        i += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
    print("Success")

fix_all()
