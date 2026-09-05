import { CompileError, type Token } from "./types";

export const KEYWORDS = new Set([
  // types
  "int", "float", "double", "char", "bool", "void", "auto", "long", "unsigned", "string", "size_t",
  // control flow
  "if", "else", "while", "do", "for", "return", "break", "continue",
  // misc
  "const", "true", "false", "using", "namespace", "std", "cout", "cin", "endl",
]);

const PUNCT_MULTI = ["==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "<<", ">>", "::"];
const PUNCT_SINGLE = new Set("+-*/%=<>!(){}[];,.:?&|");

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", "\\": "\\", '"': '"', "'": "'", "0": "\0", r: "\r" };

export interface LexResult {
  tokens: Token[];
  directives: number;
}

export function lex(source: string): LexResult {
  const toks: Token[] = [];
  const lines = source.split("\n");
  let i = 0;
  let line = 1;
  let col = 1;
  let directives = 0;

  const err = (msg: string, l: number, c: number, hint?: string): CompileError =>
    new CompileError(msg, l, c, lines[l - 1], hint);

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (source[i] === "\n") { line++; col = 1; } else { col++; }
      i++;
    }
  };

  while (i < source.length) {
    const ch = source[i];

    // whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { advance(); continue; }

    // preprocessor directives — accepted and skipped (this is a subset compiler)
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") advance();
      directives++;
      continue;
    }

    // comments
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") advance();
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const sl = line, sc = col;
      advance(2);
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) advance();
      if (i >= source.length) throw err("unterminated block comment", sl, sc, "close it with */");
      advance(2);
      continue;
    }

    // string literal
    if (ch === '"') {
      const sl = line, sc = col;
      advance();
      let val = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\n") throw err("unterminated string literal", sl, sc, 'add the closing "');
        if (source[i] === "\\") {
          advance();
          const e = source[i];
          if (e === undefined) break;
          val += ESCAPES[e] ?? e;
          advance();
        } else { val += source[i]; advance(); }
      }
      if (i >= source.length) throw err("unterminated string literal", sl, sc, 'add the closing "');
      advance(); // closing quote
      toks.push({ kind: "str", v: val, line: sl, col: sc });
      continue;
    }

    // char literal
    if (ch === "'") {
      const sl = line, sc = col;
      advance();
      let val = "";
      if (source[i] === "\\") {
        advance();
        val = ESCAPES[source[i]] ?? source[i];
        advance();
      } else { val = source[i] ?? ""; advance(); }
      if (source[i] !== "'") throw err("unterminated character literal", sl, sc, "close it with '");
      advance();
      toks.push({ kind: "chr", v: val, line: sl, col: sc });
      continue;
    }

    // numbers (decimal, float, hex, suffixes stripped)
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      const sl = line, sc = col;
      let raw = "";
      if (ch === "0" && (source[i + 1] === "x" || source[i + 1] === "X")) {
        raw = "0x"; advance(2);
        while (i < source.length && /[0-9a-fA-F]/.test(source[i])) { raw += source[i]; advance(); }
        toks.push({ kind: "num", v: raw, line: sl, col: sc });
      } else {
        while (i < source.length && /[0-9]/.test(source[i])) { raw += source[i]; advance(); }
        if (source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
          raw += "."; advance();
          while (i < source.length && /[0-9]/.test(source[i])) { raw += source[i]; advance(); }
        }
        if (source[i] === "e" || source[i] === "E") {
          let j = i + 1;
          if (source[j] === "+" || source[j] === "-") j++;
          if (/[0-9]/.test(source[j] ?? "")) {
            raw += source[i]; advance();
            if (source[i] === "+" || source[i] === "-") { raw += source[i]; advance(); }
            while (i < source.length && /[0-9]/.test(source[i])) { raw += source[i]; advance(); }
          }
        }
        // strip literal suffixes (f, u, ll…)
        while (i < source.length && /[a-zA-Z]/.test(source[i])) advance();
        toks.push({ kind: "num", v: raw, line: sl, col: sc });
      }
      continue;
    }

    // identifiers & keywords
    if (/[A-Za-z_]/.test(ch)) {
      const sl = line, sc = col;
      let name = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) { name += source[i]; advance(); }
      toks.push({ kind: KEYWORDS.has(name) ? "kw" : "ident", v: name, line: sl, col: sc });
      continue;
    }

    // punctuation (multi-char first)
    const two = source.slice(i, i + 2);
    if (PUNCT_MULTI.includes(two)) {
      toks.push({ kind: "pun", v: two, line, col });
      advance(2);
      continue;
    }
    if (PUNCT_SINGLE.has(ch)) {
      toks.push({ kind: "pun", v: ch, line, col });
      advance();
      continue;
    }

    throw err(`unexpected character '${ch}'`, line, col, "this character is not part of the supported C++ subset");
  }

  toks.push({ kind: "eof", v: "", line, col });
  return { tokens: toks, directives };
}
