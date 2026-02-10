# Synthetic Markdown

```
<html>
    <body>
        <synthetic-markdown />

        <script type="module">
            import 'synthetic-markdown'

            const element = document.querySelector('synthetic-markdown')

            let value = ''
            element.value = value

            element.addEventListener('input', (event) => {
                value = event.target.value
            })
        </script>
    </body>
</html>
```
