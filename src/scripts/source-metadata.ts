import { parse } from "tldts"

export function httpUrl(value: string, base?: string): string {
    if (!value?.trim()) return ""
    try {
        const url = new URL(value, base)
        return url.protocol === "https:" || url.protocol === "http:"
            ? url.href
            : ""
    } catch {
        return ""
    }
}

export function websiteDomain(url: string): string {
    try {
        const hostname = new URL(url).hostname.toLowerCase()
        if (hostname === "localhost" || parse(hostname).isIp) return ""
        return parse(hostname, { allowPrivateDomains: true }).domain || hostname
    } catch {
        return ""
    }
}

type FeedMetadata = {
    link?: string
    image?: { url?: string }
    icon?: string
    logo?: string
    items?: { link?: string }[]
}

export function sourceMetadata(feedUrl: string, feed: FeedMetadata) {
    const feedOrigin = new URL(feedUrl).origin
    let siteUrl = httpUrl(feed.link, feedUrl)
    // Aggregator routes sometimes point their channel link back to the service.
    const articleUrl = feed.items?.map(item => httpUrl(item.link)).find(Boolean)
    if (!siteUrl || new URL(siteUrl).origin === feedOrigin) {
        siteUrl = articleUrl || siteUrl || feedOrigin
    }
    const feedIcon = httpUrl(feed.image?.url || feed.icon || feed.logo, siteUrl)
    return { siteUrl, feedIcon }
}
