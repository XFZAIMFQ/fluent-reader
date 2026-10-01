import * as React from "react"
import { Dropdown, IDropdownProps } from "@fluentui/react"
import { makeStyles, mergeClasses } from "@griffel/react"
import { ChevronDown16Regular } from "@fluentui/react-icons"

const useStyles = makeStyles({
    root: {
        "minWidth": 0,
        "width": "100%",
        "& .ms-Dropdown": { height: "36px" },
        "& .ms-Dropdown:after": { borderRadius: "6px" },
        "& .ms-Dropdown-title": {
            height: "36px",
            lineHeight: "34px",
            borderRadius: "6px",
            padding: "0 36px 0 12px",
        },
        "& .ms-Dropdown-caretDownWrapper": {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            top: "1px",
            bottom: "1px",
            height: "auto",
            lineHeight: "normal",
            width: "32px",
            right: "4px",
            color: "var(--neutralSecondary)",
        },
        "& .ms-Dropdown[aria-disabled='true'] .ms-Dropdown-caretDownWrapper": {
            color: "var(--neutralTertiary)",
        },
    },
})

export const SettingsDropdown: React.FC<
    IDropdownProps & { styleClass?: string }
> = ({ styleClass, className, onRenderCaretDown, ...props }) => {
    const classes = useStyles()
    return (
        <Dropdown
            {...props}
            onRenderCaretDown={
                onRenderCaretDown || (() => <ChevronDown16Regular />)
            }
            className={mergeClasses(classes.root, className, styleClass)}
        />
    )
}
