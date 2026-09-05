import type { Example } from "../lib/examples";
import { IconBolt } from "./icons";

interface SidebarProps {
  examples: Example[];
  activeId: string | null;
  onSelect: (ex: Example) => void;
  stdin: string;
  onStdin: (v: string) => void;
}

const SUBSET = [
  "int · double · char · bool",
  "std::string",
  "std::vector<T>",
  "functions & references",
  "if · for · while · do",
  "range-for",
  "auto · const",
  "cout · cin · getline",
  "math builtins",
];

export function Sidebar({ examples, activeId, onSelect, stdin, onStdin }: SidebarProps) {
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

      {/* stdin */}
      <div className="border-t border-ink-700/60 px-4 pb-4 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 className="font-display text-[11px] font-semibold tracking-[0.22em] text-mist-600">STANDARD INPUT</h2>
          <span className="font-mono text-[9.5px] text-mist-600">cin · getline</span>
        </div>
        <textarea
          value={stdin}
          onChange={(e) => onStdin(e.target.value)}
          placeholder={"17 5\nAda Lovelace"}
          spellCheck={false}
          className="h-20 w-full resize-none rounded-lg border border-ink-700/70 bg-ink-950/70 px-3 py-2 font-mono text-[12px] leading-[19px] text-mist-200 placeholder:text-mist-600/70 transition-colors focus:border-ember-500/60 focus:outline-none focus:ring-2 focus:ring-ember-500/15"
        />
        <p className="mt-1.5 text-[10.5px] leading-snug text-mist-600">
          Fed to the program on each run. <span className="font-mono text-mist-500">cin &gt;&gt;</span> reads
          whitespace-separated tokens.
        </p>
      </div>

      {/* subset reference */}
      <div className="border-t border-ink-700/60 px-4 pb-4 pt-3">
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-[11px] font-semibold tracking-[0.22em] text-mist-600">
          <IconBolt className="h-3.5 w-3.5 text-pulse-400" />
          LANGUAGE SUBSET
        </h2>
        <div className="flex flex-wrap gap-1">
          {SUBSET.map((s) => (
            <span key={s} className="rounded border border-ink-700/60 bg-ink-800/60 px-1.5 py-0.5 font-mono text-[9.5px] text-mist-500">
              {s}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-[10.5px] leading-snug text-mist-600">
          A hand-written lexer, parser and tree-walking interpreter — everything runs locally in your browser.
        </p>
      </div>
    </div>
  );
}
