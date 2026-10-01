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

// Keep the first folder's order and expansion state when repairing old names.
export function mergeNamedGroups(groups: SourceGroup[]): SourceGroup[] {
    const named = new Map<string, SourceGroup>()
    const merged: SourceGroup[] = []
    let changed = false
    for (const group of groups) {
        if (!group.isMultiple) {
            merged.push(group)
            continue
        }
        const name = group.name.trim()
        const existing = named.get(name)
        if (existing) {
            existing.sids = [...new Set([...existing.sids, ...group.sids])]
            changed = true
        } else {
            const folder = { ...group, name, sids: [...group.sids] }
            named.set(name, folder)
            merged.push(folder)
            changed ||= name !== group.name
        }
    }
    return changed ? merged : groups
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
    const named = new Map<string, SidebarGroup>()
    groups.forEach((group, index) => {
        if (!group.isMultiple) return
        const sids = group.sids.filter(sid => ids.has(sid))
        sids.forEach(sid => assigned.add(sid))
        const name = group.name.trim()
        const existing = named.get(name)
        if (existing) {
            existing.sids = [...new Set([...existing.sids, ...sids])]
        } else {
            const folder = {
                key: `folder-${encodeURIComponent(name)}`,
                name,
                sids,
                index,
                expanded: group.expanded,
            }
            named.set(name, folder)
            folders.push(folder)
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
        const existing = folders.find(
            folder => folder.name.toLowerCase() === domain
        )
        if (existing) {
            sids.forEach(sid => assigned.add(sid))
            existing.sids = [...new Set([...existing.sids, ...sids])]
        } else if (sids.length >= 2) {
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
    return { folders: folders.filter(folder => folder.sids.length), singles }
}
