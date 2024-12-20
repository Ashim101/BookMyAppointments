import React, { useState } from 'react';
import { assets } from "../assets/assets_frontend/assets";
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { settingActions } from '../store/configSlice';

const Navbar = () => {
    const dispatch = useDispatch()

    const { backendUrl, token } = useSelector(store => store.settings)
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State to manage dropdown visibility

    const toggleDropdown = () => {
        setIsDropdownOpen(prev => !prev); // Toggle dropdown visibility
    };

    return (
        <div className="navbar flex flex-wrap gap-3 sm:flex-col md:flex-row justify-between py-1">
            {/* Logo section */}
            <div onClick={() => navigate('/')} className="logo">
                <img src={assets.logo} alt="Logo" className="image-class" />
            </div>

            {/* Navigation links */}
            <div className="navlinks flex items-center">
                <ul className='flex flex-wrap space-x-4'>
                    <li>
                        <NavLink
                            to="/"
                            className={({ isActive }) =>
                                isActive ? 'nav-link border-b-2 border-primary pb-1' : 'nav-link'
                            }>
                            Home
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to="/doctors"
                            className={({ isActive }) =>
                                isActive ? 'nav-link border-b-2 border-primary pb-1' : 'nav-link'
                            }>
                            All Doctors
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to="/about"
                            className={({ isActive }) =>
                                isActive ? 'nav-link border-b-2 border-primary pb-1' : 'nav-link'
                            }>
                            About
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to="/contact"
                            className={({ isActive }) =>
                                isActive ? 'nav-link border-b-2 border-primary pb-1' : 'nav-link'
                            }>
                            Contact
                        </NavLink>
                    </li>
                </ul>
            </div>

            {token ? (
                <div className="flex items-center relative">
                    <img src={assets.profile_pic} alt="Profile" className="image-class h-12 rounded-full" />
                    <img
                        src={assets.dropdown_icon}
                        alt="Dropdown"
                        className="image-class h-2 rounded-full cursor-pointer"
                        onClick={toggleDropdown} // Toggle dropdown on click
                    />
                    {/* Dropdown Menu */}

                    {isDropdownOpen && (
                        <div className="absolute right-0 top-[50px]  bg-white shadow-lg rounded-lg w-[200px]">
                            <ul className="py-2 space-y-2">
                                <li onClick={() => { navigate("my-profile") }} className=" mx-3 hover:bg-gray-100 cursor-pointer">My Profile</li>
                                <li onClick={() => { navigate("my-appointments") }} className=" mx-3 hover:bg-gray-100 cursor-pointer">My Appointments</li>
                                <li onClick={() => { dispatch(settingActions.clearToken()); localStorage.removeItem("token"); navigate("/") }
                                } className="mx-2 hover:bg-gray-100 cursor-pointer">Logout</li>
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-cente my-5 sm:my-auto">
                    <button onClick={() => navigate('/login')} className='bg-primary px-2 py-2 rounded-lg  text-white'>
                        Create account
                    </button>
                </div>
            )}
        </div>
    );
}

export default Navbar;
