/* ==========================================================================
   پروژه‌ها: ساخت، ویرایش، حذف و بازه‌ی زمانی
   ========================================================================== */

function projectTaskCount(project) {
  return state.tasks.filter((task) => task.project === project.name).length;
}

function projectRangeLabel(project) {
  const start = project.startDate ? jalaliDisplayFromISO(project.startDate) : "";
  const end = project.endDate ? jalaliDisplayFromISO(project.endDate) : "";
  if (start && end) return start + " تا " + end;
  if (start) return "شروع: " + start;
  if (end) return "پایان: " + end;
  return "بدون بازه‌ی زمانی";
}

function renderProjectOptions() {
  const select = $("#set-project");
  if (!select) return;
  const current = state.settings.defaultProject || "";
  const options = [`<option value="">بدون پروژه</option>`];
  state.projects.forEach((project) => {
    options.push(`<option value="${escapeAttr(project.name)}">${escapeHtml(project.name)}</option>`);
  });
  if (current && !state.projects.some((project) => project.name === current)) {
    options.push(`<option value="${escapeAttr(current)}">${escapeHtml(current)}</option>`);
  }
  select.innerHTML = options.join("");
  select.value = current;
}

function renderProjects() {
  const list = $("#projects-list");
  if (!list) return;
  if (!state.projects.length) {
    list.innerHTML = `<div class="project-empty">هنوز پروژه‌ای نساخته‌ای. با دکمه‌ی «پروژه‌ی جدید» اولین پروژه را بساز تا بتوانی تسک‌ها را به آن وصل کنی.</div>`;
    return;
  }
  list.innerHTML = state.projects.map((project) => {
    const count = projectTaskCount(project);
    const isDefault = state.settings.defaultProject === project.name;
    return `
      <div class="project-row" data-project-id="${escapeAttr(project.id)}">
        <div class="project-row-icon">${icon("folder")}</div>
        <div class="project-row-body">
          <div class="project-row-name">${escapeHtml(project.name)} ${isDefault ? `<span class="badge badge-structural">پیش‌فرض</span>` : ""}</div>
          <div class="project-row-meta">
            <span>${escapeHtml(projectRangeLabel(project))}</span>
            <span>${faDigits(count)} تسک</span>
          </div>
        </div>
        <div class="project-row-actions">
          <button class="icon-btn" type="button" data-project-action="edit" aria-label="ویرایش پروژه" title="ویرایش">${icon("edit")}</button>
          <button class="icon-btn" type="button" data-project-action="delete" aria-label="حذف پروژه" title="حذف">${icon("trash")}</button>
        </div>
      </div>`;
  }).join("");
}

function openProjectModal(project) {
  const isNew = !project;
  const draft = project
    ? { id: project.id, name: project.name, startDate: project.startDate, endDate: project.endDate }
    : { id: uid("p"), name: "", startDate: "", endDate: "" };

  const body = `
    <div class="field">
      <label class="field-label" for="project-name">نام پروژه *</label>
      <input class="input" type="text" id="project-name" value="${escapeAttr(draft.name)}" placeholder="مثلاً سامانه‌ی داخلی">
    </div>
    <div class="settings-grid" style="margin-top:13px">
      <div class="field">
        <span class="field-label">تاریخ شروع</span>
        <button class="date-pick${draft.startDate ? "" : " is-empty"}" type="button" id="project-start">
          ${icon("calendar")}<span>${draft.startDate ? jalaliDisplayFromISO(draft.startDate) : "بدون تاریخ"}</span>${icon("chevron-down")}
        </button>
      </div>
      <div class="field">
        <span class="field-label">تاریخ پایان</span>
        <button class="date-pick${draft.endDate ? "" : " is-empty"}" type="button" id="project-end">
          ${icon("calendar")}<span>${draft.endDate ? jalaliDisplayFromISO(draft.endDate) : "بدون تاریخ"}</span>${icon("chevron-down")}
        </button>
      </div>
    </div>
    <p class="helper" style="margin-top:10px">اگر هر دو تاریخ را وارد کنی، پایان نباید قبل از شروع باشد. تسک‌های این پروژه بعداً با همین نام در گزارش می‌آیند.</p>`;

  const layer = openModal({
    title: isNew ? "پروژه‌ی جدید" : "ویرایش پروژه",
    sub: isNew ? "نام و بازه‌ی زمانی پروژه را مشخص کن." : "تغییر نام پروژه روی تسک‌های مرتبط هم اعمال می‌شود.",
    iconName: "folder",
    size: "modal-sm",
    body,
    footer: `
      <button class="btn btn-primary" type="button" data-save-project>${icon("check")} ذخیره‌ی پروژه</button>
      <button class="btn" type="button" data-modal-close>انصراف</button>`
  });

  const updateDateButton = (id, value) => {
    const button = layer.querySelector(id);
    if (!button) return;
    button.classList.toggle("is-empty", !value);
    button.querySelector("span").textContent = value ? jalaliDisplayFromISO(value) : "بدون تاریخ";
  };

  layer.querySelector("#project-start").addEventListener("click", () => {
    openDatePicker(layer.querySelector("#project-start"), draft.startDate, (value) => {
      draft.startDate = value;
      updateDateButton("#project-start", value);
    });
  });
  layer.querySelector("#project-end").addEventListener("click", () => {
    openDatePicker(layer.querySelector("#project-end"), draft.endDate, (value) => {
      draft.endDate = value;
      updateDateButton("#project-end", value);
    });
  });

  layer.querySelector("[data-save-project]").addEventListener("click", () => {
    const name = normalizePersian(layer.querySelector("#project-name").value);
    if (!name) {
      toast("نام پروژه را بنویس.", { type: "error" });
      layer.querySelector("#project-name").focus();
      return;
    }
    const duplicate = state.projects.find((entry) => entry.id !== draft.id && entry.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      toast("پروژه‌ای با این نام از قبل وجود دارد.", { type: "error" });
      layer.querySelector("#project-name").focus();
      return;
    }
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      toast("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.", { type: "error" });
      return;
    }

    if (isNew) {
      state.projects.push({ id: draft.id, name, startDate: draft.startDate, endDate: draft.endDate });
      if (!state.settings.defaultProject) state.settings.defaultProject = name;
      toast("پروژه‌ی جدید ساخته شد.", { type: "success" });
    } else {
      const oldName = project.name;
      project.name = name;
      project.startDate = draft.startDate;
      project.endDate = draft.endDate;
      if (oldName !== name) {
        state.tasks.forEach((task) => {
          if (task.project === oldName) task.project = name;
        });
        if (state.settings.defaultProject === oldName) state.settings.defaultProject = name;
      }
      toast("پروژه ویرایش شد.", { type: "success" });
    }

    closeModal();
    renderSettings();
    renderTasks();
    renderPreview();
    updateStorageInfo();
    scheduleSave();
  });
}

function deleteProject(project) {
  const count = projectTaskCount(project);
  confirmDialog({
    title: "حذف پروژه",
    message: "پروژه‌ی «" + project.name + "» حذف شود؟" + (count ? " " + faDigits(count) + " تسک از این پروژه جدا می‌شوند و بدون پروژه می‌مانند." : ""),
    confirmText: "حذف پروژه",
    danger: true,
    iconName: "trash"
  }).then((ok) => {
    if (!ok) return;
    state.projects = state.projects.filter((entry) => entry.id !== project.id);
    state.tasks.forEach((task) => {
      if (task.project === project.name) task.project = "";
    });
    if (state.settings.defaultProject === project.name) state.settings.defaultProject = "";
    renderSettings();
    renderTasks();
    renderPreview();
    updateStorageInfo();
    scheduleSave();
    toast("پروژه حذف شد.", { type: "info" });
  });
}

function bindProjectEvents() {
  const addButton = $("#btn-add-project");
  if (addButton) addButton.addEventListener("click", () => openProjectModal(null));

  const list = $("#projects-list");
  if (list) {
    list.addEventListener("click", (event) => {
      const action = event.target.closest("[data-project-action]");
      if (!action) return;
      const row = action.closest("[data-project-id]");
      if (!row) return;
      const project = state.projects.find((entry) => entry.id === row.dataset.projectId);
      if (!project) return;
      if (action.dataset.projectAction === "edit") openProjectModal(project);
      else if (action.dataset.projectAction === "delete") deleteProject(project);
    });
  }
}
