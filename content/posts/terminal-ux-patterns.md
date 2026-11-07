---
title: Terminal UX Patterns for the Web
date: 2026-10-18
description: Autocomplete, history, resize handles, and the small courtesies that make a command line feel human.
tags: [terminal, ux, design]
---

A browser terminal is not a real terminal. It has no PTY, no process table, and no reason to exist except that some interactions are faster when you can type them. That constraint is a gift: it forces every command to justify itself.

### Completion Should Teach

The command bar completes command names, files, directories, and project names. It also shows the candidate list above the input instead of silently choosing one.

```bash
cat h<Tab>        # completes hello-world
archive<Tab>      # completes archive
goto g<Tab>       # completes github
```

The goal is not to save keystrokes. It is to make the content model visible. A reader learns that posts live under `posts/` because the completion bar says so.

### History Is a Conversation

Up and Down cycle through previous commands, stored locally. History is useful when it feels like scrolling back through a conversation, not when it becomes a forensic log of every typo.

There are two rules:

1. Never store passwords in history.
2. Keep the draft line when the user hits Up and then Down again.

The second rule is easy to miss. Without it, exploratory typing disappears the moment someone checks a previous command.

### Resize Handles Are an Invitation

The terminal can be resized by dragging its top edge. This is a small thing, but it changes the relationship: the panel is a tool, not a modal. A fixed-height overlay feels like an error dialog. A resizable drawer feels like a workspace.

### Failure Should Be Quiet and Specific

When a command fails, the terminal says what failed and what to try next:

```text
Error: File not found: ghost.
```

Not a stack trace. Not a toast that disappears before it is read. Just a line in the transcript. Errors are part of the interface, not an exception to it.

### Close on Mobile

On small screens, a command that changes the page closes the terminal. Navigation is the goal; the command line is the vehicle. Leaving the drawer open over the new page would be a small act of hostility.

### The Keyboard First

Every action has a keyboard path:

- `Ctrl+Shift+P` toggles the terminal.
- `Ctrl+Shift+E` opens the editor.
- `Tab` completes.
- `↑` / `↓` browse history.
- `Esc` clears, then closes.

The mouse is supported. It just isn't required.

---

> A command line is a promise that the interface will not get in the way of the words.
