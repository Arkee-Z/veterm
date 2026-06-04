/**
 * Encrypted localStorage cache for viewer content.
 * Uses AES-GCM with a PBKDF2-derived key.
 */
const Cache = {
  _key: null,

  async _getKey() {
    if (this._key) return this._key;
    // Derive a stable key from origin + fixed salt
    var enc = new TextEncoder();
    var material = await crypto.subtle.importKey("raw", enc.encode("veterm-cache-v1"), "PBKDF2", false, ["deriveKey"]);
    this._key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode(location.origin), iterations: 100000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    return this._key;
  },

  async get(filePath) {
    try {
      var raw = localStorage.getItem("vet:" + filePath);
      if (!raw) return null;
      var key = await this._getKey();
      var buf = this._b64ToBuf(raw);
      var iv = buf.slice(0, 12);
      var data = buf.slice(12);
      var decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      localStorage.removeItem("vet:" + filePath);
      return null;
    }
  },

  async set(filePath, html) {
    var key = await this._getKey();
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var enc = new TextEncoder();
    var encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(html));
    var combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    localStorage.setItem("vet:" + filePath, this._bufToB64(combined));
  },

  remove(filePath) {
    localStorage.removeItem("vet:" + filePath);
  },

  _bufToB64(buf) {
    var bin = "";
    for (var i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  },

  _b64ToBuf(b64) {
    var bin = atob(b64);
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }
};