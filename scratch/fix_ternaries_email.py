import sys
import re

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def fix_sections():
    modified = False
    
    # We look for sections where we have {loading ? <...Skeleton ... /> : ... ? (
    # and ensure there's a )} before the next </div> or closing tag.
    
    # I'll specifically target the ones my previous script might have miscounted or missed.
    
    # 1. EmailLimitsSection (approx 3783)
    # 2. EmailForwardingSection (approx 3840)
    # 3. CatchAllEmailSection (approx 3895) - wait, this one uses : <input ... /> so it's closed.
    # 4. EmailChangePasswordSection (approx 4029) - closed.
    
    # Let's look for: {loading ? <TableSkeleton ... /> : emails.length > 0 ? (
    
    for i in range(len(lines)):
        line = lines[i]
        if '{loading ? <TableSkeleton' in line and '? (' in line:
            # Found one! Now find where it SHOULD end.
            # Usually it ends before a </div> that is followed by </div> or similar.
            # Or before the end of the return (
            
            # Let's find the closing </div> for this block.
            depth = 0
            for j in range(i + 1, len(lines)):
                if '<div' in lines[j]: depth += 1
                if '</div>' in lines[j]:
                    if depth == 0:
                        # This is the closing div of the parent block? 
                        # No, we need to find the specific point.
                        pass
                    depth -= 1
    
    # Actually, I'll use a more targeted approach.
    # I'll check the lines identified by grep.
    
    # L3815: {loading ? <TableSkeleton columns={2} rows={5} /> : emails.length > 0 ? (
    # L3861: {loading ? <TableSkeleton columns={2} rows={5} /> : emails.length > 0 ? (
    # L3918: {loading ? <TableSkeleton columns={2} rows={5} /> : emails.length > 0 ? (
    
    targets = [3815, 3861, 3918]
    # We need to adjust indices because of previous insertions.
    # But wait, did they shift?
    # I inserted at 3250 and 3299. So everything after 3300 is shifted by 2.
    
    # I'll search for the content instead.
    for i in range(len(lines)):
        if '{loading ? <TableSkeleton' in lines[i] and 'emails.length > 0 ? (' in lines[i]:
            # Find the next </div> that is alone on a line (or nearly)
            for j in range(i + 1, len(lines)):
                if '</div>' in lines[j] and ')}' not in lines[j] and ')}' not in lines[j-1]:
                    # Insert )}
                    lines.insert(j, '        )}\n')
                    print(f"Fixed ternary at line {i+1}, inserted at {j+1}")
                    modified = True
                    break
                    
    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Success")
    else:
        print("No changes needed")

fix_sections()
