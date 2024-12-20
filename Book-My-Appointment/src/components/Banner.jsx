import React from 'react'
import { assets } from '../assets/assets_frontend/assets'
import { useNavigate } from 'react-router-dom'

const Banner = () => {
    const navigate = useNavigate()
    return (
        <div className='bg-primary flex rounded-lg  mt-5 md:mt-60 md:pb-0 p-10 px-10 text-white  mx-auto justify-between md:h-full'>
            <div className='space-y-3 my-auto mx text-xl md:my-20 '>
                <div className='space-y-1' >
                    <p>
                        Book Appointment

                    </p>
                    <p>
                        with 100+ trusted doctors
                    </p>
                </div>
                <button onClick={() => navigate("/login")} className='border-2 border-slate-500 bg-white text-primary rounded-lg px-3 py-2'>Create account</button>


            </div>
            <div className='hidden sm:block w-1/3 relative  '>
                <img className='w-full absolute bottom-0 right-0' src={assets.appointment_img} alt="" />

            </div>
        </div>
    )
}

export default Banner