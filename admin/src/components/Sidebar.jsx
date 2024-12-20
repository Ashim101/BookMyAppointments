import React, { useState } from 'react';
import { FaHome, FaCalendarAlt, FaUserPlus, FaUserMd } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation(); // Get the current URL
    const [activeTab, setActiveTab] = useState(location.pathname); // Set initial active tab based on URL

    return (
        <div className="w-64 bg-white shadow-lg">
            <div className="px-4 py-8">
                <ul className="space-y-4">
                    <li
                        className={`flex items-center p-2 rounded-lg hover:bg-indigo-100 ${activeTab === '/Dashboard' ? 'bg-indigo-200' : 'text-gray-700'}`}
                    >
                        <Link
                            to="/Dashboard"
                            onClick={() => setActiveTab('/Dashboard')} // Set active tab on click
                            className="flex items-center"
                        >
                            <FaHome className="w-5 h-5 mr-2" />
                            Dashboard
                        </Link>
                    </li>
                    <li
                        className={`flex items-center p-2 rounded-lg hover:bg-indigo-100 ${activeTab === '/appointments' ? 'bg-indigo-200' : 'text-gray-700'}`}
                    >
                        <Link
                            to="/appointments"
                            onClick={() => setActiveTab('/appointments')} // Set active tab on click
                            className="flex items-center"
                        >
                            <FaCalendarAlt className="w-5 h-5 mr-2" />
                            Appointments
                        </Link>
                    </li>
                    <li
                        className={`flex items-center p-2 rounded-lg hover:bg-indigo-100 ${activeTab === '/add-doctor' ? 'bg-indigo-200' : 'text-gray-700'}`}
                    >
                        <Link
                            to="/add-doctor"
                            onClick={() => setActiveTab('/add-doctor')} // Set active tab on click
                            className="flex items-center"
                        >
                            <FaUserPlus className="w-5 h-5 mr-2" />
                            Add Doctor
                        </Link>
                    </li>
                    <li
                        className={`flex items-center p-2 rounded-lg hover:bg-indigo-100 ${activeTab === '/doctorlist' ? 'bg-indigo-200' : 'text-gray-700'}`}
                    >
                        <Link
                            to="/doctorlist"
                            onClick={() => setActiveTab('/doctorlist')} // Set active tab on click
                            className="flex items-center"
                        >
                            <FaUserMd className="w-5 h-5 mr-2" />
                            Doctors List
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default Sidebar;
