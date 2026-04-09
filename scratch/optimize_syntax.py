import sys

file_path = '/Users/macbook/Desktop/APP/visualdesign/src/app/admin/CyberPanelSections.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def optimize_syntax():
    # We will target specific blocks and rewrite them to be clean.
    
    # 1. EmailCatchAllSection (approx 4013)
    for i in range(len(lines)):
        if 'export function EmailCatchAllSection' in lines[i]:
            for j in range(i, i+50):
                if j < len(lines) and 'loading ? <TableSkeleton columns={3} rows={3} />' in lines[j]:
                    # Replace the whole block until end of function
                    for k in range(j+1, j+50):
                        if k < len(lines) and 'export function' in lines[k]:
                             # Found end. Now we fix everything between j and k.
                             new_block = [
                                '        {loading ? <TableSkeleton columns={3} rows={3} /> : patterns.length > 0 && (\n',
                                '          <div className="space-y-2">{patterns.map((p, i) => (\n',
                                '            <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">\n',
                                '              <span className="font-mono">{p.pattern || p.source}</span>\n',
                                '              <ArrowRight className="w-4 h-4 text-gray-400" />\n',
                                '              <span>{p.destination || p.target}</span>\n',
                                '            </div>\n',
                                '          ))}</div>\n',
                                '        )}\n',
                                '      </div>\n',
                                '    </div>\n',
                                '  )\n',
                                '}\n'
                             ]
                             # We'll replace lines from j to k-1 (or just before export)
                             # Let's find exactly where the function ends.
                             func_end = j
                             for m in range(j, k):
                                 if 'return (' in lines[m]:
                                     # Not this one
                                     pass
                             # Actually it's easier to just find the '  )' and '}' before 'export'
                             pass
    
    # Actually, a simpler way is to REWRITE the problematic sections fully.
    # I have the correct versions in my mind.
    pass

# I'll use a more direct approach: identify the mess and replace it with a clean block.

# Block A: EmailCatchAllSection
target_a = """        {loading ? <TableSkeleton columns={3} rows={3} /> : patterns.length > 0 && (
          <div className="space-y-2">{patterns.map((p, i) => <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm"><span className="font-mono">{p.pattern || p.source}</span><ArrowRight className="w-4 h-4 text-gray-400" /><span>{p.destination || p.target}</span></div>
        )})}</div>
        )}
      </div>"""

replacement_a = """        {loading ? <TableSkeleton columns={3} rows={3} /> : patterns.length > 0 && (
          <div className="space-y-2">
            {patterns.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                <span className="font-mono">{p.pattern || p.source}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span>{p.destination || p.target}</span>
              </div>
            ))}
          </div>
        )}
      </div>"""

# Block B: DKIMManagerSection
target_b = """          <div>
            <p className="text-sm mb-2">Status: <span className={`font-bold ${dkim.enabled ? 'text-green-600' : 'text-red-600'}`}>{dkim.enabled ? 'Enabled' : 'Disabled'}</span></p>
            {dkim.record && <div className="bg-gray-50 border border-gray-200 rounded-lg p-3"><p className="text-xs font-bold text-gray-600 uppercase mb-1">DKIM Record</p><code className="text-xs font-mono text-gray-700 break-all">{dkim.record}</code></div>}
          </div>
      </div>"""

replacement_b = """          <div>
            <p className="text-sm mb-2">Status: <span className={`font-bold ${dkim.enabled ? 'text-green-600' : 'text-red-600'}`}>{dkim.enabled ? 'Enabled' : 'Disabled'}</span></p>
            {dkim.record && <div className="bg-gray-50 border border-gray-200 rounded-lg p-3"><p className="text-xs font-bold text-gray-600 uppercase mb-1">DKIM Record</p><code className="text-xs font-mono text-gray-700 break-all">{dkim.record}</code></div>}
          </div>
        )}
      </div>"""

# Apply
content = "".join(lines)
if target_a in content:
    content = content.replace(target_a, replacement_a)
    print("Fixed CatchAll")
if target_b in content:
    content = content.replace(target_b, replacement_b)
    print("Fixed DKIM")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Success")
