# Theme

The visitor's theme choice: `system`, `light`, or `dark`. It lives in a cookie
that the server reads while rendering, so the first paint already carries the
right class and a light or dark choice never flashes the wrong theme. Spec:
`docs/specs/0006-signed-in-area/index.md`; the design system itself is
`design.md`.

## Where things live

- `theme.ts`: the cookie name, the three allowed values, the labels, the cycle
  order, and the inline script that applies the choice before paint.
- `data.ts`: the server function the root route reads the choice with.
- `use-theme.ts`: the client hook and the context the header control and the
  settings page share.
- `components/theme-toggle.tsx`: the header control.

## The contract

- The cookie holds only `system`, `light`, or `dark`. Any other value, or no
  value, resolves to `system`, so a forged cookie cannot inject a class or
  markup.
- The class reaches the root document because the root route resolves the choice
  in `beforeLoad` into router context and the shell reads that context.
- A change applies at once with no reload: the browser writes the cookie with
  `document.cookie` (`Path=/`, `SameSite=Lax`, one year) and toggles the class,
  so nothing waits on a round trip.
- The cookie is not `httpOnly` by necessity, so treat it as untrusted input and
  validate it on read.
- The icon only header control states the current choice in its accessible name.
- Do not add a colour value here or in any component. The tokens in
  `src/styles.css` answer both themes.

_Drafted by /sync from the introducing change, worth a quick human pass._
