export function articleText(content: string, snippet = ""): string {
    const doc = new DOMParser().parseFromString(
        content || snippet || "",
        "text/html"
    )
    doc.querySelectorAll("script, style").forEach(element => element.remove())
    return doc.documentElement.textContent || ""
}

export function articleTags(categories?: unknown[]): string {
    return [
        ...new Set(
            (categories || [])
                .map(value =>
                    typeof value === "string"
                        ? value.trim()
                        : String((value as { _?: string })?._ || "").trim()
                )
                .filter(Boolean)
        ),
    ].join("\n")
}
