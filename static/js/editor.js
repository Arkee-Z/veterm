/**
 * Veterm v2.0 — Admin Editor
 * Full-screen overlay, Ctrl+Shift+E, admin only.
 * File tree sidebar + textarea editor.
 * Ctrl+S → save to DB + encrypted cache.
 */
const Editor = {
  textarea: null,
  filename: null,
  overlay: null,
  fileTree: null,
  currentFile: "",
  editMode: false,
  dirty: false,

  init() {
    this.textarea = document.getElementById("code-editor");
    this.filename = document.getElementById("editor-filename");
    this.overlay = document.getElementById("editor-overlay");
    this.fileTree = document.getElementById("editor-file-tree");

    // Ctrl+S save
    var self = this;
    this.textarea.addEventListener("keydown", function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); self.saveCurrentFile(); }
      if (e.key === "Escape") { if (self.dirty && !confirm("Unsaved changes. Close anyway?")) { e.preventDefault(); return; } App.closeEditor(); }
    });

    this.textarea.addEventListener("input", function() { self.dirty = true; });

    // Close button
    document.getElementById("editor-close-btn").addEventListener("click", () => {
      if (this.dirty && !confirm("Unsaved changes. Close anyway?")) return;
      App.closeEditor();
    });
  },

  async refreshFileTree() {
    if (!this.fileTree) return;
    try {
      var result = await API.execCommand("ls");
      var allFiles = this._parseFileList(result.output || "");
      if (allFiles.length === 0) { this.fileTree.innerHTML = "<div class='file-tree-item muted'>(empty)</div>"; return; }

      var html = "";
      for (var i = 0; i < allFiles.length; i++) {
        var f = allFiles[i];
        var cls = f === this.currentFile ? "file-tree-item active" : "file-tree-item";
        html += "<div class='" + cls + "' data-file='" + this._escAttr(f) + "'>" + this._escHtml(f) + "</div>";
      }
      this.fileTree.innerHTML = html;

      // Click to load
      var items = this.fileTree.querySelectorAll(".file-tree-item");
      var self = this;
      for (var j = 0; j < items.length; j++) {
        items[j].addEventListener("click", function() {
          var file = this.getAttribute("data-file");
          if (file) self.openFile(file);
        });
      }
    } catch (e) { this.fileTree.innerHTML = "<div class='file-tree-item muted'>Error loading</div>"; }
  },

  _parseFileList(output) {
    var lines = output.split("\n"), files = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === "(empty directory)") continue;
      var name = line.replace(/^\s+/, "").replace(/\/$/, "");
      if (name) files.push(name);
    }
    return files;
  },

  async openFile(filePath) {
    this.currentFile = filePath;
    this.editMode = true;
    this.dirty = false;

    // Load content from server
    var result = await API.renderFile(filePath);
    if (!result.error) {
      this.textarea.value = result.content || "";
      this.filename.textContent = filePath;
      this.textarea.removeAttribute("readonly");
      this.textarea.focus();
      this.refreshFileTree();
    }
  },

  async saveCurrentFile() {
    if (!this.currentFile || !this.editMode) return;
    var content = this.textarea.value;
    var result = await API.saveFile(this.currentFile, content);
    if (result.success) {
      this.dirty = false;
      // Update encrypted cache
      var render = await API.renderFile(this.currentFile);
      if (!render.error) await Cache.set(this.currentFile, render.html);
      Toast.show("Saved: " + this.currentFile, 1500);
    } else {
      Toast.show("Error: " + (result.error || "Unknown error"), 3000);
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

  _escHtml: function(s) { return s.replace(/\x26/g, "\x26amp;").replace(/</g, "\x26lt;").replace(/>/g, "\x26gt;"); },
  _escAttr: function(s) { return s.replace(/\x26/g, "\x26amp;").replace(/"/g, "\x26quot;"); }
};