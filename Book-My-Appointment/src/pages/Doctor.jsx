import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom';
import Doctors from '../components/DoctorCards';


const Doctor = () => {
    const navigate = useNavigate()

    const { speciality } = useParams(); // Access the route param

    const doctors = useSelector(store => store.doctors);

    const [filterDoctors, setFilterDoctors] = useState([])

    const applyFilter = () => {
        if (speciality) {
            setFilterDoctors(doctors.filter(doc => doc.speciality === speciality))

        }
        else {
            setFilterDoctors(doctors)


        }
    }

    useEffect(() => {
        applyFilter();
    }, [doctors, speciality])


    return (
        <div>
            <div>
                <p className='text-sm font-light my-5'>
                    Browse through the doctors specialist.
                </p>
            </div>
            <div className='flex flex-col sm:flex-row gap-16 justify-between'>

                <div className=' flex flex-col gap-4 items-center'>
                    <p onClick={() => { speciality === "General physician" ? navigate("/doctors") : navigate("/doctors/General physician") }} className={`border-2 border-slate-300 rounded-lg px-3 py-2 cursor-pointer ${speciality === 'General physician' ? "text-white bg-slate-500" : "text-black bg-white "} w-1/2 sm:w-full `}>General physician</p>
                    <p onClick={() => { speciality === "Gynecologist" ? navigate("/doctors") : navigate("/doctors/Gynecologist") }} className={`border-2 border-slate-300 rounded-lg px-3 py-2 cursor-pointer ${speciality === 'Gynecologist' ? "text-white bg-slate-500" : "text-black bg-white"} w-1/2 sm:w-full`}>Gynecologist</p>
                    <p onClick={() => { speciality === "Dermatologist" ? navigate("/doctors") : navigate("/doctors/Dermatologist") }} className={`border-2 border-slate-300 rounded-lg px-3 py-2 cursor-pointer ${speciality === 'Dermatologist' ? "text-white bg-slate-500" : "text-black bg-white"} w-1/2 sm:w-full`}>Dermatologist</p>
                    <p onClick={() => { speciality === "Pediatricians" ? navigate("/doctors") : navigate("/doctors/Pediatricians") }} className={`border-2 border-slate-300 rounded-lg px-4 py-2 cursor-pointer ${speciality === 'Pediatricians' ? "text-white bg-slate-500" : "text-black bg-white"} w-1/2 sm:w-full`}>Pediatricians</p>
                    <p onClick={() => { speciality === "Neurologist" ? navigate("/doctors") : navigate("/doctors/Neurologist") }} className={`border-2 border-slate-300 rounded-lg px-4 py-2 cursor-pointer ${speciality === 'Neurologist' ? "text-white bg-slate-500" : "text-black bg-white"} w-1/2 sm:w-full`}>Neurologist</p>
                    <p onClick={() => { speciality === "Gastroenterologist" ? navigate("/doctors") : navigate("/doctors/Gastroenterologist") }} className={`border-2 border-slate-300 rounded-lg px-4 py-2 cursor-pointer ${speciality === 'Gastroenterologist' ? "text-white bg-slate-500" : "text-black bg-white"} w-1/2 sm:w-full`}>Gastroenterologist</p>
                </div>
                <div className='w-full'>
                    <Doctors doctors={filterDoctors} />

                </div>

            </div>

        </div>
    )
}

export default Doctor