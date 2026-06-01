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

  // ---- Auto-complete ----
  _fileCache: null,
  _fileCacheTime: 0,

  async handleAutoComplete() {
    var input = this.input.value;
    var pos = this.input.selectionStart || 0;
    var before = input.substring(0, pos);
    var parts = this._parseCmdParts(before);

    if (parts.length === 0) return;

    // Command name completion (first word)
    if (parts.length === 1 && !before.endsWith(" ")) {
      var prefix = parts[0].toLowerCase();
      var cmds = this._getCommandNames();
      var match = this._findMatch(prefix, cmds);
      if (match) this._applyCompletion(match, 0, parts[0].length, input, pos);
      return;
    }

    // Argument completion (second word or more)
    var cmdName = parts[0].toLowerCase();
    var argPrefix = parts.length >= 2 ? parts[parts.length - 1] : "";
    var files = await this._getFileList();
    var match = this._findMatch(argPrefix, files);
    if (match) {
      var argStart = before.lastIndexOf(argPrefix);
      this._applyCompletion(match, argStart, argPrefix.length, input, pos);
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
    return ["ls", "cat", "edit", "touch", "mkdir", "mount", "goto", "rm", "rmdir", "login", "logout", "whoami", "help", "clear", "exit", "theme"];
  },

  async _getFileList() {
    var now = Date.now();
    if (this._fileCache && now - this._fileCacheTime < 2000) return this._fileCache;

    try {
      var result = await API.execCommand("ls");
      if (!result.output) return [];
      var names = [];
      // Parse ls output: each line starts with 📁 or 📄 followed by name
      var lines = result.output.split("\n");
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        // Strip emoji icon
        var name = line.replace(/^[📁📄]\s+/, "");
        if (name && name !== "(empty directory)") {
          names.push(name);
        }
      }
      this._fileCache = names;
      this._fileCacheTime = now;
      return names;
    } catch (e) {
      return [];
    }
  },

  _findMatch(prefix, candidates) {
    if (!prefix) return null;
    var lower = prefix.toLowerCase();
    var matches = candidates.filter(function(c) {
      return c.toLowerCase().startsWith(lower) && c.toLowerCase() !== lower;
    });
    if (matches.length === 0) return null;
    // Find longest common prefix among matches
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

    if (this.historyIndex === -1) {
      this.historyIndex = this.history.length;
    }

    this.historyIndex += direction;

    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.history.length) {
      this.historyIndex = -1;
      this.input.value = "";
      return;
    }

    this.input.value = this.history[this.historyIndex];
  },

  async executeCommand() {
    var cmd = this.input.value.trim();
    var lower = cmd.toLowerCase();
    
    // theme command — handled client-side, no server round-trip
    if (lower === "theme" || lower === "theme dark" || lower === "theme light") {
      this.input.value = "";
      this.printLine("$ " + cmd, "command-line");
      var target = lower.includes("light") ? "light" : (lower.includes("dark") ? "dark" : null);
      if (!target) {
        // toggle
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

    // Add to history
    this.history.push(command);
    this.historyIndex = -1;

    // Echo the command
    this.printLine("$ " + command, "command-line");

    // Execute via API
    const result = await API.execCommand(command);

    if (result.output) {
      this.printLine(result.output, result.output.startsWith("Error") ? "output-line error" : "output-line");
    }

    // Handle session update
    if (result.sessionCookie) {
      await this.refreshUserBadge();
    }

    // Handle actions
    if (result.action === "render" && result.html) {
      // cat command: save rendered content + show in editor (read-only source)
      App.lastViewedHtml = result.html;
      App.lastViewedFile = result.filePath;
      Editor.showFileContent(result.source, result.html, result.filePath, false);
      App.switchToEditor(false);
    } else if (result.action === "edit") {
      // edit command: open in editor (editable)
      Editor.openFile(result.filePath, result.source);
      App.switchToEditor(true);
    } else if (result.action === "list" && result.html) {
      // ls command: show file list in viewer
      var viewer = document.getElementById("rendered-content");
      viewer.innerHTML = '<div class="file-listing">' + result.html + "</div>";
    }

    // Handle clear / close
    if (result.clear) {
      this.clearOutput();
    }
    if (result.close) {
      App.closeTerminal();
    }

    // Auto-scroll output
    this.output.scrollTop = this.output.scrollHeight;
  },

  printLine(text, className) {
    const line = document.createElement("div");
    line.className = className || "output-line";
    line.textContent = text;
    this.output.appendChild(line);
  },

  clearOutput() {
    this.output.innerHTML = "";
  },

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
    // Also update the terminal welcome user display
    var welcomeUser = document.getElementById("welcome-user");
    if (welcomeUser) {
      welcomeUser.textContent = session.loggedIn ? session.username : "visitor";
    }
  },

  focus() {
    this.input.focus();
  },

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.input.blur();
    }
  },
};