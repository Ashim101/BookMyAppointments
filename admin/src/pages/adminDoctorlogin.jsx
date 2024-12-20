import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { settingActions } from '../store/adminSlice';
import { toast } from 'react-toastify';
import { doctorActions } from '../store/doctorSlice';

const LoginPage = () => {
    const [isAdminLogin, setIsAdminLogin] = useState(true);
    const { backendUrl } = useSelector(store => store.settings);

    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Refs for email and password input fields
    const emailRef = useRef(null);
    const passwordRef = useRef(null);

    // Toggle between Admin and Doctor Login
    const toggleLogin = () => {
        setIsAdminLogin(!isAdminLogin);
    };

    // Form submit handler
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Retrieve input values
        const email = emailRef.current.value;
        const password = passwordRef.current.value;

        if (isAdminLogin) {
            try {
                const response = await axios.post(backendUrl + 'api/admin/login', { email, password });
                console.log(response);
                if (response.data.success === true) {
                    localStorage.setItem("token", response.data.token);
                    dispatch(settingActions.setAdminToken(response.data.token));
                    navigate('/Dashboard'); // Navigate to dashboard page after successful login
                } else {
                    toast.error("Invalid credentials");
                }
            } catch (error) {
                toast.error("Login failed!");
            }
        } else {
            try {
                const { data } = await axios.post(backendUrl + 'api/doctor/login', { email, password });
                if (data.success) {
                    localStorage.setItem("dtoken", data.token);
                    dispatch(doctorActions.setDoctorToken(data.token));
                    console.log(data.token)
                    navigate('/Dashboard'); // Navigate to dashboard page after successful login
                } else {
                    toast.error("Invalid credentials");
                }

            } catch (error) {
                toast.error("Doctor login failed!");
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-xs p-8 space-y-4 bg-white rounded shadow-lg">
                <h2 className="text-2xl font-semibold text-center text-indigo-600">
                    {isAdminLogin ? 'Admin Login' : 'Doctor Login'}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            ref={emailRef}
                            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            ref={passwordRef}
                            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 mt-4 text-white bg-indigo-500 rounded hover:bg-indigo-600 focus:outline-none"
                    >
                        Login
                    </button>
                </form>
                <div className="text-center">
                    <button
                        onClick={toggleLogin}
                        className="text-sm text-indigo-500 hover:underline focus:outline-none"
                    >
                        {isAdminLogin ? 'Doctor Login? Click here' : 'Admin Login? Click here'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
