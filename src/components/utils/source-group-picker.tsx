import * as React from "react"
import intl from "react-intl-universal"
import { Combobox, Option } from "@fluentui/react-components"
import { makeStyles } from "@griffel/react"
import { SourceGrouping } from "../../scripts/models/group"
import { useAppSelector } from "../../scripts/reducer"

const useStyles = makeStyles({
    root: {
        "width": "100%",
        "minWidth": 0,
        "boxSizing": "border-box",
        "backgroundColor": "var(--white)",
        "color": "var(--neutralPrimary)",
        "& input": { color: "inherit" },
    },
    hint: {
        fontSize: "12px",
        color: "var(--neutralSecondary)",
        marginTop: "6px",
    },
})

export const SourceGroupPicker: React.FC<{
    id: string
    value: SourceGrouping
    onChange: (value: SourceGrouping) => void
    disabled?: boolean
}> = ({ id, value, onChange, disabled }) => {
    const classes = useStyles()
    const groups = useAppSelector(state => state.groups).filter(
        group => group.isMultiple
    )
    const text =
        value.mode === "auto"
            ? intl.get("subscriptions.autoGroup")
            : value.mode === "none"
            ? intl.get("sources.ungrouped")
            : value.name || ""
    return (
        <>
            <Combobox
                id={id}
                className={classes.root}
                aria-label={intl.get("groups.group")}
                disabled={disabled}
                freeform
                value={text}
                selectedOptions={[
                    value.mode === "manual"
                        ? `group:${value.name}`
                        : value.mode,
                ]}
                onOptionSelect={(_, data) => {
                    if (data.optionValue === undefined) return
                    onChange(
                        data.optionValue === "auto" ||
                            data.optionValue === "none"
                            ? { mode: data.optionValue }
                            : { mode: "manual", name: data.optionText || "" }
                    )
                }}
                onChange={event =>
                    onChange({ mode: "manual", name: event.target.value })
                }>
                <Option value="auto">
                    {intl.get("subscriptions.autoGroup")}
                </Option>
                <Option value="none">{intl.get("sources.ungrouped")}</Option>
                {groups.map(group => (
                    <Option key={group.name} value={`group:${group.name}`}>
                        {group.name}
                    </Option>
                ))}
            </Combobox>
            {value.mode === "manual" &&
                value.name?.trim() &&
                !groups.some(group => group.name === value.name.trim()) && (
                    <div className={classes.hint}>
                        {intl.get("subscriptions.createOnSave", {
                            name: value.name.trim(),
                        })}
                    </div>
                )}
        </>
    )
}
