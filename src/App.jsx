import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import FOOD_DB from "./foodData.js";

// ── Design tokens ─────────────────────────────────────────────────────
const C = {
  bg: "#F4EFE8", surface: "#FFFFFF", hdr: "#3D2210",
  primary: "#4A7A5A", primaryHover: "#3A6049",
  accent: "#B8692A", danger: "#DC2626", dangerBg: "#FEF2F2",
  warn: "#B45309", warnBg: "#FFFBEB", ok: "#166534", okBg: "#F0FDF4",
  border: "#E0D0BC", borderStrong: "#C4A87A",
  text: "#1C1915", textSub: "#44372A", textMuted: "#7A6A5A",
  protein: "#1D4ED8", fat: "#DC2626", carb: "#059669",
  fiber: "#7C3AED", sodium: "#0891B2",
};

// ── DRI (Taiwan 71+) ─────────────────────────────────────────────────
const DRI = {
  kcal: 1900, prot: 60, fat: 53, carb: 260,
  fib: 25, sod: 2300, pot: 2000, cal: 1000, pho: 800, iro: 10, vitC: 100,
};

// ── Disease configs ───────────────────────────────────────────────────
const DISEASES = {
  general: {
    label: "一般老年", icon: "👴", color: "#4A7A5A",
    limits: { sod: [0, 2300], prot: [50, 80], sug: [0, 50] },
    tips: ["每日熱量建議1600-2000 kcal", "蛋白質每公斤體重0.8-1g", "多補充鈣質與維生素D", "膳食纖維每日25g以上"],
  },
  diabetes: {
    label: "糖尿病", icon: "🩸", color: "#C07000",
    limits: { sug: [0, 25], carb: [0, 230], sod: [0, 2000] },
    tips: ["每餐醣類控制在45-60g", "選擇低GI食物（糙米、燕麥）", "少量多餐、定時定量", "避免含糖飲料與精製澱粉"],
  },
  kidney: {
    label: "腎臟病", icon: "🫘", color: "#7B4F2E",
    limits: { pot: [0, 2000], pho: [0, 800], prot: [0, 50], sod: [0, 1500] },
    tips: ["限鉀：每日2000mg以下", "限磷：每日800mg以下", "蛋白質以優質蛋白為主", "避免加工食品（含磷添加物）"],
  },
  hypertension: {
    label: "高血壓", icon: "❤️", color: "#C0392B",
    limits: { sod: [0, 1500], fat: [0, 40] },
    tips: ["每日鈉攝取低於1500mg", "DASH飲食：多蔬果全穀", "減少飽和脂肪與精製糖", "每日鉀攝取建議2000mg以上"],
  },
  gout: {
    label: "痛風", icon: "🦶", color: "#6B3FA0",
    limits: { prot: [0, 50] },
    tips: ["避免動物內臟、海鮮嘌呤", "每日飲水2000mL以上", "避免酒精飲料", "選擇低嘌呤蛋白質（蛋、乳製品）"],
  },
  hyperlipidemia: {
    label: "高血脂", icon: "🫀", color: "#1565C0",
    limits: { fat: [0, 44], satFat: [0, 15] },
    tips: ["減少飽和脂肪攝取", "增加Omega-3（魚類、亞麻籽）", "多選高纖食物降低膽固醇", "避免反式脂肪"],
  },
  custom: {
    label: "自訂", icon: "✏️", color: "#6B6B6B",
    limits: {},
    tips: ["依個別病人情況訂定飲食計畫", "請參考醫師及營養師建議"],
  },
};

// Resolve display config for a patient's disease (handles custom type)
const getDisease = p => {
  const base = DISEASES[p?.disease] || DISEASES.general;
  if (p?.disease === "custom" && p?.customDiseaseLabel) {
    return { ...base, label: p.customDiseaseLabel, icon: "✏️" };
  }
  return base;
};

// ── Meals ─────────────────────────────────────────────────────────────
const MEALS = [
  { id: "breakfast", label: "早餐", icon: "🌅", color: "#F59E0B", time: "07:00" },
  { id: "lunch",     label: "午餐", icon: "☀️",  color: "#10B981", time: "12:00" },
  { id: "dinner",    label: "晚餐", icon: "🌙",  color: "#6366F1", time: "18:00" },
  { id: "snack",     label: "點心", icon: "🍎",  color: "#EC4899", time: "15:00" },
];

// ── Food lookup (O(1)) ────────────────────────────────────────────────
const FOOD_MAP = new Map(FOOD_DB.map(f => [f.id, f]));
const CATEGORIES = ["全部", ...Array.from(new Set(FOOD_DB.map(f => f.cat))).filter(Boolean).sort()];

// ── Helpers ───────────────────────────────────────────────────────────
const nv = v => { const f = parseFloat(v); return isNaN(f) ? 0 : f; };
const uid = () => Math.random().toString(36).slice(2, 8);
const calcTDEE = p => {
  if (!p?.height || !p?.weight || !p?.age) return null;
  const bmr = p.gender === "男"
    ? 66 + 13.7 * +p.weight + 5 * +p.height - 6.8 * +p.age
    : 655 + 9.6 * +p.weight + 1.8 * +p.height - 4.7 * +p.age;
  return Math.round(bmr * 1.4);
};

const KEYS = ["kcal", "prot", "fat", "carb", "fib", "sod", "pot", "cal", "pho", "iro", "vitC"];

function sumItems(items) {
  const t = Object.fromEntries(KEYS.map(k => [k, 0]));
  items.forEach(({ foodId, grams }) => {
    const f = FOOD_MAP.get(foodId);
    if (!f) return;
    const r = nv(grams) / 100;
    KEYS.forEach(k => { t[k] += nv(f[k]) * r; });
  });
  return t;
}

// ── Storage ───────────────────────────────────────────────────────────
const PStore = {
  get: () => { try { return JSON.parse(localStorage.getItem("ng_pts") || "[]"); } catch { return []; } },
  set: list => localStorage.setItem("ng_pts", JSON.stringify(list)),
};

const TODAY = new Date().toLocaleDateString("zh-TW");
const EMPTY_PLAN = { breakfast: [], lunch: [], dinner: [], snack: [] };
const planKey = id => `ng_plan_${id || "anon"}_${TODAY}`;
const loadPlan = id => { try { const s = localStorage.getItem(planKey(id)); return s ? JSON.parse(s) : null; } catch { return null; } };
const savePlan = (id, plan) => localStorage.setItem(planKey(id), JSON.stringify(plan));

// ── Shared mini-button style ──────────────────────────────────────────
const btnMini = {
  width: 24, height: 24, border: `1.5px solid ${C.border}`,
  borderRadius: 5, background: C.surface, cursor: "pointer",
  fontSize: 14, fontWeight: 700, color: C.textSub, lineHeight: 1, padding: 0,
};

// ══════════════════════════════════════════════════════════════════════
// FOOD SEARCH MODAL
// ══════════════════════════════════════════════════════════════════════
function FoodSearchModal({ mealLabel, onAdd, onClose }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("全部");
  const [grams, setGrams] = useState({});
  const [added, setAdded] = useState({});
  const inputRef = useRef();
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const results = useMemo(() => {
    const query = q.toLowerCase().trim();
    return FOOD_DB.filter(f =>
      (cat === "全部" || f.cat === cat) &&
      (!query || f.name.toLowerCase().includes(query) || (f.alias || "").toLowerCase().includes(query))
    ).slice(0, 60);
  }, [q, cat]);

  const add = food => {
    const g = grams[food.id] || 100;
    onAdd(food, g);
    setAdded(p => ({ ...p, [food.id]: (p[food.id] || 0) + 1 }));
  };

  const getG = id => grams[id] || 100;
  const setG = (id, v) => setGrams(p => ({ ...p, [id]: Math.max(1, +v || 1) }));
  const stepG = (id, d) => setG(id, getG(id) + d);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 740, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.3)" }}>

        {/* Modal header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>🔍 新增食物 ─ {mealLabel}</div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.textMuted, lineHeight: 1, padding: "2px 8px" }}>×</button>
          </div>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="輸入食品名稱搜尋（如：白米飯、雞胸肉、花椰菜）…"
            style={{ width: "100%", padding: "10px 14px", fontSize: 15, border: `2px solid ${C.border}`, borderRadius: 9, outline: "none", color: C.text, background: "#FAFAFA" }}
            onFocus={e => e.target.style.borderColor = C.primary}
            onBlur={e => e.target.style.borderColor = C.border} />
          {/* Category pills */}
          <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
                padding: "3px 10px", borderRadius: 14,
                border: `1.5px solid ${cat === c ? C.primary : C.border}`,
                background: cat === c ? C.primary : "#fff",
                color: cat === c ? "#fff" : C.textSub,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Results list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {results.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted, fontSize: 14 }}>
              查無「{q}」的食品
            </div>
          )}
          {results.map(food => {
            const g = getG(food.id);
            const r = g / 100;
            const count = added[food.id] || 0;
            return (
              <div key={food.id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 20px", borderBottom: `1px solid ${C.border}30`, background: count ? "#F0FDF4" : "" }}
                onMouseEnter={e => { if (!count) e.currentTarget.style.background = "#FAF4EC"; }}
                onMouseLeave={e => { if (!count) e.currentTarget.style.background = ""; }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                    {food.name}
                    {food.alias && <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400 }}>({food.alias.split(",")[0]})</span>}
                    {count > 0 && <span style={{ fontSize: 11, background: C.okBg, color: C.ok, padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>✓ 已加入{count > 1 ? ` ×${count}` : ""}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    <span style={{ background: C.border + "50", padding: "1px 5px", borderRadius: 5, marginRight: 6 }}>{food.cat}</span>
                    每100g：<b style={{ color: C.accent }}>{food.kcal} kcal</b>
                    &nbsp;·&nbsp;蛋白 {nv(food.prot).toFixed(1)}g
                    &nbsp;·&nbsp;脂肪 {nv(food.fat).toFixed(1)}g
                    &nbsp;·&nbsp;碳水 {nv(food.carb).toFixed(1)}g
                    &nbsp;·&nbsp;鈉 {Math.round(nv(food.sod))}mg
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <button onClick={() => stepG(food.id, -10)} style={btnMini}>−</button>
                  <input type="number" min={1} value={grams[food.id] || 100}
                    onChange={e => setG(food.id, e.target.value)}
                    style={{ width: 58, textAlign: "center", padding: "4px 2px", fontSize: 13, fontWeight: 700, border: `1.5px solid ${C.border}`, borderRadius: 6, color: C.text }} />
                  <span style={{ fontSize: 11, color: C.textMuted }}>g</span>
                  <button onClick={() => stepG(food.id, 10)} style={btnMini}>+</button>
                  <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, minWidth: 58, textAlign: "right" }}>
                    {Math.round(nv(food.kcal) * r)} kcal
                  </div>
                  <button onClick={() => add(food)} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    + 加入
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            顯示 {results.length} 筆 &nbsp;·&nbsp; 共 {FOOD_DB.length} 筆食品（衛福部 2024）
          </div>
          <button onClick={onClose} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>完成</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MEAL SECTION
// ══════════════════════════════════════════════════════════════════════
function MealSection({ meal, items, onAddClick, onRemove, onGramsChange, diseaseKey }) {
  const sub = useMemo(() => sumItems(items), [items]);
  const disease = DISEASES[diseaseKey] || DISEASES.general;
  const warns = useMemo(() => {
    const w = [];
    if (disease.limits.sod && sub.sod > disease.limits.sod[1] * 0.42) w.push("鈉偏高");
    if (disease.limits.carb && sub.carb > disease.limits.carb[1] * 1.05) w.push("醣類超量");
    if (disease.limits.sug && (items.reduce((a, { foodId, grams }) => { const f = FOOD_MAP.get(foodId); return a + (f ? nv(f.sug) * grams / 100 : 0); }, 0)) > disease.limits.sug[1] * 0.5) w.push("糖份注意");
    return w;
  }, [sub, disease, items]);

  const COLS = [
    { h: "食品名稱", align: "left" },
    { h: "份量(g)", align: "center" },
    { h: "熱量(kcal)", align: "right" },
    { h: "蛋白質(g)", align: "right" },
    { h: "脂肪(g)", align: "right" },
    { h: "碳水(g)", align: "right" },
    { h: "纖維(g)", align: "right" },
    { h: "鈉(mg)", align: "right" },
    { h: "", align: "center" },
  ];

  return (
    <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 12, overflow: "hidden" }}>
      {/* Meal header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: meal.color + "18", borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 20 }}>{meal.icon}</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{meal.label}</span>
        <span style={{ fontSize: 11, color: C.textMuted, background: C.border + "60", padding: "1px 7px", borderRadius: 8 }}>{meal.time}</span>
        <div style={{ flex: 1 }} />
        {items.length > 0 && (
          <div style={{ display: "flex", gap: 12, fontSize: 12, alignItems: "center" }}>
            <span style={{ fontWeight: 900, color: meal.color, fontSize: 15 }}>{Math.round(sub.kcal)} kcal</span>
            <span style={{ color: C.textMuted }}>蛋白 <b style={{ color: C.protein }}>{sub.prot.toFixed(1)}</b>g</span>
            <span style={{ color: C.textMuted }}>脂肪 <b style={{ color: C.fat }}>{sub.fat.toFixed(1)}</b>g</span>
            <span style={{ color: C.textMuted }}>碳水 <b style={{ color: C.carb }}>{sub.carb.toFixed(1)}</b>g</span>
            <span style={{ color: C.textMuted }}>鈉 <b style={{ color: C.sodium }}>{Math.round(sub.sod)}</b>mg</span>
          </div>
        )}
        {warns.map(w => (
          <span key={w} style={{ fontSize: 11, background: C.warnBg, color: C.warn, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>⚠ {w}</span>
        ))}
      </div>

      {/* Food table */}
      {items.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#FAFAF5" }}>
                {COLS.map((col, i) => (
                  <th key={i} style={{ padding: "6px 8px", textAlign: col.align, fontWeight: 700, color: C.textMuted, fontSize: 11, whiteSpace: "nowrap" }}>{col.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, ri) => {
                const f = FOOD_MAP.get(item.foodId);
                if (!f) return null;
                const r = item.grams / 100;
                return (
                  <tr key={item.id} style={{ borderTop: `1px solid ${C.border}40`, background: ri % 2 === 0 ? "#fff" : "#FAFAF7" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: C.text, minWidth: 130 }}>
                      {f.name}
                      {f.alias && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>({f.alias.split(",")[0]})</span>}
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{f.cat}</div>
                    </td>
                    <td style={{ padding: "8px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <button onClick={() => onGramsChange(meal.id, item.id, Math.max(1, item.grams - 10))} style={btnMini}>−</button>
                        <input type="number" value={item.grams} min={1}
                          onChange={e => onGramsChange(meal.id, item.id, Math.max(1, +e.target.value || 1))}
                          style={{ width: 56, textAlign: "center", padding: "3px 2px", fontSize: 13, fontWeight: 700, border: `1.5px solid ${C.border}`, borderRadius: 6, color: C.text }} />
                        <button onClick={() => onGramsChange(meal.id, item.id, item.grams + 10)} style={btnMini}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 800, color: C.accent, fontSize: 14 }}>{Math.round(nv(f.kcal) * r)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: C.protein }}>{(nv(f.prot) * r).toFixed(1)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: C.fat }}>{(nv(f.fat) * r).toFixed(1)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: C.carb }}>{(nv(f.carb) * r).toFixed(1)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: C.fiber }}>{(nv(f.fib) * r).toFixed(1)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: C.sodium, fontSize: 12 }}>{Math.round(nv(f.sod) * r)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "center" }}>
                      <button onClick={() => onRemove(meal.id, item.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 18, lineHeight: 1, padding: 2, fontWeight: 900 }}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{ padding: "12px 16px 8px", fontSize: 13, color: C.textMuted }}>尚未加入任何食物</div>
      )}

      {/* Add button */}
      <div style={{ padding: "8px 12px" }}>
        <button onClick={() => onAddClick(meal.id)} style={{
          width: "100%", padding: "7px 0", border: `1.5px dashed ${C.border}`, borderRadius: 8,
          background: "none", color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; e.currentTarget.style.background = C.primary + "08"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = ""; }}>
          ＋ 新增食物至{meal.label}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// NUTRIENT PANEL
// ══════════════════════════════════════════════════════════════════════
const BARS = [
  { key: "prot", label: "蛋白質", unit: "g",  color: "#1D4ED8" },
  { key: "fat",  label: "脂肪",   unit: "g",  color: "#DC2626" },
  { key: "carb", label: "碳水化合物", unit: "g", color: "#059669" },
  { key: "fib",  label: "膳食纖維", unit: "g", color: "#7C3AED" },
  { key: "sod",  label: "鈉",     unit: "mg", color: "#0891B2" },
  { key: "pot",  label: "鉀",     unit: "mg", color: "#0D9488" },
  { key: "cal",  label: "鈣",     unit: "mg", color: "#2563EB" },
];

function NutrientPanel({ totals, patient, diseaseKey, plan, onPrint }) {
  const disease = getDisease(patient);
  const tdee = calcTDEE(patient);
  const hasFood = Object.values(plan).flat().length > 0;

  const targets = useMemo(() => {
    const base = { ...DRI };
    if (tdee) base.kcal = tdee;
    if (patient?.macroTargets) {
      Object.entries(patient.macroTargets).forEach(([k, v]) => { if (v) base[k] = +v; });
    }
    return base;
  }, [patient, tdee]);

  const warnings = useMemo(() => {
    return Object.entries(disease.limits).flatMap(([k, [lo, hi]]) => {
      const v = totals[k] || 0;
      const b = BARS.find(x => x.key === k);
      const label = b?.label || k;
      const unit = b?.unit || "";
      if (v > hi * 1.02) return [{ type: "over", msg: `${label} 超過上限（${unit === "mg" ? Math.round(v) : v.toFixed(1)} / ${hi}${unit}）` }];
      if (lo > 0 && v < lo * 0.8 && hasFood) return [{ type: "under", msg: `${label} 攝取不足（${v.toFixed(1)} / ${lo}${unit}）` }];
      return [];
    });
  }, [totals, disease, hasFood]);

  const kcalPct = targets.kcal ? Math.round(totals.kcal / targets.kcal * 100) : 0;
  const chartData = [
    { name: "蛋白質", kcal: Math.round(nv(totals.prot) * 4), fill: C.protein },
    { name: "脂肪",   kcal: Math.round(nv(totals.fat) * 9),  fill: C.fat },
    { name: "碳水",   kcal: Math.round(nv(totals.carb) * 4), fill: C.carb },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>

      {/* Kcal hero card */}
      <div style={{ background: "#3D2210", color: "#fff", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 10, opacity: .65, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>今日攝取熱量</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 42, fontWeight: 900, lineHeight: 1 }}>{Math.round(totals.kcal)}</span>
          <span style={{ fontSize: 14, opacity: .7 }}>/ {targets.kcal} kcal</span>
        </div>
        <div style={{ height: 8, background: "rgba(255,255,255,.2)", borderRadius: 4, overflow: "hidden", marginBottom: 7 }}>
          <div style={{ height: "100%", width: `${Math.min(kcalPct, 100)}%`, background: kcalPct > 105 ? "#F87171" : "#F5C98A", borderRadius: 4, transition: "width .5s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: .65 }}>
          <span>{kcalPct}% 已達成</span>
          <span>剩餘 {Math.max(0, targets.kcal - Math.round(totals.kcal))} kcal</span>
        </div>
        {tdee && <div style={{ fontSize: 10, opacity: .5, marginTop: 5 }}>TDEE 估算（Harris-Benedict × 輕度活動 1.4）</div>}
      </div>

      {/* Progress bars */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".7px" }}>
          每日攝取進度 {patient?.macroTargets && Object.keys(patient.macroTargets).length > 0 ? "（個人目標）" : "（DRI 建議值）"}
        </div>
        {BARS.map(b => {
          const val = totals[b.key] || 0;
          const tgt = targets[b.key];
          if (!tgt) return null;
          const pct = Math.min(Math.round(val / tgt * 100), 120);
          const over = pct > 100;
          const barColor = over ? C.danger : pct >= 70 ? C.ok : b.color;
          return (
            <div key={b.key} style={{ marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textSub }}>{b.label}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>
                  <b style={{ color: barColor, fontSize: 13 }}>{b.unit === "mg" ? Math.round(val) : val.toFixed(1)}</b>
                  <span style={{ margin: "0 2px" }}>/</span>{tgt}{b.unit}
                  <span style={{ marginLeft: 4, color: over ? C.danger : C.textMuted }}>({pct}%)</span>
                </span>
              </div>
              <div style={{ height: 7, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 4, transition: "width .4s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Macro energy chart */}
      {hasFood && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 12px 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".7px" }}>三大營養素熱量分布 (kcal)</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => [`${v} kcal`]} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1.5px solid ${C.dangerBg}`, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".7px" }}>⚠ 疾病飲食警示</div>
          {warnings.map((w, i) => (
            <div key={i} style={{
              padding: "7px 11px", borderRadius: 7, marginBottom: 5,
              background: w.type === "over" ? C.dangerBg : C.warnBg,
              color: w.type === "over" ? C.danger : C.warn,
              fontWeight: 600, fontSize: 12, display: "flex", gap: 6,
            }}>
              {w.type === "over" ? "🔴" : "🟡"} {w.msg}
            </div>
          ))}
        </div>
      )}

      {/* Disease tips */}
      <div style={{ background: disease.color + "10", border: `1.5px solid ${disease.color}40`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontWeight: 800, color: disease.color, marginBottom: 8, fontSize: 13 }}>{disease.icon} {disease.label} 衛教重點</div>
        {disease.tips.map((t, i) => (
          <div key={i} style={{ fontSize: 12, color: disease.color, marginBottom: 5, display: "flex", gap: 5 }}>
            <span style={{ opacity: .6 }}>•</span><span>{t}</span>
          </div>
        ))}
      </div>

      {/* Print */}
      <button onClick={onPrint} style={{
        width: "100%", padding: "12px", background: "#3D2210", color: "#fff",
        border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        🖨 列印 / 匯出菜單
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// PATIENT FORM
// ══════════════════════════════════════════════════════════════════════
const BLANK_P = { name: "", age: "", gender: "女", height: "", weight: "", disease: "general", customDiseaseLabel: "", note: "", macroTargets: {} };

function PatientForm({ onSave, onCancel }) {
  const [f, setF] = useState(BLANK_P);
  const [showMT, setShowMT] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setMT = (k, v) => setF(p => ({ ...p, macroTargets: { ...p.macroTargets, [k]: v ? +v : undefined } }));
  const save = () => {
    if (!f.name.trim()) return alert("請輸入病人姓名");
    if (f.disease === "custom" && !f.customDiseaseLabel.trim()) return alert("請輸入自訂疾病名稱");
    const targets = Object.fromEntries(Object.entries(f.macroTargets).filter(([, v]) => v != null && !isNaN(v)));
    onSave({ id: uid(), ...f, macroTargets: targets, createdAt: new Date().toLocaleDateString("zh-TW") });
  };

  const inpS = { width: "100%", padding: "7px 9px", fontSize: 13, border: `1.5px solid ${C.border}`, borderRadius: 7, color: C.text, background: "#fff" };
  const lblS = { fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 3, display: "block" };

  return (
    <div style={{ background: "#F4EFE8", borderRadius: 10, padding: "14px 12px", marginBottom: 14, border: `1.5px solid ${C.border}` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 12 }}>新增病人</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {[{ k: "name", l: "姓名 *", t: "text", ph: "王大明" }, { k: "age", l: "年齡", t: "number", ph: "75" }, { k: "height", l: "身高 (cm)", t: "number", ph: "160" }, { k: "weight", l: "體重 (kg)", t: "number", ph: "60" }]
          .map(({ k, l, t, ph }) => (
            <div key={k}><label style={lblS}>{l}</label>
              <input type={t} placeholder={ph} value={f[k]} onChange={e => set(k, e.target.value)} style={inpS} />
            </div>
          ))}
        <div><label style={lblS}>性別</label>
          <select value={f.gender} onChange={e => set("gender", e.target.value)} style={inpS}>
            <option>女</option><option>男</option>
          </select>
        </div>
        <div><label style={lblS}>疾病類型</label>
          <select value={f.disease} onChange={e => set("disease", e.target.value)} style={inpS}>
            {Object.entries(DISEASES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
      </div>
      {f.disease === "custom" && (
        <div style={{ marginBottom: 8 }}>
          <label style={lblS}>自訂疾病名稱 *</label>
          <input type="text" placeholder="例：骨質疏鬆、肌少症、術後恢復…" value={f.customDiseaseLabel}
            onChange={e => set("customDiseaseLabel", e.target.value)} style={inpS} />
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <label style={lblS}>備註（過敏 / 特殊需求）</label>
        <input type="text" placeholder="例：對花生過敏、低鈉飲食需求…" value={f.note} onChange={e => set("note", e.target.value)} style={inpS} />
      </div>

      <button onClick={() => setShowMT(t => !t)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.primary, fontWeight: 700, padding: "0 0 6px", display: "flex", alignItems: "center", gap: 4 }}>
        {showMT ? "▾" : "▸"} 個人化每日目標（選填，空白則使用 DRI 預設值）
      </button>
      {showMT && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 10, padding: 10, background: "#fff", borderRadius: 8, border: `1px solid ${C.border}` }}>
          {[{ k: "kcal", l: "熱量(kcal)", ph: "1900" }, { k: "prot", l: "蛋白質(g)", ph: "60" }, { k: "fat", l: "脂肪(g)", ph: "53" }, { k: "carb", l: "碳水(g)", ph: "260" }, { k: "fib", l: "纖維(g)", ph: "25" }, { k: "sod", l: "鈉上限(mg)", ph: "2300" }]
            .map(({ k, l, ph }) => (
              <div key={k}><label style={lblS}>{l}</label>
                <input type="number" placeholder={ph} value={f.macroTargets[k] || ""} onChange={e => setMT(k, e.target.value)} style={inpS} />
              </div>
            ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={save} style={{ flex: 1, padding: "9px", background: C.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✓ 儲存病人</button>
        <button onClick={onCancel} style={{ padding: "9px 14px", background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.textSub }}>取消</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// PRINT VIEW
// ══════════════════════════════════════════════════════════════════════
function PrintView({ patient, plan, totals, diseaseKey }) {
  const disease = getDisease(patient);
  const tdee = calcTDEE(patient);
  const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <div id="print-area">
      <div style={{ fontFamily: "'Noto Sans TC','PingFang TC',sans-serif", color: "#1C1915", maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        {/* Print header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid #3D2210", paddingBottom: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#3D2210" }}>🥗 NutriGuide 個人化營養菜單</div>
            <div style={{ fontSize: 12, color: "#7A6A5A", marginTop: 3 }}>{today} ｜ {disease.icon} {disease.label}</div>
          </div>
          <div style={{ fontSize: 11, color: "#9C8A78", textAlign: "right" }}>衛福部食品營養成分資料庫 2024<br />僅供衛教參考，請依醫師及營養師建議</div>
        </div>

        {/* Patient info */}
        {patient && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, background: "#F5E9D8", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
            {[
              { l: "病人姓名", v: patient.name },
              { l: "年齡/性別", v: `${patient.age}歲 ${patient.gender}` },
              { l: "身高/體重", v: `${patient.height}cm / ${patient.weight}kg` },
              { l: "疾病診斷", v: `${disease.icon} ${disease.label}` },
              { l: "建議熱量", v: tdee ? `${tdee} kcal/日` : "DRI 1900 kcal/日" },
            ].map(({ l, v }) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: "#9C8A78" }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>{v}</div>
              </div>
            ))}
            {patient.note && <div style={{ gridColumn: "1/-1", fontSize: 11, color: "#7A6A5A", marginTop: 4 }}>備註：{patient.note}</div>}
          </div>
        )}

        {/* Meal tables */}
        {MEALS.map(meal => {
          const items = plan[meal.id] || [];
          if (!items.length) return null;
          const sub = sumItems(items);
          return (
            <div key={meal.id} style={{ marginBottom: 18, pageBreakInside: "avoid" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#3D2210", marginBottom: 6, borderLeft: "4px solid #3D2210", paddingLeft: 10, display: "flex", gap: 14, alignItems: "center" }}>
                <span>{meal.icon} {meal.label}</span>
                <span style={{ color: "#B8692A" }}>{Math.round(sub.kcal)} kcal</span>
                <span style={{ fontSize: 12, color: "#7A6A5A", fontWeight: 400 }}>蛋白 {sub.prot.toFixed(1)}g · 脂肪 {sub.fat.toFixed(1)}g · 碳水 {sub.carb.toFixed(1)}g · 鈉 {Math.round(sub.sod)}mg</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#3D2210", color: "#fff" }}>
                    {["食品名稱", "份量(g)", "熱量(kcal)", "蛋白質(g)", "脂肪(g)", "碳水(g)", "纖維(g)", "鈉(mg)"].map((h, i) => (
                      <th key={i} style={{ padding: "6px 8px", textAlign: i <= 1 ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, ri) => {
                    const f = FOOD_MAP.get(item.foodId);
                    if (!f) return null;
                    const r = item.grams / 100;
                    return (
                      <tr key={item.id} style={{ background: ri % 2 === 0 ? "#fff" : "#F5EDE0" }}>
                        <td style={{ padding: "5px 8px", fontWeight: 600 }}>{f.name}{f.alias ? ` (${f.alias.split(",")[0]})` : ""}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center" }}>{item.grams}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>{Math.round(nv(f.kcal) * r)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>{(nv(f.prot) * r).toFixed(1)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>{(nv(f.fat) * r).toFixed(1)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>{(nv(f.carb) * r).toFixed(1)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>{(nv(f.fib) * r).toFixed(1)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>{Math.round(nv(f.sod) * r)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#DDD0BC", fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: "5px 8px" }}>小計</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>{Math.round(sub.kcal)}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>{sub.prot.toFixed(1)}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>{sub.fat.toFixed(1)}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>{sub.carb.toFixed(1)}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>{sub.fib.toFixed(1)}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>{Math.round(sub.sod)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Daily totals */}
        <div style={{ background: "#3D2210", color: "#fff", borderRadius: 8, padding: "14px 18px", marginBottom: 18, pageBreakInside: "avoid" }}>
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 13 }}>全日營養攝取總計</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, textAlign: "center" }}>
            {[
              { l: "熱量",   v: Math.round(totals.kcal),    u: "kcal" },
              { l: "蛋白質", v: totals.prot.toFixed(1),     u: "g" },
              { l: "脂肪",   v: totals.fat.toFixed(1),      u: "g" },
              { l: "碳水",   v: totals.carb.toFixed(1),     u: "g" },
              { l: "纖維",   v: totals.fib.toFixed(1),      u: "g" },
              { l: "鈉",     v: Math.round(totals.sod),     u: "mg" },
              { l: "鉀",     v: Math.round(totals.pot || 0), u: "mg" },
            ].map(t => (
              <div key={t.l} style={{ background: "rgba(255,255,255,.15)", borderRadius: 6, padding: "8px 4px" }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{t.v}</div>
                <div style={{ fontSize: 10, opacity: .7 }}>{t.u}</div>
                <div style={{ fontSize: 11, opacity: .65, marginTop: 2 }}>{t.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Diet tips */}
        <div style={{ marginBottom: 18, pageBreakInside: "avoid" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#3D2210", marginBottom: 8, borderLeft: "4px solid #3D2210", paddingLeft: 8 }}>飲食衛教重點</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {disease.tips.map((t, i) => (
              <div key={i} style={{ padding: "6px 10px", background: "#F5E9D8", borderRadius: 6, fontSize: 12 }}>{i + 1}. {t}</div>
            ))}
          </div>
        </div>

        {/* Signature */}
        <div style={{ borderTop: "1px solid #DEC9A8", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9C8A78" }}>
          <div>NutriGuide 系統產生 ｜ 資料來源：衛福部食品營養成分資料庫 2024</div>
          <div>營養師簽名：_______________________　　日期：___________</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [patients, setPatients] = useState(() => PStore.get());
  const [current, setCurrent] = useState(null);
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [modal, setModal] = useState(null);   // mealId | null
  const [showAdd, setShowAdd] = useState(false);

  const totals = useMemo(() => {
    const t = { kcal: 0, prot: 0, fat: 0, carb: 0, fib: 0, sod: 0, pot: 0, cal: 0, pho: 0, iro: 0, vitC: 0 };
    Object.values(plan).flat().forEach(({ foodId, grams }) => {
      const f = FOOD_MAP.get(foodId);
      if (!f) return;
      const r = nv(grams) / 100;
      KEYS.forEach(k => { t[k] += nv(f[k]) * r; });
    });
    return t;
  }, [plan]);

  const diseaseKey = current?.disease || "general";

  useEffect(() => { PStore.set(patients); }, [patients]);

  // Load this patient's plan whenever the selected patient changes
  useEffect(() => {
    setPlan(loadPlan(current?.id) || EMPTY_PLAN);
  }, [current?.id]);

  // Auto-save whenever the plan changes (current is captured in closure at render time)
  useEffect(() => {
    savePlan(current?.id, plan);
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePatient = useCallback(p => { setPatients(ps => [...ps, p]); setCurrent(p); setShowAdd(false); }, []);
  const delPatient  = useCallback(id => { setPatients(ps => ps.filter(p => p.id !== id)); setCurrent(c => c?.id === id ? null : c); }, []);

  const addFood = useCallback((mealId, food, grams) => {
    setPlan(p => ({ ...p, [mealId]: [...p[mealId], { id: uid(), foodId: food.id, grams }] }));
  }, []);

  const removeFood = useCallback((mealId, itemId) => {
    setPlan(p => ({ ...p, [mealId]: p[mealId].filter(i => i.id !== itemId) }));
  }, []);

  const setGrams = useCallback((mealId, itemId, grams) => {
    setPlan(p => ({ ...p, [mealId]: p[mealId].map(i => i.id === itemId ? { ...i, grams } : i) }));
  }, []);

  const clearPlan = () => { if (window.confirm("確定要清空今日所有餐次？")) setPlan({ breakfast: [], lunch: [], dinner: [], snack: [] }); };
  const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans TC','PingFang TC',sans-serif", color: C.text, fontSize: 14 }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #C4A87A44; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #C4A87A; }
        #print-area { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #print-area { display: block !important; visibility: visible !important; position: fixed !important; inset: 0; background: #fff; z-index: 9999; overflow: auto; }
          #print-area * { visibility: visible !important; }
        }
      `}</style>

      {/* Food search modal */}
      {modal && (
        <FoodSearchModal
          mealLabel={MEALS.find(m => m.id === modal)?.label || ""}
          onAdd={(food, g) => addFood(modal, food, g)}
          onClose={() => setModal(null)} />
      )}

      {/* Header */}
      <header style={{ background: "#3D2210", color: "#fff", height: 56, display: "flex", alignItems: "center", padding: "0 20px", gap: 14, position: "sticky", top: 0, zIndex: 200, boxShadow: "0 2px 12px rgba(0,0,0,.28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🥗</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "Georgia,serif", lineHeight: 1.1 }}>NutriGuide</div>
            <div style={{ fontSize: 9, opacity: .55, letterSpacing: "1.5px", textTransform: "uppercase" }}>Professional Nutrition Planner</div>
          </div>
        </div>
        <div style={{ height: 28, width: 1, background: "rgba(255,255,255,.18)", margin: "0 4px" }} />
        <div style={{ fontSize: 12, opacity: .6 }}>{today}</div>
        <div style={{ flex: 1 }} />
        {current && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.14)", borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ fontSize: 16 }}>{getDisease(current).icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{current.name}</div>
              <div style={{ fontSize: 10, opacity: .65 }}>{getDisease(current).label} · {current.age}歲 {current.gender}</div>
            </div>
          </div>
        )}
        <button onClick={clearPlan} style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 7, padding: "6px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          🗑 清空菜單
        </button>
        <button onClick={() => window.print()} style={{ background: "#F5C98A", color: "#3D2210", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
          🖨 列印菜單
        </button>
      </header>

      {/* Three-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "268px 1fr 310px", height: "calc(100vh - 56px)" }}>

        {/* LEFT — Patient sidebar */}
        <div style={{ background: C.surface, borderRight: `1px solid ${C.border}`, overflowY: "auto", padding: "16px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>病人管理</div>
            <button onClick={() => setShowAdd(a => !a)} style={{
              background: showAdd ? C.danger : C.primary, color: "#fff", border: "none",
              borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{showAdd ? "✕ 取消" : "+ 新增病人"}</button>
          </div>

          {showAdd && <PatientForm onSave={savePatient} onCancel={() => setShowAdd(false)} />}

          {patients.length === 0 && !showAdd ? (
            <div style={{ textAlign: "center", padding: "28px 12px", color: C.textMuted, fontSize: 13, lineHeight: 1.9 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👤</div>
              尚無病人資料<br />點選「+ 新增病人」開始建立
            </div>
          ) : (
            patients.map(p => {
              const isCur = current?.id === p.id;
              const dis = getDisease(p);
              const tdee = calcTDEE(p);
              const bmi = p.height && p.weight ? (+p.weight / (+p.height / 100) ** 2).toFixed(1) : null;
              return (
                <div key={p.id} onClick={() => setCurrent(isCur ? null : p)} style={{
                  border: `2px solid ${isCur ? C.primary : C.border}`,
                  background: isCur ? "#EFF5E8" : "#fff",
                  borderRadius: 10, padding: "10px 12px", marginBottom: 8, cursor: "pointer",
                  transition: "border-color .15s, background .15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {p.gender} · {p.age}歲 · {p.height}cm / {p.weight}kg{bmi ? ` · BMI ${bmi}` : ""}
                      </div>
                      {tdee && <div style={{ fontSize: 11, color: C.primary, fontWeight: 700, marginTop: 2 }}>建議熱量 {tdee} kcal/日</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                      <span style={{ fontSize: 11, background: dis.color + "20", color: dis.color, padding: "2px 8px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{dis.icon} {dis.label}</span>
                      <button onClick={e => { e.stopPropagation(); delPatient(p.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 12, padding: 0, opacity: .7 }}>🗑 刪除</button>
                    </div>
                  </div>
                  {p.note && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>📝 {p.note}</div>}
                  {isCur && <div style={{ marginTop: 6, fontSize: 11, color: C.primary, fontWeight: 700 }}>● 目前衛教中</div>}
                </div>
              );
            })
          )}
        </div>

        {/* CENTER — Meal planner */}
        <div style={{ overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>今日菜單</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                點選「＋ 新增食物」為各餐次加入食材 · 直接輸入或點 +/− 調整份量
              </div>
            </div>
            {current && (
              <div style={{ background: (getDisease(current).color || C.primary) + "18", color: getDisease(current).color || C.primary, padding: "5px 14px", borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                {getDisease(current).icon} {getDisease(current).label} 模式
              </div>
            )}
          </div>

          {MEALS.map(meal => (
            <MealSection key={meal.id}
              meal={meal} items={plan[meal.id]}
              onAddClick={id => setModal(id)}
              onRemove={removeFood}
              onGramsChange={setGrams}
              diseaseKey={diseaseKey} />
          ))}

          {/* Day total summary bar */}
          {Object.values(plan).flat().length > 0 && (
            <div style={{ background: "#3D2210", color: "#fff", borderRadius: 12, padding: "14px 20px", marginTop: 4 }}>
              <div style={{ fontSize: 11, opacity: .65, textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 10 }}>全日合計</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, textAlign: "center" }}>
                {[
                  { l: "熱量",   v: `${Math.round(totals.kcal)}`, u: "kcal" },
                  { l: "蛋白質", v: totals.prot.toFixed(1),        u: "g" },
                  { l: "脂肪",   v: totals.fat.toFixed(1),         u: "g" },
                  { l: "碳水",   v: totals.carb.toFixed(1),        u: "g" },
                  { l: "纖維",   v: totals.fib.toFixed(1),         u: "g" },
                  { l: "鈉",     v: `${Math.round(totals.sod)}`,   u: "mg" },
                ].map(t => (
                  <div key={t.l} style={{ background: "rgba(255,255,255,.12)", borderRadius: 8, padding: "8px 4px" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{t.v}</div>
                    <div style={{ fontSize: 10, opacity: .65 }}>{t.u}</div>
                    <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{t.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Nutrient panel */}
        <div style={{ background: C.surface, borderLeft: `1px solid ${C.border}`, overflowY: "auto", padding: "16px 14px" }}>
          <NutrientPanel totals={totals} patient={current} diseaseKey={diseaseKey} plan={plan} onPrint={() => window.print()} />
        </div>
      </div>

      {/* Hidden print view */}
      <PrintView patient={current} plan={plan} totals={totals} diseaseKey={diseaseKey} />
    </div>
  );
}
