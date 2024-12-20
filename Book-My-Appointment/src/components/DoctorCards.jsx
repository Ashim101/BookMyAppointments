import React from 'react'
// import { doctors } from '../assets/assets_frontend/assets'
import { useNavigate } from 'react-router-dom'
import CircularSpinner from './Spinner'

const Doctors = ({ doctors }) => {
    const navigate = useNavigate()
    if (doctors.length == 0)
        return (
            <CircularSpinner />)
    return (
        <div >

            <div className=' grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 '>
                {doctors.map((item, index) => (
                    <div onClick={() => navigate(`/appointments/${item._id}`)} className='border-halka h-full hover:translate-y-[-12px] transition-all duration-300 rounded-lg p-[2px]  cursor-pointer flex flex-col items-center '>
                        <div className='bg-slate-100 h-[167px] w-full rounded-lg '>
                            <img src={item.image} alt="" className='w-full h-full object-cover' />


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
    )
}

export default Doctors