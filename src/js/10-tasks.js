/* ==========================================================================
   تسک‌ها: تبدیل متن، پاک‌سازی، هشدارها و فهرست قابل ویرایش
   ========================================================================== */

function newTask(partial = {}) {
  const task = sanitizeTask(Object.assign({ id: uid(), order: state.tasks.length }, partial));
  task.source = partial.source || "manual";
  task.project = ensureProject(task.project);
  state.tasks.push(task);
  return task;
}

function resetViewFilters() {
  state.ui.filter = "all";
  state.ui.search = "";
  const search = $("#task-search");
  if (search) search.value = "";
  $$(".chip[data-filter]").forEach((chip) => chip.classList.toggle("is-active", chip.dataset.filter === "all"));
}

function displayTaskTitle(task) {
  return cleanTitle(task.title) || "بدون عنوان";
}

function duplicateMap() {
  const map = new Map();
  state.tasks.forEach((task) => {
    const key = cleanTitle(task.title);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function containsAnyWord(text, words) {
  const normalized = normalizePersian(text);
  return words.some((word) => {
    const w = normalizePersian(word);
    if (!w) return false;
    const re = new RegExp("(^|[\\s،؛:()«»\\-])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[\\s،؛:!؟.()«»\\-]|$)", "u");
    return re.test(normalized);
  });
}

function startsWithVerb(title) {
  if (!ruleOn("verbStart")) return true;
  const verbs = activeRuleConfig("verbStart", "verbs", []);
  if (!Array.isArray(verbs) || !verbs.length) return true;
  const word = normalizePersian(firstWord(title));
  const normalizedTitle = normalizePersian(title);
  return verbs.some((verb) => {
    const v = normalizePersian(verb);
    return word === v || normalizedTitle === v || normalizedTitle.startsWith(v + " ") || normalizedTitle.startsWith(v + ZWNJ);
  });
}

function taskWarnings(task, dupes = null) {
  const warnings = [];
  const title = cleanTitle(task.title);
  const map = dupes || duplicateMap();

  if (!title) {
    warnings.push("عنوان تسک خالی است.");
  } else {
    if (title.replace(/\s/g, "").length < 3) {
      warnings.push("این عنوان خیلی کوتاه است؛ نتیجه یا جزئیات بیشتری بنویس.");
    }
    if (ruleOn("vagueWarnings")) {
      const phrases = activeRuleConfig("vagueWarnings", "phrases", []);
      const normalized = normalizePersian(title);
      const vague = Array.isArray(phrases) && phrases.some((phrase) => {
        const p = normalizePersian(phrase);
        if (!p) return false;
        return normalized === p || normalized === p + " شد" || (normalized.startsWith(p) && normalized.replace(p, "").trim().length < 4);
      });
      if (vague) warnings.push("این عنوان خیلی کلی است؛ بهتر است نتیجه یا جزئیات بیشتری بنویسی.");
    }
    if (!startsWithVerb(title)) {
      warnings.push("بهتر است ردیف با یک فعل کاری شروع شود؛ مثل رفع، توسعه یا بررسی.");
    }
    if (ruleOn("noFirstPerson")) {
      const words = activeRuleConfig("noFirstPerson", "words", ["من", "ما"]);
      if (Array.isArray(words) && containsAnyWord(title, words)) {
        warnings.push("ضمیر اول‌شخص در متن آمده؛ لحن گزارش رسمی‌تر می‌شود اگر حذف شود.");
      }
    }
    if ((map.get(normalizePersian(title)) || 0) > 1) {
      warnings.push("عنوان این تسک با تسک دیگری تکراری است.");
    }
  }

  if (task.status === "blocked" && !String(task.blocker || "").trim()) {
    warnings.push("تسک مسدود است، اما مانعش نوشته نشده.");
  }
  if (ruleOn("challengeSolutions") && task.status === "blocked" && !String(task.nextStep || "").trim()) {
    warnings.push("برای این مانع، یک راهکار یا اقدام بعدی پیشنهاد کن.");
  }
  const pendingChecklist = task.checklist.filter((item) => !item.done).length;
  if (task.status === "done" && pendingChecklist > 0) {
    warnings.push("وضعیت انجام‌شده است، ولی " + faDigits(pendingChecklist) + " مورد از چک‌لیست هنوز انجام نشده.");
  }
  if (task.status === "planned" && !String(task.nextStep || "").trim() && !task.futurePlans.length) {
    warnings.push("برای برنامه‌ی آینده، یک گام یا برنامه‌ی روشن بنویس.");
  }
  if (task.status === "done" && task.progress != null && Number(task.progress) < 100) {
    warnings.push("وضعیت «انجام‌شده» است، ولی درصد پیشرفت کمتر از ۱۰۰٪ است.");
  }
  if (task.hours != null && Number(task.hours) > 24) {
    warnings.push("ساعت صرف‌شده بیشتر از ۲۴ ساعت است؛ عدد را بررسی کن.");
  }
  return Array.from(new Set(warnings));
}

function allTasksWarningCount() {
  const dupes = duplicateMap();
  return state.tasks.filter((task) => taskWarnings(task, dupes).length > 0).length;
}

function updateSummary() {
  const tasks = state.tasks;
  const done = tasks.filter((t) => t.status === "done").length;
  const totalHours = tasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
  const dupes = duplicateMap();
  const blocked = tasks.filter((t) => {
    if (t.status === "blocked") return true;
    return taskWarnings(t, dupes).length > 0;
  }).length;
  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };
  set("#sum-tasks", faDigits(tasks.length));
  set("#sum-done", faDigits(done));
  set("#sum-hours", totalHours > 0 ? formatNum(totalHours) : "۰");
  const blockedEl = $("#sum-blocked");
  if (blockedEl) {
    blockedEl.textContent = faDigits(blocked);
    blockedEl.classList.toggle("is-warn", blocked > 0);
  }
  const badge = $("#badge-tasks");
  if (badge) badge.textContent = faDigits(tasks.length);

  const counts = { all: tasks.length, done: 0, doing: 0, blocked: 0, planned: 0 };
  tasks.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
  Object.keys(counts).forEach((key) => {
    const el = $("#filter-count-" + key);
    if (el) el.textContent = faDigits(counts[key]);
  });
}

function visibleTasks() {
  const q = normalizePersian(state.ui.search || "").toLowerCase();
  return state.tasks.filter((task) => {
    if (state.ui.filter !== "all" && task.status !== state.ui.filter) return false;
    if (!q) return true;
    const haystack = normalizePersian([
      task.title, task.raw, task.project, task.owner, task.category,
      task.blocker, task.nextStep, STATUS[task.status] ? STATUS[task.status].label : "",
      (task.checklist || []).map((item) => item.text).join(" "),
      (task.futurePlans || []).map((plan) => plan.text).join(" ")
    ].join(" ")).toLowerCase();
    return haystack.includes(q);
  });
}

function updateCardWarnings(card, task) {
  if (!card) return;
  const warnings = taskWarnings(task);
  const details = card.querySelector(".task-details");
  let el = card.querySelector(".task-warnings");
  if (!warnings.length) {
    if (el) el.remove();
    return;
  }
  const text = warnings.slice(0, 2).join(" • ") + (warnings.length > 2 ? " • و " + faDigits(warnings.length - 2) + " هشدار دیگر" : "");
  if (!el) {
    el = document.createElement("div");
    el.className = "task-warnings";
    if (details) details.parentNode.insertBefore(el, details);
    else card.querySelector(".task-body").appendChild(el);
  }
  el.innerHTML = `${icon("alert")}<span>${escapeHtml(text)}</span>`;
  el.setAttribute("title", warnings.join("؛ "));
}

function taskStatusOptions(selected) {
  return Object.keys(STATUS).map((key) =>
    `<option value="${key}"${key === selected ? " selected" : ""}>${STATUS[key].label}</option>`
  ).join("");
}

function frequentValues(field, limit = 6) {
  const counts = new Map();
  state.tasks.forEach((task) => {
    const value = normalizePersian(task[field] || "");
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fa"))
    .slice(0, limit)
    .map(([value]) => value);
}

function renderFrequentOptions() {
  const categories = $("#frequent-categories");
  const owners = $("#frequent-owners");
  if (categories) {
    categories.innerHTML = frequentValues("category", 30)
      .map((value) => `<option value="${escapeAttr(value)}"></option>`).join("");
  }
  if (owners) {
    owners.innerHTML = frequentValues("owner", 30)
      .map((value) => `<option value="${escapeAttr(value)}"></option>`).join("");
  }
}

function projectSelectOptions(selected = "") {
  const options = [`<option value=""${!selected ? " selected" : ""}>بدون پروژه</option>`];
  state.projects.forEach((project) => {
    options.push(`<option value="${escapeAttr(project.name)}"${project.name === selected ? " selected" : ""}>${escapeHtml(project.name)}</option>`);
  });
  if (selected && !state.projects.some((project) => project.name === selected)) {
    options.push(`<option value="${escapeAttr(selected)}" selected>${escapeHtml(selected)}</option>`);
  }
  return options.join("");
}

function checklistProgress(task) {
  const total = task.checklist.length;
  const done = task.checklist.filter((item) => item.done).length;
  return { total, done, text: faDigits(done) + " از " + faDigits(total) };
}

function checklistHTML(task) {
  const progress = checklistProgress(task);
  const items = task.checklist.map((item) => `
    <div class="check-item${item.done ? " is-done" : ""}">
      <input type="checkbox" data-check-toggle="${escapeAttr(item.id)}" ${item.done ? "checked" : ""} aria-label="وضعیت ${escapeAttr(item.text)}">
      <input class="check-text" type="text" data-check-text="${escapeAttr(item.id)}" value="${escapeAttr(item.text)}" aria-label="متن مورد چک‌لیست">
      <button class="mini-x" type="button" data-check-delete="${escapeAttr(item.id)}" aria-label="حذف مورد چک‌لیست">${icon("x", "icon-sm")}</button>
    </div>`).join("");
  return `
    <div class="mini-section span-2" data-mini="checklist">
      <div class="mini-section-head">
        <span class="mini-section-title">${icon("tasks", "icon-sm")} چک‌لیست</span>
        <span class="mini-section-count">${progress.total ? progress.text : "خالی"}</span>
      </div>
      ${progress.total ? `<div class="checklist-list">${items}</div>` : `<p class="mini-empty">هنوز موردی ندارد؛ اولین کار را اضافه کن.</p>`}
      <div class="mini-add-row">
        <input class="input" type="text" data-check-new placeholder="مورد جدید چک‌لیست">
        <button class="btn btn-sm btn-soft" type="button" data-add-check>${icon("plus", "icon-sm")} افزودن</button>
        ${progress.total ? `<button class="btn btn-sm btn-ghost" type="button" data-clear-checklist>پاک‌کردن</button>` : ""}
      </div>
    </div>`;
}

function futurePlansHTML(task) {
  const items = task.futurePlans.map((plan) => `
    <div class="plan-item">
      <input class="plan-text" type="text" data-plan-text="${escapeAttr(plan.id)}" value="${escapeAttr(plan.text)}" aria-label="متن برنامه‌ی آینده">
      <button class="date-pick plan-date${plan.date ? "" : " is-empty"}" type="button" data-plan-date="${escapeAttr(plan.id)}">
        ${icon("calendar")}<span>${plan.date ? jalaliDisplayFromISO(plan.date) : "بدون تاریخ"}</span>
      </button>
      <button class="mini-x" type="button" data-plan-delete="${escapeAttr(plan.id)}" aria-label="حذف برنامه‌ی آینده">${icon("x", "icon-sm")}</button>
    </div>`).join("");
  return `
    <div class="mini-section span-2" data-mini="plans">
      <div class="mini-section-head">
        <span class="mini-section-title">${icon("calendar", "icon-sm")} برنامه‌های آینده</span>
        <span class="mini-section-count">${task.futurePlans.length ? faDigits(task.futurePlans.length) + " برنامه" : "خالی"}</span>
      </div>
      ${task.futurePlans.length ? `<div class="plan-list">${items}</div>` : `<p class="mini-empty">برنامه‌ای برای آینده ثبت نشده است.</p>`}
      <div class="mini-add-row">
        <input class="input" type="text" data-plan-new placeholder="برنامه‌ی آینده را بنویس...">
        <button class="btn btn-sm btn-soft" type="button" data-add-plan>${icon("plus", "icon-sm")} افزودن</button>
      </div>
    </div>`;
}

function taskCardHTML(task, index, warnings, isOpen) {
  const title = escapeAttr(task.title);
  const owner = escapeAttr(task.owner);
  const category = escapeAttr(task.category);
  const blocker = escapeHtml(task.blocker);
  const nextStep = escapeHtml(task.nextStep);
  const raw = escapeHtml(task.raw);
  const dateLabel = task.date ? jalaliDisplayFromISO(task.date) : "";
  const source = SOURCE_LABEL[task.source] || "دستی";
  const checkProgress = checklistProgress(task);
  const warningText = warnings.length
    ? warnings.slice(0, 2).join(" • ") + (warnings.length > 2 ? " • و " + faDigits(warnings.length - 2) + " هشدار دیگر" : "")
    : "";
  const showWarning = warnings.length > 0;

  return `
    <article class="task${task.title.trim() ? "" : " is-empty-title"}" data-id="${escapeAttr(task.id)}" data-status="${task.status}">
      <div class="task-grid">
        <button class="drag-handle" type="button" draggable="true" aria-label="جابه‌جایی تسک ${faDigits(index + 1)}" title="برای جابه‌جایی بکش">${icon("grip")}</button>
        <div class="task-index" aria-hidden="true">${faDigits(index + 1)}</div>
        <div class="task-body">
          <div class="task-title-row">
            <input class="task-title" type="text" data-field="title" value="${title}" aria-label="عنوان تسک ${faDigits(index + 1)}" placeholder="عنوان تسک را بنویس">
            <select class="status-select" data-status-select data-status="${task.status}" aria-label="وضعیت تسک ${faDigits(index + 1)}">
              ${taskStatusOptions(task.status)}
            </select>
          </div>
          <div class="task-meta">
            <label class="meta-field is-wide" title="پروژه">
              ${icon("folder")}
              <select class="project-select" data-field="project" aria-label="پروژه‌ی تسک">
                ${projectSelectOptions(task.project)}
              </select>
            </label>
            <span class="meta-sep"></span>
            <label class="meta-field" title="ساعت صرف‌شده">
              ${icon("clock")}
              <input type="text" inputmode="decimal" data-field="hours" value="${task.hours != null ? formatNum(task.hours) : ""}" placeholder="۰" aria-label="ساعت صرف‌شده">
              <span class="suffix">ساعت</span>
            </label>
            <label class="meta-field" title="درصد پیشرفت">
              ${icon("percent")}
              <input type="text" inputmode="numeric" data-field="progress" value="${task.progress != null ? formatNum(task.progress) : ""}" placeholder="۰" aria-label="درصد پیشرفت">
              <span class="suffix">٪</span>
            </label>
            ${checkProgress.total ? `<button class="meta-field checklist-chip" type="button" data-action="toggle" title="چک‌لیست: ${checkProgress.text}">${icon("tasks")}<span>${checkProgress.text}</span></button>` : ""}
            ${task.futurePlans.length ? `<button class="meta-field checklist-chip" type="button" data-action="toggle" title="برنامه‌های آینده">${icon("calendar")}<span>${faDigits(task.futurePlans.length)} برنامه</span></button>` : ""}
          </div>
          ${showWarning ? `<div class="task-warnings" title="${escapeAttr(warnings.join("؛ "))}">${icon("alert")}<span>${escapeHtml(warningText)}</span></div>` : ""}
          <div class="task-details"${isOpen ? "" : " hidden"}>
            <div class="field">
              <label class="field-label" for="cat-${escapeAttr(task.id)}">دسته‌بندی</label>
              <input class="input" type="text" id="cat-${escapeAttr(task.id)}" data-field="category" value="${category}" list="frequent-categories" placeholder="مثلاً توسعه">
            </div>
            <div class="field">
              <label class="field-label" for="owner-${escapeAttr(task.id)}">مسئول</label>
              <input class="input" type="text" id="owner-${escapeAttr(task.id)}" data-field="owner" value="${owner}" list="frequent-owners" placeholder="نام مسئول">
            </div>
            <div class="field">
              <span class="field-label">تاریخ تسک</span>
              <button class="date-pick${task.date ? "" : " is-empty"}" type="button" data-action="date">
                ${icon("calendar")}<span>${dateLabel || "انتخاب تاریخ"}</span>${icon("chevron-down")}
              </button>
            </div>
            <div class="field">
              <span class="field-label">منبع ورودی</span>
              <div style="font-size:11.5px;color:var(--ink-3);padding-top:6px">${escapeHtml(source)}</div>
            </div>
            <div class="field span-2">
              <label class="field-label" for="blocker-${escapeAttr(task.id)}">مانع یا موانع</label>
              <textarea class="textarea" id="blocker-${escapeAttr(task.id)}" data-field="blocker" placeholder="اگر چیزی جلوی کار را گرفته، همین‌جا بنویس">${blocker}</textarea>
            </div>
            <div class="field span-2">
              <label class="field-label" for="next-${escapeAttr(task.id)}">گام بعدی</label>
              <textarea class="textarea" id="next-${escapeAttr(task.id)}" data-field="nextStep" placeholder="قدم بعدی چه چیزی است؟">${nextStep}</textarea>
            </div>
            ${checklistHTML(task)}
            ${futurePlansHTML(task)}
            ${task.raw ? `<div class="field span-2">
              <label class="field-label" for="raw-${escapeAttr(task.id)}">متن خام اولیه</label>
              <textarea class="textarea" id="raw-${escapeAttr(task.id)}" data-field="raw" readonly style="color:var(--ink-3)">${raw}</textarea>
            </div>` : ""}
            <div class="task-detail-actions">
              <span class="source-label">${escapeHtml(source)}</span>
              <button class="btn btn-sm btn-ghost" type="button" data-action="duplicate">${icon("duplicate", "icon-sm")} تکرار</button>
              <button class="btn btn-sm btn-ghost" type="button" data-action="move-up" ${index === 0 ? "disabled" : ""}>${icon("chevron-up", "icon-sm")} بالا</button>
              <button class="btn btn-sm btn-ghost" type="button" data-action="move-down" ${index === state.tasks.length - 1 ? "disabled" : ""}>${icon("chevron-down", "icon-sm")} پایین</button>
              <button class="btn btn-sm btn-danger" type="button" data-action="delete">${icon("trash", "icon-sm")} حذف</button>
            </div>
          </div>
        </div>
        <div class="task-tools">
          <button class="icon-btn" type="button" data-action="toggle" aria-label="${isOpen ? "بستن جزئیات" : "بازکردن جزئیات"}" title="${isOpen ? "بستن جزئیات" : "جزئیات بیشتر"}">
            ${icon(isOpen ? "chevron-up" : "chevron-down")}
          </button>
          <button class="icon-btn" type="button" data-action="delete" aria-label="حذف تسک" title="حذف تسک">${icon("trash")}</button>
        </div>
      </div>
    </article>`;
}

function renderTasks() {
  updateSummary();
  const list = $("#task-list");
  const empty = $("#tasks-empty");
  if (!list || !empty) return;

  if (!state.tasks.length) {
    list.innerHTML = "";
    empty.hidden = false;
    renderFrequentOptions();
    return;
  }
  empty.hidden = true;

  const tasks = visibleTasks();
  if (!tasks.length) {
    list.innerHTML = `<div class="filter-empty">${icon("search")}<span>چیزی با این صافی یا جست‌وجو پیدا نشد. صافی را عوض کن یا عبارت دیگری بنویس.</span><button class="btn btn-sm btn-ghost" type="button" data-clear-filter>پاک‌کردن صافی</button></div>`;
    renderFrequentOptions();
    return;
  }

  renderFrequentOptions();
  const dupes = duplicateMap();
  list.innerHTML = tasks.map((task) => {
    const index = state.tasks.indexOf(task);
    return taskCardHTML(task, index, taskWarnings(task, dupes), openTasks.has(task.id));
  }).join("");
}

function setTaskFilter(filter) {
  state.ui.filter = filter;
  $$(".chip[data-filter]").forEach((chip) => chip.classList.toggle("is-active", chip.dataset.filter === filter));
  renderTasks();
}

/* ------------------------------ تبدیل متن ------------------------------- */

function stripLeadingMarker(line) {
  return line
    .replace(/^\s*(?:[-–—•●▪◦*]+|\d{1,3}[.)-]|[۰-۹]{1,3}[.)-])\s*/, "")
    .trim();
}

function detectStatus(text) {
  const s = normalizePersian(text).toLowerCase();
  const done = /(انجام شد|انجام‌شد|انجام شده|تکمیل شد|تکمیل شده|تمام شد|کامل شد|رفع شد|بررسی شد|تحویل شد|بسته شد|منتشر شد|کار شد|کار انجام شد|done|completed)/;
  const blocked = /(مسدود|بلاک|دسترسی نداریم|دسترسی نداشتیم|نداریم|نداشتیم|نمی‌توانیم|نمی توانیم|منتظر|وابسته به|نیازمند دسترسی|مانع\s*[:：]|blocked|on hold)/;
  const planned = /(فردا|برنامه‌ی آینده|برنامه اینده|در آینده|قرار است|خواهد شد|خواهد یافت|باید انجام|در برنامه|planned|todo)/;
  const doing = /(در حال|درحال|ادامه|جریان|پیشرفت|doing|in progress)/;
  if (blocked.test(s)) return "blocked";
  if (done.test(s)) return "done";
  if (planned.test(s)) return "planned";
  if (doing.test(s)) return "doing";
  return "doing";
}

function extractMeta(line) {
  const result = {
    hours: null, progress: null, project: "", owner: "", category: "",
    blocker: "", nextStep: "", date: "", title: ""
  };
  let rest = String(line);
  const take = (re, apply) => {
    const m = rest.match(re);
    if (m) {
      apply(m);
      rest = rest.replace(m[0], " ");
    }
  };

  take(/(?:^|[\s(—–-])([0-9۰-۹]+(?:[.,٫][0-9۰-۹]+)?)\s*(?:ساعت|ساعتی|ساعته)(?=$|[\s,،;)|—–-])/u, (m) => {
    const n = parseNum(m[1]);
    if (n != null) result.hours = n;
  });
  take(/([0-9۰-۹]+(?:[.,٫][0-9۰-۹]+)?)\s*(?:٪|%)/u, (m) => {
    const n = parseNum(m[1]);
    if (n != null) result.progress = clamp(n, 0, 100);
  });
  if (result.progress == null) {
    take(/پیشرفت\s*[:：]?\s*([0-9۰-۹]+)/u, (m) => {
      const n = parseNum(m[1]);
      if (n != null) result.progress = clamp(n, 0, 100);
    });
  }
  if (result.progress != null) {
    rest = rest.replace(/پیشرفت\s*[:：]?\s*/g, " ");
  }
  take(/پروژه(?:‌ی)?\s*[:：]\s*([^|،,;\t]+)/u, (m) => { result.project = normalizePersian(m[1]); });
  take(/مسئول(?:‌ی)?\s*[:：]\s*([^|،,;\t]+)/u, (m) => { result.owner = normalizePersian(m[1]); });
  take(/دسته(?:‌بندی)?\s*[:：]\s*([^|،,;\t]+)/u, (m) => { result.category = normalizePersian(m[1]); });
  take(/مانع(?:‌ها|ها)?\s*[:：]\s*([^|]+)/u, (m) => { result.blocker = normalizePersian(m[1], { keepPunctuation: true }); });
  take(/(?:گام بعدی|اقدام بعدی|برنامه‌ی بعدی)\s*[:：]\s*([^|]+)/u, (m) => { result.nextStep = normalizePersian(m[1], { keepPunctuation: true }); });
  take(/تاریخ\s*[:：]\s*([0-9۰-۹]{4}[\/\-][0-9۰-۹]{1,2}[\/\-][0-9۰-۹]{1,2})/u, (m) => {
    const j = parseJalaliInput(m[1]);
    if (j) result.date = jalaliISO(j);
  });

  const status = detectStatus(line);
  let titleSource = rest;
  const statusPhrases = [
    "در حال کار", "کار شد", "انجام شد", "بررسی شد", "ادامه کار", "انجام کارها",
    "در حال انجام", "در حال بررسی", "تکمیل شد", "تکمیل شده", "انجام شده",
    "تمام شد", "کامل شد", "رفع شد", "تحویل شد", "بسته شد", "مسدود شد",
    "در آینده", "برنامه‌ی آینده", "قرار است", "خواهد شد", "خواهد یافت", "انجام شود",
    "باید انجام شود", "در برنامه"
  ];
  statusPhrases.forEach((phrase) => {
    const re = new RegExp("(^|[\\s—–-])" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[\\s—–-])", "g");
    titleSource = titleSource.replace(re, " ");
  });
  titleSource = titleSource
    .replace(/^\s*(امروز|دیروز|فردا|همچنین|و)\s+/u, "")
    .replace(/\s*\((?:انجام شد|در حال انجام|مسدود|فردا)\)\s*/gu, " ")
    .replace(/\s*—\s*$/u, "")
    .replace(/\(\s*\)/g, " ")
    .replace(/([—–-])(?:\s*[—–-])+/g, "$1")
    .replace(/[—–-]{2,}/g, "—");

  result.title = cleanTitle(titleSource);
  if (status === "blocked") {
    result.title = cleanTitle(result.title.replace(/\s*(هم نداریم|نداریم|نداشتیم|مسدود است|مسدود|منتظریم|منتظر)$/u, ""));
  }
  if (status === "planned") {
    result.title = cleanTitle(result.title
      .replace(/^\s*(باید|قرار است)\s+/u, "")
      .replace(/\s*(فردا|در آینده|برنامه‌ی آینده|انجام شود|انجام خواهد شد)$/u, ""));
  }
  if (!result.title) result.title = cleanTitle(stripLeadingMarker(line));
  if (status === "blocked" && !result.blocker) {
    const b = normalizePersian(line, { keepPunctuation: true });
    if (/(نداریم|نداشتیم|مسدود|منتظر|نیازمند|وابسته)/.test(b)) result.blocker = b;
  }
  if (status === "planned" && !result.nextStep) result.nextStep = result.title;
  if (!result.project && state.settings.defaultProject) result.project = state.settings.defaultProject;
  return Object.assign({ status }, result);
}

function parseQuickText(text, source = "paste") {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const created = [];
  lines.forEach((line, lineIndex) => {
    const cells = splitImportLine(line);
    if (lineIndex === 0 && cells.length > 1 && isHeaderishRow(cells)) return;
    const mainLine = cells.length > 1 ? cells.join(" — ") : line;
    const meta = extractMeta(mainLine);
    if (!meta.title) return;
    const task = newTask({
      title: meta.title,
      raw: line,
      status: meta.status,
      category: meta.category,
      progress: meta.progress,
      hours: meta.hours,
      project: meta.project,
      owner: meta.owner,
      blocker: meta.blocker,
      nextStep: meta.nextStep,
      date: meta.date,
      source
    });
    created.push(task);
  });
  return created;
}

function splitImportLine(line) {
  if (line.includes("\t")) return line.split(/\t+/).map((s) => s.trim()).filter(Boolean);
  if (/\s\|\s/.test(line)) return line.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  return [line];
}

function addQuickTasks() {
  const input = $("#quick-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    toast("اول چند خط تسک بنویس یا متن را بچسبان.", { type: "info" });
    input.focus();
    return;
  }
  const created = parseQuickText(text, "paste");
  if (!created.length) {
    toast("از این متن تسکی تشخیص ندادم؛ هر خط را کمی روشن‌تر بنویس.", { type: "error" });
    return;
  }
  input.value = "";
  resetViewFilters();
  renderTasks();
  schedulePreview();
  scheduleSave();
  toast(faDigits(created.length) + " تسک اضافه شد. اگر جایی هشدار دید، با یک کلیک اصلاحش کن.", { type: "success" });
}

/* ------------------------------ تحلیل متن آزاد -------------------------- */

function proposeFromFreeText(text) {
  const prepared = String(text)
    .replace(/\r/g, "")
    .replace(/([.!؟؛])\s*/g, "$1\n")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/\s/g, "").length >= 4);

  return prepared.map((segment) => {
    const status = detectStatus(segment);
    const basis = segment.replace(/[.!؟؛]+$/u, "").trim();
    let title = basis;
    title = title.replace(/^\s*(امروز|دیروز|فردا|بعد از ظهر|صبح|شب|همچنین|و)\s+/u, "");
    title = title.replace(/\s*(انجام شد|انجام خواهد شد|انجام شود|انجام می‌شود|انجام شده|کار شد|رفع شد|بررسی شد)\s*$/u, "");

    if (/کار شد/.test(basis)) {
      const subject = normalizePersian(basis.replace(/^.*?روی\s+/u, "").replace(/\s*کار شد.*$/u, ""));
      if (subject) title = "انجام کار روی " + subject;
    }
    if (/(رفع شد|رفع شده)/.test(basis) && /(خطا|باگ|مشکل)/.test(title)) {
      const err = title.match(/(خطا[^،.]*|باگ[^،.]*|مشکل[^،.]*)/u);
      if (err) title = "رفع " + normalizePersian(err[1].replace(/بود که.*$/u, "").replace(/^(یک|یک‌)\s+/u, ""));
    }
    if (status === "blocked") {
      title = title.replace(/\s*(هم نداریم|نداریم|نداشتیم|مسدود است|مسدود|منتظریم|منتظر)\s*$/u, "");
    }
    if (status === "planned") {
      title = title.replace(/^\s*باید\s+/u, "").replace(/\s*(انجام شود|انجام خواهد شد)\s*$/u, "");
    }
    title = cleanTitle(title);
    if (!title) title = cleanTitle(basis);

    return {
      title,
      status,
      original: segment,
      blocker: status === "blocked" ? normalizePersian(segment, { keepPunctuation: true }) : "",
      nextStep: status === "planned" ? title : "",
      checked: true
    };
  });
}

function openSmartAnalysis() {
  const input = $("#quick-input");
  const text = input ? input.value.trim() : "";
  if (!text) {
    toast("یک پاراگراف از کارهایت بنویس؛ بعد پیشنهاد می‌دهم.", { type: "info" });
    if (input) input.focus();
    return;
  }
  const proposals = proposeFromFreeText(text);
  if (!proposals.length) {
    toast("متن کوتاه‌تر از آن است که بتوانم پیشنهادی بسازم.", { type: "error" });
    return;
  }

  const body = `
    <p class="helper" style="margin-bottom:12px">این پیشنهادها با نشانه‌های متن ساخته شده‌اند؛ نه با ارسال به جایی. هر کدام را خواستی ویرایش کن یا تیکش را بردار.</p>
    <div class="proposal-list">
      ${proposals.map((p, i) => `
        <label class="proposal">
          <input type="checkbox" data-prop-check="${i}" ${p.checked ? "checked" : ""} aria-label="افزودن پیشنهاد ${faDigits(i + 1)}">
          <div class="proposal-body">
            <input class="proposal-title" type="text" data-prop-title="${i}" value="${escapeAttr(p.title)}" aria-label="عنوان پیشنهاد ${faDigits(i + 1)}">
            <div class="proposal-meta">
              <select class="select select-sm" data-prop-status="${i}" aria-label="وضعیت پیشنهاد ${faDigits(i + 1)}">
                ${taskStatusOptions(p.status)}
              </select>
              <span>${statusReason(p.status)}</span>
            </div>
            ${p.blocker ? `<div class="proposal-note">مانع پیشنهادی: ${escapeHtml(p.blocker)}</div>` : ""}
            ${p.nextStep && p.status === "planned" ? `<div class="proposal-note">برنامه‌ی آینده: ${escapeHtml(p.nextStep)}</div>` : ""}
          </div>
        </label>`).join("")}
    </div>`;

  const layer = openModal({
    title: "پیشنهاد تسک از متن آزاد",
    sub: "قبل از افزودن، همه‌چیز را خودت تأیید می‌کنی.",
    iconName: "sparkles",
    size: "modal-lg",
    body,
    footer: `
      <button class="btn btn-primary" type="button" data-add-proposals>${icon("plus")} افزودن موارد انتخاب‌شده</button>
      <button class="btn" type="button" data-modal-close>انصراف</button>
      <span class="spacer"></span>
      <span class="helper" id="proposal-count">${faDigits(proposals.length)} پیشنهاد</span>`
  });

  const updateCount = () => {
    const n = layer.querySelectorAll("[data-prop-check]:checked").length;
    const el = layer.querySelector("#proposal-count");
    if (el) el.textContent = faDigits(n) + " مورد انتخاب شده";
  };
  layer.querySelectorAll("[data-prop-check]").forEach((cb) => cb.addEventListener("change", updateCount));
  updateCount();

  layer.querySelector("[data-add-proposals]").addEventListener("click", () => {
    const added = [];
    layer.querySelectorAll("[data-prop-check]:checked").forEach((cb) => {
      const i = Number(cb.dataset.propCheck);
      const p = proposals[i];
      const titleInput = layer.querySelector(`[data-prop-title="${i}"]`);
      const statusSelect = layer.querySelector(`[data-prop-status="${i}"]`);
      const title = cleanTitle(titleInput ? titleInput.value : p.title);
      if (!title) return;
      const status = statusSelect ? statusSelect.value : p.status;
      added.push(newTask({
        title,
        raw: p.original,
        status,
        blocker: status === "blocked" ? p.blocker : "",
        nextStep: status === "planned" ? p.nextStep : "",
        source: "smart"
      }));
    });
    if (!added.length) {
      toast("هیچ موردی انتخاب نشده است.", { type: "info" });
      return;
    }
    if (input) input.value = "";
    closeModal();
    resetViewFilters();
    renderTasks();
    schedulePreview();
    scheduleSave();
    toast(faDigits(added.length) + " تسک از متن ساخته شد.", { type: "success" });
  });
}

function statusReason(status) {
  if (status === "done") return "نشانه‌ی انجام‌شدن در متن بود";
  if (status === "blocked") return "نشانه‌ی مانع یا انتظار در متن بود";
  if (status === "planned") return "نشانه‌ی برنامه برای آینده در متن بود";
  return "نشانه‌ی کار در جریان بود";
}

/* ------------------------------ کارهای تسک ------------------------------ */

function deleteTaskWithUndo(id) {
  const index = state.tasks.findIndex((t) => t.id === id);
  if (index < 0) return;
  const [removed] = state.tasks.splice(index, 1);
  openTasks.delete(id);
  state.tasks.forEach((t, i) => { t.order = i; });
  renderTasks();
  schedulePreview();
  scheduleSave();
  toast("تسک حذف شد.", {
    type: "info",
    duration: 8000,
    action: "بازگردانی",
    onAction: () => {
      state.tasks.splice(index, 0, removed);
      state.tasks.forEach((t, i) => { t.order = i; });
      renderTasks();
      schedulePreview();
      scheduleSave();
      toast("تسک برگشت.", { type: "success" });
    }
  });
}

function duplicateTask(id) {
  const index = state.tasks.findIndex((t) => t.id === id);
  if (index < 0) return;
  const copy = sanitizeTask(Object.assign({}, state.tasks[index], { id: uid(), title: state.tasks[index].title }));
  state.tasks.splice(index + 1, 0, copy);
  state.tasks.forEach((t, i) => { t.order = i; });
  renderTasks();
  schedulePreview();
  scheduleSave();
  toast("یک نسخه‌ی تکراری ساخته شد.", { type: "success" });
}

function moveTask(id, delta) {
  const index = state.tasks.findIndex((t) => t.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= state.tasks.length) return;
  const [task] = state.tasks.splice(index, 1);
  state.tasks.splice(target, 0, task);
  state.tasks.forEach((t, i) => { t.order = i; });
  renderTasks();
  schedulePreview();
  scheduleSave();
}

function reorderTask(draggedId, targetId) {
  if (draggedId === targetId) return;
  const from = state.tasks.findIndex((t) => t.id === draggedId);
  const to = state.tasks.findIndex((t) => t.id === targetId);
  if (from < 0 || to < 0) return;
  const [task] = state.tasks.splice(from, 1);
  const insertAt = from < to ? to : to;
  state.tasks.splice(insertAt, 0, task);
  state.tasks.forEach((t, i) => { t.order = i; });
  renderTasks();
  schedulePreview();
  scheduleSave();
}

function frequentChipsHTML(field) {
  const values = frequentValues(field, 6);
  if (!values.length) {
    return `<span class="field-hint">گزینه‌های پرکاربرد بعد از چند تسک اینجا ظاهر می‌شوند.</span>`;
  }
  return `<div class="freq-chips">${values.map((value) =>
    `<button class="chip" type="button" data-freq-field="${field}" data-freq-value="${escapeAttr(value)}">${escapeHtml(value)}</button>`
  ).join("")}</div>`;
}

function openNewTaskModal() {
  const draft = { date: "" };
  const body = `
    <div class="settings-grid">
      <div class="field span-2">
        <label class="field-label" for="new-task-title">عنوان تسک *</label>
        <input class="input" type="text" id="new-task-title" placeholder="مثلاً پیاده‌سازی صفحه‌ی ورود">
      </div>
      <div class="field">
        <label class="field-label" for="new-task-status">وضعیت</label>
        <select class="select" id="new-task-status">${taskStatusOptions("doing")}</select>
      </div>
      <div class="field">
        <label class="field-label" for="new-task-project">پروژه</label>
        <select class="select" id="new-task-project">${projectSelectOptions(state.settings.defaultProject)}</select>
        ${state.projects.length ? "" : `<span class="field-hint">هنوز پروژه‌ای نساخته‌ای؛ برای انتخاب، از تنظیمات پروژه بساز.</span>`}
      </div>
      <div class="field">
        <label class="field-label" for="new-task-category">دسته‌بندی</label>
        <input class="input" type="text" id="new-task-category" list="frequent-categories" placeholder="مثلاً توسعه">
        ${frequentChipsHTML("category")}
      </div>
      <div class="field">
        <label class="field-label" for="new-task-owner">مسئول</label>
        <input class="input" type="text" id="new-task-owner" list="frequent-owners" placeholder="نام مسئول">
        ${frequentChipsHTML("owner")}
      </div>
      <div class="field">
        <label class="field-label" for="new-task-hours">ساعت صرف‌شده</label>
        <input class="input" type="text" inputmode="decimal" id="new-task-hours" placeholder="مثلاً ۲٫۵">
      </div>
      <div class="field">
        <label class="field-label" for="new-task-progress">درصد پیشرفت</label>
        <input class="input" type="text" inputmode="numeric" id="new-task-progress" placeholder="مثلاً ۶۰">
      </div>
      <div class="field">
        <span class="field-label">تاریخ تسک</span>
        <button class="date-pick is-empty" type="button" id="new-task-date">${icon("calendar")}<span>بدون تاریخ</span>${icon("chevron-down")}</button>
      </div>
      <div class="field">
        <label class="field-label" for="new-task-next">گام بعدی</label>
        <input class="input" type="text" id="new-task-next" placeholder="قدم بعدی چه چیزی است؟">
      </div>
      <div class="field span-2">
        <label class="field-label" for="new-task-checklist">چک‌لیست</label>
        <textarea class="textarea" id="new-task-checklist" rows="3" style="min-height:76px" placeholder="هر خط یک مورد؛ مثلاً:&#10;تکمیل فرم ورود&#10;تست سناریوها"></textarea>
      </div>
      <div class="field span-2">
        <label class="field-label" for="new-task-plans">برنامه‌های آینده</label>
        <textarea class="textarea" id="new-task-plans" rows="3" style="min-height:76px" placeholder="هر خط یک برنامه؛ بعد از افزودن می‌توانی برای هرکدام تاریخ بگذاری."></textarea>
      </div>
    </div>`;

  const layer = openModal({
    title: "تسک جدید",
    sub: "جزئیات را کامل کن یا فقط عنوان را بنویس؛ بقیه را بعداً هم می‌توانی اضافه کنی.",
    iconName: "plus",
    size: "modal-lg",
    body,
    footer: `
      <button class="btn btn-primary" type="button" data-save-new-task>${icon("check")} افزودن تسک</button>
      <button class="btn" type="button" data-modal-close>انصراف</button>`
  });

  const dateButton = layer.querySelector("#new-task-date");
  const dateLabel = dateButton.querySelector("span");
  const updateDateButton = () => {
    dateLabel.textContent = draft.date ? jalaliDisplayFromISO(draft.date) : "بدون تاریخ";
    dateButton.classList.toggle("is-empty", !draft.date);
  };
  dateButton.addEventListener("click", () => {
    openDatePicker(dateButton, draft.date, (value) => {
      draft.date = value;
      updateDateButton();
    });
  });

  layer.querySelectorAll("[data-freq-field]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const field = chip.dataset.freqField;
      const input = layer.querySelector(field === "category" ? "#new-task-category" : "#new-task-owner");
      if (input) input.value = chip.dataset.freqValue;
    });
  });

  layer.querySelector("[data-save-new-task]").addEventListener("click", () => {
    const title = cleanTitle(layer.querySelector("#new-task-title").value);
    if (!title) {
      toast("عنوان تسک را بنویس.", { type: "error" });
      layer.querySelector("#new-task-title").focus();
      return;
    }
    const checklist = layer.querySelector("#new-task-checklist").value.split(/\r?\n/)
      .map((line) => normalizePersian(line, { keepPunctuation: true }))
      .filter(Boolean)
      .map((text) => ({ text, done: false }));
    const futurePlans = layer.querySelector("#new-task-plans").value.split(/\r?\n/)
      .map((line) => normalizePersian(line, { keepPunctuation: true }))
      .filter(Boolean)
      .map((text) => ({ text, date: "" }));

    const task = newTask({
      title,
      status: layer.querySelector("#new-task-status").value,
      project: layer.querySelector("#new-task-project").value,
      category: normalizePersian(layer.querySelector("#new-task-category").value),
      owner: normalizePersian(layer.querySelector("#new-task-owner").value),
      hours: parseNum(layer.querySelector("#new-task-hours").value),
      progress: parseNum(layer.querySelector("#new-task-progress").value),
      date: draft.date,
      nextStep: normalizePersian(layer.querySelector("#new-task-next").value, { keepPunctuation: true }),
      checklist,
      futurePlans,
      source: "manual"
    });
    openTasks.add(task.id);
    closeModal();
    resetViewFilters();
    renderTasks();
    renderSettings();
    schedulePreview();
    scheduleSave();
    toast("تسک جدید اضافه شد.", { type: "success" });
  });
}

function loadSampleTasks() {
  const add = () => {
    const projectName = state.settings.defaultProject || ensureProject("سامانه‌ی داخلی");
    state.settings.defaultProject = projectName;
    SAMPLE_TASKS.forEach((sample) => {
      newTask(Object.assign({}, sample, { source: "sample", raw: sample.title, project: projectName }));
    });
    resetViewFilters();
    renderTasks();
    renderSettings();
    schedulePreview();
    scheduleSave();
    toast(faDigits(SAMPLE_TASKS.length) + " تسک نمونه اضافه شد؛ می‌توانی همین‌ها را ویرایش کنی.", { type: "success" });
  };
  if (!state.tasks.length) add();
  else {
    confirmDialog({
      title: "افزودن تسک‌های نمونه",
      message: "تسک‌های نمونه به انتهای فهرست فعلی اضافه می‌شوند. ادامه می‌دهی؟",
      confirmText: "افزودن",
      iconName: "sparkles"
    }).then((ok) => { if (ok) add(); });
  }
}

/* ------------------------------ پیوند رویدادها -------------------------- */

function addChecklistItem(task, card) {
  const input = card.querySelector("[data-check-new]");
  if (!input) return;
  const text = normalizePersian(input.value, { keepPunctuation: true });
  if (!text) {
    input.focus();
    return;
  }
  task.checklist.push({ id: uid("c"), text, done: false });
  renderTasks();
  schedulePreview();
  scheduleSave();
}

function addFuturePlan(task, card) {
  const input = card.querySelector("[data-plan-new]");
  if (!input) return;
  const text = normalizePersian(input.value, { keepPunctuation: true });
  if (!text) {
    input.focus();
    return;
  }
  task.futurePlans.push({ id: uid("f"), text, date: "" });
  renderTasks();
  schedulePreview();
  scheduleSave();
}

function clearTaskChecklist(task) {
  if (!task.checklist.length) return;
  confirmDialog({
    title: "پاک‌کردن چک‌لیست",
    message: "همه‌ی موارد چک‌لیست این تسک حذف شوند؟",
    confirmText: "پاک کن",
    danger: true,
    iconName: "trash"
  }).then((ok) => {
    if (!ok) return;
    task.checklist = [];
    renderTasks();
    schedulePreview();
    scheduleSave();
    toast("چک‌لیست پاک شد.", { type: "info" });
  });
}

function bindTaskEvents() {
  const quickInput = $("#quick-input");
  const convertBtn = $("#btn-convert");
  const smartBtn = $("#btn-smart");
  const addBlank = $("#btn-add-task");
  const sampleBtn = $("#btn-sample");
  const search = $("#task-search");

  if (convertBtn) convertBtn.addEventListener("click", addQuickTasks);
  if (quickInput) {
    quickInput.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        addQuickTasks();
      }
    });
  }
  if (smartBtn) smartBtn.addEventListener("click", openSmartAnalysis);
  if (addBlank) addBlank.addEventListener("click", openNewTaskModal);
  if (sampleBtn) sampleBtn.addEventListener("click", loadSampleTasks);
  if (search) {
    search.addEventListener("input", debounce(() => {
      state.ui.search = search.value;
      renderTasks();
    }, 160));
  }

  $$(".chip[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => setTaskFilter(chip.dataset.filter));
  });

  const list = $("#task-list");
  if (!list) return;

  list.addEventListener("input", (event) => {
    const card = event.target.closest(".task");
    if (!card) return;
    const task = state.tasks.find((t) => t.id === card.dataset.id);
    if (!task) return;

    if (event.target.matches("[data-check-text]")) {
      const item = task.checklist.find((entry) => entry.id === event.target.dataset.checkText);
      if (item) item.text = event.target.value;
      scheduleSave();
      schedulePreview();
      return;
    }
    if (event.target.matches("[data-plan-text]")) {
      const plan = task.futurePlans.find((entry) => entry.id === event.target.dataset.planText);
      if (plan) plan.text = event.target.value;
      scheduleSave();
      schedulePreview();
      return;
    }

    const field = event.target.dataset.field;
    if (!field) return;

    if (field === "hours") {
      const n = parseNum(event.target.value);
      task.hours = n == null ? null : Math.max(0, n);
    } else if (field === "progress") {
      const n = parseNum(event.target.value);
      task.progress = n == null ? null : clamp(n, 0, 100);
    } else if (field === "title") {
      task.title = event.target.value;
      card.classList.toggle("is-empty-title", !task.title.trim());
    } else {
      task[field] = event.target.value;
    }
    scheduleSave();
    schedulePreview();
    updateSummary();
  });

  list.addEventListener("change", (event) => {
    const card = event.target.closest(".task");
    if (!card) return;
    const task = state.tasks.find((t) => t.id === card.dataset.id);
    if (!task) return;

    if (event.target.matches('[data-field="project"]')) {
      task.project = ensureProject(event.target.value);
      schedulePreview();
      scheduleSave();
      updateSummary();
      return;
    }

    const checkToggle = event.target.closest("[data-check-toggle]");
    if (checkToggle) {
      const item = task.checklist.find((entry) => entry.id === checkToggle.dataset.checkToggle);
      if (item) item.done = checkToggle.checked;
      renderTasks();
      schedulePreview();
      scheduleSave();
      return;
    }

    if (!event.target.matches("[data-status-select]")) return;
    task.status = event.target.value;
    if (task.status === "blocked") openTasks.add(task.id);
    renderTasks();
    schedulePreview();
    scheduleSave();
    if (task.status === "blocked") {
      const newCard = $(`.task[data-id="${task.id}"]`);
      const blocker = newCard ? newCard.querySelector('[data-field="blocker"]') : null;
      if (blocker) blocker.focus();
    }
  });

  list.addEventListener("focusout", (event) => {
    const card = event.target.closest(".task");
    if (!card) return;
    const task = state.tasks.find((t) => t.id === card.dataset.id);
    if (!task) return;

    if (event.target.matches("[data-check-text]")) {
      const item = task.checklist.find((entry) => entry.id === event.target.dataset.checkText);
      if (item) {
        item.text = normalizePersian(item.text, { keepPunctuation: true });
        event.target.value = item.text;
      }
      schedulePreview();
      scheduleSave();
      return;
    }
    if (event.target.matches("[data-plan-text]")) {
      const plan = task.futurePlans.find((entry) => entry.id === event.target.dataset.planText);
      if (plan) {
        plan.text = normalizePersian(plan.text, { keepPunctuation: true });
        event.target.value = plan.text;
      }
      schedulePreview();
      scheduleSave();
      return;
    }

    const field = event.target.dataset.field;
    if (!field || field === "raw") return;
    if (field === "title") {
      task.title = cleanTitle(task.title);
      event.target.value = task.title;
      card.classList.toggle("is-empty-title", !task.title.trim());
    } else if (field === "hours") {
      event.target.value = task.hours != null ? formatNum(task.hours) : "";
    } else if (field === "progress") {
      event.target.value = task.progress != null ? formatNum(task.progress) : "";
    } else if (field === "project" || field === "owner" || field === "category") {
      task[field] = normalizePersian(task[field]);
      event.target.value = task[field];
    } else if (field === "blocker" || field === "nextStep") {
      task[field] = normalizePersian(task[field], { keepPunctuation: true });
      event.target.value = task[field];
    }
    updateCardWarnings(card, task);
    updateSummary();
    schedulePreview();
    scheduleSave();
  });

  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const card = event.target.closest(".task");
    if (!card) return;
    const task = state.tasks.find((t) => t.id === card.dataset.id);
    if (!task) return;
    if (event.target.matches("[data-check-new]")) {
      event.preventDefault();
      addChecklistItem(task, card);
    } else if (event.target.matches("[data-plan-new]")) {
      event.preventDefault();
      addFuturePlan(task, card);
    }
  });

  list.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-filter]")) {
      resetViewFilters();
      renderTasks();
      return;
    }
    const card = event.target.closest(".task");
    if (!card) return;
    const task = state.tasks.find((t) => t.id === card.dataset.id);
    if (!task) return;

    if (event.target.closest("[data-add-check]")) {
      addChecklistItem(task, card);
      return;
    }
    if (event.target.closest("[data-check-delete]")) {
      const id = event.target.closest("[data-check-delete]").dataset.checkDelete;
      task.checklist = task.checklist.filter((item) => item.id !== id);
      renderTasks();
      schedulePreview();
      scheduleSave();
      return;
    }
    if (event.target.closest("[data-clear-checklist]")) {
      clearTaskChecklist(task);
      return;
    }
    if (event.target.closest("[data-add-plan]")) {
      addFuturePlan(task, card);
      return;
    }
    if (event.target.closest("[data-plan-delete]")) {
      const id = event.target.closest("[data-plan-delete]").dataset.planDelete;
      task.futurePlans = task.futurePlans.filter((plan) => plan.id !== id);
      renderTasks();
      schedulePreview();
      scheduleSave();
      return;
    }
    if (event.target.closest("[data-plan-date]")) {
      const button = event.target.closest("[data-plan-date]");
      const plan = task.futurePlans.find((entry) => entry.id === button.dataset.planDate);
      if (!plan) return;
      openDatePicker(button, plan.date, (value) => {
        plan.date = value;
        renderTasks();
        schedulePreview();
        scheduleSave();
      });
      return;
    }

    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    const id = card.dataset.id;
    const action = actionBtn.dataset.action;

    if (action === "toggle") {
      if (openTasks.has(id)) openTasks.delete(id);
      else openTasks.add(id);
      renderTasks();
    } else if (action === "delete") {
      deleteTaskWithUndo(id);
    } else if (action === "duplicate") {
      duplicateTask(id);
    } else if (action === "move-up") {
      moveTask(id, -1);
    } else if (action === "move-down") {
      moveTask(id, 1);
    } else if (action === "date") {
      openDatePicker(actionBtn, task.date, (value) => {
        task.date = value;
        renderTasks();
        scheduleSave();
        schedulePreview();
      });
    }
  });

  let draggedId = null;
  list.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".task");
    if (!card) return;
    draggedId = card.dataset.id;
    card.classList.add("is-dragging");
    try {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedId);
    } catch (e) { /* بی‌اهمیت */ }
  });
  list.addEventListener("dragend", () => {
    draggedId = null;
    $$(".task").forEach((el) => el.classList.remove("is-dragging", "is-drop-target"));
  });
  list.addEventListener("dragover", (event) => {
    const card = event.target.closest(".task");
    if (!card || !draggedId || card.dataset.id === draggedId) return;
    event.preventDefault();
    $$(".task").forEach((el) => el.classList.toggle("is-drop-target", el === card));
  });
  list.addEventListener("drop", (event) => {
    const card = event.target.closest(".task");
    if (!card || !draggedId) return;
    event.preventDefault();
    reorderTask(draggedId, card.dataset.id);
    draggedId = null;
  });
}
