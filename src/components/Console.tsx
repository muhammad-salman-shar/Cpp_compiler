import { useEffect, useRef } from "react";
import type { Problem } from "../compiler/types";
import { IconCheck, IconEraser, IconError, IconTerminal, IconWarn } from "./icons";

export interface Entry {
  id: number;
  kind: "sys" | "out" | "ok" | "err" | "warn";
  text: string;
  line?: number;
  col?: number;
  lineText?: string;
  hint?: string;
}

interface ConsoleProps {
  entries: Entry[];
  problems: Problem[];
  tab: "output" | "problems" | "input";
  onTab: (t: "output" | "problems" | "input") => void;
  onClear: () => void;
  onJump: (line: number, col?: number) => void;
  running: boolean;
  hasRun: boolean;
  needsInput: boolean;
  stdin: string;
  onStdin: (v: string) => void;
  timeMs: number | null;
}

export function ConsolePanel({ entries, problems, tab, onTab, onClear, onJump, running, hasRun, needsInput, stdin, onStdin, timeMs }: ConsoleProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, tab, problems.length]);

  const errCount = problems.filter((p) => p.severity === "error").length;
  const warnCount = problems.length - errCount;

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950/80">
      {/* tab strip */}
      <div className="flex items-center gap-1 border-b border-ink-700/60 bg-ink-900/80 px-2 pt-1.5">
        <TabBtn active={tab === "output"} onClick={() => onTab("output")} label="Output" count={entries.length} tone="neutral" />
        <TabBtn
          active={tab === "problems"}
          onClick={() => onTab("problems")}
          label="Problems"
          count={problems.length}
          tone={errCount > 0 ? "error" : warnCount > 0 ? "warn" : "ok"}
        />
        {needsInput && (
          <TabBtn
            active={tab === "input"}
            onClick={() => onTab("input")}
            label="Input"
            count={0}
            tone="neutral"
          />
        )}
        <div className="ml-auto flex items-center gap-2 pb-1">
          {tab === "output" && timeMs !== null && !running && (
            <span className="font-mono text-[10px] text-mist-600">
              ● completed · {timeMs < 1 ? timeMs.toFixed(1) : Math.round(timeMs)} ms
            </span>
          )}
          {running && <span className="font-mono text-[10px] tracking-wider text-ember-400/90">RUNNING</span>}
          <button
            onClick={onClear}
            title="Clear console"
            className="rounded-md p-1.5 text-mist-600 transition-colors hover:bg-ink-700/50 hover:text-mist-300 active:scale-90"
          >
            <IconEraser className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* body */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 font-mono text-[12.5px] leading-[20px]">
        {tab === "output" ? (
          entries.length === 0 ? (
            <EmptyState hasRun={hasRun} />
          ) : (
            <>
              {entries.map((e, i) => (
                <EntryRow key={e.id} e={e} index={i} onJump={onJump} />
              ))}
              {!running && (
                <div className="mt-1 flex items-center gap-2 pl-0.5">
                  <span className="caret-blink inline-block h-[15px] w-[8px] bg-pulse-400/90" />
                </div>
              )}
            </>
          )
        ) : tab === "problems" ? (
          <ProblemsList problems={problems} onJump={onJump} hasRun={hasRun} />
        ) : (
          <InputPanel stdin={stdin} onStdin={onStdin} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- sub-pieces ------------------------------- */

function TabBtn({ active, onClick, label, count, tone }: {
  active: boolean; onClick: () => void; label: string; count: number;
  tone: "neutral" | "error" | "warn" | "ok";
}) {
  const toneCls = !active
    ? "text-mist-600"
    : tone === "error"
      ? "text-coral-400"
      : tone === "warn"
        ? "text-ember-400"
        : tone === "ok"
          ? "text-pulse-400"
          : "text-mist-200";
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-t-md px-3 py-1.5 font-display text-[11px] font-semibold tracking-[0.14em] transition-colors ${
        active ? "bg-ink-950/80 " + toneCls : "text-mist-600 hover:text-mist-400"
      }`}
    >
      {label.toUpperCase()}
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 py-px text-[10px] font-mono ${
            tone === "error" ? "bg-coral-500/15 text-coral-400" : tone === "warn" ? "bg-ember-500/15 text-ember-400" : tone === "ok" ? "bg-pulse-500/15 text-pulse-400" : "bg-ink-700/70 text-mist-400"
          }`}
        >
          {count}
        </span>
      )}
      {active && <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${tone === "error" ? "bg-coral-500" : tone === "warn" ? "bg-ember-500" : tone === "ok" ? "bg-pulse-500" : "bg-mist-500"}`} />}
    </button>
  );
}

function EntryRow({ e, index, onJump }: { e: Entry; index: number; onJump: (l: number, c?: number) => void }) {
  const style = { animationDelay: `${Math.min(index * 16, 420)}ms` };

  if (e.kind === "sys")
    return (
      <div className="entry-in flex gap-2 text-mist-600" style={style}>
        <span className="select-none text-ink-600">$</span>
        <span className="whitespace-pre-wrap break-words">{e.text}</span>
      </div>
    );

  if (e.kind === "out")
    return (
      <div className="entry-in whitespace-pre-wrap break-words pl-4 text-mist-200" style={style}>
        {e.text === "" ? "\u00A0" : e.text}
      </div>
    );

  if (e.kind === "ok")
    return (
      <div className="entry-in mt-1 flex items-center gap-2 text-pulse-400" style={style}>
        <IconCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-pre-wrap break-words">{e.text}</span>
      </div>
    );

  const isErr = e.kind === "err";
  return (
    <div
      className={`entry-in my-1.5 rounded-md border-l-2 py-2 pl-3 pr-2 ${isErr ? "border-coral-500 bg-coral-500/[0.07]" : "border-ember-500 bg-ember-500/[0.06]"}`}
      style={style}
    >
      <div className="flex items-start gap-2">
        {isErr ? <IconError className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral-400" /> : <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember-400" />}
        <div className="min-w-0">
          <div className={`font-semibold ${isErr ? "text-coral-300" : "text-ember-300"}`}>
            {isErr ? "error" : "warning"}: <span className="text-mist-100">{e.text}</span>
          </div>
          {e.line !== undefined && (
            <button
              onClick={() => onJump(e.line!, e.col)}
              className="group mt-0.5 flex items-center gap-1 text-mist-500 transition-colors hover:text-sky-lt"
              title="Jump to source"
            >
              <span className="text-ink-600">--&gt;</span>
              <span className="underline decoration-mist-600/40 decoration-dotted underline-offset-2 group-hover:decoration-sky-lt/60">
                main.cpp:{e.line}{e.col !== undefined ? `:${e.col}` : ""}
              </span>
            </button>
          )}
          {e.lineText !== undefined && (
            <pre className="mt-1.5 overflow-x-auto rounded bg-ink-950/80 px-2.5 py-1.5 text-[11.5px] leading-[18px] text-mist-300">
              {e.lineText}{"\n"}
              <span className={isErr ? "text-coral-400" : "text-ember-400"}>
                {" ".repeat(Math.max(0, (e.col ?? 1) - 1))}^
              </span>
            </pre>
          )}
          {e.hint && (
            <div className={`mt-1 text-[11.5px] ${isErr ? "text-coral-300/80" : "text-ember-300/80"}`}>
              <span className="opacity-70">help:</span> {e.hint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProblemsList({ problems, onJump, hasRun }: { problems: Problem[]; onJump: (l: number, c?: number) => void; hasRun: boolean }) {
  if (problems.length === 0)
    return (
      <div className="pop-in flex flex-col items-center gap-2 pt-10 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-pulse-500/30 bg-pulse-500/10 text-pulse-400">
          <IconCheck className="h-5 w-5" />
        </span>
        <p className="font-display text-sm font-semibold text-mist-200">{hasRun ? "Clean compile" : "No problems yet"}</p>
        <p className="max-w-[240px] text-[11.5px] leading-relaxed text-mist-600">
          {hasRun ? "Zero errors, zero warnings. The -Wunused pass found nothing to report." : "Compile the program and diagnostics will be listed here."}
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-1.5">
      {problems.map((p, i) => {
        const isErr = p.severity === "error";
        return (
          <button
            key={i}
            onClick={() => onJump(p.line, p.col)}
            className="entry-in group flex items-start gap-2.5 rounded-md border border-ink-700/50 bg-ink-900/60 px-3 py-2 text-left transition-all hover:border-ink-600 hover:bg-ink-800/80 active:scale-[0.99]"
            style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
          >
            {isErr ? <IconError className="mt-0.5 h-4 w-4 shrink-0 text-coral-400" /> : <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-ember-400" />}
            <span className="min-w-0">
              <span className="block truncate text-mist-200">
                <span className={isErr ? "text-coral-400" : "text-ember-400"}>{p.severity}:</span> {p.message}
              </span>
              <span className="text-[11px] text-mist-600 group-hover:text-sky-lt">main.cpp:{p.line} ↩ jump</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ hasRun }: { hasRun: boolean }) {
  return (
    <div className="pop-in flex h-full flex-col items-center justify-center gap-3 pb-8 text-center">
      <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-ink-600 bg-ink-800/80 text-mist-500 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]">
        <IconTerminal className="h-7 w-7" />
        <span className="dot-breathe absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-pulse-400" />
      </span>
      <div>
        <p className="font-display text-base font-semibold tracking-wide text-mist-300">
          {hasRun ? "Console cleared" : "Awaiting compilation"}
        </p>
        <p className="mx-auto mt-1 max-w-[250px] text-[11.5px] leading-relaxed text-mist-600">
          Program output streams here line by line — stdout, diagnostics and the exit code.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-mist-600">
        <span className="kbd">Ctrl</span>
        <span>+</span>
        <span className="kbd">Enter</span>
        <span className="ml-1">to compile &amp; run</span>
      </div>
    </div>
  );
}

function InputPanel({ stdin, onStdin }: { stdin: string; onStdin: (v: string) => void }) {
  return (
    <div className="pop-in flex flex-col gap-3">
      <div>
        <p className="font-display text-sm font-semibold text-mist-200">Standard Input</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-mist-600">
          This data is fed to your program when you press <span className="font-mono text-mist-500">Run</span>.
          <span className="font-mono text-mist-500"> cin &gt;&gt;</span> reads whitespace-separated tokens,
          <span className="font-mono text-mist-500"> getline</span> reads full lines.
        </p>
      </div>
      <textarea
        value={stdin}
        onChange={(e) => onStdin(e.target.value)}
        placeholder={"17 5\nAda Lovelace"}
        spellCheck={false}
        className="h-40 w-full resize-none rounded-lg border border-ink-700/70 bg-ink-950/70 px-3 py-2 font-mono text-[12px] leading-[19px] text-mist-200 placeholder:text-mist-600/70 transition-colors focus:border-ember-500/60 focus:outline-none focus:ring-2 focus:ring-ember-500/15"
      />
      <div className="flex items-center gap-2 text-[10.5px] text-mist-600">
        <span className="font-mono text-mist-500">Tip:</span>
        <span>Each line becomes a separate input for cin or getline</span>
      </div>
    </div>
  );
}
