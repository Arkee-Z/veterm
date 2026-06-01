/**
 * Main Application Controller
 * Handles mode switching (viewer/editor), terminal toggle, and initialization
 */
const App = {
  /** @type {HTMLDivElement} */
  app: null,
  /** @type {HTMLDivElement} */
  viewerPanel: null,
  /** @type {HTMLDivElement} */
  editorPanel: null,
  /** @type {HTMLDivElement} */
  terminalPanel: null,
  /** @type {HTMLSpanElement} */
  statusMode: null,
  /** @type {boolean} */
  terminalVisible: false,
  /** @type {boolean} */
  isEditorMode: false,
  /** @type {string|null} */
  lastViewedHtml: null,
  /** @type {string|null} */
  lastViewedFile: null,

  init() {
    this.app = document.getElementById("app");
    this.viewerPanel = document.getElementById("viewer-panel");
    this.editorPanel = document.getElementById("editor-panel");
    this.terminalPanel = document.getElementById("terminal-panel");
    this.statusMode = document.getElementById("status-mode");

    // Restore theme from localStorage
    var saved = localStorage.getItem("veta-theme") || "dark";
    this.setTheme(saved);

    // Initialize sub-modules
    Terminal.init();
    Editor.init();

    // Disable right-click globally
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    // Global keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleGlobalKeydown(e));

    // Load default content (about.md)
    this.loadDefaultContent();

    // Initial user badge refresh
    Terminal.refreshUserBadge();
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("veta-theme", theme);
  },

  async loadDefaultContent() {
    const result = await API.renderFile("about.md");
    if (!result.error) {
      this.viewerPanel.querySelector("#rendered-content").innerHTML = result.html;
    }
  },

  handleGlobalKeydown(e) {
    // Ctrl+Shift+P — toggle terminal (avoids browser DevTools conflict)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault();
      if (this.terminalVisible) {
        this.closeTerminal();
      } else {
        this.openTerminal();
      }
      return;
    }

    // Escape — close terminal
    if (e.key === "Escape" && this.terminalVisible) {
      // Only handle if not in input field (terminal handles its own Esc)
      if (document.activeElement !== Terminal.input) {
        e.preventDefault();
        this.closeTerminal();
      }
      return;
    }
  },

  openTerminal() {
    this.terminalVisible = true;
    this.terminalPanel.classList.remove("hidden");
    this.statusMode.textContent = "Editor";

    // Switch to editor mode
    this.isEditorMode = true;
    this.app.classList.remove("viewer-mode");
    this.app.classList.add("editor-mode");

    // Show editor panel
    this.viewerPanel.classList.add("hidden");
    this.editorPanel.classList.remove("hidden");

    // If no file is open in editor, show about.md
    if (!Editor.currentFile) {
      API.renderFile("about.md").then((result) => {
        if (!result.error) {
          Editor.showFileContent(result.content, result.html, "about.md", false);
        }
      });
    }

    // Focus terminal
    setTimeout(() => Terminal.focus(), 150);
  },

  closeTerminal() {
    // Check for unsaved changes
    if (Editor.dirty && Editor.editMode) {
      if (!confirm("You have unsaved changes. Close terminal anyway?")) {
        return;
      }
    }

    this.terminalVisible = false;
    this.terminalPanel.classList.add("hidden");
    this.statusMode.textContent = "Viewer";

    // Switch to viewer mode
    this.isEditorMode = false;
    this.app.classList.remove("editor-mode");
    this.app.classList.add("viewer-mode");

    // Show viewer, hide editor
    this.editorPanel.classList.add("hidden");
    this.viewerPanel.classList.remove("hidden");

    // Reset editor state
    Editor.reset();

    // Restore last viewed content from cat command, or fallback to about.md
    var viewer = document.getElementById("rendered-content");
    if (this.lastViewedHtml) {
      viewer.innerHTML = this.lastViewedHtml;
    } else {
      this.loadDefaultContent();
    }
  },

  switchToEditor(editable) {
    this.viewerPanel.classList.add("hidden");
    this.editorPanel.classList.remove("hidden");
    this.isEditorMode = true;
    this.statusMode.textContent = "Editor";
    this.app.classList.remove("viewer-mode");
    this.app.classList.add("editor-mode");
  },
};

// Bootstrap when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});