import { defineElement } from "@semigarden/synthetic-md-core";

defineElement();

const el = document.querySelector<HTMLDivElement>("#synthetic-text") as any;

el.value = `# Synthetic Markdown

- [x] core linked locally
- [ ] tables
- [ ] code blocks

> change event should fire on edits
`;

el.addEventListener("change", () => {
  console.log("change:", el.value);
});
