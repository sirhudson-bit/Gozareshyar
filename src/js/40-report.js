/* ==========================================================================
   ساخت گزارش، پیش‌نمایش و خروجی‌ها
   ========================================================================== */

const previewRenderSoon = debounce(() => {
  if (state) renderPreview();
}, 180);
function schedulePreview() { previewRenderSoon(); }

function reportNumber(value) {
  return ruleOn("persianDigits") ? formatNum(value) : formatNumLatin(value);
}

function reportHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const num = reportNumber(n);
  return ruleOn("hoursUnit") ? num + " " + (activeRuleConfig("hoursUnit", "unit") || "ساعت") : num;
}

function reportPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const num = reportNumber(n);
  return ruleOn("percentSymbol") ? num + (activeRuleConfig("percentSymbol", "symbol") || "٪") : num;
}

function applyCustomStructural(text) {
  let out = String(text == null ? "" : text);
  state.rules
    .filter((r) => r.enabled && r.custom && r.type === "structural" && r.config && r.config.find)
    .forEach((r) => {
      const find = String(r.config.find || "");
      if (!find) return;
      out = out.split(find).join(String(r.config.replace || ""));
    });
  return out;
}

function removeFirstPerson(text) {
  if (!ruleOn("noFirstPerson")) return text;
  let out = String(text);
  const words = activeRuleConfig("noFirstPerson", "words", ["من", "ما", "خودم", "خودمان", "اینجانب"]);
  (Array.isArray(words) ? words : []).forEach((word) => {
    const w = normalizePersian(word);
    if (!w) return;
    const re = new RegExp("(^|[\\s،؛:()«»\\-])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[\\s،؛:!؟.()«»\\-]|$)", "gu");
    out = out.replace(re, "$1");
  });
  return out.replace(/\s{2,}/g, " ").trim();
}

function transformReportText(text) {
  let out = normalizePersian(text, { keepPunctuation: true });
  out = removeFirstPerson(out);
  out = applyCustomStructural(out);
  if (ruleOn("persianDigits")) out = persianDigitsInText(out);
  return out.trim();
}

function futureToneTitle(title) {
  if (!ruleOn("futureTone")) return title;
  const suffix = activeRuleConfig("futureTone", "suffix", "انجام خواهد شد.") || "انجام خواهد شد.";
  const markers = /(خواهد شد|خواهد یافت|انجام می‌شود|انجام شود|برنامه‌ریزی شده|در برنامه)/;
  let out = title.replace(/[.،؛]+$/g, "").trim();
  if (!out) return out;
  if (markers.test(out)) return out;
  return out + " " + suffix;
}

function reportProject(task) {
  const project = normalizePersian(task.project || "");
  if (!project) return "";
  const fallback = normalizePersian(state.settings.defaultProject || "");
  if (fallback && project === fallback) return "";
  return project;
}

function reportDetails(task) {
  if (!ruleOn("rowStructure")) return [];
  const parts = [];
  if (task.status === "done") parts.push("تکمیل‌شده");
  if (task.progress != null && task.status !== "planned") {
    if (task.status === "doing") parts.push("پیشرفت " + reportPercent(task.progress));
    else if (task.status === "done") parts.push(reportPercent(task.progress));
    else parts.push(reportPercent(task.progress));
  }
  if (task.hours != null && Number(task.hours) > 0) {
    parts.push((task.status === "planned" ? "برآورد " : "") + reportHours(task.hours));
  }
  if (task.checklist && task.checklist.length) {
    const checked = task.checklist.filter((item) => item.done).length;
    parts.push("چک‌لیست: " + faDigits(checked) + " از " + faDigits(task.checklist.length));
  }
  const project = reportProject(task);
  if (project) parts.push("پروژه: " + transformReportText(project));
  return parts;
}

function makeReportLine(task, sectionKey) {
  let title = transformReportText(cleanTitle(task.title));
  if (sectionKey === "tomorrow") title = futureToneTitle(title);
  const details = reportDetails(task);
  let blocker = "";
  if (task.blocker) {
    blocker = transformReportText(task.blocker);
    if (task.nextStep && sectionKey === "blocked") {
      blocker += "؛ اقدام بعدی: " + transformReportText(task.nextStep);
    }
  } else if (sectionKey === "blocked") {
    blocker = "نیازمند بررسی و اقدام";
  }
  return {
    taskId: task.id,
    title: title || "بدون عنوان",
    details,
    blocker,
    status: task.status,
    date: task.date
  };
}

/* ------------------------------ گزارش کار اداری ------------------------- */

function fillReportPlaceholders(text, reportCtx) {
  const s = state.settings;
  const author = s.author.trim() || s.team.trim() || "این واحد";
  let out = String(text == null ? "" : text);
  out = out.replace(/\{تاریخ\}/g, reportCtx && reportCtx.dateLabel ? reportCtx.dateLabel : "");
  out = out.replace(/\{نویسنده\}/g, author);
  out = out.replace(/\{سمت\}/g, s.role.trim() || "کارشناس");
  out = out.replace(/\{تیم\}/g, s.team.trim() || "تیم");
  out = out.replace(/\{پروژه\}/g, s.defaultProject.trim() || "پروژه");
  return normalizePersian(out, { keepPunctuation: true }).replace(/\s{2,}/g, " ").trim();
}

function adminActivityDetails(task, grouped) {
  const parts = [];
  if (!grouped) parts.push(STATUS[task.status] ? STATUS[task.status].label : "");
  if (task.progress != null && task.status !== "planned") {
    parts.push(task.status === "doing" ? "پیشرفت " + reportPercent(task.progress) : reportPercent(task.progress));
  }
  if (task.hours != null && Number(task.hours) > 0) {
    parts.push((task.status === "planned" ? "برآورد " : "") + reportHours(task.hours));
  }
  if (task.checklist && task.checklist.length) {
    const checked = task.checklist.filter((item) => item.done).length;
    parts.push("چک‌لیست: " + faDigits(checked) + " از " + faDigits(task.checklist.length));
  }
  const project = reportProject(task);
  if (project) parts.push("پروژه: " + transformReportText(project));
  return parts.filter(Boolean);
}

function adminActivityItem(task, grouped) {
  const title = task.status === "planned"
    ? futureToneTitle(transformReportText(cleanTitle(task.title)))
    : transformReportText(cleanTitle(task.title));
  return {
    taskId: task.id,
    title: title || "بدون عنوان",
    details: adminActivityDetails(task, grouped),
    status: task.status
  };
}

function adminItemText(item) {
  const parts = [item.title].concat(item.details || []);
  if (item.blocker) parts.push("مانع: " + item.blocker);
  if (item.solution) parts.push("راهکار: " + item.solution);
  return parts.join(" — ");
}

function buildAdminSections(tasks, counts, reportCtx) {
  const sections = [];
  const grouped = ruleOn("activityGroups");

  const activitySection = { key: "activities", title: "شرح فعالیت‌ها", emoji: "🗂️", numbered: true };
  if (grouped) {
    const order = ["done", "doing", "blocked", "planned"];
    activitySection.groups = order.map((status) => ({
      key: status,
      title: STATUS[status].label,
      items: tasks.filter((task) => task.status === status).map((task) => adminActivityItem(task, true))
    })).filter((group) => group.items.length);
  } else {
    activitySection.items = tasks.map((task) => adminActivityItem(task, false));
  }
  if (tasks.length || !ruleOn("emptyFields")) sections.push(activitySection);

  if (ruleOn("resultsNumbers")) {
    const items = [];
    items.push({ title: "تعداد فعالیت‌های انجام‌شده: " + faDigits(counts.done) + " مورد" });
    if (counts.tasks > 0) {
      items.push({ title: "نرخ تکمیل فعالیت‌ها: " + reportPercent(Math.round((counts.done / counts.tasks) * 100)) });
    }
    if (counts.totalHours > 0) {
      items.push({ title: "جمع ساعت کار ثبت‌شده: " + reportHours(counts.totalHours) });
    }
    const doingWithProgress = tasks.filter((task) => task.status === "doing" && task.progress != null);
    if (doingWithProgress.length) {
      const avg = Math.round(doingWithProgress.reduce((sum, task) => sum + Number(task.progress), 0) / doingWithProgress.length);
      items.push({ title: "میانگین پیشرفت فعالیت‌های در حال انجام: " + reportPercent(avg) });
    }
    if (counts.blocked > 0) {
      items.push({ title: "تعداد موانع نیازمند اقدام: " + faDigits(counts.blocked) + " مورد" });
    }
    if (counts.planned > 0) {
      items.push({ title: "تعداد فعالیت‌های در برنامه‌ی آینده: " + faDigits(counts.planned) + " مورد" });
    }
    sections.push({ key: "results", title: "نتایج و دستاوردها", emoji: "📈", items, bullet: true });
  }

  const challenges = tasks.filter((task) => task.status === "blocked" || String(task.blocker || "").trim());
  if (challenges.length || !ruleOn("emptyFields")) {
    const items = challenges.map((task) => ({
      taskId: task.id,
      title: transformReportText(cleanTitle(task.title)),
      blocker: transformReportText(task.blocker) || "نیازمند بررسی و اقدام",
      solution: ruleOn("challengeSolutions") && String(task.nextStep || "").trim()
        ? transformReportText(cleanTitle(task.nextStep))
        : ""
    }));
    sections.push({ key: "challenges", title: "چالش‌ها و مشکلات", emoji: "⚠️", items, bullet: true });
  }

  const planItems = [];
  tasks.forEach((task) => {
    (task.futurePlans || []).forEach((plan) => {
      if (!cleanTitle(plan.text)) return;
      planItems.push({
        taskId: task.id,
        title: futureToneTitle(transformReportText(cleanTitle(plan.text))),
        details: plan.date ? ["تاریخ: " + jalaliLabel(parseJalaliInput(plan.date), false, true)] : []
      });
    });
  });
  if (planItems.length || !ruleOn("emptyFields")) {
    sections.push({ key: "future", title: "برنامه‌های آینده", emoji: "📌", items: planItems, bullet: true });
  }

  if (ruleOn("adminConclusion")) {
    const paragraphs = [];
    const custom = activeRuleConfig("adminConclusion", "text", "");
    if (String(custom || "").trim()) {
      paragraphs.push(fillReportPlaceholders(custom, reportCtx));
    } else {
      const parts = [];
      if (counts.tasks === 0) {
        parts.push("در این بازه فعالیتی ثبت نشده است.");
      } else {
        if (counts.done) parts.push(faDigits(counts.done) + " فعالیت به پایان رسید");
        if (counts.doing) parts.push(faDigits(counts.doing) + " فعالیت در حال انجام است");
        if (counts.blocked) parts.push(faDigits(counts.blocked) + " مانع نیازمند پیگیری است");
        if (counts.planned) parts.push(faDigits(counts.planned) + " فعالیت در برنامه‌ی آینده است");
        if (!parts.length) parts.push(faDigits(counts.tasks) + " فعالیت ثبت شده است");
        let sentence = parts.join("، ") + ".";
        if (counts.totalHours > 0) sentence += " جمع ساعت کار ثبت‌شده " + reportHours(counts.totalHours) + " است.";
        paragraphs.push(sentence);
      }
    }
    const suggestion = activeRuleConfig("adminConclusion", "suggestion", "");
    if (String(suggestion || "").trim()) paragraphs.push(fillReportPlaceholders(suggestion, reportCtx));
    if (paragraphs.length || !ruleOn("emptyFields")) {
      sections.push({ key: "conclusion", title: "جمع‌بندی و پیشنهادها", emoji: "🧭", paragraphs });
    }
  }

  return sections;
}

function buildReportData() {
  const tasks = state.tasks.filter((task) => cleanTitle(task.title));
  const jdate = todayJalali();
  const dateLabel = jalaliLabel(jdate, true, true);
  const template = ["daily", "brief", "admin"].includes(state.settings.template) ? state.settings.template : "daily";
  const titlePrefix = template === "brief" ? "خلاصه‌ی گزارش روزانه" : template === "admin" ? "گزارش کار اداری" : "گزارش روزانه";
  const title = titlePrefix + " — " + dateLabel;
  const metaParts = [];
  if (state.settings.author.trim()) metaParts.push({ label: "نویسنده", value: normalizePersian(state.settings.author), strong: true });
  if (state.settings.role.trim()) metaParts.push({ label: "سمت", value: normalizePersian(state.settings.role) });
  if (state.settings.team.trim()) metaParts.push({ label: "تیم", value: normalizePersian(state.settings.team) });
  if (state.settings.defaultProject.trim()) metaParts.push({ label: "پروژه", value: normalizePersian(state.settings.defaultProject), strong: true });
  const currentProject = state.projects.find((project) => project.name === state.settings.defaultProject.trim());
  if (currentProject && (currentProject.startDate || currentProject.endDate)) {
    metaParts.push({ label: "بازه‌ی پروژه", value: projectRangeLabel(currentProject) });
  }
  const metaText = metaParts.map((p) => p.label + ": " + p.value).join(" | ");

  const done = [];
  const doing = [];
  const blocked = [];
  const tomorrow = [];
  const tomorrowExtras = [];
  const planExtras = [];
  const warnings = [];
  const dupes = duplicateMap();
  let totalHours = 0;

  tasks.forEach((task) => {
    totalHours += Number(task.hours) || 0;
    const w = taskWarnings(task, dupes);
    if (w.length) warnings.push({ taskId: task.id, messages: w });

    if (task.status === "done") done.push(task);
    else if (task.status === "planned") tomorrow.push(task);
    else if (task.status === "blocked") {
      if (ruleOn("blockersSection")) blocked.push(task);
      else doing.push(task);
    } else if (task.blocker && ruleOn("blockersSection")) {
      blocked.push(task);
    } else {
      doing.push(task);
    }

    if (task.status !== "planned" && task.status !== "blocked" && task.nextStep && cleanTitle(task.nextStep)) {
      tomorrowExtras.push({
        text: transformReportText(cleanTitle(task.nextStep)),
        taskId: task.id
      });
    }
    (task.futurePlans || []).forEach((plan) => {
      if (!cleanTitle(plan.text)) return;
      planExtras.push({
        text: transformReportText(cleanTitle(plan.text)),
        date: plan.date || "",
        taskId: task.id
      });
    });
  });

  if (template === "admin") {
    const challengeTasks = tasks.filter((task) => task.status === "blocked" || String(task.blocker || "").trim());
    const counts = {
      done: tasks.filter((task) => task.status === "done").length,
      doing: tasks.filter((task) => task.status === "doing").length,
      blocked: challengeTasks.length,
      planned: tasks.filter((task) => task.status === "planned").length,
      totalHours,
      tasks: tasks.length
    };
    const reportCtx = { dateLabel };
    const intro = ruleOn("adminIntro")
      ? fillReportPlaceholders(activeRuleConfig("adminIntro", "text", ""), reportCtx)
      : "";
    const sections = buildAdminSections(tasks, counts, reportCtx);
    const report = {
      template,
      title,
      dateLabel,
      jdate,
      metaParts,
      metaText,
      intro,
      sections,
      counts,
      warnings,
      totalHours,
      empty: tasks.length === 0
    };
    report.text = reportToPlainText(report);
    report.markdown = reportToMarkdown(report);
    return report;
  }

  const sections = [];
  const sectionDefs = [
    { key: "done", title: "انجام‌شده", emoji: "✅", tasks: done },
    { key: "doing", title: "در حال انجام", emoji: "🔄", tasks: doing },
    {
      key: "blocked",
      title: activeRuleConfig("blockersSection", "title", "موانع و نیازمند اقدام") || "موانع و نیازمند اقدام",
      emoji: "⛔",
      tasks: blocked
    },
    { key: "tomorrow", title: "برنامه‌ی فردا", emoji: "📌", tasks: tomorrow }
  ];

  sectionDefs.forEach((def) => {
    if (def.key === "blocked" && !ruleOn("blockersSection")) return;
    const items = def.tasks.map((task) => makeReportLine(task, def.key));
    if (def.key === "tomorrow") {
      const seen = new Set(tomorrow.map((t) => cleanTitle(t.title)));
      tomorrowExtras.forEach((extra) => {
        const key = cleanTitle(extra.text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        items.push({
          taskId: extra.taskId,
          title: futureToneTitle(extra.text),
          details: [],
          blocker: "",
          status: "planned",
          extra: true
        });
      });
      planExtras.forEach((extra) => {
        const key = cleanTitle(extra.text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        items.push({
          taskId: extra.taskId,
          title: futureToneTitle(extra.text),
          details: extra.date ? ["تاریخ: " + jalaliLabel(parseJalaliInput(extra.date), false, true)] : [],
          blocker: "",
          status: "planned",
          extra: true
        });
      });
    }
    if (items.length || !ruleOn("emptyFields")) {
      sections.push({ key: def.key, title: def.title, emoji: def.emoji, items });
    }
  });

  const counts = {
    done: done.length,
    doing: doing.length,
    blocked: blocked.length,
    planned: tomorrow.length,
    totalHours,
    tasks: tasks.length
  };

  const report = {
    template,
    title,
    dateLabel,
    jdate,
    metaParts,
    metaText,
    sections,
    counts,
    warnings,
    totalHours,
    empty: tasks.length === 0
  };
  report.text = reportToPlainText(report);
  report.markdown = reportToMarkdown(report);
  return report;
}

function flattenReportItems(report) {
  const items = [];
  let n = 0;
  report.sections.forEach((section) => {
    section.items.forEach((item) => {
      n += 1;
      items.push({ number: n, section, item });
    });
  });
  return items;
}

function reportToPlainText(report) {
  if (report.template === "brief") return reportBriefPlain(report);
  if (report.template === "admin") return reportAdminPlain(report);
  let out = report.title + "\n";
  if (report.metaText) out += report.metaText + "\n";
  let n = 0;
  report.sections.forEach((section) => {
    out += "\n" + section.emoji + " " + section.title + "\n";
    if (!section.items.length) {
      out += "موردی ثبت نشده است.\n";
      return;
    }
    section.items.forEach((item) => {
      n += 1;
      const parts = [item.title].concat(item.details || []);
      if (item.blocker) parts.push("مانع: " + item.blocker);
      out += faDigits(n) + ". " + parts.join(" — ") + "\n";
    });
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function reportToMarkdown(report) {
  if (report.template === "brief") return reportBriefMarkdown(report);
  if (report.template === "admin") return reportAdminMarkdown(report);
  let out = "## " + report.title + "\n\n";
  if (report.metaParts.length) {
    out += report.metaParts.map((p) => "**" + p.label + ":** " + p.value).join(" | ") + "\n";
  }
  let n = 0;
  report.sections.forEach((section) => {
    out += "\n### " + section.emoji + " " + section.title + "\n\n";
    if (!section.items.length) {
      out += "موردی ثبت نشده است.\n";
      return;
    }
    section.items.forEach((item) => {
      n += 1;
      const parts = [item.title].concat(item.details || []);
      if (item.blocker) parts.push("**مانع:** " + item.blocker);
      out += faDigits(n) + ". " + parts.join(" — ") + "\n";
    });
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function briefCountText(count, hours) {
  const parts = [faDigits(count) + " مورد"];
  if (hours > 0) parts.push(reportHours(hours));
  return parts.join(" — ");
}

function reportBriefPlain(report) {
  const c = report.counts;
  const doneHours = report.counts ? state.tasks.filter((t) => t.status === "done").reduce((s, t) => s + (Number(t.hours) || 0), 0) : 0;
  const doingHours = state.tasks.filter((t) => t.status === "doing").reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const tomorrowTitles = report.sections.find((s) => s.key === "tomorrow");
  const tomorrowText = tomorrowTitles && tomorrowTitles.items.length
    ? tomorrowTitles.items.map((i) => i.title).join("؛ ")
    : "برنامه‌ای ثبت نشده است.";
  let out = report.title + "\n";
  if (report.metaText) out += report.metaText + "\n";
  out += "\n";
  out += "انجام‌شده: " + briefCountText(c.done, doneHours) + "\n";
  out += "در حال انجام: " + briefCountText(c.doing, doingHours) + "\n";
  out += "موانع: " + (c.blocked ? faDigits(c.blocked) + " مورد نیازمند اقدام" : "موردی ثبت نشده است.") + "\n";
  out += "برنامه‌ی فردا: " + tomorrowText + "\n";
  return out.trim();
}

function reportBriefMarkdown(report) {
  const c = report.counts;
  const doneHours = state.tasks.filter((t) => t.status === "done").reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const doingHours = state.tasks.filter((t) => t.status === "doing").reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const tomorrowTitles = report.sections.find((s) => s.key === "tomorrow");
  const tomorrowText = tomorrowTitles && tomorrowTitles.items.length
    ? tomorrowTitles.items.map((i) => i.title).join("؛ ")
    : "برنامه‌ای ثبت نشده است.";
  let out = "## " + report.title + "\n\n";
  if (report.metaParts.length) {
    out += report.metaParts.map((p) => "**" + p.label + ":** " + p.value).join(" | ") + "\n\n";
  }
  out += "- **انجام‌شده:** " + briefCountText(c.done, doneHours) + "\n";
  out += "- **در حال انجام:** " + briefCountText(c.doing, doingHours) + "\n";
  out += "- **موانع:** " + (c.blocked ? faDigits(c.blocked) + " مورد نیازمند اقدام" : "موردی ثبت نشده است.") + "\n";
  out += "- **برنامه‌ی فردا:** " + tomorrowText + "\n";
  return out.trim();
}

function reportAdminPlain(report) {
  let out = report.title + "\n";
  if (report.metaText) out += report.metaText + "\n";
  if (report.intro) out += "\n" + report.intro + "\n";
  let n = 0;
  report.sections.forEach((section) => {
    out += "\n" + section.emoji + " " + section.title + "\n";
    if (section.paragraphs) {
      if (!section.paragraphs.length) out += "موردی ثبت نشده است.\n";
      else section.paragraphs.forEach((paragraph) => { out += paragraph + "\n"; });
      return;
    }
    let wrote = false;
    const writeItems = (items, bullet) => {
      items.forEach((item) => {
        wrote = true;
        if (bullet) {
          out += "• " + adminItemText(item) + "\n";
        } else {
          n += 1;
          out += faDigits(n) + ". " + adminItemText(item) + "\n";
        }
      });
    };
    if (section.groups) {
      section.groups.forEach((group) => {
        out += "— " + group.title + "\n";
        writeItems(group.items, false);
      });
    }
    if (section.items) writeItems(section.items, section.bullet === true);
    if (!wrote) out += "موردی ثبت نشده است.\n";
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function reportAdminMarkdown(report) {
  let out = "## " + report.title + "\n\n";
  if (report.metaParts.length) {
    out += report.metaParts.map((p) => "**" + p.label + ":** " + p.value).join(" | ") + "\n";
  }
  if (report.intro) out += "\n" + report.intro + "\n";
  let n = 0;
  report.sections.forEach((section) => {
    out += "\n### " + section.emoji + " " + section.title + "\n\n";
    if (section.paragraphs) {
      if (!section.paragraphs.length) out += "موردی ثبت نشده است.\n";
      else section.paragraphs.forEach((paragraph) => { out += paragraph + "\n\n"; });
      return;
    }
    let wrote = false;
    const writeItems = (items, bullet) => {
      items.forEach((item) => {
        wrote = true;
        if (bullet) out += "- " + adminItemText(item) + "\n";
        else {
          n += 1;
          out += faDigits(n) + ". " + adminItemText(item) + "\n";
        }
      });
    };
    if (section.groups) {
      section.groups.forEach((group, index) => {
        if (index > 0) out += "\n";
        out += "**" + group.title + "**\n\n";
        writeItems(group.items, false);
      });
    }
    if (section.items) writeItems(section.items, section.bullet === true);
    if (!wrote) out += "موردی ثبت نشده است.\n";
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function reportHeadHTML(report) {
  return `<div class="report-head">
    <h2 class="report-title">${escapeHtml(report.title)}</h2>
    ${report.metaParts.length ? `<div class="report-meta">${reportMetaHTML(report)}</div>` : ""}
  </div>`;
}

function adminItemHTML(item, label) {
  const detail = (item.details || []).length
    ? `<span class="detail"><span class="dash">—</span>${escapeHtml(item.details.join(" — "))}</span>`
    : "";
  const blocker = item.blocker
    ? `<span class="detail blocker"><span class="dash">—</span>مانع: ${escapeHtml(item.blocker)}</span>`
    : "";
  const solution = item.solution
    ? `<span class="detail solution"><span class="dash">—</span>راهکار: ${escapeHtml(item.solution)}</span>`
    : "";
  return `<div class="report-item">
    <span class="n">${label}</span>
    <span class="txt${item.status === "planned" ? " future" : ""}">${escapeHtml(item.title)}${detail}${blocker}${solution}</span>
  </div>`;
}

function renderAdminReportHTML(report) {
  let html = reportHeadHTML(report);
  if (report.intro) html += `<p class="report-intro">${escapeHtml(report.intro)}</p>`;
  let n = 0;
  report.sections.forEach((section) => {
    html += `<section class="report-section">
      <h3><span class="emoji">${section.emoji}</span><span>${escapeHtml(section.title)}</span></h3>`;
    if (section.paragraphs) {
      if (!section.paragraphs.length) html += `<div class="report-empty">موردی ثبت نشده است.</div>`;
      else section.paragraphs.forEach((paragraph) => { html += `<p class="report-paragraph">${escapeHtml(paragraph)}</p>`; });
      html += `</section>`;
      return;
    }
    let wrote = false;
    const listHTML = (items, bullet) => {
      if (!items.length) return "";
      wrote = true;
      const rows = items.map((item) => {
        const label = bullet ? "•" : (n += 1, faDigits(n) + ".");
        return adminItemHTML(item, label);
      }).join("");
      return `<div class="report-list">${rows}</div>`;
    };
    if (section.groups) {
      section.groups.forEach((group) => {
        html += `<h4 class="report-group-title">${escapeHtml(group.title)}</h4>`;
        html += listHTML(group.items, false);
      });
    }
    if (section.items) html += listHTML(section.items, section.bullet === true);
    if (!wrote) html += `<div class="report-empty">موردی ثبت نشده است.</div>`;
    html += `</section>`;
  });
  return html;
}

function reportMetaHTML(report) {
  if (!report.metaParts.length) return "";
  return report.metaParts.map((p, i) =>
    `${i > 0 ? '<span class="sep"></span>' : ""}<span>${p.strong ? `<b>${escapeHtml(p.label)}:</b>` : escapeHtml(p.label) + ":"} ${escapeHtml(p.value)}</span>`
  ).join("");
}

function renderReportHTML(report) {
  if (report.template === "admin") return renderAdminReportHTML(report);
  let html = `<div class="report-head">
    <h2 class="report-title">${escapeHtml(report.title)}</h2>
    ${report.metaParts.length ? `<div class="report-meta">${reportMetaHTML(report)}</div>` : ""}
  </div>`;

  if (report.template === "brief") {
    const c = report.counts;
    const doneHours = state.tasks.filter((t) => t.status === "done").reduce((s, t) => s + (Number(t.hours) || 0), 0);
    const doingHours = state.tasks.filter((t) => t.status === "doing").reduce((s, t) => s + (Number(t.hours) || 0), 0);
    const tomorrowSection = report.sections.find((s) => s.key === "tomorrow");
    const tomorrowText = tomorrowSection && tomorrowSection.items.length
      ? tomorrowSection.items.map((i) => i.title).join("؛ ")
      : "برنامه‌ای ثبت نشده است.";
    html += `<div class="brief-grid">
      <div class="brief-row"><span class="brief-label">انجام‌شده</span><span class="brief-value">${faDigits(c.done)} مورد <small>${doneHours > 0 ? reportHours(doneHours) : ""}</small></span></div>
      <div class="brief-row"><span class="brief-label">در حال انجام</span><span class="brief-value">${faDigits(c.doing)} مورد <small>${doingHours > 0 ? reportHours(doingHours) : ""}</small></span></div>
      <div class="brief-row"><span class="brief-label">موانع</span><span class="brief-value">${c.blocked ? faDigits(c.blocked) + " مورد نیازمند اقدام" : "موردی ثبت نشده است."}</span></div>
      <div class="brief-row"><span class="brief-label">برنامه‌ی فردا</span><span class="brief-value">${escapeHtml(tomorrowText)}</span></div>
    </div>`;
    return html;
  }

  let n = 0;
  report.sections.forEach((section) => {
    html += `<section class="report-section">
      <h3><span class="emoji">${section.emoji}</span><span>${escapeHtml(section.title)}</span></h3>`;
    if (!section.items.length) {
      html += `<div class="report-empty">موردی ثبت نشده است.</div>`;
    } else {
      html += `<div class="report-list">`;
      section.items.forEach((item) => {
        n += 1;
        const detail = (item.details || []).length
          ? `<span class="detail"><span class="dash">—</span>${escapeHtml(item.details.join(" — "))}</span>`
          : "";
        const blocker = item.blocker
          ? `<span class="detail blocker"><span class="dash">—</span>مانع: ${escapeHtml(item.blocker)}</span>`
          : "";
        html += `<div class="report-item">
          <span class="n">${faDigits(n)}.</span>
          <span class="txt${item.status === "planned" && !item.extra ? " future" : ""}">${escapeHtml(item.title)}${detail}${blocker}</span>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</section>`;
  });
  return html;
}

function getReport() {
  return buildReportData();
}

function hasReportableTasks() {
  return state.tasks.some((task) => cleanTitle(task.title));
}

function renderPreview() {
  const empty = $("#preview-empty");
  const layout = $("#preview-layout");
  const content = $("#report-content");
  if (!empty || !layout || !content) return;

  const report = getReport();
  state.lastReport = report;

  if (!hasReportableTasks()) {
    empty.hidden = false;
    layout.hidden = true;
    content.innerHTML = "";
    return;
  }
  empty.hidden = true;
  layout.hidden = false;

  const templateSelect = $("#preview-template");
  if (templateSelect) templateSelect.value = report.template;
  const settingsTemplate = $("#set-template");
  if (settingsTemplate) settingsTemplate.value = report.template;
  const author = $("#preview-author");
  if (author) author.textContent = state.settings.author.trim() || "—";
  const role = $("#preview-role");
  if (role) role.textContent = state.settings.role.trim() || "—";
  const team = $("#preview-team");
  if (team) team.textContent = state.settings.team.trim() || "—";
  const project = $("#preview-project");
  if (project) project.textContent = state.settings.defaultProject.trim() || "—";
  const meta = $("#paper-meta");
  if (meta) meta.textContent = "تاریخ گزارش: " + report.dateLabel;

  content.innerHTML = renderReportHTML(report);
  const paper = $("#report-paper");
  if (paper) paper.classList.toggle("is-brief", report.template === "brief");

  const statusEl = $("#preview-status");
  const statusText = $("#preview-status-text");
  const countsEl = $("#preview-counts");
  const overCapacity = report.totalHours > Number(state.settings.dailyCapacity || 8);
  const needsAttention = report.warnings.length > 0 || report.counts.blocked > 0 || overCapacity;
  if (statusEl) statusEl.classList.toggle("has-warning", needsAttention);
  if (statusText) {
    if (needsAttention) {
      statusText.textContent = overCapacity
        ? "چند مورد نیاز به توجه دارد؛ جمع ساعت هم از ظرفیت روزانه بیشتر است. با این حال می‌توانی خروجی بگیری."
        : "چند مورد نیاز به توجه دارد، ولی می‌توانی خروجی بگیری.";
    } else {
      statusText.textContent = "گزارش آماده شد؛ فقط کپی کن و بفرست.";
    }
  }
  if (countsEl) {
    countsEl.innerHTML = `
      <span>${faDigits(report.counts.done)} انجام‌شده</span>
      <span>${faDigits(report.counts.doing)} در حال انجام</span>
      <span>${faDigits(report.counts.blocked)} مانع</span>
      <span>${report.totalHours > 0 ? reportHours(report.totalHours) : "بدون ساعت"}</span>`;
  }
}

/* ------------------------------ کپی و دانلود ---------------------------- */

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* سراغ روش جایگزین می‌رویم */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

async function copyReport(markdown = false) {
  if (!hasReportableTasks()) {
    toast("هنوز گزارشی برای کپی نیست.", { type: "info" });
    return;
  }
  const report = getReport();
  const text = markdown ? report.markdown : report.text;
  const ok = await copyToClipboard(text);
  if (ok) toast(markdown ? "نسخه‌ی نشانه‌گذاری‌شده کپی شد." : "متن گزارش کپی شد؛ فقط بفرست.", { type: "success" });
  else toast("کپی خودکار ممکن نشد. متن را از پیش‌نمایش انتخاب و دستی کپی کن.", { type: "error" });
}

function reportFileBase() {
  const j = todayJalali();
  const prefix = state.settings.template === "admin"
    ? "گزارش-کار-اداری"
    : state.settings.template === "brief"
      ? "خلاصه-گزارش"
      : "گزارش-روزانه";
  return prefix + "-" + j.jy + "-" + String(j.jm).padStart(2, "0") + "-" + String(j.jd).padStart(2, "0");
}

function downloadReport(format) {
  if (!hasReportableTasks()) {
    toast("هنوز گزارشی برای دانلود نیست.", { type: "info" });
    return;
  }
  const report = getReport();
  if (format === "md") {
    downloadText(report.markdown, reportFileBase() + ".md", "text/markdown;charset=utf-8");
    toast("نسخه‌ی نشانه‌گذاری‌شده دانلود شد.", { type: "success" });
  } else {
    downloadText(report.text, reportFileBase() + ".txt", "text/plain;charset=utf-8");
    toast("فایل متنی گزارش دانلود شد.", { type: "success" });
  }
}

function csvCell(value) {
  let s = String(value == null ? "" : value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function downloadReportCsv() {
  if (!state.tasks.length) {
    toast("تسکی برای خروجی جدولی وجود ندارد.", { type: "info" });
    return;
  }
  const headers = ["ردیف", "عنوان", "وضعیت", "دسته‌بندی", "درصد پیشرفت", "ساعت", "پروژه", "مسئول", "مانع", "گام بعدی", "تاریخ", "منبع"];
  const rows = state.tasks.map((task, index) => [
    faDigits(index + 1),
    cleanTitle(task.title),
    STATUS[task.status] ? STATUS[task.status].label : "",
    normalizePersian(task.category),
    task.progress != null ? reportPercent(task.progress) : "",
    task.hours != null ? reportHours(task.hours) : "",
    normalizePersian(task.project),
    normalizePersian(task.owner),
    normalizePersian(task.blocker, { keepPunctuation: true }),
    normalizePersian(task.nextStep, { keepPunctuation: true }),
    task.date ? jalaliDisplayFromISO(task.date) : "",
    SOURCE_LABEL[task.source] || ""
  ]);
  const content = "\uFEFF" + [headers].concat(rows).map((row) => row.map(csvCell).join(";")).join("\r\n");
  downloadText(content, reportFileBase() + ".csv", "text/csv;charset=utf-8");
  toast("خروجی جدولی آماده شد؛ با اکسل بازش کن.", { type: "success" });
}

/* ------------------------------ اشتراک و رایانامه ----------------------- */

function openMessengerModal(report) {
  const text = report.text;
  const telegram = "https://t.me/share/url?url=" + encodeURIComponent("") + "&text=" + encodeURIComponent(text);
  const whatsapp = "https://wa.me/?text=" + encodeURIComponent(text);
  const mail = "mailto:?subject=" + encodeURIComponent(report.title) + "&body=" + encodeURIComponent(text);
  openModal({
    title: "اشتراک سریع گزارش",
    sub: "یک پیام‌رسان را انتخاب کن یا متن را کپی کن.",
    iconName: "send",
    size: "modal-sm",
    body: `
      <div class="action-stack">
        <button class="btn" type="button" data-share-copy>${icon("copy")} کپی متن گزارش</button>
        <button class="btn" type="button" data-share-telegram>${icon("send")} ارسال در تلگرام</button>
        <button class="btn" type="button" data-share-whatsapp>${icon("send")} ارسال در واتس‌اپ</button>
        <button class="btn" type="button" data-share-email>${icon("mail")} ارسال با رایانامه</button>
      </div>
      <p class="field-hint" style="margin-top:11px">پیام‌رسان‌ها در مرورگر باز می‌شوند و متن گزارش از پیش پر می‌شود. اگر باز نشدند، متن کپی‌شده را همان‌جا بچسبان.</p>`,
    footer: `<button class="btn" type="button" data-modal-close>بستن</button>`,
    onMount: (layer) => {
      layer.querySelector("[data-share-copy]").addEventListener("click", async () => {
        const ok = await copyToClipboard(text);
        toast(ok ? "متن گزارش کپی شد." : "کپی ممکن نشد؛ متن را دستی انتخاب کن.", { type: ok ? "success" : "error" });
      });
      layer.querySelector("[data-share-telegram]").addEventListener("click", () => window.open(telegram, "_blank", "noopener"));
      layer.querySelector("[data-share-whatsapp]").addEventListener("click", () => window.open(whatsapp, "_blank", "noopener"));
      layer.querySelector("[data-share-email]").addEventListener("click", () => { window.location.href = mail; });
    }
  });
}

async function shareReport() {
  if (!hasReportableTasks()) {
    toast("هنوز گزارشی برای اشتراک‌گذاری نیست.", { type: "info" });
    return;
  }
  const report = getReport();
  if (navigator.share) {
    try {
      await navigator.share({ title: report.title, text: report.text });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  const ok = await copyToClipboard(report.text);
  downloadText(report.text, reportFileBase() + ".txt", "text/plain;charset=utf-8");
  toast(
    ok
      ? "اشتراک‌گذاری سیستمی در این مرورگر نبود؛ متن کپی و فایل دانلود شد."
      : "اشتراک‌گذاری سیستمی در این مرورگر نبود؛ فایل دانلود شد. متن را دستی کپی کن.",
    { type: "info", duration: 6500, action: "گزینه‌های دیگر", onAction: () => openMessengerModal(report) }
  );
}

function openEmail(report) {
  const mail = "mailto:?subject=" + encodeURIComponent(report.title) + "&body=" + encodeURIComponent(report.text);
  window.location.href = mail;
}

function printReport() {
  if (!hasReportableTasks()) {
    toast("هنوز گزارشی برای چاپ نیست.", { type: "info" });
    return;
  }
  switchTab("preview", { scroll: false });
  renderPreview();
  setTimeout(() => window.print(), 150);
}

/* ------------------------------ پیوند رویدادها -------------------------- */

function bindReportEvents() {
  const pairs = [
    ["#btn-copy-plain", () => copyReport(false)],
    ["#btn-copy-plain-2", () => copyReport(false)],
    ["#btn-copy-markdown", () => copyReport(true)],
    ["#btn-download-txt", () => downloadReport("txt")],
    ["#btn-download-md", () => downloadReport("md")],
    ["#btn-download-csv", downloadReportCsv],
    ["#btn-share", shareReport],
    ["#btn-messengers", () => {
      if (!hasReportableTasks()) { toast("هنوز گزارشی برای اشتراک‌گذاری نیست.", { type: "info" }); return; }
      openMessengerModal(getReport());
    }],
    ["#btn-email", () => {
      if (!hasReportableTasks()) { toast("هنوز گزارشی برای ارسال نیست.", { type: "info" }); return; }
      openEmail(getReport());
    }],
    ["#btn-print", printReport],
    ["#btn-print-2", printReport],
    ["#btn-save-history", () => { if (typeof saveHistory === "function") saveHistory(false); }]
  ];
  pairs.forEach(([selector, fn]) => {
    const el = $(selector);
    if (el) el.addEventListener("click", fn);
  });

  const template = $("#preview-template");
  if (template) {
    template.addEventListener("change", () => {
      state.settings.template = ["brief", "admin", "daily"].includes(template.value) ? template.value : "daily";
      const settingsTemplate = $("#set-template");
      if (settingsTemplate) settingsTemplate.value = state.settings.template;
      renderPreview();
      scheduleSave();
    });
  }

  const generate = $("#btn-generate");
  if (generate) {
    generate.addEventListener("click", () => {
      if (!hasReportableTasks()) {
        toast("اول حداقل یک تسک با عنوان بنویس.", { type: "info" });
        switchTab("tasks");
        const quick = $("#quick-input");
        if (quick) quick.focus();
        return;
      }
      switchTab("preview");
      renderPreview();
      if (typeof saveHistory === "function") saveHistory(true);
      const report = getReport();
      const over = report.totalHours > Number(state.settings.dailyCapacity || 8);
      if (report.warnings.length || report.counts.blocked || over) {
        toast("گزارش ساخته شد؛ چند مورد نیاز به توجه دارد، ولی آماده‌ی ارسال است.", { type: "info", duration: 5000 });
      } else {
        toast("گزارش آماده شد؛ فقط کپی کن و بفرست.", { type: "success" });
      }
    });
  }
}
