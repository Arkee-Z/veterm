/**
 * API communication layer
 */
const API = {
  /**
   * Execute a terminal command on the server
   * @param {string} command
   * @returns {Promise<object>}
   */
  async execCommand(command) {
    const res = await fetch("/api/cmd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      return { output: "Error: " + (err.error || res.statusText), close: false };
    }
    return res.json();
  },

  /**
   * Save file content
   * @param {string} filePath
   * @param {string} content
   * @returns {Promise<object>}
   */
  async saveFile(filePath, content) {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, content }),
    });
    return res.json();
  },

  /**
   * Render a markdown file
   * @param {string} filePath
   * @returns {Promise<object>}
   */
  async renderFile(filePath) {
    const res = await fetch("/api/render?file=" + encodeURIComponent(filePath));
    return res.json();
  },

  /**
   * Get current session info
   * @returns {Promise<object>}
   */
  async getSession() {
    const res = await fetch("/api/session");
    return res.json();
  },
};