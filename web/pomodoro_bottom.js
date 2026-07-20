(() => {
  "use strict";

  if (window.PomodoroFocusBottom) return;

  const PREFIX = "pomodoro_focus:";
  let snapshot = null;
  let lastCounts = { new: "0", learn: "0", review: "0", active: "" };
  let scheduled = false;
  let completionSignalTimer = null;

  function send(action, data = {}) {
    if (typeof pycmd === "function") {
      pycmd(PREFIX + JSON.stringify({ action, ...data }));
    }
  }

  function mmss(value) {
    const seconds = Math.max(0, Math.ceil(Number(value) || 0));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function phaseLabel(phase) {
    if (phase === "short_break") return "Short Break";
    if (phase === "long_break") return "Long Break";
    return "Focus";
  }

  function symbol(className) {
    const element = document.createElement("span");
    element.className = `pf-native-symbol ${className}`;
    element.setAttribute("aria-hidden", "true");
    return element;
  }

  function createTimer() {
    const button = document.createElement("button");
    button.id = "pf-native-timer";
    button.className = "pf-native-control pf-native-timer";
    button.type = "button";
    button.setAttribute("aria-label", "Open Pomodoro Focus");
    button.innerHTML = `
      <span class="pf-native-time">25:00</span>
      <svg class="pf-native-ring" viewBox="0 0 40 40" aria-hidden="true">
        <circle class="pf-native-ring-track" pathLength="100" cx="20" cy="20" r="16"></circle>
        <circle class="pf-native-ring-fill" pathLength="100" cx="20" cy="20" r="16"></circle>
      </svg>`;
    button.addEventListener("click", () => send("open_panel"));
    return button;
  }

  function createCounts() {
    const counts = document.createElement("div");
    counts.id = "pf-native-counts";
    counts.className = "pf-native-counts";
    counts.setAttribute("aria-label", "New, learning, and review card counts");
    counts.innerHTML = `
      <span class="pf-native-count pf-native-new" title="New cards">0</span>
      <span class="pf-native-count pf-native-learn" title="Learning cards">0</span>
      <span class="pf-native-count pf-native-review" title="Review cards">0</span>`;
    return counts;
  }

  function decorateUtility(button, kind) {
    if (!button) return;
    const label = button.textContent.replace(/\s+/g, " ").trim() || kind;
    button.id = `pf-native-${kind}`;
    button.classList.add("pf-native-control", "pf-native-utility", `pf-native-${kind}`);
    button.setAttribute("aria-label", label);
    button.title = button.title || label;
    button.replaceChildren(symbol(`pf-native-symbol-${kind}`));
  }

  function mountStaticControls() {
    const row = document.querySelector("#innertable > tbody > tr")
      || document.querySelector("#innertable > tr");
    const middle = document.getElementById("middle");
    if (!row || !middle) return false;

    document.documentElement.classList.add("pf-native-review-root");
    document.body.classList.add("pf-native-review-body");
    row.classList.add("pf-native-row");
    middle.classList.add("pf-native-middle");

    const cells = [...row.children].filter((element) => element.tagName === "TD");
    const left = cells[0];
    const right = cells[cells.length - 1];
    if (!left || !right) return false;
    left.classList.add("pf-native-left");
    right.classList.add("pf-native-right");

    const edit = document.getElementById("pf-native-edit")
      || left.querySelector("button:not(#pf-native-timer)");
    const more = document.getElementById("pf-native-more")
      || right.querySelector("button:not(#pf-native-info):not(#pf-native-edit)");

    if (!document.getElementById("pf-native-timer")) left.prepend(createTimer());
    if (!document.getElementById("pf-native-counts")) left.append(createCounts());

    if (edit && !edit.classList.contains("pf-native-edit")) {
      decorateUtility(edit, "edit");
      right.prepend(edit);
    }

    if (!document.getElementById("pf-native-info")) {
      const info = document.createElement("button");
      info.id = "pf-native-info";
      info.className = "pf-native-control pf-native-utility pf-native-info";
      info.type = "button";
      info.title = "Info";
      info.setAttribute("aria-label", "Info");
      info.append(symbol("pf-native-symbol-info"));
      info.addEventListener("click", () => send("card_info"));
      right.insertBefore(info, more || null);
    }

    if (more && !more.classList.contains("pf-native-more")) {
      decorateUtility(more, "more");
    }
    return true;
  }

  function answerEase(button) {
    const direct = Number(button.dataset.ease);
    if (direct >= 1 && direct <= 4) return direct;
    const source = `${button.id || ""} ${button.getAttribute("onclick") || ""}`;
    const match = source.match(/ease[^1-4]*([1-4])/i);
    return match ? Number(match[1]) : 0;
  }

  function readCounts(middle) {
    const showAnswer = middle.querySelector("#ansbut");
    if (!showAnswer) return;
    lastCounts = {
      new: showAnswer.querySelector(".new-count")?.textContent.trim() || "0",
      learn: showAnswer.querySelector(".learn-count")?.textContent.trim() || "0",
      review: showAnswer.querySelector(".review-count")?.textContent.trim() || "0",
      active: showAnswer.querySelector(".new-count u") ? "new"
        : showAnswer.querySelector(".learn-count u") ? "learn"
          : showAnswer.querySelector(".review-count u") ? "review"
            : "",
    };
  }

  function renderCounts() {
    const counts = document.getElementById("pf-native-counts");
    if (!counts) return;
    counts.querySelector(".pf-native-new").textContent = lastCounts.new;
    counts.querySelector(".pf-native-learn").textContent = lastCounts.learn;
    counts.querySelector(".pf-native-review").textContent = lastCounts.review;
    if (lastCounts.active) counts.dataset.active = lastCounts.active;
    else delete counts.dataset.active;
  }

  function decorateMiddle() {
    const middle = document.getElementById("middle");
    if (!middle) return;
    const showAnswer = middle.querySelector("#ansbut");
    if (showAnswer) {
      delete middle.dataset.answerCount;
      readCounts(middle);
      showAnswer.classList.add("pf-native-control", "pf-native-show");
      if (!middle.querySelector("#pf-native-skip")) {
        const skip = document.createElement("button");
        skip.id = "pf-native-skip";
        skip.className = "pf-native-control pf-native-skip";
        skip.type = "button";
        skip.textContent = "Skip";
        skip.addEventListener("click", () => send("skip_card"));
        middle.prepend(skip);
      }
    } else {
      const answerButtons = [...middle.querySelectorAll("button")]
        .filter((button) => answerEase(button));
      middle.dataset.answerCount = String(answerButtons.length);
      answerButtons.forEach((button) => {
        const ease = answerEase(button);
        const interval = button.querySelector(".nobold");
        const labelText = [...button.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent.trim())
          .filter(Boolean)
          .join(" ");
        let label = button.querySelector(".pf-native-answer-label");
        let intervalLabel = button.querySelector(".pf-native-answer-interval");
        if (!label) {
          label = document.createElement("span");
          label.className = "pf-native-answer-label";
          button.prepend(label);
        }
        if (!intervalLabel) {
          intervalLabel = document.createElement("span");
          intervalLabel.className = "pf-native-answer-interval";
          button.append(intervalLabel);
        }
        [...button.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .forEach((node) => node.remove());
        if (labelText) label.textContent = labelText;
        intervalLabel.textContent = interval ? interval.textContent.trim() : "";
        button.dataset.ease = String(ease);
        button.classList.add(
          "pf-native-control",
          "pf-native-answer",
          `pf-native-ease-${ease}`,
        );
      });
    }
    renderCounts();
  }

  function refreshNativeBar() {
    scheduled = false;
    if (!mountStaticControls()) return;
    decorateMiddle();
    if (snapshot) render(snapshot);
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refreshNativeBar);
  }

  function render(data) {
    snapshot = data;
    const timer = document.getElementById("pf-native-timer");
    if (!timer) return;
    const height = Math.max(36, Math.min(64, Number(data.config.answer_button_height) || 44));
    document.documentElement.style.setProperty("--pf-native-height", `${height}px`);
    const indicator = data.config.answer_timer_style === "circle" ? "circle" : "time";
    const duration = Math.max(1, Number(data.duration_seconds) || 1);
    const remaining = Math.max(0, Number(data.remaining_seconds) || 0);
    const remainingProgress = Math.max(0, Math.min(1, remaining / duration));
    const visualProgress = data.phase === "focus" ? 1 - remainingProgress : remainingProgress;
    timer.dataset.indicator = indicator;
    timer.dataset.state = data.state === "running" ? "running" : "inactive";
    timer.dataset.phase = data.phase;
    timer.title = `${phaseLabel(data.phase)} · ${mmss(remaining)}`;
    timer.querySelector(".pf-native-time").textContent = indicator === "circle"
      ? String(Math.ceil(remaining / 60))
      : mmss(remaining);
    timer.querySelector(".pf-native-ring-fill").style.strokeDasharray = `${visualProgress * 87.5} 100`;
  }

  function signalFocusComplete() {
    const timer = document.getElementById("pf-native-timer");
    if (!timer) return;
    clearTimeout(completionSignalTimer);
    timer.classList.remove("pf-native-complete");
    void timer.offsetWidth;
    timer.classList.add("pf-native-complete");
    completionSignalTimer = setTimeout(() => timer.classList.remove("pf-native-complete"), 1200);
  }

  function start() {
    const middle = document.getElementById("middle");
    if (!middle || !mountStaticControls()) {
      requestAnimationFrame(start);
      return;
    }
    decorateMiddle();
    new MutationObserver(scheduleRefresh).observe(middle, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    send("ready_bottom");
  }

  window.PomodoroFocusBottom = {
    receive: render,
    signalFocusComplete,
    refresh: scheduleRefresh,
  };

  start();
})();
