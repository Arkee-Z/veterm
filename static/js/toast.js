/**
 * Toast notification system.
 * Used for right-click disabled message and other notices.
 */
const Toast = {
  _el: null,
  _timer: null,

  init() {
    this._el = document.getElementById("toast");
  },

  show(msg, duration) {
    if (!this._el) return;
    if (this._timer) clearTimeout(this._timer);
    this._el.textContent = msg;
    this._el.classList.remove("hidden");
    this._el.classList.add("show");
    this._timer = setTimeout(() => {
      this._el.classList.remove("show");
      this._timer = setTimeout(() => this._el.classList.add("hidden"), 300);
    }, duration || 2000);
  }
};