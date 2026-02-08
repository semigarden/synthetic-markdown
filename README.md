# Synthetic Text

> [!NOTE]
> The project is designed as a building block rather than a complete editor application

> [!TIP]
> Try it online: <https://semigarden.github.io/synthtext/>

> [!IMPORTANT]
> This project is still in development. Interactions with the following blocks are not yet fully implemented:
> - Tables
> - Task Lists
> - Code Blocks

---

<p align="center">
  <img src="app/public/synthetic.gif" alt="Synthetic Text" />
</p>

---

## Installation

#### Vanilla
```
npm install synthtext
```

#### React
```
npm install synthtext-react
```

## Usage

#### Vanilla
```
<html>
    <body>
        <synthetic-text />

        <script type="module">
            import 'synthtext'

            const element = document.querySelector('synthtext')

            let value = ''
            element.value = value

            element.addEventListener('input', (event) => {
                value = event.target.value
            })
        </script>
    </body>
</html>
```

#### React
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
