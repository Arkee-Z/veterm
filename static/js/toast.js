/**
 * Toast notifications.
 * Usage: Toast.show("Saved", { kind: "success" }); or Toast.success("Saved");
 */
const Toast = {
  _el: null,
  _message: null,
  _timer: null,
  _hideTimer: null,

  init() {
    this._el = document.getElementById("toast");
    this._message = document.getElementById("toast-message");
  },

  show(message, options = {}) {
    if (!this._el || !this._message) return;

    const opts = typeof options === "number" ? { duration: options } : options;
    const kind = opts.kind || "info";
    const duration = opts.duration || 2600;

    clearTimeout(this._timer);
    clearTimeout(this._hideTimer);

    this._message.textContent = message;
    this._el.className = `toast toast--${kind} is-visible`;

    this._timer = setTimeout(() => this.hide(), duration);
  },

  hide() {
    if (!this._el) return;
    this._el.classList.remove("is-visible");
    // Keep the kind class during the fade, then fully reset.
    this._hideTimer = setTimeout(() => {
      if (this._el && !this._el.classList.contains("is-visible")) {
        this._el.className = "toast";
      }
    }, 220);
  },

  success(message, duration) {
    this.show(message, { kind: "success", duration });
  },

  error(message, duration) {
    this.show(message, { kind: "error", duration });
  },

  info(message, duration) {
    this.show(message, { kind: "info", duration });
  },
};
