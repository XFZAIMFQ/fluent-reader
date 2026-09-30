import * as React from "react"
import { useEffect, useState } from "react"
import intl from "react-intl-universal"
import { mergeClasses } from "@griffel/react"
import { MessageBar, MessageBarType } from "@fluentui/react"
import {
    Add20Regular,
    ArrowLeft20Regular,
    Search20Regular,
} from "@fluentui/react-icons"
import { SourceCategory, SyncService } from "../../schema-types"
import {
    useAppDispatch,
    useAppSelector,
    useAppStore,
} from "../../scripts/reducer"
import { saveSettings, toggleSettings } from "../../scripts/models/app"
import { initFeeds } from "../../scripts/models/feed"
import {
    exportOPML,
    importOPML,
    setSourceGrouping,
    SourceGrouping,
} from "../../scripts/models/group"
import { refreshSourceSelection } from "../../scripts/models/page"
import {
    addSource,
    deleteSources,
    RSSSource,
    SourceOpenTarget,
    toggleSourceHidden,
    updateFavicon,
    updateSource,
} from "../../scripts/models/source"
import { urlTest, validateFavicon } from "../../scripts/utils"
import { websiteDomain } from "../../scripts/source-metadata"
import { FlatButton } from "../utils/FlatButton"
import { SourceGroupPicker } from "../utils/source-group-picker"
import { useStyles } from "./source-settings.styles"

const categories = [
    SourceCategory.Articles,
    SourceCategory.Social,
    SourceCategory.Pictures,
    SourceCategory.Videos,
]
type Draft = {
    name: string
    url: string
    category: SourceCategory
    grouping: SourceGrouping
    private: boolean
    hidden: boolean
    frequency: number
    openTarget: SourceOpenTarget
    icon: string
}
const emptyDraft = (): Draft => ({
    name: "",
    url: "",
    category: SourceCategory.Articles,
    grouping: { mode: "auto" },
    private: false,
    hidden: false,
    frequency: 60,
    openTarget: SourceOpenTarget.Local,
    icon: "",
})

const SourcesTab: React.FC = () => {
    const classes = useStyles()
    const dispatch = useAppDispatch()
    const store = useAppStore()
    const sources = useAppSelector(state => state.sources)
    const groups = useAppSelector(state => state.groups)
    const requested = useAppSelector(state => state.app.settings.sids)
    const serviceOn = useAppSelector(
        state => state.service.type !== SyncService.None
    )
    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState("all")
    const [sid, setSid] = useState<number>(null)
    const [checked, setChecked] = useState<number[]>([])
    const [adding, setAdding] = useState(false)
    const [draft, setDraft] = useState<Draft>(emptyDraft)
    const [batchCategory, setBatchCategory] = useState("")
    const [batchGroup, setBatchGroup] = useState<SourceGrouping>(null)
    const [dirty, setDirty] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const source = sources[sid]
    const batch = checked.length > 0
    const editing = adding || Boolean(source) || batch

    const groupingFor = (source: RSSSource): SourceGrouping => {
        const group = groups.find(
            group => group.isMultiple && group.sids.includes(source.sid)
        )
        return group
            ? { mode: "manual", name: group.name }
            : { mode: source.autoGroup === false ? "none" : "auto" }
    }
    const draftFor = (source: RSSSource): Draft => ({
        name: source.name,
        url: source.url,
        category: source.category || SourceCategory.Articles,
        grouping: groupingFor(source),
        private: Boolean(source.private),
        hidden: Boolean(source.hidden),
        frequency: source.fetchFrequency || 0,
        openTarget: source.openTarget,
        icon: source.iconurl || "",
    })
    const loadSource = (nextSid: number) => {
        setSid(nextSid)
        setAdding(false)
        setChecked([])
        if (sources[nextSid]) setDraft(draftFor(sources[nextSid]))
        setDirty(false)
        setError("")
        setNotice("")
    }
    useEffect(() => {
        if (!requested.length) return
        if (requested.length === 1) loadSource(requested[0])
        else setChecked(requested.filter(id => Boolean(sources[id])))
        dispatch(toggleSettings(true))
    }, [requested])
    useEffect(() => {
        if (sid !== null && !sources[sid]) loadSource(null)
        setChecked(ids => ids.filter(id => Boolean(sources[id])))
    }, [sources])

    const change = (patch: Partial<Draft>) => {
        setDraft(previous => ({ ...previous, ...patch }))
        setDirty(true)
        setNotice("")
    }
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
    const selectSource = async (nextSid: number) => {
        if (nextSid === sid && !batch && !adding) return
        if (await canLeave()) loadSource(nextSid)
    }
    const checkSources = async (next: number[]) => {
        if (!(await canLeave())) return
        setChecked(next)
        setAdding(false)
        setSid(null)
        setBatchCategory("")
        setBatchGroup(null)
        setDirty(false)
        setNotice("")
        setError("")
    }
    const visible = Object.values(sources).filter(source => {
        const text = [
            source.name,
            source.url,
            source.siteUrl,
            groupingFor(source).name,
            websiteDomain(source.siteUrl),
        ]
            .join(" ")
            .toLocaleLowerCase()
        return (
            (filter === "all" ||
                (source.category || SourceCategory.Articles) === filter) &&
            text.includes(query.trim().toLocaleLowerCase())
        )
    })
    const refresh = async () => {
        dispatch(refreshSourceSelection())
        await dispatch(initFeeds(true))
    }
    const run = async (work: () => Promise<void>, saved = true) => {
        setBusy(true)
        setError("")
        setNotice("")
        if (!store.getState().app.settings.saving) dispatch(saveSettings())
        try {
            await work()
            await refresh()
            if (saved) {
                setDirty(false)
                setNotice(intl.get("subscriptionSettings.saved"))
            }
        } catch (err) {
            setError(String(err))
        } finally {
            if (store.getState().app.settings.saving) dispatch(saveSettings())
            setBusy(false)
        }
    }
    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (busy) return
        if (batch) {
            await run(async () => {
                for (const id of checked) {
                    const latest = store.getState().sources[id]
                    if (latest && batchCategory)
                        await dispatch(
                            updateSource({
                                ...latest,
                                category: batchCategory as SourceCategory,
                            })
                        )
                }
                if (batchGroup)
                    await dispatch(setSourceGrouping(checked, batchGroup))
                setBatchCategory("")
                setBatchGroup(null)
            })
            return
        }
        if (
            (!draft.name.trim() && !adding) ||
            (draft.grouping.mode === "manual" && !draft.grouping.name?.trim())
        )
            return
        await run(async () => {
            let id = sid
            if (adding) {
                id = await dispatch(
                    addSource(
                        draft.url.trim(),
                        draft.name.trim() || null,
                        true,
                        draft.category
                    )
                )
                if (id === null) throw new Error(intl.get("sources.errorAdd"))
            } else if (draft.icon.trim() !== (source.iconurl || "")) {
                if (
                    !urlTest(draft.icon.trim()) ||
                    !(await validateFavicon(draft.icon.trim()))
                )
                    throw new Error(intl.get("sources.badIcon"))
            }
            const latest = store.getState().sources[id]
            if (!latest) return
            const changes = {
                ...latest,
                name: draft.name.trim() || latest.name,
                category: draft.category,
                private: draft.private,
                openTarget: draft.openTarget,
                fetchFrequency: latest.serviceRef
                    ? latest.fetchFrequency
                    : draft.frequency,
            }
            if (!adding && draft.icon.trim() !== (source.iconurl || "")) {
                changes.iconurl = draft.icon.trim()
                changes.iconOrigin = "manual"
            }
            await dispatch(updateSource(changes))
            if (draft.hidden !== latest.hidden)
                await dispatch(toggleSourceHidden(store.getState().sources[id]))
            await dispatch(setSourceGrouping([id], draft.grouping))
            setSid(id)
            setAdding(false)
            setDraft({
                ...draft,
                name: changes.name,
                url: changes.url,
                icon: changes.iconurl || "",
            })
        })
    }
    const remove = async () => {
        const targets = (
            batch ? checked.map(id => sources[id]) : [source]
        ).filter(Boolean)
        if (
            !targets.length ||
            targets.some(source => source.serviceRef) ||
            busy
        )
            return
        if (
            !(await globalThis.utils.showMessageBox(
                intl.get("sources.delete"),
                intl.get("sources.deleteWarning"),
                intl.get("delete"),
                intl.get("cancel"),
                true,
                "warning"
            ))
        )
            return
        await run(async () => {
            await dispatch(deleteSources(targets))
            setSid(null)
            setChecked([])
            setAdding(false)
        })
    }
    const categorySelect = (
        value: string,
        onChange: (value: string) => void,
        id: string,
        placeholder?: string
    ) => (
        <select
            id={id}
            className={classes.input}
            value={value}
            onChange={event => onChange(event.target.value)}>
            {placeholder && <option value="">{placeholder}</option>}
            {categories.map(category => (
                <option key={category} value={category}>
                    {intl.get(`contentView.${category}`)}
                </option>
            ))}
        </select>
    )
    const invalid = batch
        ? (!batchCategory && !batchGroup) ||
          (batchGroup?.mode === "manual" && !batchGroup.name?.trim())
        : (!adding && !draft.name.trim()) ||
          (adding && !urlTest(draft.url.trim())) ||
          (draft.grouping.mode === "manual" && !draft.grouping.name?.trim())

    return (
        <div className={classes.root} data-source-settings>
            {serviceOn && (
                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("sources.serviceWarning")}
                </MessageBar>
            )}
            <div className={classes.toolbar}>
                <label className={classes.search}>
                    <Search20Regular />
                    <input
                        aria-label={intl.get("subscriptionSettings.search")}
                        placeholder={intl.get("subscriptionSettings.search")}
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                    />
                </label>
                <select
                    className={mergeClasses(classes.input, classes.filter)}
                    aria-label={intl.get("contentView.category")}
                    value={filter}
                    onChange={event => setFilter(event.target.value)}>
                    <option value="all">
                        {intl.get("subscriptionSettings.allCategories")}
                    </option>
                    {categories.map(category => (
                        <option key={category} value={category}>
                            {intl.get(`contentView.${category}`)}
                        </option>
                    ))}
                </select>
                <FlatButton
                    styleClass={mergeClasses(classes.button, classes.primary)}
                    disabled={busy}
                    onClick={async () => {
                        if (!(await canLeave())) return
                        setAdding(true)
                        setSid(null)
                        setChecked([])
                        setDraft(emptyDraft())
                        setDirty(false)
                        setError("")
                        setNotice("")
                    }}>
                    <Add20Regular />
                    {intl.get("sources.add")}
                </FlatButton>
                <FlatButton
                    styleClass={classes.button}
                    disabled={busy}
                    onClick={() => dispatch(importOPML())}>
                    {intl.get("sources.import")}
                </FlatButton>
                <FlatButton
                    styleClass={classes.button}
                    disabled={busy}
                    onClick={() => dispatch(exportOPML())}>
                    {intl.get("sources.export")}
                </FlatButton>
            </div>
            <div className={classes.layout}>
                <section
                    className={mergeClasses(
                        classes.list,
                        editing && classes.mobileHidden
                    )}
                    aria-label={intl.get("menu.subscriptions")}>
                    <div className={classes.listHeader}>
                        <input
                            type="checkbox"
                            aria-label={intl.get(
                                "subscriptionSettings.selectVisible"
                            )}
                            disabled={busy || !visible.length}
                            checked={
                                Boolean(visible.length) &&
                                visible.every(source =>
                                    checked.includes(source.sid)
                                )
                            }
                            ref={element => {
                                if (element)
                                    element.indeterminate =
                                        visible.some(source =>
                                            checked.includes(source.sid)
                                        ) &&
                                        !visible.every(source =>
                                            checked.includes(source.sid)
                                        )
                            }}
                            onChange={event => {
                                const ids = new Set(checked)
                                visible.forEach(source =>
                                    event.target.checked
                                        ? ids.add(source.sid)
                                        : ids.delete(source.sid)
                                )
                                void checkSources([...ids])
                            }}
                        />
                        <span>
                            {intl.get("subscriptionSettings.count", {
                                count: visible.length,
                            })}
                            {batch &&
                                ` · ${intl.get(
                                    "subscriptionSettings.selectedCount",
                                    { count: checked.length }
                                )}`}
                        </span>
                    </div>
                    <div className={classes.listBody}>
                        {visible.map(source => (
                            <div
                                key={source.sid}
                                className={mergeClasses(
                                    classes.row,
                                    source.sid === sid &&
                                        !batch &&
                                        classes.selected
                                )}>
                                <input
                                    type="checkbox"
                                    aria-label={intl.get(
                                        "subscriptionSettings.selectSource",
                                        { name: source.name }
                                    )}
                                    checked={checked.includes(source.sid)}
                                    disabled={busy}
                                    onChange={event =>
                                        void checkSources(
                                            event.target.checked
                                                ? [...checked, source.sid]
                                                : checked.filter(
                                                      id => id !== source.sid
                                                  )
                                        )
                                    }
                                />
                                <button
                                    type="button"
                                    className={classes.rowButton}
                                    disabled={busy}
                                    data-source-id={source.sid}
                                    aria-pressed={source.sid === sid && !batch}
                                    onClick={() =>
                                        void selectSource(source.sid)
                                    }>
                                    {source.iconurl ? (
                                        <img
                                            className={classes.icon}
                                            src={source.iconurl}
                                            alt=""
                                            draggable={false}
                                        />
                                    ) : (
                                        <span
                                            className={mergeClasses(
                                                classes.icon,
                                                classes.fallback
                                            )}>
                                            {source.name.slice(0, 1)}
                                        </span>
                                    )}
                                    <span className={classes.copy}>
                                        <strong title={source.name}>
                                            {source.name}
                                        </strong>
                                        <span
                                            className={mergeClasses(
                                                classes.hint,
                                                classes.metadata
                                            )}>
                                            {intl.get(
                                                `contentView.${
                                                    source.category ||
                                                    SourceCategory.Articles
                                                }`
                                            )}{" "}
                                            ·{" "}
                                            {groupingFor(source).name ||
                                                (source.autoGroup !== false
                                                    ? websiteDomain(
                                                          source.siteUrl
                                                      )
                                                    : "") ||
                                                intl.get("sources.ungrouped")}
                                        </span>
                                        <span
                                            className={mergeClasses(
                                                classes.hint,
                                                classes.metadata
                                            )}>
                                            {websiteDomain(source.siteUrl) ||
                                                source.url}
                                        </span>
                                    </span>
                                </button>
                            </div>
                        ))}
                        {!visible.length && (
                            <p className={classes.empty}>
                                {intl.get("subscriptionSettings.noResults")}
                            </p>
                        )}
                    </div>
                </section>
                <section
                    className={mergeClasses(
                        classes.details,
                        !editing && classes.mobileHidden
                    )}
                    aria-label={intl.get("sources.edit")}>
                    {!editing ? (
                        <p className={classes.empty}>
                            {intl.get("subscriptionSettings.chooseSource")}
                        </p>
                    ) : (
                        <form onSubmit={save}>
                            <div className={classes.heading}>
                                <span className={classes.back}>
                                    <FlatButton
                                        styleClass={classes.button}
                                        ariaLabel={intl.get(
                                            "subscriptionSettings.back"
                                        )}
                                        disabled={busy}
                                        onClick={async () => {
                                            if (await canLeave())
                                                loadSource(null)
                                        }}>
                                        <ArrowLeft20Regular />
                                    </FlatButton>
                                </span>
                                <h2 className={classes.title}>
                                    {batch
                                        ? intl.get(
                                              "subscriptionSettings.selectedCount",
                                              { count: checked.length }
                                          )
                                        : adding
                                        ? intl.get("sources.add")
                                        : source.name}
                                </h2>
                            </div>
                            <fieldset
                                className={classes.fields}
                                disabled={busy}>
                                {error && (
                                    <MessageBar
                                        messageBarType={MessageBarType.error}>
                                        {error}
                                    </MessageBar>
                                )}
                                {notice && (
                                    <div role="status" className={classes.hint}>
                                        {notice}
                                    </div>
                                )}
                                {source?.serviceRef && !batch && (
                                    <MessageBar
                                        messageBarType={MessageBarType.info}>
                                        {intl.get("sources.serviceManaged")}
                                    </MessageBar>
                                )}
                                {batch ? (
                                    <>
                                        <p className={classes.hint}>
                                            {intl.get(
                                                "subscriptionSettings.batchHint"
                                            )}
                                        </p>
                                        <label
                                            className={classes.field}
                                            htmlFor="batch-category">
                                            {intl.get("contentView.category")}
                                            {categorySelect(
                                                batchCategory,
                                                value => {
                                                    setBatchCategory(value)
                                                    setDirty(true)
                                                },
                                                "batch-category",
                                                intl.get(
                                                    "subscriptionSettings.unchanged"
                                                )
                                            )}
                                        </label>
                                        <label className={classes.toggle}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(batchGroup)}
                                                onChange={event => {
                                                    setBatchGroup(
                                                        event.target.checked
                                                            ? { mode: "auto" }
                                                            : null
                                                    )
                                                    setDirty(true)
                                                }}
                                            />
                                            {intl.get(
                                                "subscriptionSettings.changeGroup"
                                            )}
                                        </label>
                                        {batchGroup && (
                                            <SourceGroupPicker
                                                id="batch-group"
                                                value={batchGroup}
                                                onChange={value => {
                                                    setBatchGroup(value)
                                                    setDirty(true)
                                                }}
                                                disabled={busy}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <label
                                            className={classes.field}
                                            htmlFor="settings-source-name">
                                            {intl.get("sources.name")}
                                            <input
                                                id="settings-source-name"
                                                className={classes.input}
                                                value={draft.name}
                                                required={!adding}
                                                placeholder={
                                                    adding
                                                        ? intl.get(
                                                              "subscriptionSettings.autoName"
                                                          )
                                                        : ""
                                                }
                                                onChange={event =>
                                                    change({
                                                        name: event.target
                                                            .value,
                                                    })
                                                }
                                            />
                                        </label>
                                        <label
                                            className={classes.field}
                                            htmlFor="settings-source-url">
                                            URL
                                            <input
                                                id="settings-source-url"
                                                className={classes.input}
                                                type={adding ? "url" : "text"}
                                                required
                                                readOnly={!adding}
                                                value={draft.url}
                                                placeholder={intl.get(
                                                    "sources.inputUrl"
                                                )}
                                                onChange={event =>
                                                    change({
                                                        url: event.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                        {!adding && (
                                            <FlatButton
                                                styleClass={classes.button}
                                                onClick={() =>
                                                    globalThis.utils.writeClipboard(
                                                        draft.url
                                                    )
                                                }>
                                                {intl.get("context.copyURL")}
                                            </FlatButton>
                                        )}
                                        <label
                                            className={classes.field}
                                            htmlFor="settings-source-category">
                                            {intl.get("contentView.category")}
                                            {categorySelect(
                                                draft.category,
                                                value =>
                                                    change({
                                                        category:
                                                            value as SourceCategory,
                                                    }),
                                                "settings-source-category"
                                            )}
                                        </label>
                                        <div className={classes.field}>
                                            <label htmlFor="settings-source-group">
                                                {intl.get("groups.group")}
                                            </label>
                                            <SourceGroupPicker
                                                id="settings-source-group"
                                                value={draft.grouping}
                                                onChange={value =>
                                                    change({ grouping: value })
                                                }
                                                disabled={busy}
                                            />
                                        </div>
                                        <label className={classes.toggle}>
                                            <input
                                                type="checkbox"
                                                checked={draft.private}
                                                onChange={event =>
                                                    change({
                                                        private:
                                                            event.target
                                                                .checked,
                                                    })
                                                }
                                            />
                                            <span>
                                                {intl.get("sources.private")}
                                                <br />
                                                <small className={classes.hint}>
                                                    {intl.get(
                                                        "sources.privateDescription"
                                                    )}
                                                </small>
                                            </span>
                                        </label>
                                        <details className={classes.advanced}>
                                            <summary>
                                                {intl.get(
                                                    "subscriptionSettings.advanced"
                                                )}
                                            </summary>
                                            <div>
                                                {!source?.serviceRef && (
                                                    <label
                                                        className={
                                                            classes.field
                                                        }
                                                        htmlFor="settings-source-frequency">
                                                        {intl.get(
                                                            "sources.fetchFrequency"
                                                        )}
                                                        <select
                                                            id="settings-source-frequency"
                                                            className={
                                                                classes.input
                                                            }
                                                            value={
                                                                draft.frequency
                                                            }
                                                            onChange={event =>
                                                                change({
                                                                    frequency:
                                                                        Number(
                                                                            event
                                                                                .target
                                                                                .value
                                                                        ),
                                                                })
                                                            }>
                                                            {[
                                                                ...new Set([
                                                                    0,
                                                                    15,
                                                                    30,
                                                                    60,
                                                                    120,
                                                                    180,
                                                                    360,
                                                                    720,
                                                                    1440,
                                                                    draft.frequency,
                                                                ]),
                                                            ]
                                                                .sort(
                                                                    (a, b) =>
                                                                        a - b
                                                                )
                                                                .map(
                                                                    minutes => (
                                                                        <option
                                                                            key={
                                                                                minutes
                                                                            }
                                                                            value={
                                                                                minutes
                                                                            }>
                                                                            {minutes ===
                                                                            0
                                                                                ? intl.get(
                                                                                      "sources.unlimited"
                                                                                  )
                                                                                : minutes <
                                                                                  60
                                                                                ? intl.get(
                                                                                      "time.minute",
                                                                                      {
                                                                                          m: minutes,
                                                                                      }
                                                                                  )
                                                                                : intl.get(
                                                                                      "time.hour",
                                                                                      {
                                                                                          h:
                                                                                              minutes /
                                                                                              60,
                                                                                      }
                                                                                  )}
                                                                        </option>
                                                                    )
                                                                )}
                                                        </select>
                                                    </label>
                                                )}
                                                <label
                                                    className={classes.field}
                                                    htmlFor="settings-source-target">
                                                    {intl.get(
                                                        "sources.openTarget"
                                                    )}
                                                    <select
                                                        id="settings-source-target"
                                                        className={
                                                            classes.input
                                                        }
                                                        value={draft.openTarget}
                                                        onChange={event =>
                                                            change({
                                                                openTarget:
                                                                    Number(
                                                                        event
                                                                            .target
                                                                            .value
                                                                    ),
                                                            })
                                                        }>
                                                        <option
                                                            value={
                                                                SourceOpenTarget.Local
                                                            }>
                                                            {intl.get(
                                                                "sources.rssText"
                                                            )}
                                                        </option>
                                                        <option
                                                            value={
                                                                SourceOpenTarget.FullContent
                                                            }>
                                                            {intl.get(
                                                                "article.loadFull"
                                                            )}
                                                        </option>
                                                        <option
                                                            value={
                                                                SourceOpenTarget.Webpage
                                                            }>
                                                            {intl.get(
                                                                "sources.loadWebpage"
                                                            )}
                                                        </option>
                                                        <option
                                                            value={
                                                                SourceOpenTarget.External
                                                            }>
                                                            {intl.get(
                                                                "openExternal"
                                                            )}
                                                        </option>
                                                    </select>
                                                </label>
                                                <label
                                                    className={classes.toggle}>
                                                    <input
                                                        type="checkbox"
                                                        checked={draft.hidden}
                                                        onChange={event =>
                                                            change({
                                                                hidden: event
                                                                    .target
                                                                    .checked,
                                                            })
                                                        }
                                                    />
                                                    {intl.get("sources.hidden")}
                                                </label>
                                                {!adding && (
                                                    <>
                                                        <label
                                                            className={
                                                                classes.field
                                                            }
                                                            htmlFor="settings-source-icon">
                                                            {intl.get("icon")}
                                                            <input
                                                                id="settings-source-icon"
                                                                className={
                                                                    classes.input
                                                                }
                                                                value={
                                                                    draft.icon
                                                                }
                                                                onChange={event =>
                                                                    change({
                                                                        icon: event
                                                                            .target
                                                                            .value,
                                                                    })
                                                                }
                                                            />
                                                        </label>
                                                        <FlatButton
                                                            styleClass={
                                                                classes.button
                                                            }
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void run(
                                                                    async () => {
                                                                        await dispatch(
                                                                            updateFavicon(
                                                                                [
                                                                                    sid,
                                                                                ],
                                                                                true
                                                                            )
                                                                        )
                                                                        setDraft(
                                                                            previous => ({
                                                                                ...previous,
                                                                                icon:
                                                                                    store.getState()
                                                                                        .sources[
                                                                                        sid
                                                                                    ]
                                                                                        ?.iconurl ||
                                                                                    "",
                                                                            })
                                                                        )
                                                                    },
                                                                    false
                                                                )
                                                            }>
                                                            {intl.get(
                                                                "subscriptions.refreshIcon"
                                                            )}
                                                        </FlatButton>
                                                    </>
                                                )}
                                            </div>
                                        </details>
                                    </>
                                )}
                            </fieldset>
                            <div className={classes.actions}>
                                {!adding &&
                                    (batch
                                        ? checked.every(
                                              id =>
                                                  sources[id] &&
                                                  !sources[id].serviceRef
                                          )
                                        : !source?.serviceRef) && (
                                        <FlatButton
                                            styleClass={mergeClasses(
                                                classes.button,
                                                classes.danger
                                            )}
                                            disabled={busy}
                                            onClick={() => void remove()}>
                                            {intl.get("sources.delete")}
                                        </FlatButton>
                                    )}
                                <FlatButton
                                    styleClass={classes.button}
                                    disabled={busy}
                                    onClick={() => {
                                        if (adding || batch) loadSource(null)
                                        else {
                                            setDraft(draftFor(source))
                                            setDirty(false)
                                            setError("")
                                            setNotice("")
                                        }
                                    }}>
                                    {intl.get("cancel")}
                                </FlatButton>
                                <button
                                    type="submit"
                                    className={mergeClasses(
                                        classes.button,
                                        classes.primary
                                    )}
                                    disabled={busy || Boolean(invalid)}>
                                    {adding
                                        ? intl.get("add")
                                        : intl.get("sources.update")}
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            </div>
        </div>
    )
}

export default SourcesTab
