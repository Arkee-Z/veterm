/**
 * Veterm v2.0 — Terminal Controller
 * Floating overlay terminal, independent of editor/viewer.
 * cat/goto update viewer directly via hash routing.
 * edit command only available to admin, opens editor overlay.
 */
const Terminal = {
  input: null,
  output: null,
  panel: null,
  overlay: null,
  userBadge: null,
  history: [],
  historyIndex: -1,
  enabled: false,

  init() {
    this.input = document.getElementById("terminal-input");
    this.output = document.getElementById("terminal-output");
    this.panel = document.getElementById("terminal-panel");
    this.overlay = document.getElementById("terminal-overlay");
    this.userBadge = document.getElementById("terminal-user-badge");

    this.input.addEventListener("keydown", (e) => this.handleKeydown(e));
    document.getElementById("terminal-close-btn").addEventListener("click", () => App.closeTerminal());
    document.getElementById("terminal-backdrop").addEventListener("click", () => App.closeTerminal());

    this.initResize();
    this.enabled = true;
  },

  initResize() {
    var handle = document.getElementById("terminal-resize-handle");
    var self = this;
    var startY, startH;
    handle.addEventListener("mousedown", function(e) {
      startY = e.clientY;
      startH = self.panel.offsetHeight;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      e.preventDefault();
    });
    function onMove(e) {
      var h = Math.max(120, Math.min(600, startH + (startY - e.clientY)));
      self.panel.style.height = h + "px";
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  },

  handleKeydown(e) {
    if (!this.enabled) { e.preventDefault(); return; }
    if (e.key === "Enter") { e.preventDefault(); this.executeCommand(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.navigateHistory(-1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); this.navigateHistory(1); }
    else if (e.key === "Escape") { this.input.value = ""; App.closeTerminal(); }
    else if (e.key === "Tab") { e.preventDefault(); this.handleAutoComplete(); }
  },

  // ---- Auto-complete (same logic, production ready) ----
  _cache: {},
  _cacheTime: {},

  async handleAutoComplete() {
    var input = this.input.value, pos = this.input.selectionStart || 0;
    var before = input.substring(0, pos);
    var parts = this._parseCmdParts(before);
    if (!parts.length) return;

    if (parts.length === 1 && !before.endsWith(" ")) {
      var match = this._findMatch(parts[0].toLowerCase(), this._getCommandNames());
      if (match) this._applyCompletion(match, 0, parts[0].length, input, pos);
      return;
    }

    var candidates = await this._getCompletionCandidates(parts[0].toLowerCase());
    var argPrefix = before.endsWith(" ") ? "" : parts[parts.length - 1];
    var match = this._findMatch(argPrefix, candidates);
    if (match) {
      var argStart = before.lastIndexOf(argPrefix);
      if (argStart === -1) argStart = before.length;
      this._applyCompletion(match, argStart, argPrefix.length, input, pos);
    }
  },

  async _getCompletionCandidates(cmd) {
    if (["ls", "lsdir"].includes(cmd)) return this._getCached("dirs", 3000, () => this._fetchAndParse("ls", "dirs"));
    if (["cat", "rm"].includes(cmd)) return this._getCached("files", 3000, () => this._fetchDeep("files"));
    if (cmd === "goto") return this._getCached("projects", 3000, () => this._fetchAndParse("ls projects/", "dirs", ["home"]));
    if (cmd === "edit") return this._getCached("files", 3000, () => this._fetchDeep("files"));
    return [];
  },

  async _fetchAndParse(cmdOrDir, mode, prefixExtra) {
    var result = await API.execCommand(cmdOrDir);
    var names = this._parseLsOutput(result.output || "", mode);
    if (prefixExtra) names.unshift.apply(names, prefixExtra);
    return names;
  },

  async _fetchDeep(mode) {
    var self = this;
    var dirs = [{ p: "", d: "" }, { p: "posts/", d: "posts/" }, { p: "projects/", d: "projects/" }];
    var results = await Promise.all(dirs.map(function(d) {
      return API.execCommand("ls " + d.d);
    }));
    var all = [];
    for (var i = 0; i < results.length; i++) {
      var files = self._parseLsOutput(results[i].output || "", "files");
      for (var j = 0; j < files.length; j++) {
        var fp = dirs[i].p + files[j];
        if (all.indexOf(fp) === -1) all.push(fp);
      }
    }
    return all;
  },

  _parseLsOutput(output, mode) {
    var lines = output.split("\n"), names = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === "(empty directory)") continue;
      var isDir = line.endsWith("/");
      var name = line.replace(/^\s+/, "").replace(/\/$/, "");
      if (!name) continue;
      if (mode === "dirs" && !isDir) continue;
      if (mode === "files" && isDir) continue;
      names.push(name);
    }
    return names;
  },

  async _getCached(key, ttl, fetcher) {
    var now = Date.now();
    if (this._cache[key] && this._cacheTime[key] && now - this._cacheTime[key] < ttl) return this._cache[key];
    try { var d = await fetcher(); this._cache[key] = d; this._cacheTime[key] = now; return d; }
    catch (e) { return []; }
  },

  _parseCmdParts(input) {
    var parts = [], cur = "", inQ = false, q = "";
    for (var i = 0; i < input.length; i++) {
      var ch = input[i];
      if (inQ) { if (ch === q) inQ = false; else cur += ch; }
      else if (ch === '"' || ch === "'") { inQ = true; q = ch; }
      else if (ch === " ") { if (cur) parts.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur || input.endsWith(" ")) { if (cur) parts.push(cur); else parts.push(""); }
    return parts;
  },

  _getCommandNames() { return ["ls", "cat", "edit", "touch", "mkdir", "mount", "goto", "cin", "cout", "sync", "rm", "rmdir", "login", "logout", "whoami", "help", "clear", "exit", "theme"]; },

  _findMatch(prefix, candidates) {
    if (!prefix) return null;
    var lower = prefix.toLowerCase();
    var matches = candidates.filter(function(c) { return c.toLowerCase().startsWith(lower) && c.toLowerCase() !== lower; });
    if (!matches.length) return null;
    var common = matches[0];
    for (var i = 1; i < matches.length; i++) {
      for (var j = 0; j < common.length && j < matches[i].length && common[j] === matches[i][j]; j++);
      common = common.substring(0, j);
    }
    return common.length > prefix.length ? common : matches[0];
  },

  _applyCompletion(match, start, oldLen, input, cursor) {
    var bef = input.substring(0, start), aft = input.substring(cursor);
    this.input.value = bef + match + aft;
    this.input.setSelectionRange(start + match.length, start + match.length);
  },

  navigateHistory(dir) {
    if (!this.history.length) return;
    if (this.historyIndex === -1) this.historyIndex = this.history.length;
    this.historyIndex += dir;
    if (this.historyIndex < 0) this.historyIndex = 0;
    else if (this.historyIndex >= this.history.length) { this.historyIndex = -1; this.input.value = ""; return; }
    this.input.value = this.history[this.historyIndex];
  },

  async executeCommand() {
    var raw = this.input.value.trim();
    var lower = raw.toLowerCase();
    if (lower === "theme" || lower === "theme dark" || lower === "theme light") {
      this.input.value = "";
      this.printLine("$ " + raw, "command-line");
      var target = lower.includes("light") ? "light" : (lower.includes("dark") ? "dark" : null);
      if (!target) { var cur = document.documentElement.getAttribute("data-theme") || "dark"; target = cur === "dark" ? "light" : "dark"; }
      App.setTheme(target);
      this.printLine("Theme switched to: " + target, "output-line");
      return;
    }

    var command = this.input.value.trim();
    this.input.value = "";
    if (!command) return;
    this.history.push(command);
    this.historyIndex = -1;
    this.printLine("$ " + command, "command-line");

    var result = await API.execCommand(command);

    if (result.output && result.action !== "render" && result.action !== "render_project") {
      this.printLine(result.output, result.output.startsWith("Error") ? "output-line error" : "output-line");
    }

    if (result.sessionCookie) await this.refreshUserBadge();

    // cat → update viewer via hash
    if (result.action === "render" && result.html && result.filePath) {
      window.location.hash = result.filePath;
      App.onContentRendered(result.filePath, result.html);
      this.printLine("Rendered: " + result.filePath, "output-line");
    }
    // goto project → update viewer
    else if (result.action === "render_project" && result.html) {
      var proj = result.filePath ? result.filePath.split("/")[1] : "unknown";
      window.location.hash = "project:" + proj;
      App.onContentRendered("project:" + proj, result.html);
      this.printLine("Navigated to project: " + proj, "output-line");
      App.closeTerminal();
    }
    // goto home
    else if (result.action === "goto_home") {
      window.location.hash = "";
      App.navigate("about.md");
      App.closeTerminal();
    }
    // goto link
    else if (result.action === "goto_link" && result.link) {
      window.open(result.link, "_blank");
    }
    // edit → open editor (admin only)
    else if (result.action === "edit") {
      this.printLine("Opening editor for: " + result.filePath, "output-line");
      App.openEditor();
    }

    if (result.clear) this.output.innerHTML = "";
    if (result.close) App.closeTerminal();
    this.output.scrollTop = this.output.scrollHeight;
  },

  printLine(text, className) {
    var line = document.createElement("div");
    line.className = className || "output-line";
    line.textContent = text;
    this.output.appendChild(line);
  },

  async refreshUserBadge() {
    var s = await API.getSession();
    this.userBadge.textContent = s.group || "visitor";
    this.userBadge.style.color = s.loggedIn ? "#34d399" : "#4a6cf7";
    var w = document.getElementById("welcome-user");
    if (w) w.textContent = s.loggedIn ? s.username : "visitor";
  },

  focus() { this.input.focus(); },
  setEnabled(v) { this.enabled = v; if (!v) this.input.blur(); }
};