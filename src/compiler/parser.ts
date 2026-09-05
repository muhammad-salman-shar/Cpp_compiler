import { CompileError } from "./types";
import type {
  Token, Program, Decl, FuncDef, Param, Stmt, Expr, CType, Block, VarDecl,
} from "./types";

const TYPE_KWS = new Set(["int", "float", "double", "char", "bool", "void", "long", "unsigned", "string", "size_t", "auto"]);
const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%="]);

export function parse(tokens: Token[], source: string): Program {
  return new Parser(tokens, source.split("\n")).parseProgram();
}

class Parser {
  private toks: Token[];
  private pos = 0;
  private lines: string[];

  constructor(toks: Token[], lines: string[]) {
    this.toks = toks;
    this.lines = lines;
  }

  /* ------------------------- token helpers ------------------------- */

  private peek(off = 0): Token { return this.toks[Math.min(this.pos + off, this.toks.length - 1)]; }
  private next(): Token { const t = this.peek(); if (t.kind !== "eof") this.pos++; return t; }

  private check(kind: Token["kind"], v?: string): boolean {
    const t = this.peek();
    return t.kind === kind && (v === undefined || t.v === v);
  }
  private match(kind: Token["kind"], v?: string): boolean {
    if (this.check(kind, v)) { this.pos++; return true; }
    return false;
  }
  private expect(kind: Token["kind"], v?: string, what?: string, hint?: string): Token {
    if (this.check(kind, v)) return this.next();
    const t = this.peek();
    const want = what ?? (v ? `'${v}'` : kind);
    const found = t.kind === "eof" ? "end of file" : `'${t.v}'`;
    throw this.errAt(t, `expected ${want} but found ${found}`, hint);
  }
  private errAt(t: Token, msg: string, hint?: string): CompileError {
    return new CompileError(msg, t.line, t.col, this.lines[t.line - 1], hint);
  }

  /* ---------------------------- program ---------------------------- */

  parseProgram(): Program {
    const decls: Decl[] = [];
    while (!this.check("eof")) {
      if (this.check("pun", ";")) { this.next(); continue; }
      if (this.check("kw", "using")) { this.parseUsing(); continue; }
      decls.push(this.parseTopLevel());
    }
    return { node: "program", decls };
  }

  private parseUsing(): void {
    this.expect("kw", "using");
    this.expect("kw", "namespace", undefined);
    this.expect("kw", "std", "'std' — only `using namespace std;` is supported");
    this.expect("pun", ";", ";");
  }

  private parseTopLevel(): Decl {
    if (!this.isTypeStart() && !this.check("kw", "const")) {
      const t = this.peek();
      throw this.errAt(t, `expected a function or global variable declaration`, "top-level code must live inside a function — usually main()");
    }
    // function?  type ident ( … ) { … }
    if (this.looksLikeFunction()) return this.parseFunction();
    return this.parseVarDecl(true);
  }

  private looksLikeFunction(): boolean {
    // scan: type name (
    const save = this.pos;
    try {
      this.parseType(false);
      if (!this.check("ident")) return false;
      return this.peek(1).kind === "pun" && this.peek(1).v === "(";
    } catch {
      return false;
    } finally {
      this.pos = save;
    }
  }

  private parseFunction(): FuncDef {
    const start = this.peek();
    const retType = this.parseType(false);
    const name = this.expect("ident", undefined, "a function name").v;
    this.expect("pun", "(");
    const params: Param[] = [];
    if (!this.check("pun", ")")) {
      // tolerate `void` param list
      if (this.check("kw", "void") && this.peek(1).kind === "pun" && this.peek(1).v === ")") this.next();
      else {
        do {
          const pline = this.peek().line;
          const type = this.parseType(false);
          const isRef1 = this.match("pun", "&");
          const pname = this.expect("ident", undefined, "a parameter name").v;
          const isRef2 = this.match("pun", "&");
          params.push({ type, name: pname, isRef: isRef1 || isRef2, line: pline });
        } while (this.match("pun", ","));
      }
    }
    this.expect("pun", ")");
    const body = this.parseBlock();
    return { node: "func", name, retType, params, body, line: start.line };
  }

  /* ----------------------------- types ----------------------------- */

  private isTypeStart(): boolean {
    const t = this.peek();
    if (t.kind === "kw" && TYPE_KWS.has(t.v)) return true;
    if (t.kind === "kw" && t.v === "std" && this.peek(1).kind === "pun" && this.peek(1).v === "::") {
      const after = this.peek(2);
      return after.kind === "kw" || (after.kind === "ident" && after.v === "vector");
    }
    if (t.kind === "ident" && t.v === "vector" && this.peek(1).kind === "pun" && this.peek(1).v === "<") return true;
    return false;
  }

  private parseType(allowAuto: boolean): CType {
    if (this.check("kw", "std") && this.peek(1).v === "::") { this.next(); this.next(); }
    const t = this.peek();
    if (t.kind === "kw") {
      switch (t.v) {
        case "int": case "long": case "unsigned": case "size_t": this.next(); this.eatIntModifiers(); return { kind: "int" };
        case "float": case "double": this.next(); return { kind: "double" };
        case "char": this.next(); return { kind: "char" };
        case "bool": this.next(); return { kind: "bool" };
        case "void": this.next(); return { kind: "void" };
        case "string": this.next(); return { kind: "string" };
        case "auto":
          if (!allowAuto) throw this.errAt(t, `'auto' is only allowed in variable declarations`);
          this.next(); return { kind: "auto" };
      }
    }
    if (t.kind === "ident" && t.v === "vector" && this.peek(1).v === "<") {
      this.next(); this.next();
      const elem = this.parseType(false);
      this.expect("pun", ">", ">");
      return { kind: "vector", elem };
    }
    throw this.errAt(t, `expected a type`, "supported types: int, double, char, bool, string, vector<T>, auto");
  }

  private eatIntModifiers(): void {
    while (this.check("kw", "long") || this.check("kw", "unsigned") || this.check("kw", "int")) this.next();
  }

  /* --------------------------- statements -------------------------- */

  private parseBlock(): Block {
    const start = this.expect("pun", "{", "{");
    const stmts: Stmt[] = [];
    while (!this.check("pun", "}") && !this.check("eof")) stmts.push(this.parseStatement());
    this.expect("pun", "}", "}", "unclosed block — every { needs a matching }");
    return { node: "block", stmts, line: start.line };
  }

  private parseStatement(): Stmt {
    const t = this.peek();

    if (this.check("pun", "{")) return this.parseBlock();
    if (this.check("pun", ";")) { this.next(); return { node: "empty", line: t.line }; }

    if (t.kind === "kw") {
      switch (t.v) {
        case "if": return this.parseIf();
        case "while": return this.parseWhile();
        case "do": return this.parseDoWhile();
        case "for": return this.parseFor();
        case "return": {
          this.next();
          const node: Stmt = this.check("pun", ";")
            ? { node: "return", line: t.line }
            : { node: "return", value: this.parseExpression(), line: t.line };
          this.expect("pun", ";", ";", "statements end with a semicolon");
          return node;
        }
        case "break": this.next(); this.expect("pun", ";", ";"); return { node: "break", line: t.line };
        case "continue": this.next(); this.expect("pun", ";", ";"); return { node: "continue", line: t.line };
        case "cout": return this.parseCout();
        case "cin": return this.parseCin();
      }
    }

    if (t.kind === "ident" && t.v === "getline" && this.peek(1).v === "(") return this.parseGetline();

    if (this.isTypeStart() || this.check("kw", "const")) return this.parseVarDecl(false);

    const expr = this.parseExpression();
    this.expect("pun", ";", ";", "statements end with a semicolon");
    return { node: "exprstmt", expr, line: t.line };
  }

  private parseIf(): Stmt {
    const start = this.next(); // if
    this.expect("pun", "(", "(");
    const cond = this.parseExpression();
    this.expect("pun", ")", ")");
    const then = this.parseStatement();
    let els: Stmt | undefined;
    if (this.match("kw", "else")) els = this.parseStatement();
    return { node: "if", cond, then, else: els, line: start.line };
  }

  private parseWhile(): Stmt {
    const start = this.next();
    this.expect("pun", "(", "(");
    const cond = this.parseExpression();
    this.expect("pun", ")", ")");
    const body = this.parseStatement();
    return { node: "while", cond, body, line: start.line };
  }

  private parseDoWhile(): Stmt {
    const start = this.next();
    const body = this.parseStatement();
    this.expect("kw", "while", "while", "a do block must be followed by while (…)");
    this.expect("pun", "(", "(");
    const cond = this.parseExpression();
    this.expect("pun", ")", ")");
    this.expect("pun", ";", ";");
    return { node: "dowhile", body, cond, line: start.line };
  }

  private parseFor(): Stmt {
    const start = this.next(); // for
    this.expect("pun", "(", "(");

    // range-based?  for (Type x : container)
    if (this.isTypeStart() || this.check("kw", "const")) {
      const save = this.pos;
      try {
        const type = this.parseType(true);
        const name = this.expect("ident", undefined, "a variable name").v;
        if (this.match("pun", ":")) {
          const target = this.parseExpression();
          this.expect("pun", ")", ")");
          const body = this.parseStatement();
          return { node: "forrange", type, name, target, body, line: start.line };
        }
      } catch {
        /* fall through to classic for */
      }
      this.pos = save;
    }

    let init: Stmt | null = null;
    if (!this.check("pun", ";")) {
      if (this.isTypeStart() || this.check("kw", "const")) init = this.parseVarDecl(false); // consumes ;
      else {
        const expr = this.parseExpression();
        this.expect("pun", ";", ";");
        init = { node: "exprstmt", expr, line: start.line };
      }
    } else this.next();

    let cond: Expr | null = null;
    if (!this.check("pun", ";")) cond = this.parseExpression();
    this.expect("pun", ";", ";");

    let step: Expr | null = null;
    if (!this.check("pun", ")")) step = this.parseExpression();
    this.expect("pun", ")", ")");
    const body = this.parseStatement();
    return { node: "for", init, cond, step, body, line: start.line };
  }

  private parseCout(): Stmt {
    const start = this.next(); // cout
    const parts: (Expr | "endl")[] = [];
    if (!this.check("pun", "<<")) throw this.errAt(this.peek(), "expected << after cout");
    while (this.match("pun", "<<")) {
      if (this.check("kw", "endl")) { this.next(); parts.push("endl"); continue; }
      if (this.check("str", "\n") || this.check("chr", "\n")) { this.next(); parts.push("endl"); continue; }
      parts.push(this.parseExpression());
    }
    this.expect("pun", ";", ";", "statements end with a semicolon");
    return { node: "cout", parts, line: start.line };
  }

  private parseCin(): Stmt {
    const start = this.next(); // cin
    const targets: Expr[] = [];
    if (!this.check("pun", ">>")) throw this.errAt(this.peek(), "expected >> after cin");
    while (this.match("pun", ">>")) {
      const tk = this.peek();
      if (tk.kind === "ident") { this.next(); targets.push({ node: "ident", name: tk.v, line: tk.line, col: tk.col }); }
      else if (tk.kind === "kw" && tk.v === "std" && this.peek(1).v === "::" && this.peek(2).kind === "ident") {
        this.next(); this.next();
        const id = this.next();
        targets.push({ node: "ident", name: id.v, line: id.line, col: id.col });
      } else throw this.errAt(tk, "expected a variable name after >>", "cin reads into variables, e.g. cin >> x;");
      // optional [index]
      if (this.check("pun", "[")) {
        this.next();
        const index = this.parseExpression();
        this.expect("pun", "]", "]");
        targets.push({ node: "index", obj: targets.pop()!, index, line: tk.line });
      }
    }
    this.expect("pun", ";", ";", "statements end with a semicolon");
    return { node: "cin", targets, line: start.line };
  }

  private parseGetline(): Stmt {
    const start = this.next(); // getline
    this.expect("pun", "(");
    if (!(this.check("kw", "cin") || (this.check("kw", "std") && this.peek(1).v === "::")))
      throw this.errAt(this.peek(), "expected cin as first argument", "usage: getline(cin, s);");
    if (this.check("kw", "std")) { this.next(); this.next(); }
    this.next(); // cin
    this.expect("pun", ",");
    const id = this.expect("ident", undefined, "a string variable name");
    this.expect("pun", ")");
    this.expect("pun", ";", ";");
    return { node: "getline", target: id.v, line: start.line };
  }

  private parseVarDecl(topLevel: boolean): VarDecl {
    const start = this.peek();
    const isConst = this.match("kw", "const");
    const type = this.parseType(true);
    const decls: { name: string; init?: Expr; line: number }[] = [];
    do {
      const dline = this.peek().line;
      const name = this.expect("ident", undefined, "a variable name").v;
      let init: Expr | undefined;
      if (this.match("pun", "=")) {
        if (type.kind === "vector" && this.check("pun", "{")) {
          const lb = this.next();
          const items: Expr[] = [];
          if (!this.check("pun", "}")) {
            do { items.push(this.parseExpression()); } while (this.match("pun", ","));
          }
          this.expect("pun", "}", "}");
          init = { node: "vecinit", items, line: lb.line };
        } else init = this.parseExpression();
      } else if (type.kind === "vector" && this.check("pun", "(")) {
        // vector<int> v(5); or v(5, 0)
        const lb = this.next();
        const first = this.parseExpression();
        let fill: Expr | undefined;
        if (this.match("pun", ",")) fill = this.parseExpression();
        this.expect("pun", ")");
        init = this.expandVectorCtor(lb.line, fill ? [first, fill] : [first]);
      } else if (type.kind === "vector" && this.check("pun", "{")) {
        const lb = this.next();
        const items: Expr[] = [];
        if (!this.check("pun", "}")) do { items.push(this.parseExpression()); } while (this.match("pun", ","));
        this.expect("pun", "}");
        init = { node: "vecinit", items, line: lb.line };
      }
      decls.push({ name, init, line: dline });
    } while (this.match("pun", ","));
    this.expect("pun", ";", ";", "declarations end with a semicolon");
    void topLevel;
    return { node: "vardecl", type, isConst, decls, line: start.line };
  }

  /** vector<T> v(n) / v(n, x)  →  desugared loop-free equivalent via vecinit is not possible
   *  before evaluation, so emit a call to the built-in `__vec(n, x)` resolved at runtime. */
  private expandVectorCtor(line: number, args: Expr[]): Expr {
    return { node: "call", name: "__vec", args, line };
  }

  /* --------------------------- expressions -------------------------- */

  parseExpression(): Expr { return this.parseAssign(); }

  private parseAssign(): Expr {
    const left = this.parseTernary();
    const t = this.peek();
    if (t.kind === "pun" && ASSIGN_OPS.has(t.v)) {
      this.assertAssignable(left);
      this.next();
      const value = this.parseAssign();
      if (t.v === "=") return { node: "assign", target: left, value, line: t.line };
      return { node: "compound", op: t.v, target: left, value, line: t.line };
    }
    return left;
  }

  private assertAssignable(e: Expr): void {
    if (e.node === "ident" || e.node === "index") return;
    throw this.errAt(this.peek(), "expression is not assignable", "you can only assign to variables or vector elements");
  }

  private parseTernary(): Expr {
    const cond = this.parseOr();
    if (this.match("pun", "?")) {
      const a = this.parseAssign();
      this.expect("pun", ":", ":", "a ternary needs both ? and :");
      const b = this.parseTernary();
      return { node: "ternary", cond, a, b, line: cond.line };
    }
    return cond;
  }

  private parseOr(): Expr {
    let l = this.parseAnd();
    while (this.check("pun", "||")) { const op = this.next(); const r = this.parseAnd(); l = { node: "logical", op: "||", l, r, line: op.line }; }
    return l;
  }
  private parseAnd(): Expr {
    let l = this.parseEquality();
    while (this.check("pun", "&&")) { const op = this.next(); const r = this.parseEquality(); l = { node: "logical", op: "&&", l, r, line: op.line }; }
    return l;
  }
  private parseEquality(): Expr {
    let l = this.parseRel();
    while (this.check("pun", "==") || this.check("pun", "!=")) { const op = this.next(); const r = this.parseRel(); l = { node: "binary", op: op.v, l, r, line: op.line }; }
    return l;
  }
  private parseRel(): Expr {
    let l = this.parseAdd();
    while (["<", ">", "<=", ">="].some((o) => this.check("pun", o))) { const op = this.next(); const r = this.parseAdd(); l = { node: "binary", op: op.v, l, r, line: op.line }; }
    return l;
  }
  private parseAdd(): Expr {
    let l = this.parseMul();
    while (this.check("pun", "+") || this.check("pun", "-")) { const op = this.next(); const r = this.parseMul(); l = { node: "binary", op: op.v, l, r, line: op.line }; }
    return l;
  }
  private parseMul(): Expr {
    let l = this.parseUnary();
    while (this.check("pun", "*") || this.check("pun", "/") || this.check("pun", "%")) { const op = this.next(); const r = this.parseUnary(); l = { node: "binary", op: op.v, l, r, line: op.line }; }
    return l;
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.kind === "pun" && (t.v === "!" || t.v === "-" || t.v === "+")) {
      this.next();
      return { node: "unary", op: t.v as "!" | "-" | "+", e: this.parseUnary(), line: t.line };
    }
    if (t.kind === "pun" && (t.v === "++" || t.v === "--")) {
      this.next();
      const target = this.parseUnary();
      this.assertAssignable(target);
      return { node: "incdec", op: t.v as "++" | "--", prefix: true, target, line: t.line };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      if (this.check("pun", "(")) {
        if (e.node !== "ident") throw this.errAt(this.peek(), "only named functions can be called");
        this.next();
        const args: Expr[] = [];
        if (!this.check("pun", ")")) do { args.push(this.parseExpression()); } while (this.match("pun", ","));
        this.expect("pun", ")");
        e = { node: "call", name: e.name, args, line: e.line };
        continue;
      }
      if (this.check("pun", "[")) {
        this.next();
        const index = this.parseExpression();
        const close = this.peek();
        this.expect("pun", "]", "]");
        e = { node: "index", obj: e, index, line: close.line };
        continue;
      }
      if (this.check("pun", ".")) {
        this.next();
        const m = this.expect("ident", undefined, "a member name");
        this.expect("pun", "(", "(", `member '${m.v}' must be called, e.g. .${m.v}()`);
        const args: Expr[] = [];
        if (!this.check("pun", ")")) do { args.push(this.parseExpression()); } while (this.match("pun", ","));
        this.expect("pun", ")");
        e = { node: "method", obj: e, name: m.v, args, line: m.line };
        continue;
      }
      if (this.check("pun", "++") || this.check("pun", "--")) {
        const op = this.next();
        this.assertAssignable(e);
        e = { node: "incdec", op: op.v as "++" | "--", prefix: false, target: e, line: op.line };
        continue;
      }
      break;
    }
    return e;
  }

  private parsePrimary(): Expr {
    const t = this.peek();

    if (t.kind === "num") {
      this.next();
      const isDouble = t.v.includes(".") || t.v.includes("e") || t.v.includes("E");
      return { node: "num", value: Number(t.v), isDouble, line: t.line };
    }
    if (t.kind === "str") { this.next(); return { node: "str", value: t.v, line: t.line }; }
    if (t.kind === "chr") { this.next(); return { node: "chr", value: t.v, line: t.line }; }
    if (t.kind === "kw" && t.v === "true") { this.next(); return { node: "bool", value: true, line: t.line }; }
    if (t.kind === "kw" && t.v === "false") { this.next(); return { node: "bool", value: false, line: t.line }; }
    if (t.kind === "kw" && t.v === "endl") throw this.errAt(t, "'endl' is only valid inside a cout chain", "use cout << endl;");
    if (t.kind === "kw" && t.v === "std" && this.peek(1).v === "::") {
      this.next(); this.next();
      return this.parsePrimary();
    }
    if (t.kind === "ident") { this.next(); return { node: "ident", name: t.v, line: t.line, col: t.col }; }
    if (t.kind === "pun" && t.v === "(") {
      this.next();
      const e = this.parseExpression();
      this.expect("pun", ")", ")");
      return e;
    }
    if (t.kind === "pun" && t.v === "{") {
      const lb = this.next();
      const items: Expr[] = [];
      if (!this.check("pun", "}")) do { items.push(this.parseExpression()); } while (this.match("pun", ","));
      this.expect("pun", "}");
      return { node: "vecinit", items, line: lb.line };
    }
    const found = t.kind === "eof" ? "end of file" : `'${t.v}'`;
    throw this.errAt(t, `expected an expression but found ${found}`);
  }
}
