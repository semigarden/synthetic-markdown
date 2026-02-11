# Synthetic Markdown

A WYSIWYG Markdown editor built as a composable UI component

### Usage

```
import { useState } from 'react'
import { SyntheticMarkdown } from 'synthetic-markdown-react'

const App = () => {
    const [text, setText] = useState('')

    const onChange = (event: Event) => {
        const text = event.target.value
        setText(text)
    }

    return <SyntheticMarkdown value={text} onChange={onChange} />
}
    
export default App
```

### API

| Name        | Type       | Default | Description |
|-------------|------------|---------|-------------|
| **className** | `string`   | `-`     | Class name to apply to the component |
| **value**     | `string`   | `-`     | Value of the editor |
| **editable**  | `boolean`  | `true`  | If true, the editor will be editable |
| **autoFocus** | `boolean`  | `false` | If true, the editor will be focused on mount |
| **onChange**  | `function` | `-`     | Callback fired when value is changed.<br><br>`function(event: Event) => void`<br><br>• `event` — The event source of the callback. You can access the new value via `event.target.value` (string) |
