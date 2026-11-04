const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

// 1. Scroll Reveal Observer
if ("IntersectionObserver" in window && !motion.matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("revealed");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -28px", threshold: 0.08 });

  document.querySelectorAll("[data-reveal]").forEach(element => {
    observer.observe(element);
  });
} else {
  document.querySelectorAll("[data-reveal]").forEach(element => {
    element.classList.add("revealed");
  });
}

// 2. Interactive Dashboard Showcase Tabs
const previewTabs = document.querySelectorAll("[data-preview-tab]");
const previewPanes = document.querySelectorAll("[data-preview-pane]");
if (previewTabs.length && previewPanes.length) {
  previewTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-preview-tab");
      previewTabs.forEach(btn => {
        const active = btn === tab;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      previewPanes.forEach(pane => {
        const match = pane.getAttribute("data-preview-pane") === target;
        pane.classList.toggle("active", match);
        pane.hidden = !match;
      });
    });
  });
}

// 3. Interactive Demo Console Simulator
const consoleLog = document.getElementById("demo-console-log");
const consoleForm = document.getElementById("demo-console-form");
const consoleInput = document.getElementById("demo-console-input");
const quickCmds = document.querySelectorAll("[data-demo-cmd]");

function formatTime() {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

function appendLog(text, cls = "") {
  if (!consoleLog) return;
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = text;
  consoleLog.appendChild(line);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function runDemoCommand(raw) {
  const clean = raw.trim().replace(/^\/+/, "");
  if (!clean) return;
  const stamp = formatTime();
  appendLog(`[${stamp} INFO]: > /${clean}`, "sc-log-cmd");

  const lower = clean.toLowerCase();
  setTimeout(() => {
    const replyStamp = formatTime();
    if (lower === "list") {
      appendLog(`[${replyStamp} INFO]: There are 2 of a max of 20 players online: Alex, Steve`, "sc-log-ok");
    } else if (lower === "tps") {
      appendLog(`[${replyStamp} INFO]: TPS from last 1m, 5m, 15m: *20.0, *20.0, *19.98 (ARM64 OpenJDK 25)`, "sc-log-ok");
    } else if (lower === "save-all") {
      appendLog(`[${replyStamp} INFO]: Saving the game (this may take a moment!)`, "");
      appendLog(`[${replyStamp} INFO]: Saved the game — world snapshot synced to phone storage`, "sc-log-ok");
    } else if (lower.startsWith("time set")) {
      appendLog(`[${replyStamp} INFO]: Set the time to 1000 (Day)`, "sc-log-ok");
    } else if (lower.startsWith("say ")) {
      appendLog(`[${replyStamp} INFO]: [Server] ${clean.slice(4)}`, "sc-log-ok");
    } else if (lower === "help") {
      appendLog(`[${replyStamp} INFO]: Available demo commands: /list, /tps, /save-all, /time set day, /say <msg>`, "");
    } else {
      appendLog(`[${replyStamp} INFO]: Executed "/${clean}" on Android host (0.4 ms)`, "sc-log-ok");
    }
  }, 140);
}

if (consoleForm && consoleInput) {
  consoleForm.addEventListener("submit", event => {
    event.preventDefault();
    runDemoCommand(consoleInput.value);
    consoleInput.value = "";
  });
}

quickCmds.forEach(btn => {
  btn.addEventListener("click", () => {
    const cmd = btn.getAttribute("data-demo-cmd");
    if (cmd) runDemoCommand(cmd);
  });
});

// 4. Demo Address Copy & Subtle Live Telemetry
const copyBtn = document.getElementById("demo-copy-btn");
const demoAddress = document.getElementById("demo-address");
if (copyBtn && demoAddress) {
  copyBtn.addEventListener("click", () => {
    navigator.clipboard?.writeText(demoAddress.textContent || "192.168.1.44:25565");
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1800);
  });
}

const cpuEl = document.getElementById("demo-cpu");
if (cpuEl && !motion.matches) {
  setInterval(() => {
    const load = (16.2 + Math.random() * 4.6).toFixed(1);
    cpuEl.textContent = `${load} %`;
  }, 3200);
}

// 5. Subtle 3D Pointer Tilt on Hero & Engine Cards
if (!motion.matches && window.matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll("[data-tilt]").forEach(card => {
    card.addEventListener("pointermove", event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-3px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}
