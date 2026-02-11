# Synthetic Markdown

A WYSIWYG editor built as a composable UI component
> [!NOTE]
> **Supported Elements**
> 
> `Paragraph` `Heading` `Block Quote` `List` `Thematic Break`
> 
> `Text` `Strong` `Emphasis` `Strikethrough` `Code Span` `Link` `Autolink` `Image`

> [!TIP]
> See guide or try it online: <https://semigarden.github.io/synthetic-markdown>

> [!IMPORTANT]
> This project is still in development. Interactions with the following blocks are partially implemented and are currently inactive:
> - Tables
> - Task Lists
> - Code Blocks

---

<p align="center">
  <img src="app/public/synthetic.gif" alt="Synthetic Markdown" />
</p>

---

## Installation

#### Vanilla
```
npm install synthetic-markdown
```

#### React
```
npm install synthetic-markdown-react
```

## Usage

#### Vanilla
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

#### React
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

## Interactions

#### Indent
`List Item` `Block Quote`

- **Tab**
- **4 Spaces**
- **Shift + Enter**

---

#### Outdent
`List Item` `Block Quote`

- **Shift + Tab**
- **Shift + Backspace**
