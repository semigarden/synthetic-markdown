# Synthetic Markdown


```
import { useState } from 'react'
import { SyntheticText } from 'synthetic-markdown-react'

const App = () => {
    const [text, setText] = useState('')

    const onInput = (event) => {
        const text = event.target.value
        setText(text)
    }

    return <SyntheticMarkdown value={text} onInput={onInput} />
}
```
