import type { Example } from "../lib/examples";

interface SidebarProps {
  examples: Example[];
  activeId: string | null;
  onSelect: (ex: Example) => void;
}

export function Sidebar({ examples, activeId, onSelect }: SidebarProps) {
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
    </div>
  );
}
