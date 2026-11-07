/**
 * Search palette — instant, local search over the content index.
 * Ctrl/Cmd+K or "/" opens it; ↑↓ navigate; Enter opens; Esc closes.
 */
const Search = {
  els: {},
  isOpen: false,
  results: [],
  active: 0,
  lastFocus: null,
  query: "",

  init() {
    this.els.overlay = document.getElementById("search-overlay");
    this.els.input = document.getElementById("search-input");
    this.els.results = document.getElementById("search-results");
    this.els.count = document.getElementById("search-count");
    this.els.close = document.getElementById("search-close");

    this.els.input.addEventListener("input", () => this.render());
    this.els.input.addEventListener("keydown", (event) => this.handleKeydown(event));
    this.els.close.addEventListener("click", () => this.close());
    this.els.overlay.addEventListener("mousedown", (event) => {
      if (event.target === this.els.overlay) this.close();
    });
    this.els.results.addEventListener("click", (event) => {
      if (event.target.closest(".search-result")) this.close();
    });
    document.addEventListener("keydown", (event) => this.handleGlobalKeydown(event), true);
  },

  isEditable(target) {
    if (!target || !(target instanceof Element)) return false;
    return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  },

  handleGlobalKeydown(event) {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;

    if (mod && !event.shiftKey && (key === "k" || key === "K")) {
      event.preventDefault();
      event.stopPropagation();
      if (this.isOpen) this.close();
      else this.open();
      return;
    }
    if (!this.isOpen && key === "/" && !mod && !event.altKey && !this.isEditable(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      this.open();
      return;
    }
    if (this.isOpen && key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  },

  async open(initialQuery = "") {
    if (App.editorOpen) {
      Toast.info("Close the editor to search.");
      return;
    }
    if (!App.index) await App.getIndex();
    if (!this.els.overlay) return;
    this.isOpen = true;
    this.lastFocus = document.activeElement;
    App.closeSidebar();
    this.els.overlay.classList.remove("hidden");
    document.body.classList.add("search-open");
    this.els.input.value = initialQuery;
    this.query = initialQuery;
    this.render();
    setTimeout(() => {
      this.els.input.focus();
      const end = this.els.input.value.length;
      this.els.input.setSelectionRange(end, end);
    }, 20);
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.els.overlay.classList.add("hidden");
    document.body.classList.remove("search-open");
    if (this.lastFocus && typeof this.lastFocus.focus === "function") {
      try { this.lastFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  },

  refresh() {
    if (this.isOpen) this.render();
  },

  handleKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.setActive(this.active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.setActive(this.active - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = this.results[this.active];
      if (result) this.choose(result);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    }
  },

  resultsFor(query) {
    const index = App.index;
    if (!index) return [];
    const needle = query.trim().toLowerCase();
    const results = [];

    if (!needle) {
      for (const post of index.posts.slice(0, 5)) {
        results.push({
          type: "post",
          title: post.title,
          meta: `${dateLong(post.date)} · ${post.readingTime} min`,
          excerpt: post.excerpt,
          tags: post.tags,
          route: `posts/${post.slug}`,
          href: `/posts/${encodeURIComponent(post.slug)}`,
        });
      }
      for (const project of index.projects.slice(0, 3)) {
        results.push({
          type: "project",
          title: project.title,
          meta: project.type,
          excerpt: project.description,
          tags: project.tags,
          route: `projects/${project.name}`,
          href: `/projects/${encodeURIComponent(project.name)}`,
        });
      }
      for (const tag of index.tags.slice(0, 4)) {
        results.push({
          type: "tag",
          title: `#${tag.name}`,
          meta: `${tag.count} notes`,
          excerpt: "",
          tags: [],
          route: `archive/${tag.name}`,
          href: `/archive/${encodeURIComponent(tag.name)}`,
        });
      }
      return results;
    }

    const score = (text, weight) => String(text || "").toLowerCase().includes(needle) ? weight : 0;
    for (const post of index.posts) {
      let points = score(post.title, 100) + score(post.tags.join(" "), 45) +
        score(post.excerpt, 20) + score(post.searchText, 8);
      if (post.title.toLowerCase().startsWith(needle)) points += 60;
      if (points <= 0) continue;
      results.push({
        type: "post",
        title: post.title,
        meta: `${dateLong(post.date)} · ${post.readingTime} min`,
        excerpt: post.excerpt,
        tags: post.tags,
        route: `posts/${post.slug}`,
        href: `/posts/${encodeURIComponent(post.slug)}`,
        points,
      });
    }
    for (const project of index.projects) {
      let points = score(project.title, 90) + score(project.tags.join(" "), 40) +
        score(project.description, 18);
      if (points <= 0) continue;
      results.push({
        type: "project",
        title: project.title,
        meta: project.type,
        excerpt: project.description,
        tags: project.tags,
        route: `projects/${project.name}`,
        href: `/projects/${encodeURIComponent(project.name)}`,
        points,
      });
    }
    for (const tag of index.tags) {
      let points = score(tag.name, 70);
      if (points <= 0) continue;
      results.push({
        type: "tag",
        title: `#${tag.name}`,
        meta: `${tag.count} notes`,
        excerpt: "",
        tags: [],
        route: `archive/${tag.name}`,
        href: `/archive/${encodeURIComponent(tag.name)}`,
        points,
      });
    }

    return results.sort((a, b) =>
      (b.points || 0) - (a.points || 0) || a.title.localeCompare(b.title)
    ).slice(0, 10);
  },

  render() {
    const query = this.els.input.value;
    this.query = query;
    this.results = this.resultsFor(query);
    this.active = 0;
    this.els.results.replaceChildren();

    if (!this.results.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.innerHTML = `<strong>No matches</strong><span>Try a title, a tag, or a broader word.</span>`;
      this.els.results.appendChild(empty);
      this.els.count.textContent = query ? `No results for “${query}”` : "Start typing";
      return;
    }

    this.results.forEach((result, index) => {
      const link = document.createElement("a");
      link.className = "search-result" + (index === this.active ? " is-active" : "");
      link.href = result.href;
      link.dataset.index = String(index);
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", index === this.active ? "true" : "false");
      link.innerHTML = `
        <span class="search-result-kind"><span class="search-result-kind-badge">${result.type}</span><span>${result.meta || ""}</span></span>
        <span class="search-result-title"></span>
        ${result.excerpt ? '<span class="search-result-excerpt"></span>' : ""}
        <span class="search-result-meta"></span>`;
      link.querySelector(".search-result-title").textContent = result.title;
      if (result.excerpt) link.querySelector(".search-result-excerpt").textContent = result.excerpt;
      const meta = link.querySelector(".search-result-meta");
      for (const tag of (result.tags || []).slice(0, 3)) {
        const chip = document.createElement("span");
        chip.className = "tag";
        chip.textContent = tag;
        meta.appendChild(chip);
      }
      link.addEventListener("mouseenter", () => this.setActive(index, false));
      this.els.results.appendChild(link);
    });
    this.els.count.textContent = `${this.results.length} ${this.results.length === 1 ? "result" : "results"}${query ? ` for “${query}”` : ""}`;
  },

  setActive(index, scroll = true) {
    if (!this.results.length) return;
    this.active = (index + this.results.length) % this.results.length;
    const links = [...this.els.results.querySelectorAll(".search-result")];
    links.forEach((link, i) => {
      link.classList.toggle("is-active", i === this.active);
      link.setAttribute("aria-selected", i === this.active ? "true" : "false");
    });
    if (scroll && links[this.active]) links[this.active].scrollIntoView({ block: "nearest" });
  },

  choose(result) {
    this.close();
    App.go(result.route);
  },
};
