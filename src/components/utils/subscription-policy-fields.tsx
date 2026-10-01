import * as React from "react"
import intl from "react-intl-universal"
import { makeStyles } from "@griffel/react"
import { SubscriptionPolicy } from "../../schema-types"
import { IDropdownOption } from "@fluentui/react"
import { SettingsDropdown } from "./settings-dropdown"

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
    rows: { margin: 0, gap: 0 },
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
    disabled?: boolean
    layout?: "stack" | "rows"
}> = ({
    id,
    value,
    onChange,
    inherited = true,
    hideFrequency = false,
    disabled,
    layout = "stack",
}) => {
    const classes = useStyles()
    const [custom, setCustom] = React.useState(false)
    React.useEffect(() => setCustom(false), [id])
    const inheritOptions: IDropdownOption[] = inherited
        ? [{ key: "inherit", text: intl.get("policy.inherit") }]
        : []
    const field = (
        name: string,
        title: string,
        control: React.ReactNode,
        hint?: string
    ) => (
        <div
            className={
                layout === "rows" ? "modern-setting-row" : classes.label
            }>
            <div
                className={
                    layout === "rows" ? "modern-setting-copy" : undefined
                }>
                <label id={`${id}-${name}-label`} htmlFor={`${id}-${name}`}>
                    {layout === "rows" ? <strong>{title}</strong> : title}
                </label>
                {layout === "rows" && hint && <p>{hint}</p>}
            </div>
            {control}
            {layout === "stack" && hint && (
                <p className={classes.hint}>{hint}</p>
            )}
        </div>
    )
    return (
        <div
            className={layout === "rows" ? classes.rows : classes.root}
            data-policy-fields={id}>
            {field(
                "read",
                intl.get("policy.readBehavior"),
                <SettingsDropdown
                    id={`${id}-read`}
                    aria-labelledby={`${id}-read-label`}
                    disabled={disabled}
                    selectedKey={value.readBehavior || "inherit"}
                    options={[
                        ...inheritOptions,
                        { key: "auto", text: intl.get("policy.autoRead") },
                        { key: "manual", text: intl.get("policy.manualRead") },
                    ]}
                    onChange={(_, option) =>
                        onChange({
                            ...value,
                            readBehavior:
                                option.key === "inherit"
                                    ? undefined
                                    : (option.key as "auto" | "manual"),
                        })
                    }
                />
            )}
            {!hideFrequency && (
                <>
                    {field(
                        "strategy",
                        intl.get("policy.strategy"),
                        <SettingsDropdown
                            id={`${id}-strategy`}
                            aria-labelledby={`${id}-strategy-label`}
                            disabled={disabled}
                            selectedKey={value.strategy || "inherit"}
                            options={[
                                ...inheritOptions,
                                {
                                    key: "interval",
                                    text: intl.get("policy.intervalStrategy"),
                                },
                                {
                                    key: "publication",
                                    text: intl.get(
                                        "policy.publicationStrategy"
                                    ),
                                },
                            ]}
                            onChange={(_, option) =>
                                onChange({
                                    ...value,
                                    strategy:
                                        option.key === "inherit"
                                            ? undefined
                                            : (option.key as
                                                  | "interval"
                                                  | "publication"),
                                })
                            }
                        />,
                        intl.get("policy.strategyHint")
                    )}
                    {field(
                        "frequency",
                        intl.get("policy.frequency"),
                        <SettingsDropdown
                            id={`${id}-frequency`}
                            aria-labelledby={`${id}-frequency-label`}
                            disabled={disabled}
                            selectedKey={
                                custom ? "custom" : value.frequency ?? "inherit"
                            }
                            options={[
                                ...inheritOptions,
                                ...[
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
                                    .map(minutes => ({
                                        key: minutes,
                                        text: frequencyText(minutes),
                                    })),
                                {
                                    key: "custom",
                                    text: intl.get("policy.custom"),
                                },
                            ]}
                            onChange={(_, option) => {
                                setCustom(option.key === "custom")
                                if (option.key !== "custom")
                                    onChange({
                                        ...value,
                                        frequency:
                                            option.key === "inherit"
                                                ? undefined
                                                : Number(option.key),
                                    })
                            }}
                        />
                    )}
                    {custom &&
                        field(
                            "custom",
                            intl.get("policy.customMinutes"),
                            <input
                                id={`${id}-custom`}
                                className={classes.input}
                                disabled={disabled}
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
                        )}
                </>
            )}
        </div>
    )
}
