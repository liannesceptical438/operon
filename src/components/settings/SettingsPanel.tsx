import { useState, useEffect, useCallback } from 'react';
import { X, Settings, Key, Trash2, LogIn, CheckCircle, Loader2, Wrench } from 'lucide-react';
import { SetupWizard } from '../setup/SetupWizard';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { AppSettings } from '../../lib/settings';
import { DEFAULT_SETTINGS } from '../../lib/settings';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'editor' | 'terminal' | 'claude' | 'auth' | 'setup'>(
    'editor',
  );
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; method: string } | null>(null);
  const [oauthChecking, setOauthChecking] = useState(false);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const status = await invoke<{ authenticated: boolean; method: string }>('check_auth_status');
      setAuthStatus(status);
    } catch {
      setAuthStatus({ authenticated: false, method: 'none' });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      invoke<AppSettings>('get_settings')
        .then(setSettings)
        .catch(() => setSettings(DEFAULT_SETTINGS));
      invoke<string | null>('get_api_key').then((key) => setHasKey(!!key));
      refreshAuthStatus();
    }
  }, [isOpen, refreshAuthStatus]);

  const saveSettings = useCallback(async (updated: AppSettings) => {
    setSaving(true);
    try {
      await invoke('update_settings', { settings: updated });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    setSaving(false);
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    await invoke('store_api_key', { key: apiKey.trim() });
    setHasKey(true);
    setApiKey('');
  };

  const handleDeleteApiKey = async () => {
    await invoke('delete_api_key');
    setHasKey(false);
  };

  if (!isOpen) return null;

  const sections = [
    { id: 'editor' as const, label: 'Editor' },
    { id: 'terminal' as const, label: 'Terminal' },
    { id: 'claude' as const, label: 'Claude' },
    { id: 'auth' as const, label: 'Authentication' },
    { id: 'setup' as const, label: 'Setup Wizard' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[700px] max-h-[80vh] bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[180px] border-r border-zinc-800 py-3">
          <div className="flex items-center gap-2 px-4 pb-3 border-b border-zinc-800">
            <Settings className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">Settings</span>
          </div>
          <div className="py-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-1.5 text-sm ${
                  activeSection === section.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>

          {activeSection === 'editor' && (
            <div className="space-y-5">
              <h3 className="text-sm font-medium text-zinc-200">Editor Settings</h3>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Font Size</span>
                <input
                  type="number"
                  value={settings.font_size}
                  onChange={(e) =>
                    saveSettings({ ...settings, font_size: parseInt(e.target.value) || 13 })
                  }
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 outline-none"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Tab Size</span>
                <input
                  type="number"
                  value={settings.tab_size}
                  onChange={(e) =>
                    saveSettings({ ...settings, tab_size: parseInt(e.target.value) || 2 })
                  }
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 outline-none"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Word Wrap</span>
                <input
                  type="checkbox"
                  checked={settings.word_wrap}
                  onChange={(e) => saveSettings({ ...settings, word_wrap: e.target.checked })}
                  className="w-4 h-4 accent-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Minimap</span>
                <input
                  type="checkbox"
                  checked={settings.minimap_enabled}
                  onChange={(e) =>
                    saveSettings({ ...settings, minimap_enabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Show Hidden Files</span>
                <input
                  type="checkbox"
                  checked={settings.show_hidden_files}
                  onChange={(e) =>
                    saveSettings({ ...settings, show_hidden_files: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-500"
                />
              </label>
            </div>
          )}

          {activeSection === 'terminal' && (
            <div className="space-y-5">
              <h3 className="text-sm font-medium text-zinc-200">Terminal Settings</h3>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Terminal Font Size</span>
                <input
                  type="number"
                  value={settings.terminal_font_size}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      terminal_font_size: parseInt(e.target.value) || 13,
                    })
                  }
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 outline-none"
                />
              </label>
            </div>
          )}

          {activeSection === 'claude' && (
            <div className="space-y-5">
              <h3 className="text-sm font-medium text-zinc-200">Claude Code Settings</h3>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Default Model</span>
                <select
                  value={settings.model}
                  onChange={(e) => saveSettings({ ...settings, model: e.target.value })}
                  className="w-56 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 outline-none"
                >
                  <option value="claude-sonnet-4-20250514">Sonnet 4</option>
                  <option value="claude-opus-4-20250514">Opus 4</option>
                  <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
                </select>
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Max Turns</span>
                <input
                  type="number"
                  value={settings.max_turns}
                  onChange={(e) =>
                    saveSettings({ ...settings, max_turns: parseInt(e.target.value) || 25 })
                  }
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 outline-none"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Max Budget (USD)</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.max_budget_usd}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      max_budget_usd: parseFloat(e.target.value) || 5.0,
                    })
                  }
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 outline-none"
                />
              </label>
            </div>
          )}

          {activeSection === 'setup' && (
            <div className="space-y-5">
              <h3 className="text-sm font-medium text-zinc-200">Setup & Installation</h3>
              <p className="text-sm text-zinc-400">
                Run the setup wizard to check and install dependencies for Claude Code on your local machine or remote HPC servers.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setShowSetupWizard(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors text-sm w-full justify-center"
                >
                  <Wrench className="w-4 h-4" />
                  Run Setup Wizard
                </button>

                <p className="text-xs text-zinc-600">
                  The wizard checks for Xcode CLI Tools and Claude Code, and can install any missing dependencies.
                </p>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">Remote Server Setup</h4>
                <p className="text-sm text-zinc-400 mb-3">
                  To install Claude Code on a remote HPC server, connect to the server via SSH first (using the SSH panel in the sidebar), then run:
                </p>
                <div className="bg-zinc-950 rounded-lg p-3 font-mono text-xs text-zinc-300">
                  <p className="text-zinc-500"># Install Claude Code (no Node.js required)</p>
                  <p>curl -fsSL https://claude.ai/install.sh | bash</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'auth' && (
            <div className="space-y-5">
              <h3 className="text-sm font-medium text-zinc-200">Authentication</h3>

              {/* Current status banner */}
              {authStatus && (
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  authStatus.authenticated
                    ? 'bg-green-900/10 border-green-800/30'
                    : 'bg-yellow-900/10 border-yellow-800/30'
                }`}>
                  {authStatus.authenticated ? (
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                  ) : (
                    <Key className="w-5 h-5 text-yellow-400 shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${authStatus.authenticated ? 'text-green-300' : 'text-yellow-300'}`}>
                      {authStatus.authenticated
                        ? authStatus.method === 'oauth'
                          ? 'Signed in with Anthropic account'
                          : 'Authenticated with API key'
                        : 'Not authenticated'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {authStatus.authenticated
                        ? authStatus.method === 'oauth'
                          ? 'Using your Max, Pro, or Team subscription'
                          : 'Using direct API billing'
                        : 'Choose a method below to connect to Claude'}
                    </p>
                  </div>
                </div>
              )}

              {/* Option 1: Anthropic Account (OAuth) */}
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <LogIn className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-zinc-200">Anthropic Account</span>
                  {authStatus?.method === 'oauth' && (
                    <span className="ml-auto text-[11px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-zinc-500 mb-3">
                  For Max, Pro &amp; Team subscribers. Runs <code className="bg-zinc-900 px-1 rounded text-zinc-400">claude login</code> in a terminal tab.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const terminalId = crypto.randomUUID();
                        await emit('open-login-terminal', {
                          terminalId,
                          title: 'Claude Login',
                          command: 'claude login',
                        });
                      } catch (err) {
                        console.error('Failed to launch login:', err);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-sm text-white transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {authStatus?.method === 'oauth' ? 'Re-authenticate' : 'Sign in'}
                  </button>
                  <button
                    onClick={async () => {
                      setOauthChecking(true);
                      await refreshAuthStatus();
                      setOauthChecking(false);
                    }}
                    disabled={oauthChecking}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 rounded text-sm text-zinc-300 transition-colors"
                  >
                    {oauthChecking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    {oauthChecking ? 'Checking...' : 'Verify login'}
                  </button>
                </div>
              </div>

              {/* Option 2: API Key */}
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-zinc-200">API Key</span>
                  {hasKey && (
                    <span className="ml-auto text-[11px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                      Configured
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-zinc-500 mb-3">
                  For direct API billing. Get your key from <span className="text-zinc-400">console.anthropic.com</span>.
                </p>

                {hasKey ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 flex-1">API key is stored in memory</span>
                    <button
                      onClick={() => { handleDeleteApiKey(); refreshAuthStatus(); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                      placeholder="sk-ant-..."
                      className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      onClick={() => { handleSaveApiKey().then(() => refreshAuthStatus()); }}
                      disabled={!apiKey.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 rounded text-sm text-white transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Setup Wizard Modal */}
      {showSetupWizard && (
        <SetupWizard
          mode="modal"
          onComplete={() => setShowSetupWizard(false)}
        />
      )}
    </div>
  );
}
