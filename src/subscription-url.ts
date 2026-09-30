export function normalizeSubscriptionUrl(raw: string): string | null {
    if (typeof raw !== "string" || !raw.trim() || raw.length > 8192) return null

    try {
        const url = new URL(raw.trim())
        if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password
        )
            return null
        return url.toString()
    } catch {
        return null
    }
}
