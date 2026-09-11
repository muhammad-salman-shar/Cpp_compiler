/* ---------------------------------------------------------------
 * C++ Compiler Lite — shared types for lexer / parser / interpreter
 * --------------------------------------------------------------- */

export interface Token {
  kind: "kw" | "ident" | "num" | "str" | "chr" | "pun" | "eof";
  v: string;
  line: number; // 1-based
  col: number; // 1-based
}

export class CompileError extends Error {
  line: number;
  col: number;
  lineText?: string;
  hint?: string;
  constructor(message: string, line: number, col: number, lineText?: string, hint?: string) {
    super(message);
    this.line = line;
    this.col = col;
    this.lineText = lineText;
    this.hint = hint;
  }
}

export class RuntimeError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

/* ----------------------------- types ----------------------------- */

export type CType =
  | { kind: "int" }
  | { kind: "double" }
  | { kind: "char" }
  | { kind: "bool" }
  | { kind: "string" }
  | { kind: "void" }
  | { kind: "auto" }
  | { kind: "vector"; elem: CType }
  | { kind: "array"; elem: CType; size: number };

export const typeLabel = (t: CType): string => {
  if (t.kind === "vector") return `std::vector<${typeLabel(t.elem)}>`;
  if (t.kind === "array") return `${typeLabel(t.elem)}[${t.size}]`;
  if (t.kind === "auto") return "auto";
  if (t.kind === "string") return "std::string";
  return t.kind;
};

/* ------------------------------ AST ------------------------------ */

export interface Program {
  node: "program";
  decls: Decl[];
}
export type Decl = FuncDef | VarDecl | UsingDecl;

export interface UsingDecl {
  node: "using";
  line: number;
}
export interface FuncDef {
  node: "func";
  name: string;
  retType: CType;
  params: Param[];
  body: Block;
  line: number;
}
export interface Param {
  type: CType;
  name: string;
  isRef: boolean;
  line: number;
}

export type Stmt =
  | Block
  | VarDecl
  | ExprStmt
  | If
  | While
  | DoWhile
  | For
  | ForRange
  | Return
  | Break
  | Continue
  | Cout
  | Cin
  | Getline
  | Empty;

export interface Block { node: "block"; stmts: Stmt[]; line: number }
export interface VarDecl {
  node: "vardecl";
  type: CType;
  isConst: boolean;
  decls: { name: string; init?: Expr; line: number }[];
  line: number;
}
export interface ExprStmt { node: "exprstmt"; expr: Expr; line: number }
export interface If { node: "if"; cond: Expr; then: Stmt; else?: Stmt; line: number }
export interface While { node: "while"; cond: Expr; body: Stmt; line: number }
export interface DoWhile { node: "dowhile"; body: Stmt; cond: Expr; line: number }
export interface For { node: "for"; init: Stmt | null; cond: Expr | null; step: Expr | null; body: Stmt; line: number }
export interface ForRange { node: "forrange"; type: CType; name: string; target: Expr; body: Stmt; line: number }
export interface Return { node: "return"; value?: Expr; line: number }
export interface Break { node: "break"; line: number }
export interface Continue { node: "continue"; line: number }
export interface Cout { node: "cout"; parts: (Expr | "endl")[]; line: number }
export interface Cin { node: "cin"; targets: Expr[]; line: number } // Ident | Index
export interface Getline { node: "getline"; target: string; line: number }
export interface Empty { node: "empty"; line: number }

export type Expr =
  | Num | Str | Chr | BoolLit | Ident | VecInit
  | Binary | Logical | Unary | IncDec
  | Assign | Compound | Ternary
  | Call | Method | Index;

export interface Num { node: "num"; value: number; isDouble: boolean; line: number }
export interface Str { node: "str"; value: string; line: number }
export interface Chr { node: "chr"; value: string; line: number }
export interface BoolLit { node: "bool"; value: boolean; line: number }
export interface Ident { node: "ident"; name: string; line: number; col: number }
export interface VecInit { node: "vecinit"; items: Expr[]; line: number }
export interface Binary { node: "binary"; op: string; l: Expr; r: Expr; line: number }
export interface Logical { node: "logical"; op: "&&" | "||"; l: Expr; r: Expr; line: number }
export interface Unary { node: "unary"; op: "!" | "-" | "+"; e: Expr; line: number }
export interface IncDec { node: "incdec"; op: "++" | "--"; prefix: boolean; target: Expr; line: number }
export interface Assign { node: "assign"; target: Expr; value: Expr; line: number }
export interface Compound { node: "compound"; op: string; target: Expr; value: Expr; line: number }
export interface Ternary { node: "ternary"; cond: Expr; a: Expr; b: Expr; line: number }
export interface Call { node: "call"; name: string; args: Expr[]; line: number }
export interface Method { node: "method"; obj: Expr; name: string; args: Expr[]; line: number }
export interface Index { node: "index"; obj: Expr; index: Expr; line: number }

/* --------------------------- diagnostics -------------------------- */

export interface Problem {
  severity: "error" | "warning";
  message: string;
  line: number;
  col: number;
  lineText?: string;
  hint?: string;
}
