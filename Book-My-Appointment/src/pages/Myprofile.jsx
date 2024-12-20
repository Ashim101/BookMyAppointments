import React, { useEffect, useRef, useState } from 'react';
import { assets } from '../assets/assets_frontend/assets';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { json } from 'react-router-dom';
// import toast from "react-toastify"

const MyProfile = () => {
    // State to manage edit mode and user data
    const { backendUrl, token } = useSelector(store => store.settings);
    const [isEditMode, setIsEditMode] = useState(false);
    const [userData, setUserData] = useState(null); // State to hold user data
    const [profilePic, setProfilePic] = useState(null); // State for new profile image

    // Refs for input fields
    const nameRef = useRef();
    const emailRef = useRef();
    const phoneRef = useRef();
    const addressLine1Ref = useRef();
    const addressLine2Ref = useRef();
    const genderRef = useRef();
    const dobRef = useRef();

    const fetchData = async () => {
        try {
            const { data } = await axios.get(backendUrl + "api/user/profile", { headers: { token } });
            setUserData(data.userData); // Set user data once fetched
        } catch (error) {
        }
    };

    // Fetch user profile data on component mount
    useEffect(() => {
        fetchData();
    }, [backendUrl, token]);

    // Handle file input change
    const handleImageChange = (e) => {
        setProfilePic(e.target.files[0]); // Store the selected image file in state
    };

    // Toggle edit mode and optionally save data
    const toggleEditMode = async () => {
        if (isEditMode) {
            // Collect the updated data
            const updatedData = {
                name: nameRef.current.value,
                email: emailRef.current.value,
                phone: phoneRef.current.value,
                address: {
                    line1: addressLine1Ref.current.value,
                    line2: addressLine2Ref.current.value,
                }, // Address as an object
                gender: genderRef.current.value,
                dob: dobRef.current.value,
            };

            // Create FormData
            const formData = new FormData();

            // Append each field separately to the FormData object
            formData.append("name", updatedData.name);
            formData.append("email", updatedData.email);
            formData.append("phone", updatedData.phone);
            formData.append("address", JSON.stringify(updatedData.address)); // Address as a JSON string
            formData.append("gender", updatedData.gender);
            formData.append("dob", updatedData.dob);

            // If there's a profile picture, append it as well
            if (profilePic) {
                formData.append("image", profilePic);
            }

            // Log FormData entries
            console.log("FormData Entries:");
            formData.forEach((value, key) => {
                console.log(key, value);
            });

            formData.forEach((value, key) => {
                console.log(key, value);
            });

            try {
                // Send PATCH request to update profile
                await axios.patch(backendUrl + "api/user/update-profile", formData, {
                    headers: {
                        token,
                        "Content-Type": "multipart/form-data"
                    }
                });
                // Fetch updated user data after saving
                await fetchData();
            } catch (error) {
            }
        }
        setIsEditMode(!isEditMode);
    };

    if (!userData) {
        return <div>Loading...</div>; // Show a loading state while fetching data
    }

    return (
        <div className="flex flex-col items-center p-8">
            {/* Profile Image and Name */}
            <div className="flex items-center gap-6">
                <img
                    src={profilePic ? URL.createObjectURL(profilePic) : userData.image}
                    alt="Profile"
                    className={` w-24 h-24 rounded-full object-cover `}
                />

                <div className="text-left">
                    {isEditMode ? (
                        <input
                            ref={nameRef}
                            defaultValue={userData.name}
                            className="text-3xl font-bold border-b-2 border-gray-300 focus:outline-none focus:border-primary"
                        />
                    ) : (
                        <h2 className="text-3xl font-bold">{userData.name}</h2>
                    )}
                </div>
            </div>

            {/* Image upload field */}
            {isEditMode && (
                <div className="mt-4">
                    <label className="block text-gray-600">Upload new profile picture:</label>
                    <input type="file" accept="image/*" onChange={handleImageChange} />
                </div>
            )}

            {/* Contact Information */}
            <div className="mt-8 w-3/4 md:w-1/2 border-t pt-6">
                <h3 className="text-xl font-semibold mb-2">Contact Information</h3>
                <p className="text-gray-600">
                    <span className="font-semibold">Email id:</span>{' '}
                    {isEditMode ? (
                        <input
                            ref={emailRef}
                            defaultValue={userData.email}
                            className="border-b-2 border-gray-300 focus:outline-none focus:border-primary"
                        />
                    ) : (
                        <a href={`mailto:${userData.email}`} className="text-blue-600 underline">{userData.email}</a>
                    )}
                </p>
                <p className="text-gray-600">
                    <span className="font-semibold">Phone:</span>{' '}
                    {isEditMode ? (
                        <input
                            ref={phoneRef}
                            defaultValue={userData.phone}
                            className="border-b-2 border-gray-300 focus:outline-none focus:border-primary"
                        />
                    ) : (
                        <a href={`tel:${userData.phone}`} className="text-blue-600 underline">{userData.phone}</a>
                    )}
                </p>
                <p className="text-gray-600">
                    <span className="font-semibold">Address:</span>{' '}
                    {isEditMode ? (
                        <>
                            <input
                                ref={addressLine1Ref}
                                defaultValue={userData.address.line1}
                                className="block border-b-2 border-gray-300 focus:outline-none focus:border-primary"
                            />
                            <input
                                ref={addressLine2Ref}
                                defaultValue={userData.address.line2}
                                className="block border-b-2 border-gray-300 focus:outline-none focus:border-primary"
                            />
                        </>
                    ) : (
                        `${userData.address.line1}, ${userData.address.line2}`
                    )}
                </p>
            </div>

            {/* Basic Information */}
            <div className="mt-6 w-3/4 md:w-1/2">
                <h3 className="text-xl font-semibold mb-2">Basic Information</h3>
                <p className="text-gray-600">
                    <span className="font-semibold">Gender:</span>{' '}
                    {isEditMode ? (
                        <input
                            ref={genderRef}
                            defaultValue={userData.gender}
                            className="border-b-2 border-gray-300 focus:outline-none focus:border-primary"
                        />
                    ) : (
                        userData.gender
                    )}
                </p>
                <p className="text-gray-600">
                    <span className="font-semibold">Birthday:</span>{' '}
                    {isEditMode ? (
                        <input
                            ref={dobRef}
                            defaultValue={userData.dob}
                            type="date"
                            className="border-b-2 border-gray-300 focus:outline-none focus:border-primary"
                        />
                    ) : (

                        new Date(userData.dob).toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })
                    )}
                </p>
            </div>

            {/* Buttons */}
            <div className="mt-6 flex gap-4">
                <button
                    onClick={toggleEditMode}
                    className="border-2 border-primary text-primary rounded-lg px-6 py-2 hover:bg-primary hover:text-white"
                >
                    {isEditMode ? 'Save information' : 'Edit'}
                </button>
            </div>
        </div>
    );
};

export default MyProfile;
