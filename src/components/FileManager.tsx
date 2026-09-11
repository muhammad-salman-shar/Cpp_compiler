import { useState, useEffect } from "react";
import { IconFile, IconTrash, IconEdit, IconFolder, IconPlus } from "./icons";

export interface SavedFile {
  id: string;
  name: string;
  code: string;
  lastModified: number;
}

interface FileManagerProps {
  currentCode: string;
  currentFileName: string | null;
  onLoadFile: (file: SavedFile) => void;
  onSaveFile: (name: string, code: string) => void;
  onDeleteFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onNewFile: () => void;
  onSettings?: () => void;
}

const LS_FILES = "cclite.files.v1";

export function loadFiles(): SavedFile[] {
  try {
    const files = localStorage.getItem(LS_FILES);
    return files ? JSON.parse(files) : [];
  } catch {
    return [];
  }
}

export function saveFiles(files: SavedFile[]): void {
  try {
    localStorage.setItem(LS_FILES, JSON.stringify(files));
  } catch {
    // Storage full or unavailable
  }
}

export function FileManager({
  currentCode,
  currentFileName,
  onLoadFile,
  onSaveFile,
  onDeleteFile,
  onRenameFile,
  onNewFile,
  onSettings,
}: FileManagerProps) {
  const [files, setFiles] = useState<SavedFile[]>(loadFiles());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    saveFiles(files);
  }, [files]);

  const handleNewFile = () => {
    onNewFile();
  };

  const handleSaveCurrent = () => {
    const name = currentFileName || "untitled.cpp";
    const existingFile = files.find((f) => f.name === name);
    
    if (existingFile) {
      // Update existing file
      setFiles(files.map((f) => 
        f.id === existingFile.id 
          ? { ...f, code: currentCode, lastModified: Date.now() }
          : f
      ));
    } else {
      // Create new file
      const newFile: SavedFile = {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        code: currentCode,
        lastModified: Date.now(),
      };
      setFiles([newFile, ...files]);
    }
  };

  const handleDelete = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
    setDeleteConfirmId(null);
  };

  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameFile(id, renameValue.trim());
      setFiles(files.map((f) => 
        f.id === id ? { ...f, name: renameValue.trim() } : f
      ));
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header with New Code button */}
      <div className="border-b border-ink-700/60 px-4 py-3">
        <button
          onClick={handleNewFile}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ember-500 px-4 py-2.5 font-display text-sm font-semibold tracking-wide text-ink-950 transition-all hover:bg-ember-400 active:scale-[0.98]"
        >
          <IconPlus className="h-4 w-4" />
          New Code
        </button>
      </div>

      {/* Save current button */}
      <div className="border-b border-ink-700/60 px-4 py-2">
        <button
          onClick={handleSaveCurrent}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-pulse-500/40 bg-pulse-500/10 px-3 py-2 font-display text-xs font-semibold tracking-wide text-pulse-400 transition-all hover:border-pulse-500/60 hover:bg-pulse-500/20 active:scale-[0.98]"
        >
          <IconFile className="h-3.5 w-3.5" />
          Save Current
        </button>
      </div>

      {/* Files list */}
      <div className="px-4 pb-2 pt-3">
        <h2 className="font-display text-[11px] font-semibold tracking-[0.22em] text-mist-600">
          SAVED FILES
        </h2>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <IconFolder className="h-12 w-12 text-mist-600/50" />
            <p className="text-sm text-mist-500">No saved files yet</p>
            <p className="text-xs text-mist-600">
              Click "Save Current" to save your code
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {files.map((file) => {
              const isActive = file.name === currentFileName;
              const isRenaming = renamingId === file.id;
              const isDeleting = deleteConfirmId === file.id;

              return (
                <li key={file.id}>
                  <div
                    className={`group relative rounded-lg border px-3 py-2.5 transition-all ${
                      isActive
                        ? "border-ember-500/40 bg-ink-750 shadow-[inset_2px_0_0_0_var(--color-ember-500)]"
                        : "border-transparent hover:border-ink-600 hover:bg-ink-800/80"
                    }`}
                  >
                    {/* File name and actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRename(file.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(file.id);
                              if (e.key === "Escape") {
                                setRenamingId(null);
                                setRenameValue("");
                              }
                            }}
                            autoFocus
                            className="w-full rounded border border-ink-600 bg-ink-900 px-2 py-1 font-mono text-xs text-mist-200 focus:border-ember-500/60 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => onLoadFile(file)}
                            className="block w-full text-left"
                          >
                            <span
                              className={`block truncate font-body text-[13px] font-semibold leading-tight ${
                                isActive ? "text-ember-300" : "text-mist-200 group-hover:text-mist-100"
                              }`}
                            >
                              {file.name}
                            </span>
                          </button>
                        )}
                        <span className="mt-0.5 block text-[10px] text-mist-600">
                          {formatDate(file.lastModified)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      {!isRenaming && (
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setRenamingId(file.id);
                              setRenameValue(file.name);
                            }}
                            title="Rename"
                            className="rounded p-1 text-mist-500 hover:bg-ink-700 hover:text-mist-300"
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(file.id)}
                            title="Delete"
                            className="rounded p-1 text-mist-500 hover:bg-coral-500/20 hover:text-coral-400"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete confirmation */}
                    {isDeleting && (
                      <div className="mt-2 flex items-center gap-2 rounded border border-coral-500/30 bg-coral-500/10 px-2 py-1.5">
                        <span className="flex-1 text-[11px] text-coral-300">Delete?</span>
                        <button
                          onClick={() => handleDelete(file.id)}
                          className="rounded bg-coral-500 px-2 py-0.5 text-[10px] font-semibold text-ink-950 hover:bg-coral-400"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded bg-ink-700 px-2 py-0.5 text-[10px] font-semibold text-mist-300 hover:bg-ink-600"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Settings button */}
      {onSettings && (
        <div className="border-t border-ink-700/60 p-3">
          <button
            onClick={onSettings}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700/60 bg-ink-800/60 px-4 py-2.5 font-display text-[11px] font-semibold tracking-wider text-mist-400 transition-all hover:border-ink-600 hover:bg-ink-700/60 hover:text-mist-200 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            SETTINGS
          </button>
        </div>
      )}
    </div>
  );
}
