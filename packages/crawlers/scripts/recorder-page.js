// Injected into every top-level page by scripts/record.ts (public Playwright
// APIs only: addInitScript + exposeFunction). Observes trusted user events and
// reports them as {action, locator, value}; also renders the manual-mode
// toggle button. Plain JS (not TS) so it can be injected verbatim.
(() => {
  if (window !== window.top || window.__crawlerRecorderInstalled) return;
  window.__crawlerRecorderInstalled = true;

  const TOGGLE_ID = "crawler-manual-toggle";
  const q = (s) => JSON.stringify(s);
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
  let manual = false;
  let host = null;

  const visible = (e) =>
    !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);

  // ---- accessibility-ish helpers -------------------------------------------
  const INPUT_BUTTONS = ["button", "submit", "reset", "image"];
  const TEXT_TYPES = [
    "",
    "text",
    "email",
    "tel",
    "url",
    "password",
    "search",
    "number",
  ];

  const roleOf = (el) => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.split(" ")[0];
    const tag = el.tagName.toLowerCase();
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "select") return el.multiple ? "listbox" : "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (INPUT_BUTTONS.includes(t)) return "button";
      if (t === "checkbox") return "checkbox";
      if (t === "radio") return "radio";
      if (t === "search") return "searchbox";
      if (TEXT_TYPES.includes(t)) return "textbox";
    }
    return null;
  };

  const labelOf = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria) return clean(aria);
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = clean(
        by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" "),
      );
      if (t) return t;
    }
    if (el.labels?.length) {
      const t = clean([...el.labels].map((l) => l.textContent).join(" "));
      if (t) return t;
    }
    return "";
  };

  const nameOf = (el) => {
    const label = labelOf(el);
    if (label) return label;
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (INPUT_BUTTONS.includes(t)) return clean(el.value || el.alt || "");
    }
    return (
      clean(el.textContent) ||
      clean(el.getAttribute("title") || el.getAttribute("alt") || "")
    );
  };

  const isField = (el) =>
    ["input", "textarea", "select"].includes(el.tagName.toLowerCase());

  // ---- locator generation ---------------------------------------------------
  // Each strategy: [expression, matches(candidate)]. A strategy is used if it
  // matches the element; ".nth(i)" disambiguates when several elements match.
  const strategies = (el) => {
    const out = [];
    const tid = el.getAttribute("data-testid");
    if (tid) {
      out.push([
        `getByTestId(${q(tid)})`,
        (e) => e.getAttribute("data-testid") === tid,
      ]);
    }
    if (isField(el)) {
      const label = labelOf(el);
      if (label) {
        out.push([
          `getByLabel(${q(label)}, { exact: true })`,
          (e) => isField(e) && labelOf(e) === label,
        ]);
      }
      const ph = el.getAttribute("placeholder");
      if (ph) {
        out.push([
          `getByPlaceholder(${q(ph)}, { exact: true })`,
          (e) => e.getAttribute("placeholder") === ph,
        ]);
      }
    }
    const role = roleOf(el);
    const name = nameOf(el);
    if (role && name) {
      out.push([
        `getByRole(${q(role)}, { name: ${q(name)}, exact: true })`,
        (e) => roleOf(e) === role && nameOf(e) === name,
      ]);
    }
    const text = clean(el.textContent);
    if (text && text.length <= 80 && !isField(el)) {
      out.push([
        `getByText(${q(text)}, { exact: true })`,
        (e) => clean(e.textContent) === text && !e.querySelector("*"),
      ]);
    }
    if (el.id && !/\d{3,}/.test(el.id)) {
      out.push([
        `locator(${q(`#${CSS.escape(el.id)}`)})`,
        (e) => e.id === el.id,
      ]);
    }
    return out;
  };

  const cssPath = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      const tag = node.tagName.toLowerCase();
      const siblings = node.parentElement
        ? [...node.parentElement.children].filter(
            (c) => c.tagName === node.tagName,
          )
        : [];
      parts.unshift(
        siblings.length > 1
          ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})`
          : tag,
      );
      node = node.parentElement;
    }
    return `html > ${parts.join(" > ")}`;
  };

  const locatorFor = (el) => {
    const all = [...document.querySelectorAll("*")].filter(
      (e) => visible(e) && !host?.contains(e),
    );
    for (const [expr, test] of strategies(el)) {
      const matches = all.filter(test);
      // Prefer the deepest/most specific element when text matches parents.
      const index = matches.indexOf(el);
      if (index === -1) continue;
      return matches.length === 1 ? expr : `${expr}.nth(${index})`;
    }
    return `locator(${q(cssPath(el))})`;
  };

  // ---- event capture --------------------------------------------------------
  const emit = (payload) => {
    if (manual) return;
    window.__crawlerEmit(payload);
  };
  const ours = (event) => host && event.composedPath().includes(host);
  const lastSent = new WeakMap();
  const INTERACTIVE =
    'a,button,input,select,textarea,summary,label,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="option"],[onclick]';
  let pendingLabelControl = null;

  const sendValue = (el) => {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (lastSent.get(el) === el.value) return;
    lastSent.set(el, el.value);
    if (type === "password") {
      emit({ action: "secret", locator: locatorFor(el) });
    } else {
      emit({ action: "fill", locator: locatorFor(el), value: el.value });
    }
  };

  document.addEventListener(
    "click",
    (event) => {
      if (!event.isTrusted || manual || ours(event) || event.button !== 0)
        return;
      const raw = event.target instanceof Element ? event.target : null;
      if (!raw) return;
      const el = raw.closest(INTERACTIVE) || raw;
      if (pendingLabelControl === el) {
        pendingLabelControl = null;
        return;
      }
      pendingLabelControl = el.tagName === "LABEL" ? el.control : null;
      if (isField(el)) {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        if (type === "checkbox" || type === "radio") {
          emit({
            action: el.checked ? "check" : "uncheck",
            locator: locatorFor(el),
          });
          return;
        }
        if (!INPUT_BUTTONS.includes(type) || el.tagName !== "INPUT") return;
      }
      emit({ action: "click", locator: locatorFor(el) });
    },
    true,
  );

  document.addEventListener(
    "change",
    (event) => {
      const el = event.target;
      if (!event.isTrusted || manual || !(el instanceof Element) || ours(event))
        return;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (tag === "select") {
        emit({ action: "select", locator: locatorFor(el), value: el.value });
      } else if (
        tag === "textarea" ||
        (tag === "input" && TEXT_TYPES.includes(type))
      ) {
        sendValue(el);
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (!event.isTrusted || manual || ours(event) || event.key !== "Enter")
        return;
      const el = event.target;
      if (!(el instanceof Element) || el.tagName !== "INPUT") return;
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (!TEXT_TYPES.includes(type)) return;
      sendValue(el);
      emit({ action: "press", locator: locatorFor(el), value: "Enter" });
    },
    true,
  );

  // ---- manual-mode toggle button -------------------------------------------
  const install = async () => {
    if (host) return;
    host = document.createElement("div");
    host.id = `${TOGGLE_ID}-host`;
    host.style.cssText =
      "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    button.id = TOGGLE_ID;
    button.style.cssText =
      "font:600 14px system-ui,sans-serif;color:#fff;border:0;border-radius:8px;padding:12px 16px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4)";
    const render = (on) => {
      manual = on;
      button.textContent = on
        ? "\u23F8 MANUAL MODE ON \u2014 click when done"
        : "\u25CF Recording \u2014 click to start manual mode";
      button.style.background = on ? "#c62828" : "#2e7d32";
    };
    render(await window.__crawlerGetState());
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      render(await window.__crawlerToggle());
    });
    window.addEventListener("crawler-manual-state", (event) =>
      render(event.detail),
    );
    root.appendChild(button);
    document.documentElement.appendChild(host);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
