import * as React from "react"
import intl from "react-intl-universal"
import { Dropdown, DefaultButton, Label } from "@fluentui/react"
import { useAppDispatch, useAppSelector } from "../../scripts/reducer"
import { sidebarGroups } from "../../scripts/sidebar-groups"
import { updateSourceGroup } from "../../scripts/models/group"
import { setReaderPreferences } from "../../scripts/models/page"
import { SubscriptionPolicy } from "../../schema-types"
import { SubscriptionPolicyFields } from "../utils/subscription-policy-fields"

export default function GroupPolicySettings() {
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
        <section data-group-policy>
            <h3>{intl.get("policy.groupDefaults")}</h3>
            <p>{intl.get("policy.groupHint")}</p>
            <Label htmlFor="group-policy-folder">
                {intl.get("groups.chooseGroup")}
            </Label>
            <Dropdown
                id="group-policy-folder"
                disabled={busy}
                selectedKey={key}
                options={folders.map(folder => ({
                    key: folder.key,
                    text: folder.name,
                }))}
                onChange={(_, option) => setKey(String(option.key))}
            />
            {folder && (
                <fieldset disabled={busy}>
                    <SubscriptionPolicyFields
                        id="group-policy"
                        value={value}
                        onChange={setValue}
                    />
                    <DefaultButton
                        text={intl.get("policy.save")}
                        onClick={() => void save()}
                    />
                </fieldset>
            )}
            {!!notice && <p role="status">{notice}</p>}
        </section>
    )
}
