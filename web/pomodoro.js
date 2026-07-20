(() => {
  "use strict";

  if (window.PomodoroFocus) return;

  const PREFIX = "pomodoro_focus:";
  const VIEW_MARGIN = 12;

  const icons = {
    play: '<polygon points="6 3 20 12 6 21 6 3"></polygon>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path>',
    skip: '<polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" x2="19" y1="5" y2="19"></line>',
    timer: '<circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 1.5"></path><path d="M9 2h6"></path>',
    coffee: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"></path><path d="M16 10h2a3 3 0 0 1 0 6h-2"></path>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 17 9 5 9-5"></path>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"></path>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle>',
    target: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
    chart: '<path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-7"></path><path d="M22 19H2"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v5M14 11v5"></path>',
    chevron: '<path d="m9 18 6-6-6-6"></path>',
    chevronDown: '<path d="m6 9 6 6 6-6"></path>',
    check: '<path d="m20 6-11 11-5-5"></path>',
    flame: '<path d="M12 22c4.4 0 8-3.1 8-7.5 0-3-1.5-5.6-4.3-8.1.1 2.3-1 4-2.4 4.8.2-3.7-1.8-6.7-5.2-9.2.2 3.4-1.6 5.6-3 7.4C3.8 11 4 13.2 4 14.5 4 18.9 7.6 22 12 22Z"></path>',
    maximize: '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>',
    circle: '<circle cx="12" cy="12" r="9"></circle>',
  };

  const icon = (name) => `<svg class="pf-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  const customSelect = (id, label, value, options, size = "compact") => `
    <div class="pf-select pf-select-${size}" id="${id}" data-value="${value}">
      <button class="pf-select-trigger" type="button" aria-label="${label}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-listbox">
        <span class="pf-select-value">${options.find((option) => option.value === value)?.label || ""}</span>
        ${icon("chevronDown")}
      </button>
      <div class="pf-select-menu" id="${id}-listbox" role="listbox" aria-label="${label}">
        ${options.map((option) => `
          <button class="pf-select-option" id="${id}-${option.value}" type="button" role="option" data-value="${option.value}" aria-selected="${String(option.value === value)}">
            <span>${option.label}</span>
            ${icon("check")}
          </button>`).join("")}
      </div>
    </div>`;

  const presetOptions = [
    { value: "classic", label: "Classic · 25/5/15" },
    { value: "deep", label: "Deep · 50/10/30" },
    { value: "quick", label: "Quick · 15/3/10" },
    { value: "custom", label: "Custom" },
  ];
  const idleOptions = [
    { value: "0", label: "Off" },
    ...Array.from({ length: 10 }, (_, index) => ({
      value: String(index + 1),
      label: `${index + 1} min`,
    })),
  ];
  const answerTimerStyleOptions = [
    { value: "time", label: "Time · MM:SS" },
    { value: "circle", label: "Circle" },
  ];
  let snapshot = null;
  let panelOpen = false;
  let historyOpen = false;
  let lastActivitySent = 0;

  const root = document.getElementById("pomodoro-focus-root");
  if (!root) return;

  root.innerHTML = `
    <div class="pf-shell pf-answer-bar-mode">
      <section class="pf-panel" id="pf-panel" role="dialog" aria-label="Pomodoro Focus controls" aria-hidden="true">
        <div class="pf-panel-inner">
          <div class="pf-timer-header">
            <h2 class="pf-product-title">Pomodoro Focus</h2>
            <div class="pf-exact-time" id="pf-exact-time">25:00</div>
          </div>
          <div class="pf-session-meta">
            <span class="pf-session-dot" aria-hidden="true"></span>
            <span class="pf-phase-name" id="pf-phase-name">Focus</span>
            <span aria-hidden="true">·</span>
            <span class="pf-round-label" id="pf-round-label">Round 1 of 4</span>
          </div>

          <div class="pf-controls">
            <button class="pf-button" id="pf-reset" type="button" aria-label="Reset phase" title="Reset phase">${icon("reset")}</button>
            <button class="pf-button pf-button-primary" id="pf-primary" type="button">${icon("play")}<span>Start Focus</span></button>
            <button class="pf-button" id="pf-skip" type="button" aria-label="Skip phase" title="Skip phase">${icon("skip")}</button>
          </div>

          <div class="pf-status-banner" id="pf-status-banner"></div>

          <div class="pf-metrics">
            <div class="pf-metric">
              <div class="pf-metric-value" id="pf-goal-value">0 / 4</div>
              <div class="pf-metric-label">Today</div>
              <div class="pf-goal-track"><div class="pf-goal-fill" id="pf-goal-fill"></div></div>
            </div>
            <div class="pf-metric">
              <div class="pf-metric-value" id="pf-streak-value">0 days</div>
              <div class="pf-metric-label">Current streak</div>
            </div>
          </div>

          <div class="pf-settings">
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("layers")}</span>
              <span class="pf-setting-label">Preset</span>
              ${customSelect("pf-preset", "Preset", "classic", presetOptions, "wide")}
            </div>
            <label class="pf-setting-row pf-custom-duration-row">
              <span class="pf-setting-icon">${icon("timer")}</span>
              <span class="pf-setting-label">Focus duration</span>
              <input class="pf-setting-control" id="pf-focus-minutes" type="number" min="1" max="120" inputmode="numeric" aria-label="Focus duration in minutes">
            </label>
            <label class="pf-setting-row pf-custom-duration-row">
              <span class="pf-setting-icon">${icon("coffee")}</span>
              <span class="pf-setting-label">Short break</span>
              <input class="pf-setting-control" id="pf-short-minutes" type="number" min="1" max="60" inputmode="numeric" aria-label="Short break in minutes">
            </label>
            <label class="pf-setting-row pf-custom-duration-row">
              <span class="pf-setting-icon">${icon("moon")}</span>
              <span class="pf-setting-label">Long break</span>
              <input class="pf-setting-control" id="pf-long-minutes" type="number" min="1" max="120" inputmode="numeric" aria-label="Long break in minutes">
            </label>
            <label class="pf-setting-row">
              <span class="pf-setting-icon">${icon("layers")}</span>
              <span class="pf-setting-label">Long break after</span>
              <input class="pf-setting-control" id="pf-long-after" type="number" min="1" max="8" inputmode="numeric" aria-label="Focus rounds before a long break">
            </label>
          </div>

          <div class="pf-settings">
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("pause")}</span>
              <span class="pf-setting-label">Idle auto-pause</span>
              ${customSelect("pf-idle-minutes", "Idle auto-pause", "2", idleOptions)}
            </div>
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("eye")}</span>
              <span class="pf-setting-label">Focus Hide</span>
              <button class="pf-switch" id="pf-focus-hide" type="button" role="switch" aria-checked="true" aria-label="Focus Hide"></button>
            </div>
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("bell")}</span>
              <span class="pf-setting-label">Completion sound</span>
              <button class="pf-switch" id="pf-sound" type="button" role="switch" aria-checked="true" aria-label="Completion sound"></button>
            </div>
            <label class="pf-setting-row">
              <span class="pf-setting-icon">${icon("target")}</span>
              <span class="pf-setting-label">Daily goal</span>
              <input class="pf-setting-control" id="pf-daily-goal" type="number" min="1" max="12" inputmode="numeric" aria-label="Daily Pomodoro goal">
            </label>
          </div>

          <div class="pf-settings">
            <button class="pf-row-button" id="pf-history-button" type="button">
              <span class="pf-setting-icon">${icon("chart")}</span>
              <span class="pf-setting-label">7-day history</span>
              <span class="pf-row-value" id="pf-history-chevron">${icon("chevron")}</span>
            </button>
            <button class="pf-row-button pf-danger" id="pf-clear-history" type="button">
              <span class="pf-setting-icon">${icon("trash")}</span>
              <span class="pf-setting-label">Clear history</span>
              <span class="pf-row-value">Clear</span>
            </button>
          </div>

          <div class="pf-history" id="pf-history">
            <div class="pf-chart" id="pf-chart"></div>
            <div class="pf-history-note" id="pf-history-note"></div>
          </div>

          <div class="pf-settings pf-answer-bar-settings">
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("circle")}</span>
              <span class="pf-setting-label">Timer</span>
              ${customSelect("pf-answer-timer-style", "Answer bar timer", "time", answerTimerStyleOptions)}
            </div>
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("maximize")}</span>
              <span class="pf-setting-label">Button height</span>
              <div class="pf-size-control">
                <input id="pf-answer-button-height" type="range" min="36" max="64" step="2" value="44" aria-label="Answer bar button height in pixels">
                <output id="pf-answer-button-height-value" for="pf-answer-button-height">44 px</output>
              </div>
            </div>
          </div>
          <div class="pf-local-note">Local only · 90-day history · no card content stored</div>
        </div>

        <div class="pf-confirm" id="pf-confirm" aria-hidden="true">
          <div class="pf-confirm-dialog">
            <div class="pf-confirm-title" id="pf-confirm-title">Reset this phase?</div>
            <div class="pf-confirm-copy" id="pf-confirm-copy"></div>
            <div class="pf-confirm-actions">
              <button class="pf-button" id="pf-confirm-cancel" type="button">Cancel</button>
              <button class="pf-button pf-button-primary" id="pf-confirm-accept" type="button">Reset</button>
            </div>
          </div>
        </div>
      </section>
    </div>`;

  const $ = (selector) => root.querySelector(selector);
  const panel = $("#pf-panel");
  const confirmLayer = $("#pf-confirm");
  let confirmAction = null;

  function send(action, data = {}) {
    if (typeof pycmd === "function") {
      pycmd(PREFIX + JSON.stringify({ action, ...data }));
    }
  }

  function phaseLabel(phase) {
    if (phase === "short_break") return "Short Break";
    if (phase === "long_break") return "Long Break";
    return "Focus";
  }

  function mmss(value) {
    const seconds = Math.max(0, Math.ceil(Number(value) || 0));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function setControlValue(element, value) {
    if (element?.classList.contains("pf-select")) {
      setCustomSelectValue(element, value);
      return;
    }
    if (document.activeElement !== element) element.value = String(value);
  }

  function setCustomSelectValue(select, value) {
    if (!select) return;
    const normalized = String(value);
    const options = [...select.querySelectorAll(".pf-select-option")];
    const selected = options.find((option) => option.dataset.value === normalized) || options[0];
    if (!selected) return;
    select.dataset.value = selected.dataset.value;
    select.querySelector(".pf-select-value").textContent = selected.querySelector("span").textContent;
    options.forEach((option) => option.setAttribute("aria-selected", String(option === selected)));
  }

  function closeCustomSelect(select, restoreFocus = false) {
    if (!select?.classList.contains("pf-open")) return;
    select.classList.remove("pf-open", "pf-select-up");
    select.querySelector(".pf-select-trigger").setAttribute("aria-expanded", "false");
    select.querySelector(".pf-select-menu").style.removeProperty("--pf-select-menu-height");
    if (restoreFocus) select.querySelector(".pf-select-trigger").focus();
  }

  function closeCustomSelects(except = null) {
    root.querySelectorAll(".pf-select.pf-open").forEach((select) => {
      if (select !== except) closeCustomSelect(select);
    });
  }

  function openCustomSelect(select, focusOption = false) {
    if (!select) return;
    closeCustomSelects(select);
    const trigger = select.querySelector(".pf-select-trigger");
    const menu = select.querySelector(".pf-select-menu");
    select.classList.add("pf-open");
    trigger.setAttribute("aria-expanded", "true");

    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const roomBelow = Math.max(0, panelRect.bottom - triggerRect.bottom - 10);
    const roomAbove = Math.max(0, triggerRect.top - panelRect.top - 10);
    const openUp = roomBelow < Math.min(220, menu.scrollHeight) && roomAbove > roomBelow;
    select.classList.toggle("pf-select-up", openUp);
    const availableRoom = openUp ? roomAbove : roomBelow;
    menu.style.setProperty("--pf-select-menu-height", `${Math.max(76, Math.min(276, availableRoom))}px`);

    if (focusOption) {
      const selected = select.querySelector('.pf-select-option[aria-selected="true"]') || select.querySelector(".pf-select-option");
      selected?.focus();
    }
  }

  function commitCustomSelect(select, option) {
    if (!select || !option) return;
    const value = option.dataset.value;
    setCustomSelectValue(select, value);
    closeCustomSelect(select, true);
    select.dispatchEvent(new CustomEvent("pf-change", { detail: { value } }));
  }

  function initializeCustomSelect(select) {
    const trigger = select.querySelector(".pf-select-trigger");
    const menu = select.querySelector(".pf-select-menu");
    const options = [...select.querySelectorAll(".pf-select-option")];

    trigger.addEventListener("click", () => {
      if (select.classList.contains("pf-open")) closeCustomSelect(select);
      else openCustomSelect(select);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openCustomSelect(select, true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeCustomSelect(select);
      }
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest(".pf-select-option");
      if (option) commitCustomSelect(select, option);
    });
    menu.addEventListener("keydown", (event) => {
      const current = event.target.closest(".pf-select-option");
      if (!current) return;
      const index = options.indexOf(current);
      let nextIndex = null;
      if (event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
      if (event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = options.length - 1;
      if (nextIndex !== null) {
        event.preventDefault();
        options[nextIndex].focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        commitCustomSelect(select, current);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeCustomSelect(select, true);
      }
    });
    select.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!select.contains(document.activeElement)) closeCustomSelect(select);
      }, 0);
    });
  }

  function accentColor(data) {
    if (data.state !== "running") return "var(--pf-inactive)";
    return data.phase === "focus" ? "var(--pf-focus)" : "var(--pf-break)";
  }

  function primaryState(data) {
    if (data.state === "running") return { label: "Pause", icon: "pause", action: "pause" };
    if (data.state === "paused") return { label: "Resume", icon: "play", action: "resume" };
    if (data.state === "completed") {
      return data.completion?.kind === "focus"
        ? { label: "Start Break", icon: "play", action: "start" }
        : { label: "Start Focus", icon: "play", action: "start" };
    }
    return data.phase === "focus"
      ? { label: "Start Focus", icon: "play", action: "start" }
      : { label: "Start Break", icon: "play", action: "start" };
  }

  function statusCopy(data) {
    if (data.state === "completed" && data.completion?.kind === "focus") {
      const cards = data.completion.answers || 0;
      const next = data.completion.next_phase === "long_break" ? "Long break ready" : "Short break ready";
      return `${cards} ${cards === 1 ? "card" : "cards"} reviewed · ${next}`;
    }
    if (data.state === "completed") return "Break complete · Answer a card or start focus";
    if (data.state === "paused") {
      const reason = data.pause_reason;
      if (data.phase !== "focus") return "Break paused · Resume or answer a card to start focus";
      if (reason === "idle") return "Paused for inactivity · Answer a card to resume";
      if (reason === "reviewer_left" || reason === "app_inactive" || reason === "app_closed") return "Paused while away · Answer a card to resume";
      return "Focus paused · Answer a card or resume";
    }
    if (data.state === "idle" && data.phase === "focus") return "Ready · Answer a card or start focus";
    if (data.state === "idle") return "Break ready · Start break or answer a card to focus";
    return "";
  }

  function renderHistory(data) {
    const chart = $("#pf-chart");
    const days = data.daily?.days || [];
    chart.innerHTML = days.map((day) => {
      const label = new Date(`${day.date}T12:00:00`).toLocaleDateString("en", { weekday: "short" }).slice(0, 2);
      const percent = Math.max(5, Math.min(100, (day.completed / Math.max(1, day.goal)) * 100));
      const title = `${day.completed}/${day.goal} Pomodoros · ${day.answers} cards`;
      return `<div class="pf-day ${day.goal_met ? "pf-goal-met" : ""}" title="${title}">
        <div class="pf-day-bar-wrap"><div class="pf-day-bar" style="height:${percent}%"></div></div>
        <div class="pf-day-label">${label}</div>
      </div>`;
    }).join("");
    const today = data.daily?.today || { completed: 0, answers: 0 };
    $("#pf-history-note").textContent = `Today: ${today.completed} completed · ${today.answers} cards reviewed`;
  }

  function render(data) {
    snapshot = data;
    const shell = $(".pf-shell");
    shell.style.setProperty("--pf-ring", accentColor(data));
    shell.classList.toggle("pf-custom-preset", data.config.preset === "custom");
    $("#pf-exact-time").textContent = mmss(data.remaining_seconds);
    $("#pf-phase-name").textContent = phaseLabel(data.phase);
    const cardCount = data.phase === "focus" && data.answer_count > 0 ? ` · ${data.answer_count} cards` : "";
    $("#pf-round-label").textContent = `Round ${data.round_index}${cardCount}`;
    const primary = primaryState(data);
    const primaryButton = $("#pf-primary");
    primaryButton.dataset.action = primary.action;
    primaryButton.innerHTML = `${icon(primary.icon)}<span>${primary.label}</span>`;
    $("#pf-reset").disabled = data.state === "completed";
    $("#pf-skip").disabled = data.state === "completed";

    const banner = $("#pf-status-banner");
    const copy = statusCopy(data);
    banner.textContent = copy;
    banner.classList.toggle("pf-visible", Boolean(copy));

    const today = data.daily?.today || { completed: 0, goal: data.config.daily_goal };
    $("#pf-goal-value").textContent = `${today.completed} / ${today.goal}`;
    $("#pf-goal-fill").style.width = `${Math.min(100, (today.completed / Math.max(1, today.goal)) * 100)}%`;
    const streak = Number(data.daily?.streak || 0);
    $("#pf-streak-value").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;

    setControlValue($("#pf-preset"), data.config.preset);
    setControlValue($("#pf-focus-minutes"), data.config.focus_minutes);
    setControlValue($("#pf-short-minutes"), data.config.short_break_minutes);
    setControlValue($("#pf-long-minutes"), data.config.long_break_minutes);
    setControlValue($("#pf-long-after"), data.config.long_break_after);
    setControlValue($("#pf-idle-minutes"), data.config.idle_autopause_enabled ? data.config.idle_minutes : 0);
    setControlValue($("#pf-daily-goal"), data.config.daily_goal);
    setControlValue(
      $("#pf-answer-timer-style"),
      data.config.answer_timer_style === "circle" ? "circle" : "time"
    );
    setControlValue($("#pf-answer-button-height"), data.config.answer_button_height);
    $("#pf-answer-button-height-value").textContent = `${data.config.answer_button_height} px`;
    $("#pf-focus-hide").setAttribute("aria-checked", String(Boolean(data.config.focus_hide)));
    $("#pf-sound").setAttribute("aria-checked", String(Boolean(data.config.completion_sound)));

    renderHistory(data);
    positionPanel();
  }

  function positionPanel() {
    if (!panelOpen) return;
    const availableHeight = window.innerHeight - VIEW_MARGIN * 2;
    panel.style.maxHeight = `${Math.max(160, Math.min(720, availableHeight))}px`;
    const width = panel.offsetWidth || 380;
    const height = panel.offsetHeight || Math.min(720, availableHeight);
    const left = Math.max(VIEW_MARGIN, Math.min(window.innerWidth - width - VIEW_MARGIN, 16));
    const top = Math.max(VIEW_MARGIN, window.innerHeight - height - 12);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function openPanel() {
    panelOpen = true;
    panel.scrollTop = 0;
    panel.classList.add("pf-open");
    panel.setAttribute("aria-hidden", "false");
    requestAnimationFrame(positionPanel);
  }

  function closePanel() {
    panelOpen = false;
    closeCustomSelects();
    hideConfirm();
    panel.classList.remove("pf-open");
    panel.setAttribute("aria-hidden", "true");
  }

  function reportActivity(force = false) {
    const now = Date.now();
    if (force || now - lastActivitySent >= 10000) {
      lastActivitySent = now;
      send("activity");
    }
  }

  function showConfirm(title, copy, label, action) {
    closeCustomSelects();
    confirmAction = action;
    $("#pf-confirm-title").textContent = title;
    $("#pf-confirm-copy").textContent = copy;
    $("#pf-confirm-accept").textContent = label;
    confirmLayer.classList.add("pf-visible");
    confirmLayer.setAttribute("aria-hidden", "false");
    $("#pf-confirm-cancel").focus();
  }

  function hideConfirm() {
    confirmAction = null;
    confirmLayer.classList.remove("pf-visible");
    confirmLayer.setAttribute("aria-hidden", "true");
  }

  function sendSettings(settings) {
    send("update_settings", { settings });
    reportActivity(true);
  }

  root.querySelectorAll(".pf-select").forEach(initializeCustomSelect);

  $("#pf-primary").addEventListener("click", () => {
    if (!snapshot) return;
    send($("#pf-primary").dataset.action || "start");
    reportActivity(true);
  });

  $("#pf-reset").addEventListener("click", () => {
    if (!snapshot) return;
    const hasProgress = snapshot.elapsed_seconds > 0.5 || snapshot.answer_count > 0;
    if (hasProgress) {
      showConfirm(
        "Reset this phase?",
        "Elapsed time and the current card count will be discarded. Your cycle position stays the same.",
        "Reset",
        () => send("reset")
      );
    } else {
      send("reset");
    }
  });

  $("#pf-skip").addEventListener("click", () => send("skip"));
  $("#pf-preset").addEventListener("pf-change", (event) => sendSettings({ preset: event.detail.value }));
  $("#pf-focus-minutes").addEventListener("change", (event) => sendSettings({ focus_minutes: Number(event.target.value) }));
  $("#pf-short-minutes").addEventListener("change", (event) => sendSettings({ short_break_minutes: Number(event.target.value) }));
  $("#pf-long-minutes").addEventListener("change", (event) => sendSettings({ long_break_minutes: Number(event.target.value) }));
  $("#pf-long-after").addEventListener("change", (event) => sendSettings({ long_break_after: Number(event.target.value) }));
  $("#pf-daily-goal").addEventListener("change", (event) => sendSettings({ daily_goal: Number(event.target.value) }));
  $("#pf-answer-timer-style").addEventListener("pf-change", (event) => {
    sendSettings({ answer_timer_style: event.detail.value });
  });
  $("#pf-answer-button-height").addEventListener("input", (event) => {
    const height = Number(event.target.value);
    $("#pf-answer-button-height-value").textContent = `${height} px`;
    sendSettings({ answer_button_height: height });
  });
  $("#pf-idle-minutes").addEventListener("pf-change", (event) => {
    const value = Number(event.detail.value);
    sendSettings({ idle_autopause_enabled: value > 0, idle_minutes: Math.max(1, value || 2) });
  });

  $("#pf-focus-hide").addEventListener("click", (event) => {
    const enabled = event.currentTarget.getAttribute("aria-checked") !== "true";
    event.currentTarget.setAttribute("aria-checked", String(enabled));
    sendSettings({ focus_hide: enabled });
  });

  $("#pf-sound").addEventListener("click", (event) => {
    const enabled = event.currentTarget.getAttribute("aria-checked") !== "true";
    event.currentTarget.setAttribute("aria-checked", String(enabled));
    sendSettings({ completion_sound: enabled });
  });

  $("#pf-history-button").addEventListener("click", () => {
    historyOpen = !historyOpen;
    $("#pf-history").classList.toggle("pf-visible", historyOpen);
    $("#pf-history-button").setAttribute("aria-expanded", String(historyOpen));
    requestAnimationFrame(positionPanel);
  });

  $("#pf-clear-history").addEventListener("click", () => {
    showConfirm(
      "Clear all history?",
      "This permanently removes the local 90-day Pomodoro history. Timer settings are kept.",
      "Clear",
      () => send("clear_history")
    );
  });

  $("#pf-confirm-cancel").addEventListener("click", hideConfirm);
  $("#pf-confirm-accept").addEventListener("click", () => {
    const action = confirmAction;
    hideConfirm();
    if (action) action();
  });

  document.addEventListener("pointerdown", (event) => {
    reportActivity();
    const activeSelect = event.target.closest?.(".pf-select") || null;
    closeCustomSelects(activeSelect);
    if (panelOpen && !panel.contains(event.target)) closePanel();
  }, { passive: true });
  document.addEventListener("pointermove", () => reportActivity(), { passive: true });
  document.addEventListener("keydown", (event) => {
    reportActivity(true);
    if (event.key === "Escape") {
      const openSelect = root.querySelector(".pf-select.pf-open");
      if (openSelect) closeCustomSelect(openSelect, true);
      else if (confirmLayer.classList.contains("pf-visible")) hideConfirm();
      else if (panelOpen) closePanel();
    }
  });
  window.addEventListener("resize", () => {
    positionPanel();
  });

  window.PomodoroFocus = {
    receive: render,
    openPanel,
    closePanel,
  };

  send("ready");
})();
