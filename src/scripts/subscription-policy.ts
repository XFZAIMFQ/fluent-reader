import type { RSSSource } from "./models/source"
import {
    ReaderPreferences,
    SourceGroup,
    SubscriptionPolicy,
} from "../schema-types"
import { websiteDomain } from "./source-metadata"

export function sourceFrequencyOverride(source: RSSSource): number | undefined {
    return source.policy
        ? source.policy.frequency
        : source.fetchFrequency > 0 && source.fetchFrequency !== 60
        ? source.fetchFrequency
        : undefined
}

export function resolveSubscriptionPolicy(
    source: RSSSource,
    groups: SourceGroup[],
    preferences: ReaderPreferences
): Required<
    Pick<SubscriptionPolicy, "strategy" | "readBehavior" | "frequency">
> {
    const inherited = inheritedSubscriptionPolicy(
        source,
        groups,
        preferences
    ).policy
    return {
        strategy:
            source.policy?.strategy ??
            inherited?.strategy ??
            preferences.strategy,
        readBehavior:
            source.policy?.readBehavior ??
            inherited?.readBehavior ??
            preferences.readBehavior,
        frequency:
            sourceFrequencyOverride(source) ??
            inherited?.frequency ??
            preferences.frequency,
    }
}

export function inheritedSubscriptionPolicy(
    source: RSSSource,
    groups: SourceGroup[],
    preferences: ReaderPreferences
): { policy?: SubscriptionPolicy; name?: string } {
    const domain = source.autoGroup !== false && websiteDomain(source.siteUrl)
    const group =
        groups.find(
            group => group.isMultiple && group.sids.includes(source.sid)
        ) ||
        (domain &&
            groups.find(
                group =>
                    group.isMultiple &&
                    group.name.trim().toLowerCase() === domain
            ))
    return group
        ? { policy: group.policy, name: group.name }
        : domain
        ? { policy: preferences.domainPolicies[domain], name: domain }
        : {}
}

export function feedWebsite(source: RSSSource): string {
    const domain = websiteDomain(source.siteUrl)
    if (domain) return domain
    try {
        const url = new URL(source.url)
        if (
            url.hostname === "localhost" ||
            /^127\./.test(url.hostname) ||
            /^192\.168\./.test(url.hostname)
        ) {
            return `${url.origin}/${
                url.pathname.split("/").filter(Boolean)[0] || "feed"
            }`
        }
        return websiteDomain(source.url) || url.origin
    } catch {
        return source.url
    }
}
