import { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { detectLanguage } from './CodeEditor';

interface DiffViewerProps {
  filePath: string;
  original: string;
  modified: string;
  onAccept?: () => void;
  onReject?: () => void;
}

export function DiffViewer({
  filePath,
  original,
  modified,
  onAccept,
  onReject,
}: DiffViewerProps) {
  const [sideBySide, setSideBySide] = useState(true);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 truncate">{filePath}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSideBySide((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-800"
          >
            {sideBySide ? 'Inline' : 'Side by Side'}
          </button>
          {onReject && (
            <button
              onClick={onReject}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-zinc-800"
            >
              Reject
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              className="text-xs text-green-400 hover:text-green-300 px-2 py-0.5 rounded bg-zinc-800"
            >
              Accept
            </button>
          )}
        </div>
      </div>

      {/* Diff Editor */}
      <div className="flex-1">
        <DiffEditor
          height="100%"
          original={original}
          modified={modified}
          language={detectLanguage(filePath)}
          theme="operon-dark"
          options={{
            readOnly: true,
            renderSideBySide: sideBySide,
            enableSplitViewResizing: true,
            ignoreTrimWhitespace: false,
            renderIndicators: true,
            originalEditable: false,
            automaticLayout: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
