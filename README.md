# Skild

A learning build of the JavaScript Mastery [Skild tutorial](https://github.com/adrianhajdin/skild):
a platform for discovering and sharing AI agent skills.

Built with TanStack Start, React 19, TanStack Router, TanStack Query, Tailwind CSS 4, shadcn/ui,
and Clerk.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Clerk keys
npm run dev                  # http://localhost:3000
```

Sign in, sign up, and the signed in user button all live in the header, so you can create your
first account straight away.

## Commands

```bash
npm run dev              # dev server on http://localhost:3000
npm run build            # production build
npm run preview          # preview the production build
npm run lint             # Biome lint
npm run format           # Biome format
npm run check            # Biome lint, format, and import sorting
npm run generate-routes  # rebuild src/routeTree.gen.ts
```

## Environment variables

Clerk keys live in `.env.local`, which is not committed. The Clerk CLI wrote them when it ran
`clerk init`. See `.env.example` for the variable names and what each one does.

## Deploy

Netlify builds every push to `main` and serves the app from serverless functions. The adapter is
`@netlify/vite-plugin-tanstack-start`, registered in `vite.config.ts`; `netlify.toml` runs
`npm run build` and publishes `dist/client`. `.nvmrc` pins Node 24, the same version CI uses.

Set these values in the Netlify dashboard under **Project configuration → Environment variables**.
Build scoped values are inlined into the bundle, so changing one needs a redeploy.

| Variable | Scope | Purpose | Secret |
|---|---|---|---|
| `VITE_SITE_URL` | Builds | The site's public origin, with no trailing path. Drives canonicals, the sitemap, the robots file, and the noindex host check. | No |
| `VITE_CLERK_PUBLISHABLE_KEY` | Builds | Clerk's browser key. | No |
| `VITE_CLERK_SIGN_IN_URL` | Builds | In app sign in address, `/sign-in`. | No |
| `VITE_CLERK_SIGN_UP_URL` | Builds | In app sign up address, `/sign-up`. | No |
| `VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Builds | Where sign in lands with no return path, `/`. | No |
| `VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Builds | Where sign up lands with no return path, `/`. | No |
| `VITE_POSTHOG_PROJECT_TOKEN` | Builds | PostHog project token. | No |
| `VITE_POSTHOG_HOST` | Builds | PostHog ingestion host, `https://eu.i.posthog.com`. | No |
| `CLERK_SECRET_KEY` | Functions | Clerk's server key, from the same instance. | Yes |
| `DATABASE_URL` | Functions | Supabase session pooler connection string, in `eu-west-1`. | Yes |

The production build fails with an error naming `VITE_SITE_URL` when it is absent, so a broken
build never becomes a deploy. A running server without `DATABASE_URL` answers on the app's error
surface and names the variable in its log.

The functions region lives in `netlify.toml` as `dub` (EU Ireland), the same region as the Supabase
pooler. Netlify names regions by airport code; the dashboard setting under **Cloud compute →
Functions → Region** shows and changes the same value.

Deploy previews and branch deploys stay off, so there is one environment and one set of values.

### Migrations

Migrations are manual and never run during a deploy. After changing `src/db/schema.ts`:

```bash
npm run db:generate
npm run db:migrate   # run against the production database before pushing code that needs it
```

A local schema push or a local experiment writes the live database, so treat both with care.

### Rollback

A failed build leaves the previous deploy serving. To go back to the last good deploy, open
**Deploys** in Netlify, open the last deploy that succeeded, and choose **Publish Deploy**. The
rollback is instant, needs no code change, and does not trigger a new build.

A rollback restores code, not environment values. Fix a wrong `CLERK_SECRET_KEY` or `DATABASE_URL`
under **Environment variables** and the restored deploy picks it up, because functions read those
at runtime. A wrong `VITE_` value was inlined when that deploy was built, so it needs a new deploy
after the value is corrected.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling, with
[shadcn/ui](https://ui.shadcn.com/) components in `src/components/ui`.

Add a component with:

```bash
npx shadcn@latest add card
```

Clerk's UI uses the shadcn theme. It is applied on `ClerkProvider` in `src/routes/__root.tsx`, and
its stylesheet is imported from `src/styles.css`.

## Linting and formatting

This project uses [Biome](https://biomejs.dev/) for linting, formatting, and import sorting. Run
`npm run check` before committing.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).



# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
