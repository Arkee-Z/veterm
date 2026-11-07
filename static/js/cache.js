/**
 * Encrypted localStorage cache for rendered viewer content.
 * AES-GCM with a PBKDF2-derived key; values are stored as JSON.
 */
const Cache = (() => {
  const PREFIX = "vet:";
  const VERSION = 2;
  let keyPromise = null;

  function supported() {
    try {
      return typeof crypto !== "undefined" && !!crypto.subtle && !!localStorage;
    } catch {
      return false;
    }
  }

  async function getKey() {
    if (keyPromise) return keyPromise;
    keyPromise = (async () => {
      const encoder = new TextEncoder();
      const material = await crypto.subtle.importKey(
        "raw",
        encoder.encode("veterm-cache-v2"),
        "PBKDF2",
        false,
        ["deriveKey"],
      );
      return await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: encoder.encode(location.origin),
          iterations: 100000,
          hash: "SHA-256",
        },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();
    return keyPromise;
  }

  function bufToB64(buf) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function b64ToBuf(b64) {
    const binary = atob(b64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf;
  }

  return {
    /**
     * @returns {Promise<{html:string, type:string, title:string, updatedAt:string, savedAt:number}|null>}
     */
    async get(filePath) {
      if (!supported()) return null;
      try {
        const raw = localStorage.getItem(PREFIX + filePath);
        if (!raw) return null;

        const buf = b64ToBuf(raw);
        const iv = buf.slice(0, 12);
        const payload = buf.slice(12);
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          await getKey(),
          payload,
        );
        const text = new TextDecoder().decode(plain);

        let value;
        try {
          value = JSON.parse(text);
        } catch {
          // Legacy entries stored the HTML string directly.
          value = {
            html: text,
            type: "md",
            title: "",
            updatedAt: "",
            savedAt: 0,
          };
        }
        if (!value || typeof value.html !== "string") return null;
        return {
          html: value.html,
          type: value.type || "md",
          title: value.title || "",
          updatedAt: value.updatedAt || "",
          savedAt: value.savedAt || 0,
        };
      } catch {
        try {
          localStorage.removeItem(PREFIX + filePath);
        } catch { /* ignore */ }
        return null;
      }
    },

    async set(filePath, value) {
      if (!supported()) return false;
      try {
        const key = await getKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const payload = new TextEncoder().encode(JSON.stringify({
          v: VERSION,
          html: value.html,
          type: value.type || "md",
          title: value.title || "",
          updatedAt: value.updatedAt || "",
          savedAt: Date.now(),
        }));
        const encrypted = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          payload,
        );
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        localStorage.setItem(PREFIX + filePath, bufToB64(combined));
        return true;
      } catch {
        // Quota exceeded or private mode — caching is optional.
        try {
          localStorage.removeItem(PREFIX + filePath);
        } catch { /* ignore */ }
        return false;
      }
    },

    remove(filePath) {
      try {
        localStorage.removeItem(PREFIX + filePath);
      } catch { /* ignore */ }
    },

    clear() {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(PREFIX)) keys.push(key);
        }
        keys.forEach((key) => localStorage.removeItem(key));
      } catch { /* ignore */ }
    },
  };
})();
