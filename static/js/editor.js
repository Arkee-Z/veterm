/**
 * Veterm — admin editor.
 * Full-screen workspace with a collapsible file tree, dirty tracking,
 * keyboard shortcuts, and a nested content view.
 */
const Editor = {
  textarea: null,
  filenameEl: null,
  typeEl: null,
  dirtyEl: null,
  saveBtn: null,
  treeEl: null,
  countEl: null,
  form: null,
  newInput: null,
  overlay: null,
  sidebarToggle: null,
  cursorEl: null,
  statsEl: null,
  sessionBadge: null,

  currentFile: "",
  pageType: "md",
  dirty: false,
  isNew: false,
  saving: false,
  tree: null,
  expanded: new Set(),
  treeInitialized: false,

  ICONS: {
    folder:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    file:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    html:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    link:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  },

  init() {
    const $ = (id) => document.getElementById(id);
    this.textarea = $("code-editor");
    this.filenameEl = $("editor-filename");
    this.typeEl = $("editor-file-type");
    this.dirtyEl = $("editor-dirty");
    this.saveBtn = $("editor-save-btn");
    this.treeEl = $("editor-file-tree");
    this.countEl = $("editor-file-count");
    this.form = $("editor-new-form");
    this.newInput = $("editor-new-input");
    this.overlay = $("editor-overlay");
    this.sidebarToggle = $("editor-sidebar-toggle");
    this.cursorEl = $("editor-cursor");
    this.statsEl = $("editor-stats");
    this.sessionBadge = $("editor-session-badge");

    this.textarea.addEventListener("input", () => {
      this.dirty = true;
      this.isNew = this.isNew && this.textarea.value.length === 0;
      this.updateDirtyUI();
      this.updateStats();
      this.updateCursor();
    });

    this.textarea.addEventListener("keydown", (event) => {
      if (
        event.key === "Tab" && !event.shiftKey && !event.ctrlKey &&
        !event.metaKey && !event.altKey
      ) {
        event.preventDefault();
        this.insertTab();
      }
    });

    this.textarea.addEventListener("keyup", () => this.updateCursor());
    this.textarea.addEventListener("click", () => this.updateCursor());
    this.textarea.addEventListener("select", () => this.updateCursor());

    this.saveBtn.addEventListener("click", () => this.save());
    document.getElementById("editor-close-btn").addEventListener(
      "click",
      () => this.requestClose(),
    );
    document.getElementById("editor-refresh-btn").addEventListener(
      "click",
      () => this.refreshFileTree(true),
    );
    document.getElementById("editor-new-btn").addEventListener(
      "click",
      () => this.toggleNewForm(),
    );
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.createFile();
    });
    this.newInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.toggleNewForm(false);
      }
    });
    this.sidebarToggle.addEventListener("click", () => {
      this.overlay.classList.toggle("sidebar-open");
    });
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay && this.overlay.classList.contains("sidebar-open")) {
        this.overlay.classList.remove("sidebar-open");
      }
    });
    document.getElementById("editor-sidebar-close").addEventListener(
      "click",
      () => {
        this.overlay.classList.remove("sidebar-open");
        this.sidebarToggle.focus();
      },
    );

    document.addEventListener("selectionchange", () => {
      if (document.activeElement === this.textarea) this.updateCursor();
    });

    this.updateStats();
    this.updateDirtyUI();
  },

  // ------------------------------------------------------------------ opening
  async open(filePath, options = {}) {
    await this.refreshFileTree();
    if (filePath) {
      if (this.currentFile && this.dirty && this.currentFile !== filePath) {
        if (!confirm(I18n.t("editor.discard"))) return;
        this.dirty = false;
      }
      await this.openFile(filePath, options);
    } else if (this.currentFile) {
      await this.openFile(this.currentFile);
    } else {
      this.showEmpty();
    }
    this.overlay.classList.remove("sidebar-open");
    document.title = this.currentFile
      ? I18n.t("editor.editingTitle", { path: this.currentFile })
      : I18n.t("editor.title");
  },

  async openFile(filePath, options = {}) {
    if (
      this.currentFile && this.dirty && this.currentFile !== filePath &&
      !options.source
    ) {
      if (!confirm(I18n.t("editor.discard"))) return;
    }

    let content = options.source;
    let pageType = options.pageType;
    if (content === undefined) {
      const result = await API.renderFile(filePath);
      if (result.error) {
        Toast.error(result.error);
        return;
      }
      content = result.content || "";
      pageType = result.type;
    }

    this.currentFile = filePath;
    this.pageType = pageType || this.typeFromPath(filePath) || "md";
    this.isNew = !!options.newFile;
    this.dirty = this.isNew;
    this.textarea.value = content || "";
    this.textarea.removeAttribute("readonly");
    this.filenameEl.textContent = filePath;
    this.updateTypeBadge();
    this.updateDirtyUI();
    this.updateStats();
    this.updateCursor();
    this.renderTree();
    this.textarea.focus();
    this.textarea.setSelectionRange(0, 0);
    this.textarea.scrollTop = 0;
    this.textarea.scrollLeft = 0;
    requestAnimationFrame(() => {
      this.textarea.scrollTop = 0;
      this.textarea.scrollLeft = 0;
    });
    this.overlay.classList.remove("sidebar-open");
  },

  showEmpty() {
    this.currentFile = "";
    this.pageType = "md";
    this.dirty = false;
    this.isNew = false;
    this.textarea.value = "";
    this.filenameEl.textContent = I18n.t("editor.noFile");
    this.updateTypeBadge();
    this.updateDirtyUI();
    this.updateStats();
    this.updateCursor();
    this.renderTree();
  },

  updateTypeBadge() {
    const ext = this.typeFromPath(this.currentFile);
    let label = "MD";
    if (this.pageType === "html" || ext === "html") label = "HTML";
    else if (this.pageType === "link") label = "LINK";
    else if (ext === "json") label = "JSON";
    else if (ext === "txt") label = "TXT";
    this.typeEl.textContent = label;
  },

  typeFromPath(path) {
    const match = /\.([a-z0-9]+)$/i.exec(path || "");
    return match ? match[1].toLowerCase() : "";
  },

  // ------------------------------------------------------------------ saving
  updateDirtyUI() {
    this.dirtyEl.classList.toggle("hidden", !this.dirty);
    this.saveBtn.disabled = !this.currentFile || this.saving || !this.dirty;
    if (this.currentFile) {
      this.filenameEl.textContent = this.currentFile + (this.dirty ? " *" : "");
    }

    const active = this.treeEl
      ? this.treeEl.querySelector(".tree-row.is-active")
      : null;
    if (active) {
      const existing = active.querySelector(".tree-dirty");
      if (this.dirty && !existing) {
        const dot = document.createElement("span");
        dot.className = "tree-dirty";
        dot.textContent = "●";
        active.appendChild(dot);
      } else if (!this.dirty && existing) {
        existing.remove();
      }
    }
  },

  async save() {
    if (!this.currentFile || this.saving) return;
    this.saving = true;
    this.saveBtn.disabled = true;
    this.saveBtn.querySelector("span").textContent = I18n.t("editor.saving");

    const result = await API.saveFile(this.currentFile, this.textarea.value);
    this.saving = false;
    this.saveBtn.querySelector("span").textContent = I18n.t("editor.save");

    if (result.error || !result.success) {
      Toast.error(result.error || I18n.t("editor.saveError"));
      this.updateDirtyUI();
      return;
    }

    this.dirty = false;
    this.isNew = false;
    this.pageType = result.type || this.pageType;
    this.updateTypeBadge();
    this.updateDirtyUI();
    Toast.success(I18n.t("editor.saved", { path: this.currentFile }));
    document.title = I18n.t("editor.editingTitle", { path: this.currentFile });

    await App.onFileSaved(this.currentFile);
    await this.refreshFileTree();
  },

  // ------------------------------------------------------------------ file tree
  async refreshFileTree(silent = false) {
    const tree = await App.getTree(true);
    if (!tree) {
      if (!silent) Toast.error(I18n.t("editor.loadError"));
      return;
    }
    this.setTree(tree);
  },

  setTree(tree) {
    this.tree = tree;
    this.renderTree();
  },

  renderTree() {
    if (!this.treeEl) return;
    const entries = (this.tree && this.tree.entries) || [];
    const scrollTop = this.treeEl.scrollTop;

    // Keep only the current file's folder open on first paint.
    this.treeInitialized = true;

    if (this.currentFile) {
      const segments = this.currentFile.split("/");
      let path = "";
      for (let i = 0; i < segments.length - 1; i++) {
        path = path ? `${path}/${segments[i]}` : segments[i];
        this.expanded.add(path);
      }
    }

    const byParent = new Map();
    for (const entry of entries) {
      const index = entry.path.lastIndexOf("/");
      const parent = index === -1 ? "" : entry.path.slice(0, index);
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(entry);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }

    this.treeEl.replaceChildren();
    const files = entries.filter((entry) => !entry.isDirectory).length;
    this.countEl.textContent = I18n.t("editor.fileCount", { count: files });

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tree-row muted";
      empty.textContent = "(no files yet)";
      this.treeEl.appendChild(empty);
      return;
    }

    const addChildren = (parent, depth) => {
      const children = byParent.get(parent) || [];
      for (const entry of children) {
        if (entry.isDirectory) {
          const isOpen = this.expanded.has(entry.path);
          const row = document.createElement("button");
          row.type = "button";
          row.className = `tree-row is-dir${isOpen ? " is-open" : ""}`;
          row.style.paddingLeft = `${8 + depth * 12}px`;
          row.setAttribute("aria-expanded", isOpen ? "true" : "false");
          row.innerHTML =
            `<span class="tree-caret" aria-hidden="true">▸</span><span class="tree-icon">${this.ICONS.folder}</span>`;

          const name = document.createElement("span");
          name.className = "tree-name";
          name.textContent = entry.name + "/";
          row.appendChild(name);

          row.addEventListener("click", () => {
            if (isOpen) this.expanded.delete(entry.path);
            else this.expanded.add(entry.path);
            this.renderTree();
          });
          this.treeEl.appendChild(row);

          if (isOpen) addChildren(entry.path, depth + 1);
        } else {
          const row = document.createElement("button");
          row.type = "button";
          row.className = `tree-row${
            entry.path === this.currentFile ? " is-active" : ""
          }`;
          row.style.paddingLeft = `${8 + depth * 12 + 13}px`;
          if (entry.path === this.currentFile) {
            row.setAttribute("aria-current", "true");
          }
          const iconName =
            (entry.type || this.typeFromPath(entry.path)) === "html"
              ? "html"
              : (entry.type === "link" ? "link" : "file");
          row.innerHTML = `<span class="tree-icon">${
            this.ICONS[iconName] || this.ICONS.file
          }</span>`;

          const name = document.createElement("span");
          name.className = "tree-name";
          name.textContent = entry.name;
          row.appendChild(name);

          if (entry.path === this.currentFile && this.dirty) {
            const dot = document.createElement("span");
            dot.className = "tree-dirty";
            dot.textContent = "●";
            row.appendChild(dot);
          }

          row.addEventListener("click", () => {
            if (entry.path === this.currentFile) {
              this.textarea.focus();
              this.overlay.classList.remove("sidebar-open");
              return;
            }
            if (this.dirty && this.currentFile) {
              if (!confirm(I18n.t("editor.discard"))) {
                return;
              }
              this.dirty = false;
            }
            this.openFile(entry.path);
            this.overlay.classList.remove("sidebar-open");
          });
          this.treeEl.appendChild(row);
        }
      }
    };

    addChildren("", 0);
    this.treeEl.scrollTop = scrollTop;
  },

  // ------------------------------------------------------------------ new file
  toggleNewForm(force) {
    const show = force === undefined
      ? this.form.classList.contains("hidden")
      : force;
    if (show) {
      this.form.classList.remove("hidden");
      this.newInput.value = "";
      this.newInput.focus();
    } else {
      this.form.classList.add("hidden");
      this.newInput.blur();
    }
  },

  async createFile() {
    let path = this.newInput.value.trim().replace(/^\/+/, "");
    if (!path) return;
    if (
      path.includes("..") || path.includes("\\") || path.includes("\x00") ||
      /["']/.test(path)
    ) {
      Toast.error(I18n.t("editor.invalidPath"));
      return;
    }
    if (!/\.[a-z0-9]+$/i.test(path)) path += ".md";

    const result = await API.execCommand(`touch "${path}"`);
    if (result.error || /^Error:/i.test(result.output || "")) {
      Toast.error(
        result.output || result.error || I18n.t("editor.createError"),
      );
      return;
    }

    Toast.success(I18n.t("editor.created", { path }));
    this.toggleNewForm(false);
    await App.getTree(true);
    await this.openFile(path, { source: "", newFile: true });
  },

  // ------------------------------------------------------------------ close/reset
  requestClose() {
    if (this.dirty) {
      if (!confirm(I18n.t("editor.closeDirty"))) return false;
      this.dirty = false;
      this.isNew = false;
      this.showEmpty();
    }
    this.dirty = false;
    App.closeEditor();
    return true;
  },

  onClose() {
    this.toggleNewForm(false);
    this.overlay.classList.remove("sidebar-open");
    if (this.dirty) {
      this.dirty = false;
      this.showEmpty();
    }
    App.restoreDocumentMeta();
  },

  reset() {
    this.showEmpty();
    this.dirty = false;
    this.isNew = false;
    this.updateDirtyUI();
    App.restoreDocumentMeta();
  },

  focus() {
    if (this.textarea) this.textarea.focus();
  },

  updateSession(session) {
    if (!this.sessionBadge) return;
    this.sessionBadge.textContent = session && session.group === "admin"
      ? I18n.t("editor.session")
      : (session?.group || I18n.t("editor.session"));
  },

  applyLanguage() {
    if (!this.currentFile) this.filenameEl.textContent = I18n.t("editor.noFile");
    this.updateSession(App.session);
    this.updateStats();
    this.updateCursor();
  },

  // ------------------------------------------------------------------ status
  updateStats() {
    const text = this.textarea.value;
    const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const latin = text
      .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const words = cjk + latin;
    this.statsEl.textContent = I18n.t("editor.stats", { words, chars: text.length });
  },

  updateCursor() {
    if (!this.cursorEl || !this.textarea) return;
    const position = this.textarea.selectionStart || 0;
    const before = this.textarea.value.slice(0, position);
    const line = before.split("\n").length;
    const column = position - before.lastIndexOf("\n");
    this.cursorEl.textContent = I18n.t("editor.cursor", { line, col: column });
  },

  insertTab() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const value = this.textarea.value;
    this.textarea.value = value.slice(0, start) + "  " + value.slice(end);
    const position = start + 2;
    this.textarea.setSelectionRange(position, position);
    this.dirty = true;
    this.updateDirtyUI();
    this.updateStats();
    this.updateCursor();
  },
};
