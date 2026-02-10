import { useState, useEffect } from 'react'
import { createHighlighter } from 'shiki'
import styles from '../styles/Guide.module.scss'
import CopyIcon from '../assets/copy.svg?react'

const usageVanilla = `<!doctype html>
<html>
    <body>
        <synthetic-markdown />
        <script type='module'>
            import 'synthetic-markdown'

            const element = document.querySelector('synthetic-markdown')

            let value = ''
            element.value = value

            element.addEventListener('input', (event) => {
                value = event.target.value
            })
        </script>
    </body>
</html>`

const usageReact = `import { useState } from 'react'
import { SyntheticMarkdown } from 'synthetic-markdown-react'

const App = () => {
    const [text, setText] = useState('')

    const onInput = (event) => {
        const text = event.target.value
        setText(text)
    }

    return <SyntheticMarkdown value={text} onInput={onInput} />
}
    
export default App
`

const Guide = ({ className = '', active = false, theme = 'dark' }: { className?: string, active?: boolean, theme?: string }) => {
    const [installTab, setInstallTab] = useState('vanilla')
    const [usageTab, setUsageTab] = useState('vanilla')
    const [apiTab, setApiTab] = useState('vanilla')
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [html, setHtml] = useState('')

    useEffect(() => {
        let cancelled = false

        const code = usageTab === 'react' ? usageReact : usageVanilla
        const lang = usageTab === 'react' ? 'jsx' : 'html';

        (async () => {
            const highlighter = await createHighlighter({
                themes: ['tokyo-night', 'min-light'],
                langs: usageTab === 'react' ? ['jsx'] : ['html'],
            })
        
            const codeTheme =
                theme === 'dark'
                ? 'tokyo-night'
                : 'min-light'
        
            const out = highlighter.codeToHtml(code, { lang, theme: codeTheme })
        
            if (!cancelled) setHtml(out)
        })()
    
        return () => {
            cancelled = true
        }
    }, [usageTab, theme])

    const copy = (key: string, text: string) => {
        setCopiedKey(key)
        navigator.clipboard.writeText(text)
        setTimeout(() => {
            setCopiedKey(null)
        }, 1000)
    }

    return (
        <div className={`${styles.guide} ${active && styles.active} ${className}`}>
            <h2 className={styles.overview}>Overview</h2>
            <p><strong>Synthetic Markdown</strong> is a WYSIWYG editor built as a primitive UI component. It's core is written in TypeScript and can be adapted to any modern framework. The project is designed as a building block, rather than a full editor and aims to be minimalistic and self sufficient. No external dependencies are required. No need for toolbars or menus. Just a simple component that you can use to create any type of application you want.
            </p>
            <hr/>
            <h2>Status</h2>
            <p>This project is still in development. Interactions with the following blocks are not yet fully implemented: <em>Tables, Task Lists, Code Blocks</em>.</p>
            <div className={styles.supported}>
                <div className={styles.supportGroup}>
                    <span className={styles.supportLabel}>Blocks</span>
                    <div className={styles.supportTags}>
                        {['Paragraph', 'Heading', 'Block Quote', 'List', 'List Item', 'Thematic Break'].map((name) => (
                            <span key={name} className={styles.tag}>{name}</span>
                        ))}
                    </div>
                </div>
                <div className={styles.supportGroup}>
                    <span className={styles.supportLabel}>Inlines</span>
                    <div className={styles.supportTags}>
                        {['Text', 'Strong', 'Emphasis', 'Strikethrough', 'Code Span', 'Link', 'Autolink', 'Image'].map((name) => (
                            <span key={name} className={styles.tag}>{name}</span>
                        ))}
                    </div>
                </div>
            </div>
            <hr/>
            <h2>Try It Online</h2>
            <p>Visit the sandbox page and start typing to explore supported <a href="https://www.markdownguide.org/" target="_blank">Markdown</a> syntax.
            </p>
            <hr/>
            <h2>Installation</h2>
            <div className={styles.code}>
                <div className={styles.header}>
                    <div className={styles.tabs}>
                        <div className={`${styles.tab} ${installTab === 'vanilla' && styles.active}`} onClick={() => setInstallTab('vanilla')}>Vanilla</div>
                        <div className={`${styles.tab} ${installTab === 'react' && styles.active}`} onClick={() => setInstallTab('react')}>React</div>
                    </div>
                    <button className={styles.button} onClick={() => {
                        if (installTab === 'vanilla') copy('install-vanilla', 'npm install synthetic-markdown')
                        else copy('install-react', 'npm install synthetic-markdown-react')
                    }}
                    title="Copy">
                        {copiedKey === 'install-vanilla' || copiedKey === 'install-react' ? <span className={styles.icon} title="Copied">✓</span> : <CopyIcon className={styles.icon} title="Copy" />}
                    </button>
                </div>
                
                <div className={styles.blocks}>
                    {installTab === 'vanilla' && <div className={styles.content}>
                        <span className={styles.language}>bash</span>
                        <pre>
                            <code>
                                npm install synthetic-markdown
                            </code>
                        </pre>
                    </div>}
                    {installTab === 'react' && <div className={styles.content}>
                        <span className={styles.language}>bash</span>
                        <pre>
                            <code>
                                npm install synthetic-markdown-react
                            </code>
                        </pre>
                    </div>}
                    
                </div>
            </div>
            <p/>
            <hr/>
            <h2>Usage</h2>
            <div className={styles.code}>
                <div className={styles.header}>
                    <div className={styles.tabs}>
                        <div className={`${styles.tab} ${usageTab === 'vanilla' && styles.active}`} onClick={() => setUsageTab('vanilla')}>Vanilla</div>
                        <div className={`${styles.tab} ${usageTab === 'react' && styles.active}`} onClick={() => setUsageTab('react')}>React</div>
                    </div>
                    <button className={styles.button} onClick={() => {
                        if (usageTab === 'vanilla') copy('usage-vanilla', usageVanilla)
                        else copy('usage-react', usageReact)
                    }} title="Copy">
                        {copiedKey === 'usage-vanilla' || copiedKey === 'usage-react' ? <span className={styles.icon} title="Copied">✓</span> : <CopyIcon className={styles.icon} title="Copy" />}
                    </button>
                </div>
                <div className={styles.blocks}>
                    <div className={styles.content}>
                        <span className={styles.language}>{usageTab === 'vanilla' ? 'html' : 'jsx'}</span>
                        <code className={styles.code} dangerouslySetInnerHTML={{ __html: html }} />
                    </div>
                </div>
            </div>
            <hr/>
            <h2>API</h2>
            <div className={styles.api}>
                <div className={styles.code}>
                    <div className={styles.header}>
                        <div className={styles.tabs}>
                            <div className={`${styles.tab} ${apiTab === 'vanilla' && styles.active}`} onClick={() => setApiTab('vanilla')}>Vanilla</div>
                            <div className={`${styles.tab} ${apiTab === 'react' && styles.active}`} onClick={() => setApiTab('react')}>React</div>
                        </div>
                    </div>
                    <div className={styles.blocks}>
                        <div className={styles.docs}>
                            {apiTab === 'vanilla' && <>
                                <h4>Attributes &amp; properties</h4>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Type</th>
                                            <th>Default</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>class</strong></td>
                                            <td><code>string</code></td>
                                            <td><code>-</code></td>
                                            <td>Class name to apply to the host element (<code>element.className</code>)</td>
                                        </tr>
                                        <tr>
                                            <td><strong>value</strong></td>
                                            <td><code>string</code></td>
                                            <td><code>-</code></td>
                                            <td>Value of the editor. Set via <code>element.value</code> or initial <code>value</code> attribute</td>
                                        </tr>
                                        <tr>
                                            <td><strong>autofocus</strong></td>
                                            <td><code>boolean</code></td>
                                            <td><code>false</code></td>
                                            <td>If set, the editor will be focused on mount (<code>element.autofocus</code> or <code>autofocus</code> attribute)</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <h4>Events</h4>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>input</strong></td>
                                            <td><p>
                                                Fired when the value changes. Use <code>element.addEventListener('input', handler)</code></p><p>
                                                The new value is available as <code>event.target.value</code> (string)</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </>}
                            {apiTab === 'react' && <>
                                <h4>Props</h4>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Type</th>
                                            <th>Default</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>className</strong></td>
                                            <td><code>string</code></td>
                                            <td><code>-</code></td>
                                            <td>Class name to apply to the component</td>
                                        </tr>
                                        <tr>
                                            <td><strong>value</strong></td>
                                            <td><code>string</code></td>
                                            <td><code>-</code></td>
                                            <td>Value of the editor</td>
                                        </tr>
                                        <tr>
                                            <td><strong>autofocus</strong></td>
                                            <td><code>boolean</code></td>
                                            <td><code>false</code></td>
                                            <td>If true, the editor will be focused on mount</td>
                                        </tr>
                                        <tr>
                                            <td><strong>onInput</strong></td>
                                            <td><code>function</code></td>
                                            <td><code>-</code></td>
                                            <td><p>
                                                Callback fired when value is changed.</p><p>
                                                <code>{`function(event: Event) => void`}</code>
                                                <ul>
                                                    <li><code>event</code> - The event source of the callback. You can access the new value via <code>event.target.value</code> (string)</li>
                                                </ul>
                                            </p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Guide
