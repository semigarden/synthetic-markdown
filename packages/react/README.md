# Synthetic Text


```
import { useState } from 'react'
import { SynthText } from 'synthtext-react'

const App = () => {
    const [text, setText] = useState('')

    const onInput = (event) => {
        const text = event.target.value
        setText(text)
    }

    return <SynthText value={text} onInput={onInput} />
}
```
