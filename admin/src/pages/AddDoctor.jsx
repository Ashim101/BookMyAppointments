import React, { useRef, useState } from 'react';
import { assets } from '../assets/assets_frontend/assets';
import { useSelector } from 'react-redux';
import axios, { toFormData } from 'axios';
import { toast } from 'react-toastify';

const AddDoctor = () => {

    const { adminToken, backendUrl } = useSelector(store => store.settings);
    // Creating refs for form fields
    const nameRef = useRef();
    const emailRef = useRef();
    const passwordRef = useRef();
    const experienceRef = useRef();
    const feesRef = useRef();
    const aboutRef = useRef();
    const specialityRef = useRef();
    const educationRef = useRef();
    const address1Ref = useRef();
    const address2Ref = useRef();

    // Specialities array with only names for the select options
    const specialities = [
        'General physician',
        'Gynecologist',
        'Dermatologist',
        'Pediatricians',
        'Neurologist',
        'Gastroenterologist',
    ];

    // Generating experience options from 1 to 10 years
    const experienceOptions = Array.from({ length: 10 }, (_, i) => `${i + 1} year${i === 0 ? '' : 's'}`);

    // State for image (profile picture)
    const [docImg, setDocImg] = useState(null);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Accessing the values of inputs



        const formData = new FormData();

        // Append each field using ref.current.value
        formData.append('name', nameRef.current.value);
        formData.append('email', emailRef.current.value);
        formData.append('password', passwordRef.current.value);
        formData.append('experience', experienceRef.current.value);
        formData.append('fees', feesRef.current.value);
        formData.append('about', aboutRef.current.value);
        formData.append('speciality', specialityRef.current.value);
        formData.append('degree', educationRef.current.value);
        formData.append('available', true);


        // Append address fields
        formData.append('address', JSON.stringify({ line1: address1Ref.current.value, line2: address2Ref.current.value }));

        // Append the profile image (if present)
        if (docImg) {
            formData.append('image', docImg);
        }

        // Log each key-value pair in the FormData
        for (let [key, value] of formData.entries()) {
            console.log(`${key}: ${value}`);
        }

        // Now formData contains all the key-value pairs


        try {
            const response = await axios.post(backendUrl + 'api/admin/add-doctor', formData, { headers: { atoken: adminToken } });
            console.log(response)

            if (response.data.success) {
                toast.success("Doctor created")
            }
            else {
                toast.error(data.response.message)
            }
        } catch (e) {
            console.log(e)
            toast.error(e.response.data.message)

        }


    }
    // You can now send this data to your backend or use it as needed


    // Handle image file selection
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setDocImg(file); // Update the state with the selected image
        }
    };

    return (
        <div className="w-full mx-auto p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-6">Add Doctor</h2>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-4 mb-8 text-gray-500">
                        <label htmlFor="doc-img">
                            <img
                                className="w-16 bg-gray-100 rounded-full cursor-pointer"
                                src={docImg ? URL.createObjectURL(docImg) : assets.upload_area}
                                alt="Doctor"
                            />
                        </label>
                        <input
                            onChange={handleImageChange}
                            type="file"
                            id="doc-img"
                            hidden
                        />
                        <p>Upload doctor picture</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Doctor Name</label>
                        <input
                            type="text"
                            ref={nameRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Speciality</label>
                        <select
                            ref={specialityRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            {specialities.map((speciality, index) => (
                                <option key={index} value={speciality}>
                                    {speciality}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Doctor Email</label>
                        <input
                            type="email"
                            ref={emailRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Your email"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Education</label>
                        <input
                            type="text"
                            ref={educationRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Education"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Doctor Password</label>
                        <input
                            type="password"
                            ref={passwordRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Address 1</label>
                        <input
                            type="text"
                            ref={address1Ref}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Address 1"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Experience</label>
                        <select
                            ref={experienceRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            {experienceOptions.map((experience, index) => (
                                <option key={index} value={experience}>
                                    {experience}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Address 2</label>
                        <input
                            type="text"
                            ref={address2Ref}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Address 2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fees</label>
                        <input
                            type="text"
                            ref={feesRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Your fees"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">About Me</label>
                        <textarea
                            ref={aboutRef}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Write about yourself"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    className="mt-6 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition"
                >
                    Add Doctor
                </button>
            </form>
        </div>
    );
};

export default AddDoctor;
