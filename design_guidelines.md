# Korean University Entrance Exam Academy Management System - Design Guidelines

## Design Approach

**Selected Framework**: Hybrid approach combining Material Design principles (for data-heavy dashboards) with Korean educational platform aesthetics (warm, approachable visual language)

**Design Direction**: Professional educational management platform inspired by leading Korean학원 platforms. Clean data visualization with warm, motivational aesthetic that encourages learning progress.

---

## Typography System

**Primary Font**: Noto Sans KR (Google Fonts) - optimized for Korean-English mixed content
**Secondary Font**: Inter (Google Fonts) - for data tables and analytics

**Hierarchy**:
- Display (Page Headers): Noto Sans KR, 32px/40px, Semi-bold (600)
- H1 (Section Titles): Noto Sans KR, 24px/32px, Semi-bold (600)
- H2 (Card Headers): Noto Sans KR, 18px/24px, Medium (500)
- Body Large (Primary Content): Noto Sans KR, 16px/24px, Regular (400)
- Body (Secondary): Noto Sans KR, 14px/20px, Regular (400)
- Caption (Metadata): Inter, 12px/16px, Regular (400)
- Data Display: Inter, various sizes, Medium (500)

---

## Layout System

**Spacing Primitives**: Tailwind units of 1, 2, 4, 6, 8, 12, 16
- Micro spacing (inside cards, between elements): 2, 4
- Component spacing (between sections): 6, 8
- Page layout spacing: 12, 16

**Grid System**:
- Dashboard layouts: 12-column grid with 4-column sidebar
- Card grids: 3-column on desktop, 2-column tablet, 1-column mobile
- Data tables: Full-width with horizontal scroll on mobile

**Container Widths**:
- Full dashboard: max-w-full with px-6 padding
- Content sections: max-w-7xl mx-auto
- Forms/modals: max-w-2xl

---

## Core Component Library

### Navigation
**Top Navigation Bar**: Fixed header with academy logo, role indicator, notification bell, user profile dropdown. Height 16 units, shadow-sm

**Sidebar Navigation** (Admin/Branch Manager): Collapsible 64-unit width sidebar with icon+label navigation, active state highlighting, nested menu support for multi-level navigation

**Mobile Navigation**: Bottom tab bar for Student/Parent roles with 4-5 key actions

### Dashboard Components

**Stat Cards**: 3-column grid showing key metrics (enrollment numbers, exam averages, attendance rates). Include icon, large number display (32px), label, and trend indicator (arrow + percentage)

**Progress Charts**: Use Chart.js or similar - line charts for performance trends, bar charts for subject comparisons, donut charts for completion rates

**Data Tables**: Striped rows, sortable headers, sticky header on scroll, pagination controls, row actions (view/edit/delete), filter dropdowns in header

**Activity Feed**: Timeline-style list with avatar, timestamp, action description, and relevant metadata. Reverse chronological order

**Calendar View**: Month/week/day toggle, event indicators, color-coding by event type (exam, class, assignment)

### Forms & Input

**Input Fields**: Label above input, border focus states, helper text below, error states with icon and message. All inputs height 12 units

**Search Bars**: Prominent placement in header, autocomplete suggestions, recent searches

**Filters**: Collapsible filter panel (sidebar or accordion), checkbox groups, date range pickers, apply/reset buttons

**Multi-step Forms**: Progress indicator at top, previous/next navigation, save draft functionality

### Cards & Content

**Student/Parent Cards**: Avatar image, name, ID number, key stats (attendance %, last exam score), quick action buttons

**Exam Result Cards**: Exam title, date, score display (large), subject breakdown, percentile ranking, detailed report link

**Class Schedule Cards**: Time slot, subject, instructor name, room number, attendance status indicator

### Overlays

**Modals**: Centered, max-width 2xl, backdrop blur, close button top-right, action buttons bottom-right (cancel/confirm pattern)

**Toasts**: Top-right position, auto-dismiss after 4 seconds, success/error/info variants with icons

**Dropdown Menus**: Box shadow-lg, 8px rounded corners, hover states on items

---

## Accessibility Standards

- All interactive elements minimum 44x44px touch targets
- Form inputs with proper labels and ARIA attributes
- Keyboard navigation support throughout
- Focus indicators on all interactive elements (2px outline)
- Color contrast ratio minimum 4.5:1 for all text
- Screen reader announcements for dynamic content updates

---

## Images & Visual Assets

**Hero Image**: Large banner image (h-80 on desktop, h-48 mobile) on landing/marketing pages showing diverse students studying together in modern classroom environment. Overlay with semi-transparent gradient for text readability

**Dashboard Illustrations**: Empty state illustrations for "no exams scheduled", "no students enrolled" - friendly, educational themed SVG graphics

**User Avatars**: Circular 40x40px profile images, with initials fallback in gradient background

**Achievement Badges**: Icon-based badges for student milestones (exam scores, attendance streaks)

**Icons**: Use Heroicons for all interface icons - solid variant for filled states, outline for default

**Image Placement**:
- Login page: Right-side hero image (50% split) showing academy building or students
- Marketing pages: Full-width hero with CTA buttons over blurred backdrop
- Dashboard: Small decorative illustrations in empty states
- Student profiles: Profile photo (large, 120x120px)

---

## Animations

**Micro-interactions** (keep minimal):
- Hover lift on cards (2px translate-y)
- Loading spinners for data fetching
- Smooth expand/collapse for sidebar and accordions (200ms ease)
- Toast slide-in from top-right (300ms ease-out)

Avoid: Page transitions, scroll-triggered animations, parallax effects

---

## Role-Specific Layouts

**Admin Dashboard**: 4-column stat cards, full-width data table, 2-column chart section, activity feed sidebar

**Branch Manager**: 3-column layout - sidebar navigation, main content area with tabs (students/exams/schedule), right panel for quick stats

**Student Portal**: Card-based interface - upcoming exams, recent scores, class schedule, assignment tracker in masonry-style grid

**Parent View**: Child selector dropdown at top, 2-column split (performance overview + detailed metrics), communication center for teacher messages