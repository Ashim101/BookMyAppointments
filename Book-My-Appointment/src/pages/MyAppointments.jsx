import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { doctorActions } from '../store/DoctorSlice';

const MyAppointments = () => {
    const { token, backendUrl } = useSelector((store) => store.settings);
    const [appointments, setAppointments] = useState([]);
    const [error, setError] = useState(null);
    const dispatch = useDispatch()

    const fetchDoctors = async () => {
        try {
            const response = await axios.get(`${backendUrl}api/doctor/list`);
            if (response.data.success) {
                dispatch(doctorActions.initializetheDoctors(response.data.doctors));
            }
        } catch (error) {
        }
    };

    const fetchAppointments = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}api/user/appointments`, {
                headers: {
                    token
                }
            });

            if (data.success) {
                setAppointments(data.appointments);
                console.log(data.appointments);
            } else {
                toast.error(data.message);
                setError(data.message); // Set the error message if fetching fails
            }
        } catch (e) {
            setError(e.response?.data?.message || 'Error fetching appointments.');
        }
    };

    useEffect(() => {
        if (token && backendUrl) {
            fetchAppointments();
        }
    }, [token, backendUrl]); // Add token and backendUrl to dependencies if needed

    if (error) {
        return <p>{error}</p>; // Display error message if it exists
    }

    if (!appointments.length) {
        return <p>No appointments found.</p>;  // Display this if no appointments are fetched
    }

    // Function to format the date as "day, month-name, year"
    const formatDate = (dateString) => {
        // Split the date into day, month, and year
        const [day, month, year] = dateString.split('_');

        // Create a new Date object with the correct format
        const date = new Date(`${month}-${day}-${year}`);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const handleCancelAppointment = async (appointmentId) => {
        try {
            const { data } = await axios.delete(
                backendUrl + "api/user/cancel-appointment",
                {
                    data: { appointmentId },  // The 'data' field holds the payload
                    headers: { token }         // Include the token in headers
                }
            ); if (data.success) {
                toast.success(data.message)
                fetchAppointments()
                fetchDoctors()
            }

        } catch (error) {

            toast.error(error.response.message)
            console.log(error.response.message)
        }

    }

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">My Appointments</h2>
            {appointments.map((appointment, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-4 mb-4">
                    <div className="flex items-center">
                        {/* Doctor's Image */}
                        <img
                            src={appointment.docData.image}
                            alt={appointment.docData.name}
                            className="w-20 h-20 rounded-full mr-4"
                        />
                        {/* Doctor's Information */}
                        <div>
                            <h3 className="text-xl font-semibold">Name:{appointment.docData.name}</h3>
                            <p className="text-sm text-gray-500">{appointment.docData.specialty}</p>
                            <p className="text-sm">Address: {appointment.docData.address?.line1}</p>
                            <p className="text-sm">{appointment.docData.address?.line2}</p>
                            <p className="text-sm">
                                Date & Time: {formatDate(appointment.slotDate)} {appointment.slotTime}
                            </p>
                        </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex justify-end mt-4">
                        {!appointment.payment && (!appointment.cancelled) && !appointment.isCompleted && (
                            <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2">
                                Pay Here
                            </button>
                        )}
                        <button disabled={appointment.cancelled || appointment.isCompleted} onClick={() => handleCancelAppointment(appointment._id)} className="bg-gray-500 text-white px-4 py-2 rounded-md">
                            {appointment.cancelled || appointment.isCompleted ? 'Cancelled' : 'Cancel Appointment'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MyAppointments;
