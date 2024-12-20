import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    backendUrl: import.meta.env.VITE_BACKEND_URL,
    token: localStorage.getItem("token") ? localStorage.getItem("token") : false
};

const settingSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setToken: (state, action) => {
            state.token = action.payload;
        },
        clearToken: (state) => {
            state.token = null;
        },
        setBackendUrl: (state, action) => {
            state.backendUrl = action.payload;
        },
    },
});

export const settingActions = settingSlice.actions;

export default settingSlice
