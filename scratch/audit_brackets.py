import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

def audit_brackets(content):
    lines = content.split('\n')
    stack = []
    
    # Simple function-level auditor
    in_function = False
    func_name = ""
    bracket_count = 0 # { }
    paren_count = 0   # ( )
    
    for i, line in enumerate(lines):
        ln = i + 1
        
        if 'export function' in line:
            if in_function and bracket_count != 0:
                print(f"L{ln}: WARNING: New function started but previous function {func_name} has bracket_count={bracket_count}")
            in_function = True
            func_name = line.split('function')[1].split('(')[0].strip()
            bracket_count = 0
            paren_count = 0
            
        # Count in line
        # This is very rough because it doesn't handle strings/regex
        # But for our current situation (unclosed ternaries in JSX), it might help.
        
        # Strip comments
        code = line.split('//')[0]
        
        for char in code:
            if char == '{': bracket_count += 1
            if char == '}': bracket_count -= 1
            if char == '(': paren_count += 1
            if char == ')': paren_count -= 1
            
        if in_function and bracket_count == 0 and '}' in line:
            # End of function?
            if paren_count != 0:
                print(f"L{ln}: ERROR in {func_name}: bracket_count reached 0 but paren_count is {paren_count}")
            in_function = False

audit_brackets(content)
