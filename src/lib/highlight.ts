/* Regex-based C++ syntax highlighter for the editor overlay.
 * It tokenizes the raw source and escapes each chunk, so the output
 * has exactly the same characters/line-breaks as the input. */

const MASTER = new RegExp(
  [
    String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/)`, // 1 comments
    String.raw`("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)`, // 2 strings & chars
    String.raw`(^[ \t]*#[^\n]*)`, // 3 preprocessor
    String.raw`(\b(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?[a-zA-Z]*\b)`, // 4 numbers
    String.raw`(\b(?:if|else|for|while|do|return|break|continue|switch|case|default)\b)`, // 5 control
    String.raw`(\b(?:int|float|double|char|bool|void|auto|const|long|unsigned|string|vector|size_t)\b)`, // 6 types
    String.raw`(\b(?:true|false|nullptr|NULL)\b)`, // 7 literals
    String.raw`(\b(?:cout|cin|endl|std|using|namespace|getline)\b)`, // 8 io / std
    String.raw`(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\())`, // 9 calls
  ].join("|"),
  "gm"
);

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function highlight(code: string): string {
  const out: string[] = [];
  let last = 0;
  MASTER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASTER.exec(code))) {
    const [full, com, str, pp, num, ctl, typ, lit, io] = m;
    out.push(escapeHtml(code.slice(last, m.index)));
    const cls = com
      ? "tk-com"
      : str
        ? "tk-str"
        : pp
          ? "tk-pp"
          : num
            ? "tk-num"
            : ctl
              ? "tk-ctl"
              : typ
                ? "tk-type"
                : lit
                  ? "tk-lit"
                  : io
                    ? "tk-io"
                    : "tk-fn";
    out.push(`<span class="${cls}">${escapeHtml(full)}</span>`);
    last = m.index + full.length;
    if (full.length === 0) MASTER.lastIndex++;
  }
  out.push(escapeHtml(code.slice(last)));
  return out.join("");
}
