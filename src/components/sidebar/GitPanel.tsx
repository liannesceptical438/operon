import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  RefreshCw,
  Upload,
  Github,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Tag,
  Plus,
  FileEdit,
  FilePlus,
  FileQuestion,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LogIn,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useProject } from '../../context/ProjectContext';

// ── Types matching Rust structs ──

interface GitStatus {
  is_repo: boolean;
  branch: string;
  changed_files: number;
  staged_files: number;
  untracked_files: number;
  ahead: number;
  behind: number;
  remote_url: string;
  has_remote: boolean;
  last_commit_message: string;
  last_commit_time: string;
}

interface GhAuthStatus {
  installed: boolean;
  authenticated: boolean;
  username: string;
  scopes: string;
}

interface VersionInfo {
  current: string;
  next_patch: string;
  next_minor: string;
  next_major: string;
  total_commits: number;
}

// ── Component ──

export function GitPanel() {
  const { projectPath } = useProject();

  // State
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [ghAuth, setGhAuth] = useState<GhAuthStatus | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [autoVersion, setAutoVersion] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [ghSetupStep, setGhSetupStep] = useState<'idle' | 'installing' | 'logging-in' | 'creating-repo'>('idle');
  const [loginCode, setLoginCode] = useState<string | null>(null);

  // ── Data loading ──

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const [status, auth] = await Promise.all([
        invoke<GitStatus>('git_status', { projectPath }),
        invoke<GhAuthStatus>('gh_check_auth'),
      ]);
      setGitStatus(status);
      setGhAuth(auth);

      if (status.is_repo) {
        try {
          const ver = await invoke<VersionInfo>('git_version_info', { projectPath });
          setVersionInfo(ver);
        } catch {
          setVersionInfo(null);
        }
      }
    } catch (err) {
      console.error('Git refresh failed:', err);
    }
    setLoading(false);
  }, [projectPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Actions ──

  const initRepo = async () => {
    if (!projectPath) return;
    try {
      await invoke('git_init', { projectPath });
      setStatusMessage({ type: 'success', text: 'Git repository initialized!' });
      refresh();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Init failed: ${err}` });
    }
  };

  const installGh = async () => {
    setGhSetupStep('installing');
    try {
      await invoke('gh_install');
      setStatusMessage({ type: 'success', text: 'GitHub CLI installed!' });
      refresh();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `${err}` });
    }
    setGhSetupStep('idle');
  };

  // Listen for gh login events (one-time code + completion)
  useEffect(() => {
    const unlistenCode = listen<string>('gh-login-code', (event) => {
      setLoginCode(event.payload);
    });
    const unlistenDone = listen<boolean>('gh-login-done', (event) => {
      setLoginCode(null);
      setGhSetupStep('idle');
      if (event.payload) {
        setStatusMessage({ type: 'success', text: 'Logged in to GitHub!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Login was not completed. Please try again.' });
      }
      refresh();
    });
    return () => {
      unlistenCode.then((u) => u());
      unlistenDone.then((u) => u());
    };
  }, [refresh]);

  const loginGh = async () => {
    setGhSetupStep('logging-in');
    setLoginCode(null);
    try {
      const result = await invoke<string>('gh_login');
      if (result === 'ALREADY_AUTHED') {
        setStatusMessage({ type: 'success', text: 'Already logged in to GitHub!' });
        setGhSetupStep('idle');
        refresh();
      }
      // If LOGIN_STARTED, the event listeners above will handle the rest
    } catch (err) {
      setStatusMessage({ type: 'error', text: `${err}` });
      setGhSetupStep('idle');
    }
  };

  const createRepo = async () => {
    if (!projectPath) return;
    setGhSetupStep('creating-repo');
    try {
      const folderName = projectPath.split('/').pop() || 'my-project';
      await invoke<string>('gh_create_repo', {
        projectPath,
        repoName: folderName,
        private: true,
        description: '',
      });
      setStatusMessage({ type: 'success', text: `Repository "${folderName}" created on GitHub!` });
      refresh();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `${err}` });
    }
    setGhSetupStep('idle');
  };

  const publish = async () => {
    if (!projectPath) return;
    const message = publishMessage.trim() || `Update ${new Date().toLocaleDateString()}`;
    setPublishing(true);
    setStatusMessage(null);
    try {
      const result = await invoke<string>('git_publish', {
        projectPath,
        message,
        autoVersion,
      });
      setStatusMessage({ type: 'success', text: result });
      setPublishMessage('');
      refresh();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `${err}` });
    }
    setPublishing(false);
  };

  // Auto-dismiss status messages
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // ── Render helpers ──

  const totalChanges = (gitStatus?.changed_files || 0) + (gitStatus?.staged_files || 0) + (gitStatus?.untracked_files || 0);

  if (!projectPath) {
    return (
      <div className="flex flex-col h-full bg-zinc-900">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-zinc-500 text-sm text-center">Open a project folder to use Git</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-zinc-900">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Not a git repo yet → offer to init ──
  if (!gitStatus?.is_repo) {
    return (
      <div className="flex flex-col h-full bg-zinc-900">
        <Header onRefresh={refresh} />
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <GitBranch className="w-10 h-10 text-zinc-600" />
          <p className="text-zinc-400 text-sm text-center">
            This folder isn't a Git repository yet.
          </p>
          <button
            onClick={initRepo}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Initialize Repository
          </button>
        </div>
        <StatusToast message={statusMessage} />
      </div>
    );
  }

  // ── GitHub not set up → guided setup ──
  const needsGhSetup = !ghAuth?.installed || !ghAuth?.authenticated || !gitStatus?.has_remote;

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <Header onRefresh={refresh} />

      <div className="flex-1 overflow-y-auto">
        {/* Branch info */}
        <div className="px-3 py-2 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-sm text-zinc-200 font-medium">{gitStatus.branch || 'main'}</span>
            {gitStatus.ahead > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">
                ↑{gitStatus.ahead}
              </span>
            )}
            {gitStatus.behind > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300">
                ↓{gitStatus.behind}
              </span>
            )}
          </div>
          {gitStatus.last_commit_message && (
            <p className="text-[11px] text-zinc-500 mt-1 truncate">
              {gitStatus.last_commit_message} · {gitStatus.last_commit_time}
            </p>
          )}
        </div>

        {/* GitHub setup guide */}
        {needsGhSetup && (
          <div className="px-3 py-3 border-b border-zinc-800/50">
            <div className="bg-zinc-800/60 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-zinc-300" />
                <span className="text-xs font-semibold text-zinc-300">Connect to GitHub</span>
              </div>

              {/* Step 1: Install gh CLI */}
              <SetupStep
                number={1}
                label="GitHub CLI"
                done={ghAuth?.installed ?? false}
                active={!ghAuth?.installed}
              >
                {!ghAuth?.installed && (
                  <button
                    onClick={installGh}
                    disabled={ghSetupStep !== 'idle'}
                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded text-xs text-zinc-200 transition-colors"
                  >
                    {ghSetupStep === 'installing' ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Installing...</>
                    ) : (
                      <><Download className="w-3 h-3" /> Install GitHub CLI</>
                    )}
                  </button>
                )}
              </SetupStep>

              {/* Step 2: Login */}
              <SetupStep
                number={2}
                label="GitHub Account"
                done={ghAuth?.authenticated ?? false}
                active={(ghAuth?.installed ?? false) && !(ghAuth?.authenticated ?? false)}
              >
                {ghAuth?.installed && !ghAuth?.authenticated && !loginCode && (
                  <button
                    onClick={loginGh}
                    disabled={ghSetupStep !== 'idle'}
                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded text-xs text-zinc-200 transition-colors"
                  >
                    {ghSetupStep === 'logging-in' ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Starting...</>
                    ) : (
                      <><LogIn className="w-3 h-3" /> Sign in with GitHub</>
                    )}
                  </button>
                )}
                {loginCode && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-zinc-400">Enter this code on GitHub:</p>
                    <div
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-800 border border-zinc-600 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(loginCode);
                        setStatusMessage({ type: 'success', text: 'Code copied to clipboard!' });
                      }}
                      title="Click to copy"
                    >
                      <span className="text-xl font-mono font-bold text-white tracking-[0.25em]">{loginCode}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center">Click the code to copy · Complete sign-in in your browser</p>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-blue-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Waiting for authorization...
                    </div>
                  </div>
                )}
                {ghAuth?.authenticated && ghAuth.username && (
                  <p className="text-[11px] text-green-400 mt-1">Signed in as @{ghAuth.username}</p>
                )}
              </SetupStep>

              {/* Step 3: Create / link repo */}
              <SetupStep
                number={3}
                label="GitHub Repository"
                done={gitStatus.has_remote}
                active={(ghAuth?.authenticated ?? false) && !gitStatus.has_remote}
              >
                {ghAuth?.authenticated && !gitStatus.has_remote && (
                  <button
                    onClick={createRepo}
                    disabled={ghSetupStep !== 'idle'}
                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-xs text-white transition-colors"
                  >
                    {ghSetupStep === 'creating-repo' ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
                    ) : (
                      <><Github className="w-3 h-3" /> Create Repository on GitHub</>
                    )}
                  </button>
                )}
                {gitStatus.has_remote && (
                  <p className="text-[11px] text-zinc-500 mt-1 truncate" title={gitStatus.remote_url}>
                    {gitStatus.remote_url.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')}
                  </p>
                )}
              </SetupStep>
            </div>
          </div>
        )}

        {/* Connected status */}
        {ghAuth?.authenticated && gitStatus.has_remote && (
          <div className="px-3 py-2 border-b border-zinc-800/50 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[11px] text-green-400">
              Connected · @{ghAuth.username}
            </span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // Open remote URL in browser via shell
                const url = gitStatus.remote_url.replace(/\.git$/, '');
                if (url.startsWith('http')) {
                  invoke('greet', { name: '' }); // noop, just to keep Tauri happy
                  window.open(url, '_blank');
                }
              }}
              className="ml-auto text-zinc-500 hover:text-zinc-300"
              title="Open on GitHub"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Changes list */}
        <div className="border-b border-zinc-800/50">
          <button
            onClick={() => setChangesExpanded((v) => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-zinc-800/40 transition-colors"
          >
            {changesExpanded ? (
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            )}
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Changes
            </span>
            {totalChanges > 0 && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-300 font-medium">
                {totalChanges}
              </span>
            )}
          </button>

          {changesExpanded && (
            <div className="px-3 pb-2">
              {totalChanges === 0 ? (
                <p className="text-[11px] text-zinc-600 py-2">No changes</p>
              ) : (
                <div className="space-y-1">
                  {(gitStatus.staged_files || 0) > 0 && (
                    <ChangeRow icon={CheckCircle2} color="text-green-500" label="Staged" count={gitStatus.staged_files} />
                  )}
                  {(gitStatus.changed_files || 0) > 0 && (
                    <ChangeRow icon={FileEdit} color="text-yellow-500" label="Modified" count={gitStatus.changed_files} />
                  )}
                  {(gitStatus.untracked_files || 0) > 0 && (
                    <ChangeRow icon={FilePlus} color="text-blue-400" label="New files" count={gitStatus.untracked_files} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Version info */}
        {versionInfo && (
          <div className="px-3 py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[11px] text-zinc-400">
                Version: <span className="text-zinc-200 font-medium">{versionInfo.current}</span>
              </span>
              <span className="text-[10px] text-zinc-600 ml-auto">
                {versionInfo.total_commits} commits
              </span>
            </div>
          </div>
        )}

        {/* Publish section */}
        {gitStatus.is_repo && (
          <div className="px-3 py-3">
            <div className="space-y-2.5">
              {/* Commit message */}
              <input
                type="text"
                value={publishMessage}
                onChange={(e) => setPublishMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !publishing && totalChanges > 0) publish();
                }}
                placeholder="Describe your changes..."
                className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-blue-500 transition-colors"
              />

              {/* Auto-version toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoVersion}
                  onChange={(e) => setAutoVersion(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-[11px] text-zinc-400">
                  Auto-version
                  {autoVersion && versionInfo && (
                    <span className="text-zinc-500"> → {versionInfo.next_patch}</span>
                  )}
                </span>
              </label>

              {/* Publish button */}
              <button
                onClick={publish}
                disabled={publishing || totalChanges === 0}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  totalChanges > 0
                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {publishing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</>
                ) : totalChanges > 0 ? (
                  <><Upload className="w-4 h-4" /> Publish to GitHub</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Everything up to date</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <StatusToast message={statusMessage} />
    </div>
  );
}

// ── Sub-components ──

function Header({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        Git & GitHub
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function SetupStep({
  number,
  label,
  done,
  active,
  children,
}: {
  number: number;
  label: string;
  done: boolean;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        ) : active ? (
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
        ) : (
          <div className="w-4 h-4 rounded-full border border-zinc-600 flex items-center justify-center shrink-0">
            <span className="text-[9px] text-zinc-500">{number}</span>
          </div>
        )}
        <span className={`text-xs ${done ? 'text-green-400' : active ? 'text-zinc-200' : 'text-zinc-500'}`}>
          {label}
          {done && ' ✓'}
        </span>
      </div>
      {children}
    </div>
  );
}

function ChangeRow({
  icon: Icon,
  color,
  label,
  count,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="ml-auto text-[11px] text-zinc-500 font-mono">{count}</span>
    </div>
  );
}

function StatusToast({ message }: { message: { type: 'success' | 'error'; text: string } | null }) {
  if (!message) return null;
  return (
    <div className={`mx-3 mb-3 px-3 py-2 rounded-lg text-xs ${
      message.type === 'success'
        ? 'bg-green-900/30 text-green-300 border border-green-800/50'
        : 'bg-red-900/30 text-red-300 border border-red-800/50'
    }`}>
      <div className="flex items-start gap-2">
        {message.type === 'success' ? (
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        )}
        <span className="break-words">{message.text}</span>
      </div>
    </div>
  );
}
