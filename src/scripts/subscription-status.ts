import { SourceCategory, SubscriptionCheckReply } from "../schema-types"
import { normalizeSubscriptionUrl } from "../subscription-url"
import type { RootState } from "./reducer"

export function checkSubscriptions(
    urls: string[],
    state: RootState
): SubscriptionCheckReply {
    if (!state.app.sourceInit) return { ready: false }

    const sources = new Map<string, typeof state.sources[number]>()
    for (const source of Object.values(state.sources)) {
        const url = normalizeSubscriptionUrl(source.url)
        if (url && !sources.has(url)) sources.set(url, source)
    }

    return {
        ready: true,
        results: urls.map(url => {
            const normalized = normalizeSubscriptionUrl(url)
            const source = normalized ? sources.get(normalized) : undefined
            return source
                ? {
                      subscribed: true,
                      view: source.category || SourceCategory.Articles,
                  }
                : { subscribed: false }
        }),
    }
}
