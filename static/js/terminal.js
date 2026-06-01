/**
 * Terminal UI Controller
 * Handles terminal input, output rendering, and command history
 */
const Terminal = {
  /** @type {HTMLInputElement} */
  input: null,
  /** @type {HTMLDivElement} */
  output: null,
  /** @type {HTMLDivElement} */
  panel: null,
  /** @type {HTMLSpanElement} */
  userBadge: null,
  /** @type {string[]} */
  history: [],
  /** @type {number} */
  historyIndex: -1,
  /** @type {boolean} */
  enabled: false,

  init() {
    this.input = document.getElementById("terminal-input");
    this.output = document.getElementById("terminal-output");
    this.panel = document.getElementById("terminal-panel");
    this.userBadge = document.getElementById("terminal-user-badge");

    this.input.addEventListener("keydown", (e) => this.handleKeydown(e));

    // Close button
    document.getElementById("terminal-close-btn").addEventListener("click", () => {
      App.closeTerminal();
    });

    // Resize handle
    this.initResize();

    this.enabled = true;
  },

  initResize() {
    /** @type {HTMLDivElement} */
    const handle = document.getElementById("terminal-resize-handle");
    let startY = 0;
    let startHeight = 0;

    handle.addEventListener("mousedown", (e) => {
      startY = e.clientY;
      startHeight = this.panel.offsetHeight;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });

    const onMouseMove = (e) => {
      const delta = startY - e.clientY;
      const newHeight = Math.max(120, Math.min(600, startHeight + delta));
      this.panel.style.height = newHeight + "px";
      this.panel.style.animation = "none";
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  },

  handleKeydown(e) {
    if (!this.enabled) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      this.executeCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.navigateHistory(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.navigateHistory(1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.input.value = "";
      App.closeTerminal();
    } else if (e.key === "Tab") {
      e.preventDefault();
      this.handleAutoComplete();
    }
  },

  // ---- Auto-complete (command-aware) ----
  _cache: {},
  _cacheTime: {},

  async handleAutoComplete() {
    var input = this.input.value;
    var pos = this.input.selectionStart || 0;
    var before = input.substring(0, pos);
    var parts = this._parseCmdParts(before);
    if (parts.length === 0) return;

    // Command name completion
    if (parts.length === 1 && !before.endsWith(" ")) {
      var prefix = parts[0].toLowerCase();
      var match = this._findMatch(prefix, this._getCommandNames());
      if (match) this._applyCompletion(match, 0, parts[0].length, input, pos);
      return;
    }

    var cmd = parts[0].toLowerCase();
    var argIdx = before.endsWith(" ") ? parts.length : parts.length - 1;
    var argPrefix = before.endsWith(" ") ? "" : parts[parts.length - 1];

    // Command-specific argument completion
    var candidates = await this._getCompletionCandidates(cmd, argIdx);
    var match = this._findMatch(argPrefix, candidates);
    if (match) {
      var argStart = before.lastIndexOf(argPrefix);
      if (argStart === -1) argStart = before.length;
      this._applyCompletion(match, argStart, argPrefix.length, input, pos);
    }
  },

  async _getCompletionCandidates(cmd, argIdx) {
    switch (cmd) {
      case "ls":
      case "rmdir":
        return this._getCached("ls_dirs", 3000, async () => {
          var result = await API.execCommand("ls");
          return this._parseLsOutput(result.output || "", "dirs");
        });

      case "cat":
      case "edit":
      case "rm":
        return this._getCached("ls_files_deep", 3000, async () => {
          var allFiles = [];
          var dirs = [
            { prefix: "", dir: "" },
            { prefix: "posts/", dir: "posts/" },
            { prefix: "projects/", dir: "projects/" }
          ];
          for (var d = 0; d < dirs.length; d++) {
            var result = await API.execCommand("ls " + dirs[d].dir);
            var files = this._parseLsOutput(result.output || "", "files");
            for (var f = 0; f < files.length; f++) {
              var fullPath = dirs[d].prefix + files[f];
              if (allFiles.indexOf(fullPath) === -1) allFiles.push(fullPath);
            }
          }
          return allFiles;
        });

      case "touch":
      case "mkdir":
      case "cin":
      case "cout":
        return [];

      case "mount":
        if (argIdx === 1) return []; // free-form name
        if (argIdx === 2) return ["project", "link"];
        return [];

      case "goto":
        return this._getCached("goto_projects", 3000, async () => {
          var result = await API.execCommand("ls projects/");
          if (!result.output || result.output.startsWith("Error")) return ["home"];
          var names = this._parseLsOutput(result.output, "dirs");
          names.unshift("home");
          return names;
        });

      default:
        return this._getCached("ls_all", 3000, async () => {
          var result = await API.execCommand("ls");
          return this._parseLsOutput(result.output || "", "all");
        });
    }
  },

  _parseLsOutput(output, mode) {
    var lines = output.split("\n");
    var names = [];
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
    if (this._cache[key] && this._cacheTime[key] && now - this._cacheTime[key] < ttl) {
      return this._cache[key];
    }
    try {
      var data = await fetcher();
      this._cache[key] = data;
      this._cacheTime[key] = now;
      return data;
    } catch (e) {
      return [];
    }
  },

  _parseCmdParts(input) {
    var parts = [];
    var current = "";
    var inQuote = false;
    var quoteChar = "";
    for (var i = 0; i < input.length; i++) {
      var ch = input[i];
      if (inQuote) {
        if (ch === quoteChar) { inQuote = false; } else { current += ch; }
      } else if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === " ") {
        if (current) { parts.push(current); current = ""; }
      } else {
        current += ch;
      }
    }
    if (current || input.endsWith(" ")) {
      if (current) parts.push(current);
      else parts.push("");
    }
    return parts;
  },

  _getCommandNames() {
    return ["ls", "cat", "edit", "touch", "mkdir", "mount", "goto", "cin", "cout", "sync", "rm", "rmdir", "login", "logout", "whoami", "help", "clear", "exit", "theme"];
  },

  _findMatch(prefix, candidates) {
    if (!prefix) return null;
    var lower = prefix.toLowerCase();
    var matches = candidates.filter(function(c) {
      return c.toLowerCase().startsWith(lower) && c.toLowerCase() !== lower;
    });
    if (matches.length === 0) return null;
    var common = matches[0];
    for (var i = 1; i < matches.length; i++) {
      var s = matches[i];
      var j = 0;
      while (j < common.length && j < s.length && common[j] === s[j]) j++;
      common = common.substring(0, j);
    }
    return common.length > prefix.length ? common : matches[0];
  },

  _applyCompletion(match, startPos, oldLen, input, cursorPos) {
    var before = input.substring(0, startPos);
    var after = input.substring(cursorPos);
    this.input.value = before + match + after;
    var newCursor = startPos + match.length;
    this.input.setSelectionRange(newCursor, newCursor);
  },

  navigateHistory(direction) {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1) this.historyIndex = this.history.length;
    this.historyIndex += direction;
    if (this.historyIndex < 0) { this.historyIndex = 0; }
    else if (this.historyIndex >= this.history.length) { this.historyIndex = -1; this.input.value = ""; return; }
    this.input.value = this.history[this.historyIndex];
  },

  async executeCommand() {
    var cmd = this.input.value.trim();
    var lower = cmd.toLowerCase();
    
    if (lower === "theme" || lower === "theme dark" || lower === "theme light") {
      this.input.value = "";
      this.printLine("$ " + cmd, "command-line");
      var target = lower.includes("light") ? "light" : (lower.includes("dark") ? "dark" : null);
      if (!target) {
        var current = document.documentElement.getAttribute("data-theme") || "dark";
        target = current === "dark" ? "light" : "dark";
      }
      App.setTheme(target);
      this.printLine("Theme switched to: " + target, "output-line");
      this.output.scrollTop = this.output.scrollHeight;
      return;
    }

    const command = this.input.value.trim();
    this.input.value = "";
    if (!command) return;

    this.history.push(command);
    this.historyIndex = -1;
    this.printLine("$ " + command, "command-line");

    const result = await API.execCommand(command);

    if (result.output) {
      this.printLine(result.output, result.output.startsWith("Error") ? "output-line error" : "output-line");
    }

    if (result.sessionCookie) await this.refreshUserBadge();

    if (result.action === "render" && result.html) {
      App.lastViewedHtml = result.html;
      App.lastViewedFile = result.filePath;
      Editor.showFileContent(result.source, result.html, result.filePath, false);
      App.switchToEditor(false);
    } else if (result.action === "render_project" && result.html) {
      App.lastViewedHtml = result.html;
      App.lastViewedFile = result.filePath;
      App.currentProject = result.filePath ? result.filePath.split("/")[1] : null;
      document.getElementById("rendered-content").innerHTML = result.html;
      Editor.reset();
      App.viewerPanel.classList.remove("hidden");
      App.editorPanel.classList.add("hidden");
      App.closeTerminal();
    } else if (result.action === "goto_home") {
      App.currentProject = null;
      App.lastViewedHtml = null;
      App.lastViewedFile = null;
      Editor.reset();
      App.loadDefaultContent();
      App.viewerPanel.classList.remove("hidden");
      App.editorPanel.classList.add("hidden");
      App.closeTerminal();
    } else if (result.action === "goto_link" && result.link) {
      window.open(result.link, "_blank");
    } else if (result.action === "edit") {
      Editor.openFile(result.filePath, result.source);
      App.switchToEditor(true);
    } else if (result.action === "list" && result.html) {
      document.getElementById("rendered-content").innerHTML = '<div class="file-listing">' + result.html + "</div>";
    }

    if (result.clear) this.clearOutput();
    if (result.close) App.closeTerminal();

    this.output.scrollTop = this.output.scrollHeight;
  },

  printLine(text, className) {
    const line = document.createElement("div");
    line.className = className || "output-line";
    line.textContent = text;
    this.output.appendChild(line);
  },

  clearOutput() { this.output.innerHTML = ""; },

  async refreshUserBadge() {
    const session = await API.getSession();
    const group = session.group || "visitor";
    this.userBadge.textContent = group;
    if (session.loggedIn) {
      this.userBadge.style.color = "#34d399";
      this.userBadge.style.background = "rgba(52, 211, 153, 0.15)";
    } else {
      this.userBadge.style.color = "#4a6cf7";
      this.userBadge.style.background = "rgba(74, 108, 247, 0.15)";
    }
    var w = document.getElementById("welcome-user");
    if (w) w.textContent = session.loggedIn ? session.username : "visitor";
  },

  focus() { this.input.focus(); },

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.input.blur();
  },
};