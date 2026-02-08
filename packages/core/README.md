# Synthetic Text

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
