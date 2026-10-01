import * as React from "react"
import { makeStyles, mergeClasses } from "@griffel/react"

const useStyles = makeStyles({
    root: {
        ":not(:first-child)": { marginTop: "30px" },
    },
    description: {
        margin: "0 0 12px",
        fontSize: "12px",
        lineHeight: "1.5",
        color: "var(--neutralSecondary)",
    },
})

export const SettingsSection: React.FC<{
    title: string
    description?: string
    styleClass?: string
}> = ({ title, description, styleClass, children }) => {
    const classes = useStyles()
    return (
        <section className={mergeClasses(classes.root, styleClass)}>
            <h2 className="modern-settings-section-title">{title}</h2>
            {description && (
                <p className={classes.description}>{description}</p>
            )}
            {children}
        </section>
    )
}
