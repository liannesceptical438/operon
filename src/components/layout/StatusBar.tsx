import { GitBranch } from "lucide-react";

interface StatusBarProps {
  sidebarVisible: boolean;
  terminalVisible: boolean;
  chatVisible: boolean;
}

export function StatusBar({ sidebarVisible, terminalVisible, chatVisible }: StatusBarProps) {
  return (
    <div className="h-6 flex items-center justify-between px-3 bg-zinc-900 border-t border-zinc-800 text-[11px] text-zinc-500 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          <span>main</span>
        </div>
        <span>Ln 1, Col 1</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <span>UTF-8</span>
        <span>TypeScript React</span>
        <div className="flex items-center gap-1.5">
          <span className={sidebarVisible ? "text-zinc-400" : ""}>Sidebar</span>
          <span className={terminalVisible ? "text-zinc-400" : ""}>Terminal</span>
          <span className={chatVisible ? "text-zinc-400" : ""}>Chat</span>
        </div>
      </div>
    </div>
  );
}
