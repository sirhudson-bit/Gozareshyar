/* ==========================================================================
   قوانین نگارش
   ========================================================================== */

function ruleTypeBadge(rule) {
  if (rule.type === "linguistic") {
    return `<span class="badge badge-linguistic">${icon("sparkles")} دستور زبانی</span>`;
  }
  return `<span class="badge badge-structural">${icon("rules")} ساختاری</span>`;
}

function configSummary(rule) {
  if (!rule.config) return "";
  if (rule.key === "verbStart" && Array.isArray(rule.config.verbs)) {
    return `<b>افعال:</b> ${escapeHtml(rule.config.verbs.slice(0, 7).join("، "))}${rule.config.verbs.length > 7 ? " و " + faDigits(rule.config.verbs.length - 7) + " فعل دیگر" : ""}`;
  }
  if (rule.key === "vagueWarnings" && Array.isArray(rule.config.phrases)) {
    return `<b>عبارت‌ها:</b> ${escapeHtml(rule.config.phrases.slice(0, 6).join("، "))}${rule.config.phrases.length > 6 ? " و " + faDigits(rule.config.phrases.length - 6) + " مورد دیگر" : ""}`;
  }
  if (rule.key === "noFirstPerson" && Array.isArray(rule.config.words)) {
    return `<b>ضمیرها:</b> ${escapeHtml(rule.config.words.join("، "))}`;
  }
  if (rule.key === "hoursUnit" && rule.config.unit) {
    return `<b>واحد:</b> ${escapeHtml(rule.config.unit)}`;
  }
  if (rule.key === "percentSymbol" && rule.config.symbol) {
    return `<b>نماد:</b> ${escapeHtml(rule.config.symbol)}`;
  }
  if (rule.key === "futureTone" && rule.config.suffix) {
    return `<b>پایان برنامه:</b> ${escapeHtml(rule.config.suffix)}`;
  }
  if (rule.key === "blockersSection" && rule.config.title) {
    return `<b>عنوان بخش:</b> ${escapeHtml(rule.config.title)}`;
  }
  if (rule.key === "adminIntro" && rule.config.text) {
    return `<b>مقدمه:</b> ${escapeHtml(String(rule.config.text).slice(0, 130))}${String(rule.config.text).length > 130 ? "…" : ""}`;
  }
  if (rule.key === "adminConclusion") {
    const parts = [];
    if (rule.config.text) parts.push("جمع‌بندی سفارشی");
    if (rule.config.suggestion) parts.push("پیشنهاد: " + String(rule.config.suggestion).slice(0, 90) + (String(rule.config.suggestion).length > 90 ? "…" : ""));
    return parts.length ? `<b>${escapeHtml(parts.join(" — "))}</b>` : "";
  }
  if (rule.custom && rule.type === "structural") {
    return `<b>جایگزینی:</b> «${escapeHtml(rule.config.find || "")}» ← «${escapeHtml(rule.config.replace || "")}»`;
  }
  if (rule.type === "linguistic" && rule.config.instruction) {
    return `<b>دستور:</b> ${escapeHtml(String(rule.config.instruction).slice(0, 120))}${String(rule.config.instruction).length > 120 ? "…" : ""}`;
  }
  return "";
}

function renderRules() {
  const list = $("#rules-list");
  if (!list) return;
  const structural = state.rules.filter((r) => r.type === "structural").length;
  const linguistic = state.rules.filter((r) => r.type === "linguistic").length;
  const enabled = state.rules.filter((r) => r.enabled).length;
  const cs = $("#rules-count-structural");
  const cl = $("#rules-count-linguistic");
  if (cs) cs.textContent = faDigits(structural);
  if (cl) cl.textContent = faDigits(linguistic);
  const badge = $("#badge-rules");
  if (badge) badge.textContent = faDigits(enabled);

  if (!state.rules.length) {
    list.innerHTML = `<div class="history-empty">هنوز قانونی نداری. با «قانون جدید» یکی بساز یا قوانین پیش‌فرض را برگردان.</div>`;
    return;
  }

  list.innerHTML = state.rules.map((rule, index) => {
    const summary = configSummary(rule);
    return `
      <div class="rule${rule.enabled ? "" : " is-off"}" data-rule-id="${escapeAttr(rule.id)}">
        <div class="rule-order">
          <button class="mini-btn" type="button" data-rule-action="up" aria-label="بالا بردن قانون" ${index === 0 ? "disabled" : ""}>${icon("chevron-up")}</button>
          <button class="mini-btn" type="button" data-rule-action="down" aria-label="پایین بردن قانون" ${index === state.rules.length - 1 ? "disabled" : ""}>${icon("chevron-down")}</button>
        </div>
        <div class="rule-num" aria-hidden="true">${faDigits(index + 1)}</div>
        <div class="rule-body">
          <div class="rule-heading">
            <span class="rule-title">${escapeHtml(rule.title)}</span>
            ${ruleTypeBadge(rule)}
            ${rule.custom ? `<span class="badge badge-custom">${icon("edit")} سفارشی</span>` : ""}
            ${rule.enabled ? "" : `<span class="badge badge-off">خاموش</span>`}
          </div>
          <p class="rule-desc">${escapeHtml(rule.desc)}</p>
          ${summary ? `<div class="rule-config">${summary}</div>` : ""}
        </div>
        <div class="rule-actions">
          <button class="icon-btn" type="button" data-rule-action="edit" aria-label="ویرایش قانون" title="ویرایش">${icon("edit")}</button>
          ${rule.custom ? `<button class="icon-btn" type="button" data-rule-action="delete" aria-label="حذف قانون" title="حذف">${icon("trash")}</button>` : ""}
          <button class="switch" type="button" role="switch" aria-checked="${rule.enabled ? "true" : "false"}" data-rule-action="toggle" aria-label="${rule.enabled ? "خاموش‌کردن" : "روشن‌کردن"} قانون ${escapeAttr(rule.title)}"></button>
        </div>
      </div>`;
  }).join("");
}

function ruleConfigEditor(rule) {
  const c = rule.config || {};
  if (!rule.custom) {
    if (rule.key === "verbStart") {
      return `<div class="field">
        <label class="field-label" for="rule-verbs">فعل‌های کاری</label>
        <textarea class="textarea" id="rule-verbs" rows="5" style="min-height:110px">${escapeHtml((c.verbs || []).join("\n"))}</textarea>
        <span class="field-hint">هر فعل در یک خط. ردیف باید با یکی از این فعل‌ها شروع شود.</span>
      </div>`;
    }
    if (rule.key === "vagueWarnings") {
      return `<div class="field">
        <label class="field-label" for="rule-phrases">عبارت‌های مبهم</label>
        <textarea class="textarea" id="rule-phrases" rows="5" style="min-height:110px">${escapeHtml((c.phrases || []).join("\n"))}</textarea>
        <span class="field-hint">هر عبارت در یک خط؛ اگر عنوان تسک دقیقاً همین باشد یا فقط همین عبارت باشد، هشدار می‌گیرد.</span>
      </div>`;
    }
    if (rule.key === "noFirstPerson") {
      return `<div class="field">
        <label class="field-label" for="rule-words">ضمیرها و عبارت‌های اول‌شخص</label>
        <textarea class="textarea" id="rule-words" rows="4" style="min-height:90px">${escapeHtml((c.words || []).join("\n"))}</textarea>
        <span class="field-hint">هر مورد در یک خط. این موارد از متن گزارش حذف می‌شوند.</span>
      </div>`;
    }
    if (rule.key === "hoursUnit") {
      return `<div class="field">
        <label class="field-label" for="rule-unit">واحد ساعت</label>
        <input class="input" type="text" id="rule-unit" value="${escapeAttr(c.unit || "ساعت")}">
      </div>`;
    }
    if (rule.key === "percentSymbol") {
      return `<div class="field">
        <label class="field-label" for="rule-symbol">نماد درصد</label>
        <input class="input" type="text" id="rule-symbol" value="${escapeAttr(c.symbol || "٪")}" maxlength="3">
      </div>`;
    }
    if (rule.key === "futureTone") {
      return `<div class="field">
        <label class="field-label" for="rule-suffix">پایان‌بندی برنامه‌ی آینده</label>
        <input class="input" type="text" id="rule-suffix" value="${escapeAttr(c.suffix || "انجام خواهد شد.")}">
        <span class="field-hint">اگر عنوان برنامه‌ی آینده لحن آینده نداشته باشد، این عبارت به آن اضافه می‌شود.</span>
      </div>`;
    }
    if (rule.key === "blockersSection") {
      return `<div class="field">
        <label class="field-label" for="rule-section-title">عنوان بخش موانع</label>
        <input class="input" type="text" id="rule-section-title" value="${escapeAttr(c.title || "موانع و نیازمند اقدام")}">
      </div>`;
    }
    if (rule.key === "adminIntro") {
      return `<div class="field">
        <label class="field-label" for="rule-intro-text">متن مقدمه</label>
        <textarea class="textarea" id="rule-intro-text" rows="3" style="min-height:82px">${escapeHtml(c.text || "")}</textarea>
        <span class="field-hint">می‌توانی از جای‌نگهدارهای {تاریخ}، {نویسنده}، {سمت}، {تیم} و {پروژه} استفاده کنی.</span>
      </div>`;
    }
    if (rule.key === "adminConclusion") {
      return `<div class="field">
        <label class="field-label" for="rule-conclusion-text">جمع‌بندی سفارشی (اختیاری)</label>
        <textarea class="textarea" id="rule-conclusion-text" rows="3" style="min-height:82px" placeholder="اگر خالی بماند، جمع‌بندی از روی آمار گزارش ساخته می‌شود.">${escapeHtml(c.text || "")}</textarea>
        <span class="field-hint">اگر خالی باشد، تعداد فعالیت‌های انجام‌شده، ساعت کار و موانع به‌صورت خودکار جمع‌بندی می‌شوند.</span>
      </div>
      <div class="field">
        <label class="field-label" for="rule-conclusion-suggestion">پیشنهاد بهبود</label>
        <textarea class="textarea" id="rule-conclusion-suggestion" rows="2" style="min-height:64px">${escapeHtml(c.suggestion || "")}</textarea>
      </div>`;
    }
    return `<p class="helper">این قانون رفتار داخلی دارد و تنظیم اضافه‌ای لازم ندارد. با خاموش‌کردنش، اثرش از گزارش حذف می‌شود.</p>`;
  }

  if (rule.type === "linguistic") {
    return `<div class="field">
      <label class="field-label" for="rule-instruction">دستور زبانی</label>
      <textarea class="textarea" id="rule-instruction" rows="5" style="min-height:110px" placeholder="مثلاً جمله‌ها را کوتاه‌تر و رسمی‌تر بنویس.">${escapeHtml(c.instruction || "")}</textarea>
      <span class="field-hint">این دستور فقط هنگام بازنویسی هوشمند و با تأیید تو ارسال می‌شود.</span>
    </div>`;
  }

  return `<div class="settings-grid">
    <div class="field">
      <label class="field-label" for="rule-find">متن پیدا</label>
      <input class="input" type="text" id="rule-find" value="${escapeAttr(c.find || "")}" placeholder="مثلاً انجام شد">
    </div>
    <div class="field">
      <label class="field-label" for="rule-replace">جایگزین با</label>
      <input class="input" type="text" id="rule-replace" value="${escapeAttr(c.replace || "")}" placeholder="مثلاً تکمیل شد">
    </div>
  </div>
  <p class="field-hint" style="margin-top:6px">این جایگزینی روی متن نهایی گزارش اعمال می‌شود و به ترتیب قوانین اجرا می‌شود.</p>`;
}

function openRuleModal(rule) {
  const isNew = !rule;
  const editing = rule || {
    id: uid("rule"),
    key: "custom-" + uid("rule"),
    type: "structural",
    title: "",
    desc: "",
    enabled: true,
    custom: true,
    config: { find: "", replace: "", instruction: "" }
  };
  const body = `
    <div class="field">
      <label class="field-label" for="rule-title">عنوان قانون</label>
      <input class="input" type="text" id="rule-title" value="${escapeAttr(editing.title)}" placeholder="مثلاً جایگزینی عبارت‌های غیررسمی">
    </div>
    <div class="field">
      <label class="field-label" for="rule-desc">توضیح کوتاه</label>
      <textarea class="textarea" id="rule-desc" rows="2" style="min-height:64px" placeholder="این قانون چه چیزی را بهتر می‌کند؟">${escapeHtml(editing.desc)}</textarea>
    </div>
    <div class="field">
      <span class="field-label">نوع قانون</span>
      ${editing.custom
        ? `<select class="select" id="rule-type">
            <option value="structural"${editing.type === "structural" ? " selected" : ""}>ساختاری — همین‌جا و آفلاین اجرا می‌شود</option>
            <option value="linguistic"${editing.type === "linguistic" ? " selected" : ""}>زبانی — فقط در بازنویسی هوشمند</option>
          </select>`
        : `<div style="padding-top:5px">${ruleTypeBadge(editing)} <span class="field-hint">نوع قانون‌های داخلی تغییر نمی‌کند.</span></div>`}
    </div>
    <div id="rule-config-area">${ruleConfigEditor(editing)}</div>`;

  const layer = openModal({
    title: isNew ? "قانون جدید" : "ویرایش قانون",
    sub: isNew ? "قانون ساختاری به‌صورت جایگزینی متن اجرا می‌شود؛ قانون زبانی فقط در بازنویسی هوشمند." : "تغییرها فوراً روی پیش‌نمایش گزارش اثر می‌گذارند.",
    iconName: "rules",
    size: "modal-lg",
    body,
    footer: `
      <button class="btn btn-primary" type="button" data-save-rule>${icon("check")} ذخیره‌ی قانون</button>
      <button class="btn" type="button" data-modal-close>انصراف</button>`
  });

  const configArea = layer.querySelector("#rule-config-area");
  const typeSelect = layer.querySelector("#rule-type");
  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      editing.type = typeSelect.value;
      editing.config = editing.config || {};
      configArea.innerHTML = ruleConfigEditor(editing);
    });
  }

  layer.querySelector("[data-save-rule]").addEventListener("click", () => {
    const title = normalizePersian(layer.querySelector("#rule-title").value);
    const desc = normalizePersian(layer.querySelector("#rule-desc").value, { keepPunctuation: true });
    if (!title) {
      toast("برای قانون یک عنوان بنویس.", { type: "error" });
      return;
    }
    const type = typeSelect ? typeSelect.value : editing.type;
    let config = {};
    if (!editing.custom) {
      if (editing.key === "verbStart") {
        config.verbs = layer.querySelector("#rule-verbs").value.split(/\n|،/).map((s) => normalizePersian(s)).filter(Boolean);
      } else if (editing.key === "vagueWarnings") {
        config.phrases = layer.querySelector("#rule-phrases").value.split(/\n/).map((s) => normalizePersian(s)).filter(Boolean);
      } else if (editing.key === "noFirstPerson") {
        config.words = layer.querySelector("#rule-words").value.split(/\n|،/).map((s) => normalizePersian(s)).filter(Boolean);
      } else if (editing.key === "hoursUnit") {
        config.unit = normalizePersian(layer.querySelector("#rule-unit").value) || "ساعت";
      } else if (editing.key === "percentSymbol") {
        config.symbol = layer.querySelector("#rule-symbol").value.trim() || "٪";
      } else if (editing.key === "futureTone") {
        config.suffix = normalizePersian(layer.querySelector("#rule-suffix").value, { keepPunctuation: true }) || "انجام خواهد شد.";
      } else if (editing.key === "blockersSection") {
        config.title = normalizePersian(layer.querySelector("#rule-section-title").value) || "موانع و نیازمند اقدام";
      } else if (editing.key === "adminIntro") {
        config.text = String(layer.querySelector("#rule-intro-text").value || "").trim();
      } else if (editing.key === "adminConclusion") {
        config.text = String(layer.querySelector("#rule-conclusion-text").value || "").trim();
        config.suggestion = String(layer.querySelector("#rule-conclusion-suggestion").value || "").trim();
      } else {
        config = deepClone(editing.config || {});
      }
    } else if (type === "linguistic") {
      config.instruction = String(layer.querySelector("#rule-instruction").value || "").trim();
      if (!config.instruction) {
        toast("دستور زبانی را بنویس.", { type: "error" });
        return;
      }
    } else {
      config.find = String(layer.querySelector("#rule-find").value || "");
      config.replace = String(layer.querySelector("#rule-replace").value || "");
      if (!config.find) {
        toast("برای قانون ساختاری، «متن پیدا» را بنویس.", { type: "error" });
        return;
      }
    }

    if (isNew) {
      state.rules.push(sanitizeRule({
        id: editing.id,
        key: editing.key,
        type,
        title,
        desc,
        enabled: true,
        custom: true,
        config
      }));
    } else {
      editing.title = title;
      editing.desc = desc;
      editing.type = type;
      editing.config = config;
    }
    closeModal();
    renderRules();
    schedulePreview();
    scheduleSave();
    toast(isNew ? "قانون جدید اضافه شد." : "قانون ویرایش شد.", { type: "success" });
  });
}

function bindRuleEvents() {
  const list = $("#rules-list");
  if (list) {
    list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-rule-id]");
      if (!row) return;
      const rule = state.rules.find((r) => r.id === row.dataset.ruleId);
      if (!rule) return;
      const actionBtn = event.target.closest("[data-rule-action]");
      if (!actionBtn) return;
      const action = actionBtn.dataset.ruleAction;
      const index = state.rules.indexOf(rule);

      if (action === "toggle") {
        rule.enabled = !rule.enabled;
        renderRules();
        schedulePreview();
        scheduleSave();
      } else if (action === "edit") {
        openRuleModal(rule);
      } else if (action === "delete") {
        confirmDialog({
          title: "حذف قانون",
          message: "قانون «" + rule.title + "» حذف شود؟ بعداً می‌توانی دوباره بسازی یا از قوانین پیش‌فرض برگردانی.",
          confirmText: "حذف قانون",
          danger: true,
          iconName: "trash"
        }).then((ok) => {
          if (!ok) return;
          state.rules.splice(index, 1);
          renderRules();
          schedulePreview();
          scheduleSave();
          toast("قانون حذف شد.", { type: "info" });
        });
      } else if (action === "up" && index > 0) {
        const [r] = state.rules.splice(index, 1);
        state.rules.splice(index - 1, 0, r);
        renderRules();
        schedulePreview();
        scheduleSave();
      } else if (action === "down" && index < state.rules.length - 1) {
        const [r] = state.rules.splice(index, 1);
        state.rules.splice(index + 1, 0, r);
        renderRules();
        schedulePreview();
        scheduleSave();
      }
    });
  }

  const addBtn = $("#btn-add-rule");
  if (addBtn) addBtn.addEventListener("click", () => openRuleModal(null));

  const resetBtn = $("#btn-reset-rules");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      confirmDialog({
        title: "بازگشت به قوانین پیش‌فرض",
        message: "قوانین فعلی با دوازده قانون پیش‌فرض جایگزین شوند؟ قانون‌های سفارشی حذف می‌شوند.",
        confirmText: "بازگردانی",
        iconName: "refresh"
      }).then((ok) => {
        if (!ok) return;
        state.rules = deepClone(DEFAULT_RULES);
        renderRules();
        schedulePreview();
        scheduleSave();
        toast("قوانین پیش‌فرض برگشتند.", { type: "success" });
      });
    });
  }

  const exportBtn = $("#btn-rules-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const payload = {
        app: APP_ID,
        kind: "rules",
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        rules: state.rules
      };
      downloadText(JSON.stringify(payload, null, 2), "قوانین-گزارش‌یار.json", "application/json;charset=utf-8");
      toast("فایل قوانین آماده شد.", { type: "success" });
    });
  }

  const importBtn = $("#btn-rules-import");
  const rulesFile = $("#rules-file-input");
  if (importBtn && rulesFile) {
    importBtn.addEventListener("click", () => rulesFile.click());
    rulesFile.addEventListener("change", async () => {
      const file = rulesFile.files && rulesFile.files[0];
      rulesFile.value = "";
      if (!file) return;
      try {
        const text = await readFileText(file);
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : parsed.rules;
        if (!Array.isArray(arr) || !arr.length) throw new Error("rules");
        const imported = arr.map(sanitizeRule);
        let settled = false;
        const apply = (replace) => {
          if (settled) return;
          settled = true;
          if (replace) state.rules = imported;
          else {
            imported.forEach((rule) => {
              const idx = state.rules.findIndex((r) => r.id === rule.id);
              if (idx >= 0) state.rules[idx] = rule;
              else state.rules.push(rule);
            });
          }
          renderRules();
          schedulePreview();
          scheduleSave();
          toast(replace ? "قوانین جایگزین شدند." : faDigits(imported.length) + " قانون اضافه یا به‌روز شد.", { type: "success" });
        };
        openModal({
          title: "بازیابی قوانین",
          sub: faDigits(imported.length) + " قانون در فایل پیدا شد.",
          iconName: "upload",
          size: "modal-sm",
          body: `<p class="helper">می‌توانی قوانین فعلی را کامل جایگزین کنی یا قانون‌های فایل را کنار آن‌ها اضافه کنی.</p>`,
          footer: `
            <button class="btn btn-primary" type="button" data-replace>جایگزینی کامل</button>
            <button class="btn" type="button" data-merge>افزودن به قوانین</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" type="button" data-modal-close>انصراف</button>`,
          onMount: (layer) => {
            layer.querySelector("[data-replace]").addEventListener("click", () => { apply(true); closeModal(); });
            layer.querySelector("[data-merge]").addEventListener("click", () => { apply(false); closeModal(); });
          }
        });
      } catch (e) {
        toast("فایل قوانین معتبر نبود. یک فایل پشتیبان قوانین انتخاب کن.", { type: "error" });
      }
    });
  }
}
