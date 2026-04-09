import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def fix_skeletons():
    modified = False
    
    # We find every occurrence of a skeleton ternary that isn't closed.
    # Pattern: {loading ? <...Skeleton ... /> : ... ? (
    # Or generically: ... ? (
    
    # Actually, I'll just check allsections that use skeletons.
    
    # Let's count the bracket/paren level as we go.
    bracket_level = 0
    paren_level = 0
    
    result_lines = []
    
    for i, line in enumerate(lines):
        result_lines.append(line)
        
        # Track levels roughly (ignoring strings for now as it's a JSX heavy file)
        # Handle only the ones we care about
        if '{loading ? <' in line and '? (' in line:
            # Plan to close it later
            pass
            
        # If we see the end of a block like </div> and we are at bracket/paren level > 0
        # for a function, we might need to close.
        
    # Better approach: I'll use the previous list of sections and fix them one by one.
    
    sections = [
        "WebsitePreviewSection",
        "EmailManagementSection",
        "WPListSection",
        "SuspenderWebsiteSection",
        "DeleteWebsiteSection",
        "EmailAccountsSection",
        "EmailLimitsSection",
        "EmailForwardingSection",
        "BackupManagerSection",
        "SecuritySection",
        "DomainManagerSection",
        "FileManagerSection",
        "WPPluginsSection",
        "GitDeploySection"
    ]
    
    # I'll re-run my first fix script but MORE CAREFULLY.
    # I'll only insert at the VERY END of the JSX return block of each function if unclosed.
    
    # Actually, I'll just manually fix the 16 missing ones easily.
    # 1. Subdomains in WebsitesSection
    # 2. Users in ClientesSection
    # 3. Email accounts in EmailManagement
    # etc.
    
    # I'll use a script to find all ? ( and check if there is a )} after.
    
    final_output = []
    for i in range(len(lines)):
        line = lines[i]
        final_output.append(line)
        if ('? (' in line and '{' in line and 'loading' in line) or (i > 0 and '? (' in line and 'loading' in lines[i-1]):
            # Needs a )} later.
            # Find the end of this block.
            # We look for the next line that is just </div> before </div> or end of function.
            
            # This is hard to automate perfectly. 
            # I'll just use a list of lines from grep and fix them.
            pass

fix_skeletons()
