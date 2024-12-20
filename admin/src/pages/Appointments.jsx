import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { assets } from '../assets/assets_frontend/assets'
import axios from 'axios'
import { toast } from 'react-toastify'
import { appointmentActions } from '../store/appointmentSlice'

const Appointments = () => {
    const { appointments } = useSelector(store => store.appointments)

    const { backendUrl, adminToken } = useSelector(store => store.settings)

    const dispatch = useDispatch()

    const fetchAllAppointments = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}api/admin/all-appointments`, {
                headers: {
                    atoken: adminToken,  // Ensure adminToken is correct
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
                `${backendUrl}api/admin/cancel-appointment`,
                { appointment_id }, // Send appointment_id in the request body
                {
                    headers: {
                        atoken: adminToken // Assuming adminToken is correctly set
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
    return (
        <div className='w-full space-y-6 '>
            <p className='text-xl font-semibold'>All Appointments</p>
            <div className='grid grid-flow-col grid-cols-[0.5fr_3fr_1fr_3fr_3fr_1fr_2fr] bg-white border-gray-500 rounded-lg p-4 gap-x-10 text-lg font-semibold'>

                <p>#</p>
                <p>Patient</p>
                <p>Age</p>
                <p>Date and time</p>
                <p>Doctor</p>
                <p>Fees</p>
                <p>Actions</p>
            </div>


            {appointments.map((appointment, index) => (
                <div className='grid grid-flow-col grid-cols-[0.5fr_3fr_1fr_3fr_3fr_1fr_2fr] bg-white border-gray-500 rounded-lg p-4 text-sm gap-x-10'>
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

                    <div className='flex justify-around'>
                        <img className='w-7 h-10 rounded-full bg-gray-300' src={appointment.docData.image} alt="" />
                        <p>{appointment.docData.name}</p>
                    </div>
                    <p>{appointment.docData.fees}</p>

                    {




                        appointment.cancelled ? <p className='text-red-500 text-sm'>Cancelled</p>

                            : appointment.isCompleted ? <p className='text-green-500 text-sm'>Completed</p>


                                : <img onClick={() => handleOnCancel(appointment._id)} className='h-7 ml-10' src={assets.cross_icon} alt="" />
                    }




                </div>

            ))}
        </div>


    )
}

export default Appointments