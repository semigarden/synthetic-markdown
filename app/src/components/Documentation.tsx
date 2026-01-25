import styles from '../styles/Documentation.module.scss'

const Documentation = ({ className = '', active = false }: { className?: string, active?: boolean }) => {
    return (
        <div className={`${styles.documentation} ${active && styles.active} ${className}`}>
            ...
        </div>
    )
}

export default Documentation
