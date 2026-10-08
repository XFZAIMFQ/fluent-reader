import lf from "lovefield"
import * as db from "./db"
import type {
    ContentFilter,
    ContentFilterPlan,
    ContentFilterRule,
    ReaderPreferences,
    SourceGroup,
} from "../schema-types"
import type { RSSSource } from "./models/source"
import type { RSSItem } from "./models/item"
import { inheritedSubscriptionPolicy } from "./subscription-policy"

export type ContentFilters = Record<number, ContentFilter[]>

export function contentFilterPlans(
    filter?: ContentFilter
): ContentFilterPlan[] {
    if (!filter) return []
    if (filter.plans) return filter.plans
    return filter.rules.length
        ? [
              {
                  id: "legacy",
                  name: "",
                  enabled: true,
                  match: filter.match,
                  rules: filter.rules,
              },
          ]
        : []
}

function activePlans(filter: ContentFilter): ContentFilterPlan[] {
    return contentFilterPlans(filter).filter(
        plan => plan.enabled && plan.rules.length
    )
}

export function contentRuleRegex(rule: ContentFilterRule): RegExp {
    const pattern = rule.regex
        ? rule.pattern
        : rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(
        pattern,
        `${rule.caseSensitive ? "" : "i"}${rule.field === "tags" ? "m" : ""}`
    )
}

export function validContentFilter(filter?: ContentFilter): boolean {
    if (!filter || filter.mode === "inherit" || filter.mode === "off")
        return true
    return contentFilterPlans(filter)
        .filter(plan => plan.enabled)
        .every(
            plan => plan.rules.length > 0 && plan.rules.every(validContentRule)
        )
}

export function validContentRule(rule: ContentFilterRule): boolean {
    if (!rule.pattern.trim()) return false
    try {
        contentRuleRegex(rule)
        return true
    } catch {
        return false
    }
}

export function resolveContentFilters(
    source: RSSSource,
    groups: SourceGroup[],
    preferences: ReaderPreferences
): ContentFilter[] {
    const inherited = inheritedSubscriptionPolicy(source, groups, preferences)
        .policy?.contentFilter
    const defaults =
        inherited &&
        ["append", "replace"].includes(inherited.mode) &&
        activePlans(inherited).length
            ? [inherited]
            : []
    const own = source.policy?.contentFilter
    if (!own || own.mode === "inherit") return defaults
    if (own.mode === "off") return []
    const rules = activePlans(own).length ? [own] : []
    return own.mode === "append" ? [...defaults, ...rules] : rules
}

export function contentFiltersForSources(
    sources: RSSSource[],
    groups: SourceGroup[],
    preferences: ReaderPreferences
): ContentFilters {
    return Object.fromEntries(
        sources.map(source => [
            source.sid,
            resolveContentFilters(source, groups, preferences),
        ])
    )
}

export function matchesContentFilters(
    filters: ContentFilter[],
    item: RSSItem
): boolean {
    return filters.every(filter => {
        if (!validContentFilter(filter)) return true
        const plans = activePlans(filter)
        if (!plans.length) return true
        const matches = plans.map(plan => {
            const matches = plan.rules.map(rule => {
                const value =
                    rule.field === "content"
                        ? item.contentText ?? item.snippet ?? ""
                        : item[rule.field] || ""
                const result = contentRuleRegex(rule).test(value)
                return rule.exclude ? !result : result
            })
            return plan.match === "any"
                ? matches.some(Boolean)
                : matches.every(Boolean)
        })
        return filter.match === "any"
            ? matches.some(Boolean)
            : matches.every(Boolean)
    })
}

// Include the source condition before pagination, including sources without a filter.
export function contentFilterPredicate(
    sids: number[],
    filters: ContentFilters
): lf.Predicate {
    const unrestricted = sids.filter(
        sid =>
            !filters[sid]?.some(
                filter =>
                    activePlans(filter).length && validContentFilter(filter)
            )
    )
    const predicates: lf.Predicate[] = unrestricted.length
        ? [db.items.source.in(unrestricted)]
        : []
    for (const sid of sids) {
        if (unrestricted.includes(sid)) continue
        const conditions = filters[sid]
            .filter(
                filter =>
                    activePlans(filter).length && validContentFilter(filter)
            )
            .map(filter => {
                const plans = activePlans(filter).map(plan => {
                    const rules = plan.rules.map(rule => {
                        const field =
                            rule.field === "content"
                                ? db.items.contentText
                                : db.items[rule.field]
                        const predicate = field.match(contentRuleRegex(rule))
                        return rule.exclude ? lf.op.not(predicate) : predicate
                    })
                    return plan.match === "any"
                        ? lf.op.or(...rules)
                        : lf.op.and(...rules)
                })
                return filter.match === "any"
                    ? lf.op.or(...plans)
                    : lf.op.and(...plans)
            })
        predicates.push(lf.op.and(db.items.source.eq(sid), ...conditions))
    }
    return predicates.length ? lf.op.or(...predicates) : db.items.source.in([])
}
