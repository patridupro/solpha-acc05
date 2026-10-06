// Nhật ký giao dịch hằng ngày: chấm điểm hành vi có trọng số + tổng kết tháng.
// Dữ liệu lưu trên máy (localStorage) — dùng "Sao lưu" để giữ bản JSON an toàn.
(function () {
  const KEY = "solpha_journal";
  const CRITERIA = [
    { id: "kyluat", w: 30, name: "Kỷ luật theo chỉ báo", hint: "Chỉ vào khi app đủ điều kiện; đứng ngoài khi WAIT." },
    { id: "setup", w: 25, name: "Setup đúng", hint: "Đồng pha 1D/4H/1H, chạm BB / nến tín hiệu đạt." },
    { id: "ruiro", w: 20, name: "Quản trị rủi ro", hint: "Đặt SL trước khi vào; mỗi lệnh rủi ro ≤ 1–2% tài khoản." },
    { id: "chianho", w: 15, name: "Chia nhỏ lệnh", hint: "Vào 2–3 phần tại vùng setup tốt, không all-in một giá." },
    { id: "tamly", w: 10, name: "Không FOMO / gỡ / chase", hint: "Không vào vì sợ lỡ, không gỡ lỗ, không đuổi BB trên." }
  ];
  const NA_WHEN_IDLE = ["setup", "ruiro", "chianho"];
  const $ = (id) => document.getElementById(id);
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } };
  const save = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (_) { return false; } };
  const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  // Chấp nhận "-1,5", "−1.5", "+2": bàn phím số Android thường thiếu dấu trừ nên có nút ± hỗ trợ.
  const parsePnl = (s) => {
    const t = String(s ?? "").trim().replace(/[−–]/g, "-").replace(",", ".").replace(/\s/g, "");
    if (t === "" || t === "-" || t === "+") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function score(entry) {
    let got = 0, max = 0;
    for (const c of CRITERIA) {
      const v = entry.c?.[c.id];
      if (v === "yes") { got += c.w; max += c.w; } else if (v === "no") max += c.w;
    }
    return max ? Math.round((got / max) * 100) : null;
  }
  const grade = (s) => (s == null ? "—" : s >= 85 ? "A" : s >= 70 ? "B" : s >= 50 ? "C" : "D");

  function renderForm() {
    $("jCriteria").innerHTML = CRITERIA.map((c) => `
      <div class="jrow">
        <div><b>${c.name}</b> <span class="pill dim">${c.w}đ</span><div class="muted">${c.hint}</div></div>
        <div class="seg" data-id="${c.id}">
          <label><input type="radio" name="j_${c.id}" value="yes"><span>Đạt</span></label>
          <label><input type="radio" name="j_${c.id}" value="no"><span>Không</span></label>
          <label><input type="radio" name="j_${c.id}" value="na"><span>N/A</span></label>
        </div>
      </div>`).join("");
  }
  function readForm() {
    const c = {};
    for (const k of CRITERIA) c[k.id] = (document.querySelector(`input[name="j_${k.id}"]:checked`) || {}).value || "na";
    return {
      mode: $("jMode").value, c,
      trades: Number($("jTrades").value || 0), pnl: parsePnl($("jPnl").value),
      note: $("jNote").value.trim(), updated: Date.now()
    };
  }
  function fillForm(date) {
    const e = load()[date];
    $("jMode").value = e?.mode || "trade";
    for (const k of CRITERIA) {
      const v = e?.c?.[k.id] || "";
      document.querySelectorAll(`input[name="j_${k.id}"]`).forEach((r) => { r.checked = r.value === v; });
    }
    $("jTrades").value = e?.trades || "";
    $("jPnl").value = e?.pnl ?? "";
    $("jNote").value = e?.note || "";
    $("jSaved").textContent = e ? `Đã có nhật ký ngày này · ${score(e) ?? "—"} điểm (${grade(score(e))})` : "Chưa ghi ngày này";
    renderSignals(date);
    updateLive();
  }
  function applyMode() {
    if ($("jMode").value !== "idle") return;
    for (const id of NA_WHEN_IDLE) document.querySelectorAll(`input[name="j_${id}"]`).forEach((r) => { r.checked = r.value === "na"; });
    $("jTrades").value = 0;
    updateLive();
  }
  function updateLive() {
    const s = score(readForm());
    $("jLive").textContent = s == null ? "Điểm: —" : `Điểm: ${s}/100 · ${grade(s)}`;
  }
  // Đối chiếu khách quan: những gì app đã báo trong ngày đó.
  function renderSignals(date) {
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem("solpha_logs") || "[]"); } catch (_) {}
    const [y, m, d] = date.split("-").map(Number);
    const tag = `${d}/${m}/${y}`;
    const hits = logs.filter((l) => l.alert && String(l.t).includes(tag));
    $("jSignals").innerHTML = hits.length
      ? `App báo ${hits.length} tín hiệu ngày này:<br>` + hits.slice(0, 6).map((h) => `• ${esc(h.t)} — ${esc(h.text)}`).join("<br>")
      : "App không ghi nhận tín hiệu nào ngày này (nhật ký app chỉ lưu khi app đang mở). Không có tín hiệu mà vẫn vào lệnh = trừ điểm Kỷ luật.";
  }

  function renderMonth() {
    const month = $("jMonth").value || today().slice(0, 7);
    const db = load();
    const days = Object.keys(db).filter((d) => d.startsWith(month)).sort();
    const scores = days.map((d) => score(db[d])).filter((s) => s != null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const pnl = days.reduce((a, d) => a + (Number(db[d].pnl) || 0), 0);
    const idle = days.filter((d) => db[d].mode === "idle").length;
    let streak = 0, best = 0;
    for (const d of days) { if (db[d].c?.kyluat === "yes") { streak++; best = Math.max(best, streak); } else if (db[d].c?.kyluat === "no") streak = 0; }
    $("jStats").innerHTML = `
      <div><span>Ngày ghi</span><b>${days.length}</b></div>
      <div><span>Điểm TB</span><b>${avg ?? "—"} ${avg != null ? "(" + grade(avg) + ")" : ""}</b></div>
      <div><span>Ngày hạng A</span><b>${scores.filter((s) => s >= 85).length}</b></div>
      <div><span>Đứng ngoài</span><b>${idle}</b></div>
      <div><span>Chuỗi kỷ luật dài nhất</span><b>${best} ngày</b></div>
      <div><span>Tổng PnL</span><b class="${pnl >= 0 ? "up" : "down"}">${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</b></div>`;
    $("jCritBody").innerHTML = CRITERIA.map((c) => {
      const appl = days.filter((d) => ["yes", "no"].includes(db[d].c?.[c.id]));
      const ok = appl.filter((d) => db[d].c[c.id] === "yes").length;
      const pct = appl.length ? Math.round((ok / appl.length) * 100) : null;
      return `<tr><td><b>${c.name}</b></td><td>${c.w}</td><td>${ok}/${appl.length}</td><td><div class="bar"><i style="width:${pct ?? 0}%"></i></div> ${pct ?? "—"}%</td></tr>`;
    }).join("");
    $("jDays").innerHTML = days.length ? days.slice().reverse().map((d) => {
      const e = db[d], s = score(e);
      const marks = CRITERIA.map((c) => (e.c?.[c.id] === "yes" ? "✅" : e.c?.[c.id] === "no" ? "❌" : "·")).join("");
      return `<tr data-day="${d}"><td>${d.slice(8)}/${d.slice(5, 7)}</td><td>${e.mode === "idle" ? "Đứng ngoài" : (e.trades || 0) + " lệnh"}</td><td>${marks}</td><td><b>${s ?? "—"}</b> ${grade(s)}</td><td>${e.pnl ?? ""}</td><td class="muted">${esc(e.note).slice(0, 60)}</td></tr>`;
    }).join("") : `<tr><td colspan="6" class="muted">Chưa có nhật ký tháng này.</td></tr>`;
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCSV() {
    const month = $("jMonth").value || today().slice(0, 7);
    const db = load();
    const head = ["Ngay", "CheDo", "SoLenh", ...CRITERIA.map((c) => `${c.name} (${c.w})`), "Diem", "Hang", "PnL", "GhiChu"];
    const rows = Object.keys(db).filter((d) => d.startsWith(month)).sort().map((d) => {
      const e = db[d], s = score(e);
      return [d, e.mode === "idle" ? "Dung ngoai" : "Vao lenh", e.trades || 0, ...CRITERIA.map((c) => ({ yes: "Dat", no: "Khong" }[e.c?.[c.id]] || "N/A")), s ?? "", grade(s), e.pnl ?? "", (e.note || "").replace(/"/g, '""')];
    });
    const csv = "﻿" + [head, ...rows].map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");
    download(`solpha-nhat-ky-${month}.csv`, csv, "text/csv");
  }

  function init() {
    if (!$("journalCard")) return;
    renderForm();
    $("jDate").value = today();
    $("jMonth").value = today().slice(0, 7);
    fillForm($("jDate").value);
    renderMonth();
    $("jDate").addEventListener("change", () => fillForm($("jDate").value || today()));
    $("jMode").addEventListener("change", applyMode);
    $("jCriteria").addEventListener("change", updateLive);
    $("jMonth").addEventListener("change", renderMonth);
    $("jSave").addEventListener("click", () => {
      const date = $("jDate").value || today();
      const entry = readForm();
      if (Number.isNaN(entry.pnl)) { $("jSaved").textContent = "PnL không hợp lệ — chỉ nhập số, ví dụ -1.5"; $("jPnl").focus(); return; }
      const db = load(); db[date] = entry;
      $("jSaved").textContent = save(db) ? `Đã lưu ${date} · ${score(db[date]) ?? "—"} điểm (${grade(score(db[date]))})` : "Không lưu được (trình duyệt chặn bộ nhớ)";
      if (date.startsWith($("jMonth").value)) renderMonth();
    });
    $("jDays").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-day]"); if (!tr) return;
      $("jDate").value = tr.dataset.day; fillForm(tr.dataset.day);
      $("jDate").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    $("jPnlSign").addEventListener("click", () => {
      const v = $("jPnl").value.trim().replace(/^[−–]/, "-");
      $("jPnl").value = v.startsWith("-") ? v.slice(1) : "-" + v.replace(/^\+/, "");
      $("jPnl").focus();
    });
    $("jCsv").addEventListener("click", exportCSV);
    $("jBackup").addEventListener("click", () => download(`solpha-nhat-ky-backup-${today()}.json`, JSON.stringify(load(), null, 2), "application/json"));
    $("jImport").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("sai định dạng");
        save({ ...load(), ...data });
        fillForm($("jDate").value); renderMonth();
        $("jSaved").textContent = `Đã khôi phục ${Object.keys(data).length} ngày`;
      } catch (err) { $("jSaved").textContent = "File không hợp lệ: " + err.message; }
      e.target.value = "";
    });
  }
  window.SolphaJournal = { score, grade, CRITERIA };
  init();
})();
