(() => {
  "use strict";

  if (window.PomodoroFocus) return;

  const PREFIX = "pomodoro_focus:";
  const DEFAULT_CARD_SIZE = 96;
  const MIN_CARD_SIZE = 50;
  const MAX_CARD_SIZE = 144;
  const VIEW_MARGIN = 12;
  const HIDE_DELAY = 3000;
  const RING_CENTER = 50;
  const RING_RADIUS = 41.5;
  const RING_START_DEGREES = 112.5;
  const RING_SWEEP_DEGREES = 315;
  const LINE_REFERENCE_CARD_SIZE = 112;
  const LINE_REFERENCE_FONT_SIZE = 67;
  const CIRCLE_REFERENCE_CARD_SIZE = 112;
  const CIRCLE_REFERENCE_FONT_SIZE = 45;

  function ringPoint(degrees) {
    const radians = degrees * Math.PI / 180;
    return {
      x: RING_CENTER + RING_RADIUS * Math.cos(radians),
      y: RING_CENTER + RING_RADIUS * Math.sin(radians),
    };
  }

  function ringArcPath(progress) {
    const normalized = Math.max(0, Math.min(1, Number(progress) || 0));
    if (normalized === 0) return "";
    const sweep = RING_SWEEP_DEGREES * normalized;
    const start = ringPoint(RING_START_DEGREES);
    const end = ringPoint(RING_START_DEGREES + sweep);
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

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
    move: '<path d="M12 2v20M2 12h20"></path><path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"></path>',
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
  const progressStyleOptions = [
    { value: "line", label: "Line" },
    { value: "circle", label: "Circle" },
  ];
  const answerTimerStyleOptions = [
    { value: "line", label: "Line" },
    { value: "circle", label: "Circle" },
    { value: "hidden", label: "Hidden" },
  ];

  let snapshot = null;
  let panelOpen = false;
  let historyOpen = false;
  let hideTimer = null;
  let completionSignalTimer = null;
  let lastActivitySent = 0;
  let lastHideKey = "";
  let dragging = null;
  let activeCardSize = DEFAULT_CARD_SIZE;
  let activeProgressStyle = "line";
  let activeMinuteBoxWidth = 64;
  let activeMinuteBoxHeight = 76;
  let displayedMinutes = 25;
  let answerBarMode = true;
  let studyActions = null;
  let liquidGlassFrame = null;
  const liquidFilterCache = new Map();
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  const root = document.getElementById("pomodoro-focus-root");
  if (!root) return;

  root.innerHTML = `
    <div class="pf-shell pf-answer-bar-mode">
      <button class="pf-card" id="pf-card" type="button" aria-label="Open Pomodoro Focus" title="Pomodoro Focus">
        <span class="pf-minute-box" id="pf-minute">25</span>
        <span class="pf-card-progress-track" aria-hidden="true">
          <span class="pf-card-progress" id="pf-card-progress"></span>
        </span>
        <svg class="pf-card-progress-ring" viewBox="0 0 100 100" aria-hidden="true">
          <path class="pf-card-ring-track" d="${ringArcPath(1)}"></path>
          <path class="pf-card-ring-progress" id="pf-card-ring-progress"></path>
        </svg>
      </button>

      <svg class="pf-liquid-definitions" aria-hidden="true" focusable="false">
        <defs id="pf-liquid-filter-defs"></defs>
      </svg>

      <div class="pf-review-bar" id="pf-review-bar" aria-label="Review controls">
        <div class="pf-review-edge pf-review-left">
          <button class="pf-review-control pf-review-timer" id="pf-review-timer" type="button" aria-label="Open Pomodoro Focus">
            <span class="pf-review-time">25:00</span>
            <span class="pf-review-progress" aria-hidden="true"><span class="pf-review-progress-fill"></span></span>
            <svg class="pf-review-ring" viewBox="0 0 40 40" aria-hidden="true">
              <circle class="pf-review-ring-track" pathLength="100" cx="20" cy="20" r="16"></circle>
              <circle class="pf-review-ring-fill" pathLength="100" cx="20" cy="20" r="16"></circle>
            </svg>
          </button>
          <div class="pf-review-counts" id="pf-review-counts" aria-label="New, learning, and review card counts" hidden>
            <span class="pf-review-count-card pf-review-new" id="pf-review-new" title="New cards"></span>
            <span class="pf-review-count-card pf-review-learn" id="pf-review-learn" title="Learning cards"></span>
            <span class="pf-review-count-card pf-review-due" id="pf-review-due" title="Review cards"></span>
          </div>
        </div>
        <div class="pf-review-actions" id="pf-review-actions"></div>
        <div class="pf-review-edge pf-review-right">
          <button class="pf-review-control pf-review-utility" id="pf-review-edit" type="button" aria-label="Edit" title="Edit">
            <span class="pf-sf-symbol pf-sf-square-and-pencil" aria-hidden="true"></span>
          </button>
          <button class="pf-review-control pf-review-utility" id="pf-review-info" type="button" aria-label="Info" title="Info">
            <span class="pf-sf-symbol pf-sf-info-circle" aria-hidden="true"></span>
          </button>
          <button class="pf-review-control pf-review-utility" id="pf-review-more" type="button" aria-label="More" title="More">
            <span class="pf-sf-symbol pf-sf-ellipsis" aria-hidden="true"></span>
          </button>
        </div>
      </div>

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
            <label class="pf-setting-row">
              <span class="pf-setting-icon">${icon("timer")}</span>
              <span class="pf-setting-label">Focus duration</span>
              <input class="pf-setting-control" id="pf-focus-minutes" type="number" min="1" max="120" inputmode="numeric" aria-label="Focus duration in minutes">
            </label>
            <label class="pf-setting-row">
              <span class="pf-setting-icon">${icon("coffee")}</span>
              <span class="pf-setting-label">Short break</span>
              <input class="pf-setting-control" id="pf-short-minutes" type="number" min="1" max="60" inputmode="numeric" aria-label="Short break in minutes">
            </label>
            <label class="pf-setting-row">
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
            <button class="pf-row-button" id="pf-reset-position" type="button">
              <span class="pf-setting-icon">${icon("move")}</span>
              <span class="pf-setting-label">Reset card position</span>
              <span class="pf-row-value">Reset</span>
            </button>
            <button class="pf-row-button pf-danger" id="pf-clear-history" type="button">
              <span class="pf-setting-icon">${icon("trash")}</span>
              <span class="pf-setting-label">Clear history</span>
              <span class="pf-row-value">Clear</span>
            </button>
          </div>

          <div class="pf-settings pf-size-settings">
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("circle")}</span>
              <span class="pf-setting-label">Progress style</span>
              ${customSelect("pf-progress-style", "Progress style", "line", progressStyleOptions)}
            </div>
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("maximize")}</span>
              <span class="pf-setting-label">Card size</span>
              <div class="pf-size-control">
                <input id="pf-card-size" type="range" min="50" max="144" step="2" value="96" aria-label="Card size in pixels">
                <output id="pf-card-size-value" for="pf-card-size">96 px</output>
              </div>
            </div>
          </div>

          <div class="pf-history" id="pf-history">
            <div class="pf-chart" id="pf-chart"></div>
            <div class="pf-history-note" id="pf-history-note"></div>
          </div>

          <div class="pf-settings pf-answer-bar-settings">
            <div class="pf-setting-row">
              <span class="pf-setting-icon">${icon("circle")}</span>
              <span class="pf-setting-label">Timer indicator</span>
              ${customSelect("pf-answer-timer-style", "Answer bar timer indicator", "line", answerTimerStyleOptions)}
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
  const card = $("#pf-card");
  const panel = $("#pf-panel");
  const confirmLayer = $("#pf-confirm");
  let confirmAction = null;

  function roundedRectangleDistance(x, y, width, height, radius) {
    const qx = Math.abs(x - width / 2) - (width / 2 - radius);
    const qy = Math.abs(y - height / 2) - (height / 2 - radius);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
      + Math.min(Math.max(qx, qy), 0)
      - radius;
  }

  function liquidDisplacementMap(width, height, radius, bezel) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return "";
    const image = context.createImageData(width, height);
    const pixels = image.data;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const distance = -roundedRectangleDistance(x + .5, y + .5, width, height, radius);
        let red = 128;
        let green = 128;
        if (distance >= 0 && distance < bezel) {
          const gradientX = roundedRectangleDistance(x + 1.5, y + .5, width, height, radius)
            - roundedRectangleDistance(x - .5, y + .5, width, height, radius);
          const gradientY = roundedRectangleDistance(x + .5, y + 1.5, width, height, radius)
            - roundedRectangleDistance(x + .5, y - .5, width, height, radius);
          const length = Math.hypot(gradientX, gradientY) || 1;
          const edge = 1 - distance / bezel;
          const strength = edge * edge * (3 - 2 * edge);
          red = Math.round(128 - gradientX / length * strength * 127);
          green = Math.round(128 - gradientY / length * strength * 127);
        }
        pixels[offset] = Math.max(0, Math.min(255, red));
        pixels[offset + 1] = Math.max(0, Math.min(255, green));
        pixels[offset + 2] = 128;
        pixels[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function liquidFilterFor(width, height, radius) {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    const safeRadius = Math.max(1, Math.min(Math.round(radius), Math.floor(safeHeight / 2)));
    const bezel = Math.max(7, Math.min(14, Math.round(safeHeight * .24)));
    const key = `${safeWidth}-${safeHeight}-${safeRadius}-${bezel}`;
    if (liquidFilterCache.has(key)) return liquidFilterCache.get(key);

    const definitions = $("#pf-liquid-filter-defs");
    const id = `pf-liquid-${key}`;
    const filter = document.createElementNS(SVG_NAMESPACE, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(safeWidth));
    filter.setAttribute("height", String(safeHeight));
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const map = document.createElementNS(SVG_NAMESPACE, "feImage");
    const mapUrl = liquidDisplacementMap(safeWidth, safeHeight, safeRadius, bezel);
    map.setAttribute("href", mapUrl);
    map.setAttribute("x", "0");
    map.setAttribute("y", "0");
    map.setAttribute("width", String(safeWidth));
    map.setAttribute("height", String(safeHeight));
    map.setAttribute("preserveAspectRatio", "none");
    map.setAttribute("result", "pf-displacement-map");

    const displacement = document.createElementNS(SVG_NAMESPACE, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "pf-displacement-map");
    displacement.setAttribute("scale", String(Math.max(3.5, Math.min(6, safeHeight * .1))));
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");

    filter.append(map, displacement);
    definitions.append(filter);
    liquidFilterCache.set(key, id);
    return id;
  }

  function applyLiquidGlass() {
    liquidGlassFrame = null;
    const supportsSvgBackdrop = typeof CSS !== "undefined"
      && typeof CSS.supports === "function"
      && (CSS.supports("backdrop-filter", "url(#pf-liquid-probe)")
        || CSS.supports("-webkit-backdrop-filter", "url(#pf-liquid-probe)"));
    const shell = $(".pf-shell");
    shell.classList.toggle("pf-liquid-svg-supported", supportsSvgBackdrop);
    if (!supportsSvgBackdrop || !answerBarMode) return;

    root.querySelectorAll(".pf-review-control, .pf-review-counts").forEach((element) => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      const radius = Number(getComputedStyle(element).borderRadius.replace("px", "")) || bounds.height / 4;
      const filterId = liquidFilterFor(bounds.width, bounds.height, radius);
      if (element.dataset.liquidFilter === filterId) return;
      element.dataset.liquidFilter = filterId;
      element.style.setProperty("--pf-liquid-filter", `url("#${filterId}")`);
      element.classList.add("pf-liquid-svg");
    });
  }

  function scheduleLiquidGlass() {
    if (liquidGlassFrame !== null) cancelAnimationFrame(liquidGlassFrame);
    liquidGlassFrame = requestAnimationFrame(applyLiquidGlass);
  }

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

  function clampCardSize(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_CARD_SIZE;
    return Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, parsed));
  }

  function applyCardSize(value) {
    activeCardSize = clampCardSize(value);
    const shell = $(".pf-shell");
    const cardRadius = Math.max(12, Math.min(20, activeCardSize * 0.134));
    const progressInset = activeCardSize * (12 / 112);
    const progressHeight = activeCardSize * (15 / 112);
    const lineGap = 0;
    const ringStroke = Math.max(5, Math.min(8, activeCardSize * 0.0714));
    const ringInnerRadius = activeCardSize * (RING_RADIUS / 100) - ringStroke / 2;
    const circleTextBox = Math.max(1, Math.SQRT2 * ringInnerRadius);
    activeMinuteBoxWidth = activeProgressStyle === "circle"
      ? circleTextBox
      : activeCardSize - 2 * progressInset;
    activeMinuteBoxHeight = activeProgressStyle === "circle"
      ? circleTextBox
      : activeCardSize - (2 * progressInset) - progressHeight;
    shell.style.setProperty("--pf-card-size", `${activeCardSize}px`);
    shell.style.setProperty("--pf-card-radius", `${cardRadius}px`);
    shell.style.setProperty("--pf-progress-inset", `${progressInset}px`);
    shell.style.setProperty("--pf-progress-height", `${progressHeight}px`);
    shell.style.setProperty("--pf-line-gap", `${lineGap}px`);
    shell.style.setProperty("--pf-line-box-height", `${activeMinuteBoxHeight}px`);
    shell.style.setProperty("--pf-ring-stroke", `${ringStroke}px`);
    shell.style.setProperty("--pf-circle-text-box", `${circleTextBox}px`);
    applyMinuteTypography(displayedMinutes);
    $("#pf-card-size-value").textContent = `${Math.round(activeCardSize)} px`;
  }

  function applyMinuteTypography(minutes) {
    const digits = String(Math.max(0, Math.round(Number(minutes) || 0))).length;
    const circleStyle = activeProgressStyle === "circle";
    const sizeRatio = circleStyle
      ? (digits >= 3 ? 0.32 : CIRCLE_REFERENCE_FONT_SIZE / CIRCLE_REFERENCE_CARD_SIZE)
      : (digits >= 3 ? 0.43 : LINE_REFERENCE_FONT_SIZE / LINE_REFERENCE_CARD_SIZE);
    const spacingRatio = circleStyle
      ? (digits >= 3 ? -0.019 : digits === 1 ? -0.015 : -0.026)
      : -0.035;
    const scaleX = 1;
    const shell = $(".pf-shell");
    shell.style.setProperty("--pf-minute-size", `${activeCardSize * sizeRatio}px`);
    shell.style.setProperty("--pf-minute-spacing", `${activeCardSize * spacingRatio}px`);
    shell.style.setProperty("--pf-minute-scale-x", String(scaleX));
    fitMinuteText(activeCardSize * sizeRatio, scaleX);
  }

  function fitMinuteText(nominalSize, scaleX) {
    const minute = $("#pf-minute");
    if (!minute) return;
    minute.style.fontSize = `${nominalSize}px`;
    minute.style.transform = `translate(-50%, -50%) scaleX(${scaleX})`;
    const bounds = minute.getBoundingClientRect();
    const fit = Math.min(
      1,
      Math.max(1, activeMinuteBoxWidth - 2) / Math.max(1, bounds.width),
      Math.max(1, activeMinuteBoxHeight - 2) / Math.max(1, bounds.height)
    );
    minute.style.fontSize = `${nominalSize * fit}px`;
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

  function renderReviewTimer(data) {
    const timer = $("#pf-review-timer");
    const duration = Math.max(1, Number(data.duration_seconds) || 1);
    const remaining = Math.max(0, Number(data.remaining_seconds) || 0);
    const remainingProgress = Math.max(0, Math.min(1, remaining / duration));
    const visualProgress = data.phase === "focus" ? 1 - remainingProgress : remainingProgress;
    const indicator = ["line", "circle", "hidden"].includes(data.config.answer_timer_style)
      ? data.config.answer_timer_style
      : "line";
    const height = Math.max(36, Math.min(64, Number(data.config.answer_button_height) || 44));
    $(".pf-shell").style.setProperty("--pf-review-height", `${height}px`);
    timer.dataset.indicator = indicator;
    timer.dataset.state = data.state === "running" ? "running" : "inactive";
    timer.dataset.phase = data.phase;
    timer.title = `${phaseLabel(data.phase)} · ${mmss(remaining)}`;
    timer.querySelector(".pf-review-time").textContent = indicator === "circle"
      ? String(Math.ceil(remaining / 60))
      : mmss(remaining);
    timer.querySelector(".pf-review-progress-fill").style.width = `${visualProgress * 100}%`;
    timer.querySelector(".pf-review-ring-fill").style.strokeDasharray = `${visualProgress * 87.5} 100`;
    scheduleReviewActionsPosition();
    scheduleLiquidGlass();
  }

  function positionReviewActions() {
    const bar = $("#pf-review-bar");
    const left = $(".pf-review-left");
    const right = $(".pf-review-right");
    const actions = $("#pf-review-actions");
    const barRect = bar.getBoundingClientRect();
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    if (!barRect.width || !leftRect.width || !rightRect.width) return;
    const corridorLeft = leftRect.right - barRect.left + 14;
    const corridorRight = rightRect.left - barRect.left - 14;
    actions.style.left = `${(corridorLeft + corridorRight) / 2}px`;
  }

  function scheduleReviewActionsPosition() {
    requestAnimationFrame(positionReviewActions);
  }

  function makeStudyButton(label, className, action, due = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pf-review-control ${className}`;
    button.dataset.action = action;
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    if (due) {
      const timing = document.createElement("span");
      timing.className = "pf-review-due-label";
      timing.textContent = due;
      button.append(timing);
    }
    return button;
  }

  function setStudyActions(layout) {
    if (!layout || !["question", "answer"].includes(layout.side)) return;
    const priorCounts = studyActions?.counts;
    studyActions = layout;
    const editLabel = layout.edit_label || "Edit";
    const moreLabel = layout.more_label || "More";
    $("#pf-review-edit").setAttribute("aria-label", editLabel);
    $("#pf-review-edit").title = editLabel;
    $("#pf-review-more").setAttribute("aria-label", moreLabel);
    $("#pf-review-more").title = moreLabel;
    const actions = $("#pf-review-actions");
    actions.replaceChildren();
    const counts = $("#pf-review-counts");
    const values = layout.counts || priorCounts || {};
    const hasCounts = Boolean(values.new || values.learn || values.review);
    counts.hidden = !hasCounts;
    $("#pf-review-new").textContent = values.new || "0";
    $("#pf-review-learn").textContent = values.learn || "0";
    $("#pf-review-due").textContent = values.review || "0";
    if (["new", "learn", "review"].includes(values.active)) {
      counts.dataset.active = values.active;
    } else {
      delete counts.dataset.active;
    }
    ["new", "learn", "review"].forEach((kind) => {
      const id = kind === "review" ? "#pf-review-due" : `#pf-review-${kind}`;
      $(id).classList.toggle("pf-review-current", values.active === kind);
    });
    if (layout.side === "question") {
      actions.append(
        makeStudyButton("Skip", "pf-review-skip", "skip_card"),
        makeStudyButton(layout.show_label || "Show Answer", "pf-review-show", "show_answer")
      );
    } else {
      (layout.buttons || []).forEach((item) => {
        const button = makeStudyButton(
          item.label || "",
          `pf-review-answer pf-review-ease-${Number(item.ease) || 0}`,
          "rate_card",
          item.due || ""
        );
        button.dataset.ease = String(item.ease);
        actions.append(button);
      });
    }
    scheduleReviewActionsPosition();
    scheduleLiquidGlass();
  }

  function render(data) {
    const priorHideKey = lastHideKey;
    snapshot = data;
    const shell = $(".pf-shell");
    shell.style.setProperty("--pf-ring", accentColor(data));
    activeProgressStyle = data.config.progress_style === "circle" ? "circle" : "line";
    card.classList.toggle("pf-progress-circle", activeProgressStyle === "circle");
    const sizeControl = $("#pf-card-size");
    applyCardSize(document.activeElement === sizeControl ? sizeControl.value : data.config.card_size);

    displayedMinutes = data.state === "completed" ? 0 : Math.ceil(Math.max(0, data.remaining_seconds) / 60);
    $("#pf-minute").textContent = String(displayedMinutes);
    applyMinuteTypography(displayedMinutes);
    $("#pf-exact-time").textContent = mmss(data.remaining_seconds);
    $("#pf-phase-name").textContent = phaseLabel(data.phase);
    const cardCount = data.phase === "focus" && data.answer_count > 0 ? ` · ${data.answer_count} cards` : "";
    $("#pf-round-label").textContent = `Round ${data.round_index}${cardCount}`;
    const duration = Math.max(1, Number(data.duration_seconds) || 1);
    const remainingProgress = Math.max(0, Math.min(1, Number(data.remaining_seconds) / duration));
    const elapsedProgress = 1 - remainingProgress;
    const visualProgress = data.phase === "focus" ? elapsedProgress : remainingProgress;
    $("#pf-card-progress").style.width = `${visualProgress * 100}%`;
    const ring = $("#pf-card-ring-progress");
    ring.setAttribute("d", ringArcPath(visualProgress));
    ring.style.opacity = visualProgress > 0 ? "1" : "0";

    card.classList.toggle("pf-completed", data.state === "completed");
    card.classList.toggle("pf-completed-focus", data.state === "completed" && data.completion?.kind === "focus");
    card.classList.toggle("pf-completed-break", data.state === "completed" && data.completion?.kind === "break");

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
    setControlValue($("#pf-card-size"), data.config.card_size);
    setControlValue($("#pf-progress-style"), activeProgressStyle);
    setControlValue($("#pf-answer-timer-style"), data.config.answer_timer_style);
    setControlValue($("#pf-answer-button-height"), data.config.answer_button_height);
    $("#pf-answer-button-height-value").textContent = `${data.config.answer_button_height} px`;
    $("#pf-focus-hide").setAttribute("aria-checked", String(Boolean(data.config.focus_hide)));
    $("#pf-sound").setAttribute("aria-checked", String(Boolean(data.config.completion_sound)));

    renderReviewTimer(data);

    renderHistory(data);
    applyPosition(data.position);
    positionPanel();

    lastHideKey = `${data.state}:${data.config.focus_hide}`;
    if (lastHideKey !== priorHideKey || data.state === "completed" || data.state === "paused") {
      scheduleFocusHide();
    }
  }

  function applyPosition(position) {
    if (!position || dragging) return;
    const availableX = Math.max(0, window.innerWidth - activeCardSize - VIEW_MARGIN * 2);
    const availableY = Math.max(0, window.innerHeight - activeCardSize - VIEW_MARGIN * 2);
    card.style.left = `${VIEW_MARGIN + availableX * Math.max(0, Math.min(1, position.x))}px`;
    card.style.top = `${VIEW_MARGIN + availableY * Math.max(0, Math.min(1, position.y))}px`;
  }

  function positionPanel() {
    if (!panelOpen) return;
    if (answerBarMode) {
      const anchor = $("#pf-review-timer");
      const anchorRect = anchor.getBoundingClientRect();
      const availableHeight = anchorRect.top - VIEW_MARGIN - 12;
      panel.style.maxHeight = `${Math.max(160, Math.min(720, availableHeight))}px`;
      const width = panel.offsetWidth || 380;
      const height = panel.offsetHeight || Math.min(720, availableHeight);
      const left = Math.max(
        VIEW_MARGIN,
        Math.min(window.innerWidth - width - VIEW_MARGIN, anchorRect.left)
      );
      const top = Math.max(VIEW_MARGIN, anchorRect.top - height - 12);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      return;
    }
    panel.style.maxHeight = "";
    const width = panel.offsetWidth || 380;
    const height = panel.offsetHeight || Math.min(720, window.innerHeight - 24);
    const cardRect = card.getBoundingClientRect();
    let left = cardRect.left - width - 12;
    if (left < VIEW_MARGIN) left = cardRect.right + 12;
    left = Math.max(VIEW_MARGIN, Math.min(window.innerWidth - width - VIEW_MARGIN, left));
    let top = Math.max(VIEW_MARGIN, Math.min(window.innerHeight - height - VIEW_MARGIN, cardRect.top));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function openPanel() {
    panelOpen = true;
    clearTimeout(hideTimer);
    panel.scrollTop = 0;
    card.classList.remove("pf-focus-hidden");
    card.classList.add("pf-panel-open");
    panel.classList.add("pf-open");
    panel.setAttribute("aria-hidden", "false");
    requestAnimationFrame(positionPanel);
  }

  function closePanel() {
    panelOpen = false;
    closeCustomSelects();
    hideConfirm();
    card.classList.remove("pf-panel-open");
    panel.classList.remove("pf-open");
    panel.setAttribute("aria-hidden", "true");
    scheduleFocusHide();
  }

  function scheduleFocusHide() {
    clearTimeout(hideTimer);
    card.classList.remove("pf-focus-hidden");
    if (!snapshot || panelOpen || snapshot.state !== "running" || snapshot.phase !== "focus" || !snapshot.config.focus_hide) return;
    hideTimer = setTimeout(() => card.classList.add("pf-focus-hidden"), HIDE_DELAY);
  }

  function signalFocusComplete() {
    clearTimeout(completionSignalTimer);
    card.classList.remove("pf-focus-hidden", "pf-focus-complete-signal");
    void card.offsetWidth;
    card.classList.add("pf-focus-complete-signal");
    const reviewTimer = $("#pf-review-timer");
    reviewTimer.classList.remove("pf-review-complete");
    void reviewTimer.offsetWidth;
    reviewTimer.classList.add("pf-review-complete");
    completionSignalTimer = setTimeout(
      () => {
        card.classList.remove("pf-focus-complete-signal");
        reviewTimer.classList.remove("pf-review-complete");
      },
      1200
    );
  }

  function setAnswerBarMode(enabled) {
    answerBarMode = Boolean(enabled);
    $(".pf-shell").classList.toggle("pf-answer-bar-mode", answerBarMode);
    scheduleReviewActionsPosition();
    scheduleLiquidGlass();
    if (panelOpen) requestAnimationFrame(positionPanel);
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

  card.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    reportActivity(true);
    const rect = card.getBoundingClientRect();
    dragging = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    card.setPointerCapture(event.pointerId);
    card.classList.add("pf-dragging");
    event.preventDefault();
  });

  card.addEventListener("pointermove", (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragging.startX;
    const dy = event.clientY - dragging.startY;
    if (Math.hypot(dx, dy) > 4) dragging.moved = true;
    if (!dragging.moved) return;
    const maxLeft = window.innerWidth - activeCardSize - VIEW_MARGIN;
    const maxTop = window.innerHeight - activeCardSize - VIEW_MARGIN;
    card.style.left = `${Math.max(VIEW_MARGIN, Math.min(maxLeft, dragging.left + dx))}px`;
    card.style.top = `${Math.max(VIEW_MARGIN, Math.min(maxTop, dragging.top + dy))}px`;
    positionPanel();
  });

  card.addEventListener("pointerup", (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const wasMoved = dragging.moved;
    dragging = null;
    card.classList.remove("pf-dragging");
    if (wasMoved) {
      const rect = card.getBoundingClientRect();
      const availableX = Math.max(1, window.innerWidth - activeCardSize - VIEW_MARGIN * 2);
      const availableY = Math.max(1, window.innerHeight - activeCardSize - VIEW_MARGIN * 2);
      send("move", {
        x: (rect.left - VIEW_MARGIN) / availableX,
        y: (rect.top - VIEW_MARGIN) / availableY,
      });
    } else if (panelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      panelOpen ? closePanel() : openPanel();
    }
  });

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
  $("#pf-review-edit").addEventListener("click", () => send("edit_card"));
  $("#pf-review-timer").addEventListener("click", openPanel);
  $("#pf-review-info").addEventListener("click", () => send("card_info"));
  $("#pf-review-more").addEventListener("click", () => send("more_actions"));
  $("#pf-review-actions").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "rate_card") send(action, { ease: Number(button.dataset.ease) });
    else send(action);
  });
  $("#pf-preset").addEventListener("pf-change", (event) => sendSettings({ preset: event.detail.value }));
  $("#pf-focus-minutes").addEventListener("change", (event) => sendSettings({ focus_minutes: Number(event.target.value) }));
  $("#pf-short-minutes").addEventListener("change", (event) => sendSettings({ short_break_minutes: Number(event.target.value) }));
  $("#pf-long-minutes").addEventListener("change", (event) => sendSettings({ long_break_minutes: Number(event.target.value) }));
  $("#pf-long-after").addEventListener("change", (event) => sendSettings({ long_break_after: Number(event.target.value) }));
  $("#pf-daily-goal").addEventListener("change", (event) => sendSettings({ daily_goal: Number(event.target.value) }));
  $("#pf-progress-style").addEventListener("pf-change", (event) => sendSettings({ progress_style: event.detail.value }));
  $("#pf-card-size").addEventListener("input", (event) => {
    applyCardSize(event.target.value);
    if (snapshot) applyPosition(snapshot.position);
    positionPanel();
  });
  $("#pf-card-size").addEventListener("change", (event) => {
    sendSettings({ card_size: Number(event.target.value) });
  });
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

  $("#pf-reset-position").addEventListener("click", () => send("reset_position"));
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
    if (panelOpen && !panel.contains(event.target) && !card.contains(event.target)) closePanel();
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
    if (snapshot) applyPosition(snapshot.position);
    scheduleReviewActionsPosition();
    scheduleLiquidGlass();
    positionPanel();
  });

  window.PomodoroFocus = {
    receive: render,
    openPanel,
    closePanel,
    signalFocusComplete,
    setAnswerBarMode,
    setStudyActions,
  };

  send("ready");
})();
