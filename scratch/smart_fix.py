import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def fix_mismatches():
    # Targets from audit_deep:
    # DNSZoneEditor: -1 / -1
    # Databases: 1 / 1
    # FTP: -1 / -1
    # EmailManagement: -1 / -1
    # CPUsers: -1 / -1
    # Reseller: -1 / -1
    # GitDeploy: -4 / -4
    # Packages: 2 / 2
    # WPBackup: 2 / 2
    
    # We will use simple string replacement for these specific issues in the functions
    
    content = "".join(lines)
    
    # Fix GitDeploy (it has 4 extra )})
    bad_git = """      </div>
        )}
        )}
        )}
        )}
    </div>"""
    good_git = """      </div>
    </div>"""
    if bad_git in content:
        content = content.replace(bad_git, good_git)
        print("Fixed GitDeploy")
        
    # Fix others that have -1/-1 (Remove one )} )
    # We'll search for the functions and remove the )} we added
    
    # DNSZoneEditor
    if 'DNSZoneEditorSection' in content:
        # It has an extra )} at the end
        # We find the end of the function
        pass

    # Actually, the best way to fix all is to use the audit_deep.py logic to find the errors 
    # and immediately fix them by adding or removing from the line before the function ends.
    
    new_lines = content.split('\n')
    
    def get_balance(func_lines):
        b, p = 0, 0
        for l in func_lines:
            for c in l:
                if c == '{': b += 1
                elif c == '}': b -= 1
                elif c == '(': p += 1
                elif c == ')': p -= 1
        return b, p

    # Identificamos as funções
    output_lines = []
    i = 0
    while i < len(new_lines):
        line = new_lines[i]
        if 'export function ' in line:
            # Found a function. Read until end (next export or EOF)
            func_lines = [line]
            j = i + 1
            while j < len(new_lines) and 'export function ' not in new_lines[j]:
                func_lines.append(new_lines[j])
                j += 1
            
            # Audit this function
            b, p = get_balance(func_lines)
            if b != 0 or p != 0:
                print(f"Fixing {line.strip()} (b={b}, p={p})")
                # Find the '  )' and '}' at the end
                for k in range(len(func_lines)-1, 0, -1):
                    if func_lines[k].strip() == '}' and func_lines[k-1].strip() == ')':
                        # We adjust the line before ')'
                        if b > 0: # Need to add closings
                             for _ in range(b):
                                 func_lines[k-2] += '\n        )}'
                        elif b < 0: # Need to remove closings
                             for _ in range(abs(b)):
                                 if '        )}' in func_lines[k-2]:
                                     func_lines[k-2] = func_lines[k-2].replace('        )}', '', 1)
                                 elif ')}' in func_lines[k-1]: # Maybe on the same line
                                     pass
                        break
            output_lines.extend(func_lines)
            i = j
        else:
            output_lines.append(line)
            i += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))
    print("Success")

fix_mismatches()
