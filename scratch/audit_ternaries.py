import sys

def check_unclosed(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple stack-based tracker for JSX vs JS context
    # This is hard because of the complexity of the file
    # We'll look specifically for the patterns we introduced
    
    lines = content.split('\n')
    stack = []
    
    # We want to find ternary patterns starting with { and (
    # e.g. {loading ? (
    # and check if they are closed.
    
    for i, line in enumerate(lines):
        ln = i + 1
        # Look for the start of our pattern
        if '? (' in line and '{' in line:
            # Possible start of a ternary loading state
            print(f"L{ln}: Potential unclosed ternary: {line.strip()}")
        if ') : (' in line:
            print(f"L{ln}: Middle of ternary: {line.strip()}")

check_unclosed('/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx')
