import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import intl from "react-intl-universal"
import { makeStyles, mergeClasses } from "@griffel/react"
import { Combobox, Option } from "@fluentui/react-components"
import {
    Chat24Regular,
    DocumentText24Regular,
    Image24Regular,
    Video24Regular,
} from "@fluentui/react-icons"
import { SourceCategory } from "../schema-types"
import { closeSourceEditor } from "../scripts/models/app"
import { initFeeds } from "../scripts/models/feed"
import {
    removeSourceFromGroup,
    moveToNamedGroup,
} from "../scripts/models/group"
import { getItemMedia } from "../scripts/models/item"
import { refreshSourceSelection } from "../scripts/models/page"
import {
    toggleSourceHidden,
    updateSource,
    updateFavicon,
} from "../scripts/models/source"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"

const categories = [
    SourceCategory.Articles,
    SourceCategory.Social,
    SourceCategory.Pictures,
    SourceCategory.Videos,
]

const icons = {
    [SourceCategory.Articles]: DocumentText24Regular,
    [SourceCategory.Social]: Chat24Regular,
    [SourceCategory.Pictures]: Image24Regular,
    [SourceCategory.Videos]: Video24Regular,
}

const useStyles = makeStyles({
    dialog: {
        width: "min(700px, calc(100vw - 40px))",
        maxHeight: "min(760px, calc(100vh - 40px))",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--white)",
        color: "var(--neutralPrimary)",
        borderRadius: "14px",
        boxShadow: "0 22px 65px #0004",
        overflow: "hidden",
    },
    heading: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 24px 14px",
        borderBottom: "1px solid var(--neutralQuaternaryAlt)",
    },
    title: { margin: 0, fontSize: "18px", fontWeight: 600 },
    close: {
        border: 0,
        backgroundColor: "transparent",
        color: "var(--neutralSecondary)",
        fontSize: "24px",
        cursor: "pointer",
    },
    body: { overflowY: "auto", padding: "20px 24px 12px" },
    source: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "20px",
        fontSize: "13px",
        color: "var(--neutralSecondary)",
        overflowWrap: "anywhere",
    },
    icon: { width: "34px", height: "34px", borderRadius: "8px" },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginBottom: "16px",
    },
    label: { fontSize: "13px", fontWeight: 600 },
    input: {
        boxSizing: "border-box",
        width: "100%",
        height: "38px",
        padding: "0 12px",
        border: "1px solid var(--neutralQuaternaryAlt)",
        borderRadius: "8px",
        backgroundColor: "var(--white)",
        color: "var(--neutralPrimary)",
        font: "inherit",
    },
    groupDropdown: {
        "minHeight": "38px",
        "borderRadius": "8px",
        "backgroundColor": "var(--white)",
        "color": "var(--neutralPrimary)",
        "border": "1px solid var(--neutralQuaternaryAlt)",
        "& input": { color: "inherit" },
    },
    toggle: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "13px",
        cursor: "pointer",
    },
    hint: {
        color: "var(--neutralSecondary)",
        fontSize: "12px",
        lineHeight: "18px",
    },
    views: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4, minmax(0, 1fr))",
        "gap": "10px",
        "marginTop": "10px",
        "marginBottom": "8px",
        "@media (max-width: 560px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
    },
    view: {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "stretch",
        "gap": "8px",
        "padding": "8px",
        "border": "1px solid var(--neutralQuaternaryAlt)",
        "borderRadius": "10px",
        "backgroundColor": "var(--white)",
        "color": "var(--neutralPrimary)",
        "textAlign": "left",
        "cursor": "pointer",
        ":hover": { border: "1px solid var(--primary)" },
    },
    selected: {
        border: "1px solid var(--primary)",
        boxShadow: "0 0 0 1px var(--primary) inset",
        color: "var(--primary)",
    },
    preview: {
        height: "85px",
        padding: "7px",
        borderRadius: "6px",
        backgroundColor: "var(--neutralLighterAlt)",
        overflow: "hidden",
        fontSize: "9px",
        lineHeight: "13px",
        color: "var(--neutralSecondary)",
    },
    previewImage: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: "4px",
    },
    previewMedia: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        borderRadius: "4px",
        backgroundImage: "linear-gradient(135deg, #d7e8f7, #e9def6)",
        color: "#65768c",
    },
    previewVideo: {
        backgroundImage: "linear-gradient(135deg, #314455, #171e2d)",
        color: "white",
    },
    previewPlay: {
        position: "absolute",
        zIndex: 1,
        display: "grid",
        placeItems: "center",
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        backgroundColor: "#0009",
        color: "white",
        fontSize: "12px",
    },
    previewTitle: {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "12px",
        fontWeight: 600,
    },
    previewLine: {
        display: "block",
        height: "5px",
        marginTop: "8px",
        borderRadius: "3px",
        backgroundColor: "var(--neutralTertiaryAlt)",
    },
    footer: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
        padding: "14px 24px 18px",
        borderTop: "1px solid var(--neutralQuaternaryAlt)",
    },
    button: {
        minWidth: "72px",
        height: "34px",
        padding: "0 14px",
        border: "1px solid var(--neutralQuaternaryAlt)",
        borderRadius: "8px",
        backgroundColor: "var(--white)",
        color: "var(--neutralPrimary)",
        cursor: "pointer",
    },
    primary: {
        border: "1px solid var(--primary)",
        backgroundColor: "var(--primary)",
        color: "white",
    },
})

export function SourceEditor() {
    const dispatch = useAppDispatch()
    const classes = useStyles()
    const sid = useAppSelector(state => state.app.sourceEditorSid)
    const source = useAppSelector(state => state.sources[sid])
    const groups = useAppSelector(state => state.groups)
    const groupOptions = useMemo(
        () => [
            { key: -1, text: intl.get("subscriptions.autoGroup") },
            { key: -2, text: intl.get("sources.ungrouped") },
            ...groups
                .filter(group => group.isMultiple)
                .map(group => ({
                    key: `group:${group.name}`,
                    text: group.name,
                })),
        ],
        [groups]
    )
    const sample = useAppSelector(state =>
        sid === null
            ? null
            : Object.values(state.items).find(item => item.source === sid)
    )
    const [name, setName] = useState("")
    const [category, setCategory] = useState(SourceCategory.Articles)
    const [groupIndex, setGroupIndex] = useState(-1)
    const [groupName, setGroupName] = useState("")
    const [refreshingIcon, setRefreshingIcon] = useState(false)
    const [privateSource, setPrivateSource] = useState(false)
    const [hidden, setHidden] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!source) return
        setName(source.name || "")
        setCategory(source.category || SourceCategory.Articles)
        setGroupIndex(
            groups.findIndex(
                group => group.isMultiple && group.sids.includes(sid)
            ) >= 0
                ? 0
                : source.autoGroup === false
                ? -2
                : -1
        )
        setGroupName(
            groups.find(group => group.isMultiple && group.sids.includes(sid))
                ?.name || ""
        )
        setPrivateSource(Boolean(source.private))
        setHidden(Boolean(source.hidden))
    }, [sid])

    useEffect(() => {
        if (sid === null) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") dispatch(closeSourceEditor())
        }
        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [sid])

    if (!source) return null
    const media = sample ? getItemMedia(sample) : null
    const image = sample?.thumb || media?.images?.[0]
    const previewText = (sample?.snippet || source.name)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 84)
    const currentGroupIndex = groups.findIndex(group =>
        group.sids.includes(source.sid)
    )
    const currentGroup = groups[currentGroupIndex]

    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!name.trim() || saving || refreshingIcon) return
        setSaving(true)
        try {
            const latestSource = dispatch(
                (_, getState) => getState().sources[sid]
            )
            if (!latestSource) return
            await dispatch(
                updateSource({
                    ...latestSource,
                    name: name.trim(),
                    category,
                    private: privateSource,
                    autoGroup: groupIndex !== -2,
                })
            )
            if (hidden !== source.hidden) {
                await dispatch(toggleSourceHidden(latestSource))
            }
            if (groupIndex >= 0 && groupName.trim()) {
                dispatch(moveToNamedGroup(groupName.trim(), [source.sid]))
            } else if (currentGroup?.isMultiple) {
                dispatch(removeSourceFromGroup(currentGroupIndex, [source.sid]))
            }
            dispatch(refreshSourceSelection())
            dispatch(initFeeds(true))
            dispatch(closeSourceEditor())
        } catch (error) {
            globalThis.utils.showErrorBox(
                intl.get("sources.edit"),
                String(error)
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="modern-dialog-backdrop"
            onMouseDown={() => dispatch(closeSourceEditor())}>
            <form
                role="dialog"
                aria-modal="true"
                aria-label={intl.get("sources.edit")}
                className={classes.dialog}
                onMouseDown={event => event.stopPropagation()}
                onSubmit={save}>
                <header className={classes.heading}>
                    <h2 className={classes.title}>
                        {intl.get("sources.edit")}
                    </h2>
                    <button
                        type="button"
                        className={classes.close}
                        aria-label={intl.get("cancel")}
                        onClick={() => dispatch(closeSourceEditor())}>
                        ×
                    </button>
                </header>
                <div className={classes.body}>
                    <div className={classes.source}>
                        {source.iconurl && (
                            <img
                                className={classes.icon}
                                src={source.iconurl}
                                alt=""
                            />
                        )}
                        <span>{source.url}</span>
                    </div>
                    <button
                        type="button"
                        className={classes.button}
                        disabled={refreshingIcon || saving}
                        onClick={async () => {
                            setRefreshingIcon(true)
                            try {
                                await dispatch(updateFavicon([sid], true))
                            } finally {
                                setRefreshingIcon(false)
                            }
                        }}>
                        {intl.get("subscriptions.refreshIcon")}
                    </button>
                    <label className={classes.field}>
                        <span className={classes.label}>
                            {intl.get("sources.name")}
                        </span>
                        <input
                            className={classes.input}
                            value={name}
                            onChange={event => setName(event.target.value)}
                            autoFocus
                            required
                        />
                    </label>
                    <div className={classes.field}>
                        <label
                            htmlFor="source-editor-group"
                            className={classes.label}>
                            {intl.get("groups.group")}
                        </label>
                        <Combobox
                            key={sid}
                            id="source-editor-group"
                            className={classes.groupDropdown}
                            aria-label={intl.get("groups.group")}
                            freeform
                            value={
                                groupIndex === -1
                                    ? intl.get("subscriptions.autoGroup")
                                    : groupIndex === -2
                                    ? intl.get("sources.ungrouped")
                                    : groupName
                            }
                            selectedOptions={[
                                groupIndex < 0
                                    ? String(groupIndex)
                                    : `group:${groupName}`,
                            ]}
                            onOptionSelect={(_, data) => {
                                // Typing a freeform name clears the previous selection.
                                if (data.optionValue === undefined) return
                                if (
                                    data.optionValue === "-1" ||
                                    data.optionValue === "-2"
                                ) {
                                    setGroupIndex(Number(data.optionValue))
                                    setGroupName("")
                                } else {
                                    setGroupIndex(0)
                                    setGroupName(data.optionText || "")
                                }
                            }}
                            onChange={event => {
                                setGroupIndex(0)
                                setGroupName(event.target.value)
                            }}>
                            {groupOptions.map(option => (
                                <Option
                                    key={option.key}
                                    value={String(option.key)}>
                                    {option.text}
                                </Option>
                            ))}
                        </Combobox>
                        {groupIndex >= 0 &&
                            groupName.trim() &&
                            !groups.some(
                                group =>
                                    group.isMultiple &&
                                    group.name === groupName.trim()
                            ) && (
                                <small className={classes.hint}>
                                    {intl.get("subscriptions.createOnSave", {
                                        name: groupName.trim(),
                                    })}
                                </small>
                            )}
                    </div>
                    <label className={classes.toggle}>
                        <input
                            type="checkbox"
                            checked={privateSource}
                            onChange={event =>
                                setPrivateSource(event.target.checked)
                            }
                        />
                        <span>
                            <strong>{intl.get("sources.private")}</strong>
                            <br />
                            <small className={classes.hint}>
                                {intl.get("sources.privateDescription")}
                            </small>
                        </span>
                    </label>
                    <label className={classes.toggle}>
                        <input
                            type="checkbox"
                            checked={hidden}
                            onChange={event => setHidden(event.target.checked)}
                        />
                        <strong>{intl.get("sources.hidden")}</strong>
                    </label>
                    <div className={classes.label}>
                        {intl.get("context.view")}
                    </div>
                    <div className={classes.views} role="radiogroup">
                        {categories.map(option => {
                            const Icon = icons[option]
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    role="radio"
                                    aria-label={intl.get(
                                        `contentView.${option}`
                                    )}
                                    aria-checked={category === option}
                                    className={mergeClasses(
                                        classes.view,
                                        category === option && classes.selected
                                    )}
                                    onClick={() => setCategory(option)}>
                                    <span className={classes.preview}>
                                        {option === SourceCategory.Pictures ||
                                        option === SourceCategory.Videos ? (
                                            <span
                                                className={mergeClasses(
                                                    classes.previewMedia,
                                                    option ===
                                                        SourceCategory.Videos &&
                                                        classes.previewVideo
                                                )}>
                                                <Icon />
                                                {image && (
                                                    <img
                                                        className={
                                                            classes.previewImage
                                                        }
                                                        src={image}
                                                        alt=""
                                                        onError={event => {
                                                            event.currentTarget.style.display =
                                                                "none"
                                                        }}
                                                    />
                                                )}
                                                {option ===
                                                    SourceCategory.Videos && (
                                                    <span
                                                        className={
                                                            classes.previewPlay
                                                        }>
                                                        ▶
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <>
                                                {option ===
                                                SourceCategory.Articles ? (
                                                    <strong>
                                                        {sample?.title ||
                                                            source.name}
                                                    </strong>
                                                ) : (
                                                    <span>{previewText}</span>
                                                )}
                                                <span
                                                    className={
                                                        classes.previewLine
                                                    }
                                                />
                                                <span
                                                    className={
                                                        classes.previewLine
                                                    }
                                                />
                                            </>
                                        )}
                                    </span>
                                    <span className={classes.previewTitle}>
                                        <Icon />
                                        {intl.get(`contentView.${option}`)}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
                <footer className={classes.footer}>
                    <button
                        type="button"
                        className={classes.button}
                        onClick={() => dispatch(closeSourceEditor())}>
                        {intl.get("cancel")}
                    </button>
                    <button
                        type="submit"
                        disabled={saving || refreshingIcon}
                        className={mergeClasses(
                            classes.button,
                            classes.primary
                        )}>
                        {intl.get("sources.update")}
                    </button>
                </footer>
            </form>
        </div>
    )
}
