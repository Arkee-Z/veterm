/**
 * API communication layer.
 * Every request resolves to a plain object — network failures never throw.
 */
const API = (() => {
  const TIMEOUT_MS = 15000;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        signal: controller.signal,
      });

      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }

      if (!response.ok) {
        return {
          ...data,
          error: data.error || `Request failed (${response.status})`,
          status: response.status,
        };
      }
      return data;
    } catch (error) {
      const message = error && error.name === "AbortError"
        ? "The server took too long to respond."
        : "Cannot reach the server. Is it running?";
      return { error: message, network: true };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    request,

    execCommand(command) {
      return request("/api/cmd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
    },

    saveFile(filePath, content) {
      return request("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, content }),
      });
    },

    renderFile(filePath) {
      return request("/api/render?file=" + encodeURIComponent(filePath));
    },

    getProject(name) {
      return request("/api/project?name=" + encodeURIComponent(name));
    },

    getPosts() {
      return request("/api/posts");
    },

    getTree() {
      return request("/api/tree");
    },

    getSession() {
      return request("/api/session");
    },
  };
})();
