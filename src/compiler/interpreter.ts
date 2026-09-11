import { RuntimeError, typeLabel } from "./types";
import type { Program, FuncDef, Stmt, Expr, CType, VarDecl } from "./types";

/* ------------------------------ runtime values ------------------------------ */

export interface Vec { __vec: true; elem: CType; items: RuntimeValue[] }
export type RuntimeValue = number | string | boolean | Vec;
export interface Val { v: RuntimeValue; t: CType }

interface Variable { value: RuntimeValue; type: CType; isConst: boolean }

class Scope {
  vars = new Map<string, Variable>();
  constructor(public parent: Scope | null) {}
  lookup(name: string): Variable | undefined {
    for (let s: Scope | null = this; s; s = s.parent) {
      const v = s.vars.get(name);
      if (v) return v;
    }
    return undefined;
  }
  define(name: string, variable: Variable): void { this.vars.set(name, variable); }
}

class BreakSig {}
class ContinueSig {}
class ReturnSig { constructor(public value: Val | null) {} }
export class InputPromptSignal extends Error {
  constructor(public outputSoFar: string) {
    super("Input required");
    this.name = "InputPromptSignal";
  }
}

const OP_LIMIT = 8_000_000;
const DEPTH_LIMIT = 256;

/* ------------------------------- stdin reader ------------------------------- */

class StdinReader {
  private lines: string[];
  private li = 0;
  private col = 0;
  constructor(text: string) { this.lines = text.replace(/\r/g, "").split("\n"); }

  nextToken(): string | null {
    for (;;) {
      if (this.li >= this.lines.length) return null;
      const line = this.lines[this.li];
      while (this.col < line.length && (line[this.col] === " " || line[this.col] === "\t")) this.col++;
      if (this.col >= line.length) { this.li++; this.col = 0; continue; }
      const start = this.col;
      while (this.col < line.length && line[this.col] !== " " && line[this.col] !== "\t") this.col++;
      return line.slice(start, this.col);
    }
  }

  nextLine(): string | null {
    if (this.li >= this.lines.length) return null;
    const rest = this.lines[this.li].slice(this.col);
    this.li++; this.col = 0;
    
    // If we read an empty line and we're now at EOF, treat it as EOF
    // This handles the case where input like "18\n" splits into ["18", ""]
    // and we need to prompt for more input instead of returning empty string
    if (rest === "" && this.li >= this.lines.length) {
      return null;
    }
    
    return rest;
  }

  nextChar(): string | null {
    if (this.li >= this.lines.length) return null;
    const line = this.lines[this.li];
    if (this.col >= line.length) {
      // Return newline and move to next line
      this.li++;
      this.col = 0;
      return "\n";
    }
    const ch = line[this.col];
    this.col++;
    return ch;
  }

  peek(): string | null {
    if (this.li >= this.lines.length) return null;
    const line = this.lines[this.li];
    if (this.col >= line.length) {
      return "\n";
    }
    return line[this.col];
  }

  eof(): boolean {
    return this.li >= this.lines.length;
  }
}

/* --------------------------------- context --------------------------------- */

export interface RunResult { exitCode: number; ops: number }

export interface InputRequest {
  prompt: string;
  resolve: (value: string) => void;
}

interface Ctx {
  funcs: Map<string, FuncDef>;
  globals: Scope;
  stdin: StdinReader;
  out: (line: string) => void;
  onInput?: (prompt: string) => Promise<string>;
  buffer: string;
  ops: number;
  depth: number;
}

const isVec = (v: RuntimeValue): v is Vec => typeof v === "object" && v !== null && (v as Vec).__vec === true;

function tick(ctx: Ctx, line?: number): void {
  ctx.ops++;
  if ((ctx.ops & 1023) === 0 && ctx.ops > OP_LIMIT)
    throw new RuntimeError(`time limit exceeded (${OP_LIMIT / 1e6}M operations) — possible infinite loop`, line);
}

/* ------------------------------- entry point ------------------------------- */

export function runProgram(program: Program, stdinText: string, onLine: (line: string) => void): RunResult {
  const ctx: Ctx = {
    funcs: new Map(),
    globals: new Scope(null),
    stdin: new StdinReader(stdinText),
    out: onLine,
    buffer: "",
    ops: 0,
    depth: 0,
  };

  for (const d of program.decls) if (d.node === "func") ctx.funcs.set(d.name, d);
  for (const d of program.decls) if (d.node === "vardecl") execVarDecl(d, ctx.globals, ctx);

  const main = ctx.funcs.get("main");
  if (!main) throw new RuntimeError("no main function defined — add `int main() { … }`", 1);

  let exitCode = 0;
  try {
    const ret = callFunction(main, [], ctx.globals, ctx, main.line);
    if (ret && typeof ret.v === "number") exitCode = Math.trunc(ret.v);
  } finally {
    if (ctx.buffer.length > 0) { ctx.out(ctx.buffer); ctx.buffer = ""; }
  }
  return { exitCode, ops: ctx.ops };
}

/* -------------------------------- statements -------------------------------- */

function execStmt(s: Stmt, scope: Scope, ctx: Ctx): void {
  tick(ctx, s.line);
  switch (s.node) {
    case "block": {
      const inner = new Scope(scope);
      for (const st of s.stmts) execStmt(st, inner, ctx);
      break;
    }
    case "vardecl": execVarDecl(s, scope, ctx); break;
    case "exprstmt": evaluate(s.expr, scope, ctx); break;
    case "empty": break;
    case "if":
      if (truthy(evaluate(s.cond, scope, ctx), s.line)) execStmt(s.then, scope, ctx);
      else if (s.else) execStmt(s.else, scope, ctx);
      break;
    case "while":
      while (truthy(evaluate(s.cond, scope, ctx), s.line)) {
        tick(ctx, s.line);
        try { execStmt(s.body, scope, ctx); }
        catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContinueSig) continue; throw e; }
      }
      break;
    case "dowhile":
      do {
        tick(ctx, s.line);
        try { execStmt(s.body, scope, ctx); }
        catch (e) { if (e instanceof BreakSig) break; if (!(e instanceof ContinueSig)) throw e; }
      } while (truthy(evaluate(s.cond, scope, ctx), s.line));
      break;
    case "for": {
      const fs = new Scope(scope);
      if (s.init) execStmt(s.init, fs, ctx);
      for (;;) {
        tick(ctx, s.line);
        if (s.cond && !truthy(evaluate(s.cond, fs, ctx), s.line)) break;
        try { execStmt(s.body, fs, ctx); }
        catch (e) { if (e instanceof BreakSig) break; if (!(e instanceof ContinueSig)) throw e; }
        if (s.step) evaluate(s.step, fs, ctx);
      }
      break;
    }
    case "forrange": {
      const target = evaluate(s.target, scope, ctx);
      const fs = new Scope(scope);
      const cell: Variable = { value: 0, type: { kind: "int" }, isConst: false };
      fs.define(s.name, cell);
      if (isVec(target.v)) {
        const elemType = target.v.elem;
        for (const item of [...target.v.items]) {
          tick(ctx, s.line);
          const resolved = s.type.kind === "auto" ? elemType : s.type;
          cell.value = coerce({ v: item, t: elemType }, resolved, s.line);
          cell.type = resolved;
          try { execStmt(s.body, fs, ctx); }
          catch (e) { if (e instanceof BreakSig) break; if (!(e instanceof ContinueSig)) throw e; }
        }
      } else if (typeof target.v === "string") {
        for (const ch of target.v) {
          tick(ctx, s.line);
          cell.value = ch; cell.type = { kind: "char" };
          try { execStmt(s.body, fs, ctx); }
          catch (e) { if (e instanceof BreakSig) break; if (!(e instanceof ContinueSig)) throw e; }
        }
      } else throw new RuntimeError("range-based for requires a vector or a string", s.line);
      break;
    }
    case "return": throw new ReturnSig(s.value ? evaluate(s.value, scope, ctx) : null);
    case "break": throw new BreakSig();
    case "continue": throw new ContinueSig();
    case "cout": {
      for (const part of s.parts) {
        if (part === "endl") { ctx.out(ctx.buffer); ctx.buffer = ""; continue; }
        ctx.buffer += fmtVal(evaluate(part, scope, ctx), s.line);
      }
      break;
    }
    case "cin": {
      for (const t of s.targets) {
        const cell = resolveLValue(t, scope, ctx);
        const tok = ctx.stdin.nextToken();
        if (tok === null) {
          // Flush buffer before signaling
          if (ctx.buffer.length > 0) {
            ctx.out(ctx.buffer);
            ctx.buffer = "";
          }
          throw new InputPromptSignal("");
        }
        cell.value = parseToken(tok, cell.type, s.line);
      }
      break;
    }
    case "getline": {
      const cell = scope.lookup(s.target);
      if (!cell) throw new RuntimeError(`undeclared variable '${s.target}'`, s.line);
      if (cell.type.kind !== "string") throw new RuntimeError(`getline needs a std::string variable, got ${typeLabel(cell.type)}`, s.line);
      const line = ctx.stdin.nextLine();
      if (line === null) {
        // Flush buffer before signaling
        if (ctx.buffer.length > 0) {
          ctx.out(ctx.buffer);
          ctx.buffer = "";
        }
        throw new InputPromptSignal("");
      }
      cell.value = line;
      break;
    }
    default: break;
  }
}

function execVarDecl(s: VarDecl, scope: Scope, ctx: Ctx): void {
  for (const d of s.decls) {
    let declaredType = s.type;
    let value: RuntimeValue;
    if (s.type.kind === "auto") {
      if (!d.init) throw new RuntimeError("'auto' needs an initializer", d.line);
      const init = evaluate(d.init, scope, ctx);
      declaredType = init.t.kind === "auto" ? { kind: "int" } : init.t;
      value = init.v;
    } else if (d.init) {
      if (d.init.node === "call" && d.init.name === "__vec") {
        if (declaredType.kind !== "vector") throw new RuntimeError("size constructor only works with vector", d.line);
        const vecType = declaredType;
        const n = Math.trunc(toNumber(evaluate(d.init.args[0], scope, ctx), d.line));
        if (n < 0) throw new RuntimeError("vector size cannot be negative", d.line);
        if (n > 1_000_000) throw new RuntimeError("vector too large (limit 1,000,000 elements)", d.line);
        const fill = d.init.args[1]
          ? coerce(evaluate(d.init.args[1], scope, ctx), vecType.elem, d.line)
          : defaultValue(vecType.elem);
        value = { __vec: true, elem: vecType.elem, items: Array.from({ length: n }, () => fill) };
      } else if (d.init.node === "vecinit") {
        if (declaredType.kind === "vector") {
          const vecType = declaredType;
          value = { __vec: true, elem: vecType.elem, items: d.init.items.map((it) => coerce(evaluate(it, scope, ctx), vecType.elem, d.line)) };
        } else if (declaredType.kind === "array") {
          const arrType = declaredType;
          const items = d.init.items.map((it) => coerce(evaluate(it, scope, ctx), arrType.elem, d.line));
          if (items.length > arrType.size) {
            throw new RuntimeError(`too many initializers for array of size ${arrType.size} (got ${items.length})`, d.line);
          }
          // Pad with default values if fewer initializers than size
          while (items.length < arrType.size) {
            items.push(defaultValue(arrType.elem));
          }
          value = { __vec: true, elem: arrType.elem, items };
        } else {
          throw new RuntimeError(`cannot use a brace list to initialize ${typeLabel(declaredType)}`, d.line);
        }
      } else {
        value = coerce(evaluate(d.init, scope, ctx), declaredType, d.line);
      }
    } else {
      if (declaredType.kind === "vector") {
        value = { __vec: true, elem: { kind: "int" }, items: [] };
      } else if (declaredType.kind === "array") {
        // Initialize array with default values
        const arrType = declaredType;
        const items = Array.from({ length: arrType.size }, () => defaultValue(arrType.elem));
        value = { __vec: true, elem: arrType.elem, items };
      } else {
        value = defaultValue(declaredType);
      }
    }
    if (scope.vars.has(d.name)) throw new RuntimeError(`redeclaration of '${d.name}' in the same scope`, d.line);
    scope.define(d.name, { value, type: declaredType, isConst: s.isConst });
  }
}

/* -------------------------------- expressions -------------------------------- */

function evaluate(e: Expr, scope: Scope, ctx: Ctx): Val {
  tick(ctx, e.line);
  switch (e.node) {
    case "num": return { v: e.value, t: { kind: e.isDouble ? "double" : "int" } };
    case "str": return { v: e.value, t: { kind: "string" } };
    case "chr": return { v: e.value, t: { kind: "char" } };
    case "bool": return { v: e.value, t: { kind: "bool" } };

    case "ident": {
      const cell = scope.lookup(e.name);
      if (cell) return { v: cell.value, t: cell.type };
      if (ctx.funcs.has(e.name)) throw new RuntimeError(`'${e.name}' is a function — call it with parentheses`, e.line);
      throw new RuntimeError(`undeclared variable '${e.name}'`, e.line);
    }

    case "vecinit":
      throw new RuntimeError("brace initializer lists are only allowed in variable declarations", e.line);

    case "unary": {
      const v = evaluate(e.e, scope, ctx);
      if (e.op === "!") return { v: !truthy(v, e.line), t: { kind: "bool" } };
      if (typeof v.v === "number") return { v: e.op === "-" ? -v.v : v.v, t: v.t.kind === "int" ? { kind: "int" } : { kind: "double" } };
      if (e.op === "-" && v.t.kind === "char") return { v: -code(v.v as string), t: { kind: "int" } };
      throw new RuntimeError(`unary '${e.op}' needs a numeric operand, got ${typeLabel(v.t)}`, e.line);
    }

    case "logical": {
      const l = evaluate(e.l, scope, ctx);
      if (e.op === "&&") return truthy(l, e.line) ? { v: truthy(evaluate(e.r, scope, ctx), e.line), t: { kind: "bool" } } : { v: false, t: { kind: "bool" } };
      return truthy(l, e.line) ? { v: true, t: { kind: "bool" } } : { v: truthy(evaluate(e.r, scope, ctx), e.line), t: { kind: "bool" } };
    }

    case "ternary":
      return truthy(evaluate(e.cond, scope, ctx), e.line) ? evaluate(e.a, scope, ctx) : evaluate(e.b, scope, ctx);

    case "binary":
      return binaryOp(e.op, evaluate(e.l, scope, ctx), evaluate(e.r, scope, ctx), e.line);

    case "assign": {
      const cell = resolveLValue(e.target, scope, ctx);
      if (cell.isConst) throw new RuntimeError("cannot assign to a const variable", e.line);
      const rhs = evaluate(e.value, scope, ctx);
      cell.value = coerce(rhs, targetTypeOf(cell, e.target, scope, ctx), e.line);
      return rhs;
    }

    case "compound": {
      const cell = resolveLValue(e.target, scope, ctx);
      if (cell.isConst) throw new RuntimeError("cannot assign to a const variable", e.line);
      const cur: Val = { v: cell.value, t: cell.type };
      const rhs = evaluate(e.value, scope, ctx);
      const op = e.op.slice(0, -1);
      if (op === "+" && cell.type.kind === "string") {
        cell.value = stringify(cur, e.line) + stringify(rhs, e.line);
      } else {
        const res = binaryOp(op, cur, rhs, e.line);
        cell.value = coerce(res, targetTypeOf(cell, e.target, scope, ctx), e.line);
      }
      return { v: cell.value, t: cell.type };
    }

    case "incdec": {
      const cell = resolveLValue(e.target, scope, ctx);
      if (cell.isConst) throw new RuntimeError("cannot modify a const variable", e.line);
      if (typeof cell.value !== "number") throw new RuntimeError("++ / -- needs a numeric variable", e.line);
      const old = cell.value;
      cell.value = old + (e.op === "++" ? 1 : -1);
      return { v: e.prefix ? cell.value : old, t: cell.type };
    }

    case "index": {
      const obj = evaluate(e.obj, scope, ctx);
      const idx = Math.trunc(toNumber(evaluate(e.index, scope, ctx), e.line));
      if (isVec(obj.v)) {
        if (idx < 0 || idx >= obj.v.items.length)
          throw new RuntimeError(`vector index ${idx} out of range (size ${obj.v.items.length})`, e.line);
        return { v: obj.v.items[idx], t: obj.v.elem };
      }
      if (typeof obj.v === "string") {
        if (idx < 0 || idx >= obj.v.length)
          throw new RuntimeError(`string index ${idx} out of range (length ${obj.v.length})`, e.line);
        return { v: obj.v[idx], t: { kind: "char" } };
      }
      throw new RuntimeError(`operator[] needs a vector or string, got ${typeLabel(obj.t)}`, e.line);
    }

    case "method": return callMethod(e, scope, ctx);

    case "call": return callExpr(e.name, e.args, scope, ctx, e.line);

    default: {
      const ex = e as { line?: number };
      throw new RuntimeError("unsupported expression", ex.line);
    }
  }
}

function targetTypeOf(cell: Variable, target: Expr, scope: Scope, ctx: Ctx): CType {
  if (target.node === "ident") return cell.type;
  if (target.node === "index") {
    const obj = evaluate(target.obj, scope, ctx);
    if (isVec(obj.v)) return obj.v.elem;
    return { kind: "char" };
  }
  return cell.type;
}

/* ------------------------------ operators & math ------------------------------ */

function binaryOp(op: string, l: Val, r: Val, line: number): Val {
  const lIsStr = l.t.kind === "string" || typeof l.v === "string";
  const rIsStr = r.t.kind === "string" || typeof r.v === "string";

  if ((lIsStr || rIsStr) && op === "+") return { v: stringify(l, line) + stringify(r, line), t: { kind: "string" } };
  if (lIsStr && rIsStr) {
    const a = l.v as string, b = r.v as string;
    const B = (v: boolean): Val => ({ v, t: { kind: "bool" } });
    switch (op) {
      case "==": return B(a === b);
      case "!=": return B(a !== b);
      case "<": return B(a < b);
      case ">": return B(a > b);
      case "<=": return B(a <= b);
      case ">=": return B(a >= b);
    }
    throw new RuntimeError(`operator '${op}' is not defined for strings`, line);
  }
  if (lIsStr || rIsStr) throw new RuntimeError(`operator '${op}' is not defined for strings`, line);

  // char arithmetic: char ± number → char
  if (l.t.kind === "char" && typeof r.v === "number" && (op === "+" || op === "-")) {
    const c = code(l.v as string) + (op === "+" ? Math.trunc(r.v) : -Math.trunc(r.v));
    return { v: String.fromCharCode(((c % 128) + 128) % 128), t: { kind: "char" } };
  }
  if (typeof l.v === "number" && r.t.kind === "char" && op === "+") {
    const c = Math.trunc(l.v) + code(r.v as string);
    return { v: String.fromCharCode(((c % 128) + 128) % 128), t: { kind: "char" } };
  }

  if (typeof l.v === "boolean" && typeof r.v === "boolean") {
    return compareOrArith(op, l.v ? 1 : 0, r.v ? 1 : 0, true, line);
  }
  if (typeof l.v === "number" && typeof r.v === "number") {
    const bothInt = l.t.kind === "int" && r.t.kind === "int";
    return compareOrArith(op, l.v, r.v, bothInt, line);
  }

  throw new RuntimeError(`operator '${op}' is not defined for ${typeLabel(l.t)} and ${typeLabel(r.t)}`, line);
}

function compareOrArith(op: string, a: number, b: number, bothInt: boolean, line: number): Val {
  const B = (v: boolean): Val => ({ v, t: { kind: "bool" } });
  switch (op) {
    case "==": return B(a === b);
    case "!=": return B(a !== b);
    case "<": return B(a < b);
    case ">": return B(a > b);
    case "<=": return B(a <= b);
    case ">=": return B(a >= b);
    case "+": return { v: a + b, t: { kind: bothInt ? "int" : "double" } };
    case "-": return { v: a - b, t: { kind: bothInt ? "int" : "double" } };
    case "*": return { v: a * b, t: { kind: bothInt ? "int" : "double" } };
    case "/":
      if (b === 0) throw new RuntimeError("division by zero", line);
      return bothInt ? { v: Math.trunc(a / b), t: { kind: "int" } } : { v: a / b, t: { kind: "double" } };
    case "%":
      if (Math.trunc(b) === 0) throw new RuntimeError("modulo by zero", line);
      return bothInt ? { v: Math.trunc(a) % Math.trunc(b), t: { kind: "int" } } : { v: a % b, t: { kind: "double" } };
  }
  throw new RuntimeError(`unknown operator '${op}'`, line);
}

/* --------------------------------- lvalues --------------------------------- */

function resolveLValue(e: Expr, scope: Scope, ctx: Ctx): Variable {
  if (e.node === "ident") {
    const cell = scope.lookup(e.name);
    if (!cell) throw new RuntimeError(`undeclared variable '${e.name}'`, e.line);
    return cell;
  }
  if (e.node === "index") {
    const obj = evaluate(e.obj, scope, ctx);
    const idx = Math.trunc(toNumber(evaluate(e.index, scope, ctx), e.line));
    if (isVec(obj.v)) {
      if (idx < 0 || idx >= obj.v.items.length)
        throw new RuntimeError(`vector index ${idx} out of range (size ${obj.v.items.length})`, e.line);
      const vec = obj.v;
      return {
        get value() { return vec.items[idx]; },
        set value(v: RuntimeValue) { vec.items[idx] = v; },
        type: vec.elem,
        isConst: false,
      };
    }
    if (typeof obj.v === "string") {
      if (idx < 0 || idx >= obj.v.length)
        throw new RuntimeError(`string index ${idx} out of range (length ${obj.v.length})`, e.line);
      const objExpr = e.obj;
      const s = obj.v;
      return {
        get value() { return s[idx]; },
        set value(v: RuntimeValue) {
          const ch = String(v)[0] ?? "\0";
          const src = resolveLValue(objExpr, scope, ctx);
          src.value = (src.value as string).slice(0, idx) + ch + (src.value as string).slice(idx + 1);
        },
        type: { kind: "char" },
        isConst: false,
      };
    }
    throw new RuntimeError("operator[] needs a vector or string", e.line);
  }
  throw new RuntimeError("expression is not assignable", e.line);
}

/* ---------------------------------- calls ---------------------------------- */

const BUILTINS = new Set([
  "sqrt", "pow", "abs", "fabs", "floor", "ceil", "round", "min", "max",
  "to_string", "stoi", "stod", "toupper", "tolower", "isdigit", "isalpha",
]);

function callExpr(name: string, args: Expr[], scope: Scope, ctx: Ctx, line: number): Val {
  if (name === "__vec")
    throw new RuntimeError("vector size constructor is only allowed in declarations, e.g. vector<int> v(5);", line);

  if (BUILTINS.has(name)) {
    const vals = args.map((a) => evaluate(a, scope, ctx));
    const need = (i: number): Val => vals[i] ?? ((): never => { throw new RuntimeError(`${name}() needs at least ${i + 1} argument${i ? "s" : ""}`, line); })();
    const num = (i: number) => toNumber(need(i), line);
    const D = (v: number): Val => ({ v, t: { kind: "double" } });
    const I = (v: number): Val => ({ v: Math.trunc(v), t: { kind: "int" } });
    switch (name) {
      case "sqrt": return D(Math.sqrt(num(0)));
      case "pow": return D(Math.pow(num(0), num(1)));
      case "abs": case "fabs": {
        const v = need(0);
        if (typeof v.v === "number") return v.t.kind === "int" ? I(Math.abs(v.v)) : D(Math.abs(v.v));
        return D(Math.abs(toNumber(v, line)));
      }
      case "floor": return I(Math.floor(num(0)));
      case "ceil": return I(Math.ceil(num(0)));
      case "round": return I(Math.round(num(0)));
      case "min": case "max": {
        const a = need(0), b = need(1);
        if (typeof a.v === "string" && typeof b.v === "string")
          return name === "min"
            ? { v: a.v <= b.v ? a.v : b.v, t: { kind: "string" } }
            : { v: a.v >= b.v ? a.v : b.v, t: { kind: "string" } };
        const an = toNumber(a, line), bn = toNumber(b, line);
        const r = name === "min" ? Math.min(an, bn) : Math.max(an, bn);
        return a.t.kind === "int" && b.t.kind === "int" ? I(r) : D(r);
      }
      case "to_string": return { v: stringify(need(0), line), t: { kind: "string" } };
      case "stoi": {
        const s = stringify(need(0), line);
        const n = Number.parseInt(s, 10);
        if (Number.isNaN(n)) throw new RuntimeError(`stoi: '${s}' is not an integer`, line);
        return I(n);
      }
      case "stod": {
        const s = stringify(need(0), line);
        const n = Number.parseFloat(s);
        if (Number.isNaN(n)) throw new RuntimeError(`stod: '${s}' is not a number`, line);
        return D(n);
      }
      case "toupper": return { v: strChar(need(0), name, line).toUpperCase(), t: { kind: "char" } };
      case "tolower": return { v: strChar(need(0), name, line).toLowerCase(), t: { kind: "char" } };
      case "isdigit": return { v: /^[0-9]$/.test(strChar(need(0), name, line)), t: { kind: "bool" } };
      case "isalpha": return { v: /^[A-Za-z]$/.test(strChar(need(0), name, line)), t: { kind: "bool" } };
    }
  }

  const fn = ctx.funcs.get(name);
  if (!fn) throw new RuntimeError(`no function named '${name}' — functions must be defined before they are called`, line);
  return callFunction(fn, args, scope, ctx, line) ?? { v: 0, t: { kind: "void" } };
}

function callFunction(fn: FuncDef, args: Expr[], callerScope: Scope, ctx: Ctx, line: number): Val | null {
  if (fn.params.length !== args.length)
    throw new RuntimeError(`'${fn.name}' expects ${fn.params.length} argument${fn.params.length === 1 ? "" : "s"}, got ${args.length}`, line);
  if (++ctx.depth > DEPTH_LIMIT) { ctx.depth--; throw new RuntimeError(`stack overflow — recursion in '${fn.name}' is too deep (limit ${DEPTH_LIMIT} frames)`, line); }

  const scope = new Scope(ctx.globals);
  try {
    for (let i = 0; i < fn.params.length; i++) {
      const p = fn.params[i];
      const argNode = args[i];
      if (p.isRef) {
        if (argNode.node !== "ident" && argNode.node !== "index")
          throw new RuntimeError(`parameter '${p.name}' is a reference — pass a variable, not a temporary value`, line);
        scope.define(p.name, resolveLValue(argNode, callerScope, ctx));
      } else {
        const val = evaluate(argNode, callerScope, ctx);
        scope.define(p.name, { value: cloneValue(val.v), type: p.type, isConst: false });
      }
    }
    let result: Val | null = null;
    try {
      for (const st of fn.body.stmts) execStmt(st, scope, ctx);
    } catch (e) {
      if (e instanceof ReturnSig) result = e.value;
      else throw e;
    }
    return result;
  } finally {
    ctx.depth--;
  }
}

/* --------------------------------- coercion --------------------------------- */

function coerce(v: Val, type: CType, line: number): RuntimeValue {
  switch (type.kind) {
    case "int":
      if (typeof v.v === "number") return Math.trunc(v.v);
      if (typeof v.v === "boolean") return v.v ? 1 : 0;
      if (v.t.kind === "char" && typeof v.v === "string") return code(v.v);
      if (typeof v.v === "string") throw new RuntimeError(`cannot convert ${v.t.kind === "string" ? "std::string" : "char"} to int implicitly`, line);
      throw new RuntimeError(`cannot convert ${typeLabel(v.t)} to int`, line);
    case "double":
      if (typeof v.v === "number") return v.v;
      if (typeof v.v === "boolean") return v.v ? 1 : 0;
      if (v.t.kind === "char" && typeof v.v === "string") return code(v.v);
      throw new RuntimeError(`cannot convert ${typeLabel(v.t)} to double`, line);
    case "char":
      if (v.t.kind === "char" && typeof v.v === "string") return v.v[0] ?? "\0";
      if (typeof v.v === "number") return String.fromCharCode(((Math.trunc(v.v) % 128) + 128) % 128);
      if (typeof v.v === "string" && v.t.kind === "string") return v.v[0] ?? "\0";
      throw new RuntimeError(`cannot convert ${typeLabel(v.t)} to char`, line);
    case "bool":
      if (typeof v.v === "boolean") return v.v;
      if (typeof v.v === "number") return v.v !== 0;
      if (typeof v.v === "string") return v.v.length > 0;
      return false;
    case "string":
      if (typeof v.v === "string") return v.v;
      if (typeof v.v === "boolean") return v.v ? "true" : "false";
      if (typeof v.v === "number") return fmtNum(v.v);
      throw new RuntimeError("cannot convert a vector to std::string", line);
    case "vector":
      if (isVec(v.v)) return cloneValue(v.v);
      throw new RuntimeError(`cannot convert ${typeLabel(v.t)} to ${typeLabel(type)}`, line);
    default:
      return typeof v.v === "object" ? cloneValue(v.v) : v.v;
  }
}

/* --------------------------------- helpers --------------------------------- */

function truthy(v: Val, line: number): boolean {
  if (typeof v.v === "boolean") return v.v;
  if (typeof v.v === "number") return v.v !== 0;
  if (typeof v.v === "string") return v.v.length > 0;
  if (isVec(v.v)) return v.v.items.length > 0;
  throw new RuntimeError("value cannot be used as a condition", line);
}

function code(ch: string): number { return ch.length ? ch.charCodeAt(0) : 0; }

function toNumber(v: Val, line: number): number {
  if (typeof v.v === "number") return v.v;
  if (typeof v.v === "boolean") return v.v ? 1 : 0;
  if (typeof v.v === "string" && v.t.kind === "char") return code(v.v);
  throw new RuntimeError(`expected a number, got ${typeLabel(v.t)}`, line);
}

function stringify(v: Val, line: number): string {
  if (typeof v.v === "string") return v.v;
  if (typeof v.v === "boolean") return v.v ? "true" : "false";
  if (typeof v.v === "number") return fmtNum(v.v);
  throw new RuntimeError("cannot convert a vector to a string", line);
}

function strChar(v: Val, name: string, line: number): string {
  if (typeof v.v === "string") return v.v[0] ?? "";
  throw new RuntimeError(`${name}() needs a char argument`, line);
}

function fmtNum(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return String(parseFloat(n.toPrecision(10)));
}

export function fmtVal(v: Val, line: number): string {
  if (typeof v.v === "string") return v.v;
  if (typeof v.v === "boolean") return v.v ? "true" : "false";
  if (typeof v.v === "number") return fmtNum(v.v);
  throw new RuntimeError("cannot stream a whole vector — print its elements one by one", line);
}

function parseToken(tok: string, type: CType, line: number): RuntimeValue {
  switch (type.kind) {
    case "int": { const n = Number.parseInt(tok, 10); return Number.isNaN(n) ? 0 : Math.trunc(n); }
    case "double": { const n = Number.parseFloat(tok); return Number.isNaN(n) ? 0 : n; }
    case "bool": return tok === "1" || tok === "true" || tok === "yes";
    case "char": return tok[0] ?? "\0";
    case "string": return tok;
    default: throw new RuntimeError(`cannot read ${typeLabel(type)} from cin`, line);
  }
}

function defaultValue(type: CType): RuntimeValue {
  switch (type.kind) {
    case "int": case "double": return 0;
    case "bool": return false;
    case "char": return "\0";
    case "string": return "";
    case "vector": return { __vec: true, elem: { kind: "int" }, items: [] };
    default: return 0;
  }
}

function cloneValue(v: RuntimeValue): RuntimeValue {
  if (isVec(v)) return { __vec: true, elem: v.elem, items: v.items.map(cloneValue) };
  return v;
}

/* --------------------------------- cin methods --------------------------------- */

function handleCinMethod(e: Expr & { node: "method" }, ctx: Ctx): Val {
  switch (e.name) {
    case "ignore": {
      // cin.ignore() - skip one character from input
      // cin.ignore(n) - skip n characters
      // cin.ignore(n, delim) - skip until delim or n chars
      const n = e.args.length > 0 ? Math.trunc(toNumber(evaluate(e.args[0], ctx.globals, ctx), e.line)) : 1;
      const delim = e.args.length > 1 ? stringify(evaluate(e.args[1], ctx.globals, ctx), e.line)[0] : null;
      
      // Skip characters from stdin
      for (let i = 0; i < n; i++) {
        const ch = ctx.stdin.nextChar();
        if (ch === null) break;
        if (delim !== null && ch === delim) break;
      }
      return { v: 0, t: { kind: "void" } };
    }
    case "peek": {
      // cin.peek() - look at next character without consuming
      const ch = ctx.stdin.peek();
      return { v: ch ?? "", t: { kind: "char" } };
    }
    case "get": {
      // cin.get() - read one character
      const ch = ctx.stdin.nextChar();
      return { v: ch ?? "", t: { kind: "char" } };
    }
    case "getline": {
      // cin.getline(str, n) - read up to n-1 chars or newline
      if (e.args.length < 1) throw new RuntimeError("cin.getline() requires at least one argument", e.line);
      const target = e.args[0];
      if (target.node !== "ident") throw new RuntimeError("cin.getline() first argument must be a variable", e.line);
      const cell = ctx.globals.lookup(target.name);
      if (!cell) throw new RuntimeError(`undeclared variable '${target.name}'`, e.line);
      if (cell.type.kind !== "string") throw new RuntimeError("cin.getline() needs a string variable", e.line);
      
      const maxLen = e.args.length > 1 ? Math.trunc(toNumber(evaluate(e.args[1], ctx.globals, ctx), e.line)) : 1000;
      let result = "";
      for (let i = 0; i < maxLen - 1; i++) {
        const ch = ctx.stdin.nextChar();
        if (ch === null || ch === "\n") break;
        result += ch;
      }
      // If we stopped at newline, consume it
      if (ctx.stdin.peek() === "\n") ctx.stdin.nextChar();
      
      cell.value = result;
      return { v: 0, t: { kind: "void" } };
    }
    case "ws": {
      // cin.ws() - skip whitespace
      while (true) {
        const ch = ctx.stdin.peek();
        if (ch === null) break;
        if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") break;
        ctx.stdin.nextChar();
      }
      return { v: 0, t: { kind: "void" } };
    }
    case "good": {
      // cin.good() - check if stream is in good state
      return { v: !ctx.stdin.eof(), t: { kind: "bool" } };
    }
    case "eof": {
      // cin.eof() - check if end of file
      return { v: ctx.stdin.eof(), t: { kind: "bool" } };
    }
    case "fail": {
      // cin.fail() - check if stream has failed
      return { v: ctx.stdin.eof(), t: { kind: "bool" } };
    }
    default:
      throw new RuntimeError(`cin.${e.name}() is not supported in this C++ subset`, e.line);
  }
}

/* --------------------------------- methods --------------------------------- */

function callMethod(e: Expr & { node: "method" }, scope: Scope, ctx: Ctx): Val {
  // Special handling for cin member functions
  if (e.obj.node === "ident" && e.obj.name === "cin") {
    return handleCinMethod(e, ctx);
  }
  
  const obj = evaluate(e.obj, scope, ctx);
  const I = (v: number): Val => ({ v, t: { kind: "int" } });
  const B = (v: boolean): Val => ({ v, t: { kind: "bool" } });

  if (isVec(obj.v)) {
    const vec = obj.v;
    const isArray = obj.t.kind === "array";
    
    // Arrays don't support mutating operations
    if (isArray && (e.name === "push_back" || e.name === "pop_back" || e.name === "clear")) {
      throw new RuntimeError(`C-style arrays have fixed size — '${e.name}()' is not allowed on arrays`, e.line);
    }
    
    switch (e.name) {
      case "size": case "length": return I(vec.items.length);
      case "empty": return B(vec.items.length === 0);
      case "push_back": {
        if (e.args.length !== 1) throw new RuntimeError("push_back() takes exactly one argument", e.line);
        if (vec.items.length >= 1_000_000) throw new RuntimeError("vector too large (limit 1,000,000 elements)", e.line);
        vec.items.push(coerce(evaluate(e.args[0], scope, ctx), vec.elem, e.line));
        return { v: 0, t: { kind: "void" } };
      }
      case "pop_back":
        if (vec.items.length === 0) throw new RuntimeError("pop_back() on an empty vector", e.line);
        vec.items.pop();
        return { v: 0, t: { kind: "void" } };
      case "front":
        if (vec.items.length === 0) throw new RuntimeError(`front() on an empty ${isArray ? "array" : "vector"}`, e.line);
        return { v: vec.items[0], t: vec.elem };
      case "back":
        if (vec.items.length === 0) throw new RuntimeError(`back() on an empty ${isArray ? "array" : "vector"}`, e.line);
        return { v: vec.items[vec.items.length - 1], t: vec.elem };
      case "clear":
        vec.items = [];
        return { v: 0, t: { kind: "void" } };
    }
    throw new RuntimeError(`no member named '${e.name}' in ${typeLabel(obj.t)}`, e.line);
  }

  if (typeof obj.v === "string") {
    switch (e.name) {
      case "size": case "length": return I(obj.v.length);
      case "empty": return B(obj.v.length === 0);
      case "push_back": {
        if (e.args.length !== 1) throw new RuntimeError("push_back() takes exactly one argument", e.line);
        const add = stringify(evaluate(e.args[0], scope, ctx), e.line);
        const src = resolveLValue(e.obj, scope, ctx);
        src.value = (src.value as string) + add;
        return { v: 0, t: { kind: "void" } };
      }
      case "front":
        if (obj.v.length === 0) throw new RuntimeError("front() on an empty string", e.line);
        return { v: obj.v[0], t: { kind: "char" } };
      case "back":
        if (obj.v.length === 0) throw new RuntimeError("back() on an empty string", e.line);
        return { v: obj.v[obj.v.length - 1], t: { kind: "char" } };
    }
    throw new RuntimeError(`no member named '${e.name}' in std::string — supported: size(), length(), empty(), front(), back()`, e.line);
  }

  throw new RuntimeError(`.${e.name}() needs a vector or a string, got ${typeLabel(obj.t)}`, e.line);
}
