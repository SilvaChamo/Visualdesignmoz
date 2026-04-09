import sys

def audit_balanced(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    bracket_level = 0
    paren_level = 0
    in_string = False
    string_char = ""
    in_comment = False
    in_multiline_comment = False
    
    error_found = False
    
    for i, line in enumerate(lines):
        ln = i + 1
        j = 0
        while j < len(line):
            char = line[j]
            next_char = line[j+1] if j+1 < len(line) else ""
            
            if in_multiline_comment:
                if char == '*' and next_char == '/':
                    in_multiline_comment = False
                    j += 1
            elif in_comment:
                break # Rest of line is comment
            elif in_string:
                if char == '\\':
                    j += 1 # skip next char
                elif char == string_char:
                    in_string = False
            else:
                if char == '/' and next_char == '/':
                    in_comment = True
                    break
                elif char == '/' and next_char == '*':
                    in_multiline_comment = True
                    j += 1
                elif char in ['"', "'", '`']:
                    in_string = True
                    string_char = char
                elif char == '{':
                    bracket_level += 1
                elif char == '}':
                    bracket_level -= 1
                    if bracket_level < 0:
                        print(f"L{ln}: Extra closing brace at char {j}")
                        error_found = True
                        bracket_level = 0
                elif char == '(':
                    paren_level += 1
                elif char == ')':
                    paren_level -= 1
                    if paren_level < 0:
                        print(f"L{ln}: Extra closing parenthesis at char {j}")
                        error_found = True
                        paren_level = 0
            j += 1
        in_comment = False # Reset single line comment
        
    print(f"Final levels: bracket={bracket_level}, paren={paren_level}")

audit_balanced('/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx')
