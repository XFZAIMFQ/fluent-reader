import * as React from "react"
import intl from "react-intl-universal"
import { DefaultButton } from "@fluentui/react"
import { makeStyles } from "@griffel/react"
import { useAppDispatch, useAppSelector } from "../../scripts/reducer"
import { sidebarGroups } from "../../scripts/sidebar-groups"
import { updateSourceGroup } from "../../scripts/models/group"
import { setReaderPreferences } from "../../scripts/models/page"
import { SubscriptionPolicy } from "../../schema-types"
import { SubscriptionPolicyFields } from "../utils/subscription-policy-fields"
import { SettingsDropdown } from "../utils/settings-dropdown"
import { SettingsSection } from "../utils/settings-section"

const useStyles = makeStyles({
    root: { marginTop: "30px" },
    fields: { border: 0, padding: 0, margin: 0, minWidth: 0 },
    actions: { display: "flex", justifyContent: "flex-end", marginTop: "12px" },
    notice: {
        fontSize: "12px",
        color: "var(--neutralSecondary)",
        textAlign: "right",
    },
})

export default function GroupPolicySettings() {
    const classes = useStyles()
    const dispatch = useAppDispatch()
    const groups = useAppSelector(state => state.groups)
    const sources = useAppSelector(state => state.sources)
    const preferences = useAppSelector(state => state.page.readerPreferences)
    const folders = sidebarGroups(groups, Object.values(sources)).folders
    const [key, setKey] = React.useState("")
    const [value, setValue] = React.useState<SubscriptionPolicy>({})
    const [busy, setBusy] = React.useState(false)
    const [notice, setNotice] = React.useState("")
    const folder = folders.find(folder => folder.key === key)
    React.useLayoutEffect(() => {
        setValue(
            folder
                ? folder.index === undefined
                    ? preferences.domainPolicies[folder.domain] || {}
                    : groups[folder.index].policy || {}
                : {}
        )
        setNotice("")
    }, [key, groups, preferences])
    const save = async () => {
        if (!folder || busy) return
        setBusy(true)
        try {
            if (folder.index !== undefined)
                await dispatch(
                    updateSourceGroup({
                        ...groups[folder.index],
                        index: folder.index,
                        policy: value,
                    })
                )
            else
                await dispatch(
                    setReaderPreferences({
                        domainPolicies: {
                            [folder.domain]: value,
                        },
                    })
                )
            setNotice(intl.get("policy.saved"))
        } catch (error) {
            setNotice(String(error))
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className={classes.root} data-group-policy>
            <SettingsSection
                title={intl.get("policy.groupDefaults")}
                description={intl.get("policy.groupHint")}>
                <div className="modern-setting-row">
                    <div className="modern-setting-copy">
                        <label
                            id="group-policy-folder-label"
                            htmlFor="group-policy-folder">
                            <strong>{intl.get("groups.chooseGroup")}</strong>
                        </label>
                    </div>
                    <SettingsDropdown
                        id="group-policy-folder"
                        aria-labelledby="group-policy-folder-label"
                        placeholder={intl.get("groups.chooseGroup")}
                        disabled={busy}
                        selectedKey={key}
                        options={folders.map(folder => ({
                            key: folder.key,
                            text: folder.name,
                        }))}
                        onChange={(_, option) => setKey(String(option.key))}
                    />
                </div>
                {folder && (
                    <fieldset disabled={busy} className={classes.fields}>
                        <SubscriptionPolicyFields
                            id="group-policy"
                            value={value}
                            onChange={setValue}
                            layout="rows"
                            disabled={busy}
                        />
                        <div className={classes.actions}>
                            <DefaultButton
                                text={intl.get("policy.save")}
                                onClick={() => void save()}
                                disabled={busy}
                            />
                        </div>
                    </fieldset>
                )}
                {!!notice && (
                    <p className={classes.notice} role="status">
                        {notice}
                    </p>
                )}
            </SettingsSection>
        </div>
    )
}
