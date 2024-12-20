import { createSlice } from '@reduxjs/toolkit'


const DoctorSlice = createSlice({
    name: 'doctors',
    initialState: [],
    reducers: {

        initializetheDoctors(state, action) {
            return action.payload

        },

        addDoctor(state, action) {
            return state;

        },

        removeDoctor(state, action) {
            return state

        }



    }
})

export const doctorActions = DoctorSlice.actions;
export default DoctorSlice;