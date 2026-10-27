'use strict';
window.SatoruAppStartup=function(){
if(window.SatoruLiveBridge)return;
var SatoruLiveModel = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/live/model.ts
  var model_exports = {};
  __export(model_exports, {
    accentText: () => accentText,
    accessibleAccent: () => accessibleAccent,
    buildTask: () => buildTask,
    calendarChanges: () => calendarChanges,
    calendarPlan: () => calendarPlan,
    contrast: () => contrast,
    decodeRoutePart: () => decodeRoutePart,
    editWorldTree: () => editWorldTree,
    editable: () => editable,
    fields: () => fields,
    goalMapContext: () => goalMapContext,
    goalMutation: () => goalMutation,
    goalTypes: () => goalTypes,
    initialAppNavigation: () => initialAppNavigation,
    moveTasks: () => moveTasks,
    personalRewardLabel: () => personalRewardLabel,
    project: () => project,
    projectTask: () => projectTask,
    reconcileRewardTasks: () => reconcileRewardTasks,
    rewardProjection: () => rewardProjection,
    rewardReceiptArt: () => rewardReceiptArt,
    savePersonalReward: () => savePersonalReward,
    saveWeek: () => saveWeek,
    saveWorldEpisode: () => saveWorldEpisode,
    schedule: () => schedule,
    worldKind: () => worldKind,
    worldProgress: () => worldProgress
  });

  // src/components/generated/B2Model.ts
  function day(d = /* @__PURE__ */ new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function shift(key, n) {
    const d = /* @__PURE__ */ new Date(key + "T12:00:00");
    d.setDate(d.getDate() + n);
    return day(d);
  }
  var spheres = [{ id: "work", name: "\u0420\u0430\u0431\u043E\u0442\u0430", color: "#22c1a4", children: ["\u041F\u0440\u043E\u0435\u043A\u0442\u044B", "Satoru"] }, { id: "study", name: "\u0423\u0447\u0451\u0431\u0430", color: "#4f86f7", children: ["\u042F\u0437\u044B\u043A\u0438", "\u041D\u0435\u043C\u0435\u0446\u043A\u0438\u0439"] }, { id: "sport", name: "\u0421\u043F\u043E\u0440\u0442", color: "#e0526a", children: ["\u0422\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0438", "\u0412\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u043E\u0441\u0442\u044C"] }, { id: "health", name: "\u0417\u0434\u043E\u0440\u043E\u0432\u044C\u0435", color: "#5fbf5f", children: ["\u0421\u043E\u043D", "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435"] }, { id: "mind", name: "\u0421\u0430\u043C\u043E\u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0435", color: "#b06ff0", children: ["\u0427\u0442\u0435\u043D\u0438\u0435", "\u0422\u0432\u043E\u0440\u0447\u0435\u0441\u0442\u0432\u043E"] }, { id: "life", name: "\u0411\u044B\u0442", color: "#d8a44b", children: ["\u0414\u043E\u043C", "\u041B\u0438\u0447\u043D\u044B\u0435 \u0434\u0435\u043B\u0430"] }];
  var sphereOptions = spheres.flatMap((s) => [{ id: s.id, name: s.name, color: s.color }, ...s.children.map((c, i) => ({ id: s.id + "/" + i, name: s.name + " \u203A " + c, color: s.color }))]);

  // src/components/generated/PlanModel.ts
  var monday = (date) => shift(date, -(((/* @__PURE__ */ new Date(date + "T12:00:00")).getDay() + 6) % 7));
  function validDate(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && day(/* @__PURE__ */ new Date(date + "T12:00:00")) === date;
  }

  // src/live/plan-model.ts
  var goalTypes = { mission: "\u041C\u0438\u0441\u0441\u0438\u044F", vision: "\u0412\u0438\u0434\u0435\u043D\u0438\u0435", path: "\u041F\u0443\u0442\u044C", long: "\u0414\u043E\u043B\u0433\u043E\u0441\u0440\u043E\u0447\u043D\u0430\u044F", mid: "\u0421\u0440\u0435\u0434\u043D\u0435\u0441\u0440\u043E\u0447\u043D\u0430\u044F", short: "\u041A\u0440\u0430\u0442\u043A\u043E\u0441\u0440\u043E\u0447\u043D\u0430\u044F", recurring: "\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0430\u044F\u0441\u044F" };
  function decodeRoutePart(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return "";
    }
  }
  function goalMapContext(goals, selected) {
    const ids = new Set(selected), pending = [...selected];
    while (pending.length) {
      const id = pending.shift(), g = goals.find((g2) => g2.id === id);
      if (g?.parentId && !ids.has(g.parentId)) {
        ids.add(g.parentId);
        pending.push(g.parentId);
      }
    }
    return goals.filter((g) => ids.has(g.id));
  }
  function fresh(value, base) {
    if ((value ? JSON.stringify(value) : null) !== base) throw Error("\u0417\u0430\u043F\u0438\u0441\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C. \u0417\u0430\u043A\u0440\u043E\u0439 \u0444\u043E\u0440\u043C\u0443 \u0438 \u043E\u0442\u043A\u0440\u043E\u0439 \u0435\u0451 \u0437\u0430\u043D\u043E\u0432\u043E. \u0422\u0432\u043E\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.");
  }
  function title(value, max = 160) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw Error(`\u041D\u0430\u043F\u0438\u0448\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043E ${max} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.`);
    return value.trim();
  }
  function graphCheck(g, edited) {
    for (const id of edited) {
      const v = g.goals.find((x) => x.id === id);
      if (!v) continue;
      if (!goalTypes[v.type || ""]) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442 \u0446\u0435\u043B\u0438.");
      if (v.targetDate && !validDate(v.targetDate)) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u0440\u043E\u043A \u0446\u0435\u043B\u0438.");
      const ids = v.skillIds?.length ? v.skillIds : v.skillId ? [v.skillId] : [];
      if (!ids.length || [...ids, ...v.backgroundSkillIds || []].some((id2) => !g.skills?.some((s) => s.id === id2)) || (v.backgroundSkillIds || []).length > 3) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0438 \u0434\u043E \u0442\u0440\u0451\u0445 \u0441\u043E\u043F\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0445 \u0441\u0444\u0435\u0440 \u0441\u0432\u043E\u0435\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430.");
      if (v.groupId && !g.groups.some((p2) => p2.id === v.groupId)) throw Error("\u041F\u0440\u043E\u0435\u043A\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.");
      let p = v;
      const seen = /* @__PURE__ */ new Set();
      while (p) {
        if (seen.has(p.id)) throw Error("\u0426\u0435\u043B\u0438 \u043D\u0435\u043B\u044C\u0437\u044F \u0441\u0432\u044F\u0437\u0430\u0442\u044C \u0432 \u043A\u0440\u0443\u0433.");
        seen.add(p.id);
        if (p.parentId && !g.goals.some((x) => x.id === p.parentId)) throw Error("\u0420\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u0441\u043A\u0430\u044F \u0446\u0435\u043B\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.");
        p = p.parentId ? g.goals.find((x) => x.id === p.parentId) : void 0;
      }
    }
  }
  function goalMutation(source, command, input, now, rewards, today = now.slice(0, 10)) {
    const g = structuredClone(source), edited = [];
    const requireGoal = (id) => {
      const v = g.goals.find((x) => x.id === id);
      if (!v) throw Error("\u0426\u0435\u043B\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.");
      return v;
    };
    if (command === "goal.save") {
      const p = input.goal, old = g.goals.find((x) => x.id === p.id);
      fresh(old, input.base);
      if (typeof p.id !== "string" || !p.id || p.id.length > 120) throw Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0446\u0435\u043B\u0438.");
      const primary = [...new Set(p.skillIds?.length ? p.skillIds : p.skillId ? [p.skillId] : [])], background = [...new Set(p.backgroundSkillIds || [])].filter((id) => !primary.includes(id));
      const metric = p.metric == null ? null : { ...old?.metric || {}, start: Number(p.metric.start), current: Number(p.metric.current), target: Number(p.metric.target), unit: String(p.metric.unit || "").slice(0, 12), lowerBetter: !!p.metric.lowerBetter, maintain: !!p.metric.maintain, log: old?.metric?.log || [] };
      if (metric && ![metric.start, metric.current, metric.target].every(Number.isFinite)) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0447\u0438\u0441\u043B\u0430 \u043C\u0435\u0442\u0440\u0438\u043A\u0438.");
      const v = { ...old || { id: p.id, createdAt: now, status: "active", completedAt: null, archived: false, steps: [] }, title: title(p.title), description: String(p.description || "").trim().slice(0, 800), type: p.type, skillId: primary[0], skillIds: primary, backgroundSkillIds: background, parentId: p.parentId || null, groupId: p.groupId || null, targetDate: p.targetDate || null, metric, progressKind: metric ? "metric" : "checklist", xpReward: old?.xpReward ?? rewards[p.type] ?? 0 };
      if (!old && p.firstStep?.trim()) v.steps = [{ id: p.firstStepId, title: title(p.firstStep), done: false }];
      g.goals = old ? g.goals.map((x) => x.id === v.id ? v : x) : [...g.goals, v];
      edited.push(v.id);
    } else if (command === "goal.state" || command === "goal.delete") {
      fresh(g.goals, input.base);
      const ids = new Set(input.ids || []);
      if (!ids.size || ids.size > 100) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u043E\u0442 1 \u0434\u043E 100 \u0446\u0435\u043B\u0435\u0439.");
      for (const id of ids) requireGoal(id);
      if (command === "goal.delete") {
        if (input.children) {
          let count = 0;
          do {
            count = ids.size;
            for (const v of g.goals) if (v.parentId && ids.has(v.parentId)) ids.add(v.id);
          } while (count !== ids.size);
        }
        g.goals = g.goals.filter((v) => !ids.has(v.id)).map((v) => ids.has(v.parentId || "") ? { ...v, parentId: null } : v);
        g.tasks = g.tasks.map((t) => {
          if (!ids.has(t.goalId)) return t;
          const n = { ...t };
          delete n.goalId;
          delete n.stepSourceId;
          delete n.stepTicked;
          return n;
        });
      } else for (const id of ids) {
        const v = requireGoal(id);
        if (input.field === "completed") {
          if (v.archived) throw Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u0435\u0440\u043D\u0438 \u0446\u0435\u043B\u044C \u0438\u0437 \u0430\u0440\u0445\u0438\u0432\u0430.");
          v.completedAt = input.value ? now : null;
          v.manualComplete = !!input.value;
          if (!input.value && !v.metric && v.steps.length && v.steps.every((s) => s.done)) v.steps[v.steps.length - 1].done = false;
        } else if (input.field === "status") {
          if (!["active", "paused", "waiting"].includes(input.value)) throw Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.");
          v.status = input.value;
        } else if (input.field === "archived") v.archived = !!input.value;
        else throw Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435.");
      }
    } else if (command === "goal.step" || command === "goal.metric") {
      const v = requireGoal(input.goalId);
      fresh(v, input.base);
      if (v.archived) throw Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u0435\u0440\u043D\u0438 \u0446\u0435\u043B\u044C \u0438\u0437 \u0430\u0440\u0445\u0438\u0432\u0430.");
      if (command === "goal.metric") {
        if (!v.metric || !Number.isFinite(input.value) || !validDate(today)) throw Error("\u0412\u0432\u0435\u0434\u0438 \u0447\u0438\u0441\u043B\u043E\u0432\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043C\u0435\u0442\u0440\u0438\u043A\u0438.");
        v.metric.current = input.value;
        v.metric.log = [{ date: today, value: input.value }, ...v.metric.log || []].slice(0, 50);
      } else {
        if (v.metric) throw Error("\u0423 \u0447\u0438\u0441\u043B\u043E\u0432\u043E\u0439 \u0446\u0435\u043B\u0438 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 \u043C\u0435\u0442\u0440\u0438\u043A\u0443.");
        const old = v.steps.find((s) => s.id === input.step.id);
        if (input.remove) {
          v.steps = v.steps.filter((s) => s.id !== input.step.id);
          g.tasks = g.tasks.map((t) => {
            if (t.goalId !== v.id || t.stepSourceId !== input.step.id) return t;
            const n = { ...t };
            delete n.stepSourceId;
            delete n.stepTicked;
            return n;
          });
        } else if (input.move) {
          const i = v.steps.findIndex((s) => s.id === input.step.id), j = i + input.move;
          if (i >= 0 && j >= 0 && j < v.steps.length) [v.steps[i], v.steps[j]] = [v.steps[j], v.steps[i]];
        } else {
          if (!input.step.id || v.steps.length >= 100 && !old) throw Error("\u0423 \u0446\u0435\u043B\u0438 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0434\u043E 100 \u0448\u0430\u0433\u043E\u0432.");
          const s = { ...old, id: input.step.id, title: title(input.step.title ?? old?.title), done: typeof input.step.done === "boolean" ? input.step.done : !!old?.done };
          v.steps = old ? v.steps.map((x) => x.id === s.id ? s : x) : [...v.steps, s];
        }
      }
    } else if (command === "goal.link") {
      const t = g.tasks.find((t2) => t2.id === input.taskId);
      if (!t) throw Error("\u041A\u0432\u0435\u0441\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.");
      fresh(t, input.base);
      if (input.goalId) {
        const v = requireGoal(input.goalId);
        if (v.archived) throw Error("\u0426\u0435\u043B\u044C \u0432 \u0430\u0440\u0445\u0438\u0432\u0435.");
        t.goalId = v.id;
      } else delete t.goalId;
      delete t.stepSourceId;
      delete t.stepTicked;
    } else if (command === "group.save") {
      const p = input.group, old = g.groups.find((x) => x.id === p.id);
      fresh(old, input.base);
      if (!p.id || !["active", "archived"].includes(p.status)) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043F\u0440\u043E\u0435\u043A\u0442.");
      const v = { ...old, id: p.id, title: title(p.title, 80), status: p.status, createdAt: old?.createdAt || now };
      g.groups = old ? g.groups.map((x) => x.id === v.id ? v : x) : [...g.groups, v];
    } else if (command === "group.delete") {
      const old = g.groups.find((x) => x.id === input.id);
      fresh(old, input.base);
      g.groups = g.groups.filter((x) => x.id !== input.id);
      g.goals = g.goals.map((v) => v.groupId === input.id ? { ...v, groupId: null } : v);
    } else throw Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0441 \u0446\u0435\u043B\u044C\u044E.");
    graphCheck(g, edited);
    return g;
  }

  // src/live/theme.ts
  var rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
  var luminance = (hex) => rgb(hex).map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function accentText(hex) {
    return contrast(hex, "#fff9ed") >= contrast(hex, "#18202b") ? "#fff9ed" : "#18202b";
  }
  function accessibleAccent(hex, dark) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return dark ? "#c6c9e0" : "#424760";
    const paper = dark ? "#292d3b" : "#f4f0e7", from = rgb(hex), target = dark ? 255 : 0;
    for (let step = 0; step <= 100; step++) {
      const amount = step / 100, value = "#" + from.map((v) => Math.round(v + (target - v) * amount).toString(16).padStart(2, "0")).join("");
      if (contrast(value, paper) >= 4.5) return value;
    }
    return dark ? "#c6c9e0" : "#424760";
  }

  // src/live/rewards-model.ts
  function rewardReceiptArt(r = {}) {
    return { ...r.iconId ? { iconId: r.iconId } : {}, ...r.image ? { image: r.image } : {} };
  }
  function personalRewardLabel(r, catalog = []) {
    return r.catalogNameKey ? catalog.find((c) => c.catalogNameKey === r.catalogNameKey)?.name || r.name : r.name;
  }
  function savePersonalReward(all, input, base, limit, now) {
    const old = all.find((r2) => r2.id === input.id), name = String(input.name || "").trim();
    if (!input.id || !name || name.length > 120) throw Error("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u2014 \u043E\u0442 1 \u0434\u043E 120 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    if (!Number.isInteger(input.cost) || input.cost < 1 || input.cost > 1e5) throw Error("\u0426\u0435\u043D\u0430 \u2014 \u0446\u0435\u043B\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u043E\u0442 1 \u0434\u043E 100 000.");
    if (!/^reward\.[a-z-]+$/.test(input.iconId || "")) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0437\u043D\u0430\u0447\u043E\u043A \u043D\u0430\u0433\u0440\u0430\u0434\u044B.");
    if (input.image && (!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(input.image) || input.image.length > 6e5)) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u043D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 PNG, JPEG \u0438\u043B\u0438 WebP.");
    const r = { ...old || {}, id: input.id, name, cost: input.cost, iconId: input.iconId, createdAt: old?.createdAt || now };
    if (!old && typeof input.catalogNameKey === "string") r.catalogNameKey = input.catalogNameKey;
    if (input.image) r.image = input.image;
    else delete r.image;
    if (old?.catalogNameKey && name !== old.name) delete r.catalogNameKey;
    if (!base && old) {
      if (["name", "cost", "iconId", "image"].every((k) => old[k] === r[k])) return all;
      throw Error("\u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u0441 \u0442\u0430\u043A\u0438\u043C \u043D\u043E\u043C\u0435\u0440\u043E\u043C \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442. \u041E\u0431\u043D\u043E\u0432\u0438 \u0441\u043F\u0438\u0441\u043E\u043A.");
    }
    if (base && (!old || JSON.stringify(old) !== base)) throw Error("\u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C. \u041E\u0442\u043A\u0440\u043E\u0439 \u0435\u0451 \u0437\u0430\u043D\u043E\u0432\u043E.");
    if (!old && all.length >= limit) throw Error("\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442 \u043B\u0438\u043C\u0438\u0442 \u043B\u0438\u0447\u043D\u044B\u0445 \u043D\u0430\u0433\u0440\u0430\u0434. \u0423\u0434\u0430\u043B\u0438 \u043D\u0435\u043D\u0443\u0436\u043D\u0443\u044E \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u043E\u0439 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438.");
    return old ? all.map((x) => x.id === r.id ? r : x) : [...all, r];
  }
  function rewardProjection(d) {
    const purchases = d.purchases.filter((p) => typeof p.rewardId === "string" && !!p.rewardId).map((p) => {
      const r = d.rewards.find((r2) => r2.id === p.rewardId), life = d.rewardLife?.[p.id], status = life?.status || "received";
      return { id: p.id, at: p.at || "", used: status === "used", status, date: life?.date || void 0, reward: { id: p.rewardId, name: p.name || r?.name || "\u041B\u0438\u0447\u043D\u0430\u044F \u043D\u0430\u0433\u0440\u0430\u0434\u0430", cost: Number(p.cost) || 0, iconId: p.iconId || "reward.wishlist", image: p.image } };
    });
    return { rewards: d.rewards.map((r) => ({ ...r, name: personalRewardLabel(r, d.catalog) })), purchases, nextReward: d.rewards.some((r) => r.id === d.nextReward) ? d.nextReward : void 0 };
  }
  function reconcileRewardTasks(settings, tasks, before, purchases, now) {
    let next = settings;
    for (const old of before.filter((t) => t.rewardPurchaseId)) {
      const task = tasks.find((t) => t.id === old.id), id = old.rewardPurchaseId;
      if (!purchases.some((p) => p.id === id && p.rewardId)) continue;
      if (task && old.done === task.done && old.date === task.date) continue;
      if (next === settings) next = structuredClone(settings);
      next.rewardLifeV1 = { ...next.rewardLifeV1, [id]: { status: task?.done ? "used" : task ? "planned" : "received", date: task && !task.done ? task.date : null, updatedAt: now } };
    }
    return next;
  }

  // src/live/world-model.ts
  var worldKind = (n) => n.kind || (n.milestone ? "capability" : "practice");
  var clean = (v, max) => String(v ?? "").trim().slice(0, max);
  function editWorldTree(trees, sid, input) {
    const old = trees[sid];
    if (!old || input.base !== JSON.stringify(old)) throw Error("\u041F\u0443\u0442\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u041E\u0442\u043A\u0440\u043E\u0439 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0437\u0430\u043D\u043E\u0432\u043E.");
    const next = structuredClone(trees), tree = next[sid], existing = tree.nodes.find((n2) => n2.id === (input.node?.id || input.id));
    if (input.op === "move") {
      if (!existing || [input.x, input.y].some((v) => !Number.isFinite(v) || v < 0 || v > 1e5)) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0443\u0437\u043B\u0430.");
      existing.x = input.x;
      existing.y = input.y;
      return next;
    }
    if (input.op === "remove") {
      if (!existing) throw Error("\u0423\u0437\u0435\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.");
      if (worldKind(existing) === "capability" && existing.unlocked) throw Error("\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u0430\u044F \u0432\u0435\u0445\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u0438.");
      tree.nodes = tree.nodes.filter((n2) => n2.id !== existing.id).map((n2) => ({ ...n2, requires: (n2.requires || []).filter((id) => id !== existing.id) }));
      return next;
    }
    if (input.op !== "save" || !input.node || typeof input.node.id !== "string" || !input.node.id || input.create && existing || !input.create && !existing) throw Error("\u0423\u0437\u0435\u043B \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u041E\u0442\u043A\u0440\u043E\u0439 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0437\u0430\u043D\u043E\u0432\u043E.");
    const n = input.node, kind = worldKind(n);
    if (!["capability", "practice"].includes(kind)) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0442\u0438\u043F \u0443\u0437\u043B\u0430.");
    if (existing?.unlocked && worldKind(existing) !== kind) throw Error("\u0422\u0438\u043F \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0433\u043E \u0443\u0437\u043B\u0430 \u043C\u0435\u043D\u044F\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.");
    const title2 = clean(n.title, 180), requires = n.requires || [];
    if (!title2) throw Error("\u041D\u0430\u0437\u043E\u0432\u0438 \u0443\u0437\u0435\u043B.");
    if (!Array.isArray(requires) || new Set(requires).size !== requires.length || requires.some((id) => id === n.id || !tree.nodes.some((o) => o.id === id))) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0435 \u0443\u0437\u043B\u044B.");
    const position = { x: Number(n.x ?? Number(n.col || 0) * 150), y: Number(n.y ?? Number(n.row || 0) * 120) };
    if (Object.values(position).some((v) => !Number.isFinite(v) || v < 0 || v > 1e5)) throw Error("\u041F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043E\u0442 0 \u0434\u043E 100000.");
    const cost = Number(n.cost || 0);
    if (!Number.isSafeInteger(cost) || cost < 0 || cost > 1e4) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0446\u0435\u043D\u0443 \u0431\u043E\u043D\u0443\u0441\u0430.");
    const perks = kind === "capability" ? [] : n.perks || [];
    if (!Array.isArray(perks) || perks.some((p) => !p || typeof p.kind !== "string" || !Number.isFinite(p.val) || p.val < 0)) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u044D\u0444\u0444\u0435\u043A\u0442 \u0431\u043E\u043D\u0443\u0441\u0430.");
    const titleChanged = !existing || title2 !== String(input.textBase?.title ?? existing.title), desc = clean(n.desc, 1e3), descChanged = !existing || desc !== String(input.textBase?.desc ?? existing.desc ?? "");
    const changed = { ...existing || { id: n.id, unlocked: false, personal: true }, title: titleChanged ? title2 : existing.title, kind, milestone: kind === "capability", desc: descChanged ? desc : existing?.desc || "", criterion: clean(n.criterion, 500), nextAction: clean(n.nextAction, 300), requires: [...requires], cost: kind === "capability" ? 0 : cost, perks: structuredClone(perks), ...position };
    if (titleChanged) {
      changed.titleCustom = true;
      delete changed.titleKey;
    }
    if (descChanged) {
      changed.descCustom = true;
      delete changed.descKey;
    }
    delete changed.perkXpPct;
    if (existing) tree.nodes = tree.nodes.map((o) => o.id === changed.id ? changed : o);
    else tree.nodes.push(changed);
    const visiting = /* @__PURE__ */ new Set(), visited = /* @__PURE__ */ new Set();
    function visit(id) {
      if (visiting.has(id)) throw Error("\u0421\u0432\u044F\u0437\u0438 \u043E\u0431\u0440\u0430\u0437\u0443\u044E\u0442 \u043A\u0440\u0443\u0433. \u0423\u0431\u0435\u0440\u0438 \u043E\u0434\u043D\u0443 \u0438\u0437 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0435\u0439.");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const req of tree.nodes.find((n2) => n2.id === id)?.requires || []) visit(req);
      visiting.delete(id);
      visited.add(id);
    }
    tree.nodes.forEach((n2) => visit(n2.id));
    return next;
  }
  function saveWorldEpisode(episodes, episode, base, skills, today, now) {
    const old = episodes.find((e) => e.id === episode.id);
    if (old ? base !== JSON.stringify(old) : base !== null) throw Error("\u042D\u043F\u0438\u0437\u043E\u0434 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u041E\u0442\u043A\u0440\u043E\u0439 \u0435\u0433\u043E \u0437\u0430\u043D\u043E\u0432\u043E.");
    if (!episode.id || !validDate(episode.from) || !validDate(episode.to) || episode.from > episode.to || episode.to > today) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0434\u0430\u0442\u044B: \u044D\u043F\u0438\u0437\u043E\u0434 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0443\u0436\u0435 \u043F\u0440\u043E\u0436\u0438\u0442\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434.");
    const profile = episode.profile;
    if (!Array.isArray(profile) || !profile.length || new Set(profile.map((p) => p.skillId)).size !== profile.length || profile.some((p) => !skills.includes(p.skillId) || !Number.isInteger(p.intensity) || p.intensity < 1 || p.intensity > 5)) throw Error("\u041E\u0442\u043C\u0435\u0442\u044C \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0441\u0444\u0435\u0440\u044B \u0438 \u0438\u0445 \u0438\u043D\u0442\u0435\u043D\u0441\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u043E\u0442 1 \u0434\u043E 5.");
    if (!["trip", "intensive", "camp", "vacation", "illness", "sprint", "guests", "other"].includes(episode.type)) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0432\u0438\u0434 \u044D\u043F\u0438\u0437\u043E\u0434\u0430.");
    const next = { ...old || {}, id: episode.id, type: episode.type, title: clean(episode.title, 60) || "\u042D\u043F\u0438\u0437\u043E\u0434", from: episode.from, to: episode.to, story: clean(episode.story, 4e3), profile: structuredClone(profile), highlights: old?.highlights || episode.highlights || [], social: old?.social || episode.social || null, createdAt: old?.createdAt || now };
    return old ? episodes.map((e) => e.id === old.id ? next : e) : episodes.concat(next);
  }
  function worldProgress(events, tasks, habitlog, today, range, habits = []) {
    const shift2 = (d, n) => {
      const dt = /* @__PURE__ */ new Date(d + "T12:00:00Z");
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    const days = Array.from({ length: range }, (_, i) => ({ date: shift2(today, i - range + 1), xp: 0 })), start = days[0].date, bySphere = {};
    let xp = 0, minutes = 0, unknown = 0, done = 0;
    for (const e of events) if (e.date >= start && e.date <= today) {
      xp += Number(e.xp) || 0;
      const day2 = days.find((d) => d.date === e.date);
      if (day2) day2.xp += Number(e.xp) || 0;
    }
    for (const t of tasks) {
      const date = t.completedAt ? String(t.completedAt).slice(0, 10) : t.date;
      if (!t.done || date < start || date > today) continue;
      done++;
      if (t.actualMin == null) {
        unknown++;
        continue;
      }
      const min = Math.max(0, Number(t.actualMin) || 0);
      minutes += min;
      const ids = t.skillIds?.length ? t.skillIds : [t.skillId].filter(Boolean), base = Math.floor(min / ids.length);
      ids.forEach((id, i) => bySphere[id] = (bySphere[id] || 0) + base + Math.min(1, Math.max(0, min - base * ids.length - i)));
    }
    for (const [date, logs] of Object.entries(habitlog || {})) if (date >= start && date <= today) for (const [id, rec] of Object.entries(logs)) {
      const min = Math.max(0, Number(rec.min) || 0);
      minutes += min;
      const sid = habits.find((h) => h.id === id)?.skillId;
      if (sid) bySphere[sid] = (bySphere[sid] || 0) + min;
    }
    return { days, xp, minutes, unknown, done, bySphere };
  }

  // src/live/app-navigation.ts
  var world = { den: "home", character: "hero", pets: "pets", tree: "path", stats: "progress" };
  var plan = { calendar: "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C", goals: "\u0426\u0435\u043B\u0438", habits: "\u041F\u0440\u0438\u0432\u044B\u0447\u043A\u0438", shelf: "\u0412\u0434\u043E\u0445\u043D\u043E\u0432\u0435\u043D\u0438\u0435" };
  var decode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return "";
    }
  };
  function initialAppNavigation(hash, source = {}) {
    const parts = hash.split("/"), route = parts[0].slice(1), view = source.view || "today";
    return {
      route: ["today", "plan", "world", "rewards", "settings", "tribe"].includes(route) ? route : world[view] ? "world" : plan[view] ? "plan" : view === "settings" ? "settings" : view === "rewards" ? "rewards" : ["party", "leaderboard"].includes(view) ? "tribe" : "today",
      worldMode: route === "world" && ["home", "hero", "pets", "path", "progress"].includes(parts[1]) ? parts[1] : world[view] || "home",
      planMode: route === "plan" ? { goals: "\u0426\u0435\u043B\u0438", habits: "\u041F\u0440\u0438\u0432\u044B\u0447\u043A\u0438", inspiration: "\u0412\u0434\u043E\u0445\u043D\u043E\u0432\u0435\u043D\u0438\u0435" }[parts[1]] || "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C" : plan[view] || "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C",
      calendarDate: validDate(parts[2] || "") ? parts[2] : validDate(source.calendarDate || "") ? source.calendarDate : day(),
      calendarScale: ["\u0414\u0435\u043D\u044C", "\u041D\u0435\u0434\u0435\u043B\u044F", "\u041C\u0435\u0441\u044F\u0446"].includes(decode(parts[1] || "")) ? decode(parts[1]) : { day: "\u0414\u0435\u043D\u044C", week: "\u041D\u0435\u0434\u0435\u043B\u044F", month: "\u041C\u0435\u0441\u044F\u0446" }[source.calendarMode || ""] || "\u041D\u0435\u0434\u0435\u043B\u044F",
      todayMode: route === "today" ? parts[1] === "notes" ? "\u0417\u0430\u043C\u0435\u0442\u043A\u0438" : parts[1] === "board" ? "\u0414\u043E\u0441\u043A\u0430" : "\u0414\u0435\u043D\u044C" : view === "notes" ? "\u0417\u0430\u043C\u0435\u0442\u043A\u0438" : source.todayTab === "board" ? "\u0414\u043E\u0441\u043A\u0430" : "\u0414\u0435\u043D\u044C",
      settingsGroup: route === "settings" ? parts[1] || "" : source.settingsGroup || "",
      goalEntry: route === "plan" && parts[1] === "goals" ? decode(parts[2] || "") : view === "goals" ? source.goalId || "" : ""
    };
  }

  // src/live/model.ts
  var fields = ["title", "date", "startTime", "estimateMin", "difficulty", "skillId", "skillIds", "layers", "core"];
  function schedule(t) {
    return { date: t.date, startTime: t.startTime || null, core: !!t.core };
  }
  function moveTasks(tasks, changes) {
    if (!Array.isArray(changes) || !changes.length || changes.length > 50 || new Set(changes.map((c) => c.id)).size !== changes.length) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u043E\u0442 1 \u0434\u043E 50 \u0440\u0430\u0437\u043D\u044B\u0445 \u043A\u0432\u0435\u0441\u0442\u043E\u0432.");
    const next = tasks.map((t) => ({ ...t }));
    for (const command of changes) {
      const t = next.find((t2) => t2.id === command.id), after = command.after;
      if (!t || t.done) throw Error("\u041A\u0432\u0435\u0441\u0442 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F \u0438\u043B\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D. \u041E\u0431\u043D\u043E\u0432\u0438 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C.");
      if (!after || !validDate(after.date) || after.startTime != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(after.startTime) || typeof after.core !== "boolean") throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0434\u0430\u0442\u0443 \u0438 \u0432\u0440\u0435\u043C\u044F \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0430.");
      if (after.startTime && Number(after.startTime.slice(0, 2)) * 60 + Number(after.startTime.slice(3)) + Number(t.estimateMin || 0) > 1440) throw Error("\u0414\u0435\u043B\u043E \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u0437\u0430 \u043F\u043E\u043B\u043D\u043E\u0447\u044C. \u0412\u044B\u0431\u0435\u0440\u0438 \u0434\u0440\u0443\u0433\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u0438\u043B\u0438 \u0434\u0430\u0442\u0443.");
      const current = schedule(t);
      if (JSON.stringify(current) === JSON.stringify(after)) continue;
      if (JSON.stringify(current) !== JSON.stringify(command.before)) throw Error("\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043A\u0432\u0435\u0441\u0442\u0430 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C. \u041E\u0431\u043D\u043E\u0432\u0438 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C.");
      Object.assign(t, { date: after.date, startTime: after.startTime, core: after.core });
    }
    for (const c of changes) {
      if (c.after.core && (c.before.date !== c.after.date || !c.before.core) && next.filter((t) => t.date === c.after.date && t.core).length > 3) throw Error("\u0412 \u044F\u0434\u0440\u0435 \u0434\u043D\u044F \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0442\u0440\u0438 \u043A\u0432\u0435\u0441\u0442\u0430. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0441\u0432\u043E\u0431\u043E\u0434\u0438 \u043C\u0435\u0441\u0442\u043E.");
    }
    return next;
  }
  function calendarChanges(before, after) {
    if (before.tasks.length !== after.tasks.length) throw Error("\u0421\u043E\u0437\u0434\u0430\u0432\u0430\u0439 \u0438 \u0443\u0434\u0430\u043B\u044F\u0439 \u043A\u0432\u0435\u0441\u0442\u044B \u0447\u0435\u0440\u0435\u0437 \u0444\u043E\u0440\u043C\u0443.");
    const allowed = /* @__PURE__ */ new Set(["date", "start", "core"]), changes = [];
    for (const t of before.tasks) {
      const next = after.tasks.find((n) => n.id === t.id);
      if (!next) throw Error("\u041A\u0432\u0435\u0441\u0442 \u0438\u0441\u0447\u0435\u0437 \u0438\u0437 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044F.");
      for (const key of /* @__PURE__ */ new Set([...Object.keys(t), ...Object.keys(next)])) {
        if (!allowed.has(key) && JSON.stringify(t[key]) !== JSON.stringify(next[key])) throw Error("\u041F\u0435\u0440\u0435\u043D\u043E\u0441 \u043C\u043E\u0436\u0435\u0442 \u043C\u0435\u043D\u044F\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u0430\u0442\u0443 \u0438 \u0432\u0440\u0435\u043C\u044F \u043A\u0432\u0435\u0441\u0442\u0430.");
      }
      const old = { date: t.date, startTime: t.start || null, core: !!t.core }, value = { date: next.date, startTime: next.start || null, core: !!next.core };
      if (JSON.stringify(old) !== JSON.stringify(value)) changes.push({ id: t.id, before: old, after: value });
    }
    return changes;
  }
  function calendarPlan(data, weeks = {}) {
    return { ...data, plan: { intents: Object.fromEntries(Object.entries(weeks).map(([key, w]) => [key, w.intention || ""])), budgets: Object.assign({}, ...Object.values(weeks).map((w) => w.dayBudgetsV1 || {})) }, intentSpheres: Object.fromEntries(Object.entries(weeks).map(([key, w]) => [key, w.intentionSkillIdsV1 || []])) };
  }
  function saveWeek(weeks, command, input, skills) {
    if (command === "intent") {
      const week2 = input.week || "", ids = [...new Set(input.skills || [])];
      if (!validDate(week2) || monday(week2) !== week2 || typeof input.text !== "string" || input.text.length > 1e3 || ids.some((id) => !skills.some((s) => s.id === id))) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043D\u0435\u0434\u0435\u043B\u044E, \u0442\u0435\u043A\u0441\u0442 \u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u0441\u0444\u0435\u0440\u044B.");
      return { ...weeks, [week2]: { ...weeks[week2], intention: input.text.trim(), intentionSkillIdsV1: ids } };
    }
    const date = input.date || "", minutes = input.minutes;
    if (!validDate(date) || minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0434\u0430\u0442\u0443 \u0438 \u043E\u0442 0 \u0434\u043E 1440 \u043C\u0438\u043D\u0443\u0442.");
    const week = monday(date), budgets = { ...weeks[week]?.dayBudgetsV1 };
    if (minutes === null) delete budgets[date];
    else budgets[date] = minutes;
    return { ...weeks, [week]: { ...weeks[week], dayBudgetsV1: budgets } };
  }
  function editable(t) {
    return Object.fromEntries(fields.map((k) => [k, t[k] ?? null]));
  }
  function projectTask(t) {
    return { id: t.id, title: t.title, date: t.date, goal: typeof t.goalId === "string" ? t.goalId : void 0, start: t.startTime || "", minutes: Number(t.estimateMin) || 0, actual: t.actualMin ?? null, difficulty: t.difficulty || "normal", primary: t.skillIds?.length ? t.skillIds : t.skillId ? [t.skillId] : [], background: t.layers || [], done: !!t.done, core: !!t.core, xp: t.xpAwarded || 0, gold: t.goldAwarded || 0 };
  }
  function project(s) {
    return { version: 3, tasks: s.tasks.map(projectTask), goals: [], habits: s.habits.map((h) => ({ id: h.id, title: h.title, minutes: h.estimateMin || 0, days: h.days || [], sphere: h.skillId, identity: "", cue: "", twoMin: "", reward: "", logs: Object.keys(s.habitlog).filter((d) => !!s.habitlog[d]?.[h.id]), paused: !!(h.paused || h.archived) })), notes: s.inbox.map((n) => ({ id: n.id, text: n.text, kind: n.kind, created: n.at, media: n.file ? "/api/inbox/media/" + encodeURIComponent(n.file) : void 0 })), ...rewardProjection({ ...s.rewardsData, rewards: s.rewardsData?.rewards || [], purchases: s.rewardsData?.purchases || [], rewardLife: s.rewardsData?.life || {} }), gold: s.gold, xp: s.xp, reviews: Object.fromEntries(Object.entries(s.days).map(([k, v]) => [k, v.reflection || ""])), palette: "ink", sound: true, motion: true, identity: "", lapses: [], rules: [], inspiration: [], history: [], care: "", weekIntent: "", boardHidden: [] };
  }
  function buildTask(tasks, input, base, skills, now) {
    const current = tasks.find((t) => t.id === input.id);
    if (!base && current) {
      if (JSON.stringify(editable(current)) === JSON.stringify(editable(input))) return tasks;
      throw Error("\u041A\u0432\u0435\u0441\u0442 \u0441 \u0442\u0430\u043A\u0438\u043C \u043D\u043E\u043C\u0435\u0440\u043E\u043C \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442. \u041E\u0442\u043A\u0440\u043E\u0439 \u0435\u0433\u043E \u0437\u0430\u043D\u043E\u0432\u043E.");
    }
    if (base && (!current || JSON.stringify(editable(current)) !== JSON.stringify(base))) throw Error("\u041A\u0432\u0435\u0441\u0442 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u0417\u0430\u043A\u0440\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u044C \u0438 \u043E\u0442\u043A\u0440\u043E\u0439 \u0435\u0433\u043E \u0437\u0430\u043D\u043E\u0432\u043E \u2014 \u0441\u0432\u0435\u0436\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.");
    const title2 = String(input.title || "").trim();
    if (!title2 || title2.length > 180) throw Error("\u041D\u0430\u043F\u0438\u0448\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043E 180 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || (/* @__PURE__ */ new Date(input.date + "T12:00:00Z")).toISOString().slice(0, 10) !== input.date) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0434\u0430\u0442\u0443.");
    if (input.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0432\u0440\u0435\u043C\u044F \u043D\u0430\u0447\u0430\u043B\u0430.");
    if (!Number.isInteger(input.estimateMin) || input.estimateMin < 1 || input.estimateMin > 1440) throw Error("\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u2014 \u043E\u0442 1 \u0434\u043E 1440 \u043C\u0438\u043D\u0443\u0442.");
    if (input.startTime && Number(input.startTime.slice(0, 2)) * 60 + Number(input.startTime.slice(3)) + input.estimateMin > 1440) throw Error("\u0414\u0435\u043B\u043E \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u0437\u0430 \u043F\u043E\u043B\u043D\u043E\u0447\u044C. \u0420\u0430\u0437\u0434\u0435\u043B\u0438 \u0435\u0433\u043E \u043D\u0430 \u0434\u0432\u0430 \u0434\u043D\u044F \u0438\u043B\u0438 \u0443\u0431\u0435\u0440\u0438 \u0442\u043E\u0447\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F.");
    if (!["easy", "normal", "hard"].includes(input.difficulty || "")) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C.");
    const primary = [...new Set(input.skillIds?.length ? input.skillIds : input.skillId ? [input.skillId] : [])];
    const background = [...new Set(input.layers || [])].filter((id) => !primary.includes(id));
    if (!primary.length || [...primary, ...background].some((id) => !skills.some((s) => s.id === id))) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438 \u0441\u0444\u0435\u0440\u044B \u0438\u0437 \u0441\u0432\u043E\u0435\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430.");
    if (background.length > 3) throw Error("\u041C\u043E\u0436\u043D\u043E \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0434\u043E \u0442\u0440\u0451\u0445 \u0441\u043E\u043F\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0445 \u0441\u0444\u0435\u0440.");
    if (input.core && (!current?.core || current.date !== input.date) && tasks.filter((t) => t.id !== input.id && t.core && t.date === input.date).length >= 3) throw Error("\u0412 \u044F\u0434\u0440\u0435 \u0434\u043D\u044F \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0442\u0440\u0438 \u043A\u0432\u0435\u0441\u0442\u0430. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0441\u0432\u043E\u0431\u043E\u0434\u0438 \u043C\u0435\u0441\u0442\u043E.");
    const next = { ...current || { id: input.id, done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, createdAt: now }, title: title2, date: input.date, startTime: input.startTime || null, estimateMin: input.estimateMin, difficulty: input.difficulty, skillId: primary[0], skillIds: primary, layers: background, core: !!input.core };
    return current ? tasks.map((t) => t.id === next.id ? next : t) : [...tasks, next];
  }
  return __toCommonJS(model_exports);
})();

window.SatoruLiveModel=SatoruLiveModel;
async function b28UndoTask(id){const q=questById(id),el=null;
      const completedDay = dayOf(q), beforeTask = structuredClone(q), record = questCommitmentRecord(q);
      queueTaskCompletionFocus(id, el);
      // Legacy completed entries already awarded bond. Undo must not mint it
      // again on completion, and must not guess/subtract historical care.
      if (q.entry) q.entryBondAwarded = true;
      q.done = false; q.completedAt = null; q.xpAwarded = 0; q.goldAwarded = 0; q.desire = null;
      const saved = record && commitmentEngine()
        ? await commitmentDataCommit(({ settings, tasks }) => {
          const commitmentApi = commitmentEngine();
          let commitments = commitmentApi.normalize(settings.commitmentsV1);
          const commitmentId = questCommitmentId(q);
          const candidateRecord = commitments.items.find((item) => item.id === commitmentId);
          const completionCreatedWin = commitmentApi.outcomeOf(commitments, commitmentId, completedDay) === 'win';
          commitments = commitmentApi.clearMark(commitments, commitmentId, completedDay);
          if (candidateRecord && candidateRecord.archivedAt && completionCreatedWin) {
            const reopened = commitmentApi.reopen(commitments, questCommitmentId(q), todayStr());
            // Лимит активных границ не имеет права запереть обычное undo квеста:
            // галочка снимается, а завершённая граница остаётся честно архивной.
            if (reopened.ok) commitments = reopened.state;
            else if (reopened.error !== 'limit') return null;
          }
          settings.commitmentsV1 = commitments;
          return { settings, tasks };
        }, `[data-action="toggle-task"][data-id="${CSS.escape(String(id))}"]`)
        : q.rewardPurchaseId ? await commitmentDataCommit(({settings,tasks})=>({settings,tasks})) : await Store.saveNow('tasks', State.tasks);
      if (!saved) { Object.assign(q, beforeTask); toast(t('Не удалось сохранить. Ничего не изменено — повтори попытку.')); }
      else await syncGoalStepFromQuest(q, false);

return saved;}

// B2.10 additions to the existing five-language interface dictionary.
for(const [key,...values] of [
 ['Мир','World','Welt','Світ','Mundo'],
 ['Все настройки','All settings','Alle Einstellungen','Усі налаштування','Todos los ajustes'],
 ['Сферы, навыки и планирование','Life areas, skills and planning','Lebensbereiche, Fähigkeiten und Planung','Сфери, навички та планування','Áreas, habilidades y planificación'],
 ['Вложенность сфер, цвета, ритм, фокус и стартовый уровень','Nested areas, colours, rhythm, focus and starting level','Unterbereiche, Farben, Rhythmus, Fokus und Startlevel','Вкладені сфери, кольори, ритм, фокус і початковий рівень','Subáreas, colores, ritmo, enfoque y nivel inicial'],
 ['Язык и оформление','Language and appearance','Sprache und Darstellung','Мова та оформлення','Idioma y apariencia'],
 ['Язык, светлая и тёмная тема, акцент, звук и движение','Language, light and dark theme, accent, sound and motion','Sprache, helles und dunkles Design, Akzent, Ton und Bewegung','Мова, світла й темна тема, акцент, звук і рух','Idioma, tema claro y oscuro, acento, sonido y movimiento'],
 ['Тень и подключения','Shadow and connections','Schatten und Verbindungen','Тінь і підключення','Sombra y conexiones'],
 ['ИИ, локальная модель, память, Senku, Strava и другие сервисы','AI, local model, memory, Senku, Strava and other services','KI, lokales Modell, Gedächtnis, Senku, Strava und weitere Dienste','ШІ, локальна модель, пам’ять, Senku, Strava та інші сервіси','IA, modelo local, memoria, Senku, Strava y otros servicios'],
 ['Профиль и безопасность','Profile and security','Profil und Sicherheit','Профіль і безпека','Perfil y seguridad'],
 ['Профиль, пароль, PIN, устройства и подписка','Profile, password, PIN, devices and subscription','Profil, Passwort, PIN, Geräte und Abonnement','Профіль, пароль, PIN, пристрої та підписка','Perfil, contraseña, PIN, dispositivos y suscripción'],
 ['Игровые правила','Game rules','Spielregeln','Ігрові правила','Reglas del juego'],
 ['Опыт, золото, уровни и сложность','XP, gold, levels and difficulty','XP, Gold, Level und Schwierigkeit','Досвід, золото, рівні та складність','Experiencia, oro, niveles y dificultad'],
 ['Резервная копия, импорт, восстановление и диагностика','Backup, import, recovery and diagnostics','Sicherung, Import, Wiederherstellung und Diagnose','Резервна копія, імпорт, відновлення та діагностика','Copia de seguridad, importación, recuperación y diagnóstico'],
 ['Ближайшие результаты','Your next outcomes','Die nächsten Ergebnisse','Найближчі результати','Tus próximos resultados'],
 ['Все цели, проекты и архив','All goals, projects and archive','Alle Ziele, Projekte und Archiv','Усі цілі, проєкти й архів','Todas las metas, proyectos y archivo'],
 ['Управлять проектами','Manage projects','Projekte verwalten','Керувати проєктами','Gestionar proyectos'],
 ['Добавить проект','Add project','Projekt hinzufügen','Додати проєкт','Añadir proyecto'],
 ['Параметры цели','Goal settings','Zieleinstellungen','Параметри цілі','Ajustes de la meta'],
 ['Родительская цель','Parent goal','Übergeordnetes Ziel','Батьківська ціль','Meta superior'],
 ['Самостоятельная цель','Independent goal','Eigenständiges Ziel','Самостійна ціль','Meta independiente'],
 ['Без проекта','No project','Kein Projekt','Без проєкту','Sin proyecto'],
 ['Как считать прогресс','How to track progress','Fortschritt erfassen','Як рахувати прогрес','Cómo medir el progreso'],
 ['По шагам','By steps','Nach Schritten','За кроками','Por pasos'],
 ['Числовая метрика','Numeric metric','Zahlenwert','Числова метрика','Métrica numérica'],
 ['Достигнуты','Achieved','Erreicht','Досягнуті','Logradas'],
 ['Ждут','Waiting','Wartend','Очікують','En espera'],
 ['Изменить шаг','Edit step','Schritt bearbeiten','Змінити крок','Editar paso'],
 ['Сохранить шаг','Save step','Schritt speichern','Зберегти крок','Guardar paso'],
 ['Название шага','Step title','Schritttitel','Назва кроку','Nombre del paso'],
 ['Постоянное расписание','Recurring schedule','Wiederkehrender Wochenplan','Постійний розклад','Horario recurrente'],
 ['По расписанию','Scheduled','Im Wochenplan','За розкладом','En el horario'],
 ['Расписание','Schedule','Wochenplan','Розклад','Horario'],
 ['Занятия без времени','Flexible activities','Aktivitäten ohne Uhrzeit','Заняття без часу','Actividades sin hora'],
 ['Название занятия','Activity title','Name der Aktivität','Назва заняття','Nombre de la actividad'],
 ['День недели','Day of week','Wochentag','День тижня','Día de la semana'],
 ['Сфера или подсфера','Area or subarea','Bereich oder Unterbereich','Сфера або підсфера','Área o subárea'],
 ['Время любое','Any time','Beliebige Uhrzeit','Будь-який час','Cualquier hora'],
 ['Длительность, минут','Duration in minutes','Dauer in Minuten','Тривалість, хвилин','Duración en minutos'],
 ['Неделя цикла','Week in cycle','Woche im Zyklus','Тиждень циклу','Semana del ciclo'],
 ['Добавить занятие','Add activity','Aktivität hinzufügen','Додати заняття','Añadir actividad'],
 ['Начало цикла чередования','Rotation start date','Beginn des Wechselrhythmus','Початок циклу чергування','Inicio del ciclo'],
 ['Сохранить расписание','Save schedule','Wochenplan speichern','Зберегти розклад','Guardar horario'],
 ['Часы для планирования дел','Hours for planning tasks','Zeitfenster für Aufgaben','Години для планування справ','Horario para planificar tareas'],
 ['Настройки твоего аккаунта. Сферы связаны с квестами, целями, привычками и прогрессом.','Your account settings. Areas connect quests, goals, habits and progress.','Deine Kontoeinstellungen. Bereiche verbinden Aufgaben, Ziele, Gewohnheiten und Fortschritt.','Налаштування твого акаунта. Сфери пов’язані з квестами, цілями, звичками та прогресом.','Ajustes de tu cuenta. Las áreas conectan misiones, metas, hábitos y progreso.'],
])for(const [i,locale] of ['en','de','uk','es'].entries())I18N[locale][key]=values[i];

// Authored reward controls only. Personal names and immutable receipts stay untouched.
for(const [key,...values] of [
 ['Личные','Personal','Persönlich','Особисті','Personales'],
 ['Каталог','Catalog','Katalog','Каталог','Catálogo'],
 ['Полученные','Received','Erhalten','Отримані','Recibidas'],
 ['Мой список','My list','Meine Liste','Мій список','Mi lista'],
 ['То, ради чего приятно стараться.','Things worth looking forward to.','Dinge, auf die du dich freuen kannst.','Те, заради чого приємно старатися.','Cosas que hace ilusión esperar.'],
 ['Выбери, чего ждёшь','Choose something to look forward to','Wähle, worauf du dich freust','Обери, на що чекаєш','Elige algo que te haga ilusión'],
 ['Закрепи одну личную награду — она появится на главной.','Pin a personal reward to show it on Today.','Markiere eine persönliche Belohnung für Heute.','Закріпи особисту нагороду — вона з’явиться на головній.','Fija una recompensa personal para verla en Hoy.'],
 ['Хочу следующей','My next reward','Meine nächste Belohnung','Хочу наступною','Mi próxima recompensa'],
 ['Выбрана на главной','Shown on Today','Auf Heute angezeigt','Обрана на головній','Visible en Hoy'],
 ['Открепить','Unpin','Lösen','Відкріпити','Desfijar'],
 ['Награда ждёт тебя','A reward is waiting for you','Eine Belohnung wartet auf dich','Нагорода чекає на тебе','Te espera una recompensa'],
 ['Награды ждут тебя','Rewards are waiting for you','Belohnungen warten auf dich','Нагороди чекають на тебе','Te esperan recompensas'],
 ['Своя награда','Custom reward','Eigene Belohnung','Своя нагорода','Recompensa propia'],
 ['Что тебя порадует','What would make you happy?','Worüber würdest du dich freuen?','Що тебе потішить','¿Qué te haría ilusión?'],
 ['Цена в золоте','Price in gold','Preis in Gold','Ціна в золоті','Precio en oro'],
 ['Цену выбираешь ты. Изменение не затронет уже полученные награды.','You choose the price. Changes do not affect rewards already received.','Du bestimmst den Preis. Bereits erhaltene Belohnungen bleiben unverändert.','Ціну обираєш ти. Зміни не вплинуть на вже отримані нагороди.','Tú eliges el precio. Los cambios no afectan a las recompensas ya recibidas.'],
 ['Выбрать значок','Choose an icon','Symbol wählen','Обрати значок','Elegir icono'],
 ['Своя картинка','Your own image','Eigenes Bild','Своє зображення','Imagen propia'],
 ['PNG, JPEG или WebP · до 5 МБ','PNG, JPEG or WebP · up to 5 MB','PNG, JPEG oder WebP · bis 5 MB','PNG, JPEG або WebP · до 5 МБ','PNG, JPEG o WebP · hasta 5 MB'],
 ['Сохранить награду','Save reward','Belohnung speichern','Зберегти нагороду','Guardar recompensa'],
 ['Удалить из моего списка','Remove from my list','Aus meiner Liste entfernen','Видалити з мого списку','Eliminar de mi lista'],
 ['Личная награда','Personal reward','Persönliche Belohnung','Особиста нагорода','Recompensa personal'],
 ['Полученная награда','Received reward','Erhaltene Belohnung','Отримана нагорода','Recompensa recibida'],
 ['Время для себя','Time for yourself','Zeit für dich','Час для себе','Tiempo para ti'],
 ['Закрыть награду','Close reward','Belohnung schließen','Закрити нагороду','Cerrar recompensa'],
 ['Поиск личной награды','Search personal rewards','Persönliche Belohnungen suchen','Пошук особистих нагород','Buscar recompensas personales'],
 ['Найти в моих наградах','Search my rewards','Meine Belohnungen durchsuchen','Знайти в моїх нагородах','Buscar en mis recompensas'],
 ['Доступные','Affordable','Bezahlbar','Доступні','Asequibles'],
 ['Не добавлены','Not added','Noch nicht hinzugefügt','Не додані','Sin añadir'],
 ['В моём списке','In my list','In meiner Liste','У моєму списку','En mi lista'],
 ['Добавить себе','Add to my list','Zu meiner Liste hinzufügen','Додати собі','Añadir a mi lista'],
 ['Создать свою награду','Create a custom reward','Eigene Belohnung erstellen','Створити свою нагороду','Crear una recompensa propia'],
 ['Ждут меня','Waiting for me','Warten auf mich','Чекають на мене','Pendientes'],
 ['Использованы','Used','Genutzt','Використані','Usadas'],
 ['Отложены','Deferred','Zurückgestellt','Відкладені','Pospuestas'],
 ['Получено','Received','Erhalten','Отримано','Recibida'],
 ['Запланировано','Planned','Geplant','Заплановано','Planificada'],
 ['Использовано','Used','Genutzt','Використано','Usada'],
 ['Отложено','Deferred','Zurückgestellt','Відкладено','Pospuesta'],
 ['Я воспользовался','I used this reward','Belohnung genutzt','Я скористався','Ya la he usado'],
 ['Дата для себя','Your reward date','Dein Belohnungstermin','Дата для себе','Fecha para ti'],
 ['Запланировать награду','Schedule reward','Belohnung einplanen','Запланувати нагороду','Programar recompensa'],
 ['Запланировать отдых как квест','Plan rest as a quest','Erholung als Quest planen','Запланувати відпочинок як квест','Planificar el descanso como misión'],
 ['Открыть отдых в плане','Open rest in Plan','Erholung im Plan öffnen','Відкрити відпочинок у плані','Abrir el descanso en Plan'],
 ['Квест отдыха появится в Сегодня и Плане. Его завершение отметит награду использованной.','The rest quest appears in Today and Plan. Completing it marks the reward as used.','Die Erholungsquest erscheint unter Heute und Plan. Wenn du sie abschließt, gilt die Belohnung als genutzt.','Квест відпочинку з’явиться в Сьогодні та Плані. Його завершення позначить нагороду використаною.','La misión de descanso aparece en Hoy y Plan. Al completarla, la recompensa se marca como usada.'],
 ['Отложить награду','Defer reward','Belohnung zurückstellen','Відкласти нагороду','Posponer recompensa'],
 ['Вернуть в полученные','Move back to received','Zurück zu Erhalten','Повернути до отриманих','Volver a recibidas'],
 ['Открыть завершённый квест','Open completed quest','Abgeschlossene Quest öffnen','Відкрити завершений квест','Abrir misión completada'],
 ['Это изменение отметки. Потраченное золото не возвращается.','This changes the status. Spent gold is not refunded.','Das ändert nur den Status. Ausgegebenes Gold wird nicht erstattet.','Це зміна позначки. Витрачене золото не повертається.','Esto cambia el estado. El oro gastado no se devuelve.'],
 ['Золото уже списано. Планирование и отметки использования не меняют баланс.','The gold has already been spent. Planning and usage status do not change your balance.','Das Gold wurde bereits ausgegeben. Planung und Nutzungsstatus ändern dein Guthaben nicht.','Золото вже списано. Планування та позначки використання не змінюють баланс.','El oro ya se ha descontado. Planificar o marcar el uso no cambia tu saldo.'],
 ['История золота и действий','Gold and activity history','Gold- und Aktivitätsverlauf','Історія золота та дій','Historial de oro y acciones'],
 ['Коллекция, Логово и достижения','Collection, Den and achievements','Sammlung, Lager und Erfolge','Колекція, Лігво та досягнення','Colección, guarida y logros'],
 ['Правила экономики','Economy rules','Wirtschaftsregeln','Правила економіки','Reglas de la economía'],
 ['Отдых не нужно заслуживать. Золото — способ отметить усилия и не забыть о том, что радует.','Rest does not have to be earned. Gold helps you acknowledge your effort and remember what brings you joy.','Erholung musst du dir nicht verdienen. Gold würdigt deinen Einsatz und erinnert dich an das, was dir Freude macht.','Відпочинок не потрібно заслужити. Золото допомагає відзначити зусилля й не забути про те, що тішить.','No tienes que ganarte el descanso. El oro reconoce tu esfuerzo y te recuerda lo que te alegra.'],
 ['Получить','Get reward','Erhalten','Отримати','Obtener'],
 ['Например, вечер с любимой игрой','For example, an evening with your favourite game','Zum Beispiel ein Abend mit deinem Lieblingsspiel','Наприклад, вечір з улюбленою грою','Por ejemplo, una tarde con tu juego favorito'],
 ['Поиск в каталоге','Search the catalog','Katalog durchsuchen','Пошук у каталозі','Buscar en el catálogo'],
 ['Кино, игры, прогулка…','Movies, games, a walk…','Filme, Spiele, ein Spaziergang…','Кіно, ігри, прогулянка…','Cine, juegos, un paseo…'],
 ['Убрать картинку','Remove image','Bild entfernen','Прибрати зображення','Quitar imagen'],
 ['Ничего не найдено','Nothing found','Nichts gefunden','Нічого не знайдено','No se encontró nada'],
 ['Твой список пока пуст','Your list is empty','Deine Liste ist noch leer','Твій список поки порожній','Tu lista está vacía'],
 ['Измени поиск или фильтр.','Try a different search or filter.','Ändere deine Suche oder den Filter.','Зміни пошук або фільтр.','Cambia la búsqueda o el filtro.'],
 ['Добавь личную награду или выбери готовую из каталога.','Add a personal reward or choose one from the catalog.','Erstelle eine persönliche Belohnung oder wähle eine aus dem Katalog.','Додай особисту нагороду або обери готову з каталогу.','Añade una recompensa personal o elige una del catálogo.'],
 ['Таких наград нет','No matching rewards','Keine passenden Belohnungen','Таких нагород немає','No hay recompensas que coincidan'],
 ['Попробуй другой запрос или создай свою награду.','Try another search or create your own reward.','Versuche eine andere Suche oder erstelle deine eigene Belohnung.','Спробуй інший запит або створи свою нагороду.','Prueba otra búsqueda o crea tu propia recompensa.'],
 ['Здесь пока пусто','Nothing here yet','Hier ist noch nichts','Тут поки порожньо','Aquí todavía no hay nada'],
 ['Получи награду из своего списка. Здесь она останется до использования.','Get a reward from your list. It stays here until you use it.','Hole dir eine Belohnung aus deiner Liste. Sie bleibt hier, bis du sie nutzt.','Отримай нагороду зі свого списку. Вона залишиться тут до використання.','Obtén una recompensa de tu lista. Permanecerá aquí hasta que la uses.'],
 ['доступна','affordable','bezahlbar','доступна','asequible'],
 ['не хватает','short by','es fehlen','бракує','faltan'],
 ['Уже доступна','Already affordable','Bereits bezahlbar','Уже доступна','Ya es asequible'],
 ['Осталось накопить','Still to save','Noch sparen','Залишилося накопичити','Falta ahorrar'],
 ['Изменить награду:','Edit reward:','Belohnung bearbeiten:','Змінити нагороду:','Editar recompensa:'],
 ['Открыть полученную награду:','Open received reward:','Erhaltene Belohnung öffnen:','Відкрити отриману нагороду:','Abrir recompensa recibida:'],
 ['Раздел наград','Reward sections','Belohnungsbereiche','Розділи нагород','Secciones de recompensas'],
 ['Покупка сохранена:','Purchase saved:','Kauf gespeichert:','Покупку збережено:','Compra guardada:'],
 ['Сохранение не подтверждено. Повтори то же действие или обнови страницу.','Save not confirmed. Retry the same action or reload the page.','Speicherung nicht bestätigt. Wiederhole dieselbe Aktion oder lade die Seite neu.','Збереження не підтверджено. Повтори ту саму дію або онови сторінку.','Guardado sin confirmar. Repite la misma acción o recarga la página.'],
])for(const [i,locale] of ['en','de','uk','es'].entries())I18N[locale][key]??=values[i];
I18N_DYN.push(
 [/^(Изменить награду:|Открыть полученную награду:) (.+)$/, (locale,m)=>`${I18N[locale][m[1]]} ${m[2]}`],
 [/^Баланс ([\d\s.,]+) золота$/, (locale,m)=>({en:`Balance: ${m[1]} gold`,de:`Guthaben: ${m[1]} Gold`,uk:`Баланс: ${m[1]} золота`,es:`Saldo: ${m[1]} de oro`})[locale]],
);

/* Existing domain owners, mounted inside the approved B2.5 shell. No new storage. */
window.SatoruPlanBridge=(()=>{
  let revision=0,attempt=null,preferenceBusy=false;
  const scope=()=>({account:String(State.me?.id||''),epoch:Store._writeEpoch});
  const current=s=>s.account===scope().account&&s.epoch===scope().epoch&&State.phase==='app';
  const graph=()=>({goals:State.goals||[],tasks:State.tasks||[],groups:State.goalGroups||[],skills:State.settings?.skills||[]});
  const snapshot=()=>({revision,view:State.view,settingsGroup:State.settingsSection,
    goals:State.goals||[],groups:State.goalGroups||[],routine:State.settings?.weeklyRoutineV1||null,routineDraft:window.RoutineV2.normalize(State.settings?.weeklyRoutineV1),
    preferences:{appName:State.settings?.appName||'Satoru',language:lang(),theme:State.settings?.theme||'dark',accent:State.settings?.accent||'',sound:State.settings?.sound!==false,motion:State.settings?.motion!==false},
    goalProgress:Object.fromEntries((State.goals||[]).map(g=>[g.id,goalProgress(g)])),
  });
  function originalRender(){revision++;window.dispatchEvent(new CustomEvent('satoru:legacy-route',{detail:{view:State.view,group:State.settingsSection,navigation:window.SatoruTodayBridge?.navigation()}}));}
  function view(view,group){if(State.view!==view)sfx('navigate');State.view=view;if(group!==undefined)State.settingsSection=group;}
  async function flush(){
    if(!document.getElementById('skills-list'))return true;
    const owner=scope(),deadline=Date.now()+15000;
    // An in-flight autosave is pending, not a failed receipt. Wait for its owner,
    // then flush the final captured revision before unmounting any controls.
    while(SettingsAutosave.saving&&current(owner)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
    if(!current(owner)||SettingsAutosave.saving)return false;
    const pending=SettingsAutosave.failed||SettingsAutosave.revision>SettingsAutosave.durableRevision||Store._timers?.settings||Store._timers?.skilltree||Store._timers?.habits;
    if(!pending)return true;
    const saved=await flushSettingsForm();
    if(saved&&current(owner))window.SatoruLiveBridge?.emit();
    return saved&&current(owner);
  }
  async function preference(action,value){
    if(preferenceBusy)return false;preferenceBusy=true;const owner=scope();let ok=false;
    try{
      if(!await flush()||!current(owner))return false;
      if(action==='set-theme')ok=await persistThemeChoice(value);
      else{
        if(action==='set-lang'&&!APP_LANGS.includes(value)||action==='set-accent'&&!ACCENTS.includes(value))return false;
        if(!['set-lang','set-accent','set-motion'].includes(action)||action==='set-motion'&&!['0','1'].includes(value))return false;
        ok=await Store.updateNow('settings',settings=>current(owner)?{...settings,...(action==='set-lang'?{lang:value}:action==='set-motion'?{motion:value==='1'}:{accent:value,systemMode:false})}:undefined,settings=>{if(!current(owner))return false;State.settings=settings;return true;});
      }
      if(current(owner)){if(ok){applyTheme();render();}else{const status=document.querySelector?.('.settings-save-state');if(status){status.textContent=t('Не удалось сохранить изменения.');status.setAttribute('role','alert');}toast(t('Не удалось сохранить изменения.'));}}
      return ok&&current(owner);
    }finally{preferenceBusy=false;}
  }
  function mount(host,kind,group){
    const viewName=kind==='settings'?'settings':kind==='habits'?'habits':'shelf';
    State.view=viewName;if(group)State.settingsSection=group;
    const openedSkills=new Set([...host.querySelectorAll('.b210-skill-row[open]')].map(el=>el.dataset.skill));
    const sameGroup=host.dataset.settingsGroup===group;
    const openedSections=new Set([...host.querySelectorAll('.b210-owned-section[open]')].map(el=>el.dataset.section));
    const staging=document.createElement('div');staging.innerHTML=safeViewMarkup(viewName);
    staging.querySelectorAll('.b26-settings').forEach(el=>el.classList.remove('b26-settings'));
    if(viewName==='settings'){
      staging.querySelectorAll('.settings-group').forEach(el=>{el.hidden=el.dataset.settingsGroup!==group;});
      staging.querySelectorAll('.settings-hub h2,.settings-hub>div>p,.settings-hub-nav,.b26-settings-back,.settings-group-head').forEach(el=>el.hidden=true);
      // Spheres are the main task here; keep all hidden controls for the original capture owner.
      if(group==='life'){const skills=staging.querySelector('#skills-list')?.closest('.card');const section=staging.querySelector('section.settings-group[data-settings-group="life"]');if(skills&&section)section.prepend(skills);}
      const wrap=(node,key,caption,defaultOpen=false)=>{
        if(!node)return;const details=document.createElement('details'),summary=document.createElement('summary');
        details.className='b210-owned-section settings-disclosure';details.dataset.section=key;summary.textContent=caption;details.append(summary);node.before(details);details.append(node);details.open=sameGroup?openedSections.has(key):defaultOpen;
        node.querySelector('h3,h4')?.setAttribute('hidden','');
      };
      const account=staging.querySelector('section.settings-group[data-settings-group="account"]');
      if(account){const security=account.querySelector('#change-password,#add-email')?.closest('.card');if(security)account.prepend(security);[...account.children].filter(el=>el.classList.contains('card')).forEach((node,i)=>wrap(node,'account-'+i,node===security?t('Вход и восстановление'):node.querySelector('h3,h4')?.textContent.trim()||t('Профиль'),node===security&&group==='account'));}
      const connections=staging.querySelector('section.settings-group[data-settings-group="connections"]');
      if(connections){
        const ai=connections.querySelector('.connections-ai'),local=connections.querySelector('.connections-local-ai'),memory=connections.querySelector('.ai-memory-card'),context=connections.querySelector('.connections-memory');
        if(local)connections.prepend(local);if(ai)connections.prepend(ai);if(memory)connections.append(memory);if(context)connections.append(context);
        if(ai)ai.open=group==='connections'&&(!sameGroup||!!host.querySelector('.connections-ai[open]'));
        [...connections.children].filter(el=>el.classList.contains('card')&&el.tagName!=='DETAILS').forEach((node,i)=>wrap(node,'connection-'+i,node.querySelector('h3,h4')?.textContent.trim()||t('Подключения')));
      }
    }
    if(lang()!=='ru')translateDOM(staging);
    commitMainView(host,staging,viewName);
    host.dataset.settingsGroup=group||'';
    host.querySelectorAll('form').forEach(form=>{form.method='post';if(!form.dataset.b210Guard){form.dataset.b210Guard='1';form.addEventListener('submit',e=>e.preventDefault());}});
    host.querySelectorAll('.skill-edit').forEach(row=>{
      row.querySelectorAll('input,select').forEach(control=>control.setAttribute('data-noi18n',''));
      const skill=State.settings.skills.find(s=>s.id===row.dataset.id),details=document.createElement('details'),summary=document.createElement('summary'),name=document.createElement('span'),meta=document.createElement('small');
      details.className='b210-skill-row';details.dataset.skill=row.dataset.id;details.style.setProperty('--skill-depth',row.style.getPropertyValue('--d')||'0');
      name.textContent=skill?.name||'Сфера';name.dataset.noi18n='';meta.textContent=skill?.parentId?skillLabel(skill.parentId):skill?.archived?t('Архив'):t('Самостоятельная сфера');meta.dataset.noi18n='';summary.append(name,meta);details.append(summary);row.before(details);details.append(row);details.open=openedSkills.has(row.dataset.id)||skill?.name==='Новая сфера';
    });
  }
  const occurrences=dates=>Object.fromEntries(routineForDates(dates));
  async function run(command,input,expected){
    if(!current(expected))throw Error('Аккаунт изменился. Обнови страницу.');
    if(command==='routine.workshop'){State.weekStart=input.week||weekStart(todayStr());openWeekWorkshop();return {ok:true};}
    if(command==='routine.open'){openRoutineOccurrence(input.key);return {ok:true};}
    if(command==='routine.save'){
      if(!settingsWriteAllowed('B2.10',true))return {ok:false};
      const api=window.RoutineV2,blocks=api.blocks(input.value.blocks);
      if(blocks.some(b=>!b.title||b.skillId&&!State.settings.skills.some(s=>s.id===b.skillId)))throw Error('Проверь названия занятий и сферы аккаунта.');
      const from=api.minutes(input.value.from),to=api.minutes(input.value.to);
      if(from===null||to===null||from>=to||input.value.cycleStart&&!api.isDate(input.value.cycleStart))throw Error('Проверь часы и начало чередования.');
      const value={blocks,from:input.value.from,to:input.value.to,cycleStart:input.value.cycleStart||null,text:String(input.value.text||'').slice(0,6000)};
      const saved=await Store.updateNow('settings',settings=>{
        if(!current(expected))return undefined;
        if(blocks.some(b=>b.skillId&&!settings.skills.some(s=>s.id===b.skillId)))return undefined;
        const old=settings.weeklyRoutineV1||null;
        const next={...(old||{}),...value};
        if(JSON.stringify(old)!==input.base&&JSON.stringify(old)!==JSON.stringify(next))return undefined;
        return {...settings,weeklyRoutineV1:next};
      },settings=>{if(!current(expected))return false;State.settings=settings;return true;});
      return {ok:saved,notice:saved?'Расписание сохранено. Занятия не создают долг.':''};
    }
    if(command==='routine.restore'){
      const saved=await Store.updateNow('settings',settings=>{if(!current(expected))return undefined;const r=settings.weeklyRoutineV1||{};return {...settings,weeklyRoutineV1:{...r,skips:(r.skips||[]).filter(k=>k!==input.key)}};},settings=>{if(!current(expected))return false;State.settings=settings;return true;});return {ok:saved};
    }
    if(!goalWriteAllowed('B2.10',true))return {ok:false};
    const key=JSON.stringify([expected,command,input]);
    if(attempt?.key!==key){
      let candidate;
      if(command==='goal.quest'){
        const goal=goalById(input.goalId);if(!goal||JSON.stringify(goal)!==input.base)throw Error('Цель изменилась. Открой её заново.');
        const result=window.GoalStepQuestV1.planStepQuest({goal,stepId:input.stepId,tasks:State.tasks,today:input.date||todayStr(),id:input.id,createdAt:new Date().toISOString(),skillId:goal.skillId,skillIds:goalSkillIds(goal),layers:goalBackgroundSkillIds(goal)});
        if(result.status==='exists')return {ok:true,notice:'Этот шаг уже есть среди квестов.'};
        if(result.status!=='create')throw Error('Этот шаг больше нельзя добавить в день.');
        candidate={...structuredClone(graph()),tasks:[...structuredClone(State.tasks),result.task]};
      }else candidate=window.SatoruLiveModel.goalMutation(graph(),command,input,new Date().toISOString(),GOAL_XP,todayStr());
      for(const g of candidate.goals){const old=goalById(g.id);if(command!=='goal.state'&&command!=='goal.link'&&JSON.stringify(old)!==JSON.stringify(g))refreshGoalCompletion(g,{announce:false});}
      attempt={key,candidate};
    }
    const data=attempt.candidate,ok=await goalDataCommit(data.goals,data.tasks,data.groups);
    if(!current(expected))return {ok:false};
    if(ok){State.goals=data.goals;State.tasks=data.tasks;State.goalGroups=data.groups;attempt=null;}
    return {ok};
  }
  return {snapshot,originalRender,view,flush,preference,mount,occurrences,run,translate:translateDOM,accepts:c=>/^(goal\.|group\.|routine\.)/.test(c)};
})();

/* B2.5 presentation; original economy, chest issuer and inventory owners. */
window.SatoruRewardsBridge=(()=>{
 let attempt=null;
 const current=s=>State.phase==='app'&&s.account===String(State.me?.id||'')&&s.epoch===Store._writeEpoch;
 const errors=()=>[...['rewards','purchases','lootbox','achievements'].filter(k=>State._accountDataLoadErrors?.[k]).map(k=>({rewards:'Личные награды',purchases:'История покупок',lootbox:'Сундуки',achievements:'Достижения'}[k])+' не загрузились. Обнови страницу; сохранённые данные не заменены.'),...(!window.RewardLifeV1.valid(State.settings?.rewardLifeV1)?['Статусы наград не читаются. Исходные данные сохранены; открой восстановление в настройках.']:[]),...(State._lootboxReadUnsupported?['Данные сундука не читаются. Открой восстановление в настройках.']:[])];
 const snapshot=()=>({rewards:State.rewards||[],purchases:State.purchases||[],catalog:REWARD_CATALOG.map((r,i)=>({...r,id:'catalog-'+i,name:t(r.name),catalogNameKey:r.name})),life:State.settings?.rewardLifeV1||{},nextReward:State.settings?.personalRewardTargetV1||undefined,limit:isPro()?5000:FREE_REWARDS_MAX,errors:errors()});
 function guard(expected){if(!current(expected))throw Error('Аккаунт изменился. Обнови страницу.');if(errors().length||State._settingsLoadError||!settingsWriteAllowed('B2.11',true)||!['rewards','purchases'].every(k=>accountDataWriteAllowed(k,'B2.11',true)))throw Error('Сначала восстанови загрузку наград и настроек.');}
 async function run(command,input,expected){
  guard(expected);
  if(command==='reward.life'&&input.status==='planned'&&State.tasks.some(t=>t.rewardPurchaseId===input.id)){
   const key=JSON.stringify([expected,command,input]);if(attempt?.key!==key||!attempt.now)attempt={key,now:new Date().toISOString()};
   const now=attempt.now,ok=await commitmentDataCommit(({settings,tasks})=>{
    if(!current(expected))return null;const linked=tasks.find(t=>t.rewardPurchaseId===input.id);if(!linked||linked.done)return null;
    const next=window.RewardLifeV1.change(settings,State.purchases,input.id,'planned',input.date,now);
    if(linked.date!==input.date){const before=structuredClone(linked);linked.date=input.date;const note=window.StuckTaskV1?.notePostpone(before,input.date,todayStr());if(note)Object.assign(linked,note);if(!releaseActiveQuestCommitmentCandidate(next,linked).ok)return null;}
    return{settings:next,tasks};
   });if(ok&&current(expected))attempt=null;return{ok:ok&&current(expected)};
  }
  if(command==='reward.open')return{ok:!!showEconomyConfirm(input.kind,input.id,document.activeElement)};
  if(command==='reward.rest'){
   const task=input.task,p=State.purchases.find(p=>p.id===task.rewardPurchaseId&&p.rewardId);if(!p)throw Error('Полученная награда не найдена.');
   const other=State.tasks.find(t=>t.rewardPurchaseId===p.id);if(other&&other.id!==task.id)throw Error('Этот отдых уже есть в плане. Открой его заново.');
   if(!other&&task.id!=='reward-rest:'+p.id)throw Error('Обнови форму отдыха.');
   const now=new Date().toISOString();
   window.SatoruLiveModel.buildTask(State.tasks,task,input.base,State.settings.skills,now);
   const ok=await commitmentDataCommit(({settings,tasks})=>{
    if(!current(expected))return null;
    const duplicate=tasks.find(t=>t.rewardPurchaseId===p.id&&t.id!==task.id);if(duplicate)return null;
    const next=window.SatoruLiveModel.buildTask(tasks,task,input.base,settings.skills,now),linked=next.find(t=>t.id===task.id);
    linked.rewardPurchaseId=p.id;
    const before=tasks.find(t=>t.id===task.id);if(before&&before.date!==linked.date){const note=window.StuckTaskV1?.notePostpone(before,linked.date,todayStr());if(note)Object.assign(linked,note);if(!releaseActiveQuestCommitmentCandidate(settings,linked).ok)return null;}
    return{settings:window.RewardLifeV1.change(settings,State.purchases,p.id,linked.done?'used':'planned',linked.done?null:linked.date,now),tasks:next};
   });return{ok};
  }
  const key=JSON.stringify([expected,command,input]);
  if(attempt?.key!==key){
   let data;
   if(command==='reward.save')data={rewards:window.SatoruLiveModel.savePersonalReward(State.rewards,input.reward,input.base,isPro()?5000:FREE_REWARDS_MAX,new Date().toISOString())};
   else if(command==='reward.pin'){
    if(input.id&&!State.rewards.some(r=>r.id===input.id))throw Error('Награда больше не существует.');
    data={settings:{...structuredClone(State.settings),personalRewardTargetV1:input.id||null}};
   }else if(command==='reward.life'){
    const linked=State.tasks.find(t=>t.rewardPurchaseId===input.id);
    if(linked?.done&&input.status!=='used')throw Error('Сначала отмени выполнение связанного квеста в Плане.');
    data={settings:window.RewardLifeV1.change(State.settings,State.purchases,input.id,input.status,input.date||null,new Date().toISOString())};
   }else throw Error('Неизвестное действие награды.');
   attempt={key,data};
  }
  const pending=attempt,ok=await economyCommit(pending.data);
  if(!current(expected))return{ok:false};
  if(ok){for(const [k,v]of Object.entries(pending.data))State[k]=v;attempt=null;checkAchievements();}
  return{ok,error:ok?'':economySaveUnconfirmed(pending.data)};
 }
 function mount(host,part){
  const opened=new Set([...host.querySelectorAll('details[open]')].map(e=>e.className));
  const staging=document.createElement('div');
  staging.innerHTML=part==='chest'?lootboxCard():renderRewards();
  if(part!=='chest'){const selected=document.createElement('div');staging.querySelectorAll('.gold-goal,.furniture-collection,.collection-card,.arsenal-disclosure,.achievements-disclosure').forEach(el=>selected.append(el));staging.replaceChildren(selected);}
  staging.querySelectorAll('details').forEach(d=>d.open=opened.has(d.className));
  staging.querySelectorAll('.th-kicker').forEach(e=>e.remove());
  if(lang()!=='ru')translateDOM(staging);
  commitMainView(host,staging,'rewards');
 }
 return{snapshot,run,mount,accepts:c=>c.startsWith('reward.')};
})();

/* Actual domain owners only. This adapter is injected into the isolated live engine. */
window.SatoruWorldBridge=(()=>{
 let attempt=null;
 const scope=()=>({account:String(State.me?.id||''),epoch:Store._writeEpoch});
 const current=s=>State.phase==='app'&&s.account===scope().account&&s.epoch===scope().epoch;
 const errors=()=>[State._treeLoadError&&'Путь не загрузился. Сохранённая карта не заменена; повтори загрузку.',State._settingsLoadError&&'Настройки Мира не загрузились.',State._accountDataLoadErrors?.episodes&&'Эпизоды не загрузились. История не заменена.'].filter(Boolean);
 function snapshot(){
  const c=State.settings?.companion||{},curve=State.settings.curve,level=levelInfo(overallXp(),curve.base,curve.growth),rank=charRank();
  return{errors:errors(),level,rank:{name:t(rank.name),color:rank.color},title:equippedTitle()||'',archetype:t(archetype().name),visuals:Object.fromEntries(['avatarAppearance','avatarCoreGender','avatar','body','wear','gear','cosmetics','petNames','petSpecies','fortuneSkins','fortuneProps'].map(k=>[k,State.settings[k]??null])),
   companion:{name:c.name||'Тень',bond:c.bond||0,tier:t(COMP_TIERS[compTierIdx(c.bond||0)].name),next:compNextTier(c.bond||0),pet:c.pet||'',check:c.check?.[todayStr()]||{},journal:c.journal||[]},
   pets:topSkills().map(s=>{const traits=petTraits(s.id),stats=petStats(s.id);return{id:s.id,name:petName(s.id),sphere:sphereNameText(s.name),color:s.color,species:petSpeciesForSphere(s.id,traits),level:skillLevelOf(s.id),xp:skillXp(s.id),stats,hint:t(traits[0]?.hint||''),kind:t(traits[0]?.kind||'Спутник')};}),
   trees:State._treeLoadError?{}:State.tree||{},nodes:Object.fromEntries(Object.entries(State.tree||{}).map(([id,tree])=>[id,(tree.nodes||[]).map(n=>({...n,title:treeNodeCopy(n,'title'),desc:treeNodeCopy(n,'desc'),criterion:treeNodeCriterion(n),nextAction:treeNodeNextAction(n),state:treeNodeState(id,n),reason:treeNodeLockReason(id,n),perks:nodePerks(n),effects:nodePerks(n).map(p=>PERK_KINDS[p.kind]?t(PERK_KINDS[p.kind].fmt(p.val)):'').filter(Boolean)}))])),
   points:Object.fromEntries(Object.keys(State.tree||{}).map(id=>[id,{earned:treePointsEarned(id),spent:treePointsSpent(id),available:treePointsAvailable(id)}])),
   progressTasks:State.tasks.map(task=>({id:task.id,done:task.done,date:dayOf(task),actualMin:task.actualMin,skillIds:taskSkills(task),skillId:task.skillId})),perks:Object.entries(PERK_KINDS).map(([id,p])=>({id,label:t(p.label),cap:p.cap})),events:xpEvents(),episodes:(State.episodes||[]).map(e=>({...e,xp:episodeTotalXp(e),days:episodeDays(e).length})),rawEpisodes:State.episodes||[],episodeTypes:EPISODE_TYPES.map(e=>({id:e.id,name:t(e.name)})),intensities:EPISODE_INTENSITY.map(v=>t(v)),record:longestStreak(),den:structuredClone(State.settings.den||{})};
 }
 function guard(expected,command){
  if(!current(expected))throw Error('Аккаунт изменился. Обнови страницу.');
  if(State._settingsLoadError||!settingsWriteAllowed('B2.12',true))throw Error('Сначала восстанови загрузку настроек.');
  if(command.startsWith('world.tree')&&(State._treeLoadError||State._treeLoadBusy))throw Error('Путь не загрузился. Повтори загрузку.');
  if(command.startsWith('world.episode')&&!accountDataWriteAllowed('episodes','B2.12',true))throw Error('Сначала восстанови загрузку эпизодов.');
 }
 async function run(command,input={},expected=scope()){
  if(command==='world.retry'){if(!current(expected))return{ok:false};await retrySkillTreeLoad();return{ok:!State._treeLoadError&&current(expected)};}
  guard(expected,command);
  if(command==='world.care'){
   const c=State.settings.companion||{},already=input.kind==='pet'?c.pet===todayStr():c.check?.[todayStr()]?.[input.kind];
   if(already)return{ok:true,notice:'Сегодня это уже записано.'};
   const ok=await saveCompanionCare(input.kind,input.text);if(ok&&current(expected))try{window.ShadowRig?.setTransient('happy',1000);}catch{}return{ok:ok&&current(expected)};
  }
  if(command==='world.shadowName')return{ok:await saveCompanionName(input.name)&&current(expected)};
  if(command==='world.aiMap'){if(!State.tree[input.skillId])throw Error('Сначала выбери загруженную сферу.');State.treeSkill=input.skillId;openTreeMapAI();return{ok:true};}
  if(command==='world.episode.open'){openEpisode();return{ok:true};}
  if(command==='world.episode.save'||command==='world.episode.remove'){
   const key=JSON.stringify([expected,command,input]);
   if(attempt?.key!==key){
    const episodes=State.episodes||[];
    if(command==='world.episode.remove'){
     const ep=episodes.find(e=>e.id===input.id);if(!ep||JSON.stringify(ep)!==input.base)throw Error('Эпизод изменился. Открой его заново.');
     attempt={key,episodes:episodes.filter(e=>e.id!==input.id),before:JSON.stringify(episodes)};
    }else attempt={key,episodes:window.SatoruLiveModel.saveWorldEpisode(episodes,input.episode,input.base,State.settings.skills.map(s=>s.id),todayStr(),new Date().toISOString()),before:JSON.stringify(episodes)};
   }
   const pending=attempt,ok=await Store.updateNow('episodes',stored=>{
    if(!current(expected))return null;
    if(JSON.stringify(stored)!==pending.before&&JSON.stringify(stored)!==JSON.stringify(pending.episodes))throw Error('История изменилась. Открой эпизод заново.');
    return pending.episodes;
   },committed=>{if(!current(expected))return false;State.episodes=committed;return true;});
   if(ok&&current(expected)){attempt=null;checkAchievements();}return{ok:ok&&current(expected)};
  }
  if(command==='world.tree.plan'){
   if(!accountDataWriteAllowed('tasks','B2.12',true)||State._tasksLoadError)throw Error('Квесты не загрузились.');
   const n=State.tree[input.skillId]?.nodes.find(n=>n.id===input.id);if(!n||!treeNodeNextAction(n))throw Error('Укажи следующий шаг в редакторе вехи.');
   const existing=State.tasks.find(t=>t.treeNodeId===n.id&&(!t.treeSkillId||t.treeSkillId===input.skillId));if(existing)return{ok:true,notice:'Этот шаг уже есть в Плане.'};
   const task={id:'tree-step:'+input.skillId+':'+n.id,title:treeNodeNextAction(n),date:todayStr(),estimateMin:30,startTime:null,difficulty:'normal',skillId:input.skillId,skillIds:[input.skillId],layers:[],core:false,treeNodeId:n.id,treeSkillId:input.skillId};
   const ok=await Store.updateNow('tasks',tasks=>{if(tasks.some(t=>t.id===task.id||t.treeNodeId===n.id&&(!t.treeSkillId||t.treeSkillId===input.skillId)))return tasks;const next=window.SatoruLiveModel.buildTask(tasks,task,null,State.settings.skills,new Date().toISOString());Object.assign(next.find(t=>t.id===task.id),{treeNodeId:n.id,treeSkillId:input.skillId});return next;},value=>{if(!current(expected))return false;State.tasks=value;return true;});return{ok:ok&&current(expected)};
  }
  const key=JSON.stringify([expected,command,input]);
  if(attempt?.key!==key){
   let data;
   if(command==='world.tree.import'){
    if(input.base!==JSON.stringify(State.tree[input.skillId]))throw Error('Путь изменился. Проверь предложения ещё раз.');
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>6||input.items.some(n=>!n||typeof n.title!=='string'||!n.title.trim()||n.title.length>180||typeof n.criterion!=='string'||n.criterion.length>500||typeof n.nextAction!=='string'||n.nextAction.length>300))throw Error('Проверь выбранные вехи, критерии и шаги.');
    const live=State.tree,tree=structuredClone(live);
    try{State.tree=tree;applyPersonalMap(input.skillId,input.items);}finally{State.tree=live;}
    if(tree[input.skillId].nodes.some(n=>(n.requires||[]).some(id=>!tree[input.skillId].nodes.some(o=>o.id===id))))throw Error('Игровой бонус связан с заменяемой вехой. Сначала измени эту зависимость в редакторе.');
    if(!validateSkillTreePayload(tree))throw Error('Формат пути не прошёл проверку.');data={skilltree:tree};
   }else if(command==='world.tree.edit'){
    const tree=window.SatoruLiveModel.editWorldTree(State.tree,input.skillId,input);if(!validateSkillTreePayload(tree))throw Error('Формат пути не прошёл проверку.');
    data={skilltree:tree};
   }else if(command==='world.tree.arrange'){
    if(input.base!==JSON.stringify(State.tree[input.skillId]))throw Error('Путь изменился. Открой его заново.');
    const tree=structuredClone(State.tree);arrangeTreeOverlaps(tree[input.skillId]);data={skilltree:tree};
   }else if(command==='world.tree.unlock'){
    const n=State.tree[input.skillId]?.nodes.find(n=>n.id===input.id);if(!n)throw Error('Узел не найден.');
    if(n.unlocked)return{ok:true,notice:'Узел уже открыт.'};
    if(!nodeUnlockable(input.skillId,n))throw Error(treeNodeLockReason(input.skillId,n)||'Этот узел пока недоступен.');
    const tree=structuredClone(State.tree),node=tree[input.skillId].nodes.find(n=>n.id===input.id);node.unlocked=true;
    data={skilltree:tree};
    if(treeNodeKind(n)==='capability'){
     if(!input.confirm)throw Error('Подтверди, что результат достигнут.');
     node.claimedAt=new Date().toISOString();node.claimSource='self';const proof=String(input.proof||'').trim().slice(0,500);if(proof)node.proofNote=proof;
     const settings=structuredClone(State.settings),c=ensureCompanion(settings);c.journal=c.journal.concat({date:todayStr(),kind:'ms',skillId:input.skillId,nodeId:n.id,title:n.title,titleKey:n.titleKey||null,text:treeNodeCopy(n,'title')}).slice(-120);data.settings=settings;
    }
   }else if(command==='world.pet.name'){
    if(!topSkills().some(s=>s.id===input.id))throw Error('Сфера не найдена.');
    const settings=structuredClone(State.settings);settings.petNames={...settings.petNames,[input.id]:String(input.name||'').trim().slice(0,20)};data={settings};
   }else if(command==='world.pet.look'){
    const id=input.id;if(!topSkills().some(s=>s.id===id))throw Error('Сфера не найдена.');
    const settings=structuredClone(State.settings),value=input.value||'';
    if(input.part==='species'){
     const species=petSpeciesForSphere(id,petTraits(id));if(['bodyToad','resourcesPenguin'].includes(species))throw Error('Облик канонического хранителя пока фиксирован.');
     if(value&&(!PET_SPECIES[value]||PET_SPECIES[value].guardianV1))throw Error('Этот облик недоступен.');
     settings.petSpecies={...settings.petSpecies};if(value)settings.petSpecies[id]=value;else delete settings.petSpecies[id];
    }else if(['skin','prop'].includes(input.part)){
     const catalog=input.part==='skin'?FORTUNE_SKINS:FORTUNE_PROPS,key=input.part==='skin'?'fortuneSkins':'fortuneProps';if(value&&!catalog[value])throw Error('Облик не найден.');settings[key]={...settings[key]};if(value)settings[key][id]=value;else delete settings[key][id];
    }else{
     if(!['head','neck','back'].includes(input.part))throw Error('Слот не найден.');const item=wearableById(value);if(value&&(!item||item.species!=='fortune'||item.slot!==input.part||!item.png))throw Error('Предмет не подходит этому слоту.');
     settings.wear=structuredClone(settings.wear||{owned:[],pet:{},avatar:{}});settings.wear.pet||={};settings.wear.pet[id]||={};if(value)settings.wear.pet[id][input.part]=value;else delete settings.wear.pet[id][input.part];
    }data={settings};
   }else throw Error('Неизвестное действие Мира.');
   attempt={key,data};
  }
  const pending=attempt,ok=await economyCommit(pending.data);
  if(!current(expected))return{ok:false};
  if(ok){for(const[k,v]of Object.entries(pending.data))State[Store._liveSlot(k)]=v;attempt=null;checkAchievements();}
  return{ok,error:ok?'':economySaveUnconfirmed(pending.data)};
 }
 // The scene contract is independent of its renderer. 3D must use the same room,
 // ownership, focus and care owners; never create another room/account store.
 function mount(host,part,id){
  if(part==='den'&&!host.firstElementChild)State._denEdit=true;
  const opened=new Set([...host.querySelectorAll('details[open]')].map(e=>e.id||e.className));
  const staging=document.createElement('div');let view='character';
  if(part==='scene'||part==='den'){staging.innerHTML=renderDen();view='den';if(part==='scene'){const shell=staging.querySelector('.den-shell'),scene=staging.querySelector('.den-scene');if(shell&&scene){shell.replaceChildren(scene);staging.replaceChildren(shell);}}}
  else if(part==='heroArt')staging.innerHTML=avatarFigureHTML({appearance:avatarAppearance()});
  else if(part==='wardrobe'||part==='heroExtras'){staging.innerHTML=renderCharacter();const selected=staging.querySelector(part==='wardrobe'?'.character-wardrobe-layout':'.character-secondary');staging.replaceChildren(...(selected?[selected]:[]));}
  else if(part==='profile'){staging.innerHTML=identityProfileCard();view='settings';}
  else if(part==='petArt'){const traits=petTraits(id);staging.innerHTML=petSVG(skillById(id).color||'#6c8cff',petStats(id).state,traits,id);view='pets';}
  else if(part==='petControls'||part==='recovery'){
   staging.innerHTML=renderPets();view='pets';const selected=part==='recovery'?staging.querySelector('.pet-card-recovery-slug'):staging.querySelector('#pet-summary-'+CSS.escape(id));staging.replaceChildren(...(selected?[selected]:[]));if(selected)selected.open=true;
  }else if(part==='stats'){staging.innerHTML=renderStats();staging.querySelector('.stats-route-head')?.remove();view='stats';}
  else if(part==='collection'){window.SatoruRewardsBridge.mount(host,'collection');return;}
  staging.querySelectorAll('.th-kicker,.character-kicker,.settings-eyebrow').forEach(e=>e.remove());
  staging.querySelectorAll('details').forEach(d=>{if(opened.has(d.id||d.className))d.open=true;});
  if(part==='scene')host.dataset.sceneRenderer='den-'+(staging.querySelector('.den-scene')?.dataset.denRenderer||'source');
  if(lang()!=='ru')translateDOM(staging);commitMainView(host,staging,view);
  host.querySelectorAll('form').forEach(form=>{form.method='post';if(!form.dataset.b212Guard){form.dataset.b212Guard='1';form.addEventListener('submit',e=>e.preventDefault());}});
 }
 return{snapshot,run,mount,accepts:c=>c.startsWith('world.')};
})();
// Keep the original AI/manual episode composer, with confirmed persistence.
epSave=async function(){
 const dialog=document.getElementById('ep-modal')||document.getElementById('ep-title')?.closest('[role="dialog"],dialog,.modal');
 let status=document.getElementById('b212-ep-status');if(!status){status=document.createElement('p');status.id='b212-ep-status';status.setAttribute('role','status');document.getElementById('ep-title')?.parentElement.append(status);}
 const episode={id:dialog?.dataset.b212EpisodeId||('ep_'+crypto.randomUUID()),type:document.querySelector('.ep-type.on')?.dataset.id||'trip',title:document.getElementById('ep-title')?.value||'',from:document.getElementById('ep-from')?.value,to:document.getElementById('ep-to')?.value,story:document.getElementById('ep-text')?.value||'',profile:_epRows.filter(r=>r.intensity>0).map(r=>({skillId:r.skillId,intensity:r.intensity})),highlights:_epExtra.highlights||[],social:_epExtra.social||null};
 if(!episode.title.trim())episode.title=t(episodeType(episode.type).name);
 if(dialog)dialog.dataset.b212EpisodeId=episode.id;
 const controls=[...(dialog?.querySelectorAll('button,input,textarea')||[])];controls.forEach(c=>c.disabled=true);if(status)status.textContent=t('Сохраняю…');
 const result=await window.SatoruLiveBridge.run('world.episode.save',{episode,base:null});
 if(result.ok){closeAiSurfaceModal('episode');render();}else{controls.forEach(c=>c.disabled=false);if(status)status.textContent=result.error||t('Не удалось сохранить. Повтори попытку.');}
};
// Original pet look controls occur both inline and in a document-level editor.
for(const event of ['click','change'])document.addEventListener(event,async e=>{
 const el=e.target.closest?.('[data-action]');if(!el)return;const a=el.dataset.action;
 if(event==='click'&&a==='treemap-apply'){
  e.preventDefault();e.stopImmediatePropagation();const id=State.treeSkill,items=[...document.querySelectorAll('#treemap-result [data-treemap]:checked')].map(c=>_treeMapItems[Number(c.dataset.treemap)]).filter(Boolean);
  const controls=[...document.querySelectorAll('#treemap-modal button,#treemap-modal input,#treemap-modal textarea')];controls.forEach(c=>c.disabled=true);
  let status=document.getElementById('treemap-save-status');if(!status){status=document.createElement('p');status.id='treemap-save-status';status.setAttribute('role','status');document.getElementById('treemap-result')?.append(status);}status.textContent=t('Сохраняю…');
  const result=await window.SatoruLiveBridge.run('world.tree.import',{skillId:id,items,base:JSON.stringify(State.tree[id])});if(result.ok)closeTreeDialog('treemap-modal');else{controls.forEach(c=>c.disabled=false);status.textContent=result.error;}return;
 }
 if(event==='click'&&a==='ep-del'&&el.closest('.b212-owned')){
  e.preventDefault();e.stopImmediatePropagation();const ep=State.episodes.find(ep=>ep.id===el.dataset.id);if(!ep||!confirm(t('Удалить эпизод')+' «'+ep.title+'»? '+t('Опыт за него тоже уйдёт.')))return;
  const result=await window.SatoruLiveBridge.run('world.episode.remove',{id:ep.id,base:JSON.stringify(ep)});if(!result.ok)alert(result.error);return;
 }
 const select={'set-pet-species':'species','set-fortune-skin':'skin','set-fortune-prop':'prop','set-pet-wear-slot':el.dataset.slot};
 const pick={'pick-fortune-skin':'skin','pick-fortune-prop':'prop','pick-fortune-wear':el.dataset.slot};
 const part=event==='change'?select[a]:pick[a];if(!part)return;
 e.preventDefault();e.stopImmediatePropagation();el.disabled=true;
 const result=await window.SatoruLiveBridge.run('world.pet.look',{id:el.dataset.id,part,value:event==='change'?el.value:el.dataset.value||''});el.disabled=false;
 let status=el.parentElement?.querySelector('.b212-save-status');if(!status){status=document.createElement('p');status.className='b212-save-status';status.setAttribute('role','status');el.parentElement?.append(status);}status.textContent=result.ok?t('Сохранено'):result.error;
 if(result.ok&&a.startsWith('pick-'))showFortuneEditor(el.dataset.id,part);
},true);

window.SatoruTodayBridge=(()=>{
 const navigation=()=>({view:State.view,settingsGroup:State.settingsSection||'',calendarDate:State.calDate,calendarMode:State.calMode,goalId:State._goalOpenId||'',todayTab:State._todayTab||'day',entryFocus:State._liveEntryFocus||''});
 function mode(value){State.view=value==='Заметки'?'notes':'today';State._todayTab=value==='Доска'?'board':'day';if(value==='День')ensureSenkuDay();}
 function calendar(date,scale){State.calDate=date;State.calMode=({День:'day',Неделя:'week',Месяц:'month'})[scale]||'week';State.weekStart=weekStart(date);}
 async function run(command,input,expected){
  if(State.phase!=='app'||String(State.me?.id||'')!==expected.account||Store._writeEpoch!==expected.epoch)return{ok:false};
  if(command==='today.board.enter'){mode('Доска');if(await boardV2IssueStandardOffers())render();await boardV2LoadLocalStatus();return{ok:true};}
  if(command==='today.note.delete'){openNoteDeleteDialog(input.id,document.activeElement);return{ok:true};}
  if(command==='today.dayrec'){openDayRecap();return{ok:true};}
  throw Error('Неизвестное действие рабочего экрана.');
 }
 function mount(host,part){
  const draftAccount=String(State.me?.id||''),draftDay=todayStr();
  const draftKey=id=>'satoru.b213.draft:'+draftAccount+':'+(id==='capture'?'capture':draftDay+':'+id);
  const readDraft=id=>{try{return JSON.parse(sessionStorage.getItem(draftKey(id))||'null');}catch{return null;}};
  const forget=id=>{try{sessionStorage.removeItem(draftKey(id));}catch{}};
  const captureSaved=host.querySelector('#capture-form')?.dataset.persisted==='true';
  if(captureSaved)forget('capture');
  const staging=document.createElement('div');let view='today';
  if(part==='board')staging.innerHTML=boardScreenHTML();
  else if(part==='notes'){staging.innerHTML=renderNotes();staging.querySelector('.notes-header')?.remove();view='notes';}
  else if(part==='capture')staging.innerHTML=captureBar({expanded:true});
  else if(part==='review'){staging.innerHTML=renderToday();const review=staging.querySelector('.shutdown');staging.replaceChildren(...(review?[review]:[]));if(review)review.open=true;}
  else if(part==='tribe'){view=['party','leaderboard'].includes(State.view)?State.view:'party';staging.innerHTML=safeViewMarkup(view);}
  staging.querySelectorAll('.th-kicker,.route-kicker').forEach(e=>e.remove());
  // Only unsent drafts live here. Existing handlers still own every confirmed write.
  const savedFields={};for(const id of ['reflection','first-line']){const field=staging.querySelector('#'+id);if(field)savedFields[id]=field.value;}
  if(lang()!=='ru')translateDOM(staging);commitMainView(host,staging,view);
  for(const id of ['reflection','first-line','capture-text']){
   const field=host.querySelector('#'+id);if(!field)continue;const key=id==='capture-text'?'capture':id,base=savedFields[id]||'',draft=readDraft(key);
   if(draft&&(key==='capture'||draft.base===base))field.value=draft.value;else if(draft)forget(key);
   if(!field.dataset.b213Draft){field.dataset.b213Draft='1';field.addEventListener('input',()=>{try{sessionStorage.setItem(draftKey(key),JSON.stringify({base:field.dataset.b213Base||'',value:field.value}));}catch{}});}
   field.dataset.b213Base=base;
  }
  host.querySelectorAll('form').forEach(f=>{f.method='post';if(!f.dataset.b213Guard){f.dataset.b213Guard='1';f.addEventListener('submit',e=>e.preventDefault());}});
 }
 return{mount,run,navigation,mode,calendar,consumeCapture:()=>{State._liveEntryFocus='';},accepts:c=>c.startsWith('today.')};
})();

/* Injected only into the isolated B2.8 engine, before init().
 * State/Store and all domain writers below are the existing app's bindings. */
window.SatoruLiveBridge = (() => {
  let busy = false, bankPromise = null, bankError = '', calendarAttempt=null, calendarUndo=null;
  const scope = () => ({account:String(State.me?.id||''),epoch:Store._writeEpoch});
  const current = expected => expected.account === scope().account && expected.epoch === scope().epoch && State.phase === 'app';
  const snapshot = () => structuredClone({
    ...scope(),...window.SatoruPlanBridge?.snapshot(),navigation:window.SatoruTodayBridge?.navigation(),rewardsData:window.SatoruRewardsBridge?.snapshot(),worldData:window.SatoruWorldBridge?.snapshot(),name:State.me?.name||'',tasks:State.tasks||[],
    skills:(State.settings?.skills||[]).map(s=>({id:s.id,name:s.name,color:s.color,parentId:s.parentId,archived:s.archived})),
    inbox:State.inbox||[],days:State.days||{},habits:State.habits||[],habitlog:State.habitlog||{},weeks:State.weeks||{},
    deadlines:(State.goals||[]).filter(g=>!g.archived&&!g.completedAt&&g.status!=='completed').map(g=>({id:g.id,title:g.title,date:g.targetDate||'',primary:g.skillIds||[g.skillId].filter(Boolean)})),
    timer:State.timer,gold:goldBalance(),xp:overallXp(),streak:currentStreak(),
    shadowForm:Math.min(3,compTierIdx(State.settings?.companion?.bond||0)),
    pendingFocus:focusSessionSync().count(),chestsAvailable:lootChestsAvailable(),
    errors:[State._tasksLoadError&&'Квесты не загрузились. Обнови страницу перед изменениями.',
      State._inboxLoadError&&'Заметки не загрузились. Исходные записи сохранены.',
      State._settingsLoadError&&'Настройки не загрузились.',State._goalsLoadError&&'Цели не загрузились. Изменения заблокированы до восстановления.',State._goalGroupsLoadError&&'Проекты не загрузились.',
      State._accountDataLoadErrors?.days&&'Итоги дня не загрузились.',State._accountDataLoadErrors?.weeks&&'Намерения недели не загрузились.',bankError].filter(Boolean),
  });
  const emit = () => {if(State.phase==='app')window.SatoruLiveView?.render(snapshot());};
  // Same minute accounting as bankTimerProgress, but advance the checkpoint
  // only after Store confirms it. A failed write can be retried without loss.
  async function bank() {
    if(bankPromise)return bankPromise;
    const tm=State.timer, expected=scope();
    if(!tm||tm.ownerId!==expected.account)return true;
    const total=Math.floor(timerElapsedMs()/60000),delta=total-(tm.bankedMin||0);
    if(delta<=0&&!tm.b28Bank)return true;
    if(!tm.b28Bank){
      const from=questById(tm.taskId)?.actualMin??null;
      tm.b28Bank={from,to:(Number(from)||0)+delta,total};
      // Persist the absolute intent before sending it. A lost response/reload
      // cannot turn a retry into another delta against already-updated data.
      try{persistTimer();}catch{delete tm.b28Bank;bankError='Не удалось сохранить таймер на устройстве.';return false;}
    }
    const intent=tm.b28Bank;
    bankPromise=(async()=>{
      const saved=await Store.updateNow('tasks',tasks=>{
        if(!current(expected)||State.timer!==tm||!tasks.some(t=>t.id===tm.taskId))return undefined;
        const task=tasks.find(t=>t.id===tm.taskId),actual=task.actualMin??null;
        if(actual===intent.to)return tasks;
        if(actual!==intent.from)return undefined;
        return tasks.map(t=>t.id===tm.taskId?{...t,actualMin:intent.to}:t);
      },value=>{State.tasks=value;});
      if(!current(expected))return false;
      if(saved&&State.timer===tm){tm.bankedMin=intent.total;delete tm.b28Bank;persistTimer();bankError='';}
      else bankError='Время ещё не сохранено на сервере. Таймер оставлен на месте — повтори сохранение.';
      emit();return saved;
    })();
    try{return await bankPromise;}finally{bankPromise=null;}
  }
  async function endFocus(){
    const tm=State.timer;
    if(tm?.running){tm.accumulatedMs+=Date.now()-tm.startedAt;tm.running=false;persistTimer();}
    do{if(!await bank())return false;}
    while(State.timer===tm&&tm&&(tm.b28Bank||Math.floor(timerElapsedMs()/60000)>(tm.bankedMin||0)));
    stopFocus(true,true);return !State.timer;
  }
  function scheduleContext(settings,before,after){
    if(before.date===after.date)return true;
    const note=window.StuckTaskV1?.notePostpone(before,after.date,todayStr());if(note)Object.assign(after,note);
    return releaseActiveQuestCommitmentCandidate(settings,after).ok;
  }
  async function run(command,input={},expected=scope()) {
    if(!current(expected))return {ok:false,error:'Аккаунт изменился. Обнови страницу.'};
    if(busy)return {ok:false,error:'Предыдущее действие ещё сохраняется.'};
    busy=true;
    let ok=false, notice='', detail='Не удалось подтвердить сохранение. Данные формы оставлены — повтори попытку.';
    try {
      if(window.SatoruRewardsBridge?.accepts(command)){const result=await window.SatoruRewardsBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';detail=result.error||detail;}
      else if(window.SatoruWorldBridge?.accepts(command)){const result=await window.SatoruWorldBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';detail=result.error||detail;}
      else if(window.SatoruTodayBridge?.accepts(command)){const result=await window.SatoruTodayBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';}
      else if(window.SatoruPlanBridge?.accepts(command)){const result=await window.SatoruPlanBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';}
      else if(command==='task.save') {
        const {task,base}=input;
        // Validate before entering Store, so actionable errors reach the form.
        window.SatoruLiveModel.buildTask(State.tasks,task,base,State.settings.skills,new Date().toISOString());
        const old=questById(task.id);
        if(old&&(old.date!==task.date||old.rewardPurchaseId)){
          ok=await commitmentDataCommit(({settings,tasks})=>{const next=window.SatoruLiveModel.buildTask(tasks,task,base,settings.skills,new Date().toISOString());return scheduleContext(settings,tasks.find(t=>t.id===task.id),next.find(t=>t.id===task.id))?{settings,tasks:next}:null;});
        } else ok=await Store.updateNow('tasks',tasks=>window.SatoruLiveModel.buildTask(tasks,task,base,State.settings.skills,new Date().toISOString()),value=>{State.tasks=value;});
      } else if(command==='calendar.apply') {
        // Validate once for helpful UI errors, then again inside the paired lock.
        window.SatoruLiveModel.moveTasks(State.tasks,input.changes);
        const attemptKey=JSON.stringify([expected,input.changes]);
        if(calendarAttempt?.key!==attemptKey)calendarAttempt={key:attemptKey,before:structuredClone(State.tasks.filter(t=>input.changes.some(c=>c.id===t.id)))};
        const attempt=calendarAttempt;
        ok=await commitmentDataCommit(({settings,tasks})=>{
          const next=window.SatoruLiveModel.moveTasks(tasks,input.changes);
          for(const c of input.changes){if(!scheduleContext(settings,tasks.find(t=>t.id===c.id),next.find(t=>t.id===c.id)))return null;}
          return {settings,tasks:next};
        });
        if(ok&&current(expected)){
          const after=structuredClone(State.tasks.filter(t=>input.changes.some(c=>c.id===t.id)));
          calendarUndo={scope:expected,before:attempt.before,after};
          if(attempt.before.some(t=>t.commitmentId&&!after.find(a=>a.id===t.id)?.commitmentId))notice='Расписание обновлено. Прежняя временная граница снята.';
        }
      } else if(command==='calendar.undo') {
        const receipt=calendarUndo;if(!receipt||!current(receipt.scope))throw Error('Этот перенос уже нельзя отменить. Открой квест и выбери дату.');
        const signature=t=>JSON.stringify([window.SatoruLiveModel.schedule(t),t.postponedCount??null,t.firstDate??null,t.commitmentId??null]);
        const changes=receipt.before.map(before=>({id:before.id,before:window.SatoruLiveModel.schedule(receipt.after.find(t=>t.id===before.id)),after:window.SatoruLiveModel.schedule(before)}));
        ok=await commitmentDataCommit(({settings,tasks})=>{
          for(const after of receipt.after){const t=tasks.find(t=>t.id===after.id);if(!t||signature(t)!==signature(after))return null;}
          const next=window.SatoruLiveModel.moveTasks(tasks,changes);
          for(const before of receipt.before){const t=next.find(t=>t.id===before.id);for(const key of ['postponedCount','firstDate']){if(Object.hasOwn(before,key))t[key]=before[key];else delete t[key];}}
          return {settings,tasks:next};
        });
        if(ok){calendarUndo=null;calendarAttempt=null;if(receipt.before.some(t=>t.commitmentId&&!receipt.after.find(a=>a.id===t.id)?.commitmentId))notice='Дата возвращена. Прежняя временная граница остаётся снятой.';}
      } else if(command==='calendar.intent'||command==='calendar.budget') {
        const kind=command==='calendar.intent'?'intent':'budget';
        window.SatoruLiveModel.saveWeek(State.weeks||{},kind,input,State.settings.skills);
        ok=await Store.updateNow('weeks',weeks=>window.SatoruLiveModel.saveWeek(weeks||{},kind,input,State.settings.skills),value=>{State.weeks=value;});
      } else if(command==='task.complete'||command==='task.undo') {
        const task=questById(input.id);if(!task)throw Error('Квест больше не существует.');
        if(!taskWriteAllowed('B2.8',true))throw Error('Сначала восстанови загрузку квестов.');
        if(command==='task.complete'){
          if(State.timer?.taskId===task.id&&!await endFocus())throw Error(bankError||detail);
          const fresh=questById(input.id);
          ok=!!fresh&&(fresh.done||await completeTask(fresh,input.desire||null));
        } else ok=!task.done||await b28UndoTask(task.id);
      } else if(command==='task.actual') {
        ok=await commitmentDataCommit(({settings,tasks})=>{
          const next=window.TaskActualV1.update(tasks,input.id,input.minutes,input.expected,State.timer?.taskId);
          return next?{settings,tasks:next}:null;
        });
      } else if(command==='note.save') {
        const text=String(input.text||'').trim();if(!text||text.length>1000)throw Error('Напиши заметку до 1000 символов.');
        const old=State.inbox.find(n=>n.id===input.id);
        if(old&&old.text!==input.base&&old.text!==text)throw Error('Заметка изменилась. Открой её заново.');
        ok=await commitInbox(old?State.inbox.map(n=>n.id===input.id?{...n,text}:n):[{id:input.id,kind:'text',text,at:new Date().toISOString()},...State.inbox]);
      } else if(command==='note.quest') {
        await noteToQuest(input.id);
        ok=!State.inbox.some(n=>n.id===input.id)&&State.tasks.some(t=>t.noteSourceId===input.id);
      } else if(command==='day.save') {
        ok=await commitDayClosed(!!State.days[todayStr()]?.closed,{reflection:input.text});
      } else if(command==='habit.toggle') {
        const h=State.habits.find(h=>h.id===input.id);if(!h)throw Error('Привычка больше не существует.');
        const was=!!State.habitlog[habitDayKey()]?.[h.id];
        await transactHabitCompletion(h);
        ok=!!State.habitlog[habitDayKey()]?.[h.id]!==was;
      } else if(command==='focus.start') {
        const task=questById(input.id);if(!task||task.done)throw Error('Выбери незавершённый квест.');
        if(State.timer&&State.timer.taskId!==input.id&&!await endFocus())throw Error(bankError||detail);
        startFocus(input.id);ok=State.timer?.taskId===input.id;
      } else if(command==='focus.pause') {
        const tm=State.timer;if(!tm)throw Error('Таймер уже остановлен.');
        if(tm.running){tm.accumulatedMs+=Date.now()-tm.startedAt;tm.running=false;persistTimer();ok=await bank();}
        else if(await bank()){resumeFocus();ok=true;}
      } else if(command==='focus.stop') ok=await endFocus();
      else if(command==='focus.retry'){await focusSessionSync().flush();ok=focusSessionSync().count()===0;detail='Запись фокуса ещё ожидает отправки. Повтори при появлении сети.';}
      else if(command==='shadow.open'){openHelperChat();ok=true;}
      else throw Error('Это действие пока не подключено.');
      if(!current(expected))return {ok:false,error:'Аккаунт изменился. Обнови страницу.'};
      return {ok:!!ok,error:ok?'':detail,notice,snapshot:snapshot()};
    } catch(error){console.error('B2.8 command failed',command,error?.stack||error);return {ok:false,error:error instanceof Error?error.message:detail};}
    finally{busy=false;emit();}
  }
  return {snapshot,run,bank,emit};
})();

// Runs once, from the canonical init, after its lexical State/owners exist.
const sourceRender=render;
render=function(){
 if(State.phase==='app'&&window.SatoruLiveBridge&&window.SatoruLiveView){syncDeviceAccount();if(State.view==='today')ensureSenkuDay();window.SatoruPlanBridge.originalRender();window.SatoruLiveView.render(window.SatoruLiveBridge.snapshot());return;}
 window.SatoruLiveView?.hide();sourceRender();
};
const sourceBank=bankTimerProgress;
bankTimerProgress=function(){if(window.SatoruLiveBridge){void window.SatoruLiveBridge.bank();return 0;}return sourceBank();};
const sourceFocusWidget=openFocusWidget,sourcePill=updatePill;
openFocusWidget=async function(...args){if(window.SatoruLiveBridge)return;return sourceFocusWidget(...args);};
updatePill=function(...args){if(window.SatoruLiveBridge)return;return sourcePill(...args);};
const sourceToast=toast;
toast=function(msg){sourceToast(msg);window.dispatchEvent(new CustomEvent('satoru:legacy-toast',{detail:String(msg).replace(/🪙/gu,t('золота')).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim()}));};
for(const[phase,original,assign]of[
 ['login',renderLoginScreen,f=>renderLoginScreen=f],
 ['register-language',renderRegistrationLanguageScreen,f=>renderRegistrationLanguageScreen=f],
 ['register',renderRegisterScreen,f=>renderRegisterScreen=f],
 ['reset',renderResetScreen,f=>renderResetScreen=f],
 ['reset-token',renderResetTokenScreen,f=>renderResetTokenScreen=f],
])assign(function(){original();window.SatoruStartView?.mount(phase,lang());});
if(window.SatoruStartView)window.SatoruStartView.changeLanguage=code=>{if(APP_LANGS.includes(code)){State.authLang=code;render();}};

};
