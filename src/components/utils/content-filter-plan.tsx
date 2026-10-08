import * as React from "react"
import intl from "react-intl-universal"
import { Toggle } from "@fluentui/react"
import { makeStyles, mergeClasses } from "@griffel/react"
import {
    Add16Regular,
    ChevronDown16Regular,
    ChevronRight16Regular,
    Delete16Regular,
} from "@fluentui/react-icons"
import { ContentFilterPlan, ContentFilterRule } from "../../schema-types"
import { validContentRule } from "../../scripts/content-filter"
import { FlatButton } from "./FlatButton"
import { SettingsDropdown } from "./settings-dropdown"

const useStyles = makeStyles({
    root: {
        border: "1px solid var(--neutralQuaternaryAlt)",
        borderRadius: "8px",
        overflow: "hidden",
        minWidth: 0,
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        backgroundColor: "var(--white)",
    },
    trigger: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flex: 1,
        minWidth: 0,
        width: "auto",
        height: "auto",
        minHeight: "64px",
        padding: "12px",
        textAlign: "left",
        lineHeight: "20px",
        cursor: "pointer",
    },
    copy: {
        display: "grid",
        gap: "2px",
        minWidth: 0,
        overflowWrap: "anywhere",
    },
    name: { fontWeight: 600, fontSize: "13px" },
    summary: { color: "var(--neutralSecondary)", fontSize: "12px" },
    icon: { flexShrink: 0 },
    editor: {
        padding: "12px",
        borderTop: "1px solid var(--neutralQuaternaryAlt)",
        backgroundColor: "var(--neutralLighterAlt)",
        display: "grid",
        gap: "12px",
    },
    hidden: { display: "none" },
    grid: {
        "display": "grid",
        "gridTemplateColumns": "minmax(0, 1fr) minmax(0, 1fr)",
        "gap": "12px",
        "@media (max-width: 560px)": { gridTemplateColumns: "minmax(0, 1fr)" },
    },
    label: { display: "grid", gap: "6px", fontSize: "12px", minWidth: 0 },
    full: { gridColumn: "1 / -1" },
    input: {
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        padding: "8px",
        border: "1px solid var(--neutralQuaternaryAlt)",
        borderRadius: "6px",
        backgroundColor: "var(--white)",
        color: "var(--neutralPrimary)",
        font: "inherit",
    },
    condition: {
        display: "grid",
        gap: "10px",
        paddingTop: "12px",
        borderTop: "1px solid var(--neutralQuaternaryAlt)",
    },
    actions: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
    },
    options: {
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        fontSize: "12px",
    },
    button: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        width: "auto",
        height: "auto",
        minHeight: "32px",
        padding: "0 10px",
        border: "1px solid var(--neutralQuaternaryAlt)",
        borderRadius: "6px",
        cursor: "pointer",
        lineHeight: "20px",
        fontSize: "12px",
        justifySelf: "start",
    },
    error: { margin: 0, color: "var(--red)", fontSize: "12px" },
})

export function newContentFilterRule(): ContentFilterRule {
    return {
        field: "tags",
        pattern: "",
        regex: false,
        exclude: false,
        caseSensitive: false,
    }
}

export default function ContentFilterPlanFields({
    id,
    value: plan,
    expanded,
    disabled,
    onExpand,
    onChange,
    onDelete,
}: {
    id: string
    value: ContentFilterPlan
    expanded: boolean
    disabled?: boolean
    onExpand: () => void
    onChange: (plan: ContentFilterPlan) => void
    onDelete: () => void
}) {
    const classes = useStyles()
    const name = plan.name || intl.get("contentFilter.defaultPlan")
    const changeRule = (index: number, patch: Partial<ContentFilterRule>) =>
        onChange({
            ...plan,
            rules: plan.rules.map((rule, i) =>
                i === index ? { ...rule, ...patch } : rule
            ),
        })
    const dropdown = (
        suffix: string,
        label: string,
        selected: string,
        keys: string[],
        onSelect: (key: string) => void
    ) => (
        <div className={classes.label}>
            <label id={`${id}-${suffix}-label`} htmlFor={`${id}-${suffix}`}>
                {intl.get(`contentFilter.${label}`)}
            </label>
            <SettingsDropdown
                id={`${id}-${suffix}`}
                aria-labelledby={`${id}-${suffix}-label`}
                disabled={disabled}
                selectedKey={selected}
                options={keys.map(key => ({
                    key,
                    text: intl.get(`contentFilter.${key}`),
                }))}
                onChange={(_, option) => onSelect(String(option.key))}
            />
        </div>
    )
    return (
        <div
            className={classes.root}
            data-filter-plan={plan.id}
            data-enabled={plan.enabled}>
            <div className={classes.header}>
                <FlatButton
                    styleClass={classes.trigger}
                    aria-expanded={expanded}
                    aria-controls={`${id}-editor`}
                    onClick={onExpand}>
                    {expanded ? (
                        <ChevronDown16Regular className={classes.icon} />
                    ) : (
                        <ChevronRight16Regular className={classes.icon} />
                    )}
                    <span className={classes.copy}>
                        <span className={classes.name}>{name}</span>
                        <span className={classes.summary}>
                            {intl.get("contentFilter.planSummary", {
                                count: plan.rules.length,
                                match: intl.get(`contentFilter.${plan.match}`),
                            })}{" "}
                            ·{" "}
                            {plan.rules
                                .map(
                                    rule =>
                                        rule.pattern ||
                                        intl.get("contentFilter.emptyCondition")
                                )
                                .join(" / ")}
                        </span>
                    </span>
                </FlatButton>
                <Toggle
                    checked={plan.enabled}
                    disabled={disabled}
                    ariaLabel={intl.get("contentFilter.enablePlan", { name })}
                    onText={intl.get("contentFilter.enabled")}
                    offText={intl.get("contentFilter.disabled")}
                    inlineLabel
                    styles={{
                        root: { margin: "0 12px 0 0", flexShrink: 0 },
                        text: { fontSize: 12 },
                    }}
                    onChange={(_, enabled) => onChange({ ...plan, enabled })}
                />
            </div>
            <div
                id={`${id}-editor`}
                className={mergeClasses(
                    classes.editor,
                    !expanded && classes.hidden
                )}
                hidden={!expanded}>
                <div className={classes.grid}>
                    <label className={classes.label} htmlFor={`${id}-name`}>
                        {intl.get("contentFilter.planName")}
                        <input
                            id={`${id}-name`}
                            className={classes.input}
                            disabled={disabled}
                            value={plan.name}
                            maxLength={80}
                            onChange={event =>
                                onChange({ ...plan, name: event.target.value })
                            }
                        />
                    </label>
                    {dropdown(
                        "match",
                        "planMatch",
                        plan.match,
                        ["all", "any"],
                        match =>
                            onChange({ ...plan, match: match as "all" | "any" })
                    )}
                </div>
                {plan.rules.map((rule, index) => (
                    <div
                        key={index}
                        className={classes.condition}
                        data-filter-condition={index}>
                        <div className={classes.actions}>
                            <span className={classes.summary}>
                                {intl.get("contentFilter.condition", {
                                    n: index + 1,
                                })}
                            </span>
                            {plan.rules.length > 1 && (
                                <FlatButton
                                    styleClass={classes.button}
                                    disabled={disabled}
                                    ariaLabel={intl.get(
                                        "contentFilter.deleteCondition",
                                        { n: index + 1 }
                                    )}
                                    onClick={() =>
                                        onChange({
                                            ...plan,
                                            rules: plan.rules.filter(
                                                (_, i) => i !== index
                                            ),
                                        })
                                    }>
                                    <Delete16Regular />
                                    {intl.get("delete")}
                                </FlatButton>
                            )}
                        </div>
                        <div className={classes.grid}>
                            {dropdown(
                                `field-${index}`,
                                "field",
                                rule.field,
                                ["tags", "title", "content", "creator"],
                                field =>
                                    changeRule(index, {
                                        field: field as ContentFilterRule["field"],
                                    })
                            )}
                            {dropdown(
                                `direction-${index}`,
                                "direction",
                                rule.exclude ? "exclude" : "include",
                                ["include", "exclude"],
                                direction =>
                                    changeRule(index, {
                                        exclude: direction === "exclude",
                                    })
                            )}
                            <div className={classes.full}>
                                <label
                                    className={classes.label}
                                    htmlFor={`${id}-pattern-${index}`}>
                                    {intl.get("contentFilter.pattern")}
                                    <input
                                        id={`${id}-pattern-${index}`}
                                        className={classes.input}
                                        disabled={disabled}
                                        value={rule.pattern}
                                        maxLength={512}
                                        aria-invalid={
                                            plan.enabled &&
                                            !validContentRule(rule)
                                        }
                                        onChange={event =>
                                            changeRule(index, {
                                                pattern: event.target.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>
                        </div>
                        <div className={classes.options}>
                            <label>
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={rule.regex}
                                    onChange={event =>
                                        changeRule(index, {
                                            regex: event.target.checked,
                                        })
                                    }
                                />
                                {intl.get("contentFilter.regex")}
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={rule.caseSensitive}
                                    onChange={event =>
                                        changeRule(index, {
                                            caseSensitive: event.target.checked,
                                        })
                                    }
                                />
                                {intl.get("contentFilter.caseSensitive")}
                            </label>
                        </div>
                        {plan.enabled && !validContentRule(rule) && (
                            <p className={classes.error} role="alert">
                                {intl.get("contentFilter.invalid")}
                            </p>
                        )}
                    </div>
                ))}
                <FlatButton
                    styleClass={classes.button}
                    disabled={disabled}
                    onClick={() =>
                        onChange({
                            ...plan,
                            rules: [...plan.rules, newContentFilterRule()],
                        })
                    }>
                    <Add16Regular />
                    {intl.get("contentFilter.add")}
                </FlatButton>
                <div className={classes.actions}>
                    <FlatButton
                        styleClass={classes.button}
                        disabled={disabled}
                        onClick={onDelete}>
                        <Delete16Regular />
                        {intl.get("contentFilter.deletePlan")}
                    </FlatButton>
                    <FlatButton styleClass={classes.button} onClick={onExpand}>
                        {intl.get("contentFilter.collapse")}
                    </FlatButton>
                </div>
            </div>
        </div>
    )
}
