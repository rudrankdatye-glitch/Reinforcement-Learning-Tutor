const BACKEND_URL = "/ask";   // relative path — always correct, same origin as the page

const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const clearBtn = document.getElementById("clearBtn");
const examples = document.getElementById("examples");
const statusLine = document.getElementById("statusLine");

let history = [];

/* ------------------------------------------------------------------ *
 * Message rendering: safe mini-markdown + math (fractions, subscripts)
 * ------------------------------------------------------------------ */

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Fallback used only if MathJax is unavailable: LaTeX -> readable plain text.
const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  theta: "θ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", tau: "τ", phi: "φ",
  omega: "ω", Delta: "Δ", Sigma: "Σ", Pi: "π", nabla: "∇",
};
const SYMBOLS = {
  sum: "∑", cdot: "·", times: "×", leq: "≤", le: "≤", geq: "≥", ge: "≥",
  approx: "≈", neq: "≠", in: "∈", to: "→", rightarrow: "→", leftarrow: "←",
  infty: "∞", mid: "|", max: "max", min: "min", log: "log", exp: "exp",
  argmax: "argmax", argmin: "argmin", pm: "±", ldots: "…", dots: "…",
};

function latexToPlain(src) {
  let t = src;
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
  }
  t = t.replace(/\\(?:mathbb|mathbf|mathrm|mathcal|text|operatorname)\s*\{([^{}]*)\}/g,
    (_, x) => (x === "E" ? "𝔼" : x));
  t = t.replace(/\\(left|right|big|Big)\b\s*/g, "");
  t = t.replace(/\\([a-zA-Z]+)/g, (m, name) => GREEK[name] || SYMBOLS[name] || name);
  t = t.replace(/\\[,;: !]/g, " ");
  t = t.replace(/_\{([^{}]*)\}/g, "_($1)").replace(/\^\{([^{}]*)\}/g, "^($1)");
  return t.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function mathReady() {
  return !!(window.MathJax && window.MathJax.typesetPromise);
}

// Models sometimes use $...$, \\( ... \\), or other delimiter styles. Normalise them.
function normalizeMathDelimiters(text) {
  let t = text;
  // Double backslashes copied from prompts: \\( \\) \\[ \\] \\gamma -> single backslash
  t = t.replace(/\\\\(?=[a-zA-Z()\[\]])/g, "\\");
  // $$ ... $$  ->  \[ ... \]
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => "\\[" + m + "\\]");
  // $ ... $  ->  \( ... \)   (ignores things like "$5 and $10")
  t = t.replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (m, inner) =>
    /[\\^_=]|[A-Za-z]\(/.test(inner) ? "\\(" + inner + "\\)" : m);
  return t;
}

function renderRich(raw) {
  const stash = [];
  const keep = (html) => { stash.push(html); return `@@S${stash.length - 1}@@`; };

  let t = normalizeMathDelimiters(raw);

  // 1) Fenced code blocks
  t = t.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, (_, code) =>
    keep(`<pre><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`));

  // 2) Math (kept away from markdown processing so _ and * inside formulas survive)
  const useMathJax = mathReady();
  t = t.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => keep(useMathJax
    ? `<span class="math-block">\\[${escapeHtml(m.trim())}\\]</span>`
    : `<span class="math-block plain">${escapeHtml(latexToPlain(m))}</span>`));
  t = t.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => keep(useMathJax
    ? `\\(${escapeHtml(m.trim())}\\)`
    : `<span class="math-plain">${escapeHtml(latexToPlain(m))}</span>`));

  // 3) Any stray, undelimited LaTeX commands -> readable text
  if (/\\[a-zA-Z]+/.test(t)) t = latexToPlain(t);

  // 4) Inline code
  t = t.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code>${escapeHtml(c)}</code>`));

  // 5) Markdown blocks
  t = escapeHtml(t);
  const inline = (s) => s
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");

  const out = [];
  let list = null;      // "ul" | "ol"
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.join("<br>")}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  for (const line of t.split("\n")) {
    const trimmed = line.trim();
    let m;
    if (!trimmed) { flushPara(); closeList(); continue; }
    if ((m = trimmed.match(/^#{1,4}\s+(.*)$/))) {
      flushPara(); closeList(); out.push(`<h4>${inline(m[1])}</h4>`);
    } else if ((m = trimmed.match(/^[-*•]\s+(.*)$/))) {
      flushPara();
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = trimmed.match(/^\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (/^@@S\d+@@$/.test(trimmed)) {
      flushPara(); closeList(); out.push(trimmed);       // standalone block (display math / code)
    } else {
      closeList(); para.push(inline(trimmed));
    }
  }
  flushPara(); closeList();

  // 6) Restore stashed pieces (may be nested once: inline code inside nothing, so one pass is enough)
  return out.join("").replace(/@@S(\d+)@@/g, (_, i) => stash[Number(i)]);
}

/* ------------------------------------------------------------------ */

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "🧑" : "🤖";
  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (sender === "assistant") {
    bubble.classList.add("rich");
    bubble.innerHTML = renderRich(text);   // input is HTML-escaped inside renderRich
  } else {
    bubble.textContent = text;
  }

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatWindow.appendChild(msg);

  if (sender === "assistant" && mathReady()) {
    window.MathJax.typesetPromise([bubble])
      .then(() => { chatWindow.scrollTop = chatWindow.scrollHeight; })
      .catch((err) => console.error("MathJax typesetting failed:", err));
  }
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTyping() {
  const msg = document.createElement("div");
  msg.className = "message assistant typing-indicator";
  msg.id = "typingIndicator";
  msg.innerHTML = `<div class="avatar">🤖</div><div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

async function sendQuestion(question) {
  addMessage(question, "user");
  userInput.value = "";
  showTyping();
  statusLine.textContent = "";

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, history: history }),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }

    const data = await response.json();
    hideTyping();
    addMessage(data.reply, "assistant");
    history.push([question, data.reply]);
  } catch (err) {
    hideTyping();
    addMessage("Sorry, I couldn't reach the RL Tutor backend.", "assistant");
    statusLine.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = userInput.value.trim();
  if (!question) return;
  sendQuestion(question);
});

examples.addEventListener("click", (e) => {
  if (e.target.classList.contains("chip")) {
    sendQuestion(e.target.textContent);
  }
});

clearBtn.addEventListener("click", () => {
  history = [];
  chatWindow.innerHTML = "";
  addMessage("Chat cleared. Ask me a new RL question!", "assistant");
});
