(() => {
  "use strict";

  const MANIFEST_URL = "/art/avatars/avatar-forge-v1/art-manifest.json";
  const ASSET_ROOT = "/art/avatars/avatar-forge-v1/";
  const APPEARANCE_SCHEMA_VERSION = 2;
  const MESSAGE_VERSION = 1;
  const BATCH_ID = "avatar-forge-v1-20260801";
  const isEmbedded = window.parent !== window;

  const FALLBACK_MANIFEST = {
    schemaVersion: 1,
    batchId: "avatar-forge-v1-20260801",
    status: "runtime-enabled",
    runtimeIntegrationAllowed: true,
    canvas: [512, 768],
    base: {
      id: "mannequin-base",
      file: "production/mannequin-base-alpha.png",
    },
    slots: {
      hair: [
        { id: "none", file: null },
        { id: "traveller", file: "production/hair-traveller-alpha.png" },
        { id: "scholar", file: "production/hair-scholar-alpha.png" },
        { id: "explorer-bob", file: "production/hair-bob-alpha.png" },
      ],
      earwear: [
        { id: "none", file: null },
        { id: "soft-noise-headphones", file: "production/headphones-soft-noise-alpha.png" },
      ],
      outerwear: [
        { id: "none", file: null },
        {
          id: "traveller-coat-draft",
          file: "production/traveller-outerwear-alpha.png",
          defaultColorway: "teal",
          colorways: {
            teal: { swatch: "#187b80", file: "production/colorways/traveller/traveller-outerwear-teal-alpha.png" },
            blue: { swatch: "#365f9e", file: "production/colorways/traveller/traveller-outerwear-blue-alpha.png" },
            violet: { swatch: "#704c98", file: "production/colorways/traveller/traveller-outerwear-violet-alpha.png" },
            crimson: { swatch: "#99445a", file: "production/colorways/traveller/traveller-outerwear-crimson-alpha.png" },
            forest: { swatch: "#476659", file: "production/colorways/traveller/traveller-outerwear-forest-alpha.png" },
          },
        },
        {
          id: "scholar-coat-draft",
          file: "production/scholar-outerwear-alpha.png",
          defaultColorway: "forest",
          colorways: {
            teal: { swatch: "#187b80", file: "production/colorways/scholar/scholar-outerwear-teal-alpha.png" },
            blue: { swatch: "#365f9e", file: "production/colorways/scholar/scholar-outerwear-blue-alpha.png" },
            violet: { swatch: "#704c98", file: "production/colorways/scholar/scholar-outerwear-violet-alpha.png" },
            crimson: { swatch: "#99445a", file: "production/colorways/scholar/scholar-outerwear-crimson-alpha.png" },
            forest: { swatch: "#476659", file: "production/colorways/scholar/scholar-outerwear-forest-alpha.png" },
          },
        },
      ],
      neck: [
        { id: "none", file: null },
        { id: "traveller-scarf-draft", file: "production/traveller-scarf-alpha.png" },
        { id: "scholar-astrolabe-draft", file: "production/scholar-pendant-alpha.png" },
      ],
      eyewear: [
        { id: "none", file: null },
        { id: "traveller-goggles-draft", file: "production/traveller-goggles-alpha.png" },
        { id: "scholar-spectacles-draft", file: "production/scholar-glasses-alpha.png" },
      ],
      headwear: [
        { id: "none", file: null },
        { id: "scholar-hat-draft", file: "production/scholar-hat-alpha.png" },
      ],
      back: [
        { id: "none", renderParts: [] },
        {
          id: "traveller-backpack-draft",
          renderParts: [
            { file: "production/traveller-backpack-back-alpha.png", pass: "back" },
            { file: "production/traveller-backpack-front-alpha.png", pass: "front" },
          ],
        },
        {
          id: "scholar-backpack-draft",
          renderParts: [
            { file: "production/scholar-backpack-back-alpha.png", pass: "back" },
            { file: "production/scholar-backpack-front-alpha.png", pass: "front" },
          ],
        },
      ],
      waist: [
        { id: "none", file: null },
        { id: "traveller-pouch-draft", file: "production/traveller-pouch-alpha.png" },
        { id: "scholar-field-kit-draft", file: "production/scholar-waist-kit-alpha.png" },
      ],
      rightHand: [
        { id: "none", file: null },
        { id: "traveller-lantern-draft", file: "production/traveller-lantern-hand-alpha.png" },
        { id: "scholar-journal-draft", file: "production/scholar-journal-alpha.png" },
      ],
    },
    presets: [
      {
        id: "traveller",
        ownsSlots: ["hair", "earwear", "headwear", "outerwear", "neck", "eyewear", "back", "waist", "rightHand"],
        colors: { outerwear: "teal" },
        patch: {
          hair: "traveller",
          earwear: "none",
          headwear: "none",
          outerwear: "traveller-coat-draft",
          neck: "traveller-scarf-draft",
          eyewear: "traveller-goggles-draft",
          back: "traveller-backpack-draft",
          waist: "traveller-pouch-draft",
          rightHand: "traveller-lantern-draft",
        },
      },
      {
        id: "scholar",
        ownsSlots: ["hair", "earwear", "headwear", "outerwear", "neck", "eyewear", "back", "waist", "rightHand"],
        colors: { outerwear: "forest" },
        patch: {
          hair: "scholar",
          earwear: "none",
          headwear: "scholar-hat-draft",
          outerwear: "scholar-coat-draft",
          neck: "scholar-astrolabe-draft",
          eyewear: "scholar-spectacles-draft",
          back: "scholar-backpack-draft",
          waist: "scholar-field-kit-draft",
          rightHand: "scholar-journal-draft",
        },
      },
    ],
  };

  const SLOT_KEYS = ["hair", "earwear", "headwear", "outerwear", "neck", "eyewear", "back", "waist", "rightHand"];
  const COLORWAY_IDS = ["teal", "blue", "violet", "crimson", "forest"];
  const COLORWAY_SET = new Set(COLORWAY_IDS);
  const COLORWAY_COPY = {
    teal: ["Бирюзовый", "Traveller · authored", "#187b80"],
    blue: ["Синий", "Глубокий индиго", "#365f9e"],
    violet: ["Фиолетовый", "Чернильный аметист", "#704c98"],
    crimson: ["Бордовый", "Тёмный кармин", "#99445a"],
    forest: ["Лесной", "Scholar · authored", "#476659"],
  };
  const EMPTY_PATCH = {
    hair: "none",
    earwear: "none",
    headwear: "none",
    outerwear: "none",
    neck: "none",
    eyewear: "none",
    back: "none",
    waist: "none",
    rightHand: "none",
    color: "teal",
  };
  const TRAVELLER_PATCH = {
    hair: "traveller",
    earwear: "none",
    headwear: "none",
    outerwear: "traveller-coat-draft",
    neck: "traveller-scarf-draft",
    eyewear: "traveller-goggles-draft",
    back: "traveller-backpack-draft",
    waist: "traveller-pouch-draft",
    rightHand: "traveller-lantern-draft",
    color: "teal",
  };
  const SCHOLAR_PATCH = {
    hair: "scholar",
    earwear: "none",
    headwear: "scholar-hat-draft",
    outerwear: "scholar-coat-draft",
    neck: "scholar-astrolabe-draft",
    eyewear: "scholar-spectacles-draft",
    back: "scholar-backpack-draft",
    waist: "scholar-field-kit-draft",
    rightHand: "scholar-journal-draft",
    color: "forest",
  };
  const PRESET_COPY = {
    base: {
      label: "Базовый манекен",
      description: "Чистая голова и утверждённая нижняя одежда",
    },
    traveller: {
      label: "Traveller",
      description: "Полный комплект Странника",
    },
    scholar: {
      label: "Scholar",
      description: "Полный комплект Учёного",
    },
  };

  const CATEGORY_META = {
    presets: {
      eyebrow: "Готовые патчи",
      title: "Образы",
      description: "Пресет меняет только принадлежащие ему слоты. После применения каждый элемент остаётся независимым.",
    },
    hair: {
      eyebrow: "Голова",
      title: "Волосы",
      description: "Три самостоятельные причёски, чистая голова, головной убор и отдельный слот наушников на одном манекене.",
    },
    clothing: {
      eyebrow: "Гардероб",
      title: "Одежда",
      description: "Пальто и шарф снимаются независимо. Нижний слой остаётся полноценной одеждой, а не техническим бельём.",
    },
    gear: {
      eyebrow: "Экипировка",
      title: "Снаряжение",
      description: "Очки, наушники, рюкзак, пояс и предмет в руке живут в отдельных слотах. Рюкзак собирается из заднего и переднего проходов одной транзакцией.",
    },
    color: {
      eyebrow: "Материал",
      title: "Цвет",
      description: "Здесь доступны только готовые цветовые PNG, чтобы не ломать бумажную текстуру фильтрами браузера.",
    },
  };

  const ITEM_COPY = {
    hair: {
      none: ["Без волос", "Чистая голова"],
      traveller: ["Traveller", "Взъерошенная"],
      scholar: ["Scholar", "Собранная лента"],
      "explorer-bob": ["Explorer bob", "Асимметричный боб"],
    },
    earwear: {
      none: ["Без наушников", "Уши открыты"],
      "soft-noise-headphones": ["Наушники", "Режим мягкого шума"],
    },
    outerwear: {
      none: ["Без пальто", "Базовая рубашка"],
      "traveller-coat-draft": ["Пальто Traveller", "5 реальных материалов"],
      "scholar-coat-draft": ["Мантия Scholar", "5 реальных материалов"],
    },
    neck: {
      none: ["Без шарфа", "Открытый ворот"],
      "traveller-scarf-draft": ["Шарф Traveller", "Красная бумага"],
      "scholar-astrolabe-draft": ["Астролябия", "Подвеска Scholar"],
    },
    eyewear: {
      none: ["Без очков", "Открытое лицо"],
      "traveller-goggles-draft": ["Очки Traveller", "Латунь и бирюза"],
      "scholar-spectacles-draft": ["Очки Scholar", "Круглая оправа"],
    },
    headwear: {
      none: ["Без головного убора", "Причёска открыта"],
      "scholar-hat-draft": ["Шляпа Scholar", "Полевой академик"],
    },
    back: {
      none: ["Без рюкзака", "Свободная спина"],
      "traveller-backpack-draft": ["Рюкзак Traveller", "Задний + передний проход"],
      "scholar-backpack-draft": ["Рюкзак Scholar", "Книги и свитки · два прохода"],
    },
    waist: {
      none: ["Без сумки", "Чистый пояс"],
      "traveller-pouch-draft": ["Поясная сумка", "Кожаный слот"],
      "scholar-field-kit-draft": ["Полевой набор", "Инструменты Scholar"],
    },
    rightHand: {
      none: ["Пустая рука", "Без предмета"],
      "traveller-lantern-draft": ["Фонарь", "Правая рука · низкий хват"],
      "scholar-journal-draft": ["Полевой журнал", "Правая рука · низкий хват"],
    },
  };

  const SLOT_TITLES = {
    earwear: "Наушники",
    headwear: "Головной убор",
    outerwear: "Верхняя одежда",
    neck: "Шея",
    eyewear: "Очки",
    back: "Спина",
    waist: "Пояс",
    rightHand: "Правая рука",
  };

  const STORAGE_PREFIX = "satoru-avatar-forge-draft";
  const MAX_HISTORY = 50;
  const assetPromises = new Map();

  const elements = {
    avatarStage: document.getElementById("avatarStage"),
    stackA: document.getElementById("avatarStackA"),
    stackB: document.getElementById("avatarStackB"),
    stageLoader: document.getElementById("stageLoader"),
    renderStatus: document.getElementById("renderStatus"),
    renderStatusText: document.getElementById("renderStatusText"),
    categoryRail: document.getElementById("categoryRail"),
    optionsPanel: document.getElementById("optionsPanel"),
    optionGroups: document.getElementById("optionGroups"),
    categoryEyebrow: document.getElementById("categoryEyebrow"),
    categoryTitle: document.getElementById("categoryTitle"),
    categoryDescription: document.getElementById("categoryDescription"),
    optionCount: document.getElementById("optionCount"),
    buildName: document.getElementById("buildName"),
    summaryChips: document.getElementById("summaryChips"),
    undoButton: document.getElementById("undoButton"),
    redoButton: document.getElementById("redoButton"),
    baseButton: document.getElementById("baseButton"),
    forgeCancelButton: document.getElementById("forgeCancelButton"),
    forgeApplyButton: document.getElementById("forgeApplyButton"),
    toast: document.getElementById("toast"),
  };

  let manifest = null;
  let storageKey = STORAGE_PREFIX;
  let currentState = null;
  let desiredState = null;
  let activeCategory = "presets";
  let activeStackIndex = 0;
  let renderToken = 0;
  let isBusy = false;
  let undoStack = [];
  let redoStack = [];
  let toastTimer = 0;
  let resolveEmbeddedInitial = null;
  const embeddedInitial = new Promise((resolve) => { resolveEmbeddedInitial = resolve; });

  function cloneState(state) {
    return { ...state };
  }

  function statesEqual(left, right) {
    if (!left || !right) return false;
    return [...SLOT_KEYS, "color"].every((key) => left[key] === right[key]);
  }

  function getSlotOptions(slot) {
    return Array.isArray(manifest?.slots?.[slot]) ? manifest.slots[slot] : [];
  }

  function getSlotItem(slot, id) {
    return getSlotOptions(slot).find((item) => item.id === id) || null;
  }

  function getOuterwearColorway(item, id) {
    if (!item || !isPlainRecord(item.colorways) || !COLORWAY_SET.has(id)) return null;
    const colorway = item.colorways[id];
    return isPlainRecord(colorway) && typeof colorway.file === "string" ? colorway : null;
  }

  function defaultOuterwearColorway(outerwearId) {
    const item = getSlotItem("outerwear", outerwearId);
    return item && COLORWAY_SET.has(item.defaultColorway) ? item.defaultColorway : "teal";
  }

  function sanitizeState(candidate) {
    const safe = cloneState(TRAVELLER_PATCH);
    for (const slot of SLOT_KEYS) {
      const requested = candidate?.[slot];
      if (getSlotItem(slot, requested)) safe[slot] = requested;
    }
    const requestedColor = candidate?.color;
    const selectedOuterwear = getSlotItem("outerwear", safe.outerwear);
    safe.color = COLORWAY_SET.has(requestedColor) && (!selectedOuterwear?.file || getOuterwearColorway(selectedOuterwear, requestedColor))
      ? requestedColor
      : defaultOuterwearColorway(safe.outerwear);
    return safe;
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function appearanceToState(value) {
    if (!isPlainRecord(value) || value.schemaVersion !== APPEARANCE_SCHEMA_VERSION || value.batchId !== BATCH_ID || value.palette !== "authored") return null;
    const allowedKeys = new Set(["schemaVersion", "batchId", "presetId", "palette", "slots", "colors"]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key)) || !["traveller", "scholar", "base", "custom"].includes(value.presetId)) return null;
    if (!isPlainRecord(value.slots) || Object.keys(value.slots).length !== SLOT_KEYS.length || !isPlainRecord(value.colors)) return null;
    for (const key of SLOT_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(value.slots, key) || !getSlotItem(key, value.slots[key])) return null;
    }
    if (Object.keys(value.colors).length !== 1 || !Object.prototype.hasOwnProperty.call(value.colors, "outerwear") || !COLORWAY_SET.has(value.colors.outerwear)) return null;
    return sanitizeState({ ...value.slots, color: value.colors.outerwear });
  }

  function stateToAppearance(state) {
    const safe = sanitizeState(state);
    return {
      schemaVersion: APPEARANCE_SCHEMA_VERSION,
      batchId: BATCH_ID,
      presetId: derivePreset(safe),
      palette: "authored",
      slots: Object.fromEntries(SLOT_KEYS.map((key) => [key, safe[key]])),
      colors: { outerwear: safe.color },
    };
  }

  function postToHost(type, appearance = null) {
    if (!isEmbedded) return;
    const message = { source: "satoru-avatar-forge", messageVersion: MESSAGE_VERSION, type };
    if (appearance) message.appearance = appearance;
    window.parent.postMessage(message, location.origin);
  }

  window.addEventListener("message", (event) => {
    if (!isEmbedded || event.origin !== location.origin || event.source !== window.parent || !isPlainRecord(event.data)) return;
    const message = event.data;
    if (message.source !== "satoru-app" || message.messageVersion !== MESSAGE_VERSION || message.type !== "init") return;
    resolveEmbeddedInitial?.(message.appearance);
    resolveEmbeddedInitial = null;
  });

  function assetUrl(file) {
    const runtimeFile = String(file || "").replace(/^production\//, "runtime/512/");
    return new URL(runtimeFile, new URL(ASSET_ROOT, location.origin)).href;
  }

  function filesForItem(item, pass = null) {
    if (!item) return [];
    if (Array.isArray(item.renderParts)) {
      return item.renderParts
        .filter((part) => !pass || part.pass === pass)
        .map((part) => part.file)
        .filter(Boolean);
    }
    return !pass && item.file ? [item.file] : [];
  }

  function buildRenderPlan(state) {
    const plan = [];
    const add = (slot, files) => {
      for (const file of files) plan.push({ slot, file, url: assetUrl(file) });
    };

    add("back", filesForItem(getSlotItem("back", state.back), "back"));
    add("base", [manifest.base.file]);
    const outerwearItem = getSlotItem("outerwear", state.outerwear);
    const selectedColorway = getOuterwearColorway(outerwearItem, state.color) ||
      getOuterwearColorway(outerwearItem, outerwearItem?.defaultColorway);
    add("outerwear", selectedColorway?.file ? [selectedColorway.file] : filesForItem(outerwearItem));
    add("back", filesForItem(getSlotItem("back", state.back), "front"));
    add("hair", filesForItem(getSlotItem("hair", state.hair)));
    add("earwear", filesForItem(getSlotItem("earwear", state.earwear)));
    add("headwear", filesForItem(getSlotItem("headwear", state.headwear)));
    add("neck", filesForItem(getSlotItem("neck", state.neck)));
    add("eyewear", filesForItem(getSlotItem("eyewear", state.eyewear)));
    add("waist", filesForItem(getSlotItem("waist", state.waist)));
    add("rightHand", filesForItem(getSlotItem("rightHand", state.rightHand)));
    return plan;
  }

  function loadAndDecode(url) {
    if (assetPromises.has(url)) return assetPromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      const loaded = new Promise((loadResolve, loadReject) => {
        image.addEventListener("load", loadResolve, { once: true });
        image.addEventListener("error", () => loadReject(new Error(`Не удалось загрузить ${url}`)), { once: true });
      });

      image.decoding = "async";
      image.src = url;

      (async () => {
        try {
          if (typeof image.decode === "function") {
            await image.decode();
          } else {
            await loaded;
          }
          resolve(url);
        } catch (decodeError) {
          try {
            await loaded;
            resolve(url);
          } catch (loadError) {
            reject(loadError || decodeError);
          }
        }
      })();
    }).catch((error) => {
      assetPromises.delete(url);
      throw error;
    });

    assetPromises.set(url, promise);
    return promise;
  }

  async function preloadPlan(plan) {
    await Promise.all(plan.map((layer) => loadAndDecode(layer.url)));
  }

  function populateStack(stack, plan) {
    const fragment = document.createDocumentFragment();
    for (const layer of plan) {
      const image = document.createElement("img");
      image.className = "avatar-layer";
      image.src = layer.url;
      image.alt = "";
      image.decoding = "sync";
      image.draggable = false;
      image.dataset.slot = layer.slot;
      fragment.append(image);
    }
    stack.replaceChildren(fragment);
  }

  function nextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function setBusy(busy, message = "Сборка готова") {
    isBusy = busy;
    elements.avatarStage.setAttribute("aria-busy", String(busy));
    elements.optionsPanel.setAttribute("aria-busy", String(busy));
    elements.renderStatus.classList.toggle("is-busy", busy);
    elements.renderStatus.classList.toggle("is-ready", !busy && elements.avatarStage.classList.contains("has-render"));
    elements.renderStatus.classList.remove("is-error");
    elements.renderStatusText.textContent = busy ? "Готовим слои" : message;
    renderHistoryControls();
  }

  function setRenderError() {
    elements.renderStatus.classList.remove("is-busy", "is-ready");
    elements.renderStatus.classList.add("is-error");
    elements.renderStatusText.textContent = "Ошибка слоя";
  }

  async function commitState(candidate, options = {}) {
    const nextState = sanitizeState(candidate);
    if (currentState && statesEqual(currentState, nextState)) {
      desiredState = cloneState(currentState);
      return true;
    }

    desiredState = cloneState(nextState);
    const token = ++renderToken;
    const previous = currentState ? cloneState(currentState) : null;
    const plan = buildRenderPlan(nextState);
    setBusy(true);

    try {
      await preloadPlan(plan);
      if (token !== renderToken) return false;

      const inactiveIndex = activeStackIndex === 0 ? 1 : 0;
      const inactiveStack = inactiveIndex === 0 ? elements.stackA : elements.stackB;
      const activeStack = activeStackIndex === 0 ? elements.stackA : elements.stackB;
      populateStack(inactiveStack, plan);
      await nextPaint();
      if (token !== renderToken) return false;

      inactiveStack.classList.add("avatar-stack--active");
      activeStack.classList.remove("avatar-stack--active");
      activeStackIndex = inactiveIndex;
      elements.avatarStage.classList.add("has-render");

      if (options.recordHistory !== false && previous && !statesEqual(previous, nextState)) {
        undoStack.push(previous);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack = [];
      }

      currentState = cloneState(nextState);
      desiredState = cloneState(nextState);
      saveDraft();
      renderOptions();
      renderSummary();

      if (token === renderToken) setBusy(false);
      return true;
    } catch (error) {
      if (token !== renderToken) return false;
      desiredState = currentState ? cloneState(currentState) : cloneState(TRAVELLER_PATCH);
      isBusy = false;
      setRenderError();
      renderHistoryControls();
      showToast(error instanceof Error ? error.message : "Не удалось собрать образ");
      return false;
    }
  }

  function requestPatch(patch) {
    const base = desiredState || currentState || TRAVELLER_PATCH;
    const safePatch = { ...patch };
    if (safePatch.earwear && safePatch.earwear !== "none") safePatch.headwear = "none";
    if (safePatch.headwear && safePatch.headwear !== "none") safePatch.earwear = "none";
    return commitState({ ...base, ...safePatch });
  }

  async function undo() {
    if (isBusy || undoStack.length === 0 || !currentState) return;
    const target = cloneState(undoStack[undoStack.length - 1]);
    const previous = cloneState(currentState);
    const success = await commitState(target, { recordHistory: false });
    if (!success) return;
    undoStack.pop();
    redoStack.push(previous);
    renderHistoryControls();
  }

  async function redo() {
    if (isBusy || redoStack.length === 0 || !currentState) return;
    const target = cloneState(redoStack[redoStack.length - 1]);
    const previous = cloneState(currentState);
    const success = await commitState(target, { recordHistory: false });
    if (!success) return;
    redoStack.pop();
    undoStack.push(previous);
    renderHistoryControls();
  }

  function renderHistoryControls() {
    elements.undoButton.disabled = isBusy || undoStack.length === 0;
    elements.redoButton.disabled = isBusy || redoStack.length === 0;
    elements.baseButton.disabled = isBusy || Boolean(currentState && statesEqual(currentState, EMPTY_PATCH));
    if (elements.forgeApplyButton) elements.forgeApplyButton.disabled = isBusy || !currentState;
  }

  function derivePreset(state) {
    for (const preset of getPresetDefinitions()) {
      const ownedSlots = preset.ownsSlots.filter((slot) => SLOT_KEYS.includes(slot));
      if (ownedSlots.length > 0 && ownedSlots.every((slot) => state[slot] === preset.patch[slot]) && state.color === preset.patch.color) {
        return preset.id;
      }
    }
    return "custom";
  }

  function getPresetDefinitions() {
    const declared = Array.isArray(manifest?.presets) && manifest.presets.length > 0
      ? manifest.presets
      : [
          { id: "traveller", ownsSlots: SLOT_KEYS, patch: TRAVELLER_PATCH },
          { id: "scholar", ownsSlots: SLOT_KEYS, patch: SCHOLAR_PATCH },
        ];
    const baseCopy = PRESET_COPY.base;
    const definitions = [
      {
        id: "base",
        label: baseCopy.label,
        description: baseCopy.description,
        ownsSlots: SLOT_KEYS,
        patch: EMPTY_PATCH,
      },
    ];

    for (const preset of declared) {
      if (!preset?.id || !preset?.patch) continue;
      const copy = PRESET_COPY[preset.id] || {};
      definitions.push({
        id: preset.id,
        label: copy.label || preset.id,
        description: copy.description || "Production preset",
        ownsSlots: Array.isArray(preset.ownsSlots) ? preset.ownsSlots : Object.keys(preset.patch),
        patch: {
          ...preset.patch,
          color: COLORWAY_SET.has(preset.colors?.outerwear)
            ? preset.colors.outerwear
            : defaultOuterwearColorway(preset.patch.outerwear),
        },
      });
    }
    return definitions;
  }

  function itemCopy(slot, id) {
    return ITEM_COPY[slot]?.[id] || [id, "Production layer"];
  }

  function createMiniAvatar(state) {
    const mini = document.createElement("span");
    mini.className = "mini-avatar";
    for (const layer of buildRenderPlan(state)) {
      const image = document.createElement("img");
      image.src = layer.url;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.draggable = false;
      mini.append(image);
    }
    return mini;
  }

  function isolatedSlotState(slot, id) {
    return sanitizeState({
      ...EMPTY_PATCH,
      [slot]: id,
      color: slot === "outerwear" ? defaultOuterwearColorway(id) : EMPTY_PATCH.color,
    });
  }

  function createOptionCard({ label, description, selected, previewState, onSelect, color = null }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-card";
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));

    const preview = document.createElement("span");
    preview.className = "option-card__preview";
    if (previewState) preview.append(createMiniAvatar(previewState));
    if (color) {
      button.classList.add("option-card--color");
      const swatch = document.createElement("span");
      swatch.className = "color-swatch";
      swatch.style.background = color;
      preview.append(swatch);
    }

    const selectedMark = document.createElement("span");
    selectedMark.className = "option-card__selected";
    selectedMark.setAttribute("aria-hidden", "true");
    selectedMark.textContent = "✓";
    preview.append(selectedMark);

    const body = document.createElement("span");
    body.className = "option-card__body";
    const title = document.createElement("strong");
    title.textContent = label;
    const subtitle = document.createElement("small");
    subtitle.textContent = description;
    body.append(title, subtitle);
    button.append(preview, body);
    button.addEventListener("click", onSelect);
    return button;
  }

  function createGroup(title, cards) {
    const section = document.createElement("section");
    section.className = "option-group";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const grid = document.createElement("div");
    grid.className = "option-grid";
    for (const card of cards) grid.append(card);
    section.append(heading, grid);
    return section;
  }

  function slotCards(slot) {
    return getSlotOptions(slot).map((item) => {
      const [label, description] = itemCopy(slot, item.id);
      return createOptionCard({
        label,
        description,
        selected: currentState?.[slot] === item.id,
        previewState: isolatedSlotState(slot, item.id),
        onSelect: () => requestPatch({ [slot]: item.id }),
      });
    });
  }

  function variantLabel(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "вариант";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "варианта";
    return "вариантов";
  }

  function renderOptions() {
    if (!manifest || !currentState) return;
    const meta = CATEGORY_META[activeCategory];
    elements.categoryEyebrow.textContent = meta.eyebrow;
    elements.categoryTitle.textContent = meta.title;
    elements.categoryDescription.textContent = meta.description;
    elements.optionGroups.replaceChildren();
    let count = 0;

    if (activeCategory === "presets") {
      const activePreset = derivePreset(currentState);
      const cards = getPresetDefinitions().map((preset) => {
        count += 1;
        return createOptionCard({
          label: preset.label,
          description: preset.description,
          selected: activePreset === preset.id,
          previewState: sanitizeState({ ...EMPTY_PATCH, ...preset.patch }),
          onSelect: () => commitState({ ...(desiredState || currentState), ...preset.patch }),
        });
      });
      elements.optionGroups.append(createGroup("Пресеты", cards));
    }

    if (activeCategory === "hair") {
      for (const slot of ["hair", "headwear"]) {
        const cards = slotCards(slot);
        count += cards.length;
        elements.optionGroups.append(createGroup(slot === "hair" ? "Причёска" : SLOT_TITLES[slot], cards));
      }
    }

    if (activeCategory === "clothing") {
      for (const slot of ["outerwear", "neck"]) {
        const cards = slotCards(slot);
        count += cards.length;
        elements.optionGroups.append(createGroup(SLOT_TITLES[slot], cards));
      }
    }

    if (activeCategory === "gear") {
      for (const slot of ["eyewear", "earwear", "back", "waist", "rightHand"]) {
        const cards = slotCards(slot);
        count += cards.length;
        elements.optionGroups.append(createGroup(SLOT_TITLES[slot], cards));
      }
    }

    if (activeCategory === "color") {
      const outerwearItem = getSlotItem("outerwear", currentState.outerwear);
      const cards = COLORWAY_IDS.map((id) => {
        const [label, description, fallbackSwatch] = COLORWAY_COPY[id];
        const colorway = getOuterwearColorway(outerwearItem, id);
        count += 1;
        return createOptionCard({
          label,
          description,
          selected: currentState.color === id,
          previewState: sanitizeState({ ...currentState, color: id }),
          color: colorway?.swatch || fallbackSwatch,
          onSelect: () => requestPatch({ color: id }),
        });
      });
      elements.optionGroups.append(createGroup("Цвет верхней одежды", cards));
      const note = document.createElement("p");
      note.className = "asset-gate";
      note.textContent = currentState.outerwear === "none"
        ? "Цвет сохранится и применится, когда ты выберешь пальто. Каждый вариант — отдельный QA-проверенный PNG, без CSS-фильтров."
        : "Каждый вариант — отдельный QA-проверенный PNG с исходной бумажной текстурой и светом. CSS-фильтры не используются.";
      elements.optionGroups.append(note);
    }

    elements.optionCount.textContent = `${count} ${variantLabel(count)}`;
  }

  function renderSummary() {
    if (!currentState) return;
    const preset = derivePreset(currentState);
    const presetDefinition = getPresetDefinitions().find((item) => item.id === preset);
    elements.buildName.textContent = presetDefinition?.label || "Свой образ";

    const active = [];
    for (const slot of SLOT_KEYS) {
      const id = currentState[slot];
      if (id === "none") continue;
      active.push(itemCopy(slot, id)[0]);
    }
    active.push(COLORWAY_COPY[currentState.color]?.[0] || currentState.color);
    elements.summaryChips.replaceChildren();
    for (const label of active.slice(0, 6)) {
      const chip = document.createElement("span");
      chip.className = "summary-chip";
      chip.textContent = label;
      elements.summaryChips.append(chip);
    }
  }

  function saveDraft() {
    if (!currentState || isEmbedded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 2, state: currentState }));
    } catch (error) {
      console.warn("Avatar Forge draft could not be saved", error);
    }
  }

  function loadDraft() {
    if (isEmbedded) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.schemaVersion === 2 || parsed?.schemaVersion === 1 ? parsed.state : null;
    } catch (error) {
      console.warn("Avatar Forge draft could not be restored", error);
      return null;
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3600);
  }

  function setCategory(category) {
    if (!CATEGORY_META[category]) return;
    activeCategory = category;
    for (const button of elements.categoryRail.querySelectorAll("[data-category]")) {
      const active = button.dataset.category === category;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
    renderOptions();
    elements.optionsPanel.scrollTop = 0;
  }

  function bindEvents() {
    elements.categoryRail.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (button) setCategory(button.dataset.category);
    });
    elements.undoButton.addEventListener("click", undo);
    elements.redoButton.addEventListener("click", redo);
    elements.baseButton.addEventListener("click", () => commitState({ ...(desiredState || currentState), ...EMPTY_PATCH }));
    elements.forgeCancelButton?.addEventListener("click", () => postToHost("close"));
    elements.forgeApplyButton?.addEventListener("click", () => {
      if (!isBusy && currentState) postToHost("apply", stateToAppearance(currentState));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isEmbedded) {
        event.preventDefault();
        postToHost("close");
        return;
      }
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.altKey || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    });
  }

  function validateManifest(candidate) {
    if (!candidate?.base?.file || !candidate?.slots) throw new Error("Manifest Avatar Forge неполный");
    for (const slot of SLOT_KEYS) {
      if (!Array.isArray(candidate.slots[slot])) throw new Error(`В manifest отсутствует слот ${slot}`);
    }
    for (const coat of candidate.slots.outerwear.filter((item) => item?.file)) {
      if (!COLORWAY_SET.has(coat.defaultColorway) || !isPlainRecord(coat.colorways)) {
        throw new Error(`В manifest отсутствуют colorways для ${coat.id}`);
      }
      if (Object.keys(coat.colorways).length !== COLORWAY_IDS.length || COLORWAY_IDS.some((id) => {
        const colorway = coat.colorways[id];
        return !isPlainRecord(colorway) || typeof colorway.file !== "string" || !/^#[0-9a-f]{6}$/i.test(colorway.swatch || "");
      })) throw new Error(`Colorway-набор ${coat.id} неполный`);
    }
    for (const preset of candidate.presets || []) {
      if (!isPlainRecord(preset.colors) || !COLORWAY_SET.has(preset.colors.outerwear)) {
        throw new Error(`В manifest отсутствует authored colorway пресета ${preset.id}`);
      }
    }
    return candidate;
  }

  async function loadManifest() {
    try {
      const response = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
      return validateManifest(await response.json());
    } catch (error) {
      console.info("Avatar Forge uses its embedded manifest mirror in file preview mode", error);
      return validateManifest(FALLBACK_MANIFEST);
    }
  }

  async function initialize() {
    if (isEmbedded) document.body.classList.add("is-embedded");
    bindEvents();
    renderHistoryControls();
    try {
      manifest = await loadManifest();
      storageKey = `${STORAGE_PREFIX}:${manifest.batchId || "v1"}`;
      let initialCandidate = loadDraft();
      if (isEmbedded) {
        postToHost("ready");
        const incoming = await Promise.race([
          embeddedInitial,
          new Promise((resolve) => window.setTimeout(() => resolve(null), 2500)),
        ]);
        initialCandidate = appearanceToState(incoming);
      }
      const initialState = sanitizeState(initialCandidate || TRAVELLER_PATCH);
      desiredState = cloneState(initialState);
      await commitState(initialState, { recordHistory: false });
      setCategory(activeCategory);
    } catch (error) {
      isBusy = false;
      setRenderError();
      showToast(error instanceof Error ? error.message : "Avatar Forge не запустился");
    }
  }

  initialize();
})();
