# Synthetic Text


```
import { useState } from 'react'
import { SyntheticText } from 'syntxt-react'

const App = () => {
    const [text, setText] = useState('')

    const onInput = (event) => {
        const text = event.target.value
        setText(text)
    }

    return <SyntheticText value={text} onInput={onInput} />
}
```
