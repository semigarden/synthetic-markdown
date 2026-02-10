# Synthetic Markdown


```
import { useState } from 'react'
import { SyntheticText } from 'synthetic-markdown-react'

const App = () => {
    const [text, setText] = useState('')

    const onChange = (event) => {
        const text = event.target.value
        setText(text)
    }

    return <SyntheticMarkdown value={text} onChange={onChange} />
}
```
