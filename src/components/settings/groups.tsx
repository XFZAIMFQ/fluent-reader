import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import intl from "react-intl-universal"
import { mergeClasses } from "@griffel/react"
import { MessageBar, MessageBarType } from "@fluentui/react"
import {
    Add20Regular,
    Search20Regular,
    Globe20Regular,
    Folder20Regular,
    ReOrderDotsVertical20Regular,
    ArrowSort20Regular,
    ArrowLeft20Regular,
} from "@fluentui/react-icons"
import { SubscriptionPolicy, SyncService } from "../../schema-types"
import {
    useAppDispatch,
    useAppSelector,
    useAppStore,
} from "../../scripts/reducer"
import { SidebarGroup, subscriptionGroups } from "../../scripts/sidebar-groups"
import {
    createSourceGroup,
    updateSourceGroup,
    deleteSourceGroup,
    setSourceGrouping,
    reorderSubscriptionSources,
} from "../../scripts/models/group"
import {
    setReaderPreferences,
    refreshSourceSelection,
    selectSources,
} from "../../scripts/models/page"
import { initFeeds, SOURCE } from "../../scripts/models/feed"
import { importGroups } from "../../scripts/models/service"
import { openSourceEditor } from "../../scripts/models/app"
import { RSSSource } from "../../scripts/models/source"
import { sourceFrequencyOverride } from "../../scripts/subscription-policy"
import { FlatButton } from "../utils/FlatButton"
import { SettingsDropdown } from "../utils/settings-dropdown"
import { frequencyText } from "../utils/subscription-policy-fields"
import { useListReorder } from "../utils/use-list-reorder"
import GroupPolicySettings from "./group-policy"
import { useStyles } from "./source-settings.styles"
import { useGroupStyles } from "./group-settings.styles"
import { validContentFilter } from "../../scripts/content-filter"

const emptyPolicy: SubscriptionPolicy = {}
const folderKey = (name: string) => `folder-${encodeURIComponent(name)}`
function moved<T>(items: T[], from: T, to: T): T[] {
    const next = [...items],
        index = next.indexOf(to)
    if (index < 0 || !next.includes(from)) return next
    next.splice(next.indexOf(from), 1)
    next.splice(index, 0, from)
    return next
}

export default function GroupsTab() {
    const dispatch = useAppDispatch(),
        store = useAppStore()
    const classes = useStyles(),
        styles = useGroupStyles()
    const sources = useAppSelector(state => state.sources)
    const groups = useAppSelector(state => state.groups)
    const preferences = useAppSelector(state => state.page.readerPreferences)
    const serviceOn = useAppSelector(
        state => state.service.type !== SyncService.None
    )
    const folders = useMemo(
        () =>
            subscriptionGroups(
                groups,
                Object.values(sources),
                preferences.groupOrder
            ),
        [groups, sources, preferences.groupOrder]
    )
    const [selectedKey, setSelectedKey] = useState(folders[0]?.key || null)
    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState("all")
    const [tab, setTab] = useState<"rules" | "sources">("rules")
    const [draft, setDraft] = useState<SubscriptionPolicy>({})
    const [name, setName] = useState("")
    const [dirty, setDirty] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState("")
    const [sourceQuery, setSourceQuery] = useState("")
    const [checked, setChecked] = useState<number[]>([])
    const [addingSources, setAddingSources] = useState(false)
    const folder = folders.find(folder => folder.key === selectedKey)
    const ungrouped = folder?.key === "ungrouped"
    const policyFor = (folder: SidebarGroup) =>
        folder.index === undefined
            ? preferences.domainPolicies[folder.domain] || emptyPolicy
            : groups[folder.index]?.policy || emptyPolicy
    const savedPolicy = folder && !ungrouped ? policyFor(folder) : emptyPolicy
    const savedName = folder?.name || ""
    const kind = (folder: SidebarGroup) =>
        folder.key === "ungrouped"
            ? "ungrouped"
            : folder.index === undefined
            ? "auto"
            : "manual"
    const label = (folder: SidebarGroup) =>
        folder.key === "ungrouped"
            ? intl.get("groupSettings.ungrouped")
            : folder.name
    const kindText = (folder: SidebarGroup) =>
        intl.get(`groupSettings.${kind(folder)}`)

    useLayoutEffect(() => {
        if (!dirty) {
            setDraft({ ...savedPolicy })
            setName(savedName)
        }
    }, [selectedKey, savedPolicy, savedName, dirty])
    useEffect(() => {
        if (!busy && selectedKey && !folder) {
            setSelectedKey(folders[0]?.key || null)
            setDirty(false)
        }
    }, [folders, selectedKey, folder, busy])
    useEffect(() => {
        setChecked([])
        setSourceQuery("")
        setAddingSources(false)
        if (selectedKey === "ungrouped") setTab("sources")
    }, [selectedKey])
    useEffect(() => {
        setChecked(ids =>
            ids.filter(
                id =>
                    sources[id] &&
                    (addingSources
                        ? !folder?.sids.includes(id)
                        : folder?.sids.includes(id))
            )
        )
    }, [sources, folder, addingSources])

    const canLeave = async () =>
        !busy &&
        (!dirty ||
            (await globalThis.utils.showMessageBox(
                intl.get("subscriptionSettings.unsavedTitle"),
                intl.get("subscriptionSettings.unsavedHint"),
                intl.get("subscriptionSettings.discard"),
                intl.get("cancel"),
                true,
                "warning"
            )))
    const selectFolder = async (key: string) => {
        if (key === selectedKey || !(await canLeave())) return
        setSelectedKey(key)
        setDirty(false)
        setError("")
        setNotice("")
    }
    const run = async (work: () => Promise<void>, refresh = false) => {
        if (busy) return
        setBusy(true)
        setError("")
        setNotice("")
        try {
            await work()
            if (refresh) {
                dispatch(refreshSourceSelection())
                await dispatch(initFeeds(true))
            }
            setNotice(intl.get("subscriptionSettings.saved"))
        } catch (error) {
            setError(String(error))
        } finally {
            setBusy(false)
        }
    }
    const reset = () => {
        setDraft({ ...savedPolicy })
        setName(savedName)
        setDirty(false)
        setError("")
        setNotice("")
    }
    const nameError = (value: string, exclude?: string) =>
        !value.trim()
            ? intl.get("emptyName")
            : folders.some(
                  folder =>
                      folder.key !== exclude &&
                      label(folder).toLocaleLowerCase() ===
                          value.trim().toLocaleLowerCase()
              )
            ? intl.get("groups.exist")
            : ""
    const changePolicy = (value: SubscriptionPolicy) => {
        setDraft(value)
        setDirty(true)
        setNotice("")
    }
    const persistOrder = async (order: string[]) => {
        await dispatch(setReaderPreferences({ groupOrder: order }))
    }
    const save = async () => {
        if (!folder || ungrouped) return
        if (!validContentFilter(draft.contentFilter)) return
        const nextName = name.trim(),
            invalid =
                folder.index === undefined
                    ? ""
                    : nameError(nextName, folder.key)
        if (invalid) {
            setError(invalid)
            return
        }
        await run(async () => {
            if (folder.index === undefined)
                await dispatch(
                    setReaderPreferences({
                        domainPolicies: { [folder.domain]: draft },
                    })
                )
            else {
                let index = folder.index
                let latest = store.getState().groups[index]
                if (!latest || latest.name !== folder.name)
                    throw new Error(intl.get("groupSettings.listChanged"))
                // A named website group can also contain automatic members.
                // Keep them in the renamed folder rather than recreating it.
                if (
                    nextName !== folder.name &&
                    folder.sids.length !== latest.sids.length
                ) {
                    await dispatch(
                        reorderSubscriptionSources(folder.key, folder.sids)
                    )
                    index = store
                        .getState()
                        .groups.findIndex(
                            group =>
                                group.isMultiple && group.name === folder.name
                        )
                    latest = store.getState().groups[index]
                }
                await dispatch(
                    updateSourceGroup({
                        ...latest,
                        index,
                        name: nextName,
                        policy: draft,
                    })
                )
                if (nextName !== folder.name) {
                    const order = (
                        store.getState().page.readerPreferences.groupOrder || []
                    ).map(key =>
                        key === folder.key ? folderKey(nextName) : key
                    )
                    await persistOrder(order)
                    setSelectedKey(folderKey(nextName))
                    const state = store.getState()
                    if (state.app.menuKey === folder.key) {
                        dispatch(
                            selectSources(
                                state.feeds[SOURCE].sids,
                                folderKey(nextName),
                                nextName,
                                true
                            )
                        )
                        await dispatch(initFeeds(true))
                    }
                }
            }
            setDirty(false)
        })
    }
    const create = async (event: React.FormEvent) => {
        event.preventDefault()
        const invalid = nameError(newName)
        if (invalid) {
            setError(invalid)
            return
        }
        if (!(await canLeave())) return
        await run(async () => {
            dispatch(createSourceGroup(newName.trim()))
            await window.settings.saveGroups(store.getState().groups)
            setSelectedKey(folderKey(newName.trim()))
            setDirty(false)
            setTab("rules")
            setCreating(false)
            setNewName("")
            setQuery("")
            setFilter("all")
        })
    }
    const remove = async (ids: number[]) => {
        await run(async () => {
            await dispatch(setSourceGrouping(ids, { mode: "none" }))
            await window.settings.saveGroups(store.getState().groups)
            setChecked([])
        }, true)
    }
    const deleteFolder = async () => {
        if (!folder || folder.index === undefined || !(await canLeave())) return
        if (
            !(await globalThis.utils.showMessageBox(
                intl.get("groups.deleteGroup"),
                intl.get("groupSettings.deleteHint"),
                intl.get("delete"),
                intl.get("cancel"),
                true,
                "warning"
            ))
        )
            return
        await run(async () => {
            await dispatch(setSourceGrouping(folder.sids, { mode: "none" }))
            const index = store
                .getState()
                .groups.findIndex(
                    group => group.isMultiple && group.name === folder.name
                )
            if (index >= 0) dispatch(deleteSourceGroup(index))
            await window.settings.saveGroups(store.getState().groups)
            await persistOrder(
                (
                    store.getState().page.readerPreferences.groupOrder || []
                ).filter(key => key !== folder.key)
            )
            setSelectedKey(null)
            setDirty(false)
        }, true)
    }
    const addMembers = async () => {
        if (!folder || folder.index === undefined || !checked.length) return
        await run(async () => {
            await dispatch(
                setSourceGrouping(checked, {
                    mode: "manual",
                    name: folder.name,
                })
            )
            await window.settings.saveGroups(store.getState().groups)
            setChecked([])
            setAddingSources(false)
        }, true)
    }
    const textFor = (source: RSSSource) =>
        [source.name, source.url, source.siteUrl].join(" ").toLocaleLowerCase()
    const visible = folders.filter(
        folder =>
            (filter === "all" || kind(folder) === filter) &&
            [label(folder), ...folder.sids.map(sid => textFor(sources[sid]))]
                .join(" ")
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase())
    )
    const orderable = folders
        .filter(folder => folder.key !== "ungrouped")
        .map(folder => folder.key)
    const groupDrag = useListReorder(
        visible
            .filter(folder => folder.key !== "ungrouped")
            .map(folder => folder.key),
        (from, to) =>
            void run(async () => {
                await persistOrder(moved(orderable, from, to))
            }),
        busy
    )
    const groupSourceIds = folder?.sids || []
    const memberIds = addingSources
        ? Object.values(sources)
              .filter(source => !groupSourceIds.includes(source.sid))
              .map(source => source.sid)
        : groupSourceIds
    const members = memberIds
        .map(id => sources[id])
        .filter(
            source =>
                source &&
                textFor(source).includes(sourceQuery.trim().toLocaleLowerCase())
        )
    const sourceDrag = useListReorder(
        members.map(source => String(source.sid)),
        (from, to) =>
            void run(async () => {
                await dispatch(
                    reorderSubscriptionSources(
                        folder.key,
                        moved(groupSourceIds, Number(from), Number(to))
                    )
                )
            }),
        busy || addingSources
    )
    const sourceFrequency = (source: RSSSource) =>
        sourceFrequencyOverride(source)
    const sortByName = () =>
        void run(async () => {
            await persistOrder(
                [...folders]
                    .filter(folder => folder.key !== "ungrouped")
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(folder => folder.key)
            )
        })
    const openEditor = async (source: RSSSource) => {
        if (await canLeave()) {
            reset()
            dispatch(openSourceEditor(source.sid))
        }
    }
    const importServiceGroups = async () => {
        if (!(await canLeave())) return
        setDirty(false)
        await run(async () => {
            await dispatch(importGroups())
        }, true)
    }

    return (
        <div className={classes.root} data-group-settings>
            {serviceOn && (
                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("service.groupsWarning")}{" "}
                    <FlatButton
                        styleClass={classes.button}
                        disabled={busy}
                        onClick={() => void importServiceGroups()}>
                        {intl.get("service.importGroups")}
                    </FlatButton>
                </MessageBar>
            )}
            <div className={classes.toolbar}>
                <label className={classes.search}>
                    <Search20Regular />
                    <input
                        aria-label={intl.get("groupSettings.search")}
                        placeholder={intl.get("groupSettings.search")}
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                    />
                </label>
                <SettingsDropdown
                    styleClass={styles.filter}
                    aria-label={intl.get("groupSettings.filter")}
                    selectedKey={filter}
                    options={["all", "auto", "manual", "ungrouped"].map(
                        key => ({ key, text: intl.get(`groupSettings.${key}`) })
                    )}
                    onChange={(_, option) => setFilter(String(option.key))}
                />
                <FlatButton
                    styleClass={mergeClasses(classes.button, classes.primary)}
                    disabled={busy}
                    onClick={() => {
                        setCreating(true)
                        setError("")
                    }}>
                    <Add20Regular />
                    {intl.get("groups.create")}
                </FlatButton>
            </div>
            <div className={styles.layout}>
                <section
                    className={classes.list}
                    aria-label={intl.get("groups.group")}>
                    <div className={classes.listHeader}>
                        <span>
                            {intl.get("groupSettings.count", {
                                count: visible.filter(
                                    folder => folder.key !== "ungrouped"
                                ).length,
                            })}
                        </span>
                        <FlatButton
                            styleClass={styles.grip}
                            ariaLabel={intl.get("groupSettings.sortName")}
                            title={intl.get("groupSettings.sortName")}
                            disabled={busy || orderable.length < 2}
                            onClick={sortByName}>
                            <ArrowSort20Regular />
                        </FlatButton>
                    </div>
                    {creating && (
                        <form className={styles.create} onSubmit={create}>
                            <input
                                autoFocus
                                className={classes.input}
                                aria-label={intl.get("groups.enterName")}
                                placeholder={intl.get("groups.enterName")}
                                value={newName}
                                onChange={event =>
                                    setNewName(event.target.value)
                                }
                                disabled={busy}
                                maxLength={200}
                            />
                            <div className={styles.createActions}>
                                <FlatButton
                                    styleClass={classes.button}
                                    disabled={busy}
                                    onClick={() => {
                                        setCreating(false)
                                        setNewName("")
                                        setError("")
                                    }}>
                                    {intl.get("cancel")}
                                </FlatButton>
                                <button
                                    className={mergeClasses(
                                        classes.button,
                                        classes.primary
                                    )}
                                    type="submit"
                                    disabled={busy || !newName.trim()}>
                                    {intl.get("create")}
                                </button>
                            </div>
                        </form>
                    )}
                    <div
                        ref={groupDrag.listRef}
                        className={styles.list}
                        data-group-list>
                        {visible.map(item => (
                            <div
                                key={item.key}
                                data-group-key={item.key}
                                data-reorder-id={item.key}
                                className={mergeClasses(
                                    styles.groupRow,
                                    selectedKey === item.key &&
                                        classes.selected,
                                    groupDrag.over === item.key && styles.drop
                                )}>
                                {item.key !== "ungrouped" && (
                                    <button
                                        type="button"
                                        className={styles.grip}
                                        aria-label={intl.get(
                                            "groupSettings.reorder",
                                            { name: label(item) }
                                        )}
                                        {...groupDrag.handleProps(item.key)}>
                                        <ReOrderDotsVertical20Regular />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={classes.rowButton}
                                    disabled={busy}
                                    aria-pressed={selectedKey === item.key}
                                    onClick={() => void selectFolder(item.key)}>
                                    {item.index === undefined &&
                                    item.key !== "ungrouped" ? (
                                        <Globe20Regular
                                            className={styles.groupIcon}
                                        />
                                    ) : (
                                        <Folder20Regular
                                            className={styles.groupIcon}
                                        />
                                    )}
                                    <span className={classes.copy}>
                                        <strong>{label(item)}</strong>
                                        <span className={classes.hint}>
                                            {kindText(item)}
                                            {item.key !== "ungrouped" &&
                                                ` · ${frequencyText(
                                                    policyFor(item).frequency ??
                                                        preferences.frequency
                                                )}`}
                                        </span>
                                    </span>
                                    <span className={styles.count}>
                                        {item.sids.length}
                                    </span>
                                </button>
                            </div>
                        ))}
                        {!visible.length && (
                            <p className={classes.empty}>
                                {intl.get("groupSettings.noGroups")}
                            </p>
                        )}
                    </div>
                    <div className={styles.footer}>
                        {intl.get("groupSettings.sortHint")}
                    </div>
                </section>
                <section
                    className={classes.details}
                    aria-label={intl.get("groupSettings.details")}>
                    {!folder ? (
                        <p className={classes.empty}>
                            {intl.get("groupSettings.choose")}
                        </p>
                    ) : (
                        <>
                            <header className={classes.heading}>
                                {folder.index === undefined && !ungrouped ? (
                                    <Globe20Regular
                                        className={styles.groupIcon}
                                    />
                                ) : (
                                    <Folder20Regular
                                        className={styles.groupIcon}
                                    />
                                )}
                                <div>
                                    <h2 className={classes.title}>
                                        {label(folder)}
                                    </h2>
                                    <p className={classes.hint}>
                                        {kindText(folder)} ·{" "}
                                        {intl.get(
                                            "subscriptionSettings.count",
                                            { count: folder.sids.length }
                                        )}
                                    </p>
                                </div>
                            </header>
                            {!ungrouped && (
                                <div
                                    className={styles.tabs}
                                    role="tablist"
                                    aria-label={intl.get(
                                        "groupSettings.details"
                                    )}>
                                    {(["rules", "sources"] as const).map(
                                        (key, index) => (
                                            <button
                                                key={key}
                                                type="button"
                                                id={`group-tab-${key}`}
                                                role="tab"
                                                aria-selected={tab === key}
                                                aria-controls="group-detail-panel"
                                                disabled={busy}
                                                className={mergeClasses(
                                                    styles.tab,
                                                    tab === key &&
                                                        styles.activeTab
                                                )}
                                                onClick={() => setTab(key)}
                                                onKeyDown={event => {
                                                    if (
                                                        event.key !==
                                                            "ArrowLeft" &&
                                                        event.key !==
                                                            "ArrowRight"
                                                    )
                                                        return
                                                    event.preventDefault()
                                                    const next =
                                                        index === 0
                                                            ? "sources"
                                                            : "rules"
                                                    setTab(next)
                                                    document
                                                        .getElementById(
                                                            `group-tab-${next}`
                                                        )
                                                        ?.focus()
                                                }}>
                                                {key === "rules"
                                                    ? intl.get(
                                                          "policy.groupDefaults"
                                                      )
                                                    : intl.get(
                                                          "groupSettings.members",
                                                          {
                                                              count: folder.sids
                                                                  .length,
                                                          }
                                                      )}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                            <section
                                id="group-detail-panel"
                                role={ungrouped ? undefined : "tabpanel"}
                                aria-labelledby={
                                    ungrouped ? undefined : `group-tab-${tab}`
                                }>
                                {tab === "rules" && !ungrouped ? (
                                    <>
                                        <div className={styles.policy}>
                                            {folder.index !== undefined && (
                                                <label
                                                    className={classes.field}
                                                    htmlFor="group-settings-name">
                                                    {intl.get("name")}
                                                    <input
                                                        id="group-settings-name"
                                                        className={
                                                            classes.input
                                                        }
                                                        disabled={busy}
                                                        value={name}
                                                        onChange={event => {
                                                            setName(
                                                                event.target
                                                                    .value
                                                            )
                                                            setDirty(true)
                                                            setNotice("")
                                                        }}
                                                    />
                                                </label>
                                            )}
                                            <GroupPolicySettings
                                                key={folder.key}
                                                value={draft}
                                                onChange={changePolicy}
                                                disabled={busy}
                                                sids={folder.sids}
                                                name={folder.name}
                                            />
                                        </div>
                                        <div className={classes.actions}>
                                            {folder.index !== undefined && (
                                                <FlatButton
                                                    styleClass={mergeClasses(
                                                        classes.button,
                                                        classes.danger
                                                    )}
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void deleteFolder()
                                                    }>
                                                    {intl.get(
                                                        "groups.deleteGroup"
                                                    )}
                                                </FlatButton>
                                            )}
                                            <FlatButton
                                                styleClass={classes.button}
                                                disabled={busy || !dirty}
                                                onClick={reset}>
                                                {intl.get("cancel")}
                                            </FlatButton>
                                            <FlatButton
                                                styleClass={mergeClasses(
                                                    classes.button,
                                                    classes.primary
                                                )}
                                                disabled={
                                                    busy ||
                                                    !dirty ||
                                                    !validContentFilter(
                                                        draft.contentFilter
                                                    )
                                                }
                                                onClick={() => void save()}>
                                                {intl.get("policy.save")}
                                            </FlatButton>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.sourceTools}>
                                            <label className={classes.search}>
                                                <Search20Regular />
                                                <input
                                                    aria-label={intl.get(
                                                        "groupSettings.sourceSearch"
                                                    )}
                                                    placeholder={intl.get(
                                                        "groupSettings.sourceSearch"
                                                    )}
                                                    value={sourceQuery}
                                                    onChange={event =>
                                                        setSourceQuery(
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </label>
                                            {folder.index !== undefined && (
                                                <FlatButton
                                                    styleClass={classes.button}
                                                    disabled={busy}
                                                    onClick={() => {
                                                        setAddingSources(
                                                            !addingSources
                                                        )
                                                        setChecked([])
                                                        setSourceQuery("")
                                                    }}>
                                                    {addingSources ? (
                                                        <ArrowLeft20Regular />
                                                    ) : (
                                                        <Add20Regular />
                                                    )}
                                                    {intl.get(
                                                        addingSources
                                                            ? "groupSettings.backMembers"
                                                            : "groupSettings.addMembers"
                                                    )}
                                                </FlatButton>
                                            )}
                                        </div>
                                        <div className={styles.sourceTools}>
                                            <input
                                                type="checkbox"
                                                aria-label={intl.get(
                                                    "subscriptionSettings.selectVisible"
                                                )}
                                                disabled={
                                                    busy || !members.length
                                                }
                                                checked={
                                                    members.length > 0 &&
                                                    members.every(source =>
                                                        checked.includes(
                                                            source.sid
                                                        )
                                                    )
                                                }
                                                onChange={event =>
                                                    setChecked(
                                                        event.target.checked
                                                            ? [
                                                                  ...new Set([
                                                                      ...checked,
                                                                      ...members.map(
                                                                          source =>
                                                                              source.sid
                                                                      ),
                                                                  ]),
                                                              ]
                                                            : checked.filter(
                                                                  id =>
                                                                      !members.some(
                                                                          source =>
                                                                              source.sid ===
                                                                              id
                                                                      )
                                                              )
                                                    )
                                                }
                                            />
                                            <span className={classes.hint}>
                                                {intl.get(
                                                    addingSources
                                                        ? "groupSettings.available"
                                                        : "subscriptionSettings.selectedCount",
                                                    {
                                                        count: addingSources
                                                            ? members.length
                                                            : checked.length,
                                                    }
                                                )}
                                            </span>
                                            {!ungrouped && !addingSources && (
                                                <FlatButton
                                                    styleClass={classes.button}
                                                    disabled={
                                                        busy || !checked.length
                                                    }
                                                    onClick={() =>
                                                        void remove(checked)
                                                    }>
                                                    {intl.get(
                                                        "groupSettings.remove"
                                                    )}
                                                </FlatButton>
                                            )}
                                            {addingSources && (
                                                <FlatButton
                                                    styleClass={mergeClasses(
                                                        classes.button,
                                                        classes.primary
                                                    )}
                                                    disabled={
                                                        busy || !checked.length
                                                    }
                                                    onClick={() =>
                                                        void addMembers()
                                                    }>
                                                    {intl.get(
                                                        "groupSettings.addSelected"
                                                    )}
                                                </FlatButton>
                                            )}
                                        </div>
                                        <div
                                            ref={sourceDrag.listRef}
                                            className={styles.sources}
                                            data-group-members>
                                            {members.map(source => (
                                                <div
                                                    key={source.sid}
                                                    data-member-id={source.sid}
                                                    data-reorder-id={String(
                                                        source.sid
                                                    )}
                                                    className={mergeClasses(
                                                        classes.row,
                                                        sourceDrag.over ===
                                                            String(
                                                                source.sid
                                                            ) && styles.drop
                                                    )}>
                                                    {!addingSources && (
                                                        <button
                                                            type="button"
                                                            className={
                                                                styles.grip
                                                            }
                                                            aria-label={intl.get(
                                                                "groupSettings.reorder",
                                                                {
                                                                    name: source.name,
                                                                }
                                                            )}
                                                            {...sourceDrag.handleProps(
                                                                String(
                                                                    source.sid
                                                                )
                                                            )}>
                                                            <ReOrderDotsVertical20Regular />
                                                        </button>
                                                    )}
                                                    <input
                                                        type="checkbox"
                                                        aria-label={intl.get(
                                                            "subscriptionSettings.selectSource",
                                                            {
                                                                name: source.name,
                                                            }
                                                        )}
                                                        disabled={busy}
                                                        checked={checked.includes(
                                                            source.sid
                                                        )}
                                                        onChange={event =>
                                                            setChecked(
                                                                event.target
                                                                    .checked
                                                                    ? [
                                                                          ...checked,
                                                                          source.sid,
                                                                      ]
                                                                    : checked.filter(
                                                                          id =>
                                                                              id !==
                                                                              source.sid
                                                                      )
                                                            )
                                                        }
                                                    />
                                                    {source.iconurl && (
                                                        <img
                                                            src={source.iconurl}
                                                            alt=""
                                                            className={
                                                                classes.icon
                                                            }
                                                            draggable={false}
                                                        />
                                                    )}
                                                    <div
                                                        className={
                                                            styles.sourceName
                                                        }>
                                                        <strong>
                                                            {source.name}
                                                        </strong>
                                                        <div
                                                            className={
                                                                classes.hint
                                                            }>
                                                            {intl.get(
                                                                `contentView.${
                                                                    source.category ||
                                                                    "articles"
                                                                }`
                                                            )}
                                                            {(source.policy
                                                                ?.readBehavior !==
                                                                undefined ||
                                                                source.policy
                                                                    ?.strategy !==
                                                                    undefined ||
                                                                sourceFrequency(
                                                                    source
                                                                ) !==
                                                                    undefined) &&
                                                                ` · ${intl.get(
                                                                    "groupSettings.sourceOverride"
                                                                )}`}
                                                        </div>
                                                    </div>
                                                    {!addingSources && (
                                                        <FlatButton
                                                            styleClass={
                                                                classes.button
                                                            }
                                                            ariaLabel={intl.get(
                                                                "edit"
                                                            )}
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void openEditor(
                                                                    source
                                                                )
                                                            }>
                                                            {intl.get("edit")}
                                                        </FlatButton>
                                                    )}
                                                    {!addingSources &&
                                                        !ungrouped && (
                                                            <FlatButton
                                                                styleClass={
                                                                    classes.button
                                                                }
                                                                disabled={busy}
                                                                onClick={() =>
                                                                    void remove(
                                                                        [
                                                                            source.sid,
                                                                        ]
                                                                    )
                                                                }>
                                                                {intl.get(
                                                                    "subscriptions.removeFromGroup"
                                                                )}
                                                            </FlatButton>
                                                        )}
                                                </div>
                                            ))}
                                            {!members.length && (
                                                <p className={classes.empty}>
                                                    {intl.get(
                                                        addingSources
                                                            ? "groupSettings.noAvailable"
                                                            : "subscriptionSettings.noResults"
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </section>
                        </>
                    )}
                    {error && (
                        <p
                            role="alert"
                            className={mergeClasses(
                                styles.status,
                                styles.error
                            )}>
                            {error}
                        </p>
                    )}
                    {notice && (
                        <p role="status" className={styles.status}>
                            {notice}
                        </p>
                    )}
                </section>
            </div>
        </div>
    )
}
