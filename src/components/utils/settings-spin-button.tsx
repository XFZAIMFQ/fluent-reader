import * as React from "react"
import intl from "react-intl-universal"
import { SpinButton, ISpinButtonProps } from "@fluentui/react"
import { ChevronUp16Regular, ChevronDown16Regular } from "@fluentui/react-icons"
import { makeStyles, mergeClasses } from "@griffel/react"

const useStyles = makeStyles({
    root: {
        "minWidth": 0,
        "& .ms-UpButton, & .ms-DownButton": {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            color: "var(--neutralSecondary)",
        },
        "& .ms-UpButton[disabled], & .ms-DownButton[disabled]": {
            color: "var(--neutralTertiary)",
        },
    },
})

export const SettingsSpinButton: React.FC<ISpinButtonProps> = props => {
    const classes = useStyles()
    return (
        <SpinButton
            {...props}
            className={mergeClasses(classes.root, props.className)}
            iconButtonProps={{
                ...props.iconButtonProps,
                onRenderIcon: button =>
                    button.className?.includes("ms-UpButton") ? (
                        <ChevronUp16Regular />
                    ) : (
                        <ChevronDown16Regular />
                    ),
            }}
            incrementButtonAriaLabel={intl.get("settingsControls.increase", {
                label: props.ariaLabel,
            })}
            decrementButtonAriaLabel={intl.get("settingsControls.decrease", {
                label: props.ariaLabel,
            })}
            styles={{
                ...props.styles,
                spinButtonWrapper: [
                    { height: "36px", borderRadius: "6px" },
                    props.styles?.spinButtonWrapper,
                ],
                arrowButtonsContainer: [
                    { width: "32px" },
                    props.styles?.arrowButtonsContainer,
                ],
            }}
        />
    )
}
