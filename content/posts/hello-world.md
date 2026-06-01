# Hello World

> My first blog post!

---

Welcome to my blog! This is my very first post. I built this blog using **Deno** with a terminal-based interface.

## Why Terminal-Based?

The terminal is a powerful tool. By integrating a command-line interface into the blog, I can:

- Quickly navigate between posts
- Edit content on the fly
- Manage files directly

### Code Example

```typescript
// A simple Deno server
Deno.serve((req: Request) => {
  return new Response("Hello, world!");
});
```

### What's Next?

I plan to write about:

1. Deno runtime features
2. TypeScript best practices
3. Web development patterns
4. Open source contributions

Stay tuned!

---

*Published via terminal command: `touch posts/hello-world.md` + `edit posts/hello-world.md`*