# Mobile Responsive Unit Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a mobile-friendly responsive unit selector & editor in the ReportForm.tsx component, while preserving the existing layout on desktop viewports.

**Architecture:** Use responsive Tailwind breakpoints (e.g. `md:hidden` and `hidden md:block/md:flex`) to display a clean unit dropdown selector, unit action buttons (add/delete), and a dedicated unit name input on mobile, while rendering the original horizontal scrolling tabs on desktop.

**Tech Stack:** React, TypeScript, TailwindCSS, Lucide-React icons (Plus, Trash2).

---

### Task 1: Update ReportForm.tsx to use responsive dual-layout unit navigation

**Files:**
- Modify: `frontend/components/ReportForm.tsx:1037-1108`

- [ ] **Step 1: Check existing tab navigation code in ReportForm.tsx**
- [ ] **Step 2: Modify ReportForm.tsx to wrap existing layout with desktop responsive styling (`hidden md:block`)**
- [ ] **Step 3: Implement new mobile layout block (`block md:hidden`) using custom dropdown, action buttons, and dedicated input**
- [ ] **Step 4: Run dev server to verify it compiles correctly and test responsiveness manually**
- [ ] **Step 5: Commit changes**

```bash
git add frontend/components/ReportForm.tsx
git commit -m "feat: add responsive mobile dropdown for unit navigation in ReportForm"
```
