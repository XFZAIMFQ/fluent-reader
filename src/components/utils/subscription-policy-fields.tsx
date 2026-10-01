import * as React from "react"
import intl from "react-intl-universal"
import { makeStyles } from "@griffel/react"
import { SubscriptionPolicy } from "../../schema-types"

const useStyles = makeStyles({
    root: {
        display: "grid",
        gap: "12px",
        marginTop: "12px",
        marginBottom: "12px",
    },
    label: { display: "grid", gap: "6px", fontSize: "13px" },
    input: {
        width: "100%",
        boxSizing: "border-box",
        padding: "7px 10px",
        border: "1px solid var(--neutralQuaternaryAlt)",
        borderRadius: "6px",
        backgroundColor: "var(--white)",
        color: "var(--neutralPrimary)",
        font: "inherit",
    },
    hint: { margin: 0, color: "var(--neutralSecondary)", fontSize: "12px" },
})

export function frequencyText(minutes: number): string {
    if (!minutes) return intl.get("policy.manualUpdates")
    if (minutes % 10080 === 0)
        return intl.get("policy.weeks", { n: minutes / 10080 })
    if (minutes % 1440 === 0)
        return intl.get("policy.days", { n: minutes / 1440 })
    if (minutes % 60 === 0) return intl.get("time.hour", { h: minutes / 60 })
    return intl.get("time.minute", { m: minutes })
}

export const SubscriptionPolicyFields: React.FC<{
    id: string
    value: SubscriptionPolicy
    onChange: (value: SubscriptionPolicy) => void
    inherited?: boolean
    hideFrequency?: boolean
}> = ({ id, value, onChange, inherited = true, hideFrequency = false }) => {
    const classes = useStyles()
    const [custom, setCustom] = React.useState(false)
    React.useEffect(() => setCustom(false), [id])
    return (
        <div className={classes.root} data-policy-fields={id}>
            <label className={classes.label} htmlFor={`${id}-read`}>
                {intl.get("policy.readBehavior")}
                <select
                    id={`${id}-read`}
                    className={classes.input}
                    value={value.readBehavior || "inherit"}
                    onChange={event =>
                        onChange({
                            ...value,
                            readBehavior:
                                event.target.value === "inherit"
                                    ? undefined
                                    : (event.target.value as "auto" | "manual"),
                        })
                    }>
                    {inherited && (
                        <option value="inherit">
                            {intl.get("policy.inherit")}
                        </option>
                    )}
                    <option value="auto">{intl.get("policy.autoRead")}</option>
                    <option value="manual">
                        {intl.get("policy.manualRead")}
                    </option>
                </select>
            </label>
            {!hideFrequency && (
                <>
                    <label
                        className={classes.label}
                        htmlFor={`${id}-frequency`}>
                        {intl.get("policy.frequency")}
                        <select
                            id={`${id}-frequency`}
                            className={classes.input}
                            value={custom ? "custom" : value.frequency ?? -1}
                            onChange={event => {
                                if (event.target.value === "custom")
                                    setCustom(true)
                                else {
                                    setCustom(false)
                                    onChange({
                                        ...value,
                                        frequency:
                                            Number(event.target.value) < 0
                                                ? undefined
                                                : Number(event.target.value),
                                    })
                                }
                            }}>
                            {inherited && (
                                <option value={-1}>
                                    {intl.get("policy.inherit")}
                                </option>
                            )}
                            {[
                                ...new Set([
                                    0,
                                    15,
                                    30,
                                    60,
                                    120,
                                    360,
                                    720,
                                    1440,
                                    4320,
                                    10080,
                                    20160,
                                    43200,
                                    ...(value.frequency === undefined
                                        ? []
                                        : [value.frequency]),
                                ]),
                            ]
                                .sort((a, b) => a - b)
                                .map(minutes => (
                                    <option key={minutes} value={minutes}>
                                        {frequencyText(minutes)}
                                    </option>
                                ))}
                            <option value="custom">
                                {intl.get("policy.custom")}
                            </option>
                        </select>
                    </label>
                    {custom && (
                        <label
                            className={classes.label}
                            htmlFor={`${id}-custom`}>
                            {intl.get("policy.customMinutes")}
                            <input
                                id={`${id}-custom`}
                                className={classes.input}
                                type="number"
                                min={1}
                                max={525600}
                                value={value.frequency || 60}
                                onChange={event => {
                                    const frequency = Number(event.target.value)
                                    if (
                                        Number.isInteger(frequency) &&
                                        frequency >= 1 &&
                                        frequency <= 525600
                                    )
                                        onChange({ ...value, frequency })
                                }}
                            />
                        </label>
                    )}
                </>
            )}
        </div>
    )
}
