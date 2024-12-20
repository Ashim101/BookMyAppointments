// src/components/Sidebar.jsx
import React from 'react';
import { FaHome, FaCalendarAlt, FaUserPlus, FaUserMd } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

const doctorSidebar = () => {


    return (
        <div className="w-64 bg-white shadow-lg"> {/* Hide sidebar on small screens */}
            <div className="px-4 py-8">
                <ul className="space-y-4">
                    <li className="flex items-center p-2 text-gray-700 rounded-lg hover:bg-indigo-100">
                        <FaHome className="w-5 h-5 mr-2" />
                        <Link to="/Dashboard">Dashboard</Link>
                    </li>
                    <li className="flex items-center p-2 text-gray-700 rounded-lg hover:bg-indigo-100">
                        <FaCalendarAlt className="w-5 h-5 mr-2" />
                        <Link to="/appointments">Appointments</Link>
                    </li>

                    <li className="flex items-center p-2 text-gray-700 rounded-lg hover:bg-indigo-100">
                        <FaUserMd className="w-5 h-5 mr-2" />
                        <Link to="/profile">Profile</Link>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default doctorSidebar;
