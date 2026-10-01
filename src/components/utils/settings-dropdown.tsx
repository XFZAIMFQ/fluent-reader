import * as React from "react"
import { Dropdown, IDropdownProps } from "@fluentui/react"
import { makeStyles, mergeClasses } from "@griffel/react"

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
        "& .ms-Dropdown-chevronDownWrapper": {
            height: "34px",
            lineHeight: "34px",
            width: "32px",
            right: "4px",
        },
    },
})

export const SettingsDropdown: React.FC<
    IDropdownProps & { styleClass?: string }
> = ({ styleClass, className, ...props }) => {
    const classes = useStyles()
    return (
        <Dropdown
            {...props}
            className={mergeClasses(classes.root, className, styleClass)}
        />
    )
}
