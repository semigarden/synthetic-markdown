<!-- # Synthetic Text

> [!NOTE]
> The project is designed as a building block rather than a complete editor application

> [!TIP]
> Try it online: <https://semigarden.github.io/syntxt/>

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
npm install syntxt
```

#### React
```
npm install syntxt-react
```

## Usage

#### Vanilla
```
<html>
    <body>
        <synthetic-text />

        <script type="module">
            import 'syntxt'

            const element = document.querySelector('synthetic-text')

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
import { SyntheticText } from 'syntxt-react'

const App = () => {
    const [text, setText] = useState('')

    const onInput = (event) => {
        const text = event.target.value
        setText(text)
    }

    return <SyntheticText value={text} onInput={onInput} />
}
``` -->
