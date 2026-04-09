import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def fix_all_deep():
    # We will use the audit results to fix each function
    
    # 1. DNSZoneEditorSection (L457-L1215) -> 1/1
    # We look for where it should end
    for i in range(457, 1215):
        if i < len(lines) and '      </div>\n' == lines[i] and '    </div>\n' == lines[i+1]:
             # This is usually the end of return. We add )} before it if needed.
             # Actually, we need to find the SPECIFIC skeleton block.
             pass

    # A better way is to find the opening ? ( and close it at the end of its div container.
    
    modified = False
    
    # List of targets based on my grep results and audit
    
    # 2624 PHPConfigs -- wait, audit didn't say it's broken? Ah, maybe it's 0/0 but wrong.
    
    # I'll just use the grep results as "potential starts" and audit as "confirmer"
    
    targets = [
        ("DNSZoneEditorSection", 1, 1),
        ("DatabasesSection", 2, 2),
        ("FTPSection", 1, 1),
        ("EmailManagementSection", 1, 1),
        ("CPUsersSection", 1, 1),
        ("ResellerSection", 1, 1),
        ("GitDeploySection", 4, 4),
        ("PackagesSection", 2, 2),
        ("WPBackupSection", 2, 2)
    ]
    
    for func_name, b_needed, p_needed in targets:
        print(f"Fixing {func_name}...")
        found = False
        for i in range(len(lines)):
            if f'export function {func_name}' in lines[i]:
                # Find the return end
                for j in range(i+20, i+800):
                    if j+2 < len(lines) and lines[j].strip() == '</div>' and lines[j+1].strip() == '</div>' and lines[j+2].strip() == ')':
                        # Insert needed )}
                        print(f"  Found end at L{j+1}")
                        suffix = "        " + "}" * b_needed + "\n" # This is crude. 
                        # Actually most need )}
                        # Let's be smarter.
                        
                        # Fix DNSZoneEditor (L1018 start)
                        if func_name == "DNSZoneEditorSection":
                             # Look for the end of the table
                             for k in range(i, j):
                                 if '</table>' in lines[k] and ')}' not in lines[k+1]:
                                     lines[k] = lines[k].replace('</table>', '</table>\n        )}')
                                     modified = True
                                     break
                        
                        # Fix CPUsersSection
                        if func_name == "CPUsersSection":
                             for k in range(i, j):
                                 if '</table>' in lines[k] and ')}' not in lines[k+1]:
                                     lines[k] = lines[k].replace('</table>', '</table>\n        )}')
                                     modified = True
                                     break
                        
                        # Fix GitDeploy
                        if func_name == "GitDeploySection":
                             # It has 4/4! 
                             # 4265, 4284, 4296, 4359
                             # I'll just re-add 4 closing lines
                             lines[j] = '        )}\n        )}\n        )}\n        )}\n' + lines[j]
                             modified = True
                        
                        # General case for 1/1 at end of main div
                        if b_needed == 1 and not modified:
                             lines[j] = '        )}\n' + lines[j]
                             modified = True
                        
                        break
                break

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Success")
    else:
        print("No changes applied")

fix_all_deep()
