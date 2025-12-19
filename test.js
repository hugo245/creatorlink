import React, { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Code } from 'lucide-react';

export default function LuaDeobfuscator() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const deobfuscationPatterns = [
    {
      pattern: /\("([^"]+)"\s*\.\.\s*"([^"]+)"\)/g,
      replace: (match, p1, p2) => `"${p1}${p2}"`,
      name: 'String Concatenation'
    },
    {
      pattern: /\\x([0-9A-Fa-f]{2})/g,
      replace: (match, p1) => String.fromCharCode(parseInt(p1, 16)),
      name: 'Hex Strings'
    },
    {
      pattern: /\\u\{([0-9A-Fa-f]+)\}/g,
      replace: (match, p1) => String.fromCharCode(parseInt(p1, 16)),
      name: 'Unicode Escapes'
    },
    {
      pattern: /string\.char\((\d+(?:\s*,\s*\d+)*)\)/g,
      replace: (match, p1) => {
        const codes = p1.split(',').map(n => parseInt(n.trim()));
        return '"' + codes.map(c => String.fromCharCode(c)).join('') + '"';
      },
      name: 'String.char'
    },
    {
      pattern: /\[(['"])(.+?)\1\]\s*=/g,
      replace: (match, quote, key) => {
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          return `${key} =`;
        }
        return match;
      },
      name: 'Table Keys'
    },
    {
      pattern: /\(([a-zA-Z_][a-zA-Z0-9_]*)\)/g,
      replace: '$1',
      name: 'Excess Parentheses'
    }
  ];

  const renameVariables = (code) => {
    const varMap = new Map();
    const upvaluePattern = /\b(v_u_|p_u_)(\d+)\b/g;
    let match;
    const upvalues = new Set();

    while ((match = upvaluePattern.exec(code)) !== null) {
      upvalues.add(match[0]);
    }

    upvalues.forEach(upval => {
      if (upval.startsWith('v_u_')) {
        const num = upval.match(/\d+/)[0];
        varMap.set(upval, `upval_${num}`);
      } else if (upval.startsWith('p_u_')) {
        const num = upval.match(/\d+/)[0];
        varMap.set(upval, `param_${num}`);
      }
    });

    let result = code;
    varMap.forEach((newName, oldName) => {
      const regex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      result = result.replace(regex, newName);
    });

    return result;
  };

  const beautifyLua = (code) => {
    let beautified = code;
    let indent = 0;
    const lines = beautified.split('\n');
    const result = [];

    for (let line of lines) {
      const trimmed = line.trim();

      if (trimmed.match(/^(end|else|elseif|until)/)) {
        indent = Math.max(0, indent - 1);
      }

      if (trimmed) {
        result.push('  '.repeat(indent) + trimmed);
      } else {
        result.push('');
      }

      if (trimmed.match(/\b(function|if|for|while|repeat|do)\b/) && !trimmed.match(/\bend\b/)) {
        indent++;
      }
      if (trimmed.match(/\belse\b/) || trimmed.match(/\belseif\b/)) {
        indent++;
      }
      if (trimmed.match(/\bend\b/)) {
        indent = Math.max(0, indent - 1);
      }
    }

    return result.join('\n');
  };

  const deobfuscate = () => {
    setIsProcessing(true);
    setStatus('Processing...');

    setTimeout(() => {
      try {
        let result = input;
        const appliedPatterns = [];

        const beforeRename = result;
        result = renameVariables(result);
        if (beforeRename !== result) {
          appliedPatterns.push('Variable Renaming');
        }

        for (const pattern of deobfuscationPatterns) {
          const before = result;
          result = result.replace(pattern.pattern, pattern.replace);
          if (before !== result) {
            appliedPatterns.push(pattern.name);
          }
        }

        result = result.replace(/\s+\n/g, '\n');
        result = result.replace(/\n{3,}/g, '\n\n');

        result = beautifyLua(result);

        setOutput(result);

        if (appliedPatterns.length > 0) {
          setStatus(`✓ Deobfuscation complete! Applied: ${appliedPatterns.join(', ')}`);
        } else {
          setStatus('⚠ No common obfuscation patterns detected. Code may already be deobfuscated or use custom obfuscation.');
        }
      } catch (error) {
        setStatus(`✗ Error: ${error.message}`);
        setOutput('');
      } finally {
        setIsProcessing(false);
      }
    }, 300);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setInput(event.target.result);
        setStatus('File loaded successfully');
      };
      reader.readAsText(file);
    }
  };

  const downloadOutput = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deobfuscated.lua';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setStatus('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-purple-500/20 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Code className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Lua Bytecode Deobfuscator</h1>
          </div>

          <p className="text-slate-300 mb-6">
            Analyze and deobfuscate Lua code with common obfuscation techniques including string concatenation,
            hex encoding, unicode escapes, and more.
          </p>

          {status && (
            <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
              status.startsWith('✓') ? 'bg-green-500/20 border border-green-500/50' :
              status.startsWith('⚠') ? 'bg-yellow-500/20 border border-yellow-500/50' :
              status.startsWith('✗') ? 'bg-red-500/20 border border-red-500/50' :
              'bg-blue-500/20 border border-blue-500/50'
            }`}>
              {status.startsWith('✓') ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" /> :
               <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />}
              <span className="text-slate-200">{status}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Input (Obfuscated Lua)</label>
                <label className="cursor-pointer text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  Upload File
                  <input type="file" accept=".lua,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your obfuscated Lua code here..."
                className="w-full h-96 bg-slate-900/50 text-slate-200 border border-slate-700 rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Output (Deobfuscated)</label>
                {output && (
                  <button
                    onClick={downloadOutput}
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
              </div>
              <textarea
                value={output}
                readOnly
                placeholder="Deobfuscated code will appear here..."
                className="w-full h-96 bg-slate-900/50 text-slate-200 border border-slate-700 rounded-lg p-4 font-mono text-sm focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={deobfuscate}
              disabled={!input || isProcessing}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isProcessing ? 'Processing...' : 'Deobfuscate'}
            </button>
            <button
              onClick={clearAll}
              className="bg-slate-700 text-slate-200 font-semibold py-3 px-6 rounded-lg hover:bg-slate-600 transition-all duration-200"
            >
              Clear All
            </button>
          </div>

          <div className="mt-8 p-4 bg-slate-900/30 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Supported Obfuscation Patterns:</h3>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• String concatenation</li>
              <li>• Hex escape sequences</li>
              <li>• Unicode escapes</li>
              <li>• string.char conversions</li>
              <li>• Table key obfuscation</li>
              <li>• Variable renaming (v_u_X to upval_X, p_u_X to param_X)</li>
              <li>• Code beautification and formatting</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}