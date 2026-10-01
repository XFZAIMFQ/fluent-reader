import * as React from "react"
import intl from "react-intl-universal"
import { useAppSelector } from "../../scripts/reducer"
import {
    resolveSubscriptionPolicy,
    feedWebsite,
} from "../../scripts/subscription-policy"
import type { RSSSource } from "../../scripts/models/source"
import { frequencyText } from "./subscription-policy-fields"

export default function EffectiveSourcePolicy({
    source,
}: {
    source: RSSSource
}) {
    const groups = useAppSelector(state => state.groups)
    const preferences = useAppSelector(state => state.page.readerPreferences)
    const policy = resolveSubscriptionPolicy(source, groups, preferences)
    const schedule = window.settings.getFeedSchedule()
    const retryAt = Math.max(
        schedule.sources[source.url]?.retryAt || 0,
        schedule.sites[feedWebsite(source)]?.retryAt || 0
    )
    return (
        <p role="status">
            {intl.get("policy.effective", {
                frequency: frequencyText(policy.frequency),
                read: intl.get(
                    policy.readBehavior === "manual"
                        ? "policy.manualRead"
                        : "policy.autoRead"
                ),
            })}
            {!source.serviceRef && retryAt > Date.now() && (
                <>
                    <br />
                    {intl.get("policy.cooldown", {
                        time: new Date(retryAt).toLocaleString(),
                    })}
                </>
            )}
        </p>
    )
}
