import { createSlice } from '@reduxjs/toolkit';



const appointmentSlice = createSlice({
    name: 'settings',
    initialState: {
        appointments: []
    },
    reducers: {
        initializeAppointments: (state, action) => {
            state.appointments = action.payload;
        },


    },
});

export const appointmentActions = appointmentSlice.actions;

export default appointmentSlice;
