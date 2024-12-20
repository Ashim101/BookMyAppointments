import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    adminToken: localStorage.token ? localStorage.token : null,
    backendUrl: import.meta.env.VITE_BACKEND_URL,
};

const settingSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setAdminToken: (state, action) => {
            state.adminToken = action.payload;
        },
        clearAdminToken: (state) => {
            state.adminToken = null;
        },
        setBackendUrl: (state, action) => {
            state.backendUrl = action.payload;
        },
    },
});

export const settingActions = settingSlice.actions;

export default settingSlice.reducer;
