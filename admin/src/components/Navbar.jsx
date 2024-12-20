import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { settingActions } from '../store/adminSlice';
import { doctorActions } from '../store/doctorSlice';
import { assets } from '../assets/assets_frontend/assets';

const Navbar = () => {
    const navigate = useNavigate();
    const { adminToken } = useSelector(store => store.settings);
    const { doctorToken } = useSelector(store => store.doctor);

    const dispatch = useDispatch();

    return (
        <div className="navbar flex flex-wrap gap-3 sm:flex-col md:flex-row justify-between py-1">
            {/* Logo section */}
            <div onClick={() => navigate('/')} className="logo flex gap-2 items-center">
                <img src={assets.logo} alt="Logo" className="image-class" />
                {adminToken && <p className='text-gray-500 text-sm border-gray-800 rounded-lg px-1 border-2 h-1/2'>Admin</p>}
                {doctorToken && <p className='text-gray-500 text-sm border-gray-800 rounded-lg px-1 border-2 h-1/2'>Doctor</p>}
            </div>

            {/* Navigation links */}

            <div className="flex items-center">
                <button
                    onClick={() => {
                        if (adminToken) {
                            // Admin Logout
                            localStorage.removeItem('token'); // Ensure this matches the correct key in localStorage
                            dispatch(settingActions.clearAdminToken()); // Dispatch action to clear admin token
                            navigate("/"); // Redirect to login page
                        } else if (doctorToken) {
                            // Doctor Logout
                            localStorage.removeItem('dtoken'); // Ensure this matches the correct key in localStorage
                            dispatch(doctorActions.clearDoctorToken()); // Dispatch action to clear doctor token
                            navigate("/"); // Redirect to login page
                        }
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}

export default Navbar;
