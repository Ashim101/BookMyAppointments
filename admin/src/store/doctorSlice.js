import { createSlice } from "@reduxjs/toolkit";


const doctorSlice = createSlice({
    name: 'doctors',
    initialState: {
        doctors: [],
        doctorToken: localStorage.dtoken ? localStorage.dtoken : null,

    },
    reducers: {
        initializeDoctors: (state, action) => {
            console.log("adding all doctor", action.payload)

            state.doctors = action.payload


        },
        setDoctorToken: (state, action) => {
            state.doctorToken = action.payload;
        },
        clearDoctorToken: (state) => {
            state.doctorToken = null;
        },



    }

})

export const doctorActions = doctorSlice.actions;

export default doctorSlice.reducer;