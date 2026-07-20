(() => {
  "use strict";

  if (window.PomodoroFocusBottom) return;

  const PREFIX = "pomodoro_focus:";
  let lastStudyActions = "";
  let lastCardCounts = { new: "", learn: "", review: "", active: "" };
  let scheduled = false;

  function send(action, data = {}) {
    if (typeof pycmd === "function") {
      pycmd(PREFIX + JSON.stringify({ action, ...data }));
    }
  }

  function buttonLabel(button) {
    if (!button) return "";
    const copy = button.cloneNode(true);
    copy.querySelectorAll(".nobold, .stattxt, #time, svg").forEach((node) => node.remove());
    return copy.textContent.replace(/\s+/g, " ").trim();
  }

  function answerEase(button) {
    const direct = Number(button.dataset.ease);
    if (direct >= 1 && direct <= 4) return direct;
    const source = `${button.id || ""} ${button.getAttribute("onclick") || ""}`;
    const match = source.match(/ease[^1-4]*([1-4])/i);
    return match ? Number(match[1]) : 0;
  }

  function readStudyActions(force = false) {
    scheduled = false;
    const middle = document.getElementById("middle");
    if (!middle) return;

    const outerButtons = [...document.querySelectorAll("#innertable > tbody > tr > td.stat > button")];
    const base = {
      edit_label: buttonLabel(outerButtons[0]) || "Edit",
      more_label: buttonLabel(outerButtons[outerButtons.length - 1]) || "More",
    };
    const showAnswer = middle.querySelector("#ansbut");
    let layout;

    if (showAnswer) {
      lastCardCounts = {
        new: middle.querySelector(".new-count")?.textContent.trim() || "",
        learn: middle.querySelector(".learn-count")?.textContent.trim() || "",
        review: middle.querySelector(".review-count")?.textContent.trim() || "",
        active: middle.querySelector(".new-count u") ? "new"
          : middle.querySelector(".learn-count u") ? "learn"
            : middle.querySelector(".review-count u") ? "review"
              : "",
      };
      layout = {
        ...base,
        side: "question",
        show_label: buttonLabel(showAnswer) || "Show Answer",
        counts: lastCardCounts,
      };
    } else {
      const answerButtons = [...middle.querySelectorAll("button")]
        .filter((button) => answerEase(button));
      if (!answerButtons.length) return;
      layout = {
        ...base,
        side: "answer",
        counts: lastCardCounts,
        buttons: answerButtons.map((button) => ({
          ease: answerEase(button),
          label: buttonLabel(button),
          due: button.querySelector(".nobold")?.textContent.trim() || "",
        })),
      };
    }

    const serialized = JSON.stringify(layout);
    if (!force && serialized === lastStudyActions) return;
    lastStudyActions = serialized;
    send("study_actions", { layout });
  }

  function scheduleRead() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(readStudyActions);
  }

  function start() {
    const middle = document.getElementById("middle");
    if (!middle) {
      requestAnimationFrame(start);
      return;
    }
    new MutationObserver(scheduleRead).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleRead();
    window.setInterval(() => readStudyActions(true), 1000);
    send("ready_bottom");
  }

  window.PomodoroFocusBottom = {
    receive() {
      lastStudyActions = "";
      scheduleRead();
    },
    signalFocusComplete() {},
  };

  start();
})();
