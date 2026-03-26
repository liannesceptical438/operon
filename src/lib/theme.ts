import { loader } from '@monaco-editor/react';

let themeRegistered = false;

export function registerMonacoTheme() {
  if (themeRegistered) return;
  themeRegistered = true;

  loader.init().then((monaco) => {
    monaco.editor.defineTheme('operon-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'fafafa', background: '09090b' },
        { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'keyword.control', foreground: 'c084fc' },
        { token: 'string', foreground: '4ade80' },
        { token: 'string.escape', foreground: '22d3ee' },
        { token: 'number', foreground: 'fb923c' },
        { token: 'type', foreground: '38bdf8' },
        { token: 'type.identifier', foreground: '38bdf8' },
        { token: 'function', foreground: '60a5fa' },
        { token: 'function.declaration', foreground: '60a5fa' },
        { token: 'variable', foreground: 'fafafa' },
        { token: 'variable.predefined', foreground: 'f472b6' },
        { token: 'constant', foreground: 'fb923c' },
        { token: 'tag', foreground: 'f87171' },
        { token: 'attribute.name', foreground: 'facc15' },
        { token: 'attribute.value', foreground: '4ade80' },
        { token: 'delimiter', foreground: 'a1a1aa' },
        { token: 'operator', foreground: 'a1a1aa' },
      ],
      colors: {
        'editor.background': '#09090b',
        'editor.foreground': '#fafafa',
        'editor.lineHighlightBackground': '#18181b',
        'editor.selectionBackground': '#3f3f4680',
        'editor.inactiveSelectionBackground': '#3f3f4640',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#a1a1aa',
        'editorCursor.foreground': '#fafafa',
        'editorIndentGuide.background': '#27272a',
        'editorIndentGuide.activeBackground': '#3f3f46',
        'editorBracketMatch.background': '#3f3f4660',
        'editorBracketMatch.border': '#71717a',
        'editor.findMatchBackground': '#eab30840',
        'editor.findMatchHighlightBackground': '#eab30820',
        'editorWidget.background': '#18181b',
        'editorWidget.border': '#27272a',
        'editorSuggestWidget.background': '#18181b',
        'editorSuggestWidget.border': '#27272a',
        'editorSuggestWidget.selectedBackground': '#27272a',
        'editorHoverWidget.background': '#18181b',
        'editorHoverWidget.border': '#27272a',
        'minimap.background': '#09090b',
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': '#3f3f4640',
        'scrollbarSlider.hoverBackground': '#3f3f4680',
        'scrollbarSlider.activeBackground': '#3f3f46a0',
      },
    });
  });
}
