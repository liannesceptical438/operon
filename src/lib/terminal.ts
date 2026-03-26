import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Spawn a new PTY shell process for the given terminal ID.
 */
export async function spawnTerminal(terminalId: string): Promise<void> {
  return invoke('spawn_terminal', { terminalId });
}

/**
 * Write raw bytes to the terminal's PTY stdin.
 */
export async function writeTerminal(terminalId: string, data: Uint8Array): Promise<void> {
  return invoke('write_terminal', { terminalId, data: Array.from(data) });
}

/**
 * Resize the PTY to match the xterm.js dimensions.
 * Always call fitAddon.fit() BEFORE this to keep them in sync.
 */
export async function resizeTerminal(terminalId: string, rows: number, cols: number): Promise<void> {
  return invoke('resize_terminal', { terminalId, rows, cols });
}

/**
 * Kill the terminal's PTY process and remove it from the manager.
 */
export async function killTerminal(terminalId: string): Promise<void> {
  return invoke('kill_terminal', { terminalId });
}

/**
 * Listen for PTY output events streamed from the Rust backend.
 * Returns an unlisten function to stop listening.
 */
export async function onTerminalOutput(
  terminalId: string,
  callback: (output: string) => void,
): Promise<UnlistenFn> {
  return listen<{ output: string }>(`pty-output-${terminalId}`, (event) => {
    callback(event.payload.output);
  });
}

/**
 * Listen for terminal exit events (process finished).
 * Returns an unlisten function to stop listening.
 */
export async function onTerminalExit(
  terminalId: string,
  callback: () => void,
): Promise<UnlistenFn> {
  return listen(`pty-exit-${terminalId}`, callback);
}
