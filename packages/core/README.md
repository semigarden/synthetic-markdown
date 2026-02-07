# Synthetic Markdown

A UI primitive for unified Markdown editing and rendering

---

```
import { defineElement } from 'synthetic-md'

defineElement()

const syntheticElement = document.querySelector<any>('#synthetic')

syntheticElement.addClasses(['synthetic'])

syntheticElement.addEventListener('change', (e) => {
    const text = e.target.value
    console.log(text)
})

syntheticElement.value = '# Hello'
```
