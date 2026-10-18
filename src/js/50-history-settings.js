/* ==========================================================================
   تنظیمات، تاریخچه، پشتیبان و راهنما
   ========================================================================== */

function renderSettings() {
  const s = state.settings;
  renderProjectOptions();
  const setValue = (selector, value) => {
    const el = $(selector);
    if (el && document.activeElement !== el) el.value = value == null ? "" : value;
  };
  setValue("#set-author", s.author);
  setValue("#set-role", s.role);
  setValue("#set-team", s.team);
  setValue("#set-project", s.defaultProject);
  setValue("#set-template", s.template);
  setValue("#set-ai-url", s.aiUrl);
  setValue("#set-ai-model", s.aiModel);
  setValue("#set-ai-key", s.aiKey);

  $$('input[name="set-theme"]').forEach((input) => { input.checked = input.value === s.theme; });
  const aiSwitch = $("#set-ai-enabled");
  if (aiSwitch) aiSwitch.setAttribute("aria-checked", s.aiEnabled ? "true" : "false");
  const aiFields = $("#ai-fields");
  if (aiFields) aiFields.hidden = !s.aiEnabled;
  const keyInput = $("#set-ai-key");
  if (keyInput) keyInput.type = "password";
  const keyBtn = $("#btn-toggle-key");
  if (keyBtn) keyBtn.innerHTML = icon("eye");
  renderProjects();
}

function updateStorageInfo() {
  const info = $("#storage-info");
  if (!info) return;
  try {
    const payload = JSON.stringify({
      settings: state.settings,
      tasks: state.tasks,
      projects: state.projects,
      rules: state.rules,
      history: state.history
    });
    const bytes = new Blob([payload]).size;
    info.textContent = "حدود " + formatBytes(bytes) + " — " + faDigits(state.tasks.length) + " تسک و " + faDigits(state.history.length) + " گزارش.";
  } catch (e) {
    info.textContent = "ذخیره‌سازی محلی فعال است.";
  }
}

/* ------------------------------ هوش مصنوعی ------------------------------ */

function syncAiUi() {
  const s = state.settings;
  const sw = $("#set-ai-enabled");
  if (sw) sw.setAttribute("aria-checked", s.aiEnabled ? "true" : "false");
  const fields = $("#ai-fields");
  if (fields) fields.hidden = !s.aiEnabled;
}

/* ------------------------------ تاریخچه --------------------------------- */

function saveHistory(auto = false) {
  if (!hasReportableTasks()) {
    toast("هنوز گزارشی برای ذخیره نیست.", { type: "info" });
    return;
  }
  const report = getReport();
  const key = jalaliISO(report.jdate) + "-" + hashString(report.text);
  const snapshot = {
    id: uid("h"),
    key,
    savedAt: new Date().toISOString(),
    dateLabel: report.dateLabel,
    jdate: deepClone(report.jdate),
    title: report.title,
    template: report.template,
    author: normalizePersian(state.settings.author),
    role: normalizePersian(state.settings.role),
    team: normalizePersian(state.settings.team),
    project: normalizePersian(state.settings.defaultProject),
    text: report.text,
    markdown: report.markdown,
    counts: deepClone(report.counts),
    tasks: deepClone(state.tasks)
  };

  const latest = state.history[0];
  if (auto && latest && latest.key === key) {
    Object.assign(latest, snapshot, { id: latest.id });
    persistNow();
    renderHistory();
    return;
  }

  state.history.unshift(snapshot);
  state.history = state.history.slice(0, 100);
  persistNow();
  renderHistory();
  if (!auto) toast("گزارش در تاریخچه ذخیره شد.", { type: "success" });
}

function dateBadgeHTML(item) {
  const j = item.jdate && item.jdate.jy ? item.jdate : (item.savedAt ? (function () {
    const d = new Date(item.savedAt);
    if (Number.isNaN(d.getTime())) return null;
    return gToJ(d.getFullYear(), d.getMonth() + 1, d.getDate());
  })() : null);
  if (!j) return `<div class="history-date"><span class="d">—</span><span class="m">بدون تاریخ</span></div>`;
  return `<div class="history-date"><span class="d">${faDigits(j.jd)}</span><span class="m">${MONTHS[j.jm - 1]}</span></div>`;
}

function renderHistory() {
  const list = $("#history-list");
  const empty = $("#history-empty");
  const badge = $("#badge-history");
  const sub = $("#history-sub");
  if (!list || !empty) return;
  if (badge) badge.textContent = faDigits(state.history.length);
  if (sub) sub.textContent = state.history.length ? faDigits(state.history.length) + " گزارش ذخیره‌شده" : "گزارش‌های ساخته‌شده همین‌جا می‌مانند.";

  const search = $("#history-search");
  const q = search ? normalizePersian(search.value).toLowerCase() : "";
  const items = state.history.filter((item) => {
    if (!q) return true;
    return normalizePersian([item.title, item.author, item.project, item.text, item.dateLabel].join(" ")).toLowerCase().includes(q);
  });

  if (!items.length) {
    list.innerHTML = "";
    empty.hidden = false;
    empty.textContent = state.history.length
      ? "گزارشی با این جست‌وجو پیدا نشد. عبارت دیگری امتحان کن."
      : "هنوز گزارش ذخیره‌شده‌ای نداری. اولین گزارش را که بسازی، اینجا ظاهر می‌شود.";
    return;
  }
  empty.hidden = true;

  list.innerHTML = items.map((item) => {
    const c = item.counts || {};
    const meta = [
      item.author || "بدون نویسنده",
      item.project || "بدون پروژه",
      faDigits(item.tasks.length) + " تسک",
      c.blocked ? faDigits(c.blocked) + " مانع" : "",
      faDigits(item.tasks.length ? (c.totalHours || 0) : 0) + " ساعت"
    ].filter(Boolean).join(" • ");
    return `
      <div class="history-item" data-history-id="${escapeAttr(item.id)}">
        ${dateBadgeHTML(item)}
        <div class="history-body">
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-meta">${escapeHtml(meta)}</div>
          <div class="history-actions">
            <button class="icon-btn" type="button" data-history-action="restore" aria-label="بازیابی گزارش" title="بازیابی">${icon("restore")}</button>
            <button class="icon-btn" type="button" data-history-action="duplicate" aria-label="کپی به‌عنوان گزارش جدید" title="کپی به‌عنوان گزارش جدید">${icon("duplicate")}</button>
            <button class="icon-btn" type="button" data-history-action="copy" aria-label="کپی متن گزارش" title="کپی متن">${icon("copy")}</button>
            <button class="icon-btn" type="button" data-history-action="delete" aria-label="حذف گزارش" title="حذف">${icon("trash")}</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

function restoreHistoryTasks(item, mode) {
  if (!item.tasks || !item.tasks.length) {
    toast("این گزارش تسکی برای بازیابی ندارد.", { type: "info" });
    return;
  }
  const apply = () => {
    state.tasks = item.tasks.map((task, index) => {
      const copy = sanitizeTask(Object.assign({}, task, { id: uid(), order: index }));
      return copy;
    });
    state.projects = buildProjectsFromData(state.projects, state.settings, state.tasks);
    openTasks.clear();
    state.settings.template = ["brief", "admin", "daily"].includes(item.template)
      ? item.template
      : (item.title.indexOf("خلاصه") === 0 ? "brief" : "daily");
    resetViewFilters();
    renderTasks();
    renderSettings();
    renderHistory();
    scheduleSave();
    switchTab("preview");
    renderPreview();
    toast(mode === "duplicate" ? "نسخه‌ی جدید از این گزارش ساخته شد." : "گزارش بازیابی شد؛ می‌توانی ویرایشش کنی.", { type: "success" });
  };
  if (!state.tasks.length) {
    apply();
    return;
  }
  confirmDialog({
    title: mode === "duplicate" ? "ساخت گزارش جدید از این نسخه" : "بازیابی گزارش قبلی",
    message: "تسک‌های فعلی با تسک‌های این گزارش جایگزین می‌شوند. ادامه می‌دهی؟",
    confirmText: mode === "duplicate" ? "بساز" : "بازیابی",
    iconName: mode === "duplicate" ? "duplicate" : "restore"
  }).then((ok) => { if (ok) apply(); });
}

function bindHistoryEvents() {
  const list = $("#history-list");
  if (list) {
    list.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-history-action]");
      if (!btn) return;
      const row = btn.closest("[data-history-id]");
      if (!row) return;
      const item = state.history.find((h) => h.id === row.dataset.historyId);
      if (!item) return;
      const action = btn.dataset.historyAction;

      if (action === "restore") {
        restoreHistoryTasks(item, "restore");
      } else if (action === "duplicate") {
        restoreHistoryTasks(item, "duplicate");
      } else if (action === "copy") {
        const ok = await copyToClipboard(item.text || "");
        toast(ok ? "متن گزارش قبلی کپی شد." : "کپی ممکن نشد.", { type: ok ? "success" : "error" });
      } else if (action === "delete") {
        const ok = await confirmDialog({
          title: "حذف گزارش از تاریخچه",
          message: "این گزارش برای همیشه از تاریخچه حذف شود؟ تسک‌های فعلی دست‌نخورده می‌مانند.",
          confirmText: "حذف گزارش",
          danger: true,
          iconName: "trash"
        });
        if (!ok) return;
        state.history = state.history.filter((h) => h.id !== item.id);
        renderHistory();
        persistNow();
        toast("گزارش از تاریخچه حذف شد.", { type: "info" });
      }
    });
  }

  const search = $("#history-search");
  if (search) {
    search.addEventListener("input", debounce(renderHistory, 150));
  }
}

/* ------------------------------ پشتیبان --------------------------------- */

function backupPayload() {
  const settings = deepClone(state.settings);
  delete settings.aiKey;
  return {
    app: APP_ID,
    kind: "backup",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    note: "کلید بازنویسی هوشمند در این فایل ذخیره نشده است.",
    settings,
    tasks: deepClone(state.tasks),
    projects: deepClone(state.projects),
    rules: deepClone(state.rules),
    history: deepClone(state.history)
  };
}

function exportBackup() {
  downloadText(JSON.stringify(backupPayload(), null, 2), "پشتیبان-گزارش‌یار-" + jalaliISO(todayJalali()) + ".json", "application/json;charset=utf-8");
  updateStorageInfo();
  toast("پشتیبان کامل دانلود شد. جای امنی نگهش دار.", { type: "success" });
}

async function importBackup(file) {
  if (!file) return;
  try {
    const text = await readFileText(file);
    const data = JSON.parse(text);
    const valid = data && typeof data === "object" && (data.app === APP_ID || Array.isArray(data.tasks) || Array.isArray(data.rules));
    if (!valid) throw new Error("backup");
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const rules = Array.isArray(data.rules) ? data.rules : [];
    const history = Array.isArray(data.history) ? data.history : [];
    const ok = await confirmDialog({
      title: "بازیابی پشتیبان",
      message: "این فایل شامل " + faDigits(tasks.length) + " تسک، " + faDigits(rules.length) + " قانون و " + faDigits(history.length) + " گزارش است. داده‌های فعلی جایگزین می‌شوند. مطمئنی؟",
      confirmText: "بازیابی کامل",
      iconName: "database"
    });
    if (!ok) return;
    const currentKey = state.settings.aiKey;
    state.settings = sanitizeSettings(Object.assign({}, data.settings || {}, { aiKey: currentKey }));
    state.tasks = tasks.map(sanitizeTask);
    state.tasks.forEach((t, i) => { t.order = i; });
    state.projects = buildProjectsFromData(data.projects, state.settings, state.tasks);
    state.rules = rules.length ? rules.map(sanitizeRule) : deepClone(DEFAULT_RULES);
    state.history = history.map(sanitizeHistoryItem).slice(0, 100);
    openTasks.clear();
    resetViewFilters();
    applyTheme(state.settings.theme);
    renderSettings();
    renderRules();
    renderTasks();
    renderHistory();
    renderPreview();
    updateStorageInfo();
    persistNow();
    toast("پشتیبان با موفقیت بازیابی شد.", { type: "success", duration: 5000 });
  } catch (e) {
    toast("این فایل پشتیبان معتبر نیست. فایل خروجی خود گزارش‌یار را انتخاب کن.", { type: "error" });
  }
}

async function clearAllData() {
  const ok = await confirmDialog({
    title: "پاک‌کردن همه‌ی داده‌ها",
    message: "همه‌ی تسک‌ها، قوانین سفارشی، تنظیمات و تاریخچه پاک می‌شوند. این کار برگشت‌پذیر نیست. اگر پشتیبان نگرفته‌ای، اول پشتیبان بگیر.",
    confirmText: "بله، همه را پاک کن",
    danger: true,
    iconName: "alert"
  });
  if (!ok) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* بی‌اهمیت */ }
  state = defaultState();
  state.lastReport = null;
  openTasks.clear();
  applyTheme("dark");
  const search = $("#task-search");
  if (search) search.value = "";
  const histSearch = $("#history-search");
  if (histSearch) histSearch.value = "";
  renderSettings();
  renderRules();
  renderTasks();
  renderHistory();
  renderPreview();
  updateStorageInfo();
  setSaveState("saved");
  switchTab("tasks");
  toast("همه‌چیز پاک شد؛ یک شروع تازه.", { type: "info" });
}

/* ------------------------------ راهنما ---------------------------------- */

function openHelp() {
  const layer = openModal({
    title: "راهنمای کوتاه گزارش‌یار",
    sub: "سه گام تا یک گزارش آماده‌ی ارسال.",
    iconName: "help",
    size: "modal-lg",
    body: `
      <div class="description-list">
        <div class="row"><span class="num-badge">۱</span><p><strong>تسک‌ها را بریز.</strong> هر خط یک تسک است. می‌توانی تایپ کنی، متن را از چت بچسبانی یا فایل اکسل را روی کادر رها کنی. با دکمه‌ی + هم می‌توانی تسک را با فرم کامل، پروژه، چک‌لیست و برنامه‌ی آینده بسازی.</p></div>
        <div class="row"><span class="num-badge">۲</span><p><strong>مرتبش کن.</strong> عنوان‌ها را ویرایش کن، وضعیت و ساعت را بگذار، پروژه را انتخاب کن و برای هر تسک چک‌لیست و برنامه‌های آینده بساز. اگر هشدار زرد دیدی، همان‌جا اصلاحش کن.</p></div>
        <div class="row"><span class="num-badge">۳</span><p><strong>خروجی بگیر.</strong> دکمه‌ی «ساخت گزارش» را بزن. متن نهایی را کپی کن، دانلود کن یا با پیام‌رسان و رایانامه بفرست. اگر گزارش کار اداری می‌خواهی، قالب «گزارش کار اداری» را از تنظیمات سریع انتخاب کن.</p></div>
      </div>
      <div class="divider"></div>
      <h3 style="font-size:13px;font-weight:750;margin-bottom:7px">میان‌بُرها</h3>
      <table class="shortcut-table">
        <tr><td>ساخت گزارش</td><td><span class="kbd">کنترل</span> + <span class="kbd">اینتر</span></td></tr>
        <tr><td>ذخیره‌ی فوری</td><td><span class="kbd">کنترل</span> + <span class="kbd">S</span></td></tr>
        <tr><td>جست‌وجوی تسک</td><td><span class="kbd">/</span></td></tr>
        <tr><td>بستن پنجره</td><td><span class="kbd">کلید خروج</span></td></tr>
      </table>
      <div class="divider"></div>
      <div class="callout" style="margin:0; padding:10px 12px; font-size:11px">
        ${icon("shield")}
        <div>همه‌چیز آفلاین و روی همین مرورگر است. فقط اگر خودت «بازنویسی هوشمند» را روشن کنی و اجازه بدهی، متن تسک‌ها به نشانی انتخابی‌ات فرستاده می‌شود.</div>
      </div>`,
    footer: `
      <button class="btn btn-soft" type="button" data-help-sample>${icon("sparkles")} بارگذاری نمونه</button>
      <button class="btn" type="button" data-help-file>${icon("sheet")} فایل اکسل نمونه</button>
      <span class="spacer"></span>
      <button class="btn btn-primary" type="button" data-modal-close>فهمیدم</button>`,
    onMount: (modalLayer) => {
      modalLayer.querySelector("[data-help-sample]").addEventListener("click", () => { closeModal(); loadSampleTasks(); });
      modalLayer.querySelector("[data-help-file]").addEventListener("click", downloadSampleWorkbook);
    }
  });
  return layer;
}

/* ------------------------------ پیوندهای تنظیمات ------------------------ */

function bindSettingsEvents() {
  const bindText = (selector, key, normalize = true) => {
    const el = $(selector);
    if (!el) return;
    el.addEventListener("input", () => {
      state.settings[key] = normalize ? normalizePersian(el.value, { keepPunctuation: true }) : el.value;
      scheduleSave();
      if (key === "author" || key === "team" || key === "defaultProject" || key === "role") {
        const author = $("#preview-author");
        if (author) author.textContent = state.settings.author.trim() || "—";
        const role = $("#preview-role");
        if (role) role.textContent = state.settings.role.trim() || "—";
        const team = $("#preview-team");
        if (team) team.textContent = state.settings.team.trim() || "—";
        const project = $("#preview-project");
        if (project) project.textContent = state.settings.defaultProject.trim() || "—";
        schedulePreview();
      }
    });
    el.addEventListener("blur", () => {
      if (normalize) el.value = state.settings[key] || "";
    });
  };
  bindText("#set-author", "author");
  bindText("#set-role", "role");
  bindText("#set-team", "team");
  bindText("#set-project", "defaultProject");

  const template = $("#set-template");
  if (template) {
    template.addEventListener("change", () => {
      state.settings.template = ["brief", "admin", "daily"].includes(template.value) ? template.value : "daily";
      const previewTemplate = $("#preview-template");
      if (previewTemplate) previewTemplate.value = state.settings.template;
      renderPreview();
      scheduleSave();
    });
  }

  $$('input[name="set-theme"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      applyTheme(input.value, true);
      schedulePreview();
    });
  });

  const aiSwitch = $("#set-ai-enabled");
  if (aiSwitch) {
    aiSwitch.addEventListener("click", () => {
      state.settings.aiEnabled = !state.settings.aiEnabled;
      syncAiUi();
      scheduleSave();
      if (state.settings.aiEnabled) {
        toast("بازنویسی هوشمند روشن شد؛ نشانی و کلید را کامل کن.", { type: "info" });
      } else {
        toast("بازنویسی هوشمند خاموش شد؛ همه‌چیز آفلاین می‌ماند.", { type: "info" });
      }
    });
  }

  const aiUrl = $("#set-ai-url");
  if (aiUrl) aiUrl.addEventListener("input", () => { state.settings.aiUrl = aiUrl.value.trim(); scheduleSave(); });
  const aiModel = $("#set-ai-model");
  if (aiModel) aiModel.addEventListener("input", () => { state.settings.aiModel = aiModel.value.trim(); scheduleSave(); });
  const aiKey = $("#set-ai-key");
  if (aiKey) aiKey.addEventListener("input", () => { state.settings.aiKey = aiKey.value.trim(); scheduleSave(); });

  const keyToggle = $("#btn-toggle-key");
  if (keyToggle && aiKey) {
    keyToggle.addEventListener("click", () => {
      const show = aiKey.type === "password";
      aiKey.type = show ? "text" : "password";
      keyToggle.innerHTML = icon(show ? "eye-off" : "eye");
      keyToggle.setAttribute("aria-label", show ? "پنهان‌کردن کلید" : "نمایش کلید");
    });
  }

  const exportBtn = $("#btn-backup-export");
  if (exportBtn) exportBtn.addEventListener("click", exportBackup);
  const importBtn = $("#btn-backup-import");
  const importFile = $("#backup-file-input");
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", () => {
      const file = importFile.files && importFile.files[0];
      importFile.value = "";
      if (file) importBackup(file);
    });
  }

  const clearBtn = $("#btn-clear-data");
  if (clearBtn) clearBtn.addEventListener("click", clearAllData);

  const helpBtn = $("#btn-help");
  if (helpBtn) helpBtn.addEventListener("click", openHelp);

  const themeBtn = $("#btn-theme");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      applyTheme(state.settings.theme === "dark" ? "light" : "dark", true);
    });
  }

  const sampleFile = $("#btn-sample-file");
  if (sampleFile) sampleFile.addEventListener("click", downloadSampleWorkbook);
}
