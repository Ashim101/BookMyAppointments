import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom';

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
                    <div className=' grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 w-full'>
                        {filterDoctors.map((item, index) => (
                            <div onClick={() => navigate(`/appointments/${item._id}`)} className='border-2 hover:translate-y-[-12px] transition-all duration-300 rounded-lg p-[2px] border-slate-300 cursor-pointer '>
                                <div className='bg-slate-100 '>
                                    <img src={item.image} alt="" className='h-56 md:h-auto' />


                                </div>
                                <div className='flex flex-col items-start  gap-1'>
                                    <div className='flex mb-3 items-center gap-2 '>

                                        <p className={`${item.available ? 'bg-green-500' : 'bg-gray-500'}  h-2 w-2 rounded-full`}></p>
                                        <p className={`${item.available ? 'text-green-500' : 'text-gray-500'}  `}>{item.available ? "Available" : "Not Available"}</p>
                                    </div>
                                    <p className='text-xl font-normal '>{item.name}</p>
                                    <p className='font-light'>{item.speciality}</p>


                                </div>

                            </div>

                        ))}

                    </div>
                </div>

            </div>

        </div>
    )
}

export default Doctor