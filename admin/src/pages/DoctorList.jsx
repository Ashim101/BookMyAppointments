import axios from 'axios'
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { doctorActions } from '../store/doctorSlice'
import { toast } from 'react-toastify'

const DoctorList = () => {
    const dispatch = useDispatch()
    const { backendUrl, adminToken } = useSelector(store => store.settings)
    const { doctors } = useSelector(store => store.doctor)
    const fetchDoctors = async () => {
        try {
            const response = await axios.get(`${backendUrl}api/admin/all-doctors`, {
                headers: { atoken: adminToken }
            });

            if (response.data.success) {
                dispatch(doctorActions.initializeDoctors(response.data.doctors));
            } else {
                toast.error("Failed to load doctors");
            }
        } catch (error) {
            toast.error("Error fetching doctors", error);
        }
    };

    useEffect(() => {

        fetchDoctors();
    }, [adminToken, backendUrl]);

    const handleOnChange = async (id) => {

        const response = await axios.patch(backendUrl + "api/admin/change-availability", { id }, {
            headers: {
                atoken: adminToken
            }
        })
        if (response.data.success) {
            toast.success(response.data.message)
            fetchDoctors()
        }
    }

    return (
        <div>
            <div className=' grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 '>
                {doctors.map((item, index) => (
                    <div onClick={() => { console.log("clicked") }} className='border-2 hover:translate-y-[-12px] transition-all duration-300 rounded-lg p-[2px] border-slate-400 '>
                        <div className='bg-slate-100 '>
                            <img src={item.image} alt="" className='h-56 md:h-auto' />


                        </div>
                        <div className='flex flex-col items-start  gap-1'>
                            <div className='flex mb-3 items-center gap-2 '>


                                <div className="flex">
                                    <input type="checkbox" name="availability" id="avail" checked={item.available} onClick={() => handleOnChange(item._id)} />
                                    <p>Available</p>

                                </div>
                            </div>
                            <p className='text-xl font-normal '>{item.name}</p>
                            <p className='font-light'>{item.speciality}</p>


                        </div>

                    </div>

                ))}

            </div>
        </div >
    )
}

export default DoctorList;
