import { connect } from "react-redux"
import {
    initIntl,
    saveSettings,
    setupAutoFetch,
    setPrivacyMode,
} from "../../scripts/models/app"
import * as db from "../../scripts/db"
import AppTab from "../../components/settings/app"
import { importAll } from "../../scripts/settings"
import { updateUnreadCounts } from "../../scripts/models/source"
import { AppDispatch } from "../../scripts/utils"
import { RootState } from "../../scripts/reducer"

const mapStateToProps = (state: RootState) => ({
    privacyMode: state.app.privacyMode,
})

const mapDispatchToProps = (dispatch: AppDispatch) => ({
    setPrivacyMode: (enabled: boolean) => dispatch(setPrivacyMode(enabled)),
    setLanguage: (option: string) => {
        window.settings.setLocaleSettings(option)
        dispatch(initIntl())
    },
    setFetchInterval: (interval: number) => {
        window.settings.setFetchInterval(interval)
        dispatch(setupAutoFetch())
    },
    deleteArticles: async (days: number) => {
        dispatch(saveSettings())
        let date = new Date()
        date.setTime(date.getTime() - days * 86400000)
        await db.itemsDB
            .delete()
            .from(db.items)
            .where(db.items.date.lt(date))
            .exec()
        await dispatch(updateUnreadCounts())
        dispatch(saveSettings())
    },
    importAll: async () => {
        dispatch(saveSettings())
        let cancelled = await importAll()
        if (cancelled) dispatch(saveSettings())
    },
})

const AppTabContainer = connect(mapStateToProps, mapDispatchToProps)(AppTab)
export default AppTabContainer
