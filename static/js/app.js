/**
 * Veterm v2.0 — Application Controller
 * - Viewer: always visible, hash-routed
 * - Terminal: floating overlay, Ctrl+Shift+P
 * - Editor: full-screen overlay, Ctrl+Shift+E (admin only)
 */
const App = {
  app: null,
  viewerPanel: null,
  renderedContent: null,
  terminalOverlay: null,
  editorOverlay: null,
  statusMode: null,
  terminalVisible: false,
  editorVisible: false,
  lastFile: null,

  init() {
    this.app = document.getElementById("app");
    this.viewerPanel = document.getElementById("viewer-panel");
    this.renderedContent = document.getElementById("rendered-content");
    this.terminalOverlay = document.getElementById("terminal-overlay");
    this.editorOverlay = document.getElementById("editor-overlay");
    this.statusMode = document.getElementById("status-mode");

    var saved = localStorage.getItem("veterm-theme") || "dark";
    this.setTheme(saved);

    Terminal.init();
    Editor.init();
    Toast.init();

    // Right-click disabled with toast
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      Toast.show("Right-click disabled — Use the terminal for all actions");
    });

    // Global keyboard
    document.addEventListener("keydown", (e) => this.handleGlobalKeydown(e));

    // Hash change listener for browser back/forward
    window.addEventListener("hashchange", () => this.handleHashChange());

    // Initial route
    this.handleHashChange();

    Terminal.refreshUserBadge();
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("veterm-theme", theme);
  },

  handleHashChange() {
    var hash = window.location.hash.slice(1);
    if (!hash) {
      this.navigate("about.md");
    } else if (hash.startsWith("project:")) {
      this.navigateProject(hash.slice(8));
    } else {
      this.navigate(hash);
    }
  },

  async navigate(filePath) {
    this.lastFile = filePath;
    // Try cache first
    var cached = await Cache.get(filePath);
    if (cached) {
      this.renderedContent.innerHTML = cached;
      return;
    }
    // Fetch from server
    var result = await API.renderFile(filePath);
    if (!result.error) {
      this.renderedContent.innerHTML = result.html;
      await Cache.set(filePath, result.html);
    }
  },

  async navigateProject(name) {
    var cached = await Cache.get("project:" + name);
    if (cached) {
      this.renderedContent.innerHTML = cached;
      return;
    }
    var result = await API.execCommand("goto " + name);
    if (result.action === "render_project" && result.html) {
      this.renderedContent.innerHTML = result.html;
      await Cache.set("project:" + name, result.html);
    }
  },

  handleGlobalKeydown(e) {
    // Ctrl+Shift+P — toggle terminal
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault();
      this.toggleTerminal();
      return;
    }
    // Ctrl+Shift+E — toggle editor (admin only)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "E" || e.key === "e")) {
      e.preventDefault();
      this.toggleEditor();
      return;
    }
    // Escape — close terminal or editor
    if (e.key === "Escape") {
      if (this.terminalVisible && document.activeElement !== Terminal.input) {
        this.closeTerminal();
      } else if (this.editorVisible) {
        if (Editor.dirty) {
          if (!confirm("Unsaved changes. Close anyway?")) return;
        }
        this.closeEditor();
      }
      return;
    }
  },

  toggleTerminal() {
    this.terminalVisible ? this.closeTerminal() : this.openTerminal();
  },

  openTerminal() {
    this.terminalVisible = true;
    this.terminalOverlay.classList.remove("hidden");
    setTimeout(() => Terminal.focus(), 150);
  },

  closeTerminal() {
    this.terminalVisible = false;
    this.terminalOverlay.classList.add("hidden");
  },

  toggleEditor() {
    this.editorVisible ? this.closeEditor() : this.openEditor();
  },

  async openEditor() {
    // Check admin session
    var session = await API.getSession();
    if (!session.loggedIn || session.group !== "admin") {
      Toast.show("Editor requires admin login. Use 'login admin <password>' in terminal.");
      return;
    }
    this.editorVisible = true;
    this.editorOverlay.classList.remove("hidden");
    Editor.refreshFileTree();
  },

  closeEditor() {
    this.editorVisible = false;
    this.editorOverlay.classList.add("hidden");
  },

  // Called by terminal after cat/goto to update viewer and cache
  async onContentRendered(filePath, html) {
    this.renderedContent.innerHTML = html;
    await Cache.set(filePath, html);
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());