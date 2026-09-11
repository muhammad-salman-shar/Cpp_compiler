import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { highlight } from "../lib/highlight";

const LINE_H = 22;
const PAD = 16;

export interface EditorHandle {
  jumpTo: (line: number, col?: number) => void;
  focus: () => void;
}

interface EditorProps {
  code: string;
  onChange: (code: string) => void;
  onCaret: (line: number, col: number) => void;
  onRun: () => void;
  errorLine: number | null;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: boolean;
  lineNumbers?: boolean;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { code, onChange, onCaret, onRun, errorLine, fontSize = 14, tabSize = 4, wordWrap = false, lineNumbers = true },
  ref
) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });

  const lines = useMemo(() => code.split("\n"), [code]);
  const html = useMemo(() => highlight(code) + (code.endsWith("\n") ? " " : ""), [code]);

  const reportCaret = () => {
    const ta = taRef.current;
    if (!ta) return;
    const upto = code.slice(0, ta.selectionStart);
    const line = upto.split("\n").length;
    const col = ta.selectionStart - (upto.lastIndexOf("\n") + 1) + 1;
    onCaret(line, col);
  };

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    setScroll({ top: ta.scrollTop, left: ta.scrollLeft });
  };

  const replaceRange = (from: number, to: number, text: string, caret: number) => {
    const next = code.slice(0, from) + text + code.slice(to);
    onChange(next);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(caret, caret); reportCaretAt(next, caret); }
    });
  };

  const reportCaretAt = (src: string, pos: number) => {
    const upto = src.slice(0, pos);
    onCaret(upto.split("\n").length, pos - (upto.lastIndexOf("\n") + 1) + 1);
  };

  const tabStr = " ".repeat(tabSize);
  
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRun();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      replaceRange(ta.selectionStart, ta.selectionEnd, tabStr, ta.selectionStart + tabSize);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const start = ta.selectionStart;
      const lineStart = code.lastIndexOf("\n", start - 1) + 1;
      const lineText = code.slice(lineStart, start);
      const indent = (lineText.match(/^[ \t]*/) ?? [""])[0];
      const extra = /\{\s*$/.test(lineText) ? tabStr : "";
      const insert = "\n" + indent + extra;
      replaceRange(ta.selectionStart, ta.selectionEnd, insert, start + insert.length);
    }
  };

  useImperativeHandle(ref, () => ({
    jumpTo(line: number, col = 1) {
      const ta = taRef.current;
      if (!ta) return;
      const ls = code.split("\n");
      let offset = 0;
      for (let i = 0; i < Math.min(line - 1, ls.length); i++) offset += ls[i].length + 1;
      offset += Math.max(0, col - 1);
      ta.focus();
      ta.setSelectionRange(offset, offset);
      ta.scrollTop = Math.max(0, (line - 6) * LINE_H);
      reportCaretAt(code, offset);
    },
    focus() { taRef.current?.focus(); },
  }));

  return (
    <div className="flex h-full min-h-0 bg-ink-850">
      {/* line-number gutter */}
      {lineNumbers && (
        <div
          ref={gutterRef}
          className="w-12 shrink-0 select-none overflow-hidden border-r border-ink-700/60 bg-ink-900/70 text-right font-mono text-mist-600"
          style={{ paddingTop: PAD, paddingBottom: PAD, fontSize: `${fontSize * 0.82}px`, lineHeight: `${fontSize * 1.57}px` }}
        >
          {lines.map((_, i) => {
            const n = i + 1;
            const isErr = errorLine === n;
            return (
              <div
                key={n}
                className={`pr-3 transition-colors duration-200 ${isErr ? "bg-coral-500/15 font-semibold text-coral-400" : ""}`}
                style={{ height: fontSize * 1.57 }}
              >
                {n}
              </div>
            );
          })}
        </div>
      )}

      {/* code area: highlighted pre under a transparent textarea */}
      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden
          className="ed-metrics pointer-events-none absolute inset-0 m-0 overflow-hidden text-mist-200"
          style={{ padding: PAD, fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.57}px`, tabSize: tabSize, whiteSpace: wordWrap ? "pre-wrap" : "pre", wordBreak: wordWrap ? "break-word" : "normal" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {/* error line wash */}
        {errorLine !== null && errorLine <= lines.length && (
          <div
            className="pointer-events-none absolute left-0 right-0 border-l-2 border-coral-500 bg-coral-500/10"
            style={{ top: PAD + (errorLine - 1) * fontSize * 1.57 - scroll.top, height: fontSize * 1.57 }}
          />
        )}
        <textarea
          ref={taRef}
          className="ed-metrics editor-textarea absolute inset-0 h-full w-full overflow-auto"
          style={{ padding: PAD, fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.57}px`, tabSize: tabSize, whiteSpace: wordWrap ? "pre-wrap" : "pre", wordBreak: wordWrap ? "break-word" : "normal" }}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onKeyUp={reportCaret}
          onClick={reportCaret}
          onSelect={reportCaret}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="// write C++ here…"
        />
      </div>
    </div>
  );
});
