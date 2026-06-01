/**
 * Editor Controller
 * Handles code editor (source only, no preview)
 */
const Editor = {
  /** @type {HTMLTextAreaElement} */
  textarea: null,
  /** @type {HTMLSpanElement} */
  filename: null,
  /** @type {string} */
  currentFile: "",
  /** @type {boolean} */
  editMode: false,
  /** @type {boolean} */
  dirty: false,

  init() {
    this.textarea = document.getElementById("code-editor");
    this.filename = document.getElementById("editor-filename");

    // Ctrl+S to save
    this.textarea.addEventListener("keydown", function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        Editor.saveCurrentFile();
      }
    });

    // Track dirty state
    this.textarea.addEventListener("input", function() {
      Editor.dirty = true;
    });
  },

  /**
   * Open a file for editing
   * @param {string} filePath
   * @param {string} content
   */
  openFile(filePath, content) {
    this.currentFile = filePath;
    this.editMode = true;
    this.dirty = false;
    this.textarea.value = content || "";
    this.filename.textContent = filePath;
    this.textarea.removeAttribute("readonly");
    this.textarea.focus();
  },

  /**
   * Show file content (read-only source view from cat)
   * @param {string} source
   * @param {string} html
   * @param {string} filePath
   * @param {boolean} editable
   */
  showFileContent(source, html, filePath, editable) {
    this.currentFile = filePath || "";
    this.editMode = editable;
    this.dirty = false;

    if (editable) {
      this.textarea.value = source || "";
      this.filename.textContent = filePath || "";
      this.textarea.removeAttribute("readonly");
    } else {
      this.textarea.value = source || "";
      this.filename.textContent = filePath ? filePath + " (read-only)" : "(read-only)";
      this.textarea.setAttribute("readonly", "true");
    }
  },

  /**
   * Save the current file to server
   */
  async saveCurrentFile() {
    if (!this.currentFile || !this.editMode) return;

    var content = this.textarea.value;
    var result = await API.saveFile(this.currentFile, content);

    if (result.success) {
      this.dirty = false;
      Terminal.printLine("Saved: " + this.currentFile, "output-line");
      Terminal.output.scrollTop = Terminal.output.scrollHeight;
    } else {
      Terminal.printLine("Error saving: " + (result.error || "Unknown error"), "output-line error");
      Terminal.output.scrollTop = Terminal.output.scrollHeight;
    }
  },

  reset() {
    this.currentFile = "";
    this.editMode = false;
    this.dirty = false;
    this.textarea.value = "";
    this.textarea.removeAttribute("readonly");
    this.filename.textContent = "";
  },
};