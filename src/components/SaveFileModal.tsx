import { useEffect, useState } from "react";
import { saveFileToDevice, shareFile } from "../lib/fileSystem";

const EXTENSIONS = [".cpp", ".c", ".h", ".hpp", ".cc", ".cxx", ".txt"];
const DEFAULT_EXT = ".cpp";

interface SaveFileModalProps {
  initialFilename: string;
  content: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

function splitExt(name: string): { base: string; ext: string } {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return { base: name || "untitled", ext: DEFAULT_EXT };
  const ext = name.slice(idx).toLowerCase();
  if (!EXTENSIONS.includes(ext)) return { base: name, ext: DEFAULT_EXT };
  return { base: name.slice(0, idx) || "untitled", ext };
}

export function SaveFileModal({ initialFilename, content, onClose, onSaved, onError }: SaveFileModalProps) {
  const initial = splitExt(initialFilename || "untitled.cpp");
  const [base, setBase] = useState(initial.base);
  const [ext, setExt] = useState(initial.ext);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  useEffect(() => {
    const parsed = splitExt(initialFilename || "untitled.cpp");
    setBase(parsed.base);
    setExt(parsed.ext);
  }, [initialFilename]);

  const filename = `${(base.trim() || "untitled").replace(/\s+/g, "_")}${ext}`;

  const run = async (mode: "save" | "share") => {
    setBusy(mode);
    try {
      const r = mode === "save"
        ? await saveFileToDevice(content, filename)
        : await shareFile(content, filename);
      if (r.ok) {
        onSaved(r.message);
        onClose();
      } else {
        onError(r.message);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/85 p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-850 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-display text-sm font-semibold tracking-[0.18em] text-mist-200">
          SAVE FILE
        </h2>

        <label className="block text-[11px] font-semibold tracking-wider text-mist-500">
          FILENAME
        </label>
        <div className="mt-1 flex gap-2">
          <input
            autoFocus
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="untitled"
            className="flex-1 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-sm text-mist-100 focus:border-ember-500/60 focus:outline-none"
          />
          <select
            value={ext}
            onChange={(e) => setExt(e.target.value)}
            className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-2 font-mono text-sm text-mist-100 focus:border-ember-500/60 focus:outline-none"
          >
            {EXTENSIONS.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </div>

        <p className="mt-2 break-all font-mono text-[11px] text-mist-500">
          {filename}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => run("save")}
            disabled={busy !== null}
            className="flex-1 rounded-lg bg-ember-500 px-4 py-2.5 font-display text-sm font-semibold tracking-wide text-ink-950 transition hover:bg-ember-400 active:scale-[0.98] disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save to Device"}
          </button>
          <button
            type="button"
            onClick={() => run("share")}
            disabled={busy !== null}
            className="flex-1 rounded-lg border border-pulse-500/40 bg-pulse-500/10 px-4 py-2.5 font-display text-sm font-semibold tracking-wide text-pulse-400 transition hover:bg-pulse-500/20 active:scale-[0.98] disabled:opacity-50"
          >
            {busy === "share" ? "Sharing…" : "Share"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => { if (!busy) onClose(); }}
          disabled={busy !== null}
          className="mt-3 w-full rounded-lg border border-ink-700 px-4 py-2 font-display text-xs tracking-wider text-mist-400 transition hover:bg-ink-800 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
