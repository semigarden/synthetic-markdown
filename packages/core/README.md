# Synthetic Text

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
