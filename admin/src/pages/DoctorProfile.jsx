import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { doctorActions } from '../store/doctorSlice'; // Import the doctor slice actions
import axios from 'axios';
import { toast } from 'react-toastify';

const DoctorProfile = () => {
    const dispatch = useDispatch();
    const { backendUrl } = useSelector(store => store.settings);
    const { doctorToken } = useSelector(store => store.doctor);

    const [doctorData, setDoctorData] = useState(null);  // Store fetched doctor profile
    const [isEditing, setIsEditing] = useState(false);   // Toggle between view and edit mode

    // Refs to capture the values of the inputs
    const addressRef1 = useRef();
    const addressRef2 = useRef();
    const feesRef = useRef();
    const availableRef = useRef();

    useEffect(() => {
        // Fetch doctor profile data from the backend
        const fetchDoctorProfile = async () => {
            try {
                const response = await axios.get(backendUrl + 'api/doctor/profile', {
                    headers: {
                        dtoken: doctorToken,
                    },
                });
                setDoctorData(response.data.profile);
            } catch (error) {
                toast.error('Error fetching doctor profile:', error);
            }
        };

        fetchDoctorProfile();
    }, [doctorToken]);

    // Handle save button click
    const handleSave = async () => {
        const updatedData = {
            address: {
                line1: addressRef1.current.value,
                line2: addressRef2.current.value
            },
            fees: feesRef.current.value,
            available: availableRef.current.checked,
        };

        try {
            // Send the updated data to the backend
            await axios.put(backendUrl + 'api/doctor/profile', updatedData, {
                headers: {
                    dtoken: doctorToken,
                },
            });

            // Dispatch the updated data to the Redux store
            // dispatch(doctorActions.updateProfile(updatedData));

            // Switch back to view mode
            setIsEditing(false);
            setDoctorData(prevProfile => ({
                ...prevProfile,  // Preserve the existing profile state
                address: updatedData.address,  // Update only the address field
                fees: updatedData.fees,  // Update only the fee field
                available: updatedData.available,  // Update only the availability field
            }));
        } catch (error) {
            toast.error('Error saving profile changes:', error);
        }
    };

    // Handle edit button click
    const handleEdit = () => {
        setIsEditing(true);
    };

    if (!doctorData) {
        return <p>Loading...</p>;
    }

    return (
        <div className="doctor-profile bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center">
                <img src={doctorData.image} alt="Doctor" className="w-24 h-24 rounded-full" />
                <div className="ml-4">
                    <h2 className="text-xl font-bold">{doctorData.name}</h2>
                    <div className="flex gap-2">
                        <p className="text-gray-500"> {doctorData.speciality}</p>
                        <button className='text-gray-400 text-sm  border-2 border-gray-600 rounded-lg px-2 '>
                            {doctorData.experience}
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <h3 className="text-lg font-semibold">About:</h3>
                <p>{doctorData.about}</p>
            </div>

            <div className="mt-4">
                <h3 className="text-lg font-semibold">Appointment fee:</h3>
                {isEditing ? (
                    <input
                        type="number"
                        name="fees"
                        defaultValue={doctorData.fees}
                        ref={feesRef}
                        className="border border-gray-300 rounded-md p-2"
                    />
                ) : (
                    <p>${doctorData.fees}</p>
                )}
            </div>

            <div className="mt-4">
                <h3 className="text-lg font-semibold">Address:</h3>
                {isEditing ? (
                    <div className='flex flex-col items-center'>
                        <textarea
                            name="address"
                            defaultValue={`${doctorData.address.line1}`}
                            ref={addressRef1}
                            className="border border-gray-300 rounded-md p-2 w-1/2 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            rows="2"
                            placeholder="Enter address line 1"
                        />
                        <textarea
                            name="address"
                            defaultValue={` ${doctorData.address.line2}`}
                            ref={addressRef2}
                            className="border border-gray-300 rounded-md p-2 w-1/2 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mt-2"
                            rows="2"
                            placeholder="Enter address line 2"
                        />
                    </div>
                ) : (
                    <div>
                        <p>{doctorData.address.line1}</p>
                        <p>{doctorData.address.line2}</p>
                    </div>
                )}
            </div>

            <div className="mt-4">
                <h3 className="text-lg font-semibold">Availability:</h3>
                {isEditing ? (
                    <div>
                        <input
                            type="checkbox"
                            defaultChecked={doctorData.available}
                            ref={availableRef}
                        />
                        <label className="ml-2">Available</label>
                    </div>
                ) : (
                    <p>{doctorData.available ? 'Available' : 'Not Available'}</p>
                )}
            </div>

            <div className="mt-4">
                {isEditing ? (
                    <button
                        onClick={handleSave}
                        className="bg-purple-500 text-white px-4 py-2 rounded-md"
                    >
                        Save
                    </button>
                ) : (
                    <button
                        onClick={handleEdit}
                        className="bg-purple-500 text-white px-4 py-2 rounded-md"
                    >
                        Edit
                    </button>
                )}
            </div>
        </div>
    );
};

export default DoctorProfile;
