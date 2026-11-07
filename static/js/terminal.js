/**
 * Veterm — terminal controller.
 * Docked, non-modal command panel with history, completion, and quick actions.
 */
const Terminal = {
  input: null,
  output: null,
  panel: null,
  overlay: null,
  suggestEl: null,
  busyEl: null,
  badge: null,
  handle: null,

  history: [],
  historyIndex: -1,
  draft: "",
  completion: null,
  busy: false,
  enabled: false,
  height: 300,
  dragging: false,

  MIN_HEIGHT: 170,
  DEFAULT_HEIGHT: 300,
  COMMANDS: [
    "ls",
    "cat",
    "edit",
    "touch",
    "mkdir",
    "mount",
    "goto",
    "archive",
    "tags",
    "search",
    "cin",
    "cout",
    "sync",
    "rm",
    "rmdir",
    "login",
    "logout",
    "whoami",
    "help",
    "theme",
    "clear",
    "exit",
  ],

  init() {
    this.input = document.getElementById("terminal-input");
    this.output = document.getElementById("terminal-output");
    this.panel = document.getElementById("terminal-panel");
    this.overlay = document.getElementById("terminal-overlay");
    this.suggestEl = document.getElementById("terminal-suggest");
    this.busyEl = document.getElementById("terminal-busy");
    this.badge = document.getElementById("terminal-user-badge");
    this.handle = document.getElementById("terminal-resize-handle");

    this.loadHistory();
    let saved = 0;
    try {
      saved = Number(localStorage.getItem("veterm-terminal-height"));
    } catch { /* ignore */ }
    if (Number.isFinite(saved) && saved > 0) this.height = saved;
    else if (window.innerWidth <= 720) this.height = 280;

    this.input.addEventListener(
      "keydown",
      (event) => this.handleKeydown(event),
    );
    this.input.addEventListener("input", () => this.hideSuggest());
    document.getElementById("terminal-close-btn").addEventListener(
      "click",
      () => App.closeTerminal(),
    );
    document.getElementById("terminal-clear-btn").addEventListener(
      "click",
      () => this.clearScreen(),
    );
    this.initResize();

    this.enabled = true;
  },

  // ------------------------------------------------------------------ sizing
  maxHeight() {
    return Math.max(
      this.MIN_HEIGHT,
      Math.min(900, Math.floor(window.innerHeight * 0.72)),
    );
  },

  applyHeight(value, persist = true) {
    const height = Math.max(
      this.MIN_HEIGHT,
      Math.min(this.maxHeight(), Math.round(value)),
    );
    this.height = height;
    this.panel.style.height = height + "px";
    if (App.terminalOpen) {
      document.documentElement.style.setProperty("--terminal-h", height + "px");
    }
    if (persist) {
      try {
        localStorage.setItem("veterm-terminal-height", String(height));
      } catch { /* ignore */ }
    }
  },

  measure() {
    this.applyHeight(this.height);
  },

  initResize() {
    const handle = this.handle;
    let startY = 0;
    let startHeight = 0;

    const onMove = (event) => {
      if (!this.dragging) return;
      const next = startHeight + (startY - event.clientY);
      this.applyHeight(next, false);
    };

    const onUp = (event) => {
      if (!this.dragging) return;
      this.dragging = false;
      handle.classList.remove("is-dragging");
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch { /* ignore */ }
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      this.applyHeight(this.height);
    };

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      this.dragging = true;
      startY = event.clientY;
      startHeight = this.panel.offsetHeight;
      handle.classList.add("is-dragging");
      try {
        handle.setPointerCapture(event.pointerId);
      } catch { /* ignore */ }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });

    handle.addEventListener("dblclick", () => {
      this.applyHeight(this.DEFAULT_HEIGHT);
    });
  },

  // ------------------------------------------------------------------ lifecycle
  onOpen() {
    this.applyHeight(this.height);
    this.hideSuggest();
    this.scrollToBottom();
  },

  onClose() {
    this.hideSuggest();
    if (this.input) this.input.blur();
  },

  focus() {
    if (this.input) this.input.focus();
  },

  prefill(text) {
    this.input.value = text;
    this.input.setSelectionRange(text.length, text.length);
    this.input.focus();
    this.scrollToBottom();
  },

  runQuick(command) {
    if (!App.terminalOpen) App.openTerminal();
    this.input.value = command;
    this.input.focus();
    this.execute();
  },

  updateUser(session) {
    if (!this.badge) return;
    const name = session && session.loggedIn ? session.username : I18n.t("terminal.guest");
    this.badge.textContent = name;
    this.badge.classList.toggle(
      "is-admin",
      !!session && session.group === "admin",
    );
    const welcome = document.getElementById("welcome-user");
    if (welcome) welcome.textContent = name;
  },

  applyLanguage() {
    this.updateUser(App.session);
  },

  // ------------------------------------------------------------------ input
  handleKeydown(event) {
    if (!this.enabled) return;
    const key = event.key;

    if (key === "Enter") {
      event.preventDefault();
      this.execute();
      return;
    }
    if (key === "Tab") {
      event.preventDefault();
      this.complete();
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      this.navigateHistory(-1);
      return;
    }
    if (key === "ArrowDown") {
      event.preventDefault();
      this.navigateHistory(1);
      return;
    }
    if (event.ctrlKey && !event.metaKey && (key === "l" || key === "L")) {
      event.preventDefault();
      this.clearScreen();
      return;
    }
    if (event.ctrlKey && !event.metaKey && (key === "c" || key === "C")) {
      event.preventDefault();
      if (this.input.value) this.printLine("^C", "output-line muted");
      this.input.value = "";
      this.hideSuggest();
      return;
    }
    if (event.ctrlKey && !event.metaKey && (key === "u" || key === "U")) {
      event.preventDefault();
      this.input.value = "";
      this.hideSuggest();
    }
  },

  handleEscape() {
    if (this.suggestEl && !this.suggestEl.classList.contains("hidden")) {
      this.hideSuggest();
      return true;
    }
    if (this.input.value) {
      this.input.value = "";
      return true;
    }
    return false;
  },

  setBusy(busy) {
    this.busy = busy;
    this.busyEl.classList.toggle("hidden", !busy);
    this.input.setAttribute("aria-busy", busy ? "true" : "false");
  },

  // ------------------------------------------------------------------ history
  loadHistory() {
    try {
      const raw = localStorage.getItem("veterm-history");
      const parsed = raw ? JSON.parse(raw) : [];
      this.history = Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === "string").slice(-100)
        : [];
    } catch {
      this.history = [];
    }
    this.historyIndex = -1;
  },

  saveHistory() {
    try {
      localStorage.setItem(
        "veterm-history",
        JSON.stringify(this.history.slice(-100)),
      );
    } catch { /* ignore */ }
  },

  addHistory(command) {
    if (!command) return;
    // Never persist credentials in the browser history.
    if (/^login\s+/i.test(command)) return;
    if (this.history[this.history.length - 1] !== command) {
      this.history.push(command);
      if (this.history.length > 100) this.history.shift();
      this.saveHistory();
    }
    this.historyIndex = -1;
    this.draft = "";
  },

  navigateHistory(direction) {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1) {
      this.draft = this.input.value;
      this.historyIndex = this.history.length;
    }
    this.historyIndex += direction;
    if (this.historyIndex < 0) this.historyIndex = 0;
    if (this.historyIndex >= this.history.length) {
      this.historyIndex = -1;
      this.input.value = this.draft;
    } else {
      this.input.value = this.history[this.historyIndex];
    }
    const end = this.input.value.length;
    this.input.setSelectionRange(end, end);
    this.hideSuggest();
  },

  // ------------------------------------------------------------------ completion
  tokenInfo() {
    const value = this.input.value;
    const cursor = this.input.selectionStart === null
      ? value.length
      : this.input.selectionStart;
    const before = value.slice(0, cursor);
    const match = before.match(/(^|\s)([^\s]*)$/);
    const prefix = match ? match[2] : "";
    return {
      value,
      cursor,
      before,
      prefix,
      start: before.length - prefix.length,
      end: cursor,
      after: value.slice(cursor),
    };
  },

  async complete() {
    if (this.busy) return;
    const info = this.tokenInfo();
    const trimmed = info.before.trimStart();
    const isCommand = !/\s/.test(trimmed);

    // Repeat Tab cycles through the previous match list.
    const state = this.completion;
    if (
      state && state.matches.length > 1 && state.value === info.value &&
      info.cursor === info.value.length
    ) {
      state.index = (state.index + 1) % state.matches.length;
      this.applyMatch(state.matches[state.index], state);
      return;
    }

    let candidates;
    if (isCommand) {
      candidates = this.COMMANDS;
    } else {
      const command = trimmed.split(/\s+/)[0].toLowerCase();
      candidates = await this.argCandidates(command);
    }

    const prefix = info.prefix;
    const lower = prefix.toLowerCase();
    const matches = [...new Set(candidates)]
      .filter((candidate) =>
        candidate.toLowerCase().startsWith(lower) &&
        candidate.toLowerCase() !== lower
      )
      .sort((a, b) => a.localeCompare(b));

    if (matches.length === 0) {
      this.showEmptySuggest();
      return;
    }

    const nextState = {
      start: info.start,
      end: info.end,
      value: info.value,
      matches,
      index: -1,
    };

    // With no prefix, show the options instead of silently inserting the first one.
    if (!prefix && matches.length > 1) {
      this.completion = nextState;
      this.renderSuggest(matches, -1);
      return;
    }

    const common = this.commonPrefix(matches);
    if (common.length > prefix.length && matches.length > 1) {
      this.applyMatch(common, nextState, false);
      this.renderSuggest(matches, -1);
      return;
    }

    nextState.index = 0;
    this.applyMatch(matches[0], nextState);
  },

  async argCandidates(command) {
    if (command === "goto") {
      const tree = await App.getTree();
      const projects = tree && tree.projects ? tree.projects : [];
      return ["home", ...projects];
    }

    if (!["ls", "cat", "edit", "rm", "rmdir"].includes(command)) return [];

    const tree = await App.getTree();
    const entries = tree && tree.entries ? tree.entries : [];
    const result = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        if (command === "ls" || command === "rmdir") {
          result.push(entry.path + "/");
          result.push(entry.path);
        }
        continue;
      }
      if (command === "rmdir") continue;
      result.push(entry.path);

      const base = entry.path.split("/").pop();
      if (base && base !== entry.path) {
        result.push(base);
        const stem = base.replace(/\.[^.]+$/, "");
        if (stem && stem !== base) result.push(stem);
      }
    }
    return result;
  },

  commonPrefix(items) {
    let common = items[0] || "";
    for (let i = 1; i < items.length; i++) {
      let j = 0;
      while (
        j < common.length && j < items[i].length && common[j] === items[i][j]
      ) j++;
      common = common.slice(0, j);
      if (!common) break;
    }
    return common;
  },

  applyMatch(match, state, finalize = true) {
    const value = this.input.value;
    const before = value.slice(0, state.start);
    const after = value.slice(state.end);
    const isDirectory = match.endsWith("/");
    const atEnd = state.end === value.length;
    const suffix = finalize && atEnd && !isDirectory && !match.endsWith(" ")
      ? " "
      : "";
    const quoted = /\s/.test(match) && !match.startsWith('"')
      ? `"${match}"`
      : match;

    const replacement = quoted + suffix;
    this.input.value = before + replacement + after;
    const cursor = state.start + replacement.length;
    this.input.setSelectionRange(cursor, cursor);

    state.end = cursor;
    state.value = this.input.value;
    this.completion = state;
    this.renderSuggest(state.matches, state.index);
    this.input.focus();
  },

  renderSuggest(matches, activeIndex) {
    this.suggestEl.replaceChildren();
    matches.forEach((match, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = match;
      if (index === activeIndex) button.classList.add("is-active");
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        if (!this.completion) return;
        this.completion.index = index;
        this.applyMatch(match, this.completion);
        this.input.focus();
      });
      this.suggestEl.appendChild(button);
    });
    this.suggestEl.classList.remove("hidden");
    const active = this.suggestEl.querySelector(".is-active");
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  },

  showEmptySuggest() {
    this.suggestEl.replaceChildren();
    const empty = document.createElement("span");
    empty.className = "suggest-empty";
    empty.textContent = "no matches — press Esc";
    this.suggestEl.appendChild(empty);
    this.suggestEl.classList.remove("hidden");
    this.completion = null;
  },

  hideSuggest() {
    if (!this.suggestEl) return;
    this.suggestEl.classList.add("hidden");
    this.suggestEl.replaceChildren();
    this.completion = null;
  },

  // ------------------------------------------------------------------ execution
  async execute() {
    if (this.busy) return;
    const command = this.input.value.trim();
    if (!command) return;

    this.hideSuggest();
    this.input.value = "";
    this.addHistory(command);
    this.printCommand(command);

    const lower = command.toLowerCase();
    if (lower === "clear" || lower === "cls") {
      this.clearScreen();
      return;
    }
    if (lower === "exit" || lower === "quit") {
      this.printLine(I18n.t("terminal.bye"), "output-line muted");
      setTimeout(() => App.closeTerminal(), 180);
      return;
    }
    if (lower === "theme" || lower.startsWith("theme ")) {
      this.handleTheme(command);
      return;
    }

    this.setBusy(true);
    const result = await API.execCommand(command);
    this.setBusy(false);

    if (
      /^(touch|mkdir|rm|rmdir|mount|cin|cout|sync)\b/.test(lower) &&
      !result.error
    ) {
      App.onTreeChanged();
    }

    const output = result.output || result.error || "";
    const failed = !!result.error ||
      /^Error:|^Permission denied|^Command not found/i.test(output);

    const navigationActions = [
      "render",
      "render_project",
      "goto_link",
      "goto_home",
      "archive",
      "tags",
      "edit",
    ];
    if (output && !navigationActions.includes(result.action)) {
      this.printLine(output, failed ? "output-line error" : "output-line");
    }

    if (result.sessionCookie) {
      await App.handleAuthChange();
    }

    if (result.action === "render" || result.action === "render_project") {
      const target = result.action === "render_project" && result.projectName
        ? "projects/" + result.projectName
        : (result.filePath || "about.md");
      await App.go(target);
      if (!failed) {
        this.printLine(I18n.t("terminal.opened", { path: result.projectName || result.filePath || "page" }), "output-line muted");
        this.closeOnMobile();
      }
    } else if (result.action === "goto_link") {
      const target = result.projectName
        ? "projects/" + result.projectName
        : (result.filePath || "about.md");
      await App.go(target);
      this.printLine(I18n.t("terminal.openedLink", { url: result.link }), "output-line muted");
      this.closeOnMobile();
    } else if (result.action === "goto_home") {
      await App.go("home");
      this.printLine(I18n.t("terminal.returnedHome"), "output-line muted");
      this.closeOnMobile();
    } else if (result.action === "archive" || result.action === "tags") {
      await App.go(result.action);
      this.printLine(result.output || I18n.t("terminal.opened", { path: result.action }), "output-line muted");
      this.closeOnMobile();
    } else if (result.action === "search") {
      if (window.matchMedia("(max-width: 900px)").matches) App.closeTerminal();
      Search.open(result.query || "");
    } else if (result.action === "edit") {
      this.printLine(I18n.t("terminal.editing", { path: result.filePath }), "output-line muted");
      App.closeTerminal();
      App.openEditor(result.filePath, {
        source: result.source,
        pageType: result.pageType,
        newFile: result.newFile,
      });
    } else if (result.action === "theme") {
      App.toggleTheme();
      this.printLine(I18n.t("terminal.theme", { theme: App.getTheme() }), "output-line");
    } else if (result.close) {
      setTimeout(() => App.closeTerminal(), 160);
    } else if (result.clear) {
      this.clearScreen();
    }

    this.scrollToBottom();
  },

  handleTheme(command) {
    const parts = command.trim().split(/\s+/);
    const arg = (parts[1] || "").toLowerCase();
    if (arg && !["dark", "light", "toggle"].includes(arg)) {
      this.printLine("Usage: theme [dark|light]", "output-line error");
      return;
    }
    if (arg === "dark" || arg === "light") {
      App.applyTheme(arg);
    } else {
      App.toggleTheme();
    }
    this.printLine(`Theme: ${App.getTheme()}`, "output-line");
  },

  closeOnMobile() {
    if (window.matchMedia && window.matchMedia("(max-width: 720px)").matches) {
      App.closeTerminal();
    }
  },

  // ------------------------------------------------------------------ output
  printCommand(command) {
    const display = command.replace(/^(login\s+\S+\s+).+$/i, "$1••••");
    const line = document.createElement("div");
    line.className = "command-line";
    const prompt = document.createElement("span");
    prompt.className = "prompt";
    prompt.textContent = "$";
    line.appendChild(prompt);
    line.appendChild(document.createTextNode(" " + display));
    this.output.appendChild(line);
    this.scrollToBottom();
  },

  printLine(text, className) {
    if (text === undefined || text === null) return;
    const line = document.createElement("div");
    line.className = className || "output-line";
    line.textContent = String(text);
    this.output.appendChild(line);
    this.scrollToBottom();
  },

  clearScreen() {
    this.output.replaceChildren();
    this.hideSuggest();
  },

  scrollToBottom() {
    if (!this.output) return;
    this.output.scrollTop = this.output.scrollHeight;
  },
};
