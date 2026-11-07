/**
 * Veterm — application controller.
 * Owns routing, the editorial pages, article rendering, sidebar, and overlays.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ICONS = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
  rss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
};

function $id(id) { return document.getElementById(id); }
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function iconSpan(name, className) {
  const span = document.createElement("span");
  if (className) span.className = className;
  span.innerHTML = ICONS[name] || ICONS.file;
  return span;
}
function dateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: match[1], month: Number(match[2]), day: Number(match[3]) };
}
function dateLong(value) {
  const d = dateParts(value);
  return d ? `${MONTHS[d.month - 1]} ${String(d.day).padStart(2, "0")}, ${d.year}` : "Undated";
}
function dateShort(value) {
  const d = dateParts(value);
  return d ? `${d.year}.${String(d.month).padStart(2, "0")}.${String(d.day).padStart(2, "0")}` : "—";
}
function yearOf(value) {
  const d = dateParts(value);
  return d ? d.year : "Undated";
}
function tagHref(tag) {
  return `/archive/${encodeURIComponent(tag)}`;
}
function tagNode(tag, count) {
  const link = document.createElement("a");
  link.className = "tag";
  link.href = tagHref(tag);
  link.textContent = tag;
  if (count !== undefined) {
    const span = el("span", "tag-count", String(count));
    link.appendChild(span);
  }
  return link;
}
function ensureMeta(selector, attr, value) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    const nameMatch = selector.match(/\[name="([^"]+)"\]/);
    const propMatch = selector.match(/\[property="([^"]+)"\]/);
    if (nameMatch) node.setAttribute("name", nameMatch[1]);
    if (propMatch) node.setAttribute("property", propMatch[1]);
    document.head.appendChild(node);
  }
  node.setAttribute(attr, value);
}

const App = {
  els: {},
  session: { loggedIn: false, username: null, group: "visitor", adminConfigured: false },
  route: null,
  currentPage: null,
  currentProject: null,
  tree: null,
  treeFetchedAt: 0,
  treePromise: null,
  index: null,
  indexFetchedAt: 0,
  indexPromise: null,
  renderToken: 0,
  terminalOpen: false,
  editorOpen: false,
  sidebarOpen: false,
  lastFocus: null,
  archiveState: { tag: "", query: "" },
  _tocObserver: null,
  _scrollFrame: null,

  CACHE_TTL: 5 * 60 * 1000,
  TREE_TTL: 15 * 1000,
  INDEX_TTL: 30 * 1000,

  init() {
    this.els = {
      app: $id("app"),
      viewer: $id("viewer-panel"),
      content: $id("rendered-content"),
      breadcrumbs: $id("breadcrumbs"),
      projectView: $id("project-view"),
      projectFrame: $id("project-frame"),
      projectPath: $id("project-path"),
      statusDot: $id("status-dot"),
      statusText: $id("status-text"),
      statusPath: $id("status-path"),
      statusUser: $id("status-user"),
      statusHint: $id("status-hint"),
      sidebar: $id("sidebar"),
      sidebarBackdrop: $id("sidebar-backdrop"),
      sidebarUser: $id("sidebar-user"),
      sidebarTags: $id("sidebar-tags"),
      sidebarProjects: $id("sidebar-projects"),
      sidebarGenerated: $id("sidebar-generated"),
      terminalOverlay: $id("terminal-overlay"),
      terminalPanel: $id("terminal-panel"),
      editorOverlay: $id("editor-overlay"),
      backToTop: $id("back-to-top"),
      readingProgress: $id("reading-progress"),
    };

    let savedTheme = "dark";
    try { savedTheme = localStorage.getItem("veterm-theme") === "light" ? "light" : "dark"; } catch { /* ignore */ }
    this.applyTheme(savedTheme);


    Terminal.init();
    Editor.init();
    Toast.init();
    Search.init();

    document.addEventListener("click", (event) => this.handleClick(event));
    document.addEventListener("keydown", (event) => this.handleGlobalKeydown(event));
    window.addEventListener("popstate", () => this.scheduleRoute());
    window.addEventListener("hashchange", () => {
      if (location.hash.startsWith("#/")) this.scheduleRoute();
    });
    window.addEventListener("resize", () => {
      if (this.terminalOpen) Terminal.measure();
      if (window.innerWidth > 900 && this.sidebarOpen) this.closeSidebar();
    });
    window.addEventListener("beforeunload", (event) => {
      if (this.editorOpen && Editor.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    this.els.viewer.addEventListener("scroll", () => this.scheduleScrollUpdate(), { passive: true });

    this.updateUserUI();
    this.refreshSession();
    this.getTree().catch(() => {});
    this.getIndex().catch(() => {});
    this.handleRoute();
  },

  // ------------------------------------------------------------------ theme
  applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("veterm-theme", next); } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#f1ede5" : "#141311");
    document.querySelectorAll('[data-action="theme"]').forEach((btn) => {
      btn.setAttribute("aria-label", next === "light" ? "Switch to dark theme" : "Switch to light theme");
      btn.title = next === "light" ? "Switch to dark theme" : "Switch to light theme";
    });
  },

  getTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  },

  toggleTheme() {
    this.applyTheme(this.getTheme() === "dark" ? "light" : "dark");
  },

  // ------------------------------------------------------------------ routing
  parseRoute(input = location.pathname + location.search) {
    let raw = String(input || "");
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      try {
        const url = new URL(raw);
        raw = url.pathname + url.search;
      } catch { /* keep */ }
    }
    if (raw.startsWith("#")) raw = raw.slice(1);
    raw = raw.split("#")[0].split("?")[0];
    try { raw = decodeURIComponent(raw); } catch { /* keep */ }
    raw = raw.trim().replace(/^\/+/, "");
    const hadTrailingSlash = /\/+$/.test(raw);
    raw = raw.replace(/\/+$/, "");

    if (!raw || raw === "home" || raw === "index" || raw === "index.html") {
      return { kind: "home", canonical: "/" };
    }
    if (raw === "about" || raw === "about.md") {
      return { kind: "about", path: "about.md", canonical: "/about" };
    }
    if (raw === "archive" || raw === "posts" || raw === "blog") {
      return { kind: "archive", tag: "", canonical: "/archive" };
    }
    if (raw.startsWith("archive/")) {
      const tag = raw.slice("archive/".length).split("/").filter(Boolean);
      return {
        kind: "archive",
        tag: tag[0] || "",
        canonical: tag[0] ? `/archive/${encodeURIComponent(tag[0])}` : "/archive",
      };
    }
    if (raw.startsWith("tags/")) {
      const tag = raw.slice("tags/".length).split("/").filter(Boolean);
      return {
        kind: "archive",
        tag: tag[0] || "",
        canonical: tag[0] ? `/archive/${encodeURIComponent(tag[0])}` : "/archive",
      };
    }
    if (raw === "tags") return { kind: "tags", canonical: "/tags" };
    if (raw === "projects") return { kind: "projects", canonical: "/projects" };

    if (raw.startsWith("project:")) {
      const name = raw.slice("project:".length);
      return { kind: "project", name, canonical: `/projects/${encodeURIComponent(name)}` };
    }
    if (raw.startsWith("projects/")) {
      const parts = raw.slice("projects/".length).split("/").filter(Boolean);
      if (parts.length === 1) {
        return { kind: "project", name: parts[0], canonical: `/projects/${encodeURIComponent(parts[0])}` };
      }
      return { kind: "page", path: `projects/${parts.join("/")}`, canonical: `/${raw}` };
    }
    if (raw.startsWith("post/")) {
      const slug = raw.slice("post/".length).replace(/\.md$/i, "");
      return { kind: "post", slug, path: `posts/${slug}.md`, canonical: `/posts/${encodeURIComponent(slug)}` };
    }
    if (raw.startsWith("posts/")) {
      const rest = raw.slice("posts/".length).replace(/\.md$/i, "");
      if (!rest) return { kind: "archive", tag: "", canonical: "/archive" };
      return { kind: "post", slug: rest, path: `posts/${rest}.md`, canonical: `/posts/${encodeURIComponent(rest)}` };
    }
    if (raw.startsWith("p/")) {
      const slug = raw.slice(2);
      return { kind: "post", slug, path: `posts/${slug}.md`, canonical: `/posts/${encodeURIComponent(slug)}` };
    }

    if (hadTrailingSlash) {
      return { kind: "dir", path: raw, canonical: `/${raw}` };
    }
    if (!raw.includes(".")) {
      if (this.isDirectory(raw)) return { kind: "dir", path: raw, canonical: `/${raw}` };
      return { kind: "post", slug: raw, path: `posts/${raw}.md`, canonical: `/posts/${encodeURIComponent(raw)}` };
    }
    return { kind: "page", path: raw, canonical: `/${raw}` };
  },

  canonicalFor(route) {
    if (route.canonical) return route.canonical;
    if (route.kind === "home") return "/";
    if (route.kind === "about") return "/about";
    if (route.kind === "archive") return route.tag ? `/archive/${encodeURIComponent(route.tag)}` : "/archive";
    if (route.kind === "tags") return "/tags";
    if (route.kind === "projects") return "/projects";
    if (route.kind === "project") return `/projects/${encodeURIComponent(route.name)}`;
    if (route.kind === "post") return `/posts/${encodeURIComponent(route.slug || "")}`;
    if (route.kind === "dir") return `/${route.path}`;
    return `/${route.path || ""}`;
  },

  scheduleRoute() {
    clearTimeout(this._routeTimer);
    this._routeTimer = setTimeout(() => this.handleRoute(), 0);
  },

  async handleRoute() {
    clearTimeout(this._routeTimer);
    this.closeSidebar();
    if (typeof Search !== "undefined" && Search.isOpen) Search.close();
    // Old bookmarks used hash routes: /#/posts/foo -> /posts/foo.
    if (location.hash.startsWith("#/")) {
      history.replaceState(null, "", location.hash.slice(1) || "/");
    }
    let route = this.parseRoute();

    if (route.kind === "post" && !route.path) {
      const index = await this.getIndex();
      const post = index && index.posts.find((item) => item.slug === route.slug);
      if (post) route = { ...route, path: post.path, canonical: `/posts/${encodeURIComponent(post.slug)}` };
    }

    if (route.kind === "post") {
      const index = await this.getIndex();
      const post = index && index.posts.find((item) =>
        item.path === route.path || item.slug === route.slug
      );
      if (post) {
        route = { ...route, path: post.path, slug: post.slug, canonical: `/posts/${encodeURIComponent(post.slug)}` };
      } else if (!route.path) {
        route = { kind: "page", path: route.slug || "", canonical: `/${route.slug || ""}` };
      }
    }

    if (route.kind === "page" && route.path && !route.path.includes(".")) {
      await this.getTree();
      const resolved = this.parseRoute();
      if (resolved.kind === "dir") route = resolved;
    }

    this.route = route;
    this.updateBreadcrumb(route);
    this.setActiveNav(route);
    const canonical = this.canonicalFor(route);
    const currentPath = location.pathname + location.search;
    if (currentPath !== canonical) history.replaceState(null, "", canonical);

    if (route.kind === "home") await this.showHome();
    else if (route.kind === "archive") await this.showArchive(route.tag);
    else if (route.kind === "tags") await this.showTags();
    else if (route.kind === "projects") await this.showProjects();
    else if (route.kind === "about") await this.showAbout();
    else if (route.kind === "post") await this.showPost(route);
    else if (route.kind === "project") await this.showProject(route.name);
    else if (route.kind === "dir") await this.showDirectory(route);
    else await this.showPage(route.path, route);
  },

  async go(target, options = {}) {
    clearTimeout(this._routeTimer);
    const route = target && target.kind
      ? target
      : this.parseRoute(String(target || ""));
    const path = this.canonicalFor(route);
    const currentPath = location.pathname + location.search;
    if (currentPath !== path) {
      history[options.replace ? "replaceState" : "pushState"](null, "", path);
    }
    this.route = route;
    this.updateBreadcrumb(route);
    this.setActiveNav(route);
    await this.handleRoute();
  },

  // ------------------------------------------------------------------ data
  async getIndex(force = false) {
    const now = Date.now();
    if (!force && this.index && now - this.indexFetchedAt < this.INDEX_TTL) return this.index;
    if (this.indexPromise) return this.indexPromise;

    this.indexPromise = API.getPosts()
      .then((data) => {
        if (data.error) throw new Error(data.error);
        this.index = data;
        this.indexFetchedAt = Date.now();
        this.renderSidebar();
        if (typeof Search !== "undefined" && Search.isOpen) Search.refresh();
        return data;
      })
      .catch((error) => {
        if (!this.index) Toast.error(error.message || "Could not load the content index.");
        return this.index;
      })
      .finally(() => { this.indexPromise = null; });

    return this.indexPromise;
  },

  async getTree(force = false) {
    const now = Date.now();
    if (!force && this.tree && now - this.treeFetchedAt < this.TREE_TTL) return this.tree;
    if (this.treePromise) return this.treePromise;
    this.treePromise = API.getTree()
      .then((data) => {
        if (data.error) throw new Error(data.error);
        this.tree = data;
        this.treeFetchedAt = Date.now();
        if (this.editorOpen) Editor.setTree(data);
        return data;
      })
      .catch((error) => {
        if (!this.tree) Toast.error(error.message || "Could not load the content tree.");
        return this.tree;
      })
      .finally(() => { this.treePromise = null; });
    return this.treePromise;
  },

  async loadPostPage(post) {
    const cached = await Cache.get(post.path);
    if (cached && cached.html && Date.now() - cached.savedAt < this.CACHE_TTL) {
      return {
        path: post.path,
        html: cached.html,
        type: cached.type || "md",
        title: post.title,
        updatedAt: cached.updatedAt,
        date: post.date,
        tags: post.tags,
        excerpt: post.excerpt,
        readingTime: post.readingTime,
        meta: { title: post.title, description: post.excerpt, date: post.date, tags: post.tags },
        cached: true,
      };
    }
    const result = await API.renderFile(post.path);
    if (result.error) return { error: result.error, status: result.status };
    if (result.type === "html" || result.type === "link") return result;
    await Cache.set(post.path, {
      html: result.html || "",
      type: result.type || "md",
      title: result.title || post.title,
      updatedAt: result.updatedAt || "",
    });
    return result;
  },

  postFromPage(page, route) {
    const meta = page.meta || {};
    return {
      path: page.path,
      slug: page.slug || (page.path || "").split("/").pop()?.replace(/\.md$/i, "") || route.slug || "",
      title: meta.title || page.title || route.slug || "Untitled",
      date: meta.date || page.date || "",
      excerpt: meta.description || page.excerpt || "",
      tags: meta.tags || page.tags || [],
      readingTime: page.readingTime || 1,
      featured: !!meta.featured,
      updatedAt: page.updatedAt || "",
    };
  },

  // ------------------------------------------------------------------ home
  async showHome() {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", "home");
    const index = await this.getIndex();
    if (token !== this.renderToken) return;
    if (!index) return this.showError("Could not load the content index.", { status: 500, path: "home" });

    const page = el("section", "page home-page");
    const hero = el("header", "home-hero");
    const heroMain = el("div", "hero-main");

    const kicker = el("div", "hero-kicker", `issue ${String(index.stats.posts).padStart(2, "0")} · ${new Date().getFullYear()} · written from a terminal`);
    const title = el("h1", "hero-title");
    title.innerHTML = "Notes on systems,<br><em>interfaces</em>, and the web.";
    const lede = el("p", "hero-lede", "I’m Gene Max Zhang — a full-stack engineer building small, deliberate tools. This is a terminal-native notebook about software, typography, and the long way around the web.");
    const actions = el("div", "hero-actions");
    const archiveBtn = el("a", "button primary", "Read the archive");
    archiveBtn.href = "/archive";
    const terminalBtn = el("button", "button", "Open terminal");
    terminalBtn.type = "button";
    terminalBtn.dataset.action = "terminal";
    actions.append(archiveBtn, terminalBtn);
    const stats = el("div", "hero-stats");
    for (const [value, label] of [
      [index.stats.posts, "posts"],
      [index.stats.tags, "tags"],
      [index.stats.projects, "projects"],
      [index.stats.words.toLocaleString("en-US"), "words"],
    ]) {
      const stat = el("div", "hero-stat");
      stat.append(el("strong", "", String(value)), el("span", "", label));
      stats.appendChild(stat);
    }
    heroMain.append(kicker, title, lede, actions, stats);

    const heroAside = el("aside", "hero-aside");
    const monogram = el("div", "hero-monogram", "GMZ");
    const note = el("p", "hero-note", "“The terminal is the most honest interface between a developer and their machine. Everything else is decoration.”");
    const heroLinks = el("div", "hero-aside-links");
    for (const [label, href] of [
      ["RSS feed", "/rss.xml"],
      ["GitHub", "https://github.com/Arkee-Z"],
      ["About", "/about"],
    ]) {
      const link = el("a", "", label);
      link.href = href;
      if (href.startsWith("http")) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
      heroLinks.appendChild(link);
    }
    heroAside.append(monogram, note, heroLinks);
    hero.append(heroMain, heroAside);

    const layout = el("div", "home-layout");
    const main = el("div", "home-main");
    const aside = el("aside", "home-aside");

    const featured = index.posts.find((post) => post.featured) || index.posts[0];
    if (featured) main.appendChild(this.renderFeatured(featured));

    const latest = index.posts.filter((post) => !featured || post.path !== featured.path).slice(0, 5);
    if (latest.length) {
      const list = el("div", "post-list");
      for (const post of latest) list.appendChild(this.renderPostRow(post));
      main.appendChild(this.renderSectionHead("Latest writing", `${latest.length} notes`, "/archive", list));
    }

    const nowCard = el("div", "side-card");
    nowCard.appendChild(this.renderSideCardTitle("Now"));
    nowCard.appendChild(el("p", "", "Building a quieter web with Node.js, SQLite, and a command palette."));
    nowCard.appendChild(el("span", "now-dot", "Open to small collaborations"));
    aside.appendChild(nowCard);

    const quoteCard = el("div", "side-card");
    quoteCard.appendChild(this.renderSideCardTitle("Marginalia"));
    const quote = el("p", "side-quote", "A quiet interface is not an empty one. It is a place where the writing is the loudest thing in the room.");
    quote.appendChild(el("cite", "", "— design notes, 2026"));
    quoteCard.appendChild(quote);
    aside.appendChild(quoteCard);

    const colophonCard = el("div", "side-card");
    colophonCard.appendChild(this.renderSideCardTitle("Colophon"));
    colophonCard.appendChild(el("p", "", "Node.js, SQLite, and vanilla JavaScript. No framework, no tracker, no external font request. The page is the interface."));
    aside.appendChild(colophonCard);

    layout.append(main, aside);
    page.append(hero, layout);
    this.els.content.replaceChildren(page);
    this.currentPage = null;
    this.currentArticle = null;
    this.scrollToTop();
    this.setStatus("Ready", "ready", "home");
    this.updateDocumentMeta({
      title: "Veterm — Terminal Blog Engine",
      description: "Notes on systems, interfaces, and the web — a terminal-native notebook by Gene Max Zhang.",
      type: "website",
    });
    this.updateProgress(0);
  },

  renderFeatured(post) {
    const article = el("article", "featured");
    const top = el("div", "featured-top");
    top.append(el("span", "featured-label", "Featured note"), el("span", "featured-number", "01"));
    const link = el("a");
    link.href = `/posts/${encodeURIComponent(post.slug)}`;
    link.appendChild(el("h2", "featured-title", post.title));
    if (post.excerpt) link.appendChild(el("p", "featured-excerpt", post.excerpt));
    const meta = el("div", "featured-meta");
    meta.append(el("span", "", dateLong(post.date)), el("span", "", `${post.readingTime} min read`));
    link.appendChild(meta);
    article.append(top, link);
    const tags = el("div", "article-tags");
    for (const tag of (post.tags || []).slice(0, 3)) tags.appendChild(tagNode(tag));
    article.appendChild(tags);
    return article;
  },

  renderSectionHead(title, count, href, content) {
    const wrap = document.createDocumentFragment();
    const head = el("div", "section-head");
    const heading = el("div", "section-title", title);
    heading.appendChild(el("span", "section-count", count));
    const link = el("a", "section-link", "view all →");
    link.href = href || "/archive";
    head.append(heading, link);
    wrap.appendChild(head);
    wrap.appendChild(content);
    return wrap;
  },

  renderSideCardTitle(title, href) {
    const head = el("div", "side-card-title");
    head.appendChild(el("span", "", title));
    if (href) {
      const link = el("a", "", "all →");
      link.href = href;
      head.appendChild(link);
    }
    return head;
  },

  renderPostRow(post) {
    const row = el("article", "post-row");
    const date = el("div", "post-date");
    date.append(el("span", "", dateShort(post.date)), el("br"), el("span", "", `${post.readingTime} min`));
    const main = el("div", "post-main");
    const link = el("a", "post-link");
    link.href = `/posts/${encodeURIComponent(post.slug)}`;
    link.appendChild(el("h3", "post-title", post.title));
    if (post.excerpt) link.appendChild(el("p", "post-excerpt", post.excerpt));
    main.appendChild(link);
    const tags = el("div", "post-tags");
    for (const tag of post.tags.slice(0, 4)) tags.appendChild(tagNode(tag));
    main.appendChild(tags);
    row.append(date, main);
    return row;
  },

  // ------------------------------------------------------------------ archive
  async showArchive(tag = "") {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", "archive");
    const index = await this.getIndex();
    if (token !== this.renderToken) return;
    if (!index) return this.showError("Could not load the archive.", { status: 500, path: "archive" });

    this.archiveState = { tag: tag || "", query: "" };
    const page = el("section", "page archive-page");
    const head = el("header", "page-head");
    head.append(
      el("div", "page-kicker", "index · writing"),
      el("h1", "page-title", "Archive"),
      el("p", "page-lede", "Every note, grouped by year. Filter by tag or search the collection in place."),
    );
    const toolbar = el("div", "archive-toolbar");
    const field = el("label", "search-field");
    field.appendChild(iconSpan("search"));
    const input = document.createElement("input");
    input.type = "search";
    input.id = "archive-search";
    input.placeholder = "Filter this archive…";
    input.autocomplete = "off";
    input.value = this.archiveState.query;
    field.appendChild(input);
    toolbar.appendChild(field);

    const chips = el("div", "filter-chips");
    const allChip = el("button", "filter-chip" + (this.archiveState.tag ? "" : " is-active"), "all");
    allChip.type = "button";
    allChip.dataset.tag = "";
    chips.appendChild(allChip);
    for (const item of index.tags) {
      const chip = el("button", "filter-chip" + (item.name === this.archiveState.tag ? " is-active" : ""), `#${item.name}`);
      chip.type = "button";
      chip.dataset.tag = item.name;
      chips.appendChild(chip);
    }
    toolbar.appendChild(chips);
    head.appendChild(toolbar);
    const summary = el("div", "archive-summary");
    head.appendChild(summary);
    page.appendChild(head);

    const list = el("div");
    page.appendChild(list);
    this.els.content.replaceChildren(page);

    const renderList = () => {
      const query = input.value.trim().toLowerCase();
      this.archiveState.query = input.value;
      this.archiveState.tag = [...chips.querySelectorAll(".filter-chip.is-active")].map((chip) => chip.dataset.tag)[0] || "";
      this.renderArchiveList(list, summary, index, this.archiveState.tag, query);
    };
    input.addEventListener("input", renderList);
    chips.addEventListener("click", (event) => {
      const chip = event.target.closest(".filter-chip");
      if (!chip) return;
      chips.querySelectorAll(".filter-chip").forEach((item) => item.classList.remove("is-active"));
      chip.classList.add("is-active");
      this.archiveState.tag = chip.dataset.tag || "";
      const path = this.archiveState.tag ? `/archive/${encodeURIComponent(this.archiveState.tag)}` : "/archive";
      history.replaceState(null, "", path);
      this.route = { kind: "archive", tag: this.archiveState.tag, canonical: path };
      this.updateBreadcrumb(this.route);
      renderList();
    });
    renderList();

    this.scrollToTop();
    this.setStatus("Ready", "ready", "archive");
    this.currentPage = null;
    this.currentArticle = null;
    this.updateDocumentMeta({
      title: "Archive — Veterm",
      description: "Every note in the Veterm archive, grouped by year and tag.",
      type: "website",
    });
    this.updateProgress(0);
  },

  renderArchiveList(container, summary, index, tag, query) {
    const filtered = index.posts.filter((post) => {
      if (tag && !post.tags.includes(tag)) return false;
      if (!query) return true;
      return `${post.title} ${post.excerpt} ${post.tags.join(" ")} ${post.searchText}`.toLowerCase().includes(query);
    });
    container.replaceChildren();
    summary.textContent = `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}${tag ? ` · #${tag}` : ""}${query ? ` · “${query}”` : ""}`;
    if (filtered.length === 0) {
      const empty = el("div", "empty-state");
      empty.append(el("strong", "", "Nothing here."), el("span", "", "Try a different tag or search term."));
      container.appendChild(empty);
      return;
    }
    const groups = new Map();
    for (const post of filtered) {
      const year = yearOf(post.date);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(post);
    }
    for (const [year, posts] of groups) {
      const group = el("section", "archive-group");
      group.appendChild(el("div", "archive-year", year));
      const list = el("div", "archive-list");
      for (const post of posts) {
        const row = document.createElement("a");
        row.className = "archive-item";
        row.href = `/posts/${encodeURIComponent(post.slug)}`;
        row.appendChild(el("span", "archive-date", dateShort(post.date)));
        const main = el("span", "archive-main");
        main.appendChild(el("span", "archive-title", post.title));
        if (post.excerpt) main.appendChild(el("span", "archive-excerpt", post.excerpt));
        row.appendChild(main);
        const tags = el("span", "archive-tags");
        for (const item of post.tags.slice(0, 3)) {
          const chip = el("span", "tag", item);
          tags.appendChild(chip);
        }
        row.appendChild(tags);
        list.appendChild(row);
      }
      group.appendChild(list);
      container.appendChild(group);
    }
  },

  async showTags() {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", "tags");
    const index = await this.getIndex();
    if (token !== this.renderToken) return;
    if (!index) return this.showError("Could not load tags.", { status: 500, path: "tags" });

    const page = el("section", "page tags-page");
    const head = el("header", "page-head");
    head.append(
      el("div", "page-kicker", "index · subjects"),
      el("h1", "page-title", "Tags"),
      el("p", "page-lede", "A map of the notebook. Each tag is a thread through the archive."),
    );
    page.appendChild(head);
    const grid = el("div", "tag-grid");
    for (const tag of index.tags) {
      const card = document.createElement("a");
      card.className = "tag-card";
      card.href = tagHref(tag.name);
      card.appendChild(el("span", "tag-card-name", `#${tag.name}`));
      card.appendChild(el("span", "tag-card-count", `${tag.count} ${tag.count === 1 ? "note" : "notes"}`));
      grid.appendChild(card);
    }
    if (index.tags.length === 0) grid.appendChild(el("div", "empty-state", "No tags yet."));
    page.appendChild(grid);
    this.els.content.replaceChildren(page);
    this.setStatus("Ready", "ready", "tags");
    this.currentPage = null;
    this.currentArticle = null;
    this.scrollToTop();
    this.updateDocumentMeta({
      title: "Tags — Veterm",
      description: "Browse Veterm notes by subject and tag.",
      type: "website",
    });
    this.updateProgress(0);
  },

  async showProjects() {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", "projects");
    const index = await this.getIndex();
    if (token !== this.renderToken) return;
    if (!index) return this.showError("Could not load projects.", { status: 500, path: "projects" });

    const page = el("section", "page projects-page");
    const head = el("header", "page-head");
    head.append(
      el("div", "page-kicker", "index · mounted"),
      el("h1", "page-title", "Projects"),
      el("p", "page-lede", "Small experiments, external references, and interactive sandboxes mounted inside the engine."),
    );
    page.appendChild(head);
    const grid = el("div", "project-grid");
    index.projects.forEach((project, i) => {
      const card = document.createElement("a");
      card.className = "project-card";
      card.href = `/projects/${encodeURIComponent(project.name)}`;
      card.appendChild(el("div", "project-card-index", `PROJECT ${String(i + 1).padStart(2, "0")}`));
      card.appendChild(el("h2", "project-card-title", project.title));
      if (project.description) card.appendChild(el("p", "project-card-desc", project.description));
      const foot = el("div", "project-card-foot");
      for (const tag of project.tags.slice(0, 4)) foot.appendChild(el("span", "tag", tag));
      foot.appendChild(el("span", "project-card-type", project.type || "project"));
      card.appendChild(foot);
      grid.appendChild(card);
    });
    if (index.projects.length === 0) grid.appendChild(el("div", "empty-state", "No projects mounted yet."));
    page.appendChild(grid);
    this.els.content.replaceChildren(page);
    this.setStatus("Ready", "ready", "projects");
    this.currentPage = null;
    this.currentArticle = null;
    this.scrollToTop();
    this.updateDocumentMeta({
      title: "Projects — Veterm",
      description: "Interactive projects and experiments mounted in Veterm.",
      type: "website",
    });
    this.updateProgress(0);
  },

  // ------------------------------------------------------------------ article
  async showPost(route) {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", route.path || route.slug);
    this.renderLoading(`~/${route.path || route.slug}`);

    const index = await this.getIndex();
    if (token !== this.renderToken) return;
    const post = index && index.posts.find((item) =>
      item.path === route.path || item.slug === route.slug
    );
    if (!post) {
      const fallback = await API.renderFile(route.path || route.slug);
      if (token !== this.renderToken) return;
      if (fallback.error) return this.showError(fallback.error, { status: fallback.status, path: route.path });
      return this.renderArticle(fallback, this.postFromPage(fallback, route), route, { related: false, nav: false });
    }

    if (route.canonical !== `/posts/${encodeURIComponent(post.slug)}`) {
      this.route = { ...route, path: post.path, slug: post.slug, canonical: `/posts/${encodeURIComponent(post.slug)}` };
      history.replaceState(null, "", this.route.canonical);
      this.updateBreadcrumb(this.route);
    }
    const page = await this.loadPostPage(post);
    if (token !== this.renderToken) return;
    if (page.error) return this.showError(page.error, { status: page.status, path: post.path });
    this.renderArticle(page, post, this.route, { related: true, nav: true });
  },

  async showAbout() {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", "about");
    this.renderLoading("~/about.md");
    const page = await API.renderFile("about.md");
    if (token !== this.renderToken) return;
    if (page.error) return this.showError(page.error, { status: page.status, path: "about.md" });
    const meta = page.meta || {};
    const tags = meta.tags || [];
    const pageEl = el("section", "page about-page");
    const layout = el("div", "about-layout");
    const sheet = el("article", "about-sheet");
    const header = el("header", "article-header");
    header.append(
      el("div", "article-kicker", "about · colophon"),
      el("h1", "article-title", meta.title || page.title || "About"),
    );
    if (meta.description) header.appendChild(el("p", "article-deck", meta.description));
    const metaRow = el("div", "article-meta");
    if (meta.location) metaRow.appendChild(el("span", "", meta.location));
    metaRow.appendChild(el("span", "", "UTC+8"));
    header.appendChild(metaRow);
    if (tags.length) {
      const tagRow = el("div", "article-tags");
      for (const tag of tags) tagRow.appendChild(tagNode(tag));
      header.appendChild(tagRow);
    }
    const prose = el("div", "prose");
    prose.innerHTML = page.html || "";
    this.enhanceProse(prose);
    sheet.append(header, prose);
    layout.appendChild(sheet);

    const aside = el("aside", "about-aside");
    const contact = el("div", "about-card");
    contact.appendChild(el("h3", "", "Elsewhere"));
    const list = el("div", "contact-list");
    if (meta.location) {
      const row = el("span");
      row.innerHTML = ICONS.pin;
      row.appendChild(el("span", "", meta.location));
      list.appendChild(row);
    }
    if (meta.email) {
      const row = document.createElement("a");
      row.href = `mailto:${meta.email}`;
      row.innerHTML = ICONS.mail;
      row.appendChild(el("span", "", meta.email));
      list.appendChild(row);
    }
    if (meta.github) {
      const row = document.createElement("a");
      row.href = meta.github;
      row.target = "_blank";
      row.rel = "noopener noreferrer";
      row.innerHTML = ICONS.github;
      row.appendChild(el("span", "", meta.github.replace(/^https?:\/\//, "")));
      list.appendChild(row);
    }
    contact.appendChild(list);
    aside.appendChild(contact);

    const colophon = el("div", "about-card");
    colophon.appendChild(el("h3", "", "Colophon"));
    colophon.appendChild(el("p", "", "Veterm is built with Node.js, SQLite, and vanilla JavaScript. No framework, no tracker, no external font request. Typography uses the reader's own serif face; labels and code use a local monospace stack."));
    aside.appendChild(colophon);

    const availability = el("div", "about-card");
    availability.appendChild(el("h3", "", "Availability"));
    availability.appendChild(el("p", "now-dot", "Open to small collaborations"));
    aside.appendChild(availability);

    layout.appendChild(aside);
    pageEl.appendChild(layout);
    this.els.content.replaceChildren(pageEl);
    this.currentPage = page;
    this.currentArticle = null;
    this.scrollToTop();
    this.setStatus("Ready", "ready", "about.md");
    this.updateDocumentMeta({
      title: `${meta.title || "About"} — Veterm`,
      description: meta.description || "About Gene Max Zhang and the Veterm notebook.",
      type: "profile",
    });
    this.updateProgress(0);
  },

  renderArticle(page, post, route, options = {}) {
    const pageEl = el("section", "page article-page");
    const layout = el("div", "article-layout");
    const main = el("div", "article-main");
    const sheet = el("article", "article-sheet");
    const header = el("header", "article-header");
    const kicker = el("div", "article-kicker", `${route.kind === "project" ? "project" : "note"} · ${yearOf(post.date)}`);
    const title = el("h1", "article-title", post.title || page.title || "Untitled");
    const deck = post.excerpt ? el("p", "article-deck", post.excerpt) : null;
    const meta = el("div", "article-meta");
    const dateLabel = route.kind === "project" ? "Updated " : "";
    meta.append(
      el("span", "", `${dateLabel}${dateLong(post.date)}`),
      el("span", "", `${post.readingTime || 1} min read`),
      el("span", "", `${(post.tags || []).length} tags`),
    );
    const tags = el("div", "article-tags");
    for (const tag of post.tags || []) tags.appendChild(tagNode(tag));
    header.append(kicker, title);
    if (deck) header.appendChild(deck);
    header.append(meta, tags);

    const prose = el("div", "prose");
    prose.innerHTML = page.html || "";
    const firstParagraph = prose.querySelector("p");
    if (firstParagraph && firstParagraph.textContent.trim().length > 120) firstParagraph.classList.add("dropcap");
    this.enhanceProse(prose);

    const foot = el("footer", "article-foot");
    foot.append(el("span", "end-mark", "— END —"));
    for (const tag of post.tags || []) foot.appendChild(tagNode(tag));
    sheet.append(header, prose, foot);

    const aside = el("aside", "article-aside");
    const headings = [...prose.querySelectorAll("h2, h3")].filter((heading) => heading.id);
    if (headings.length) {
      const toc = el("nav", "toc");
      toc.setAttribute("aria-label", "Table of contents");
      toc.appendChild(el("div", "toc-title", "On this page"));
      const list = el("div", "toc-list");
      for (const heading of headings) {
        const link = document.createElement("button");
        link.type = "button";
        link.className = `toc-link depth-${heading.tagName === "H3" ? 3 : 2}`;
        link.dataset.target = heading.id;
        link.textContent = heading.textContent;
        link.addEventListener("click", () => {
          const target = document.getElementById(heading.id);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        list.appendChild(link);
      }
      toc.appendChild(list);
      aside.appendChild(toc);

      const mobile = el("details", "toc-mobile");
      mobile.appendChild(el("summary", "", "Contents"));
      const mobileList = el("div", "toc-list");
      for (const heading of headings) {
        const link = document.createElement("a");
        link.href = `#${heading.id}`;
        link.className = `toc-link depth-${heading.tagName === "H3" ? 3 : 2}`;
        link.textContent = heading.textContent;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        mobileList.appendChild(link);
      }
      mobile.appendChild(mobileList);
      sheet.insertBefore(mobile, prose);
    }

    const info = el("div", "article-aside-card");
    info.appendChild(el("strong", "", "Filed under"));
    const infoTags = el("div", "tag-cloud");
    for (const tag of post.tags || []) infoTags.appendChild(tagNode(tag));
    info.appendChild(infoTags);
    const infoMeta = el("div", "article-aside-card");
    infoMeta.append(
      el("strong", "", "Details"),
      el("span", "", `${route.kind === "project" ? "Updated" : "Published"} ${dateLong(post.date)}`),
      document.createElement("br"),
      el("span", "", `Approx. ${post.readingTime || 1} minute read`),
    );
    aside.append(info, infoMeta);
    layout.append(main, aside);
    main.appendChild(sheet);
    pageEl.appendChild(layout);

    if (options.nav !== false) {
      const nav = this.renderPostNav(post);
      if (nav) pageEl.appendChild(nav);
    }
    if (options.related !== false) {
      const related = this.renderRelated(post);
      if (related) pageEl.appendChild(related);
    }

    this.els.content.replaceChildren(pageEl);
    this.currentPage = page;
    this.currentArticle = { page, post, route };
    if (route.kind === "post") {
      this.route = { ...route, title: post.title, path: post.path };
      this.updateBreadcrumb(this.route);
    }
    this.scrollToTop();
    this.setStatus("Ready", "ready", post.path);
    this.updateDocumentMeta({
      title: `${post.title} — Veterm`,
      description: post.excerpt || `${post.title} — a note in the Veterm notebook.`,
      type: "article",
      published: post.date,
      tags: post.tags,
    });
    this.setupToc(headings);
    this.updateProgress(0);
  },

  renderPostNav(post) {
    if (!this.index || !this.index.posts.length) return null;
    const posts = this.index.posts;
    const index = posts.findIndex((item) => item.path === post.path);
    if (index === -1) return null;
    const newer = index > 0 ? posts[index - 1] : null;
    const older = index < posts.length - 1 ? posts[index + 1] : null;
    if (!newer && !older) return null;
    const nav = el("nav", "post-nav");
    nav.setAttribute("aria-label", "Previous and next posts");
    for (const [item, label, className] of [
      [older, "Previous", ""],
      [newer, "Next", "next"],
    ]) {
      if (!item) continue;
      const link = document.createElement("a");
      link.className = `post-nav-link ${className}`.trim();
      link.href = `/posts/${encodeURIComponent(item.slug)}`;
      link.append(
        el("span", "post-nav-label", label),
        el("span", "post-nav-title", item.title),
      );
      nav.appendChild(link);
    }
    return nav;
  },

  renderRelated(post) {
    if (!this.index || this.index.posts.length < 2) return null;
    const tags = new Set(post.tags || []);
    const scored = this.index.posts
      .filter((item) => item.path !== post.path)
      .map((item) => ({
        item,
        score: item.tags.reduce((sum, tag) => sum + (tags.has(tag) ? 1 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score || (b.item.date || "").localeCompare(a.item.date || ""))
      .slice(0, 2);
    if (scored.length === 0) return null;
    const section = el("section", "related");
    const head = el("div", "section-head");
    head.append(el("div", "section-title", "Related notes"), el("span", "section-count", "from the archive"));
    section.appendChild(head);
    const grid = el("div", "related-grid");
    for (const { item } of scored) {
      const link = document.createElement("a");
      link.className = "related-card";
      link.href = `/posts/${encodeURIComponent(item.slug)}`;
      link.append(
        el("span", "related-date", dateLong(item.date)),
        el("span", "related-title", item.title),
        el("span", "related-excerpt", item.excerpt),
      );
      grid.appendChild(link);
    }
    section.appendChild(grid);
    return section;
  },

  enhanceProse(prose) {
    prose.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      const langClass = [...(code?.classList || [])].find((name) => name.startsWith("language-"));
      const lang = langClass ? langClass.slice("language-".length) : "";
      if (lang) pre.dataset.lang = lang;
      const button = el("button", "code-copy", "copy");
      button.type = "button";
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const text = code ? code.textContent : pre.textContent;
        await this.copyText(text, "Code copied");
        button.textContent = "copied";
        setTimeout(() => { button.textContent = "copy"; }, 1200);
      });
      pre.appendChild(button);
    });
    prose.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      if (!img.alt) img.alt = "";
    });
    prose.querySelectorAll('a[href^="http"]').forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  },

  setupToc(headings) {
    if (this._tocObserver) this._tocObserver.disconnect();
    if (!headings.length) return;
    const links = [...this.els.content.querySelectorAll(".article-aside .toc-link")];
    if (!links.length) return;
    this._tocObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        links.forEach((link) => link.classList.toggle("is-active", link.dataset.target === id));
      }
    }, { root: this.els.viewer, rootMargin: "-90px 0px -68% 0px", threshold: 0 });
    for (const heading of headings) this._tocObserver.observe(heading);
  },

  // ------------------------------------------------------------------ project
  async showProject(name) {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", `projects/${name}`);
    this.renderLoading(`~/projects/${name}`);
    const [index, result] = await Promise.all([this.getIndex(), API.getProject(name)]);
    if (token !== this.renderToken) return;
    if (result.error) return this.showError(result.error, { status: result.status || 404, path: `projects/${name}` });
    const project = index?.projects.find((item) => item.name === name) || {
      name, title: result.title || name, description: "", tags: [], type: result.type, url: result.link || "",
    };
    const isHtmlProject = result.type === "html" ||
      String(result.filePath || "").toLowerCase().endsWith(".html");
    const page = {
      ...result,
      path: `projects/${name}`,
      filePath: result.filePath || "",
      html: isHtmlProject ? (result.content ?? result.html) : result.html,
      meta: {
        title: project.title,
        description: project.description,
        tags: project.tags,
      },
    };
    this.currentProject = { name, page, route: { kind: "project", name }, project };
    if (result.type === "link") {
      this.renderProjectLink(page, project);
    } else if (isHtmlProject) {
      this.showProjectHtml(page, name, { kind: "project", name });
    } else {
      this.renderArticle(page, {
        path: page.filePath || `projects/${name}`,
        slug: name,
        title: project.title,
        date: (project.updatedAt || "").slice(0, 10),
        excerpt: project.description,
        tags: project.tags,
        readingTime: result.readingTime || 1,
      }, { kind: "project", name }, { related: false, nav: false });
    }
    this.updateBreadcrumb({ kind: "project", name });
    this.setStatus("Ready", "ready", `projects/${name}`);
    this.updateDocumentMeta({
      title: `${project.title} — Veterm`,
      description: project.description || `Project ${name} in Veterm.`,
      type: "article",
    });
    this.updateProgress(0);
  },

  renderProjectLink(page, project) {
    const pageEl = el("section", "page");
    const sheet = el("article", "article-sheet");
    const header = el("header", "article-header");
    header.append(
      el("div", "article-kicker", "project · external"),
      el("h1", "article-title", project.title),
    );
    if (project.description) header.appendChild(el("p", "article-deck", project.description));
    const tags = el("div", "article-tags");
    for (const tag of project.tags || []) tags.appendChild(tagNode(tag));
    header.appendChild(tags);
    const box = el("div", "link-box", page.link || project.url || "");
    const actions = el("div", "state-actions");
    const open = document.createElement("a");
    open.className = "button primary";
    open.href = page.link || project.url || "#";
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.innerHTML = `Open link ${ICONS.external}`;
    const copy = el("button", "button", "Copy URL");
    copy.type = "button";
    copy.addEventListener("click", () => this.copyText(page.link || project.url || ""));
    const back = document.createElement("a");
    back.className = "button is-quiet";
    back.href = "/projects";
    back.textContent = "All projects";
    actions.append(open, copy, back);
    sheet.append(header, box, actions);
    pageEl.appendChild(sheet);
    this.els.content.replaceChildren(pageEl);
    this.currentPage = null;
    this.currentArticle = null;
    this.scrollToTop();
    this.updateProgress(0);
    this.setStatus("Ready", "ready", `projects/${project.name}`);
  },

  showProjectHtml(page, name, route) {
    const iframe = this.els.projectFrame;
    this.els.viewer.classList.add("project-mode");
    this.els.content.classList.add("hidden");
    this.els.projectView.classList.remove("hidden");
    const file = (page.filePath || "index.html").split("/").pop();
    this.els.projectPath.textContent = page.path && page.path.endsWith(".html")
      ? `~/${page.path}`
      : `~/projects/${name} · ${file}`;
    iframe.title = `${this.currentProject?.project?.title || name} — project preview`;
    iframe.srcdoc = page.html || page.content || "<!doctype html><title>Empty project</title>";
    this.currentProject = { ...(this.currentProject || {}), name, page, route: route || { kind: "project", name } };
    this.currentArticle = null;
    this.updateProgress(0);
    this.setStatus("Ready", "ready", `projects/${name}`);
  },

  setProjectMode(enabled) {
    if (enabled) {
      this.els.viewer.classList.add("project-mode");
      this.els.content.classList.add("hidden");
      this.els.projectView.classList.remove("hidden");
    } else {
      this.els.viewer.classList.remove("project-mode");
      this.els.content.classList.remove("hidden");
      this.els.projectView.classList.add("hidden");
    }
  },

  async reloadProject() {
    if (!this.currentProject) return;
    Toast.info("Reloading project…", 1200);
    const { name, page, route } = this.currentProject;
    if (route && route.kind === "page") await this.showPage(page.filePath || page.path, route);
    else await this.showProject(name);
  },

  openProjectInNewTab() {
    if (!this.currentProject) return;
    const { name, page, route } = this.currentProject;
    const path = route && route.kind === "page"
      ? `/${page.filePath || page.path}`
      : `/projects/${encodeURIComponent(name)}`;
    window.open(`${location.origin}${path}`, "_blank", "noopener");
  },

  // ------------------------------------------------------------------ generic / directory
  async showPage(path, route) {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", path);
    this.renderLoading(path);
    const result = await API.renderFile(path);
    if (token !== this.renderToken) return;
    if (result.error) return this.showError(result.error, { status: result.status, path });
    if (result.type === "html") {
      return this.showProjectHtml(result, path.split("/").slice(-2, -1)[0] || "project", route);
    }
    if (result.type === "link") {
      this.renderProjectLink(result, {
        name: path, title: result.title || path, description: result.excerpt || "",
        tags: result.tags || [], type: "link", url: result.link,
      });
      return;
    }
    this.renderArticle(result, this.postFromPage(result, route || { kind: "page", path }), route || { kind: "page", path }, { related: false, nav: false });
  },

  async showDirectory(route) {
    const token = ++this.renderToken;
    this.setProjectMode(false);
    this.setStatus("Loading…", "loading", route.path);
    const tree = await this.getTree();
    if (token !== this.renderToken) return;
    if (!tree) return this.showError("Could not load the content tree.", { status: 500, path: route.path });
    const dir = route.path;
    const children = (tree.entries || []).filter((entry) => this.parentOf(entry.path) === dir);
    const page = el("section", "page");
    const head = el("header", "page-head");
    head.append(
      el("div", "page-kicker", "directory"),
      el("h1", "page-title", `~/${dir}/`),
      el("p", "page-lede", `${children.length} entries in this directory.`),
    );
    page.appendChild(head);
    const list = el("div", "archive-list");
    for (const entry of children) {
      const link = document.createElement("a");
      link.className = "archive-item";
      link.href = `/${entry.path}`;
      link.append(
        el("span", "archive-date", entry.isDirectory ? "DIR" : (entry.type || "file").toUpperCase()),
        el("span", "archive-title", entry.name + (entry.isDirectory ? "/" : "")),
        el("span", "archive-tags"),
      );
      list.appendChild(link);
    }
    if (!children.length) list.appendChild(el("div", "empty-state", "(empty directory)"));
    page.appendChild(list);
    this.els.content.replaceChildren(page);
    this.setStatus("Ready", "ready", dir + "/");
    this.currentPage = null;
    this.updateDocumentMeta({ title: `${dir} — Veterm`, description: `Directory ${dir}`, type: "website" });
    this.scrollToTop();
    this.updateProgress(0);
  },

  parentOf(path) {
    const index = path.lastIndexOf("/");
    return index === -1 ? "" : path.slice(0, index);
  },

  // ------------------------------------------------------------------ sidebar
  renderSidebar() {
    const index = this.index;
    if (this.els.sidebarTags) {
      this.els.sidebarTags.replaceChildren();
      const tags = (index?.tags || []).slice(0, 9);
      if (tags.length) {
        for (const tag of tags) this.els.sidebarTags.appendChild(tagNode(tag.name, tag.count));
      } else {
        this.els.sidebarTags.appendChild(el("span", "muted", "No tags yet."));
      }
    }
    if (this.els.sidebarProjects) {
      this.els.sidebarProjects.replaceChildren();
      const projects = index?.projects || [];
      if (!projects.length) this.els.sidebarProjects.appendChild(el("span", "muted", "No projects mounted."));
      for (const project of projects.slice(0, 4)) {
        const link = el("a", "mini-project");
        link.href = `/projects/${encodeURIComponent(project.name)}`;
        link.append(
          el("span", "mini-mark", project.type === "link" ? "↗" : "▦"),
          el("span", "mini-name", project.title),
          el("span", "mini-type", project.type || "proj"),
        );
        this.els.sidebarProjects.appendChild(link);
      }
    }
    if (this.els.sidebarGenerated) {
      this.els.sidebarGenerated.textContent = index?.stats?.latestDate
        ? `latest ${dateShort(index.stats.latestDate)}`
        : "awaiting index";
    }
  },

  setActiveNav(route) {
    let active = "";
    if (route.kind === "home") active = "home";
    else if (route.kind === "archive" || route.kind === "post") active = "archive";
    else if (route.kind === "tags") active = "tags";
    else if (route.kind === "projects" || route.kind === "project") active = "projects";
    else if (route.kind === "about") active = "about";
    document.querySelectorAll(".site-nav a[data-nav]").forEach((link) => {
      const isActive = link.dataset.nav === active;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  },

  toggleSidebar(force) {
    const open = force === undefined ? !this.sidebarOpen : force;
    if (window.innerWidth > 900 && open) return;
    this.sidebarOpen = open;
    document.body.classList.toggle("sidebar-open", open);
    this.els.sidebarBackdrop.classList.toggle("hidden", !open);
    const menu = document.querySelector('[data-action="sidebar"]');
    if (menu) menu.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      const first = this.els.sidebar.querySelector(".site-nav a");
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 40);
    }
  },

  closeSidebar() {
    if (!this.sidebarOpen) return;
    this.sidebarOpen = false;
    document.body.classList.remove("sidebar-open");
    this.els.sidebarBackdrop.classList.add("hidden");
    const menu = document.querySelector('[data-action="sidebar"]');
    if (menu) menu.setAttribute("aria-expanded", "false");
  },

  // ------------------------------------------------------------------ chrome
  updateBreadcrumb(route) {
    const nav = this.els.breadcrumbs;
    if (!nav) return;
    nav.replaceChildren();
    const addLink = (label, href) => {
      const link = el("a", "", label);
      link.href = href;
      nav.appendChild(link);
    };
    const sep = () => nav.appendChild(el("span", "breadcrumb-sep", "/"));
    const current = (label) => {
      const node = el("span", "breadcrumb-current", label);
      node.setAttribute("aria-current", "page");
      nav.appendChild(node);
    };
    addLink("~", "/");
    if (route.kind === "home") return;
    sep();
    if (route.kind === "archive") {
      addLink("archive", "/archive");
      if (route.tag) { sep(); current(`#${route.tag}`); } else current("all");
    } else if (route.kind === "tags") current("tags");
    else if (route.kind === "projects") current("projects");
    else if (route.kind === "about") current("about");
    else if (route.kind === "project") {
      addLink("projects", "/projects");
      sep();
      current(route.name);
    } else if (route.kind === "post") {
      addLink("archive", "/archive");
      sep();
      current(route.title || this.currentPage?.title || route.slug || "note");
    } else if (route.kind === "dir") current(route.path + "/");
    else {
      addLink("archive", "/archive");
      sep();
      current(route.path || "");
    }
  },

  updateDocumentMeta(options) {
    this._lastMeta = options;
    const { title, description, type = "website", published = "", tags = [] } = options;
    document.title = title;
    const canonicalUrl = `${location.origin}${location.pathname}`;
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
    ensureMeta('meta[property="og:url"]', "content", canonicalUrl);
    if (description) {
      ensureMeta('meta[name="description"]', "content", description);
      ensureMeta('meta[property="og:description"]', "content", description);
    }
    ensureMeta('meta[property="og:title"]', "content", title);
    ensureMeta('meta[property="og:type"]', "content", type);
    document.querySelectorAll('meta[property="article:tag"]').forEach((node) => node.remove());
    const publishedMeta = document.head.querySelector('meta[property="article:published_time"]');
    if (published && type === "article") {
      ensureMeta('meta[property="article:published_time"]', "content", published);
    } else if (publishedMeta) {
      publishedMeta.remove();
    }
    if (type === "article") {
      for (const tag of tags) {
        const meta = document.createElement("meta");
        meta.setAttribute("property", "article:tag");
        meta.setAttribute("content", tag);
        document.head.appendChild(meta);
      }
    }
  },

  restoreDocumentMeta() {
    if (this._lastMeta) this.updateDocumentMeta(this._lastMeta);
    else this.updateDocumentMeta({ title: "Veterm — Terminal Blog Engine", description: "A terminal-native notebook.", type: "website" });
  },

  updateUserUI() {
    const name = this.session.loggedIn ? this.session.username : "visitor";
    this.els.statusUser.textContent = name;
    this.els.statusUser.classList.toggle("is-admin", this.session.group === "admin");
    if (this.els.sidebarUser) {
      this.els.sidebarUser.textContent = name;
      this.els.sidebarUser.classList.toggle("is-admin", this.session.group === "admin");
    }
    this.els.statusHint.textContent = this.session.group === "admin"
      ? "ctrl shift e editor"
      : "ctrl shift p terminal";
    document.querySelectorAll(".js-editor-btn").forEach((btn) => {
      btn.title = this.session.group === "admin" ? "Admin editor (Ctrl+Shift+E)" : "Admin editor — sign in through the terminal";
      btn.classList.toggle("is-locked", this.session.group !== "admin");
    });
    Terminal.updateUser(this.session);
    Editor.updateSession(this.session);
  },

  async refreshSession() {
    const previous = { ...this.session };
    const next = await API.getSession();
    if (next.error) return this.session;
    this.session = {
      loggedIn: !!next.loggedIn,
      username: next.username || null,
      group: next.group || "visitor",
      adminConfigured: !!next.adminConfigured,
    };
    const changed = previous.loggedIn !== this.session.loggedIn ||
      previous.username !== this.session.username ||
      previous.group !== this.session.group;
    this.updateUserUI();
    if (changed) {
      Cache.clear();
      this.getTree(true);
      this.getIndex(true);
      if (this.editorOpen && !this.session.loggedIn) this.closeEditor();
    }
    return this.session;
  },

  async handleAuthChange() {
    await this.refreshSession();
    Toast.success(this.session.loggedIn ? `Signed in as ${this.session.username}` : "Signed out");
  },

  setStatus(text, kind = "ready", path = "") {
    if (!this.els.statusText) return;
    this.els.statusText.textContent = text;
    this.els.statusPath.textContent = path;
    this.els.statusDot.classList.remove("is-loading", "is-error");
    if (kind === "loading") this.els.statusDot.classList.add("is-loading");
    if (kind === "error") this.els.statusDot.classList.add("is-error");
  },

  // ------------------------------------------------------------------ progress
  scheduleScrollUpdate() {
    if (this._scrollFrame) return;
    this._scrollFrame = requestAnimationFrame(() => {
      this._scrollFrame = null;
      this.updateScrollUi();
    });
  },

  updateScrollUi() {
    const scrollTop = this.els.viewer.scrollTop;
    const article = this.els.content.querySelector(".article-sheet");
    let progress = 0;
    if (article) {
      const articleTop = article.offsetTop - 80;
      const articleHeight = article.offsetHeight - this.els.viewer.clientHeight * 0.5;
      progress = articleHeight > 0 ? (scrollTop - articleTop) / articleHeight : 0;
    }
    this.updateProgress(progress);
    if (this.els.backToTop) this.els.backToTop.classList.toggle("hidden", scrollTop < 420);
  },

  updateProgress(value) {
    if (!this.els.readingProgress) return;
    const clamped = Math.max(0, Math.min(1, Number(value) || 0));
    this.els.readingProgress.style.width = `${(clamped * 100).toFixed(2)}%`;
  },

  scrollToTop() {
    if (this.els.viewer) this.els.viewer.scrollTop = 0;
    if (this.els.backToTop) this.els.backToTop.classList.add("hidden");
  },

  // ------------------------------------------------------------------ overlays
  openTerminal() {
    this.closeSidebar();
    if (typeof Search !== "undefined") Search.close();
    if (this.terminalOpen) { Terminal.focus(); return; }
    this.lastFocus = document.activeElement;
    this.terminalOpen = true;
    this.els.terminalOverlay.classList.remove("hidden");
    document.querySelectorAll(".js-terminal-btn").forEach((btn) => btn.classList.add("is-active"));
    document.body.classList.add("terminal-open");
    Terminal.onOpen();
    requestAnimationFrame(() => Terminal.measure());
    setTimeout(() => Terminal.focus(), 40);
  },

  closeTerminal() {
    if (!this.terminalOpen) return;
    this.terminalOpen = false;
    this.els.terminalOverlay.classList.add("hidden");
    document.querySelectorAll(".js-terminal-btn").forEach((btn) => btn.classList.remove("is-active"));
    document.body.classList.remove("terminal-open");
    document.documentElement.style.setProperty("--terminal-h", "0px");
    Terminal.onClose();
    if (this.editorOpen) { Editor.focus(); return; }
    if (this.lastFocus && typeof this.lastFocus.focus === "function") {
      try { this.lastFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  },

  toggleTerminal() {
    if (this.terminalOpen) this.closeTerminal();
    else this.openTerminal();
  },

  async openEditor(filePath, options = {}) {
    this.closeSidebar();
    if (typeof Search !== "undefined") Search.close();
    if (!this.session.loggedIn || this.session.group !== "admin") {
      Toast.show("Admin login required. Use `login admin <password>` in the terminal.", { kind: "info", duration: 3800 });
      if (!this.terminalOpen) this.openTerminal();
      setTimeout(() => Terminal.prefill("login admin "), 80);
      return false;
    }
    if (this.terminalOpen) this.closeTerminal();
    this.lastFocus = document.activeElement;
    this.editorOpen = true;
    this.els.editorOverlay.classList.remove("hidden");
    document.querySelectorAll(".js-editor-btn").forEach((btn) => btn.classList.add("is-active"));
    document.body.classList.add("editor-open");
    await Editor.open(filePath, options);
    return true;
  },

  closeEditor() {
    if (!this.editorOpen) return;
    this.editorOpen = false;
    this.els.editorOverlay.classList.add("hidden");
    document.querySelectorAll(".js-editor-btn").forEach((btn) => btn.classList.remove("is-active"));
    document.body.classList.remove("editor-open");
    Editor.onClose();
    if (this.lastFocus && typeof this.lastFocus.focus === "function") {
      try { this.lastFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  },

  requestCloseEditor() {
    return Editor.requestClose();
  },

  toggleEditor() {
    if (this.editorOpen) this.requestCloseEditor();
    else this.openEditor();
  },

  openSearch() {
    if (this.editorOpen) {
      Toast.info("Close the editor to search.");
      return;
    }
    if (window.innerWidth <= 900 && this.terminalOpen) this.closeTerminal();
    Search.open();
  },

  // ------------------------------------------------------------------ events
  handleGlobalKeydown(event) {
    if (event.defaultPrevented) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;

    if (mod && event.shiftKey && (key === "P" || key === "p")) {
      event.preventDefault();
      this.toggleTerminal();
      return;
    }
    if (mod && event.shiftKey && (key === "E" || key === "e")) {
      event.preventDefault();
      this.toggleEditor();
      return;
    }
    if (this.editorOpen && mod && (key === "s" || key === "S")) {
      event.preventDefault();
      Editor.save();
      return;
    }
    if (this.editorOpen && key === "Tab") {
      const overlay = this.els.editorOverlay;
      const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]')]
        .filter((node) => {
          if (node.closest("#editor-sidebar") && window.matchMedia("(max-width: 700px)").matches && !overlay.classList.contains("sidebar-open")) return false;
          return node.offsetParent !== null;
        });
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      }
      return;
    }
    if (key === "Escape") {
      if (typeof Search !== "undefined" && Search.isOpen) return;
      if (this.sidebarOpen) { event.preventDefault(); this.closeSidebar(); return; }
      if (this.editorOpen && this.els.editorOverlay.classList.contains("sidebar-open")) {
        event.preventDefault();
        this.els.editorOverlay.classList.remove("sidebar-open");
        if (Editor.sidebarToggle) Editor.sidebarToggle.focus();
        return;
      }
      if (this.terminalOpen) {
        const handled = Terminal.handleEscape();
        event.preventDefault();
        if (handled) return;
        this.closeTerminal();
        return;
      }
      if (this.editorOpen) {
        event.preventDefault();
        this.requestCloseEditor();
      }
    }
  },

  handleClick(event) {
    const anchor = event.target.closest?.("a[href]");
    if (anchor && this.shouldHandleLink(anchor, event)) {
      event.preventDefault();
      this.go(anchor.href);
      return;
    }
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const action = actionEl.dataset.action;
      if (action === "sidebar") this.toggleSidebar();
      else if (action === "sidebar-close") this.closeSidebar();
      else if (action === "search") this.openSearch();
      else if (action === "search-close") Search.close();
      else if (action === "theme") this.toggleTheme();
      else if (action === "terminal") this.toggleTerminal();
      else if (action === "editor") this.toggleEditor();
      else if (action === "retry") this.retryCurrent();
      else if (action === "project-reload") this.reloadProject();
      else if (action === "project-open") this.openProjectInNewTab();
      else if (action === "top") this.scrollToTop();
      return;
    }
    const quick = event.target.closest("[data-cmd]");
    if (quick) Terminal.runQuick(quick.dataset.cmd);
  },

  shouldHandleLink(anchor, event) {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return false; }
    if (url.origin !== location.origin) return false;
    if (url.hash && url.pathname === location.pathname) return false;
    if (url.pathname.startsWith("/api/")) return false;
    if (["/rss.xml", "/feed.xml", "/sitemap.xml", "/robots.txt"].includes(url.pathname)) return false;
    const parts = url.pathname.split("/").filter(Boolean);
    const first = parts[0] || "";
    if (["css", "js", "assets", "images", "img", "fonts"].includes(first)) return false;
    if (["archive", "tags", "projects", "about", "posts", "post", "p"].includes(first)) return true;
    const last = parts[parts.length - 1] || "";
    return !last.includes(".");
  },

  async retryCurrent() {
    if (!this.route) return;
    await this.handleRoute();
  },

  // ------------------------------------------------------------------ helpers
  async copyText(text, successMessage = "Copied to clipboard") {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      Toast.success(successMessage);
    } catch {
      Toast.error("Could not copy to clipboard");
    }
  },

  async onFileSaved(path) {
    Cache.remove(path);
    this.index = null;
    this.indexFetchedAt = 0;
    await Promise.all([this.getTree(true), this.getIndex(true)]);
    if (!this.route) return;
    if (this.route.kind === "post") {
      const post = this.index?.posts.find((item) => item.path === path);
      if (post) await this.go(`posts/${post.slug}`);
      else await this.handleRoute();
    } else if (this.route.kind === "about" && path === "about.md") {
      await this.showAbout();
    } else if (this.route.kind === "project") {
      await this.showProject(this.route.name);
    } else if (this.route.kind === "archive" || this.route.kind === "tags" || this.route.kind === "home") {
      await this.handleRoute();
    }
  },

  async onTreeChanged() {
    this.index = null;
    this.indexFetchedAt = 0;
    await Promise.all([this.getTree(true), this.getIndex(true)]);
    if (this.route && (this.route.kind === "archive" || this.route.kind === "tags" || this.route.kind === "home" || this.route.kind === "projects")) {
      await this.handleRoute();
    }
  },

  renderLoading(label) {
    const card = el("div", "state-card loading-card");
    card.setAttribute("aria-busy", "true");
    card.appendChild(el("div", "state-eyebrow", `$ open ${label}`));
    card.append(el("div", "skeleton skeleton-title"), el("div", "skeleton"), el("div", "skeleton skeleton-short"));
    this.els.content.replaceChildren(card);
  },

  showError(message, options = {}) {
    this.setProjectMode(false);
    const card = el("div", "state-card error-card");
    const code = el("div", "state-code", options.status === 404 ? "404" : options.status === 403 ? "403" : "!");
    const title = el("h1", "", options.status === 404 ? "Page not found" : "Something went wrong");
    const text = el("p", "", message || "The page could not be loaded.");
    const actions = el("div", "state-actions");
    const retry = el("button", "button", "Retry");
    retry.type = "button";
    retry.dataset.action = "retry";
    const home = el("a", "button", "Back home");
    home.href = "/";
    const terminal = el("button", "button", "Open terminal");
    terminal.type = "button";
    terminal.dataset.action = "terminal";
    actions.append(retry, home, terminal);
    card.append(code, title, text, actions);
    this.els.content.replaceChildren(card);
    this.scrollToTop();
    this.currentArticle = null;
    this.setStatus("Error", "error", options.path || "");
    this.updateDocumentMeta({ title: "Error — Veterm", description: "The requested page could not be loaded.", type: "website" });
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
