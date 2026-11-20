(function(){
'use strict';

/* ========== STATE ========== */
const LS = { history:'sgc_v2_history', dark:'sgc_v2_dark', gpa:'sgc_v2_gpa', scale:'sgc_v2_scale' };
const state = {
  scale: parseInt(localStorage.getItem(LS.scale)) || 10,
  darkMode: localStorage.getItem(LS.dark) === '1',
  history: safeJSON(localStorage.getItem(LS.history), []),
  gpaSubjects: safeJSON(localStorage.getItem(LS.gpa), []),
  searchTerm: ''
};

// Fix NaN sau JSON roundtrip (null → NaN để logic nhất quán)
state.gpaSubjects = state.gpaSubjects.map(s => ({
  name: s && typeof s.name === 'string' ? s.name : '',
  score: s && (s.score === null || s.score === undefined) ? NaN : Number(s.score),
  weight: s && Number.isFinite(Number(s.weight)) && Number(s.weight) > 0 ? Number(s.weight) : 1
}));

const PANEL_RESULT = {
  'panel-hk2':'result-hk2',
  'panel-ck':'result-ck',
  'panel-tb':'result-tb',
  'panel-nam':'result-nam',
  'panel-gpa':'result-gpa',
  'panel-thpt':'result-thpt'
};

/* ========== UTILS ========== */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function safeJSON(s, fallback){ try{ return s ? JSON.parse(s) : fallback; }catch(e){ return fallback; } }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function roundScore(n){
  if (!isFinite(n)) return n;
  if (state.scale === 100) return Math.round(n);
  return Math.round((n + 1e-9) * 10) / 10;
}
function fmt(n){
  if (!isFinite(n)) return '—';
  if (state.scale === 100) return Math.round(n).toString();
  return roundScore(n).toFixed(1);
}
function parseOne(str){
  if (str === null || str === undefined) return NaN;
  const s = String(str);
  if (!s.trim()) return NaN;
  return parseFloat(s.trim().replace(/,/g, '.'));
}
function parseNumbers(str){
  if (!str || !str.trim()) return [];
  return str.trim().split(/\s+/).map(s => {
    const n = parseFloat(s.replace(/,/g, '.'));
    return isNaN(n) ? null : n;
  }).filter(n => n !== null);
}
function isValidScore(n){ return !isNaN(n) && n >= 0 && n <= state.scale; }
function debounce(fn, ms){
  let t; return function(...a){ clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
}

function toast(msg, type){
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
function showEmpty(el, msg){
  el.className = 'result empty';
  el.textContent = msg;
}
function showError(el, msg){
  el.className = 'result error';
  el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + escapeHtml(msg);
}
function classify(needed){
  if (needed <= 0) return 'success';
  if (needed <= state.scale * 0.6) return 'success';
  if (needed <= state.scale * 0.85) return 'warning';
  if (needed <= state.scale) return 'warning';
  return 'danger';
}
function scoreClass(score){
  if (!isValidScore(score)) return '';
  const pct = score / state.scale;
  if (pct >= 0.8) return 'score-great';
  if (pct >= 0.65) return 'score-good';
  if (pct >= 0.5) return 'score-ok';
  return 'score-bad';
}

/* ========== THEME / SCALE ========== */
function applyTheme(){
  document.body.classList.toggle('dark', state.darkMode);
  $('themeIcon').className = state.darkMode ? 'fas fa-moon' : 'fas fa-sun';
}
$('themeToggle').addEventListener('click', () => {
  state.darkMode = !state.darkMode;
  localStorage.setItem(LS.dark, state.darkMode ? '1' : '0');
  applyTheme();
});

function applyScale(){
  $$('.scale-switch button').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.scale) === state.scale);
  });
  $$('.scale-max').forEach(el => el.textContent = state.scale);
}
$$('.scale-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    const sc = parseInt(btn.dataset.scale);
    if (sc === state.scale) return;
    state.scale = sc;
    localStorage.setItem(LS.scale, sc);
    applyScale();
    computeAll();
  });
});

/* ========== TABS ========== */
$$('.tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab-btn').forEach(t => t.classList.toggle('active', t === tab));
    $$('.panel').forEach(p => p.hidden = p.id !== tab.dataset.panel);
  });
});

/* ========== PRESETS ========== */
$$('.preset').forEach(p => {
  p.addEventListener('click', () => {
    const input = $(p.closest('.presets').dataset.for);
    const val = p.dataset.target;
    const parts = input.value.trim().split(/\s+/).filter(Boolean);
    if (!parts.includes(val)){
      parts.push(val);
      input.value = parts.join(' ');
      computeAll();
    } else {
      toast('Mục tiêu đã có trong danh sách');
    }
  });
});

/* ========== PANEL 1: HK2 cần ========== */
function calcHK2(){
  const hk1El = $('hk1');
  const hk1 = parseOne(hk1El.value);
  const result = $('result-hk2');

  if (!hk1El.value.trim()){
    showEmpty(result, 'Nhập điểm HK1 để bắt đầu');
    hk1El.classList.remove('error'); return;
  }
  if (!isValidScore(hk1)){
    showError(result, `HK1 phải từ 0 đến ${state.scale}`);
    hk1El.classList.add('error'); return;
  }
  hk1El.classList.remove('error');

  const targets = parseNumbers($('targets-hk2').value).filter(t => isValidScore(t));
  if (!targets.length){ showEmpty(result, 'Nhập ít nhất 1 mục tiêu'); return; }

  let html = '<div class="result-title">Kết quả</div>';
  targets.forEach(t => {
    const needed = (3 * t - hk1) / 2;
    const cls = classify(needed);
    if (needed > state.scale){
      const maxCN = (hk1 + 2 * state.scale) / 3;
      html += `
        <div class="res-row danger">
          <span class="label">ĐTBCN ≥ ${fmt(t)}</span>
          <span class="value"><i class="fas fa-xmark"></i> Không khả thi</span>
        </div>
        <div class="res-meta">HK2 tối đa <strong>${state.scale}</strong> → ĐTBCN tối đa = <strong>${fmt(maxCN)}</strong> (thiếu <strong>${fmt(t - maxCN)}</strong>)</div>
      `;
    } else {
      html += `
        <div class="res-row ${cls}">
          <span class="label">ĐTBCN ≥ ${fmt(t)}</span>
          <span class="value">${fmt(Math.max(0, needed))}</span>
        </div>
      `;
    }
  });
  html += `<div class="res-meta">Công thức: HK2 = (3 × Mục tiêu − HK1) / 2</div>`;
  result.className = 'result';
  result.innerHTML = html;
}

/* ========== PANEL 2: Cuối kỳ cần ========== */
function calcCK(){
  const txEl = $('tx-ck'), gkEl = $('gk-ck');
  const result = $('result-ck');
  const txArr = parseNumbers(txEl.value);
  const gk = parseOne(gkEl.value);

  if (!txEl.value.trim() || !gkEl.value.trim()){ showEmpty(result, 'Nhập điểm TX và giữa kỳ'); return; }
  if (txArr.some(v => !isValidScore(v))){ showError(result, `Điểm TX phải từ 0 đến ${state.scale}`); return; }
  if (!isValidScore(gk)){ showError(result, `Điểm giữa kỳ phải từ 0 đến ${state.scale}`); return; }

  const targets = parseNumbers($('targets-ck').value).filter(t => isValidScore(t));
  if (!targets.length){ showEmpty(result, 'Nhập ít nhất 1 mục tiêu ĐTB HK2'); return; }

  const sumTx = txArr.reduce((a,b) => a+b, 0);
  const n = txArr.length;

  let html = '<div class="result-title">Kết quả</div>';
  targets.forEach(t => {
    const needed = (t * (n + 5) - sumTx - 2 * gk) / 3;
    const cls = classify(needed);
    if (needed > state.scale){
      const maxDTB = (sumTx + 2 * gk + 3 * state.scale) / (n + 5);
      html += `
        <div class="res-row danger">
          <span class="label">ĐTBHK2 ≥ ${fmt(t)}</span>
          <span class="value"><i class="fas fa-xmark"></i> Không khả thi</span>
        </div>
        <div class="res-meta">Nếu CK = ${state.scale}, ĐTBHK2 tối đa = <strong>${fmt(maxDTB)}</strong> (thiếu <strong>${fmt(t - maxDTB)}</strong>)</div>
      `;
    } else {
      html += `
        <div class="res-row ${cls}">
          <span class="label">ĐTBHK2 ≥ ${fmt(t)}</span>
          <span class="value">${fmt(Math.max(0, needed))}</span>
        </div>
      `;
    }
  });
  html += `<div class="res-meta">Công thức: CK = (ĐTB × (n+5) − ΣTX − 2×GK) / 3 · n = ${n}</div>`;
  result.className = 'result';
  result.innerHTML = html;
}

/* ========== PANEL 3: Điểm TB môn ========== */
function calcTB(){
  const txArr = parseNumbers($('tx-tb').value);
  const gk = parseOne($('gk-tb').value);
  const ck = parseOne($('ck-tb').value);
  const result = $('result-tb');

  if (!txArr.length && isNaN(gk) && isNaN(ck)){ showEmpty(result, 'Nhập điểm để tính ĐTB môn'); return; }
  if (!txArr.length){ showError(result, 'Cần nhập ít nhất 1 điểm thường xuyên'); return; }
  if (txArr.some(v => !isValidScore(v))){ showError(result, `Điểm TX phải từ 0 đến ${state.scale}`); return; }
  if (isNaN(gk) || isNaN(ck)){ showError(result, 'Cần nhập đủ giữa kỳ và cuối kỳ'); return; }
  if (!isValidScore(gk) || !isValidScore(ck)){ showError(result, `Điểm phải từ 0 đến ${state.scale}`); return; }

  const sumTx = txArr.reduce((a,b) => a+b, 0);
  const n = txArr.length;
  const dtb = (sumTx + 2*gk + 3*ck) / (n + 5);

  let rank = '';
  const r1 = state.scale === 10 ? 8 : 80;
  const r2 = state.scale === 10 ? 6.5 : 65;
  const r3 = state.scale === 10 ? 5 : 50;
  if (dtb >= r1) rank = '🎉 Xếp loại <strong>Giỏi</strong>';
  else if (dtb >= r2) rank = '👍 Xếp loại <strong>Khá</strong>';
  else if (dtb >= r3) rank = '📚 Xếp loại <strong>Trung bình</strong>';
  else rank = '⚠️ Xếp loại dưới trung bình';

  result.className = 'result';
  result.innerHTML = `
    <div class="big-value">
      <span class="num">${fmt(dtb)}</span>
      <span class="unit">/ ${state.scale}</span>
    </div>
    <div class="res-row"><span class="label">ΣTX (${n} điểm)</span><span class="value">${fmt(sumTx)}</span></div>
    <div class="res-row"><span class="label">Giữa kỳ (×2)</span><span class="value">${fmt(gk)}</span></div>
    <div class="res-row"><span class="label">Cuối kỳ (×3)</span><span class="value">${fmt(ck)}</span></div>
    <div class="res-meta">
      Công thức: (ΣTX + 2×GK + 3×CK) / (n + 5) = (${fmt(sumTx)} + ${fmt(2*gk)} + ${fmt(3*ck)}) / ${n+5}<br>
      ${rank}
    </div>
  `;
}

/* ========== PANEL 4: Cả năm ========== */
function calcNam(){
  const hk1 = parseOne($('hk1-nam').value);
  const hk2 = parseOne($('hk2-nam').value);
  const target = parseOne($('target-nam').value);
  const result = $('result-nam');

  if (isNaN(hk1)){ showEmpty(result, 'Nhập điểm HK1 để bắt đầu'); return; }
  if (!isValidScore(hk1)){ showError(result, `HK1 phải từ 0 đến ${state.scale}`); return; }

  // Case 1: HK1 + target (không có HK2) → HK2 cần
  if (isNaN(hk2) && !isNaN(target)){
    if (!isValidScore(target)){ showError(result, `Mục tiêu phải từ 0 đến ${state.scale}`); return; }
    const needed = (3 * target - hk1) / 2;
    const cls = classify(needed);
    let html = '<div class="result-title">HK2 cần</div>';
    if (needed > state.scale){
      const maxCN = (hk1 + 2 * state.scale) / 3;
      html += `
        <div class="res-row danger">
          <span class="label">ĐTBCN ≥ ${fmt(target)}</span>
          <span class="value"><i class="fas fa-xmark"></i> Không khả thi</span>
        </div>
        <div class="res-meta">HK2 tối đa <strong>${state.scale}</strong> → ĐTBCN tối đa = <strong>${fmt(maxCN)}</strong></div>
      `;
    } else {
      html += `
        <div class="res-row ${cls}">
          <span class="label">ĐTBCN ≥ ${fmt(target)} → HK2 cần</span>
          <span class="value">${fmt(Math.max(0, needed))}</span>
        </div>
      `;
    }
    html += `<div class="res-meta">Công thức: HK2 = (3 × ${fmt(target)} − ${fmt(hk1)}) / 2</div>`;
    result.className = 'result';
    result.innerHTML = html;
    return;
  }

  // Case 2: có HK1 + HK2 → ĐTBCN
  if (!isNaN(hk2)){
    if (!isValidScore(hk2)){ showError(result, `HK2 phải từ 0 đến ${state.scale}`); return; }
    const dtbcn = (hk1 + 2 * hk2) / 3;
    const r1 = state.scale === 10 ? 8 : 80;
    const r2 = state.scale === 10 ? 6.5 : 65;
    const r3 = state.scale === 10 ? 5 : 50;
    let rank = '';
    if (dtbcn >= r1) rank = '🎉 Xếp loại <strong>Giỏi</strong>';
    else if (dtbcn >= r2) rank = '👍 Xếp loại <strong>Khá</strong>';
    else if (dtbcn >= r3) rank = '📚 Xếp loại <strong>Trung bình</strong>';
    else rank = '⚠️ Xếp loại dưới trung bình';

    result.className = 'result';
    result.innerHTML = `
      <div class="big-value">
        <span class="num">${fmt(dtbcn)}</span>
        <span class="unit">/ ${state.scale}</span>
      </div>
      <div class="res-row"><span class="label">HK1</span><span class="value">${fmt(hk1)}</span></div>
      <div class="res-row"><span class="label">HK2 (×2)</span><span class="value">${fmt(hk2)}</span></div>
      <div class="res-meta">
        Công thức: (HK1 + 2×HK2) / 3 = (${fmt(hk1)} + ${fmt(2*hk2)}) / 3<br>
        ${rank}
      </div>
    `;
    return;
  }

  showEmpty(result, 'Nhập HK2 hoặc mục tiêu để tính tiếp');
}

/* ========== PANEL 5: GPA (FIXED & UPGRADED) ========== */

// Render danh sách môn từ state
function renderSubjects(){
  const wrap = $('gpa-subjects');
  if (!state.gpaSubjects.length){
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = state.gpaSubjects.map((s, i) => {
    const scoreVal = Number.isFinite(s.score) ? s.score : '';
    const cls = scoreClass(s.score);
    const name = escapeHtml(s.name || '');
    return `
      <div class="subject-row ${cls}" data-idx="${i}">
        <input type="text" class="input subj-name" list="subject-names"
               placeholder="Tên môn" value="${name}" autocomplete="off">
        <input type="text" class="input subj-score" inputmode="decimal"
               placeholder="Điểm" value="${scoreVal}" autocomplete="off">
        <input type="text" class="input subj-weight" inputmode="decimal"
               placeholder="HS" value="${s.weight || 1}" title="Hệ số tín chỉ" autocomplete="off">
        <button class="icon-btn-sm subj-del" title="Xóa môn"><i class="fas fa-times"></i></button>
      </div>
    `;
  }).join('');
}

// Đọc dữ liệu từ DOM → state
function syncSubjectsFromDOM(){
  const rows = $$('#gpa-subjects .subject-row');
  state.gpaSubjects = Array.from(rows).map(row => ({
    name: row.querySelector('.subj-name').value.trim(),
    score: parseOne(row.querySelector('.subj-score').value),
    weight: parseOne(row.querySelector('.subj-weight').value) || 1
  }));
}

// Cập nhật màu viền theo điểm (không re-render để giữ focus)
function updateRowClasses(){
  $$('#gpa-subjects .subject-row').forEach(row => {
    row.classList.remove('score-great','score-good','score-ok','score-bad');
    const score = parseOne(row.querySelector('.subj-score').value);
    const cls = scoreClass(score);
    if (cls) row.classList.add(cls);
  });
}

// Ghi localStorage (debounced)
const persistGPA = debounce(() => {
  // Chuyển NaN → null để JSON hợp lệ
  const safe = state.gpaSubjects.map(s => ({
    name: s.name,
    score: Number.isFinite(s.score) ? s.score : null,
    weight: s.weight
  }));
  localStorage.setItem(LS.gpa, JSON.stringify(safe));
}, 250);

// Tính GPA
function calcGPA(){
  const result = $('result-gpa');
  const valid = state.gpaSubjects.filter(s => isValidScore(s.score) && s.weight > 0);

  if (!valid.length){
    result.className = 'result empty';
    result.innerHTML = `
      <div class="gpa-empty">
        <i class="fas fa-graduation-cap"></i>
        <p>Chưa có môn nào hợp lệ</p>
        <p class="sm">Bấm <strong>+ Thêm môn</strong> hoặc <strong>Mẫu</strong> để bắt đầu</p>
      </div>
    `;
    return;
  }

  let sumScore = 0, sumWeight = 0;
  valid.forEach(s => { sumScore += s.score * s.weight; sumWeight += s.weight; });
  const gpa = sumScore / sumWeight;

  let maxSub = valid[0], minSub = valid[0];
  valid.forEach(s => {
    if (s.score > maxSub.score) maxSub = s;
    if (s.score < minSub.score) minSub = s;
  });

  const r1 = state.scale === 10 ? 8 : 80;
  const r2 = state.scale === 10 ? 6.5 : 65;
  const r3 = state.scale === 10 ? 5 : 50;
  let rank = '';
  if (gpa >= r1) rank = '🎉 GPA đạt loại <strong>Giỏi</strong>';
  else if (gpa >= r2) rank = '👍 GPA đạt loại <strong>Khá</strong>';
  else if (gpa >= r3) rank = '📚 GPA đạt loại <strong>Trung bình</strong>';
  else rank = '⚠️ GPA dưới trung bình';

  // Quy đổi Thang 4 & Điểm chữ (Quy chế tín chỉ ĐH)
  const gpa10 = (gpa / state.scale) * 10;
  let gpa4 = 0, letterGrade = 'F';
  if (gpa10 >= 8.5) { gpa4 = 4.0; letterGrade = 'A'; }
  else if (gpa10 >= 8.0) { gpa4 = 3.5; letterGrade = 'B+'; }
  else if (gpa10 >= 7.0) { gpa4 = 3.0; letterGrade = 'B'; }
  else if (gpa10 >= 6.5) { gpa4 = 2.5; letterGrade = 'C+'; }
  else if (gpa10 >= 5.5) { gpa4 = 2.0; letterGrade = 'C'; }
  else if (gpa10 >= 5.0) { gpa4 = 1.5; letterGrade = 'D+'; }
  else if (gpa10 >= 4.0) { gpa4 = 1.0; letterGrade = 'D'; }
  else { gpa4 = 0.0; letterGrade = 'F'; }

  result.className = 'result';
  result.innerHTML = `
    <div class="big-value">
      <span class="num">${fmt(gpa)}</span>
      <span class="unit">/ ${state.scale}</span>
    </div>
    <div style="margin:6px 0 12px; font-size:.85rem; display:flex; justify-content:center; gap:14px; opacity:.95; background:var(--surface-2); padding:6px 12px; border-radius:8px;">
      <span>🎓 Hệ 4.0: <strong>${gpa4.toFixed(1)} / 4.0</strong></span>
      <span>🔤 Điểm chữ: <strong>${letterGrade}</strong></span>
    </div>
    <div class="res-row success">
      <span class="label">Tổng môn tính</span>
      <span class="value">${valid.length} / ${state.gpaSubjects.length}</span>
    </div>
    <div class="res-row success">
      <span class="label"><i class="fas fa-arrow-up"></i> Cao nhất</span>
      <span class="value">${fmt(maxSub.score)}</span>
    </div>
    <div class="res-row danger">
      <span class="label"><i class="fas fa-arrow-down"></i> Thấp nhất</span>
      <span class="value">${fmt(minSub.score)}</span>
    </div>
    <div class="res-meta">
      Tổng hệ số: <strong>${sumWeight.toFixed(sumWeight % 1 ? 1 : 0)}</strong> · ${rank}
    </div>
  `;
}

/* --- GPA interactions --- */

// ✅ FIX: sync trước khi push
$('gpa-add').addEventListener('click', () => {
  syncSubjectsFromDOM();
  state.gpaSubjects.push({ name: '', score: NaN, weight: 1 });
  persistGPA();
  renderSubjects();
  calcGPA();
  const rows = $$('#gpa-subjects .subject-row');
  if (rows.length){
    rows[rows.length - 1].querySelector('.subj-name').focus();
  }
});

// Mẫu
const SAMPLE_SUBJECTS = [
  { name: 'Toán',      score: 8.0, weight: 2 },
  { name: 'Ngữ văn',   score: 7.5, weight: 2 },
  { name: 'Tiếng Anh', score: 9.0, weight: 1 },
  { name: 'Vật lý',    score: 7.0, weight: 1 },
  { name: 'Hóa học',   score: 8.5, weight: 1 }
];
$('gpa-sample').addEventListener('click', () => {
  if (state.gpaSubjects.length && !confirm('Ghi đè danh sách hiện tại bằng dữ liệu mẫu?')) return;
  state.gpaSubjects = SAMPLE_SUBJECTS.map(s => ({ ...s }));
  persistGPA();
  renderSubjects();
  calcGPA();
  toast('Đã điền dữ liệu mẫu');
});

// Xóa hết
$('gpa-clear').addEventListener('click', () => {
  if (!state.gpaSubjects.length) return toast('Danh sách đã trống');
  if (!confirm('Xóa toàn bộ môn trong danh sách?')) return;
  state.gpaSubjects = [];
  persistGPA();
  renderSubjects();
  calcGPA();
  toast('Đã xóa toàn bộ môn');
});

// Sắp xếp
$('gpa-sort').addEventListener('change', e => {
  const mode = e.target.value;
  if (mode === 'none') return;
  syncSubjectsFromDOM();
  const copy = state.gpaSubjects.slice();
  if (mode === 'score-desc'){
    copy.sort((a,b) => (Number.isFinite(b.score) ? b.score : -1) - (Number.isFinite(a.score) ? a.score : -1));
  } else if (mode === 'score-asc'){
    copy.sort((a,b) => (Number.isFinite(a.score) ? a.score : state.scale + 1) - (Number.isFinite(b.score) ? b.score : state.scale + 1));
  } else if (mode === 'name'){
    copy.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }
  state.gpaSubjects = copy;
  persistGPA();
  renderSubjects();
  calcGPA();
  toast('Đã sắp xếp');
});

// Delegated: input → sync + class + calc
$('gpa-subjects').addEventListener('input', () => {
  syncSubjectsFromDOM();
  updateRowClasses();
  persistGPA();
  calcGPA();
});

// Delegated: xóa môn
$('gpa-subjects').addEventListener('click', e => {
  const btn = e.target.closest('.subj-del');
  if (!btn) return;
  const row = btn.closest('.subject-row');
  const idx = parseInt(row.dataset.idx, 10);
  syncSubjectsFromDOM();
  state.gpaSubjects.splice(idx, 1);
  persistGPA();
  renderSubjects();
  calcGPA();
  toast('Đã xóa môn');
});

// Enter → nhảy ô tiếp theo trong row, hoặc tạo row mới nếu ở ô cuối
$('gpa-subjects').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const row = e.target.closest('.subject-row');
  if (!row) return;
  e.preventDefault();
  const fields = row.querySelectorAll('input');
  const curIdx = Array.from(fields).indexOf(e.target);
  if (curIdx < fields.length - 1){
    fields[curIdx + 1].focus();
    fields[curIdx + 1].select?.();
  } else {
    // Ở ô cuối cùng → thêm môn mới
    syncSubjectsFromDOM();
    state.gpaSubjects.push({ name: '', score: NaN, weight: 1 });
    persistGPA();
    renderSubjects();
    calcGPA();
    const rows = $$('#gpa-subjects .subject-row');
    rows[rows.length - 1].querySelector('.subj-name').focus();
  }
});

/* ========== COMPUTE ALL ========== */
function computeAll(){
  calcHK2();
  calcCK();
  calcTB();
  calcNam();
  calcGPA();
}

/* ========== REAL-TIME INPUT ========== */
['hk1','targets-hk2','tx-ck','gk-ck','targets-ck','tx-tb','gk-tb','ck-tb','hk1-nam','hk2-nam','target-nam']
  .forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', computeAll);
  });

/* ========== HISTORY ========== */
function saveHistoryToStorage(){ localStorage.setItem(LS.history, JSON.stringify(state.history)); }

function getCurrentResult(){
  const activeTab = document.querySelector('.tab-btn.active');
  if (!activeTab) return null;
  const resultEl = $(PANEL_RESULT[activeTab.dataset.panel]);
  if (!resultEl) return null;
  if (resultEl.classList.contains('empty') || resultEl.classList.contains('error')) return null;
  return { mode: activeTab.textContent.trim(), html: resultEl.innerHTML };
}

function renderHistory(){
  const list = $('history-list');
  const term = state.searchTerm.toLowerCase().trim();
  let items = state.history.slice();
  if (term){
    items = items.filter(it =>
      it.mode.toLowerCase().includes(term) ||
      it.content.toLowerCase().includes(term)
    );
  }
  if (!items.length){
    list.innerHTML = `<div class="empty-history">
      <i class="fas fa-inbox"></i>
      <p>${term ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có kết quả nào được lưu'}</p>
    </div>`;
    return;
  }
  list.innerHTML = items.map(it => `
    <div class="history-item" data-id="${it.id}">
      <div class="top">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="mode">${escapeHtml(it.mode)}</span>
          <span class="time"><i class="far fa-clock"></i> ${escapeHtml(it.time)}</span>
        </div>
        <div class="actions">
          <button class="restore" title="Khôi phục"><i class="fas fa-rotate-left"></i></button>
          <button class="del" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="content">${it.content}</div>
    </div>
  `).join('');
}

$('history-list').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const item = btn.closest('.history-item');
  const id = item.dataset.id;
  const idx = state.history.findIndex(h => h.id === id);
  if (idx === -1) return;

  if (btn.classList.contains('del')){
    state.history.splice(idx, 1);
    saveHistoryToStorage();
    renderHistory();
    toast('Đã xóa mục lịch sử');
  }
  else if (btn.classList.contains('restore')){
    const it = state.history[idx];
    const tabBtn = Array.from($$('.tab-btn')).find(b => b.textContent.trim() === it.mode);
    if (tabBtn){
      tabBtn.click();
      const resultEl = $(PANEL_RESULT[tabBtn.dataset.panel]);
      if (resultEl){
        resultEl.className = 'result';
        resultEl.innerHTML = it.html;
      }
      window.scrollTo({top:0, behavior:'smooth'});
      toast('Đã khôi phục kết quả');
    }
  }
});

$('save-history-btn').addEventListener('click', () => {
  const cur = getCurrentResult();
  if (!cur){ toast('Không có kết quả hợp lệ để lưu', 'error'); return; }
  state.history.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    mode: cur.mode,
    time: new Date().toLocaleString('vi-VN'),
    content: cur.html
  });
  if (state.history.length > 100) state.history.length = 100;
  saveHistoryToStorage();
  renderHistory();
  toast('Đã lưu vào lịch sử');
});

$('clear-history-btn').addEventListener('click', () => {
  if (!state.history.length) return toast('Lịch sử đã trống');
  if (confirm('Xóa toàn bộ lịch sử?')){
    state.history = [];
    saveHistoryToStorage();
    renderHistory();
    toast('Đã xóa toàn bộ lịch sử');
  }
});

const searchHistoryDebounced = debounce(renderHistory, 180);
$('history-search').addEventListener('input', e => {
  state.searchTerm = e.target.value;
  searchHistoryDebounced();
});

/* ========== COPY ========== */
$('copy-result-btn').addEventListener('click', () => {
  const cur = getCurrentResult();
  if (!cur) return toast('Không có kết quả để sao chép', 'error');
  const tmp = document.createElement('div');
  tmp.innerHTML = cur.html;
  const text = `[${cur.mode}]\n` + tmp.innerText.replace(/\n{3,}/g, '\n\n').trim();
  navigator.clipboard.writeText(text)
    .then(() => toast('Đã sao chép kết quả'))
    .catch(() => toast('Không thể sao chép', 'error'));
});

/* ========== SHORTCUTS ========== */
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 's'){
    e.preventDefault();
    $('save-history-btn').click();
  } else if (ctrl && e.key === '/'){
    e.preventDefault();
    $('history-search').focus();
  }
});


/* ========== THPT & ĐẠI HỌC LOGIC ========== */
(function initThptCalc(){
  const khoiLabels = {
    'A00': ['Toán', 'Vật Lý', 'Hóa Học'],
    'A01': ['Toán', 'Vật Lý', 'Tiếng Anh'],
    'B00': ['Toán', 'Hóa Học', 'Sinh Học'],
    'C00': ['Ngữ Văn', 'Lịch Sử', 'Địa Lý'],
    'D01': ['Toán', 'Ngữ Văn', 'Tiếng Anh'],
    'D07': ['Toán', 'Hóa Học', 'Tiếng Anh']
  };

  const selKhoi = $('dh-khoi');
  if (selKhoi) {
    selKhoi.addEventListener('change', () => {
      const labels = khoiLabels[selKhoi.value] || ['Môn 1', 'Môn 2', 'Môn 3'];
      $('lbl-m1').textContent = labels[0];
      $('lbl-m2').textContent = labels[1];
      $('lbl-m3').textContent = labels[2];
    });
  }

  // Tính Điểm Tốt Nghiệp
  const btnThpt = $('btn-calc-thpt');
  if (btnThpt) {
    btnThpt.addEventListener('click', () => {
      const toan = parseFloat($('thpt-toan').value);
      const van = parseFloat($('thpt-van').value);
      const anh = parseFloat($('thpt-anh').value);
      const tohop = parseFloat($('thpt-tohop').value);
      const tb12 = parseFloat($('thpt-tb12').value);
      const kk = parseFloat($('thpt-kk').value) || 0;
      const ut = parseFloat($('thpt-ut').value) || 0;

      const resBox = $('result-thpt');
      const calcEngine = window.THPTCalculator || (typeof THPTCalculator !== 'undefined' ? THPTCalculator : null);
      if (!calcEngine) {
        resBox.className = 'result error';
        resBox.textContent = 'Lỗi: Không tìm thấy module tính điểm THPT.';
        return;
      }

      const res = calcEngine.calculateGraduation({ toan, van, anh, tohop, tb12, kk, ut });
      if (!res.success) {
        resBox.className = 'result error';
        resBox.textContent = res.error;
        return;
      }

      const { rounded, isLiet, isPass, avg4Bai } = res;
      resBox.className = 'result ' + (isPass ? 'success' : 'danger');
      resBox.innerHTML = `
        <div class="big-value">
          <span class="num">${rounded.toFixed(2)}</span>
          <span class="sub">Điểm xét tốt nghiệp</span>
        </div>
        <div style="font-weight:700; margin-top:8px; font-size:1rem; color:${isPass ? 'var(--success)' : 'var(--danger)'}">
          ${isLiet ? '❌ KHÔNG ĐỖ (Có môn bị dính điểm liệt ≤ 1.0)' : isPass ? '🎉 ĐỦ ĐIỀU KIỆN TỐT NGHIỆP THPT!' : '❌ CHƯA ĐỦ ĐIỀU KIỆN TỐT NGHIỆP (< 5.0 điểm)'}
        </div>
        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:6px;">
          Điểm 4 bài thi TB: <strong>${avg4Bai.toFixed(2)}</strong> · TB lớp 12: <strong>${tb12}</strong> · Khuyến khích: <strong>${kk}</strong> · Ưu tiên: <strong>${ut}</strong>
        </div>
      `;
      resBox.classList.remove('empty');
      saveHistoryItem('Xét Tốt Nghiệp THPT', `${rounded.toFixed(2)} điểm · ${isPass ? 'ĐỖ' : 'TRƯỢT'}`);
    });
  }

  // Tính Điểm Đại Học
  const btnDh = $('btn-calc-dh');
  if (btnDh) {
    btnDh.addEventListener('click', () => {
      const m1 = parseFloat($('dh-m1').value);
      const m2 = parseFloat($('dh-m2').value);
      const m3 = parseFloat($('dh-m3').value);
      const kv = parseFloat($('dh-kv').value) || 0;
      const dt = parseFloat($('dh-dt').value) || 0;
      const khoi = $('dh-khoi').value;
      const resBox = $('result-dh');

      const calcEngine = window.THPTCalculator || (typeof THPTCalculator !== 'undefined' ? THPTCalculator : null);
      if (!calcEngine) {
        resBox.className = 'result error';
        resBox.textContent = 'Lỗi: Không tìm thấy module tính điểm THPT.';
        return;
      }

      const res = calcEngine.calculateUniversity({ m1, m2, m3, kv, dt, khoi });
      if (!res.success) {
        resBox.className = 'result error';
        resBox.textContent = res.error;
        return;
      }

      const { rawSum, adjustedUt, total, isDecreasedUt } = res;
      resBox.className = 'result success';
      resBox.innerHTML = `
        <div class="big-value">
          <span class="num">${total.toFixed(2)}</span>
          <span class="sub">Tổng điểm xét tuyển (${khoi})</span>
        </div>
        <div style="font-size:0.88rem; color:var(--text); margin-top:8px;">
          Điểm 3 môn gốc: <strong>${rawSum.toFixed(2)}</strong> + Điểm ưu tiên: <strong>${adjustedUt.toFixed(2)}</strong>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
          ${isDecreasedUt ? '⚡ Đã áp dụng công thức giảm trừ điểm ưu tiên cho mức điểm từ 22.5 trở lên theo quy chế Bộ GD&ĐT.' : 'Mức điểm ưu tiên theo khu vực & đối tượng.'}
        </div>
      `;
      resBox.classList.remove('empty');
      saveHistoryItem(`Xét Tuyển ĐH (${khoi})`, `${total.toFixed(2)} điểm (Gốc: ${rawSum.toFixed(2)} + UT: ${adjustedUt.toFixed(2)})`);
    });
  }
        </div>
      `;
      resBox.classList.remove('empty');
      saveHistoryItem(`Xét Đại Học ${khoi}`, `${finalScore.toFixed(2)} điểm (Gốc: ${rawSum.toFixed(2)})`);
    });
  }
})();

/* ========== INIT ========== */
function init(){
  applyTheme();
  applyScale();
  renderSubjects();
  computeAll();
  renderHistory();
}

if ($('gpa-print')) {
  $('gpa-print').addEventListener('click', () => {
    window.print();
  });
}

init();
})();
