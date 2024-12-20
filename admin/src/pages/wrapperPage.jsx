import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { appointmentActions } from '../store/appointmentSlice';

const WrapperPage = ({ children }) => {


    const { adminToken, backendUrl } = useSelector(store => store.settings);

    const dispatch = useDispatch()



    const fetchAllAppointments = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}api/admin/all-appointments`, {
                headers: {
                    atoken: adminToken,  // Ensure adminToken is correct
                },

            });
            if (data.success) {
                toast.success('Appointments fetched successfully');
                dispatch(appointmentActions.initializeAppointments(data.message))
            } else {
                toast.error(data.error.message);
            }


        } catch (e) {
            toast.error('Error fetching appointments');
        }
    };

    const getDashboardData = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}api/admin/get-dashboard-data`, {
                headers: {
                    atoken: adminToken
                }
            });

            console.log(data)

            if (data.success) {
                console.log(data)
                setDashData(data.message)
            }
            else {
                console.log("error")
                toast.error("cant fetch dashboard data")
            }
        } catch (error) {
            toast.error('Error fetching dashboard data');
        }
    };



    useEffect(() => {
        fetchAllAppointments();
        getDashboardData();
    }, [adminToken, backendUrl]);

    return (
        <div>
            {children}
        </div>
    )
}

export default WrapperPage