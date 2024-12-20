import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { appointmentActions } from '../store/appointmentSlice';
import { toast } from 'react-toastify';
import { assets } from '../assets/assets_admin/assets';
import axios from 'axios';

const DoctorAppointment = () => {
    const dispatch = useDispatch()

    const { backendUrl } = useSelector(store => store.settings)
    const { doctorToken } = useSelector(store => store.doctor)
    const { appointments } = useSelector(store => store.appointments)


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

    const handleOnCancel = async (appointment_id) => {
        try {
            const { data } = await axios.patch(
                `${backendUrl}api/doctor/cancel-appointment`,
                { appointment_id }, // Send appointment_id in the request body
                {
                    headers: {
                        dtoken: doctorToken// Assuming adminToken is correctly set
                    }
                }
            );

            // Handle the response data if needed
            if (data.success) {
                toast.success("Cancelled successfully")
                fetchAllAppointments()
            }
            else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error('Error canceling appointment:', error.response || error.message);
        }

    }

    const handleOnFinish = async (appointment_id) => {

        try {
            const { data } = await axios.patch(
                `${backendUrl}api/doctor/finish-appointment`,
                { appointment_id }, // Send appointment_id in the request body
                {
                    headers: {
                        dtoken: doctorToken// Assuming adminToken is correctly set
                    }
                }
            );

            // Handle the response data if needed
            if (data.success) {
                toast.success("Updated successfully")
                fetchAllAppointments()
            }
            else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error('Error canceling appointment:', error.response || error.message);
        }


    }


    {
        if (!appointments) {
            return <div>
                Loading...
            </div>
        }
    }
    const revAppointments = [...appointments].reverse()
    return (
        <div >
            <p className='text-xl font-semibold my-10'>All Appointments</p>
            <div className='grid grid-flow-col grid-cols-[0.5fr_3fr_1fr_3fr_1fr_2fr] bg-white border-gray-500 rounded-lg p-4 gap-x-10 text-lg font-semibold'>

                <p>#</p>
                <p>Patient</p>
                <p>Age</p>
                <p>Date and time</p>
                <p>Fees</p>
                <p>Actions</p>
            </div>


            {revAppointments?.map((appointment, index) => (
                <div className='grid grid-flow-col grid-cols-[0.5fr_3fr_1fr_3fr_1fr_2fr] bg-white border-gray-500 rounded-lg p-4 text-sm gap-x-10'>
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

                    {
                        appointment.isCompleted ? <p className='text-green-600 text-sm'>Completed</p> :
                            appointment.cancelled ? <p className='text-red-600 text-sm'>Cancelled</p> :
                                <div className=' ml-5 flex gap-1'>

                                    <img onClick={() => handleOnCancel(appointment._id)} className='h-7 cursor-pointer ' src={assets.cancel_icon} alt="" />
                                    <img onClick={() => handleOnFinish(appointment._id)} className='h-7 cursor-pointer ' src={assets.tick_icon} alt="" />
                                </div>

                    }




                </div>

            ))}

        </div>
    )
}

export default DoctorAppointment