import { useCallback, useEffect, useRef, useState } from "react";
import { lex } from "./compiler/lexer";
import { parse } from "./compiler/parser";
import { collectDiagnostics } from "./compiler/diagnostics";
import { runProgram } from "./compiler/interpreter";
import { CompileError, RuntimeError } from "./compiler/types";
import type { Problem } from "./compiler/types";
import { EXAMPLES } from "./lib/examples";
import type { Example } from "./lib/examples";
import { Editor } from "./components/Editor";
import type { EditorHandle } from "./components/Editor";
import { ConsolePanel } from "./components/Console";
import type { Entry } from "./components/Console";
import { Sidebar } from "./components/Sidebar";
import { SettingsPanel, loadSettings, saveSettings } from "./components/SettingsPanel";
import type { Settings } from "./components/SettingsPanel";
import { ProPopup } from "./components/ProPopup";
import { LogoMark, IconPlay, IconSpinner, IconCheck, IconError, IconChevron, IconClose, IconPanel, IconCode } from "./components/icons";

type Stage = "idle" | "lex" | "parse" | "exec" | "done" | "error";

interface Stats { tokens: number; timeMs: number; exitCode: number; ops: number }
interface Toast { id: number; msg: string; tone: "ok" | "err" | "info" }

const LS_CODE = "cclite.code.v1";
const LS_STDIN = "cclite.stdin.v1";
const LS_EX = "cclite.example.v1";

function loadInitial(): { code: string; stdin: string; exampleId: string | null } {
  try {
    const code = localStorage.getItem(LS_CODE);
    if (code !== null) {
      return {
        code,
        stdin: localStorage.getItem(LS_STDIN) ?? "",
        exampleId: localStorage.getItem(LS_EX),
      };
    }
  } catch { /* private mode */ }
  return { code: EXAMPLES[0].code, stdin: "", exampleId: EXAMPLES[0].id };
}

export default function App() {
  const initial = useRef(loadInitial()).current;

  const [code, setCode] = useState(initial.code);
  const [stdin, setStdin] = useState(initial.stdin);
  const [activeExample, setActiveExample] = useState<string | null>(initial.exampleId);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [tab, setTab] = useState<"output" | "problems" | "input">("output");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [caret, setCaret] = useState({ ln: 1, col: 1 });
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [std, setStd] = useState("C++17");
  const [stats, setStats] = useState<Stats | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [inputWarning, setInputWarning] = useState(false);
  
  // Detect if code uses cin or getline (token-based detection)
  const needsInput = (() => {
    try {
      const result = lex(code);
      const tokens = result.tokens;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.kind === "kw" && t.v === "cin") {
          // Check if it's cin >> or cin.method()
          if (i + 1 < tokens.length) {
            const next = tokens[i + 1];
            if ((next.kind === "pun" && next.v === ">>") || (next.kind === "pun" && next.v === ".")) {
              return true;
            }
          }
        }
        if (t.kind === "ident" && t.v === "getline") {
          return true;
        }
      }
      return false;
    } catch {
      // If lexing fails, fall back to simple regex
      return /(\bcin\s*>>|\bcin\s*\.|\bgetline\s*\()/.test(code);
    }
  })();

  const editorRef = useRef<EditorHandle>(null);
  const runningRef = useRef(false);
  const idRef = useRef(0);
  const toastTimer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  const codeRef = useRef(code);
  const stdinRef = useRef(stdin);
  const stdRef = useRef(std);
  codeRef.current = code;
  stdinRef.current = stdin;
  stdRef.current = std;

  const mk = useCallback((kind: Entry["kind"], text: string, extra?: Partial<Entry>): Entry => {
    idRef.current += 1;
    return { id: idRef.current, kind, text, ...extra };
  }, []);

  const showToast = useCallback((msg: string, tone: Toast["tone"]) => {
    idRef.current += 1;
    setToast({ id: idRef.current, msg, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  /* ------------------------------ autosave ------------------------------ */
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(LS_CODE, codeRef.current);
        localStorage.setItem(LS_STDIN, stdinRef.current);
        if (activeExample) localStorage.setItem(LS_EX, activeExample);
      } catch { /* ignore */ }
      const d = new Date();
      setSavedAt(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 650);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [code, stdin, activeExample]);

  /* --------------------------------- run --------------------------------- */

  const run = useCallback(() => {
    if (runningRef.current) return;
    
    // Check if input is required but not provided
    if (needsInput && stdinRef.current.trim() === "") {
      setInputWarning(true);
      setTab("input");
      setTimeout(() => setInputWarning(false), 3000);
      return;
    }
    
    const src = codeRef.current;
    const lines = src.split("\n");

    runningRef.current = true;
    setRunning(true);
    setHasRun(true);
    setTab("output");
    setErrorLine(null);
    setProblems([]);
    setEntries([]);
    setStage("lex");

    const fail = (msg: string, p: Problem) => {
      setProblems([p]);
      setErrorLine(p.line);
      setStage("error");
      runningRef.current = false;
      setRunning(false);
      showToast("Compilation failed", "err");
    };

    window.setTimeout(() => {
      /* ---- stage 1 · lexical analysis ---- */
      let tokens;
      let directives = 0;
      try {
        const r = lex(src);
        tokens = r.tokens;
        directives = r.directives;
      } catch (e) {
        const ce = e as CompileError;
        fail(ce.message, { severity: "error", message: ce.message, line: ce.line, col: ce.col, lineText: ce.lineText, hint: ce.hint ?? "lexical error" });
        return;
      }

      setStage("parse");
      window.setTimeout(() => {
        /* ---- stage 2 · parsing + diagnostics ---- */
        let ast;
        try {
          ast = parse(tokens, src);
        } catch (e) {
          const ce = e as CompileError;
          fail(ce.message, { severity: "error", message: ce.message, line: ce.line, col: ce.col, lineText: ce.lineText ?? lines[ce.line - 1], hint: ce.hint });
          return;
        }

        const diags = collectDiagnostics(ast, lines);
        setProblems(diags);
        const errors = diags.filter((d) => d.severity === "error");

        if (errors.length > 0) {
          const e0 = errors[0];
          fail(e0.message, e0);
          return;
        }

        setStage("exec");

        window.setTimeout(() => {
          /* ---- stage 3 · execution ---- */
          const t0 = performance.now();
          const out: string[] = [];
          try {
            const res = runProgram(ast, stdinRef.current, (line) => out.push(line));
            const ms = performance.now() - t0;
            setEntries((prev) => [
              ...prev,
              ...out.map((l) => mk("out", l)),
            ]);
            setStats({ tokens: tokens.length - 1, timeMs: ms, exitCode: res.exitCode, ops: res.ops });
            setStage("done");
            showToast(`Executed in ${ms < 1 ? ms.toFixed(1) : Math.round(ms)} ms`, "ok");
          } catch (e) {
            const ms = performance.now() - t0;
            const partial = out.map((l) => mk("out", l));
            if (e instanceof RuntimeError) {
              const line = e.line ?? 1;
              setEntries((prev) => [
                ...prev,
                ...partial,
              ]);
              setProblems((prev) => [...prev, { severity: "error", message: e.message, line, col: 1, lineText: lines[line - 1] }]);
              setErrorLine(line);
            } else {
              setEntries((prev) => [...prev, ...partial]);
            }
            setStage("error");
            showToast("Runtime error", "err");
          }
          runningRef.current = false;
          setRunning(false);
        }, 90);
      }, 90);
    }, 70);
  }, [mk, showToast]);

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------- actions ------------------------------- */

  const selectExample = (ex: Example) => {
    setCode(ex.code);
    setStdin(ex.stdin ?? "");
    setActiveExample(ex.id);
    setNavOpen(false);
    setProblems([]);
    setErrorLine(null);
    showToast(`Loaded “${ex.title}”`, "info");
  };

  const jumpTo = useCallback((line: number, col?: number) => {
    editorRef.current?.jumpTo(line, col ?? 1);
  }, []);

  const pipeline: { key: Stage; label: string }[] = [
    { key: "lex", label: "LEX" },
    { key: "parse", label: "PARSE" },
    { key: "exec", label: "EXEC" },
  ];
  const stageIdx = pipeline.findIndex((p) => p.key === stage);

  const statusDot =
    stage === "error" ? "bg-coral-400" : running ? "bg-ember-400 dot-breathe" : stage === "done" ? "bg-pulse-400" : "bg-mist-600";

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="flex h-full flex-col overflow-hidden font-body text-mist-200">
      {/* ================= header ================= */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-ink-700/60 bg-ink-900/90 px-3 sm:px-4">
        <button
          onClick={() => setNavOpen(true)}
          className="rounded-md p-2 text-mist-500 transition-colors hover:bg-ink-700/60 hover:text-mist-200 lg:hidden"
          title="Open examples panel"
        >
          <IconPanel className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8 drop-shadow-[0_2px_8px_rgba(69,212,190,0.25)]" />
          <div className="leading-none">
            <div className="font-display text-[16px] font-bold tracking-wide">
              <span className="text-ember-400">C++</span>
              <span className="text-mist-100"> Compiler</span>
              <span className="ml-1.5 rounded border border-pulse-500/50 px-1 py-0.5 align-middle font-display text-[9px] font-semibold tracking-[0.2em] text-pulse-400">
                LITE
              </span>
            </div>
            <div className="mt-1 hidden font-mono text-[9.5px] tracking-wide text-mist-600 sm:block">
              in-browser subset compiler · no server, no install
            </div>
          </div>
        </div>

        {/* pipeline indicator */}
        <div className="mx-auto hidden items-center md:flex">
          {pipeline.map((p, i) => {
            const state =
              stage === "done" ? "done" : i < stageIdx ? "done" : i === stageIdx ? (stage === "error" ? "error" : "active") : "idle";
            return (
              <span key={p.key} className="flex items-center">
                {i > 0 && <IconChevron className="mx-0.5 h-3 w-3 text-ink-600" />}
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-[10px] font-semibold tracking-[0.18em] transition-all duration-300 ${
                    state === "done"
                      ? "border-pulse-500/40 bg-pulse-500/10 text-pulse-400"
                      : state === "active"
                        ? "stage-pulse border-ember-500/60 bg-ember-500/10 text-ember-400"
                        : state === "error"
                          ? "border-coral-500/60 bg-coral-500/10 text-coral-400"
                          : "border-ink-600/80 bg-ink-800/60 text-mist-600"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      state === "done" ? "bg-pulse-400" : state === "active" ? "bg-ember-400 dot-breathe" : state === "error" ? "bg-coral-400" : "bg-mist-600/50"
                    }`}
                  />
                  {p.label}
                </span>
              </span>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <label className="hidden items-center gap-1.5 sm:flex">
            <span className="font-mono text-[10px] text-mist-600">-std=</span>
            <select
              value={std}
              onChange={(e) => setStd(e.target.value)}
              className="h-8 cursor-pointer rounded-md border border-ink-600 bg-ink-800 px-2 font-mono text-[11px] text-mist-300 transition-colors hover:border-ink-600 focus:border-ember-500/60 focus:outline-none"
            >
              {["C++11", "C++14", "C++17", "C++20"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <button
            onClick={run}
            disabled={running}
            className="run-glow flex h-9 items-center gap-2 rounded-lg bg-ember-500 px-3.5 font-display text-[13px] font-bold tracking-widest text-ink-950 transition-all hover:bg-ember-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:px-4"
          >
            {running ? <IconSpinner className="spin h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
            {running ? "RUNNING" : "RUN"}
            <span className="hidden rounded border border-ink-950/25 bg-ink-950/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-ink-900/80 sm:inline">
              Ctrl⏎
            </span>
          </button>
          
          {/* FREE badge */}
          <button
            onClick={() => setProOpen(true)}
            className="flex h-8 items-center gap-1 rounded-md border border-ember-500/40 bg-ember-500/10 px-2.5 font-display text-[10px] font-bold tracking-wider text-ember-400 transition-all hover:border-ember-500/60 hover:bg-ember-500/20 active:scale-95"
          >
            FREE
          </button>
        </div>
      </header>

      {/* ================= body ================= */}
      <div className="relative flex min-h-0 flex-1">
        <div className="blueprint pointer-events-none absolute inset-0 z-0" />

        {/* desktop sidebar */}
        <aside className="relative z-10 hidden w-[280px] shrink-0 border-r border-ink-700/60 bg-ink-850/95 lg:block">
          <Sidebar examples={EXAMPLES} activeId={activeExample} onSelect={selectExample} onSettings={() => setSettingsOpen(true)} />
        </aside>

        {/* mobile drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-ink-950/75" onClick={() => setNavOpen(false)} />
            <aside className="pop-in absolute left-0 top-0 flex h-full w-[300px] flex-col border-r border-ink-700 bg-ink-850">
              <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2.5">
                <span className="font-display text-[12px] font-semibold tracking-[0.2em] text-mist-400">PLAYGROUND</span>
                <button onClick={() => setNavOpen(false)} className="rounded-md p-1.5 text-mist-500 hover:bg-ink-700/60 hover:text-mist-200">
                  <IconClose className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <Sidebar examples={EXAMPLES} activeId={activeExample} onSelect={selectExample} onSettings={() => setSettingsOpen(true)} />
              </div>
            </aside>
          </div>
        )}

        {/* editor + console */}
        <main className="relative z-10 flex min-w-0 flex-1 flex-col lg:flex-row">
          <section className="flex min-h-[42vh] flex-1 flex-col border-b border-ink-700/60 lg:min-h-0 lg:border-b-0 lg:border-r">
            {/* editor tab strip */}
            <div className="flex h-9 shrink-0 items-center border-b border-ink-700/60 bg-ink-900/70 pl-2 pr-3">
              <div className="flex h-full items-center gap-2 border-x border-t border-ink-700/60 bg-ink-850 px-3 font-mono text-[11.5px] text-mist-200">
                <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
                main.cpp
              </div>
              <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-mist-600">
                <span className="hidden items-center gap-1 sm:flex">
                  <IconCode className="h-3 w-3" />
                  {code.split("\n").length} lines
                </span>
                <span>{code.length} chars</span>
                <span className="hidden text-pulse-500/80 sm:inline">UTF-8</span>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Editor
                ref={editorRef}
                code={code}
                onChange={setCode}
                onCaret={(ln, col) => setCaret({ ln, col })}
                onRun={run}
                errorLine={errorLine}
              />
            </div>
          </section>

          <section className="h-[38vh] shrink-0 lg:h-auto lg:w-[400px] xl:w-[450px]">
            <ConsolePanel
              entries={entries}
              problems={problems}
              tab={tab}
              onTab={setTab}
              onClear={() => setEntries([])}
              onJump={jumpTo}
              running={running}
              hasRun={hasRun}
              needsInput={needsInput}
              stdin={stdin}
              onStdin={setStdin}
              timeMs={stats?.timeMs ?? null}
              onRun={run}
            />
          </section>
        </main>
      </div>

      {/* ================= status bar ================= */}
      <footer className="relative z-20 flex h-7 shrink-0 items-center gap-3 border-t border-ink-700/60 bg-ink-900/90 px-3 font-mono text-[10.5px] text-mist-500">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full transition-colors ${statusDot}`} />
          {stage === "error" ? "failed" : running ? "working…" : stage === "done" ? "ready" : "idle"}
        </span>
        <span className="hidden text-mist-600 sm:inline">main.cpp</span>
        {savedAt && (
          <span key={savedAt} className="entry-in hidden items-center gap-1 text-mist-600 md:flex">
            <IconCheck className="h-3 w-3 text-pulse-500" />
            autosaved {savedAt}
          </span>
        )}
        <span className="ml-auto hidden sm:inline">tokens {stats ? stats.tokens : "—"}</span>
        <span className="hidden sm:inline">last run {stats ? `${stats.timeMs < 1 ? stats.timeMs.toFixed(2) : Math.round(stats.timeMs)} ms` : "—"}</span>
        <span>
          Ln {caret.ln}, Col {caret.col}
        </span>
        <span className="hidden text-mist-600 sm:inline">{std}</span>
      </footer>

      {/* ================= toast ================= */}
      {toast && (
        <div
          key={toast.id}
          className={`toast-in fixed bottom-10 right-4 z-50 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium shadow-[0_12px_36px_-8px_rgba(0,0,0,0.7)] ${
            toast.tone === "ok"
              ? "border-pulse-500/40 bg-ink-800 text-pulse-300"
              : toast.tone === "err"
                ? "border-coral-500/40 bg-ink-800 text-coral-300"
                : "border-ink-600 bg-ink-800 text-mist-200"
          }`}
        >
          {toast.tone === "ok" ? <IconCheck className="h-4 w-4" /> : toast.tone === "err" ? <IconError className="h-4 w-4" /> : <IconCode className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
      
      {/* ================= input warning ================= */}
      {inputWarning && (
        <div className="toast-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-ember-500/40 bg-ink-800 px-4 py-2.5 text-[13px] font-medium text-ember-300 shadow-[0_12px_36px_-8px_rgba(0,0,0,0.7)]">
          <IconError className="h-4 w-4" />
          Please enter input before running this program.
        </div>
      )}
      
      {/* ================= settings popup ================= */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={(s) => {
          setSettings(s);
          saveSettings(s);
          showToast("Settings saved", "ok");
        }}
      />
      
      {/* ================= pro popup ================= */}
      <ProPopup isOpen={proOpen} onClose={() => setProOpen(false)} />
    </div>
  );
}
