/* ==========================================================================
   ورود فایل: اکسل، جدول متنی و نمونه‌سازی
   ========================================================================== */

const HEADER_SYNONYMS = {
  title: ["عنوان", "عنوان تسک", "تسک", "وظیفه", "فعالیت", "شرح", "شرح کار", "موضوع", "کار", "title", "task", "subject"],
  status: ["وضعیت", "وضعیت انجام", "وضعیت کار", "status", "state"],
  category: ["دسته", "دسته‌بندی", "دسته بندی", "نوع", "دسته کار", "category", "type"],
  progress: ["درصد", "درصد پیشرفت", "پیشرفت", "میزان پیشرفت", "progress", "percent"],
  hours: ["ساعت", "ساعت کار", "زمان", "مدت", "ساعت صرف‌شده", "hours", "time", "duration"],
  project: ["پروژه", "پروژه‌ی", "نام پروژه", "project"],
  owner: ["مسئول", "مسئول کار", "مالک", "مجری", "assignee", "owner", "responsible"],
  blocker: ["مانع", "موانع", "مشکل", "بلاکر", "issue", "blocker", "obstacle"],
  next: ["گام بعدی", "اقدام بعدی", "برنامه فردا", "برنامه‌ی فردا", "بعدی", "next", "next step", "next action"],
  date: ["تاریخ", "تاریخ انجام", "روز", "date"]
};

const IMPORT_FIELDS = [
  ["title", "عنوان تسک", true],
  ["status", "وضعیت", false],
  ["category", "دسته‌بندی", false],
  ["progress", "درصد پیشرفت", false],
  ["hours", "ساعت", false],
  ["project", "پروژه", false],
  ["owner", "مسئول", false],
  ["blocker", "مانع", false],
  ["next", "گام بعدی", false],
  ["date", "تاریخ", false]
];

const utf8Decoder = new TextDecoder("utf-8");
const utf8Encoder = new TextEncoder();

function readFileBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsArrayBuffer(file);
  });
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsText(file, "utf-8");
  });
}

/* ------------------------------ فایل زیپ -------------------------------- */

async function unzipEntries(buffer) {
  const view = new DataView(buffer);
  const length = buffer.byteLength;
  let eocd = -1;
  const minPos = Math.max(0, length - 65557);
  for (let i = length - 22; i >= minPos; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip");
  const total = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (cdOffset <= 0 || cdOffset >= length) throw new Error("zip");
  let ptr = cdOffset;
  const entries = new Map();
  for (let n = 0; n < total; n += 1) {
    if (ptr + 46 > length || view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const uncompSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    if (ptr + 46 + nameLen > length) break;
    const name = utf8Decoder.decode(new Uint8Array(buffer, ptr + 46, nameLen));
    if (localOffset + 30 > length) break;
    if (view.getUint32(localOffset, true) !== 0x04034b50) break;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compSize > length) break;
    entries.set(name, {
      method,
      compressed: new Uint8Array(buffer, dataStart, compSize),
      size: uncompSize
    });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function decompressEntry(entry) {
  if (!entry) throw new Error("zip-entry");
  if (entry.method === 0) {
    return entry.compressed.slice().buffer;
  }
  if (entry.method === 8) {
    if (typeof DecompressionStream === "undefined") throw new Error("deflate");
    const stream = new Blob([entry.compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).arrayBuffer();
  }
  throw new Error("zip-method");
}

async function entryText(entries, name) {
  const entry = entries.get(name);
  if (!entry) return "";
  const buffer = await decompressEntry(entry);
  return utf8Decoder.decode(buffer);
}

function xmlDoc(text) {
  if (!text) return null;
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("xml");
  return doc;
}

function xmlTextNodes(root, tag) {
  return Array.from(root.getElementsByTagName(tag)).map((el) => el.textContent || "");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = xmlDoc(xml);
  if (!doc) return [];
  return Array.from(doc.getElementsByTagName("si")).map((si) => {
    const clone = si.cloneNode(true);
    Array.from(clone.getElementsByTagName("rPh")).forEach((el) => el.remove());
    return clone.textContent || "";
  });
}

function columnIndexFromRef(ref) {
  const letters = String(ref || "").replace(/[^A-Z]/gi, "").toUpperCase();
  let n = 0;
  for (let i = 0; i < letters.length; i += 1) n = n * 26 + (letters.charCodeAt(i) - 64);
  return Math.max(0, n - 1);
}

function parseSheetXml(xml, sharedStrings) {
  if (!xml) return [];
  const doc = xmlDoc(xml);
  if (!doc) return [];
  const rows = [];
  const rowElements = Array.from(doc.getElementsByTagName("row"));
  rowElements.forEach((rowEl) => {
    const row = [];
    let fallbackIndex = 0;
    const cells = Array.from(rowEl.getElementsByTagName("c"));
    cells.forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const colIndex = ref ? columnIndexFromRef(ref) : fallbackIndex;
      fallbackIndex = colIndex + 1;
      const type = cell.getAttribute("t") || "";
      let value = "";
      if (type === "inlineStr") {
        const is = cell.getElementsByTagName("is")[0];
        value = is ? is.textContent || "" : "";
      } else {
        const v = cell.getElementsByTagName("v")[0];
        const vText = v ? v.textContent || "" : "";
        if (type === "s") {
          const idx = Number(vText);
          value = Number.isFinite(idx) ? (sharedStrings[idx] || "") : "";
        } else if (type === "b") {
          value = vText === "1" ? "بله" : "خیر";
        } else if (type === "e") {
          value = "";
        } else {
          value = vText;
        }
      }
      row[colIndex] = String(value).trim();
    });
    if (row.some((cell) => String(cell || "").trim() !== "")) rows.push(row);
  });
  return rows;
}

async function parseXlsx(buffer) {
  const entries = await unzipEntries(buffer);
  const workbookXml = await entryText(entries, "xl/workbook.xml");
  if (!workbookXml) throw new Error("workbook");
  const workbookDoc = xmlDoc(workbookXml);
  const relsXml = await entryText(entries, "xl/_rels/workbook.xml.rels");
  const relsDoc = relsXml ? xmlDoc(relsXml) : null;
  const relMap = new Map();
  if (relsDoc) {
    Array.from(relsDoc.getElementsByTagName("Relationship")).forEach((rel) => {
      relMap.set(rel.getAttribute("Id"), rel.getAttribute("Target"));
    });
  }
  const sharedXml = await entryText(entries, "xl/sharedStrings.xml");
  const sharedStrings = parseSharedStrings(sharedXml);
  const sheetEls = Array.from(workbookDoc.getElementsByTagName("sheet"));
  const sheets = [];

  for (let i = 0; i < sheetEls.length; i += 1) {
    const el = sheetEls[i];
    const name = el.getAttribute("name") || ("برگ " + faDigits(i + 1));
    const relId = el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
      || el.getAttribute("r:id")
      || el.getAttribute("id");
    let target = relId ? relMap.get(relId) : "";
    if (!target) target = "worksheets/sheet" + (i + 1) + ".xml";
    let path = target.replace(/\\/g, "/");
    if (path.startsWith("/")) path = path.slice(1);
    else if (!path.startsWith("xl/")) path = "xl/" + path;
    const xml = await entryText(entries, path);
    const rows = parseSheetXml(xml, sharedStrings);
    sheets.push({ name, rows });
  }
  return sheets;
}

/* ------------------------------ جدول متنی ------------------------------- */

function parseDelimitedRows(text) {
  let input = String(text || "").replace(/^\uFEFF/, "");
  if (!input.trim()) return [];
  const firstLines = input.split(/\r?\n/).slice(0, 8).join("\n");
  const counts = {
    "\t": (firstLines.match(/\t/g) || []).length,
    ";": (firstLines.match(/;/g) || []).length,
    ",": (firstLines.match(/,/g) || []).length
  };
  let delimiter = null;
  let best = 0;
  Object.keys(counts).forEach((key) => {
    if (counts[key] > best) { best = counts[key]; delimiter = key; }
  });
  if (!delimiter || best === 0) {
    return input.split(/\r?\n/).map((line) => [line.trim()]).filter((row) => row[0] !== "");
  }

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

/* ------------------------------ تشخیص و نگاشت --------------------------- */

function normalizeHeader(value) {
  return normalizePersian(String(value || "").replace(/\s+/g, " "))
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[:：\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectHeaderRow(rows) {
  const limit = Math.min(rows.length, 12);
  let bestIndex = 0;
  let bestScore = 0;
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i] || [];
    let score = 0;
    row.forEach((cell) => {
      const normalized = normalizeHeader(cell);
      Object.keys(HEADER_SYNONYMS).forEach((field) => {
        if (HEADER_SYNONYMS[field].some((syn) => normalizeHeader(syn) === normalized)) score += 1;
      });
    });
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  }
  return { index: bestIndex, score: bestScore };
}

function autoMapping(headerRow, colCount) {
  const mapping = {};
  IMPORT_FIELDS.forEach(([field]) => { mapping[field] = -1; });
  if (headerRow && headerRow.length) {
    for (let col = 0; col < colCount; col += 1) {
      const normalized = normalizeHeader(headerRow[col]);
      if (!normalized) continue;
      Object.keys(HEADER_SYNONYMS).forEach((field) => {
        if (mapping[field] !== -1) return;
        if (HEADER_SYNONYMS[field].some((syn) => {
          const s = normalizeHeader(syn);
          return normalized === s || normalized.startsWith(s + " ") || normalized.endsWith(" " + s);
        })) {
          mapping[field] = col;
        }
      });
    }
  }
  if (mapping.title === -1) mapping.title = 0;
  const positional = ["status", "category", "progress", "hours", "project", "owner", "blocker", "next", "date"];
  if (mapping.title === 0 && colCount > 1) {
    positional.forEach((field, idx) => {
      const col = idx + 1;
      if (mapping[field] === -1 && col < colCount) mapping[field] = col;
    });
  }
  return mapping;
}

function isHeaderishRow(row) {
  return row && row.length && row.some((cell) => normalizeHeader(cell) && Object.keys(HEADER_SYNONYMS).some((field) =>
    HEADER_SYNONYMS[field].some((syn) => normalizeHeader(syn) === normalizeHeader(cell))
  ));
}

function parseImportDate(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  const j = parseJalaliInput(raw);
  if (j) return jalaliISO(j);
  const n = parseNum(raw);
  if (n != null && n > 20000 && n < 90000) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const jj = gToJ(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      return jalaliISO(jj);
    }
  }
  return "";
}

/* ------------------------------ پنجره‌ی ورود ---------------------------- */

let importState = null;

function openImportModal(fileName, sheets) {
  const available = sheets.filter((sheet) => Array.isArray(sheet.rows) && sheet.rows.length);
  if (!available.length) {
    toast("در این فایل داده‌ای پیدا نشد.", { type: "error" });
    return;
  }
  importState = {
    fileName,
    sheets: available,
    sheetIndex: 0,
    headerIndex: 0,
    mapping: {},
    colCount: 0
  };

  const body = `<div id="import-body"></div>`;
  const layer = openModal({
    title: "افزودن تسک از فایل",
    sub: "سرستون‌ها و اتصال ستون‌ها را یک بار بررسی کن؛ بعد همه‌چیز محلی پردازش می‌شود.",
    iconName: "upload",
    size: "modal-lg",
    body,
    footer: `
      <button class="btn btn-primary" type="button" data-do-import>${icon("plus")} افزودن به تسک‌ها</button>
      <button class="btn" type="button" data-modal-close>انصراف</button>
      <span class="spacer"></span>
      <span class="helper" id="import-ready-label"></span>`
  });

  const modalBody = layer.querySelector("#import-body");

  const currentSheet = () => importState.sheets[importState.sheetIndex];
  const recomputeMapping = () => {
    const sheet = currentSheet();
    const rows = sheet.rows || [];
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    importState.colCount = colCount;
    const detected = detectHeaderRow(rows);
    importState.headerIndex = detected.score > 0 ? detected.index : -1;
    const headerRow = importState.headerIndex >= 0 ? (rows[importState.headerIndex] || []) : [];
    importState.mapping = autoMapping(headerRow, colCount);
  };

  const render = () => {
    const sheet = currentSheet();
    const rows = sheet.rows || [];
    const colCount = importState.colCount;
    const headerRow = importState.headerIndex >= 0 ? (rows[importState.headerIndex] || []) : [];
    const dataRows = rows.slice(importState.headerIndex + 1).filter((row) => row.some((c) => String(c || "").trim() !== ""));
    const previewRows = dataRows.slice(0, 6);
    const mapping = importState.mapping;
    const headerIndexOptions = [];
    headerIndexOptions.push(`<option value="-1"${importState.headerIndex === -1 ? " selected" : ""}>بدون سرستون</option>`);
    for (let i = 0; i < Math.min(rows.length, 12); i += 1) {
      const label = (rows[i] || []).filter(Boolean).slice(0, 2).join(" — ").slice(0, 42);
      headerIndexOptions.push(`<option value="${i}"${importState.headerIndex === i ? " selected" : ""}>ردیف ${faDigits(i + 1)}${label ? " — " + escapeHtml(label) : ""}</option>`);
    }

    const colOptions = (selected) => {
      const options = [`<option value="-1"${selected === -1 ? " selected" : ""}>انتخاب نشده</option>`];
      for (let col = 0; col < colCount; col += 1) {
        const label = headerRow[col] ? String(headerRow[col]).slice(0, 30) : "ستون " + faDigits(col + 1);
        options.push(`<option value="${col}"${selected === col ? " selected" : ""}>${faDigits(col + 1)} — ${escapeHtml(label)}</option>`);
      }
      return options.join("");
    };

    const previewHead = Array.from({ length: colCount }).map((_, col) =>
      `<th>${headerRow[col] ? escapeHtml(headerRow[col]) : "ستون " + faDigits(col + 1)}</th>`
    ).join("");

    modalBody.innerHTML = `
      <div class="mapping-sheet-row" style="margin-bottom:13px">
        ${importState.sheets.length > 1 ? `
          <div class="field">
            <label class="field-label" for="import-sheet">برگه‌ی فایل</label>
            <select class="select" id="import-sheet">
              ${importState.sheets.map((s, i) => `<option value="${i}"${i === importState.sheetIndex ? " selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </div>` : `
          <div class="field">
            <span class="field-label">برگه‌ی فایل</span>
            <div style="font-size:12px;font-weight:600;padding-top:8px">${escapeHtml(sheet.name)}</div>
          </div>`}
        <div class="field">
          <label class="field-label" for="import-header">سرستون‌ها</label>
          <select class="select" id="import-header">${headerIndexOptions.join("")}</select>
        </div>
      </div>

      <div class="import-summary">
        ${icon("check-circle")}
        <span><b>${faDigits(dataRows.length)}</b> ردیف برای بررسی پیدا شد؛ از ردیف بعد از سرستون به بعد خوانده می‌شود.</span>
      </div>

      <div class="preview-table-wrap" style="margin-bottom:15px">
        <table class="preview-table">
          <thead><tr>${headerRow.length ? previewHead : Array.from({ length: colCount }).map((_, i) => `<th>ستون ${faDigits(i + 1)}</th>`).join("")}</tr></thead>
          <tbody>
            ${previewRows.map((row) => `<tr>${Array.from({ length: colCount }).map((_, col) => {
              const value = row[col] == null ? "" : String(row[col]);
              return `<td class="${value ? "" : "empty-cell"}" title="${escapeAttr(value)}">${value ? escapeHtml(value) : "—"}</td>`;
            }).join("")}</tr>`).join("") || `<tr><td colspan="${colCount}" style="text-align:center;color:var(--ink-3)">ردیفی برای پیش‌نمایش نیست.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="field-label" style="margin-bottom:8px">اتصال ستون‌ها به فیلدهای تسک</div>
      <div class="mapping-grid">
        ${IMPORT_FIELDS.map(([field, label, required]) => `
          <div class="field">
            <label class="field-label" for="map-${field}">${label}${required ? " *" : ""}</label>
            <select class="select" id="map-${field}" data-map="${field}">${colOptions(mapping[field])}</select>
          </div>`).join("")}
      </div>
      <p class="field-hint" style="margin-top:10px">ستون عنوان الزامی است. بقیه‌ی ستون‌ها اختیاری‌اند و مقادیر خالی در گزارش نمایش داده نمی‌شوند.</p>`;

    const ready = layer.querySelector("#import-ready-label");
    if (ready) ready.textContent = faDigits(dataRows.length) + " ردیف آماده‌ی ورود";

    modalBody.querySelectorAll("[data-map]").forEach((select) => {
      select.addEventListener("change", () => {
        importState.mapping[select.dataset.map] = Number(select.value);
      });
    });
    const sheetSelect = modalBody.querySelector("#import-sheet");
    if (sheetSelect) {
      sheetSelect.addEventListener("change", () => {
        importState.sheetIndex = Number(sheetSelect.value);
        importState.headerIndex = 0;
        recomputeMapping();
        render();
      });
    }
    const headerSelect = modalBody.querySelector("#import-header");
    if (headerSelect) {
      headerSelect.addEventListener("change", () => {
        importState.headerIndex = Number(headerSelect.value);
        const header = importState.headerIndex >= 0 ? (currentSheet().rows[importState.headerIndex] || []) : [];
        importState.mapping = autoMapping(header, importState.colCount);
        render();
      });
    }
  };

  recomputeMapping();
  render();

  layer.querySelector("[data-do-import]").addEventListener("click", () => {
    if (importState.mapping.title == null || importState.mapping.title < 0) {
      toast("برای ورود، ستون «عنوان تسک» را انتخاب کن.", { type: "error" });
      return;
    }
    const sheet = currentSheet();
    const rows = sheet.rows.slice(importState.headerIndex + 1);
    const created = [];
    rows.forEach((row) => {
      if (!row || !row.some((cell) => String(cell || "").trim() !== "")) return;
      const get = (field) => {
        const col = importState.mapping[field];
        return col != null && col >= 0 ? String(row[col] == null ? "" : row[col]).trim() : "";
      };
      const title = cleanTitle(get("title"));
      if (!title) return;
      const statusText = get("status");
      const status = statusText ? detectStatus(statusText) : "doing";
      const progressRaw = parseNum(get("progress"));
      const hoursRaw = parseNum(get("hours"));
      const project = get("project") || state.settings.defaultProject || "";
      created.push(newTask({
        title,
        raw: row.filter((c) => String(c || "").trim() !== "").join(" | "),
        status,
        category: normalizePersian(get("category")),
        progress: progressRaw == null ? null : clamp(progressRaw, 0, 100),
        hours: hoursRaw == null ? null : Math.max(0, hoursRaw),
        project: normalizePersian(project),
        owner: normalizePersian(get("owner")),
        blocker: normalizePersian(get("blocker"), { keepPunctuation: true }),
        nextStep: normalizePersian(get("next"), { keepPunctuation: true }) || (status === "planned" ? title : ""),
        date: parseImportDate(get("date")),
        source: "excel"
      }));
    });

    if (!created.length) {
      toast("از این برگه تسکی ساخته نشد؛ ستون‌ها را بررسی کن.", { type: "error" });
      return;
    }
    closeModal();
    resetViewFilters();
    renderTasks();
    schedulePreview();
    scheduleSave();
    toast(faDigits(created.length) + " تسک از فایل اضافه شد.", { type: "success" });
  });
}

async function handleFile(file) {
  if (!file) return;
  const name = String(file.name || "فایل");
  const lower = name.toLowerCase();
  const allowed = /\.(xlsx|csv|tsv|txt)$/i.test(lower);
  if (!allowed) {
    toast("فعلاً فایل اکسل، جدول متنی یا متن ساده را می‌توانم بخوانم.", { type: "error" });
    return;
  }
  if (file.size > 18 * 1024 * 1024) {
    toast("فایل بزرگ‌تر از ۱۸ مگابایت است؛ یک فایل کوچک‌تر انتخاب کن.", { type: "error" });
    return;
  }
  toast("در حال خواندن فایل…", { type: "info", duration: 1800 });
  try {
    let sheets;
    if (lower.endsWith(".xlsx")) {
      const buffer = await readFileBuffer(file);
      sheets = await parseXlsx(buffer);
    } else {
      const text = await readFileText(file);
      const rows = parseDelimitedRows(text);
      sheets = [{ name: "برگه‌ی اصلی", rows }];
    }
    openImportModal(name, sheets);
  } catch (e) {
    console.error(e);
    if (e && e.message === "deflate") {
      toast("این مرورگر از بازکردن فایل اکسل فشرده پشتیبانی نمی‌کند. فایل را به جدول متنی تبدیل کن یا از مرورگر جدیدتری استفاده کن.", { type: "error", duration: 8000 });
    } else {
      toast("خواندن این فایل ممکن نشد. مطمئن شو فایل سالم است و رمز ندارد.", { type: "error" });
    }
  }
}

function bindFileEvents() {
  const dropzone = $("#dropzone");
  const input = $("#file-input");
  if (!dropzone || !input) return;

  const pick = () => input.click();
  dropzone.addEventListener("click", pick);
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); }
  });
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (file) handleFile(file);
  });

  ["dragenter", "dragover"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-over");
    });
  });
  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    if (file) handleFile(file);
  });
}

/* ------------------------------ ساخت فایل نمونه ------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const { time, day } = dosDateTime(now);
  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const crc = crc32(dataBytes);
    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    parts.push(local);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);
    offset += local.length;
  });

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function xmlEscape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function buildSampleWorkbook() {
  const rows = SAMPLE_CSV_ROWS;
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = columnName(colIndex) + (rowIndex + 1);
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");

  const widthCols = Array.from({ length: rows[0].length }).map((_, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 38 : 16}" customWidth="1"/>`
  ).join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:J${rows.length}"/>
  <sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>
  <cols>${widthCols}</cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="تسک‌ها" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const packageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  return zipStore([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: packageRels },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml }
  ]);
}

function downloadSampleWorkbook() {
  downloadBlob(buildSampleWorkbook(), "نمونه-ورودی-گزارش‌یار.xlsx");
  toast("فایل نمونه آماده شد؛ با اکسل بازش کن و ستون‌ها را ببین.", { type: "success" });
}
