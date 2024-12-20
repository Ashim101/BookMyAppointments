import React, { useEffect } from 'react'
import Header from '../components/Header'
import Speciality from '../components/Speciality'
import Doctors from '../components/DoctorCards'
import Banner from '../components/Banner'
import { useDispatch, useSelector } from 'react-redux'
import { doctorActions } from '../store/DoctorSlice'
import axios from 'axios'
import CircularSpinner from '../components/Spinner'
import { useNavigate } from 'react-router-dom'

const Home = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const doctors = useSelector(store => store.doctors)


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
    console.log(doctors)

    return (
        <div>
            <Header />
            <Speciality />
            <div className='flex  flex-col items-center my-14 mt-20 gap-2'>
                <h1 className='text-xl font-light md:text-3xl'>Top doctors to book</h1>
                <p className='text-sm font-light md:text-xl text-center'>Simply browse through our extensive list of best doctors</p>

            </div>
            <Doctors doctors={doctors.slice(0, 10)} />
            <button onClick={() => navigate("/doctors")} className='flex my-5 bg-primary rounded-md px-3 py-1 text-white mx-auto'>More</button>

            <Banner />
        </div>
    )
}

export default Home