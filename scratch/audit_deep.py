import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def audit_deep():
    bracket_level = 0
    paren_level = 0
    
    # We will track levels and print where it deviates or stays open at function ends
    
    current_func = None
    func_start_line = 0
    
    for i, line in enumerate(lines):
        line_no = i + 1
        
        # Detect start of export function
        if 'export function' in line:
            if current_func and (bracket_level != 0 or paren_level != 0):
                 print(f"!!! Error in function {current_func} (L{func_start_line}-L{line_no-1}): bracket={bracket_level}, paren={paren_level}")
            
            # Reset for new function
            current_func = line.split('function ')[1].split('(')[0]
            func_start_line = line_no
            bracket_level = 0
            paren_level = 0
            
        # Count characters in line (simplistic but mostly works for JSX)
        # We ignore strings and comments for more accuracy if needed, but let's start simple
        
        # Remove strings and comments for accuracy
        clean_line = line
        # Very crude string removal to avoid counting brackets in text
        if '"' in clean_line or "'" in clean_line or '`' in clean_line:
            # We skip complex logic for now and just count
            pass

        for char in clean_line:
            if char == '{': bracket_level += 1
            elif char == '}': bracket_level -= 1
            elif char == '(': paren_level += 1
            elif char == ')': paren_level -= 1
            
    # Final check
    if current_func and (bracket_level != 0 or paren_level != 0):
        print(f"!!! Error in function {current_func} (L{func_start_line}-L{len(lines)}): bracket={bracket_level}, paren={paren_level}")

audit_deep()
