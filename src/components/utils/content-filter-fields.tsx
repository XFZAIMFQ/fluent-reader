import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import intl from "react-intl-universal"
import { makeStyles } from "@griffel/react"
import lf from "lovefield"
import * as db from "../../scripts/db"
import { ContentFilter, ContentFilterPlan } from "../../schema-types"
import { RSSSource } from "../../scripts/models/source"
import type { SourceGrouping } from "../../scripts/models/group"
import {
    contentFilterPlans,
    contentFiltersForSources,
    contentFilterPredicate,
    validContentFilter,
} from "../../scripts/content-filter"
import { inheritedSubscriptionPolicy } from "../../scripts/subscription-policy"
import { useAppSelector } from "../../scripts/reducer"
import { FlatButton } from "./FlatButton"
import { SettingsDropdown } from "./settings-dropdown"
import { Add16Regular } from "@fluentui/react-icons"
import ContentFilterPlanFields, {
    newContentFilterRule,
} from "./content-filter-plan"

const useStyles = makeStyles({
    root: {
        display: "grid",
        gap: "10px",
        marginTop: "16px",
        marginBottom: "16px",
    },
    grid: {
        "display": "grid",
        "gridTemplateColumns": "minmax(0, 1fr) minmax(0, 1fr)",
        "gap": "12px",
        "@media (max-width: 560px)": { gridTemplateColumns: "minmax(0, 1fr)" },
    },
    actions: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
    },
    hint: {
        margin: 0,
        color: "var(--neutralSecondary)",
        fontSize: "12px",
        lineHeight: "18px",
        overflowWrap: "anywhere",
    },
    error: { color: "var(--red)", fontSize: "12px" },
    button: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        width: "auto",
        paddingLeft: "12px",
        paddingRight: "12px",
        border: "1px solid var(--neutralQuaternaryAlt)",
        borderRadius: "6px",
        cursor: "pointer",
        justifySelf: "start",
    },
})

export default function ContentFilterFields({
    id,
    value,
    onChange,
    disabled,
    source,
    grouping,
    sids = [],
    groupName,
}: {
    id: string
    value?: ContentFilter
    onChange: (value: ContentFilter) => void
    disabled?: boolean
    source?: RSSSource
    grouping?: SourceGrouping
    sids?: number[]
    groupName?: string
}) {
    const classes = useStyles()
    const sources = useAppSelector(state => state.sources)
    const groups = useAppSelector(state => state.groups)
    const preferences = useAppSelector(state => state.page.readerPreferences)
    const isGroup = groupName !== undefined
    const filter: ContentFilter = value || {
        mode: isGroup ? "off" : "inherit",
        match: "all",
        rules: [],
    }
    const editable = filter.mode === "append" || filter.mode === "replace"
    const valid = validContentFilter(filter)
    const ids = source ? [source.sid] : sids
    const previewState = useMemo(() => {
        let previewGroups = groups
        let previewSources = ids.map(sid => sources[sid]).filter(Boolean)
        if (isGroup) {
            // Preview the folder default while preserving each source's override.
            previewGroups = groups.map(group => ({
                ...group,
                sids: group.sids.filter(sid => !ids.includes(sid)),
            }))
            previewGroups = [
                ...previewGroups,
                {
                    isMultiple: true,
                    name: groupName,
                    sids: ids,
                    policy: { contentFilter: filter },
                },
            ]
        } else if (source) {
            previewSources = [
                {
                    ...source,
                    policy: { ...source.policy, contentFilter: filter },
                    autoGroup:
                        grouping?.mode === "none" ? false : source.autoGroup,
                },
            ]
            if (grouping) {
                previewGroups = groups.map(group => ({
                    ...group,
                    sids: group.sids.filter(sid => sid !== source.sid),
                }))
                if (grouping.mode === "manual") {
                    const parent = groups.find(
                        group =>
                            group.isMultiple &&
                            group.name === grouping.name?.trim()
                    )
                    previewGroups = [
                        ...previewGroups,
                        {
                            isMultiple: true,
                            name: grouping.name?.trim(),
                            sids: [source.sid],
                            policy: parent?.policy,
                        },
                    ]
                } else previewSources[0].autoGroup = grouping.mode === "auto"
            }
        }
        return { sources: previewSources, groups: previewGroups }
    }, [
        source,
        sources,
        groups,
        preferences,
        JSON.stringify(ids),
        JSON.stringify(filter),
        JSON.stringify(grouping),
        groupName,
    ])
    const inherited =
        source &&
        inheritedSubscriptionPolicy(
            previewState.sources[0],
            previewState.groups,
            preferences
        )
    const inheritedFilter = inherited?.policy?.contentFilter
    const inheritedPlans =
        inheritedFilter && ["append", "replace"].includes(inheritedFilter.mode)
            ? contentFilterPlans(inheritedFilter).filter(plan => plan.enabled)
            : []
    const [preview, setPreview] =
        useState<{ total: number; matched: number; titles: string[] }>(null)
    const [previewError, setPreviewError] = useState(false)
    useEffect(() => {
        let cancelled = false
        setPreview(null)
        setPreviewError(false)
        if (!valid || !previewState.sources.length || !db.itemsDB) return
        const timer = setTimeout(async () => {
            try {
                const ids = previewState.sources.map(source => source.sid)
                const base = () =>
                    lf.op.and(
                        db.items.source.in(ids),
                        db.items.hidden.eq(false)
                    )
                const condition = () =>
                    lf.op.and(
                        base(),
                        contentFilterPredicate(
                            ids,
                            contentFiltersForSources(
                                previewState.sources,
                                previewState.groups,
                                preferences
                            )
                        )
                    )
                const [total, matched, examples] = await Promise.all([
                    db.itemsDB
                        .select(lf.fn.count(db.items._id))
                        .from(db.items)
                        .where(base())
                        .exec(),
                    db.itemsDB
                        .select(lf.fn.count(db.items._id))
                        .from(db.items)
                        .where(condition())
                        .exec(),
                    db.itemsDB
                        .select(db.items.title)
                        .from(db.items)
                        .where(condition())
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(3)
                        .exec(),
                ])
                if (!cancelled)
                    setPreview({
                        total: total[0]["COUNT(_id)"],
                        matched: matched[0]["COUNT(_id)"],
                        titles: examples.map(
                            item => (item as { title: string }).title
                        ),
                    })
            } catch {
                if (!cancelled) setPreviewError(true)
            }
        }, 250)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [previewState, preferences, valid])
    const plans = contentFilterPlans(filter).map(plan =>
        filter.plans
            ? plan
            : { ...plan, name: intl.get("contentFilter.defaultPlan") }
    )
    const [expanded, setExpanded] = useState<string>(null)
    useEffect(() => setExpanded(null), [id, source?.sid, groupName])
    const changePlans = (plans: ContentFilterPlan[]) =>
        onChange({ ...filter, rules: [], plans })
    return (
        <section
            className={classes.root}
            aria-labelledby={`${id}-heading`}
            data-content-filter={id}>
            <strong id={`${id}-heading`}>
                {intl.get("contentFilter.heading")}
            </strong>
            <p className={classes.hint}>{intl.get("contentFilter.hint")}</p>
            <div className={classes.grid}>
                <SettingsDropdown
                    id={`${id}-mode`}
                    label={intl.get("contentFilter.mode")}
                    disabled={disabled}
                    selectedKey={
                        isGroup && filter.mode === "inherit"
                            ? "off"
                            : filter.mode
                    }
                    options={(isGroup
                        ? ["replace", "off"]
                        : ["inherit", "append", "replace", "off"]
                    ).map(key => ({
                        key,
                        text: intl.get(`contentFilter.${key}`),
                    }))}
                    onChange={(_, option) =>
                        onChange({
                            ...filter,
                            mode: option.key as ContentFilter["mode"],
                        })
                    }
                />
                {editable && (
                    <SettingsDropdown
                        id={`${id}-match`}
                        label={intl.get("contentFilter.combinePlans")}
                        disabled={disabled}
                        selectedKey={filter.match}
                        options={["all", "any"].map(key => ({
                            key,
                            text: intl.get(`contentFilter.${key}Plans`),
                        }))}
                        onChange={(_, option) =>
                            onChange({
                                ...filter,
                                match: option.key as "all" | "any",
                                rules: [],
                                plans,
                            })
                        }
                    />
                )}
            </div>
            {inherited?.name &&
                (filter.mode === "inherit" || filter.mode === "append") && (
                    <details className={classes.hint}>
                        <summary>
                            {intl.get("contentFilter.inherited", {
                                name: inherited.name,
                                count: inheritedPlans.reduce(
                                    (count, plan) => count + plan.rules.length,
                                    0
                                ),
                            })}
                        </summary>
                        {inheritedPlans.map(plan => (
                            <div key={plan.id}>
                                <strong>
                                    {plan.name ||
                                        intl.get("contentFilter.defaultPlan")}
                                </strong>{" "}
                                · {intl.get(`contentFilter.${plan.match}`)}
                                {plan.rules.map((rule, index) => (
                                    <div key={index}>
                                        {intl.get(
                                            `contentFilter.${rule.field}`
                                        )}{" "}
                                        ·{" "}
                                        {intl.get(
                                            rule.exclude
                                                ? "contentFilter.exclude"
                                                : "contentFilter.include"
                                        )}{" "}
                                        · {rule.pattern}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </details>
                )}
            {editable && (
                <>
                    <div className={classes.actions}>
                        <div>
                            <strong>{intl.get("contentFilter.plans")}</strong>
                            <span className={classes.hint}>
                                {" "}
                                ·{" "}
                                {intl.get("contentFilter.enabledCount", {
                                    enabled: plans.filter(plan => plan.enabled)
                                        .length,
                                    total: plans.length,
                                })}
                            </span>
                        </div>
                        <FlatButton
                            styleClass={classes.button}
                            disabled={disabled}
                            onClick={() => {
                                const plan: ContentFilterPlan = {
                                    id: `plan-${Date.now()}-${Math.random()
                                        .toString(36)
                                        .slice(2, 8)}`,
                                    name: intl.get("contentFilter.newPlan"),
                                    enabled: true,
                                    match: "all",
                                    rules: [newContentFilterRule()],
                                }
                                changePlans([...plans, plan])
                                setExpanded(plan.id)
                            }}>
                            <Add16Regular />
                            {intl.get("contentFilter.addPlan")}
                        </FlatButton>
                    </div>
                    {plans.map((plan, index) => (
                        <ContentFilterPlanFields
                            key={plan.id}
                            id={`${id}-plan-${index}`}
                            value={plan}
                            expanded={expanded === plan.id}
                            disabled={disabled}
                            onExpand={() =>
                                setExpanded(
                                    expanded === plan.id ? null : plan.id
                                )
                            }
                            onChange={next =>
                                changePlans(
                                    plans.map((value, i) =>
                                        i === index ? next : value
                                    )
                                )
                            }
                            onDelete={() => {
                                changePlans(plans.filter((_, i) => i !== index))
                                if (expanded === plan.id) setExpanded(null)
                            }}
                        />
                    ))}
                    {!plans.length && (
                        <p className={classes.hint}>
                            {intl.get("contentFilter.noPlans")}
                        </p>
                    )}
                </>
            )}
            {!valid && (
                <p className={classes.error} role="alert">
                    {intl.get("contentFilter.invalid")}
                </p>
            )}
            {preview && (
                <details className={classes.hint}>
                    <summary role="status">
                        {intl.get("contentFilter.preview", {
                            matched: preview.matched,
                            total: preview.total,
                        })}
                    </summary>
                    {preview.titles.map((title, index) => (
                        <div key={index}>{title}</div>
                    ))}
                </details>
            )}
            {previewError && (
                <p className={classes.hint} role="status">
                    {intl.get("contentFilter.previewError")}
                </p>
            )}
        </section>
    )
}
