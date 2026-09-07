import type { Program, Problem, Stmt, Expr, FuncDef } from "./types";

/** Lightweight -Wunused style analysis over the AST. */
export function collectDiagnostics(program: Program, lines: string[]): Problem[] {
  const problems: Problem[] = [];

  const funcs = program.decls.filter((d): d is FuncDef => d.node === "func");
  if (!funcs.some((f) => f.name === "main")) {
    problems.push({
      severity: "error",
      message: "no main function defined",
      line: 1,
      col: 1,
      lineText: lines[0],
      hint: "every C++ program needs an entry point: int main() { … }",
    });
  }

  for (const fn of funcs) {
    const declared = new Map<string, { line: number; isParam: boolean }>();
    const used = new Set<string>();
    for (const p of fn.params) if (!declared.has(p.name)) declared.set(p.name, { line: p.line, isParam: true });
    walkStmt(fn.body, declared, used);

    for (const [name, info] of declared) {
      if (name.startsWith("_")) continue;
      if (!used.has(name)) {
        problems.push({
          severity: "warning",
          message: `unused ${info.isParam ? "parameter" : "variable"} '${name}'`,
          line: info.line,
          col: 1,
          lineText: lines[info.line - 1],
          hint: info.isParam ? "prefix it with _ to silence this warning" : "remove it or use it",
        });
      }
    }
  }

  return problems.sort((a, b) => a.line - b.line);
}

function walkStmt(s: Stmt, declared: Map<string, { line: number; isParam: boolean }>, used: Set<string>): void {
  switch (s.node) {
    case "block": s.stmts.forEach((c) => walkStmt(c, declared, used)); break;
    case "vardecl":
      for (const d of s.decls) {
        if (!declared.has(d.name)) declared.set(d.name, { line: d.line, isParam: false });
        if (d.init) walkExpr(d.init, used);
      }
      break;
    case "exprstmt": walkExpr(s.expr, used); break;
    case "if": walkExpr(s.cond, used); walkStmt(s.then, declared, used); if (s.else) walkStmt(s.else, declared, used); break;
    case "while": walkExpr(s.cond, used); walkStmt(s.body, declared, used); break;
    case "dowhile": walkStmt(s.body, declared, used); walkExpr(s.cond, used); break;
    case "for":
      if (s.init) walkStmt(s.init, declared, used);
      if (s.cond) walkExpr(s.cond, used);
      if (s.step) walkExpr(s.step, used);
      walkStmt(s.body, declared, used);
      break;
    case "forrange":
      walkExpr(s.target, used);
      if (!declared.has(s.name)) declared.set(s.name, { line: s.line, isParam: false });
      walkStmt(s.body, declared, used);
      break;
    case "return": if (s.value) walkExpr(s.value, used); break;
    case "cout": s.parts.forEach((p) => p !== "endl" && walkExpr(p, used)); break;
    case "cin": s.targets.forEach((t) => walkExpr(t, used)); break;
    case "getline": used.add(s.target); break;
    default: break;
  }
}

function walkExpr(e: Expr, used: Set<string>): void {
  switch (e.node) {
    case "ident": used.add(e.name); break;
    case "vecinit": e.items.forEach((i) => walkExpr(i, used)); break;
    case "binary": case "logical": walkExpr(e.l, used); walkExpr(e.r, used); break;
    case "unary": walkExpr(e.e, used); break;
    case "incdec": walkExpr(e.target, used); break;
    case "assign": walkExpr(e.target, used); walkExpr(e.value, used); break;
    case "compound": walkExpr(e.target, used); walkExpr(e.value, used); break;
    case "ternary": walkExpr(e.cond, used); walkExpr(e.a, used); walkExpr(e.b, used); break;
    case "call": used.add(e.name); e.args.forEach((a) => walkExpr(a, used)); break;
    case "method": walkExpr(e.obj, used); e.args.forEach((a) => walkExpr(a, used)); break;
    case "index": walkExpr(e.obj, used); walkExpr(e.index, used); break;
    default: break;
  }
}
