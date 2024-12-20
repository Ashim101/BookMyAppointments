import { configureStore } from '@reduxjs/toolkit';
import settingReducers from "./adminSlice"
import doctorReducers from "./doctorSlice"
import appointmentSlice from './appointmentSlice';

const store = configureStore({
    reducer: {
        settings: settingReducers,
        doctor: doctorReducers,
        appointments: appointmentSlice.reducer
    },
});

export default store;
