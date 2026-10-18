/* ==========================================================================
   راه‌اندازی و پیوندهای عمومی
   ========================================================================== */

function setHeaderDate() {
  const j = todayJalali();
  const label = $("#header-date-label");
  if (label) label.textContent = jalaliLabel(j, false, true);
  const chip = label ? label.closest(".header-date") : null;
  if (chip) chip.title = "امروز، " + jalaliLabel(j, true, true);
}

function renderAll() {
  setHeaderDate();
  renderSettings();
  renderRules();
  renderTasks();
  renderHistory();
  renderPreview();
  updateStorageInfo();
  setSaveState("saved");
}

function bindTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      const tabs = $$(".tab");
      const index = tabs.indexOf(tab);
      let next = -1;
      if (event.key === "ArrowLeft") next = index + 1;
      else if (event.key === "ArrowRight") next = index - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      if (next >= 0 && next < tabs.length) {
        event.preventDefault();
        tabs[next].focus();
        switchTab(tabs[next].dataset.tab, { scroll: false });
      }
    });
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-tab-link]");
    if (!link) return;
    event.preventDefault();
    switchTab(link.dataset.tabLink);
  });
}

function bindShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (activeModal) {
        closeModal();
        return;
      }
      if (datePicker) closeDatePicker();
      return;
    }

    const target = event.target;
    const typing = target && (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    );

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      if (target && target.id === "quick-input") return;
      event.preventDefault();
      const generate = $("#btn-generate");
      if (generate) generate.click();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "s") {
      event.preventDefault();
      clearTimeout(saveTimer);
      persistNow();
      toast("همه‌چیز ذخیره شد.", { type: "success" });
      return;
    }

    if (event.key === "/" && !typing && !activeModal) {
      event.preventDefault();
      switchTab("tasks", { scroll: false });
      const search = $("#task-search");
      if (search) setTimeout(() => search.focus(), 40);
    }
  });
}

function bindLifecycle() {
  window.addEventListener("beforeunload", () => {
    clearTimeout(saveTimer);
    persistNow(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      clearTimeout(saveTimer);
      persistNow(true);
    }
  });
  window.addEventListener("pagehide", () => {
    clearTimeout(saveTimer);
    persistNow(true);
  });
}

function init() {
  const loaded = loadState();
  state = loaded.state;
  state.lastReport = null;
  applyTheme(state.settings.theme, false);
  renderAll();
  bindTabs();
  bindTaskEvents();
  bindFileEvents();
  bindProjectEvents();
  bindRuleEvents();
  bindReportEvents();
  bindHistoryEvents();
  bindSettingsEvents();
  bindAiEvents();
  bindShortcuts();
  bindLifecycle();
  switchTab(state.ui.tab || "tasks", { scroll: false });
  if (loaded.error) {
    toast("داده‌های ذخیره‌شده خوانده نشد؛ با یک نسخه‌ی تازه شروع کردم. اگر پشتیبان داری، بازیابی کن.", { type: "error", duration: 8000 });
  }
}

init();
