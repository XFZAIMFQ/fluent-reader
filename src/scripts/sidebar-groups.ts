import { SourceGroup } from "../schema-types"
import type { RSSSource } from "./models/source"
import { websiteDomain } from "./source-metadata"

export interface SidebarGroup {
    key: string
    name: string
    sids: number[]
    index?: number
    domain?: string
    expanded: boolean
}

export function sidebarGroups(groups: SourceGroup[], visible: RSSSource[]) {
    const ids = new Set(visible.map(source => source.sid))
    const sourceById = new Map(visible.map(source => [source.sid, source]))
    const orderedIds = new Set([
        ...groups.flatMap(group => group.sids).filter(sid => ids.has(sid)),
        ...ids,
    ])
    const assigned = new Set<number>()
    const folders: SidebarGroup[] = []
    groups.forEach((group, index) => {
        if (!group.isMultiple) return
        const sids = group.sids.filter(sid => ids.has(sid))
        sids.forEach(sid => assigned.add(sid))
        if (sids.length) {
            folders.push({
                key: `folder-${encodeURIComponent(group.name)}`,
                name: group.name,
                sids,
                index,
                expanded: group.expanded,
            })
        }
    })
    const automatic = new Map<string, number[]>()
    for (const sid of orderedIds) {
        const source = sourceById.get(sid)
        if (assigned.has(source.sid)) continue
        const domain =
            source.autoGroup !== false && websiteDomain(source.siteUrl)
        if (domain)
            automatic.set(domain, [
                ...(automatic.get(domain) || []),
                source.sid,
            ])
    }
    automatic.forEach((sids, domain) => {
        if (sids.length >= 2) {
            sids.forEach(sid => assigned.add(sid))
            folders.push({
                key: `auto-${encodeURIComponent(domain)}`,
                name: domain,
                domain,
                sids,
                expanded: true,
            })
        }
    })
    const singles = [...orderedIds].filter(sid => !assigned.has(sid))
    return { folders, singles }
}
