# Synthetic Markdown

A WYSIWYG Markdown editor built as a composable UI component

### Usage

```
<!doctype html>
<html>
    <body>
        <synthetic-markdown />
        <script type='module'>
            import 'synthetic-markdown'

            const element = document.querySelector('synthetic-markdown')

            let value = ''
            element.value = value

            element.addEventListener('change', (event: Event) => {
                value = event.target.value
            })
        </script>
    </body>
</html>
```

### API

#### Attributes & Properties

| Name       | Type     | Default | Description |
|------------|----------|---------|-------------|
| **class**  | `string` | `-`     | Class name to apply to the host element (`element.className`) |
| **value**  | `string` | `-`     | Value of the editor. Set via `element.value` or initial `value` attribute |
| **editable** | `boolean` | `true` | If set, the editor will be editable (`element.editable`) |
| **autofocus** | `boolean` | `false` | If set, the editor will be focused on mount (`element.autofocus` or `autofocus` attribute) |

#### Events

| Name    | Description |
|---------|-------------|
| **change** | Fired when the value changes. Use `element.addEventListener('change', handler)`.<br><br>The new value is available as `event.target.value` (string). |
