// Best-effort cleanup for stray LaTeX commands in generated study content.
// The study/quiz/long-answer screens all render plain markdown or plain
// text — no LaTeX/KaTeX support — so a command like `\Sigma` shows up as
// literal backslashed text instead of "Σ". The generation prompts now warn
// against this (see server/src/services/llm.ts), but this fixes it for
// content that was already generated before that guard existed, and acts
// as a safety net if a model slips up again.
//
// Deliberately conservative: only a whitelisted set of known commands gets
// substituted. Unrecognized `\commands` are left alone rather than having
// their backslash stripped blindly — that would corrupt code blocks (e.g.
// a regex `\d+` or an escape sequence `\n` in a fenced snippet).

const SYMBOL_MAP: Record<string, string> = {
  Sigma: "Σ", sigma: "σ", varsigma: "ς",
  Delta: "Δ", delta: "δ",
  Gamma: "Γ", gamma: "γ",
  Lambda: "Λ", lambda: "λ",
  Theta: "Θ", theta: "θ", vartheta: "θ",
  Pi: "Π", pi: "π", varpi: "π",
  Phi: "Φ", phi: "φ", varphi: "φ",
  Psi: "Ψ", psi: "ψ",
  Omega: "Ω", omega: "ω",
  alpha: "α", beta: "β", mu: "μ", nu: "ν", tau: "τ", chi: "χ",
  eta: "η", rho: "ρ", xi: "ξ", Xi: "Ξ", zeta: "ζ", kappa: "κ", iota: "ι", upsilon: "υ",
  varepsilon: "ε", epsilon: "ε",
  times: "×", div: "÷", pm: "±", mp: "∓",
  rightarrow: "→", to: "→", longrightarrow: "→", Rightarrow: "⇒",
  leftarrow: "←", Leftarrow: "⇐",
  leftrightarrow: "↔", Leftrightarrow: "⇔", mapsto: "↦", implies: "⇒", iff: "⇔",
  in: "∈", notin: "∉", ni: "∋",
  subseteq: "⊆", subset: "⊂", subsetneq: "⊊", supseteq: "⊇", supset: "⊃",
  cup: "∪", cap: "∩", setminus: "∖", emptyset: "∅", varnothing: "∅",
  leq: "≤", geq: "≥", le: "≤", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", sim: "∼", cong: "≅", propto: "∝",
  forall: "∀", exists: "∃", nexists: "∄",
  langle: "⟨", rangle: "⟩",
  infty: "∞", partial: "∂", nabla: "∇",
  ldots: "…", dots: "…", cdots: "⋯", cdot: "·", circ: "∘", bullet: "•",
  wedge: "∧", vee: "∨", neg: "¬", lnot: "¬",
  sum: "∑", prod: "∏", int: "∫",
  sqrt: "√",
  top: "⊤", bot: "⊥",
  therefore: "∴", because: "∵",
  vdash: "⊢", models: "⊨",
};

const COMMAND_NAMES = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length);
const COMMAND_PATTERN = new RegExp(`\\\\(${COMMAND_NAMES.join("|")})(?![a-zA-Z])`, "g");

/** Applies the whitelist substitution + tidies leftover math delimiters. Safe on plain text (no markdown/code awareness needed). */
export function cleanLatexSymbols(text: string): string {
  if (!text || text.indexOf("\\") === -1) return text; // fast path — most content has no LaTeX in it at all

  let out = text.replace(COMMAND_PATTERN, (match, name: string) => SYMBOL_MAP[name] ?? match);

  // q_{init} -> q_init, x^{2} -> x^2 — only the brace grouping right after
  // a sub/superscript marker, never braces in general (those can be
  // legitimate content, e.g. set notation like {0, 1}).
  out = out.replace(/([_^])\{([^{}]*)\}/g, "$1$2");

  // Drop now-pointless inline/display math delimiters, keeping their content.
  out = out.replace(/\$\$([^$]*)\$\$/g, "$1");
  out = out.replace(/\$([^$]*)\$/g, "$1");
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, "$1");
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, "$1");

  return out;
}

/** Same cleanup for a markdown document, but skips fenced ```code blocks``` entirely — those may legitimately contain backslashes (regex, escape sequences) or braces (mermaid node shapes) that must not be touched. */
export function cleanMarkdownLatex(markdown: string): string {
  if (!markdown || markdown.indexOf("\\") === -1) return markdown;

  const parts = markdown.split(/(```[\s\S]*?```)/g);
  return parts.map((part) => (part.startsWith("```") ? part : cleanLatexSymbols(part))).join("");
}
