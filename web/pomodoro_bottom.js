(() => {
  "use strict";

  if (window.PomodoroFocusBottom) return;

  const PREFIX = "pomodoro_focus:";
  let snapshot = null;
  let lastStudyActions = "";
  let lastCardCounts = { new: "", learn: "", review: "", active: "" };

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

  function buttonLabel(button) {
    if (!button) return "";
    const copy = button.cloneNode(true);
    copy.querySelectorAll(".nobold, .stattxt, #time, svg").forEach((node) => node.remove());
    return copy.textContent.replace(/\s+/g, " ").trim();
  }

  function reportStudyActions(actionSlot) {
    if (!actionSlot) return;
    const outerButtons = [...document.querySelectorAll("#innertable > tbody > tr > td.stat > button")];
    const base = {
      edit_label: buttonLabel(outerButtons[0]) || "Edit",
      more_label: buttonLabel(outerButtons[outerButtons.length - 1]) || "More",
    };
    const showAnswer = actionSlot.querySelector("#ansbut");
    let layout;
    if (showAnswer) {
      lastCardCounts = {
        new: actionSlot.querySelector(".new-count")?.textContent.trim() || "",
        learn: actionSlot.querySelector(".learn-count")?.textContent.trim() || "",
        review: actionSlot.querySelector(".review-count")?.textContent.trim() || "",
        active: actionSlot.querySelector(".new-count u") ? "new"
          : actionSlot.querySelector(".learn-count u") ? "learn"
            : actionSlot.querySelector(".review-count u") ? "review"
              : "",
      };
      layout = {
        ...base,
        side: "question",
        show_label: buttonLabel(showAnswer) || "Show Answer",
        counts: lastCardCounts,
      };
    } else {
      layout = {
        ...base,
        side: "answer",
        counts: lastCardCounts,
        buttons: [...actionSlot.querySelectorAll("button[data-ease]")].map((button) => ({
          ease: Number(button.dataset.ease),
          label: buttonLabel(button),
          due: button.querySelector(".nobold")?.textContent.trim() || "",
        })),
      };
    }
    const serialized = JSON.stringify(layout);
    if (serialized === lastStudyActions) return;
    lastStudyActions = serialized;
    send("study_actions", { layout });
  }

  function ensureTimer() {
    const middle = document.getElementById("middle");
    if (!middle) return;

    const existingSlot = middle.querySelector(":scope > .pf-study-actions");
    const nativeActions = [...middle.children].find((element) => (
      element.id !== "pf-bottom-timer"
      && element.id !== "pf-bottom-info"
      && !element.classList.contains("pf-study-actions")
    ));
    const actionSlot = existingSlot || (() => {
      if (!nativeActions) return null;
      const slot = document.createElement("div");
      slot.className = "pf-study-actions";
      middle.insertBefore(slot, nativeActions);
      slot.append(nativeActions);
      return slot;
    })();

    const answerButton = actionSlot?.querySelector("#ansbut");
    if (answerButton && !actionSlot.querySelector("#pf-skip-card")) {
      const cell = answerButton.closest("td");
      const row = cell?.parentElement;
      if (cell && row) {
        const counts = answerButton.querySelector(".stattxt");
        if (counts?.textContent.trim()) {
          const countsCell = document.createElement("td");
          countsCell.className = "pf-counts-cell";
          counts.id = "pf-question-counts";
          counts.setAttribute("aria-label", "New, learning, and review card counts");
          countsCell.append(counts);
          row.insertBefore(countsCell, cell);
        }
        const skipCell = document.createElement("td");
        skipCell.className = "pf-skip-cell";
        const skip = document.createElement("button");
        skip.id = "pf-skip-card";
        skip.type = "button";
        skip.title = "Skip this card for today";
        skip.textContent = "Skip";
        skip.addEventListener("click", () => send("skip_card"));
        skipCell.append(skip);
        row.insertBefore(skipCell, cell);
      }
    }

    if (!document.getElementById("pf-bottom-timer")) {
      const timer = document.createElement("button");
      timer.id = "pf-bottom-timer";
      timer.type = "button";
      timer.setAttribute("aria-label", "Open Pomodoro Focus");
      timer.innerHTML = `
        <span class="pf-bottom-time">25:00</span>
        <span class="pf-bottom-progress" aria-hidden="true">
          <span class="pf-bottom-progress-fill"></span>
        </span>
        <svg class="pf-bottom-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle class="pf-bottom-ring-track" pathLength="100" cx="20" cy="20" r="16"></circle>
          <circle class="pf-bottom-ring-fill" pathLength="100" cx="20" cy="20" r="16"></circle>
        </svg>`;
      timer.addEventListener("click", () => send("open_panel"));
      middle.prepend(timer);
    }

    if (!document.getElementById("pf-bottom-info")) {
      const info = document.createElement("button");
      info.id = "pf-bottom-info";
      info.type = "button";
      info.title = "Card info · I";
      info.setAttribute("aria-label", "Card info");
      info.innerHTML = `<span>Info</span>`;
      info.addEventListener("click", () => send("card_info"));
      middle.append(info);
    }
    reportStudyActions(actionSlot);
    render();
  }

  function render() {
    const timer = document.getElementById("pf-bottom-timer");
    if (!timer || !snapshot) return;

    const duration = Math.max(1, Number(snapshot.duration_seconds) || 1);
    const remaining = Math.max(0, Number(snapshot.remaining_seconds) || 0);
    const remainingProgress = Math.max(0, Math.min(1, remaining / duration));
    const visualProgress = snapshot.phase === "focus"
      ? 1 - remainingProgress
      : remainingProgress;
    const running = snapshot.state === "running";
    const phase = snapshot.phase === "focus" ? "Focus" : "Break";
    const indicator = ["line", "circle", "hidden"].includes(snapshot.config?.answer_timer_style)
      ? snapshot.config.answer_timer_style
      : "line";
    const buttonHeight = Math.max(36, Math.min(64, Number(snapshot.config?.answer_button_height) || 44));

    document.documentElement.style.setProperty("--pf-answer-height", `${buttonHeight}px`);
    timer.querySelector(".pf-bottom-time").textContent = indicator === "circle"
      ? String(Math.ceil(remaining / 60))
      : mmss(remaining);
    timer.querySelector(".pf-bottom-progress-fill").style.width = `${visualProgress * 100}%`;
    timer.querySelector(".pf-bottom-ring-fill").style.strokeDasharray = `${visualProgress * 87.5} 100`;
    timer.dataset.state = running ? "running" : "inactive";
    timer.dataset.phase = snapshot.phase;
    timer.dataset.indicator = indicator;
    timer.title = `${phase} · ${mmss(remaining)}`;
  }

  const observer = new MutationObserver(ensureTimer);
  let completionSignalTimer = null;
  const start = () => {
    const middle = document.getElementById("middle");
    if (!middle) {
      requestAnimationFrame(start);
      return;
    }
    observer.observe(middle, { childList: true });
    ensureTimer();
    send("ready_bottom");
  };

  window.PomodoroFocusBottom = {
    receive(data) {
      snapshot = data;
      ensureTimer();
      render();
    },
    signalFocusComplete() {
      const timer = document.getElementById("pf-bottom-timer");
      if (!timer) return;
      clearTimeout(completionSignalTimer);
      timer.classList.remove("pf-bottom-complete");
      void timer.offsetWidth;
      timer.classList.add("pf-bottom-complete");
      completionSignalTimer = setTimeout(
        () => timer.classList.remove("pf-bottom-complete"),
        1200
      );
    },
  };

  start();
})();
