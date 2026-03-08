# Node-Based CGPA Calculator -- Design Specification

A visual CGPA calculator on a 5.0 grading scale, built as a node-based canvas editor inspired by n8n's UI. Each semester is a draggable node on an infinite canvas. Clicking a node opens a right-side panel for editing courses and grades. The cumulative CGPA is always visible in the bottom toolbar and the panel header.

---

## Aesthetic Direction

**Tone:** Warm utilitarian. Sun-bleached paper, not clinical SaaS white. Every surface has a hint of sand/cream. Borders lean warm, never pure gray.

**Key principle:** The canvas is the hero. Chrome (toolbars, panels) stays visually quiet. Semester nodes carry the visual weight. Padding is tight -- this is a tool, not a marketing page.

---

## Grading System

| Grade | Points |
| ----- | ------ |
| A     | 5.0    |
| B     | 4.0    |
| C     | 3.0    |
| D     | 2.0    |
| E     | 1.0    |
| F     | 0.0    |

**GPA** = Sum(grade_points x credit_hours) / Sum(credit_hours) per semester.
**CGPA** = Sum(all quality points across all semesters) / Sum(all credit hours).

---

## Color Palette

### Surfaces

| Token            | Hex       | Usage                                               |
| ---------------- | --------- | --------------------------------------------------- |
| `canvas-bg`      | `#f5f1eb` | Main canvas / page background                       |
| `panel-bg`       | `#faf8f5` | Properties panel, top bar                           |
| `cgpa-header-bg` | `#f7f4ef` | CGPA display strip at top of panel                  |
| `card-bg`        | `#ffffff` | Node cards, toolbar pill, input fields, course rows |
| `hover-bg`       | `#f5f0ea` | Button hover states in toolbars                     |
| `hover-bg-alt`   | `#f0ece6` | Top bar badge background                            |
| `summary-bg`     | `#faf8f5` | Course summary box in panel                         |

### Borders

| Token               | Hex       | Usage                                           |
| ------------------- | --------- | ----------------------------------------------- |
| `border-default`    | `#e0d5c8` | Node card borders                               |
| `border-panel`      | `#e8e0d6` | Top bar bottom border, toolbar border, dividers |
| `border-inner`      | `#ece4db` | Panel section borders (header/tabs/footer/cgpa) |
| `border-node-inner` | `#f0e8df` | Separator inside node (header/body/chips)       |
| `border-input`      | `#e0d6cc` | Form input/select borders, course row borders   |
| `border-handle`     | `#e8ddd0` | ReactFlow handle ring color                     |
| `border-dashed`     | `#e0d6cc` | "Add course" dashed button border               |

### Text

| Token              | Hex       | Usage                                                |
| ------------------ | --------- | ---------------------------------------------------- |
| `text-primary`     | `#1a1a2e` | Node titles, form values, toolbar labels, stats      |
| `text-secondary`   | `#555`    | Close-button hover                                   |
| `text-muted`       | `#888`    | (reserved)                                           |
| `text-disabled`    | `#999`    | Inactive tabs, "Additional Fields", labels uppercase |
| `text-faint`       | `#aaa`    | (reserved)                                           |
| `text-ghost`       | `#bbb`    | Column headers, grade scale subtext, stat labels     |
| `text-placeholder` | `#ccc`    | Input placeholders, delete icon default, empty badge |
| `text-node-sub`    | `#8b8b9e` | Course count, credit count, CGPA label               |

### Accents

| Token               | Hex                      | Usage                                    |
| ------------------- | ------------------------ | ---------------------------------------- |
| `accent-select`     | `#ff6d5a`                | Selected node ring, active tab underline |
| `accent-select-bg`  | `rgba(255,109,90,0.15)`  | Selected node outer shadow               |
| `accent-focus`      | `#ff6d5a` at 30% opacity | Input focus ring                         |
| `accent-add-hover`  | `#ff6d5a` at 40% opacity | "Add course" dashed border on hover      |
| `add-hover-bg`      | `#fff8f6`                | "Add course" button hover background     |
| `delete-hover-bg`   | `#fff0f0`                | Course delete button hover background    |
| `delete-hover-text` | `#e53935`                | Course delete button hover icon color    |

### GPA-Dependent Colors

These colors change dynamically based on the GPA value:

| GPA Range | Text Color | Badge Background |
| --------- | ---------- | ---------------- |
| >= 4.50   | `#2e7d32`  | `#e8f5e9`        |
| >= 3.50   | `#1565c0`  | `#e3f2fd`        |
| >= 2.50   | `#e65100`  | `#fff3e0`        |
| >= 1.50   | `#bf360c`  | `#fbe9e7`        |
| < 1.50    | `#c62828`  | `#ffebee`        |

### Grade-Specific Colors

| Grade | Text Color | Chip Background |
| ----- | ---------- | --------------- |
| A     | `#2e7d32`  | `#e8f5e9`       |
| B     | `#1565c0`  | `#e3f2fd`       |
| C     | `#e65100`  | `#fff3e0`       |
| D     | `#bf360c`  | `#fbe9e7`       |
| E     | `#c62828`  | `#ffebee`       |
| F     | `#b71c1c`  | `#ffebee`       |

### Semester Node Icon

| Element         | Color     |
| --------------- | --------- |
| Icon background | `#5c6bc0` |
| Icon (BookOpen) | white     |

### Edge Colors

| Edge type    | Hex       |
| ------------ | --------- |
| Default edge | `#c4b5a4` |

---

## Typography

- **Font family:** Geist Sans via CSS variable. No decorative fonts.

| Element               | Size           | Weight            | Extra                | Color            |
| --------------------- | -------------- | ----------------- | -------------------- | ---------------- |
| Top bar title         | `text-xs`      | `semibold`        |                      | `#1a1a2e`        |
| Top bar badge         | `text-[9px]`   | `medium`          |                      | `#999`           |
| Node title            | `text-sm`      | `semibold`        |                      | `#1a1a2e`        |
| Node subtitle (count) | `text-[11px]`  | normal            |                      | `#8b8b9e`        |
| Node GPA badge        | `text-[11px]`  | `bold`            |                      | GPA-dependent    |
| Node grade chips      | `text-[9px]`   | `semibold`        |                      | grade-dependent  |
| Panel CGPA value      | `text-lg`      | `bold`            | `tabular-nums`       | GPA-dependent    |
| Panel semester GPA    | `text-[10px]`  | (label)           | value is `font-bold` | GPA-dependent    |
| Panel semester name   | `text-sm`      | `semibold`        |                      | `#1a1a2e`        |
| Mode tab              | `text-[11px]`  | `medium`          |                      | `#ff6d5a`/`#999` |
| Column headers        | `text-[9px]`   | `medium`          | uppercase tracking   | `#bbb`           |
| Course name input     | `text-xs`      |                   |                      | `#1a1a2e`        |
| Grade select          | `text-xs`      |                   |                      | `#1a1a2e`        |
| Summary labels        | `text-[10px]`  |                   |                      | `#999`           |
| Summary values        | `text-xs`/`sm` | `semibold`/`bold` |                      | `#1a1a2e`/GPA    |
| Grade scale header    | `text-[9px]`   | `medium`          | uppercase tracking   | `#bbb`           |
| Grade scale letter    | `text-[10px]`  | `bold`            |                      | grade-dependent  |
| Grade scale points    | `text-[8px]`   |                   |                      | `#999`           |
| Toolbar stat label    | `text-[9px]`   | `medium`          | uppercase tracking   | `#bbb`           |
| Toolbar stat value    | `text-xs`      | `bold`            |                      | `#1a1a2e`        |
| Toolbar CGPA label    | `text-[9px]`   | `medium`          | uppercase tracking   | `#bbb`           |
| Toolbar CGPA value    | `text-base`    | `bold`            | `tabular-nums`       | GPA-dependent    |
| "Add course" button   | `text-[11px]`  | `medium`          |                      | `#999`/`#ff6d5a` |
| "Add Semester" button | `text-[11px]`  | `medium`          |                      | `#1a1a2e`        |

---

## Spacing & Layout

- **Canvas fills viewport:** `h-dvh w-full overflow-hidden`.
- **Top bar:** Fixed `h-10`, pinned to top, `z-20`.
- **Properties panel:** Fixed `w-[380px]`, right-aligned, full height below top bar, `z-30`.
- **Bottom toolbar:** Centered at `bottom-4`, `z-20`.
- **Canvas shrinks** when panel is open: `right-[380px]`, otherwise `right-0`. Transitions with `duration-200`.

### Internal Spacing

| Context                   | Value             |
| ------------------------- | ----------------- |
| Panel CGPA header         | `px-4 py-2`       |
| Panel header              | `px-4 py-2.5`     |
| Panel semester name field | `px-4 py-2.5`     |
| Panel course list         | `p-3`             |
| Panel direct mode         | `p-4`             |
| Course row padding        | `p-1.5`           |
| Course row gap            | `gap-1.5`         |
| Course list gap           | `space-y-1.5`     |
| Column header margin      | `mb-1.5`          |
| Summary box padding       | `p-2.5`           |
| Grade scale footer        | `px-4 py-2`       |
| Node header padding       | `px-3 py-2`       |
| Node body padding         | `px-3 py-2`       |
| Node chips area           | `px-3 py-1.5`     |
| Toolbar padding           | `px-2.5 py-1.5`   |
| Toolbar dividers          | `mx-0.5 h-6 w-px` |

---

## Component Anatomy

### Semester Node

```
┌──────────────────────────────────┐
│ [BookOpen icon]  Semester 1      │  ← header, border-b
├──────────────────────────────────┤
│ 5 courses   15 cr       [4.25]  │  ← body (count, credits, GPA badge)
├──────────────────────────────────┤
│ A  B  A  B  A  C                 │  ← grade chips (max 6 shown, +N overflow)
└──────────────────────────────────┘
  ○ (left handle)     (right handle) ○
```

- Width: `w-[240px]`
- Container: `rounded-lg border bg-white shadow-sm`
- Selected: `border-[#ff6d5a]/50 shadow-[0_0_0_2px_rgba(255,109,90,0.15)]`
- Default: `border-[#e0d5c8]`
- Icon: `h-7 w-7 rounded-md bg-[#5c6bc0]`
- GPA badge: dynamic `backgroundColor` and `color` from GPA range
- Grade chips: max 6 visible, each `rounded px-1.5 py-0.5 text-[9px] font-semibold`
- Empty state badge: `bg-[#f5f5f5] text-[#bbb]` showing "--"

### Properties Panel

```
┌─ CGPA Header ────────────────────┐  border-b, bg-[#f7f4ef]
│ [cap icon] CGPA           4.35   │
├─ Node Header ────────────────────┤  border-b
│ [icon] Semester 1       [X]      │
│   GPA: 4.25  ·  15 credits      │
├─ Semester Name ──────────────────┤  border-b
│ [input field]                    │
├─ Mode Tabs ──────────────────────┤  border-b
│ Individual Courses | Direct GPA  │
├──────────────────────────────────┤
│                                  │
│  Course rows (scrollable)        │
│  or Direct GPA inputs            │
│                                  │
│  [+ Add course] (dashed)         │
│                                  │
│  ┌─ Summary ──────────────┐      │
│  │ Total credits      15  │      │
│  │ Semester GPA     4.25  │      │
│  └────────────────────────┘      │
│                                  │
├─ Grade Scale Footer ─────────────┤  border-t
│ A    B    C    D    E    F       │
│ 5.0  4.0  3.0  2.0  1.0  0.0   │
└──────────────────────────────────┘
```

### Course Row (grid layout)

```
┌──────────────────┬───────┬────────┬────┐
│ Course name      │ Grade │ Credits│ [x]│
│ (text input)     │(select)│(number)│    │
└──────────────────┴───────┴────────┴────┘
```

- Grid: `grid-cols-[1fr_60px_56px_28px]`
- Container: `rounded-md border border-[#f0e8df] bg-white p-1.5`
- All internal inputs: `h-7`, borderless or minimal border
- Delete button: `h-7 w-7`, `text-[#ccc]`, hover: `bg-[#fff0f0] text-[#e53935]`

### Add Course Button

- Style: `border border-dashed border-[#e0d6cc]`
- Hover: `border-[#ff6d5a]/40 bg-[#fff8f6] text-[#ff6d5a]`
- Icon: Plus, `h-3 w-3`

### Connection Handles

- Size: `h-2.5 w-2.5`
- Style: `rounded-full border-2 border-[#e8ddd0] bg-white`
- Position: `-right-1` / `-left-1`

### Edges

- Bezier curves, dashed `strokeDasharray: "6 4"`, `strokeWidth: 1.5`, `opacity: 0.5`
- Color: `#c4b5a4`

### Bottom Toolbar

```
┌─────────────────────────────────────────────────┐
│ [+] Add Semester │ Semesters │ Credits │ 🎓 CGPA │
│                  │     3     │   42    │   4.35   │
└─────────────────────────────────────────────────┘
```

- Container: `rounded-xl border border-[#e0d6cc] bg-white/95 shadow-[0_2px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm`
- Dividers: `h-6 w-px bg-[#e8e0d6]` with `mx-0.5`
- CGPA icon: GraduationCap `h-4 w-4 text-[#8b8b9e]`

### Top Bar

```
┌────────────────────────────────────────────────┐
│ 🎓 CGPA Calculator  [5.0 scale]               │
└────────────────────────────────────────────────┘
```

- Height: `h-10`
- Background: `#faf8f5`
- Scale badge: `rounded bg-[#f0ece6] px-1.5 py-0.5`

---

## Canvas Background

- **Variant:** Dots
- **Gap:** `24px`
- **Dot size:** `1px`
- **Dot color:** `rgba(0,0,0,0.07)`
- **Canvas bg:** `#f5f1eb`

---

## Interaction States

| State                | Visual treatment                                                   |
| -------------------- | ------------------------------------------------------------------ |
| Node default         | `border-[#e0d5c8]` + `shadow-sm`                                   |
| Node selected        | `border-[#ff6d5a]/50` + `shadow-[0_0_0_2px_rgba(255,109,90,0.15)]` |
| Mode tab active      | `border-b-2 border-[#ff6d5a] text-[#ff6d5a]`                       |
| Mode tab inactive    | `text-[#999]`, hover `text-[#666]`                                 |
| Input focus          | `ring-1 ring-[#ff6d5a]/30`                                         |
| Add course default   | `border-dashed border-[#e0d6cc] text-[#999]`                       |
| Add course hover     | `border-[#ff6d5a]/40 bg-[#fff8f6] text-[#ff6d5a]`                  |
| Delete default       | `text-[#ccc]`                                                      |
| Delete hover         | `bg-[#fff0f0] text-[#e53935]`                                      |
| Close button hover   | `bg-[#eee] text-[#555]`                                            |
| Toolbar button hover | `bg-[#f5f0ea]`                                                     |

---

## Shadows

| Context          | Value                                   |
| ---------------- | --------------------------------------- |
| Node cards       | `shadow-sm`                             |
| Properties panel | `shadow-[-4px_0_24px_rgba(0,0,0,0.06)]` |
| Bottom toolbar   | `shadow-[0_2px_16px_rgba(0,0,0,0.06)]`  |

---

## Semester Input Modes

Each semester supports two modes, toggled by tabs in the properties panel:

1. **Individual Courses** -- Add/remove courses with name, grade (A-F select), and credit hours. GPA is calculated automatically.
2. **Direct GPA** -- Enter a GPA value (0.00-5.00) and total credit hours directly. Useful when you already know the semester result.

---

## Motion / Transitions

- Interactive elements: `transition` (Tailwind default 150ms ease).
- Canvas-to-panel width: `transition-all duration-200`.
- No spring animations or elaborate effects.

---

## Tech Stack

| Concern       | Library                 |
| ------------- | ----------------------- |
| Canvas/nodes  | `@xyflow/react` v12     |
| Styling       | Tailwind CSS v3         |
| UI primitives | shadcn/ui (new-york)    |
| Icons         | Lucide React            |
| Class merging | `cn()` (clsx + twMerge) |
| Framework     | Next.js 15 App Router   |
| Font          | Geist Sans              |
