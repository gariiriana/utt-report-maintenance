# Mobile Unit Navigation Design

Implement a responsive mobile-friendly layout for unit navigation in the `ReportForm` component, improving usability for engineers onsite using mobile devices.

## Current Problem
The existing navigation for units is built as a horizontal tab bar inside the `ReportForm` component. It includes small scroll buttons (`<` and `>`), a text input inside the active tab to rename the unit, and a close button (`X`) to delete it. On small mobile viewports, this layout is extremely cramped, hard to click, prone to mistaps, and makes text input frustrating.

## Proposed Design

### 1. Dual-Layout Navigation
We will split the unit navigation section in `ReportForm.tsx` based on responsive breakpoints using Tailwind classes:
- **Desktop Mode (`hidden md:block`)**: Renders the existing horizontal tab container, preserving the original design and layout.
- **Mobile Mode (`block md:hidden`)**: Renders a new custom dropdown selector, inline editing buttons, and a dedicated unit name input field.

### 2. Mobile Layout Components
The mobile navigation block will feature:
- A styled, full-width `<select>` element (dropdown) displaying all units by their name (e.g. `Unit 1: Daikin`, `Unit 2: Schneider`).
  - Dropdown options dynamically list `unit.tabName || \`Unit \${idx + 1}\``.
  - Changing the selected option updates `activeUnitId`.
- An action row underneath the dropdown:
  - **"Tambah Unit" button**: Triggers `addNewUnit` function.
  - **"Hapus Unit" button**: Prompts confirmation and deletes the active unit, then focuses on a sibling unit.
- A dedicated rename input field directly below the dropdown:
  - Input label: "Nama Unit / Tab"
  - Updates `tabName` (active unit's name) on change.

## Verification Plan
1. Launch local development server (`npm run dev`).
2. Open the browser dev tools and toggle device emulation (e.g., iPhone or Pixel viewport).
3. Select different units using the dropdown.
4. Rename a unit via the dedicated input field.
5. Add and delete units using the mobile-only buttons.
6. Switch back to desktop viewport and ensure the desktop tab navigation still functions normally.
