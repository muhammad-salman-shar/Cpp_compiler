import type { Example } from "../lib/examples";

interface SidebarProps {
  examples: Example[];
  activeId: string | null;
  onSelect: (ex: Example) => void;
  onSettings?: () => void;
}

export function Sidebar({ examples, activeId, onSelect, onSettings }: SidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* examples */}
      <div className="px-4 pb-2 pt-4">
        <h2 className="font-display text-[11px] font-semibold tracking-[0.22em] text-mist-600">EXAMPLES</h2>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <ul className="flex flex-col gap-1">
          {examples.map((ex) => {
            const active = ex.id === activeId;
            return (
              <li key={ex.id}>
                <button
                  onClick={() => onSelect(ex)}
                  className={`group relative w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.985] ${
                    active
                      ? "border-ember-500/40 bg-ink-750 shadow-[inset_2px_0_0_0_var(--color-ember-500)]"
                      : "border-transparent hover:translate-x-0.5 hover:border-ink-600 hover:bg-ink-800/80"
                  }`}
                >
                  <span className={`block font-body text-[13px] font-semibold leading-tight ${active ? "text-ember-300" : "text-mist-200 group-hover:text-mist-100"}`}>
                    {ex.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-mist-600">{ex.blurb}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {ex.tags.map((t) => (
                      <span
                        key={t}
                        className={`rounded px-1.5 py-px font-mono text-[9.5px] tracking-wide ${
                          active ? "bg-ember-500/15 text-ember-400" : "bg-ink-700/60 text-mist-500"
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
