import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { appointmentActions } from '../store/appointmentSlice';
import { toast } from 'react-toastify';
import axios from 'axios';
import { assets } from '../assets/assets_admin/assets';

const DoctorDashBoard = () => {

    const { backendUrl } = useSelector(store => store.settings)
    const { doctorToken } = useSelector(store => store.doctor)

    const [dashData, setDashData] = useState()
    const dispatch = useDispatch()

    const calculateAge = (dob) => {
        if (dob === 'Not selected') {
            return 'Not selected';
        }

        const birthDate = new Date(dob);  // Assumes dob in format 'YYYY-MM-DD'
        const today = new Date();

        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDifference = today.getMonth() - birthDate.getMonth();

        // Adjust age if the birth date hasn't occurred yet this year
        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    }

    const fetchAllAppointments = async () => {
        try {
            console.log("fetching")
            const { data } = await axios.get(`${backendUrl}api/doctor/all-appointments`, {
                headers: {
                    dtoken: doctorToken,  // Ensure adminToken is correct
                },
            });
            console.log(data)

            if (data.success) {
                toast.success('Appointments fetched successfully');
                dispatch(appointmentActions.initializeAppointments(data.message))
            } else {
                toast.error(data.error.message);
            }
        } catch (e) {
            toast.error('Error fetching appointments');
        }


    };



    const getDashboardData = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}api/doctor/dashboard`, {
                headers: {
                    dtoken: doctorToken
                }
            });

            console.log(data)

            if (data.success) {
                console.log(data)
                setDashData(data.message)
            }
            else {
                console.log("error")
                toast.error("cant fetch dashboard data")
            }
        } catch (error) {
            console.error('Error fetching dashboard data');
        }
    };

    useEffect(() => {
        fetchAllAppointments();
        getDashboardData();
    }, [doctorToken, backendUrl]);





    return (
        <div>
            {dashData ? (

                <div className='space-y-10 mt-10'>
                    <div className='flex justify-around'>
                        <div className='flex flex-col items-center border-gray-600 rounded-lg bg-white px-16 py-5 justify-around'>
                            <img className='w-13' src={assets.doctor_icon} alt="" />
                            <p className='text-lg font-semibold'>Earnings: {dashData.earning}</p>
                        </div>

                        <div className='flex flex-col items-center justify-around border-gray-600 rounded-lg  bg-white px-16 py-5  '>
                            <img className='w-13' src={assets.patients_icon} alt="" />
                            <p className='text-lg font-semibold' >Patients: {dashData.patients}</p>
                        </div>
                        <div className='flex flex-col items-center border-gray-600 rounded-lg bg-white px-16 py-5 justify-around'>
                            <img className='w-10' src={assets.appointment_icon} alt="" />
                            <p className='text-lg font-semibold'>Appointments: {dashData.appointments}</p>
                        </div>
                    </div>


                    <div>
                        <p className='text-xl font-semibold'>Latest Appointments</p>
                    </div>
                    <div>


                        <div className='grid grid-flow-col grid-cols-[0.5fr_3fr_1fr_3fr_1fr] bg-white border-gray-500 rounded-lg p-4 gap-x-10 text-xl font-normal'>

                            <p>#</p>
                            <p>Patient</p>
                            <p>Age</p>
                            <p>Date and time</p>
                            <p>Fees</p>
                        </div>

                        {dashData.latestAppointments.map((appointment, index) => (
                            <div className='grid grid-flow-col grid-cols-[0.5fr_3fr_1fr_3fr_1fr] bg-white border-gray-500 rounded-lg p-4 text-sm gap-x-10'>
                                <p>
                                    {index + 1}
                                </p>
                                <div className='flex justify-around '>
                                    <img
                                        className='w-7  rounded-full'
                                        src=""
                                        alt="User profile"
                                    />
                                    <p>{appointment.userData.name}</p>
                                </div>
                                <p>
                                    {calculateAge(appointment.userData.dob)}
                                </p>
                                <p>
                                    {`${new Date(appointment.slotDate.replace(/_/g, '-').split('-').reverse().join('-')).toLocaleDateString('en-GB', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })} , ${appointment.slotTime}`}
                                </p>

                                <p>{appointment.docData.fees}</p>





                            </div>

                        ))}

                    </div>
                </div>
            ) : (
                <p>Loading appointments...</p>
            )
            }

        </div >
    );
};
export default DoctorDashBoard