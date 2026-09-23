# UI/UX Design System

## Overview
The UI must project an Enterprise-SaaS aesthetic. It must reflect a professional, trustworthy, and scalable system suitable for heavy-duty B2B and B2C operations.

## 1. Layout Rules
- **Grid & Spacing:** Strict adherence to predictable intervals (e.g., 4px/8px baselines).
- **Navigation:** Persistent sidebar for desktop systems, collapsing into a bottom tab or hamburger menu on mobile.
- **Canvas:** Generous negative space. No cluttered dense walls of information.

## 2. Colors
- **Primary:** Professional blues or authoritative slates.
- **Success:** Distinctive, accessible green (e.g., Tailwind `emerald-600`).
- **Danger:** High contrast red for destructive actions (e.g., `red-600`).
- **Background:** Soft grays (`gray-50`) or crisp whites to ensure contrast. Card boundaries must be subtle but distinct.

## 3. Typography
- **Families:** Inter, Roboto, or systematic Sans-Serif fonts.
- **Hierarchy:** Strict usage of H1-H6, ensuring visual weight directs user attention to the most critical actions.

## 4. Components
- **Tables:** Must support empty states, loading skeletons, and pagination controls natively. No unstyled borders.
- **Forms:** Labels, standardized padding, clear focus states (`ring` utility), and inline validation error text.
- **Cards:** Used to cluster related data points (e.g., a Vehicle profile, a Gig listing). Consistent border-radius and minimal drop-shadows.
- **Modals:** Reserved for interruptive, critical tasks (Confirm Deletion, Assign Mechanic). Must possess a darkened backdrop and focus-trapping.
- **Alerts (Toasts):** Non-blocking notifications for transient actions ("Profile Updated").

## 5. Responsive Behavior
- Desktop-first precision with absolute adherence to mobile-first scaling behavior. Touch-targets on mobile must not fall below a 44px matrix.
