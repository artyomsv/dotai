---
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/webapp/**"
---

# Clean Code — React / TypeScript

## Components

- Functional components only — no class components
- Use `interface` for props, not `type` (project convention)
- One component per file — co-locate with related hooks/utils when tightly coupled
- Extract reusable UI into `components/shared/`, feature-specific into `components/{feature}/`

## Component Size

- **Max 250 lines** per file. Extract:
  - UI sections → child components
  - Complex logic → custom hooks (`use*.ts`)
  - Form handling → dedicated form components or hooks

## State Limits

- **Max 8 `useState` calls** per component. Beyond that:
  - Group related state into `useReducer`
  - Extract domain logic into custom hooks

```tsx
// BAD — 10+ scattered useState calls
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');
// ... 7 more

// GOOD — grouped with useReducer or custom hook
const { formState, updateField, resetForm } = useContactForm();
```

## Props

- **Max 8 props** per component. For more, group related props into objects or split the component.

```tsx
// BAD
<OrderCard title={t} price={p} qty={q} img={i} desc={d} sku={s} weight={w} category={c} rating={r} />

// GOOD
<OrderCard product={product} displayOptions={displayOptions} />
```

## File Naming

- PascalCase for components: `RiskCard.tsx`, `DashboardHeader.tsx`
- camelCase for hooks: `useFilteredRisks.ts`, `useWorkflows.ts`
- camelCase for utilities: `formatDate.ts`, `cn.ts`
- kebab-case for non-component modules when appropriate

## Hooks

- Extract shared logic into custom hooks in `hooks/`
- Always prefix with `use` — `useRiskRelationships`, `useAnnualReview`
- One concern per hook — don't build monolithic hooks
- Use React Query (`@tanstack/react-query`) for server state — not `useEffect` + `useState`
- Keep `useEffect` minimal — most side effects belong in event handlers or React Query

## TypeScript

- Avoid `any` — use `unknown` when type is uncertain
- Use `interface` for object shapes, `type` for unions/intersections
- Use utility types: `Pick`, `Omit`, `Partial`, `Required`, `ComponentProps`
- Define shared types in `types/` (e.g., `types/workflow.ts`)
- Use discriminated unions for state variants (loading/error/success)

## shadcn/ui

- Add components via CLI: `npx shadcn-ui@latest add <name>`
- Never hand-edit files in `components/ui/` — they are managed by shadcn
- Compose shadcn primitives into feature components in `components/{feature}/`
- Use Radix UI props as documented — don't fight the abstraction

## Tailwind CSS

- Use theme CSS variables defined in `index.css` (HSL-based)
- Prefer Tailwind utility classes over inline styles or CSS modules
- Use `cn()` helper (from `lib/utils`) for conditional class merging
- Dark mode is default — ensure all components work in dark theme
- Avoid arbitrary values (`w-[347px]`) — use design tokens when possible

## State Management

- **Server state**: React Query — caching, refetching, optimistic updates
- **Global UI state**: Context API or Redux Toolkit (project-dependent)
- **Component state**: `useState` for local, component-scoped state
- Avoid prop drilling > 2 levels — lift to context or use composition
- Don't duplicate server state in local state

## JSX Duplication

- If a JSX block (3+ lines) appears 2+ times, extract to a component.

## Event Handlers

- Inline handlers: 1-2 lines max (e.g., `onClick={() => setOpen(true)}`).
- 3+ lines → extract to a named function above the return.

```tsx
// BAD
<button onClick={() => {
  validate();
  submit();
  track('click');
}}>Save</button>

// GOOD
const handleSave = () => {
  validate();
  submit();
  track('click');
};
<button onClick={handleSave}>Save</button>
```

## Conditional Rendering

- Avoid nested ternaries. Use early returns or extract to named sub-components.
- For 3+ branches, prefer `switch` or a render map over chained ternaries.

## Magic Strings

- UI-facing strings: use i18n translation keys.
- Internal constants (routes, query keys, storage keys): extract to `lib/constants.ts` or a local `constants.ts`.

```tsx
// BAD
queryKey: ['orders', 'active']

// GOOD — in lib/constants.ts
export const QUERY_KEYS = { ACTIVE_ORDERS: ['orders', 'active'] } as const;
```

## Imports

- Use `@/*` path alias (maps to `src/*`) for all non-relative imports
- Group imports: React/hooks → third-party → `@/` local → relative
- No circular imports — restructure with dependency inversion if needed

## Performance

- `React.memo` only when profiling shows unnecessary re-renders
- `useMemo` / `useCallback` for expensive computations or stable references passed to children
- Lazy-load route-level pages with `React.lazy` + `Suspense`
- Avoid creating objects/arrays inline in JSX props (causes re-renders)

## Routing

- Route-level components live in `pages/`
- Use `ProtectedRoute` wrapper for authenticated routes
- Keep route definitions in a central location
- Use React Router v6 conventions (`useNavigate`, `useParams`, `useSearchParams`)
