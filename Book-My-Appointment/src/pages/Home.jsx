import React, { useEffect } from 'react'
import Header from '../components/Header'
import Speciality from '../components/Speciality'
import TopDoctors from '../components/TopDoctors'
import Banner from '../components/Banner'
import { useDispatch, useSelector } from 'react-redux'
import { doctorActions } from '../store/DoctorSlice'
import axios from 'axios'

const Home = () => {
    const dispatch = useDispatch()

    const { backendUrl } = useSelector(store => store.settings)
    const fetchDoctors = async () => {
        try {
            const response = await axios.get(`${backendUrl}api/doctor/list`, {
            });

            if (response.data.success) {
                dispatch(doctorActions.initializetheDoctors(response.data.doctors))
            } else {
            }
        } catch (error) {
        }
    };

    useEffect(() => {

        fetchDoctors();
    }, [backendUrl]);
    return (
        <div>
            <Header />
            <Speciality />
            <TopDoctors />
            <Banner />
        </div>
    )
}

export default Home