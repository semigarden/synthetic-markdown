import { SyntheticText } from './visual/SyntheticText (original)'

if (!customElements.get('synthetic-text')) {
    customElements.define('synthetic-text', SyntheticText)
}
