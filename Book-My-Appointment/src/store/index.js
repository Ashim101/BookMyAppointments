import { configureStore } from '@reduxjs/toolkit'
import DoctorSlice from './DoctorSlice'
import settingSlice from './configSlice'


export const store = configureStore({
    reducer: {
        doctors: DoctorSlice.reducer,
        settings: settingSlice.reducer

    },
})