
const BACKEND_URL = "/ask";   // relative path — always correct, same origin as the page

const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const clearBtn = document.getElementById("clearBtn");
const examples = document.getElementById("examples");
const statusLine = document.getElementById("statusLine");

let history = [];

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "🧑" : "🤖";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  // Keep model output as text (not HTML) for safety, then typeset any MathJax formulas.
  bubble.textContent = text;
  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatWindow.appendChild(msg);

  if (sender === "assistant" && window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([bubble]).catch((err) => console.error("MathJax typesetting failed:", err));
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
