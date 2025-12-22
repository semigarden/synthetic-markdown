# synthetic-md

A library package for the Mist workspace.

## Development

To develop this package standalone:
```bash
pnpm dev
```

## Building as a Library

To build this package as a library that can be imported by other packages:
```bash
pnpm build:lib
```

This will create a `dist/` folder with the compiled library files.

## Usage in Other Packages

In the `app` package, you can import from `synthetic-md`:

```typescript
import { App } from 'synthetic-md';
```

## Adding New Exports

When you create new components or utilities to export, add them to `src/lib.ts`:

```typescript
export { YourComponent } from './components/YourComponent';
export type { YourComponentProps } from './components/YourComponent';
```
