import React, { useRef, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { settingActions } from '../store/configSlice';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import OtpModal from '../components/OtpModal'; // Import the OTP Modal Component

const Login = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { backendUrl, token } = useSelector(store => store.settings);
    const [state, setState] = useState("Sign up");

    const fullNameRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);

    const [showOtpModal, setShowOtpModal] = useState(false); // Show OTP modal state
    const [emailForOtp, setEmailForOtp] = useState(null); // Store the email for OTP verification

    const handleOnError = () => {
        console.log("Google login error occurred");
    };

    const handleOnSuccess = async (response) => {
        const credential = response.credential;
        try {
            const { data } = await axios.post(backendUrl + "api/user/google-auth", { token: credential });
            if (data.success) {
                dispatch(settingActions.setToken(data.token));
                localStorage.setItem("token", data.token);
                toast.success("Login successful!");
                navigate("/");
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Google login failed");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (state === "Sign up") {
            const name = fullNameRef.current.value;
            const email = emailRef.current.value;
            const password = passwordRef.current.value;

            // Proceed with OTP verification after sign-up logic

            try {
                const { data } = await axios.post(backendUrl + "api/user/generate-otp", { email })
                if (data.success) {
                    setShowOtpModal(true); // Show OTP modal

                }
                else {
                    toast.error(data.message)
                }

            } catch (error) {

            }
            setEmailForOtp(email);
        } else {
            const email = emailRef.current.value;
            const password = passwordRef.current.value;

            try {
                const { data } = await axios.post(backendUrl + "api/user/login", { email, password });
                if (data.success) {
                    dispatch(settingActions.setToken(data.token));
                    localStorage.setItem("token", data.token);
                    navigate("/");
                } else {
                    toast.error(data.message);
                }
            } catch (e) {
                toast.error("Error occurred. Please try again!");
            }
        }
    };

    const handleOtpSubmit = async (otp) => {
        // Handle OTP submission logic here (send OTP to server)
        try {
            console.log(emailForOtp, otp)
            const { data } = await axios.post(`${backendUrl}api/user/verify-otp`,
                {
                    email: emailForOtp,
                    otp: otp,
                }
            );
            if (data.success) {
                try {
                    const { data } = await axios.post(backendUrl + "api/user/register", { name: fullNameRef.current.value, email: emailRef.current.value, password: passwordRef.current.value })
                    if (data.success) {
                        localStorage.setItem('token', data.token)
                        toast.success("Account created. Welcome to Prescriptio")
                        navigate("/"); // Redirect to the main page or dashboard

                    }
                    else {
                        toast.error(data.message)
                    }
                } catch (error) {
                    console.log(error)
                    toast.error("something went wrong")

                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("OTP verification failed");
        }
    };

    return (
        <div className="flex justify-center bg-gray-50">
            <div className="my-6 mx-10 bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-center">{state === "Sign up" ? "Create Account" : "Login"}</h2>
                <p className="text-center text-gray-500 mb-6">{state === "Sign up" ? "Please sign up to book an appointment" : "Please sign in to book an appointment"}</p>

                <form onSubmit={handleSubmit}>
                    {state === "Sign up" && (
                        <div className="mb-4">
                            <p className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="fullName">Full Name</p>
                            <input
                                type="text"
                                ref={fullNameRef}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter your full name"
                                required
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="email">Email</label>
                        <input
                            type="email"
                            ref={emailRef}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">Password</label>
                        <input
                            type="password"
                            ref={passwordRef}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                        {state === "Sign up" ? "Create account" : "Login"}
                    </button>
                </form>

                {state === "Sign up" ? (
                    <p className="text-center text-gray-500 mt-6">
                        Already have an account?{' '}
                        <span onClick={() => setState("Sign in")} className="text-blue-500 hover:underline cursor-pointer">Login here</span>
                    </p>
                ) : (
                    <p className="text-center text-gray-500 mt-6">
                        Create a new account?{' '}
                        <span onClick={() => setState("Sign up")} className="text-blue-500 hover:underline cursor-pointer">Signup here</span>
                    </p>
                )}

                <GoogleLogin onSuccess={handleOnSuccess} onError={handleOnError} />

                {/* Show OTP Modal when needed */}
                {showOtpModal && <OtpModal onSubmit={handleOtpSubmit} />}
            </div>
        </div>
    );
};

export default Login;
